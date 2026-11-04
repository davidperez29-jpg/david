import type { MetadataRoute } from 'next';

/** Manifiesto de la PWA: permite instalar TrainPro desde el navegador (móvil y ordenador). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'TrainPro',
    short_name: 'TrainPro',
    description: 'Entrenamiento, evaluación, rendimiento, salud y readaptación.',
    lang: 'es',
    dir: 'ltr',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#FFF8EA',
    theme_color: '#FFF8EA',
    categories: ['health', 'fitness', 'sports'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
