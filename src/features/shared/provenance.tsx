import { Calculator, Download, Gauge, MessageCircle, Sigma } from 'lucide-react';
import { type ProvenanceVM } from '@/contracts/shared';
import { formatDate } from '@/domain/format';
import { DATA_ORIGIN_INFO, DATA_ORIGINS, type DataOrigin } from '@/domain/measurement';
import { Badge, type BadgeTone } from '@/ui/badge';

const STYLE: Record<DataOrigin, { tone: BadgeTone; icon: React.ReactNode }> = {
  direct: { tone: 'leaf', icon: <Gauge /> },
  calculated: { tone: 'sky', icon: <Calculator /> },
  estimated: { tone: 'plum', icon: <Sigma /> },
  imported: { tone: 'sun', icon: <Download /> },
  self_reported: { tone: 'coral', icon: <MessageCircle /> },
};

/** Etiqueta visible del origen del dato (medido, calculado, estimado, importado o declarado). */
export function OriginBadge({ origin }: { origin: DataOrigin }) {
  const { tone, icon } = STYLE[origin];
  return (
    <Badge tone={tone} icon={icon} title={DATA_ORIGIN_INFO[origin].description}>
      {DATA_ORIGIN_INFO[origin].label}
    </Badge>
  );
}

/** Ficha completa de procedencia: método, instrumento, fórmula, origen y fecha. */
export function ProvenanceDetails({ provenance }: { provenance: ProvenanceVM }) {
  const rows: [string, string | null][] = [
    ['Método', provenance.method],
    ['Instrumento', provenance.instrument],
    ['Fórmula', provenance.formula],
    ['Procedencia', provenance.importedFrom],
    ['Fecha de medición', formatDate(provenance.measuredOn, 'dayMonth')],
  ];
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
      {rows
        .filter((row): row is [string, string] => row[1] !== null)
        .map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="font-semibold text-ink-500">{label}</dt>
            <dd className="text-ink-700">{value}</dd>
          </div>
        ))}
    </dl>
  );
}

/** Leyenda con los cinco orígenes posibles de un dato. */
export function OriginLegend() {
  return (
    <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {DATA_ORIGINS.map((origin) => (
        <li
          key={origin}
          className="flex flex-col items-start gap-1.5 rounded-2xl bg-cream-50 p-3 ring-1 ring-line"
        >
          <OriginBadge origin={origin} />
          <span className="text-xs leading-relaxed text-ink-500">
            {DATA_ORIGIN_INFO[origin].description}
          </span>
        </li>
      ))}
    </ul>
  );
}
