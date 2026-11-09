/**
 * Borra los datos de una ejecución anterior de las E2E (`.data/e2e`) antes de arrancar el servidor
 * de pruebas (docs/V1_SPEC.md §8.3.1). Solo toca esa carpeta: la base de desarrollo
 * (`.data/trainpro.sqlite`) y sus copias no se tocan nunca.
 */
import { rmSync } from 'node:fs';
import { resolve, sep } from 'node:path';

const target = resolve('.data', 'e2e');
if (!target.endsWith(`${sep}.data${sep}e2e`)) throw new Error(`Ruta inesperada: ${target}`);
rmSync(target, { recursive: true, force: true });
console.log(`Datos de E2E borrados: ${target}`);
