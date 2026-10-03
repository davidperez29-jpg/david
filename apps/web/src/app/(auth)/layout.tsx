import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-bg p-6 shadow-sm">
        <p className="mb-6 text-sm font-semibold tracking-wide text-accent uppercase">
          Plataforma de entrenamiento
        </p>
        {children}
      </div>
    </main>
  );
}
