# Desarrollo y mantenimiento

## Primer arranque

```bash
corepack enable
pnpm install
pnpm exec next telemetry disable      # recomendado (ver SECURITY_PRIVACY.md)
pnpm dev
```

Para las pruebas E2E en un equipo nuevo: `pnpm exec playwright install chromium`.

## Antes de cada commit

```bash
pnpm check        # formato, lint, tipos, tests unitarios y compilación
pnpm test:e2e     # compila y ejecuta las pruebas E2E (escritorio y móvil) con axe
```

Ninguno debe fallar. Si un test falla, se arregla el código o el test, pero **nunca se desactiva para que pase**.

## Tests

| Tipo        | Dónde                     | Qué cubre                                                                                                                                                                                                                                               |
| ----------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unitarios   | `src/domain/**/*.test.ts` | Fechas y semanas ISO, procedencia, registro de fórmulas, volumen, prescripción, permisos, comparación de resultados, readaptación                                                                                                                       |
| Integración | `src/server/**/*.test.ts` | Casos de uso con el adaptador demo: aislamiento entre entrenadores y clientes, compartición, integridad de los datos demo, configuración                                                                                                                |
| E2E         | `e2e/*.spec.ts`           | Todas las pantallas (estado HTTP, encabezado, errores de consola, accesibilidad axe), navegación, búsqueda y filtros, registro de una sesión en móvil, acceso a sesiones ajenas, cabeceras de seguridad, manifiesto, service worker y modo sin conexión |

Los tests de servicios fijan la fecha (`2026-11-04`) para ser reproducibles. Los E2E usan la fecha real en `Europe/Madrid`.

## Tareas habituales

- **Actualizar dependencias**: `pnpm outdated`, actualizar de una en una (las versiones están fijadas sin `^` a propósito), y después `pnpm check` + `pnpm test:e2e` + `pnpm audit --prod`. Antes de una versión mayor, leer sus notas de migración. Next 16 incluye su documentación en `node_modules/next/dist/docs`.
- **Cambiar el logotipo**: editar `public/icons/icon.svg`, copiarlo a `src/app/icon.svg`, ejecutar `pnpm icons` y copiar `public/icons/apple-touch-icon.png` a `src/app/apple-icon.png`.
- **Invalidar la caché de la PWA**: subir `CACHE_VERSION` en `public/sw.js`.
- **Añadir una pantalla, un dato o un cálculo**: ver «Cómo ampliar» en `ARCHITECTURE.md`.

## Variables de entorno

| Variable               | Valor por defecto | Descripción                                       |
| ---------------------- | ----------------- | ------------------------------------------------- |
| `TRAINPRO_DATA_SOURCE` | `demo`            | Fuente de datos. Solo existe `demo` en esta fase. |
| `TRAINPRO_TIME_ZONE`   | `Europe/Madrid`   | Zona horaria IANA para calcular «hoy».            |

Se validan al arrancar (`src/server/env.ts`): un valor inválido detiene la aplicación con un mensaje claro.

## Problemas conocidos del entorno de desarrollo

- **npm** 10.9 no puede instalar el proyecto por un error interno (ver ADR-03): usa pnpm.
- Durante la Fase 1, el servidor de desarrollo (Turbopack) dejó de detectar algunos cambios de archivo en el entorno de trabajo usado. Si una modificación no se refleja, reinicia `pnpm dev`, y si persiste, borra `.next/`. La compilación de producción no se ve afectada.
- `pnpm install` muestra avisos de _peer dependencies_ de plugins de ESLint con ESLint 10. Son esperados (ver ADR-08).

## Convenciones

- Código e identificadores en inglés; textos de interfaz y documentación en español.
- Las rutas visibles van en español (`/entrenador`, `/cliente`).
- Componentes de servidor por defecto; `'use client'` solo donde hay interacción.
- Nada de lógica de negocio en `src/app`: va al dominio o a los casos de uso.
- Nada visual o simulado se presenta como terminado: se usa `PendingFeature` o `Notice`.
