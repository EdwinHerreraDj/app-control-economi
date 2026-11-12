/**
 * Teclado en móvil y app instalada.
 *
 * En iPhone (y en navegadores que no redimensionan la página al abrir el
 * teclado) un panel pegado abajo queda tapado por el teclado. Aquí se
 * publica en CSS cuánto ocupa el teclado (--keyboard-inset) y el alto
 * visible (--visual-height) para que los paneles suban con él, y se lleva a
 * la vista el campo en el que se está escribiendo.
 */
export function trackVisualViewport(): void {
    const viewport = window.visualViewport;
    const root = document.documentElement;

    if (viewport) {
        const update = () => {
            const keyboard = Math.max(
                0,
                window.innerHeight - viewport.height - viewport.offsetTop,
            );

            root.style.setProperty(
                '--keyboard-inset',
                `${Math.round(keyboard)}px`,
            );
            root.style.setProperty(
                '--visual-height',
                `${Math.round(viewport.height)}px`,
            );
        };

        viewport.addEventListener('resize', update);
        viewport.addEventListener('scroll', update);
        update();
    }

    document.addEventListener('focusin', (event) => {
        const field = event.target;

        if (
            !(field instanceof HTMLElement) ||
            !field.matches('input, textarea, select') ||
            !field.closest('[role="dialog"]')
        ) {
            return;
        }

        // Tras abrirse el teclado (tarda un poco), el campo queda visible.
        window.setTimeout(
            () => field.scrollIntoView({ block: 'center', behavior: 'smooth' }),
            300,
        );
    });
}
