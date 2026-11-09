import type { Goal, MealType, Unit } from './api/types';

const number = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });
const servingsFmt = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });
const money = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 });
const day = new Intl.DateTimeFormat('ru-RU', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'UTC' });
const dateTime = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const shortDate = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone: 'UTC' });

export const formatNumber = (value: number) => number.format(value);
export const formatServings = (value: number) => servingsFmt.format(value);
export const formatRub = (value: number) => money.format(value);
export const formatDay = (iso: string) => day.format(new Date(`${iso}T00:00:00Z`));
export const formatDateTime = (iso: string) => dateTime.format(new Date(iso));

export function formatPeriod(startIso: string, days: number): string {
  const start = new Date(`${startIso}T00:00:00Z`);
  const end = new Date(start.getTime() + (days - 1) * 86_400_000);
  return `${shortDate.format(start)} — ${shortDate.format(end)}`;
}

export function formatQty(value: number, unit: Unit): string {
  if (unit === 'G' && value >= 1000) return `${formatNumber(value / 1000)} кг`;
  if (unit === 'ML' && value >= 1000) return `${formatNumber(value / 1000)} л`;
  return `${formatNumber(value)} ${UNIT_LABEL[unit]}`;
}

export function formatPct(value: number): string {
  return `${value > 0 ? '+' : ''}${formatNumber(value)} %`;
}

export const UNIT_LABEL: Record<Unit, string> = { G: 'г', ML: 'мл', PCS: 'шт' };

export const MEAL_LABEL: Record<MealType, string> = {
  BREAKFAST: 'Завтрак',
  LUNCH: 'Обед',
  DINNER: 'Ужин',
  SNACK: 'Перекус',
};

export const GOAL_LABEL: Record<Goal, string> = { LOSE: 'Снизить вес', MAINTAIN: 'Сохранить вес', GAIN: 'Набрать вес' };

export const ACTIVITY_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 1.2, label: 'Минимальная (1,2)' },
  { value: 1.375, label: 'Лёгкая (1,375)' },
  { value: 1.55, label: 'Умеренная (1,55)' },
  { value: 1.725, label: 'Высокая (1,725)' },
  { value: 1.9, label: 'Очень высокая (1,9)' },
];

export const CATEGORY_LABEL: Record<string, string> = {
  VEGETABLES: 'Овощи и зелень',
  FRUITS: 'Фрукты',
  DAIRY: 'Молочные продукты',
  MEAT_FISH: 'Мясо и рыба',
  GROCERY: 'Бакалея',
  BAKERY: 'Хлеб',
  EGGS: 'Яйца',
  OTHER: 'Прочее',
};

export function pluralDays(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} день`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} дня`;
  return `${n} дней`;
}
