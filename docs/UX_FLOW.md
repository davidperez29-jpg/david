# Flujos de uso (UX)

> **Objetivo**: que el entrenador piense «esto es muy fácil de usar».
>
> Referencia de usabilidad pedida: **Excel + web app + base de datos + automatización**.
>
> Regla: **máximo 2–3 clics** para las acciones habituales.

## 1. Navegación

### Entrenador (escritorio y tablet)

```
┌──────────────────────────────────────────────────────────────────────┐
│ ◉ Clientes   Plantillas   Ejercicios   Tests        [Buscar…]   (L) ▾│
└──────────────────────────────────────────────────────────────────────┘
```

- **Cuatro entradas**, frente a las 13 de la versión anterior.
- El menú del usuario («Menú ▾») agrupa Calendario, Alertas, Informes, Ciencia, Ajustes, Usuarios y Privacidad (administración) y Cerrar sesión.
- Las alertas urgentes (rojas y amarillas) se cuentan junto al menú (`⚠ n`); el contador abre la lista de alertas.
- **Buscar** encuentra clientes desde cualquier pantalla (fase 1). Ejercicios y plantillas se añadirán en las fases 2 y 3.

### Cliente (móvil)

Barra inferior: **Hoy · Calendario · Progreso · Perfil**.

## 2. Pantallas principales

### 2.1 Inicio: Mis clientes + Entrenamientos de hoy (§42)

```
Mis clientes                                  [+ Nuevo cliente]
┌────────────────────────────────────────────────────────────────┐
│ ● Marcos Villalba   Hipertrofia · N2   Hoy 18:00 Sesión B  92 %│
│ ● Elena Prieto      Readaptación tobillo · Fase 3     ⚠ revisar│
│ ● Iker Arrieta      Deportes de equipo · N3  Mañana    100 %   │
└────────────────────────────────────────────────────────────────┘
Entrenamientos de hoy
  18:00 Marcos · Sesión B (publicada) · sin registrar
  19:30 Ana · Fuerza N1 · completada ✓
```

- Una fila por cliente:
  - punto de estado: verde = al día, ámbar = algo que mirar, rojo = revisar antes de progresar;
  - perfil y nivel;
  - próxima sesión;
  - adherencia de 4 semanas.
- No hay tarjetas ni paneles de alertas. Lo que requiere atención aparece **en la fila del cliente**, con su motivo y un enlace al sitio donde se resuelve:
  - alerta roja o amarilla → Seguimiento;
  - «Requiere valoración por profesional sanitario» → Ficha → Salud;
  - ejercicio cambiado o registro de series por revisar → la sesión.
- Las filas en rojo van primero; después, orden alfabético por apellidos.
- «Entrenamientos de hoy» enlaza con el calendario completo («Ver calendario»).

### 2.2 Ficha de cliente: Programa (pestaña por defecto)

```
Marcos Villalba · Hipertrofia · Nivel 2 · 3 días/semana · Objetivo: Hipertrofia
 Programa | Evaluación | Seguimiento | Informes | Ficha
──────────────────────────────────────────────────────────────────────────
Plan: Hipertrofia N2 · 3 días · 3 meses (desde plantilla v4)   [⋯]
  Octubre ▾  │ Sem 1 ✓ │ Sem 2 ● │ Sem 3 │ Sem 4 (descarga) │
  Semana 2:  [ Lun · Sesión A ]  [ Mié · Sesión B ]  [ Vie · Sesión C ]
```

- **MES → SEMANA → SESIÓN** en una sola vista.
- Pulsar una sesión abre su tabla debajo, sin cambiar de página.
- Sin plan, la pestaña ofrece dos botones: **[Usar plantilla]** y **[Crear plan desde cero]**.

### 2.3 Tabla de sesión (§10): la pantalla central

```
Sesión B · Semana 2 · Mié 8 oct            [Duplicar sesión] [Duplicar semana]
┌───┬───────────────────────┬────────┬────────┬──────┬───────┬─────┬─────┬───────┬──────────┐
│ # │ EJERCICIO             │ CAT.   │ SERIES │ REPS │ CARGA │ RIR │ RPE │ DESC. │ NOTAS    │
├───┼───────────────────────┼────────┼────────┼──────┼───────┼─────┼─────┼───────┼──────────┤
│ 1 │ Sentadilla trasera    │ Fuerza │   4    │ 6-8  │ 80 kg │  2  │     │ 2:30  │          │
│ 2 │ Peso muerto rumano    │ Fuerza │   3    │ 8-10 │ 60 kg │  2  │     │ 2:00  │ tempo 3-1│
│ 3 │ Copenhagen adaptado   │ Prev.  │   2    │ 6/l  │       │     │     │ 1:00  │ N2       │
│ + │ Añadir ejercicio…     │        │        │      │       │     │     │       │          │
└───┴───────────────────────┴────────┴────────┴──────┴───────┴─────┴─────┴───────┴──────────┘
  Selección: [Duplicar] [Eliminar] [↑] [↓] [Copiar] [Pegar]
```

**Comportamiento de hoja de cálculo**:

| Acción | Teclado / ratón |
|---|---|
| Editar una celda | Escribir encima o doble clic; `Enter` guarda y baja; `Tab` guarda y pasa a la derecha |
| Moverse | Flechas; `Esc` cancela la edición |
| Añadir ejercicio | Escribir en la última fila: autocompletado por nombre, sin tildes y tolerante a erratas |
| Copiar y pegar filas | `Ctrl+C` / `Ctrl+V`, también **desde Excel o Google Sheets**: el texto tabulado se convierte en filas y los ejercicios se reconocen por nombre (los no reconocidos se marcan para elegir) |
| Mover filas | Arrastrar o `Alt+↑/↓` |
| Deshacer | `Ctrl+Z` (última acción) |

- **Autoguardado** por celda, con bloqueo optimista: si otro entrenador cambió la fila, se avisa y no se pisa.
- **Validación en la propia celda**, en rojo y sin ventanas: RIR fuera de 0–10, carga negativa…
- Las sugerencias del motor aparecen como **icono discreto** en la celda («Sugerencia: 82,5 kg, por el RIR registrado»). Se aceptan con un clic.
- La celda **CARGA** admite `80 kg`, `75 %` (de 1RM), `RPE 8`, `banda roja` o `peso corporal`. Se guarda en la variable correcta de la prescripción.

### 2.4 Evaluación (§12–§17)

```
Evaluación   [+ Nueva evaluación]   Batería: Deportes de equipo ▾
┌────────────────────┬────────┬────────┬────────┬──────────┬────────┬────────┐
│ TEST               │ Int. 1 │ Int. 2 │ Int. 3 │ Resultado│ Ref.   │ Z      │
├────────────────────┼────────┼────────┼────────┼──────────┼────────┼────────┤
│ CMJ (cm) ↑         │ 41,2   │ 42,9   │ 42,1   │ 42,9 máx │ 38,5±3,5│ +1,25 │
│ Sprint 30 m (s) ↓  │ 4,02   │ 3,95   │        │ 3,95 mín │ 4,13   │ +1,04 │
└────────────────────┴────────┴────────┴────────┴──────────┴────────┴────────┘
 Radar ▾ (dimensiones: Fuerza · Potencia · Velocidad · …)   Comparar con: [Evaluación anterior ▾]
```

- Hoja de intentos tipo Excel. El resultado se calcula con la regla del test (mejor, media, mediana o mínimo).
- Z y radar se actualizan al escribir.
- **Comparativa** (§17): selectores CLIENTE ▾ · EVALUACIÓN A ▾ · EVALUACIÓN B ▾ · REFERENCIA ▾ → tabla de cambios, porcentajes, radar superpuesto, evolución e interpretación.

### 2.5 Readaptación (§18–§30)

```
Esguince lateral de tobillo (dcho.) · desde 12/09 · Protocolo v2     [Ficha de lesión]
Fase 3 de 6 · Desarrollo de fuerza y capacidad de carga
Criterios para avanzar                                       Estado: CRITERIOS PARCIALES
 [✓] Dolor ≤ 2/10 en actividad las últimas 48 h      (registro 03/10)
 [✓] Dorsiflexión en carga simétrica (≥ 90 % LSI)     (test 01/10)
 [ ] Elevaciones de talón unipodales ≥ 90 % LSI        (pendiente de test)
 [ ] Y-Balance anterior ≥ 90 % LSI                     (pendiente de test)
⚠ Revisar antes de progresar: dolor 6/10 registrado el 04/10
[Comparar evaluaciones]  [Avanzar de fase] (desactivado hasta cumplir los criterios obligatorios)
```

- Los criterios y umbrales del ejemplo son **ilustrativos**. Cada protocolo define los suyos con su fuente, población y limitaciones (`INJURY_MODULE.md` §4).
- La pantalla muestra solo lo que pide el protocolo de esa lesión.
- **[Avanzar de fase]** lo pulsa el entrenador; nunca avanza solo.
- La pantalla **RETURN TO PLAY** lista la checklist del §28 con sus estados. Nunca muestra «APTO»: la decisión la registra una persona responsable.

### 2.6 Cliente: Hoy (§40)

```
Hoy · Sesión B (45 min)
┌───────────────────────────────┐
│ [silueta]   Sentadilla trasera│
│ ▶ Ver vídeo                   │
│ 4 series de 6-8 · 80 kg · RIR 2 │
│ Serie 1  [ 8 ] reps [ 80 ] kg [RIR 2] ✓ │
│ Serie 2  [   ]      [    ]     …        │
│ ¿Molestias?  No · Algo · Mucho          │
└───────────────────────────────┘
[ Completar sesión ] → ¿Cómo fue? Fácil · Normal · Difícil · Muy difícil
```

- Objetivos táctiles de 48 px y una tarjeta por ejercicio.
- Funciona sin conexión.
- **Fichaje automático** (§41): la sesión queda planificada → iniciada (primera serie) → completada o incompleta. Si no se registra nada, queda como no realizada.

## 3. Clics por acción habitual

| Acción | Recorrido | Clics |
|---|---|---|
| Ver la sesión de hoy de un cliente | Inicio → fila del cliente (abre Programa en la semana actual) → sesión | 2 |
| Cambiar una carga | … → sesión → celda | 3 (+ escribir) |
| Crear cliente | **+ Nuevo cliente** → formulario único → Guardar | 2 |
| Asignar un plan desde plantilla | Programa → **Usar plantilla** → elegir (filtrada por perfil, nivel y días) → Crear | 3 |
| Registrar una evaluación | Evaluación → **+ Nueva** (batería del perfil ya elegida) → escribir en la hoja | 2 |
| Comparar dos evaluaciones | Evaluación → Comparar con ▾ → elegir | 2 |
| Generar un informe | Informes → tipo → Generar (PDF en la vista previa) | 3 |
| Registrar molestias de un cliente lesionado | Readaptación → **+ Registro de síntomas** → Guardar | 2 |
| Duplicar una semana | Programa → semana → **Duplicar semana** | 2 |

Los tests E2E de UX miden estos recorridos y fallan si se superan (`ux.spec.ts`).

## 4. Alta de cliente (§2): un solo formulario

```
Nuevo cliente
 Nombre*  [            ]   Apellidos* [            ]
 Fecha de nacimiento [    ] (34 años)   Sexo [▾]
 Perfil principal* [Hipertrofia ▾]      Nivel [2 · Intermedio ▾]
 Experiencia [▾]   Objetivo [Hipertrofia ▾]
 Deporte [▾]       Días por semana [3]
 Dónde entrena [▾] Email (para invitar) [      ]
 Material [Mancuernas ✕] [Barra ✕] [+ Añadir…] [Gimnasio completo] [Casa básica] [Sin material]
 Observaciones [                                 ]
                                       [Guardar e invitar a la app] [Guardar]
```

- Los campos obligatorios son tres: nombre, apellidos y perfil.
- El perfil propone el objetivo y la experiencia propone el nivel (inicial → 1, intermedio → 2, avanzado → 3). Los dos se ven en el formulario y el entrenador los cambia si quiere. Bajo el nivel aparece qué significa ese nivel en ese perfil.
- «Guardar e invitar a la app» necesita email; muestra el enlace de invitación (válido 7 días).
- Al guardar se abre la Ficha en **Salud**: consentimiento y cribado antes de entrenar. La salud no se pregunta en el alta.
- En la Ficha, «Perfil y nivel» explica qué cambia en cada una de las 10 dimensiones (complejidad, intensidad, volumen…).

## 5. Reglas de interfaz

- **Un único botón primario** por pantalla.
- **Sin modales** para editar datos: edición en línea. Las confirmaciones solo se piden para acciones destructivas.
- **Sin jerga de software** («entidad», «registro», «instancia»). Se usa el lenguaje del entrenador (sesión, serie, carga, fase).
- **Estados vacíos útiles**: cada lista vacía explica qué hacer y ofrece el botón para hacerlo.
- **Responsive**:
  - tabla de sesión completa desde 768 px;
  - en móvil, el entrenador ve tarjetas por ejercicio con la misma edición.
- **Accesibilidad WCAG 2.2 AA**: se comprueba con axe en CI, en modo claro y oscuro.
