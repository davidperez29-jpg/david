# Decisiones técnicas (ADR)

Cada decisión indica su estado: **Aprobada** (por el responsable del producto), **Adoptada** (tomada en la Fase 1, revisable) o **Pendiente** (necesita aprobación antes de implementarse).

## ADR-01 · Proyecto nuevo en una rama sin historial · Aprobada

El repositorio contenía otro proyecto. TrainPro se creó como **rama huérfana** `claude/vigilant-bardeen-qfycp4`: no comparte archivos, dependencias, configuración ni historial con el proyecto anterior. Esa rama no existía todavía en GitHub, así que se publicó como rama nueva y **no hubo que sobrescribir nada**. El proyecto anterior sigue intacto en la rama por defecto, `claude/training-platform-system-hm10nq`. Más adelante se puede mover a un repositorio propio (`git push <nuevo-remoto> claude/vigilant-bardeen-qfycp4:main`).

## ADR-02 · Next.js 16 + React 19 + TypeScript estricto + Tailwind CSS 4 · Aprobada

- Un solo proyecto sirve las dos experiencias, con rutas y permisos en el servidor.
- El renderizado en servidor evita enviar al navegador datos que el usuario no debe ver.
- Admite PWA instalable (manifest y service worker) sin dependencias extra.
- Licencias MIT/Apache, sin coste, y se puede alojar en muchos proveedores o en un servidor propio.
- TypeScript con `strict` y `noUncheckedIndexedAccess`: los errores de datos ausentes aparecen al compilar.
- Alternativa descartada: una SPA con Vite. Obligaría a un backend aparte para los permisos y dejaría más lógica de seguridad en el navegador.

## ADR-03 · pnpm como gestor de paquetes · Adoptada

npm 10.9 falla al resolver el árbol de dependencias (`Cannot read properties of null (reading 'edgesOut')`, un error interno de arborist con dependencias _peer_ opcionales de Vitest). Es reproducible. pnpm 10.28 resuelve sin problemas, es más estricto (impide usar dependencias no declaradas) y se fija con `packageManager` para que Corepack instale la misma versión en cualquier equipo.

## ADR-04 · Dominio puro, puertos y adaptadores · Adoptada

La lógica (permisos, procedencia, fórmulas y volumen) vive en `src/domain` sin dependencias de framework, con tests unitarios. El acceso a datos se hace a través de interfaces. Esto permite decidir la base de datos más adelante sin reescribir la aplicación.

## ADR-05 · Capa `contracts` entre servidor e interfaz · Adoptada

La interfaz no puede importar código de servidor (regla de ESLint). Los tipos de los modelos de vista viven en `src/contracts`, que solo contiene tipos. Así el contrato es explícito y se comprueba en compilación.

## ADR-06 · Sin base de datos en la Fase 1 · Aprobada (por el alcance de la fase)

Los datos son ficticios, deterministas y generados en memoria a partir de la fecha actual. No hay persistencia: el registro de sesiones del cliente funciona en la pantalla, pero no se guarda.

## ADR-07 · Dependencias mínimas · Adoptada

| Dependencia                                                           | Motivo                                                                |
| --------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `next`, `react`, `react-dom`                                          | Marco de la aplicación                                                |
| `lucide-react` (ISC)                                                  | Iconografía coherente y accesible; solo se incluyen los iconos usados |
| `server-only`                                                         | Impide en compilación que el código de servidor llegue al navegador   |
| `tailwindcss`, `@tailwindcss/postcss`                                 | Estilos con _tokens_ de diseño                                        |
| `typescript`, `eslint`, `eslint-config-next`, `prettier`              | Calidad y consistencia                                                |
| `vitest`                                                              | Tests unitarios y de integración                                      |
| `@playwright/test`, `@axe-core/playwright` (MPL-2.0, solo desarrollo) | E2E y accesibilidad automática                                        |

No se usan: librería de gráficos (las barras de volumen son HTML/CSS accesibles), librería de componentes, ORM, validación de formularios ni gestión de estado. Se añadirán solo cuando una fase lo justifique.

## ADR-08 · ESLint 10 · Adoptada

ESLint 9 ya no tiene soporte. La documentación de Next 16.4 confirma que `eslint-config-next` funciona con ESLint 10, aunque tres plugins (react, import y jsx-a11y) aún no lo declaran en sus _peer dependencies_. Por eso pnpm muestra avisos al instalar. El lint se ejecuta sin errores.

## ADR-09 · Fuentes autoalojadas · Adoptada

Plus Jakarta Sans (texto) y Bricolage Grotesque (titulares), ambas con licencia OFL, mediante `next/font/google`. Se descargan **al compilar** y se sirven desde el propio dominio: el navegador del usuario no contacta con Google. Hace falta conexión a internet durante `pnpm build`.

## ADR-10 · PWA mínima y respetuosa con la privacidad · Adoptada

Incluye un manifiesto con iconos (también uno adaptable para Android) y un service worker que solo guarda en caché la página sin conexión y un icono. Las páginas y los datos siempre se piden a la red, así que no queda información personal en la caché del dispositivo. El modo sin conexión con datos (por ejemplo, registrar una sesión en el gimnasio sin cobertura) requiere decidir antes qué se puede guardar en el dispositivo y cómo cifrarlo.

## ADR-11 · Renderizado dinámico en páginas con datos · Adoptada

Todas las páginas con datos se renderizan en cada petición. Es coherente con la autenticación futura, que dependerá de la cookie, y evita que «hoy» quede congelado al compilar.

## ADR-12 · Gráficos: componentes propios ahora, librería cuando haga falta · Adoptada (revisable en la Fase 5)

Alternativas evaluadas, todas con licencia abierta y sin coste:

| Opción                         | Licencia   | A favor                                                                                                 | En contra                                                            |
| ------------------------------ | ---------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Componentes propios (HTML/SVG) | —          | Cero dependencias, control total de la accesibilidad (teclado, tabla de datos) y de la identidad visual | Más trabajo para gráficos complejos (líneas con muchas series, zoom) |
| Recharts                       | MIT        | Muy usada en React, declarativa, SVG                                                                    | Hay que reforzar la accesibilidad; aumenta el tamaño del JavaScript  |
| visx                           | MIT        | Piezas de bajo nivel muy flexibles                                                                      | Más código propio por gráfico                                        |
| Chart.js                       | MIT        | Madura, ligera                                                                                          | Dibuja en _canvas_: la accesibilidad depende de alternativas aparte  |
| Apache ECharts                 | Apache-2.0 | Muy completa                                                                                            | Pesada para lo que necesitamos ahora                                 |

**Decisión:** en la Fase 1 solo hay columnas de volumen semanal, y se hacen con componentes propios accesibles (`src/features/shared/volume.tsx`). Cuando lleguen los gráficos de evolución y comparación (Fases 5 y 9), se propondrá **Recharts** o **visx**, con justificación y prueba de accesibilidad, antes de añadir la dependencia.

## ADR-13 · Validación de datos · Adoptada (Zod propuesto para la Fase 2)

- **Hoy:** la validación de dominio está en funciones puras con tests (`prescriptionIssues`, `measurementIssues`, `provenanceIssues`, `resultIssues`, `libraryIssues`, `taxonomyIssues`), y la del entorno en `src/server/env.ts`. No hay formularios que envíen datos al servidor.
- **Propuesta:** adoptar **Zod** (MIT) en la Fase 2 para validar las entradas de formularios y _Server Actions_ en el borde del servidor. Los esquemas delegarán en las reglas del dominio para no duplicarlas. Alternativa considerada: Valibot (MIT, más ligera), con menor adopción.
- Regla: **todo dato que entre al servidor se valida en el servidor**, aunque el formulario también valide en el navegador.

## ADR-14 · Pruebas automatizadas · Adoptada

- **Vitest** (MIT): reglas del dominio y casos de uso con el adaptador demo, incluidos los intentos de acceso no autorizado.
- **Playwright** (Apache-2.0): pruebas E2E contra la compilación de producción, en escritorio y móvil emulado.
- **axe-core** (MPL-2.0, solo desarrollo): análisis WCAG 2.1 A/AA en todas las pantallas principales.
- Pendiente: pruebas de integración con PostgreSQL real (Fase 2/3), pruebas en dispositivos reales y con lectores de pantalla (Fase 10).

## ADR-15 · Biblioteca: ejercicio principal + variantes con clasificación propia · Adoptada

Se eligió separar `exercise` (principal) de `exercise_variant` (prescribible) en lugar de una única tabla con autorreferencia:

- La especificación pide entidades independientes para ejercicios y variantes.
- Las sesiones siempre prescriben una **variante** concreta. Cada principal tiene una variante de referencia.
- Las variantes **no heredan** clasificación (etiquetas, patrones, material). Solo, para presentación, las instrucciones de la referencia cuando no tienen las suyas.
- Patrones, material y región son **árboles ampliables**. Filtrar por un grupo incluye sus subtipos.
- Las etiquetas personales sobre ejercicios globales se guardan con su autor y solo las ve él.

Detalle completo en `DATA_MODEL.md`.

## ADR-16 · Estado de la sesión deducido de lo realizado · Adoptada (revisión de la Fase 1)

Corrige un error detectado en la revisión: pulsar «Terminar» marcaba la sesión como completada aunque faltaran series. Ahora:

- Hay una única función de dominio (`summarizeExecution` + `deriveSessionStatus`) que usan el servidor y el portal del cliente.
- Estados: pendiente, en curso, completada (todas las series), parcial o interrumpida, y no realizada.
- Las series se **deduplican** por (ejercicio, número de serie) y se descartan los registros ajenos a lo prescrito. Series, repeticiones y tonelaje se calculan sobre esas series efectivas.
- Al terminar con series pendientes, el cliente ve una confirmación, y el resumen muestra lo prescrito frente a lo realizado, ejercicio a ejercicio.
- En base de datos se añadirá la restricción única en `set_log` como segunda barrera.

## ADR-17 · Taxonomía v2: cuatro dimensiones de etiquetas y patrones con rol · Adoptada (revisión de la Fase 1)

- **Etiquetas:** Cualidades y objetivos, Métodos y formas de entrenamiento, Acciones musculares y ejecución, y Aplicaciones y evaluación. «1RM» se archiva y se sustituye por «Test o evaluación de 1RM» y «Trabajo con porcentajes de 1RM». Los ids se conservan.
- **Patrones:** se añaden flexión y extensión de cadera, locomoción, saltos, aterrizajes y transporte de cargas, con **patrón principal y secundarios**.
- Detalle en `TAXONOMY.md`.

## ADR-18 · Unilateral/bilateral como dimensión «Ejecución», no como patrón · Propuesta (P-12)

Los saltos y aterrizajes se clasifican por dirección (patrón). La ejecución unilateral o bilateral se toma de la dimensión independiente «Ejecución». Así no se guarda el mismo dato en dos sitios ni se mezclan ejes biomecánicos distintos. La búsqueda combina ambos, y el texto «salto unilateral» funciona. Si prefieres patrones explícitos «Salto unilateral» o «Aterrizaje bilateral», se pueden añadir sin romper nada.

## ADR-19 · Niveles global, personalizado y privado; adaptar = copiar · Adoptada (definición del responsable del producto)

- **Global:** lo gestiona la administración del catálogo (`admin`, rol nuevo que no accede a datos de clientes).
- **Personalizado:** del entrenador, utilizable con sus clientes y preparado para compartirse con su equipo.
- **Privado:** solo su autor.
- Adaptar un ejercicio global crea una **copia personalizada** con `derivedFrom` (`adaptVariant`) y el original no cambia.
- Tres relaciones distintas: variante de, copia adaptada de, y progresión o regresión.

## Pendientes de aprobación

| Id   | Decisión                                                                                                         | Notas                                                                                                                                                                                                                |
| ---- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P-01 | **Base de datos**: PostgreSQL con **Supabase** y Supabase Auth (opción preferida)                                | Comparativa en `INFRASTRUCTURE.md`. **No autorizado conectar**: la Fase 2 puede desarrollarse con Supabase local (Docker), sin cuenta. Antes de usar datos reales: plan Pro en región UE, DPA y decisión sobre PITR. |
| P-02 | **Autenticación**: Supabase Auth con 2FA por aplicación (TOTP) para entrenadores                                 | El 2FA por SMS es de pago. Falta decidir el proveedor de correo para producción.                                                                                                                                     |
| P-03 | **Alojamiento** y región UE                                                                                      | Opciones y límites en `INFRASTRUCTURE.md` (Vercel Hobby no admite uso comercial). Sin despliegue hasta aprobarlo.                                                                                                    |
| P-04 | **CI en GitHub Actions**                                                                                         | Unos 6–8 min por ejecución; cabe en los 2.000 min/mes del plan Free con límite de gasto 0.                                                                                                                           |
| P-05 | ~~Licencia~~                                                                                                     | **Resuelta:** repositorio privado, sin licencia abierta (`UNLICENSED`).                                                                                                                                              |
| P-06 | **Repositorio propio** para TrainPro                                                                             | Recomendado a medio plazo.                                                                                                                                                                                           |
| P-07 | **Modo oscuro**                                                                                                  | No incluido: la identidad pedida es clara (amarillo, crema y blanco).                                                                                                                                                |
| P-08 | ~~Personalizado frente a privado~~                                                                               | **Resuelta** por el responsable del producto (ADR-19).                                                                                                                                                               |
| P-09 | ~~Ampliar patrones~~                                                                                             | **Resuelta** (ADR-17).                                                                                                                                                                                               |
| P-10 | ~~Quién mantiene el catálogo global~~                                                                            | **Resuelta:** administración de TrainPro (rol `admin`, ADR-19). Falta definir quién la ejerce en la práctica.                                                                                                        |
| P-11 | **Zod** para validar entradas (Fase 2) y **librería de gráficos** (Fase 5)                                       | Ver ADR-13 y ADR-12.                                                                                                                                                                                                 |
| P-12 | **Unilateral/bilateral en saltos y aterrizajes**: como dimensión «Ejecución» (actual) o como patrones explícitos | Ver ADR-18.                                                                                                                                                                                                          |
| P-13 | **Notas privadas del entrenador** frente al derecho de acceso del cliente                                        | Ver `DATA_RIGHTS.md`; requiere asesoría jurídica.                                                                                                                                                                    |
| P-14 | **Roles del tratamiento** (entrenador responsable, TrainPro encargado) y contrato de encargo                     | Ver `DATA_RIGHTS.md`.                                                                                                                                                                                                |
| P-15 | **Plazos de conservación** e inactividad                                                                         | Propuesta inicial en `DATA_RIGHTS.md`, para validar.                                                                                                                                                                 |
