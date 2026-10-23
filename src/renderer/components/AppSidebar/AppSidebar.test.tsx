import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { setLocale } from '@lib/i18n';
import { useFinancialOperations } from '@store/financial-operations';
import { TooltipProvider } from '@components/ui/tooltip';
import { ToastProvider } from '@components/ui/toast';
import FinanceSections from '@modules/FinanceSections';
import Categories from '@modules/Categories';
import AppSidebar, { type AppDestination } from './index';

test('sidebar exposes Categories and Timeline with current-page and financial-operation states', () => {
  const snapshot = useFinancialOperations.getInitialState();
  const original = { ...snapshot };
  setLocale('en-US');

  function render(destination: AppDestination) {
    return renderToStaticMarkup(
      <TooltipProvider>
        <AppSidebar destination={destination} onNavigate={() => {}} />
      </TooltipProvider>,
    );
  }

  try {
    snapshot.pending = new Map();
    let markup = render('categories');
    assert.match(
      markup,
      /<button[^>]*aria-current="page"[^>]*aria-label="Categories"/,
    );
    assert.match(
      markup,
      /<button[^>]*aria-disabled="false"[^>]*aria-label="Categories"/,
    );
    assert.match(
      markup,
      /<button[^>]*aria-disabled="false"[^>]*aria-label="Timeline"/,
    );
    assert.match(
      markup,
      /<button[^>]*aria-disabled="true"[^>]*aria-label="Dashboard"/,
    );
    markup = render('timeline');
    assert.match(
      markup,
      /<button[^>]*aria-current="page"[^>]*aria-label="Timeline"/,
    );

    for (const operation of [
      'period',
      'mutation',
      'transaction-details',
    ] as const) {
      snapshot.pending = new Map([[Symbol(operation), operation]]);
      markup = render('categories');
      assert.match(
        markup,
        /<button[^>]*aria-disabled="true"[^>]*aria-label="Categories"/,
      );
      assert.match(
        markup,
        /<button[^>]*aria-disabled="true"[^>]*aria-label="Timeline"/,
      );
      assert.match(markup, /<button[^>]*aria-label="Expand sidebar"[^>]*>/);
      const categories = renderToStaticMarkup(<Categories />);
      assert.match(categories, /<button[^>]*disabled=""[^>]*>/);
    }

    snapshot.pending = new Map();
    const sections = renderToStaticMarkup(
      <ToastProvider>
        <FinanceSections />
      </ToastProvider>,
    );
    assert.doesNotMatch(sections, /Categories|categories-title/);
    const categories = renderToStaticMarkup(<Categories />);
    assert.match(categories, /<h1[^>]*id="categories-title"/);
    assert.doesNotMatch(
      categories,
      /Opening balance|Previous month|role="tablist"/,
    );
  } finally {
    Object.assign(snapshot, original);
    setLocale('pt-BR');
  }
});
