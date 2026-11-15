import { describe, expect, it } from 'vitest';
import {
  canAccessClient,
  canAnalyzeClient,
  canAnalyzeSession,
  canEditSession,
  canManageDemoData,
  canPlanForClient,
  canReadResource,
  canViewSession,
  defaultSharing,
  visibleAssessmentTestIds,
  type Actor,
  type SharingSettings,
} from './access';

const marta = { id: 'c-marta', trainerId: 't-alex' };
const otherClient = { id: 'c-otro', trainerId: 't-alex' };
const foreignClient = { id: 'c-ajeno', trainerId: 't-otro' };

const trainer: Actor = { role: 'trainer', trainerId: 't-alex' };
const otherTrainer: Actor = { role: 'trainer', trainerId: 't-otro' };
const martaActor: Actor = { role: 'client', clientId: 'c-marta', trainerId: 't-alex' };

const sharing: SharingSettings = {
  clientId: 'c-marta',
  assessments: { enabled: true, testIds: ['cmj'] },
  volume: true,
  rehab: false,
  reports: false,
};

describe('control de acceso', () => {
  it('un entrenador solo accede a sus propios clientes', () => {
    expect(canAccessClient(trainer, marta)).toBe(true);
    expect(canAccessClient(trainer, foreignClient)).toBe(false);
    expect(canAccessClient(otherTrainer, marta)).toBe(false);
  });

  it('un cliente solo accede a sí mismo', () => {
    expect(canAccessClient(martaActor, marta)).toBe(true);
    expect(canAccessClient(martaActor, otherClient)).toBe(false);
  });

  it('el cliente ve su plan y sus registros, pero nunca las notas privadas del entrenador', () => {
    expect(canReadResource(martaActor, marta, 'plan', null)).toBe(true);
    expect(canReadResource(martaActor, marta, 'own_logs', null)).toBe(true);
    expect(canReadResource(martaActor, marta, 'trainer_notes', sharing)).toBe(false);
    expect(canReadResource(trainer, marta, 'trainer_notes', null)).toBe(true);
  });

  it('el resto de módulos solo se ven si el entrenador los comparte', () => {
    expect(canReadResource(martaActor, marta, 'volume', sharing)).toBe(true);
    expect(canReadResource(martaActor, marta, 'rehab', sharing)).toBe(false);
    expect(canReadResource(martaActor, marta, 'volume', defaultSharing('c-marta'))).toBe(false);
    expect(canReadResource(martaActor, marta, 'volume', null)).toBe(false);
  });

  it('ignora una configuración de compartición que pertenece a otro cliente', () => {
    const misplaced = { ...sharing, clientId: 'c-otro' };
    expect(canReadResource(martaActor, marta, 'volume', misplaced)).toBe(false);
  });

  it('limita las evaluaciones visibles a las pruebas compartidas', () => {
    expect(visibleAssessmentTestIds(trainer, marta, null)).toBe('all');
    expect([...(visibleAssessmentTestIds(martaActor, marta, sharing) as Set<string>)]).toEqual([
      'cmj',
    ]);
    expect((visibleAssessmentTestIds(martaActor, otherClient, sharing) as Set<string>).size).toBe(
      0,
    );
  });
});

describe('sesiones de entrenamiento (V1)', () => {
  const draftOfMarta = { clientId: 'c-marta', trainerId: 't-alex', status: 'draft' as const };
  const publishedOfMarta = { ...draftOfMarta, status: 'published' as const };
  const admin: Actor = { role: 'admin', adminId: 'adm-1' };

  it('solo el entrenador del cliente planifica y edita sus sesiones', () => {
    expect(canPlanForClient(trainer, marta)).toBe(true);
    expect(canEditSession(trainer, draftOfMarta, marta)).toBe(true);
    // Intentos no autorizados: otro entrenador, el propio cliente y la administración.
    expect(canPlanForClient(otherTrainer, marta)).toBe(false);
    expect(canEditSession(otherTrainer, draftOfMarta, marta)).toBe(false);
    expect(canPlanForClient(martaActor, marta)).toBe(false);
    expect(canEditSession(martaActor, draftOfMarta, marta)).toBe(false);
    expect(canEditSession(admin, draftOfMarta, marta)).toBe(false);
  });

  it('una sesión que no es de ese cliente o de ese entrenador no se edita', () => {
    expect(canEditSession(trainer, { ...draftOfMarta, clientId: 'c-otro' }, marta)).toBe(false);
    expect(canEditSession(trainer, { ...draftOfMarta, trainerId: 't-otro' }, marta)).toBe(false);
  });

  it('el cliente solo ve sus sesiones publicadas; nunca los borradores ni las de otros', () => {
    expect(canViewSession(martaActor, publishedOfMarta, marta)).toBe(true);
    expect(canViewSession(martaActor, draftOfMarta, marta)).toBe(false);
    const otherClientActor: Actor = { role: 'client', clientId: 'c-otro', trainerId: 't-alex' };
    expect(canViewSession(otherClientActor, publishedOfMarta, marta)).toBe(false);
    expect(
      canViewSession(martaActor, { ...publishedOfMarta, clientId: 'c-otro' }, otherClient),
    ).toBe(false);
  });

  it('el entrenador ve también los borradores de sus clientes, pero no los de otro entrenador', () => {
    expect(canViewSession(trainer, draftOfMarta, marta)).toBe(true);
    expect(canViewSession(otherTrainer, publishedOfMarta, marta)).toBe(false);
    expect(canViewSession(admin, publishedOfMarta, marta)).toBe(false);
  });
});

describe('análisis de la sesión (B3.1)', () => {
  const publishedOfMarta = {
    clientId: 'c-marta',
    trainerId: 't-alex',
    status: 'published' as const,
  };
  const draftOfMarta = { ...publishedOfMarta, status: 'draft' as const };
  const admin: Actor = { role: 'admin', adminId: 'adm-1' };

  it('solo el entrenador del cliente analiza sus sesiones publicadas', () => {
    expect(canAnalyzeSession(trainer, publishedOfMarta, marta)).toBe(true);
    expect(canAnalyzeClient(trainer, marta)).toBe(true);
    // Un borrador no tiene ejecución que analizar.
    expect(canAnalyzeSession(trainer, draftOfMarta, marta)).toBe(false);
  });

  it('intentos no autorizados: otro entrenador, la propia clienta, otra clienta y la administración', () => {
    const otherClientActor: Actor = { role: 'client', clientId: 'c-otro', trainerId: 't-alex' };
    for (const actor of [otherTrainer, martaActor, otherClientActor, admin]) {
      expect(canAnalyzeSession(actor, publishedOfMarta, marta)).toBe(false);
      expect(canAnalyzeClient(actor, marta)).toBe(false);
    }
    // Una sesión que no es de ese cliente.
    expect(canAnalyzeSession(trainer, { ...publishedOfMarta, clientId: 'c-otro' }, marta)).toBe(
      false,
    );
    expect(canAnalyzeClient(trainer, foreignClient)).toBe(false);
  });
});

describe('datos de la demostración', () => {
  it('solo un entrenador hace copias o restablece los datos; un cliente no', () => {
    expect(canManageDemoData(trainer)).toBe(true);
    expect(canManageDemoData(martaActor)).toBe(false);
    expect(canManageDemoData({ role: 'admin', adminId: 'adm-1' })).toBe(false);
  });
});
