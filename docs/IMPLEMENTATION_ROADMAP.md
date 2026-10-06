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
| **0** | **Despliegue online** (Render, UE): URL + login, sin comandos | Docker, migraciones, observabilidad | ✅ Desplegado por el usuario |
| 1 | Arquitectura + BD + autenticación + clientes (perfil principal, nivel, deporte, material, frecuencia); navegación nueva | Auth, RLS, clientes | ✅ Hecha |
| 2 | Ejercicios + sesiones (tabla tipo Excel) + planificación MES → SEMANA → SESIÓN | Biblioteca, prescripción, planes | ✅ Hecha |
| 3 | Plantillas + objetivos + niveles (filtros, usar plantilla = copia, desde cero, mis plantillas con versiones, 102 plantillas iniciales) | `plan_templates`, `plan_template_versions` | ✅ Hecha |
| 4 | Evaluaciones + referencias (hoja de intentos, baterías por perfil, fórmulas, grupos/equipos) | Evaluación actual | ✅ Hecha |
| 5 | Radares + evolución (normalización, dimensiones, comparativas) | Cambio real, gráficos | ✅ Hecha |
| 6 | Informes (8 tipos, comparativo, grupal, radar en PDF) | Motor de informes | ✅ Hecha |
| 7 | Lesiones / readaptación / RTP | Seguimiento de dolor, planes | Siguiente |
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
- Ficha de cliente con 5 pestañas: Programa, Evaluación, Seguimiento, Informes y Ficha. Readaptación se añade en la fase 7 (✅, solo si hay un caso). Las pestañas sin rediseñar todavía muestran el contenido actual.

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

## Fase 3 · Plantillas, objetivos y niveles ✅

- ✅ Biblioteca con filtros (perfil, nivel, días, población, tipo, origen, material del cliente y texto). La duración se elige al usar la plantilla (decisión A17), no es un filtro.
- ✅ **Usar plantilla** crea una copia independiente, con la duración elegida (3, 6, 9 o 12 meses).
- ✅ **Crear desde cero**.
- ✅ **Mis plantillas**: guardar desde un plan, duplicar (también las de la plataforma), editar en la misma tabla que las sesiones, archivar, versionar (con restaurar) y reutilizar. Detalle en `PLANNING.md` §6 ter.
- ✅ **Plantillas iniciales**: 102 de la plataforma, detalle en `PLANNING.md` §6 ter.
  - 17 escritas a mano y 76 generadas, que cubren los 13 perfiles con plantillas genéricas × 3 niveles × 2–5 días.
  - Cada una es un bloque de 13 semanas que se repite en ciclos para 6–12 meses.
  - Se añaden 9 rutinas de reducción de factores de riesgo: aductores, isquiosurales y cuádriceps, en 3 niveles.
  - Las dosis se apoyan en evidencia verificada en PubMed, con búsquedas específicas por perfil (`SCIENCE_SYSTEM.md` §4). Hay métodos nuevos: `equilibrio-mayores`, `fuerza-paralisis-cerebral` y `actividad-fisica-oms`.

**Criterios**:
- ✅ usar una plantilla no modifica el original (integración);
- ✅ cada edición de plantilla crea versión (integración y E2E; las seguidas de la misma persona se agrupan hasta que un plan la usa);
- ✅ los filtros devuelven resultados en < 300 ms. Medido con las 103 plantillas cargadas (102 de la plataforma y 1 del centro), en el build de producción y con 20 repeticiones:
  - `GET /plan-templates`, con y sin filtros: p95 ≤ 33 ms;
  - página Plantillas: p95 ≤ 60 ms;
  - página Plantillas para un cliente, ordenada por encaje: p95 ≤ 81 ms.

## Fase 4 · Evaluaciones y referencias ✅

- Hoja de intentos tipo Excel (pegar desde Excel, Intro para bajar, guardado por fila) en cada evaluación y en la evaluación de grupo.
- Reglas de resultado: mediana, mínimo y máximo se suman a mejor, media, media de los mejores y último.
- Fórmulas derivadas como datos (`derived_formulas`), con constantes editables por centro y fórmulas propias. Bilateral con asimetría por lado.
- Tests nuevos: 6 pliegues, conducción de balón y DSI. Límites plausibles por test. Batería de equipo ampliada y batería «Función y fuerza (parálisis cerebral y discapacidad motora)».
- Referencias con condición y limitaciones, además de población y fuente.
- Grupos/equipos (`client_groups`) con informe grupal (N, media, referencia, DT, máximo, mínimo, mejor, peor, Z y bandas) y «confirmar medición» para datos atípicos o fuera de límites.
- Detalle en `EVALUATION_SYSTEM.md` §8.

**Criterios**:
- ✅ reproduce el informe del club con datos anonimizados: mismas medianas, mínimos, fórmulas, estadísticos de grupo y Z frente al equipo que la hoja original (test de oro, `club-golden.unit.test.ts`).

## Fase 5 · Radares y evolución ✅

- Cadena de normalización del dominio (`normalize.ts`): Z frente a referencia o grupo, percentil y % de referencia, con el sentido corregido. Tests de propiedades: monotonía, dirección invertida = eje invertido, sin dato = hueco, todo dentro del radar.
- `RadarChart` (SVG en servidor, sin JavaScript): dimensiones seleccionables, capas A y B, anillo neutro (media del grupo, referencia, P50 o 100 %), huecos sin dato, título y descripción accesibles, y la tabla al lado.
- **Comparativa y radar** en la pestaña Evaluación del cliente: elegir evaluación A, evaluación B, escala y dimensiones. A y B se comparan con la misma base; tabla test a test con valores reales, cambio absoluto y %, cambio real frente al error de medida y puntuación A → B.
- Evolución: además de lo que ya había (gráfico, tendencia con ≥ 3 puntos, cambio real), tabla evaluación por evaluación con el cambio absoluto y % respecto a la anterior.
- Detalle en `EVALUATION_SYSTEM.md` §9.

**Criterios**:
- ✅ ningún radar mezcla unidades: cada eje es una dimensión en una sola escala estandarizada; las unidades solo aparecen en la tabla (`normalize.unit.test.ts`, integración);
- ✅ invertir la dirección de un test invierte su eje (propiedad: Z → −Z, percentil → 100 − P, % → recíproco);
- ✅ el radar es accesible y lleva tabla (axe WCAG 2.2 AA en escritorio y móvil; E2E `radar.spec.ts`).

## Fase 6 · Informes ✅

- Los 8 tipos del §16:
  - técnico, para el cliente, inicial, seguimiento, comparativo y final;
  - rendimiento (grupo), con una ficha y un radar por persona elegida;
  - readaptación / vuelta a la competición.
- El comparativo tiene selector de evaluación A, evaluación B y referencia (grupo, normativa o ninguna).
- El radar va dibujado con vectores en el PDF.
- Hay un validador de frases prohibidas.
- Detalle en `REPORT_SYSTEM.md` §6.

**Criterios**:
- ✅ cada tipo se genera en PDF, XLSX y CSV (integración `report-kinds.int.test.ts`, los 8 tipos);
- ✅ el PDF es reproducible: idéntico byte a byte en cada descarga y aunque después cambien los datos;
- ✅ el validador rechaza «previene lesiones» sin evidencia de incidencia, y también «apto» y los diagnósticos, en el texto del entrenador. El motor no los escribe en ningún tipo (test).

## Fase 7 · Lesiones, readaptación y RTP ✅

- Catálogos de regiones y condiciones; protocolos versionados con fases y criterios.
- Ficha de lesión; registro de síntomas con alertas de seguridad.
- Checklist de criterios con [Avanzar de fase] manual.
- Comparativa por lesión y por fases; pantalla RTP con estados.
- `rtp_decisions` (decisión humana).
- Contenido inicial con búsquedas específicas por condición y fase (`INJURY_MODULE.md` §8).

**Criterios**:
- ✅ el software nunca muestra «apto» (dominio, informe, integración y E2E lo comprueban);
- ✅ una alerta bloquea el avance hasta revisarla (`injuries.int.test.ts`, `injury.spec.ts`);
- ✅ la comparativa solo muestra las variables del protocolo (integración);
- ✅ la RLS de datos de salud está en la matriz (`rls-matrix.security.test.ts`, 10 tablas nuevas) y en la seguridad por ruta (13 rutas nuevas).
- Detalle en `INJURY_MODULE.md` §10.

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
