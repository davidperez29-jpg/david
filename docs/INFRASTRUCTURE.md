# Infraestructura: base de datos, autenticación, alojamiento y CI

> **Estado:** solo evaluación. No se ha creado ninguna cuenta ni proyecto, no se ha conectado ningún servicio, no hay credenciales y no se ha activado ningún plan. Datos consultados el **5 de noviembre de 2026**.
>
> **Fiabilidad de los datos:** desde este entorno no se pudieron abrir directamente `supabase.com` ni `docs.github.com` (la política de red de la sesión no los permite), así que las cifras proceden de búsquedas web. Se indica en cada caso si la fuente es **oficial** o **de terceros**, y hay que **confirmarlas en las páginas oficiales antes de decidir**. Ningún proveedor garantiza que sus planes gratuitos se mantengan.

## 1. Base de datos y autenticación

Preferencia indicada: **PostgreSQL con Supabase y Supabase Auth**. La arquitectura actual (puertos y adaptadores) es compatible con cualquiera de las opciones.

| Criterio                       | Supabase Free                                                                                                                                                                                 | Supabase Pro                                                                                              | Neon Free + autenticación aparte                                         | PostgreSQL propio en VPS                                               |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| **Coste**                      | 0 €                                                                                                                                                                                           | 25 $/mes por organización; incluye 10 $ de cómputo (1 instancia Micro) [O]                                | 0 € (y la autenticación, aparte)                                         | ~4–5 €/mes (VPS de entrada) [T]                                        |
| **Base de datos**              | 500 MB por proyecto [T]                                                                                                                                                                       | Más espacio; 8 GB según terceros, sin confirmar [T]                                                       | 0,5 a 1 GB por proyecto, según fuente [T]                                | Lo que dé el disco (40 GB en el VPS de entrada) [T]                    |
| **Usuarios de autenticación**  | 50.000 usuarios activos al mes [T]                                                                                                                                                            | Más (cifra por confirmar)                                                                                 | Depende de la librería elegida                                           | Sin límite técnico                                                     |
| **Almacenamiento de archivos** | 1 GB según la mayoría de fuentes (alguna dice 500 MB) [T]                                                                                                                                     | 100 GB según terceros [T]                                                                                 | No incluido                                                              | Lo que dé el disco                                                     |
| **Transferencia**              | 5 GB [T]                                                                                                                                                                                      | 250 GB según terceros [T]                                                                                 | —                                                                        | 20 TB/mes en la UE [T]                                                 |
| **Inactividad**                | **Se pausa tras 7 días sin actividad** [T]                                                                                                                                                    | No se pausa                                                                                               | Escala a cero (arranques en frío) [T]                                    | No                                                                     |
| **Copias de seguridad**        | **No garantizadas**: la página de precios dice que no se incluyen, la documentación dice que hay copias diarias [O, contradictorio]                                                           | Diarias, 7 días de retención; recuperación a un momento concreto (PITR): 100 $/mes por cada 7 días [O]    | Según el plan                                                            | **Responsabilidad propia** (scripts, cifrado, pruebas de restauración) |
| **Región UE**                  | Frankfurt, Irlanda, París, Estocolmo (en la UE); Londres y Zúrich están fuera de la UE [O]                                                                                                    | Igual                                                                                                     | Disponibilidad por región sin verificar                                  | Alemania o Finlandia (proveedor de referencia) [T]                     |
| **Autenticación y 2FA**        | Supabase Auth; 2FA con aplicación (TOTP) incluida en Free [O]; 2FA por SMS de pago (unos 75 $/mes el primer proyecto, según terceros)                                                         | Igual                                                                                                     | Hay que integrar una librería (Auth.js, Better Auth…): más código propio | Igual que Neon                                                         |
| **Escalabilidad**              | Limitada; pensada para prototipos                                                                                                                                                             | Cómputo ampliable de pago; límite de gasto activado por defecto (el cómputo no queda limitado por él) [O] | Escala automática                                                        | Manual                                                                 |
| **Protección de datos**        | DPA disponible; transferencias a subencargados de EE. UU. y Singapur con cláusulas contractuales tipo [O]; copias, registros y funciones en el borde afectan a la residencia de los datos [O] | Igual; SOC 2 y HIPAA en planes superiores o como complemento de pago [O/T]                                | DPA por revisar                                                          | Control total, pero toda la seguridad depende de nosotros              |

[O] = fuente oficial (página o documentación del proveedor, vista a través del buscador) · [T] = terceros (blogs y comparadores de 2026).

### Conclusión y recomendación

- **Supabase encaja con la arquitectura**: PostgreSQL con RLS, autenticación con 2FA por aplicación, almacenamiento de archivos y región UE (Frankfurt o París).
- **Supabase Free no es adecuado para datos reales**: se pausa con 7 días de inactividad, no garantiza copias de seguridad y es para prototipos. Con datos de salud reales hacen falta copias y un DPA firmado.
- **Propuesta para la Fase 2 (sin coste):** desarrollar contra un **Supabase local** (la CLI de Supabase levanta la pila completa con Docker en el propio ordenador) o un PostgreSQL local, con datos ficticios. No se necesita ninguna cuenta.
- **Antes de usar datos reales:** Supabase **Pro** en una región UE, con el DPA revisado y la decisión sobre PITR. Coste estimado más abajo.
- **A verificar antes de decidir:** cifras exactas de Free y Pro, copias en Free, condiciones del correo de autenticación (el servicio de correo integrado suele ser limitado para producción, y un proveedor SMTP propio sería otro encargado del tratamiento) y la lista de subencargados.

## 2. Alojamiento de la aplicación (Next.js)

| Opción                      | Coste                                                        | Límites relevantes                                                                                                                                    | Para TrainPro                                                                      |
| --------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| **Vercel Hobby**            | 0 €                                                          | **Solo uso personal y no comercial** [O]                                                                                                              | ❌ No vale para un servicio profesional                                            |
| **Vercel Pro**              | ~20 $/miembro/mes con uso incluido; el exceso se factura [T] | Facturación por uso                                                                                                                                   | ✅ Mejor integración con Next.js, pero de pago                                     |
| **Netlify Free**            | 0 €                                                          | Basado en créditos (unos 300/mes); al agotarse, **el sitio se pausa**, sin cobrar más [T]; permite uso comercial [T]                                  | ⚠️ Posible para una beta pequeña                                                   |
| **Cloudflare Workers Free** | 0 €                                                          | 100.000 peticiones/día, **10 ms de CPU por petición**, 128 MB de memoria [O]; Next.js mediante el adaptador OpenNext (sin probar con esta aplicación) | ⚠️ El límite de CPU puede quedarse corto para las páginas renderizadas en servidor |
| **Render Free**             | 0 €                                                          | Se suspende tras 15 min sin tráfico (hasta ~1 min en arrancar); 750 h/mes [O]; su PostgreSQL gratuito **caduca a los 30 días y no tiene copias** [O]  | ❌ Solo para demos                                                                 |
| **VPS en la UE**            | ~4–5 €/mes [T]                                               | Mantenimiento y seguridad propios (actualizaciones, TLS, copias)                                                                                      | ✅ Control y coste fijos, pero más trabajo de operación                            |

**Recomendación:** decidir el alojamiento junto con la base de datos. Para una beta con pocos usuarios, Netlify Free o Cloudflare (tras probar los límites de CPU) mantienen 0 €. Para producción, Vercel Pro o un VPS en la UE. No se despliega nada sin autorización.

## 3. Repositorio y CI (GitHub Actions)

- **El repositorio sigue siendo privado** y **sin licencia abierta**: `package.json` declara `"private": true` y `"license": "UNLICENSED"`, y no hay archivo de licencia.
- **GitHub Actions en repositorios privados (plan Free):** 2.000 minutos Linux y 500 MB de artefactos al mes [T; la página oficial no se pudo abrir]. Desde el 1 de junio de 2026 las revisiones de código de Copilot en repositorios privados también consumen minutos [O]. El cobro anunciado para los _runners_ propios se pospuso [O]. En repositorios públicos es gratis.
- **Estimación para TrainPro:** cada ejecución completa (`pnpm check` + E2E con compilación e instalación del navegador) tardaría unos **6–8 minutos**, lo que da para unos **250 _pushes_ al mes** dentro del cupo gratuito.
- **Exceso:** según la documentación de GitHub (por confirmar), sin método de pago o con el límite de gasto a 0, al agotar los minutos los flujos se detienen en lugar de facturarse.
- **Recomendación:** activar un flujo de CI (P-04) con límite de gasto 0. Alternativas: ejecutar `pnpm check` y `pnpm test:e2e` en local antes de cada _push_, o un _runner_ propio.

## 4. Costes estimados

| Escenario                                                                          | Coste mensual estimado       | Comentario                                                              |
| ---------------------------------------------------------------------------------- | ---------------------------- | ----------------------------------------------------------------------- |
| **Fase 2 en local** (Supabase local o PostgreSQL local, datos ficticios)           | **0 €**                      | Sin cuentas ni servicios externos                                       |
| **Entorno de pruebas en la nube** (Supabase Free + Netlify o Cloudflare Free)      | **0 €**                      | Se pausa por inactividad; sin copias garantizadas; **sin datos reales** |
| **Producción mínima con datos reales** (Supabase Pro + alojamiento gratuito o VPS) | **~25–30 $/mes**             | Copias diarias de 7 días; sin PITR                                      |
| **Producción con PITR y Vercel Pro**                                               | **~145 $/mes o más**         | 25 $ Pro + 100 $ PITR (7 días) + 20 $ Vercel; más cómputo si hace falta |
| **2FA por SMS**                                                                    | +75 $/mes (más mensajes) [T] | Evitable con 2FA por aplicación (TOTP), incluida                        |

Las cifras son orientativas, en dólares estadounidenses (salvo el VPS, en euros), sin impuestos, y pueden cambiar. **0 €/mes es viable para desarrollar y para pruebas con datos ficticios, pero no para un servicio con datos reales de salud que necesite copias de seguridad.**

### Almacenamiento multimedia (añadido el 6 de noviembre de 2026)

Con los supuestos de `MEDIA.md` §8 (300 variantes con silueta, vídeo breve y ampliado ≈ 2,9 GB; 10–36 GB/mes de transferencia):

| Escenario                                        | Coste mensual estimado                                                  |
| ------------------------------------------------ | ----------------------------------------------------------------------- |
| Desarrollo con archivos locales o Supabase local | **0 €**                                                                 |
| Supabase Free                                    | **No cabe** (1 GB de archivos y 5 GB de transferencia [T])              |
| Supabase Pro (ya contratado para la BD)          | **+0 $**: dentro de los 100 GB y 250 GB de transferencia incluidos [T]  |
| Cloudflare R2                                    | **0 $**: dentro de los 10 GB gratuitos y sin coste de transferencia [O] |
| Bunny Stream                                     | ~0,13–0,39 $ → **mínimo de 1 $/mes** [T]                                |

La partida principal es la **producción del contenido** (grabación, edición, siluetas y cesiones de imagen), sin estimar (P-33). Comparativa completa, formatos y riesgos en `MEDIA.md`.

### Costes potenciales de etapas posteriores (añadido el 6 de noviembre de 2026)

No se activan sin aprobación. Detalle por etapa en `ROADMAP.md`.

| Concepto                                                       | Cuándo                 | Orden de magnitud                                                               |
| -------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------- |
| Asesoría jurídica (RGPD) y regulatoria (MDR, Reglamento de IA) | Antes de E1 y de E4/E6 | Sin estimar; servicio profesional                                               |
| Hardware para probar integraciones                             | E5                     | Cientos de dólares (encoder) a miles (plataformas de fuerza), según tiendas [T] |
| Programas de desarrolladores de _wearables_                    | E5                     | Gratuitos o con condiciones comerciales, según el fabricante                    |
| Proveedor de IA                                                | E6                     | Pago por uso; se estimará con el volumen real antes de aprobarlo                |
| Pagos y facturación                                            | E8                     | Comisión por transacción del proveedor (a evaluar)                              |

## 5. Riesgos

- **Cambios de condiciones** en los planes gratuitos o en los precios. Mitigación: arquitectura con adaptadores y exportaciones periódicas.
- **Pausa por inactividad** en Supabase Free: si se usara con usuarios, perderían el acceso. Mitigación: no usar Free con usuarios reales.
- **Facturación por uso** (cómputo, transferencia, PITR, SMS). Mitigación: límite de gasto activado, alertas y no activar complementos sin aprobación.
- **Residencia de los datos**: copias, registros y subencargados fuera de la UE. Mitigación: región de la UE, revisión del DPA y de los subencargados, y evaluación de impacto.
- **Dependencia del proveedor** (Auth y almacenamiento de Supabase). Mitigación: puertos propios y datos en PostgreSQL estándar.
- **Operación propia** (VPS o PostgreSQL propio): copias, parches y seguridad recaen en nosotros.
- **Transferencia de vídeo**: es lo que más puede crecer con el uso. Mitigación: vídeos ligeros, caché larga, límite de gasto y la opción de R2, que no cobra la transferencia (`MEDIA.md`).

## Fuentes consultadas

- Supabase: [precios](https://supabase.com/pricing), [documentación de precios](https://supabase.com/docs/pricing), [copias de seguridad](https://supabase.com/docs/guides/platform/backups.md), [límite de gasto](https://supabase.com/docs/guides/platform/spend-cap), [regiones](https://supabase.com/docs/guides/platform/regions), [RGPD](https://supabase.com/docs/guides/security/gdpr-compliance), [residencia y transferencias](https://supabase.com/legal/privacy-resources/data-residency-and-transfers-faq), [MFA](https://supabase.com/features/multi-factor-authentication), [facturación](https://supabase.com/docs/guides/platform/billing-on-supabase).
- Terceros sobre Supabase: [Jet Admin (2026)](https://www.jetadmin.io/blog/supabase-pricing-2026-guide-to-plans-limits-and-real-world-costs/), [MakerKit](https://makerkit.dev/blog/saas/supabase-pricing), [Automation Atlas](https://automationatlas.io/answers/supabase-free-tier-limits-2026/), [MetaCTO](https://metacto.com/blogs/the-true-cost-of-supabase-a-comprehensive-guide-to-pricing-integration-and-maintenance), [SimpleBackups](https://simplebackups.com/blog/what-supabase-native-backup-doesnt-cover).
- Neon: [Activepieces (2026)](https://www.activepieces.com/blog/neon-pricing-2026-plans-free-tier-limits-and-costs.md), [Jet Admin](https://www.jetadmin.io/blog/neon-pricing/), [releases.sh](https://releases.sh/collections/serverless-postgres/digest/2026-09-28).
- GitHub Actions: [cambios de precios (GitHub)](https://github.blog/changelog/2025-12-16-coming-soon-simpler-pricing-and-a-better-experience-for-github-actions/), [Copilot y minutos (GitHub)](https://github.blog/changelog/2026-04-27-github-copilot-code-review-will-start-consuming-github-actions-minutes-on-june-1-2026/), [heise](https://heise.de/-11118027), [cicdcost](https://cicdcost.com/github-actions-pricing-changes-2026).
- Alojamiento: [Vercel Hobby](https://vercel.com/docs/plans/hobby-plan), [Vercel Pro](https://vercel.com/docs/plans/pro), [Netlify (netli.fyi)](https://netli.fyi/blog/netlify-free-plan-limits-2026), [límites de Cloudflare Workers](https://developers.cloudflare.com/workers/platform/limits), [Render Free](https://render.com/docs/free), [Hetzner CX23 (vpsbenchmarks)](https://www.vpsbenchmarks.com/hosters/hetzner/plans/cx23), [Hetzner, planes de coste optimizado](https://www.hetzner.com/cloud/cost-optimized).
