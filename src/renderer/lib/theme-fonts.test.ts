import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadThemeFonts } from './theme-fonts';

function documentFixture(readyState: DocumentReadyState = 'loading') {
  const loaded = new EventTarget();
  const styles: { dataset: Record<string, string>; textContent: string }[] = [];
  const target = {
    readyState,
    defaultView: loaded,
    querySelector: () => styles[0] ?? null,
    createElement: () => ({ dataset: {}, textContent: '' }),
    head: { append: (style: (typeof styles)[number]) => styles.push(style) },
  } as unknown as Document;
  return { target, loaded, styles };
}

test('font delivery starts after document load and a pending request cannot block initialization', async () => {
  const { target, loaded, styles } = documentFixture();
  let requests = 0;
  let resolve!: (response: Response) => void;
  const request = (() => {
    requests += 1;
    return new Promise<Response>((done) => {
      resolve = done;
    });
  }) as typeof fetch;
  loadThemeFonts(target, request);
  loadThemeFonts(target, request);
  assert.equal(requests, 0);
  loaded.dispatchEvent(new Event('load'));
  assert.equal(requests, 1);
  assert.equal(styles.length, 0);
  loaded.dispatchEvent(new Event('load'));
  assert.equal(requests, 1);
  resolve(
    new Response('@font-face { font-family: Example; src: local(Example); }'),
  );
  await new Promise((done) => setImmediate(done));
  assert.equal(styles.length, 1);
  assert.match(styles[0].textContent, /@font-face/);
  assert.equal(styles[0].dataset.themeFonts, '');
});

test('offline and HTTP font failures preserve fallback typography without injecting a stylesheet', async () => {
  for (const request of [
    async () => {
      throw new Error('Offline');
    },
    async () => new Response('', { status: 503 }),
  ]) {
    const { target, styles } = documentFixture('complete');
    loadThemeFonts(target, request as typeof fetch);
    await new Promise((done) => setImmediate(done));
    assert.deepEqual(styles, []);
  }
});
