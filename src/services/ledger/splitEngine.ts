// src/services/ledger/splitEngine.ts
//
// Turns an expense amount + a split type into a per-member share, in a way
// that always sums back to exactly the original amount to the paisa/cent.
//
// The old app did `totalExpense / totalUsers.length` with no rounding
// strategy at all, which both loses/gains fractions of a rupee across a
// group and offers no way to split anything other than dead-even. This
// replaces that with four split types, each routed through the same
// largest-remainder rounding so the numbers always reconcile.

import {EPSILON, SplitParams, SplitType} from './types';

export interface SplitValidationResult {
  valid: boolean;
  error?: string;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Distributes `total` across `weights` (uid -> weight, any positive numbers)
 * proportionally, using the largest-remainder method so the distributed
 * amounts always sum to exactly `total` (to the cent) even though naive
 * proportional division would leave the sum off by a rounding error.
 */
function distributeByWeights(
  total: number,
  weights: Record<string, number>,
): Record<string, number> {
  const uids = Object.keys(weights);
  const weightSum = uids.reduce((s, uid) => s + weights[uid], 0);
  if (weightSum <= 0) {
    throw new Error('Split weights must sum to a positive number.');
  }

  const totalCents = Math.round(total * 100);
  const raw = uids.map(uid => (total * weights[uid]) / weightSum);
  const flooredCents = raw.map(v => Math.floor(v * 100));
  let distributedCents = flooredCents.reduce((s, v) => s + v, 0);
  let remainder = totalCents - distributedCents;

  // Largest-remainder method: give the leftover paise/cents, one each, to
  // the uids whose fractional part was closest to rounding up.
  const remainders = uids
    .map((uid, i) => ({uid, i, frac: raw[i] * 100 - flooredCents[i]}))
    .sort((a, b) => b.frac - a.frac);

  const cents = [...flooredCents];
  for (let k = 0; k < remainders.length && remainder > 0; k++, remainder--) {
    cents[remainders[k].i] += 1;
  }

  const result: Record<string, number> = {};
  uids.forEach((uid, i) => {
    result[uid] = cents[i] / 100;
  });
  return result;
}

export function validateSplitInput(
  totalAmount: number,
  splitType: SplitType,
  participantUids: string[],
  params?: SplitParams,
): SplitValidationResult {
  if (!(totalAmount > 0)) {
    return {valid: false, error: 'Total amount must be greater than zero.'};
  }
  if (participantUids.length === 0) {
    return {valid: false, error: 'A split needs at least one participant.'};
  }

  switch (splitType) {
    case 'equal':
      return {valid: true};

    case 'exact': {
      const amounts = params?.exactAmounts;
      if (!amounts) {
        return {
          valid: false,
          error: 'Exact amounts are required for an exact split.',
        };
      }
      const missing = participantUids.filter(uid => amounts[uid] == null);
      if (missing.length) {
        return {
          valid: false,
          error: 'Every participant needs an exact amount.',
        };
      }
      const sum = participantUids.reduce((s, uid) => s + amounts[uid], 0);
      if (Math.abs(sum - totalAmount) > EPSILON) {
        return {
          valid: false,
          error: `Exact amounts add up to ${round2(sum)}, not ${round2(
            totalAmount,
          )}.`,
        };
      }
      return {valid: true};
    }

    case 'percentage': {
      const percentages = params?.percentages;
      if (!percentages) {
        return {
          valid: false,
          error: 'Percentages are required for a percentage split.',
        };
      }
      const missing = participantUids.filter(uid => percentages[uid] == null);
      if (missing.length) {
        return {valid: false, error: 'Every participant needs a percentage.'};
      }
      const sum = participantUids.reduce((s, uid) => s + percentages[uid], 0);
      if (Math.abs(sum - 100) > 0.01) {
        return {
          valid: false,
          error: `Percentages add up to ${round2(sum)}%, not 100%.`,
        };
      }
      return {valid: true};
    }

    case 'shares': {
      const shares = params?.shares;
      if (!shares) {
        return {
          valid: false,
          error: 'Shares are required for a weighted split.',
        };
      }
      const missing = participantUids.filter(uid => !(shares[uid] > 0));
      if (missing.length) {
        return {
          valid: false,
          error: 'Every participant needs at least 1 share.',
        };
      }
      return {valid: true};
    }

    default:
      return {valid: false, error: `Unknown split type: ${splitType}`};
  }
}

/**
 * Computes each participant's share of `totalAmount`. Always returns shares
 * that sum to exactly `totalAmount` (rounded to 2 decimal places).
 * Throws if the input is invalid — call `validateSplitInput` first to
 * surface a friendly error instead.
 */
export function computeSplits(
  totalAmount: number,
  splitType: SplitType,
  participantUids: string[],
  params?: SplitParams,
): Record<string, number> {
  const check = validateSplitInput(
    totalAmount,
    splitType,
    participantUids,
    params,
  );
  if (!check.valid) {
    throw new Error(check.error);
  }

  switch (splitType) {
    case 'equal': {
      const equalWeights: Record<string, number> = {};
      participantUids.forEach(uid => (equalWeights[uid] = 1));
      return distributeByWeights(totalAmount, equalWeights);
    }

    case 'exact': {
      const amounts = params!.exactAmounts!;
      const result: Record<string, number> = {};
      participantUids.forEach(uid => (result[uid] = round2(amounts[uid])));
      return result;
    }

    case 'percentage': {
      const percentages = params!.percentages!;
      return distributeByWeights(totalAmount, percentages);
    }

    case 'shares': {
      const shares = params!.shares!;
      return distributeByWeights(totalAmount, shares);
    }

    default:
      throw new Error(`Unknown split type: ${splitType}`);
  }
}
