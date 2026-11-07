# TrainPro

Plataforma web para gestionar el entrenamiento, la evaluación, el rendimiento, la salud y la readaptación. Está pensada para entrenadores personales, preparadores físicos, readaptadores y especialistas en rendimiento y salud, y para sus clientes.

Ciclo de trabajo: **crear cliente → evaluar → interpretar → planificar → registrar ejecución → analizar carga y evolución → ajustar el plan**.

> **Estado: Fase 1 (fundamentos), versión de demostración.** Usa **datos ficticios en memoria**, **no tiene inicio de sesión real** y **no guarda nada**. No hay base de datos ni servicios externos conectados, y no hay ningún despliegue público. El detalle de qué funciona de verdad y qué está pendiente está en [`docs/PHASE1_REPORT.md`](docs/PHASE1_REPORT.md). El diseño de la experiencia de entrenamiento guiada está documentado y **pendiente de aprobación**, sin código nuevo (ver [`docs/MASTER_SPEC.md`](docs/MASTER_SPEC.md)).

## Requisitos

- **Node.js 22.13 o superior** (LTS recomendada). Comprobar con `node --version`.
- **pnpm 10.28** mediante Corepack, que viene con Node: `corepack enable`. El proyecto fija la versión en `package.json`.
- Solo para las pruebas E2E: el navegador Chromium de Playwright (`pnpm exec playwright install chromium`).

## Puesta en marcha

```bash
corepack enable                     # una vez por equipo
pnpm install                        # instala las dependencias exactas del lockfile
pnpm exec next telemetry disable    # opcional y recomendado: desactiva la telemetría anónima de Next.js
pnpm dev                            # http://localhost:3000
```

No hace falta configurar nada: todas las variables de entorno tienen un valor por defecto seguro. Si quieres cambiarlas, copia `.env.example` como `.env.local`.

Entradas de la demo:

| Ruta          | Experiencia                                                                               |
| ------------- | ----------------------------------------------------------------------------------------- |
| `/`           | Portada: elegir entre entrenador y cliente                                                |
| `/entrenador` | Área del entrenador (Alex, ficticio): panel, clientes con ficha por pestañas, biblioteca… |
| `/cliente`    | Portal del cliente, pensado para el móvil (Marta, ficticia): la sesión de hoy             |

## Scripts

| Comando          | Qué hace                                                                           |
| ---------------- | ---------------------------------------------------------------------------------- |
| `pnpm dev`       | Servidor de desarrollo                                                             |
| `pnpm build`     | Compilación de producción                                                          |
| `pnpm start`     | Sirve la compilación de producción                                                 |
| `pnpm lint`      | ESLint, incluidas las reglas que impiden saltarse las capas                        |
| `pnpm typecheck` | Genera los tipos de rutas y comprueba TypeScript                                   |
| `pnpm format`    | Formatea con Prettier (`format:check` solo comprueba)                              |
| `pnpm test`      | Tests unitarios y de integración (Vitest)                                          |
| `pnpm test:e2e`  | Compila y ejecuta las pruebas de extremo a extremo (Playwright + axe)              |
| `pnpm check`     | Formato + lint + tipos + tests + compilación: lo que debe pasar antes de un commit |
| `pnpm icons`     | Regenera los iconos PNG de la PWA a partir de `public/icons/icon.svg`              |

## Estructura

```
src/
  app/         Rutas de Next.js (solo orquestan: piden datos al servidor y los pasan a la interfaz)
  domain/      Modelo y reglas en TypeScript puro: permisos, procedencia de datos, fórmulas, volumen…
  server/      Solo servidor: contexto de la petición, casos de uso y repositorios (hoy, demo en memoria)
  contracts/   Tipos de los datos que el servidor entrega a la interfaz (ya filtrados por permisos)
  features/    Componentes de pantalla por área (entrenador, cliente, compartidos, marca)
  ui/          Componentes visuales genéricos del sistema de diseño
e2e/           Pruebas de extremo a extremo
docs/          Documentación técnica y de producto
public/        Iconos, service worker y página sin conexión
scripts/       Utilidades de mantenimiento
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

## Costes

La Fase 1 no usa ningún servicio de pago ni externo: todo se ejecuta en local y las dependencias tienen licencias abiertas. Las fuentes tipográficas se descargan al compilar y se sirven desde el propio dominio. Cualquier servicio externo futuro (base de datos, alojamiento, correo) se propondrá antes de conectarlo, con sus condiciones, límites y posibles costes.

## Licencia

Repositorio **privado**. Todos los derechos reservados; no se publica ninguna licencia abierta (`"license": "UNLICENSED"`).
