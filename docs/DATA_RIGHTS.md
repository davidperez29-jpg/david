# Derechos del cliente sobre sus datos (diseño)

> **Diseño técnico, no asesoramiento jurídico.** TrainPro **no afirma cumplir el RGPD**: eso exige una auditoría jurídica y técnica real del sistema en producción. Los artículos citados sirven para orientar el diseño y deben validarse con asesoría jurídica. **No implementado todavía**: se desarrollará a partir de la Fase 2.

## 1. Roles (a confirmar con asesoría jurídica)

- **Responsable del tratamiento:** previsiblemente, el entrenador o su empresa, que decide para qué y cómo se tratan los datos de sus clientes.
- **Encargado del tratamiento:** el operador de TrainPro, que presta la plataforma. Necesita un contrato de encargo con cada entrenador.
- **Subencargados:** proveedores de infraestructura (base de datos, alojamiento, correo), con sus propios DPA (ver `INFRASTRUCTURE.md`).

De este reparto depende quién responde a cada solicitud. La plataforma debe **facilitar** que el entrenador la atienda.

## 2. Inventario de datos por categoría

| Categoría                    | Ejemplos                                                                                   | Sensibilidad                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| Identificación y cuenta      | Nombre, correo, sesiones de acceso                                                         | Media                                            |
| Perfil deportivo             | Objetivos, población, deporte                                                              | Media                                            |
| Entrenamiento                | Planes, sesiones, series registradas, RIR/RPE, comentarios                                 | Media                                            |
| Evaluaciones                 | Resultados, intentos, procedencia                                                          | Media                                            |
| **Salud**                    | Lesiones, antecedentes, readaptación                                                       | **Categoría especial (art. 9)**                  |
| Notas del entrenador         | Observaciones privadas sobre el cliente                                                    | Media (son datos del cliente)                    |
| Indicaciones y restricciones | Indicaciones del entrenador para el cliente; restricciones que pueden proceder de la salud | Media; **de salud** si revelan una lesión        |
| Datos en el dispositivo      | Sesión del día y series pendientes de enviar (propuesta, `ARCHITECTURE.md`)                | Media; se borran al cerrar sesión                |
| Imagen en vídeos             | Personas que aparecen en los vídeos de demostración (no clientes, en este alcance)         | Media; requiere cesión de imagen (`MEDIA.md` §9) |
| Registros técnicos           | Auditoría de accesos y cambios                                                             | Baja; sin contenido de salud                     |
| Copias de seguridad          | Todo lo anterior, de forma temporal                                                        | Según contenido                                  |

## 3. Procedimiento común

1. **Solicitud** desde el portal del cliente o, en su nombre, por el entrenador. Se registra en `data_request` (tipo, fecha, estado, plazo).
2. **Verificación de identidad:** sesión autenticada y nueva autenticación (con 2FA si está activo) antes de exportar o borrar.
3. **Revisión por el responsable** (el entrenador), con plantillas de respuesta.
4. **Ejecución** por la plataforma y **respuesta** al cliente.
5. **Plazo orientativo:** un mes, ampliable en casos complejos (art. 12.3), con avisos internos antes del vencimiento.
6. **Registro** de la solicitud y su resolución en `audit_event`, sin copiar el contenido.

## 4. Acceso y exportación (arts. 15 y 20)

- **Formato estructurado y legible por máquina:** JSON con todos los datos y CSV por tabla (sesiones, series, evaluaciones…), más un resumen legible.
- **Se incluye la procedencia de cada dato** (método, instrumento, fórmula y versión), coherente con la trazabilidad científica.
- **Se excluyen** los datos de otras personas y los secretos técnicos.
- **Decisión pendiente:** cómo tratar las **notas privadas del entrenador**. Son datos personales del cliente y en principio entran en el derecho de acceso, salvo excepciones que debe valorar la asesoría jurídica.
- El derecho de acceso existe **con independencia de lo que el entrenador comparta en la app**. Compartir es una función de producto, no un límite legal.

## 5. Rectificación (art. 16)

- Datos de perfil: el cliente los corrige directamente o lo solicita.
- **Mediciones y registros: no se sobrescriben en silencio.** Se crea una corrección con motivo, fecha y autor, y se conserva el historial. Así se mantiene la trazabilidad y se sabe qué valor se usó en cada cálculo.
- **Series registradas** (diseño de la experiencia guiada): el cliente corrige una serie creando una versión nueva (`supersedes`), que sustituye a la anterior en los cálculos y la conserva en el historial. El entrenador no edita lo realizado por el cliente: lo anota.

## 6. Supresión (art. 17) y conservación

- **Supresión o anonimización** de los datos del cliente cuando lo solicite o cuando termine el plazo de conservación.
- **Excepciones** que pueden obligar a conservar algunos datos:
  - Obligaciones legales (por ejemplo, de facturación, si la plataforma la gestiona).
  - Si intervienen **profesionales sanitarios** (fisioterapeutas), puede aplicarse normativa de documentación clínica con plazos mínimos de conservación. **A confirmar con asesoría jurídica.**
  - Formulación o defensa de reclamaciones.
- **Copias de seguridad:** los datos borrados desaparecen de las copias cuando estas rotan (por ejemplo, 7 días con copias diarias). Se informa al cliente de ese plazo y, si hay que restaurar una copia, se vuelven a aplicar las supresiones pendientes.
- **Datos de salud:** se borran o anonimizan primero, salvo obligación legal de conservarlos, en cuyo caso quedan con acceso aún más restringido.
- **Agregados anónimos** (por ejemplo, estadísticas sin posibilidad de reidentificación) pueden conservarse.

## 7. Políticas de conservación (propuesta inicial para validar)

| Datos                        | Mientras…                         | Después                                                                                |
| ---------------------------- | --------------------------------- | -------------------------------------------------------------------------------------- |
| Cuenta y perfil              | Relación activa                   | Supresión o anonimización tras un periodo de inactividad por definir, con aviso previo |
| Entrenamiento y evaluaciones | Relación activa                   | Igual que la cuenta, salvo exportación previa del cliente                              |
| Salud                        | Lo necesario para la readaptación | Supresión, salvo obligación legal                                                      |
| Auditoría                    | Plazo mínimo por definir          | Supresión automática                                                                   |
| Copias                       | Rotación del proveedor            | Expiran solas                                                                          |

## 8. Implementación prevista

- **Entidades:** `data_request`, `retention_policy`, `erasure_job` y `audit_event` (ver `DATA_MODEL.md`).
- **Servicios:** exportación (JSON/CSV), anonimización, borrado en cascada controlado y reaplicación de supresiones tras restaurar una copia.
- **Tests:** un cliente solo exporta lo suyo; la supresión no deja datos de salud en las tablas activas; las correcciones conservan el historial.
- **Por fases:** el modelo y el aislamiento en la Fase 2, exportación y rectificación en las Fases 3 y 7, y supresión, conservación y revisión jurídica en la Fase 10.
