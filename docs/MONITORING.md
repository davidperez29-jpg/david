# Seguimiento: adherencia, carga interna y alertas

> Fase 8. Implementa `MASTER_SPECIFICATION.md` §13.7 y el criterio de aceptación de §16.2: «24 planificadas / 21 realizadas = 87,5 %» (test unitario y test de integración).
>
> Las alertas **describen** lo que ha pasado («Dolor 7/10 declarado en hombro derecho»); **nunca diagnostican**. El entrenador decide qué hacer: ninguna alerta modifica un plan.

## 1. Métricas (`packages/domain/src/monitoring/metrics.ts`)

### 1.1 Adherencia
- **Fórmula:** sesiones realizadas (completadas o parciales) / sesiones planificadas en la ventana, con un decimal.
  - Ejemplo de la especificación: 24 planificadas y 21 realizadas = **87,5 %**.
- **Qué cuenta como planificada:** las sesiones publicadas (o registradas en modo sala) de planes activos o completados, con fecha hasta hoy.
- **Qué no cuenta:** las sesiones reprogramadas y las canceladas por el entrenador.
- **Desglose:** completadas, parciales, no realizadas con motivo y pasadas sin registro.
- **Ventanas:** 28 días, 84 días y por semana.

### 1.2 Carga interna (método sRPE)

| Métrica | Definición | Evidencia (según PubMed) |
|---|---|---|
| Carga de la sesión | RPE de la sesión (CR-10) × duración en minutos, en unidades arbitrarias (UA). Sin duración registrada se usa la estimada de la sesión. | Válido y fiable en muchos deportes y actividades: Foster 2001 (PMID 11708692) y Haddad 2017 ([10.3389/fnins.2017.00612](https://doi.org/10.3389/fnins.2017.00612)). Afirmación `c_srpe_valido`, confianza moderada. |
| Carga semanal | Suma de las cargas diarias de la semana ISO. | — |
| Monotonía | Media / desviación típica de las 7 cargas diarias. | Foster 1998 ([10.1097/00005768-199807000-00023](https://doi.org/10.1097/00005768-199807000-00023)): estudio observacional en 25 deportistas. Se muestra **solo como descriptor, sin umbrales universales** (`c_monotonia_descriptiva`, confianza baja). |
| Tensión | Carga semanal × monotonía. | Ídem. |
| **ACWR** | **No se calcula.** | Impellizzeri 2020 ([10.1123/ijspp.2019-0864](https://doi.org/10.1123/ijspp.2019-0864)): no hay evidencia para usarlo en la gestión de la carga ni para reducir lesiones (`c_acwr_no_usar`). |

Las cuatro fuentes están en `seed-data/evidence/monitoring.json`, con su cita literal del resumen. Se verificaron en PubMed el 2026-10-03.

### 1.3 Bienestar
- **Puntuación:** de 0 a 10 (más alto = mejor). Es la media de los ítems respondidos: energía, sueño y motivación, más fatiga, estrés y agujetas invertidos.
- Es autodeclarado: contexto, no un diagnóstico.

## 2. Reglas de alerta (`packages/domain/src/monitoring/rules.ts`)

Todas son datos: cada umbral es un parámetro configurable (nivel F, recomendación práctica) con su rango permitido.

| Regla | Por defecto | Color |
|---|---|---|
| Adherencia baja | En 28 días: < 80 % 🟡 y < 60 % 🔴. Solo se evalúa con al menos 4 sesiones planificadas. | 🟡/🔴 |
| Sesiones no realizadas seguidas | 2 sesiones pasadas seguidas sin registro o «no realizada» sin motivo. La sesión de hoy no cuenta. | 🟡 |
| Sesiones incompletas | 3 o más parciales en 14 días. | 🟡 |
| RPE de sesión elevado | Las últimas 3 sesiones, cada una al menos 2 puntos por encima de lo previsto. Si no hay RPE previsto, se compara con la mediana personal de las 6 anteriores (mínimo 3). | 🟡 |
| RIR distinto del objetivo | La media de RIR por sesión queda al menos 2 por encima o por debajo del rango objetivo en 2 sesiones del mismo ejercicio (28 días). Es una **propuesta** de subir o bajar la carga: no se aplica sola. | 🟢 |
| Descenso de rendimiento | Veredicto «empeoramiento probable» del motor de evaluación (cambio mayor que el error de medida) en los últimos 42 días. | 🟡 |
| Dolor o molestias | 4/10 o más 🟡, con la propuesta de valorar una sustitución. 7/10 o más, o repetido en la misma zona en 2 sesiones seguidas, 🔴 con «Requiere valoración por profesional sanitario». **Solo con consentimiento de datos de salud.** | 🟡/🔴 |
| Bienestar bajo | Puntuación < 4 durante 3 días seguidos (el último, hoy o ayer). | 🟡 |
| Sesión sin valoración | Sesión completada sin RPE en los últimos 7 días: recordatorio. | 🟢 |
| Reevaluación vencida | Semana de tipo «test» del plan activo pasada (con 3 días de margen) sin una evaluación registrada desde la semana anterior. | 🟡 |

**Configuración:**
- **Del centro:** la administración edita los umbrales en Ajustes › Reglas de alerta (`monitoring:rules`).
- **Versionado:** cada cambio crea una versión nueva de `rule_sets` y retira la anterior; los cambios quedan en el historial con el antes y el después. Cada alerta guarda la versión de reglas con la que se generó.
- **Por cliente:** el entrenador puede desactivar una regla con motivo (`client_rule_overrides`, auditado), por ejemplo durante una pausa acordada.

## 3. Ciclo de vida de una alerta

```
evento (sesión cerrada · valoración de ejercicio · bienestar · evaluación completada · regla cambiada)
  └─ al confirmarse la transacción → monitorClient (código de sistema)
trabajo diario (pnpm monitor:daily) → todos los clientes con plan activo o alertas vivas
```

- **Se evalúa después de confirmar** (`afterCommit` en `rls.ts`): un fallo al evaluar se registra en el log y nunca deshace lo que hizo el usuario. La evaluación corre como código de sistema, como el trabajo diario, porque el cliente no puede escribir alertas (RLS).
- **Una alerta viva por situación** (`alert_key`, índice único parcial):
  - si la situación sigue, se actualiza el mensaje;
  - si empeora (amarilla → roja), se escala en el mismo registro y vuelve a «abierta».
- **Resolución automática:** si la condición deja de cumplirse, la alerta se resuelve sola con la nota «la condición ya no se cumple».
- **Resolución por una persona:** la misma situación no se vuelve a crear durante 7 días, salvo que empeore.
- **Rojas:** cada alerta roja nueva notifica dentro de la app a los entrenadores activos del cliente.
- **Estados:** abierta → vista → resuelta (con nota, auditado).

**Trabajo diario:** `pnpm monitor:daily` (`packages/application/scripts/monitor-daily.ts`). Programarlo una vez al día, por ejemplo con cron `15 5 * * *`. Así funcionan las reglas que dependen del paso del tiempo (sesiones no realizadas, reevaluación vencida y ventanas de adherencia).

## 4. Valoración por ejercicio

- En el reproductor, «¿Qué tal …?» permite valorar la dificultad (0–10) y las molestias (0–10) de cada ejercicio.
- Pasa por la cola sin conexión como `exercise_feedback`; es idempotente: una fila por ejercicio de la sesión.
- Las molestias solo se guardan con consentimiento de datos de salud y alimentan la regla de dolor.
- También existe el endpoint REST `POST /exercise-feedback`.

## 5. Interfaz

| Dónde | Qué |
|---|---|
| Menú «Alertas •N» | Rojas + amarillas vivas de los clientes accesibles. |
| `/app` (Hoy) | Adherencia de 28 días del centro (o de tus clientes) y alertas vivas por gravedad, con marcar vista y resolver. |
| `/app/alerts` | Activas o resueltas, filtro por gravedad (icono + texto: 🔴 Roja, 🟡 Amarilla, 🟢 Propuesta), notas de resolución. |
| Cliente › Seguimiento | Adherencia de 4 y 12 semanas; carga semanal (gráfico de una serie con tooltip y tabla con sesiones, adherencia, carga, monotonía y tensión) con su evidencia; últimas sesiones (RPE frente al previsto, minutos, carga); bienestar de 14 días; alertas; «Recalcular alertas»; reglas desactivadas para el cliente. |
| Editor de sesión | «RPE previsto de la sesión (0–10)». |
| Ajustes › Reglas de alerta | Umbrales con rango, valor por defecto y nivel F. Edita ADMIN; el entrenador los ve en solo lectura. |
| App del cliente › Progreso | «Tu constancia»: «Has hecho 6 de 6 sesiones en las últimas 4 semanas (100 %)» y sesiones por semana. El cliente **no** ve las alertas. |

## 6. Permisos

| Permiso | ADMIN | TRAINER | CLIENT |
|---|---|---|---|
| `monitoring:read` | Organización | Asignados | Propio (sin alertas) |
| `alerts:manage` | Organización | Asignados | ✗ |
| `monitoring:rules` | Organización | ✗ (lectura con `monitoring:read`) | ✗ |

Las alertas no son legibles por el cliente por RLS (`alerts`: `client_owned`, `clientRead: false`).

## 7. Pendiente

| Elemento | Fase |
|---|---|
| Dashboards entrenador y cliente completos, calendario global, revisión UX cronometrada | 9 |
| Propuestas de ajuste aceptables desde la alerta (aplicar la subida o bajada de carga al plan con revisión) | 11 |
| Notificaciones push y por correo de alertas rojas | 13 |
| Umbrales por población (p. ej., personas mayores frente a deportistas) | Tras uso real |

## Fase 11: de la alerta a la propuesta de ajuste

Tras cada sesión cerrada, y en `pnpm monitor:daily`, el motor de programación (`PROGRAMMING_ENGINE.md`) lee las alertas abiertas y propone ajustes concretos del plan:

- RPE de sesión alto o bienestar bajo → semana de descarga;
- adherencia baja o sesiones parciales → menos volumen;
- RIR fuera del objetivo → carga;
- molestias en un ejercicio → sustitución.

Nunca se aplican solos: la ficha → Seguimiento enlaza con «Ver propuesta de ajuste».
