export type Sex = 'MALE' | 'FEMALE';
export type Goal = 'LOSE' | 'MAINTAIN' | 'GAIN';
export type MealType = 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK';
export type Unit = 'G' | 'ML' | 'PCS';

export interface SessionUser {
  id: string;
  email: string;
  hasProfile: boolean;
}

export interface AuthResponse {
  accessToken: string;
  user: SessionUser;
}

export interface Norm {
  kcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
}

export interface MemberInput {
  name: string;
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activityFactor: number;
  goal: Goal;
  allergens: string[];
  excludedIngredientIds: number[];
}

export interface Member extends MemberInput {
  id: string;
  isOwner: boolean;
  norm: Norm;
}

export interface ProfileSettings {
  mealsPerDay: number;
  repeatLimitPerWeek: number;
  monthlyBudgetRub: number;
}

export interface Profile extends ProfileSettings {
  city: string;
  members: Member[];
  householdNorm: Norm;
}

export type ProfileInput = MemberInput & ProfileSettings;

export interface Allergen {
  code: string;
  name: string;
}

export interface Ingredient {
  id: number;
  name: string;
  category: string;
  baseUnit: Unit;
}

export interface PlanSummary {
  id: string;
  startDate: string;
  days: number;
  mealsPerDay: number;
  budgetRub: number;
  needsRecheck: boolean;
  createdAt: string;
}

export interface PlannedMeal {
  id: string;
  slot: number;
  mealType: MealType;
  servings: number;
  kcal: number;
  dish: { id: number; name: string; kcalPerServing: number; cookTimeMin: number };
  violatesRestrictions: boolean;
}

export interface PlanDay {
  dayIndex: number;
  date: string;
  kcal: number;
  kcalDeviationPct: number;
  withinTolerance: boolean;
  meals: PlannedMeal[];
}

export interface Plan {
  id: string;
  startDate: string;
  days: number;
  mealsPerDay: number;
  dailyKcalTarget: number;
  budgetRub: number;
  needsRecheck: boolean;
  violations: string[];
  schedule: PlanDay[];
}

export interface Alternative {
  dishId: number;
  name: string;
  kcalPerServing: number;
  servings: number;
  kcal: number;
  cookTimeMin: number;
}

export interface Recipe {
  id: number;
  name: string;
  mealType: MealType;
  baseServings: number;
  servings: number;
  cookTimeMin: number;
  steps: string[];
  perServing: { kcal: number; proteinG: number | null; fatG: number | null; carbsG: number | null };
  ingredients: Array<{ ingredientId: number; name: string; unit: Unit; quantity: number; allergens: string[] }>;
}

export interface ShoppingLine {
  ingredientId: number;
  name: string;
  category: string;
  unit: Unit;
  required: number;
  atHome: number;
  toBuy: number;
  bought: boolean;
}

export interface ShoppingGroup {
  category: string;
  lines: ShoppingLine[];
}

export interface ChainBasket {
  chainCode: string;
  totalRub: number;
  complete: boolean;
  lines: Array<{ ingredientId: number; name: string; title: string; packs: number; packSize: number; unit: Unit; costRub: number; priceUpdatedAt: string }>;
  missing: Array<{ ingredientId: number; name: string }>;
  oldestPriceAt: string | null;
  hasStalePrices: boolean;
}

export interface BasketComparison {
  chains: Array<{ code: string; name: string }>;
  itemsCount: number;
  baskets: ChainBasket[];
  recommended: { chainCode: string; totalRub: number; savingVsNextRub: number | null } | null;
  split: { chains: [string, string]; totalRub: number; savingRub: number } | null;
  budget: { budgetRub: number; forecastRub: number; overBudgetRub: number; remainingRub: number; preliminary: boolean };
}

export interface Recommendation {
  dayIndex: number;
  dishId: number | null;
  text: string;
}

export interface Analysis {
  createdAt: string;
  recommendations: Recommendation[];
  disclaimer: string;
}
