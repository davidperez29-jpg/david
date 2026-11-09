import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

/**
 * Límites entre capas (ver docs/ARCHITECTURE.md):
 *   domain   → no depende de nada del proyecto ni de React/Next.
 *   server   → puede usar domain; nunca la interfaz (app, features, ui).
 *   ui       → componentes genéricos: no conocen el dominio ni el servidor.
 *   features → componen ui + domain; nunca importan server (los datos llegan por props).
 *   app      → rutas: orquesta server y features.
 */
const restrict = (patterns) => ({
  'no-restricted-imports': ['error', { patterns }],
});

const noServer = {
  group: ['@/server', '@/server/*'],
  message: 'La interfaz no puede importar código de servidor: recibe los datos por props.',
};
const noApp = { group: ['@/app', '@/app/*'], message: 'Nada importa desde las rutas (src/app).' };
const noFeatures = {
  group: ['@/features', '@/features/*'],
  message: 'Esta capa no puede depender de componentes de pantalla.',
};
const noUi = { group: ['@/ui', '@/ui/*'], message: 'Esta capa no puede depender de la interfaz.' };
const noDomain = {
  group: ['@/domain', '@/domain/*'],
  message: 'Los componentes de ui son genéricos y no conocen el dominio.',
};
const noDriver = {
  group: ['better-sqlite3'],
  message:
    'El controlador SQLite solo se importa en src/server/db/sqlite.ts (ver docs/V1_SPEC.md §8.3.4).',
};
const noAdapter = {
  regex: '(^|/)repositories/sqlite(/|$)',
  message:
    'El adaptador SQLite solo se compone en src/server/db/store.ts (ver docs/V1_SPEC.md §8.3.4).',
};
const noFramework = {
  group: ['react', 'react/*', 'react-dom', 'react-dom/*', 'next', 'next/*', 'lucide-react'],
  message: 'El dominio es TypeScript puro, sin frameworks.',
};

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    'playwright-report/**',
    'test-results/**',
    'public/**',
  ]),
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always'],
    },
  },
  {
    // Scripts de mantenimiento: pueden escribir en la consola.
    files: ['scripts/**'],
    rules: { 'no-console': 'off' },
  },
  {
    files: ['src/**'],
    rules: restrict([noDriver]),
  },
  {
    // El adaptador SQLite solo se importa desde la composición (y desde las pruebas).
    files: ['src/**'],
    ignores: ['src/server/db/store.ts', 'src/server/repositories/sqlite/**', 'src/**/*.test.ts'],
    rules: restrict([noDriver, noAdapter]),
  },
  {
    files: ['src/domain/**'],
    rules: restrict([noServer, noApp, noFeatures, noUi, noFramework, noDriver, noAdapter]),
  },
  {
    files: ['src/server/**'],
    ignores: ['src/server/db/store.ts', 'src/server/repositories/sqlite/**', 'src/**/*.test.ts'],
    rules: restrict([noApp, noFeatures, noUi, noDriver, noAdapter]),
  },
  {
    files: [
      'src/server/db/store.ts',
      'src/server/repositories/sqlite/**',
      'src/server/**/*.test.ts',
    ],
    rules: restrict([noApp, noFeatures, noUi, noDriver]),
  },
  {
    // Única excepción: el adaptador del controlador.
    files: ['src/server/db/sqlite.ts'],
    rules: restrict([noApp, noFeatures, noUi]),
  },
  {
    files: ['src/ui/**'],
    rules: restrict([noServer, noApp, noFeatures, noDomain, noDriver, noAdapter]),
  },
  {
    files: ['src/features/**'],
    rules: restrict([noServer, noApp, noDriver, noAdapter]),
  },
]);
