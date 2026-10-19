import type { IndicatorAnchorDto } from '@shared/contracts/indicator-anchor';
import {
  financialActionsBlocked,
  useFinancialOperations,
} from '@store/financial-operations';
import { useAppStore } from '@store/transaction';

export type AnchorMutationOutcome =
  'blocked' | 'stale' | 'saved' | 'error' | 'refresh_failed';

/** Keeps the mutation lock until the new reporting period has been published. */
export async function changeIndicatorAnchor(
  input: IndicatorAnchorDto | null,
  current: () => boolean,
  onSaved: (anchor: IndicatorAnchorDto | null) => void,
): Promise<AnchorMutationOutcome> {
  if (financialActionsBlocked() || !current()) {
    return 'blocked';
  }

  const release = useFinancialOperations.getState().begin('mutation');
  let saved = false;
  try {
    let anchor: IndicatorAnchorDto | null = null;

    if (input) {
      anchor = await window.api.indicatorAnchor.save(input);
    } else {
      await window.api.indicatorAnchor.remove();
    }

    if (!current()) {
      return 'stale';
    }

    saved = true;
    onSaved(anchor);
    useAppStore.setState({
      indicatorAnchor: anchor,
      statementLoaded: false,
      statementIssue: null,
    });
    await useAppStore.getState().refreshMonth();

    if (!current()) {
      return 'stale';
    }

    const state = useAppStore.getState();
    return state.failedMonth !== null || state.statementFailed
      ? 'refresh_failed'
      : 'saved';
  } catch {
    return current() ? (saved ? 'refresh_failed' : 'error') : 'stale';
  } finally {
    release();
  }
}
