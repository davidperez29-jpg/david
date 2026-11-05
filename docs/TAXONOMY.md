# Taxonomía de la biblioteca de ejercicios

Fuente de verdad en el código: `src/domain/library/taxonomy.ts`. Los **identificadores** (entre paréntesis) son estables y no se reutilizan. Los nombres visibles sí pueden cambiar.

## Principios

1. **Dimensiones independientes y combinables.** Etiquetas (en 4 categorías), patrones de movimiento, material, región corporal, ejecución, entorno y complejidad no dependen unas de otras.
2. **Varias etiquetas por dimensión.** Una variante puede tener varias cualidades, métodos, acciones musculares y aplicaciones a la vez.
3. **Clasificación real, no por el nombre.** Cada variante tiene su propia clasificación según su ejecución, carga, intención, velocidad, rango y acción muscular. Cuando depende del contexto, se explica en una nota (`classificationNote`). Las asignaciones del catálogo demo son ejemplos editables.
4. **Etiquetas globales y personales.** Las globales las gestiona la administración del catálogo. Cada entrenador puede crear las suyas, en categorías propias o del sistema. No se permiten duplicados: el nombre se compara sin tildes ni mayúsculas frente a las globales y a las propias.
5. **Archivar, no borrar.** Una etiqueta que se divide o renombra se archiva con `replacedBy`, y su id no se reutiliza.

## Etiquetas: cuatro dimensiones

### A. Cualidades y objetivos (`capacity`)

Potencia (`power`) · Fuerza explosiva (`explosive-strength`) · Fuerza máxima (`max-strength`) · Hipertrofia (`hypertrophy`) · Fuerza-resistencia (`strength-endurance`) · Fuerza general (`general-strength`) · Estabilidad (`stability`) · Core (`core`) · Coordinación (`coordination`) · Equilibrio (`balance`) · Control motor (`motor-control`)

### B. Métodos y formas de entrenamiento (`method`)

Pliometría (`plyometric`) · Contraste (`contrast`) · Entrenamiento oscilatorio (`oscillatory`) · Balístico (`ballistic`) · Intención de máxima velocidad (`max-velocity-intent`). Se pueden añadir métodos nuevos como etiquetas de esta categoría.

> Contraste y entrenamiento oscilatorio son, sobre todo, **formas de programar**: el contraste combina ejercicios en la sesión. Las etiquetas existen para marcar los ejercicios adecuados para ese uso, y en el catálogo demo no se asignan a ningún ejercicio para no forzar la clasificación.

### C. Acciones musculares y características de ejecución (`muscle-action`)

Concéntrico (`concentric`) · Excéntrico (`eccentric`) · Isométrico (`isometric`) · Ciclo estiramiento-acortamiento (`ssc`), cuando corresponda.

Se asignan cuando la acción **se enfatiza**: una pausa isométrica, una bajada lenta, un aterrizaje que frena el movimiento o un salto con contramovimiento. No se ponen todas a todos los ejercicios.

### D. Aplicaciones y evaluación (`application`)

Test o evaluación de 1RM (`one-rm-test`) · Trabajo con porcentajes de 1RM (`percent-1rm`).

> La antigua etiqueta «1RM» (`one-rm`) mezclaba una aplicación con las cualidades. Está **archivada**, sustituida por las dos anteriores, y la categoría «Control y estabilidad» (`control`) quedó archivada al integrarse en A.

## Patrones de movimiento

Cada variante tiene **un patrón principal** y, si procede, **patrones secundarios**. Solo se asignan subtipos, no grupos. Filtrar por un grupo incluye todos sus subtipos, y la opción «Solo patrón principal» excluye los secundarios.

| Grupo                                         | Subtipos                                                                                                                |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Empuje (`push`)                               | Horizontal · Vertical · Diagonal                                                                                        |
| Tracción (`pull`)                             | Horizontal · Vertical · Diagonal                                                                                        |
| Tren inferior (`lower`)                       | Dominante de rodilla · Dominante de cadera · Patrón mixto                                                               |
| Core y tronco: anti-movimiento (`trunk-anti`) | Anti-extensión · Anti-rotación · Anti-flexión lateral · Anti-flexión                                                    |
| Core y tronco: movimiento (`trunk-dynamic`)   | Extensión · Rotación · Flexión lateral · Flexión (del tronco)                                                           |
| Cadera: flexión y extensión (`hip-motion`)    | Flexión de cadera · Extensión de cadera                                                                                 |
| Locomoción (`locomotion`)                     | Carrera · Aceleración · Desaceleración · Cambio de dirección · Desplazamiento lateral · Desplazamiento multidireccional |
| Saltos (`jump`)                               | Vertical · Horizontal · Lateral                                                                                         |
| Aterrizajes (`landing`)                       | En el sitio · Hacia delante · Lateral · Multidireccional                                                                |
| Transporte de cargas (`carry`)                | Farmer carry · Suitcase carry · Front rack carry · Overhead carry                                                       |

### Conceptos que no se tratan como equivalentes

- **Dominante de cadera** (tren inferior) es un patrón global bajo carga, como la bisagra o el puente. **Flexión o extensión de cadera** es el movimiento de la articulación con el tronco estable. Por ejemplo, la elevación de piernas tumbado es flexión de cadera (principal) con anti-extensión del tronco (secundario), **no** flexión de tronco.
- **Anti-movimiento** (resistir) y **movimiento** (producir) del tronco son grupos distintos.
- **Unilateral o bilateral no es un patrón**: es la dimensión **Ejecución**. «Salto unilateral» se obtiene combinando «Saltos» con «Unilateral», y lo mismo con los aterrizajes. Así no se registra el mismo dato en dos dimensiones. La búsqueda por texto también lo entiende: «salto unilateral» encuentra los saltos con ejecución unilateral. _Pendiente de tu confirmación (P-12)._
- **Carrera** (patrón cíclico) y **aceleración** (fase de arranque) son subtipos distintos de Locomoción.

### Ejemplos del catálogo demo

| Variante                     | Principal            | Secundarios                                            |
| ---------------------------- | -------------------- | ------------------------------------------------------ |
| Salto con contramovimiento   | Salto vertical       | Aterrizaje en el sitio · Patrón mixto de tren inferior |
| Drop jump                    | Salto vertical       | Aterrizaje en el sitio                                 |
| Sentadilla frontal           | Dominante de rodilla | Anti-flexión                                           |
| Paseo de maleta              | Suitcase carry       | Anti-flexión lateral                                   |
| Cambio de dirección de 180°  | Cambio de dirección  | Desaceleración · Aceleración                           |
| Elevación de piernas tumbado | Flexión de cadera    | Anti-extensión                                         |

## Dimensiones complementarias

- **Material** (jerárquico): Peso corporal, Barra, Mancuernas, Kettlebell, Poleas, Máquinas, Bandas elásticas, Balón medicinal, Cajón y Otros materiales (Banco, Rack, Barra fija, Conos, Escalón, Pared).
- **Región corporal** (jerárquica): Tren superior (Hombro), Tren inferior (Cadera, Rodilla, Tobillo), Tronco y Cuerpo completo.
- **Ejecución**: Bilateral, Unilateral o Alternante.
- **Entorno**: Gimnasio, Campo, Domicilio u Otros (varios a la vez).
- **Complejidad**: Básica, Intermedia o Avanzada.

## Búsqueda

- **Texto por palabras**: cada palabra debe aparecer en algún dato del ejercicio (nombre, ejercicio principal, etiquetas, patrones, material, región, ejecución o entorno), sin distinguir tildes ni mayúsculas.
- **Modo Y (todos)**: cumple todos los filtros elegidos. **Modo O (alguno)**: cumple al menos uno. El texto siempre es obligatorio.
- **Filtros activos** visibles como chips, que se pueden quitar uno a uno o todos a la vez, junto al número de resultados.
- Ejemplos verificados con tests sobre el catálogo demo:
  - Potencia + Pliometría + Salto vertical (Y) → _Drop jump_ y _Saltos verticales continuos_.
  - Fuerza máxima + Dominante de rodilla (Y) → _Sentadilla trasera con barra_ y _Sentadilla frontal_.
  - Con O, los mismos filtros devuelven la unión: todo lo que cumple al menos uno.

## Niveles de ejercicios

| Nivel           | Quién lo gestiona                  | Quién lo ve                                                                                                              | Cómo se cambia                                                                                                               |
| --------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Catálogo global | Administración de TrainPro         | Todos los entrenadores                                                                                                   | Solo la administración. Un entrenador lo **adapta**: se crea una copia personalizada (`derivedFrom`) y el original no cambia |
| Personalizado   | El entrenador que lo crea o adapta | Ese entrenador (y sus clientes, a través de las sesiones). Preparado para compartirse con su equipo (`sharedWithTeamId`) | Su propietario                                                                                                               |
| Privado         | El entrenador que lo crea          | Solo ese entrenador                                                                                                      | Su propietario                                                                                                               |

Relaciones entre ejercicios, todas distintas:

- **Variante de** un ejercicio principal (familia).
- **Copia adaptada de** otra variante (`derivedFrom`).
- **Progresión o regresión** (arista dirigida).
