# TrainPro · Documento maestro

Documento de referencia del producto: qué es TrainPro, qué reglas lo rigen, qué incluye cada módulo y dónde está el detalle. Reúne la especificación maestra de desarrollo, la revisión de la Fase 1 y los requisitos de la experiencia de entrenamiento guiada. Si dos documentos se contradicen, **manda el más específico** y se corrige el otro.

| Versión | Fecha                  | Cambios                                                                                                                                                                                         |
| ------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.0     | 6 de noviembre de 2026 | Primera versión: consolida la especificación y la revisión de la Fase 1, y añade el diseño de la experiencia guiada, la carga y el esfuerzo, y la gestión audiovisual (pendiente de aprobación) |

## 1. Producto

Plataforma web para gestionar el **entrenamiento, la evaluación, el rendimiento, la salud y la readaptación**. Para entrenadores personales, preparadores físicos, readaptadores y especialistas en rendimiento y salud, y para sus clientes.

**Ciclo de trabajo:** crear cliente → evaluar → interpretar → planificar → registrar la ejecución → analizar carga y evolución → ajustar el plan.

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
- No hay reglas universales ni automatismos por defecto: el profesional decide.

### Privacidad y seguridad

- Permisos en los casos de uso del servidor con las políticas de `src/domain/access.ts`, y en base de datos con RLS como segunda barrera. Todo dato nuevo tiene tests que incluyen el acceso no autorizado.
- Los datos de salud se separan y se protegen más. El cliente solo ve lo que el entrenador comparte, sin perjuicio de sus derechos (`DATA_RIGHTS.md`).
- No se afirma el cumplimiento del RGPD sin una auditoría real. El repositorio es privado y sin licencia abierta.

### Diseño

- Identidad **alegre, cercana, deportiva y profesional**: amarillo cálido, crema y blanco, formas redondeadas, pictogramas propios, gráficos claros y buena legibilidad en móvil. Nada de aspecto SaaS genérico (`DESIGN_SYSTEM.md`).
- Accesibilidad WCAG 2.1 AA comprobada con axe en E2E.

## 3. Módulos

| Módulo                   | Alcance                                                                                                                                                                                                                               | Estado                                                                                                  | Detalle                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Identidad y permisos     | Actores `trainer`, `client`, `admin`; aislamiento por entrenador y cliente; compartición                                                                                                                                              | Políticas implementadas; sin inicio de sesión real                                                      | `ARCHITECTURE.md`, `SECURITY_PRIVACY.md` |
| Clientes                 | Lista, ficha con pestañas (Información, Objetivos, Evaluaciones, Resultados, Planificación, Sesiones, Registro, Informes, Salud, Compartido)                                                                                          | Navegable con datos demo                                                                                | `SCREEN_INVENTORY.md`                    |
| Biblioteca               | Ejercicio principal + variantes con clasificación propia; etiquetas en 4 dimensiones; patrones con rol; material, región, ejecución, entorno, complejidad; búsqueda Y/O; favoritos; global, personalizado y privado; adaptar = copiar | Funcional con datos demo                                                                                | `TAXONOMY.md`, `DATA_MODEL.md` §3        |
| **Ficha del ejercicio**  | Identificación, **silueta de la variante, vídeo breve (< 15 s) y ampliado (≤ 45 s) independientes**, información técnica e **indicaciones individualizadas**                                                                          | Parcial (sin vídeos dentro de la app ni silueta por variante); **diseño nuevo pendiente de aprobación** | `TRAINING_EXPERIENCE.md` §2, `MEDIA.md`  |
| **Prescripción**         | **10 modalidades de carga**, esfuerzo RIR, RPE (con escala), ambos con justificación o ninguno, **por serie**, rangos y criterios de finalización                                                                                     | Básica en la Fase 1; **diseño nuevo pendiente de aprobación**                                           | `EFFORT_AND_LOAD.md`                     |
| Planificación            | Planes, semanas, sesiones, **editor por serie, plantillas y duplicados que conservan la individualización, versiones y publicación**                                                                                                  | Solo lectura en la Fase 1; diseño nuevo pendiente                                                       | `TRAINING_EXPERIENCE.md` §5              |
| **Portal del cliente**   | Hoy, sesión guiada **en 11 pasos** (calentamiento, ejercicio actual, registro, descanso, siguiente, resumen), semana, progreso; **sin conexión**                                                                                      | Hoy y reproductor de una página con datos demo; diseño nuevo pendiente                                  | `TRAINING_EXPERIENCE.md` §3, §4 y §6     |
| Registro de la ejecución | Lo realizado por serie, separado de lo prescrito; estados deducidos; sin duplicados; correcciones con historial                                                                                                                       | Estados y duplicados implementados; registro v2 pendiente                                               | `DATA_MODEL.md` §5                       |
| Carga y volumen          | Series, repeticiones y tonelaje; **prescrito frente a ejecutado**; carga externa, añadida, asistida, intensidad relativa y carga respecto al peso corporal                                                                            | Ejecutado (kg externos) implementado; resto, diseño                                                     | `EFFORT_AND_LOAD.md` §10                 |
| Evaluaciones             | Pruebas, intentos, regla de agregación, procedencia, comparación solo si es comparable; 1RM directo como referencia del %1RM                                                                                                          | Funcional con datos demo; protocolos pendientes                                                         | `SCIENTIFIC_RIGOR.md`                    |
| Readaptación             | Casos, fases y criterios definidos por el profesional                                                                                                                                                                                 | Funcional con datos demo                                                                                | `DATA_MODEL.md` §8                       |
| Informes                 | Progreso, entrenamiento y readaptación, con las versiones de las fórmulas                                                                                                                                                             | Pendiente                                                                                               | `DATA_MODEL.md` §9                       |
| Integraciones            | Importación de archivos y dispositivos **solo tras verificarlas**                                                                                                                                                                     | Conceptual                                                                                              | `DATA_MODEL.md` §10                      |

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

| Fase   | Contenido                                                                                                                    | Estado                                |
| ------ | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| 1      | Fundamentos                                                                                                                  | Hecha y revisada (`PHASE1_REPORT.md`) |
| **1B** | **Propuesta:** prescripción v2 y experiencia guiada sobre datos demo, sin infraestructura ni costes                          | **Pendiente de aprobación (P-16)**    |
| 2      | Autenticación y usuarios, con base de datos                                                                                  | Pendiente de aprobación (P-01, P-02)  |
| 3–10   | Clientes, biblioteca, evaluaciones, planificación, portal, carga y volumen, readaptación e informes, validación y despliegue | Pendientes (`ROADMAP.md`)             |

## 6. Mapa de la documentación

| Documento                | Contenido                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------- |
| `MASTER_SPEC.md`         | Este documento                                                                        |
| `TRAINING_EXPERIENCE.md` | Análisis y diseño de la experiencia guiada, bocetos, flujo y criterios de aceptación  |
| `EFFORT_AND_LOAD.md`     | Carga, esfuerzo, registro, estimación del 1RM, volumen y tonelaje, con referencias    |
| `MEDIA.md`               | Silueta y vídeos: modelo, formatos, almacenamiento, costes, privacidad y riesgos      |
| `ARCHITECTURE.md`        | Capas, flujo de datos, sincronización sin conexión y cómo ampliar                     |
| `DATA_MODEL.md`          | Modelo conceptual de datos                                                            |
| `TAXONOMY.md`            | Taxonomía de la biblioteca                                                            |
| `SCIENTIFIC_RIGOR.md`    | Procedencia, registro de fórmulas y convenciones                                      |
| `SECURITY_PRIVACY.md`    | Permisos, privacidad y RGPD                                                           |
| `DATA_RIGHTS.md`         | Derechos del cliente                                                                  |
| `INFRASTRUCTURE.md`      | Base de datos, autenticación, alojamiento, CI y almacenamiento multimedia, con costes |
| `DESIGN_SYSTEM.md`       | Identidad, tokens, componentes y patrones                                             |
| `DECISIONS.md`           | Decisiones tomadas (ADR) y pendientes (P-xx)                                          |
| `ROADMAP.md`             | Fases                                                                                 |
| `SCREEN_INVENTORY.md`    | Qué funciona en cada pantalla                                                         |
| `PHASE1_REPORT.md`       | Informe de la Fase 1                                                                  |
| `DEVELOPMENT.md`         | Desarrollo del día a día                                                              |

## 7. Glosario

| Término                      | Significado en TrainPro                                                                                                |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **1RM**                      | Carga máxima con la que se completa una repetición de un ejercicio. **Directo** si se mide; **estimado** si se predice |
| **%1RM**                     | Porcentaje de un 1RM de referencia, con su fecha y procedencia                                                         |
| **RIR**                      | Repeticiones en reserva: cuántas repeticiones más se estima que se podrían hacer antes del fallo                       |
| **RPE**                      | Esfuerzo percibido, siempre con su escala (basada en RIR, OMNI-RES o Borg CR10)                                        |
| **Carácter del esfuerzo**    | Repeticiones realizadas frente a realizables, por ejemplo `6 (12)`                                                     |
| **Criterio de finalización** | Condición para terminar una serie: pérdida de velocidad, calidad o técnica, dolor, tope de tiempo o repeticiones       |
| **Serie efectiva**           | La última versión válida de una serie prescrita; los reenvíos y las correcciones no cuentan dos veces                  |
| **Tonelaje**                 | Σ repeticiones × kg de carga **externa**. No incluye el peso corporal                                                  |
| **Variante**                 | Forma concreta y prescribible de un ejercicio principal, con su propia clasificación                                   |
| **Copia adaptada**           | Variante personalizada creada a partir de otra (normalmente global) sin modificar el original                          |
