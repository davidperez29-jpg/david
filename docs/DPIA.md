# Evaluación de impacto relativa a la protección de datos (EIPD/DPIA): plantilla

> **[REQUIERE VALIDACIÓN LEGAL]**
>
> - Este documento es una **plantilla técnica** rellenada con lo que hace el software. No es asesoramiento jurídico.
> - El responsable del tratamiento (cada centro u organización) y su asesor o DPD deben completarla, validarla y decidir los puntos marcados (decisión D7 de `MASTER_SPECIFICATION.md`).
> - Base: RGPD, art. 35. La EIPD es probablemente necesaria porque hay datos de salud (art. 9) y seguimiento sistemático de personas (§14.4).
> - Antes de usarla, revisa la metodología y las listas de tratamientos que publica la AEPD.

## 1. Descripción del tratamiento

| Campo | Contenido |
|---|---|
| Responsable | *[Completar: centro u organización que usa la plataforma]* |
| Encargado | *[Completar: quien aloja y opera la plataforma, si es distinto]* |
| Finalidad | Planificar, registrar y ajustar el entrenamiento físico de los clientes con criterios basados en evidencia; generar informes de progreso. **No** hay finalidad diagnóstica ni sanitaria. |
| Interesados | Clientes del centro (adultos; menores **[REQUIERE VALIDACIÓN LEGAL]**: la plataforma no lo impide hoy), entrenadores y administración. |
| Categorías de datos | Identificación y contacto; datos de entrenamiento (objetivos, planes, series, cargas, RPE, bienestar, evaluaciones físicas); **datos de salud** (declaraciones, cribado previo, molestias), solo con consentimiento explícito; cuenta y seguridad (sesiones, intentos de inicio de sesión, auditoría). |
| Base jurídica | Ejecución del contrato de servicio (art. 6.1.b) para el entrenamiento. **Consentimiento explícito** (art. 9.2.a) para los datos de salud. Consentimiento (art. 6.1.a) para fotografías y comunicaciones comerciales. *[Validar]* |
| Destinatarios | Personal del centro según su asignación. Sin cesiones. Subencargados: alojamiento y, cuando se decida (D4), el proveedor de email. Consulta opcional a Have I Been Pwned: **no recibe datos personales**, solo 5 caracteres de un hash de la contraseña. |
| Transferencias internacionales | Ninguna prevista si el alojamiento y el email están en la UE *[Confirmar al desplegar]*. |
| Plazos de conservación | Ver §4. |

## 2. Necesidad y proporcionalidad

- **Minimización**:
  - no se piden diagnósticos, medicación ni documentos clínicos;
  - el texto libre de salud avisa de no incluir información médica innecesaria;
  - los datos de salud son opcionales y solo se usan para adaptar el entrenamiento y avisar de «Requiere valoración por profesional sanitario».
- **Exactitud**: el cliente ve y corrige sus datos de perfil y puede pedir la rectificación desde la app.
- **Transparencia**:
  - textos de consentimiento por finalidad, versionados;
  - el cliente ve qué datos se tratan y su registro de actividad (en la exportación).
- **Derechos**: acceso, portabilidad, rectificación, supresión, limitación y oposición se ejercen **desde la interfaz**, con un plazo de un mes y seguimiento (`SECURITY.md` §2.2).
- **Decisiones automatizadas** (art. 22): el motor de decisiones **propone**; el entrenador **decide** y puede anular cualquier propuesta, con auditoría. No hay decisiones con efectos jurídicos ni significativos sin intervención humana *[Validar]*.

## 3. Riesgos y medidas

Probabilidad e impacto: estimación técnica inicial **[REQUIERE VALIDACIÓN LEGAL]**.

| ID | Riesgo para las personas | P | I | Medidas implementadas | Riesgo residual |
|---|---|---|---|---|---|
| R-1 | Acceso no autorizado a datos de salud por otro cliente o por personal no asignado | Baja | Alto | RBAC con ámbito; RLS en PostgreSQL; respuesta 404 fuera de ámbito; tests de aislamiento y pentest ligero (`PENTEST.md`) | Bajo |
| R-2 | Robo de credenciales del staff | Media | Alto | argon2id; bloqueo y límites; 2FA obligatorio para ADMIN y recomendado al resto; rechazo de contraseñas filtradas (opcional); sesiones visibles y revocables | Medio-bajo |
| R-3 | Fuga de la base de datos o de una copia | Baja | Alto | Cifrado AES-256-GCM de teléfono, texto de salud y secretos TOTP; tokens y códigos guardados como hash; rotación de claves. **Las copias de seguridad son del despliegue** | Medio *[completar al desplegar]* |
| R-4 | Uso de los datos de salud sin consentimiento o tras retirarlo | Baja | Alto | El sistema rechaza registrar salud sin consentimiento activo; historial de consentimientos; los informes solo incluyen salud con consentimiento | Bajo |
| R-5 | Conservación excesiva | Media | Medio | Plazo configurable para clientes archivados con anonimización automática; depuración diaria de registros de seguridad | Medio, hasta que el responsable fije el plazo |
| R-6 | Datos en dispositivos del cliente (modo sin conexión) | Media | Medio | Solo la cola pendiente de sincronizar, borrada al sincronizar; sesión `HttpOnly` | Medio-bajo (aceptado *[validar]*) |
| R-7 | Interpretación clínica errónea de las recomendaciones | Media | Alto | Lenguaje de no diagnóstico; derivación a profesional sanitario; trazabilidad de cada recomendación a sus fuentes; el entrenador decide | Bajo |
| R-8 | Exportaciones o informes que salen del sistema | Media | Medio | Exportaciones auditadas; descargas sin caché; sin salud en las exportaciones masivas; neutralización de fórmulas | Medio-bajo |
| R-9 | Supresión incompleta | Baja | Medio | Anonimización transaccional con tests; redacción de la auditoría del cliente. **Las copias de seguridad conservan los datos hasta su caducidad** | Bajo *[definir la caducidad de las copias]* |
| R-10 | Abuso por personal con privilegios (ADMIN) | Baja | Alto | Auditoría *append-only* de cada escritura y de las lecturas de salud; 2FA obligatorio | Medio-bajo |

## 4. Plazos de conservación (por decidir)

| Dato | Plazo propuesto por el software | Decisión del responsable |
|---|---|---|
| Cliente activo | Mientras dure la relación | *[Completar]* |
| Cliente archivado | **Sin plazo por defecto**: lo fija ADMIN en Privacidad → Conservación; al vencer, se anonimiza | *[Completar: meses]* |
| Sesiones de usuario | Hasta 30 días después de caducar o revocarse | *[Validar]* |
| Intentos de inicio de sesión | 90 días | *[Validar]* |
| Filas de importación | 30 días | *[Validar]* |
| Auditoría | Sin depuración automática; se redacta al suprimir un cliente | *[Completar: posible obligación legal o plazo de prescripción]* |
| Copias de seguridad | Del despliegue | *[Completar]* |

## 5. Consulta y aprobación

| Paso | Responsable | Fecha | Resultado |
|---|---|---|---|
| Revisión técnica (este documento) | Equipo de desarrollo | Fase 13 | Plantilla completada con las medidas implementadas |
| Revisión del DPD o asesor | *[Completar]* | | |
| ¿Hace falta consulta previa a la AEPD (art. 36)? | *[Completar]* | | |
| Aprobación del responsable | *[Completar]* | | |
| Próxima revisión | *[Completar: al menos anual o ante cambios relevantes]* | | |
