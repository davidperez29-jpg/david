# Sistema de diseño

Identidad **alegre, cercana, moderna y profesional**: amarillo cálido para acentos y acciones, crema como fondo y blanco para las superficies; formas redondeadas, jerarquía clara y pictogramas deportivos propios. Evita el aspecto frío y corporativo.

## Tokens (`src/app/globals.css`, `@theme` de Tailwind 4)

| Familia        | Tokens                                                                                    | Uso                                                        |
| -------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Crema          | `cream-50 · 100 · 200 · 300`                                                              | Fondo de la app (`100`), fondos suaves y separadores       |
| Sol (amarillo) | `sun-100 · 200 · 300 · 400 · 500 · 700 · 800`                                             | `400` acción principal y destacados; `700` texto de acento |
| Tinta          | `ink-900 · 700 · 500 · 300`, `line`                                                       | Texto principal, secundario y apagado; bordes              |
| Estados        | `leaf` (completado), `coral` (no realizado), `sky` (cálculo), `plum` (estimación y salud) | Siempre con icono y texto, nunca solo con color            |
| Gráficos       | `chart-amber` `#c27c0e`, `chart-grid`                                                     | Barras de datos y cuadrícula                               |

Sombras: `shadow-soft` (tarjetas) y `shadow-lift` (elementos que se elevan). Radios: `rounded-2xl` en controles, `rounded-3xl` en tarjetas y `rounded-[2rem]` en tarjetas protagonistas.

Tipografía: **Bricolage Grotesque** en titulares y **Plus Jakarta Sans** en el texto. Ambas OFL y autoalojadas.

## Contraste (WCAG 2.x, calculado)

| Combinación                   | Ratio   | Uso                                      |
| ----------------------------- | ------- | ---------------------------------------- |
| `ink-900` sobre blanco        | 15,77:1 | Texto principal                          |
| `ink-900` sobre `sun-400`     | 10,92:1 | Texto sobre amarillo                     |
| `ink-500` sobre `cream-100`   | 6,11:1  | Texto secundario                         |
| `sun-700` sobre blanco        | 5,93:1  | Enlaces y acentos                        |
| `leaf-700` sobre `leaf-100`   | 5,88:1  | Insignia «Completada»                    |
| `coral-700` sobre `coral-100` | 5,28:1  | Insignia «No realizada»                  |
| `sky-700` sobre `sky-100`     | 6,43:1  | Insignia «Cálculo»                       |
| `plum-700` sobre `plum-100`   | 6,30:1  | Insignias de salud y estimación          |
| `chart-amber` sobre blanco    | 3,40:1  | Barras (elemento no textual: mínimo 3:1) |

El amarillo de marca (`sun-400`) **nunca se usa como texto** ni como color de datos sobre blanco (1,74:1). Para las barras se eligió `chart-amber` con el validador de paletas: pasa los controles de luminosidad, croma y contraste. Además, las pruebas E2E ejecutan **axe** (WCAG 2.1 A/AA) en todas las pantallas principales y fallan ante incidencias graves.

## Componentes

- `src/ui`: `Button`/`ButtonLink`, `Card`/`CardHeader`, `Badge`, `Avatar`, `Stat`, `Meter` (barra de progreso accesible), `Notice`, `PageHeader` y `EmptyState`.
- `src/features/shared`: `SessionStatusBadge`, `OriginBadge`/`ProvenanceDetails`/`OriginLegend` (procedencia del dato), `WeeklyVolumeChart`/`VolumePanel`/`VolumeBoard`, `AssessmentSeriesList`, `RehabTimeline`, `PrescriptionChips`, `PendingFeature` (funcionalidad aún no disponible, siempre con su fase) y `DemoBanner`.
- `src/features/brand`: `Logo`/`LogoMark`, `PatternPictogram` (siluetas por patrón de movimiento) e ilustraciones (`HeroIllustration`, `KettlebellIllustration`, `RestIllustration`). Todo es SVG propio.

## Gráficos

Las columnas de volumen semanal siguen estas reglas:

- Barras de 24 px como máximo, con 4 px redondeados en el extremo del dato y rectas en la base.
- Cuadrícula fina y discreta. Una sola serie, así que no lleva leyenda (el título dice qué se mide).
- Etiqueta directa solo en la semana en curso.
- _Tooltip_ con ratón y con teclado (cada barra es un botón con nombre accesible).
- Vista en tabla con todos los valores (`Ver datos en tabla`).
- Un único selector de métrica encima de los gráficos a los que afecta.
- Cada gráfico indica la fórmula (id + versión) que produce sus cifras.

## Patrones de experiencia

- **Cliente**: una columna pensada para el móvil. La sesión de hoy ocupa la pantalla principal y el botón «Empezar sesión» se ve sin hacer scroll (comprobado en E2E). Las series se confirman con un toque, porque los valores prescritos vienen ya rellenos. Botones de 48 px o más y descanso automático con +15 s y «Saltar». El progreso vive en su propia pestaña.
- **Entrenador**: barra lateral en escritorio y menú desplegable en móvil, panel con hechos (sin interpretaciones automáticas) y ficha del cliente con **pestañas horizontales**. Cada pestaña es una ruta enlazable; en pantallas estrechas se desplazan en horizontal y la activa se marca con `aria-current`.
- **Biblioteca**: panel de filtros por dimensión (plegable), selector «Todos (Y) / Alguno (O)», chips de filtros activos con botón para quitarlos y resultados que se actualizan al momento. Las siluetas son un campo visual de cada variante (15 tipos), independiente de su clasificación.
- **Honestidad**: lo que aún no existe se marca con `PendingFeature` o `Notice`, nunca como si funcionara. El aviso de demostración está siempre visible.
- **Accesibilidad**: `lang="es"`, enlace «Saltar al contenido», foco visible, `aria-current` en la navegación, estados con texto (no solo color) y respeto de `prefers-reduced-motion`.
