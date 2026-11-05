# Informe de la Fase 1 · Fundamentos

Fecha: 5 de noviembre de 2026 · Rama: `claude/vigilant-bardeen-qfycp4` · Especificación de referencia: «Prompt maestro de desarrollo desde cero».

> **Resumen.** TrainPro es un proyecto nuevo, sin código ni historial del proyecto anterior. Incluye:
>
> - una arquitectura por capas;
> - una interfaz navegable del entrenador (21 rutas) y del cliente (4 rutas, para móvil);
> - el modelo conceptual de datos completo, con la biblioteca multidimensional de ejercicios;
> - 84 tests unitarios y de integración y 30 pruebas E2E, todos superados.
>
> Todo funciona con **datos ficticios en memoria**: no hay base de datos, no hay inicio de sesión real y nada se guarda.

## 1. Entorno y preservación del proyecto anterior

- El repositorio `davidperez29-jpg/david` contenía otro proyecto (`training-platform`). Sigue **intacto** en la rama por defecto `claude/training-platform-system-hm10nq` (commit `ff080be`).
- TrainPro vive en la rama huérfana `claude/vigilant-bardeen-qfycp4`. No comparte archivos, dependencias, configuración ni historial con el proyecto anterior.
- Nunca se ha hecho push a la rama por defecto ni push forzado, y no se ha migrado ni conectado nada del proyecto anterior.

## 2. Tecnologías y versiones

| Pieza                             | Versión                       | Licencia             | Motivo                                                   |
| --------------------------------- | ----------------------------- | -------------------- | -------------------------------------------------------- |
| Node.js                           | ≥ 22.13 (probado con 22.23.4) | MIT                  | Entorno de ejecución                                     |
| pnpm                              | 10.28.0                       | MIT                  | npm 10.9 falla al instalar (ADR-03)                      |
| Next.js                           | 16.4.5                        | MIT                  | Dos experiencias en un proyecto, servidor y PWA (ADR-02) |
| React / React DOM                 | 19.3.1                        | MIT                  | Interfaz                                                 |
| TypeScript                        | 6.0.3 (estricto)              | Apache-2.0           | Errores en compilación                                   |
| Tailwind CSS                      | 4.3.4                         | MIT                  | Sistema de diseño con _tokens_                           |
| lucide-react                      | 1.65.0                        | ISC                  | Iconos                                                   |
| server-only                       | 0.0.1                         | MIT                  | Impide que el código de servidor llegue al navegador     |
| ESLint + eslint-config-next       | 10.13.0 + 16.4.5              | MIT                  | Calidad y límites entre capas                            |
| Prettier                          | 3.9.10                        | MIT                  | Formato                                                  |
| Vitest                            | 5.0.5                         | MIT                  | Tests unitarios y de integración                         |
| Playwright + @axe-core/playwright | 1.63.0 + 4.14.0               | Apache-2.0 / MPL-2.0 | E2E y accesibilidad (solo desarrollo)                    |

**Evaluadas y no adoptadas todavía**, con la justificación en `DECISIONS.md`:

- **Gráficos:** propios ahora; Recharts o visx en la Fase 5 (ADR-12).
- **Validación:** Zod en la Fase 2 (ADR-13).
- **Datos:** PostgreSQL, con Supabase o un servidor propio a decidir (P-01).

Ningún servicio externo ni de pago.

## 3. Arquitectura

Monolito modular en Next.js con capas comprobadas por ESLint (`ARCHITECTURE.md`):

- `src/domain`: TypeScript puro. Modelo, reglas, permisos, procedencia, fórmulas versionadas, volumen, evaluaciones con intentos, objetivos, readaptación y biblioteca (taxonomía, variantes y búsqueda Y/O).
- `src/contracts`: tipos de los datos que el servidor entrega a la interfaz, ya filtrados por permisos.
- `src/server`: contexto de la petición, casos de uso con control de acceso, puertos de repositorio y adaptador demo en memoria.
- `src/features` y `src/ui`: pantallas y componentes del sistema de diseño.
- `src/app`: rutas.

**Modelo conceptual de datos:** `DATA_MODEL.md`, con diagramas entidad-relación de todos los módulos y detalle de la biblioteca multidimensional (ejercicio principal y variantes, etiquetas globales y personales por categoría, patrones jerárquicos, material, región, ejecución, entorno, complejidad, progresiones y regresiones, favoritos, notas, propietario y visibilidad).

## 4. Estructura y archivos creados

Archivos versionados por zona:

| Zona                   | Contenido                                                                                                                                                                                                                                                                                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Raíz                   | `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `next.config.ts` (cabeceras de seguridad), `eslint.config.mjs` (límites entre capas), `vitest.config.mts`, `playwright.config.ts`, `postcss.config.mjs`, `.env.example`, `.gitignore`, `.prettierrc.json`, `.npmrc`, `.nvmrc`, `README.md`, `AGENTS.md`                                                          |
| `src/domain` (+ tests) | `access`, `measurement`, `formulas`, `assessment`, `goals`, `people`, `rehab`, `time`, `text`, `format`, `training/{prescription,session,volume}`, `library/{taxonomy,exercise,search}`                                                                                                                                                                             |
| `src/server` (+ tests) | `env`, `context`, `repositories/{ports, demo/{dataset, library, index}}`, `services/{trainer, trainer-access, client-file, client, library, mappers}`                                                                                                                                                                                                               |
| `src/contracts`        | `shared`, `trainer`, `client`                                                                                                                                                                                                                                                                                                                                       |
| `src/features`         | `brand/` (logotipo, 15 siluetas, ilustraciones), `shared/` (procedencia, estados, gráfico de volumen, evaluaciones, readaptación, prescripción, funcionalidad pendiente, aviso de demo, service worker), `trainer/` (shell, navegación, pestañas de la ficha, lista de clientes, buscador de la biblioteca), `client/` (navegación inferior, reproductor de sesión) |
| `src/ui`               | `button`, `card`, `badge`, `avatar`, `stat`, `meter`, `notice`, `page-header`, `empty-state`, `cn`                                                                                                                                                                                                                                                                  |
| `src/app`              | 27 páginas (ver §5), `layout`, `manifest`, `icon.svg`, `apple-icon.png`, `not-found`, `error`, `globals.css`                                                                                                                                                                                                                                                        |
| `public/`              | `sw.js`, `offline.html`, `icons/` (192, 512, adaptable, Apple)                                                                                                                                                                                                                                                                                                      |
| `e2e/`                 | `helpers`, `platform`, `trainer`, `client-app`                                                                                                                                                                                                                                                                                                                      |
| `docs/`                | `ARCHITECTURE`, `DATA_MODEL`, `DECISIONS`, `SECURITY_PRIVACY`, `SCIENTIFIC_RIGOR`, `DESIGN_SYSTEM`, `DEVELOPMENT`, `ROADMAP`, `PHASE1_REPORT`                                                                                                                                                                                                                       |
| `scripts/`             | `generate-icons.mjs`                                                                                                                                                                                                                                                                                                                                                |

## 5. Pantallas implementadas

**Área del entrenador**

1. **Panel**: sesiones de hoy, clientes activos, semana, readaptaciones, avisos basados en hechos y evaluaciones recientes con el origen del dato.
2. **Clientes**: lista con búsqueda sin distinguir tildes.
3. **Ficha del cliente con 10 pestañas horizontales** (cada una es una ruta):
   - Información.
   - Objetivos, enlazados con pruebas.
   - Evaluaciones (historial con intentos).
   - Resultados y evolución.
   - Planificación (semana y próxima sesión con la prescripción completa).
   - Sesiones.
   - Registro de entrenamiento: lo realizado serie a serie, RIR/RPE real y observaciones del cliente.
   - Informes.
   - Salud y readaptación, con acceso restringido.
   - Información compartida.
4. **Evaluaciones**: últimos resultados, leyenda de procedencias y catálogo de pruebas.
5. **Análisis de resultados**: evolución y comparaciones, solo cuando son comparables.
6. **Planificación**: semana de todos los clientes activos.
7. **Biblioteca de ejercicios**:
   - Buscador con texto y 8 dimensiones de filtro combinables, en modo Todos (Y) o Alguno (O).
   - Grupos de patrones que incluyen sus subtipos.
   - Chips activos con botón para quitarlos, orden, solo favoritos y resultados al instante.
8. **Ficha de ejercicio**: todos los campos del apartado 8.5 de la especificación. Las variantes se relacionan entre sí, las progresiones y regresiones son enlaces, y las instrucciones se heredan de la variante de referencia si faltan.
9. **Carga y volumen**: series, repeticiones y tonelaje por semana, con las definiciones versionadas y sus limitaciones.
10. **Readaptación**: fases y criterios definidos por el profesional.
11. **Informes** y **Configuración**: solo indican lo previsto o se consultan.

**Portal del cliente (móvil)**

1. **Hoy**: la sesión del día es la protagonista y el botón «Empezar sesión» se ve sin hacer scroll. El progreso no ocupa la pantalla principal.
2. **Sesión**:
   - Prescripción completa con silueta, «Cómo se hace» y explicación del tempo.
   - Un toque por serie o «Marcar todas como hechas».
   - Validación de lo que se escribe y temporizador de descanso.
   - RIR o RPE real por ejercicio.
   - Resumen calculado, esfuerzo de la sesión y observaciones para el entrenador.
3. **Semana**.
4. **Progreso**: apartado independiente que solo muestra lo compartido.

Además: portada, 404 propio, página de error y página sin conexión.

## 6. Funcionalidades realmente operativas

Lógica real, probada, ejecutada sobre datos ficticios:

- **Permisos en el servidor**:
  - Cada entrenador solo ve sus clientes, en todas las pestañas.
  - Un cliente solo ve lo suyo y lo que se le comparte.
  - Las sesiones ajenas responden 404.
  - Los ejercicios privados y propios, las etiquetas personales, los favoritos, las notas y las progresiones son solo de su autor.
- **Biblioteca**:
  - Taxonomía completa de la especificación (19 etiquetas en 3 categorías, 22 patrones en 5 grupos, material, regiones, entornos, ejecución y complejidad).
  - Detección de etiquetas duplicadas e integridad del catálogo.
  - Búsqueda Y/O con jerarquías.
  - Catálogo demo de 17 ejercicios principales y 30 variantes, entre ellas las 7 variantes de sentadilla de la especificación.
- **Trazabilidad**: procedencia validada en cada dato; resultados de evaluación obtenidos de sus intentos con una regla registrada (mejor intento o promedio); comparaciones solo si coinciden unidad, método, instrumento y regla.
- **Cálculo de volumen** con fórmulas versionadas (series, repeticiones, tonelaje), excluyendo del tonelaje las series sin carga externa.
- **Estado de las sesiones** deducido de los registros; objetivos enlazados con pruebas; fases de readaptación según sus criterios.
- **Reproductor de sesión**: funciona por completo en pantalla, pero **no guarda nada**.
- **Plataforma**: cabeceras de seguridad, PWA (manifiesto, iconos y página sin conexión verificada) y configuración validada al arrancar.

**Solo visual, simulado o pendiente** (no debe darse por hecho):

- Autenticación y persistencia (Fase 2).
- Alta y edición de clientes y objetivos (Fase 3).
- Gestión de la biblioteca: crear, editar, cambiar favoritos y relaciones, subir medios (Fase 4).
- Registro de evaluaciones, protocolos y referencias (Fase 5).
- Editor de planes y añadir ejercicios a una sesión (Fase 6).
- Envío al entrenador de registros y observaciones del cliente (Fase 7).
- Volumen por patrón o etiqueta, carga interna y estimación de RM (Fase 8).
- Informes, lesiones y antecedentes (Fase 9).
- Edición de lo compartido.
- Métricas visibles configurables por población y objetivo.
- Vídeos.
- Instalación real de la PWA en un móvil (requiere HTTPS y despliegue).

## 7. Pruebas realizadas y resultados

Todas ejecutadas en este entorno el 5 de noviembre de 2026:

| Comprobación                                                      | Resultado                                                    |
| ----------------------------------------------------------------- | ------------------------------------------------------------ |
| `pnpm format:check`                                               | Todo con formato correcto                                    |
| `pnpm lint` (incluye límites entre capas)                         | 0 errores, 0 avisos                                          |
| `pnpm typecheck`                                                  | 0 errores                                                    |
| `pnpm test` (Vitest)                                              | **84/84 superados** en 9 archivos                            |
| `pnpm build`                                                      | Correcto: 30 entradas (las páginas con datos, dinámicas)     |
| `pnpm test:e2e` (Chromium de escritorio + emulación Pixel 7)      | **30/30 superados**                                          |
| axe (WCAG 2.1 A/AA) en todas las pantallas principales y pestañas | Sin incidencias graves ni críticas                           |
| `pnpm audit --prod`                                               | Sin vulnerabilidades conocidas                               |
| `pnpm audit` (con desarrollo)                                     | 1 moderada en `minimatch` dentro de ESLint (riesgo aceptado) |

Errores reales que las pruebas detectaron en esta fase y que ya están corregidos:

- Un test de E2E daba por abierto un grupo de filtros que empieza plegado.
- Dos tests suponían que el primer ejercicio siempre tiene RIR.
- En fases previas de esta misma Fase 1: el nombre accesible del logotipo, el contraste de las fases futuras de readaptación, la pureza del temporizador, las series por tiempo que sumaban repeticiones y la numeración de bloques.

## 8. Errores y limitaciones

- **No probado en dispositivos reales** (iOS, Android) ni con lectores de pantalla: solo Chromium con emulación móvil.
- La CSP aún admite `'unsafe-inline'` en scripts; la versión estricta con _nonce_ llegará con la autenticación.
- La telemetría de Next.js viene activada. Se desactiva con `pnpm exec next telemetry disable`; ponerla en `.env.local` **no** funciona (comprobado).
- **Patrones**: algunos ejercicios demo no tienen patrón (aceleraciones, paseo del granjero, saltos de tobillo, elevación de talones, movilidad), porque no encajan en los cinco grupos iniciales (P-09).
- **Biblioteca**: los favoritos se muestran, pero aún no se pueden cambiar; las etiquetas personales y las notas son datos de ejemplo.
- **Filtros**: en la biblioteca no muestran cuántos resultados tendría cada opción.
- **Volumen unilateral**: las repeticiones de ejercicios unilaterales cuentan tal como se prescriben (por ejemplo, por pierna); está documentado en la fórmula.
- **Entorno**: el servidor de desarrollo dejó de detectar cambios en algunos momentos de este entorno (se resuelve reiniciándolo; producción no se ve afectada). ESLint 10 muestra avisos de _peer dependencies_ de tres plugins.

## 9. Decisiones pendientes

| Id          | Decisión                                                               | Recomendación                                                                           |
| ----------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| P-01        | Base de datos                                                          | PostgreSQL. Supabase o propio, tras revisar condiciones, límites, región UE y DPA       |
| P-02        | Autenticación                                                          | Proveedor con 2FA para entrenadores; definir cómo se envían los correos                 |
| P-03        | Alojamiento y región                                                   | UE; sin despliegue hasta autorizarlo                                                    |
| P-04        | CI en GitHub Actions                                                   | Recomendado (consume minutos; gratis en repositorios públicos)                          |
| P-05 / P-06 | Licencia y repositorio propio                                          | Decidir antes de abrir el código o invitar a otras personas                             |
| P-07        | Modo oscuro                                                            | No prioritario                                                                          |
| P-08        | «Personalizado» frente a «privado» en la biblioteca                    | Confirmar la interpretación: propio y compartible con el equipo, frente a solo el autor |
| P-09        | Ampliar patrones (locomoción, salto, transporte)                       | Recomendado                                                                             |
| P-10        | Quién mantiene el catálogo global                                      | Un rol de administración del catálogo                                                   |
| P-11        | Zod (Fase 2) y librería de gráficos (Fase 5)                           | Ver ADR-12 y ADR-13                                                                     |
| —           | Procedimiento para el derecho de acceso del cliente a sus datos (RGPD) | Definirlo con asesoría jurídica                                                         |

## 10. Cómo ejecutarlo

```bash
corepack enable            # una vez por equipo (activa pnpm)
pnpm install               # instala las dependencias
pnpm dev                   # abre http://localhost:3000
```

- **Entrenador:** `/entrenador`. **Cliente:** `/cliente` (mejor en un móvil o con la ventana estrecha).
- **Comprobar que todo está bien:** `pnpm check`. **Pruebas E2E:** `pnpm exec playwright install chromium` (una vez) y después `pnpm test:e2e`.
- **Requisitos:** Node.js 22.13 o superior y conexión a internet al instalar y al compilar (para descargar las fuentes).
