# Sistema científico y trazabilidad

> Cubre los §31–§35 del encargo. Parte de lo que ya existe (`SCIENTIFIC_FRAMEWORK.md`):
> - fuentes verificadas por DOI/PMID;
> - afirmaciones graduadas con su población;
> - métodos con evidencia;
> - control de calidad.

## 1. Qué debe poder indicar cada recomendación importante (§32)

| Campo | Ejemplo |
|---|---|
| Artículo, autores, año | Harøy J et al., 2019 |
| DOI / PMID | 10.1136/bjsports-2017-098937 · 29891614 |
| Población | Futbolistas varones semiprofesionales (35 equipos) |
| Qué respalda | Menor prevalencia de problemas inguinales con el Adductor Strengthening Programme |
| Tipo de evidencia | `reduccion_incidencia` (ensayo aleatorizado por clusters) |
| Limitaciones | Varones, fútbol, prevalencia autorreportada |
| Origen | `literatura_externa` |

**Prohibido inventar** artículos, DOI, PMID, resultados, tamaños de efecto o protocolos. Si no hay evidencia suficiente, la aplicación muestra **«Evidencia insuficiente / criterio práctico»**.

## 2. Tres orígenes, siempre distinguidos (§33)

| Origen | Qué es | Cómo se muestra |
|---|---|---|
| **Documento del usuario** | Contenido de los documentos aportados (rutinas, informes, hojas de evaluación) | «Fuente: documento del entrenador». Sus citas se marcan `citada_en_documento` hasta verificarlas |
| **Literatura externa** | Artículos encontrados y verificados en PubMed/DOI | «Fuente: autor, año · DOI» con el tipo de evidencia |
| **Propuesta práctica** | Criterio de trabajo sin respaldo publicado suficiente | «Criterio práctico», con su motivo |

**Los documentos del usuario se usan como fuente de ideas, estructura y contenido.**
- No se sustituyen por conocimiento general.
- Cuando no bastan, se busca en la literatura.
- Se anonimizan: no se guardan nombres de jugadores ni datos de salud reales.

| Documento | Qué aporta |
|---|---|
| Rutina de prevención de aductores | Bloques: movilidad dinámica, reeducación postural, fortalecimiento isométrico/excéntrico, integrado específico. Cada ejercicio con dosis, ejecución y silueta |
| Rutina de prevención de cuádriceps | Lo mismo, más «error a evitar» por ejercicio |
| Hoja de prevención individual de un jugador | Sesiones por zona según molestias declaradas; niveles N1/N2/N3 dentro de cada ejercicio; claves técnicas |
| Informe de rendimiento de un club | Datos brutos por intentos; reglas de agregación; fórmulas con constantes editables; Z frente al equipo con dirección; informe grupal; comparativa A/B con radar; ficha individual con bandas; referencias con APA y uso |
| Programa de fuerza en casa (PC leve) | Datos de la persona y lado afectado; registro de hasta 6 evaluaciones; comparador con nivel de referencia elegido (FT2/FT3); % de la referencia; umbral de cambio real por test; asistencia SÍ/NO con «¿Cómo fue?»; referencias con **nivel de verificación**; aviso de que no es un tratamiento |

## 3. Principio de evidencia (§34)

La aplicación diferencia el **cambio en un factor de riesgo** de la **reducción real de la incidencia lesional**:

| Si la evidencia demuestra… | La aplicación puede decir… | Nunca dice… |
|---|---|---|
| Menos lesiones en estudios de incidencia (ECA, metaanálisis) | «Reduce la incidencia de [lesión] en [población] (fuente)» | «Previene lesiones» sin población ni fuente |
| Mejora de una variable asociada al riesgo (fuerza excéntrica, asimetría, ROM) | «Mejora [variable], asociada a [lesión]; no demuestra que reduzca lesiones» | «Previene [lesión]» |
| Mecanismo o plausibilidad | «Justificación fisiológica; sin estudios de resultado» | Cualquier efecto clínico |
| Nada publicado suficiente | «Evidencia insuficiente / criterio práctico» | Una referencia que no lo respalda |
| Resultados contradictorios | «Evidencia contradictoria» con ambas fuentes, p. ej. isométricos y dolor en tendinopatía rotuliana: Rio et al., 2015 frente a Holden et al., 2020 | Solo la fuente favorable |

Lo aplica un validador (`knowledge_claims.evidence_kind`). Un texto con «previene» o «reduce el riesgo» enlazado a una afirmación que no es `reduccion_incidencia` se rechaza.

## 4. Búsquedas específicas, no genéricas (§31)

Cada módulo se construye con búsquedas por **objetivo, población, lesión, fase, método, test o criterio de progresión**. Cada búsqueda se registra en `science_searches`: consulta, filtros, fecha, resultados revisados y seleccionados, y motivo.

| Módulo | Ejemplos de búsqueda |
|---|---|
| Perfil hipertrofia | Dosis-respuesta del volumen, proximidad al fallo, frecuencia (metaanálisis) |
| Adulto mayor | Guías de entrenamiento de fuerza y potencia en mayores; equilibrio y caídas |
| PC leve | Recomendaciones de ejercicio en parálisis cerebral; fiabilidad de tests funcionales en PC |
| LCA | Criterios de vuelta tras reconstrucción; fuerza de cuádriceps; hop tests |
| Isquiosurales | Criterios de RTP; ejercicio nórdico e incidencia |
| Tobillo | Consenso de RTS en esguince lateral; inestabilidad crónica |
| Aductores | Programas de fortalecimiento e incidencia/prevalencia; criterios tras lesión aguda |

Las búsquedas se hacen con la herramienta de PubMed. **Solo entra lo que tiene metadatos verificados** (título, autores, revista, año, DOI y/o PMID).

**Búsquedas de la fase 3** (plantillas iniciales, verificadas en PubMed el 05/10/2026; `seed-data/evidence/templates_profiles.json`):

| Tema | Fuentes | Método que respaldan |
|---|---|---|
| Equilibrio en mayores y caídas | Lesinski 2015 ([10.1007/s40279-015-0375-y](https://doi.org/10.1007/s40279-015-0375-y)); Sherrington 2019, Cochrane ([10.1002/14651858.CD012424.pub2](https://doi.org/10.1002/14651858.CD012424.pub2)) | `equilibrio-mayores` |
| Fuerza en parálisis cerebral | Verschuren 2016 ([10.1111/dmcn.13053](https://doi.org/10.1111/dmcn.13053)); Merino-Andrés 2021 ([10.1177/02692155211040199](https://doi.org/10.1177/02692155211040199)); Ryan 2017, Cochrane ([10.1002/14651858.CD011660.pub2](https://doi.org/10.1002/14651858.CD011660.pub2)) | `fuerza-paralisis-cerebral` (evidencia contradictoria: se dice así) |

`actividad-fisica-oms` cita las guías de la OMS 2020, que ya estaban verificadas. Se añadieron al catálogo:
- la población `cerebral_palsy`, solo como contexto clínico;
- el resultado `falls`.

## 5. Estado de verificación

| Estado | Significado |
|---|---|
| `verificada` | Metadatos obtenidos de PubMed o del DOI en la fecha indicada |
| `citada_en_documento` | Aparece en un documento del usuario; pendiente de verificar |
| `no_verificable` | No se encontró registro; no se usa como respaldo |

**Referencias del documento del club** (verificadas en PubMed el 06/10/2026, `seed-data/evidence/club_references.json`):

| Cita del documento | Resultado |
|---|---|
| Reilly 2009 | Verificada · PMID 19301213 · [10.1055/s-0029-1202353](https://doi.org/10.1055/s-0029-1202353) |
| Bernal-Orozco (sin año) | Verificada como **correspondencia probable** (su único artículo de antropometría deportiva indexado, 2020) · PMID 32058363 · [10.1519/JSC.0000000000003416](https://doi.org/10.1519/JSC.0000000000003416) |
| Haugen 2013 | Verificada (coincide por tema; publicada en línea en 2012) · PMID 22868347 · [10.1123/ijspp.8.2.148](https://doi.org/10.1123/ijspp.8.2.148) |
| Haugen & Buchheit 2016 | Ya estaba en el catálogo (PMID 26660758) |
| Buchheit 2008 | Ya estaba en el catálogo (PMID 18550949) |
| Buchheit & Rabbani 2014 | Verificada · PMID 23475226 · [10.1123/ijspp.2012-0335](https://doi.org/10.1123/ijspp.2012-0335). PubMed la clasifica como ensayo aleatorizado, pero el resumen describe un solo grupo pre-post: se registra como no aleatorizado |
| Badby 2025 | Verificada · PMID 40643226 · [10.1080/02640414.2025.2523671](https://doi.org/10.1080/02640414.2025.2523671) (CMJ, salto con rebote e IMTP) |
| McMahon 2022 | Verificada como correspondencia probable (bandas T con semáforo, rugby league) · PMID 36433265 · [10.3390/s22228669](https://doi.org/10.3390/s22228669) |
| Garrido-Chamorro 2012 | **No verificable**: no hay registro de 2012 en PubMed |
| Marfell-Jones 2006 (ISAK) | **No verificable**: manual, no indexado |
| Faulkner 1968 y Yuhasz 1974 | **No verificables**: capítulo de libro y tesis, no indexados |
| Nikolaidis 2016 | **No verificable**: dos candidatos posibles en PubMed y la cita no permite elegir |
| Flanagan & Comyns 2008 | **No verificable**: Strength Cond J no está indexada de forma sistemática |

Las no verificables se guardan con `verificationStatus = unverifiable`, sin DOI ni PMID inventados, con el documento que las cita, y **nunca respaldan nada**. Las 31 búsquedas hechas para verificarlas están en Ciencia → Búsquedas.

**Referencias del documento del club, por verificar en la fase 9** (lista original):
- Garrido-Chamorro 2012, Bernal-Orozco, Reilly 2009, Marfell-Jones 2006 (ISAK), Faulkner 1968 y Yuhasz 1974 (ecuaciones);
- Haugen 2013, Haugen & Buchheit 2016 (sprint);
- Nikolaidis 2016, Badby 2025 (CMJ e IMTP);
- Buchheit 2008, Buchheit & Rabbani 2014 (30-15 IFT);
- Flanagan & Comyns 2008 (RSI) y McMahon 2022 (bandas Z).

Ya verificadas el 05/10/2026: Bishop 2018 y Read 2021 (`INJURY_MODULE.md` §9).

**Referencias del programa de PC leve**:
- el propio documento indica su nivel de verificación por cita;
- se importan con ese nivel y se reverifican en la fase 9.

## 6. Interfaz

- **La ciencia aparece donde se usa**: un icono «Fuente» junto al ejercicio, el test, la referencia, el criterio de fase o la recomendación. Abre la ficha con los campos del §1.
- **«Ciencia»** (menú de usuario) es una **consulta**: buscar fuentes y afirmaciones, ver qué respalda cada una. El control de calidad y la importación quedan en Ajustes (ADMIN).

## 7. Implementación (reestructuración, fase 9)

- **Tipo de evidencia** (`knowledge_claims.evidence_kind`) y **origen** (`origin`).
  - El seed lo toma del curador o lo deduce de lo que midieron los hallazgos que la respaldan: si midieron incidencia (lesiones, relesiones, caídas), es reducción de incidencia; si midieron rendimiento, rendimiento; si midieron biomecánica, asimetría o movilidad, factor de riesgo.
  - Una afirmación que diga «reduce el riesgo / la incidencia de lesiones» sin evidencia de incidencia se rechaza al crearla o editarla, y es un error del control de calidad.
- **Verificación**: `citada en documento` y `no verificable` se suman a `verificada`. Solo una fuente verificada aparece como respaldo, en las fichas, en el «¿Por qué?» de las recomendaciones y en los criterios de readaptación.
- **Búsquedas** (`science_searches`): Ciencia → **Búsquedas**, con la consulta exacta, la fecha, los resultados revisados, las fuentes elegidas y el motivo. El centro puede registrar las suyas. El registro empieza en esta fase; las búsquedas anteriores están descritas en el §4.
- **Icono «Fuente»** (ⓘ): junto a los criterios y el protocolo de readaptación, las referencias de un ejercicio, la evidencia de las dosis de una plantilla y las fuentes de un test. Abre la ficha del §1. En el «¿Por qué?» de las recomendaciones se añaden el tipo de evidencia, la población y las limitaciones.
