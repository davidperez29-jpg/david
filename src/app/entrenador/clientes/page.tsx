import { type Metadata } from 'next';
import { ClientList } from '@/features/trainer/client-list';
import { Notice } from '@/ui/notice';
import { PageHeader } from '@/ui/page-header';
import { Info } from 'lucide-react';
import { getTrainerContext } from '@/server/context';
import { listTrainerClients } from '@/server/services/trainer';

export const metadata: Metadata = { title: 'Clientes' };

export default async function ClientsPage() {
  const ctx = await getTrainerContext();
  const clients = await listTrainerClients(ctx);
  return (
    <>
      <PageHeader title="Clientes" description="Tus clientes, su objetivo y su próxima sesión." />
      <ClientList clients={clients} today={ctx.today} />
      <Notice className="mt-8" icon={<Info />} title="Alta y edición de clientes">
        Llegarán junto con la base de datos y la autenticación. Entonces se pedirán solo los datos
        necesarios (minimización) y los de salud se guardarán aparte, con acceso restringido.
      </Notice>
    </>
  );
}
