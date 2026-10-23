import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { createAppearanceService } from './appearance';

function removeFixture(directory: string): void {
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep));
  rmSync(directory, { recursive: true, force: true });
}

test('appearance survives restart independently of profiles and resolves system mode', () => {
  const directory = mkdtempSync(join(tmpdir(), 'finance-appearance-'));
  try {
    const filename = join(directory, 'appearance.json');
    const service = createAppearanceService(filename);
    assert.equal(service.snapshot(false).resolvedMode, 'light');
    assert.equal(service.snapshot(true).resolvedMode, 'dark');
    service.update({ themeId: 'graphite', colorMode: 'light' });
    assert.equal(service.snapshot(true).resolvedMode, 'light');
    const reopened = createAppearanceService(filename);
    assert.equal(reopened.snapshot(true).themeId, 'graphite');
    assert.equal(reopened.snapshot(true).resolvedMode, 'light');
    reopened.update({ themeId: 'ledger', colorMode: 'dark' });
    assert.equal(reopened.snapshot(false).resolvedMode, 'dark');
    reopened.update({ themeId: 'ledger', colorMode: 'system' });
    const before = reopened.snapshot(false);
    reopened.systemChanged();
    assert.equal(reopened.snapshot(true).resolvedMode, 'dark');
    assert.ok(reopened.snapshot(true).revision > before.revision);
  } finally {
    removeFixture(directory);
  }
});

test('malformed files fall back safely and invalid IPC input cannot change appearance', () => {
  const directory = mkdtempSync(join(tmpdir(), 'finance-appearance-'));
  try {
    const filename = join(directory, 'appearance.json');
    for (const saved of [
      '{',
      'null',
      '{"themeId":"missing","colorMode":"dark"}',
      '{"themeId":"ledger","colorMode":"invalid"}',
    ]) {
      writeFileSync(filename, saved);
      const service = createAppearanceService(filename);
      assert.equal(service.snapshot(false).themeId, 'ledger');
      assert.equal(service.snapshot(false).colorMode, 'system');
      const before = service.snapshot(false);
      for (const value of [
        null,
        {},
        { themeId: 'missing', colorMode: 'light' },
        { themeId: 'ledger', colorMode: 'invalid' },
      ]) {
        assert.throws(() => service.update(value), /Invalid appearance/);
        assert.deepEqual(service.snapshot(false), before);
      }
    }
  } finally {
    removeFixture(directory);
  }
});

test('persistence failures preserve the last published preference and revision', () => {
  const directory = mkdtempSync(join(tmpdir(), 'finance-appearance-'));
  try {
    const service = createAppearanceService(
      join(directory, 'missing', 'appearance.json'),
    );
    const before = service.snapshot(false);
    assert.throws(() =>
      service.update({ themeId: 'graphite', colorMode: 'dark' }),
    );
    assert.deepEqual(service.snapshot(false), before);
  } finally {
    removeFixture(directory);
  }
});
