import type { Unit } from './shopping-list.js';

export interface BasketNeed {
  ingredientId: number;
  name: string;
  unit: Unit;
  quantity: number;
}

export interface ChainOffer {
  chainCode: string;
  ingredientId: number;
  title: string;
  packSize: number;
  packUnit: Unit;
  priceRub: number;
  inStock: boolean;
  priceUpdatedAt: Date;
}

export interface BasketLine {
  ingredientId: number;
  name: string;
  title: string;
  packs: number;
  packSize: number;
  unit: Unit;
  costRub: number;
  priceUpdatedAt: Date;
}

export interface ChainBasket {
  chainCode: string;
  totalRub: number;
  complete: boolean;
  lines: BasketLine[];
  missing: Array<{ ingredientId: number; name: string }>;
  oldestPriceAt: Date | null;
  hasStalePrices: boolean;
}

export interface SplitSuggestion {
  chains: [string, string];
  totalRub: number;
  savingRub: number;
}

export interface BasketComparison {
  baskets: ChainBasket[];
  recommended: { chainCode: string; totalRub: number; savingVsNextRub: number | null } | null;
  split: SplitSuggestion | null;
}

export const STALE_PRICE_HOURS = 72;
export const DEFAULT_SPLIT_THRESHOLD_RUB = 200;

const roundRub = (value: number) => Math.round(value * 100) / 100;

export function packsNeeded(quantity: number, packSize: number): number {
  return Math.ceil(quantity / packSize - 1e-9);
}

function offerFor(offers: ChainOffer[], chainCode: string, need: BasketNeed): ChainOffer | undefined {
  return offers.find(
    (o) => o.chainCode === chainCode && o.ingredientId === need.ingredientId && o.packUnit === need.unit && o.inStock,
  );
}

function lineFor(need: BasketNeed, offer: ChainOffer): BasketLine {
  const packs = packsNeeded(need.quantity, offer.packSize);
  return {
    ingredientId: need.ingredientId,
    name: need.name,
    title: offer.title,
    packs,
    packSize: offer.packSize,
    unit: offer.packUnit,
    costRub: roundRub(packs * offer.priceRub),
    priceUpdatedAt: offer.priceUpdatedAt,
  };
}

export function chainBasket(chainCode: string, needs: BasketNeed[], offers: ChainOffer[], now: Date): ChainBasket {
  const lines: BasketLine[] = [];
  const missing: ChainBasket['missing'] = [];
  for (const need of needs) {
    const offer = offerFor(offers, chainCode, need);
    if (offer) {
      lines.push(lineFor(need, offer));
    } else {
      missing.push({ ingredientId: need.ingredientId, name: need.name });
    }
  }
  const oldest = lines.reduce<Date | null>(
    (min, l) => (min === null || l.priceUpdatedAt < min ? l.priceUpdatedAt : min),
    null,
  );
  return {
    chainCode,
    totalRub: roundRub(lines.reduce((sum, l) => sum + l.costRub, 0)),
    complete: missing.length === 0,
    lines,
    missing,
    oldestPriceAt: oldest,
    hasStalePrices: oldest !== null && now.getTime() - oldest.getTime() > STALE_PRICE_HOURS * 3600_000,
  };
}

export function recommend(baskets: ChainBasket[]): BasketComparison['recommended'] {
  const complete = baskets.filter((b) => b.complete).sort((a, b) => a.totalRub - b.totalRub);
  const [best, next] = complete;
  if (!best) {
    return null;
  }
  return {
    chainCode: best.chainCode,
    totalRub: best.totalRub,
    savingVsNextRub: next ? roundRub(next.totalRub - best.totalRub) : null,
  };
}

export function bestSplit(
  chainCodes: string[],
  needs: BasketNeed[],
  offers: ChainOffer[],
  bestSingleRub: number,
  thresholdRub = DEFAULT_SPLIT_THRESHOLD_RUB,
): SplitSuggestion | null {
  let best: SplitSuggestion | null = null;
  for (let i = 0; i < chainCodes.length; i++) {
    for (let j = i + 1; j < chainCodes.length; j++) {
      const pair: [string, string] = [chainCodes[i], chainCodes[j]];
      let total = 0;
      let complete = true;
      for (const need of needs) {
        const costs = pair
          .map((code) => offerFor(offers, code, need))
          .filter((o): o is ChainOffer => o !== undefined)
          .map((o) => lineFor(need, o).costRub);
        if (costs.length === 0) {
          complete = false;
          break;
        }
        total += Math.min(...costs);
      }
      if (complete && (best === null || total < best.totalRub)) {
        best = { chains: pair, totalRub: roundRub(total), savingRub: roundRub(bestSingleRub - total) };
      }
    }
  }
  return best && best.savingRub >= thresholdRub ? best : null;
}

export function compareBaskets(
  chainCodes: string[],
  needs: BasketNeed[],
  offers: ChainOffer[],
  now: Date,
): BasketComparison {
  const baskets = chainCodes.map((code) => chainBasket(code, needs, offers, now));
  const recommended = recommend(baskets);
  const split = recommended ? bestSplit(chainCodes, needs, offers, recommended.totalRub) : null;
  return { baskets, recommended, split };
}

export function budgetVerdict(budgetRub: number, forecastRub: number, preliminary: boolean) {
  const diff = roundRub(forecastRub - budgetRub);
  return {
    budgetRub,
    forecastRub,
    overBudgetRub: diff > 0 ? diff : 0,
    remainingRub: diff <= 0 ? -diff : 0,
    preliminary,
  };
}
