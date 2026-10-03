# Plataforma de entrenamiento basada en evidencia

Sistema profesional para **evaluar, programar, entrenar y hacer seguimiento** de clientes, presencial y online, con trazabilidad científica y control total del entrenador.

> **Estado actual: Fase 2 completada**: estructura completa de la base de datos (91 tablas) con Row Level Security. Ya funcionan la autenticación, los usuarios, las organizaciones y la ficha de cliente. Siguiente: Fase 3 (biblioteca de ejercicios).

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
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)                 | Arquitectura implementada, decisiones (ADR) y puesta en marcha.                                                                                                                                           |
| [`docs/DATABASE.md`](docs/DATABASE.md)                         | Modelo de datos, integridad y Row Level Security.                                                                                                                                                         |
| [`docs/SECURITY.md`](docs/SECURITY.md)                         | Controles de seguridad y RGPD.                                                                                                                                                                            |
| [`docs/TESTING.md`](docs/TESTING.md)                           | Cómo ejecutar los tests y qué cubren.                                                                                                                                                                     |
| [`docs/API.md`](docs/API.md)                                   | API REST v1.                                                                                                                                                                                              |
| [`docs/ROADMAP.md`](docs/ROADMAP.md)                           | Estado por fases.                                                                                                                                                                                         |
| [`docs/research/`](docs/research/README.md)                    | Anexos de la Fase 0: análisis de los documentos aportados, registro de evidencia, base de tests y QA de referencias.                                                                                      |
| [`CHANGELOG.md`](CHANGELOG.md)                                 | Registro de cambios.                                                                                                                                                                                      |

## Principios

1. Tres capas separadas: biblioteca científica · biblioteca de ejercicios · motor de decisiones.
2. El entrenador tiene la última palabra: el sistema propone, explica y audita; nunca impone.
3. Nada inventado: toda evidencia tiene estado de verificación; lo no verificado se marca `[REQUIERE VERIFICACIÓN]`.
4. No diagnosticar: ante cuestiones médicas, _"Requiere valoración por profesional sanitario"_.
