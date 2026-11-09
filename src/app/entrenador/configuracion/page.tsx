import { Database, Globe, Lock, Plug, Ruler, UserRound } from 'lucide-react';
import { type Metadata } from 'next';
import { Badge } from '@/ui/badge';
import { Card, CardHeader } from '@/ui/card';
import { PageHeader } from '@/ui/page-header';
import { getTrainerContext } from '@/server/context';
import { readServerEnv } from '@/server/env';

export const metadata: Metadata = { title: 'Configuración' };

export default async function SettingsPage() {
  await getTrainerContext();
  const env = readServerEnv();
  const sections = [
    {
      icon: <UserRound className="size-5" />,
      title: 'Cuenta',
      rows: [['Acceso', 'Sesión de demostración, sin autenticación real'] as const],
      status: 'Pendiente',
    },
    {
      icon: <Lock className="size-5" />,
      title: 'Privacidad',
      rows: [
        ['Compartir con clientes nuevos', 'Nada compartido por defecto'],
        ['Datos de salud', 'Solo el entrenador responsable'],
      ] as const,
      status: 'Reglas listas, sin login real',
    },
    {
      icon: <Database className="size-5" />,
      title: 'Datos',
      rows: [
        ['Fuente de datos', 'SQLite local (datos ficticios)'],
        ['Persistencia', 'En este equipo, en la carpeta de datos'],
      ] as const,
      status: 'Demo',
    },
    {
      icon: <Globe className="size-5" />,
      title: 'Región y formato',
      rows: [
        ['Zona horaria', env.timeZone],
        ['Idioma', 'Español (España)'],
      ] as const,
      status: 'Aplicado',
    },
    {
      icon: <Ruler className="size-5" />,
      title: 'Unidades',
      rows: [['Sistema', 'Métrico (kg, cm, m, s)'] as const],
      status: 'Aplicado',
    },
    {
      icon: <Plug className="size-5" />,
      title: 'Integraciones',
      rows: [['Dispositivos y servicios externos', 'Ninguno conectado'] as const],
      status: 'Pendiente',
    },
  ];

  return (
    <>
      <PageHeader
        title="Configuración"
        description="Ajustes de la cuenta, la privacidad y los datos. En esta fase solo se pueden consultar."
      />
      <div className="grid gap-5 md:grid-cols-2">
        {sections.map((section) => (
          <Card key={section.title}>
            <CardHeader
              as="h2"
              icon={section.icon}
              title={section.title}
              action={
                <Badge
                  tone={
                    section.status === 'Aplicado'
                      ? 'leaf'
                      : section.status === 'Pendiente'
                        ? 'outline'
                        : 'sun'
                  }
                >
                  {section.status}
                </Badge>
              }
            />
            <dl className="space-y-2 text-sm">
              {section.rows.map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 border-t border-line pt-2">
                  <dt className="text-ink-500">{label}</dt>
                  <dd className="text-right font-semibold text-ink-900">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>
        ))}
      </div>
    </>
  );
}
