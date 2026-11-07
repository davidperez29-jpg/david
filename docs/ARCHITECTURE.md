# Arquitectura

TrainPro es un **monolito modular** en una única aplicación Next.js (App Router) con TypeScript estricto. Un solo proyecto sirve las dos experiencias, entrenador y cliente, con permisos aplicados siempre en el servidor.

## Capas y reglas de dependencia

```
            ┌──────────────┐
            │   src/app    │  Rutas: orquestan, no contienen lógica de negocio
            └──┬────────┬──┘
               │        │
     ┌─────────▼──┐  ┌──▼──────────┐
     │ src/server │  │ src/features│  Pantallas por área (React)
     │ (solo      │  └──┬──────────┘
     │ servidor)  │     │      ┌─────────┐
     └──┬─────────┘     ├─────►│ src/ui  │  Componentes genéricos
        │               │      └─────────┘
        │   ┌───────────▼──┐
        ├──►│src/contracts │  Tipos de los datos que llegan a la interfaz
        │   └───────────┬──┘
        │   ┌───────────▼──┐
        └──►│  src/domain  │  TypeScript puro: modelo, reglas, permisos, fórmulas
            └──────────────┘
```

| Capa        | Puede importar                         | No puede importar                     |
| ----------- | -------------------------------------- | ------------------------------------- |
| `domain`    | nada del proyecto, ni React ni Next    | todo lo demás                         |
| `contracts` | `domain` (solo tipos)                  | código ejecutable                     |
| `server`    | `domain`, `contracts`, Next (servidor) | `app`, `features`, `ui`               |
| `ui`        | React, Next                            | `domain`, `server`, `features`, `app` |
| `features`  | `domain`, `contracts`, `ui`            | `server`, `app`                       |
| `app`       | todo                                   | —                                     |

Actores: `trainer`, `client` y `admin` (administración del catálogo de ejercicios; no accede a datos de clientes). Estas reglas **se comprueban automáticamente** con ESLint (`no-restricted-imports` en `eslint.config.mjs`); `pnpm lint` falla si alguien se las salta. Además, cada módulo de `src/server` importa `server-only`: si un componente de cliente lo importara por error, la compilación fallaría y ese código nunca llegaría al navegador.

## Flujo de una petición

1. La ruta (por ejemplo `src/app/entrenador/clientes/[clientId]/page.tsx`) obtiene el **contexto**: `getTrainerContext()` o `getClientContext()` en `src/server/context.ts`. El contexto contiene el **actor** (quién pide), el día de hoy en la zona horaria configurada y los repositorios.
2. Llama a un **caso de uso** (`src/server/services/*`), que lee los repositorios y aplica las **políticas de acceso** del dominio (`src/domain/access.ts`).
3. El caso de uso devuelve un **modelo de vista** plano (`src/contracts/*`) que ya contiene solo lo permitido. Si el recurso no existe o el actor no tiene acceso, devuelve `null` y la ruta responde 404, sin revelar cuál de las dos cosas ocurre.
4. La ruta pasa ese modelo a los componentes de `src/features`. Los componentes interactivos (`'use client'`) solo reciben datos ya filtrados.

Todas las páginas con datos se renderizan en cada petición (`await connection()` en el contexto). Así «hoy» nunca queda congelado en el momento de compilar y la autenticación real encajará sin cambios estructurales.

## Lógica compartida entre servidor y cliente

Algunas reglas del dominio se ejecutan también en el navegador, siempre con **la misma función**. Por ejemplo, el reproductor de sesión usa `summarizeExecution` y `deriveSessionStatus` (`src/domain/training/session.ts`), igual que el servidor, para que el estado y los cálculos coincidan. El dominio no depende de React ni de Next, así que puede importarse en componentes de cliente.

## Datos: puertos y adaptadores

`src/server/repositories/ports.ts` define interfaces asíncronas: `ClientRepository`, `SessionRepository`, etc. Hoy las implementa `src/server/repositories/demo/`, un **adaptador en memoria** con datos ficticios, deterministas y relativos a la fecha actual. Cuando se apruebe la base de datos se añadirá un adaptador PostgreSQL con las mismas interfaces, sin tocar casos de uso ni pantallas.

- Los repositorios **no deciden permisos**: lo hacen los casos de uso con las políticas del dominio. Con PostgreSQL se añadirá una segunda barrera en la base de datos (Row Level Security) como defensa en profundidad.
- El adaptador demo devuelve **copias** (`structuredClone`): nadie puede modificar el conjunto en memoria por accidente.
- `TRAINPRO_DATA_SOURCE` elige el adaptador; hoy solo acepta `demo` y falla al arrancar con cualquier otro valor.

## Registro sin conexión y envío idempotente (propuesta, ADR-22)

Diseño pendiente de aprobación para el portal del cliente (`TRAINING_EXPERIENCE.md` §4). No añade dependencias: usa APIs del navegador.

1. Al abrir «Hoy» con conexión, el portal guarda en el dispositivo la sesión del día (y la siguiente), con su prescripción, las indicaciones y las siluetas. Los vídeos no se guardan (P-30).
2. Cada serie registrada se guarda **primero en IndexedDB** con un `clientSetId` (UUID generado en el dispositivo) y pasa a una **cola de envío**.
3. La cola se envía al abrir la app, al volver a ella (`visibilitychange`) y al recuperar la conexión (`online`). iOS no admite la sincronización en segundo plano, así que no se depende de ella.
4. El servidor recibe los envíos en un **caso de uso idempotente** (`recordSetLogs`): comprueba con `canLogExecution` que el actor es el cliente de esa sesión publicada, ignora los `clientSetId` ya recibidos y guarda las correcciones como versiones (`supersedes`). La restricción única de la base de datos es la segunda barrera.
5. La interfaz distingue «Guardado en el móvil» de «Enviado». Si al cerrar sesión quedan series sin enviar, se avisa antes de borrar los datos locales.
6. Las series efectivas se calculan con la misma función del dominio en el servidor y en el portal, como ya ocurre con `effectiveSetRecords`.

El temporizador de descanso se calcula a partir de la hora de fin y del reloj monótono (`performance.now()`), así que es correcto aunque se bloquee la pantalla. Mantener la pantalla encendida (API Wake Lock) se usará donde el navegador lo permita.

## Recursos visuales (propuesta, ADR-21)

Un puerto `MediaStorage` en `src/server` (subir con URL firmada, obtener URL de lectura, firmada o pública según la visibilidad, y borrar) aísla el proveedor de almacenamiento. El caso de uso comprueba `canViewMedia` antes de firmar una URL. Detalle en `MEDIA.md`.

## Evolución hacia un producto comercial (propuesta)

Pendiente de aprobación (`PRODUCT_STRATEGY.md`, P-51 y siguientes). Principio: **monolito modular**, sin microservicios. Se separan módulos dentro del mismo proyecto y solo se extrae un servicio si una carga concreta lo exige y se mide.

### Módulos

Cada módulo tiene su carpeta en `domain`, `server/services` y `contracts`, y solo se comunica con los demás por su interfaz pública (reglas de ESLint por módulo, como las de las capas actuales). Es el destino, no el punto de partida: en la 1B se crea la carpeta de un área solo cuando aparece su código, y las reglas por módulo, cuando el código lo justifique; no se crean módulos vacíos (`IMPLEMENTATION_READINESS.md` §7):

- `identity` (organizaciones, centros, miembros y roles);
- `people` (clientes y equipos asistenciales);
- `library`;
- `assessment`;
- `planning` (planes, sesiones y prescripción);
- `execution` (registro, valoración previa y RPE de la sesión);
- `analytics` (volumen y carga);
- `adaptation` (progresiones, reglas, recomendaciones y registro de decisiones);
- `rehab`;
- `evidence`;
- `media`;
- `integrations`;
- `reporting`;
- `messaging`.

### Inquilinos y permisos

- **Organización como inquilino** desde el primer esquema (Fase 2). Un entrenador independiente es una organización de una persona, de modo que añadir centros y equipos (E7) no exige migrar los datos.
- Cada fila lleva `organization_id`. RLS filtra por organización y por la relación con el cliente.
- Los permisos pasan de «entrenador responsable» a **equipo asistencial** (`client_care_team`): cada profesional tiene un rol (entrenador, readaptador, fisioterapeuta, observador) y un alcance (entrenamiento, evaluaciones, salud). Las políticas de `src/domain/access.ts` se amplían con esos roles, con tests de acceso no autorizado.

### Motor de reglas

- Funciones **puras** del dominio: reciben una instantánea de los datos y devuelven recomendaciones con su explicación. Sin acceso a red ni a base de datos, deterministas y versionadas.
- Se ejecutan en el servidor y, para las reglas preautorizadas previas a la sesión, también en el móvil sin conexión, con la misma función (como `summarizeExecution`).
- El **registro de decisiones** es una tabla de primera clase, de solo adición (`PROGRESSION_AND_AUTOREGULATION.md` §5.5).

### Versionado y auditoría

- Tienen versión: prescripciones (versión de la sesión), reglas, fórmulas, correspondencias de integraciones y fuentes de evidencia (fecha de revisión).
- Auditoría de los accesos a datos de salud, de los cambios en lo compartido y de las decisiones del motor. No se usa _event sourcing_ completo: solo registros de adición donde la trazabilidad lo exige.

### IA y servicios externos

Un puerto `AssistantPort` aísla cualquier proveedor de IA. **No se conecta ninguno hasta aprobar** el proveedor, la región (UE), el contrato de tratamiento, el coste y la base jurídica (P-55). Las salidas se etiquetan como generadas y requieren la revisión del profesional.

### Escalabilidad

- PostgreSQL con índices por organización y fecha.
- Partición por tiempo de `set_log` cuando el volumen lo justifique.
- Trabajos en segundo plano para los agregados y la importación, solo cuando haga falta.
- Costes en `INFRASTRUCTURE.md`.

## Decisiones estructurales propuestas para la Fase 1B (P-51, P-52 y P-62 a P-67)

El objetivo es que la 1B, aunque use datos ficticios, **no obligue a reconstruir** nada en la 1C ni en la Fase 2. Se separa lo que hay que preparar de lo que se implementa y de lo que puede esperar.

> **Revisado en la auditoría de preparación (7 de noviembre de 2026).** Esta tabla preparaba en la 1B más de lo necesario. La columna «Clase» recoge la clasificación vigente del §7 de `IMPLEMENTATION_READINESS.md`: **A**, implementar ahora; **B**, preparar ahora con una decisión de diseño sencilla; **C**, construir cuando haga falta. En resumen: organización y equipo asistencial, en el esquema de la Fase 2 (P-51, P-52); historial por (cliente, variante) y `trackId` solo en la 1C, si hace falta (P-62); versiones en la 1B y modelo de cambios en la 1C (P-63); la escala, como un campo (P-64); una sola cola local para la sesión (P-65); y la zona horaria de la aplicación (P-66). Las demás columnas conservan la propuesta anterior.

| Área                                       | Preparación arquitectónica necesaria en la 1B                                                                                                        | Funcionalidad que se implementa en la 1B                         | Puede esperar                                                                                      | Coste de no fijarlo ahora                                                 | Clase                                                                                 |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **Clientes y organizaciones** (P-51, P-52) | `organizationId` en todos los agregados; `membership` (usuario, organización, rol); `careTeam` del cliente con un responsable principal y alcances   | Una organización demo con un entrenador; crear y editar clientes | Centros, grupos, varios profesionales, interfaz de equipo (E7); acceso entre organizaciones (P-73) | Migrar todas las tablas y reescribir las políticas RLS en la Fase 2       | C (Fase 2). En la 1B, crear y editar clientes, sin organización                       |
| **Prescripción por serie** (ADR-20, P-41)  | Valores comunes + excepciones por serie; modalidades de carga y escalas tipadas                                                                      | Editor y reproductor por serie                                   | —                                                                                                  | Rehacer el editor, el reproductor y los cálculos                          | A                                                                                     |
| **Versiones de sesión**                    | Versiones inmutables; cada serie registrada apunta a la versión en vigor cuando se hizo                                                              | Publicar, editar y avisar al cliente                             | Comparar versiones visualmente a gran escala                                                       | Perder la trazabilidad de lo prescrito                                    | A; la comparación visual, B                                                           |
| **Rastro de progresión** (P-62)            | `trackId` opcional en cada ejercicio prescrito (cliente + variante + contexto), estable entre sesiones y versiones                                   | Se asigna al duplicar o planificar; visible en el historial      | Esquemas de progresión que lo usan (1C)                                                            | La 1C no podría saber qué ejercicios de sesiones distintas son «el mismo» | C (1C, si hace falta); en la 1B, (cliente, variante)                                  |
| **Cambios de prescripción** (P-63)         | Un único modelo `prescription_change` con origen (`manual`, `supervised`, `preauthorized`), autor, fecha, motivo y diferencias                       | Historial y trazabilidad de los cambios manuales                 | Orígenes del motor (1C)                                                                            | Dos historiales incompatibles entre la 1B y la 1C                         | C (1C); en la 1B, versiones con autor y fecha                                         |
| **Registro de ejecución** (ADR-22)         | Registro de solo adición, `clientSetId`, `supersedes`, procedencia por dato                                                                          | Registro, correcciones y series sin duplicados                   | —                                                                                                  | Contar series dos veces o perder correcciones                             | A                                                                                     |
| **Cola de envío** (P-65)                   | Comandos idempotentes genéricos (serie, valoración previa, dolor, RPE de la sesión, nota)                                                            | Envío sin conexión y reintentos                                  | Sincronización en segundo plano (no existe en iOS)                                                 | Una cola distinta por tipo de dato                                        | A, solo para lo que escribe el cliente en la sesión; sin dolor y no genérica          |
| **Valoraciones subjetivas** (P-64)         | `instrument` + `item` + versión de la escala en cada respuesta (valoración previa, RPE de la sesión, escalas de RPE, dolor, calidad)                 | Recogida y visualización                                         | Instrumentos validados opcionales (E3)                                                             | Mezclar respuestas de escalas distintas al cambiar la escala              | A, como un campo de escala con versión; sin `instrument` ni dolor                     |
| **Cálculos de carga**                      | Funciones puras y versionadas en el registro de fórmulas; resultados recalculables, no guardados                                                     | Volumen y tonelaje por tipo (P-36)                               | Carga interna (1C) y volumen por músculo (E3)                                                      | Cifras que no se pueden reproducir                                        | A                                                                                     |
| **Unidades y tiempo** (P-66)               | Unidades canónicas (kg, s, m) con la unidad en cada valor; fechas con la zona horaria del cliente                                                    | Visualización en kg                                              | Libras y otras unidades de visualización                                                           | Errores de conversión y sesiones que cambian de día                       | B (unidad en el nombre del campo, zona horaria de la aplicación); zona por cliente, C |
| **Integraciones**                          | Modelo de medición con procedencia `imported`, dispositivo y lote, igual para series y evaluaciones                                                  | Transcripción manual con procedencia (P-25)                      | Importación de CSV (E2) y API (E5)                                                                 | Datos importados sin trazabilidad                                         | B (la procedencia `imported` ya existe); transcripción manual, iteración B            |
| **Permisos**                               | Políticas con la forma `puede(actor, acción, recurso)`, con la organización, el equipo asistencial y el alcance (entrenamiento, evaluaciones, salud) | Políticas nuevas con tests de acceso no autorizado               | Roles adicionales (E7)                                                                             | Reescribir todas las políticas al añadir roles                            | A, con el actor y el recurso; organización, equipo y alcance de salud, C              |
| **Historial de decisiones**                | Registro de solo adición compartido con `prescription_change`                                                                                        | Cambios manuales                                                 | Recomendaciones y decisiones del motor (1C)                                                        | Auditoría incompleta                                                      | C (1C)                                                                                |
| **Datos de referencia** (P-67)             | `normative_reference` con fuente, población y verificación; referencias del cliente (1RM, peso corporal, línea base) como mediciones                 | Referencias del cliente                                          | Valores normativos poblacionales verificados (E2)                                                  | Comparaciones con referencias sin fuente                                  | A, las del cliente; poblacionales, B (estructura sin valores)                         |

### Terminología (P-52)

- **Miembro de la organización** (`membership`): profesional que trabaja en una organización, con un rol.
- **Equipo asistencial** (`care_team`): profesionales que atienden a **un cliente**, cada uno con su alcance.
- **Equipo deportivo o grupo** (`team`, `group`): conjunto de clientes o deportistas que se planifican juntos (E7).

Así no se confunden «el equipo de un club» y «los profesionales que atienden a una persona».

### Mapa de dependencias entre módulos

```mermaid
flowchart LR
  identity["identity<br/>organizaciones, miembros, roles"] --> people["people<br/>clientes, equipo asistencial"]
  people --> assessment["assessment<br/>evaluaciones, referencias"]
  library["library<br/>ejercicios, medios, evidencia"] --> planning
  people --> planning["planning<br/>sesiones, prescripción, versiones, rastros"]
  assessment --> planning
  planning --> execution["execution<br/>registro, valoraciones, cola<br/>(dolor estructurado: E4)"]
  execution --> analytics["analytics<br/>volumen, carga, carga interna"]
  planning --> analytics
  analytics --> adaptation["adaptation (1C)<br/>esquemas, reglas, recomendaciones"]
  execution --> adaptation
  assessment --> adaptation
  adaptation -->|prescription_change| planning
  evidence["evidence<br/>fuentes y etiquetas"] --> adaptation
  evidence --> analytics
  integrations["integrations (E5)"] --> assessment
  integrations --> execution
```

**Regla:** `adaptation` solo modifica la planificación a través de `prescription_change`, nunca directamente. Las dependencias van siempre en el sentido de las flechas y se comprueban con ESLint, como las capas actuales.

### Acceso entre organizaciones (P-73, diseñado, no construido)

Si en el futuro un cliente trabaja con un centro y una clínica distintos, cada organización conserva sus datos. Compartirlos exigirá una **concesión explícita** (`access_grant`: quién, qué alcance, hasta cuándo) con el consentimiento del cliente. No se implementa hasta E7, pero las políticas de permisos ya reciben la organización del recurso, así que añadirlo no exigirá rehacerlas.

## Sesión de demostración

No hay autenticación. `getTrainerContext()` y `getClientContext()` devuelven actores fijos (Alex, entrenador; Marta, clienta). Son **el único punto que cambiará** con el inicio de sesión real: el actor saldrá de una sesión verificada en el servidor. El resto del código ya trabaja con un `Actor` y no sabe de dónde viene.

## Estructura de carpetas

```
src/app/
  layout.tsx, globals.css        Raíz: fuentes, metadatos, tokens de diseño, service worker
  page.tsx                       Portada (elegir experiencia)
  manifest.ts, icon.svg, apple-icon.png   PWA
  not-found.tsx, error.tsx       Páginas de error propias
  entrenador/                    Área del entrenador (layout con barra lateral)
    page.tsx                     Panel
    clientes/                    Lista de clientes
    clientes/[clientId]/         Ficha con pestañas horizontales (layout + una ruta por pestaña):
      page.tsx                   Información
      objetivos/ evaluaciones/ resultados/ planificacion/ sesiones/
      registro/ informes/ salud/ compartido/
    evaluaciones/, analisis/     Catálogo y últimos resultados · evolución y comparaciones
    planificacion/, carga/, readaptacion/, informes/, configuracion/
    ejercicios/, ejercicios/[exerciseId]/   Biblioteca (buscador avanzado) y ficha de variante
  cliente/                       Portal del cliente (columna móvil)
    (pestanas)/                  Grupo con navegación inferior: Hoy, Semana, Progreso
    sesion/[sessionId]/          Reproductor de sesión a pantalla completa
src/domain/                      access, measurement, formulas, assessment, goals, people, rehab,
                                 time, text, format, training/{prescription,session,volume},
                                 library/{taxonomy, exercise, search}
src/server/                      env, context, repositories/{ports, demo/{dataset, library, index}},
                                 services/{trainer, trainer-access, client-file, client, library, mappers}
src/contracts/                   shared, trainer, client
src/features/                    brand/, shared/, trainer/, client/
src/ui/                          button, card, badge, avatar, stat, meter, notice, page-header, empty-state, cn
```

El modelo de datos completo (también lo que aún es conceptual) está en `DATA_MODEL.md`. El diseño de la experiencia guiada, la prescripción v2 y los recursos visuales, pendiente de aprobación, está en `TRAINING_EXPERIENCE.md`, `EFFORT_AND_LOAD.md` y `MEDIA.md`. La estrategia, la progresión y autorregulación y las integraciones están en `PRODUCT_STRATEGY.md`, `PROGRESSION_AND_AUTOREGULATION.md` e `INTEGRATIONS.md`.

## Cómo ampliar

- **Nueva pantalla**: crea la ruta en `src/app`, obtén el contexto, llama a un caso de uso y pasa el resultado a un componente de `src/features`. No consultes repositorios directamente desde la ruta.
- **Nuevo dato**: añade el tipo en `src/domain`, el método en el puerto y en el adaptador demo, el caso de uso con su comprobación de permisos y el modelo de vista en `src/contracts`. Escribe tests del caso de uso que incluyan el intento de acceso no autorizado.
- **Nuevo cálculo**: regístralo en `src/domain/formulas.ts` con id, versión y limitaciones; si es científico, con su referencia verificada (ver `SCIENTIFIC_RIGOR.md`).
