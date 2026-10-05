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
| 1 | Arquitectura + BD + autenticación + clientes (perfil principal, nivel, deporte, material, frecuencia); navegación nueva | Auth, RLS, clientes | ✅ Hecha |
| 2 | Ejercicios + sesiones (tabla tipo Excel) + planificación MES → SEMANA → SESIÓN | Biblioteca, prescripción, planes | ✅ Hecha |
| 3 | Plantillas + objetivos + niveles (filtros, usar plantilla = copia, desde cero, mis plantillas con versiones) | `plan_templates`, `plan_template_versions` | ⏳ En curso (biblioteca y versiones hechas; faltan las plantillas iniciales) |
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

## Fase 1 · Clientes, perfiles y navegación ✅

- Catálogo `programming_profiles` con 16 perfiles (los 15 del §3 más «Perfil personalizado») y sus 3 niveles; las 10 dimensiones del §4 en el dominio (`LEVEL_DIMENSIONS`).
- `clients.programming_profile_id`, `programming_level` y `sport_id` (decisión A11 sobre los nombres).
- Alta rápida en un formulario: nombre, fecha de nacimiento (edad), sexo, perfil principal, nivel, experiencia, objetivo, deporte, días por semana, lugar, material, observaciones y email.
- **Navegación nueva**: Clientes · Plantillas · Ejercicios · Tests, más el menú de usuario.
- **Inicio = Mis clientes + Entrenamientos de hoy**, con el motivo de atención en la fila del cliente.
- Ficha de cliente con 5 pestañas: Programa, Evaluación, Seguimiento, Informes y Ficha. Readaptación se añade en la fase 7. Las pestañas sin rediseñar todavía muestran el contenido actual.

**Criterios**:
- ✅ crear un cliente con perfil en 2 clics (Nuevo cliente → Guardar) rellenando 3 campos (E2E `trainer.spec.ts`);
- ✅ el menú tiene 4 entradas (E2E);
- ✅ la RLS de las tablas nuevas está en la matriz (`programming_profiles`, `scheduled_job_runs`);
- ✅ los E2E de alta y de navegación pasan;
- ✅ axe sin infracciones en las páginas nuevas (claro y oscuro).

## Fase 2 · Ejercicios, sesiones y planificación ✅

- Tabla de sesión tipo hoja de cálculo (`SessionGrid`, detalle en `PLANNING.md` §6 bis):
  - edición en celda, teclado y autoguardado con bloqueo optimista;
  - pegado desde Excel con reconocimiento de ejercicios por nombre, copiar/pegar filas, mover, duplicar, quitar y deshacer.
- Tabla del §10 (EJERCICIO · CAT. · SERIES · REPS · CARGA · RIR · RPE · DESC. · NOTAS). La celda CARGA interpreta kg, %, RPE, banda y peso corporal.
- Programa: MES → SEMANA → SESIÓN en una vista, con la tabla de la sesión debajo; duplicar sesión y semana.
- Ejercicios: resumen con silueta de músculos (o la imagen subida), categorías del §11, vídeo, progresiones/regresiones y referencias.
- El registro de sesiones (hechas y pendientes) pasa a Seguimiento.

**Criterios**:
- ✅ cambiar una carga desde el inicio con 2 clics y escribir (E2E «UX 4», 4 interacciones);
- ✅ pegar 5 filas desde Excel crea 5 ejercicios (E2E e integración; una fila errónea no añade ninguna);
- ✅ sin pérdidas con dos editores a la vez: el segundo recibe aviso, ve el cambio del primero y vuelve a escribir el suyo (E2E).

Pendiente para fases siguientes: tarjetas por ejercicio en el móvil y sugerencias del motor dentro de la celda.

## Fase 3 · Plantillas, objetivos y niveles ⏳ En curso

- ✅ Biblioteca con filtros (perfil, nivel, días, población, tipo, origen, material del cliente y texto). La duración se elige al usar la plantilla (decisión A17), no es un filtro.
- ✅ **Usar plantilla** crea una copia independiente, con la duración elegida (3, 6, 9 o 12 meses).
- ✅ **Crear desde cero**.
- ✅ **Mis plantillas**: guardar desde un plan, duplicar (también las de la plataforma), editar en la misma tabla que las sesiones, archivar, versionar (con restaurar) y reutilizar. Detalle en `PLANNING.md` §6 ter.
- ⏳ Plantillas iniciales por perfil × nivel × días (2–5), con sus fases para 3–12 meses, construidas con búsqueda específica por perfil (`SCIENCE_SYSTEM.md` §4). Incluyen las rutinas de reducción de factores de riesgo de los documentos del usuario. **Siguiente.**

**Criterios**:
- ✅ usar una plantilla no modifica el original (integración);
- ✅ cada edición de plantilla crea versión (integración y E2E; las seguidas de la misma persona se agrupan hasta que un plan la usa);
- ⏳ los filtros devuelven resultados en < 300 ms (se medirá con las plantillas iniciales cargadas).

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
- Bloquear también en el servidor la edición de planes completados o archivados. Hoy solo lo impide la interfaz; las operaciones del editor (también las de la tabla de la fase 2) ya exigen permiso y ámbito del entrenador y quedan auditadas.

**Criterios**:
- simulacro de restauración documentado;
- 0 vulnerabilidades altas;
- matrices de seguridad en verde.
