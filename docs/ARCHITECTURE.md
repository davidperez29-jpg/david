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

Estas reglas **se comprueban automáticamente** con ESLint (`no-restricted-imports` en `eslint.config.mjs`); `pnpm lint` falla si alguien se las salta. Además, cada módulo de `src/server` importa `server-only`: si un componente de cliente lo importara por error, la compilación fallaría y ese código nunca llegaría al navegador.

## Flujo de una petición

1. La ruta (por ejemplo `src/app/entrenador/clientes/[clientId]/page.tsx`) obtiene el **contexto**: `getTrainerContext()` o `getClientContext()` en `src/server/context.ts`. El contexto contiene el **actor** (quién pide), el día de hoy en la zona horaria configurada y los repositorios.
2. Llama a un **caso de uso** (`src/server/services/*`), que lee los repositorios y aplica las **políticas de acceso** del dominio (`src/domain/access.ts`).
3. El caso de uso devuelve un **modelo de vista** plano (`src/contracts/*`) que ya contiene solo lo permitido. Si el recurso no existe o el actor no tiene acceso, devuelve `null` y la ruta responde 404, sin revelar cuál de las dos cosas ocurre.
4. La ruta pasa ese modelo a los componentes de `src/features`. Los componentes interactivos (`'use client'`) solo reciben datos ya filtrados.

Todas las páginas con datos se renderizan en cada petición (`await connection()` en el contexto). Así «hoy» nunca queda congelado en el momento de compilar y la autenticación real encajará sin cambios estructurales.

## Datos: puertos y adaptadores

`src/server/repositories/ports.ts` define interfaces asíncronas: `ClientRepository`, `SessionRepository`, etc. Hoy las implementa `src/server/repositories/demo/`, un **adaptador en memoria** con datos ficticios, deterministas y relativos a la fecha actual. Cuando se apruebe la base de datos se añadirá un adaptador PostgreSQL con las mismas interfaces, sin tocar casos de uso ni pantallas.

- Los repositorios **no deciden permisos**: lo hacen los casos de uso con las políticas del dominio. Con PostgreSQL se añadirá una segunda barrera en la base de datos (Row Level Security) como defensa en profundidad.
- El adaptador demo devuelve **copias** (`structuredClone`): nadie puede modificar el conjunto en memoria por accidente.
- `TRAINPRO_DATA_SOURCE` elige el adaptador; hoy solo acepta `demo` y falla al arrancar con cualquier otro valor.

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

El modelo de datos completo (también lo que aún es conceptual) está en `DATA_MODEL.md`.

## Cómo ampliar

- **Nueva pantalla**: crea la ruta en `src/app`, obtén el contexto, llama a un caso de uso y pasa el resultado a un componente de `src/features`. No consultes repositorios directamente desde la ruta.
- **Nuevo dato**: añade el tipo en `src/domain`, el método en el puerto y en el adaptador demo, el caso de uso con su comprobación de permisos y el modelo de vista en `src/contracts`. Escribe tests del caso de uso que incluyan el intento de acceso no autorizado.
- **Nuevo cálculo**: regístralo en `src/domain/formulas.ts` con id, versión y limitaciones; si es científico, con su referencia verificada (ver `SCIENTIFIC_RIGOR.md`).
