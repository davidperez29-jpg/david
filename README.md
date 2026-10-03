# Plataforma de entrenamiento basada en evidencia

Sistema profesional para **evaluar, programar, entrenar y hacer seguimiento** de clientes, presencial y online, con trazabilidad científica y control total del entrenador.

> **Estado actual: Fase 8 completada**: evaluación, bibliotecas científica (verificada en PubMed) y de ejercicios, planificación desde plantillas, app del cliente sin conexión y, ahora, **seguimiento**: adherencia, carga interna (método sRPE) y alertas 🟢🟡🔴 configurables que describen y nunca diagnostican. Siguiente: Fase 9 (dashboards).

## Arranque rápido

```bash
pnpm install
cp .env.example .env            # APP_ENCRYPTION_KEY: openssl rand -base64 32
pnpm db:reset && pnpm db:seed:demo
pnpm dev                        # http://localhost:3000
pnpm monitor:daily              # alertas diarias (programar con cron)
```

Usuario demo: `lucia.moreno@example.com` / `demo-entrenamiento-2026`. Más detalles en [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Documentación

| Documento                                                      | Contenido                                                                                                                                                                                                 |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`docs/MASTER_SPECIFICATION.md`](docs/MASTER_SPECIFICATION.md) | Especificación maestra: visión, usuarios, arquitectura, stack, base de datos, módulos, flujos, sistema científico, evaluación, planificación, motor de decisiones, seguridad, testing, roadmap y riesgos. |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)                 | Arquitectura implementada, decisiones (ADR) y puesta en marcha.                                                                                                                                           |
| [`docs/DATABASE.md`](docs/DATABASE.md)                         | Modelo de datos, integridad y Row Level Security.                                                                                                                                                         |
| [`docs/SCIENTIFIC_FRAMEWORK.md`](docs/SCIENTIFIC_FRAMEWORK.md) | Biblioteca científica: niveles A–H, QA, trazabilidad y evidencia verificada en PubMed.                                                                                                                    |
| [`docs/ASSESSMENT.md`](docs/ASSESSMENT.md)                     | Evaluación: tests, fiabilidad, referencias, interpretación del cambio.                                                                                                                                    |
| [`docs/PLANNING.md`](docs/PLANNING.md)                         | Planificación: plantillas, prescripción, progresión, revisiones.                                                                                                                                          |
| [`docs/SESSIONS.md`](docs/SESSIONS.md)                         | Sesiones: publicación, reproductor, modo sin conexión, sustituciones, modo sala.                                                                                                                          |
| [`docs/MONITORING.md`](docs/MONITORING.md)                     | Seguimiento: adherencia, carga interna, reglas y ciclo de vida de las alertas.                                                                                                                            |
| [`docs/EXERCISE_LIBRARY.md`](docs/EXERCISE_LIBRARY.md)         | Biblioteca de ejercicios y banco importado.                                                                                                                                                               |
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
