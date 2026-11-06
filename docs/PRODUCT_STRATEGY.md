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

### 6.1 Revisión con fuentes oficiales (6 de noviembre de 2026)

> **Limitación:** EUR-Lex no es accesible desde la red de esta sesión. Los textos se han consultado mediante búsquedas que devuelven extractos de páginas oficiales (EUR-Lex, Comisión Europea y la mesa de servicio del Reglamento de IA). **Falta la lectura literal completa**: se puede hacer permitiendo `eur-lex.europa.eu` en la configuración de red (P-74) o con los textos que aportes. **Nada de esto es asesoramiento jurídico, ni permite afirmar que TrainPro cumple ninguna norma.**

| Norma                                        | Qué dice (según fuentes oficiales consultadas)                                                                                                                                                                                                                                                                                                                                | Implicación para TrainPro                                                                                                                                                              |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **MDR, considerando 19**                     | El software para fines generales, aunque se use en un entorno sanitario, y el software destinado a fines de **estilo de vida y bienestar** no es un producto sanitario. Lo es el software que el fabricante destina específicamente a algún fin médico de la definición                                                                                                       | El entrenamiento, el rendimiento y el bienestar pueden quedar fuera, **si la finalidad declarada lo es**                                                                               |
| **MDR, artículo 2.1** (definición)           | Entre los fines médicos figuran, entre otros, el diagnóstico, la prevención, el seguimiento, el tratamiento o el alivio de una enfermedad, y el diagnóstico, el seguimiento, el tratamiento, el alivio o la compensación de **una lesión o una discapacidad** (texto literal pendiente de cotejar en EUR-Lex)                                                                 | Un módulo cuya finalidad declarada sea **tratar o aliviar lesiones** puede entrar en la definición. Es el principal riesgo de la readaptación (E4)                                     |
| **MDCG 2019-11 rev. 1** (junio de 2025)      | Guía de la Comisión para calificar y clasificar el software (incluido el que usa IA). El software debe tener por sí mismo una finalidad médica para ser producto sanitario. Ya no se usa el término «software independiente»                                                                                                                                                  | La calificación se decide por la finalidad prevista de **cada módulo** (software modular)                                                                                              |
| **MDCG 2025-6 / AIB 2025-1** (junio de 2025) | Guía conjunta sobre la interacción entre el MDR/IVDR y el Reglamento de IA                                                                                                                                                                                                                                                                                                    | Hay que leerla antes de E6 si alguna función de IA tuviera finalidad médica                                                                                                            |
| **Reglamento de IA, artículo 6**             | Alto riesgo: (1) componente de seguridad de un producto del anexo I, o producto en sí, que requiera evaluación de terceros, o (2) casos del anexo III. Según la versión modificada consultada, no se consideran componentes de seguridad los sistemas usados solo para asistencia al usuario, optimización del rendimiento, eficiencia, automatización o comodidad            | Los usos previstos (recomendaciones de entrenamiento supervisadas, borradores de informes) no aparecen en el anexo III. Riesgo si alguna función se integrase en un producto sanitario |
| **Reglamento de IA, artículos 50 y 113**     | La transparencia (avisar cuando se interactúa con una IA o se genera contenido sintético) se aplica desde el **2 de agosto de 2026**. Según la mesa de servicio de la Comisión y otras fuentes, las obligaciones de alto riesgo se aplazaron (2 de diciembre de 2027 para el anexo III, 2 de agosto de 2028 para el anexo I), **pendiente de confirmar en el Diario Oficial** | Toda salida de IA se etiquetará como generada desde el primer día (P-55)                                                                                                               |
| **RGPD, artículo 4.15 y considerando 35**    | Datos relativos a la salud: los que revelan el estado de salud física o mental. El considerando incluye cualquier información sobre, por ejemplo, una enfermedad, una discapacidad o el **estado fisiológico** de la persona, sea cual sea su fuente. El Tribunal de Justicia aplica el criterio de si se pueden **inferir** conclusiones sobre la salud (asunto C-21/23)     | El dolor es dato de salud. La energía y la recuperación probablemente también, por inferencia: se protegen igual (P-58)                                                                |
| **RGPD, artículo 35 y considerando 91**      | Evaluación de impacto cuando se tratan datos de salud a gran escala. El considerando 91 excluye el tratamiento de los pacientes o clientes de un profesional sanitario individual                                                                                                                                                                                             | Para TrainPro como plataforma con muchos profesionales, la evaluación de impacto será probablemente obligatoria antes de E1 (a confirmar)                                              |
| **RGPD, artículo 22**                        | Decisiones basadas únicamente en el tratamiento automatizado con efectos jurídicos o significativos (texto no verificado en esta sesión)                                                                                                                                                                                                                                      | Las adaptaciones preautorizadas son automáticas: hay que valorar si «significativo» aplica. Mitigación: límites, explicación, notificación y revisión humana (P-45)                    |

### 6.2 Clasificación de las funciones según su riesgo regulatorio

| Funciones                                                                               | Encaje probable (a confirmar con asesoría)                        | Medidas                                                                                                        |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Planificación, prescripción, ejecución, volumen, evaluaciones de rendimiento            | Entrenamiento y rendimiento; fuera del MDR si la finalidad es esa | Finalidad documentada; ningún texto de marketing que hable de tratar lesiones                                  |
| Valoración previa, RPE de la sesión, carga interna                                      | Bienestar; **datos de salud** según el RGPD                       | Protección de categoría especial; sin interpretaciones clínicas                                                |
| Registro de dolor                                                                       | Dato de salud; sin finalidad diagnóstica                          | Solo informa al profesional; sin reglas (P-58)                                                                 |
| Motor de progresión y autorregulación                                                   | Entrenamiento, siempre que no tenga finalidad médica              | Prohibido en readaptación (P-45); supervisión y explicación; posible análisis del artículo 22 del RGPD         |
| **Readaptación de lesiones** (E4)                                                       | **Zona de riesgo de producto sanitario** (artículo 2.1)           | Asesoría regulatoria **antes** de diseñarla; posible limitación a herramienta de documentación del profesional |
| IA de bajo riesgo: asistencia documental sin datos de clientes, borradores supervisados | Obligaciones generales del Reglamento de IA (transparencia)       | Etiquetado, revisión humana, contrato de tratamiento si hay datos personales (P-55, P-56)                      |
| IA que influya en decisiones clínicas                                                   | Posible alto riesgo (anexo I, vía MDR)                            | **No se plantea** sin un análisis regulatorio completo                                                         |

### 6.3 Preguntas para la asesoría especializada

1. ¿Qué redacción de la finalidad prevista mantiene a TrainPro fuera del MDR, módulo a módulo, y qué afirmaciones comerciales hay que evitar?
2. ¿Puede un módulo de readaptación que solo registra fases y criterios definidos por el profesional quedar fuera del MDR? ¿Y si sugiere progresiones?
3. ¿Son la energía y la recuperación autodeclaradas datos de salud? ¿Qué base jurídica corresponde (consentimiento explícito u otra)?
4. ¿Se aplica el artículo 22 del RGPD a las adaptaciones preautorizadas?
5. Reparto de responsabilidades: ¿el entrenador como responsable y TrainPro como encargado? (P-14)
6. ¿Es obligatoria la evaluación de impacto antes de la beta (E1)?
7. Obligaciones del Reglamento de IA para la asistencia documental y los borradores supervisados.
8. Normativa española aplicable (LOPDGDD) y profesiones reguladas del ejercicio y la fisioterapia.

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

## 8. Producto y competitividad: respuestas

Nada de lo siguiente afirma superioridad: son hipótesis que habrá que comprobar con usuarios y comparaciones verificables (`COMPETITIVE_ANALYSIS.md`).

1. **¿Qué puede ser una ventaja competitiva real?**
   - La autorregulación **supervisada** para entrenadores, con perfiles por contexto, simulación previa y registro de decisiones.
   - La **fidelidad del registro**: estados deducidos, versiones, series sin duplicados, prescrito frente a real.
   - El **rigor visible**: procedencia, fórmulas versionadas y etiquetas de evidencia.
   - Un único ciclo que va de la salud al rendimiento.
2. **¿Qué construir extraordinariamente bien desde el principio?**
   - La ejecución móvil guiada y sin conexión.
   - La prescripción por serie con todas las modalidades de carga.
   - El historial y la trazabilidad.
   - El cálculo de volumen sin mezclar magnitudes.
   - La explicación de cada recomendación.

   Son la base de todo lo demás, y fallos en ellos destruyen la confianza.

3. **¿Qué no merece la pena copiar?**
   - Puntuaciones compuestas de disposición y semáforos sin línea base.
   - Generación de programas «por texto».
   - Predicción de lesiones.
   - Bibliotecas enormes sin clasificación.
   - Nutrición, pagos, apps con marca propia y gestión de clases en esta etapa.
   - IA presentada como «inteligente» sin explicación.
4. **¿Qué carencias del mercado podemos aprovechar?**
   - Autorregulación pensada para entrenadores, no para usuarios sin entrenador.
   - El puente entre la evaluación instrumental y la programación para profesionales pequeños.
   - Readaptación y rendimiento en una sola herramienta (con la cautela regulatoria).
   - Interfaz en español de calidad profesional.
5. **¿Qué decisiones de arquitectura podrían limitar el crecimiento comercial?**
   - No tener **organización como inquilino** desde la Fase 2 (P-51).
   - Un solo entrenador por cliente (P-52).
   - Historiales de cambios incompatibles entre módulos (P-63).
   - Escalas sin versión (P-64).
   - Depender de una PWA para integraciones que exigen una app nativa (P-59).
   - Atarse a un proveedor sin puertos (base de datos, almacenamiento, IA).
   - Una finalidad prevista ambigua que convierta el producto en sanitario sin pretenderlo (P-54).
6. **¿Qué funciones futuras dan más valor sin complicar el producto?**
   - Detección de cambios relevantes según el error de medición (E2).
   - Simulación retrospectiva de reglas (1C).
   - Importación de CSV de dispositivos (E2).
   - Borradores de informes supervisados (IA de bajo riesgo).
   - Vistas de equipo para centros (E7).

## 9. Registro de riesgos

| Tipo       | Riesgo                                                   | Probabilidad | Impacto  | Mitigación                                                           | Dónde se detalla                         |
| ---------- | -------------------------------------------------------- | ------------ | -------- | -------------------------------------------------------------------- | ---------------------------------------- |
| Científico | Escalas subjetivas interpretadas como mediciones         | Media        | Alto     | `self_reported`, línea base, sin puntuaciones compuestas             | `PROGRESSION_AND_AUTOREGULATION.md` §4   |
| Científico | Ecuaciones de 1RM fuera de su validez                    | Media        | Medio    | Solo con la fuente original leída; 2–10 repeticiones; margen visible | Ídem §3                                  |
| Científico | Reglas arbitrarias presentadas como ciencia              | Media        | Alto     | Etiquetas, sin valores por defecto, simulación y registro            | Ídem §5.13                               |
| Científico | Carga interna interpretada causalmente                   | Baja         | Medio    | Sin cociente agudo:crónico ni riesgo de lesión                       | Ídem §6                                  |
| Técnico    | Sincronización sin conexión con conflictos o duplicados  | Media        | Alto     | Identificadores, cola idempotente, versiones, escenarios S-07 a S-09 | `ROADMAP.md` (escenarios)                |
| Técnico    | Reconstrucción por decisiones estructurales mal fijadas  | Media        | Alto     | Decisiones de la 1B (P-62 a P-67)                                    | `ARCHITECTURE.md`                        |
| Técnico    | Limitaciones de la PWA en iOS                            | Alta         | Medio    | Pruebas en dispositivos reales en E1; P-59                           | `INTEGRATIONS.md`                        |
| Técnico    | Alcance de la 1B y la 1C demasiado grande                | Media        | Medio    | Listas cerradas, subfases y revisiones intermedias                   | `ROADMAP.md`                             |
| Jurídico   | Software calificado como producto sanitario              | Media en E4  | Muy alto | Finalidad prevista y asesoría antes de E4 y E6                       | §6                                       |
| Jurídico   | Tratamiento de datos de salud sin base jurídica adecuada | Media        | Muy alto | Datos ficticios hasta la asesoría; evaluación de impacto antes de E1 | `SECURITY_PRIVACY.md`, `DATA_RIGHTS.md`  |
| Jurídico   | Decisiones automatizadas (RGPD, artículo 22)             | Baja         | Alto     | Límites, explicación, notificación y revisión humana                 | §6.1                                     |
| Jurídico   | Derechos de imagen y de autor del material audiovisual   | Media        | Medio    | Cesiones registradas; material sintético en la 1B                    | `MEDIA.md`                               |
| Económico  | Costes de infraestructura y transferencia de vídeo       | Baja         | Medio    | Límites de gasto; alternativas sin coste de transferencia            | `INFRASTRUCTURE.md`, `MEDIA.md`          |
| Económico  | Coste de producir contenido y de la asesoría             | Alta         | Medio    | Presupuesto antes de E1; priorizar las variantes más usadas          | `MEDIA.md` §8                            |
| Económico  | Dependencia de API de terceros (cierres, tarifas)        | Media        | Medio    | Adaptadores aislados y datos en bruto                                | `INTEGRATIONS.md`                        |
| Producto   | Fatiga de cumplimentación del cliente                    | Media        | Medio    | Dos preguntas fijas; el resto, opcional                              | `PROGRESSION_AND_AUTOREGULATION.md` §4.6 |

## Fuentes

Las referencias científicas están en `PROGRESSION_AND_AUTOREGULATION.md` y `EFFORT_AND_LOAD.md`; las de competencia, en `COMPETITIVE_ANALYSIS.md`. Regulación (fuentes secundarias, a contrastar con los textos oficiales): [OpenRegulatory sobre MDCG 2019-11](https://openregulatory.com/mdcg/mdcg-2019-11), [Emergo by UL sobre la revisión 1](https://www.emergobyul.com/news/european-revision-primary-software-guidance-mdcg-2019-11-revision-1-small-changes-meaningful), [Pure Global sobre las fechas del Reglamento de IA](https://www.pureglobal.com/news/eu-ai-act-omnibus-high-risk-dates-2028), [Sahha sobre IA en apps de salud](https://sahha.ai/blog/eu-ai-act-health-apps/). Fuentes oficiales: [considerando 19 del MDR en EUR-Lex](https://eur-lex.europa.eu/eli/reg/2017/745/oj/eng), [MDCG 2019-11 rev. 1 (Comisión Europea, junio de 2025)](https://health.ec.europa.eu/latest-updates/update-mdcg-2019-11-rev1-qualification-and-classification-software-regulation-eu-2017745-and-2025-06-17_en), [guías del MDCG](https://health.ec.europa.eu/medical-devices-sector/new-regulations/guidance-mdcg-endorsed-documents-and-other-guidance_en), [MDCG 2025-6 / AIB 2025-1](https://health.ec.europa.eu/document/download/b78a17d7-e3cd-4943-851d-e02a2f22bbb4_en), [artículo 113 del Reglamento de IA (mesa de servicio de la Comisión)](https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-113), [calendario de aplicación](https://ai-act-service-desk.ec.europa.eu/en/ai-act/timeline/timeline-implementation-eu-ai-act), [artículo 6 (texto consolidado no oficial)](https://artificialintelligenceact.eu/article/6/), [RGPD en EUR-Lex](https://eur-lex.europa.eu/eli/reg/2016/679/art_4/oj), [considerando 35 (texto no oficial)](https://gdpr-info.eu/recitals/no-35/), [asunto C-21/23](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A62023CJ0021).
