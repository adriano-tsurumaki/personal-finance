import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ToastProvider } from '@components/ui/toast';
import { renderToStaticMarkup } from 'react-dom/server';
import { setLocale } from '@lib/i18n';
import { useAppStore } from '@store/transaction';
import { useFinancialOperations } from '@store/financial-operations';
import MonthlyFinance from './index';
import FinanceSections from '../FinanceSections';

test('summary markup distinguishes unavailable amounts, pending navigation, failure and recovery', () => {
  const appSnapshot = useAppStore.getInitialState();
  const originalAppSnapshot = { ...appSnapshot };
  const operationsSnapshot = useFinancialOperations.getInitialState();
  const originalOperationsSnapshot = { ...operationsSnapshot };
  const base = useAppStore.getState();
  let current = { ...base, monthKey: '2026-10' };
  let blocked = false;
  // Zustand server rendering reads its initial snapshot rather than live subscriptions.
  function render(element = <MonthlyFinance />) {
    Object.assign(appSnapshot, current);
    operationsSnapshot.pending = blocked
      ? new Map([[Symbol('period'), 'period' as const]])
      : new Map();
    return renderToStaticMarkup(<ToastProvider>{element}</ToastProvider>);
  }
  setLocale('en-US');

  try {
    current = { ...current, statementLoading: true, pendingMonth: '2026-11' };
    blocked = true;
    let markup = render();
    assert.match(markup, /October 2026/);
    assert.doesNotMatch(markup, /Loading 2026-11/);
    assert.equal((markup.match(/—/g) ?? []).length, 5);
    assert.equal((markup.match(/disabled=""/g) ?? []).length, 2);
    const sections = render(<FinanceSections />);
    assert.match(sections, /<fieldset[^>]*disabled=""[^>]*inert=""/);
    current = {
      ...current,
      statementLoading: false,
      pendingMonth: null,
      failedMonth: '2026-11',
      statementFailed: true,
    };
    blocked = false;
    markup = render();
    assert.doesNotMatch(markup, /role="alert"/);
    assert.doesNotMatch(markup, /Could not load 2026-11/);
    assert.doesNotMatch(markup, /Try again/);
    assert.equal((markup.match(/—/g) ?? []).length, 5);
    assert.doesNotMatch(markup, /disabled=""/);
    current = {
      ...current,
      statementLoaded: true,
      statementFailed: false,
      monthlyStatement: {
        ...base.monthlyStatement,
        year: 2026,
        month: 10,
        openingBalance: 1000,
        closingBalance: 1700,
        income: 3000,
        expense: 2300,
        net: 700,
      },
    };
    markup = render();
    assert.match(markup, /October 2026/);
    assert.match(markup, /Opening balance/);
    assert.doesNotMatch(markup, /role="alert"/);
    assert.doesNotMatch(markup, /—/);
    current = { ...current, monthKey: '2026-11', failedMonth: null };
    markup = render();
    assert.match(markup, /November 2026/);
    assert.doesNotMatch(markup, /role="alert"/);
    assert.doesNotMatch(markup, /—/);
  } finally {
    Object.assign(appSnapshot, originalAppSnapshot);
    Object.assign(operationsSnapshot, originalOperationsSnapshot);
    setLocale('pt-BR');
  }
});
