import { useEffect, useRef, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ChartNoAxesCombined, Globe } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@components/ui/tabs';
import { FieldDatePicker, FieldMoney } from '@components/ui/field';
import { Button } from '@components/ui/button';
import { Spinner } from '@components/ui/spinner';
import { getLocale, t } from '@lib/i18n';
import { formatCurrency } from '@lib/format/currency';
import { useProfileStore } from '@store/profile';
import {
  financialActionsBlocked,
  useFinancialOperations,
} from '@store/financial-operations';
import type { IndicatorAnchorDto } from '@shared/contracts/indicator-anchor';
import type { ProfileLocale } from '@shared/contracts/user';
import { changeIndicatorAnchor } from './indicator-anchor-actions';
import AppearanceSettings from './AppearanceSettings';

function GeneralSettings() {
  const profile = useProfileStore((state) => state.activeProfile);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const request = useRef(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const changeLocale = async (locale: ProfileLocale) => {
    if (request.current || locale === profile?.locale) {
      return;
    }

    request.current = true;
    setPending(true);
    setFailed(false);
    try {
      await useProfileStore.getState().updateLocale(locale);
    } catch {
      if (mounted.current) {
        setFailed(true);
      }
    } finally {
      request.current = false;

      if (mounted.current) {
        setPending(false);
      }
    }
  };
  return (
    <section className="space-y-5">
      <h2 className="font-semibold">{t('settings.general')}</h2>
      <AppearanceSettings />
      <fieldset disabled={pending} className="space-y-3">
        <legend className="mb-3 text-sm font-medium">
          {t('profiles.language')}
        </legend>
        {(['pt-BR', 'en-US'] as const).map((locale) => (
          <label
            key={locale}
            className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 text-sm"
          >
            <input
              type="radio"
              name="settings-locale"
              checked={profile?.locale === locale}
              onChange={() => void changeLocale(locale)}
              className="accent-primary"
            />
            {locale === 'pt-BR' ? 'Português (Brasil)' : 'English (US)'}
          </label>
        ))}
      </fieldset>
      {failed && (
        <p role="alert" className="text-xs text-destructive">
          {t('common.error')}
        </p>
      )}
    </section>
  );
}

function IndicatorAnchorSettings({
  onPendingChange,
}: {
  onPendingChange: (pending: boolean) => void;
}) {
  const [anchor, setAnchor] = useState<IndicatorAnchorDto | null>(null);
  const [date, setDate] = useState<Date>();
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<
    'saved' | 'error' | 'refresh_failed' | null
  >(null);
  const blocked = useFinancialOperations((state) => state.pending.size > 0);
  const mounted = useRef(false);
  const session = useProfileStore.getState().sessionVersion;
  const current = () =>
    mounted.current && useProfileStore.getState().sessionVersion === session;

  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    setLoading(true);
    setLoadFailed(false);
    void window.api.indicatorAnchor
      .get()
      .then((value) => {
        if (
          cancelled ||
          useProfileStore.getState().sessionVersion !== session
        ) {
          return;
        }

        setAnchor(value);
        setDate(value ? parseISO(value.start_date) : undefined);
        setBalance((value?.opening_balance_cents ?? 0) / 100);
        setLoading(false);
      })
      .catch(() => {
        if (
          !cancelled &&
          useProfileStore.getState().sessionVersion === session
        ) {
          setLoading(false);
          setLoadFailed(true);
        }
      });
    return () => {
      cancelled = true;
      mounted.current = false;
    };
  }, [retry, session]);

  const update = async (input: IndicatorAnchorDto | null) => {
    if (financialActionsBlocked() || loading || loadFailed || !current()) {
      return;
    }

    setSaving(true);
    onPendingChange(true);
    setMessage(null);
    try {
      const result = await changeIndicatorAnchor(input, current, setAnchor);

      if (current() && result !== 'blocked' && result !== 'stale') {
        setMessage(result);
      }
    } finally {
      if (current()) {
        setSaving(false);
        onPendingChange(false);
      }
    }
  };

  if (loading) {
    return (
      <p role="status" className="flex items-center gap-2">
        <Spinner />
        {t('common.loading')}
      </p>
    );
  }

  if (loadFailed) {
    return (
      <div role="alert" className="space-y-3">
        <p>{t('common.error')}</p>
        <Button
          variant="outline"
          onClick={() => setRetry((value) => value + 1)}
        >
          {t('common.retry')}
        </Button>
      </div>
    );
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();

        if (
          !date ||
          !Number.isFinite(balance) ||
          !Number.isSafeInteger(Math.round(balance * 100))
        ) {
          setMessage('error');
          return;
        }

        void update({
          start_date: format(date, 'yyyy-MM-dd'),
          opening_balance_cents: Math.round(balance * 100),
        });
      }}
    >
      <div className="space-y-2">
        <h2 className="font-semibold">{t('settings.anchor_title')}</h2>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {t('settings.anchor_description')}
        </p>
      </div>
      {anchor && (
        <p className="rounded-lg border border-border bg-background/60 p-3 text-xs text-muted-foreground">
          {t('settings.anchor_current', {
            date: anchor.start_date,
            balance: formatCurrency(anchor.opening_balance_cents / 100),
          })}
        </p>
      )}
      <FieldDatePicker
        label={t('settings.start_date')}
        value={date}
        onValueChange={setDate}
        placeholder={t('settings.select_date')}
        disabled={saving}
      />
      <FieldMoney
        label={t('settings.opening_balance')}
        money={balance}
        onMoneyChange={setBalance}
        decimalSeparator={getLocale() === 'pt-BR' ? ',' : '.'}
        description={t('settings.balance_hint')}
        disabled={saving}
      />
      <p className="text-xs leading-relaxed text-muted-foreground">
        {t('settings.invoice_hint')}
      </p>
      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
        <Button
          type="submit"
          disabled={blocked || !date || !Number.isFinite(balance)}
        >
          {saving && <Spinner />}
          {t('settings.save')}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={blocked || anchor === null}
          onClick={() => void update(null)}
        >
          {t('settings.remove')}
        </Button>
      </div>
      {message && (
        <p
          role={message === 'saved' ? 'status' : 'alert'}
          className={
            message === 'saved'
              ? 'text-xs text-muted-foreground'
              : 'text-xs text-destructive'
          }
        >
          {t(`settings.${message}`)}
        </p>
      )}
    </form>
  );
}

export default function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [pending, setPending] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) {
          onOpenChange(next);
        }
      }}
    >
      <DialogContent
        className="h-[min(36rem,calc(100dvh-3rem))] max-w-3xl grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0"
        showCloseButton={!pending}
      >
        <DialogHeader className="border-b border-border p-5 pr-12">
          <DialogTitle>{t('settings.title')}</DialogTitle>
          <DialogDescription>{t('settings.description')}</DialogDescription>
        </DialogHeader>
        {open && (
          <Tabs
            defaultValue="indicators"
            orientation="vertical"
            className="grid min-h-0 grid-cols-[7.5rem_minmax(0,1fr)] sm:grid-cols-[11rem_minmax(0,1fr)]"
          >
            <TabsList
              className="flex-col justify-start gap-1 border-b-0 border-r border-border bg-background/50 p-2"
              aria-label={t('settings.topics')}
            >
              <TabsTrigger
                value="general"
                className="m-0 h-auto whitespace-normal rounded-md border-0 px-3 py-3 text-left text-xs data-active:bg-secondary data-active:text-secondary-foreground data-active:hover:text-secondary-foreground"
              >
                <Globe aria-hidden="true" />
                {t('settings.general')}
              </TabsTrigger>
              <TabsTrigger
                value="indicators"
                className="m-0 h-auto whitespace-normal rounded-md border-0 px-3 py-3 text-left text-xs data-active:bg-secondary data-active:text-secondary-foreground data-active:hover:text-secondary-foreground"
              >
                <ChartNoAxesCombined aria-hidden="true" />
                {t('settings.indicators')}
              </TabsTrigger>
            </TabsList>
            <div className="min-h-0 min-w-0 overflow-y-auto p-4 sm:p-6">
              <TabsContent value="general" keepMounted>
                <GeneralSettings />
              </TabsContent>
              <TabsContent value="indicators" keepMounted>
                <IndicatorAnchorSettings onPendingChange={setPending} />
              </TabsContent>
            </div>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
