# Biblioteca de ejercicios

> Fase 3. Capa B de la arquitectura (`MASTER_SPECIFICATION.md` §4.2): ejercicios, media, taxonomías, progresiones y sustituciones. **No contiene evidencia científica**: un ejercicio solo enlaza con métodos de la biblioteca científica por id (`exercise_method_links`), desde la pestaña «Métodos» de la ficha (Fase 4, ver `SCIENTIFIC_FRAMEWORK.md`).

## 1. Modelo

| Elemento | Dónde | Notas |
|---|---|---|
| Ejercicio | `exercises` | Patrón, región, lateralidad, planos, énfasis de contracción, velocidad prevista, nivel, espacio, complejidad 1–5, carga axial, impacto, perfil de prescripción, `supports_vbt`, contactos por repetición, textos para el cliente y para el entrenador, estado (`draft`, `published`, `archived`), procedencia (`source`, `source_ref`) y revisión (`needs_review`, `review_notes`). |
| Categorías y etiquetas | `exercise_category_links`, `exercise_tag_links` | Un ejercicio puede tener varias (§15). La primera categoría es la principal. |
| Músculos | `exercise_muscles` | Rol principal, secundario o estabilizador. El grupo (`muscles.group_slug`) es el que se usará para contar series por semana. |
| Material | `exercise_equipment` | Cada elemento es **necesario** u **opcional**. Solo el necesario filtra en búsquedas y sustituciones. |
| Instrucciones | `exercise_instructions` | Indicaciones, errores frecuentes, precauciones, preparación y ejecución, ordenadas y por audiencia (cliente, entrenador o ambos). |
| Media | `exercise_media` + `files` | Vídeo (YouTube/Vimeo) o silueta (archivo subido). |
| Relaciones | `exercise_progressions` | Grafo de progresión, regresión y variante, con los ejes que cambian. |
| Tolerancias del cliente [SALUD] | `exercise_tolerances` | Ejercicio o patrón tolerado, no tolerado o con restricción. Lo registra el staff y exige consentimiento de salud. |

### Contenido global y de organización
- **Global** (`organization_id NULL`): curado por la plataforma y de solo lectura. **«Copiar a mi organización»** crea una copia editable con `derived_from_id`.
- **De organización**: lo crea y edita el staff de la organización. **«Duplicar»** crea un borrador nuevo.

## 2. Reglas

### 2.1 Publicación
Un ejercicio solo se publica (lo que lo hace utilizable en programas visibles para clientes) si tiene:
- patrón de movimiento;
- al menos una categoría;
- al menos un músculo principal, cuando el patrón es de fuerza (tren inferior, superior, tronco, cuerpo completo o aislamiento);
- nivel;
- explicación para el cliente;
- perfil de prescripción;
- **no** estar pendiente de revisión.

Las faltas se muestran en la ficha (`publishProblems`, en `packages/domain/src/library/publish.ts`).

### 2.2 Vídeos (§28)
- Solo se aceptan URLs bien formadas de YouTube (incluidas `youtu.be` y `/shorts`) y Vimeo. Se guardan en forma canónica y se rechazan los duplicados.
- Todo vídeo nuevo queda en **«Vídeo pendiente de verificación»**. Solo una persona del staff lo marca como verificado (tras verlo, con fecha y autor) o como roto. El cliente no verá vídeos sin verificar.
- La reproducción usa `youtube-nocookie.com` y `player.vimeo.com` en un iframe con *sandbox*. La CSP solo permite esos dos orígenes en `frame-src`.

### 2.3 Siluetas (§27)
- Formatos PNG, JPEG o WebP, de 2 MB como máximo. El tipo se detecta por los **bytes**, no por la extensión ni el `Content-Type`. **No se aceptan SVG**, porque pueden contener scripts.
- Una silueta nueva sustituye a la anterior, que queda marcada como `replaced` y se conserva en el historial.
- El almacenamiento es un puerto `FileStorage`:
  - `LocalDiskStorage`, en `FILE_STORAGE_DIR` (por defecto `.data/files`);
  - `MemoryStorage` en los tests;
  - un adaptador S3 compatible en la UE, más adelante.
- Los archivos se sirven por `GET /api/v1/files/{id}` con autorización y RLS, `nosniff` y caché privada.

**Silueta de músculos** (reestructuración, fase 2): si el ejercicio no tiene silueta subida, la ficha muestra un esquema del cuerpo (delante y detrás) con los grupos musculares principales en color y los secundarios en color claro (`BodyMap`, a partir de `exercise_muscles`). Es una guía, no un dibujo anatómico. La ficha empieza con un resumen: silueta, categorías, músculos, vídeo (verificado o pendiente), progresiones, regresiones y referencias (métodos con su evidencia).

**Categorías del §11**: fuerza, hipertrofia, potencia, velocidad, pliometría, isométricos, excéntricos, core, movilidad, coordinación, equilibrio, reducción de factores de riesgo y readaptación (más las específicas que ya existían). El catálogo global se mantiene alineado con la lista en cada arranque (nombre y orden).

### 2.4 Progresiones (§30)
Una regresión A→B equivale a una progresión B→A. El sistema normaliza todas las aristas a la dirección «más exigente» y **rechaza** cualquier relación que cree un ciclo (A más difícil que B, B más difícil que C y C más difícil que A). Las variantes no tienen dirección. Implementación: `findProgressionCycle` en `packages/domain/src/library/progressions.ts`.

### 2.5 Sustituciones (§29)
`suggestSubstitutes` (dominio puro) funciona en dos pasos:
1. **Filtros duros**, cada uno con su motivo de exclusión: el mismo ejercicio, ejercicios no tolerados, patrones restringidos y material no disponible en el lugar del cliente.
2. **Puntuación explicada**. Cada punto suma con una frase legible:
   - mismo patrón;
   - mismos músculos principales;
   - músculos secundarios comunes;
   - misma categoría;
   - mismo método;
   - regresión o variante definida en el grafo;
   - con dolor: menos carga axial o impacto;
   - si es demasiado difícil o hay fatiga: menor complejidad;
   - si falta espacio: menos espacio necesario;
   - nivel adecuado para el cliente.

Los candidatos sin patrón ni músculos principales en común **no** se proponen, porque no sustituyen el estímulo.

Los pesos son **valores prácticos por defecto (nivel F)**, configurables (`DEFAULT_SUBSTITUTION_WEIGHTS`). La salida es una sugerencia: **el entrenador decide**.

### 2.6 Búsqueda
La búsqueda no distingue tildes ni mayúsculas y tolera errores de escritura. Usa un índice GIN trigram sobre `lower(immutable_unaccent(name))` y busca también en los nombres alternativos. Filtros disponibles:
- patrón, categoría, grupo muscular, nivel, región, lateralidad y contracción;
- material disponible (solo ejercicios realizables con el material elegido);
- estado, pendiente de revisión y vídeo (verificado, pendiente o sin vídeo);
- ámbito (global u organización).

## 3. Permisos

| Permiso | ADMIN | TRAINER | CLIENT |
|---|---|---|---|
| `library:read` | Organización | Organización | ✗ (verá los ejercicios dentro de sus sesiones, Fase 7) |
| `library:write` | Organización | Organización | ✗ |
| `library:publish` | Organización | Organización | ✗ |

Además, RLS de tipo `catalog`: el contenido global es de solo lectura y el de otra organización es invisible.

## 4. Banco de ejercicios de los Excel de metodología

### 4.1 Normalización
`pnpm --filter @tp/application exercise-bank:normalize <xlsx…>` genera `seed-data/exercise-bank/bank.json`.

| Fuente en los Excel | Uso |
|---|---|
| Hoja «Banco de ejercicios» (bloque, nombre, vídeo, fuente) | Nombre, categorías y patrón deducidos del bloque, vídeos y fuente. |
| Hojas «Meso N» (patrón, grupo 1.º y 2.º, cualidad) | **Prioridad** para el patrón y los músculos, porque es clasificación hecha por el entrenador. |
| Hoja «Batería preventiva» (93 fichas) | Modo de contracción, ejecución (visible solo para el entrenador), error a evitar, zona y dosis de referencia (en la descripción del entrenador). |
| Nombre del ejercicio | Material deducido por palabras completas (`barra`, `mancuerna`, `polea`, `goma`…), marcado para revisión. |

Resultado:

| Indicador | Valor |
|---|---|
| Ejercicios únicos (deduplicados sin distinguir tildes ni mayúsculas) | 1 141 |
| Con vídeo / vídeos totales | 1 007 / 1 011 |
| Patrón tomado de las hojas Meso / deducido del bloque / sin patrón | 229 / 588 / 324 |
| Con músculos principales | 421 |
| Con material deducido | 438 |
| Fichas de la batería preventiva | 93 |

Las correspondencias están en `packages/application/scripts/exercise-bank/mapping.ts`. Un test comprueba que solo usan elementos existentes del catálogo.

### 4.2 Importación
`pnpm --filter @tp/application exercise-bank:import -- --org <slug> --as <email del staff>`
- Crea **borradores** con `needs_review = true` y `review_notes`, que explican qué se dedujo y qué falta.
- Los vídeos quedan **pendientes de verificación**.
- Es idempotente: no se duplica si se vuelve a ejecutar.
- Pasa por los mismos casos de uso, así que queda auditado y bajo RLS. Tarda unos 20 s para 1 141 ejercicios.
- `pnpm db:seed:demo` lo incluye; se puede omitir con `DEMO_SKIP_BANK=1`.

### 4.3 Avisos sobre el contenido importado
- Los nombres, vídeos y fuentes («MPE-Vitafit», «Personalizado») proceden de los documentos del usuario. **Ningún vídeo se ha verificado todavía**.
- Los textos de ejecución y de error de la batería proceden del documento del cuerpo técnico citado en los Excel. Contienen justificaciones que son **opinión o práctica (G/F)**, no afirmaciones verificadas, por eso son visibles solo para el entrenador.
- La deducción por bloque es aproximada. Por ejemplo, «Box Jump» está en el bloque de acondicionamiento y se clasificó como tal; la revisión humana debe corregirlo.

## 5. API
Ver `docs/API.md` (sección «Biblioteca de ejercicios»).

## 6. Pendiente

| Elemento | Fase |
|---|---|
| Vista del ejercicio para el cliente dentro de la sesión (vídeo verificado, silueta, cues) | 7 |
| Sustitución en vivo durante la sesión, con alternativas preaprobadas | 7 |
| Comprobación periódica de enlaces de vídeo rotos (job) | 15 (requiere acceso de red a YouTube/Vimeo). La verificación de que el vídeo **muestra el ejercicio** es siempre de una persona (§8.4) |
| Set de siluetas propio | Decisión D10 |
| Adaptador S3 en la UE para archivos | Despliegue |

## 7. Biblioteca global (Fase 6)

`seed-data/exercises/global.json` contiene 92 ejercicios **publicados**, de solo lectura para las organizaciones, que usan las plantillas de planificación:
- taxonomía completa;
- material obligatorio u opcional (los dispositivos de medida y las alternativas son opcionales);
- instrucciones técnicas;
- 63 progresiones sin ciclos.

No tienen vídeo. Se pueden «Copiar a mi organización» para adaptarlos.

## 8. Revisión del banco (fase 19)

El banco importado (§4) llega como borradores **sin revisar**: hay que completarlos y comprobarlos uno a uno antes de publicarlos. La página **Ejercicios → «Revisión del banco»** (`/app/library/revision`) organiza ese trabajo.

### 8.1 Qué le falta a cada ejercicio
Las carencias son los requisitos de publicación (§2.1) más el estado de los vídeos:

| Carencia | Cuándo | ¿Impide publicar? |
|---|---|---|
| Sin revisar | Importado y aún no marcado como revisado | Sí |
| Sin patrón | No tiene patrón de movimiento | Sí |
| Sin categoría | Ninguna categoría | Sí |
| Sin músculo principal | Su patrón es de fuerza y no tiene ningún músculo principal | Sí |
| Sin nivel | — | Sí |
| Sin explicación para el cliente | — | Sí |
| Sin perfil de prescripción | — | Sí |
| Vídeo sin verificar | Algún vídeo pendiente de verificación | No |
| Vídeo roto | Algún vídeo marcado como roto | No |

- **Listos para publicar**: borradores sin ninguna carencia que impida publicar.
- **Avance**: publicados + listos, sobre el total de ejercicios del centro (sin archivados).
- La regla vive en el dominio (`reviewGaps`, `packages/domain/src/library/review.ts`). La consulta SQL de la cola la replica para filtrar y contar en la base de datos; una prueba de integración comprueba que ambas coinciden en cada carencia.

### 8.2 La cola
- Cada carencia es un filtro con su recuento. También se filtra por nombre, patrón, categoría y estado (borrador o publicado).
- Orden por nombre, 50 por página. Solo ejercicios **del centro**: los globales son de la plataforma (§7).
- **«Revisar»** abre la ficha con la cola: una barra dice qué le falta, cuántos quedan detrás y enlaza **«Siguiente»** de la misma cola. Así se completa el banco uno a uno sin volver a la lista.

### 8.3 Cambios en bloque
Se marcan ejercicios y se aplica **un cambio** a todos (máximo 100 por vez):
- poner patrón, nivel o perfil de prescripción;
- añadir una categoría (si es la primera, queda como principal) o un músculo principal;
- marcar como revisados;
- publicar (**solo los completos**; los demás se listan con «Le faltan datos para publicarse»);
- archivar (pide confirmación; se pueden volver a borrador).

La selección es de la página que se ve: al pasar de página o cambiar de filtro empieza vacía, y solo se envían los ejercicios en pantalla. «Aplicar» no se desactiva. Si falta algo, lo dice («Marca al menos un ejercicio en la tabla.» o «Elige un valor para el cambio.») y lleva el foco al control (fase 21).

Reglas (A67):
- **Los textos nunca se escriben en bloque**: la explicación para el cliente y las instrucciones son propias de cada ejercicio y se escriben con «Revisar».
- Cada ejercicio se cambia, se **versiona** y se **audita por separado** (motivo «Revisión del banco (en bloque)»).
- La lista envía la versión que la persona vio. Un ejercicio que alguien cambió mientras tanto **se omite**, no se sobrescribe.
- Primero se actualiza el ejercicio con esa versión, lo que además lo bloquea. La categoría o el músculo solo se escriben si la versión coincidió. Si llegan dos cambios a la vez sobre el mismo ejercicio, uno se aplica y el otro se omite (P-24, fase 21).
- También se omiten los globales, los archivados y los que no son del centro. Un ejercicio omitido no detiene a los demás: el resultado los lista con su motivo.
- Si el valor ya era ese, cuenta como «ya estaban así» y no crea versión.
- Permisos: `library:write`; publicar exige `library:publish`. Es una operación pesada en el límite de peticiones.

### 8.4 Vídeos
**«Verificar vídeos»** (`/app/library/revision/videos`) muestra los vídeos pendientes **de uno en uno**, incrustados con `youtube-nocookie` o Vimeo. Usa el mismo componente que la ficha y el reproductor de sesión (`VideoEmbed`): con `sandbox`, sin abrir ventanas ni navegar la página y con solo el origen como *referrer* (P-27, fase 21).
- «He visto el vídeo: es correcto» o «Está roto o no corresponde»; el siguiente ocupa su lugar y se anuncia junto con el veredicto («Vídeo de «X» marcado como roto. Ahora: vídeo de «Y».»).
- «Saltar» lo deja pendiente para otro momento.
- **Nada se verifica automáticamente** (A68): comprobar que un enlace carga no dice si muestra este ejercicio con buena técnica.
- La auditoría guarda el estado anterior y el nuevo.
- Hasta que se verifica, el cliente ve el aviso de vídeo pendiente (§2.2).

### 8.5 Estado del banco en la demo
Recién cargada la demo (`pnpm db:seed:demo`), la revisión muestra:

| | Ejercicios |
|---|---|
| Total del centro | 1 141 (0 publicados, 0 listos) |
| Sin revisar | 1 141 |
| Sin patrón | 324 |
| Sin músculo principal | 144 (de los que ya tienen un patrón de fuerza; al poner patrón a los 324 puede aparecer en más) |
| Sin nivel | 1 141 |
| Sin explicación para el cliente | 1 141 |
| Sin categoría · sin perfil | 0 · 0 |
| Con vídeo sin verificar | 1 007 (1 011 vídeos) |

Patrón, músculo y nivel se pueden completar en bloque por grupos (filtrando por categoría o por nombre). La **explicación para el cliente** de los 1 141 hay que escribirla una a una: es el trabajo que más tiempo llevará.

