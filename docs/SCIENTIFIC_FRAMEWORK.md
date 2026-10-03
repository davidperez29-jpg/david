# Biblioteca científica

> Fase 4. Capa A de la arquitectura (`MASTER_SPECIFICATION.md` §4.2 y §10). Guarda **qué dice la evidencia, con qué fuerza y para quién**. No prescribe nada por sí sola: el motor de decisiones (Fase 9) la usará para proponer y explicar, y **el entrenador decide**.

## 1. Modelo y trazabilidad

```
Método ──(variables de dosis · notas)──▶ Afirmación ──(apoya / contradice / contexto)──▶ Hallazgo ──▶ Fuente
                                          nivel A–H                                      cita literal    DOI · PMID · verificación
Ejercicio ──(exercise_method_links, solo por id)──▶ Método
```

| Elemento | Tabla | Qué contiene |
|---|---|---|
| Fuente | `evidence_sources` | Datos bibliográficos copiados del registro, diseño, población, resultados, limitaciones y aplicación práctica. Incluye la verificación: estado, acceso (resumen o texto completo), método, fecha y autor, y correcciones. |
| Hallazgo | `evidence_findings` | Un resultado en una población y un desenlace. Incluye intervención, comparador, efecto e IC (**solo si aparecen literalmente en la fuente**), la **cita literal**, la justificación de la gradación y el nivel calculado. |
| Afirmación | `knowledge_claims` + `claim_evidence` | Texto nuestro, tipo epistémico (hecho, inferencia, hipótesis u opinión), confianza, limitaciones, poblaciones a las que se aplica y no se aplica, hallazgos con su papel, y nivel calculado. |
| Método | `methods`, `method_variables`, `method_notes`, `method_evidence` | Definición, resúmenes para entrenador y cliente, notas (mecanismo, indicación, precaución, progresión, limitación) y variables de dosis. Cada nota y cada variable puede citar una afirmación. |
| Revisión | `evidence_reviews` | Lista de control del QA científico (§10.6) con resultado y notas. |

La interfaz `/app/science/methods/{id}` muestra la cadena completa. Para cada variable de dosis enseña:
- la afirmación que la justifica, con su nivel y sus limitaciones;
- los hallazgos, con su cita literal;
- la fuente, con enlaces a DOI y PubMed y el estado de verificación.

Si una nota no cita ninguna afirmación, se muestra como **recomendación práctica (F) u opinión (G)**.

## 2. Niveles A–H: calculados, nunca tecleados (§10.4)

`gradeFinding` (`packages/domain/src/science/grading.ts`) parte del diseño y baja un nivel por cada motivo serio. Los motivos son los de la gradación de la certeza de la evidencia: riesgo de sesgo, inconsistencia, evidencia indirecta, imprecisión y sesgo de publicación.

| Diseño | Nivel de partida |
|---|---|
| Revisión sistemática, metaanálisis, revisión paraguas | A |
| Guía, posicionamiento o consenso **basado en una revisión sistemática** | A (si no, F) |
| Ensayo aleatorizado | B |
| Ensayo no aleatorizado, cohortes, transversal, serie de casos | C |
| Estudio mecanístico | E |
| Revisión narrativa, opinión, libro, web | G |

Reglas de cálculo:
- **Descensos:** A→B→C; el nivel nunca baja de C por los descensos.
- **Resultados contradictorios** dentro de la fuente → D.
- **Fuente sin verificar** → H, sea cual sea el diseño.
- **Nivel de la afirmación:** el mejor hallazgo que la apoya. Pasa a D si un hallazgo contrario de nivel C o superior está a un nivel o menos del mejor apoyo. Sin apoyo, H.

Los niveles se recalculan automáticamente cuando:
- se verifica una fuente o se cambian sus datos bibliográficos (esto la devuelve a «sin verificar»);
- se añaden o borran hallazgos;
- se cambian los hallazgos de una afirmación.

La interfaz nunca muestra la letra sola: siempre la acompaña su significado («B · Evidencia moderada») y la explicación de la gradación.

## 3. Control de calidad científico (§10.6)

`packages/domain/src/science/qa.ts`. Los **errores** bloquean la publicación; los **avisos** los revisa una persona.

| Comprobación | Severidad |
|---|---|
| DOI o PMID con formato no válido | error |
| Fuente verificada sin fecha o sin método de verificación | error |
| Artículo retractado | error |
| Afirmación sin hallazgos que la apoyen | error |
| Afirmación apoyada en una fuente no verificada | error |
| Lenguaje causal o absoluto («previene», «garantiza», «cura», «reduce a la mitad»…) | error |
| Afirmación publicada con nivel H | error |
| Fuente verificada sin DOI ni PMID | aviso |
| Sin población descrita o sin cita literal | aviso |
| Una cifra del hallazgo no aparece en la cita | aviso |
| La afirmación se aplica a poblaciones que los hallazgos no estudiaron (extrapolación) | aviso |

Además, `assessApplicability` (`applicability.ts`) compara a una persona con la población de un estudio (edad, sexo, nivel de entrenamiento y deporte) y devuelve avisos legibles. Ejemplo: «Estudio realizado en "Adultos mayores…", pero se aplica a una persona de 22 años.» El motor de decisiones lo usará en la Fase 9.

**Revisión humana.** La lista de control tiene seis puntos:
1. las cifras coinciden con la fuente;
2. se respeta la población;
3. no presenta correlación como causalidad;
4. no presenta un mecanismo como resultado clínico;
5. no presenta la prevención de lesiones como un hecho;
6. está registrada la evidencia contraria.

Solo se puede **aprobar** con los seis puntos cumplidos.

## 4. Flujo y permisos

| Acción | ADMIN | TRAINER | CLIENT |
|---|---|---|---|
| Consultar (`science:read`) | ✔ | ✔ | ✗ |
| Crear y editar fuentes, hallazgos, afirmaciones y métodos (`science:write`) | ✔ | ✔ | ✗ |
| Verificar fuentes, revisar y publicar (`science:publish`) | ✔ | ✗ | ✗ |
| Enlazar ejercicio ↔ método (`library:write`) | ✔ | ✔ | ✗ |

Reglas de flujo:
- **Afirmaciones:** borrador → revisada → publicada → obsoleta. Editar una afirmación publicada la devuelve a borrador.
- **Métodos:** solo se publican con una definición y con **todas** las variables de dosis justificadas por una afirmación.
- **Contenido global** (`organization_id NULL`): es de solo lectura para las organizaciones. Las organizaciones solo ven su propio contenido y el global (RLS de tipo `catalog`); el de otra organización devuelve 404.

## 5. Contenido inicial verificado

### 5.1 Cómo se construyó
Las búsquedas se hicieron en **PubMed** con el conector NCBI, en cuatro bloques:
- fuerza e hipertrofia;
- potencia, velocidad y métodos;
- salud, movilidad y resistencia;
- las referencias citadas en los documentos aportados (Excel y manual de resistencias acomodadas).

Para cada fuente se copiaron del registro de PubMed (con el año de publicación del registro) el título, los autores, la revista, el año, el DOI y el PMID. Los hallazgos usan citas **literales** del resumen, y las cifras solo se registran si aparecen en él. Los datos están en `seed-data/evidence/*.json` (formato: `seed-data/evidence/SCHEMA.md`).

**Comprobación independiente.** Antes de importar se verificó contra PubMed una muestra aleatoria de 12 fuentes. Los 12 casos coincidían en DOI, año y título, y todas las citas aparecían literalmente en el resumen. Algunas de las fuentes comprobadas, según PubMed:

| Fuente | DOI |
|---|---|
| Lauersen et al., 2013 (Br J Sports Med) | [10.1136/bjsports-2013-092538](https://doi.org/10.1136/bjsports-2013-092538) |
| Orssatto et al., 2020 (Appl Physiol Nutr Metab) | [10.1139/apnm-2020-0021](https://doi.org/10.1139/apnm-2020-0021) |
| Oliver et al., 2023 (Sports Med) | [10.1007/s40279-023-01944-8](https://doi.org/10.1007/s40279-023-01944-8) |
| Jiménez-Reyes et al., 2019 (PLoS One) | [10.1371/journal.pone.0216681](https://doi.org/10.1371/journal.pone.0216681) |
| Nimphius et al., 2016 (J Strength Cond Res) | [10.1519/JSC.0000000000001421](https://doi.org/10.1519/JSC.0000000000001421) |
| Sanchez-Sanchez et al., 2024 (Sports Med Open) | [10.1186/s40798-024-00720-w](https://doi.org/10.1186/s40798-024-00720-w) |
| Thorborg et al., 2017 (Br J Sports Med) | [10.1136/bjsports-2016-097066](https://doi.org/10.1136/bjsports-2016-097066) |
| Sole et al., 2018 (Sports) | [10.3390/sports6040133](https://doi.org/10.3390/sports6040133) |
| Rønnestad y Mujika, 2013 (Scand J Med Sci Sports) | [10.1111/sms.12104](https://doi.org/10.1111/sms.12104) |
| Xu et al., 2026 (PeerJ) | [10.7717/peerj.20644](https://doi.org/10.7717/peerj.20644) |
| Faigenbaum et al., 2009 (J Strength Cond Res) | [10.1519/JSC.0b013e31819df407](https://doi.org/10.1519/JSC.0b013e31819df407) |
| Lloyd et al., 2013 (Br J Sports Med) | [10.1136/bjsports-2013-092952](https://doi.org/10.1136/bjsports-2013-092952) |

### 5.2 Resultado de la importación
`pnpm db:seed` y `pnpm db:reset` ejecutan `seedEvidence` (`packages/db/src/seed/evidence.ts`).

| Elemento | Cantidad |
|---|---|
| Fuentes (deduplicadas por PMID/DOI) | 135, todas con PMID; 134 verificadas y 1 retractada |
| Hallazgos | 218 |
| Afirmaciones | 80, de las cuales 79 publicadas |
| Métodos | 23, todos publicados |

| Nivel de las afirmaciones | A | B | C | D | E | F | G | H |
|---|---|---|---|---|---|---|---|---|
| Número | 6 | 15 | 44 | 5 | 6 | 2 | 1 | 1 |

Lectura de la tabla:
- **C es el nivel más frecuente.** La mayoría de los hallazgos bajan por evidencia indirecta (poblaciones o protocolos distintos) o por imprecisión. Es lo esperable en ciencias del deporte.
- **Las afirmaciones D son contradicciones registradas a propósito:**
  - la frecuencia de entrenamiento;
  - la pliometría según la maduración;
  - la analgesia isométrica en la tendinopatía;
  - la magnitud del efecto preventivo del Nordic;
  - la individualización por el perfil fuerza-velocidad.
- **La afirmación H** (fórmulas de estimación del 1RM por repeticiones: Epley, Brzycki, O'Connor y LeSuer) queda en **borrador**, porque esas fuentes no están en PubMed.
- **Retracción:** el metaanálisis de Soria-Gila et al. (2015) sobre resistencia variable consta como **retractado** (PMID 25968227). No apoya ninguna afirmación y aparece como error en el informe de QA.

La importación es **idempotente**. Usa como claves la de la fuente (o su PMID/DOI), `tema:clave` para los hallazgos, la clave de la afirmación y el *slug* del método. Una afirmación solo se publica si el QA no da errores. Un método solo se publica si todas sus variables citan afirmaciones publicadas.

### 5.3 Catálogo de métodos (§10.7)
Hay 23 métodos, entre ellos:
- fuerza máxima, hipertrofia, fuerza en mayores, dosis mínima y potencia;
- pliometría, PAPE/complex/contrast, halterofilia, isométricos, excéntricos/flywheel y Nordic;
- sprint, COD/agilidad y resistencia variable;
- VBT, RIR/RPE y perfil fuerza-velocidad;
- estiramientos/movilidad, core, concurrente, RSA, programas preventivos y fuerza en jóvenes.

Solo se incluyen **variables de dosis** cuando una afirmación contiene ese rango; por ejemplo:
- ≥80 % 1RM para la fuerza máxima;
- 70–79 % 1RM y 2–3 × 7–9 en mayores sanos;
- 30–70 % 1RM para la potencia;
- 20 % de pérdida de velocidad;
- 7–10 min de recuperación en la potenciación.

Todo lo demás figura como nota práctica (F), sin cifras.

### 5.4 Correcciones a los documentos aportados
La comprobación encontró **28 correcciones** a referencias de los Excel y del manual: DOIs ausentes o erróneos, valores que no figuran en el resumen y años. También identificó **19 referencias no localizables en PubMed**, que no se han incorporado. El detalle está en `docs/research/evidence_seed_report.md`.

## 6. Lo que esta capa no hace
- No diagnostica. Las poblaciones clínicas (tendinopatía) se muestran solo como contexto. Ante dolor, lesión o síntomas: **requiere valoración por profesional sanitario**.
- No presenta la prevención de lesiones como un hecho: «se asocia a menos lesiones en…», «puede reducir…».
- No genera cifras: todo número procede de una cita literal o de una afirmación que lo contiene.

## 7. Pendiente

| Elemento | Fase |
|---|---|
| Revisión humana experta (lista de control) de las 79 afirmaciones globales publicadas por la importación | Operación (D1) |
| Lectura del texto completo de las fuentes que solo se consultaron por el resumen (casi todas) | Operación |
| Uso de afirmaciones y aplicabilidad en el motor de decisiones | 9 |
| Base de tests de evaluación con valores de referencia verificados | 5 |
| Alertas de retracción y revisión periódica de fuentes | 15 |
