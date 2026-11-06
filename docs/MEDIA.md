# Gestión audiovisual de los ejercicios

> **Estado: diseño pendiente de aprobación.** No se ha creado ninguna cuenta de almacenamiento ni se ha conectado ningún servicio, y ninguna de las alternativas se ha probado con TrainPro. Precios consultados el **6 de noviembre de 2026** mediante búsquedas web: [O] = página o documentación oficial vista a través del buscador; [T] = terceros. Hay que confirmarlos en las páginas oficiales antes de decidir.

## 1. Requisitos (R1-B)

Cada variante tiene **tres recursos independientes**:

| Recurso                       | Contenido                                                                               | Obligatorio              | Duración   |
| ----------------------------- | --------------------------------------------------------------------------------------- | ------------------------ | ---------- |
| **Silueta estática**          | Ilustración de **esa variante concreta**                                                | Sí (con alternativa, §3) | —          |
| **Vídeo breve**               | Ejecución general, sin explicación                                                      | No                       | **< 15 s** |
| **Vídeo ampliado** (opcional) | Aspectos técnicos, errores frecuentes, colocación, variantes o indicaciones específicas | No                       | **≤ 45 s** |

- Cada recurso se crea, sustituye, retira y publica **por separado**.
- El vídeo ampliado **no sustituye** al breve: ocupan huecos distintos y la interfaz nunca muestra el ampliado en el lugar del breve. Propuesta: solo se puede publicar el ampliado si existe el breve (P-28).
- El cliente reproduce los vídeos **dentro de TrainPro**.
- Si un vídeo no carga, la silueta y las instrucciones siguen visibles (§6).

## 2. Situación actual

- `silhouette`: uno de **17 pictogramas** SVG propios (sentadilla, bisagra, empuje…), **compartidos** por varias variantes. No corresponde a cada variante concreta.
- `media.videoUrl`: un enlace externo que se abre **fuera** de TrainPro, con su aviso. `media.imageUrl` no se usa en la interfaz.
- La CSP no tiene `media-src` (se aplica `default-src 'self'`) y `frame-src` es `'none'`: hoy no se podría reproducir un vídeo de otro dominio ni incrustar un reproductor externo.

## 3. Modelo propuesto

### 3.1 Entidades

| Entidad         | Campos principales                                                                                                                                                                                                                                                                      |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `media_asset`   | id, owner_type (`system` \| `trainer`), owner_trainer_id, kind (`image` \| `video`), storage_provider, storage_key, mime_type, codec, width, height, duration_ms, size_bytes, checksum_sha256, poster_asset_id, captions_asset_id, has_audio, status, rights_id, created_at, created_by |
| `variant_media` | variant_id, slot (`silhouette` \| `demo_short` \| `demo_extended`), asset_id, published_at, published_by, alt_text. **Único (variant_id, slot)**: un recurso publicado por hueco                                                                                                        |
| `media_rights`  | id, holder, license (`own` \| `commissioned` \| `licensed`), consent_document_ref (cesión de imagen de las personas que aparecen), valid_until, notes                                                                                                                                   |

El archivo vive **fuera de la base de datos**, en el almacenamiento elegido (§7). La base de datos guarda solo la referencia y los metadatos.

Ciclo de vida de `media_asset.status`: `uploaded` → `processing` → `ready` → `archived` (o `rejected` con motivo). Solo un recurso `ready` se puede publicar en un hueco. Sustituir un vídeo publica uno nuevo y archiva el anterior, que se conserva mientras lo referencie algún informe o copia.

### 3.2 Silueta por variante

- **Propuesta:** la silueta de la variante es una imagen propia (SVG preferentemente) que gestiona la administración del catálogo, en el hueco `silhouette`.
- El pictograma por tipo que existe hoy pasa a ser la **última alternativa** cuando una variante aún no tiene la suya, y la interfaz lo indica («Silueta genérica»).
- Producir una silueta por variante (44 en el catálogo demo) es trabajo de diseño: se puede hacer con el estilo de los pictogramas actuales o encargarse (coste humano, §8).

### 3.3 Copias adaptadas y visibilidad

- Una copia adaptada (`derivedFrom`) **reutiliza** los recursos del original sin duplicar archivos, hasta que el entrenador sustituye un hueco. Entonces se crea un recurso suyo y el original no cambia.
- Un recurso tiene la visibilidad de la variante que lo usa. Los de ejercicios privados o personalizados **no tienen URL pública**: se sirven con URL firmada de corta duración, tras comprobar `canViewExercise` en el caso de uso (§9).

## 4. Formatos y límites

| Recurso        | Formato de entrega                                                                                                     | Límites propuestos                      |
| -------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Silueta        | **SVG** (vectorial, ligero, se adapta a los colores de la marca) o WebP/PNG con fondo transparente                     | ≤ 200 KB; texto alternativo obligatorio |
| Vídeo breve    | **MP4 + H.264** (perfil Main o High, 8 bits, 4:2:0), **sin audio**, 720p, 24–30 fps, `faststart` (índice al principio) | **< 15 s**; ≤ 4 MB; ~1–1,5 Mbit/s       |
| Vídeo ampliado | MP4 + H.264, con audio AAC si hay voz; **subtítulos WebVTT obligatorios si hay voz**                                   | **≤ 45 s**; ≤ 12 MB; ~1,5–2 Mbit/s      |
| Póster         | WebP del primer fotograma o la silueta                                                                                 | ≤ 100 KB                                |

- **Por qué H.264:** es el códec que reproducen de forma general los navegadores actuales de escritorio y móvil, incluido Safari en iOS. AV1 o VP9 en WebM ocupan menos, pero exigirían una segunda versión de cada vídeo: se dejan para más adelante si el coste de transferencia lo justifica.
- **HEVC (H.265)**, el formato por defecto de muchos iPhone (archivos `.mov`), **no se acepta como formato de entrega** porque su soporte en navegadores no es uniforme. Debe convertirse a H.264.
- **Tamaños orientativos:** 15 s a 1,5 Mbit/s ≈ 2,8 MB; 45 s a 2 Mbit/s ≈ 11 MB.
- **Relación de aspecto:** cuadrada (720 × 720) para el breve, porque cabe bien en vertical y en horizontal; 16:9 o 4:5 para el ampliado. Decisión pendiente (P-29).
- **Preajuste reproducible** para la administración del catálogo: se documentará el comando de conversión (por ejemplo, con ffmpeg en el ordenador de quien prepara el contenido) para que todos los vídeos sigan los mismos parámetros. No requiere ningún servicio externo.

## 5. Reproducción dentro de TrainPro

Con el elemento nativo `<video>` de HTML, **sin dependencias nuevas**:

- **Vídeo breve:** `playsinline`, `muted` y `loop`, porque iOS solo reproduce automáticamente y sin pantalla completa los vídeos silenciados con `playsinline` [T]. Reproducción automática solo si el usuario no pide movimiento reducido (`prefers-reduced-motion`). Siempre con botón visible de **pausa y reproducción**, que es obligatorio en contenido en movimiento que dura más de 5 s (WCAG 2.2.2).
- **Vídeo ampliado:** se abre en una hoja deslizante sobre la ficha, con controles y sonido. **Nunca** se reproduce solo.
- `preload="metadata"`: no se descarga el vídeo completo hasta que hace falta. Si `navigator.connection.saveData` está activo (no existe en todos los navegadores), no hay reproducción automática.
- **Requisitos del servidor:** respuestas parciales (HTTP 206, peticiones por rangos), que Safari necesita para reproducir MP4; `Content-Type: video/mp4`; caché larga con nombres de archivo que incluyen la suma de comprobación. Se comprobará en pruebas con el almacenamiento elegido.
- **CSP:** añadir `media-src 'self' https://<dominio-de-medios>` e `img-src` para los pósters de ese dominio. `frame-src` sigue en `'none'`: no se incrustan reproductores de terceros.

## 6. Si un vídeo no carga

1. La **silueta** y las **instrucciones en texto** están siempre en la ficha. El vídeo es un complemento: no hay información que solo esté en el vídeo.
2. Si el vídeo falla (evento `error`, o sin datos tras un tiempo de espera), se muestra la silueta con el aviso «No se ha podido cargar el vídeo» y un botón «Reintentar».
3. **Sin conexión**, se muestran la silueta y las instrucciones guardadas de la sesión del día. Guardar también los vídeos breves para usarlos sin conexión (opcional, solo con wifi y dentro de la cuota del navegador) se evaluará en la Fase 7: el almacenamiento del navegador en iOS puede borrarse, y servir vídeo con peticiones por rangos desde el _service worker_ es complejo (P-30).

## 7. Almacenamiento: alternativas

| Criterio                     | Supabase Storage                                                                           | Cloudflare R2                                      | Bunny Stream                                                                                   | Archivos de la propia aplicación                        | VPS propio                    |
| ---------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ----------------------------- |
| **Encaje**                   | Mismo proveedor que la base de datos preferida (P-01), con permisos sobre los archivos     | Almacenamiento de objetos compatible con S3        | Plataforma de vídeo con conversión y reproductor                                               | Solo catálogo global pequeño                            | Todo propio                   |
| **Gratis**                   | 1 GB y 5 GB de transferencia en Free [T]                                                   | 10 GB-mes, 1 M operaciones A y 10 M B al mes [O]   | Prueba de 14 días [T]                                                                          | Incluido en el alojamiento                              | —                             |
| **Precio**                   | Pro: 100 GB incluidos, luego ~0,021 $/GB-mes; 250 GB de transferencia, luego 0,09 $/GB [T] | 0,015 $/GB-mes; **sin coste de transferencia** [O] | 0,01 $/GB-mes en Frankfurt; entrega en Europa y Norteamérica 0,01 $/GB [O]; mínimo 1 $/mes [T] | La transferencia cuenta en el plan del alojamiento      | Disco y 20 TB/mes [T]         |
| **Conversión de vídeo**      | No conocida (a verificar)                                                                  | No (Cloudflare Stream es otro producto de pago)    | Incluida [T]                                                                                   | No                                                      | Propia (ffmpeg)               |
| **URLs firmadas / privadas** | Sí, con políticas de acceso                                                                | Sí (URLs prefirmadas)                              | Sí (tokens; a verificar)                                                                       | No (todo público)                                       | Propias                       |
| **Región UE**                | La del proyecto (Frankfurt, París…)                                                        | Existe una opción de jurisdicción UE (a verificar) | Frankfurt como región por defecto [O]                                                          | La del alojamiento                                      | Alemania o Finlandia [T]      |
| **Encargado de tratamiento** | El mismo que la base de datos                                                              | Uno más (DPA)                                      | Uno más (DPA)                                                                                  | El del alojamiento                                      | Nosotros                      |
| **Riesgos**                  | Coste de transferencia por encima de lo incluido                                           | Otra cuenta y otro proveedor                       | Reproductor en `iframe` (exigiría abrir `frame-src`) salvo usar sus MP4 directos               | Aumenta el tamaño del despliegue; no sirve para subidas | Operación y seguridad propias |

### Recomendación

1. **Catálogo global** (administración): preparar los vídeos sin conexión con el preajuste del §4 y guardarlos en el **mismo almacenamiento que la base de datos** (Supabase Storage, si se aprueba P-01). Evita otro encargado del tratamiento y, con el volumen previsto, cabe en lo incluido en Pro.
2. Si la transferencia creciera mucho, **Cloudflare R2** es la alternativa natural porque no cobra la salida de datos. Los puertos del almacenamiento (`MediaStorage` en `src/server`) permiten cambiar sin tocar el resto.
3. **Subidas de los entrenadores:** en una fase posterior (P-31). Hasta entonces, el entrenador puede usar los recursos del catálogo global y su enlace externo actual, que se abre fuera y se marca como tal.
4. En desarrollo, todo con archivos locales o Supabase local, **sin coste ni cuenta**.

## 8. Estimación de costes

Supuestos (orientativos, para validar): **300 variantes** con silueta (0,1 MB), vídeo breve (2,5 MB) y ampliado en todas (7 MB) ≈ **2,9 GB**. **200 clientes activos**, 12 sesiones al mes y 6 ejercicios por sesión ≈ 14.400 reproducciones del breve al mes: entre **10 GB** (con caché del navegador) y **36 GB** (sin caché) de transferencia.

| Escenario                                                          | Supabase Free            | Supabase Pro (ya contratado para la BD) | Cloudflare R2                | Bunny Stream                      |
| ------------------------------------------------------------------ | ------------------------ | --------------------------------------- | ---------------------------- | --------------------------------- |
| Desarrollo y demo local                                            | 0 €                      | —                                       | —                            | —                                 |
| Catálogo global (2,9 GB) y 10–36 GB/mes                            | **No cabe** (1 GB, 5 GB) | **+0 $** (dentro de lo incluido)        | **0 $** (gratis hasta 10 GB) | ~0,13–0,39 $ → **mínimo 1 $/mes** |
| + subidas de 20 entrenadores (50 vídeos de 10 MB cada uno ≈ 10 GB) | No cabe                  | +0 $                                    | ~0,04 $/mes                  | ~0,23–0,49 $ → mínimo 1 $/mes     |

- El **coste principal no es el almacenamiento, sino la producción**: grabar, editar, ilustrar siluetas y conseguir las cesiones de imagen. No se ha estimado: depende de si se hace con medios propios o se encarga.
- La conversión de vídeos subidos por entrenadores añadiría cómputo (un proceso propio) o una plataforma como Bunny Stream. Sin decidir.
- Ninguna cifra incluye impuestos. Se activará un **límite de gasto** en cualquier servicio que lo permita.

## 9. Privacidad, derechos y seguridad

- **Imagen de las personas:** quien aparece en un vídeo es identificable. Hace falta su **cesión de imagen por escrito** (`media_rights`) antes de publicar. Alternativa: grabar sin mostrar la cara.
- **Metadatos:** al convertir el vídeo se eliminan los metadatos del archivo (ubicación GPS, dispositivo).
- **Contenido de terceros:** solo propio, encargado o con licencia. Por defecto no se incrustan vídeos de YouTube u otras plataformas: cargan _cookies_ y rastreo de terceros, y exigirían consentimiento y abrir `frame-src`.
- **Vídeos de clientes** (por ejemplo, para revisar su técnica): **fuera de este alcance**. Si se añaden, exigirán consentimiento específico, acceso solo de su entrenador, URLs firmadas, plazo de conservación y su lugar en `DATA_RIGHTS.md`.
- **Subidas:** directas al almacenamiento con URL firmada (no pasan por el servidor de la aplicación), tipo comprobado por el contenido del archivo y no por su extensión, tamaño máximo del original (por ejemplo, 100 MB), cuota por entrenador y revisión de la administración para lo que se comparta más allá del propio entrenador.
- **Catálogo global:** sus archivos pueden ser públicos y cacheables si no contienen datos personales o hay cesión de imagen. Los de ejercicios personalizados o privados, siempre con URL firmada.

## 10. Accesibilidad

- Subtítulos en el vídeo ampliado si tiene voz (WCAG 1.2.2). El breve no tiene audio.
- Control de pausa visible (WCAG 2.2.2) y sin destellos (WCAG 2.3.1).
- Toda la información técnica está también en texto (instrucciones, puntos clave y errores frecuentes).
- Respeto de `prefers-reduced-motion`.

## 11. Riesgos técnicos

| Riesgo                                              | Mitigación                                                                             |
| --------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Safari no reproduce MP4 sin respuestas parciales    | Probar el almacenamiento elegido con iOS real antes de aprobarlo                       |
| Vídeos HEVC o pesados subidos desde el móvil        | Validación y conversión obligatorias; rechazo con motivo                               |
| La reproducción automática falla según el navegador | Póster + botón de reproducir; el vídeo nunca es imprescindible                         |
| Consumo de datos y batería en el móvil              | Sin audio, 720p, `preload="metadata"`, sin reproducción automática con ahorro de datos |
| Crecimiento de la transferencia                     | Caché larga, límite de gasto, y migrar a R2 si hiciera falta                           |
| CSP mal configurada que bloquee los vídeos          | Prueba E2E que reproduce un vídeo de ejemplo                                           |
| Caché sin conexión de vídeos                        | Fuera del alcance inicial; silueta e instrucciones sin conexión                        |
| Contenido inadecuado o con derechos de terceros     | Cesiones registradas, revisión de lo compartido y mecanismo de retirada                |

## Fuentes consultadas

- Cloudflare R2: [precios (oficial)](https://developers.cloudflare.com/r2/pricing), [Filebase (2026)](https://filebase.com/blog/cloudflare-r2-pricing-costs-savings-and-alternatives-in-2026/), [Upstash](https://upstash.com/kb/cloudflare-r2-pricing-in-2026-storage-operations-and-real-monthly-bills).
- Supabase Storage: [MakerKit (2026)](https://makerkit.dev/blog/saas/supabase-pricing), [Jet Admin (2026)](https://www.jetadmin.io/blog/supabase-pricing-2026-guide-to-plans-limits-and-real-world-costs/), [Activepieces](https://www.activepieces.com/blog/supabase-pricing-free-tier-limits-pro-costs-egress). Ver también `INFRASTRUCTURE.md`.
- Bunny Stream: [precios (documentación oficial)](https://docs.bunny.net/stream/pricing), [Bitdoze (2026)](https://www.bitdoze.com/bunny-net-review/), [Swarmify](https://swarmify.com/blog/bunny-stream-review/).
- Reproducción automática en iOS: [Pqina](https://pqina.nl/blog/fix-html-video-autoplay-not-working/), [foros de desarrolladores de Apple](https://developer.apple.com/forums/thread/690523?page=2). Pendiente de contrastar con la documentación oficial (MDN, WebKit).
