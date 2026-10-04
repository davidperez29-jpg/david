# Integraciones

> Fase 15: preparación. Implementa `MASTER_SPECIFICATION.md` §5 («Integraciones»).
>
> Los datos externos entran por **adaptadores** que escriben en `external_measurements`. Aún no hay conexiones con fabricantes: se añadirán cuando exista una necesidad real (§16, Fase 15+).

## 1. Modelo

- **`external_measurements`**: mediciones por cliente.
  - Origen: `source`, con un adaptador por origen.
  - Contenido: `device`, `type`, `value`, `unit`, `measured_at`.
  - Deduplicación: `external_id`, clave única por origen.
- **`integration_connections`**: conexión de un cliente con un servicio. Los tokens OAuth van cifrados con AES-256-GCM y se rotan con `pnpm keys:rotate`. **Nunca se exportan** al interesado.
- **Puerto `ExternalDataSource`** (`packages/application/src/integrations.ts`): `parse(content) → mediciones`. Cada adaptador solo traduce. Después, la validación, el consentimiento, la deduplicación y la auditoría son comunes.

## 2. Tipos de medición

Los tipos están en `packages/domain/src/integrations`. Los límites son **técnicos**: solo detectan errores de unidad o de tecleo. No son rangos clínicos ni se usan para interpretar nada.

| Tipo | Unidad | Límites técnicos | Dato de salud |
|---|---|---|---|
| `resting_heart_rate` | bpm | 20–250 | **Sí** |
| `hrv_rmssd` | ms | 1–500 | **Sí** |
| `sleep_duration` | h | 0–24 | **Sí** |
| `steps` | pasos | 0–200 000 | No |
| `body_mass` | kg | 20–400 | No |
| `session_duration` | min | 0–1 440 | No |
| `distance` | km | 0–1 000 | No |
| `jump_height` | cm | 0–150 | No |
| `mean_propulsive_velocity` | m/s | 0–5 | No |

**Datos de salud** (art. 9 RGPD):

- solo se guardan si el cliente tiene activo el consentimiento de datos de salud; si no, esa fila se rechaza con el motivo;
- solo los ve quien puede leer datos de salud de ese cliente.

## 3. Adaptadores genéricos

**JSON**: una lista, o un objeto con `measurements`.

```json
[
  { "id": "a1", "type": "steps", "value": 8432, "unit": "pasos", "measuredAt": "2026-10-01T20:00:00Z" },
  { "type": "body_mass", "value": 72.4, "unit": "kg", "measuredAt": "2026-10-02T07:30:00Z", "device": "Báscula" }
]
```

**CSV**:

- separador `;` o `,`, y coma decimal admitida;
- cabeceras en español o en inglés: `tipo`/`type`, `valor`/`value`, `unidad`/`unit`, `fecha`/`measured_at`; opcionales `dispositivo`/`device` e `id`/`external_id`.

```csv
tipo;valor;unidad;fecha;dispositivo
steps;8432;pasos;2026-10-01T20:00:00Z;Reloj
body_mass;72,4;kg;2026-10-02T07:30:00Z;Báscula
```

**Reglas**:

- hasta 5 000 mediciones y 1 MB por archivo;
- las filas válidas entran y las erróneas se listan por número de fila y campo;
- **reimportar el mismo archivo no duplica**: se usa el `id` del dispositivo o, si no lo hay, una huella del contenido.

## 4. Uso

- **Interfaz**: ficha del cliente → **Seguimiento** → «Datos de dispositivos». Muestra las últimas mediciones y permite importar un archivo.
- **API**:

| Método y ruta | Permiso | Descripción |
|---|---|---|
| `POST /clients/{id}/external-measurements` | `integrations:import` (ADMIN de la organización, entrenador asignado) | `{provider: json \| csv, content, device?}` → `{imported, duplicates, errors[]}`. Auditado. |
| `GET /clients/{id}/external-measurements?type&limit` | `clients:read` (también el propio cliente) | Mediciones más recientes. Los tipos de salud solo se devuelven con `health:read`. |

- **RGPD**: las mediciones forman parte de la exportación del interesado (`mediciones_de_dispositivos`) y se borran al suprimirlo, junto con sus conexiones.

## 5. Añadir un fabricante (cuando haga falta)

1. Un adaptador `ExternalDataSource` que traduzca su formato.
2. Si es por OAuth: el flujo de conexión guarda los tokens cifrados en `integration_connections`, y un trabajo periódico descarga y llama al adaptador.
3. Confirmar en la documentación oficial del fabricante el significado y la unidad de cada campo **[REQUIERE VERIFICACIÓN]**, y añadir los tipos nuevos al catálogo con sus límites técnicos.
4. Revisar la DPIA: un nuevo destinatario o encargado y nuevos datos.
