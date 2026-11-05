# Seguridad y privacidad

> **Aviso importante.** Este documento describe decisiones técnicas. **No es una evaluación jurídica**, y TrainPro **no puede considerarse conforme con el RGPD** sin una revisión jurídica y técnica real del sistema completo (con base de datos, autenticación, alojamiento y contratos con proveedores). En la Fase 1 no se tratan datos personales reales: todos son ficticios.

## Modelo de permisos (implementado y probado)

Reglas en `src/domain/access.ts`, aplicadas por los casos de uso de `src/server/services`:

| Quién                    | Qué puede ver                                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Entrenador               | Solo **sus** clientes, con todos sus datos (incluidos salud y notas privadas).                               |
| Otro entrenador          | Nada de los clientes ajenos: la lista sale vacía y la ficha responde 404.                                    |
| Cliente                  | Solo **sus propios** datos: plan, sesiones y registros siempre; el resto, solo si el entrenador lo comparte. |
| Cliente (otro cliente)   | Nada: la sesión de otro cliente responde 404, igual que si no existiera.                                     |
| Cliente (notas privadas) | Nunca, aunque haya una configuración de compartición.                                                        |

- **Privacidad por defecto**: un cliente nuevo no tiene nada compartido (`defaultSharing`).
- **Biblioteca**: el catálogo global lo ven todos los entrenadores y no se edita. Los ejercicios propios y privados, las etiquetas personales (también las aplicadas a ejercicios globales), los favoritos, las notas y las progresiones de un entrenador solo los ve ese entrenador. Los clientes no navegan por la biblioteca: ven los ejercicios a través de sus sesiones.
- **Administración del catálogo** (rol `admin`, futuro): edita el catálogo global de ejercicios, pero no accede a datos de clientes ni a los ejercicios privados o personalizados de los entrenadores. Un entrenador no edita un ejercicio global: lo **adapta**, y se crea una copia personalizada.
- **Ficha del cliente**: cada pestaña llama a su propio caso de uso, que comprueba que el cliente pertenece al entrenador antes de devolver nada.
- La compartición es **granular**: por módulo (evaluaciones, volumen, readaptación, informes) y, en evaluaciones, por prueba.
- Una configuración de compartición que pertenezca a otro cliente se ignora.
- Hay tests de todas estas reglas: `src/domain/access.test.ts`, `src/server/services/services.test.ts` y `e2e/client-app.spec.ts`.

**Limitación actual:** sin autenticación real, el actor es fijo (sesión de demostración). Las reglas están listas, pero hasta que exista el inicio de sesión no protegen a usuarios reales.

## Datos de salud

Lesiones y readaptación son datos de **categoría especial** (art. 9 RGPD).

- Se modelan **aparte** de la ficha básica (`RehabCase` no forma parte de `Client`).
- En la interfaz se señalan con el aviso «Datos de salud · acceso restringido».
- El cliente solo los vería si el entrenador los comparte expresamente (no se comparten por defecto).

Pendiente para cuando haya datos reales: base jurídica y consentimiento explícito, cifrado adicional de campos sensibles, registro de accesos, evaluación de impacto (DPIA) y revisión jurídica.

## Minimización

La ficha del cliente solo contiene lo necesario para entrenar (nombre, objetivo, población, deporte y fecha de alta). No se piden fecha de nacimiento, teléfono, dirección ni documento de identidad. Cada dato nuevo deberá justificar para qué se necesita.

## Medidas técnicas presentes

- **Cabeceras HTTP** (`next.config.ts`, verificadas en E2E): Content-Security-Policy (sin recursos de terceros, `frame-ancestors 'none'`, `object-src 'none'`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy` (cámara, micrófono, ubicación y pagos desactivados) y `Cross-Origin-Opener-Policy`. Sin `X-Powered-By`.
- **Separación servidor/cliente**: `server-only` en todo `src/server` y reglas de ESLint entre capas.
- **Respuestas que no revelan existencia**: «no existe» y «no tienes acceso» devuelven lo mismo (404).
- **Enlaces externos**: solo `https`, con `rel="noopener noreferrer"`.
- **Sin terceros en el navegador**: las fuentes se sirven desde el propio dominio y no hay analítica, píxeles ni CDN.
- **Service worker sin datos personales**: solo guarda en caché la página sin conexión y un icono.
- **Configuración validada al arrancar** (`src/server/env.ts`).
- **Telemetría de Next.js**: está activada por defecto y envía datos anónimos de compilación a Vercel. Se recomienda desactivarla (`pnpm exec next telemetry disable`). Se comprobó que **no** se desactiva poniendo la variable en `.env.local`.

## Pendiente (fases posteriores)

| Área                     | Qué falta                                                                                                                  |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Autenticación            | Proveedor, contraseñas seguras o enlace mágico, 2FA para entrenadores, sesiones con cookies `HttpOnly`/`Secure`/`SameSite` |
| CSP estricta             | Pasar a CSP con _nonce_ y quitar `'unsafe-inline'` en scripts (requiere `proxy.ts`)                                        |
| HSTS                     | Al desplegar con HTTPS y dominio definitivo                                                                                |
| Base de datos            | Row Level Security como segunda barrera, cifrado en reposo, mínimo privilegio                                              |
| Auditoría                | Registro de quién accede a datos de salud y de cada cambio en lo que se comparte (`audit_event`, ver `DATA_MODEL.md`)      |
| Copias de seguridad      | Frecuencia, cifrado, región y prueba periódica de restauración                                                             |
| Conservación             | Plazos por tipo de dato, borrado y anonimización al dar de baja a un cliente                                               |
| Derechos de los usuarios | Acceso, rectificación, supresión y portabilidad (exportación)                                                              |
| Proveedores              | Contratos de encargo de tratamiento (DPA) y región UE                                                                      |
| Legal                    | DPIA, registro de actividades de tratamiento, textos informativos y revisión por un profesional                            |

### Derechos del cliente

El diseño de acceso, exportación, rectificación y supresión (con datos de salud y obligaciones de conservación) está en `DATA_RIGHTS.md`.

### Matiz importante sobre «el cliente solo ve lo que el entrenador comparte»

Es una regla **de la interfaz de la app**, coherente con el producto. Pero el RGPD reconoce a cada persona el **derecho de acceso** a sus datos personales (art. 15), con independencia de lo que muestre la app. Habrá que definir un procedimiento para atender esas solicitudes (por ejemplo, una exportación) y validarlo jurídicamente.

## Dependencias

- `pnpm audit --prod`: sin vulnerabilidades conocidas en las dependencias de producción (comprobado el 4 de noviembre de 2026).
- `pnpm audit` (incluye desarrollo, comprobado el 5 de noviembre de 2026): 1 aviso moderado en `minimatch` (ReDoS, GHSA-g3hv-75wg-m249), a través de ESLint. Solo hay parche en la rama 11.x, que ESLint no usa todavía. Afecta únicamente a herramientas de desarrollo y requiere patrones _glob_ controlados por un atacante. **Riesgo aceptado**, a revisar cuando ESLint actualice.
- Licencias de producción: MIT, Apache-2.0, ISC, BSD, 0BSD y CC-BY-4.0. Los binarios opcionales de `sharp` (optimización de imágenes de Next, que no se usa por ahora) incluyen libvips con licencia LGPL-3.0-or-later.
