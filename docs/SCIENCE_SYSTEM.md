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

**Referencias del documento del club, por verificar en la fase 9**:
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
