/**
 * Video links (§28). Only well-formed YouTube/Vimeo URLs are accepted; the system never
 * fabricates links and a new link always starts as `pending_verification`.
 */
export type VideoProvider = 'youtube' | 'vimeo';

export interface ParsedVideo {
  provider: VideoProvider;
  id: string;
  /** Canonical URL stored in the database. */
  canonicalUrl: string;
  /** Privacy-friendly embed URL (no tracking cookies for YouTube). */
  embedUrl: string;
}

const YT_ID = /^[A-Za-z0-9_-]{11}$/;

export function parseVideoUrl(raw: string): ParsedVideo | null {
  let url: URL;
  try {
    url = new URL(raw.trim().startsWith('http') ? raw.trim() : `https://${raw.trim()}`);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const host = url.hostname.replace(/^www\.|^m\./, '');
  let id: string | null = null;
  if (host === 'youtu.be') id = url.pathname.slice(1).split('/')[0] ?? null;
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (url.pathname === '/watch') id = url.searchParams.get('v');
    else {
      const m = url.pathname.match(/^\/(?:shorts|embed|live|v)\/([^/?#]+)/);
      id = m?.[1] ?? null;
    }
  } else if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const m = url.pathname.match(/^\/(?:video\/)?(\d{5,12})(?:\/|$)/);
    if (!m) return null;
    return {
      provider: 'vimeo',
      id: m[1]!,
      canonicalUrl: `https://vimeo.com/${m[1]}`,
      embedUrl: `https://player.vimeo.com/video/${m[1]}`,
    };
  }
  if (!id || !YT_ID.test(id)) return null;
  return {
    provider: 'youtube',
    id,
    canonicalUrl: `https://www.youtube.com/watch?v=${id}`,
    embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
  };
}

export const PENDING_VIDEO_TEXT = 'Vídeo pendiente de verificación.';
