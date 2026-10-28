# Publicar la aplicación online, gratis (Render + Neon, UE)

> **Resultado**: una dirección web (`https://…onrender.com`) donde entrar con email y contraseña desde cualquier navegador u ordenador.
>
> - **Gratis y sin fecha de caducidad**: la web va en el plan gratuito de Render y la base de datos en el plan gratuito de Neon. Ninguno de los dos caduca (fase 22 de la reestructuración).
> - **Sin comandos** y sin instalar nada: todo se hace en las webs de Neon y de Render.
> - **Tiempo**: unos 25 minutos la primera vez, casi todo esperando.
> - **Datos en la UE**: región Frankfurt en los dos.

## Antes de empezar

- Una cuenta de GitHub con acceso al repositorio `davidperez29-jpg/david`. La tienes.
- Un email y una contraseña para el **administrador**:
  - la contraseña debe tener **al menos 12 caracteres** y ser distinta del email;
  - puede ser una frase, por ejemplo `entreno-en-crevillente-2026`.

**Por qué dos servicios.** Render ofrece la web gratis para siempre, pero su base de datos gratuita caduca a los 30 días. Neon ofrece una base de datos PostgreSQL gratuita que no caduca. La web de Render se conecta a la base de Neon.

## Paso 1 · Crear la base de datos en Neon

1. Abre **https://neon.tech** y pulsa **Sign up**. Puedes registrarte con tu cuenta de GitHub.
2. Crea un proyecto (**New project**):

   | Campo | Qué poner |
   |---|---|
   | Nombre | `plataforma` |
   | Versión de PostgreSQL | **16** |
   | Región | **AWS Europe Central 1 (Frankfurt)** |

   La región no se puede cambiar después: comprueba que es Frankfurt.
3. En el panel del proyecto pulsa **Connect** y copia la **cadena de conexión**. Empieza por `postgresql://` y contiene la contraseña de la base de datos: **no la compartas**.
   - Cópiala tal cual. Da igual que tenga `?sslmode=require&channel_binding=require` o que sea la «pooled» (`-pooler` en el nombre): la aplicación la adapta.
   - Guárdala un momento: la pegarás en el paso 3.

## Paso 2 · Crear la cuenta de Render

1. Abre **https://render.com** y pulsa **Get Started** (o **Sign up**).
2. Elige **GitHub** para registrarte. Así Render ya puede ver tus repositorios.
3. Cuando GitHub pregunte qué repositorios puede ver Render, permite **`david`** (o todos).

## Paso 3 · Crear la aplicación desde el «Blueprint»

El repositorio incluye un archivo (`render.yaml`) que le dice a Render qué crear: la aplicación web, en el plan gratuito.

1. En el panel de Render pulsa **New +** → **Blueprint**.
2. Elige el repositorio **`davidperez29-jpg/david`**.
3. En **Branch** elige **`claude/training-platform-system-hm10nq`**.
4. Pon un nombre al Blueprint, por ejemplo «Plataforma entrenamiento».
5. Render muestra lo que va a crear: `plataforma-entrenamiento` (web, Frankfurt, **Free**). Ya no crea ninguna base de datos de Render.
6. Rellena los datos que pide:

   | Campo | Qué poner |
   |---|---|
   | `DATABASE_URL` | La cadena de conexión de Neon (paso 1) |
   | `ADMIN_EMAIL` | Tu email (con él entrarás) |
   | `ADMIN_PASSWORD` | Tu contraseña (mínimo 12 caracteres) |
   | `ADMIN_NAME` | Tu nombre y apellidos |
   | `ORG_NAME` | Nombre de tu centro o club |

   La clave de cifrado de los datos no la tienes que poner: la genera Render.
7. Pulsa **Apply** (o **Deploy Blueprint**).

## Paso 4 · Esperar a que esté lista

- La primera vez Render construye la aplicación: **10–15 minutos**. Lo verás en el servicio `plataforma-entrenamiento` → **Events/Logs**.
- El primer arranque prepara la base de datos, carga la biblioteca (92 ejercicios, 51 tests, 102 plantillas y la base científica) y crea tu usuario administrador. En el plan gratuito, con poca CPU, tarda **unos 3 minutos** más.
- Cuando el estado sea **Live**, arriba aparece la dirección, por ejemplo `https://plataforma-entrenamiento-abcd.onrender.com`.

## Paso 5 · Entrar

1. Abre la dirección y entra con tu email y contraseña.
2. La primera vez, la aplicación pide **activar la verificación en dos pasos** (obligatoria para administradores, porque hay datos de salud):
   - instala en el móvil una app de códigos: Google Authenticator, Microsoft Authenticator o similar;
   - escanea el código QR que aparece;
   - guarda los códigos de recuperación.
3. **Guarda la dirección en favoritos**: es tu aplicación, en el ordenador y en el móvil. Para tus clientes, invítales desde su ficha y ellos entran en la misma dirección.
4. **Tenla como una app**, gratis y sin tienda: en **Ajustes** → **App en el móvil y el ordenador**. En Chrome o Edge hay un botón **Instalar la app**. En el iPhone: **Compartir** → **Añadir a pantalla de inicio**.

## Qué incluye el plan gratuito y qué límites tiene

| Servicio | Gratis | Límites | Si se superan |
|---|---|---|---|
| **Render** (la web) | Sí, sin fecha de caducidad | Se duerme tras **15 min** sin visitas; la siguiente visita tarda **alrededor de 1 minuto** en despertarla. 750 horas al mes, suficientes para tenerla encendida todo el mes. 500 minutos de construcción al mes: unas 30 actualizaciones | La web se pausa hasta el mes siguiente. Los datos no se tocan |
| **Neon** (la base de datos) | Sí, sin fecha de caducidad | **0,5 GB**: la aplicación con su biblioteca ocupa unos 35 MB y la demo completa 43 MB. **100 horas de cómputo al mes**: la base se apaga sola tras 5 min sin uso y solo cuenta el tiempo encendida. 5 GB de transferencia al mes | La base se pausa hasta el mes siguiente y la app no puede abrir datos. No se borra nada |

- **Para un centro pequeño, estos límites sobran.** Si se quedaran cortos, se puede pasar a un plan de pago en cualquier momento sin perder nada.
- **«Gratis de por vida» depende de que Render y Neon mantengan sus planes gratuitos.** Si algún día los cambian, los datos se pueden trasladar a otro proveedor: la aplicación funciona con cualquier PostgreSQL.
- **La web «duerme».** Al despertar ya no repite la instalación: el arranque solo la hace cuando hay una versión nueva o cambias un ajuste (fase 22).
- Precios y límites consultados el 18/10/2026: **[REQUIERE VERIFICACIÓN]** en las webs de Render y Neon antes de empezar.

## Copias de seguridad

- **Neon gratis guarda el historial de las últimas 6 horas**: puedes volver la base a cualquier momento de ese intervalo (Neon → **Restore**).
- **Copia mensual gratuita dentro de Neon**: en el proyecto → **Branches** → **Create branch**, con un nombre como `copia-2026-11`. Guarda la base tal como está en ese momento. El plan gratuito permite 10 ramas. Borra las más antiguas cuando ya no las necesites.
- Para copias automáticas largas (7 días o más), hace falta un plan de pago de Neon. Con datos reales de clientes, valóralo.
- El nombre exacto de los menús puede variar: **[REQUIERE VERIFICACIÓN en el panel de Neon]**.

**Simulacro de restauración** (cada 6 meses; también antes de empezar a usarlo con clientes reales):

1. En Neon, crea una rama desde un instante de hace unos minutos.
2. En Render, crea un servicio web temporal desde el mismo repositorio, con las mismas variables de entorno, pero con `DATABASE_URL` = la cadena de conexión de esa rama. Usa **la misma `APP_ENCRYPTION_KEY`**: sin ella, los datos cifrados no se pueden leer.
3. Comprueba que `https://<servicio-temporal>/api/ready` responde `ready` y que puedes entrar y ver tus clientes.
4. Apunta la fecha y cuánto tardó en `OPERATIONS.md` → «Registro de simulacros».
5. Borra el servicio temporal y la rama.

Si una restauración real sustituye a la base de producción, vuelve a aplicar después las supresiones RGPD hechas desde la copia (`OPERATIONS.md` §6). Si no, las personas suprimidas desde entonces volverían a aparecer.

## Datos de ejemplo (opcional)

Para ver la aplicación con clientes, planes y evaluaciones ficticios:
1. Ve a `plataforma-entrenamiento` → **Environment** → `DEMO_DATA` = `true`.
2. Pulsa **Save, rebuild and deploy**.

Se crean el «Centro Demo» y sus usuarios (`lucia.moreno@example.com`, `marcos.villalba@example.com`…). Comparten **tu misma contraseña de administrador**; la contraseña pública de la demo no funciona online.

## Dominio propio (opcional)

Para usar una dirección como `entrenamiento.tucentro.es` en lugar de `….onrender.com`:

1. En `plataforma-entrenamiento` → **Settings** → **Custom Domains** → **Add Custom Domain**, escribe el dominio.
2. Render te indica el registro DNS que debes crear. Normalmente es un `CNAME` del subdominio hacia `plataforma-entrenamiento.onrender.com`. Créalo en el panel de tu proveedor de dominio.
3. Espera a que Render marque el dominio como verificado. El certificado HTTPS lo emite Render solo.
4. En **Environment**, pon `APP_BASE_URL` = `https://entrenamiento.tucentro.es` y pulsa **Save, rebuild and deploy**. Así los enlaces de invitación usan el dominio nuevo.
5. Entra por la dirección nueva. Las sesiones abiertas en la antigua no se trasladan: hay que volver a iniciar sesión.

La protección CSRF compara el origen de cada petición con el dominio por el que se entra, así que no hace falta configurar nada más. El nombre exacto de los menús puede variar: **[REQUIERE VERIFICACIÓN en el panel de Render]**.

## Actualizaciones

- Cada vez que se publica un cambio de la aplicación en la rama, Render vuelve a desplegar **solo**, en unos 10–15 minutos. Los cambios que solo tocan documentación o pruebas no la reconstruyen, para no gastar minutos de construcción.
- Tus datos se conservan: las actualizaciones nunca borran la base de datos.

## Si ya la habías publicado con la base de datos de Render

Las versiones anteriores creaban una base de datos de Render, que caduca a los 30 días. Para pasar a Neon sin perder nada, los datos hay que copiarlos de una base a otra. Ese paso necesita comandos (`pg_dump` y `pg_restore`): pídemelo y te preparo los pasos, o lo hago yo si me das acceso. Si aún no tienes datos reales, basta con borrar el Blueprint antiguo y crear uno nuevo con esta guía.

## Si algo falla

| Síntoma | Qué hacer |
|---|---|
| La página de inicio de sesión dice «Todavía no hay ninguna cuenta de administrador» | La contraseña no cumplía la política. En **Environment**, corrige `ADMIN_PASSWORD` (≥ 12 caracteres, distinta del email) y pulsa **Manual Deploy → Deploy latest commit** |
| El despliegue falla con `password authentication failed` o `could not translate host name` | La cadena de conexión de Neon está mal copiada. Vuelve a copiarla (Neon → **Connect**) en **Environment** → `DATABASE_URL` |
| La app deja de cargar datos a final de mes | Se agotaron las horas gratuitas de Neon del mes. Se recuperan el día 1, o pasando a pago |
| El despliegue falla por otro motivo | Servicio → **Logs**: copia las últimas líneas y envíamelas |
| Tarda en cargar la primera vez que entras | Se estaba despertando (alrededor de 1 minuto). Es normal en el plan gratuito |
| Un cliente o alguien del equipo ha olvidado su contraseña | La app no envía correos. Su entrenador (o un administrador) crea un enlace en la app: ficha del cliente → **Crear enlace para nueva contraseña**, o **Usuarios** → **Nueva contraseña**. Se lo mandas por WhatsApp; vale 24 horas y una sola vez |
| Has olvidado tu contraseña de administrador | En **Environment**, cambia `ADMIN_PASSWORD` por una contraseña nueva (≥ 12 caracteres, distinta del email) y pulsa **Manual Deploy → Deploy latest commit**. Al arrancar, esa pasa a ser tu contraseña y se cierran tus sesiones abiertas. Si tienes la verificación en dos pasos, te seguirá pidiendo el código |

## Qué está comprobado y qué no

- **Comprobado aquí**:
  - una cadena de conexión como la de Neon (con `channel_binding=require` y el servidor «pooled») funciona; sin el arreglo de la fase 22, el servidor rechazaba la conexión;
  - las imágenes subidas se guardan en la base de datos y sobreviven a los reinicios;
  - el primer arranque prepara la base (15,7 s de CPU) y el siguiente, sin cambios, se la salta (0,12 s);
  - la memoria del servidor se queda por debajo de 330 MB recorriendo las páginas y generando PDF (el plan gratuito tiene 512 MB);
  - la base completa con la demo ocupa 43 MB;
  - CI arranca la imagen de Render dos veces sobre una base vacía con un propietario sin privilegios de superusuario, como en Neon (`deploy/smoke-test.sh`).
- **No comprobado aquí**: los paneles de Render y Neon, y una conexión real a Neon. Sus webs están bloqueadas desde este entorno de trabajo. Si en tu primer despliegue algo no coincide, mándame el mensaje de Render o de Neon y lo ajusto.
