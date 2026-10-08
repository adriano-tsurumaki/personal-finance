import { create } from 'zustand';
import type { ProfileLocale, UserDto } from '@shared/contracts/user';
import type { ProfileOptionsDto } from '@shared/contracts/profile-catalog';
import { setLocale } from '@lib/i18n';

interface ProfileState {
  activeProfile: UserDto | null;
  options: ProfileOptionsDto;
  activate: (profile: UserDto) => Promise<void>;
  leave: () => Promise<void>;
  updateLocale: (locale: ProfileLocale) => Promise<void>;
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  activeProfile: null,
  options: { categories: [], payments: [] },
  activate: async (profile) => {
    const options = await window.api.getProfileOptions();
    setLocale(profile.locale);
    set({ activeProfile: profile, options });
  },
  leave: async () => {
    await window.api.leaveProfile();
    set({ activeProfile: null, options: { categories: [], payments: [] } });
    setLocale('pt-BR');
  },
  updateLocale: async (locale) => {
    const current = get().activeProfile;

    if (!current) {
      throw new Error('No active profile.');
    }

    const updated = await window.api.updateProfileLocale(locale);

    if (get().activeProfile?.id !== current.id || updated.id !== current.id) {
      return;
    }

    set({ activeProfile: updated });
    setLocale(updated.locale);
  },
}));
