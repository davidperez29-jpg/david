# TrainPro

Plataforma web para gestionar el entrenamiento, la evaluación, el rendimiento, la salud y la readaptación. Está pensada para entrenadores personales, preparadores físicos, readaptadores y especialistas en rendimiento y salud, y para sus clientes.

Ciclo de trabajo: **crear cliente → evaluar → interpretar → planificar → registrar ejecución → analizar carga y evolución → ajustar el plan**.

> **Estado: V1, bloque 2 implementado y pendiente de revisión (12 de noviembre de 2026).** Prototipo **local** con **datos ficticios** guardados en **SQLite** en tu equipo:
>
> - el entrenador crea y publica sesiones (varias el mismo día);
> - la clienta las entrena en el móvil, paso a paso: registra cada serie, descansa, pausa y termina;
> - lo registrado se guarda primero en el móvil y se envía al servidor sin duplicarse, también tras perder la conexión;
> - el entrenador compara lo prescrito con lo realizado.
>
> **No hay inicio de sesión real** («Entrar como…» elige una persona ficticia), ni servicios externos, ni despliegue. Tampoco hay análisis de carga ni tonelaje (bloque 3).
>
> Detalle: [`docs/V1_SPEC.md`](docs/V1_SPEC.md) §9.2–9.3 y [`docs/EXECUTION.md`](docs/EXECUTION.md). La Fase 1: [`docs/PHASE1_REPORT.md`](docs/PHASE1_REPORT.md).

## Requisitos

- **Node.js 26.13.1** (Node 26 LTS). La versión exacta está en `.nvmrc`, que leen `nvm`, `fnm` y Volta. `package.json` exige `>=26.13.1 <27` y `.npmrc` (`engine-strict=true`) impide instalar con otra versión. Política de actualización: `docs/V1_SPEC.md` §8.7.
- **pnpm 10.28** mediante Corepack. Desde Node 25, Corepack ya no viene incluido: se instala una vez con `npm install -g corepack@0.36.0` y se activa con `corepack enable`. El proyecto fija la versión de pnpm en `package.json`.
- Solo para las pruebas E2E: el navegador Chromium de Playwright (`pnpm exec playwright install chromium`).

## Puesta en marcha

```bash
nvm use                             # o fnm use: Node 26.13.1 según .nvmrc
npm install -g corepack@0.36.0      # una vez por equipo (Node 26 no incluye Corepack)
corepack enable                     # una vez por equipo
pnpm install                        # instala las dependencias exactas del lockfile
cp .env.example .env.local          # activa el modo de demostración local (TRAINPRO_MODE=local-demo)
pnpm exec next telemetry disable    # opcional y recomendado: desactiva la telemetría anónima de Next.js
pnpm dev                            # http://127.0.0.1:3000 (solo en este equipo)
```

- **`.env.local` con `TRAINPRO_MODE=local-demo`** es necesario para entrar: sin él la aplicación arranca, pero no hay forma de entrar (no hay autenticación hasta la Fase 2). El resto de variables tienen un valor por defecto seguro (`docs/DEVELOPMENT.md`).
- El servidor **solo escucha en 127.0.0.1** y rechaza cualquier otro nombre de host (`TRAINPRO_ALLOWED_HOSTS`): no es accesible desde la red local.
- `better-sqlite3` trae los binarios compilados para Linux, macOS y Windows (x64 y arm64): `pnpm install` no compila nada y avisa de que ha ignorado su script de compilación, que no hace falta.

**Datos:**

- La primera vez se crea `<proyecto>/.data/trainpro.sqlite` (fuera de Git, solo legible por tu usuario) con los datos ficticios del día. Configuración muestra la ruta real.
- Se conservan al recargar, al cerrar el navegador y al reiniciar el servidor.
- «Restablecer datos demo» (Configuración) guarda una copia y vuelve a sembrar con la fecha de hoy.
- Lo que la clienta registra sin conexión espera en el navegador (IndexedDB) hasta que el servidor lo confirma: [`docs/EXECUTION.md`](docs/EXECUTION.md) §6.

Entradas de la demo (en la portada, «Entrar como…»):

| Persona          | Experiencia                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------------- |
| Alex, entrenador | Panel, clientes con ficha por pestañas, sesiones (crear, prescribir y publicar), biblioteca, carga, informes… |
| Marta, clienta   | App pensada para el móvil, con historial: Hoy, entrenar la sesión de hoy, detalle, semana y progreso          |
| Lucía, clienta   | Clienta nueva, sin historial: entrena lo que Alex le publica                                                  |

## Scripts

| Comando                   | Qué hace                                                                                     |
| ------------------------- | -------------------------------------------------------------------------------------------- |
| `pnpm dev`                | Servidor de desarrollo                                                                       |
| `pnpm build`              | Compilación de producción                                                                    |
| `pnpm start`              | Sirve la compilación de producción                                                           |
| `pnpm lint`               | ESLint, incluidas las reglas que impiden saltarse las capas                                  |
| `pnpm typecheck`          | Genera los tipos de rutas y comprueba TypeScript                                             |
| `pnpm format`             | Formatea con Prettier (`format:check` solo comprueba)                                        |
| `pnpm test`               | Tests unitarios y de integración (Vitest)                                                    |
| `pnpm test:e2e`           | Compila y ejecuta las pruebas de extremo a extremo (Playwright + axe)                        |
| `pnpm check`              | Formato + lint + tipos + tests + compilación: lo que debe pasar antes de un commit           |
| `pnpm icons`              | Regenera los iconos PNG de la PWA a partir de `public/icons/icon.svg`                        |
| `pnpm db:status`          | Dónde está la base, migraciones, semilla, recuento, integridad y copias                      |
| `pnpm db:backup`          | Copia de seguridad verificada en `.data/backups/` (también con el servidor en marcha)        |
| `pnpm db:restore <copia>` | Restaura una copia verificada. **Con el servidor parado**; guarda antes el estado actual     |
| `pnpm verify:env`         | Comprueba Node, la carga de SQLite, migraciones, copia y restauración (pensado para Windows) |

## Estructura

```
src/
  app/         Rutas de Next.js (solo orquestan: piden datos al servidor y los pasan a la interfaz)
  domain/      Modelo y reglas en TypeScript puro: permisos, procedencia de datos, fórmulas, volumen…
  server/      Solo servidor: contexto de la petición, casos de uso, repositorios y base SQLite (server/db)
  contracts/   Tipos de los datos que el servidor entrega a la interfaz (ya filtrados por permisos)
  features/    Componentes de pantalla por área (entrenador, cliente, compartidos, marca)
  ui/          Componentes visuales genéricos del sistema de diseño
e2e/           Pruebas de extremo a extremo
docs/          Documentación técnica y de producto
public/        Iconos, service worker y página sin conexión
scripts/       Utilidades de mantenimiento (copias de la base, limpieza de datos de E2E, iconos)
.data/         Base de datos local y sus copias (se crea al arrancar; fuera de Git)
```

## Documentación

| Documento                                                                          | Contenido                                                                                                                   |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| [`docs/MASTER_SPEC.md`](docs/MASTER_SPEC.md)                                       | **Documento maestro**: producto, reglas, módulos, fases y mapa de la documentación                                          |
| [`docs/PRODUCT_STRATEGY.md`](docs/PRODUCT_STRATEGY.md)                             | Visión estratégica, principios, mapa de módulos, auditoría y regulación (propuesta)                                         |
| [`docs/COMPETITIVE_ANALYSIS.md`](docs/COMPETITIVE_ANALYSIS.md)                     | Análisis competitivo con fuentes y oportunidades de diferenciación                                                          |
| [`docs/PROGRESSION_AND_AUTOREGULATION.md`](docs/PROGRESSION_AND_AUTOREGULATION.md) | Progresión, 1RM estimado, valoración previa, motor de adaptación y carga interna (propuesta)                                |
| [`docs/INTEGRATIONS.md`](docs/INTEGRATIONS.md)                                     | Requisitos de cada integración y arquitectura de importación                                                                |
| [`docs/TRAINING_EXPERIENCE.md`](docs/TRAINING_EXPERIENCE.md)                       | Experiencia de entrenamiento guiada: análisis, flujo, bocetos y criterios de aceptación (diseño pendiente de aprobación)    |
| [`docs/EFFORT_AND_LOAD.md`](docs/EFFORT_AND_LOAD.md)                               | Prescripción de carga y esfuerzo (RIR, RPE), registro, 1RM, volumen y tonelaje                                              |
| [`docs/MEDIA.md`](docs/MEDIA.md)                                                   | Silueta y vídeos de los ejercicios: formatos, almacenamiento, costes y privacidad                                           |
| [`docs/PHASE1_REPORT.md`](docs/PHASE1_REPORT.md)                                   | Informe de revisión de la Fase 1                                                                                            |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)                                     | Arquitectura, capas, flujo de datos y cómo ampliar                                                                          |
| [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md)                                         | Modelo conceptual de datos, incluida la biblioteca multidimensional                                                         |
| [`docs/TAXONOMY.md`](docs/TAXONOMY.md)                                             | Taxonomía de la biblioteca: dimensiones de etiquetas, patrones y niveles de ejercicios                                      |
| [`docs/INFRASTRUCTURE.md`](docs/INFRASTRUCTURE.md)                                 | Comparativa de base de datos, autenticación, alojamiento y CI, con costes y riesgos                                         |
| [`docs/DATA_RIGHTS.md`](docs/DATA_RIGHTS.md)                                       | Diseño de los derechos del cliente: acceso, exportación, rectificación y supresión                                          |
| [`docs/SCREEN_INVENTORY.md`](docs/SCREEN_INVENTORY.md)                             | Qué es funcional, qué usa datos ficticios y qué es solo visual en cada pantalla                                             |
| [`docs/DECISIONS.md`](docs/DECISIONS.md)                                           | Decisiones técnicas justificadas (ADR) y las pendientes de aprobar                                                          |
| [`docs/SECURITY_PRIVACY.md`](docs/SECURITY_PRIVACY.md)                             | Modelo de permisos, privacidad, RGPD y pendientes                                                                           |
| [`docs/SCIENTIFIC_RIGOR.md`](docs/SCIENTIFIC_RIGOR.md)                             | Procedencia de los datos, registro de fórmulas y convenciones                                                               |
| [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md)                                   | Identidad visual, tokens, componentes y accesibilidad                                                                       |
| [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md)                                       | Desarrollo y mantenimiento del día a día                                                                                    |
| [`docs/ROADMAP.md`](docs/ROADMAP.md)                                               | Fases propuestas                                                                                                            |
| [`docs/IMPLEMENTATION_READINESS.md`](docs/IMPLEMENTATION_READINESS.md)             | Auditoría de preparación: primera versión funcional, decisiones para aprobar, entregas verticales y definición de terminado |
| [`docs/V1_SPEC.md`](docs/V1_SPEC.md)                                               | Especificación técnica y funcional de V1: pantallas, modelo de datos, API, plan por bloques y pruebas                       |
| [`docs/EXECUTION.md`](docs/EXECUTION.md)                                           | Ejecución del entrenamiento: modelo, estados, API de comandos, cola local, sincronización y conflictos (bloque 2)           |

## Costes

La Fase 1 no usa ningún servicio de pago ni externo: todo se ejecuta en local y las dependencias tienen licencias abiertas. Las fuentes tipográficas se descargan al compilar y se sirven desde el propio dominio. Cualquier servicio externo futuro (base de datos, alojamiento, correo) se propondrá antes de conectarlo, con sus condiciones, límites y posibles costes.

## Licencia

Repositorio **privado**. Todos los derechos reservados; no se publica ninguna licencia abierta (`"license": "UNLICENSED"`).
