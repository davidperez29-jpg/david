/**
 * Inline script that keeps the browser's install prompt (Chrome, Edge, Samsung Internet) from the
 * first moment, before React is ready, for the «Instalar la app» button (restructure phase 24).
 * A plain module, like THEME_BOOT: the root layout puts it in the page.
 */
export const INSTALL_BOOT = `addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__tpInstall=e;dispatchEvent(new Event('tp:installable'))});addEventListener('appinstalled',function(){window.__tpInstall=null;window.__tpInstalled=true;dispatchEvent(new Event('tp:installable'))});`;
