import Link from 'next/link';
import { listFormulas } from '@tp/application';
import { FormulaConstantsForm, NewFormulaForm } from '@/components/assessment/formula-forms';
import { Badge, Card } from '@/components/ui/card';
import { requireStaff } from '@/server/session';

/**
 * Fórmulas y constantes (restructure phase 4): derived metrics are data. The centre can use its
 * own constants (e.g. the club's Faulkner a and b) or add formulas; nothing is a black box.
 */
export default async function FormulasPage() {
  const ctx = await requireStaff();
  const formulas = await listFormulas(ctx);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/app/assessments" className="text-sm text-muted hover:underline">
          ← Tests
        </Link>
        <h1 className="text-2xl font-semibold">Fórmulas y constantes</h1>
      </div>
      <p className="text-sm text-muted">
        Las métricas derivadas (IMC, Σ pliegues, % graso, masa grasa…) se calculan con estas
        fórmulas al guardar una evaluación. Cambiar una constante afecta a los cálculos nuevos de tu
        centro; los valores ya calculados conservan la fórmula con la que se calcularon.
      </p>
      <ul className="flex flex-col gap-3">
        {formulas.map((f) => (
          <li key={f.slug}>
            <Card
              title={
                <span className="flex flex-wrap items-center gap-2">
                  {f.name}
                  {f.unit ? (
                    <span className="text-xs font-normal text-muted">({f.unit})</span>
                  ) : null}
                  {f.isEstimate ? <Badge tone="warn">Estimación</Badge> : null}
                  {f.sex ? (
                    <Badge>{f.sex === 'male' ? 'Solo hombres' : 'Solo mujeres'}</Badge>
                  ) : null}
                  {f.own ? <Badge tone="accent">Del centro</Badge> : null}
                </span>
              }
            >
              <p className="text-sm">{f.definition}</p>
              <p className="mt-1 font-mono text-xs text-muted">
                {f.slug} = {f.text}
              </p>
              {Object.keys(f.constants).length ? (
                <div className="mt-3">
                  <FormulaConstantsForm f={f} />
                  {f.own && f.platformConstants ? (
                    <p className="mt-1 text-xs text-muted">
                      De la plataforma:{' '}
                      {Object.entries(f.platformConstants)
                        .map(([k, v]) => `${k} = ${String(v).replace('.', ',')}`)
                        .join(' · ')}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </Card>
          </li>
        ))}
      </ul>
      <Card title="Nueva fórmula del centro">
        <p className="mb-3 text-xs text-muted">
          Usa los identificadores de los tests (p. ej. <code>body_mass</code>,{' '}
          <code>skinfold_triceps</code>, <code>single_leg_cmj_height.left</code>) y de otras
          fórmulas; operaciones + − × / ^ y paréntesis; funciones sum, mean, min, max, abs y sqrt.
          Si falta un dato, la fórmula no da valor (nunca un cero).
        </p>
        <NewFormulaForm />
      </Card>
    </div>
  );
}
