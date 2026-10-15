import type { RecurrenceRuleDto } from '@shared/contracts/recurrence';

/** Local calendar dates intentionally avoid UTC conversion at the renderer boundary. */
export function localToday(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
export function forecastEnd(start: string): string {
  const end = new Date(`${start}T12:00:00`);
  end.setDate(end.getDate() + 45);
  return localToday(end);
}
/** Approximate cents per month for active defaults only; never used for dated cash flow. */
export function monthlyEquivalent(rule: RecurrenceRuleDto): number {
  const version = rule.versions.at(-1);

  if (rule.status !== 'active' || !version) {
    return 0;
  }

  const multiplier =
    version.frequency === 1
      ? 365.2425 / 12
      : version.frequency === 2
        ? 52.1775 / 12
        : version.frequency === 4
          ? 1 / 12
          : 1;
  return (version.amount_cents * multiplier) / version.interval;
}
