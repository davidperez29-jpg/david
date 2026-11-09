import {
  ArrowRight,
  ChartColumn,
  ClipboardCheck,
  Lightbulb,
  ListChecks,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  UserPlus,
  CalendarDays,
  Microscope,
} from 'lucide-react';
import { HeroIllustration } from '@/features/brand/illustrations';
import { Logo } from '@/features/brand/logo';
import { DemoBanner } from '@/features/shared/demo-banner';
import { Badge } from '@/ui/badge';
import { Notice } from '@/ui/notice';
import { getDemoEntry } from '@/server/context';
import { enterAs } from './actions';

const CYCLE = [
  { icon: UserPlus, label: 'Crear cliente' },
  { icon: ClipboardCheck, label: 'Evaluar' },
  { icon: Lightbulb, label: 'Interpretar' },
  { icon: CalendarDays, label: 'Planificar' },
  { icon: ListChecks, label: 'Registrar' },
  { icon: ChartColumn, label: 'Analizar' },
  { icon: RefreshCw, label: 'Ajustar' },
];

const PRINCIPLES = [
  {
    icon: Microscope,
    title: 'Rigor y trazabilidad',
    text: 'Cada dato indica si es una medición, un cálculo, una estimación, una importación o una autodeclaración.',
  },
  {
    icon: ShieldCheck,
    title: 'Privacidad por defecto',
    text: 'El cliente solo ve lo que su entrenador decide compartir. Los datos de salud tienen acceso restringido.',
  },
  {
    icon: Smartphone,
    title: 'Pensada para el móvil',
    text: 'El cliente abre la app y encuentra su sesión de hoy. Se podrá instalar desde el navegador.',
  },
];

export default async function HomePage() {
  const entry = await getDemoEntry();
  const trainer = entry.choices.filter((c) => c.role === 'trainer');
  const clients = entry.choices.filter((c) => c.role === 'client');
  return (
    <>
      <DemoBanner />
      <div className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <header className="flex items-center justify-between py-5">
          <Logo />
          <Badge tone="sun">V1 · prototipo local</Badge>
        </header>

        <main id="contenido">
          <section className="grid items-center gap-8 py-6 md:grid-cols-[1.1fr_0.9fr] md:py-12">
            <div>
              <h1 className="text-4xl font-extrabold leading-[1.05] text-ink-900 sm:text-5xl lg:text-6xl">
                Entrena con criterio.{' '}
                <span className="relative whitespace-nowrap">
                  <span className="relative z-10">Acompaña</span>
                  <span
                    aria-hidden
                    className="absolute inset-x-0 bottom-1 -z-0 h-4 rounded-full bg-sun-300"
                  />
                </span>{' '}
                con cercanía.
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-500">
                TrainPro reúne evaluación, planificación, registro y análisis del entrenamiento en
                un solo lugar, para profesionales del ejercicio y para las personas a las que
                acompañan.
              </p>
            </div>
            <HeroIllustration className="mx-auto max-w-sm md:max-w-md" />
          </section>

          <section aria-labelledby="entrar" className="py-4">
            <h2 id="entrar" className="mb-4 text-2xl font-bold text-ink-900">
              Elige cómo quieres entrar
            </h2>
            {entry.enabled ? (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <EntryCard
                    title="Soy entrenador"
                    text="Panel, clientes con ficha por pestañas, sesiones (varias el mismo día), evaluaciones, análisis, planificación, biblioteca de ejercicios, carga, readaptación e informes."
                    tone="bg-sun-400"
                    choices={trainer.map((c) => ({
                      id: c.id,
                      label: `Entrar como ${firstWord(c.name)}, entrenador`,
                    }))}
                  />
                  <EntryCard
                    title="Soy cliente"
                    text="Tus sesiones de hoy en primer plano: ejercicios, series, cargas y descansos. Marta tiene historial; Lucía acaba de empezar."
                    tone="bg-white"
                    choices={clients.map((c) => ({
                      id: c.id,
                      label: `Entrar como ${firstWord(c.name)}, clienta`,
                    }))}
                  />
                </div>
                <p className="mt-3 text-sm text-ink-500">
                  No hay cuentas reales: cada botón abre la app como una persona ficticia, con datos
                  ficticios guardados solo en este equipo. Elegir una persona no es iniciar sesión.
                </p>
              </>
            ) : (
              <Notice title="Este servidor no está en modo demostración local">
                Todavía no hay inicio de sesión real (llegará en la Fase 2), así que no hay forma de
                entrar. Para probar la demostración en tu equipo, añade{' '}
                <code className="font-mono">TRAINPRO_MODE=local-demo</code> a{' '}
                <code className="font-mono">.env.local</code> y vuelve a arrancar el servidor.
              </Notice>
            )}
          </section>

          <section aria-labelledby="ciclo" className="py-10">
            <h2 id="ciclo" className="text-2xl font-bold text-ink-900">
              El ciclo de trabajo
            </h2>
            <ol className="mt-5 flex flex-wrap gap-2.5">
              {CYCLE.map(({ icon: Icon, label }, index) => (
                <li
                  key={label}
                  className="flex items-center gap-2 rounded-2xl border border-line bg-white px-3.5 py-2.5 text-sm font-semibold text-ink-700 shadow-soft"
                >
                  <span className="grid size-6 place-items-center rounded-lg bg-sun-200 text-xs font-bold text-sun-800">
                    {index + 1}
                  </span>
                  <Icon aria-hidden className="size-4 text-sun-700" />
                  {label}
                </li>
              ))}
            </ol>
          </section>

          <section aria-label="Principios" className="grid gap-4 md:grid-cols-3">
            {PRINCIPLES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-3xl bg-cream-50 p-6 ring-1 ring-line">
                <Icon aria-hidden className="size-6 text-sun-700" />
                <h3 className="mt-3 text-lg font-bold text-ink-900">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-500">{text}</p>
              </div>
            ))}
          </section>
        </main>
      </div>
    </>
  );
}

const firstWord = (name: string) => name.split(' ')[0] ?? name;

function EntryCard({
  title,
  text,
  tone,
  choices,
}: {
  title: string;
  text: string;
  tone: string;
  choices: { id: string; label: string }[];
}) {
  return (
    <section
      aria-label={title}
      className={`flex flex-col justify-between gap-6 rounded-[2rem] border border-line/70 p-6 shadow-soft sm:p-8 ${tone}`}
    >
      <div>
        <h3 className="text-2xl font-extrabold text-ink-900">{title}</h3>
        <p className="mt-2 max-w-md text-ink-700">{text}</p>
      </div>
      <form action={enterAs} className="flex flex-wrap gap-3">
        {choices.map((choice) => (
          <button
            key={choice.id}
            type="submit"
            name="persona"
            value={choice.id}
            className="group inline-flex min-h-12 items-center gap-2 rounded-2xl bg-ink-900 px-5 py-3 font-semibold text-cream-50 transition-colors hover:bg-ink-700"
          >
            {choice.label}
            <ArrowRight
              aria-hidden
              className="size-4 transition-transform group-hover:translate-x-0.5"
            />
          </button>
        ))}
      </form>
    </section>
  );
}
