# Plataforma de entrenamiento basada en evidencia

Sistema profesional para **evaluar, programar, entrenar y hacer seguimiento** de clientes, presencial y online, con trazabilidad científica y control total del entrenador.

> **Estado actual: Fase 1 completada** — autenticación, usuarios, organizaciones y ficha de cliente, con experiencias de entrenador y cliente. Siguiente: Fase 2 (estructura completa de BD + RLS).

## Arranque rápido

```bash
pnpm install
cp .env.example .env            # APP_ENCRYPTION_KEY: openssl rand -base64 32
pnpm db:reset && pnpm db:seed:demo
pnpm dev                        # http://localhost:3000
```

Usuario demo: `lucia.moreno@example.com` / `demo-entrenamiento-2026`. Más detalles en [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Documentación

| Documento                                                      | Contenido                                                                                                                                                                                                 |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`docs/MASTER_SPECIFICATION.md`](docs/MASTER_SPECIFICATION.md) | Especificación maestra: visión, usuarios, arquitectura, stack, base de datos, módulos, flujos, sistema científico, evaluación, planificación, motor de decisiones, seguridad, testing, roadmap y riesgos. |
| [`docs/research/`](docs/research/README.md)                    | Anexos de la Fase 0: análisis de los documentos aportados, registro de evidencia verificada, base de tests y QA de referencias.                                                                           |
| [`CHANGELOG.md`](CHANGELOG.md)                                 | Registro de cambios.                                                                                                                                                                                      |

## Principios

1. Tres capas separadas: biblioteca científica · biblioteca de ejercicios · motor de decisiones.
2. El entrenador tiene la última palabra: el sistema propone, explica y audita; nunca impone.
3. Nada inventado: toda evidencia tiene estado de verificación; lo no verificado se marca `[REQUIERE VERIFICACIÓN]`.
4. No diagnosticar: ante cuestiones médicas, _"Requiere valoración por profesional sanitario"_.
