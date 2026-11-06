# Hoja de ruta

Fases definidas en la especificación maestra (`MASTER_SPEC.md`). Cada fase empieza solo con **aprobación explícita** y termina con un informe de revisión.

| Fase   | Contenido                                                                                                                                                                                                                                                                                                             | Estado                                                                           |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 1      | **Fundamentos**: entorno, proyecto limpio, tecnologías, arquitectura, configuración, identidad visual, primera interfaz navegable del entrenador y del cliente, modelo conceptual de datos (incluida la biblioteca multidimensional)                                                                                  | Hecha y revisada (`PHASE1_REPORT.md`)                                            |
| **1B** | **Ciclo funcional completo con datos ficticios**, sin infraestructura externa: crear cliente → evaluar → planificar → prescribir → ejecutar desde el móvil → registrar → analizar (ver abajo)                                                                                                                         | **Acuerdo conceptual (6 de noviembre de 2026); alcance pendiente de aprobación** |
| **1C** | **Progresión y autorregulación supervisada con datos ficticios**: esquemas de progresión, motor de reglas explicable, registro de decisiones, carga interna y 1RM estimado verificado (ver abajo)                                                                                                                     | **Propuesta (P-44), pendiente de aprobación**                                    |
| 2      | **Autenticación y usuarios**: registro e inicio de sesión, roles, entrenadores, clientes, permisos y aislamiento de datos (con base de datos y RLS). El esquema incluye ya el modelo de la 1B                                                                                                                         | Pendiente de aprobación (requiere decidir P-01, P-02)                            |
| 3      | **Clientes**: gestión, fichas individuales, pestañas, información y objetivos. _La 1B adelanta el alta y la edición básica con datos ficticios._                                                                                                                                                                      | Pendiente                                                                        |
| 4      | **Biblioteca**: modelo de datos completo, catálogo, etiquetas multidimensionales, patrones, variantes, progresiones y regresiones, filtros Y/O, buscador avanzado, favoritos. _Añade siluetas y vídeos reales con almacenamiento y la administración del catálogo; la 1B solo usa material sintético._                | Pendiente (P-10, P-32, P-33)                                                     |
| 5      | **Evaluaciones**: registro de pruebas e intentos, historial, gráficos, comparaciones. _La 1B adelanta el registro con datos ficticios; quedan protocolos y fiabilidad verificados._                                                                                                                                   | Pendiente                                                                        |
| 6      | **Planificación**: planes, semanas, sesiones, programación de ejercicios, integración con la biblioteca. _La 1B adelanta sesiones, prescripción por serie, plantillas y duplicados; quedan planes, semanas y persistencia real._                                                                                      | Pendiente                                                                        |
| 7      | **Portal del cliente**: entrenamiento diario protagonista, consulta de ejercicios, registro de ejecución, comunicación con el entrenador, progreso en un apartado independiente. _La 1B adelanta el reproductor guiado y el registro sin conexión; quedan persistencia real, comunicación y pruebas en dispositivos._ | Pendiente                                                                        |
| 8      | **Carga y volumen**: cálculos, seguimiento, resúmenes y análisis. _La 1B adelanta prescrito frente a ejecutado; quedan carga interna, pérdida de velocidad calculada y estimación del 1RM (P-23, P-24)._                                                                                                              | Pendiente                                                                        |
| 9      | **Readaptación e informes**: procesos, fases, criterios, informes                                                                                                                                                                                                                                                     | Pendiente                                                                        |
| 10     | **Validación y despliegue**: seguridad, pruebas, rendimiento, accesibilidad, PWA (incluido iOS real) y despliegue (solo tras autorización). _Propuesta (P-57): dividirla en 10a, antes de la primera beta con datos reales, y 10b, validación a escala._                                                              | Pendiente                                                                        |

Algunas pantallas de fases posteriores ya existen como **propuesta visual con datos ficticios**. Su lógica de dominio está probada, pero no tienen persistencia ni edición. `PHASE1_REPORT.md` detalla qué funciona de verdad y qué no.

## Hoja de ruta estratégica (propuesta, 6 de noviembre de 2026)

> **Pendiente de aprobación.** Agrupa las fases en etapas según la visión de `PRODUCT_STRATEGY.md`. Las fases 1 a 10 **conservan su contenido**; solo se proponen dos cambios justificados: dividir la Fase 10 (P-57) y hacer las integraciones antes que la IA (P-56). **Visión no es alcance:** cada etapa se aprueba por separado y solo lo que figura en su alcance cerrado se compromete.

| Etapa                                             | Fases incluidas                          | Versión orientativa              |
| ------------------------------------------------- | ---------------------------------------- | -------------------------------- |
| **E0 · Núcleo funcional** (datos demo)            | 1 (hecha), 1B, 1C                        | Demostración                     |
| **E1 · Producto profesional inicial**             | 2, 3, 4, 6, 7, 8 y 10a                   | Beta privada con datos reales    |
| **E2 · Evaluación avanzada**                      | 5 (ampliada)                             | v1.x                             |
| **E3 · Planificación y autorregulación avanzada** | 6 y 8 (ampliadas)                        | v1.x                             |
| **E4 · Readaptación**                             | 9                                        | v2, tras la revisión regulatoria |
| **E5 · Integraciones** (P-56: antes que la IA)    | Nueva                                    | v2                               |
| **E6 · Inteligencia artificial**                  | Nueva                                    | v2+                              |
| **E7 · Centros y equipos**                        | Nueva (el modelo existe desde la Fase 2) | v2+                              |
| **E8 · Escalabilidad comercial**                  | 10b y nueva                              | Comercial                        |

### E0 · Núcleo funcional

- **Objetivo:** demostrar con calidad el ciclo evaluar → planificar → prescribir → ejecutar → registrar → analizar → adaptar, sin infraestructura.
- **Funcionalidades:** 1B (núcleo de ejecución) y 1C (progresión y autorregulación supervisada), definidas abajo.
- **Dependencias:** las aprobaciones resumidas en `DECISIONS.md`.
- **Riesgos:** alcance grande; construir sobre datos ficticios.
- **Criterios de aceptación y tests:** 1B-01 a 1B-47 y 1C-01 a 1C-16, más las pruebas E2E del ciclo completo.
- **Costes:** 0 €.
- **Valor para el usuario:** probar el flujo completo, del entrenador al móvil del cliente.
- **Ventaja competitiva:** prescripción por serie, ejecución fiel y adaptación explicable y supervisada.

### E1 · Producto profesional inicial

- **Objetivo:** que un grupo pequeño de entrenadores reales trabaje con clientes reales, con seguridad y garantías jurídicas.
- **Funcionalidades:**
  - autenticación y base de datos con organización como inquilino y equipos asistenciales (Fase 2);
  - clientes (Fase 3);
  - biblioteca con material audiovisual real (Fase 4);
  - planes y semanas (Fase 6);
  - persistencia real, sin conexión en dispositivos y comunicación básica (Fase 7);
  - volumen y carga con datos reales (Fase 8);
  - seguridad, copias probadas, revisión jurídica, evaluación de impacto y despliegue mínimo (Fase 10a).
- **Dependencias:** P-01 a P-04, P-13 a P-15, P-32, P-33, P-51, P-52 y P-57.
- **Riesgos:** datos de salud reales, costes, comportamiento sin conexión en iOS.
- **Criterios de aceptación:**
  - aislamiento entre organizaciones probado, también con RLS;
  - una restauración de copia probada;
  - evaluación de impacto completada;
  - sin hallazgos graves en una revisión de seguridad;
  - registro sin conexión probado en un iPhone y un Android reales;
  - tareas clave completadas por los entrenadores de la beta.
- **Tests:** políticas RLS, migraciones, E2E contra base de datos local, pruebas en dispositivos reales y revisión de seguridad.
- **Costes:** ~25–30 $/mes (Supabase Pro), alojamiento de 0 a 20 $/mes, asesoría jurídica y producción de contenido, sin estimar.
- **Valor para el usuario:** usarlo de verdad con sus clientes.
- **Ventaja competitiva:** el núcleo completo desde el primer día.

### E2 · Evaluación avanzada

- **Objetivo:** evaluar con protocolos y detectar **cambios reales**, no ruido.
- **Funcionalidades:**
  - protocolos versionados por capacidad: fuerza, potencia, saltos, sprint, cambios de dirección, movilidad, equilibrio, resistencia y antropometría;
  - error típico y cambio mínimo detectable por protocolo (Hopkins, 2000);
  - referencias verificadas, con su población;
  - perfil fuerza–velocidad cuando haya instrumento;
  - importación de CSV;
  - informes de evolución con las limitaciones de cada comparación.
- **Dependencias:** E1 y el protocolo de evidencia (P-61).
- **Riesgos:** referencias de otra población; instrumentos distintos entre evaluaciones.
- **Criterios de aceptación:** ningún cambio se marca como relevante sin el error de medición del protocolo; cada referencia tiene población y DOI o PMID; las comparaciones solo se hacen con el mismo protocolo e instrumento.
- **Tests:** tests unitarios con ejemplos publicados; importaciones con archivos de muestra.
- **Costes:** sin coste adicional, salvo dispositivos para conocer sus formatos de exportación.
- **Valor para el usuario:** interpretar las evaluaciones con criterio.
- **Ventaja competitiva:** detección de cambios según el error de medición; no se ha visto en la competencia revisada.

### E3 · Planificación y autorregulación avanzada

- **Objetivo:** periodización y autorregulación completas para cualquier población.
- **Funcionalidades:**
  - bloques y mesociclos;
  - modelos ondulante y ondulante flexible, y APRE;
  - planificación concurrente;
  - objetivos por capacidad;
  - volumen por grupo muscular (P-53);
  - evidencia vinculada a ejercicios y métodos;
  - análisis de cómo funcionan las reglas a partir del registro de decisiones.
- **Dependencias:** E1 con datos y la Fase 1C.
- **Riesgos:** complejidad de la interfaz y reglas mal configuradas.
- **Criterios de aceptación:** todo esquema y toda regla tienen etiqueta de evidencia; ninguna regla se activa sin configuración explícita; los informes de reglas muestran su tasa de aceptación y sus resultados, sin inferir causalidad.
- **Tests:** dominio puro con casos de cada modelo, E2E del editor de planes.
- **Costes:** sin coste adicional.
- **Valor para el usuario:** programar con profundidad sin perder rapidez.
- **Ventaja competitiva:** autorregulación supervisada para entrenadores, que la competencia revisada resuelve mal.

### E4 · Readaptación

- **Objetivo:** acompañar la readaptación y el retorno al deporte con criterios definidos por el profesional.
- **Funcionalidades:**
  - lesiones y antecedentes (datos de salud);
  - fases y criterios;
  - exposición progresiva y tolerancia, con registro de síntomas;
  - evaluaciones funcionales;
  - asimetrías (evidencia asociativa; Bishop et al., 2018);
  - sprint, frenadas, saltos y cambios de dirección;
  - retorno como un continuo (Ardern et al., 2016).
- **Dependencias:** asesoría regulatoria (P-54) y E2.
- **Riesgos:** que el software se considere producto sanitario; responsabilidad clínica.
- **Criterios de aceptación:** el sistema no propone criterios clínicos; cada criterio tiene autor y rol; se auditan los accesos a datos de salud; no hay automatismos.
- **Tests:** permisos por alcance de salud y auditoría.
- **Costes:** asesoría regulatoria.
- **Valor para el usuario:** un único ciclo desde la lesión hasta el rendimiento.
- **Ventaja competitiva:** unir readaptación y rendimiento, que hoy van en herramientas separadas.

### E5 · Integraciones

- **Objetivo:** incorporar datos instrumentales con procedencia.
- **Funcionalidades:**
  - la primera API, elegida por apertura verificada y demanda (`INTEGRATIONS.md`);
  - un _wearable_;
  - la decisión sobre una app nativa complementaria (P-59).
- **Dependencias:** acuerdos con los fabricantes y hardware de prueba.
- **Riesgos:** cambios o cierres de API; contratos de tratamiento.
- **Criterios de aceptación:** cada medición importada conserva el dispositivo, el lote y la versión de la correspondencia; no se deducen variables no medidas.
- **Tests:** contratos de API simulados y archivos reales de muestra.
- **Costes:** hardware (de cientos a miles de dólares) y posibles tarifas.
- **Valor para el usuario:** no transcribir a mano.
- **Ventaja competitiva:** datos instrumentales y de campo en un mismo modelo, para profesionales pequeños.

### E6 · Inteligencia artificial

- **Objetivo:** ayudar a interpretar y decidir, de forma explicable.
- **Funcionalidades:**
  - modelos de respuesta individual y detección de incoherencias;
  - sugerencias de ejercicios a partir de la biblioteca y de la evidencia vinculada;
  - asistente para redactar informes, siempre revisado por el profesional.
- **Dependencias:** datos reales suficientes, E5, P-54 y P-55.
- **Riesgos:** Reglamento de IA y MDR, sesgos, errores del modelo, privacidad.
- **Criterios de aceptación:** cada salida lleva explicación y etiqueta; evaluación con datos históricos antes de mostrarse; se mide la tasa de aceptación; ningún dato de salud sale sin base jurídica.
- **Tests:** conjuntos de evaluación fijos y pruebas de regresión de las salidas.
- **Costes:** proveedor de IA, pago por uso.
- **Valor para el usuario:** menos tiempo en análisis e informes.
- **Ventaja competitiva:** IA explicable y supervisada, frente a «cajas negras».

### E7 · Centros y equipos

- **Objetivo:** organizaciones con varios centros, profesionales y grupos.
- **Funcionalidades:**
  - centros y roles por centro;
  - grupos y vistas de equipo;
  - programación grupal con individualización;
  - informes de equipo.
- **Dependencias:** P-51 y P-52 desde la Fase 2.
- **Riesgos:** complejidad de permisos.
- **Criterios de aceptación:** pruebas de acceso entre centros y roles.
- **Tests:** matrices de permisos.
- **Costes:** solo el crecimiento de la infraestructura.
- **Valor para el usuario:** trabajo en equipo e interdisciplinar.
- **Ventaja competitiva:** pasar de entrenador individual a centro sin cambiar de herramienta.

### E8 · Escalabilidad comercial

- **Objetivo:** producto comercial sostenible.
- **Funcionalidades:**
  - planes y facturación;
  - alta autoservicio;
  - idiomas;
  - observabilidad y rendimiento;
  - exportación y portabilidad;
  - soporte;
  - validación a escala (Fase 10b).
- **Dependencias:** E1 a E7 según la demanda.
- **Riesgos:** costes de infraestructura y obligaciones fiscales.
- **Criterios de aceptación:** objetivos de rendimiento y disponibilidad acordados y medidos.
- **Tests:** carga y recuperación ante desastres.
- **Costes:** proveedor de pagos e infraestructura escalable.
- **Valor para el usuario:** fiabilidad.
- **Ventaja competitiva:** confianza.

---

## Fase 1B · Propuesta definitiva

> **Pendiente de aprobación. No hay código.** Esta propuesta aplica las decisiones que figuran como «propuesta» en `DECISIONS.md`; ninguna se da por aprobada. Si cambias alguna, el alcance se ajusta antes de empezar.

### 1. Objetivo y límites

Probar **el ciclo funcional completo de TrainPro** con datos ficticios: **crear cliente → evaluar → planificar → prescribir → ejecutar desde el móvil → registrar → analizar**.

- **Sin infraestructura externa:** sin base de datos, sin Supabase, sin autenticación real, sin almacenamiento en la nube, sin despliegue y sin costes.
- **Sin dependencias nuevas** (P-11). Se usan APIs del navegador (IndexedDB, `<video>`, Wake Lock) y lo que ya tiene el proyecto.
- **Se conserva todo lo que funciona.** Las 110 pruebas unitarias y las 85 E2E actuales siguen pasando. Las que cambien porque cambia el comportamiento (por ejemplo, «nada se guarda» o la suma de repeticiones de P-36) se actualizarán con su justificación en el informe.
- **Arquitectura intacta:** dominio puro, casos de uso con permisos y puertos de repositorio. Lo nuevo entra por los mismos puntos.
- **Datos ficticios:** los datos se guardan en la memoria del servidor (P-39) y la identidad del cliente se elige en modo demostración (P-40). Los formularios avisan de que no se introduzcan datos personales reales.

### 2. Funcionalidades (lista cerrada)

| Id   | Funcionalidad                         | Incluye                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F-01 | Datos demo con escritura              | Adaptador en memoria que admite altas y cambios mediante los casos de uso; vuelve a los datos iniciales al reiniciar; botón «Restablecer datos demo»; espacios aislados para E2E; aviso en los formularios                                                                                                                                                                                                                                                                        |
| F-02 | Identidad demo del cliente            | «Entrar como…» en el portal, solo entre los clientes ficticios de Alex, con la etiqueta «Modo demostración»; validado en el servidor                                                                                                                                                                                                                                                                                                                                              |
| F-03 | Crear cliente                         | Alta y edición de los datos básicos (nombre, objetivo, población, deporte), con validación y minimización (sin fecha de nacimiento, teléfono ni dirección)                                                                                                                                                                                                                                                                                                                        |
| F-04 | Evaluar                               | Registrar un resultado de una prueba del catálogo con intentos, regla de agregación, método, instrumento, fecha y procedencia; 1RM directo; 1RM estimado **introducido a mano** (`estimated`, con el método); peso corporal con fecha. Sin valores normativos ni «cambio relevante»                                                                                                                                                                                               |
| F-05 | Indicaciones y restricciones          | Por cliente (generales o para una variante) y por sesión; visibles para el cliente en los ejercicios afectados; las de origen sanitario, sin diagnóstico                                                                                                                                                                                                                                                                                                                          |
| F-06 | Planificar sesiones                   | Crear y editar sesiones (fecha, título, objetivo, duración estimada, nota, calentamiento, orden y etiqueta del día), borrador y publicación, versiones, duplicar (al mismo cliente y a otro, P-19) y plantillas (guardar y aplicar)                                                                                                                                                                                                                                               |
| F-07 | Prescribir                            | Editor por ejercicio con prescripción común y **por serie** (P-41): repeticiones o rango (y por lado), 10 modalidades de carga, esfuerzo (RIR, RPE con la escala basada en RIR, carácter, intención o ninguno), descanso, tempo de 3 o 4 cifras, observaciones visibles y privadas, criterios de finalización, series de aproximación, medición opcional (P-25), bloques y su modo; %1RM con la referencia del cliente, redondeo y congelación al publicar; validaciones y avisos |
| F-08 | Ficha del ejercicio y material visual | Ficha completa del §2 de `TRAINING_EXPERIENCE.md`; tres huecos por variante con su estado; vista «Material pendiente»; alternativa cuando falta o falla un recurso; 2–3 clips sintéticos y siluetas propias para las variantes de las sesiones demo (P-38)                                                                                                                                                                                                                        |
| F-09 | Pantalla «Hoy»                        | Sesión del día con objetivo, duración y número de ejercicios; dos sesiones el mismo día (P-21); «Continuar entrenamiento»; día sin sesión con la próxima                                                                                                                                                                                                                                                                                                                          |
| F-10 | Reproductor guiado                    | Vista previa, calentamiento (hacer o saltar), ejercicio actual con la tarjeta de prescripción, silueta, vídeo, indicaciones y restricciones, registro de series con un toque, descanso, siguiente ejercicio, panel «Tu sesión», saltar un ejercicio con motivo, terminar (con confirmación si faltan series), RPE de la sesión en todas las sesiones (P-48), mensaje y resumen                                                                                                    |
| F-11 | Registro sin conexión y reanudación   | Cada serie se guarda primero en el dispositivo con su identificador; cola de envío idempotente; «Guardado en el móvil» frente a «Enviado»; correcciones como versiones; reanudación tras cerrar o recargar (P-17, P-42); borrado de los datos locales al salir                                                                                                                                                                                                                    |
| F-12 | Textos claros para el cliente         | Ayudas de RIR, RPE (escala basada en RIR), tempo, carga autoseleccionada, lastre, asistencia, intención y calidad, con el texto aprobado (P-26)                                                                                                                                                                                                                                                                                                                                   |
| F-13 | Analizar                              | En la ficha del cliente: lo realizado serie a serie frente a lo prescrito, con la versión; volumen y tonelaje prescritos frente a ejecutados según P-36; lastre, asistencia, intensidad relativa (con referencia) y carga respecto al peso corporal (con peso medido); anotaciones del entrenador; panel con las sesiones del día (también dos por día)                                                                                                                           |
| F-14 | Progreso del cliente                  | Solo lo compartido por el entrenador, con las métricas nuevas                                                                                                                                                                                                                                                                                                                                                                                                                     |
| F-15 | Permisos                              | Políticas `canLogExecution`, `canEditPrescription`, `canAnnotateExecution`, `canViewMedia` y las de clientes y evaluaciones, con tests de acceso no autorizado                                                                                                                                                                                                                                                                                                                    |
| F-16 | Valoración previa                     | Energía y recuperación de 1 a 10 y dolor o molestias antes de la sesión (P-47); se puede saltar; visible para el entrenador junto a la sesión, como dato autodeclarado. **Solo se recoge y se muestra: no adapta nada** (eso llega en la 1C)                                                                                                                                                                                                                                      |
| F-17 | Dolor e incidencias                   | Durante la sesión, por ejercicio: zona, lado, intensidad 0–10 y nota; tratado como dato de salud (P-58)                                                                                                                                                                                                                                                                                                                                                                           |
| F-18 | RPE de la sesión                      | Al terminar, en todas las sesiones, con «Responder más tarde» durante 24 h y los minutos transcurridos (P-48); duración sin pausas registrada. **Sin calcular la carga interna** (1C)                                                                                                                                                                                                                                                                                             |

**Fuera de la 1B:** autenticación real, base de datos, almacenamiento en la nube, subida de vídeos, vídeos con personas, vídeos sin conexión, ecuaciones de estimación del 1RM, cálculo de pérdida de velocidad, integración de dispositivos, carga interna (RPE de la sesión × duración, en la 1C), motor de progresión y autorregulación (1C), planes, semanas y mesociclos, mensajería, notificaciones, informes, edición de la readaptación, interfaz de administración del catálogo, CI y despliegue.

### 3. Definiciones que fija la 1B

#### 3.1 Prescripción por serie (P-41)

El entrenador elige entre **prescripción común** («4 × 6, 80 kg, RIR 2, 120 s, 2-0-1») o **configuración por serie**, en la que cualquier campo de una serie concreta sustituye al común:

| Serie | Repeticiones | Carga | Esfuerzo | Descanso | Tempo | Observación          |
| ----- | ------------ | ----- | -------- | -------- | ----- | -------------------- |
| 1     | 8            | 70 kg | RIR 3    | 120 s    | 3-0-1 | —                    |
| 2     | 6            | 80 kg | RIR 2    | 150 s    | 2-0-1 | —                    |
| 3     | 6            | 80 kg | RIR 2    | 150 s    | 2-0-1 | —                    |
| 4     | 4–6          | 85 kg | RIR 1    | —        | 2-1-1 | «Pausa de 1 s abajo» |

Se pueden variar por serie: repeticiones o rango, **modalidad de carga** y carga (por ejemplo, serie 1 con peso corporal y las demás con lastre), objetivo de esfuerzo (RIR o RPE, o ninguno), descanso, tempo, observación visible, nota privada y criterios de finalización. Si se reduce el número de series, las configuraciones de las series que desaparecen se eliminan con aviso. El cliente ve el objetivo de **la serie actual** y la lista de todas.

#### 3.2 Potencia, pliometría, velocidad y técnica (P-35, P-25, P-37)

| Ejercicio                      | Carga externa             | Repeticiones       | Intención  | Calidad técnica                                          | Velocidad medida                                               | Valoración sin instrumento | RIR/RPE                             |
| ------------------------------ | ------------------------- | ------------------ | ---------- | -------------------------------------------------------- | -------------------------------------------------------------- | -------------------------- | ----------------------------------- |
| Salto con contramovimiento     | Sin carga (peso corporal) | 4 × 5 saltos       | Máxima     | «Para si el aterrizaje deja de ser estable y silencioso» | Solo si el entrenador indica un instrumento; si no, no se pide | Buena, aceptable o baja    | No                                  |
| Sentadilla con salto           | 20 kg (barra)             | 4 × 4              | Máxima     | Texto del entrenador                                     | Opcional, transcrita del instrumento indicado (`imported`)     | Sí                         | No                                  |
| Lanzamiento de balón medicinal | 4 kg (implemento)         | 3 × 6 lanzamientos | Máxima     | Texto del entrenador                                     | —                                                              | Sí                         | No                                  |
| Sprint de 20 m                 | Sin carga                 | 6 × 20 m           | Máxima     | «Para si pierdes la postura»                             | Tiempo solo si se indica el cronometraje                       | Sí                         | No                                  |
| Ejercicio técnico              | Ligera (autoseleccionada) | 3 × 5              | Controlada | Criterio técnico                                         | —                                                              | Sí                         | No                                  |
| Potencia con cargas altas      | kg o %1RM                 | 5 × 2              | Máxima     | Texto del entrenador                                     | Opcional                                                       | Opcional                   | Opcional, si el entrenador lo añade |

- **Carga externa, repeticiones, intención, calidad técnica, medición y valoración son datos distintos** y se guardan por separado.
- En estos ejercicios, la tarjeta de prescripción muestra **«Intención: máxima velocidad en cada repetición»** en el lugar del esfuerzo.
- **La velocidad nunca se inventa.** El campo solo aparece si el entrenador indica el instrumento. El valor lo introduce una persona y se guarda como `imported` («transcrito a mano»). La 1B **no calcula pérdidas de velocidad ni propone umbrales**, y los datos demo **no contienen valores de velocidad**. Si el entrenador escribe un umbral, es una prescripción suya, visible como tal.
- La **valoración cualitativa** es una escala operativa no validada, marcada como valoración personal y excluida de los cálculos.
- Una serie terminada por su criterio de calidad **cuenta como hecha**, porque cumple lo prescrito; la diferencia de repeticiones aparece en el resumen.

#### 3.3 Material visual (P-28, P-38)

Cada variante tiene **tres huecos propios**: silueta, vídeo breve (< 15 s) y vídeo ampliado (≤ 45 s).

| Situación          | Lo que ve el cliente                                            | Lo que ve el entrenador       |
| ------------------ | --------------------------------------------------------------- | ----------------------------- |
| Sin silueta propia | Pictograma del tipo con «Imagen orientativa»                    | «Silueta pendiente»           |
| Sin vídeo breve    | Silueta e instrucciones, sin reproductor vacío                  | «Vídeo breve pendiente»       |
| Sin vídeo ampliado | No aparece el botón                                             | «Ampliado: no hay» (opcional) |
| Ampliado sin breve | No ocurre: el ampliado no se publica sin el breve               | Aviso al intentarlo           |
| El vídeo no carga  | Silueta, instrucciones, «No se ha podido cargar» y «Reintentar» | Igual                         |

**Material pendiente:** cada hueco tiene un estado (publicado, pendiente o genérico). La biblioteca muestra insignias («Sin vídeo breve») y un filtro «Material pendiente». Una vista lista las variantes incompletas, ordenadas por cuántas veces están prescritas en sesiones próximas, para priorizar la producción. En la 1B no se suben archivos: los huecos con material son los clips sintéticos y las siluetas propias incluidas en el proyecto.

#### 3.4 Dos sesiones el mismo día y reanudación (P-21, P-17, P-42)

- Cada sesión tiene **orden** (obligatorio si hay dos ese día) y **etiqueta** opcional. «Hoy» destaca la sesión en curso o, si no hay, la primera pendiente; la otra aparece debajo con su estado.
- Empezar la segunda con la primera en curso pide confirmación y deja la primera **en pausa**. Solo una se ejecuta en el reproductor.
- Cada sesión tiene su registro, su estado y su resumen. El panel del entrenador y la semana muestran las dos.
- **Abandonar no termina la sesión.** Salir del reproductor, cerrar la app, bloquear el móvil o perder la conexión la deja en curso. Solo «Terminar» la finaliza.
- **Se conserva todo:** cada serie (con sus correcciones), las valoraciones y observaciones (también los borradores), el calentamiento hecho o saltado, los ejercicios saltados con motivo, las horas y la versión de la prescripción. Primero en el dispositivo y después en el servidor.
- **Al volver:** «Continuar entrenamiento» abre el último ejercicio visitado con series pendientes o, si no queda ninguno, la primera serie pendiente. Un descanso en curso se recalcula con su hora de fin.
- Se puede retomar **hasta el final del día programado**. Después la sesión queda como parcial (o no realizada) y sus registros se conservan.

### 4. Ejemplos de cálculo (P-20, P-36)

Estos ejemplos se convertirán en **pruebas unitarias con los valores exactos**. Peso corporal del cliente ficticio: 72 kg.

| Ejercicio                                  | Prescrito                                                                | Ejecutado                                                                                      | Volumen prescrito → ejecutado             | Tonelaje externo                 | Magnitud propia                                                                                                          | No se calcula                                                 |
| ------------------------------------------ | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- | ----------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| **Sentadilla trasera** (carga externa)     | Aproximación 5 × 40 kg y 3 × 60 kg; trabajo 4 × 6 × 80 kg, RIR 2         | 6 × 80 · 6 × 80 (+ un reenvío de esa serie, ignorado) · 6 × 77,5 · 5 × 80                      | 4 series, 24 rep. → 4 series, 23 rep.     | 1.920 kg → **1.825 kg** (−95 kg) | Aproximación aparte: 2 series, 8 rep., 380 kg                                                                            | —                                                             |
| **Dominadas con peso corporal y lastre**   | Serie 1: 8 × peso corporal; series 2–4: 5 × peso corporal + 10 kg; RIR 2 | 8 sin lastre · 5 × +10 · 4 × +10 · 5 × +7,5                                                    | 4 series, 23 rep. → 4 series, 22 rep.     | No aplica                        | Carga externa añadida: 150 kg → **127,5 kg**                                                                             | 72 kg × 22 = 1.584 kg (peso corporal × repeticiones)          |
| **Dominadas asistidas**                    | 3 × 8, asistencia de 20 kg (máquina), RIR 2                              | 8 × 20 · 8 × 20 · 6 × 25 kg de asistencia                                                      | 3 series, 24 rep. → 3 series, 22 rep.     | No aplica                        | Asistencia por serie 20 / 20 / 25 kg; media ponderada **21,4 kg** (470 ÷ 22); serie 3 marcada «más ayuda de la prevista» | 72 − 20 = 52 kg como «carga movida»                           |
| **Remo con banda elástica**                | 3 × 12, banda roja doble, RIR 3                                          | 12 roja doble · 12 roja doble · 10 roja simple                                                 | 3 series, 36 rep. → 3 series, 34 rep.     | No aplica                        | 2 series con la configuración prescrita y 1 distinta (marcada)                                                           | Kg o tonelaje de la banda; comparación entre bandas distintas |
| **Salto con contramovimiento** (sin carga) | 4 × 5 saltos, intención máxima, criterio de calidad, sin RIR/RPE         | 5 · 5 · 5 · 4 (la última, terminada por el criterio); valoración buena, buena, aceptable, baja | 4 series, 20 saltos → 4 series, 19 saltos | No aplica                        | Contactos; todas las series cuentan como hechas                                                                          | Altura de salto (no hay instrumento)                          |

Con la sentadilla al **75 % de un 1RM directo de 107 kg**: 0,75 × 107 = 80,25 → **80 kg** (múltiplo de 2,5 kg más cercano), congelado al publicar. La intensidad relativa de la tercera serie es 77,5 ÷ 107 = **72,4 %**.

**Totales de esa sesión, sin mezclar magnitudes:**

| Magnitud                        | Prescrito           | Ejecutado           |
| ------------------------------- | ------------------- | ------------------- |
| Series de trabajo (todas)       | 18                  | 18                  |
| Repeticiones de fuerza          | 107                 | 101                 |
| Saltos (contactos)              | 20                  | 19                  |
| Tonelaje externo                | 1.920 kg            | 1.825 kg            |
| Carga externa añadida (lastre)  | 150 kg              | 127,5 kg            |
| Asistencia media                | 20 kg               | 21,4 kg             |
| Series de aproximación (aparte) | 2 · 8 rep. · 380 kg | 2 · 8 rep. · 380 kg |

No se muestran un total de «repeticiones» que sume fuerza y saltos (120), ni un total de «kg» que sume tonelaje, lastre y asistencia.

### 5. Criterios de aceptación y pruebas

**U** = prueba unitaria o de integración (Vitest) · **E** = E2E (Playwright, escritorio y móvil Pixel 7) · **M** = revisión manual documentada en el informe. Los identificadores CA-xx remiten a `TRAINING_EXPERIENCE.md` §12.

| Func. | Id    | Criterio verificable                                                                                                                                                              | Prueba  |
| ----- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| F-01  | 1B-01 | Clientes, evaluaciones, sesiones y registros creados persisten entre páginas y recargas mientras el servidor sigue en marcha                                                      | E       |
| F-01  | 1B-02 | «Restablecer datos demo» devuelve exactamente el conjunto inicial                                                                                                                 | U, E    |
| F-01  | 1B-03 | Todos los formularios muestran el aviso de no introducir datos personales reales                                                                                                  | E       |
| F-01  | 1B-04 | Las pruebas E2E con escritura se ejecutan en paralelo en espacios aislados, sin interferir entre sí                                                                               | E       |
| F-02  | 1B-05 | «Entrar como…» solo ofrece clientes ficticios de Alex, se identifica como «Modo demostración» y el servidor rechaza un identificador ajeno                                        | U, E    |
| F-03  | 1B-06 | Un cliente creado aparece en la lista y en la búsqueda sin tildes; faltan campos obligatorios → error explicado                                                                   | U, E    |
| F-03  | 1B-07 | Un entrenador no puede ver, editar ni planificar clientes de otro (acceso no autorizado probado)                                                                                  | U       |
| F-04  | 1B-08 | Un resultado con varios intentos se guarda como `calculated` con su regla, y cada intento conserva su procedencia                                                                 | U, E    |
| F-04  | 1B-09 | 1RM directo y 1RM estimado manual se muestran separados; el estimado no sustituye al directo; no hay ninguna ecuación de estimación                                               | U       |
| F-04  | 1B-10 | El peso corporal se registra con fecha; sin él, no se calcula la carga respecto al peso corporal                                                                                  | U       |
| F-05  | 1B-11 | CA-07 y CA-35: las indicaciones y restricciones de un cliente aparecen en sus ejercicios afectados, en los de ningún otro cliente y sin diagnóstico                               | U, E    |
| F-06  | 1B-12 | El cliente solo ve sesiones publicadas (CA-41)                                                                                                                                    | U       |
| F-06  | 1B-13 | Dos sesiones el mismo día exigen orden y se muestran con su etiqueta                                                                                                              | U, E    |
| F-06  | 1B-14 | Duplicar a otro cliente sigue P-19 (CA-38); los kg solo se copian si se marca la opción                                                                                           | U       |
| F-06  | 1B-15 | Aplicar una plantilla resuelve el %1RM con la referencia del cliente o lo marca para revisar; cambiar la plantilla no altera sesiones creadas (CA-39, CA-40)                      | U       |
| F-06  | 1B-16 | Editar una sesión publicada crea una versión nueva; si está en curso, el cliente ve el aviso y lo registrado conserva su versión (CA-34)                                          | U, E    |
| F-07  | 1B-17 | Prescripción común y por serie de repeticiones o rango, modalidad y carga, esfuerzo, descanso, tempo y observaciones; el cliente ve el objetivo de la serie actual (CA-14, CA-37) | U, E    |
| F-07  | 1B-18 | Los seis ejemplos de carga del requisito se prescriben y se muestran con su texto; el formulario solo muestra los campos de la modalidad (CA-09, CA-10)                           | U, E    |
| F-07  | 1B-19 | %1RM: kg calculados con la referencia y el redondeo, con fórmula y versión, congelados al publicar; sin referencia no se publica (CA-11, CA-12)                                   | U       |
| F-07  | 1B-20 | El esfuerzo empieza vacío; RIR + RPE exige justificación; RPE solo con la escala basada en RIR; RIR en series por tiempo o distancia, rechazado (CA-13, CA-15, CA-16)             | U       |
| F-07  | 1B-21 | Potencia y técnica: intención, criterio de calidad y valoración sin RIR/RPE; el campo de velocidad solo aparece con instrumento indicado y no hay valores ni umbrales por defecto | U, E    |
| F-07  | 1B-22 | Tempo de 3 y 4 cifras, con su explicación                                                                                                                                         | U       |
| F-08  | 1B-23 | Cada variante muestra sus tres huecos con estado; la vista «Material pendiente» lista las incompletas y el filtro funciona                                                        | U, E    |
| F-08  | 1B-24 | Sin recurso o con fallo de carga se aplica la tabla del §3.3; el ampliado no se publica sin el breve (CA-04, CA-05, CA-06)                                                        | U, E    |
| F-08  | 1B-25 | El clip sintético se reproduce silenciado y en bucle, con botón de pausa, y no se reproduce solo con `prefers-reduced-motion` (CA-50)                                             | E       |
| F-09  | 1B-26 | «Hoy» muestra objetivo, duración, número de ejercicios y el botón sin desplazarse; dos sesiones, continuar y día de descanso (CA-22, CA-30, CA-31)                                | E       |
| F-10  | 1B-27 | Calentamiento opcional, ejercicio con todos sus datos en una pantalla, serie prevista con un toque, descanso con ±15 s y saltar, siguiente, «Tu sesión» y resumen (CA-23 a CA-28) | E       |
| F-10  | 1B-28 | Saltar un ejercicio guarda el motivo y no cuenta como hecho; terminar con series pendientes pide confirmación                                                                     | U, E    |
| F-11  | 1B-29 | Sin conexión se registran series; al recuperarla se envían y cambia el estado visible (CA-32)                                                                                     | E       |
| F-11  | 1B-30 | Un reenvío con el mismo identificador o una corrección no aumentan series, repeticiones ni tonelaje (CA-33)                                                                       | U, E    |
| F-11  | 1B-31 | Tras recargar o cerrar, «Continuar» abre el punto de P-42 con todo lo registrado; el descanso en curso es correcto                                                                | E       |
| F-11  | 1B-32 | Al salir del modo demostración se borran los datos del dispositivo, avisando si hay series sin enviar (CA-36)                                                                     | E       |
| F-12  | 1B-33 | Las ayudas se abren en la misma pantalla con el texto aprobado (CA-18)                                                                                                            | E       |
| F-13  | 1B-34 | La ficha del cliente muestra lo realizado serie a serie frente a lo prescrito, con la versión y las diferencias marcadas con icono y texto                                        | E       |
| F-13  | 1B-35 | Los cinco ejemplos y los totales del §4 se reproducen con los valores exactos (CA-43 a CA-46)                                                                                     | U       |
| F-13  | 1B-36 | El entrenador anota una serie sin poder modificar lo registrado por el cliente                                                                                                    | U       |
| F-14  | 1B-37 | El progreso del cliente solo muestra lo compartido                                                                                                                                | U, E    |
| F-15  | 1B-38 | Cada política nueva tiene un test de acceso permitido y otro no autorizado                                                                                                        | U       |
| Todas | 1B-39 | Ciclo completo del §6 en escritorio (entrenador) y móvil (cliente)                                                                                                                | E       |
| Todas | 1B-40 | Sin incidencias graves de axe ni desplazamiento horizontal en las pantallas nuevas (CA-49); carga y esfuerzo, los textos más grandes de la ficha del ejercicio (CA-48)            | E, M    |
| Todas | 1B-41 | `pnpm check` y `pnpm test:e2e` pasan; `package.json` no tiene dependencias nuevas; lo simulado se marca con `PendingFeature` o `Notice` (CA-52)                                   | U, E, M |
| F-16  | 1B-42 | La valoración previa se responde en un máximo de tres interacciones, se puede saltar y se guarda como `self_reported`, sin puntuación compuesta                                   | U, E    |
| F-16  | 1B-43 | La valoración previa no cambia la prescripción (no hay reglas en la 1B)                                                                                                           | U       |
| F-17  | 1B-44 | El dolor se registra con zona, lado, intensidad y contexto; solo lo ven quienes tienen el alcance de salud; acceso no autorizado probado                                          | U, E    |
| F-18  | 1B-45 | El RPE de la sesión se pide al terminar en todas las sesiones salvo desactivación con motivo; «Responder más tarde» funciona 24 h y se guardan los minutos                        | U, E    |
| F-18  | 1B-46 | La duración de la sesión excluye las pausas registradas; no se calcula ninguna carga interna                                                                                      | U       |
| Todas | 1B-47 | El ciclo del §6 incluye la valoración previa y el RPE de la sesión, visibles para el entrenador como autodeclarados                                                               | E       |

### 6. Prueba del ciclo completo (1B-39)

Una prueba E2E recorre el ciclo con valores comprobables:

1. **Crear cliente:** Alex da de alta a «Lucía (ficticia)».
2. **Evaluar:** registra un 1RM directo de sentadilla de 100 kg y un peso corporal de 65 kg.
3. **Planificar y prescribir** una sesión para hoy, y publicarla:
   - A1 · Sentadilla trasera, 4 × 6 al 75 % del 1RM (→ **75 kg**), RIR 2, 120 s, tempo 2-0-1.
   - B1 · Dominadas, 3 × 5, peso corporal + 5 kg, RIR 2.
   - C1 · Salto con contramovimiento, 3 × 5, sin carga, intención máxima y criterio de calidad.
4. **Ejecutar desde el móvil** como Lucía:
   - Valoración previa: energía 7, recuperación 6, sin dolor.
   - Sentadilla: dos series de 6 × 75 kg. **Sin conexión**: 6 × 72,5 kg y 5 × 75 kg.
   - Recarga la página → «Continuar» abre las dominadas.
   - **Vuelve la conexión** y se envía la cola. Se fuerza el reenvío de una serie, que no debe contar.
   - Dominadas: 5, 5 y 4 con +5 kg. Saltos: 5, 5 y 5, con su valoración.
   - Termina y valora la sesión con un RPE de 7.
5. **Registrar:** el resumen muestra 10 de 10 series y la sesión completada.
6. **Analizar** como Alex:
   - Sentadilla: 24 → 23 repeticiones, tonelaje 1.800 → **1.710 kg**; intensidad relativa de la tercera serie, 72,5 %.
   - Dominadas: 15 → 14 repeticiones; lastre 75 → **70 kg**.
   - Saltos: 15 → 15 contactos.
   - Repeticiones de fuerza: 39 → 37.
   - Valoración previa (7 y 6) y RPE de la sesión (7) como autodeclarados, sin carga interna calculada (llega en la 1C).

### 7. Etapas, dependencias y riesgos

| Etapa | Contenido                                                                                                                                                     | Termina con                                    |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| 1B.1  | Dominio: prescripción y registro v2, validaciones, métricas y los ejemplos del §4 como tests; datos demo adaptados; las pantallas actuales siguen funcionando | **Revisión intermedia (P-43)**, si la apruebas |
| 1B.2  | Datos demo con escritura, identidad demo, crear cliente, evaluar, indicaciones (F-01 a F-05)                                                                  | Commit y pruebas                               |
| 1B.3  | Planificar y prescribir (F-06, F-07)                                                                                                                          | Commit y pruebas                               |
| 1B.4  | Portal: Hoy, reproductor, registro sin conexión, reanudación, textos, valoración previa, dolor y RPE de la sesión (F-09 a F-12 y F-16 a F-18)                 | Commit y pruebas                               |
| 1B.5  | Ficha y material visual, análisis, progreso, ciclo completo e informe (F-08, F-13 a F-15)                                                                     | **Informe de la Fase 1B y parada**             |

**Dependencias:**

- **Tu aprobación** del alcance y de las decisiones marcadas «Sí» en `DECISIONS.md`: P-11, P-16 a P-23, P-25, P-26, P-28, P-34 a P-44, P-47, P-48 y P-58.
- **Textos aprobados** para el cliente (P-26) antes de la etapa 1B.4.
- **Documentación de Next.js 16** incluida en `node_modules` (acciones de servidor, manejadores de rutas, cookies), que hay que leer antes de programar, como pide `AGENTS.md`.
- **ffmpeg en local**, solo para generar los clips sintéticos una vez (está disponible en este entorno; no es una dependencia del proyecto).
- **Navegador:** Chromium preinstalado (escritorio y emulación de Pixel 7). **No hay Safari ni iPhone en este entorno**: la reproducción automática, Wake Lock y el borrado del almacenamiento en iOS quedan para la Fase 10.

**Riesgos:**

| Riesgo                                                                 | Mitigación                                                                         |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Alcance grande                                                         | Lista cerrada, etapas con commit y revisión tras 1B.1                              |
| Estado compartido en memoria entre pruebas                             | Espacios aislados solo para E2E (1B-04)                                            |
| Sincronización sin conexión probada solo en Chromium                   | Pruebas de reenvío e idempotencia; validación en dispositivos reales en la Fase 10 |
| El modo demostración parece un inicio de sesión                        | Etiqueta permanente; un único punto de cambio (`getClientContext`)                 |
| Introducción de datos reales en los formularios                        | Aviso visible; los datos se pierden al reiniciar; sin envío a terceros             |
| Cambios en pruebas existentes (repeticiones totales, «nada se guarda») | Justificación de cada cambio en el informe; fórmulas con versión nueva             |
| Servidor sin autenticación accesible en la red local                   | Ejecutarlo solo en local; no desplegar                                             |

---

## Fase 1C · Propuesta: progresión y autorregulación supervisada

> **Pendiente de aprobación (P-44).** Empieza solo tras cerrar la 1B y con las aprobaciones de «antes de la 1C» (`DECISIONS.md`). Mismas condiciones que la 1B: datos ficticios, sin infraestructura, sin dependencias nuevas y sin costes. Diseño en `PROGRESSION_AND_AUTOREGULATION.md`.

### 1. Funcionalidades (lista cerrada)

| Id   | Funcionalidad                             | Incluye                                                                                                                                                                                           |
| ---- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C-01 | Esquemas de progresión                    | Lineal en kg o %, doble progresión, por cumplimiento de repeticiones y RIR/RPE, y mantener, reducir o repetir (P-46); por ejercicio o bloque; parámetros del entrenador; versión                  |
| C-02 | Motor de reglas                           | Funciones puras del dominio: condición, acción, límites, modo y versión. Sin valores por defecto                                                                                                  |
| C-03 | Alternativas autorizadas                  | Lista de sustitutos permitidos por ejercicio y cliente                                                                                                                                            |
| C-04 | Recomendaciones explicables               | Tarjeta con propuesta, motivo, datos con procedencia, regla y versión, etiqueta de evidencia, limitaciones y alternativas                                                                         |
| C-05 | Bandeja de revisión                       | Aceptar, modificar o rechazar; aviso de las acciones preautorizadas aplicadas                                                                                                                     |
| C-06 | Reglas preautorizadas previas a la sesión | Se evalúan tras la valoración previa, también sin conexión, con la misma función del dominio; el cliente ve el cambio explicado                                                                   |
| C-07 | Registro de decisiones                    | Los seis datos del §5.5 de `PROGRESSION_AND_AUTOREGULATION.md`, visibles en la ficha del cliente                                                                                                  |
| C-08 | 1RM estimado                              | Solo con ecuaciones que superen P-50, con margen y condiciones; progresión por 1RM estimado, supervisada. Si ninguna ecuación supera el protocolo: `PendingFeature` y solo el 1RM estimado a mano |
| C-09 | Carga interna y volumen por patrón        | RPE de la sesión × duración sin pausas (P-49), con tendencias semanales; volumen por patrón «solo principal» y «principal y secundarios». Si la fórmula no se verifica: `PendingFeature`          |
| C-10 | Registro de evidencia mínimo              | Fuentes y etiquetas de las fórmulas, esquemas y reglas incluidos (P-61)                                                                                                                           |

**Fuera de la 1C:** periodización por bloques, modelos ondulantes, APRE, VBT, volumen por grupo muscular, IA, modo automático sin límites, reglas en readaptación, notificaciones push y planes con semanas.

### 2. Ejemplos que se convertirán en tests

Todos los umbrales son **valores escritos por el entrenador en el ejemplo**, no recomendaciones.

1. **Doble progresión.** Press de banca 3 × 6–8 con 60 kg; incremento de 2,5 kg cuando todas las series lleguen a 8 con RIR real ≥ 2. Sesión A: 8, 8 y 7 → «Mantener 60 kg». Sesión B: 8, 8 y 8 con RIR 2, 2 y 3 → «Subir a 62,5 kg y volver a 6 repeticiones». Si el entrenador acepta, la sesión siguiente se publica con 62,5 kg y queda el registro de la decisión.
2. **Regla preautorizada.** «Si energía ≤ 4 y recuperación ≤ 4, no aplicar el incremento previsto.» El cliente responde 3 y 3 → hoy 60 kg en lugar de 62,5 kg. Queda registrado: original 62,5 kg; respuesta 3 y 3; regla v1; recomendación «no aplicar el incremento»; decisión «preautorizada»; ejecutado 60 kg.
3. **Conflicto.** Carga prevista para hoy: 62,5 kg. Dos reglas preautorizadas: «no aplicar el incremento» (→ 60 kg) y «reducir un 10 % la carga prevista» (62,5 × 0,9 = 56,25 kg → 55 kg, porque el redondeo a 2,5 kg resuelve el empate hacia abajo, P-41). En la carga gana la de menor exigencia: **55 kg**. Si una tercera regla quita una serie, se aplica también, porque afecta a otro campo.
4. **1RM estimado.** 80 kg × 8 repeticiones con RIR 0 y una ecuación validada para ese ejercicio → valor con margen. Con 12 repeticiones → «Fuera del rango de la ecuación (2–10)», sin resultado.
5. **Carga interna.** Sesión de 52 min con 7 min en pausa → 45 min. RPE de la sesión 7 → 315 UA (`calculated`, con fórmula y versión).
6. **Readaptación.** Intentar crear una regla preautorizada para un ejercicio de un caso de readaptación → se rechaza.

### 3. Criterios de aceptación y pruebas

| Func. | Id    | Criterio verificable                                                                                                                                   | Prueba  |
| ----- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| C-01  | 1C-01 | Cada esquema del catálogo se asigna a un ejercicio o bloque y produce las recomendaciones del ejemplo 1                                                | U, E    |
| C-01  | 1C-02 | Ningún esquema tiene parámetros prerrellenados                                                                                                         | U       |
| C-02  | 1C-03 | Las reglas son deterministas: la misma entrada da la misma salida; cambiar una regla crea una versión nueva                                            | U       |
| C-02  | 1C-04 | El ejemplo 3 (conflicto) se resuelve campo a campo con el valor de menor exigencia                                                                     | U       |
| C-02  | 1C-05 | Una acción preautorizada nunca aumenta la exigencia por encima de lo planificado ni se aplica en readaptación (ejemplo 6)                              | U       |
| C-03  | 1C-06 | Solo se sustituye por alternativas autorizadas para ese ejercicio y cliente                                                                            | U       |
| C-04  | 1C-07 | Cada recomendación muestra los seis elementos de la explicación, y los datos llevan su procedencia                                                     | U, E    |
| C-05  | 1C-08 | Aceptar, modificar y rechazar actualizan la prescripción solo en los dos primeros casos                                                                | U, E    |
| C-06  | 1C-09 | El ejemplo 2 funciona con y sin conexión, con el mismo resultado, y el cliente ve el texto explicativo                                                 | U, E    |
| C-07  | 1C-10 | El registro de decisiones contiene los seis datos y no se puede editar                                                                                 | U       |
| C-08  | 1C-11 | El 1RM estimado se guarda como `estimated`, con su margen y condiciones; fuera de rango no se calcula; nunca sustituye a un 1RM directo                | U       |
| C-08  | 1C-12 | Las ecuaciones reproducen los valores del §3.3 de `PROGRESSION_AND_AUTOREGULATION.md` y, si existen, los ejemplos publicados de su fuente              | U       |
| C-09  | 1C-13 | Ejemplo 5: 315 UA con fórmula y versión; no existe ningún cociente agudo:crónico ni indicador de riesgo de lesión                                      | U       |
| C-09  | 1C-14 | El volumen por patrón «solo principal» y «principal y secundarios» se muestra por separado y cada serie cuenta una vez por patrón                      | U       |
| C-10  | 1C-15 | Cada fórmula, esquema y regla incluidos tiene su fuente o su etiqueta («heurística», «decisión de diseño»)                                             | U, M    |
| Todas | 1C-16 | Un entrenador no puede crear reglas ni ver recomendaciones de clientes que no son suyos; `pnpm check` y `pnpm test:e2e` pasan; sin dependencias nuevas | U, E, M |

### 4. Subfases, dependencias y riesgos

| Subfase | Contenido                                                                 | Termina con                        |
| ------- | ------------------------------------------------------------------------- | ---------------------------------- |
| 1C.1    | Dominio: esquemas, reglas, explicación, registro de decisiones y ejemplos | Revisión intermedia (como P-43)    |
| 1C.2    | Entrenador: asignar esquemas, configurar reglas y alternativas, bandeja   | Commit y pruebas                   |
| 1C.3    | Cliente: reglas preautorizadas tras la valoración previa, sin conexión    | Commit y pruebas                   |
| 1C.4    | 1RM estimado, carga interna, volumen por patrón, evidencia e informe      | **Informe de la Fase 1C y parada** |

**Dependencias:**

- Las aprobaciones de «antes de la 1C».
- La verificación de la fórmula de carga interna y de las ecuaciones de 1RM, sin la cual esas partes quedan como `PendingFeature`.

**Riesgos:**

| Riesgo                                         | Mitigación                                                                  |
| ---------------------------------------------- | --------------------------------------------------------------------------- |
| Reglas que parecen recomendaciones científicas | Etiqueta «decisión del entrenador» en todo umbral y explicación obligatoria |
| Complejidad de configuración                   | Pocos esquemas, sin parámetros por defecto pero con ayuda contextual        |
| Incoherencias entre el móvil y el servidor     | La misma función del dominio y tests que comparan ambos resultados          |
