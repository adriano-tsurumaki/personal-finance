import assert from 'node:assert/strict';
import { test } from 'node:test';
import { useProfileStore } from './profile';
import { getLocale, setLocale } from '@lib/i18n';
import type { UserDto } from '@shared/contracts/user';
import { useAppStore } from './transaction';
import { dialogTransactionStore } from './dialog-transaction';
import { confirmation, useConfirmationStore } from './confirmation';
import type { TransactionInput } from '@shared/contracts/transaction';
import type { ProfileOptionsDto } from '@shared/contracts/profile-catalog';

test('locale updates apply after saving and ignore responses for a departed profile', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const initialState = useProfileStore.getState();
  const initialLocale = getLocale();
  const profile: UserDto = {
    id: 1,
    name: 'First',
    email: 'first@example.test',
    locale: 'pt-BR',
  };
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      api: {
        updateProfileLocale: async () => {
          throw new Error('Save failed');
        },
      },
    },
  });

  try {
    useProfileStore.setState({ activeProfile: profile });
    setLocale(profile.locale);
    await assert.rejects(
      useProfileStore.getState().updateLocale('en-US'),
      /Save failed/,
    );
    assert.equal(useProfileStore.getState().activeProfile?.locale, 'pt-BR');
    assert.equal(getLocale(), 'pt-BR');
    let resolveUpdate!: (profile: UserDto) => void;
    window.api.updateProfileLocale = () =>
      new Promise((resolve) => {
        resolveUpdate = resolve;
      });
    const saving = useProfileStore.getState().updateLocale('en-US');
    assert.equal(getLocale(), 'pt-BR');
    resolveUpdate({ ...profile, locale: 'en-US' });
    await saving;
    assert.equal(useProfileStore.getState().activeProfile?.locale, 'en-US');
    assert.equal(getLocale(), 'en-US');
    const lateSave = useProfileStore.getState().updateLocale('pt-BR');
    const otherProfile = { ...profile, id: 2, locale: 'en-US' as const };
    useProfileStore.setState({ activeProfile: otherProfile });
    resolveUpdate(profile);
    await lateSave;
    assert.equal(useProfileStore.getState().activeProfile?.id, 2);
    assert.equal(getLocale(), 'en-US');
  } finally {
    useProfileStore.setState(initialState);
    setLocale(initialLocale);

    if (descriptor) {
      Object.defineProperty(globalThis, 'window', descriptor);
    } else {
      Reflect.deleteProperty(globalThis, 'window');
    }
  }
});

test('leaving a profile clears all financial state and ignores delayed responses after reentry', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const initialProfile = useProfileStore.getState();
  const initialApp = useAppStore.getState();
  const initialLocale = getLocale();
  const profile: UserDto = {
    id: 1,
    name: 'First',
    email: 'first@example.test',
    locale: 'en-US',
  };
  let resolveEdit!: (input: TransactionInput) => void;
  let resolveLocale!: (profile: UserDto) => void;
  let resolveTimeline!: (entries: []) => void;
  const options: ProfileOptionsDto = { categories: [], payments: [] };
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      api: {
        getTransaction: () =>
          new Promise((resolve) => {
            resolveEdit = resolve;
          }),
        getTransactions: () =>
          new Promise((resolve) => {
            resolveTimeline = resolve;
          }),
        updateProfileLocale: () =>
          new Promise((resolve) => {
            resolveLocale = resolve;
          }),
        leaveProfile: async () => {},
        getProfileOptions: async () => options,
      },
    },
  });

  try {
    await useProfileStore.getState().activate(profile);
    useAppStore.setState({
      monthlyStatement: { ...initialApp.monthlyStatement, net: 999 },
    });
    dialogTransactionStore.getState().openDialogTransaction();
    dialogTransactionStore
      .getState()
      .handleTransaction('name', 'Private draft');
    const editing = dialogTransactionStore.getState().loadTransaction(1);
    const updatingLocale = useProfileStore.getState().updateLocale('pt-BR');
    const loadingTimeline = useAppStore.getState().loadTransactions();
    const confirming = confirmation.confirm({ title: 'Private entry' });
    await useProfileStore.getState().leave();
    assert.equal(await confirming, false);
    assert.equal(useConfirmationStore.getState().options, null);
    assert.equal(useConfirmationStore.getState().resolve, null);
    assert.equal(useProfileStore.getState().activeProfile, null);
    assert.deepEqual(useProfileStore.getState().options, options);
    assert.equal(useAppStore.getState().monthlyStatement.net, 0);
    assert.deepEqual(useAppStore.getState().transactions, []);
    assert.equal(dialogTransactionStore.getState().transaction.name, '');
    assert.equal(
      dialogTransactionStore.getState().isDialogTransactionOpen,
      false,
    );
    assert.equal(getLocale(), 'pt-BR');
    await useProfileStore.getState().activate(profile);
    resolveEdit({
      name: 'Private entry',
      user_id: 1,
      payment_id: 1,
      category_id: 1,
      type: 2,
      amount_cents: 100,
      reference_date: '2026-10-08',
      payment_date: null,
    });
    resolveLocale({ ...profile, locale: 'pt-BR' });
    resolveTimeline([]);
    await Promise.all([editing, updatingLocale, loadingTimeline]);
    assert.equal(dialogTransactionStore.getState().transaction.name, '');
    assert.equal(dialogTransactionStore.getState().transactionId, null);
    assert.equal(
      dialogTransactionStore.getState().isDialogTransactionOpen,
      false,
    );
    assert.equal(useProfileStore.getState().activeProfile?.locale, 'en-US');
    assert.equal(getLocale(), 'en-US');
  } finally {
    dialogTransactionStore.getState().resetSession();
    confirmation.respond(false);
    useAppStore.getState().reset();
    useAppStore.setState(initialApp);
    useProfileStore.setState(initialProfile);
    setLocale(initialLocale);

    if (descriptor) {
      Object.defineProperty(globalThis, 'window', descriptor);
    } else {
      Reflect.deleteProperty(globalThis, 'window');
    }
  }
});

test('obsolete activation cannot restore the previous profile or its catalogs', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const initialProfile = useProfileStore.getState();
  const initialApp = useAppStore.getState();
  const initialLocale = getLocale();
  let resolveOptions!: (options: ProfileOptionsDto) => void;
  const profile: UserDto = {
    id: 1,
    name: 'First',
    email: 'first@example.test',
    locale: 'pt-BR',
  };
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      api: {
        getProfileOptions: () =>
          new Promise((resolve) => {
            resolveOptions = resolve;
          }),
      },
    },
  });

  try {
    const activating = useProfileStore.getState().activate(profile);
    window.api.getProfileOptions = async () => ({
      categories: [],
      payments: [],
    });
    await useProfileStore
      .getState()
      .activate({ ...profile, id: 2, locale: 'en-US' });
    resolveOptions({
      categories: [
        {
          id: 1,
          name: 'Private category',
          icon_key: 'food',
          catalog_key: null,
        },
      ],
      payments: [],
    });
    await activating;
    assert.equal(useProfileStore.getState().activeProfile?.id, 2);
    assert.deepEqual(useProfileStore.getState().options.categories, []);
    assert.equal(getLocale(), 'en-US');
  } finally {
    useAppStore.getState().reset();
    useAppStore.setState(initialApp);
    useProfileStore.setState(initialProfile);
    setLocale(initialLocale);

    if (descriptor) {
      Object.defineProperty(globalThis, 'window', descriptor);
    } else {
      Reflect.deleteProperty(globalThis, 'window');
    }
  }
});
