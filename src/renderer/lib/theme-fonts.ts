const fontStylesheetUrl =
  'https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600&family=Geist+Mono:wght@400;500;600&family=Instrument+Sans:wght@400;500;600&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&family=Lora:wght@400;500;600&family=Outfit:wght@400;500;600&family=Playfair+Display:wght@400;500;600&family=Poppins:wght@400;500;600&display=swap';

const scheduledDocuments = new WeakSet<Document>();

/** Optional web fonts must never participate in document or window readiness. */
export function loadThemeFonts(
  target: Document = document,
  request: typeof fetch = fetch,
): void {
  if (scheduledDocuments.has(target)) {
    return;
  }

  scheduledDocuments.add(target);
  const start = () => {
    void request(fontStylesheetUrl)
      .then((response) => {
        if (!response.ok) {
          throw new Error('Theme fonts are unavailable.');
        }

        return response.text();
      })
      .then((css) => {
        if (target.querySelector('[data-theme-fonts]')) {
          return;
        }

        const style = target.createElement('style');
        style.dataset.themeFonts = '';
        style.textContent = css;
        target.head.append(style);
      })
      .catch(() => {
        // Every theme keeps its local fallback stack when font delivery fails.
      });
  };

  if (target.readyState === 'complete') {
    start();
  } else {
    target.defaultView?.addEventListener('load', start, { once: true });
  }
}
