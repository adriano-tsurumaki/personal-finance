import type {
  CreditFinancingAmounts,
  CreditFinancingInput,
  FinancingCharge,
} from '../contracts/credit-financing';

function chargeCents(principal: number, charge: FinancingCharge): number {
  if (!charge || !Number.isFinite(charge.value) || charge.value < 0) {
    throw new Error('invalid_financing_charge');
  }

  if (charge.mode === 'amount' && Number.isSafeInteger(charge.value)) {
    return charge.value;
  }

  const basisPoints = Math.round(charge.value * 100);

  if (
    charge.mode !== 'percent' ||
    !Number.isSafeInteger(basisPoints) ||
    Math.abs(charge.value * 100 - basisPoints) > 0.000001
  ) {
    throw new Error('invalid_financing_charge');
  }

  const cents = Number(
    (BigInt(principal) * BigInt(basisPoints) + 5000n) / 10000n,
  );

  if (!Number.isSafeInteger(cents)) {
    throw new Error('invalid_financing_charge');
  }

  return cents;
}

/** Returns BRL cents, rounding each percentage charge half up independently. */
export function financingAmounts(
  input: CreditFinancingInput,
): CreditFinancingAmounts {
  if (
    !input ||
    !Number.isSafeInteger(input.principal_cents) ||
    input.principal_cents <= 0
  ) {
    throw new Error('invalid_financing_principal');
  }

  const interest = chargeCents(input.principal_cents, input.interest);
  const iof = chargeCents(input.principal_cents, input.iof);
  const total = input.principal_cents + interest + iof;

  if (!Number.isSafeInteger(total)) {
    throw new Error('invalid_financing_total');
  }

  return {
    principal_cents: input.principal_cents,
    interest_cents: interest,
    iof_cents: iof,
    total_cents: total,
  };
}

/** Allocates components against installment totals without creating or losing cents. */
export function allocateFinancing(
  input: CreditFinancingInput,
  totals: number[],
): CreditFinancingAmounts[] {
  const amounts = financingAmounts(input);

  if (
    totals.some((value) => !Number.isSafeInteger(value) || value <= 0) ||
    totals.reduce((sum, value) => sum + BigInt(value), 0n) !==
      BigInt(amounts.total_cents)
  ) {
    throw new Error('invalid_financing_allocation');
  }

  const distribute = (amount: number, capacities: number[]) => {
    const denominator = capacities.reduce(
      (sum, value) => sum + BigInt(value),
      0n,
    );
    const result = capacities.map((value) =>
      denominator === 0n
        ? 0
        : Number((BigInt(amount) * BigInt(value)) / denominator),
    );
    let remainder = amount - result.reduce((sum, value) => sum + value, 0);
    for (let index = 0; remainder > 0; index = (index + 1) % result.length) {
      if (result[index] < capacities[index]) {
        result[index]++;
        remainder--;
      }
    }
    return result;
  };
  const principal = distribute(amounts.principal_cents, totals);
  const interest = distribute(
    amounts.interest_cents,
    totals.map((total, index) => total - principal[index]),
  );
  return totals.map((total, index) => ({
    principal_cents: principal[index],
    interest_cents: interest[index],
    iof_cents: total - principal[index] - interest[index],
    total_cents: total,
  }));
}
