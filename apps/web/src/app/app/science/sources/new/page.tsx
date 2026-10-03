import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { requireStaff } from '@/server/session';
import { SourceForm } from '../../science-forms';

export default async function NewSourcePage() {
  await requireStaff();
  return (
    <div className="flex flex-col gap-4">
      <Link href="/app/science/sources" className="text-sm text-muted hover:underline">
        ← Fuentes
      </Link>
      <Card title="Nueva fuente">
        <SourceForm />
      </Card>
    </div>
  );
}
