import { create } from 'zustand';
import type { ProfileLocale, UserDto } from '@shared/contracts/user';
import type { ProfileOptionsDto } from '@shared/contracts/profile-catalog';
import { setLocale } from '@lib/i18n';
import { useAppStore } from './transaction';
import { dialogTransactionStore } from './dialog-transaction';
import { confirmation } from './confirmation';
import { toast } from '@components/ui/toast';

interface ProfileState {
  activeProfile: UserDto | null;
  options: ProfileOptionsDto;
  sessionVersion: number;
  activate: (profile: UserDto) => Promise<void>;
  leave: () => Promise<void>;
  updateLocale: (locale: ProfileLocale) => Promise<void>;
}

function resetProfileData() {
  useAppStore.getState().reset();
  dialogTransactionStore.getState().resetSession();
  confirmation.respond(false);
  toast.close();
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  activeProfile: null,
  options: { categories: [], payments: [] },
  sessionVersion: 0,
  activate: async (profile) => {
    const sessionVersion = get().sessionVersion + 1;
    resetProfileData();
    set({
      activeProfile: null,
      options: { categories: [], payments: [] },
      sessionVersion,
    });
    let options: ProfileOptionsDto;

    try {
      options = await window.api.getProfileOptions();
    } catch (error) {
      if (get().sessionVersion !== sessionVersion) {
        return;
      }

      throw error;
    }

    if (get().sessionVersion !== sessionVersion) {
      return;
    }

    setLocale(profile.locale);
    set({ activeProfile: profile, options });
  },
  leave: async () => {
    const sessionVersion = get().sessionVersion + 1;
    set({ sessionVersion });
    resetProfileData();
    try {
      await window.api.leaveProfile();
    } catch (error) {
      if (get().sessionVersion === sessionVersion && get().activeProfile) {
        void useAppStore.getState().init();
      }

      throw error;
    }

    if (get().sessionVersion !== sessionVersion) {
      return;
    }

    resetProfileData();
    set({ activeProfile: null, options: { categories: [], payments: [] } });
    setLocale('pt-BR');
  },
  updateLocale: async (locale) => {
    const current = get().activeProfile;
    const sessionVersion = get().sessionVersion;

    if (!current) {
      throw new Error('No active profile.');
    }

    const updated = await window.api.updateProfileLocale(locale);

    if (
      get().sessionVersion !== sessionVersion ||
      get().activeProfile?.id !== current.id ||
      updated.id !== current.id
    ) {
      return;
    }

    set({ activeProfile: updated });
    setLocale(updated.locale);
  },
}));
