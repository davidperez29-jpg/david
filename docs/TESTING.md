# Testing

> Estrategia completa en `MASTER_SPECIFICATION.md` §15. Estado tras la Fase 3.

## 1. Cómo ejecutar

| Comando | Qué ejecuta | Requisitos |
|---|---|---|
| `pnpm test:unit` | Dominio, primitivas de auth, cobertura de rutas | — |
| `pnpm test:integration` | Casos de uso contra PostgreSQL real | `TEST_DATABASE_URL` (se **borra y recrea**) |
| `pnpm test` | Unidad + integración | ídem |
| `pnpm test:e2e` | Playwright (escritorio + móvil) contra `next start` | `pnpm build`, `pnpm db:reset && pnpm db:seed:demo`; Chromium (`PW_CHROMIUM` para usar uno ya instalado) |
| `pnpm lint` · `pnpm typecheck` · `pnpm format:check` · `pnpm depcruise` | Calidad y capas | — |

CI (`.github/workflows/ci.yml`) ejecuta todo lo anterior con un servicio PostgreSQL 16.

Los tests de integración no truncan tablas (la auditoría es *append-only*): cada test crea su **propia organización** (`buildOrg()` en `packages/application/test/fixtures.ts`), lo que además ejercita el aislamiento entre organizaciones.

## 2. Cobertura por área (Fase 1)

| Área (§57) | Tests | Archivo |
|---|---|---|
| Login | Credenciales correctas, email sin distinguir mayúsculas, mismo mensaje usuario inexistente / contraseña errónea, bloqueo tras 5 fallos, sesión caducada, logout, usuario desactivado pierde sesiones | `auth.int.test.ts` |
| 2FA | Alta TOTP, código incorrecto, login en dos pasos, secreto cifrado en BD | `auth.int.test.ts`, `auth.unit.test.ts` |
| Invitaciones y contraseñas | Un solo uso, política de contraseñas, email duplicado, recuperación de un solo uso que revoca sesiones, cambio con contraseña actual | `auth.int.test.ts` |
| Permisos | Matriz pura (deny by default, organizaciones, ámbitos, roles combinados) | `policy.unit.test.ts` |
| Seguridad / aislamiento | Entrenador ↛ cliente no asignado (lectura, edición, salud, auditoría, invitación), listados filtrados por ámbito, cliente ↛ otro cliente, cliente ↛ acciones de staff, cliente solo edita contacto/preferencias, ADMIN de otra organización ↛ nada, solo ADMIN invita a staff | `security.int.test.ts` |
| Cliente | Alta completa transaccional, objetivos inválidos sin alta parcial, bloqueo optimista, auditoría por campo, objetivos con historial, disponibilidad del propio cliente, búsqueda (con escape de comodines), archivado, asignaciones | `clients.int.test.ts` |
| Salud y RGPD | Consentimiento obligatorio, staff no puede fingir consentimiento en app, cifrado, aviso de derivación, auditoría de lectura sin texto de salud, cribado «derivar», revocación | `health.int.test.ts` |
| Auditoría | *Append-only* a nivel de BD (UPDATE/DELETE rechazados) | `health.int.test.ts` |
| RLS (Fase 2) | Todas las tablas de `public` mapeadas y con RLS; sin contexto no se ve nada; tablas de sistema inaccesibles; con SQL directo: entrenador solo asignados, cliente solo él mismo, ADMIN nunca otra organización, cliente no escribe salud ni planes, staff no escribe en otra organización ni en catálogo global, auditoría no modificable ni falsificable; triggers de herencia y de pareja cliente-organización; plantillas invisibles para clientes; seeds idempotentes | `rls.int.test.ts` |
| Ejercicios (Fase 3) | Normalización de nombres; vídeos válidos e inválidos (incluido `javascript:`); ciclos de progresión; sustituciones (filtros duros con motivo, dolor → menor carga axial, dificultad → regresión, patrones restringidos); requisitos de publicación; integración: búsqueda sin tildes y con errores, filtros por patrón/músculo/material, aislamiento entre organizaciones, cliente sin acceso, publicación y revisión, bloqueo optimista, taxonomía ajena rechazada, vídeo pendiente → verificado, silueta con detección de tipo (SVG rechazado) y sustitución, progresiones contradictorias, contenido global de solo lectura y copia, sustituciones con material y tolerancias del cliente, importación idempotente del banco; E2E: buscar en el banco importado, crear, completar y publicar, vídeo inválido y verificación, cliente sin acceso a la API | `library.unit.test.ts`, `exercise-bank.unit.test.ts`, `library.int.test.ts`, `e2e/library.spec.ts` |
| Límite por IP | 35 inicios de sesión correctos desde la misma IP no bloquean | `auth.int.test.ts` |
| Esquema (Fase 2) | Perfiles de prescripción solo con variables existentes, slugs únicos, RIR 0–10, mapa RLS coherente, salud y decisiones nunca escribibles por el cliente, migración RLS sin desviación respecto al generador | `packages/db/test/catalog.unit.test.ts` |
| Cálculos | Edad, validación de objetivos, consentimientos vigentes, diff y redacción | `clients.unit.test.ts` |
| Rutas | Todos los handlers usan `authedRoute`/`publicRoute`; lista cerrada de públicos | `apps/web/test/routes.unit.test.ts` |
| E2E | Alta de cliente con asistente + consentimiento + cribado + historial; aislamiento entre entrenadores; cliente no accede al área de entrenador ni a la API de usuarios; CSRF; API sin sesión; experiencia móvil (consentimiento, perfil, objetivos táctiles ≥ 48 px) | `apps/web/e2e/*.spec.ts` |

Pendiente para fases siguientes: evaluación, programa, sesión, ejercicios, feedback, adherencia, informes, filtros avanzados y sustitución (las funciones aún no existen), accesibilidad automatizada con axe-core (Fase 14) y cobertura de líneas ≥ 90 % en `domain` (se medirá cuando existan los motores).

## 3. Resultado en la entrega de la Fase 3

- Unidad: 102 tests ✔ · Integración: 63 tests ✔ (todos bajo RLS) · E2E: 8 tests ✔ (Chromium, escritorio y Pixel 7); los E2E son repetibles sin reiniciar la base de datos.
- `lint`, `typecheck`, `format:check` y `depcruise` sin errores.

## 4. Resultado en la entrega de la Fase 4

- Unidad: 138 tests ✔ (incluye la gradación, el QA, la aplicabilidad y la coherencia de los archivos de evidencia) · Integración: 76 tests ✔ · E2E: 11 tests ✔.
- Integración científica (`science.int.test.ts`, `evidence-seed.int.test.ts`):
  - niveles recalculados al verificar y al editar;
  - una fuente sin verificar da nivel H;
  - el QA bloquea la publicación;
  - publicar es exclusivo de ADMIN;
  - la lista de control incompleta no permite aprobar;
  - las contradicciones dan nivel D;
  - un método no se publica con variables sin justificar;
  - aislamiento entre organizaciones;
  - el contenido global es de solo lectura;
  - DOI/PMID únicos;
  - la importación es idempotente;
  - la retracción queda registrada.
- La base de datos de integración se crea con la biblioteca científica global importada (`prepareTestDatabase`).
- `lint`, `typecheck`, `format:check` y `depcruise` sin errores.
