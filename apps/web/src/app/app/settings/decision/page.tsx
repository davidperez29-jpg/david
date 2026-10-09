import Link from 'next/link';
import { getDecisionRules } from '@tp/application';
import { DecisionRulesEditor } from '@/components/decision/actions';
import { formatDateTime } from '@/lib/labels';
import { requireStaff } from '@/server/session';

export default async function DecisionRulesPage() {
  const ctx = await requireStaff();
  const r = await getDecisionRules(ctx);
  const pending = r.rules.filter((x) => x.pending);
  return (
    <div className="flex max-w-4xl flex-col gap-4">
      <Link href="/app/settings" className="text-sm text-muted hover:underline">
        ← Ajustes
      </Link>
      <h1 className="text-2xl font-semibold">Reglas del motor de decisión</h1>
      <p className="text-sm text-muted">
        {r.version
          ? `Versión ${r.version} del centro${r.publishedAt ? `, publicada el ${formatDateTime(r.publishedAt)}` : ''}.`
          : 'Valores por defecto de la plataforma (el centro aún no los ha cambiado).'}{' '}
        Las reglas son datos: cada una enlaza sus afirmaciones científicas, su nivel de evidencia y
        sus limitaciones. Los umbrales del perfil no tienen valor por defecto: los fija el centro
        para su población (nivel F), con valores generales y, si hace falta, valores por población
        (sexo, edad, experiencia o deporte). Cada cambio crea una versión nueva y las propuestas
        guardan la versión con la que se calcularon. El entrenador decide siempre; los rechazos y
        cambios por regla ayudan a detectar reglas mal calibradas.
      </p>
      {pending.length ? (
        <p className="rounded-md border border-warn p-3 text-sm">
          {pending.length === 1 ? 'Hay 1 regla' : `Hay ${pending.length} reglas`} con parámetros
          generales sin definir (
          {pending
            .map((p) =>
              p.variants.length
                ? `${p.key}, con valores para ${p.variants.map((v) => v.population).join('; ')}`
                : p.key,
            )
            .join(' · ')}
          ). Para los clientes sin valor aplicable, el motor lo indica y usa una referencia
          verificada aplicable o la valoración manual del entrenador.
        </p>
      ) : null}
      <DecisionRulesEditor
        rules={r.rules}
        sports={r.sports}
        editable={ctx.actor.roles.includes('ADMIN')}
      />
    </div>
  );
}
