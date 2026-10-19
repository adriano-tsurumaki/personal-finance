/** Redistributes a local draft in integer cents; main validates its final persisted allocation. */
export function redistributeInstallmentAmounts(
  total: number,
  amounts: number[],
  locked: boolean[],
  editedIndex: number,
  editedAmount: number,
): number[] {
  if (
    !Number.isSafeInteger(total) ||
    total <= 0 ||
    amounts.length < 2 ||
    amounts.length > 120 ||
    locked.length !== amounts.length ||
    !Number.isInteger(editedIndex) ||
    editedIndex < 0 ||
    editedIndex >= amounts.length ||
    !Number.isSafeInteger(editedAmount) ||
    editedAmount <= 0
  ) {
    throw new Error('invalid_installment_allocation');
  }

  const next = [...amounts];
  next[editedIndex] = editedAmount;
  const free = next.flatMap((_, index) =>
    index !== editedIndex && !locked[index] ? [index] : [],
  );
  const fixed = next.reduce(
    (sum, amount, index) =>
      index === editedIndex || locked[index]
        ? sum + BigInt(Number.isSafeInteger(amount) && amount > 0 ? amount : 0)
        : sum,
    0n,
  );

  if (
    next.some(
      (amount, index) =>
        (index === editedIndex || locked[index]) &&
        (!Number.isSafeInteger(amount) || amount <= 0),
    ) ||
    fixed > BigInt(total)
  ) {
    throw new Error('invalid_installment_allocation');
  }

  const remaining = Number(BigInt(total) - fixed);

  if ((free.length === 0 && remaining !== 0) || remaining < free.length) {
    throw new Error('invalid_installment_allocation');
  }

  for (const [position, index] of free.entries()) {
    next[index] =
      Math.floor(remaining / free.length) +
      (position < remaining % free.length ? 1 : 0);
  }

  return next;
}
