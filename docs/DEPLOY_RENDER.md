# Publicar la aplicación online (Render, UE)

> **Resultado**: una dirección web (`https://…onrender.com`) donde entrar con email y contraseña desde cualquier navegador u ordenador.
>
> - **Sin comandos** y sin instalar nada: todo se hace en la web de Render.
> - **Tiempo**: unos 20 minutos la primera vez, casi todo esperando.
> - **Datos en la UE**: región Frankfurt.

## Antes de empezar

- Una cuenta de GitHub con acceso al repositorio `davidperez29-jpg/david`. La tienes.
- Un email y una contraseña para el **administrador**:
  - la contraseña debe tener **al menos 12 caracteres** y ser distinta del email;
  - puede ser una frase, por ejemplo `entreno-en-crevillente-2026`.

## Paso 1 · Crear la cuenta de Render

1. Abre **https://render.com** y pulsa **Get Started** (o **Sign up**).
2. Elige **GitHub** para registrarte. Así Render ya puede ver tus repositorios.
3. Cuando GitHub pregunte qué repositorios puede ver Render, permite **`david`** (o todos).

## Paso 2 · Crear la aplicación desde el «Blueprint»

El repositorio incluye un archivo (`render.yaml`) que le dice a Render todo lo que hay que crear: la aplicación web y la base de datos.

1. En el panel de Render pulsa **New +** → **Blueprint**.
2. Elige el repositorio **`davidperez29-jpg/david`**.
3. En **Branch** elige **`claude/training-platform-system-hm10nq`**.
4. Pon un nombre al Blueprint, por ejemplo «Plataforma entrenamiento».
5. Render muestra lo que va a crear:
   - `plataforma-entrenamiento` (web, Frankfurt);
   - `plataforma-db` (PostgreSQL, Frankfurt).
6. Rellena los datos que pide:

   | Campo | Qué poner |
   |---|---|
   | `ADMIN_EMAIL` | Tu email (con él entrarás) |
   | `ADMIN_PASSWORD` | Tu contraseña (mínimo 12 caracteres) |
   | `ADMIN_NAME` | Tu nombre y apellidos |
   | `ORG_NAME` | Nombre de tu centro o club |

   La clave de cifrado de los datos no la tienes que poner: la genera Render.
7. Pulsa **Apply** (o **Deploy Blueprint**).

## Paso 3 · Esperar a que esté lista

- La primera vez Render construye la aplicación: **10–15 minutos**. Lo verás en el servicio `plataforma-entrenamiento` → **Events/Logs**.
- Al arrancar, la aplicación:
  1. prepara la base de datos;
  2. carga la biblioteca: 92 ejercicios, 51 tests, 102 plantillas y la base científica;
  3. crea tu usuario administrador.
- Cuando el estado sea **Live**, arriba aparece la dirección, por ejemplo `https://plataforma-entrenamiento-abcd.onrender.com`.

## Paso 4 · Entrar

1. Abre la dirección y entra con tu email y contraseña.
2. La primera vez, la aplicación pide **activar la verificación en dos pasos** (obligatoria para administradores, porque hay datos de salud):
   - instala en el móvil una app de códigos: Google Authenticator, Microsoft Authenticator o similar;
   - escanea el código QR que aparece;
   - guarda los códigos de recuperación.
3. **Guarda la dirección en favoritos**: es tu aplicación. Para tus clientes, invítales desde su ficha y ellos entran en la misma dirección.

## Gratis o de pago

| Plan | Para qué | Coste orientativo |
|---|---|---|
| **Free** (el que crea el Blueprint) | Probar la aplicación | 0 € |
| **Starter** (web) + **Basic-256mb** (base de datos) | Uso real | ≈ 13 $/mes |

Limitaciones del plan gratuito:
- la web «se duerme» tras 15 min sin uso; la siguiente visita tarda unos 30 s en despertar;
- **la base de datos gratuita caduca a los 30 días**. Hay 14 días de gracia para pasar a pago; después Render la borra con sus datos.

**Para pasar a pago** (sin perder nada):
- en `plataforma-db` → **Settings** → **Instance Type** → `Basic-256mb`;
- en `plataforma-entrenamiento` → **Settings** → **Instance Type** → `Starter`.

Precios consultados el 05/10/2026: revísalos en la web de Render antes de contratar.

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

## Copias y restauración

- **Plan gratuito**: **sin copias**. No guardes datos reales en él.
- **Planes de pago**: Render ofrece recuperación a un instante (PITR) de la base de datos y exportaciones descargables. Los días de retención dependen del plan: consúltalos en la web de Render antes de contratar **[REQUIERE VERIFICACIÓN]**.

**Simulacro de restauración en Render** (cada 6 meses; también antes de empezar a usarlo con clientes reales). Lo haces tú desde el panel; no se ha podido probar desde aquí:

1. En `plataforma-db` → **Recovery** (o **Backups**), elige un instante de hace unos minutos y restaura en una **base nueva**. Nunca sobre la de producción.
2. Copia la **Internal Database URL** de la base nueva.
3. Crea un servicio web temporal desde el mismo repositorio, con las mismas variables de entorno, pero con `DATABASE_URL` = la URL de la base nueva. Usa **la misma `APP_ENCRYPTION_KEY`**: sin ella, los datos cifrados no se pueden leer.
4. Comprueba:
   - que `https://<servicio-temporal>/api/ready` responde `ready`;
   - que puedes entrar y ver tus clientes.
5. Apunta la fecha y cuánto tardó en `OPERATIONS.md` → «Registro de simulacros».
6. Borra el servicio y la base temporales.

Si una restauración real sustituye a la base de producción, vuelve a aplicar después las supresiones RGPD hechas desde la copia (`OPERATIONS.md` §6). Si no, las personas suprimidas desde entonces volverían a aparecer.

## Actualizaciones

- Cada vez que se publica un cambio en la rama, Render vuelve a desplegar **solo**, en unos 10 minutos.
- Tus datos se conservan: las actualizaciones nunca borran la base de datos.

## Si algo falla

| Síntoma | Qué hacer |
|---|---|
| La página de inicio de sesión dice «Todavía no hay ninguna cuenta de administrador» | La contraseña no cumplía la política. En **Environment**, corrige `ADMIN_PASSWORD` (≥ 12 caracteres, distinta del email) y pulsa **Manual Deploy → Deploy latest commit** |
| El despliegue falla | Servicio → **Logs**: copia las últimas líneas y envíamelas |
| Tarda en cargar por la mañana | Plan Free: se estaba despertando. Pasa a Starter |

## Qué está comprobado y qué no

- **Comprobado aquí**:
  - la imagen que construye Render arranca sobre una base de datos vacía y con un propietario que no es superusuario, como la de Render;
  - crea el administrador, permite entrar, y al reiniciar no duplica nada;
  - el trabajo diario se ejecuta una sola vez al día;
  - CI lo repite en cada cambio (`deploy/smoke-test.sh`).
- **No comprobado aquí**: el propio panel de Render. Su web está bloqueada desde este entorno de trabajo. El `render.yaml` sigue la especificación oficial de Render (repositorio público `render-oss/skills`). Si en tu primer despliegue algo no coincide, mándame el mensaje de Render y lo ajusto.
