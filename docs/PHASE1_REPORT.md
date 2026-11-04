# Informe de revisión · Fase 1 (fundamentos)

Fecha: 4 de noviembre de 2026 · Rama: `claude/vigilant-bardeen-qfycp4`

## 1. Qué se ha creado

Un proyecto nuevo, **sin código, configuración, dependencias ni historial del proyecto anterior**. El proyecto anterior sigue intacto en `claude/training-platform-system-hm10nq`.

- Aplicación Next.js con dos experiencias diferenciadas:
  - **Entrenador**: 11 pantallas.
  - **Cliente**: 4 pantallas pensadas para el móvil.
  - Además: portada, página 404 y página de error.
- Una **capa de dominio** en TypeScript puro: permisos, procedencia de los datos, registro de fórmulas versionadas, volumen de entrenamiento, prescripción, sesiones, evaluaciones, readaptación y fechas.
- Una **capa de servidor** con contexto de petición, casos de uso con control de acceso, puertos de repositorio y un adaptador demo en memoria con datos ficticios.
- Un **sistema de diseño** propio (amarillo, crema y blanco) con logotipo, pictogramas deportivos e ilustraciones en SVG propio.
- Una **PWA básica**: manifiesto, iconos, service worker sin datos personales y página sin conexión.
- **Pruebas**: 59 tests unitarios y de integración, y 25 pruebas E2E con análisis de accesibilidad.
- **Documentación**: README, arquitectura, decisiones (ADR), seguridad y privacidad, rigor científico, sistema de diseño, desarrollo, hoja de ruta y este informe.

## 2. Tecnologías y versiones

| Pieza                       | Versión                       | Licencia                  |
| --------------------------- | ----------------------------- | ------------------------- |
| Node.js                     | ≥ 22.13 (probado con 22.23.4) | MIT                       |
| pnpm                        | 10.28.0                       | MIT                       |
| Next.js                     | 16.4.5                        | MIT                       |
| React / React DOM           | 19.3.1                        | MIT                       |
| TypeScript                  | 6.0.3                         | Apache-2.0                |
| Tailwind CSS                | 4.3.4                         | MIT                       |
| lucide-react                | 1.65.0                        | ISC                       |
| server-only                 | 0.0.1                         | MIT                       |
| ESLint + eslint-config-next | 10.13.0 + 16.4.5              | MIT                       |
| Prettier                    | 3.9.10                        | MIT                       |
| Vitest                      | 5.0.5                         | MIT                       |
| Playwright                  | 1.63.0                        | Apache-2.0                |
| @axe-core/playwright        | 4.14.0                        | MPL-2.0 (solo desarrollo) |

Fuentes: Plus Jakarta Sans y Bricolage Grotesque (OFL), autoalojadas. Justificación de cada elección en `DECISIONS.md`.

## 3. Estructura

Explicada en `ARCHITECTURE.md`. En resumen:

- `src/domain`: reglas puras.
- `src/contracts`: tipos que el servidor entrega a la interfaz.
- `src/server`: contexto, casos de uso y repositorios.
- `src/features`: pantallas por área.
- `src/ui`: componentes genéricos.
- `src/app`: rutas.

ESLint impide saltarse las capas (verificado con archivos que incumplían las reglas a propósito).

## 4. Qué funciona de verdad y qué no

### Funciona (lógica real, ejecutada sobre datos ficticios)

| Funcionalidad                        | Notas                                                                                                                                                                                                                                                                              |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Navegación completa por las 18 rutas | Barra lateral y menú móvil del entrenador; navegación inferior del cliente                                                                                                                                                                                                         |
| **Control de acceso en el servidor** | Cada entrenador ve solo sus clientes. Cada cliente ve solo lo suyo y lo que se le comparte; las notas privadas, nunca. Las sesiones ajenas responden 404. Probado en unitarios, integración y E2E                                                                                  |
| Cálculo de volumen semanal           | Series, repeticiones y tonelaje, a partir de los registros y con fórmulas versionadas                                                                                                                                                                                              |
| Estado de cada sesión                | Completada, a medias, pendiente o no realizada, deducido de los registros y de la fecha                                                                                                                                                                                            |
| Panel del entrenador                 | Sesiones de hoy, semana, readaptaciones activas, evaluaciones recientes con su origen y avisos factuales («1 sesión no realizada en los últimos 7 días»)                                                                                                                           |
| Comparación de evaluaciones          | Solo si coinciden prueba, unidad, método e instrumento; en caso contrario explica por qué no se compara                                                                                                                                                                            |
| Etiqueta de procedencia en cada dato | Medición directa, cálculo, estimación, importado o autodeclarado, con su detalle                                                                                                                                                                                                   |
| Fases de readaptación                | Fase actual y avance por criterios                                                                                                                                                                                                                                                 |
| Búsqueda y filtros                   | Clientes sin distinguir tildes; ejercicios por patrón de movimiento                                                                                                                                                                                                                |
| Gráficos                             | _Tooltip_ con ratón y teclado, tabla de datos y selector de métrica                                                                                                                                                                                                                |
| Reproductor de sesión del cliente    | Prescripción completa (series, repeticiones, carga, descanso, tempo con explicación y RIR/RPE/carácter), un toque por serie, validación de lo escrito, temporizador de descanso, resumen calculado y esfuerzo percibido autodeclarado. **Funciona en pantalla, pero no se guarda** |
| Cabeceras de seguridad               | CSP base, protección frente a _clickjacking_, `nosniff` y similares; verificado en E2E                                                                                                                                                                                             |
| PWA                                  | El manifiesto y los iconos se sirven bien y el service worker muestra la página sin conexión al perder la red (verificado en E2E con Chromium)                                                                                                                                     |
| Configuración validada al arrancar   | Valores de `TRAINPRO_DATA_SOURCE` y `TRAINPRO_TIME_ZONE`                                                                                                                                                                                                                           |

### Solo visual, simulado o inexistente (no debe considerarse hecho)

- **Autenticación**: no existe. La sesión es fija (Alex o Marta).
- **Persistencia**: no hay base de datos y nada se guarda. Los datos se regeneran cada día a partir de la fecha actual.
- **Datos**: todos ficticios.
- **Evaluaciones**: el catálogo no tiene protocolos, fórmulas ni referencias; no se interpreta ningún resultado.
- **Informes**: solo una pantalla que indica lo previsto.
- **Configuración** y **compartición con el cliente**: solo se pueden consultar.
- **Sin editar**: plan (no hay editor), clientes (no hay alta ni edición) y biblioteca de ejercicios.
- **Vídeos de ejercicios**: el campo existe, pero no hay ninguno. Se muestra la silueta del patrón.
- **Instalación real de la PWA en un móvil**: no probada, porque necesita HTTPS y un despliegue.

## 5. Pruebas ejecutadas y resultados

Todas ejecutadas en este entorno el 4 de noviembre de 2026:

| Comprobación                                                             | Resultado                                                                                       |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `pnpm format:check`                                                      | Todos los archivos con formato correcto                                                         |
| `pnpm lint`                                                              | 0 errores, 0 avisos                                                                             |
| `pnpm typecheck`                                                         | 0 errores                                                                                       |
| `pnpm test` (Vitest)                                                     | **59/59 superados** en 8 archivos                                                               |
| `pnpm build`                                                             | Compilación correcta; páginas con datos dinámicas y portada, 404, iconos y manifiesto estáticos |
| `pnpm test:e2e` (Playwright, Chromium de escritorio + emulación Pixel 7) | **25/25 superados**, en dos ejecuciones seguidas                                                |
| axe (WCAG 2.1 A/AA) en todas las pantallas principales                   | Sin incidencias graves ni críticas                                                              |
| `pnpm audit --prod`                                                      | Sin vulnerabilidades conocidas                                                                  |
| `pnpm audit` (con desarrollo)                                            | 2 moderadas en `minimatch` dentro de ESLint (riesgo aceptado, ver `SECURITY_PRIVACY.md`)        |

Errores reales que encontraron las pruebas y se corrigieron:

- Un enlace cuyo nombre accesible no incluía su texto visible (WCAG 2.5.3).
- Texto con contraste insuficiente en las fases futuras de readaptación (había una opacidad del 80 %).
- Una regla de pureza de React en el temporizador.
- Series por tiempo o distancia que sumaban repeticiones en los datos demo.
- Etiquetas de bloque mal numeradas (B3 en lugar de B1).

## 6. Limitaciones y errores pendientes

- **No se ha probado en dispositivos reales** (Safari de iOS, Android) ni con lectores de pantalla. Solo Chromium y emulación móvil.
- La CSP aún permite `'unsafe-inline'` en scripts. La versión estricta con _nonce_ llegará con la autenticación.
- **Telemetría de Next.js**: se envía por defecto. Se desactiva con `next telemetry disable` o con una variable del sistema; **no** sirve ponerla en `.env.local` (comprobado).
- Los pictogramas son por patrón de movimiento, no por ejercicio. Por ejemplo, el press de banca muestra la silueta genérica de «empuje».
- `next/font` necesita internet al compilar.
- El servidor de desarrollo dejó de detectar cambios en algunos momentos en este entorno. La solución es reiniciarlo; producción no se ve afectada.
- Avisos de _peer dependencies_ de tres plugins de ESLint con ESLint 10. Son esperados y el lint funciona.
- No hay CI ni modo oscuro (pendientes de decisión).
- En la demo, Marta siempre tiene sesión «hoy» a propósito, para que la pantalla principal muestre su caso típico. La versión sin sesión (día de descanso) está implementada, pero no aparece con los datos demo.

## 7. Riesgos técnicos y decisiones que necesitan aprobación

**Riesgos**

- **Next.js publica versiones de parche con mucha frecuencia** (16.4.3, 16.4.4 y 16.4.5 en menos de dos semanas). Hará falta una rutina de actualización con `pnpm audit`.
- **Planes gratuitos**: ningún proveedor garantiza que sigan siendo gratuitos. Pueden tener límites, pausas por inactividad o cambios de condiciones. Hay que revisarlo en el momento de elegir.
- **Datos de salud**: tratarlos exige base jurídica, consentimiento, medidas reforzadas y revisión legal antes de usar datos reales.
- **Dependencia del proveedor**: elegir Supabase acopla autenticación y almacenamiento al proveedor. Los puertos actuales lo limitan a la capa de datos.

**Decisiones pendientes** (detalle en `DECISIONS.md`):

| Id   | Decisión                                                                                           |
| ---- | -------------------------------------------------------------------------------------------------- |
| P-01 | Base de datos: Supabase o PostgreSQL propio                                                        |
| P-02 | Autenticación: proveedor y método; 2FA para entrenadores                                           |
| P-03 | Alojamiento y región (preferiblemente UE)                                                          |
| P-04 | CI en GitHub Actions (consume minutos; gratis en repositorios públicos, cupo gratuito en privados) |
| P-05 | Licencia del código                                                                                |
| P-06 | Mover TrainPro a un repositorio propio                                                             |
| P-07 | Modo oscuro                                                                                        |

Hay además una decisión de producto: el RGPD reconoce el derecho de acceso del cliente a sus datos, con independencia de lo que el entrenador comparta en la app. Hay que definir cómo atenderlo (ver `SECURITY_PRIVACY.md`).

## 8. Pantallas principales

1. **Portada** (`/`): titular «Entrena con criterio. Acompaña con cercanía.», ilustración de una persona saltando ante un sol, dos tarjetas grandes para entrar como entrenador (amarilla) o como cliente (blanca), el ciclo de trabajo en 7 pasos y tres principios (rigor, privacidad, móvil).
2. **Panel del entrenador** (`/entrenador`): saludo con fecha, cuatro indicadores (sesiones de hoy destacada en amarillo, clientes activos, semana con barra de progreso y readaptaciones), «Entrenan hoy» con el estado de cada sesión, «Requiere atención» con hechos y «Evaluaciones recientes» con el origen de cada dato.
3. **Ficha de cliente** (`/entrenador/clientes/c-diego`): cabecera amarilla con objetivo y población; navegación por secciones. Incluye la próxima sesión con la prescripción completa y siluetas, sesiones recientes, gráfico de volumen con selector, evaluaciones, readaptación por fases con criterios y aviso de datos de salud, y lo que ve el cliente.
4. **Carga y volumen** (`/entrenador/carga`): un selector de métrica para todos los gráficos, una tarjeta por cliente (esta semana y la anterior) y las tres definiciones con su versión y limitaciones.
5. **Biblioteca de ejercicios** (`/entrenador/ejercicios`): búsqueda, filtros por patrón y tarjetas con silueta, material, patrón y nivel; el detalle incluye pasos, puntos clave y errores frecuentes.
6. **Cliente · Hoy** (`/cliente`, móvil): tarjeta amarilla protagonista «Hoy toca» con duración, ejercicios, series y el botón «Empezar sesión» visible sin scroll; nota del entrenador; lista de la sesión; y, en segundo plano, «Esta semana: X de Y».
7. **Cliente · Sesión**: barra de progreso fija, una tarjeta por ejercicio (A1, A2…) con la prescripción, «Cómo se hace» desplegable y filas de series con repeticiones y kg rellenados y botón ✓. Al marcar una serie aparece el temporizador de descanso abajo. Al final, un resumen calculado y el esfuerzo percibido.
8. **Cliente · Progreso**: solo lo compartido. En la demo, el volumen semanal (series o tonelaje) y dos evaluaciones (CMJ y sprint de 20 m).
