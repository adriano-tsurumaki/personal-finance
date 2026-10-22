import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { FieldSelect } from './field';

test('repeated select fields connect distinct triggers to their labels and feedback', () => {
  const markup = renderToStaticMarkup(
    <>
      {[1, 2].map((key) => (
        <FieldSelect
          key={key}
          label="Category"
          value={1}
          options={[{ value: 1, label: 'Travel' }]}
          onValueChange={() => {}}
          description="Choose a category"
          error="Category is unavailable"
        />
      ))}
    </>,
  );
  const ids = [...markup.matchAll(/<label[^>]* for="([^"]+)"/g)].map(
    (match) => match[1],
  );
  assert.equal(ids.length, 2);
  assert.notEqual(ids[0], ids[1]);

  for (const id of ids) {
    const trigger = [...markup.matchAll(/<button[^>]*>/g)].find((match) =>
      match[0].includes(`id="${id}"`),
    )?.[0];
    assert.ok(trigger);
    assert.ok(trigger.includes('aria-invalid="true"'));
    assert.ok(
      trigger.includes(`aria-describedby="${id}-description ${id}-error"`),
    );
    assert.ok(markup.includes(`id="${id}-description"`));
    assert.ok(markup.includes(`id="${id}-error"`));
  }
});

test('select fields preserve null, zero, and string values and use option labels in the trigger', () => {
  for (const value of [null, 0, 'manual'] as const) {
    const options = [
      { value: null, label: 'Automatic' },
      { value: 0, label: 'Current invoice' },
      { value: 'manual', label: 'Manual', content: 'Manual (archived)' },
    ];
    const markup = renderToStaticMarkup(
      <FieldSelect<string | number>
        id="invoice-choice"
        name="invoice"
        label="Invoice"
        value={value}
        options={options}
        onValueChange={() => {}}
        placeholder="Choose an invoice"
      />,
    );
    assert.ok(markup.includes(`for="invoice-choice"`));
    assert.ok(markup.includes(`id="invoice-choice"`));
    assert.ok(markup.includes('name="invoice"'));
    assert.ok(
      markup.includes(options.find((option) => option.value === value)!.label),
    );
    assert.ok(!markup.includes('Manual (archived)'));
    assert.ok(!markup.includes('aria-describedby='));
  }
});

test('disabled select fields retain their placeholder and supplemental status', () => {
  const markup = renderToStaticMarkup(
    <FieldSelect<number>
      label="Invoice"
      value={null}
      options={[]}
      disabled
      placeholder="Choose an invoice"
    >
      <p role="status">Loading invoices</p>
    </FieldSelect>,
  );
  assert.match(markup, /<button[^>]*disabled=""/);
  assert.ok(markup.includes('Choose an invoice'));
  assert.ok(markup.includes('Loading invoices'));
});
