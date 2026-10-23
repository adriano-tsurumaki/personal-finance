import type {
  AppearanceApi,
  AppearanceSnapshot,
} from '@shared/contracts/appearance';

/** Update the root so portals and non-React window controls inherit the same theme. */
export function applyAppearance(
  snapshot: AppearanceSnapshot,
  root: HTMLElement = document.documentElement,
): void {
  root.dataset.theme = snapshot.themeId;
  root.classList.toggle('dark', snapshot.resolvedMode === 'dark');
  root.classList.toggle('light', snapshot.resolvedMode === 'light');
  root.style.colorScheme = snapshot.resolvedMode;
}

/** Subscribe before rendering and reject responses older than a published event. */
export function connectAppearance(
  api: AppearanceApi,
  receive: (snapshot: AppearanceSnapshot) => void,
): () => void {
  let revision = -1;
  const publish = (snapshot: AppearanceSnapshot) => {
    if (snapshot.revision < revision) {
      return;
    }

    revision = snapshot.revision;
    receive(snapshot);
  };
  const unsubscribe = api.onChange(publish);
  publish(api.initial);
  return unsubscribe;
}
