/** Where the chosen theme is kept in the browser (light, dark or nothing for the system one). */
export const THEME_KEY = 'tp-theme';

/**
 * Inline script that applies the saved theme before the first paint (no flash). A plain module,
 * not the client component's: the root layout (a server component) puts it in the page.
 */
export const THEME_BOOT = `try{var t=localStorage.getItem('${THEME_KEY}');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`;
