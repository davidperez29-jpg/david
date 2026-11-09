# Desarrollo y mantenimiento

## Primer arranque

```bash
nvm use                               # Node 26.13.0 (.nvmrc)
npm install -g corepack@0.36.0        # una vez: Node 26 no incluye Corepack
corepack enable
pnpm install
cp .env.example .env.local            # TRAINPRO_MODE=local-demo: sin él no hay «Entrar como…»
pnpm exec next telemetry disable      # recomendado (ver SECURITY_PRIVACY.md)
pnpm dev                              # http://127.0.0.1:3000
```

`pnpm install` avisa de que ha ignorado el script de compilación de `better-sqlite3` (`pnpm.ignoredBuiltDependencies`). Es lo esperado: el paquete trae los binarios compilados para Linux, macOS y Windows (x64 y arm64) y se usan esos.

Para las pruebas E2E en un equipo nuevo: `pnpm exec playwright install chromium`.

## Antes de cada commit

```bash
pnpm check        # formato, lint, tipos, tests unitarios y compilación
pnpm test:e2e     # compila y ejecuta las pruebas E2E (escritorio y móvil) con axe
```

Ninguno debe fallar. Si un test falla, se arregla el código o el test, pero **nunca se desactiva para que pase**.

## Tests

| Tipo        | Dónde                     | Qué cubre                                                                                                                                                                                                                                                                                                                                                                                      |
| ----------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unitarios   | `src/domain/**/*.test.ts` | Fechas y semanas ISO, procedencia, registro de fórmulas, volumen, prescripción (también v2: `resolveSets`, validaciones, bloqueos, resumen de cambios, compatibilidad), permisos (también de las sesiones v2, con lo no autorizado), intentos y comparación de resultados, readaptación, taxonomía, búsqueda Y/O, variantes y progresiones                                                     |
| Integración | `src/server/**/*.test.ts` | Sobre **SQLite real** (en memoria o en archivos temporales): migraciones, restricciones e índices, copias y restauración, almacén (reapertura, espacios, permisos, restablecer), contrato del repositorio (idempotencia, conflictos, inmutabilidad), casos de uso de las sesiones con otro entrenador y otra clienta, y la **equivalencia** memoria ↔ SQLite de todas las pantallas existentes |
| E2E         | `e2e/*.spec.ts`           | Todas las pantallas (estado HTTP, encabezado, errores de consola, axe, 360 px), «Entrar como…», crear y publicar sesiones (varias el mismo día), Hoy y detalle en Pixel 7, independencia entre clientas, reinicio del servidor con `SIGTERM` y `SIGKILL`, protección local, y lo de la Fase 1                                                                                                  |

Los tests de servicios fijan la fecha (`2026-11-04`) para ser reproducibles. Los E2E usan la fecha real en `Europe/Madrid`.

**E2E y datos:** Playwright arranca `next start -H 127.0.0.1` con `TRAINPRO_MODE=local-demo`, `TRAINPRO_DEMO_SPACES=on` y `TRAINPRO_DATA_DIR=.data/e2e`, carpeta que se borra al empezar (`scripts/e2e-clean.ts`). Las pruebas que escriben usan su propio espacio (`e2e/fixtures.ts`). La prueba de reinicio arranca y para servidores propios en los puertos 3191 y 3192. Nunca se reutiliza un servidor ya arrancado.

## Tareas habituales

- **Actualizar dependencias**: `pnpm outdated`, actualizar de una en una (las versiones están fijadas sin `^` a propósito), y después `pnpm check` + `pnpm test:e2e` + `pnpm audit --prod`. Antes de una versión mayor, leer sus notas de migración. Next 16 incluye su documentación en `node_modules/next/dist/docs`.
- **Cambiar el logotipo**: editar `public/icons/icon.svg`, copiarlo a `src/app/icon.svg`, ejecutar `pnpm icons` y copiar `public/icons/apple-touch-icon.png` a `src/app/apple-icon.png`.
- **Invalidar la caché de la PWA**: subir `CACHE_VERSION` en `public/sw.js`.
- **Añadir una pantalla, un dato o un cálculo**: ver «Cómo ampliar» en `ARCHITECTURE.md`.

## Variables de entorno

| Variable                 | Valor por defecto     | Descripción                                                                                         |
| ------------------------ | --------------------- | --------------------------------------------------------------------------------------------------- |
| `TRAINPRO_MODE`          | (vacío)               | `local-demo` habilita «Entrar como…». Sin él no hay identidad: no hay autenticación hasta la Fase 2 |
| `TRAINPRO_DATA_SOURCE`   | `sqlite`              | Solo existe `sqlite`                                                                                |
| `TRAINPRO_DATA_DIR`      | `.data`               | Carpeta de la base, relativa al proyecto. No puede estar dentro de `.next` ni de `node_modules`     |
| `TRAINPRO_ALLOWED_HOSTS` | `localhost,127.0.0.1` | Nombres de host aceptados (sin puerto ni comodines). Cualquier otro recibe `403`                    |
| `TRAINPRO_TIME_ZONE`     | `Europe/Madrid`       | Zona horaria IANA para calcular «hoy»                                                               |
| `TRAINPRO_DEMO_SPACES`   | `off`                 | `on` solo en las E2E (exige `local-demo`): un archivo SQLite por espacio                            |

Se validan al arrancar (`src/server/env.ts`): un valor inválido detiene la aplicación con un mensaje claro.

## Base de datos local, copias y restauración

- **Dónde:** `.data/trainpro.sqlite` (más `-wal` y `-shm` mientras el servidor está en marcha), con permisos `600` en Linux y macOS. Está fuera de Git y fuera de `.next` y `node_modules`, así que compilar o reinstalar no la borra.
- **Copias:** en `.data/backups/`, con el nombre `trainpro-AAAAMMDD-HHMMSS-<motivo>.sqlite`. Se hacen así:
  - `pnpm db:backup` o «Hacer una copia ahora» (Configuración), con el servidor en marcha o parado;
  - automáticamente antes de migrar, de restablecer y de restaurar.
  - Cada copia se verifica: `integrity_check`, claves ajenas y migraciones iguales a las del código.
- **Restaurar:** para el servidor y ejecuta `pnpm db:restore <nombre o ruta>`. Se niega si el servidor tiene la base abierta (marca `.data/trainpro.sqlite.pid`), verifica la copia, guarda el estado actual como `antes-de-restaurar`, sustituye el archivo y vuelve a verificar.
- **Estado:** `pnpm db:status` muestra la ubicación, las migraciones, la fecha de la semilla, los recuentos, la integridad y las copias.
- **Empezar de cero:** «Restablecer datos demo» en Configuración: guarda una copia y vuelve a sembrar con la fecha de hoy.
- **Migraciones:** solo hacia delante. Una nueva va en `src/server/db/migrations/` y se añade a `MIGRATIONS` en `migrate.ts`. Nunca se edita una ya aplicada: el arranque falla si su suma de comprobación cambia.

## Problemas conocidos del entorno de desarrollo

- **npm** 10.9 no puede instalar el proyecto por un error interno (ver ADR-03): usa pnpm.
- Durante la Fase 1, el servidor de desarrollo (Turbopack) dejó de detectar algunos cambios de archivo en el entorno de trabajo usado. Si una modificación no se refleja, reinicia `pnpm dev`, y si persiste, borra `.next/`. La compilación de producción no se ve afectada.
- `pnpm install` muestra avisos de _peer dependencies_ de plugins de ESLint con ESLint 10. Son esperados (ver ADR-08).
- **Windows:** `better-sqlite3` incluye los binarios `win32-x64` y `win32-arm64`, pero el proyecto **no se ha ejecutado todavía en Windows**. Los scripts no usan sintaxis de shell propia de Unix; copiar `.env.example` se puede hacer con `copy .env.example .env.local` (cmd) o `Copy-Item` (PowerShell).

## Convenciones

- Código e identificadores en inglés; textos de interfaz y documentación en español.
- Las rutas visibles van en español (`/entrenador`, `/cliente`).
- Componentes de servidor por defecto; `'use client'` solo donde hay interacción.
- Nada de lógica de negocio en `src/app`: va al dominio o a los casos de uso.
- Nada visual o simulado se presenta como terminado: se usa `PendingFeature` o `Notice`.
