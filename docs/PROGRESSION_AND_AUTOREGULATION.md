# Progresión, autorregulación, valoración previa y carga interna

> **Estado: diseño pendiente de aprobación. No hay código.** Referencias verificadas en PubMed el **6 de noviembre de 2026** (metadatos y resumen). Cuando una afirmación sale solo del título, o de una fuente secundaria, se indica. Las decisiones están en `DECISIONS.md` (P-45 a P-50 y P-53) y la implementación propuesta, en la Fase 1C de `ROADMAP.md`.

## 1. Principios

1. **El entrenador elige y configura.** Ningún sistema de progresión, umbral ni regla viene activado o rellenado por defecto.
2. **Sin umbrales universales.** Los valores de cada regla los escribe el entrenador. Los ejemplos de este documento son ilustrativos, no recomendaciones.
3. **Supervisión.** El motor propone; el entrenador decide. La única excepción son las acciones **preautorizadas**: conservadoras, definidas por el entrenador de antemano y nunca en readaptación (P-45).
4. **Explicación y registro.** Cada recomendación explica datos, regla, versión, evidencia y limitaciones, y queda registrada con la decisión tomada.
5. **Escalas subjetivas como lo que son.** La energía, la recuperación y el RPE son autodeclarados (`self_reported`), no mediciones fisiológicas.

## 2. Sistemas de progresión

| Sistema                                        | Cómo funciona                                                                                                 | Parámetros (los define el entrenador)                                          | Evidencia y etiqueta                                                                                                                                                                                                                                                                                                                         | Cuándo encaja                                                        | Entrega                                           |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------- |
| **Lineal en kg o en %**                        | La carga sube un incremento fijo por sesión o por semana si se cumple lo prescrito                            | Incremento (kg o %), frecuencia, condición de cumplimiento, tope               | **Práctica profesional.** Como modelo de periodización, la lineal y la ondulante no difieren en fuerza en el metaanálisis de Harries et al. (2015), y la ondulante favorece el 1RM en personas entrenadas en el de Moesgaard et al. (2022)                                                                                                   | Principiantes, fases de acumulación, readaptación (sin automatismos) | **1C**                                            |
| **Doble progresión**                           | Dentro de un rango (p. ej., 6–8): se suben repeticiones hasta el extremo superior y entonces se sube la carga | Rango, incremento de carga, condición (todas las series o algunas), RIR mínimo | **Heurística con apoyo indirecto.** Progresar repeticiones con la carga fija o progresar la carga dio adaptaciones similares en 8 semanas, en personas entrenadas (Plotkin et al., 2022)                                                                                                                                                     | Hipertrofia, accesorios, material con saltos de carga grandes        | **1C**                                            |
| **Por cumplimiento de repeticiones y RIR/RPE** | Avanza si se cumplen las repeticiones con el RIR (o RPE) real dentro del margen; mantiene o reduce si no      | Margen de RIR, acción en cada caso, incrementos                                | **Evidencia de equivalencia.** La carga autorregulada y la estandarizada dieron ganancias de fuerza similares (metaanálisis de Hickmott et al., 2022). La carga por RPE fue tan eficaz como el %1RM, con una posible ventaja pequeña (Helms et al., 2018). Graham y Cleather (2021) informan, según su título, de mejores resultados con RIR | Personas familiarizadas con el RIR (`EFFORT_AND_LOAD.md` §4.2)       | **1C**                                            |
| **Por 1RM estimado**                           | Recalcula los kg del %1RM con el 1RM estimado de sesiones recientes                                           | Ecuación, ventana de sesiones, condiciones del §3                              | Depende de la validez de la estimación (§3)                                                                                                                                                                                                                                                                                                  | Fuerza, cuando hay datos fiables                                     | **1C** (tras P-50)                                |
| **Mantener, reducir o repetir la exposición**  | Acciones explícitas cuando no se cumple o la respuesta es mala                                                | Condiciones y cuantía                                                          | **Decisión del profesional**                                                                                                                                                                                                                                                                                                                 | Todas                                                                | **1C**                                            |
| **Autorregulación diaria por esfuerzo**        | La carga del día se elige para alcanzar un RPE o RIR objetivo                                                 | Objetivo de esfuerzo; opcional, tope de cambio                                 | Helms et al. (2016, 2018); ver la fila «Por cumplimiento»                                                                                                                                                                                                                                                                                    | Personas familiarizadas con la escala                                | Ya en el diseño de la 1B (carga autoseleccionada) |
| **Ondulante (diaria o semanal)**               | Variación planificada de intensidad y volumen                                                                 | Estructura de la semana o del bloque                                           | **Evidencia.** La periodizada supera a la no periodizada en 1RM (Williams et al., 2017; Moesgaard et al., 2022); la ondulante favorece el 1RM en personas entrenadas (Moesgaard et al., 2022); sin diferencias en hipertrofia (Grgic et al., 2017)                                                                                           | Rendimiento y personas entrenadas                                    | **E3** (es estructura de planificación, no regla) |
| **Ondulante flexible**                         | La persona elige qué sesión del bloque hace según su estado                                                   | Sesiones intercambiables y reglas de elección                                  | **Evidencia limitada.** Principiantes: más mejora en prensa de piernas (McNamara y Stearne, 2010). Personas entrenadas: resultados similares a la ondulante fija (Colquhoun et al., 2017)                                                                                                                                                    | Con valoración previa                                                | **E3**                                            |
| **APRE**                                       | La carga se ajusta según las repeticiones hasta el fallo en series concretas                                  | Tabla de ajuste                                                                | **Evidencia de un estudio** en jugadores universitarios de fútbol americano: más mejora que la lineal en 6 semanas (Mann et al., 2010)                                                                                                                                                                                                       | Requiere llevar series al fallo: no es para todas las poblaciones    | **E3**                                            |
| **Por velocidad (VBT)**                        | Carga o volumen según la velocidad medida                                                                     | Objetivos de velocidad, umbral de pérdida                                      | **Evidencia.** VBT frente a porcentajes: mejoras similares o mayores, con menos volumen (Dorrell et al., 2020). Umbrales de pérdida ≤ 25 % favorecieron la fuerza y > 25 % la hipertrofia (Hickmott et al., 2022)                                                                                                                            | Solo con dispositivo verificado                                      | **E5** (integraciones)                            |
| **Por objetivos o criterios**                  | Se avanza de fase cuando se cumple un criterio de evaluación                                                  | Criterios y pruebas que los respaldan                                          | **Consenso:** en el retorno al deporte, la decisión es un continuo y la evidencia es escasa (Ardern et al., 2016). Criterios definidos por el profesional                                                                                                                                                                                    | Readaptación y objetivos de rendimiento                              | **E4** (ya existe la base)                        |

La **progresión se asigna por ejercicio o por bloque** y puede variar entre ejercicios de la misma sesión. Cada asignación guarda el esquema, sus parámetros y la versión.

## 3. Estimación del 1RM

### 3.1 Ecuaciones estudiadas

Las expresiones son las que se citan habitualmente. Ninguna fuente original es un artículo indexado en PubMed: son libros o revistas profesionales. **Ninguna se implementará hasta cumplir el protocolo de verificación (P-50).** _w_ = carga (kg), _r_ = repeticiones hasta el fallo.

| Ecuación                   | Expresión habitual                                                    | Fuente original citada                                                      | Estado de verificación                                               |
| -------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| **Brzycki (1993)**         | _w_ ÷ (1,0278 − 0,0278 _r_)                                           | _J Phys Educ Recreat Dance_ 64(1):88–90; doi:10.1080/07303084.1993.10606684 | Fuente localizada, texto no leído                                    |
| **Epley (1985)**           | _w_ × (1 + _r_ ÷ 30)                                                  | Tabla publicada por su autor                                                | Fuente no localizada                                                 |
| **O'Connor et al. (1989)** | _w_ × (1 + 0,025 _r_)                                                 | Libro _Weight Training Today_                                               | Fuente no consultada. **Estudiada, no implementada** (como se pidió) |
| **Lombardi (1989)**        | _w_ × _r_^0,10                                                        | Libro _Beginning Weight Training_                                           | Fuente no consultada                                                 |
| **Lander (1985)**          | 100 _w_ ÷ (101,3 − 2,67123 _r_)                                       | _National Strength and Conditioning Association Journal_                    | Fuente no consultada                                                 |
| **Mayhew et al. (1992)**   | 100 _w_ ÷ (52,2 + 41,9 e^(−0,055 _r_))                                | _Journal of Applied Sport Science Research_                                 | Fuente no consultada                                                 |
| **Wathan (1994)**          | 100 _w_ ÷ (48,8 + 53,8 e^(−0,075 _r_))                                | Capítulo de un manual de la NSCA                                            | Fuente no consultada                                                 |
| **Reynolds et al. (2006)** | Prensa: 1,0970 × 5RM + 14,2546; press de pecho: 1,1307 × 5RM + 0,6999 | _J Strength Cond Res_ 20(3):584–592                                         | **Verificada en PubMed.** Solo para esas máquinas y a partir de 5RM  |

### 3.2 Lo que dicen los estudios de validación (PubMed)

- **Press de banca en hombres de distintos niveles (n = 220):** seis ecuaciones dieron coeficientes de validez de 0,82 a 0,98. Con 10 repeticiones o menos, Brzycki fue la más precisa y otras sobrestimaron o subestimaron. Con más de 10, todas se desviaron. Los autores sugieren que promediar dos ecuaciones puede reducir el error (Mayhew et al., 1995).
- **Mujeres jóvenes, antes y después de entrenar:** más precisión con menos de 10 repeticiones hasta el fallo (Mayhew et al., 2008).
- **Prensa y press de pecho en adultos de 18 a 69 años:** no más de 10 repeticiones en ecuaciones lineales (Reynolds et al., 2006).
- **Artrosis de rodilla:** las más precisas cambiaron con el ejercicio. En extensión de rodilla: Brown, Brzycki, Epley, Lander, Mayhew, Poliquin y Wathan. En prensa: Adams, Berger, Kemmler y **O'Conner**, con errores típicos del 5,9 % al 6,3 % (McNair et al., 2011).
- **Press de banca, personas entrenadas, al 70 % del 1RM:** Epley dio el menor error típico de estimación, frente a Wathan, Mayhew y la estimación por velocidad (Nickerson et al., 2020).
- **Lesión medular:** Lombardi tuvo la mejor validez cruzada (Ribeiro Neto et al., 2017).

**Conclusión:** no hay una ecuación «mejor» universal. La precisión depende del **ejercicio**, la **población** y el **número de repeticiones**.

### 3.3 Por qué no se puede extrapolar

Cálculo propio con las expresiones de §3.1 para 80 kg:

| Repeticiones | Mínimo de las 7 ecuaciones | Máximo             | Diferencia |
| ------------ | -------------------------- | ------------------ | ---------- |
| 5            | 90,0 kg                    | 95,2 kg            | 5,8 %      |
| 8            | 96,0 kg (O'Connor)         | 102,1 kg (Wathan)  | 6,4 %      |
| 10           | 100,0 kg (O'Connor)        | 107,8 kg (Wathan)  | 7,8 %      |
| 15           | 104,9 kg (Lombardi)        | 130,9 kg (Brzycki) | **24,8 %** |

Además, con 1 repetición algunas no devuelven la carga levantada (Epley da 82,7 kg y Mayhew, 87,1 kg): no tienen sentido fuera de su rango.

### 3.4 Reglas propuestas

- Solo de **2 a 10 repeticiones** hasta el fallo (o hasta el fallo estimado con RIR, §3.5), con carga externa en kg y en el **mismo ejercicio y variante**.
- **El entrenador elige la ecuación** para cada ejercicio, viendo para qué ejercicios y poblaciones se ha validado. No hay ecuación por defecto.
- El resultado se muestra como **valor aproximado con su margen**: la dispersión entre las ecuaciones validadas para ese ejercicio y, si hay RIR, ±1 repetición.
- Se guarda como medición `estimated` con: fórmula y versión, carga, repeticiones, RIR (si lo hay), serie usada, fecha, resultado, margen y condiciones comprobadas. **Nunca sustituye a un 1RM medido** ni lo sobrescribe.
- Un 1RM medido es `direct` cuando se levanta en una prueba.

### 3.5 Con RIR

Repeticiones hasta el fallo estimadas = repeticiones + RIR declarado. **No se ha encontrado validación publicada de esta combinación** (`EFFORT_AND_LOAD.md` §8.2). La subestimación media del RIR, de 0,95 repeticiones con mucha heterogeneidad (Halperin et al., 2022), se traslada al resultado. Se ofrece solo si el entrenador lo activa (P-24), con RIR de 3 o menos.

### 3.6 Verificación de las fuentes (revisión del 6 de noviembre de 2026, P-50)

Se refuerza la regla: **no se implementa ninguna ecuación sin leer su fuente original** (fórmula, población y condiciones). La vía alternativa de cotejar la expresión en estudios de validación queda descartada como regla general.

| Ecuación                                               | Fuente original                     | Cómo obtenerla sin coste                                                                                    | Estado                                                                                                                                                                                       |
| ------------------------------------------------------ | ----------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Brzycki (1993)                                         | Artículo en _JOPERD_ (DOI conocido) | Biblioteca universitaria; hay una copia en línea, pero ese dominio está bloqueado por la red de esta sesión | **No leída.** Según fuentes secundarias, el artículo no describe los datos de los que sale la ecuación, así que su validez depende de los estudios posteriores (p. ej., Mayhew et al., 1995) |
| Reynolds et al. (2006)                                 | Artículo indexado                   | Biblioteca universitaria                                                                                    | Resumen verificado; falta el texto completo (población y procedimiento)                                                                                                                      |
| Epley (1985)                                           | Tabla comercial                     | Difícil de localizar                                                                                        | No localizada                                                                                                                                                                                |
| O'Connor et al. (1989), Lombardi (1989), Wathan (1994) | Libros                              | Préstamo de biblioteca                                                                                      | No consultadas                                                                                                                                                                               |
| Lander (1985), Mayhew et al. (1992)                    | Revistas profesionales no indexadas | Biblioteca o hemeroteca                                                                                     | No consultadas                                                                                                                                                                               |

**Consecuencia para la 1C:** el 1RM estimado por ecuación solo entra si antes de empezar se han leído las fuentes. Si no, esa función queda como `PendingFeature` y se mantiene el 1RM estimado introducido a mano.

## 4. Valoración previa a la sesión

### 4.1 Qué se pregunta

| Pregunta                                     | Escala                     | Obligatoria                       |
| -------------------------------------------- | -------------------------- | --------------------------------- |
| ¿Cuánta energía tienes hoy?                  | 1 (muy poca) a 10 (mucha)  | Sí (se puede saltar)              |
| ¿Cómo de recuperado o descansado te sientes? | 1 (nada) a 10 (totalmente) | Sí (se puede saltar)              |
| ¿Tienes dolor o molestias?                   | No / Sí → zona y 0–10      | No en la 1B (P-58 revisada, §4.7) |

Se responde en menos de 10 segundos, con dos deslizadores y un toque. Si se salta, la sesión sigue igual.

### 4.2 Lo que dice la evidencia

- Las **medidas subjetivas** reflejaron la carga de entrenamiento aguda y crónica con más sensibilidad y consistencia que las objetivas habituales, y ambas no solían correlacionar (Saw et al., 2016).
- Pero los **ítems sueltos** más usados en ciencias del deporte **no están validados**, y son frecuentes las versiones modificadas de ítems que ya no estaban validados (Jeffries et al., 2020).
- Ya existían escalas de recuperación percibida: la escala PRS (Laurent et al., 2011) se correlacionó moderadamente con el cambio de rendimiento en sprints repetidos (r = −0,63).
- Cuestionarios de varios ítems con dimensiones separadas: el índice de Hooper (Hooper et al., 1995; sueño, estrés, fatiga y dolor muscular) y el de McLean et al. (2010; fatiga, bienestar y dolor muscular).
- **¿Aportan energía y recuperación información distinta?** No se ha encontrado un estudio que lo compare para estos dos ítems. Conceptualmente son distintos (disposición inmediata frente a recuperación de esfuerzos previos), pero pueden estar muy correlacionados.

### 4.3 Propuesta (P-47)

1. Mantener las **dos preguntas pedidas**, marcadas como **ítems propios no validados**. La pregunta de **dolor o molestias**, propuesta antes por ser accionable (restricciones y seguridad) y relevante en readaptación, queda fuera de la 1B por la recomendación revisada de P-58 (§4.7).
2. **Sin puntuación compuesta**, a diferencia de la encuesta promediada de TrainHeroic: mezclar dimensiones oculta información.
3. Interpretar los valores **respecto a la línea base de cada persona**, no con umbrales absolutos.
4. **Revisar con datos reales** (E1): si energía y recuperación correlacionan mucho, fusionarlas; si alguna no se relaciona con nada útil, retirarla.
5. Si hacen falta más dimensiones (sueño, estrés), el entrenador puede activarlas para un cliente. No se añaden por defecto.
6. El dolor es un **dato de salud** (P-58).

### 4.4 Valoración posterior

RPE de la sesión (§6) y un comentario opcional.

### 4.5 Justificación ampliada de las dos preguntas (P-47)

- **Por qué energía y recuperación.** Cubren dos ideas distintas: cómo se siente la persona para rendir hoy y cuánto se ha recuperado de lo anterior. Un instrumento validado de 8 ítems, la Short Recovery and Stress Scale (SRSS), mantiene escalas separadas que se parecen a estas dos, y se validó en 996 deportistas de tres regiones de habla inglesa (Kölling et al., 2019). En niños y adolescentes, la aplicabilidad de estos cuestionarios fue más limitada (Kölling et al., 2019b). La correspondencia entre nuestras preguntas y las de la SRSS es **conceptual**, no una validación de nuestras preguntas.
- **Escala 1 a 10.** La pediste así y es fácil de entender en el móvil. No equivale a la escala de la SRSS ni se convierte a ella. Los extremos se rotulan con palabras propias («1: muy poca energía», «10: mucha energía»), sin pretender que sean anclas validadas.
- **Interpretación.** Solo **respecto a la línea base de cada persona**: la mediana y el rango de sus últimas _K_ respuestas, con _K_ elegido por el entrenador. Si hay menos de _K_ respuestas, la señal es «insuficiente» y ninguna regla la usa. No hay umbrales universales.
- **Limitaciones.** Son ítems propios no validados (Jeffries et al., 2020); dependen del estado de ánimo, de la sinceridad y de la costumbre de responder; no son mediciones fisiológicas; pueden estar muy correlacionados entre sí.
- **Plan de revisión.** Con datos reales (E1) se calculará la correlación entre las dos preguntas y su relación con lo realizado (RIR real, cumplimiento). Si no aportan información distinta, se fusionarán en una sola.

### 4.6 ¿Merece la pena preguntar más?

| Variable posible                              | Valor                                                                 | Coste para el cliente      | Propuesta                                                                           |
| --------------------------------------------- | --------------------------------------------------------------------- | -------------------------- | ----------------------------------------------------------------------------------- |
| Dolor o molestias                             | Alto: es accionable (seguridad, restricciones, readaptación)          | Bajo (un «No» en un toque) | **No en la 1B** (§4.7); en E4, si se aprueban su diseño y su protección             |
| Sueño                                         | Medio; se solapa con la recuperación                                  | Bajo                       | No por defecto; el entrenador puede activarlo para un cliente                       |
| Estrés                                        | Medio; útil en algunos contextos (competición, estudios)              | Bajo                       | No por defecto; activable                                                           |
| Dolor muscular de aparición tardía            | Medio en fuerza e hipertrofia; se puede confundir con el dolor (§4.7) | Bajo                       | No por defecto; activable, con texto que lo distinga del dolor                      |
| Ánimo o motivación                            | Bajo para decidir la carga                                            | Bajo                       | No                                                                                  |
| Cuestionario validado completo (p. ej., SRSS) | Alto en rendimiento                                                   | Medio (8 ítems)            | **E3**, tras comprobar que existe versión validada en español y los derechos de uso |

Cada pregunta añadida reduce la tasa de respuesta, así que la regla es: **dos preguntas fijas y las demás solo si el entrenador va a usarlas**.

### 4.7 Dolor e incidencias (P-58)

> **Recomendación revisada (7 de noviembre de 2026, pendiente de tu respuesta a Q3 de `IMPLEMENTATION_READINESS.md`).** En la 1B no hay registro estructurado de dolor: solo las observaciones libres y el motivo neutro «molestias» al saltar un ejercicio o terminar una serie, sin escala ni zona. Lo que sigue es el diseño para E4, que solo se aplicará tras la asesoría jurídica y regulatoria y con tu aprobación. Del dolor nunca se derivarán recomendaciones ni cambios automáticos del entrenamiento, en ninguna fase ni modo.

- **Finalidad:** avisar al profesional para que **él** decida. No es una valoración clínica, no genera diagnósticos y **no dispara ninguna regla automática**, ni siquiera preautorizada.
- **Cómo se pregunta:**
  - en la valoración previa: «¿Tienes alguna molestia o dolor hoy?» → No / Sí;
  - si responde «Sí»: zona (de la taxonomía de regiones corporales), lado, intensidad de 0 a 10 y una nota opcional;
  - también durante la sesión, en el ejercicio en el que aparece.
- **Escala:** numérica de 0 a 10 (0 = sin dolor, 10 = el peor dolor posible). Las escalas numéricas tienen mejor cumplimentación que otras y son aplicables en la mayoría de contextos, aunque las anclas varían entre estudios (Hjermstad et al., 2011). Los cambios clínicamente importantes se han estudiado en dolor crónico, en torno a 2 puntos o un 30 % (Farrar et al., 2001). **TrainPro no usa esos valores como umbrales**: solo explican que un cambio de 1 punto no tiene por qué ser relevante.
- **Mensaje fijo al cliente:** «Hemos avisado a tu entrenador. Si el dolor es intenso o va a más, detén el ejercicio y consulta con un profesional sanitario.»
- **Quién lo ve:** el propio cliente y los profesionales de su equipo asistencial con **alcance de salud** (con un solo profesional, el entrenador responsable). Nadie más; los accesos quedan registrados.
- **Protección:** dato de salud (categoría especial); minimización (sin diagnóstico ni texto libre obligatorio); no se exporta fuera de la ficha; borrado según la política de conservación de salud (`DATA_RIGHTS.md`).

## 5. Motor de adaptación

### 5.1 Entradas

- Valoración previa.
- Historial reciente: sesiones, cumplimiento, RIR/RPE reales y evolución de cargas.
- Rendimiento de sesiones anteriores en el mismo ejercicio.
- Restricciones individuales.
- Tipo de ejercicio y objetivo.
- Esquema de progresión asignado.

Todo con su procedencia.

### 5.2 Reglas

Cada regla tiene un **ámbito** (cliente, y ejercicio o bloque), una **condición**, una **acción**, unos **límites**, un **modo** y una **versión**.

- **Condiciones:** comparaciones sobre las entradas con valores que escribe el entrenador. Por ejemplo, «energía ≤ _X_ y recuperación ≤ _Y_», o «todas las series con RIR real ≥ objetivo + _Z_».
- **Acciones posibles:** mantener la progresión, no aplicar el incremento previsto, mantener la carga, reducir la carga (en kg o en %), modificar las repeticiones, ajustar el RIR objetivo, reducir series o sustituir por una **alternativa autorizada** (una lista que el entrenador define por ejercicio).
- **Límites:** cambio máximo por sesión. Las acciones automáticas nunca aumentan la exigencia por encima de lo planificado.
- **Conflictos entre reglas:** si las acciones afectan a campos distintos y son compatibles (por ejemplo, no aplicar el incremento y quitar una serie), se aplican todas. Si cambian el mismo campo, gana, **campo a campo, el valor de menor exigencia**: menos carga, menos series, menos repeticiones o un RIR objetivo más alto. Las demás se muestran en la explicación.

### 5.3 Modos (P-45)

| Modo                                   | Qué ocurre                                                                                                                      | Dónde se permite                                                                                                                                                                      |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Supervisado** (el único por defecto) | Se genera una recomendación; el entrenador la acepta, modifica o rechaza; el cliente ve la sesión cuando se decide              | Todas las reglas                                                                                                                                                                      |
| **Preautorizado**                      | El entrenador definió la regla y su acción de antemano; se aplica al momento (por ejemplo, antes de la sesión) y se le notifica | Solo acciones conservadoras (no aplicar el incremento, mantener, reducir carga o series, ajustar el RIR al alza, sustituir por una alternativa autorizada). **Nunca en readaptación** |
| Automático sin límites                 | No existe                                                                                                                       | —                                                                                                                                                                                     |

El modo preautorizado resuelve un problema práctico: la valoración previa se hace justo antes de entrenar, cuando el entrenador puede no estar disponible.

### 5.4 Explicación (lo que ve el entrenador)

> **Propuesta: no aplicar el incremento de +2,5 kg en la sentadilla trasera hoy.**
> **Por qué:** se cumple tu regla «Energía baja» (energía 3 ≤ 4 y recuperación 3 ≤ 4; valores fijados por ti el 2 de noviembre).
> **Datos:** valoración previa de hoy (autodeclarada); últimas 3 sesiones con RIR real 2, 2 y 1 (autodeclarado).
> **Regla:** «Energía baja» v2, preautorizada.
> **Evidencia:** decisión de diseño del entrenador. Las medidas subjetivas son sensibles a la carga de entrenamiento (Saw et al., 2016), pero estos ítems no están validados.
> **Limitaciones:** escalas subjetivas, sin línea base suficiente (6 registros).
> **Alternativas:** mantener el incremento; reducir una serie.

El cliente ve un texto sencillo: «Hoy mantenemos 80 kg, como tenía previsto Alex si llegabas con poca energía».

### 5.5 Registro de decisiones

Cada recomendación guarda:

- la **prescripción original**;
- la **respuesta subjetiva**;
- la **regla aplicada** (con versión);
- la **recomendación generada**, con su explicación;
- la **decisión del entrenador** (aceptada, modificada o rechazada), o «preautorizada»;
- la **prescripción finalmente ejecutada**, enlazada con las series registradas;
- quién, cuándo y desde qué versión.

Así se puede auditar y, más adelante, estudiar si las reglas funcionan.

### 5.6 Cuatro orígenes de un cambio (P-45, desarrollo)

| Origen                                          | Quién lo inicia                                        | Cuándo se aplica                                        | Aprobación                                                      | Registro (`prescription_change`)                                                      |
| ----------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **Decisión del cliente dentro de lo prescrito** | El cliente                                             | Al ejecutar (carga autoseleccionada, punto de un rango) | No es una adaptación: es ejecución                              | No es un cambio de la prescripción: se guarda en el registro de la ejecución          |
| **Modificación manual del entrenador**          | El entrenador                                          | Al publicar una versión nueva                           | Es la decisión del profesional                                  | Versión nueva, con autor, fecha, motivo opcional y diferencias (**1B**)               |
| **Recomendación supervisada**                   | El motor                                               | Cuando el entrenador la acepta o la modifica            | Obligatoria                                                     | Recomendación, explicación y decisión (**1C**)                                        |
| **Adaptación preautorizada**                    | El motor, con una regla que el entrenador aprobó antes | Al momento, por ejemplo tras la valoración previa       | La dio el entrenador al activar la regla, dentro de sus límites | Igual que la supervisada, con decisión «preautorizada» y aviso al entrenador (**1C**) |

Los cuatro orígenes comparten **un único modelo de cambio de prescripción**. En la 1B se registran los cambios manuales; en la 1C se añaden los dos del motor sin cambiar el modelo (P-63).

### 5.7 Qué puede hacer cada modo

✓ = permitido · ◐ = permitido con el límite que fija el entrenador · ✗ = prohibido

| Acción                                                            | Manual                      | Supervisada                                   | Preautorizada                                                                                      |
| ----------------------------------------------------------------- | --------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Aumentar la carga                                                 | ✓                           | ✓ (según el esquema)                          | ✗                                                                                                  |
| No aplicar el incremento previsto                                 | ✓                           | ✓                                             | ✓                                                                                                  |
| Mantener la carga                                                 | ✓                           | ✓                                             | ✓                                                                                                  |
| Reducir la carga                                                  | ✓                           | ✓                                             | ◐                                                                                                  |
| Elegir repeticiones dentro del rango prescrito                    | ✓                           | ✓                                             | ◐ solo hacia el extremo inferior                                                                   |
| Prescribir repeticiones fuera del rango                           | ✓                           | ✓                                             | ✗                                                                                                  |
| Quitar series                                                     | ✓                           | ✓                                             | ◐                                                                                                  |
| Añadir series                                                     | ✓                           | ✓                                             | ✗                                                                                                  |
| Cambiar el objetivo de RIR o RPE                                  | ✓                           | ✓                                             | ◐ solo hacia más reserva (RIR más alto, RPE más bajo)                                              |
| Alargar el descanso                                               | ✓                           | ✓                                             | ✓                                                                                                  |
| Acortar el descanso                                               | ✓                           | ✓                                             | ✗                                                                                                  |
| Sustituir el ejercicio                                            | ✓                           | ✓ solo por una alternativa autorizada         | ◐ solo por una alternativa autorizada; en potencia y pliometría, solo por una regresión autorizada |
| Quitar un ejercicio entero                                        | ✓                           | ✓                                             | ✗                                                                                                  |
| Cambiar la intención o el criterio de calidad                     | ✓                           | ✓                                             | ✗                                                                                                  |
| Mover la sesión de fecha                                          | ✓                           | ✗ (fuera de la 1C)                            | ✗                                                                                                  |
| Cualquier cambio en un cliente con un caso de readaptación activo | ✓ (profesional responsable) | Solo resumen informativo, sin proponer cargas | ✗                                                                                                  |
| Cualquier cambio motivado por un dolor registrado                 | ✓                           | ✗ (solo alerta)                               | ✗                                                                                                  |

### 5.8 Perfiles de autorregulación por contexto

Cada ejercicio prescrito se asocia a un **perfil**. El perfil fija qué señales se pueden usar y qué acciones se pueden preautorizar. **El entrenador no puede desbloquear lo que el perfil prohíbe.** TrainPro puede sugerir el perfil por las etiquetas del ejercicio (por ejemplo, «Pliometría»), pero el entrenador lo confirma, y sin perfil confirmado no se activan reglas preautorizadas.

| Perfil                                                     | Señales admitidas                                                                     | Preautorizable                                                                                      | Prohibido siempre                                                                      | Fundamento                                                                                                                                                  |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Fuerza máxima**                                          | RIR/RPE real, repeticiones logradas, 1RM estimado (si es válido), valoración previa   | No aplicar el incremento, reducir la carga ◐, quitar series ◐, RIR más alto ◐                       | Subir la carga automáticamente; llevar series al fallo como respuesta                  | RIR más preciso cerca del fallo y con pocas repeticiones (`EFFORT_AND_LOAD.md` §4.2); carga autorregulada equivalente a porcentajes (Hickmott et al., 2022) |
| **Fuerza general e hipertrofia**                           | Repeticiones frente al rango, RIR real, valoración previa                             | No aplicar el incremento, quitar series ◐, RIR más alto ◐, repeticiones hacia el mínimo del rango ◐ | Añadir series automáticamente                                                          | Progresar repeticiones o carga da resultados similares (Plotkin et al., 2022)                                                                               |
| **Potencia y velocidad**                                   | Valoración de calidad (P-37), velocidad medida si hay instrumento, valoración previa  | Quitar series o repeticiones ◐, alargar el descanso, no aplicar el incremento                       | Usar el RIR como señal principal; compensar con más repeticiones; rebajar la intención | El RIR no es fiable lejos del fallo (Helms et al., 2016); la calidad es el objetivo                                                                         |
| **Pliometría y aterrizajes**                               | Contactos, calidad del aterrizaje, valoración previa                                  | Quitar contactos ◐, sustituir por una regresión autorizada, alargar el descanso                     | Aumentar contactos, altura o intensidad automáticamente                                | Decisión de diseño conservadora: la carga de impacto la decide el profesional                                                                               |
| **Salud y población general** (incluidas personas mayores) | Valoración previa, RPE de la sesión, adherencia, RIR si la persona está familiarizada | No aplicar el incremento, quitar series ◐, RIR más alto ◐                                           | Aumentos automáticos                                                                   | Prioridad en la adherencia y la seguridad; decisión de diseño                                                                                               |
| **Readaptación**                                           | Solo informativo                                                                      | Nada                                                                                                | Cualquier adaptación del motor                                                         | Criterios definidos por el profesional (Ardern et al., 2016); riesgo regulatorio (`PRODUCT_STRATEGY.md` §6)                                                 |

### 5.9 Señales, calidad y línea base

Las reglas no leen datos sueltos, sino **señales** tipadas y con su calidad. Cada señal declara:

- de dónde sale y con qué procedencia;
- si tiene datos suficientes;
- su tipo («autodeclarada», «calculada», «estimada con margen»).

| Señal                                         | Definición                                              | Calidad mínima para usarla                             |
| --------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------ |
| Energía y recuperación frente a la línea base | Diferencia con la mediana de las últimas _K_ respuestas | _K_ respuestas previas (_K_ lo elige el entrenador)    |
| Cumplimiento de repeticiones                  | Repeticiones logradas ÷ objetivo, por serie             | Series registradas                                     |
| Diferencia de RIR                             | RIR real − RIR objetivo, por serie                      | RIR registrado y persona marcada como familiarizada    |
| Tendencia del 1RM estimado                    | Pendiente en las últimas _N_ exposiciones               | Ecuación verificada y _N_ exposiciones válidas         |
| Calidad en potencia                           | Valoraciones de calidad de la sesión                    | Valoración registrada                                  |
| Dolor registrado (E4, si se aprueba)          | Sí o no, con zona e intensidad                          | **Solo genera alertas; nunca es entrada de una regla** |

Si la calidad no se alcanza, la regla **no se dispara** y la explicación dice por qué («Faltan 3 valoraciones para tener línea base»).

### 5.10 Ámbitos de las reglas y precedencia

Una regla se puede definir para un **ejercicio** (o su rastro de progresión, P-62), un **bloque** de la sesión, un **objetivo** (las etiquetas de cualidades de la biblioteca), una **población** (el campo de población del cliente) o un **cliente**.

Si varias se aplican a la vez:

1. se aplican todas las que afectan a campos distintos;
2. si cambian el mismo campo, gana el valor de menor exigencia (§5.2);
3. las prohibiciones del perfil prevalecen siempre.

### 5.11 Simulación retrospectiva

Antes de activar una regla, el entrenador puede **simularla sobre el historial del cliente**: cuántas veces se habría activado y qué habría cambiado. Es descriptivo y no promete resultados. Sirve para elegir los valores con datos de esa persona, en lugar de con números arbitrarios.

### 5.12 Progresión prevista frente a real

- **Prevista:** las cargas y repeticiones publicadas en cada sesión del rastro de progresión, más las que el esquema proyecta si se cumple el criterio.
- **Real:** lo ejecutado en cada exposición (series de trabajo efectivas).
- **Métricas:**
  - diferencia por exposición (kg y repeticiones);
  - exposiciones en que se alcanzó lo previsto;
  - retraso de la progresión (exposiciones de diferencia);
  - recomendaciones aceptadas, modificadas y rechazadas;
  - tendencia del 1RM estimado, si existe.
- **Panel de evolución:** un gráfico por rastro de progresión, con la línea prevista y la real, las decisiones marcadas en la línea temporal y la etiqueta de procedencia. No se muestran correlaciones como si fueran causas.

### 5.13 Por qué no es un conjunto de condiciones arbitrarias

El riesgo de reglas como «puntuación baja → reducir un porcentaje fijo» se evita así:

1. **Sin valores por defecto.** Todo umbral lo escribe el entrenador.
2. **Señales relativas a la persona y con calidad mínima**, no números absolutos.
3. **Perfiles con prohibiciones** según el contexto.
4. **Simulación retrospectiva** antes de activar una regla.
5. **Explicación y etiqueta de evidencia** en cada recomendación.
6. **Registro de decisiones** y comparación entre lo previsto y lo real, para revisar si las reglas sirven.
7. **Reglas versionadas.** Cambiar una regla no reescribe el pasado.
8. **Una valoración aislada nunca basta** para reducir ni aumentar (§5.14).

### 5.14 La valoración aislada no basta para cambiar la carga

Salvaguarda añadida en la auditoría de preparación (7 de noviembre de 2026), pendiente de aprobación con P-45 y P-69:

- **Una valoración subjetiva aislada** (la valoración previa o el RPE de la sesión, sin otra señal) **como mucho impide el incremento previsto**: «mantener lo planificado sin progresar».
- **Nunca reduce ni aumenta por sí sola** la carga, las series ni las repeticiones.
- Para reducir hace falta, además, **otra señal de rendimiento** con calidad suficiente (por ejemplo, una diferencia de RIR en la exposición anterior, §5.9) o la **supervisión del entrenador**: en modo supervisado, la regla solo genera una recomendación que decide él.
- Se comprueba al guardar la regla: una regla preautorizada que reduce o aumenta con una valoración aislada como única señal no se puede guardar (criterio 1C-25 y escenario S-18 de `ROADMAP.md`).
- **Motivo:** los ítems sueltos no están validados (§4.2) y dependen del ánimo y de la costumbre de responder. Una sola respuesta no justifica cambiar lo que prescribió el profesional.

## 6. RPE de la sesión y carga interna

### 6.1 Magnitudes distintas

| Magnitud                     | Qué es                                                       | Unidad                    | Procedencia                |
| ---------------------------- | ------------------------------------------------------------ | ------------------------- | -------------------------- |
| **RIR de serie**             | Repeticiones en reserva estimadas al terminar una serie      | repeticiones              | `self_reported`            |
| **RPE de ejercicio o serie** | Esfuerzo percibido en una serie o ejercicio, con su escala   | puntos de la escala       | `self_reported`            |
| **RPE de la sesión**         | Esfuerzo global de la sesión completa                        | 0–10 (CR-10 modificada)   | `self_reported`            |
| **Carga externa**            | Lo realizado: series, repeticiones, kg, contactos, distancia | según la magnitud         | `direct` o `self_reported` |
| **Carga interna estimada**   | RPE de la sesión × duración en minutos                       | unidades arbitrarias (UA) | `calculated`               |

Según Impellizzeri et al. (2019), carga externa e interna son constructos distintos y no se suman ni se intercambian.

### 6.2 Escala y momento (P-48)

- **Escala:** CR-10 modificada por Foster et al. (2001). Una revisión encontró 36 estudios que validan el método con esa escala en distintos deportes, edades y niveles (Haddad et al., 2017).
- **En fuerza:** fiable (CCI 0,88) y capaz de distinguir intensidades (Day et al., 2004). Puede subestimar la media de los RPE de cada serie (Sweet et al., 2004). Por eso no se sustituyen entre sí.
- **Momento:** tradicionalmente, a los 30 minutos. Pero no hubo diferencias entre 5 minutos y 24 horas en ciclismo (Christen et al., 2016) ni entre 10 y 30 minutos en boxeo (Uchida et al., 2014). Christen et al. señalan que puede influir hacer o no vuelta a la calma.
- **Propuesta:** pedirlo **al terminar** la sesión, con la opción «Responder más tarde» durante 24 horas, y guardar los minutos transcurridos desde el final. Se pide **en todas las sesiones** salvo que el entrenador lo desactive para un cliente indicando el motivo.
- **Anclajes verbales:** pendientes de verificar en la fuente original antes de mostrarlos.

### 6.3 Carga interna (P-49)

- **Definición:** RPE de la sesión × duración (min), en UA. Es el método de Foster et al. (2001) tal como lo describen las revisiones; **la fórmula se verificará en el texto original** antes de registrarla.
- **Duración:** de «Empezar» a «Terminar», **sin las pausas** registradas.
- **Se muestran** tendencias individuales (sesión y semana) con su fórmula y versión, **sin inferir causalidad**.
- **No se calcula** el cociente de carga aguda:crónica ni ningún «riesgo de lesión». Se ha documentado que no hay evidencia para usarlo con ese fin, que es una métrica imprecisa (Impellizzeri et al., 2020) y que su cálculo convencional produce correlaciones espurias por acoplamiento matemático (Lolli et al., 2019, según su título).

### 6.4 Resumen operativo (P-48 y P-49)

| Aspecto          | RPE de la sesión                                                                                                              | Carga interna                                                                                              |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Qué es           | Esfuerzo global percibido de la sesión completa                                                                               | RPE de la sesión × duración                                                                                |
| Escala o fórmula | CR-10 modificada (Foster et al., 2001): enteros de 0 a 10                                                                     | `training.session-internal-load` 1.0.0, pendiente de verificar en el original                              |
| Anclas           | Solo las verificadas en el original. Mientras tanto, versión provisional con los extremos rotulados y marcada como tal (P-64) | —                                                                                                          |
| Momento          | Al terminar; «Responder más tarde» durante 24 h; se guardan los minutos transcurridos                                         | Se calcula cuando existen el RPE y la duración                                                             |
| Duración         | —                                                                                                                             | De «Empezar» a «Terminar», menos las pausas registradas, en minutos enteros                                |
| Unidad           | Puntos (0–10)                                                                                                                 | Unidades arbitrarias (UA = puntos × min)                                                                   |
| Procedencia      | `self_reported`                                                                                                               | `calculated`                                                                                               |
| Qué no se hace   | Convertirlo a RIR ni promediarlo con los RPE de las series                                                                    | Sumarla al tonelaje u otro volumen externo; calcular el cociente agudo:crónico; hablar de riesgo de lesión |
| Ejemplo          | RPE 7, recogido 30 min después                                                                                                | 52 min − 7 min de pausa = 45 min → 7 × 45 = **315 UA**                                                     |

## 7. Volumen: ampliaciones

Complementa `EFFORT_AND_LOAD.md` §10 y P-36:

- **Magnitudes:** series, repeticiones de fuerza, contactos (saltos y aterrizajes), lanzamientos, distancia, duración, tonelaje externo, lastre, asistencia, intensidad relativa, carga respecto al peso corporal y carga interna. Cada una por sesión y por semana, prescrita frente a ejecutada.
- **Por patrón de movimiento:** con los datos actuales. Se muestran **por separado** el recuento «solo patrón principal» y el «principal y secundarios». No se inventan pesos para los secundarios.
- **Por grupo muscular (E3, P-53):** requiere una taxonomía de músculos que hoy no existe. Se propone el recuento **fraccional**: serie directa = 1 e indirecta = 0,5. En un metaanálisis de 67 estudios fue el método de cuantificación con más respaldo relativo, y tanto el volumen como la frecuencia mostraron rendimientos decrecientes (Pelland et al., 2025). La relación dosis–respuesta entre series semanales e hipertrofia ya se había descrito (Schoenfeld et al., 2017). La clasificación directa o indirecta de cada ejercicio es una **heurística** curada por la administración, y se etiquetará así.

## 8. Etiquetas de evidencia de este documento

| Elemento                                         | Etiqueta                                         |
| ------------------------------------------------ | ------------------------------------------------ |
| Doble progresión, incrementos lineales           | Heurística o práctica profesional                |
| Autorregulación por RIR/RPE frente a porcentajes | Evidencia (equivalencia)                         |
| Periodización ondulante frente a lineal          | Evidencia (depende del nivel de entrenamiento)   |
| Ecuaciones de 1RM                                | Estimación (validez según ejercicio y población) |
| 1RM con RIR                                      | Estimación sin validar                           |
| Valoración previa (dos ítems)                    | Decisión de diseño; ítems no validados           |
| RPE de la sesión                                 | Evidencia (método validado)                      |
| Carga interna                                    | Cálculo (fórmula pendiente de verificar)         |
| Umbrales de las reglas                           | Decisión del entrenador                          |
| Recuento fraccional por músculo                  | Heurística respaldada por un metaanálisis        |

## 9. Riesgos

| Riesgo                                                    | Mitigación                                                                                     |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Reglas mal configuradas que bajen o suban la carga de más | Límites por sesión, modo supervisado por defecto, explicación y registro                       |
| Confundir escalas subjetivas con mediciones               | Etiqueta `self_reported`, sin puntuaciones compuestas, interpretación respecto a la línea base |
| Estimaciones del 1RM fuera de su rango                    | Reglas del §3.4 y margen visible                                                               |
| Falsa sensación de precisión en la carga interna          | Unidades arbitrarias, tendencias individuales, sin umbrales                                    |
| Automatización en readaptación                            | Prohibida (P-45)                                                                               |
| Carga para el cliente (preguntas)                         | Dos ítems y una pregunta, menos de 10 segundos, se pueden saltar                               |

## 10. Referencias

### Verificadas en PubMed (6 de noviembre de 2026)

- Ardern CL, et al. 2016 Consensus statement on return to sport from the First World Congress in Sports Physical Therapy, Bern. _Br J Sports Med_. 2016;50(14):853-64. doi:10.1136/bjsports-2016-096278. PMID 27226389.
- Christen J, Foster C, Porcari JP, Mikat RP. Temporal robustness of the session rating of perceived exertion. _Int J Sports Physiol Perform_. 2016;11(8):1088-1093. doi:10.1123/ijspp.2015-0438. PMID 26999454.
- Colquhoun RJ, et al. Comparison of powerlifting performance in trained men using traditional and flexible daily undulating periodization. _J Strength Cond Res_. 2017;31(2):283-291. doi:10.1519/JSC.0000000000001500. PMID 28129275.
- Day ML, McGuigan MR, Brice G, Foster C. Monitoring exercise intensity during resistance training using the session RPE scale. _J Strength Cond Res_. 2004;18(2):353-8. doi:10.1519/R-13113.1. PMID 15142026.
- Dorrell HF, Smith MF, Gee TI. Comparison of velocity-based and traditional percentage-based loading methods on maximal strength and power adaptations. _J Strength Cond Res_. 2020;34(1):46-53. doi:10.1519/JSC.0000000000003089. PMID 30946276.
- Foster C, et al. A new approach to monitoring exercise training. _J Strength Cond Res_. 2001;15(1):109-15. PMID 11708692.
- Graham T, Cleather DJ. Autoregulation by "repetitions in reserve" leads to greater improvements in strength over a 12-week training program than fixed loading. _J Strength Cond Res_. 2021;35(9):2451-2456. doi:10.1519/JSC.0000000000003164. PMID 31009432. **Resumen no disponible en PubMed: solo se cita el título.**
- Grgic J, et al. Effects of linear and daily undulating periodized resistance training programs on measures of muscle hypertrophy: a systematic review and meta-analysis. _PeerJ_. 2017;5:e3695. doi:10.7717/peerj.3695. PMID 28848690.
- Haddad M, et al. Session-RPE method for training load monitoring: validity, ecological usefulness, and influencing factors. _Front Neurosci_. 2017;11:612. doi:10.3389/fnins.2017.00612. PMID 29163016.
- Halperin I, et al. Accuracy in predicting repetitions to task failure in resistance exercise. _Sports Med_. 2022;52(2):377-390. doi:10.1007/s40279-021-01559-x. PMID 34542869.
- Harries SK, Lubans DR, Callister R. Systematic review and meta-analysis of linear and undulating periodized resistance training programs on muscular strength. _J Strength Cond Res_. 2015;29(4):1113-25. doi:10.1519/JSC.0000000000000712. PMID 25268290.
- Helms ER, et al. RPE vs. percentage 1RM loading in periodized programs matched for sets and repetitions. _Front Physiol_. 2018;9:247. doi:10.3389/fphys.2018.00247. PMID 29628895.
- Hickmott LM, et al. The effect of load and volume autoregulation on muscular strength and hypertrophy: a systematic review and meta-analysis. _Sports Med Open_. 2022;8(1):9. doi:10.1186/s40798-021-00404-9. PMID 35038063.
- Hooper SL, et al. Markers for monitoring overtraining and recovery. _Med Sci Sports Exerc_. 1995;27(1):106-12. PMID 7898325.
- Hopkins WG. Measures of reliability in sports medicine and science. _Sports Med_. 2000;30(1):1-15. doi:10.2165/00007256-200030010-00001. PMID 10907753.
- Impellizzeri FM, Marcora SM, Coutts AJ. Internal and external training load: 15 years on. _Int J Sports Physiol Perform_. 2019;14(2):270-273. doi:10.1123/ijspp.2018-0935. PMID 30614348.
- Impellizzeri FM, et al. Acute:chronic workload ratio: conceptual issues and fundamental pitfalls. _Int J Sports Physiol Perform_. 2020;15(6):907-913. doi:10.1123/ijspp.2019-0864. PMID 32502973.
- Jeffries AC, et al. Athlete-reported outcome measures for monitoring training responses: a systematic review of risk of bias and measurement property quality according to the COSMIN guidelines. _Int J Sports Physiol Perform_. 2020;15(9):1203-1215. doi:10.1123/ijspp.2020-0386. PMID 32957081.
- Farrar JT, et al. Clinical importance of changes in chronic pain intensity measured on an 11-point numerical pain rating scale. _Pain_. 2001;94(2):149-158. doi:10.1016/S0304-3959(01)00349-9. PMID 11690728.
- Hjermstad MJ, et al. Studies comparing Numerical Rating Scales, Verbal Rating Scales, and Visual Analogue Scales for assessment of pain intensity in adults: a systematic literature review. _J Pain Symptom Manage_. 2011;41(6):1073-93. doi:10.1016/j.jpainsymman.2010.08.016. PMID 21621130.
- Kölling S, et al. Validation of the Acute Recovery and Stress Scale (ARSS) and the Short Recovery and Stress Scale (SRSS) in three English-speaking regions. _J Sports Sci_. 2020;38(2):130-139 (en línea en 2019). doi:10.1080/02640414.2019.1684790. PMID 31696778. (Kölling et al., 2019)
- Kölling S, et al. Modification and applicability of questionnaires to assess the recovery-stress state among adolescent and child athletes. _Front Physiol_. 2019;10:1414. doi:10.3389/fphys.2019.01414. PMID 31824332. (Kölling et al., 2019b)
- Laurent CM, et al. A practical approach to monitoring recovery: development of a perceived recovery status scale. _J Strength Cond Res_. 2011;25(3):620-8. doi:10.1519/JSC.0b013e3181c69ec6. PMID 20581704.
- Lolli L, et al. Mathematical coupling causes spurious correlation within the conventional acute-to-chronic workload ratio calculations. _Br J Sports Med_. 2019;53(15):921-922. doi:10.1136/bjsports-2017-098110. PMID 29101104. **Editorial sin resumen: se cita el título.**
- Mann JB, et al. The effect of autoregulatory progressive resistance exercise vs. linear periodization on strength improvement in college athletes. _J Strength Cond Res_. 2010;24(7):1718-23. doi:10.1519/JSC.0b013e3181def4a6. PMID 20543732.
- Mayhew JL, et al. Muscular endurance repetitions to predict bench press strength in men of different training levels. _J Sports Med Phys Fitness_. 1995;35(2):108-13. PMID 7500624.
- Mayhew JL, et al. Accuracy of prediction equations for determining one repetition maximum bench press in women before and after resistance training. _J Strength Cond Res_. 2008;22(5):1570-7. doi:10.1519/JSC.0b013e31817b02ad. PMID 18714230.
- McLean BD, et al. Neuromuscular, endocrine, and perceptual fatigue responses during different length between-match microcycles in professional rugby league players. _Int J Sports Physiol Perform_. 2010;5(3):367-83. doi:10.1123/ijspp.5.3.367. PMID 20861526.
- McNair PJ, Colvin M, Reid D. Predicting maximal strength of quadriceps from submaximal performance in individuals with knee joint osteoarthritis. _Arthritis Care Res_. 2011;63(2):216-22. doi:10.1002/acr.20368. PMID 20890972.
- McNamara JM, Stearne DJ. Flexible nonlinear periodization in a beginner college weight training class. _J Strength Cond Res_. 2010;24(1):17-22. doi:10.1519/JSC.0b013e3181bc177b. PMID 20042923.
- Moesgaard L, et al. Effects of periodization on strength and muscle hypertrophy in volume-equated resistance training programs: a systematic review and meta-analysis. _Sports Med_. 2022;52(7):1647-1666. doi:10.1007/s40279-021-01636-1. PMID 35044672.
- Nickerson BS, et al. Evaluation of load-velocity relationships and repetitions-to-failure equations in the presence of male and female spotters. _J Strength Cond Res_. 2020;34(9):2427-2433. doi:10.1519/JSC.0000000000003731. PMID 32740290.
- Pelland JC, et al. The resistance training dose response: meta-regressions exploring the effects of weekly volume and frequency on muscle hypertrophy and strength gains. _Sports Med_. 2025 (publicado en línea el 4 de diciembre de 2025); 56(2):481-505. doi:10.1007/s40279-025-02344-w. PMID 41343037.
- Plotkin D, et al. Progressive overload without progressing load? The effects of load or repetition progression on muscular adaptations. _PeerJ_. 2022;10:e14142. doi:10.7717/peerj.14142. PMID 36199287. Varios autores pertenecen a una empresa con una app de autorregulación (Renaissance Periodization).
- Reynolds JM, Gordon TJ, Robergs RA. Prediction of one repetition maximum strength from multiple repetition maximum testing and anthropometry. _J Strength Cond Res_. 2006;20(3):584-92. doi:10.1519/R-15304.1. PMID 16937972.
- Ribeiro Neto F, et al. Validity of one-repetition maximum predictive equations in men with spinal cord injury. _Spinal Cord_. 2017;55(10):950-956. doi:10.1038/sc.2017.49. PMID 28485383.
- Saw AE, Main LC, Gastin PB. Monitoring the athlete training response: subjective self-reported measures trump commonly used objective measures: a systematic review. _Br J Sports Med_. 2016;50(5):281-91. doi:10.1136/bjsports-2015-094758. PMID 26423706.
- Schoenfeld BJ, Ogborn D, Krieger JW. Dose-response relationship between weekly resistance training volume and increases in muscle mass: a systematic review and meta-analysis. _J Sports Sci_. 2017;35(11):1073-1082. doi:10.1080/02640414.2016.1210197. PMID 27433992.
- Sweet TW, et al. Quantitation of resistance training using the session rating of perceived exertion method. _J Strength Cond Res_. 2004;18(4):796-802. doi:10.1519/14153.1. PMID 15574104.
- Uchida MC, et al. Does the timing of measurement alter session-RPE in boxers? _J Sports Sci Med_. 2014;13(1):59-65. PMID 24570606.
- Williams TD, et al. Comparison of periodized and non-periodized resistance training on maximal strength: a meta-analysis. _Sports Med_. 2017;47(10):2083-2100. doi:10.1007/s40279-017-0734-y. PMID 28497285.

Las referencias de RIR y RPE ya verificadas (Zourdos, Helms 2016 y 2017, Refalo, Hermann) están en `EFFORT_AND_LOAD.md` §12.

### Pendientes de verificar en la fuente original

- Las fuentes originales de las ecuaciones de §3.1 (salvo Reynolds et al., 2006).
- Los anclajes verbales de la CR-10 modificada y la fórmula de carga interna en Foster et al. (2001).
- Los anclajes de la escala PRS (Laurent et al., 2011), si se quisieran usar.
