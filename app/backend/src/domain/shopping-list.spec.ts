import { buildShoppingList, type IngredientInfo } from './shopping-list.js';

const rice: IngredientInfo = { id: 1, name: 'Рис', category: 'GROCERY', baseUnit: 'G', gramsPerPiece: null };
const garlic: IngredientInfo = { id: 2, name: 'Чеснок', category: 'VEGETABLES', baseUnit: 'G', gramsPerPiece: null };
const potato: IngredientInfo = { id: 3, name: 'Картофель', category: 'VEGETABLES', baseUnit: 'G', gramsPerPiece: 120 };

describe('buildShoppingList (FR-09, FR-10)', () => {
  it('sums equal ingredients: 200 g + 300 g of rice = 500 g', () => {
    const groups = buildShoppingList(
      [
        { servings: 2, baseServings: 2, ingredients: [{ ingredient: rice, quantity: 200, unit: 'G' }] },
        { servings: 2, baseServings: 2, ingredients: [{ ingredient: rice, quantity: 300, unit: 'G' }] },
      ],
      [],
    );
    expect(groups[0].lines[0]).toMatchObject({ name: 'Рис', unit: 'G', required: 500 });
  });

  it('keeps pieces and grams apart when there is no conversion factor', () => {
    const groups = buildShoppingList(
      [
        { servings: 2, baseServings: 2, ingredients: [{ ingredient: garlic, quantity: 10, unit: 'G' }] },
        { servings: 2, baseServings: 2, ingredients: [{ ingredient: garlic, quantity: 2, unit: 'PCS' }] },
      ],
      [],
    );
    expect(groups[0].lines.map((l) => l.unit).sort()).toEqual(['G', 'PCS']);
  });

  it('converts pieces to grams when the ingredient has a piece weight', () => {
    const groups = buildShoppingList(
      [{ servings: 2, baseServings: 2, ingredients: [{ ingredient: potato, quantity: 3, unit: 'PCS' }] }],
      [],
    );
    expect(groups[0].lines[0]).toMatchObject({ unit: 'G', required: 360 });
  });

  it('rounds pieces up to whole items', () => {
    const egg: IngredientInfo = { id: 4, name: 'Яйцо', category: 'EGGS', baseUnit: 'PCS', gramsPerPiece: null };
    const groups = buildShoppingList(
      [{ servings: 3.65, baseServings: 2, ingredients: [{ ingredient: egg, quantity: 4, unit: 'PCS' }] }],
      [],
    );
    expect(groups[0].lines[0].required).toBe(8);
  });

  it('scales by servings and groups by category', () => {
    const groups = buildShoppingList(
      [
        {
          servings: 3,
          baseServings: 2,
          ingredients: [
            { ingredient: rice, quantity: 200, unit: 'G' },
            { ingredient: potato, quantity: 240, unit: 'G' },
          ],
        },
      ],
      [],
    );
    expect(groups.map((g) => g.category)).toEqual(['GROCERY', 'VEGETABLES']);
    expect(groups[0].lines[0].required).toBe(300);
  });

  it('subtracts what is at home: need 1 kg, have 300 g, buy 700 g', () => {
    const groups = buildShoppingList(
      [{ servings: 2, baseServings: 2, ingredients: [{ ingredient: rice, quantity: 1000, unit: 'G' }] }],
      [{ ingredientId: 1, bought: false, atHomeQty: 300 }],
    );
    expect(groups[0].lines[0]).toMatchObject({ required: 1000, atHome: 300, toBuy: 700 });
  });
});
