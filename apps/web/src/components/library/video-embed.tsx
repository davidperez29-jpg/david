/**
 * An exercise video (YouTube without cookies or Vimeo; `src` comes from `parseVideoUrl`, and the
 * CSP only allows those hosts in frames). Sandboxed: the player cannot open windows or navigate
 * the page; it only gets the origin as referrer (restructure phase 21, P-27).
 */
export function VideoEmbed({
  src,
  title,
  className,
}: {
  src: string;
  title: string;
  className?: string;
}) {
  return (
    <iframe
      title={title}
      src={src}
      className={className}
      allow="encrypted-media; picture-in-picture"
      referrerPolicy="strict-origin-when-cross-origin"
      sandbox="allow-scripts allow-same-origin allow-presentation"
      loading="lazy"
    />
  );
}
