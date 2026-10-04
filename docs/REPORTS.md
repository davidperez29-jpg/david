# Informes, exportación e importación

> Fase 12. Implementa el encargo §34 (informes), §52 (importación), §53 (exportación) y §54 (Excel no es el núcleo), y `MASTER_SPECIFICATION.md` F17 y §14 (inyección CSV, auditoría de exportaciones).

## 1. Informe de cliente (§34)

Tiene 11 apartados, siempre en este orden. Si un apartado no tiene datos, el informe lo dice; nunca inventa cifras.

| # | Apartado | Contenido |
|---|---|---|
| 1 | Datos | Cliente, edad, sexo, modalidad, experiencia, disponibilidad, entrenador/a, periodo. |
| 2 | Objetivos | Principal y secundarios, con deporte. |
| 3 | Evaluación | Cribado (**solo con consentimiento** de datos de salud; si es positivo: «requiere valoración por profesional sanitario») y evaluaciones del periodo con sus tests. |
| 4 | Resultados | Último valor por test y la **referencia aplicable** (si existe una verificada para la población del cliente). |
| 5 | Evolución | Gráfico por test y tabla primera → última, cambio y **MDC95**. |
| 6 | Interpretación | Cada cambio **frente al error de medida** («dentro del error», «posible cambio», «mejora probable»…), referencias y perfil del motor de decisiones. Siempre «No es un diagnóstico». |
| 7 | Planificación | Plan activo, semana y fase actuales, revisiones; ajustes aceptados o deshechos en el periodo. |
| 8 | Adherencia | 4 y 12 semanas; semanas con sesiones realizadas y carga interna. |
| 9 | Feedback | RPE de sesión, bienestar medio, comentarios del cliente; molestias **solo con consentimiento**. |
| 10 | Recomendaciones | Las del entrenador (texto libre) y solo las propuestas del motor que **aceptó**, con sus fuentes y DOI. |
| 11 | Próxima reevaluación | Semana de evaluación del plan, o la regla del motor (cada N semanas desde la última evaluación). |

**Reproducible.**

- Al generar el informe se congela una **instantánea** (`reports.snapshot`) con su **sha256** (`reports.hash`).
- La pantalla, el PDF, el Excel y el CSV se dibujan desde esa instantánea con el mismo modelo de bloques: texto, lista, tabla y gráfico (`buildClientReport`, dominio puro).
- Si los datos del cliente cambian después, el informe no cambia.
- El PDF es idéntico **byte a byte** en cada descarga: sus fechas internas salen de la instantánea. Lo comprueba un test de integración.
- La pantalla muestra «íntegro» si el hash coincide.

**Compartido con el cliente** (pendiente técnico 4).

- El entrenador decide: en la página del informe, «Compartir con el cliente» o «Dejar de compartir». Queda auditado (`reports.shared_at`, `shared_by`).
- Antes de compartir puede ver **la versión del cliente** («Ver la versión del cliente»).
- El cliente lo encuentra en su app, en **Progreso → Informes de tu entrenador**, y puede descargarlo en PDF (descarga auditada como `export`, `version: client`).
- **Versión del cliente** (`clientReportView`, dominio puro, misma instantánea): 7 apartados en lenguaje sencillo.

  | # | Apartado | Contenido |
  |---|---|---|
  | 1 | Tu periodo | Fechas y entrenador. Si el cribado es positivo: «requiere valoración por profesional sanitario». |
  | 2 | Tus objetivos | Objetivos, con el principal. |
  | 3 | Lo que has entrenado | Sesiones hechas de las planificadas (4 y 12 semanas) y esfuerzo medio. |
  | 4 | Cómo vas | Gráfico por test y una frase: de dónde a dónde y qué significa frente al margen de error (los mismos textos que la pantalla de Progreso). |
  | 5 | Tu plan | Plan, semana y fase; cuántas veces se ajustó. |
  | 6 | Mensaje de tu entrenador | Las recomendaciones que el entrenador escribió (sección 10). |
  | 7 | Próxima evaluación | Fecha aproximada. |

- **No incluye**: tablas técnicas (MDC95, carga interna en UA), perfil del motor de decisiones, necesidades, referencias normativas ni la lista de fuentes. El informe técnico completo sigue siendo solo para el equipo; el cliente puede pedir todos sus datos con su derecho de acceso (`SECURITY.md` §2.2).
- **Seguridad**: el cliente solo ve informes propios y compartidos. Lo comprueban la aplicación y la RLS (política `reports_select`, migración `0032`); dejar de compartir lo oculta al instante.

**PDF.** Se genera con **pdfkit**, en Node y sin navegador en el servidor.

- Es una desviación consciente de la especificación (§5: Playwright/Chromium en un worker): evita depender de Chromium en el despliegue y facilita la reproducibilidad.
- El diseño en pantalla y el del PDF comparten el modelo de bloques, no el HTML.
- Las fuentes estándar del PDF (WinAnsi) no admiten algunos símbolos: «→» se escribe «->», «≥» se escribe «>=» y los emojis se omiten.

## 2. Exportación (§53)

`GET /exports?entity&format`, en CSV o XLSX:

| Entidad | Filas |
|---|---|
| `clients` | Clientes visibles: datos, experiencia, objetivo principal. |
| `assessments` | Resultados: cliente, fecha, test, lado, valor, intentos, validez. |
| `plan` | Plan (por `planId` o el del cliente): fase, semana, sesión, bloque, ejercicio, prescripción. |
| `sessions` | Series registradas: ejercicio realizado, carga, repeticiones, RIR (autoinformado; vacío si no se informó), RPE. |
| `progress` | Evolución por test, con la valoración del cambio frente al error de medida. |

- **Alcance**: la RLS limita cada exportación a lo que ve quien la pide (ADMIN: la organización; entrenador: sus clientes).
- **Auditoría**: cada exportación y cada descarga de un informe queda auditada (`action = export`).
- **Inyección CSV/XLSX**: las celdas de texto que empiezan por `= + - @` (o tabulador/retorno) se prefijan con `'`. Los números siguen siendo números.
- **Formato CSV para Excel en español**: separador `;`, coma decimal y BOM UTF-8.
- **Datos de salud**: no se exportan declaraciones de salud. La exportación completa del interesado (RGPD) está en `SECURITY.md` §2.2 (Fase 13).

## 3. Importación validada (§52)

Admite CSV (separador `;` o `,`, detectado automáticamente) o XLSX (primera hoja). Hasta 1 000 filas y 2 MB.

1. **Validar** (`POST /imports`):
   - se leen las cabeceras: sin acentos, sin distinguir mayúsculas y con alias;
   - si falta una columna obligatoria, se rechaza el archivo;
   - cada fila se valida con el esquema zod del contrato, que convierte la entrada en español a valores canónicos: `dd/mm/aaaa`, coma decimal, `mujer`/`hombre`, `presencial`/`online`/`híbrido`, intentos `30,1|31,4`, DOI que empieza por `10.`…;
   - después se valida contra la base de datos: catálogos (objetivos, deportes, patrones, material, tests), clientes asignados, tests por lado y duplicados (en el archivo y en la base).
2. **Revisar**: la vista previa muestra cada fila con sus errores por columna y el valor tal como venía en el archivo. **No se ha escrito nada.**
3. **Confirmar** (`POST /imports/{id}/confirm`): se importan solo las filas válidas, cada una con el **caso de uso normal**, así que aplican los mismos permisos, la misma auditoría y la misma RLS. Si una fila falla en ese momento, se marca con su error y el resto sigue. También se puede cancelar.

| Entidad | Cómo entra |
|---|---|
| Clientes | Alta normal (asignado a quien importa si es entrenador). Duplicado por email. |
| Ejercicios | **Borrador** con `needs_review` y `source = import`: se revisan antes de publicar. |
| Evaluaciones | Una evaluación por cliente, fecha y contexto, y un resultado por fila. Solo para clientes asignados (o de la organización, si es ADMIN). |
| Referencias | Fuentes bibliográficas **no verificadas**: no alimentan recomendaciones hasta que ADMIN las verifique (Fase 4). |

- **Plantillas** con un ejemplo, y en XLSX una hoja de ayuda: `GET /imports/templates/{entity}?format=csv|xlsx`.
- El archivo original **no se guarda** (minimización); solo las filas validadas del trabajo de importación.

## 4. Permisos

| Permiso | ADMIN | Entrenador | Cliente |
|---|---|---|---|
| `reports:generate` | organización | asignados | — |
| `reports:read_shared` (versión del cliente) | organización | asignados | propios, solo compartidos |
| `data:export` | organización | asignados | — |
| `data:import` | organización | organización (más el permiso de la entidad: `clients:create`, `library:write`, `assessments:write`, `science:write`) | — |

## 5. Interfaz

- **Informes** (menú):
  - enlaces al informe de cada cliente;
  - formulario de exportación (qué, cliente, fechas, formato);
  - historial de importaciones.
- **Informes → Nueva importación**: tipo, plantillas, subida y columnas admitidas. Después, la vista previa con errores y «Importar N filas válidas» o «Cancelar».
- **Ficha → Informes**: generar (periodo y recomendaciones propias), informes anteriores con su PDF y exportaciones del cliente.
- **Página del informe**: los 11 apartados con gráficos, descargas en PDF, Excel y CSV, huella e integridad; compartir con el cliente y vista previa de su versión.
- **App del cliente → Progreso → Informes de tu entrenador**: los informes compartidos, en lenguaje sencillo, con su PDF.

## 6. Pendiente

- PDF del plan.
- Importación de valores de referencia normativos.
- Trabajos en segundo plano para archivos grandes (hoy, todo es síncrono y cabe en 1 000 filas).
