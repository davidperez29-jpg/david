# TrainPro · Documento maestro

Documento de referencia del producto: qué es TrainPro, qué reglas lo rigen, qué incluye cada módulo y dónde está el detalle. Reúne la especificación maestra de desarrollo, la revisión de la Fase 1 y los requisitos de la experiencia de entrenamiento guiada. Si dos documentos se contradicen, **manda el más específico** y se corrige el otro.

| Versión | Fecha                   | Cambios                                                                                                                                                                                                                                                                                                                                                                    |
| ------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.0     | 6 de noviembre de 2026  | Primera versión: consolida la especificación y la revisión de la Fase 1, y añade el diseño de la experiencia guiada, la carga y el esfuerzo, y la gestión audiovisual (pendiente de aprobación)                                                                                                                                                                            |
| 1.1     | 6 de noviembre de 2026  | Cambio de ambición: visión estratégica, ciclo rector, motor de adaptación explicable, progresión, valoración previa, RPE de sesión, análisis competitivo e integraciones (pendiente de aprobación)                                                                                                                                                                         |
| 1.2     | 6 de noviembre de 2026  | Cierre de decisiones: tabla completa clasificada de A a E, autorregulación detallada (orígenes, matriz de acciones, perfiles, señales, simulación), decisiones estructurales de la 1B, escenarios de validación S-01 a S-24, revisión regulatoria con fuentes oficiales y registro de riesgos (pendiente de aprobación)                                                    |
| 1.3     | 7 de noviembre de 2026  | Auditoría de preparación para implementar (`IMPLEMENTATION_READINESS.md`): reclasificación de las funcionalidades de la 1B (A–D), primera versión funcional cerrada, seis preguntas para aprobar (Q1–Q6), entregas verticales V1–V6, definición de terminado, dolor sin registro estructurado en la 1B y salvaguarda de la valoración aislada (pendiente de aprobación)    |
| 1.4     | 7 de noviembre de 2026  | Especificación técnica y funcional de V1 (`V1_SPEC.md`): pantallas, modelo de datos, reglas de prescripción y registro, análisis, permisos, arquitectura, plan por bloques, pruebas y decisiones P-76 a P-84 (pendiente de aprobación)                                                                                                                                     |
| 1.5     | 7 de noviembre de 2026  | Versión 2 de `V1_SPEC.md`: varias sesiones al día, edición de sesiones publicadas con versiones (casos A–D), fechas de ejecución libres, persistencia en SQLite local, series aceptadas después de medianoche, identidad, rol y permisos por etapas, nuevas pruebas y decisiones P-85 a P-89 (pendiente de aprobación)                                                     |
| 1.6     | 7 de noviembre de 2026  | Versión 2.1 de `V1_SPEC.md`: comparativa del controlador SQLite (recomendado `better-sqlite3`), política de versiones de Node (26 LTS), límites de SQLite por entorno y vía de migración a PostgreSQL, garantías ante fallos de conexión y desglose del bloque 1 con sus pruebas (pendiente de aprobación)                                                                 |
| 1.7     | 13 de noviembre de 2026 | Bloques 1 y 2 de V1 implementados, auditados (`AUDIT_BLOCK1.md`) y corregidos (ADR-25 a ADR-32). Especificación del bloque 3 de análisis (`BLOCK3_SPEC.md`): cumplimiento multidimensional sin índice global, volumen sin mezclar magnitudes, carga interna opcional y decisiones P-90 a P-113. Avance medido con método explícito (`ROADMAP.md`). Pendiente de aprobación |
| 1.8     | 13 de noviembre de 2026 | Aprobadas P-90 a P-95 (ADR-33): cumplimiento multidimensional; diferencia, condición e interpretación separadas; prescripción original y vigente; fecha prevista y de ejecución; semana ISO; duración con advertencias. `BLOCK3_SPEC.md` versión 2: plan B3.0–B3.3, auditoría de volumen y del modelo, decisiones por etapa. **Implementación no autorizada**              |

## 1. Producto

Plataforma web para gestionar el **entrenamiento, la evaluación, el rendimiento, la salud y la readaptación**. Para entrenadores personales, preparadores físicos, readaptadores y especialistas en rendimiento y salud, y para sus clientes.

**Ciclo de trabajo:** crear cliente → evaluar → interpretar → planificar → registrar la ejecución → analizar carga y evolución → ajustar el plan.

**Ambición (v1.1, propuesta):** una plataforma profesional de nueva generación que aspire a estar entre las mejores del mercado, no por acumular funciones, sino por cerrar el ciclo **evaluar → interpretar → identificar necesidades → planificar → prescribir → ejecutar → registrar → analizar → adaptar → volver a evaluar**, con decisiones explicables y rigor científico verificable. La estrategia, los principios y el criterio de decisión de ocho preguntas están en `PRODUCT_STRATEGY.md`. No se afirma superar a ningún competidor sin una comparación verificable (`COMPETITIVE_ANALYSIS.md`).

**Dos experiencias en una sola aplicación:**

- **Entrenador** (escritorio y móvil): clientes, ficha por pestañas, biblioteca multidimensional, evaluaciones, planificación, carga y volumen, readaptación e informes.
- **Cliente** (móvil primero, PWA): **el entrenamiento del día es el protagonista**. Lo ejecuta sin interpretar la planificación ni tomar decisiones innecesarias. El progreso y las estadísticas tienen su propio apartado y solo muestran lo que el entrenador comparte.

**Administración del catálogo** (rol `admin`): mantiene la biblioteca global. No accede a datos de clientes.

## 2. Reglas que no cambian

### Trabajo

- No se avanza de fase ni se implementa sin **aprobación explícita**. Cada fase termina con un informe de revisión.
- No se conectan servicios externos, no se despliega, no se activan planes de pago ni costes, y no se introducen datos personales reales sin autorización expresa.
- No se borra ni se sobrescribe trabajo previo. El proyecto anterior se conserva en su rama.
- No se añaden dependencias innecesarias. Las nuevas se proponen antes.
- Lo simulado nunca se presenta como terminado: `PendingFeature` o `Notice`. No se inventan resultados de pruebas ni se ocultan errores.
- Si falta una decisión importante, se presenta la alternativa recomendada con sus implicaciones (`DECISIONS.md`).

### Rigor científico

- No se inventan fórmulas, referencias, valores normativos ni integraciones. Cada cálculo está en el registro de fórmulas con versión y limitaciones; los científicos, con su fuente primaria verificada (`SCIENTIFIC_RIGOR.md`).
- Cada dato medible lleva su **procedencia**: `direct`, `calculated`, `estimated`, `imported` o `self_reported`.
- No se deducen variables que el instrumento no mide ni se atribuyen a una prueba capacidades que no mide.
- **Prescrito, realizado y calculado o estimado** no se confunden ni se sobrescriben (`EFFORT_AND_LOAD.md`).
- No hay reglas universales ni automatismos por defecto: el profesional decide. El motor de adaptación propuesto respeta esta regla: solo actúa con reglas que configura el entrenador, supervisadas o preautorizadas (P-45).

### Privacidad y seguridad

- Permisos en los casos de uso del servidor con las políticas de `src/domain/access.ts`, y en base de datos con RLS como segunda barrera. Todo dato nuevo tiene tests que incluyen el acceso no autorizado.
- Los datos de salud se separan y se protegen más. El cliente solo ve lo que el entrenador comparte, sin perjuicio de sus derechos (`DATA_RIGHTS.md`).
- No se afirma el cumplimiento del RGPD sin una auditoría real. El repositorio es privado y sin licencia abierta.

### Diseño

- Identidad **alegre, cercana, deportiva y profesional**: amarillo cálido, crema y blanco, formas redondeadas, pictogramas propios, gráficos claros y buena legibilidad en móvil. Nada de aspecto SaaS genérico (`DESIGN_SYSTEM.md`).
- Accesibilidad WCAG 2.1 AA comprobada con axe en E2E.

## 3. Módulos

| Módulo                                | Alcance                                                                                                                                                                                                                               | Estado                                                                                                                                                                                   | Detalle                                     |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Identidad y permisos                  | Actores `trainer`, `client`, `admin`; aislamiento por entrenador y cliente; compartición                                                                                                                                              | Políticas implementadas; sin inicio de sesión real                                                                                                                                       | `ARCHITECTURE.md`, `SECURITY_PRIVACY.md`    |
| Clientes                              | Lista, ficha con pestañas (Información, Objetivos, Evaluaciones, Resultados, Planificación, Sesiones, Registro, Informes, Salud, Compartido)                                                                                          | Navegable con datos demo                                                                                                                                                                 | `SCREEN_INVENTORY.md`                       |
| Biblioteca                            | Ejercicio principal + variantes con clasificación propia; etiquetas en 4 dimensiones; patrones con rol; material, región, ejecución, entorno, complejidad; búsqueda Y/O; favoritos; global, personalizado y privado; adaptar = copiar | Funcional con datos demo                                                                                                                                                                 | `TAXONOMY.md`, `DATA_MODEL.md` §3           |
| **Ficha del ejercicio**               | Identificación, **silueta de la variante, vídeo breve (< 15 s) y ampliado (≤ 45 s) independientes**, información técnica e **indicaciones individualizadas**                                                                          | Parcial (sin vídeos dentro de la app ni silueta por variante); **diseño nuevo pendiente de aprobación**                                                                                  | `TRAINING_EXPERIENCE.md` §2, `MEDIA.md`     |
| **Prescripción**                      | **10 modalidades de carga**, esfuerzo RIR, RPE (con escala), ambos con justificación o ninguno, **por serie**, rangos y criterios de finalización                                                                                     | Modelo v2 completo en el dominio; constructor con prescripción común, kg, peso corporal o sin carga, y RIR/RPE (V1, bloque 1). Por serie y resto de modalidades en la interfaz: bloque 4 | `EFFORT_AND_LOAD.md`                        |
| Planificación                         | Planes, semanas, sesiones, **editor por serie, plantillas y duplicados que conservan la individualización, versiones y publicación**                                                                                                  | Sesiones con borrador, publicación, versiones y varias al día (V1, bloque 1); planes, semanas, plantillas y duplicados pendientes                                                        | `TRAINING_EXPERIENCE.md` §5                 |
| **Portal del cliente**                | Hoy, sesión guiada **en 11 pasos** (calentamiento, ejercicio actual, registro, descanso, siguiente, resumen), semana, progreso; **sin conexión**                                                                                      | Hoy y reproductor por pasos con registro sin conexión, reanudación y cola por persona (V1, bloques 1 y 2, probados); abrir la app sin conexión pendiente                                 | `TRAINING_EXPERIENCE.md` §3, §4 y §6        |
| Registro de la ejecución              | Lo realizado por serie, separado de lo prescrito; estados deducidos; sin duplicados; correcciones con historial                                                                                                                       | Registro v2 implementado y probado (V1, bloque 2, y correcciones del 13 nov 2026), con procedencia y reglas de hora                                                                      | `DATA_MODEL.md` §5                          |
| Carga y volumen                       | Series, repeticiones y tonelaje; **prescrito frente a ejecutado**; carga externa, añadida, asistida, intensidad relativa y carga respecto al peso corporal                                                                            | Tonelaje 1.0.0 (kg externos) y prescrito frente a realizado serie a serie (A7). **Análisis del bloque 3 en diseño** (`BLOCK3_SPEC.md`, pendiente de aprobación)                          | `EFFORT_AND_LOAD.md` §10                    |
| Evaluaciones                          | Pruebas, intentos, regla de agregación, procedencia, comparación solo si es comparable; 1RM directo como referencia del %1RM                                                                                                          | Funcional con datos demo; protocolos pendientes                                                                                                                                          | `SCIENTIFIC_RIGOR.md`                       |
| Readaptación                          | Casos, fases y criterios definidos por el profesional                                                                                                                                                                                 | Funcional con datos demo                                                                                                                                                                 | `DATA_MODEL.md` §8                          |
| Informes                              | Progreso, entrenamiento y readaptación, con las versiones de las fórmulas                                                                                                                                                             | Pendiente                                                                                                                                                                                | `DATA_MODEL.md` §9                          |
| **Motor de adaptación**               | Progresiones configurables, reglas supervisadas o preautorizadas, recomendaciones explicables y registro de decisiones                                                                                                                | **Diseño nuevo pendiente de aprobación**                                                                                                                                                 | `PROGRESSION_AND_AUTOREGULATION.md`         |
| **Valoración previa y carga interna** | Energía y recuperación antes de la sesión, dolor e incidencias, RPE de la sesión y carga interna estimada                                                                                                                             | **Diseño nuevo pendiente de aprobación** (Q2). RPE de la sesión y carga interna: arquitectura en `BLOCK3_SPEC.md` §7 (B3.3, opcional)                                                    | `PROGRESSION_AND_AUTOREGULATION.md` §4 y §6 |
| Integraciones                         | Importación de archivos y dispositivos **solo tras verificarlas**                                                                                                                                                                     | Conceptual                                                                                                                                                                               | `DATA_MODEL.md` §10                         |

## 4. Experiencia de entrenamiento guiada (resumen)

Requisitos 1 a 9 de la experiencia profesional y guiada. **Diseño completo en `TRAINING_EXPERIENCE.md`, pendiente de aprobación; no hay código nuevo.**

1. **Ficha del ejercicio:** tres recursos visuales independientes; el ampliado nunca sustituye al breve; si un vídeo falla, quedan la silueta y las instrucciones; indicaciones del entrenador por cliente y por sesión.
2. **Carga y esfuerzo (prioritario):** la modalidad la elige el entrenador según el ejercicio, el objetivo, la persona y los datos disponibles. Sin RIR ni RPE por defecto. Equivalencia RPE ↔ RIR solo dentro de la escala basada en RIR. Prescrito, realizado y calculado, separados.
3. **Experiencia guiada:** del inicio al resumen sin cambiar de pantalla para encontrar la información; registrar una serie prevista con un toque.
4. **Flujo completo:** parcial, interrumpida y retomada, no realizada, cambios del entrenador con versiones, días sin entrenamiento, dos sesiones en un día, sin conexión, historial conservado, restricciones individuales y series que no cuentan dos veces.
5. **Planificación:** variación por serie; duplicados y plantillas que no arrastran lo individual de otro cliente.
6. **Volumen:** prescrito frente a ejecutado; el peso corporal × repeticiones no es tonelaje; estimación del 1RM con RIR documentada y no automática.
7. **Datos y arquitectura:** vídeos fuera de la base de datos con sus metadatos; sin integraciones supuestas.
8. **Diseño:** seis pantallas con la identidad aprobada; carga y esfuerzo con el máximo protagonismo.
9. **Criterios de aceptación:** 52 criterios verificables (`TRAINING_EXPERIENCE.md` §12).

## 5. Fases

| Fase   | Contenido                                                                                                                                                                                                                                                                                                     | Estado                                                 |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| 1      | Fundamentos                                                                                                                                                                                                                                                                                                   | Hecha y revisada (`PHASE1_REPORT.md`)                  |
| **1B** | **Propuesta:** prescripción v2 y experiencia guiada sobre datos demo, sin infraestructura ni costes; añade la valoración previa y el RPE de sesión, si se aprueban (Q2), y el motivo neutro «molestias», sin registro estructurado de dolor (Q3). Primera versión y entregas en `IMPLEMENTATION_READINESS.md` | **Acuerdo conceptual; alcance pendiente (P-16, P-44)** |
| **1C** | **Propuesta:** progresión y autorregulación supervisada, registro de decisiones, carga interna y 1RM estimado verificado, sobre datos demo                                                                                                                                                                    | **Pendiente de aprobación (P-44)**                     |
| 2      | Autenticación y usuarios, con base de datos                                                                                                                                                                                                                                                                   | Pendiente de aprobación (P-01, P-02)                   |
| 3–10   | Clientes, biblioteca, evaluaciones, planificación, portal, carga y volumen, readaptación e informes, validación y despliegue                                                                                                                                                                                  | Pendientes (`ROADMAP.md`)                              |

Las fases se agrupan en **etapas estratégicas** (E0 núcleo funcional a E8 escalabilidad comercial) en `ROADMAP.md`.

## 6. Mapa de la documentación

| Documento                           | Contenido                                                                                                                           |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `MASTER_SPEC.md`                    | Este documento                                                                                                                      |
| `PRODUCT_STRATEGY.md`               | Visión, principios, mapa de módulos, auditoría, motor de inteligencia y regulación                                                  |
| `COMPETITIVE_ANALYSIS.md`           | Matriz competitiva y oportunidades de diferenciación                                                                                |
| `PROGRESSION_AND_AUTOREGULATION.md` | Progresión, 1RM estimado, valoración previa, motor de adaptación, RPE de sesión y carga interna                                     |
| `INTEGRATIONS.md`                   | Requisitos de cada integración y arquitectura de importación                                                                        |
| `TRAINING_EXPERIENCE.md`            | Análisis y diseño de la experiencia guiada, bocetos, flujo y criterios de aceptación                                                |
| `EFFORT_AND_LOAD.md`                | Carga, esfuerzo, registro, estimación del 1RM, volumen y tonelaje, con referencias                                                  |
| `MEDIA.md`                          | Silueta y vídeos: modelo, formatos, almacenamiento, costes, privacidad y riesgos                                                    |
| `ARCHITECTURE.md`                   | Capas, flujo de datos, sincronización sin conexión y cómo ampliar                                                                   |
| `DATA_MODEL.md`                     | Modelo conceptual de datos                                                                                                          |
| `TAXONOMY.md`                       | Taxonomía de la biblioteca                                                                                                          |
| `SCIENTIFIC_RIGOR.md`               | Procedencia, registro de fórmulas y convenciones                                                                                    |
| `SECURITY_PRIVACY.md`               | Permisos, privacidad y RGPD                                                                                                         |
| `DATA_RIGHTS.md`                    | Derechos del cliente                                                                                                                |
| `INFRASTRUCTURE.md`                 | Base de datos, autenticación, alojamiento, CI y almacenamiento multimedia, con costes                                               |
| `DESIGN_SYSTEM.md`                  | Identidad, tokens, componentes y patrones                                                                                           |
| `DECISIONS.md`                      | Decisiones tomadas (ADR) y pendientes (P-xx)                                                                                        |
| `ROADMAP.md`                        | Fases                                                                                                                               |
| `V1_SPEC.md`                        | Especificación de la primera entrega vertical (V1): pantallas, modelo, API, tareas y pruebas                                        |
| `BLOCK3_SPEC.md`                    | Bloque 3 de V1: análisis del entrenamiento, cumplimiento, volumen, carga interna, pantallas, pruebas y decisiones (propuesta)       |
| `AUDIT_BLOCK1.md`                   | Auditoría técnica del bloque 1 y del bloque 2, y correcciones aplicadas (§15)                                                       |
| `EXECUTION.md`                      | Ejecución del bloque 2: modelo, API de comandos, cola local, conflictos y reglas de hora                                            |
| `IMPLEMENTATION_READINESS.md`       | Auditoría de preparación, primera versión funcional, decisiones para aprobar (Q1–Q6), entregas verticales y definición de terminado |
| `SCREEN_INVENTORY.md`               | Qué funciona en cada pantalla                                                                                                       |
| `PHASE1_REPORT.md`                  | Informe de la Fase 1                                                                                                                |
| `DEVELOPMENT.md`                    | Desarrollo del día a día                                                                                                            |

## 7. Glosario

| Término                             | Significado en TrainPro                                                                                                                                                               |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1RM**                             | Carga máxima con la que se completa una repetición de un ejercicio. **Directo** si se mide; **estimado** si se predice                                                                |
| **%1RM**                            | Porcentaje de un 1RM de referencia, con su fecha y procedencia                                                                                                                        |
| **RIR**                             | Repeticiones en reserva: cuántas repeticiones más se estima que se podrían hacer antes del fallo                                                                                      |
| **RPE**                             | Esfuerzo percibido, siempre con su escala (basada en RIR, OMNI-RES o Borg CR10)                                                                                                       |
| **Carácter del esfuerzo**           | Repeticiones realizadas frente a realizables, por ejemplo `6 (12)`                                                                                                                    |
| **Criterio de finalización**        | Condición para terminar una serie: pérdida de velocidad, calidad o técnica, dolor, tope de tiempo o repeticiones                                                                      |
| **Serie efectiva**                  | La última versión válida de una serie prescrita; los reenvíos y las correcciones no cuentan dos veces                                                                                 |
| **Tonelaje**                        | Σ repeticiones × kg de carga **externa** declarada (nominal), con su base (total o por implemento). No incluye el peso corporal, el lastre ni la asistencia, y no es trabajo mecánico |
| **Fecha prevista / de ejecución**   | Cuándo estaba programada una sesión, y la fecha local de su inicio en la zona del dispositivo. La planificación usa la primera; la carga ejecutada, la segunda (P-93)                 |
| **Prescripción original / vigente** | La que recibió la clienta en su momento, y la actual del entrenador (P-92)                                                                                                            |
| **Variante**                        | Forma concreta y prescribible de un ejercicio principal, con su propia clasificación                                                                                                  |
| **Copia adaptada**                  | Variante personalizada creada a partir de otra (normalmente global) sin modificar el original                                                                                         |
