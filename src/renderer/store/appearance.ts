import { create } from 'zustand';
import type {
  AppearanceApi,
  AppearancePreference,
  AppearanceSnapshot,
} from '@shared/contracts/appearance';
import { defaultAppearance } from '@shared/contracts/appearance';
import { applyAppearance, connectAppearance } from '@lib/appearance';

interface AppearanceState {
  snapshot: AppearanceSnapshot;
  pending: boolean;
  failed: boolean;
  update: (preference: AppearancePreference) => Promise<void>;
}

export function createAppearanceStore(
  api: Pick<AppearanceApi, 'update'>,
  initial: AppearanceSnapshot,
  apply: (snapshot: AppearanceSnapshot) => void,
) {
  const store = create<AppearanceState>((set, get) => ({
    snapshot: initial,
    pending: false,
    failed: false,
    update: async (preference) => {
      if (get().pending) {
        return;
      }

      set({ pending: true, failed: false });
      try {
        receive(await api.update(preference));
      } catch {
        set({ failed: true });
      } finally {
        set({ pending: false });
      }
    },
  }));
  function receive(snapshot: AppearanceSnapshot) {
    if (snapshot.revision < store.getState().snapshot.revision) {
      return;
    }

    apply(snapshot);
    store.setState({ snapshot });
  }
  return { store, receive };
}

const api = typeof window !== 'undefined' ? window.appearance : undefined;
const appearance = createAppearanceStore(
  { update: (preference) => window.appearance.update(preference) },
  api?.initial ?? { ...defaultAppearance, resolvedMode: 'light', revision: 0 },
  applyAppearance,
);

export const useAppearance = appearance.store;

export function initializeAppearance(): () => void {
  return connectAppearance(window.appearance, appearance.receive);
}
