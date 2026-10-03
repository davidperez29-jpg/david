import { scientificQaReport } from '@tp/application';
import { LevelBadge, QaList } from '@/components/science/evidence';
import { Card, Stat } from '@/components/ui/card';
import { requireStaff } from '@/server/session';

export default async function QaPage() {
  const ctx = await requireStaff();
  const r = await scientificQaReport(ctx);
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-5">
        <Stat label="Fuentes" value={r.totals.sources} />
        <Stat label="Verificadas" value={r.totals.verifiedSources} />
        <Stat label="Hallazgos" value={r.totals.findings} />
        <Stat label="Afirmaciones" value={r.totals.claims} />
        <Stat label="Publicadas" value={r.totals.publishedClaims} />
      </div>
      <Card title="Afirmaciones por nivel de evidencia">
        <ul className="flex flex-wrap gap-3 text-sm">
          {(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const).map((l) => (
            <li key={l} className="flex items-center gap-1">
              <LevelBadge level={l} /> <span className="tabular-nums">{r.claimLevels[l] ?? 0}</span>
            </li>
          ))}
        </ul>
      </Card>
      <Card title={`Errores que bloquean la publicación (${r.errors.length})`}>
        <QaList issues={r.errors} empty="Sin errores." />
      </Card>
      <Card title={`Avisos para revisar (${r.warnings.length})`}>
        <QaList issues={r.warnings} empty="Sin avisos." />
      </Card>
    </div>
  );
}
