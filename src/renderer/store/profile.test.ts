import assert from 'node:assert/strict';
import { test } from 'node:test';
import { useProfileStore } from './profile';
import { getLocale, setLocale } from '@lib/i18n';
import type { UserDto } from '@shared/contracts/user';

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
