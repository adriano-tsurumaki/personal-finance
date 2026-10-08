import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Globe,
  Plus,
  UserRound,
  Wallet,
} from 'lucide-react';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { Field, FieldLabel } from '@components/ui/field';
import { Spinner } from '@components/ui/spinner';
import { useProfileStore } from '@store/profile';
import { getLocale, setLocale, t, useLocale } from '@lib/i18n';
import { formatCurrency } from '@lib/format/currency';
import type { ProfileLocale, UserDto } from '@shared/contracts/user';

export default function Profiles() {
  const [profiles, setProfiles] = useState<UserDto[]>([]);
  const [screen, setScreen] = useState<'create' | 'enter'>('enter');
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);
  const title = useRef<HTMLHeadingElement>(null);
  const locale = useLocale();
  const activate = useProfileStore((state) => state.activate);

  const load = async () => {
    setLoading(true);
    setFailed(false);

    try {
      const current = await window.api.getActiveProfile();

      if (current) {
        await activate(current);
        return;
      }

      const entries = await window.api.listProfiles();
      setProfiles(entries);
      setSelectedId(entries[0]?.id ?? null);
      setScreen(entries.length ? 'enter' : 'create');
    } catch (cause) {
      console.error('Failed to list profiles:', cause);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    title.current?.focus();
  }, [screen, loading]);

  const changeScreen = (next: 'create' | 'enter') => {
    setScreen(next);
    setError('');
    setLocale('pt-BR');
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (submitting.current) {
      return;
    }

    submitting.current = true;
    setPending(true);
    setError('');

    try {
      if (screen === 'create') {
        const result = await window.api.createProfile({
          name,
          email,
          locale: getLocale(),
        });

        if (!result.ok) {
          setError(t(`profiles.${result.error}`));
          return;
        }

        await activate(result.profile);
      } else if (selectedId !== null) {
        const profile = await window.api.enterProfile(selectedId);
        await activate(profile);
      }
    } catch (cause) {
      console.error('Failed to open profile:', cause);
      setError(t('common.error'));
    } finally {
      submitting.current = false;
      setPending(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-5 py-8 sm:px-8">
      <div className="flex items-center gap-2 text-sm font-medium text-primary">
        <Wallet className="size-4" aria-hidden="true" />
        Ledger
      </div>
      <div className="mx-auto my-auto w-full max-w-[28rem] py-6">
        {loading ? (
          <p
            role="status"
            className="flex items-center justify-center gap-2 text-sm text-muted-foreground"
          >
            <Spinner />
            {t('common.loading')}
          </p>
        ) : failed ? (
          <div className="rounded-xl border border-border bg-card p-5 text-center">
            <p role="alert" className="mb-4 text-sm text-destructive">
              {t('common.error')}
            </p>
            <Button onClick={load}>{t('common.retry')}</Button>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <span className="mb-4 flex size-9 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
                <UserRound className="size-4" aria-hidden="true" />
              </span>
              <h1
                ref={title}
                tabIndex={-1}
                className="text-lg font-semibold outline-none"
              >
                {t(
                  screen === 'create'
                    ? 'profiles.createTitle'
                    : 'profiles.signInTitle',
                )}
              </h1>
              <p className="mt-2 text-sm text-pretty text-muted-foreground">
                {t(
                  screen === 'create'
                    ? 'profiles.createDescription'
                    : 'profiles.signInDescription',
                )}
              </p>
            </div>
            <form
              onSubmit={submit}
              className="rounded-xl border border-border bg-card p-5"
            >
              <fieldset
                disabled={pending}
                className="flex min-w-0 flex-col gap-4"
              >
                {screen === 'create' ? (
                  <>
                    <Field>
                      <FieldLabel htmlFor="profile-name">
                        {t('profiles.name')}
                      </FieldLabel>
                      <Input
                        id="profile-name"
                        autoComplete="name"
                        required
                        maxLength={100}
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder={t('profiles.namePlaceholder')}
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="profile-email">
                        {t('profiles.email')}
                      </FieldLabel>
                      <Input
                        id="profile-email"
                        type="email"
                        autoComplete="email"
                        required
                        maxLength={254}
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder={t('profiles.emailPlaceholder')}
                      />
                    </Field>
                    <fieldset aria-describedby="language-hint">
                      <legend className="mb-2 text-xs font-medium text-muted-foreground">
                        {t('profiles.language')}
                      </legend>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {(['pt-BR', 'en-US'] as ProfileLocale[]).map(
                          (value) => (
                            <label
                              key={value}
                              className={`flex cursor-pointer items-center gap-2 rounded-md border p-3 text-sm focus-within:ring-2 focus-within:ring-ring ${locale === value ? 'border-primary/30 bg-primary/5' : 'border-border'}`}
                            >
                              <input
                                type="radio"
                                name="profile-locale"
                                value={value}
                                checked={locale === value}
                                onChange={() => {
                                  setLocale(value);
                                  setError('');
                                }}
                                className="accent-primary"
                              />
                              {value === 'pt-BR'
                                ? 'Português (Brasil)'
                                : 'English (US)'}
                            </label>
                          ),
                        )}
                      </div>
                      <p
                        id="language-hint"
                        className="mt-2 text-xs text-pretty text-muted-foreground"
                      >
                        {t('profiles.languageHint')}
                      </p>
                    </fieldset>
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background/60 p-3">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">
                          {t('profiles.preview')}
                        </p>
                        <p className="mt-1 font-mono text-lg font-semibold tabular-nums">
                          {formatCurrency(1234.56)}
                        </p>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        <p>BRL</p>
                        <p className="mt-1">{t('profiles.currencyHint')}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 text-xs text-muted-foreground">
                      <Check
                        className="mt-0.5 size-4 shrink-0 text-primary"
                        aria-hidden="true"
                      />
                      <div>
                        <p className="font-medium text-foreground">
                          {t('profiles.defaults')}
                        </p>
                        <p className="mt-1 text-pretty">
                          {t('profiles.defaultsHint')}
                        </p>
                      </div>
                    </div>
                  </>
                ) : profiles.length ? (
                  <fieldset className="flex min-w-0 flex-col gap-2">
                    <legend className="mb-2 text-xs font-medium text-muted-foreground">
                      {t('profiles.local')}
                    </legend>
                    {profiles.map((profile) => (
                      <label
                        key={profile.id}
                        className={`flex cursor-pointer items-center gap-3 rounded-lg border p-4 focus-within:ring-2 focus-within:ring-ring ${selectedId === profile.id ? 'border-primary/30 bg-primary/5' : 'border-border'}`}
                      >
                        <input
                          type="radio"
                          name="active-profile"
                          checked={selectedId === profile.id}
                          onChange={() => setSelectedId(profile.id)}
                          className="accent-primary"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="break-words text-sm font-medium">
                            {profile.name}
                          </p>
                          <p className="mt-1 break-all text-xs text-muted-foreground">
                            {profile.email}
                          </p>
                          <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                            <Globe className="size-3" aria-hidden="true" />
                            {profile.locale === 'en-US'
                              ? 'English (US)'
                              : 'Português (Brasil)'}{' '}
                            · BRL
                          </p>
                        </div>
                      </label>
                    ))}
                  </fieldset>
                ) : (
                  <div className="rounded-lg border border-dashed border-border p-6 text-center">
                    <p className="text-sm font-medium">
                      {t('profiles.noProfiles')}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {t('profiles.noProfilesHint')}
                    </p>
                  </div>
                )}
                {error && (
                  <p role="alert" className="text-xs text-destructive">
                    {error}
                  </p>
                )}
                {(screen === 'create' || profiles.length > 0) && (
                  <Button
                    type="submit"
                    size="lg"
                    className="w-full"
                    disabled={
                      pending || (screen === 'enter' && selectedId === null)
                    }
                  >
                    {pending ? <Spinner /> : <ArrowRight aria-hidden="true" />}
                    {t(
                      pending
                        ? screen === 'create'
                          ? 'profiles.creating'
                          : 'profiles.entering'
                        : screen === 'create'
                          ? 'profiles.create'
                          : 'profiles.continue',
                    )}
                  </Button>
                )}
              </fieldset>
            </form>
            <div className="mt-4 text-center">
              {screen === 'create' ? (
                <>
                  <p className="text-xs text-muted-foreground">
                    {t('profiles.existing')}
                  </p>
                  <Button
                    variant="link"
                    onClick={() => changeScreen('enter')}
                    disabled={pending}
                  >
                    <ArrowLeft aria-hidden="true" />
                    {t('profiles.signIn')}
                  </Button>
                </>
              ) : (
                <Button
                  variant="link"
                  onClick={() => changeScreen('create')}
                  disabled={pending}
                >
                  <Plus aria-hidden="true" />
                  {t(profiles.length ? 'profiles.new' : 'profiles.first')}
                </Button>
              )}
            </div>
          </>
        )}
      </div>
      <p className="text-center text-xs text-muted-foreground">
        {t('profiles.localHint')}
      </p>
    </div>
  );
}
