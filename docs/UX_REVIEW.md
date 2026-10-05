# Revisión UX con 3 tareas cronometradas (Fase 9)

> Criterio de aceptación de §16.2: «Revisión UX con 3 tareas cronometradas».
>
> **Qué es y qué no es:** estas tareas son **guiones automatizados** (Playwright, Chromium) que miden el número de interacciones y el tiempo del sistema desde la pantalla de partida. Fijan un **umbral de eficiencia que no puede empeorar sin que falle CI**. **No sustituyen una prueba con personas reales:** la sección 4 describe el protocolo para hacerla.

## 1. Tareas y resultados

Medido el 2026-10-03 en el ordenador de desarrollo, con build de producción y datos demo recién cargados. Se tomó el último de dos pases completos.

**2026-10-05 (reestructuración, fase 1):** el inicio pasa a ser «Mis clientes». Las tareas 1 y 2 se adaptan sin perder interacciones: el motivo de la alerta está en la fila del cliente y el calendario se abre con «Ver calendario» desde «Entrenamientos de hoy» (salió del menú principal).

| # | Tarea (persona, dispositivo) | Inicio → fin | Interacciones (umbral) | Tiempo medido (umbral) |
|---|---|---|---|---|
| 1 | Entrenadora, escritorio: atender la alerta roja de dolor desde el inicio y resolverla con nota | Inicio (Mis clientes) → alerta resuelta | **4** (≤ 4): motivo en la fila del cliente → «Resolver…» → nota → «Resolver» | **1,0 s** (< 30 s) |
| 2 | Entrenadora, escritorio: encontrar la sesión de la semana que viene de un cliente y abrirla | Inicio → revisión de la sesión | **6** (≤ 6): «Ver calendario» → Semana → Siguiente → cliente → Filtrar → sesión | **1,8 s** (< 30 s) |
| 3 | Cliente, móvil (Pixel 7): abrir la próxima sesión y registrar la primera serie | Hoy → serie guardada | **2** (≤ 2): «Ver sesión» o «Empezar» → ✓ | **0,7 s** (< 20 s) |
| 4 | Entrenadora, escritorio: cambiar la carga de la próxima sesión de un cliente (fase 2) | Inicio → carga guardada | **4** (≤ 4): fila del cliente → celda CARGA → escribir → Intro | **1,2 s** (< 20 s) |
| 5 | Entrenadora, escritorio: crear el plan de un cliente sin plan desde una plantilla (fase 3), con la biblioteca completa (102 plantillas). La clienta no tiene perfil: la primera sugerencia sale de sus objetivos (decisión A21) | Programa → plan creado | **4** (≤ 4): «Usar plantilla» → «Usar con …» (la primera de la lista) → fecha → «Crear plan» | **1,5 s** (< 30 s) |

Los tiempos son del sistema (navegación y respuesta), no del pensamiento humano. Lo que se controla es el número de interacciones; el tiempo detecta regresiones graves de rendimiento.

**Código:** `apps/web/e2e/ux.spec.ts`, `apps/web/e2e/ux.mobile.spec.ts`, `apps/web/e2e/session-grid.spec.ts` (tarea 4), `apps/web/e2e/templates.spec.ts` (tarea 5) y `apps/web/e2e/ux-tasks.ts`. Cada ejecución añade una línea por tarea a `apps/web/test-results/ux-timings.jsonl`.

## 2. Problemas encontrados en la revisión y corregidos

| Observación | Corrección |
|---|---|
| En «Hoy» del cliente, la prescripción completa (`3×3–5 · @ RIR 1–2 · 85 % 1RM · descanso 3 min`) estrechaba el nombre del ejercicio hasta una palabra por línea. | Nombre arriba y prescripción compacta debajo (volumen y esfuerzo); el % 1RM y el descanso se ven en el reproductor. |
| «Métricas clave» del Resumen mostraba talla y perímetro antes que el rendimiento. | Primero los tests de rendimiento y luego los más recientes, salvo que el entrenador elija los suyos. |
| La tarjeta «Próximos pasos — Fase 8» del Resumen había quedado obsoleta. | Sustituida por accesos rápidos a seguimiento, sesiones y calendario. |
| Las semanas sin sesiones planificadas mostraban una barra mínima en «Tu constancia», como si hubiera actividad. | Sin barra y con «—». |
| La tarea 2 dependía de esperar a cada navegación: un clic rápido sobre la vista anterior perdía el cambio de semana. | El encabezado «Semana del …» confirma la vista antes del siguiente paso. Para personas no es un problema, porque los enlaces son de página completa. |

## 3. Heurísticas revisadas (capturas en escritorio y Pixel 7, tema claro y oscuro)

- **Lo urgente primero:** el inicio pone primero los clientes que hay que revisar, con el motivo en su fila. El calendario marca hoy y las sesiones pasadas sin registrar («!»).
- **Estado sin depender del color:** las alertas llevan icono y texto (🔴 Roja); las sesiones del calendario, icono y texto accesible.
- **Objetivos táctiles:** de 48 px o más en la app del cliente; el botón «Empezar» mide 56 px.
- **Lenguaje:** el cliente no ve niveles de evidencia, reglas ni alertas. Los hitos son positivos y nunca se comparan con otras personas.
- **Modo oscuro (§9.7):** se puede elegir y se aplica antes de pintar; los tokens de color son los mismos.

## 4. Protocolo para la prueba con personas (pendiente)

1. Participantes: 3 entrenadores/as y 3 clientes de perfiles distintos, en sus propios dispositivos.
2. Mismas 3 tareas, sin instrucciones de dónde está cada cosa. Se anota el tiempo hasta completar, los errores y los clics, y se piensa en voz alta.
3. Objetivo: tarea 1 en menos de 60 s, tarea 2 en menos de 60 s y tarea 3 en menos de 20 s, sin ayuda.
4. Los resultados se añaden a este documento y los problemas, al ROADMAP.
