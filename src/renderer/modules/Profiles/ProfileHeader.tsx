import { useRef, useState } from 'react';
import {
  Check,
  ChevronRight,
  Globe,
  LogOut,
  UserRound,
  Wallet,
} from 'lucide-react';
import type { ProfileLocale } from '@shared/contracts/user';
import { Menu } from '@base-ui/react/menu';
import { Button } from '@components/ui/button';
import { useProfileStore } from '@store/profile';
import { t } from '@lib/i18n';

export default function ProfileHeader() {
  const profile = useProfileStore((state) => state.activeProfile);
  const leave = useProfileStore((state) => state.leave);
  const updateLocale = useProfileStore((state) => state.updateLocale);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const operationPending = useRef(false);

  const handleLocaleChange = async (locale: ProfileLocale) => {
    if (operationPending.current || locale === profile?.locale) {
      return;
    }

    operationPending.current = true;
    setPending(true);
    setError(false);

    try {
      await updateLocale(locale);
    } catch (cause) {
      console.error('Failed to update profile locale:', cause);
      setError(true);
    } finally {
      operationPending.current = false;
      setPending(false);
    }
  };

  const handleLeave = async () => {
    if (operationPending.current) {
      return;
    }

    operationPending.current = true;
    setPending(true);
    setError(false);

    try {
      await leave();
    } catch (cause) {
      console.error('Failed to leave profile:', cause);
      operationPending.current = false;
      setPending(false);
      setError(true);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium text-primary">
          <Wallet className="size-4" aria-hidden="true" />
          Ledger
        </div>
        <Menu.Root>
          <Menu.Trigger
            render={
              <Button
                type="button"
                variant="outline"
                size="icon-lg"
                className="rounded-full"
                aria-label={t('profiles.menu', { name: profile?.name ?? '' })}
              >
                <UserRound aria-hidden="true" />
              </Button>
            }
          />
          <Menu.Portal>
            <Menu.Positioner
              side="bottom"
              align="end"
              sideOffset={8}
              className="z-50"
            >
              <Menu.Popup className="w-60 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-popover p-2 text-sm text-popover-foreground outline-none">
                <div className="border-b border-border px-2 pb-3 pt-1">
                  <p className="break-words font-medium">{profile?.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {profile?.locale} · BRL
                  </p>
                </div>
                <Menu.SubmenuRoot>
                  <Menu.SubmenuTrigger
                    disabled={pending}
                    className="mt-2 flex w-full cursor-default items-center gap-2 rounded-md px-2 py-2 outline-none data-highlighted:bg-muted data-highlighted:text-foreground data-disabled:pointer-events-none data-disabled:opacity-50"
                  >
                    <Globe className="size-4" aria-hidden="true" />
                    {t('profiles.changeLanguage')}
                    <ChevronRight
                      className="ml-auto size-4"
                      aria-hidden="true"
                    />
                  </Menu.SubmenuTrigger>
                  <Menu.Portal>
                    <Menu.Positioner
                      side="right"
                      align="start"
                      sideOffset={4}
                      className="z-50"
                    >
                      <Menu.Popup className="min-w-48 rounded-lg border border-border bg-popover p-2 text-sm text-popover-foreground outline-none">
                        <Menu.RadioGroup
                          value={profile?.locale}
                          onValueChange={(value) => {
                            void handleLocaleChange(value as ProfileLocale);
                          }}
                        >
                          {(['pt-BR', 'en-US'] as const).map((locale) => (
                            <Menu.RadioItem
                              key={locale}
                              value={locale}
                              disabled={pending}
                              closeOnClick={false}
                              className="flex cursor-default items-center gap-2 rounded-md px-2 py-2 outline-none data-highlighted:bg-muted data-highlighted:text-foreground data-disabled:pointer-events-none data-disabled:opacity-50"
                            >
                              <span className="flex size-4 items-center">
                                <Menu.RadioItemIndicator>
                                  <Check
                                    className="size-4"
                                    aria-hidden="true"
                                  />
                                </Menu.RadioItemIndicator>
                              </span>
                              {locale === 'pt-BR'
                                ? 'Português (Brasil)'
                                : 'English (US)'}
                            </Menu.RadioItem>
                          ))}
                        </Menu.RadioGroup>
                      </Menu.Popup>
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.SubmenuRoot>
                <Menu.Item
                  disabled={pending}
                  closeOnClick={false}
                  onClick={handleLeave}
                  className="mt-2 flex cursor-default items-center gap-2 rounded-md px-2 py-2 outline-none data-highlighted:bg-muted data-highlighted:text-foreground data-disabled:pointer-events-none data-disabled:opacity-50"
                >
                  <LogOut className="size-4" aria-hidden="true" />
                  {t('profiles.signOut')}
                </Menu.Item>
                {error && (
                  <p
                    role="alert"
                    className="px-2 py-2 text-xs text-destructive"
                  >
                    {t('common.error')}
                  </p>
                )}
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </div>
    </div>
  );
}
