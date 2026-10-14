import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { setLocale } from '@lib/i18n';
import { ToastItem, ToastProvider, ToastViewport } from './toast';

test('loading has no close control and becomes hidden immediately when its state ends', () => {
  const loading = {
    id: 'loading',
    title: 'Loading period',
    type: 'loading',
    timeout: 0,
    data: { dismissible: false, instantDismiss: true },
  };
  const markup = renderToStaticMarkup(
    <ToastProvider>
      <ToastItem toast={loading} />
    </ToastProvider>,
  );
  assert.match(markup, /Loading period/);
  assert.match(markup, /animate-spin/);
  assert.doesNotMatch(markup, /data-slot="toast-close"/);
  assert.match(markup, /transition:none/);
  const ending = renderToStaticMarkup(
    <ToastProvider>
      <ToastItem toast={{ ...loading, transitionStatus: 'ending' }} />
    </ToastProvider>,
  );
  assert.match(ending, /hidden=""/);
});

test('errors expose retry and a localized close control in the centered viewport', () => {
  setLocale('en-US');

  try {
    const markup = renderToStaticMarkup(
      <ToastProvider>
        <ToastViewport>
          <ToastItem
            toast={{
              id: 'error',
              title: 'Could not load',
              type: 'error',
              data: { dismissible: true },
              actionProps: { children: 'Try again' },
            }}
          />
        </ToastViewport>
      </ToastProvider>,
    );
    assert.match(markup, /Try again/);
    assert.match(markup, /data-slot="toast-close"/);
    assert.match(markup, /aria-label="Close"/);
    assert.match(markup, /inset-x-4 bottom-4[^"<]*mx-auto/);
    assert.doesNotMatch(markup, /sm:left-auto|sm:right-4|sm:mx-0/);
  } finally {
    setLocale('pt-BR');
  }
});
