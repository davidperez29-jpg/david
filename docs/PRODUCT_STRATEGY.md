# Estrategia de producto

> **Estado: propuesta pendiente de aprobación (6 de noviembre de 2026).** Recoge el cambio de ambición pedido por el responsable del producto y lo convierte en principios, arquitectura de producto y criterios de decisión. No hay código nuevo. Las decisiones que requieren aprobación están en `DECISIONS.md` (P-44 a P-61) y la secuencia, en `ROADMAP.md`.

## 1. Qué estamos construyendo

Una **plataforma profesional para evaluar, planificar, prescribir, ejecutar, registrar, analizar y adaptar** el entrenamiento, el rendimiento, la salud y la readaptación. No es una agenda, ni un registro de ejercicios con gráficos, ni una copia de la competencia.

**Ciclo rector:**

```
EVALUAR → INTERPRETAR → IDENTIFICAR NECESIDADES → PLANIFICAR → PRESCRIBIR
   ↑                                                              ↓
VOLVER A EVALUAR ← ADAPTAR ← ANALIZAR ← REGISTRAR ← EJECUTAR ←────┘
```

Cada etapa alimenta a las siguientes cuando es pertinente, y **todo lo que el sistema propone dice qué propone, por qué, con qué datos y qué limitaciones tiene**.

**Tesis de diferenciación** (hipótesis que hay que demostrar, no afirmaciones):

1. **Decisiones explicables y supervisadas.** Recomendaciones trazables (datos, regla, versión, nivel de evidencia y limitaciones) que el profesional acepta, modifica o rechaza, con registro de cada decisión. Las plataformas para entrenadores revisadas apenas autorregulan; las aplicaciones que sí lo hacen son para usuarios sin entrenador y explican poco (`COMPETITIVE_ANALYSIS.md`).
2. **Rigor visible.** Procedencia en cada dato, fórmulas versionadas, registro de evidencia y etiquetas que distinguen evidencia, consenso, heurística, decisión de diseño, cálculo, estimación y medición.
3. **Un único ciclo para salud, rendimiento y readaptación**, en lugar de herramientas separadas para evaluar, programar y rehabilitar.
4. **Ejecución del cliente excelente**: guiada, sin conexión y fiel a lo realizado.
5. **Datos instrumentales y de campo en el mismo modelo**, con procedencia, cuando las integraciones estén verificadas.

## 2. Principios de producto

1. **El núcleo primero.** La calidad del ciclo básico (prescribir → ejecutar → registrar → analizar) no se sacrifica por llegar antes a más módulos.
2. **El profesional decide.** El sistema propone y explica; no diagnostica ni sustituye el juicio profesional.
3. **Nada automático sin autorización previa.** Ni valores por defecto ocultos, ni umbrales universales, ni reglas que se apliquen solas sin que el entrenador las haya configurado (P-45).
4. **Ningún número sin procedencia** ni magnitudes incompatibles sumadas.
5. **La ciencia como ventaja, no como reclamo.** «Basado en evidencia» solo se usa cuando hay una fuente verificada, aplicable a esa población, y figura en el registro de evidencia (`SCIENTIFIC_RIGOR.md`).
6. **Flexibilidad sin un modelo único.** Distintos modelos de planificación, progresión y control del esfuerzo según la población, el objetivo y la fase.
7. **Privacidad y seguridad desde el diseño**, con especial cuidado en los datos de salud y en cualquier uso de IA.
8. **Complejidad solo cuando aporta.** Monolito modular, sin microservicios ni infraestructura prematura.

### Criterio de decisión para cada funcionalidad

Cada propuesta responde a estas ocho preguntas, que forman parte de la plantilla de las decisiones (`DECISIONS.md`). Si no las supera, se cuestiona:

1. ¿Mejora de forma significativa el trabajo del entrenador?
2. ¿Mejora la experiencia del cliente?
3. ¿Permite tomar mejores decisiones?
4. ¿Tiene una justificación técnica o científica?
5. ¿Está integrada con el resto de TrainPro?
6. ¿Es suficientemente flexible?
7. ¿Es viable mantenerla y escalarla?
8. ¿Aporta una ventaja competitiva real?

## 3. Mapa de módulos

| Módulo                                       | Contenido de la visión                                                                                                                                                            | Hoy                                                                       | Primera entrega propuesta                                                           |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| **A. Gestión profesional**                   | Clientes, fichas, historial (evaluaciones, lesiones, restricciones, objetivos, planes), grupos, equipos, centros, roles, comunicación, informes, varios profesionales             | Ficha por pestañas, permisos por entrenador, compartición; con datos demo | Alta de clientes (1B); organización como inquilino (Fase 2); centros y equipos (E7) |
| **B. Evaluación integral**                   | Fuerza, potencia, saltos, sprint, cambios de dirección, movilidad, control motor, equilibrio, resistencia, capacidad funcional, antropometría, readaptación                       | Catálogo de pruebas con intentos, agregación, procedencia y comparación   | Registro de resultados (1B); protocolos y fiabilidad (E2)                           |
| **C. Planificación y prescripción**          | Programas, plantillas, objetivos, capacidades, periodización, bloques, progresiones, concurrente, metodologías, por ejercicio y serie, criterios de progresión                    | Prescripción básica; diseño por serie aprobado en concepto                | Prescripción por serie (1B); progresiones (1C); periodización (E3)                  |
| **D. Biblioteca científica y de ejercicios** | Biblioteca multidimensional, variantes, patrones, siluetas, vídeos, criterios de ejecución y progresión, evidencia vinculada                                                      | Biblioteca multidimensional con búsqueda Y/O y niveles                    | Material visual (1B y Fase 4); registro de evidencia (1C)                           |
| **E. Ejecución del cliente**                 | Registro por serie, RIR/RPE, carga real, repeticiones y contactos, observaciones, dolor e incidencias, pausas, sin conexión, valoración previa y posterior, resumen               | Reproductor de una página con datos demo                                  | Reproductor guiado, valoración previa y RPE de sesión (1B)                          |
| **F. Inteligencia y adaptación**             | Interpretar, detectar cambios relevantes y déficits, proponer objetivos y ejercicios, progresiones, analizar la respuesta, recomendar, comparar, detectar incoherencias, informes | Nada (decisión explícita: sin automatismos)                               | Motor de reglas explicable y supervisado (1C); modelos (E6)                         |
| **G. Readaptación y retorno**                | Lesiones, fases, criterios, exposición gradual, tolerancia, evaluaciones funcionales, asimetrías, RTS, síntomas                                                                   | Casos, fases y criterios definidos por el profesional                     | Registro de dolor (1B); módulo completo (E4), con revisión regulatoria              |
| **H. Datos e integraciones**                 | Encoders, plataformas de fuerza, fotocélulas, dinamometría, wearables, frecuencia cardiaca, sueño                                                                                 | Modelo conceptual de importación con procedencia                          | Transcripción manual con procedencia (1B); integraciones (E5)                       |

## 4. Auditoría de la documentación y la arquitectura actuales

Revisión del 6 de noviembre de 2026 sobre los 17 documentos de `docs/` y el código de `src/`.

### 4.1 Contradicciones

| #   | Contradicción                                                                                                                                                                | Propuesta                                                                                                                                                                                                                                                |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C-1 | «Sin automatismos» (`EFFORT_AND_LOAD.md` §9, ADR-20, `MASTER_SPEC.md`, `SCIENTIFIC_RIGOR.md`) frente al motor de adaptación con recomendaciones «automáticas o supervisadas» | Se mantiene «nada automático por defecto». El motor solo actúa con reglas que configura el entrenador: **supervisado** (propone y el entrenador decide) o **preautorizado** (acciones conservadoras definidas de antemano). Nunca en readaptación (P-45) |
| C-2 | RPE de la sesión «si el entrenador lo pide» (1B, F-10) frente a «al terminar cada sesión»                                                                                    | Se pide en todas las sesiones, salvo que el entrenador lo desactive para un cliente con un motivo (P-48)                                                                                                                                                 |
| C-3 | RPE de la sesión «30 minutos después» (`EFFORT_AND_LOAD.md` §4.3) frente a la recogida al terminar en la app                                                                 | La evidencia revisada no encuentra diferencias entre 5 o 10 min y 30 min (Christen et al., 2016; Uchida et al., 2014). Se pide al terminar, con opción «más tarde», y se guarda el momento (P-48)                                                        |
| C-4 | Estimación del 1RM fuera de la 1B (P-23, P-24) frente a la progresión por 1RM estimado                                                                                       | Se diseña ahora (`PROGRESSION_AND_AUTOREGULATION.md` §3) y se implementa en la 1C solo con ecuaciones que superen el protocolo de verificación (P-50)                                                                                                    |
| C-5 | Suma de repeticiones de todos los ejercicios en el código actual (`summarizeVolume`) frente a «no sumar magnitudes incompatibles»                                            | Ya propuesto en P-36; se amplía con contactos, distancia, duración y carga interna                                                                                                                                                                       |
| C-6 | Fase 10 («validación y despliegue») al final de la hoja de ruta frente a la necesidad de seguridad, copias, revisión jurídica y despliegue antes de tener usuarios reales    | Dividir la Fase 10: 10a antes de la primera beta con datos reales y 10b para la validación a escala (P-57)                                                                                                                                               |

### 4.2 Carencias

| #   | Carencia                                                                                                                                                                                                                              | Dónde se resuelve                                                |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| G-1 | **No hay inquilino (organización) ni centros** en el modelo: todo cuelga del entrenador. Añadirlo después obligaría a migrar todas las tablas y políticas RLS                                                                         | Organización como inquilino desde el esquema de la Fase 2 (P-51) |
| G-2 | Un cliente tiene **un único entrenador responsable**; no hay equipos asistenciales (entrenador, fisioterapeuta, readaptador) con permisos por rol                                                                                     | `client_care_team` (P-52)                                        |
| G-3 | **No existe la valoración previa** ni el **registro estructurado de dolor**                                                                                                                                                           | 1B (P-47, P-58)                                                  |
| G-4 | **No hay motor de progresión** ni registro de decisiones                                                                                                                                                                              | 1C (P-45, P-46)                                                  |
| G-5 | **No hay protocolo de niveles de evidencia** ni registro de fuentes vinculables a ejercicios, métodos o reglas                                                                                                                        | `SCIENTIFIC_RIGOR.md` §Protocolo de evidencia (P-61)             |
| G-6 | **Ninguna referencia a la regulación de productos sanitarios ni de IA.** Según su finalidad prevista, el software de readaptación o de recomendaciones podría considerarse producto sanitario (MDR, regla 11) y su IA, de alto riesgo | Revisión regulatoria antes de E4 y E6 (P-54)                     |
| G-7 | **Integraciones sin requisitos**: una PWA no puede usar Bluetooth en Safari de iOS ni leer HealthKit                                                                                                                                  | `INTEGRATIONS.md` (P-59)                                         |
| G-8 | **No hay taxonomía de músculos**: el volumen por grupo muscular no es posible con los datos actuales                                                                                                                                  | E3, con recuento fraccional etiquetado como heurística (P-53)    |
| G-9 | **No hay comunicación entrenador–cliente** ni informes                                                                                                                                                                                | Fases 7 y 9 (sin cambios)                                        |

### 4.3 Dependencias críticas

```
Modelo de prescripción y registro (1B) ──► Motor de progresión (1C) ──► Esquema de BD (Fase 2)
            │                                     │
            ▼                                     ▼
Valoración previa y RPE de sesión (1B) ──► Reglas de autorregulación (1C) ──► Automatización avanzada (E3)
Organización como inquilino (Fase 2) ──► Centros y equipos (E7)
Protocolo de evidencia (1C) ──► Evidencia vinculada a ejercicios y reglas (E3) ──► IA explicable (E6)
Revisión regulatoria ──► Readaptación avanzada (E4) y modelos de IA (E6)
Integraciones verificadas (E5) ──► Modelos con datos instrumentales (E6)
```

## 5. Motor de inteligencia: principios

Se construye en capas, de lo más verificable a lo menos:

| Capa                                     | Qué es                                                                            | Cuándo                                                        |
| ---------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 1. Cálculos                              | Fórmulas versionadas (volumen, carga interna, 1RM estimado)                       | 1B y 1C                                                       |
| 2. Reglas explicables                    | Reglas deterministas configuradas por el entrenador, con explicación y registro   | 1C                                                            |
| 3. Detección                             | Cambios que superan el error de medición de la prueba, incoherencias en los datos | E2 (necesita fiabilidad de cada protocolo; Hopkins, 2000)     |
| 4. Modelos estadísticos o de aprendizaje | Predicciones con incertidumbre, validadas con datos reales                        | E6                                                            |
| 5. Asistente con IA generativa           | Redacción de informes y explicaciones, siempre revisadas por el profesional       | E6, solo tras aprobar proveedor, coste y base jurídica (P-55) |

Toda recomendación lleva una **explicación** con:

- qué propone;
- los datos usados, con su procedencia;
- la regla o el modelo, con su versión;
- la etiqueta de evidencia;
- las limitaciones;
- las alternativas.

También se registra qué decidió el profesional.

Lo que **no** hará:

- diagnosticar;
- proponer criterios clínicos;
- predecir lesiones con métricas sin validez causal (como el cociente de carga aguda:crónica; Impellizzeri et al., 2020);
- presentar como evidencia lo que es una heurística.

## 6. Posicionamiento regulatorio (riesgo a gestionar)

- **Productos sanitarios (Reglamento (UE) 2017/745):** que un software lo sea depende de su **finalidad prevista**. La guía MDCG 2019-11, revisada en junio de 2025, mantiene ese criterio y la regla 11 para el software que informa decisiones diagnósticas o terapéuticas (fuentes secundarias consultadas; hay que leer la guía original).
- **Propuesta:** TrainPro se define como herramienta para profesionales del ejercicio que **registra y organiza** lo que ellos deciden. No diagnostica ni trata. La readaptación y la IA se revisarán con asesoría regulatoria antes de E4 y E6 (P-54).
- **IA (Reglamento (UE) 2024/1689):** los sistemas de IA que son, o forman parte de, un producto sanitario sujeto a evaluación de terceros pueden ser de alto riesgo. Según fuentes secundarias, las fechas de aplicación de esas obligaciones se han revisado (2027–2028). Se verificará en el Diario Oficial antes de E6.

## 7. Lo que no se construirá todavía

Decidido con el criterio de las ocho preguntas y con el análisis competitivo:

- nutrición y planes de comidas;
- pagos y marketplace de programas;
- apps con marca propia del entrenador;
- gestión de clases y de gimnasios;
- predicción de lesiones;
- generación de programas «por texto» con IA;
- hardware propio;
- app nativa antes de validar la PWA (salvo si lo exigen las integraciones, P-59).

Cada una puede reevaluarse con datos.

## Fuentes

Las referencias científicas están en `PROGRESSION_AND_AUTOREGULATION.md` y `EFFORT_AND_LOAD.md`; las de competencia, en `COMPETITIVE_ANALYSIS.md`. Regulación (fuentes secundarias, a contrastar con los textos oficiales): [OpenRegulatory sobre MDCG 2019-11](https://openregulatory.com/mdcg/mdcg-2019-11), [Emergo by UL sobre la revisión 1](https://www.emergobyul.com/news/european-revision-primary-software-guidance-mdcg-2019-11-revision-1-small-changes-meaningful), [Pure Global sobre las fechas del Reglamento de IA](https://www.pureglobal.com/news/eu-ai-act-omnibus-high-risk-dates-2028), [Sahha sobre IA en apps de salud](https://sahha.ai/blog/eu-ai-act-health-apps/).
