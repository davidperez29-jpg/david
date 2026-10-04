# Plataforma de entrenamiento basada en evidencia

Sistema profesional para **evaluar, programar, entrenar y hacer seguimiento** de clientes, presencial y online, con trazabilidad científica y control total del entrenador.

> **Estado actual: Fases 0–15 completadas.** Plataforma completa: evaluación, bibliotecas científica (verificada en PubMed) y de ejercicios, planificación, app del cliente sin conexión, seguimiento, motores de decisiones y de programación, informes, seguridad y RGPD, pirámide de pruebas con umbrales en CI y, ahora, **optimización y escala**: observabilidad sin datos personales, límites por usuario, CSP con _nonce_, integraciones preparadas, herramientas de equipo e imagen Docker con guía de operación. Pendiente: decisiones de despliegue (proveedor UE, email) y validación legal.

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
| [`docs/DASHBOARD.md`](docs/DASHBOARD.md)                       | Dashboards del entrenador y del cliente, calendario global, apariencia.                                                                                                                                   |
| [`docs/DECISION_ENGINE.md`](docs/DECISION_ENGINE.md)           | Motor de decisiones: pipeline, reglas como datos, explicación y control del entrenador.                                                                                                                   |
| [`docs/PROGRAMMING_ENGINE.md`](docs/PROGRAMMING_ENGINE.md)     | Motor de programación: propuestas de plan y ajustes semana a semana que solo se aplican al aceptar.                                                                                                       |
| [`docs/REPORTS.md`](docs/REPORTS.md)                           | Informe de cliente (11 apartados), exportación CSV/XLSX e importación validada.                                                                                                                           |
| [`docs/UX_REVIEW.md`](docs/UX_REVIEW.md)                       | Revisión UX con 3 tareas cronometradas y protocolo con personas.                                                                                                                                          |
| [`docs/EXERCISE_LIBRARY.md`](docs/EXERCISE_LIBRARY.md)         | Biblioteca de ejercicios y banco importado.                                                                                                                                                               |
| [`docs/SECURITY.md`](docs/SECURITY.md)                         | Controles de seguridad y RGPD.                                                                                                                                                                            |
| [`docs/ASVS_L2.md`](docs/ASVS_L2.md)                           | Checklist OWASP ASVS nivel 2.                                                                                                                                                                             |
| [`docs/DPIA.md`](docs/DPIA.md)                                 | Evaluación de impacto (plantilla, requiere validación legal).                                                                                                                                             |
| [`docs/PENTEST.md`](docs/PENTEST.md)                           | Pentest ligero: pruebas, hallazgos y cómo repetirlo.                                                                                                                                                      |
| [`docs/OPERATIONS.md`](docs/OPERATIONS.md)                     | Operación: despliegue, escalado, logs, copias y restauración.                                                                                                                                             |
| [`docs/INTEGRATIONS.md`](docs/INTEGRATIONS.md)                 | Datos de dispositivos: puerto, adaptadores CSV/JSON y consentimiento.                                                                                                                                     |
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
