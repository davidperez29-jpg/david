# Hoja de ruta de la reestructuración

> Sustituye a `ROADMAP.md` (fases 0–15 de la primera versión, ya completadas) para el trabajo nuevo.
>
> Regla del §47–§48: **una fase cada vez**. Al cerrar cada fase se comprueban:
> - funcionalidad;
> - datos;
> - UX;
> - responsive;
> - permisos;
> - errores.
>
> No se avanza si la fase anterior está rota: CI en verde y los E2E de la fase pasan.

## Resumen

| Fase | Contenido | Reutiliza | Estado |
|---|---|---|---|
| **0** | **Despliegue online** (Render, UE): URL + login, sin comandos | Docker, migraciones, observabilidad | ✅ Preparado (falta el primer despliegue del usuario) |
| 1 | Arquitectura + BD + autenticación + clientes (perfil principal, nivel, deporte, material, frecuencia); navegación nueva | Auth, RLS, clientes | ⏳ En curso |
| 2 | Ejercicios + sesiones (tabla tipo Excel) + planificación MES → SEMANA → SESIÓN | Biblioteca, prescripción, planes | Pendiente |
| 3 | Plantillas + objetivos + niveles (filtros, usar plantilla = copia, desde cero, mis plantillas con versiones) | `plan_templates` | Pendiente |
| 4 | Evaluaciones + referencias (hoja de intentos, baterías por perfil, fórmulas, grupos/equipos) | Evaluación actual | Pendiente |
| 5 | Radares + evolución (normalización, dimensiones, comparativas) | Cambio real, gráficos | Pendiente |
| 6 | Informes (8 tipos, comparativo, grupal, radar en PDF) | Motor de informes | Pendiente |
| 7 | Lesiones / readaptación / RTP | Seguimiento de dolor, planes | Pendiente |
| 8 | Cliente móvil + feedback + adherencia + fichaje | PWA, registro, asistencia | Pendiente |
| 9 | Ciencia + referencias (verificación, tipos de evidencia, búsquedas registradas) | Ciencia actual | Pendiente |
| 10 | Endurecimiento final: seguridad, copias, rendimiento, revisión ASVS/RGPD | Todo lo de seguridad | Pendiente |

## Por qué el despliegue va primero (decisión A2)

El encargo pone el despliegue en la fase 10, pero también exige que el producto final sea una URL y que el usuario no use Docker ni comandos. Desplegar al principio:
- permite probar **cada fase en la URL real**, sin instalar nada;
- detecta pronto los problemas propios del entorno: memoria, arranque y base gestionada.

La fase 10 se mantiene para el endurecimiento final.

## Fase 0 · Despliegue online

- `render.yaml` (Blueprint):
  - web Docker en Frankfurt + PostgreSQL 16 en Frankfurt;
  - clave de cifrado generada por Render;
  - email y contraseña del primer administrador pedidos en el formulario de creación.
- **Arranque del contenedor** (idempotente): migraciones → catálogos → administrador inicial si la base está vacía → datos de ejemplo opcionales (`DEMO_DATA=true`) → servidor.
- **Trabajos diarios** (alertas, retención, fichaje automático): se ejecutan dentro de la app una vez al día, con un bloqueo en la base de datos. No dependen de un *cron* de pago.
- Guía paso a paso en `docs/DEPLOY_RENDER.md`, con capturas de texto del formulario y sin comandos.

**Criterios de aceptación**:
- un despliegue nuevo queda accesible por HTTPS;
- el administrador entra con su email;
- `/api/ready` responde `ready`;
- al reiniciar no se duplica nada.

Se comprueba en CI con la imagen de despliegue sobre una base vacía, arrancada dos veces.

## Fase 1 · Clientes, perfiles y navegación

- Catálogo `training_profiles` con los 15 perfiles del §3 y sus 3 niveles (descriptores del §4).
- `clients.profile_id`, `level`, `sport_id`.
- Alta rápida en un formulario: nombre, edad/fecha, sexo, deporte, nivel, objetivo, experiencia, material, frecuencia, observaciones y perfil principal.
- **Navegación nueva**: Clientes · Plantillas · Ejercicios · Tests, más el menú de usuario.
- **Inicio = Mis clientes + Entrenamientos de hoy**.
- Ficha de cliente con 6 pestañas: Programa, Evaluación, Readaptación (si procede), Seguimiento, Informes y Ficha. Las pestañas sin rediseñar todavía muestran el contenido actual.

**Criterios**:
- crear un cliente con perfil en 2 clics y menos de 30 s;
- el menú tiene 4 entradas;
- la RLS de las tablas nuevas está en la matriz;
- los E2E de alta y de navegación pasan;
- axe sin infracciones.

## Fase 2 · Ejercicios, sesiones y planificación

- Componente `DataGrid` con:
  - edición en celda, teclado y autoguardado con bloqueo optimista;
  - pegado desde Excel, copiar/pegar filas, mover, duplicar y deshacer.
- Tabla de sesión del §10 (EJERCICIO · CAT. · SERIES · REPS · CARGA · RIR · RPE · DESC. · NOTAS). La celda CARGA interpreta kg, %, RPE, banda y peso corporal.
- Programa: MES → SEMANA → SESIÓN en una vista; duplicar sesión y semana.
- Ejercicios: ficha con silueta, vídeo, progresiones/regresiones, observaciones y referencias; categorías del §11.

**Criterios**:
- cambiar una carga en 3 clics;
- pegar 5 filas desde Excel crea 5 ejercicios;
- sin pérdidas con dos editores a la vez.

## Fase 3 · Plantillas, objetivos y niveles

- Biblioteca con filtros (objetivo, nivel, días, duración, población, material).
- **Usar plantilla** crea una copia independiente.
- **Crear desde cero**.
- **Mis plantillas**: guardar, duplicar, editar, archivar, versionar y reutilizar.
- Plantillas iniciales por perfil × nivel × días (2–5) × duración (3–12 meses), construidas con búsqueda específica por perfil (`SCIENCE_SYSTEM.md` §4). Incluyen las rutinas de reducción de factores de riesgo de los documentos del usuario.

**Criterios**:
- usar una plantilla no modifica el original (test);
- cada edición de plantilla crea versión;
- los filtros devuelven resultados en < 300 ms.

## Fase 4 · Evaluaciones y referencias

- Hoja de intentos tipo Excel.
- Reglas de resultado (mediana, mínimo, máximo…), fórmulas derivadas con constantes editables y bilateral con asimetría.
- Baterías por perfil y referencias con tipo, población, condición y limitaciones.
- Grupos/equipos (`client_groups`); detección de datos atípicos.

**Criterios**:
- reproducir el informe del club de los documentos (datos anonimizados): mismos resultados de mediana, mínimos, fórmulas y Z frente al equipo que la hoja original (test de oro).

## Fase 5 · Radares y evolución

- Cadena de normalización del dominio (Z frente a referencia o equipo, percentil, % de referencia), con tests de propiedades (monotonía, dirección, sin dato = hueco).
- `RadarChart` con dimensiones seleccionables y capas A/B/referencia/equipo.
- Evolución con cambio absoluto, %, tendencia y cambio real.

**Criterios**:
- ningún radar mezcla unidades (test);
- invertir la dirección de un test invierte su eje (propiedad);
- el radar es accesible y lleva tabla.

## Fase 6 · Informes

- Los 8 tipos del §16; comparativo con selector; grupal; radar vectorial en el PDF; frases prohibidas validadas.

**Criterios**:
- cada tipo se genera en PDF/XLSX/CSV;
- el PDF es reproducible;
- el validador rechaza «previene» sin evidencia de incidencia.

## Fase 7 · Lesiones, readaptación y RTP

- Catálogos de regiones y condiciones; protocolos versionados con fases y criterios.
- Ficha de lesión; registro de síntomas con alertas de seguridad.
- Checklist de criterios con [Avanzar de fase] manual.
- Comparativa por lesión y por fases; pantalla RTP con estados.
- `rtp_decisions` (decisión humana).
- Contenido inicial con búsquedas específicas por condición y fase (`INJURY_MODULE.md` §8).

**Criterios**:
- el software nunca muestra «apto»;
- una alerta bloquea el avance hasta revisarla;
- la comparativa solo muestra las variables del protocolo;
- la RLS de datos de salud está en la matriz.

## Fase 8 · Cliente móvil, feedback y adherencia

- Hoy: ejercicio → silueta → vídeo → series → reps → carga → RIR → completar → feedback (Fácil · Normal · Difícil · Muy difícil, como en los documentos del usuario).
- Fichaje automático (planificada, iniciada, completada, incompleta, no realizada); adherencia.
- RLS «solo publicadas» en `sessions`.

**Criterios**:
- registrar una sesión entera en el móvil sin conexión, sin duplicados;
- TTI < 2,5 s en 4G.

## Fase 9 · Ciencia y referencias

- `evidence_kind`, `origin`, estado de verificación y registro de búsquedas.
- Verificación de las referencias de los documentos del usuario.
- Icono «Fuente» en contexto; validador de frases.

**Criterios**:
- ninguna referencia sin verificar aparece como respaldo;
- cada recomendación muestra artículo, DOI/PMID, población, qué respalda y sus limitaciones.

## Fase 10 · Endurecimiento final

- Revisión ASVS L2 y PENTEST con la interfaz nueva; copias y restauración probadas en Render.
- Rendimiento con 1 000 clientes; dominio propio; revisión RGPD (DPIA actualizada con el módulo de lesiones).

**Criterios**:
- simulacro de restauración documentado;
- 0 vulnerabilidades altas;
- matrices de seguridad en verde.
