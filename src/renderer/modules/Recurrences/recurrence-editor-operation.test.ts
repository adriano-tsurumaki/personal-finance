import assert from 'node:assert/strict';
import { test } from 'node:test';
import { useProfileStore } from '@store/profile';
import { confirmation } from '@store/confirmation';
import type {
  RecurrenceConfirmInput,
  RecurrenceCreateInput,
  RecurrenceRuleDto,
  RecurrenceUpdateInput,
  RecurrenceOccurrenceDto,
} from '@shared/contracts/recurrence';
import { saveRecurrenceEditor } from './recurrence-editor-operation';

const occurrence: RecurrenceOccurrenceDto = {
  kind: 'projection',
  recurrence_id: 7,
  version_id: 12,
  scheduled_date: '2026-10-03',
  name: 'Membership',
  type: 2,
  amount_cents: 5000,
  category_id: 4,
  payment_id: 1,
  credit_card_id: null,
  state: 'unconfirmed',
  transaction_id: null,
  actual_reference_date: null,
  cash_flow_date: null,
  credit_card_invoice_id: null,
  coverage: 'not_required',
  issue: null,
};

function operation() {
  return {
    editor: { action: 'confirm' as const, occurrence },
    values: occurrence,
    date: '2026-10-05',
    cadence: 'monthly',
    credit: false,
    financed: false,
    financing: null,
    invoiceMonth: '2026-11',
    invoiceId: 9,
    profile: { id: 1 },
    session: useProfileStore.getState().sessionVersion,
  };
}

test('confirming with a different reference date retains occurrence identity and clears stale credit selections for direct payment', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  let confirmed: RecurrenceConfirmInput | undefined;
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      api: {
        recurrence: {
          confirm: async (input: RecurrenceConfirmInput) => {
            confirmed = input;
            return { ok: true, value: 42 };
          },
        },
      },
    },
  });

  try {
    const result = await saveRecurrenceEditor(operation());
    assert.deepEqual(result, { ok: true, value: 42 });
    assert.equal(confirmed?.scheduled_date, '2026-10-03');
    assert.equal(confirmed?.reference_date, '2026-10-05');
    assert.equal(confirmed?.expected_version_id, 12);
    assert.equal(confirmed?.invoice_month, null);
    assert.equal(confirmed?.credit_card_invoice_id, null);
    assert.equal(confirmed?.financing, null);
  } finally {
    if (descriptor) {
      Object.defineProperty(globalThis, 'window', descriptor);
    } else {
      Reflect.deleteProperty(globalThis, 'window');
    }
  }
});

test('changing profiles during card correction review prevents occurrence persistence', async (context) => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const session = useProfileStore.getState().sessionVersion;
  let writes = 0;
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      api: {
        previewTransactionCreation: async () => ({
          token: 'review',
          changes: [],
          affected_payment_months: [],
        }),
        recurrence: {
          confirm: async () => {
            writes += 1;
            return { ok: true, value: 42 };
          },
        },
      },
    },
  });
  context.mock.method(confirmation, 'confirm', async () => {
    useProfileStore.setState({ sessionVersion: session + 1 });
    return true;
  });

  try {
    const result = await saveRecurrenceEditor({ ...operation(), credit: true });
    assert.deepEqual(result, {
      ok: false,
      error: { code: 'conflict', message: 'Cancelled' },
    });
    assert.equal(writes, 0);
  } finally {
    useProfileStore.setState({ sessionVersion: session });

    if (descriptor) {
      Object.defineProperty(globalThis, 'window', descriptor);
    } else {
      Reflect.deleteProperty(globalThis, 'window');
    }
  }
});

test('editing an earlier effective date targets its retained version instead of the latest version', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  let updated: RecurrenceUpdateInput | undefined;
  const rule: RecurrenceRuleDto = {
    id: 7,
    name: occurrence.name,
    status: 'active',
    anchor_date: '2026-01-03',
    last_retained_date: null,
    versions: [
      {
        ...occurrence,
        id: 11,
        version: 1,
        frequency: 3,
        interval: 1,
        start_date: '2026-01-03',
        end_date: '2026-11-03',
        active: 1,
      },
      {
        ...occurrence,
        id: 12,
        version: 2,
        frequency: 3,
        interval: 1,
        start_date: '2026-11-03',
        end_date: null,
        active: 1,
      },
    ],
  };
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      api: {
        recurrence: {
          update: async (input: RecurrenceUpdateInput) => {
            updated = input;
            return { ok: true, value: undefined };
          },
        },
      },
    },
  });

  try {
    await saveRecurrenceEditor({
      ...operation(),
      editor: { action: 'edit', rule },
    });
    assert.equal(updated?.expected_version_id, 11);
    assert.equal(updated?.scheduled_date, '2026-10-05');
  } finally {
    if (descriptor) {
      Object.defineProperty(globalThis, 'window', descriptor);
    } else {
      Reflect.deleteProperty(globalThis, 'window');
    }
  }
});

test('quarterly creation retains the selected first date and a three-month interval', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  let created: RecurrenceCreateInput | undefined;
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      api: {
        recurrence: {
          create: async (input: RecurrenceCreateInput) => {
            created = input;
            return { ok: true, value: 7 };
          },
        },
      },
    },
  });

  try {
    await saveRecurrenceEditor({
      ...operation(),
      editor: { action: 'create' },
      cadence: 'quarterly',
    });
    assert.equal(created?.start_date, '2026-10-05');
    assert.equal(created?.frequency, 3);
    assert.equal(created?.interval, 3);
    assert.equal(created?.amount_cents, occurrence.amount_cents);
  } finally {
    if (descriptor) {
      Object.defineProperty(globalThis, 'window', descriptor);
    } else {
      Reflect.deleteProperty(globalThis, 'window');
    }
  }
});
