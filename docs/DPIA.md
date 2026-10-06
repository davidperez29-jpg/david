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
| Interesados | Clientes del centro (adultos; menores **[REQUIERE VALIDACIÓN LEGAL]**: la plataforma no lo impide hoy), entrenadores y administración. En el módulo de lesiones, también el nombre y el rol de quien toma la decisión de vuelta al deporte (puede ser un profesional externo). |
| Categorías de datos | Identificación y contacto; datos de entrenamiento (objetivos, planes, series, cargas, RPE, bienestar, evaluaciones físicas); **datos de salud** (declaraciones, cribado previo, molestias), solo con consentimiento explícito; **casos de lesión y readaptación** (§6), también solo con ese consentimiento; cuenta y seguridad (sesiones, intentos de inicio de sesión, auditoría). |
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
| R-6 | Datos en dispositivos del cliente (modo sin conexión) | Media | Medio | Solo la cola pendiente de sincronizar, borrada al sincronizar; sesión `HttpOnly`. Desde la fase 10 de la reestructuración, la cola es del usuario que la escribió: se vacía al cerrar sesión (con aviso si queda algo) y se borra lo ajeno al entrar otra cuenta (`PENTEST.md` P-10) | Medio-bajo (aceptado *[validar]*): sigue sin cifrarse en el dispositivo |
| R-7 | Interpretación clínica errónea de las recomendaciones | Media | Alto | Lenguaje de no diagnóstico; derivación a profesional sanitario; trazabilidad de cada recomendación a sus fuentes; el entrenador decide | Bajo |
| R-8 | Exportaciones o informes que salen del sistema | Media | Medio | Exportaciones auditadas; descargas sin caché; sin salud en las exportaciones masivas; neutralización de fórmulas | Medio-bajo |
| R-9 | Supresión incompleta | Baja | Medio | Anonimización transaccional con tests; redacción de la auditoría del cliente. **Las copias de seguridad conservan los datos hasta su caducidad** | Bajo *[definir la caducidad de las copias]* |
| R-10 | Abuso por personal con privilegios (ADMIN) | Baja | Alto | Auditoría *append-only* de cada escritura y de las lecturas de salud; 2FA obligatorio | Medio-bajo |
| R-11 | Acceso indebido o fuga de los casos de lesión (información recibida del profesional sanitario, síntomas, criterios, decisiones) | Baja | Alto | Ver §6: consentimiento exigido para escribir; solo staff con el cliente en su ámbito; RLS que lo oculta incluso a la app del cliente; información recibida y notas de síntomas cifradas; lecturas auditadas; el informe de readaptación no incluye la información recibida | Bajo. Pendiente: mecanismo, restricciones y notas del caso no se cifran (texto libre que escribe el staff) *[decidir si cifrarlos]* |
| R-12 | Que el software se tome por un alta médica o por una decisión automatizada de vuelta al deporte | Media | Alto | Nunca dice «apto» (lo comprueban el dominio, los informes y las pruebas E2E). Lo máximo que calcula es «Listo para valoración». Una persona pulsa [Avanzar de fase] y la decisión de vuelta se guarda con su nombre y su rol. Los avisos de parada piden valoración por un profesional sanitario | Bajo |
| R-13 | Derechos sobre los datos nuevos incompletos (exportación o supresión que no los incluye) | Baja | Medio | La supresión borra los casos de lesión con todo lo que cuelga de ellos. La exportación del interesado los incluye. Una prueba falla si aparece una tabla con datos de un cliente sin exportar ni justificar (`PENTEST.md` P-11) | Bajo |

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
| Casos de lesión (abiertos y cerrados) | Mientras dure la relación; se borran al suprimir o anonimizar al cliente | *[Completar: ¿borrar los casos cerrados tras un plazo?]* |

## 5. Consulta y aprobación

| Paso | Responsable | Fecha | Resultado |
|---|---|---|---|
| Revisión técnica (este documento) | Equipo de desarrollo | Fase 13 | Plantilla completada con las medidas implementadas |
| Revisión técnica: módulo de lesiones y datos nuevos | Equipo de desarrollo | Fase 10 de la reestructuración (06/10/2026) | §6, R-11 a R-13 y R-6 actualizado. Se corrigieron la supresión y la exportación (P-11) |
| Revisión del DPD o asesor | *[Completar]* | | |
| ¿Hace falta consulta previa a la AEPD (art. 36)? | *[Completar]* | | |
| Aprobación del responsable | *[Completar]* | | |
| Próxima revisión | *[Completar: al menos anual o ante cambios relevantes]* | | |

## 6. Módulo de lesiones, readaptación y vuelta al deporte

Añadido en la fase 7 de la reestructuración (`INJURY_MODULE.md`). Revisado en la fase 10.

| Aspecto | Cómo lo trata el software |
|---|---|
| Qué se guarda | Afección elegida del catálogo, lado, fecha y mecanismo; información recibida del profesional sanitario y quién la emitió; fecha del alta clínica (si la hay); fase actual e historial de fases; síntomas (dolor 0–10 y señales de alarma, con nota); avisos; criterios comprobados; decisiones de vuelta al deporte con nombre, rol, fecha y motivo |
| Qué no hace | No diagnostica, no prescribe tratamiento y no da altas. Las palabras «apto» y «alta deportiva» están prohibidas en sus textos |
| Base jurídica | Consentimiento explícito para datos de salud (art. 9.2.a): sin él, no se puede abrir un caso ni registrar síntomas, criterios o decisiones *[Validar con el DPD si procede otra base, p. ej. en clubes con servicio médico]* |
| Quién accede | Entrenadores con el cliente asignado y ADMIN. La app del cliente no lo ve: lo impide la autorización y, además, la RLS. Cada lectura queda auditada como acceso a datos sensibles |
| Cifrado | Información recibida del profesional y notas de síntomas: AES-256-GCM en columna. Mecanismo, restricciones y notas del caso: sin cifrar (ver R-11) |
| Informes | El informe de readaptación congela la fase, los criterios, las variables del protocolo y las decisiones. **No incluye la información recibida del profesional** |
| Derechos | Exportación del interesado: incluye todos los datos del caso. Supresión: borra el caso y todo lo que cuelga de él |
| Decisiones automatizadas (art. 22) | El software calcula si se cumplen los criterios. Avanzar de fase y decidir la vuelta lo hace siempre una persona identificada, que queda registrada |

