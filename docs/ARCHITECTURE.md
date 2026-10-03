# Arquitectura

> Derivado de `MASTER_SPECIFICATION.md` §4–§5. Este documento describe lo **implementado** (Fase 1) y las decisiones tomadas. Si la especificación y este documento discrepan en algo ya implementado, manda este documento y la especificación se actualiza.

## 1. Vista general

Monolito modular en TypeScript (pnpm workspaces). Un único despliegue web con fronteras internas estrictas comprobadas en CI (`pnpm depcruise`).

```
apps/web  (Next.js 16, App Router)
  ├─ src/app/api/v1/**/route.ts   REST API (authedRoute / publicRoute)
  ├─ src/app/app/**               Experiencia ENTRENADOR (escritorio/tablet)
  ├─ src/app/me/**                Experiencia CLIENTE (móvil)
  ├─ src/app/(auth)/**            Login, 2FA, invitación, recuperación
  └─ src/server/**                Contexto, sesión, wrappers de API (server-only)
packages/application   Casos de uso: autorización + validación + transacción + auditoría
packages/contracts     Esquemas Zod de entrada (compartidos API ↔ UI)
packages/auth          Primitivas: argon2id, sesiones, TOTP, cifrado, rate limiting
packages/db            Esquema Drizzle, migraciones SQL, seeds de catálogo
packages/domain        Reglas puras: permisos/política, objetivos, consentimientos, auditoría
```

### Reglas de dependencia (`.dependency-cruiser.cjs`)

| Regla | Significado |
|---|---|
| `domain-is-pure`, `domain-no-third-party` | `domain` no importa nada: ni BD, ni frameworks, ni npm. |
| `db-not-above`, `auth-not-above` | Las capas inferiores no conocen a las superiores. |
| `packages-not-apps` | Ningún paquete depende de la app. |
| `ui-no-db` | Componentes/lib de UI nunca tocan la BD. |
| `no-unresolvable` | Un import no declarado en `package.json` falla. |
| `no-circular` | Sin ciclos. |

## 2. Flujo de una petición

```
Navegador ──fetch same-origin──▶ /api/v1/... (route.ts)
   authedRoute: comprueba Origin (CSRF) → resuelve sesión (cookie httpOnly) → Actor
   └─▶ caso de uso (packages/application)
         parse(zod)  → authorizeClient / requirePermission (domain.authorize)
         ctx.db.transaction( cambios + writeAudit )        ← misma transacción
   ◀── JSON (Cache-Control: no-store) | error {code,message,details,requestId}
```

Las páginas de servidor (React Server Components) llaman a los **mismos** casos de uso con el `Actor` de la sesión: hay un único punto de autorización compartido por API y UI.

## 3. Decisiones (ADR resumidas)

| # | Decisión | Alternativas | Motivo |
|---|---|---|---|
| ADR-001 | Monolito modular TS + PostgreSQL | Django, NestJS+SPA, BaaS | §5.1 de la especificación. |
| ADR-002 | **Autenticación propia** sobre primitivas probadas (`@node-rs/argon2`, `crypto`, `otplib`) en lugar de Better Auth | Better Auth, Auth.js | Spike de Fase 1 (decisión D3): el flujo es solo por invitación (sin registro público), con roles por organización, 2FA para staff, auditoría en la misma transacción y RLS futura. Integrarlo en una librería exigía puentear su registro, sus tablas y sus hooks; la superficie propia es pequeña (≈400 líneas), está cubierta por tests y no hay dependencia de su API. Revisable si se necesitan OAuth/SSO. |
| ADR-003 | Sesiones opacas en BD (token aleatorio de 256 bits, se guarda solo su SHA-256) | JWT | Revocación inmediata (desactivar usuario, cambio de contraseña), sin claves de firma que rotar. |
| ADR-004 | Autorización en la capa de aplicación (RBAC + ámbito `org/assigned/own`), *deny by default* | Solo RLS | Testeable de forma pura; RLS se añadirá como defensa en profundidad en la Fase 2 (§14.3). |
| ADR-005 | Clientes de otra organización o fuera de ámbito → `404` | `403` | No revelar la existencia de recursos (anti-enumeración). |
| ADR-006 | Auditoría *append-only* garantizada por **trigger** de PostgreSQL | Solo `REVOKE` | El trigger protege incluso frente al propietario de la tabla. |
| ADR-007 | Cifrado de columna AES-256-GCM para teléfono, texto libre de salud y secretos TOTP | Solo cifrado en disco | Datos de salud (art. 9 RGPD) y secretos de 2FA. Claves derivadas por HMAC de `APP_ENCRYPTION_KEY`. |
| ADR-008 | UUID v7 generados en la aplicación | `gen_random_uuid()` (v4) | Orden temporal → mejor localidad de índices. |
| ADR-009 | Sin proveedor de email en Fase 1: `Mailer` en memoria y el enlace de invitación se muestra al ADMIN/entrenador | Integrar ya un proveedor | El proveedor (región UE) es una decisión de coste del usuario (D4). El puerto `Mailer` ya existe. |
| ADR-010 | Cuestionario de cribado: se registra **resultado**, no se reproduce el cuestionario | Reproducir PAR-Q+ en la app | No reproducir un instrumento sin la versión verificada y su licencia. |

## 4. Modelo de datos implementado (Fase 1)

`organizations`, `users`, `roles`, `permissions`, `role_permissions`, `user_roles`, `auth_sessions`, `login_attempts`, `invitations`, `password_reset_tokens`, `trainers`, `clients`, `trainer_client_assignments`, `client_training_profiles`, `client_availability`, `client_equipment`, `client_goals`, `client_history_entries`, `health_declarations`, `screening_responses`, `consents`, `goals`, `sports`, `equipment`, `audit_logs`.

Detalle de columnas: `packages/db/src/schema/*.ts` (fuente de verdad) y `packages/db/drizzle/*.sql`. El documento `DATABASE.md` completo se escribe en la Fase 2.

## 5. Configuración

| Variable | Uso |
|---|---|
| `DATABASE_URL` | PostgreSQL de la aplicación. |
| `TEST_DATABASE_URL` | Base de datos que los tests de integración **borran y recrean**. |
| `APP_ENCRYPTION_KEY` | Clave maestra (≥ 32 bytes en base64). Rotación: Fase 13. |
| `APP_BASE_URL` | URL pública para enlaces de invitación y recuperación. |
| `DEMO_PASSWORD` | (opcional) contraseña de los usuarios demo. |

## 6. Puesta en marcha local

```bash
pnpm install
cp .env.example .env            # y rellenar APP_ENCRYPTION_KEY: openssl rand -base64 32
pnpm db:reset                   # borra, migra y carga catálogos (¡solo desarrollo!)
pnpm db:seed:demo               # 3 entrenadores y 10 clientes ficticios
pnpm dev                        # http://localhost:3000
```

Usuarios demo: `lucia.moreno@example.com` (ADMIN + entrenadora), `pablo.ibarra@example.com`, `nerea.soto@example.com` (entrenadores), `marcos.villalba@example.com`, `elena.prieto@example.com`, `iker.arrieta@example.com` (clientes con app). Contraseña: `demo-entrenamiento-2026` (o `DEMO_PASSWORD`).

Producción: crear la organización con `pnpm --filter @tp/application create-org` (variables `ORG_NAME`, `ORG_SLUG`, `ADMIN_*`), aplicar migraciones con `pnpm db:migrate` y catálogos con `pnpm db:seed`.
