# Dashboards y calendario

> Fase 9. Implementa `MASTER_SPECIFICATION.md` §8.2 (Hoy del entrenador), §8.3 (ficha del cliente: Resumen), §9.2 (Hoy del cliente), §9.5 (Progreso del cliente), §9.7 (modo oscuro) y F18 (calendario).
>
> Criterio de aceptación de §16.2: «revisión UX con 3 tareas cronometradas». Ver `UX_REVIEW.md`.

Principio de §8.2: la información sale **ordenada por lo que requiere acción**. Cada elemento lleva un enlace a la acción y no hay gráficos decorativos.

## 1. Entrenador

### 1.1 Inicio: Mis clientes (`/app`)

> Desde la reestructuración (fase 1) el antiguo «Hoy», con seis bloques de cifras, alertas y listas, se sustituye por dos listas (`docs/UX_FLOW.md` §2.1). Caso de uso: `trainerHome` (`packages/application/src/home.ts`), también en `GET /api/v1/dashboard/home`.

| Bloque | Contenido |
|---|---|
| Mis clientes | Una fila por cliente accesible: punto de estado (verde: al día · ámbar: algo que mirar · rojo: revisar), perfil y nivel, próxima sesión, adherencia de 4 semanas y, si hace falta, el motivo con su enlace. Primero las filas en rojo. |
| Entrenamientos de hoy | Sesiones publicadas o registradas hoy, con su estado y acceso al modo sala; enlace «Ver calendario». |

Qué pone una fila en ámbar o en rojo:

| Motivo | Estado | Enlace |
|---|---|---|
| Alerta roja viva | Revisar | Seguimiento |
| «Requiere valoración por profesional sanitario» (declaración sin valorar o cribado con derivación) | Revisar | Ficha → Salud |
| Ejercicio cambiado por dolor, pendiente de decidir | Revisar | La sesión |
| Otro ejercicio cambiado o registro de series marcado | Mirar | La sesión |
| Alerta amarilla viva | Mirar | Seguimiento |

Las propuestas (alertas verdes) no cambian el color de la fila: se ven en Seguimiento y en Alertas (menú).

### 1.2 Calendario global (`/app/calendar`)

**Vistas:**
- Mes (cuadrícula de lunes a domingo) y semana.
- Navegación anterior / hoy / siguiente.
- En el móvil, una agenda día a día.

**Filtros:**
- Por cliente.
- Por entrenador/a: solo ADMIN. La RLS ya limita a cada entrenador/a a sus clientes asignados.

**Qué muestra:**

| Elemento | Representación |
|---|---|
| Sesiones de planes activos o completados | Estado con icono y texto (nunca solo con color): ✓ completada · ◐ parcial · ✗ no realizada · ! pasada sin registrar · • pendiente · ○ no publicada. Enlace a la revisión de la sesión. |
| Evaluaciones | 📋 con enlace; las canceladas no aparecen. |
| Fases del plan y semanas de descarga, transición o afinamiento | Solo al filtrar por un cliente: con muchos clientes serían ruido. Se calculan con `planSpans` a partir de las fechas de las semanas. |

**Rango:** como máximo 9 semanas por consulta (`GET /calendar`).

**Reprogramar** (fase 12 de la reestructuración):
- Una sesión pendiente se arrastra a otro día, en la vista mes o en la semana.
- Alternativa para teclado y móvil: «Mover» junto a cada sesión, con un selector de fecha, en la vista semana y en la agenda del móvil.
- El resultado se anuncia en una región `status` («Sesión movida al…» o el motivo del rechazo).
- Las reglas las aplica el servidor (`rescheduleSession`, `POST /plan-sessions/{id}/reschedule`):
  - solo sesiones sin ningún registro: ni asistencia ni series anotadas (desde la fase 18, A65);
  - solo a hoy o un día futuro, dentro de las semanas del plan;
  - el plan debe ser editable: ni completado ni archivado;
  - bloqueo optimista por versión.
- Si el día cae en otra semana del plan, la sesión pasa a esa semana, al final de su día. Queda auditado y el cliente lo ve en su calendario.
- La interfaz solo ofrece mover las sesiones pendientes de un plan activo desde hoy.
- Al soltar, el calendario solo acepta datos de arrastre con un identificador de sesión válido y una versión entera; cualquier otro contenido arrastrado desde otra página se ignora (fase 18).

### 1.3 Ficha del cliente › Resumen

- **Fila superior:**
  - plan activo con la fase y la semana actuales («Base · semana 2 de 12 (Progresión)»);
  - próxima sesión;
  - adherencia de 4 semanas;
  - alertas por color, con las 3 primeras.
- **Métricas clave:** hasta 5. Son las elegidas para el cliente o, si no hay elección, primero las de rendimiento y luego las más recientes. Cada una con su último valor y el veredicto del motor de evaluación (nunca un cambio dentro del error de medida presentado como mejora).
- **Accesos rápidos:** seguimiento, sesiones y calendario del cliente.

### 1.4 Métricas visibles para el cliente

- **Dónde:** en Evaluaciones › Progreso, «Visible para el cliente».
- **Qué:** el entrenador elige hasta 5 tests para la pantalla «Progreso» del cliente (§9.5: «solo lo que el entrenador marque como visible»). Sin selección, el cliente ve todos.
- **Dónde se guarda:** `clients.progress_test_ids` (migración `0016`), auditado.

## 2. Cliente (app móvil)

### Hoy (§9.2)
- Sesión de hoy o la siguiente, con un botón grande («Empezar ▶» o «Ver sesión»).
- La lista numerada de ejercicios con su prescripción compacta: volumen y esfuerzo, sin % 1RM ni descansos, que se ven en el reproductor.
- La racha («Llevas 6 sesiones seguidas»), la próxima evaluación y el bienestar opcional.

### Progreso (§9.5)
- Constancia (sesiones y % de 4 semanas por semana) y racha actual.
- **Hitos** en positivo y sin comparaciones con otras personas:
  - primera sesión y 5, 10, 25… sesiones;
  - rachas de 3, 5, 10 y 20;
  - «Mejora confirmada en …», solo cuando el motor de evaluación dice «mejora probable».
- Los tests elegidos por el entrenador.

### Calendario
Las sesiones publicadas y las próximas evaluaciones.

## 3. Apariencia (§9.7)

- **Opciones:** Ajustes (entrenador y cliente) ofrece «Como el sistema», «Claro» u «Oscuro».
- **Dónde se guarda:** solo en el dispositivo (`localStorage`).
- **Sin parpadeo:** un script mínimo aplica el tema antes de pintar la página.
- **Colores:** los tokens oscuros son los mismos que ya seguían a `prefers-color-scheme`.

## 4. Dominio y casos de uso

| Pieza | Archivo |
|---|---|
| `sessionStreak`, `milestones`, `monthGrid`, `shiftMonth`, `planSpans` | `packages/domain/src/dashboard` |
| `calendarEvents`, `calendarTrainers`, `trainerDashboard`, `clientSummary`, `clientDashboard`, `setProgressMetrics` | `packages/application/src/dashboard.ts` |

**Racha:** sesiones planificadas seguidas hechas (completadas o parciales), contando hacia atrás desde la última. La sesión de hoy sin registrar no la rompe; las reprogramadas o canceladas por el entrenador no cuentan.

## 5. Permisos

| Uso | Permiso |
|---|---|
| Calendario global | `sessions:read` y ser personal. El cliente recibe 403. |
| Dashboard del entrenador | `sessions:review` |
| Resumen del cliente | `monitoring:read` y ser personal |
| Dashboard del cliente | `sessions:read`: propio para el cliente, asignados para el entrenador |
| Elegir métricas visibles | `assessments:write` |

Lo que queda fuera de ámbito devuelve 404.
