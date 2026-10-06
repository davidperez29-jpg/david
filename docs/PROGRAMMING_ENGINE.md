# Motor de programación

> Fase 11. Implementa `MASTER_SPECIFICATION.md` §12.2 (puntos 5 y 6 y la regla dura) y §12.7 (progresión).
>
> - Lo que hace: genera **propuestas de plan** a partir del motor de decisiones (`DECISION_ENGINE.md`) y **propuestas de ajuste** semana a semana según la respuesta del cliente.
> - La estructura de planes, las plantillas y el editor se describen en `PLANNING.md` (Fase 6).

## 1. Regla dura

**Ningún proceso automático modifica un plan activo.**

- Todo lo que calcula el motor se guarda como `recommendations`.
- El entrenador las acepta una a una o en bloque.
- Al aceptarlas se aplican solo a sesiones **futuras y sin registrar**, con una **revisión del plan** y **auditoría** campo a campo.
- Si un valor cambió a mano desde la propuesta, no se sobrescribe: se omite.
- Si no queda nada aplicable, se responde `409` («recalcula los ajustes»).

La única excepción es la opción por cliente **«Aplicar las progresiones de carga rutinarias sin confirmación»**:

- Está **desactivada por defecto**.
- Solo cubre progresiones de carga; nunca descargas ni sustituciones.
- Cada cambio se audita con el rol `SYSTEM`.
- Se puede **deshacer**.

Lo comprueba un test de integración. El registro de series, la evaluación tras cada sesión, el trabajo diario, la generación de propuestas de plan y el motor de decisiones dejan intacto el plan activo.

## 2. Propuesta de plan (§12.2.5)

`POST /clients/{id}/plan-proposals` funciona así:

1. Toma la última ejecución del motor de decisiones. Si no hay ninguna, la ejecuta.
2. Elige la plantilla que propuso el motor (`planSkeleton.templateSlug`), o la que indique el entrenador.
3. La adapta con `adaptTemplate` (dominio, puro):
   - **Fase de introducción** según la puntuación de §13.5: `ninguna` → 0 semanas, `introducción breve` → 1, `fase de adaptación` → 2. Las semanas de descarga y de test de la plantilla se mantienen.
   - **Sustituciones**: un ejercicio que el motor excluyó para este cliente (no tolerado o sin material) se cambia por el mejor candidato del mismo patrón, con la misma prescripción.
   - **Notas** en lenguaje claro sobre qué se adaptó y por qué (`training_plans.generation_notes`). Se muestran en la propuesta.
4. Materializa el plan como `kind = PROPOSAL` y `status = proposed`, con fechas y conversión de %1RM a kg. Lo enlaza con la recomendación `plan_proposal` y con el plan activo (`proposal_of_plan_id`).

Después:

- **Editar**: como cualquier plan, con el editor de la Fase 6.
- **Aceptar** (`POST /plans/{id}/proposal/accept`), siempre por decisión del entrenador:
  - `mode: draft` (por defecto): pasa a `CLIENT_PLAN` en borrador. La recomendación queda `accepted`. El plan activo no cambia: activar el nuevo es una decisión aparte.
  - `mode: revision` (fase 13 de la reestructuración): se aplica al plan activo para el que se propuso.
    - Sus sesiones desde hoy sustituyen a las sesiones futuras **sin registrar** del plan activo; lo ya registrado no se toca.
    - Cada sesión va a la semana del plan activo que contiene su fecha. Las fechas fuera de esas semanas, o en un día con una sesión ya registrada, no se copian y se cuentan.
    - Las copias se publican si las sesiones sustituidas lo estaban.
    - Queda una nueva **revisión** del plan activo («Propuesta del motor aplicada…»), auditada.
    - La propuesta se archiva y la recomendación queda `accepted`.
    - `409` si la propuesta no se generó sobre un plan activo o ese plan ya no está activo; `422` si no hay nada que aplicar.
- **Descartar**: queda `archived` y la recomendación `rejected`.
- Una propuesta **no se puede activar** (`409`); como solo se publican sesiones de planes activos, tampoco llega al cliente.
- Con **cribado positivo** no se genera un plan completo: «Requiere valoración por profesional sanitario».

## 3. Propuestas de ajuste (§12.7, §13.7)

`proposeAdjustments` (dominio, puro y determinista) recibe:

- las sesiones futuras sin registrar del plan activo;
- el historial de 28 días por ejercicio (el RIR no informado se excluye);
- las alertas abiertas de seguimiento;
- las molestias por ejercicio, solo con consentimiento de datos de salud.

| Tipo | Cuándo | Qué propone | Origen |
|---|---|---|---|
| Progresión de carga (`progression`) | 1) RIR medio por encima del objetivo + 1 en 2 sesiones → +carga; por debajo del objetivo − 1 → −carga. 2) Doble progresión: todas las series en el máximo del **rango** de repeticiones con el RIR objetivo → +carga | Desplaza la carga planificada de las sesiones de los próximos 14 días (respeta la progresión ya prevista). Incremento por material: barra 2,5 kg, mancuernas 2 kg, máquina/polea 2,5 kg, otros 1 kg | Práctica (F) de los cuadernos; el RIR es autoinformado |
| Descarga (`deload`, semana) | Alerta abierta de RPE de sesión alto o de bienestar bajo | La primera semana que aún no ha empezado: −1 serie y RIR +2 (editable) | Práctica (F); el consenso sobre la descarga está pendiente de verificar **[REQUIERE VERIFICACIÓN]** |
| Reducción de volumen (`deload`, volumen) | Alerta abierta de adherencia baja o de sesiones parciales (si no hay descarga) | −1 serie en los ejercicios de 3 o más series de esa semana (mínimo 2) | Práctica (F); conviene preguntar el motivo |
| Sustitución (`substitution`) | Molestias ≥ umbral 🟡 del centro (4/10 por defecto) en un ejercicio en los últimos 14 días | Cambiarlo en las sesiones previstas por una alternativa: primero las preaprobadas por el entrenador, después las del mismo patrón que el cliente tolera | No es un diagnóstico; si persisten, «Requiere valoración por profesional sanitario» |

**Ciclo de vida.**

- **Evaluación**: corre como código de sistema tras confirmar cada **sesión cerrada** (después de las alertas, que se actualizan antes). También corre en `pnpm monitor:daily` y con «Recalcular ajustes».
- **Una propuesta por situación**: cada situación tiene una clave estable (`recommendations.key`, p. ej. `load:{ejercicio}:{fecha}` o `deload:{semana}`) y no se propone dos veces. Una situación ya decidida, por ejemplo rechazada, no vuelve.
- **Caducidad**: si la situación desaparece, la propuesta pendiente pasa a `expired`. Una propuesta de carga antigua pasa a `superseded` cuando llega otra más reciente del mismo ejercicio.

**Decisiones del entrenador**

- Aceptar.
- Editar (aceptar con cambios): carga final, series y RIR de la descarga, o alternativa elegida. Cada parámetro cambiado va a `manual_overrides`.
- Rechazar.
- Posponer.
- Aceptar en bloque las progresiones de carga.
- **Deshacer** un ajuste aplicado: los valores vuelven donde nadie los ha cambiado desde entonces. La propuesta queda `reverted`, con revisión del plan y auditoría.

Cada propuesta lleva su **«¿Por qué?»** con la estructura de §13.6:

- **DATOS**: series registradas, objetivo y alertas.
- **INTERPRETACIÓN** y **REGLA** (`progression.*`).
- **EVIDENCIA**: ninguna verificada. Se dice explícitamente: recomendación práctica configurable, nivel F.
- **LIMITACIONES** y **CONFIANZA** (baja).

### Incremento de carga por ejercicio (fase 13 de la reestructuración)

- El salto mínimo de carga sale por defecto del material (`loadIncrementFor`: barra y máquina 2,5 kg, mancuernas 2 kg, resto 1 kg).
- Cada centro puede fijar el suyo por ejercicio, también para los ejercicios globales: Ejercicio → Progresiones → «Incremento de carga».
  - Tabla `exercise_load_increments`, por organización, con RLS de catálogo.
  - `PUT /exercises/{id}/load-increment` con `{incrementKg}` (> 0 y ≤ 50 kg; `null` vuelve al de por defecto). Queda auditado.
- La progresión de carga lo usa, y el «¿Por qué?» lo dice: «incremento del centro para este ejercicio».

## 4. Interfaz

- **Ficha → Planificación**:
  - «Ajustes propuestos», solo con plan activo, con:
    - qué cambiaría o qué cambió (fecha, ejercicio, campo, antes → después);
    - el «¿Por qué?» y las acciones;
    - los decididos recientemente, con «Deshacer»;
    - la opción de aplicación automática.
  - «Propuesta de plan del motor»: propuestas abiertas y formulario con la plantilla propuesta preseleccionada, la fecha de inicio y los días.
- **Página del plan** (si es propuesta): aviso con las notas de generación, «Aceptar como plan (borrador)» y «Descartar propuesta». En «Gestión» no se ofrece activarla.
- **Ficha → Seguimiento**: aviso «Hay N propuestas de ajuste del plan» con el enlace «Ver propuesta de ajuste».
- **Alertas** (fase 12 de la reestructuración): tarjeta «Ajustes propuestos» con los pendientes (propuestos o pospuestos) de todos los clientes que sigue el entrenador, agrupados por cliente.
  - Cada uno tiene lo mismo que en la ficha: qué cambiaría, el «¿Por qué?» y Aceptar · Editar · Rechazar · Posponer.
  - Así se decide junto a las alertas que lo motivaron, sin abrir cliente por cliente.
  - Caso de uso `listPendingAdjustments` (`GET /adjustments`). La RLS limita a cada entrenador a sus clientes asignados.

## 5. API

Ver `API.md` («Motor de programación»).

## 6. Pendiente

- ~~Propuesta como **nueva revisión del plan activo**.~~ (hecho en la fase 13 de la reestructuración)
- ~~Incremento de carga configurable por ejercicio.~~ (hecho en la fase 13 de la reestructuración)
- Progresión por velocidad (VBT) y e1RM.
- Ajustes de días o frecuencia por disponibilidad.
- ~~Aplicar ajustes desde la página de alertas.~~ (hecho en la fase 12 de la reestructuración)
