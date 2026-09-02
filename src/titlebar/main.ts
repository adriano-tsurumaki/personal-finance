import './style.css';

const minimizeButton = document.querySelector<HTMLButtonElement>(
    '#window-minimize',
);

const maximizeButton = document.querySelector<HTMLButtonElement>(
    '#window-maximize',
);

const closeButton = document.querySelector<HTMLButtonElement>(
    '#window-close',
);

minimizeButton?.addEventListener('click', () => {
    window.desktopWindow.minimize();
});

maximizeButton?.addEventListener('click', () => {
    window.desktopWindow.toggleMaximize();
});

closeButton?.addEventListener('click', () => {
    window.desktopWindow.close();
});

document.querySelector('#titlebar')?.addEventListener('dblclick', (event) => {
    const target = event.target as HTMLElement;

    if (target.closest('.window-controls')) {
        return;
    }

    window.desktopWindow.toggleMaximize();
});