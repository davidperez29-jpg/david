import Link from 'next/link';
import { listScienceTaxonomies } from '@tp/application';
import { Card } from '@/components/ui/card';
import { requireStaff } from '@/server/session';
import { ClaimForm } from '../../science-forms';
import { allFindings } from '../../findings';

export default async function NewClaimPage({
  searchParams,
}: {
  searchParams: Promise<{ finding?: string }>;
}) {
  const ctx = await requireStaff();
  const { finding } = await searchParams;
  const [tax, findings] = await Promise.all([listScienceTaxonomies(ctx), allFindings(ctx)]);
  return (
    <div className="flex flex-col gap-4">
      <Link href="/app/science/claims" className="text-sm text-muted hover:underline">
        ← Afirmaciones
      </Link>
      <Card title="Nueva afirmación">
        <ClaimForm
          findings={findings}
          populations={tax.populations}
          initialFindingIds={finding ? [finding] : []}
        />
      </Card>
    </div>
  );
}
