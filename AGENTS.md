<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## TrainPro · reglas del proyecto

- Lee `docs/ARCHITECTURE.md` antes de cambiar código. Respeta las capas (`domain` → `contracts` → `server` / `features` → `app`): `pnpm lint` las comprueba.
- Los permisos se aplican en los casos de uso de `src/server/services` con las políticas de `src/domain/access.ts`. Todo dato nuevo necesita un test que incluya el intento de acceso no autorizado.
- No inventes fórmulas, referencias, valores normativos ni integraciones. Todo cálculo va al registro `src/domain/formulas.ts` con versión y limitaciones; las fórmulas científicas, con referencia verificada en su fuente primaria (ver `docs/SCIENTIFIC_RIGOR.md`).
- Cada dato medible lleva su procedencia (`direct`, `calculated`, `estimated`, `imported` o `self_reported`).
- No presentes como terminado nada simulado: usa `PendingFeature` o `Notice`.
- No añadas dependencias, servicios externos ni despliegues sin aprobación.
- Antes de terminar: `pnpm check` y `pnpm test:e2e`.
