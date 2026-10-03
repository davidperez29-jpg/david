# Motor de decisiones

> Fase 10. Implementa `MASTER_SPECIFICATION.md` §13 (motor de decisiones) y el caso del futbolista de §69 del encargo. Es la capa C de la arquitectura: **lee** la capa científica (A) y la de ejercicios (B), **propone** y **explica**. Nunca decide: el entrenador tiene la última palabra y cada decisión queda auditada.

## 1. Límites

- **Propone, no prescribe.** Cada resultado es una propuesta con estado: `proposed`, `accepted`, `accepted_with_changes`, `rejected`, `postponed` o `superseded`.
- **No diagnostica.** Con un cribado positivo solo dice «Requiere valoración por profesional sanitario» y limita las propuestas a baja intensidad.
- **No inventa números.**
  - Los umbrales del perfil (fuerza relativa, CMJ, sprint) **no tienen valor por defecto**. Mientras el centro no los fije, el motor lo dice («Reglas con parámetros sin definir») y usa la valoración manual del entrenador.
  - Si existe una referencia verificada aplicable al cliente (Fase 5), el motor la usa antes que la valoración manual.
- **Determinista.** Con los mismos datos y la misma versión de reglas, el resultado es el mismo. Cada ejecución guarda la huella de sus entradas (`inputHash`) y la versión de reglas.
- **Sin `eval`.** Las condiciones son un DSL en JSON con operadores cerrados, interpretado en `dsl.ts`.

## 2. Arquitectura

| Pieza | Dónde | Qué hace |
|---|---|---|
| DSL | `packages/domain/src/decision/dsl.ts` | `evaluate(expr, facts, params)` devuelve `{value, used, missing}`. Operadores: `and`, `or`, `not`, `==`, `!=`, `<`, `<=`, `>`, `>=`, `in`, `between`, `exists`, `var`, `param`, `trend`, `count_in_window`. `validateExpr` rechaza operadores y parámetros desconocidos. |
| Conocimiento | `packages/domain/src/decision/knowledge.ts` | Matriz objetivo → cualidades, métodos por cualidad, ranuras por método, rasgos del perfil y las **24 reglas por defecto** (nivel F, con sus afirmaciones y limitaciones). |
| Pipeline | `packages/domain/src/decision/engine.ts` | `runDecisionEngine(context, knowledge)`, puro y sin E/S. |
| Contexto y persistencia | `packages/application/src/decision.ts` | Construye el `ClientContext` desde la base de datos y la `KnowledgeSnapshot` desde las bibliotecas. Guarda ejecuciones y propuestas, y registra decisiones, rasgos manuales y versiones de reglas. |
| Interfaz | Pestaña «Necesidades» de la ficha · `Ajustes → Reglas del motor de decisión` | Ver §6. |

### Contexto (`buildDecisionContext`)

- Persona: edad, sexo, experiencia y años de entrenamiento.
- Objetivo principal y secundarios, con deporte.
- Disponibilidad y material.
- Datos de salud, **solo con consentimiento** (art. 9 RGPD): cribado, tolerancias y patrones restringidos. Sin consentimiento, el cribado es `unknown` y se anota como dato que falta.
- Métricas: último valor válido por test, el veredicto de cambio frente al MDC y la clasificación frente a una referencia aplicable.
- Fuerza relativa: 1RM de sentadilla / masa corporal.
- Respuesta: adherencia de 4 semanas, alerta de dolor abierta y sRPE alto.
- Rasgos manuales, poblaciones (para la aplicabilidad) y la lista de **datos que faltan**, por ejemplo «Sin evaluación de fuerza en 90 días».

## 3. Pipeline (§13.3)

| # | Etapa | Resultado |
|---|---|---|
| 1 | Hechos | Contexto normalizado que lee el DSL. |
| 2 | Cribado | `clear` / `caution` / `refer`, con sus motivos. |
| 3 | Perfil | Rasgos con su base: `threshold` (umbral del centro), `reference` (referencia verificada), `manual`, `change` o `unknown`. |
| 4 | Necesidades | Puntuación por cualidad: matriz del objetivo más los ajustes de las reglas, y dirección (`desarrollar`, `mantener`, `no prioritario`). |
| 5 | Priorización | Hasta N prioridades; N es el mínimo de las reglas que limitan (por defecto 3, por ejemplo 2 con adherencia baja). Sesiones por semana = redondeo(días × puntuación × 0,75). |
| 6 | Métodos | Métodos de las cualidades priorizadas, con exclusiones por reglas (cribado, principiantes, edad) y preferencias (por ejemplo, curl nórdico en deportes de equipo). |
| 7 | Ejercicios | Candidatos por ranura y patrón: filtra material, tolerancias y nivel, y ordena con sus motivos. Los excluidos aparecen con su razón. |
| 8 | Dosis | Rangos de las variables del método con afirmación aplicable a la población y una sugerencia (conservadora en principiantes). |
| — | Fase de introducción | Puntuación (§13.5) en lugar de una regla para todos: `ninguna`, `introducción breve` o `fase de adaptación`. |
| 9 | Plan | Plantilla según el objetivo y la frecuencia, y reevaluación cada N semanas. |
| 10 | Explicación | Cada elemento incluye su `Explanation` (§13.6). |

## 4. Explicación «¿Por qué?» (§13.6)

Cada necesidad, prioridad, método y propuesta de plan muestra estos apartados:

1. **DATOS**: valores concretos con fecha y umbral, por ejemplo «Fuerza relativa baja (sentadilla): sí — 1,31 ×PC frente al umbral del centro 1,5 ×PC».
2. **INTERPRETACIÓN**: qué significa para este objetivo.
3. **REGLA**: clave y versión, por ejemplo `needs.max_strength.relative_strength_low (v1)`.
4. **EVIDENCIA**: afirmaciones publicadas de la biblioteca científica con su confianza y sus fuentes con DOI o PMID (verificadas en PubMed en la Fase 4). Si no hay ninguna, lo dice: «recomendación práctica configurable (nivel F)».
5. **APLICABILIDAD**: coincide o no con la población de cada afirmación (`appliesTo` / `notFor`).
6. **LIMITACIONES**: las de la regla y las de la evidencia.
7. **CONFIANZA**: la más baja de la cadena.

## 5. Reglas como datos y control del entrenador (§13.4, §13.9)

- Las reglas viven en `rules`, agrupadas en versiones de `rule_sets`.
  - ADMIN las edita: activa o inactiva y parámetros numéricos. Al guardar se crea una versión nueva y la anterior pasa a `retired`; las reglas de alertas (Fase 8) se copian sin cambios.
  - El cambio se audita campo a campo.
  - Si el centro no ha guardado nada, se usan las reglas por defecto (versión 0).
- **Desactivar una regla para un cliente**: `PUT /clients/{id}/rule-overrides` (el mismo de la Fase 8) acepta ya las claves de decisión. Se aplica al recalcular.
- **Decidir una propuesta**:
  - aceptar;
  - aceptar con cambios: cada campo cambiado va a `manual_overrides` con el valor propuesto, el final y el motivo;
  - rechazar;
  - posponer: una propuesta pospuesta se puede decidir después.
- **Rasgos manuales** (`client_trait_flags`): la valoración del entrenador cuando no hay umbral ni referencia aplicable. Se puede quitar.
- **Métricas por regla**: propuestas decididas, rechazadas (con su %) y cambiadas, calculadas con `unnest(rule_keys)`. Sirven para detectar reglas mal calibradas; con ≥ 5 decisiones y ≥ 50 % de rechazos se resaltan.
- Recalcular sustituye las propuestas pendientes (`superseded`). Las decididas quedan como historial.

## 6. Interfaz

- **Ficha → Necesidades**, en este orden:
  1. Cálculo (fecha, versión de reglas, huella, datos que faltan, avisos, reglas pendientes con enlace para ADMIN).
  2. Cribado.
  3. Perfil con «Tu valoración: Sí / No / Quitar».
  4. Necesidades.
  5. Prioridades.
  6. Métodos y descartados.
  7. Ejercicios candidatos y excluidos.
  8. Dosis.
  9. Fase de introducción y propuesta de plan.
  10. Reglas desactivadas para el cliente, con «Reactivar».
  - Cada propuesta tiene «¿Por qué?» (un `<details>` nativo, que funciona con teclado y sin JavaScript) y las acciones Aceptar · Editar · Rechazar · Posponer · Desactivar regla para este cliente.
- **Ajustes → Reglas del motor de decisión**: reglas por dominio con descripción, nivel, evidencia, limitaciones, parámetros (en ámbar si están pendientes), la condición DSL y las métricas. Los entrenadores solo pueden leerlas.

## 7. Caso del futbolista (§69)

**Datos.** 22 años, intermedio, 3 días de 60 min. CMJ 31,2 cm, sprint de 10 m 1,74 s, 1RM 85 kg con 77 kg (1,1 ×PC), adherencia 92 %. Umbrales del centro: 1,5 ×PC, 35 cm y 1,85 s.

**Resultado:**

- P1 fuerza máxima (2 sesiones/semana).
- P2 potencia.
- Velocidad: «mantener».
- Métodos: fuerza máxima, curl nórdico, potencia y pliometría; sin PAPE.
- Dosis de fuerza máxima: 80–100 % 1RM.
- Plantilla `equipo-3d` y reevaluación cada 6 semanas.

**Cobertura en tests:**

- Unidad: golden test con la explicación completa.
- Integración: de extremo a extremo desde la base de datos.
- E2E: pantalla con DOI, rechazo y métricas.

**Demo.** Iker Arrieta tiene un 1RM reciente de 98 kg con 75 kg (1,31 ×PC). Su P1 es fuerza máxima, aceptada con cambios. El centro demo tiene fijados los umbrales de futbolista.

## 8. API

Ver `API.md` («Motor de decisiones»).

## 9. Pendiente

- Generar el plan a partir de la propuesta y la progresión semana a semana (Fase 11).
- Editor visual de condiciones (hoy se muestran en JSON; solo se editan parámetros y activación).
- Más rasgos y umbrales por población (por ejemplo, por sexo o categoría).
