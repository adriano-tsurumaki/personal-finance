/** Keep invoice choices only while the current payment uses credit. */
export function invoiceSelection(
  credit: boolean,
  invoiceMonth: string | null,
  invoiceId: number | null,
) {
  return {
    invoice_month: credit ? invoiceMonth : null,
    credit_card_invoice_id: credit ? invoiceId : null,
  };
}

/** Preserve the first invoice when handing a confirmation draft to a plan. */
export function installmentInvoiceSelection(
  invoiceMonth: string | null,
  invoiceId: number | null,
) {
  return {
    first_invoice_month: invoiceMonth,
    invoice_ids: invoiceId === null ? [] : [invoiceId],
  };
}
