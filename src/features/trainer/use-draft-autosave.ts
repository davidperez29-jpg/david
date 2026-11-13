'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type PublishOutcome,
  type SaveDraftOutcome,
  type SessionBuilderVM,
} from '@/contracts/sessions';
import { type Issue } from '@/domain/issues';
import { normalizeContent, sameContent, type SessionContent } from '@/domain/training/session-v2';
import {
  browserStore,
  type DraftBackup,
  draftBackupKey,
  readDraftBackup,
  removeDraftBackup,
  writeDraftBackup,
} from './draft-backup';

/**
 * Guardado del constructor sin pérdidas (docs/AUDIT_BLOCK1.md A-05, A-06 y A-07):
 *
 * - GUARDADO AUTOMÁTICO 2 s después del último cambio. Un solo guardado a la vez: si hay cambios
 *   mientras se guarda, se guardan después. Cada respuesta solo da por guardado el contenido que
 *   ENVIÓ (nunca uno posterior), así que una respuesta antigua no puede pisar cambios recientes.
 * - «Borrador guardado» solo cuando el servidor lo confirma.
 * - Un error (base ocupada, sin conexión, error del servidor) NO borra nada: el contenido sigue en
 *   pantalla y en la copia local, y se reintenta (automáticamente si es recuperable).
 * - COPIA LOCAL de lo que aún no ha confirmado el servidor (por entrenador, cliente y sesión). Al
 *   volver se ofrece recuperarla; si el servidor tiene una revisión posterior, se avisa y la
 *   persona decide: nunca se sustituye nada en silencio.
 */
export type DraftStatus =
  | 'saved' // lo de la pantalla es lo que tiene el servidor
  | 'pending' // hay cambios que se guardarán en un momento
  | 'saving'
  | 'error' // no se pudo guardar; se reintenta
  | 'conflict' // otra pestaña guardó antes: no se pisa
  | 'invalid' // el servidor señala datos que corregir
  | 'blocked'; // ya no es un borrador editable (publicado o eliminado)

type DraftInput = { sessionId: string; expectedRevision: number; content: unknown };

export const AUTOSAVE_DELAY_MS = 2000;
const RETRY_DELAY_MS = 5000;

const FAILURE_TEXT: Record<string, string> = {
  storage_busy: 'la base de datos está ocupada en este momento',
  storage_unavailable: 'la base de datos no está disponible ahora mismo',
  storage_error: 'ha habido un error de almacenamiento en el servidor',
  server_error: 'ha habido un error inesperado en el servidor',
  network: 'no hay conexión con el servidor',
};
const RETRYABLE = new Set(['storage_busy', 'storage_unavailable', 'network', 'server_error']);

const same = (a: SessionContent, b: SessionContent) =>
  sameContent(normalizeContent(a), normalizeContent(b));

export interface DraftRecovery {
  savedAt: string;
  /** El servidor tiene una revisión posterior a la de la copia (se guardó en otro sitio). */
  newerOnServer: boolean;
}

export function useDraftAutosave({
  vm,
  content,
  setContent,
  saveAction,
  publishAction,
}: {
  vm: SessionBuilderVM;
  content: SessionContent;
  setContent: (content: SessionContent) => void;
  saveAction: (input: DraftInput) => Promise<SaveDraftOutcome>;
  publishAction: (input: DraftInput) => Promise<PublishOutcome>;
}) {
  const [saved, setSaved] = useState<SessionContent>(vm.content);
  const [savedAt, setSavedAt] = useState(vm.updatedAt);
  const [status, setStatus] = useState<DraftStatus>('saved');
  const [failure, setFailure] = useState<string | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [recovery, setRecovery] = useState<DraftRecovery | null>(null);
  const [localCopy, setLocalCopy] = useState<'none' | 'kept' | 'unavailable'>('none');

  const store = useMemo(() => (typeof window === 'undefined' ? null : browserStore()), []);
  const contentRef = useRef(content);
  const savedRef = useRef(vm.content);
  const revisionRef = useRef(vm.revision);
  const inFlight = useRef<Promise<boolean> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backupRef = useRef<DraftBackup | null>(null);
  const statusRef = useRef<DraftStatus>('saved');
  useEffect(() => {
    contentRef.current = content;
  }, [content]);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const dirty = !same(content, saved);
  /** El último `performSave` (para reintentos y guardados encadenados sin autorreferencia). */
  const performSaveRef = useRef<() => Promise<boolean>>(async () => false);

  // Al abrir: ¿hay una copia local de esta persona, cliente y sesión con cambios sin confirmar?
  useEffect(() => {
    const backup = readDraftBackup(store, vm.trainerId, vm.clientId, vm.sessionId);
    if (backup && !same(backup.content, vm.content)) {
      backupRef.current = backup;
      // Sincroniza con un sistema externo (el almacén del navegador) al abrir.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRecovery({ savedAt: backup.savedAt, newerOnServer: backup.baseRevision !== vm.revision });
    } else if (backup) {
      removeDraftBackup(store, vm.trainerId, vm.clientId, vm.sessionId);
    }
    // Solo al abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // La copia es una por persona, cliente y sesión en este navegador: otra pestaña abierta sobre
  // el mismo borrador puede cambiarla o borrarla (al guardarse) mientras aquí se decide qué hacer.
  // El aviso refleja siempre la copia que hay ahora; si ya no hay nada pendiente, se retira y se
  // puede editar. (Si el servidor tiene después una revisión posterior, guardar dará conflicto.)
  useEffect(() => {
    if (!recovery) return;
    const key = draftBackupKey(vm.trainerId, vm.clientId, vm.sessionId);
    const onStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== key) return;
      const backup = readDraftBackup(store, vm.trainerId, vm.clientId, vm.sessionId);
      if (!backup || same(backup.content, vm.content)) {
        backupRef.current = null;
        setRecovery(null);
        return;
      }
      backupRef.current = backup;
      setRecovery({
        savedAt: backup.savedAt,
        newerOnServer: backup.baseRevision !== revisionRef.current,
      });
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [recovery, store, vm.clientId, vm.content, vm.sessionId, vm.trainerId]);

  /** Guarda lo que hay en pantalla. Devuelve si el servidor confirmó ese contenido. */
  const performSave = useCallback(async (): Promise<boolean> => {
    if (timer.current) clearTimeout(timer.current);
    // Un guardado a la vez: si hay uno en curso, se espera y después se guarda lo que quede.
    if (inFlight.current) {
      await inFlight.current;
      return performSaveRef.current();
    }
    const snapshot = contentRef.current;
    if (same(snapshot, savedRef.current) && statusRef.current !== 'error') {
      return true;
    }
    const run = (async () => {
      setStatus('saving');
      let outcome: SaveDraftOutcome | { ok: false; reason: 'network' };
      try {
        outcome = await saveAction({
          sessionId: vm.sessionId,
          expectedRevision: revisionRef.current,
          content: snapshot,
        });
      } catch {
        outcome = { ok: false, reason: 'network' };
      }
      if (outcome.ok) {
        revisionRef.current = outcome.revision;
        savedRef.current = snapshot;
        setSaved(snapshot);
        setSavedAt(outcome.updatedAt);
        setIssues([]);
        setFailure(null);
        const pending = !same(contentRef.current, snapshot);
        setStatus(pending ? 'pending' : 'saved');
        if (!pending) {
          removeDraftBackup(store, vm.trainerId, vm.clientId, vm.sessionId);
          setLocalCopy('none');
        }
        return true;
      }
      switch (outcome.reason) {
        case 'conflict':
          setStatus('conflict');
          break;
        case 'invalid':
          setIssues(outcome.issues);
          setStatus('invalid');
          break;
        case 'not_found':
        case 'not_editable':
          setStatus('blocked');
          break;
        default:
          setFailure(outcome.reason);
          setStatus('error');
          if (RETRYABLE.has(outcome.reason)) {
            timer.current = setTimeout(() => void performSaveRef.current(), RETRY_DELAY_MS);
          }
      }
      return false;
    })();
    inFlight.current = run;
    try {
      return await run;
    } finally {
      inFlight.current = null;
    }
  }, [saveAction, store, vm.clientId, vm.sessionId, vm.trainerId]);
  useEffect(() => {
    performSaveRef.current = performSave;
  }, [performSave]);

  // Cada cambio: copia local inmediata y guardado automático a los 2 s.
  useEffect(() => {
    if (!dirty || recovery) return;
    const backup: DraftBackup = {
      trainerId: vm.trainerId,
      content,
      baseRevision: revisionRef.current,
      savedAt: new Date().toISOString(),
    };
    // El almacén del navegador es un sistema externo: se refleja si se ha podido escribir.
    setLocalCopy(
      writeDraftBackup(store, vm.clientId, vm.sessionId, backup) ? 'kept' : 'unavailable',
    );
    if (statusRef.current === 'conflict' || statusRef.current === 'blocked') return;
    if (statusRef.current !== 'saving') setStatus('pending');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void performSaveRef.current(), AUTOSAVE_DELAY_MS);
  }, [content, dirty, recovery, store, vm.clientId, vm.sessionId, vm.trainerId]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  /** Publicar: espera a que termine cualquier guardado y usa la revisión más reciente. */
  const publish = useCallback(async (): Promise<PublishOutcome | null> => {
    if (timer.current) clearTimeout(timer.current);
    if (inFlight.current) await inFlight.current;
    setStatus('saving');
    let outcome: PublishOutcome | { ok: false; reason: 'network' };
    try {
      outcome = await publishAction({
        sessionId: vm.sessionId,
        expectedRevision: revisionRef.current,
        content: contentRef.current,
      });
    } catch {
      outcome = { ok: false, reason: 'network' };
    }
    if (outcome.ok) {
      savedRef.current = contentRef.current;
      setSaved(contentRef.current);
      setStatus('saved');
      removeDraftBackup(store, vm.trainerId, vm.clientId, vm.sessionId);
      return outcome;
    }
    if (outcome.reason === 'conflict') setStatus('conflict');
    else if (outcome.reason === 'invalid') {
      setIssues(outcome.issues);
      setStatus('invalid');
    } else if (outcome.reason === 'not_found' || outcome.reason === 'not_editable') {
      setStatus('blocked');
    } else {
      setFailure(outcome.reason);
      setStatus('error');
    }
    return null;
  }, [publishAction, store, vm.clientId, vm.sessionId, vm.trainerId]);

  /** Recuperar la copia local (decisión explícita de la persona). */
  const recover = useCallback(() => {
    const backup = backupRef.current;
    setRecovery(null);
    if (!backup) return;
    // Si el servidor tiene una revisión posterior, la persona ha elegido su copia: se guarda
    // sobre la revisión actual del servidor (lo ha decidido ella, no se hace en silencio).
    setContent(backup.content);
  }, [setContent]);

  const discardRecovery = useCallback(() => {
    removeDraftBackup(store, vm.trainerId, vm.clientId, vm.sessionId);
    backupRef.current = null;
    setRecovery(null);
  }, [store, vm.clientId, vm.sessionId, vm.trainerId]);

  const unsafe = dirty || status === 'saving' || status === 'error';

  return {
    status,
    savedAt,
    dirty,
    unsafe,
    issues,
    failureText: failure ? (FAILURE_TEXT[failure] ?? failure) : null,
    localCopy,
    recovery,
    saveNow: () => performSave(),
    publish,
    recover,
    discardRecovery,
  };
}
