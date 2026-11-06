# Integraciones: requisitos y arquitectura

> **Estado: análisis, sin ninguna integración conectada ni probada.** No se presupone que exista una API disponible: cada una se verificará con el fabricante (documentación, condiciones, coste y contrato de tratamiento) antes de diseñarla. Fuentes consultadas el 6 de noviembre de 2026: [O] oficial, [T] terceros.

## 1. Principios

1. **Primero lo que no depende de nadie:** transcripción manual con procedencia (P-25) e importación de archivos CSV con plantillas de correspondencia.
2. **Los datos importados son `imported`** y conservan el dispositivo, el modelo, la versión del _firmware_ si se conoce, el lote de importación y la suma de comprobación del archivo de origen.
3. **No se deducen variables que el dispositivo no mide** (`SCIENTIFIC_RIGOR.md`).
4. **Consentimiento por integración**, revocable, con la lista de datos que se reciben.
5. **Cada integración es un adaptador** detrás de un puerto (`IngestionPort`): cambiar o quitar un proveedor no toca el resto.

## 2. Requisitos por tipo de integración

| Tipo                                                  | Qué aporta                                                                     | Vías posibles                                                             | Qué requiere                                                                                                                  | Situación conocida                                                                                                                                                                                                                    |
| ----------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Encoders lineales o rotacionales**                  | Velocidad media y pico, potencia, pérdida de velocidad, perfil carga–velocidad | Exportación de archivos; API en la nube del fabricante; Bluetooth directo | Formato y documentación de la exportación; acuerdo de API; para Bluetooth, especificación del dispositivo y app nativa en iOS | Vitruve ofrece exportación de datos [T]; Output Sports usa su propio sensor y plataforma [T]. Sin API pública verificada                                                                                                              |
| **Plataformas de fuerza**                             | Variables del salto y la isometría calculadas por su software                  | API en la nube; exportación                                               | Cuenta de integración y token; correspondencia de métricas; versión de los algoritmos del fabricante                          | Hawkin Dynamics incluye una **API abierta** con token del administrador [O, y paquete comunitario]; VALD tiene API para socios (beta en 2024) [T]                                                                                     |
| **Fotocélulas y cronometraje**                        | Tiempos de sprint y de cambio de dirección                                     | Exportación; API si existe                                                | Formato; identificación de cada intento y distancia                                                                           | Sin verificar                                                                                                                                                                                                                         |
| **Dinamometría**                                      | Fuerza isométrica, asimetrías                                                  | Exportación; API                                                          | Igual que las plataformas                                                                                                     | Kinvent integra sus sensores en su app y exporta informes [O]; API sin verificar                                                                                                                                                      |
| **Wearables (frecuencia cardiaca, sueño, actividad)** | Frecuencia cardiaca, sesiones, sueño y recuperación según cada fabricante      | API en la nube con OAuth del usuario; plataformas de salud del móvil      | Programa de desarrolladores y aprobación; consentimiento de cada usuario; para Apple Health o Health Connect, **app nativa**  | Polar AccessLink: API de solo lectura con OAuth2 y consentimiento del usuario (dato de 2017, a confirmar) [T]. Garmin: programa para empresas con aprobación; **en primavera de 2026 el formulario de solicitud estaba en pausa** [T] |
| **Apps de pruebas de campo**                          | Saltos, sprints y cambios de dirección medidos con el móvil                    | Exportación o transcripción                                               | Formato; identificar que la cifra la calcula la app                                                                           | My Jump Lab: varios estudios de validación, parte firmados por su desarrollador [T]                                                                                                                                                   |

## 3. Límites de una PWA

| Limitación                                            | Consecuencia                                                           | Fuente                                                         |
| ----------------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------- |
| **Web Bluetooth no está disponible en Safari de iOS** | No se puede conectar un sensor por Bluetooth desde la PWA en un iPhone | [T]; a confirmar con WebKit                                    |
| **HealthKit no tiene API web**                        | Leer Apple Health exige una app nativa complementaria                  | Conocimiento previo, a verificar con la documentación de Apple |
| Health Connect (Android) es una API nativa            | Igual en Android                                                       | A verificar                                                    |

**Decisión pendiente (P-59):** cuando llegue la etapa de integraciones (E5), elegir entre integraciones de nube a nube (sin app nativa) o una app nativa complementaria, mínima, solo para sensores y plataformas de salud.

## 4. Arquitectura propuesta

```
Fuente (archivo, API, transcripción)
   │
   ▼
Adaptador (uno por fabricante) ──► Carga en bruto (se conserva, con suma de comprobación)
   │
   ▼
Correspondencia versionada (métrica del fabricante → medición de TrainPro)
   │
   ▼
Medición normalizada (`imported`, dispositivo, lote, versión de la correspondencia)
   │
   ▼
Evaluaciones, registro de series, carga y volumen
```

Entidades (amplían `DATA_MODEL.md` §10):

- `device`: modelo, fabricante, número de serie y _firmware_ si se conocen.
- `integration_connection`: organización, proveedor, consentimiento, estado, último acceso.
- `raw_import`: carga original, suma de comprobación y fecha.
- `metric_mapping`: versión de la correspondencia.

## 5. Orden propuesto

1. **1B:** transcripción manual con procedencia (sin integración).
2. **E2:** importación de CSV con plantillas para los formatos de exportación más comunes, cuando se verifiquen.
3. **E5:** la primera integración por API, elegida por demanda real y por la apertura verificada de su API. Hawkin Dynamics es candidata por declarar una API abierta incluida en su licencia [O].

## 6. Costes y riesgos

- **Hardware de prueba:** para desarrollar y probar una integración hace falta el dispositivo o un acuerdo con el fabricante. Por ejemplo, ~447 $ un encoder y ~6.500 $ una plataforma doble, según tiendas [T]. **Requiere tu aprobación.**
- **Programas de desarrolladores:** pueden exigir aprobación, condiciones comerciales o tarifas.
- **Riesgo de dependencia:** cambios o cierres de API (como la pausa del programa de Garmin [T]). Mitigación: adaptadores aislados y conservación de los datos en bruto.
- **Privacidad:** los datos de _wearables_ pueden ser datos de salud. Cada integración necesita contrato de tratamiento, minimización y consentimiento.

## Fuentes

[Hawkin Dynamics, soluciones](https://hawkindynamics.com/hawkin-solutions) · [hdforce en PyPI](https://pypi.org/project/hdforce/) · [Sideline Sports sobre la API de VALD](https://sidelinesports.com/blog/beta-version-of-vald-api-integration-available) · [Kinvent, software](https://kinvent.com/software/) · [Vitruve en el App Store](https://apps.apple.com/us/app/-/id6535689778) · [Polar AccessLink (DC Rainmaker, 2017)](https://www.dcrainmaker.com/2017/10/polar-flow-api-accesslink.html/comment-page-2) · [Garmin Health API](https://developer.garmin.com/gc-developer-program/health-api/) · [pausa del programa de Garmin (Terra, 2026)](https://tryterra.co/blog/garmin-connect-developer-program-pause) · [limitaciones de las PWA en iOS (MagicBell)](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide) · [SimpliFaster](https://store.simplifaster.com/product-category/hawkin-dynamics/).
