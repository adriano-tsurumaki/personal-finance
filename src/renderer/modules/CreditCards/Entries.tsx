import type { RefObject } from 'react';
import { Pencil, Link2, Trash2 } from 'lucide-react';
import { Button } from '@components/ui/button';
import { Checkbox } from '@components/ui/checkbox';
import { t } from '@lib/i18n';
import { formatCurrency } from '@lib/format/currency';
import { cardDate } from '@lib/card-corrections';
import { financialActionsBlocked } from '@store/financial-operations';
import type { InvoiceEntryDto } from '@shared/contracts/credit-cards';
import MenuOptionsTransaction from '@modules/TimelineTransaction/MenuOptionsTransaction';
import {
  Table,
  Header,
  HeaderRow,
  Body,
  Row,
  HeaderCell,
  Cell,
} from '@table-library/react-table-library/table';
import {
  useRowSelect,
  SelectClickTypes,
  SelectTypes,
} from '@table-library/react-table-library/select';
import { useTheme } from '@table-library/react-table-library/theme';

interface EntriesProps {
  rows: InvoiceEntryDto[];
  returnFocus: RefObject<HTMLElement | null>;
  setAssociation: (entry: InvoiceEntryDto) => void;
}

export default function Entries(props: EntriesProps) {
  return (
    <EntriesTable
      key={props.rows.map((entry) => entry.id).join(',')}
      {...props}
    />
  );
}

function EntriesTable({ rows, returnFocus, setAssociation }: EntriesProps) {
  const data = { nodes: rows };
  const select = useRowSelect(
    data,
    {},
    {
      clickType: SelectClickTypes.RowClick,
      rowSelect: SelectTypes.MultiSelect,
      buttonSelect: SelectTypes.MultiSelect,
    },
  );
  const theme = useTheme({
    Table: `
      --data-table-library_grid-template-columns: 120px minmax(200px, 1fr) 140px 112px;
      min-width: 572px;
      width: 100%;
      color: var(--foreground);
      background: transparent;
      font-size: 0.875rem;
    `,
    BaseCell: `
      padding: 18px 12px;
      border: 0;
      border-bottom: 1px solid var(--border);
      background: transparent;
      &:first-of-type { padding-left: 0; }
      &:last-of-type { padding-right: 0; }
      &.entry-align-right {
        justify-content: flex-end;
        text-align: right;
      }
      &.entry-align-right > div {
        text-align: right;
      }
    `,
    HeaderCell: `
      padding-top: 12px;
      padding-bottom: 12px;
      color: var(--muted-foreground);
      font-size: 0.75rem;
      font-weight: 400;
    `,
    Row: `
      background: transparent;
      &:hover > .td {
        background-color: color-mix(in srgb, var(--muted) 40%, var(--card));
      }
      &.row-select-selected, &.row-select-single-selected {
        font-weight: 400;
      }
      &.row-select-selected > .td, &.row-select-single-selected > .td {
        background-color: color-mix(in srgb, var(--primary) 18%, var(--card));
      }
    `,
  });

  return (
    <div className="min-w-0">
      <p className="py-2 text-xs text-muted-foreground" role="status">
        {t('cards.selected_entries', { count: select.state.ids.length })}
      </p>
      <div className="overflow-x-auto">
        <Table
          data={data}
          select={select}
          theme={theme}
          layout={{ custom: true }}
          aria-label={t('monthly_views.entries')}
        >
          {(tableList: InvoiceEntryDto[]) => (
            <>
              <Header>
                <HeaderRow>
                  <HeaderCell>{t('transactions.date')}</HeaderCell>
                  <HeaderCell>{t('transactions.name')}</HeaderCell>
                  <HeaderCell className="entry-align-right">
                    {t('transactions.amount')}
                  </HeaderCell>
                  <HeaderCell className="entry-align-right">
                    {t('cards.entry_actions')}
                  </HeaderCell>
                </HeaderRow>
              </Header>
              <Body>
                {tableList.map((entry) => (
                  <MenuOptionsTransaction
                    key={entry.id}
                    transactionId={entry.id}
                    installment={!!entry.installment_id}
                    renderTrigger={
                      <Row
                        item={entry}
                        aria-selected={select.state.ids.includes(entry.id)}
                      >
                        {null}
                      </Row>
                    }
                    triggerClassName="group/transaction"
                  >
                    {(actions) => (
                      <>
                        <Cell>
                          <div className="flex items-center gap-2">
                            <Checkbox
                              aria-label={t('cards.select_entry', {
                                name: entry.name,
                              })}
                              checked={select.state.ids.includes(entry.id)}
                              onClick={(event) => event.stopPropagation()}
                              onCheckedChange={() =>
                                select.fns.onToggleById(entry.id)
                              }
                            />
                            <span className="font-mono text-xs text-muted-foreground">
                              {cardDate(entry.reference_date)}
                            </span>
                          </div>
                        </Cell>
                        <Cell>
                          <div
                            className="truncate font-medium"
                            title={entry.name}
                          >
                            {entry.name}
                          </div>
                          {entry.note && (
                            <div
                              className="mt-1 truncate text-xs text-muted-foreground"
                              title={entry.note}
                            >
                              {entry.note}
                            </div>
                          )}
                          {!!entry.installment_number && (
                            <div className="mt-1 text-xs text-muted-foreground">
                              {entry.installment_number}/
                              {entry.total_installments ?? '?'}
                            </div>
                          )}
                          {entry.outside_period && (
                            <div className="mt-1 text-xs text-muted-foreground">
                              {t('cards.outside_period')}
                            </div>
                          )}
                        </Cell>
                        <Cell className="entry-align-right">
                          <span className="font-mono tabular-nums">
                            {formatCurrency(entry.amount_cents / 100)}
                          </span>
                        </Cell>
                        <Cell className="entry-align-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              aria-label={t('cards.associate_label', {
                                name: entry.name,
                              })}
                              title={t('cards.associate')}
                              onClick={(event) => {
                                if (
                                  actions.disabled ||
                                  entry.installment_id ||
                                  financialActionsBlocked()
                                ) {
                                  return;
                                }

                                returnFocus.current = event.currentTarget;
                                setAssociation(entry);
                              }}
                              disabled={
                                actions.disabled || !!entry.installment_id
                              }
                            >
                              <Link2 aria-hidden="true" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              aria-label={t('transactions.edit_label', {
                                name: entry.name,
                              })}
                              title={t('common.edit')}
                              onClick={actions.onEdit}
                              disabled={
                                actions.disabled || !!entry.installment_id
                              }
                            >
                              <Pencil aria-hidden="true" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              className="text-muted-foreground hover:text-expense"
                              aria-label={t('transactions.remove_label', {
                                name: entry.name,
                              })}
                              title={t('common.remove')}
                              onClick={actions.onRemove}
                              disabled={
                                actions.disabled || !!entry.installment_id
                              }
                            >
                              <Trash2 aria-hidden="true" />
                            </Button>
                          </div>
                        </Cell>
                      </>
                    )}
                  </MenuOptionsTransaction>
                ))}
              </Body>
            </>
          )}
        </Table>
      </div>
    </div>
  );
}
