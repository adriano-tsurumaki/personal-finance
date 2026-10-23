import { FieldSelect } from '@components/ui/field';
import { t } from '@lib/i18n';
import { useAppearance } from '@store/appearance';
import {
  appearanceThemes,
  type ColorMode,
  type ThemeId,
} from '@shared/contracts/appearance';

export default function AppearanceSettings() {
  const { snapshot, pending, failed, update } = useAppearance();
  return (
    <section className="space-y-3" aria-labelledby="appearance-heading">
      <h3 id="appearance-heading" className="text-sm font-medium">
        {t('appearance.title')}
      </h3>
      <p className="text-xs text-muted-foreground">
        {t('appearance.description')}
      </p>
      <FieldSelect<ThemeId>
        label={t('appearance.theme')}
        value={snapshot.themeId}
        options={appearanceThemes.map((theme) => ({
          value: theme.id,
          label: theme.name,
        }))}
        disabled={pending}
        onValueChange={(themeId) => {
          if (themeId) {
            void update({ themeId, colorMode: snapshot.colorMode });
          }
        }}
      />
      <FieldSelect<ColorMode>
        label={t('appearance.mode')}
        value={snapshot.colorMode}
        options={(['system', 'light', 'dark'] as const).map((value) => ({
          value,
          label: t(`appearance.${value}`),
        }))}
        disabled={pending}
        onValueChange={(colorMode) => {
          if (colorMode) {
            void update({ themeId: snapshot.themeId, colorMode });
          }
        }}
      />
      {pending && (
        <p role="status" className="text-xs text-muted-foreground">
          {t('appearance.saving')}
        </p>
      )}
      {failed && (
        <p role="alert" className="text-xs text-destructive">
          {t('appearance.error')}
        </p>
      )}
    </section>
  );
}
