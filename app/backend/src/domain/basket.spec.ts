import { bestSplit, budgetVerdict, chainBasket, packsNeeded, recommend, type BasketNeed, type ChainBasket, type ChainOffer } from './basket.js';

const now = new Date('2026-11-09T12:00:00Z');

function basket(chainCode: string, totalRub: number, complete = true): ChainBasket {
  return { chainCode, totalRub, complete, lines: [], missing: [], oldestPriceAt: now, hasStalePrices: false };
}

function offer(chainCode: string, ingredientId: number, priceRub: number, extra: Partial<ChainOffer> = {}): ChainOffer {
  return { chainCode, ingredientId, title: 't', packSize: 1000, packUnit: 'G', priceRub, inStock: true, priceUpdatedAt: now, ...extra };
}

describe('packsNeeded (FR-12)', () => {
  it('rounds 700 g up to 2 packs of 500 g', () => {
    expect(packsNeeded(700, 500)).toBe(2);
  });

  it('does not add a pack for an exact fit', () => {
    expect(packsNeeded(1000, 500)).toBe(2);
  });
});

describe('recommend (FR-13)', () => {
  it('picks Магнит at 1180 ₽ and reports 30 ₽ saving against the next chain', () => {
    const result = recommend([basket('lenta', 1250), basket('magnit', 1180), basket('pyaterochka', 1210)]);
    expect(result).toEqual({ chainCode: 'magnit', totalRub: 1180, savingVsNextRub: 30 });
  });

  it('never recommends an incomplete basket over a complete one', () => {
    const result = recommend([basket('lenta', 1250), basket('magnit', 900, false)]);
    expect(result?.chainCode).toBe('lenta');
  });
});

describe('chainBasket (FR-11, FR-13, NFR-03)', () => {
  const needs: BasketNeed[] = [
    { ingredientId: 1, name: 'Рис', unit: 'G', quantity: 700 },
    { ingredientId: 2, name: 'Киноа', unit: 'G', quantity: 200 },
  ];

  it('marks missing and out-of-stock items and keeps the basket incomplete', () => {
    const result = chainBasket('magnit', needs, [offer('magnit', 1, 100), offer('magnit', 2, 300, { inStock: false })], now);
    expect(result.complete).toBe(false);
    expect(result.missing.map((m) => m.name)).toEqual(['Киноа']);
  });

  it('flags prices older than 72 hours as stale', () => {
    const old = new Date(now.getTime() - 96 * 3600_000);
    const result = chainBasket('auchan', needs.slice(0, 1), [offer('auchan', 1, 100, { priceUpdatedAt: old })], now);
    expect(result.hasStalePrices).toBe(true);
    expect(result.oldestPriceAt).toEqual(old);
  });
});

describe('bestSplit (FR-14)', () => {
  const needs: BasketNeed[] = [
    { ingredientId: 1, name: 'A', unit: 'G', quantity: 1000 },
    { ingredientId: 2, name: 'B', unit: 'G', quantity: 1000 },
  ];

  it('suggests a pair when it saves at least 200 ₽ (3000 → 2750)', () => {
    const offers = [offer('lenta', 1, 1500), offer('lenta', 2, 1500), offer('magnit', 1, 1250), offer('magnit', 2, 1700)];
    expect(bestSplit(['lenta', 'magnit'], needs, offers, 3000)).toMatchObject({ totalRub: 2750, savingRub: 250 });
  });

  it('stays silent when the saving is only 100 ₽ (3000 → 2900)', () => {
    const offers = [offer('lenta', 1, 1500), offer('lenta', 2, 1500), offer('magnit', 1, 1400), offer('magnit', 2, 1700)];
    expect(bestSplit(['lenta', 'magnit'], needs, offers, 3000)).toBeNull();
  });
});

describe('budgetVerdict (FR-15)', () => {
  it('reports 800 ₽ over a 9000 ₽ budget for a 9800 ₽ forecast', () => {
    expect(budgetVerdict(9000, 9800, false)).toMatchObject({ overBudgetRub: 800, remainingRub: 0 });
  });
});
