import { create } from 'zustand';

interface TimelinePreferences {
  newestFirst: boolean;
  toggleDateOrder: () => void;
}

type PreferenceStorage = Pick<Storage, 'getItem' | 'setItem'>;
const storageKey = 'personal-finance.timeline-date-order';

function browserStorage(): PreferenceStorage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export function createTimelinePreferences(
  storage: PreferenceStorage | undefined = browserStorage(),
) {
  let newestFirst = false;

  try {
    newestFirst = storage?.getItem(storageKey) === 'newest';
  } catch {
    // Keep the default order when browser storage is unavailable.
  }

  return create<TimelinePreferences>((set, get) => ({
    newestFirst,
    toggleDateOrder: () => {
      const next = !get().newestFirst;

      try {
        storage?.setItem(storageKey, next ? 'newest' : 'oldest');
      } catch {
        // Ordering remains usable for this session if persistence fails.
      }

      set({ newestFirst: next });
    },
  }));
}

export const useTimelinePreferences = createTimelinePreferences();
