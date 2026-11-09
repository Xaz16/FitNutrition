# Программные интерфейсы

Компоненты взаимодействуют на двух уровнях. Клиент обращается к серверу по REST/JSON. Внутри сервера модули Nest вызывают чистые функции доменного ядра и порт ИИ-советника. Оба уровня описаны ниже. Типы приведены на TypeScript, так как на нём написаны обе стороны. Клиентские типы лежат в `app/frontend/src/api/types.ts`, серверные схемы — в файлах `*.schemas.ts`.

## 1. Общие соглашения REST API

Все маршруты имеют префикс `/api`. Тела запросов и ответов передаются в JSON (UTF-8), даты — в ISO 8601 (`2026-11-10` или `2026-11-09T12:00:00.000Z`), деньги — числом в рублях с копейками. Количества продуктов указываются в базовых единицах `G`, `ML` или `PCS`.

Кроме `/auth/register` и `/auth/login`, каждый запрос должен нести заголовок `Authorization: Bearer <JWT>`. Токен живёт 7 дней, в полезной нагрузке хранится только `sub` (id пользователя). Пользователь видит только свои данные: каждый запрос к рациону фильтруется по `userId` из токена, поэтому чужой `planId` возвращает 404, а не 403.

Тело и параметры каждого запроса проверяются zod-схемой. Ошибки имеют единый формат:

```json
{
  "code": "VALIDATION_FAILED",
  "message": "Проверьте введённые данные",
  "fields": [{ "field": "age", "message": "Возраст должен быть от 14 до 100 лет" }]
}
```

`code` предназначен для программы, `message` можно показать человеку как есть, а `fields` присутствует только у ошибок валидации.

| HTTP | `code` | Когда |
|---|---|---|
| 400 | `VALIDATION_FAILED` | тело или параметры не прошли схему; в `fields` — поле и причина |
| 400 | `REPLACEMENT_NOT_ALLOWED` | замена на блюдо не из списка альтернатив |
| 401 | `UNAUTHENTICATED` | нет токена или он истёк |
| 401 | `INVALID_CREDENTIALS` | неверный email или пароль |
| 404 | `PLAN_NOT_FOUND`, `MEAL_NOT_FOUND`, `DISH_NOT_FOUND`, `MEMBER_NOT_FOUND`, `ITEM_NOT_FOUND` | объект не найден или принадлежит другому пользователю |
| 409 | `EMAIL_TAKEN` | повторная регистрация |
| 422 | `PROFILE_REQUIRED` | рацион запрошен до заполнения профиля |
| 422 | `NOT_ENOUGH_DISHES` | при заданных исключениях блюд не хватает; есть `unfilledByMealType`, `unfilledCount`, `suggestion` |
| 422 | `HOUSEHOLD_LIMIT` | попытка добавить седьмой профиль |
| 429 | `LOGIN_LOCKED` | пять неудачных входов за 15 минут; есть `lockedUntil` |
| 503 | `AI_UNAVAILABLE` | ИИ-сервис не ответил; есть `retryAfterSec` |

## 2. Маршруты

### Аутентификация (FR-01, NFR-01)

| Метод и путь | Тело запроса | Ответ |
|---|---|---|
| `POST /auth/register` | `Credentials` | `201 AuthResponse` |
| `POST /auth/login` | `Credentials` | `200 AuthResponse` |
| `GET /auth/me` | — | `200 SessionUser` |

```ts
interface Credentials { email: string; password: string }        // email приводится к нижнему регистру, пароль 8–128 символов
interface SessionUser { id: string; email: string; hasProfile: boolean }
interface AuthResponse { accessToken: string; user: SessionUser }
```

Пароль хранится как хеш bcrypt с cost 12. После пятой неудачной попытки в течение 15 минут учётная запись блокируется на 15 минут, и даже верный пароль получает 429.

### Профиль и семья (FR-02…FR-04, FR-15)

| Метод и путь | Тело запроса | Ответ |
|---|---|---|
| `GET /profile` | — | `200 Profile` или `200 null`, если профиль ещё не заполнен |
| `PUT /profile` | `ProfileInput` | `200 Profile` |
| `POST /household/members` | `MemberInput` | `201 Profile` |
| `PUT /household/members/:id` | `MemberInput` | `200 Profile` |
| `DELETE /household/members/:id` | — | `200 Profile` |

```ts
type Sex = 'MALE' | 'FEMALE';
type Goal = 'LOSE' | 'MAINTAIN' | 'GAIN';

interface MemberInput {
  name: string;
  sex: Sex;
  age: number;                     // 14–100
  heightCm: number;                // 100–250
  weightKg: number;                // 30–300
  activityFactor: 1.2 | 1.375 | 1.55 | 1.725 | 1.9;
  goal: Goal;
  allergens: string[];             // коды из GET /allergens
  excludedIngredientIds: number[]; // id из GET /ingredients
}

interface ProfileInput extends MemberInput {
  mealsPerDay: 3 | 4 | 5;
  repeatLimitPerWeek: number;      // 1–7
  monthlyBudgetRub: number;        // > 0
}

interface Norm { kcal: number; proteinG: number; fatG: number; carbsG: number }
interface Member extends MemberInput { id: string; isOwner: boolean; norm: Norm }

interface Profile {
  city: string;
  mealsPerDay: number;
  repeatLimitPerWeek: number;
  monthlyBudgetRub: number;
  members: Member[];               // владелец первым
  householdNorm: Norm;             // сумма норм всех членов семьи
}
```

`PUT /profile` создаёт или обновляет владельца семьи. Если у кого-то в семье изменились аллергены или исключения, все рационы пользователя получают `needsRecheck = true`.

### Каталог (FR-03, FR-08)

| Метод и путь | Ответ |
|---|---|
| `GET /allergens` | `Allergen[]` — 14 основных аллергенов |
| `GET /ingredients` | `Ingredient[]` |
| `GET /chains` | `{ code: string; name: string }[]` |
| `GET /dishes/:id?servings=3` | `Recipe` |

```ts
interface Recipe {
  id: number;
  name: string;
  mealType: 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK';
  baseServings: number;
  servings: number;                                   // запрошенное число порций (0,25–48)
  cookTimeMin: number;
  steps: string[];
  perServing: { kcal: number; proteinG: number | null; fatG: number | null; carbsG: number | null };
  ingredients: { ingredientId: number; name: string; unit: Unit; quantity: number; allergens: string[] }[];
}
```

Количества ингредиентов масштабируются как `quantity × servings / baseServings`, а КБЖУ на порцию от числа порций не зависит. Значение `null` в КБЖУ означает «нет данных», и клиент так его и показывает.

### Рационы (FR-05…FR-07)

| Метод и путь | Тело запроса | Ответ |
|---|---|---|
| `GET /plans` | — | `PlanSummary[]`, новые первыми |
| `POST /plans` | `{ startDate: string; days: number; budgetRub?: number }` | `201 Plan` |
| `GET /plans/:planId` | — | `Plan` |
| `DELETE /plans/:planId` | — | `204` |
| `PUT /plans/:planId/budget` | `{ budgetRub: number }` | `Plan` |
| `GET /plans/:planId/meals/:mealId/alternatives` | — | `Alternative[]` (до 5) |
| `PUT /plans/:planId/meals/:mealId` | `{ dishId: number }` | `Plan` |

```ts
interface Plan {
  id: string;
  startDate: string;
  days: number;                    // 7–31
  mealsPerDay: number;
  dailyKcalTarget: number;         // норма семьи на момент создания
  budgetRub: number;               // по умолчанию monthlyBudgetRub × days / 30
  needsRecheck: boolean;
  violations: string[];            // id приёмов пищи, которые нарушают текущие ограничения
  schedule: PlanDay[];
}

interface PlanDay {
  dayIndex: number;
  date: string;
  kcal: number;
  kcalDeviationPct: number;
  withinTolerance: boolean;        // |отклонение| ≤ 10 %
  meals: PlannedMeal[];
}

interface PlannedMeal {
  id: string;
  slot: number;
  mealType: MealType;
  servings: number;                // шаг 0,25 порции
  kcal: number;
  dish: { id: number; name: string; kcalPerServing: number; cookTimeMin: number };
  violatesRestrictions: boolean;
}

interface Alternative { dishId: number; name: string; kcalPerServing: number; servings: number; kcal: number; cookTimeMin: number }
```

Альтернативы подбираются среди блюд того же приёма пищи с калорийностью порции в пределах ±15 % от заменяемого. Блюда, нарушающие ограничения семьи, в список не попадают. Сервер принимает замену только на блюдо из этого списка и пересчитывает порции так, чтобы калорийность приёма пищи осталась прежней.

### Список покупок (FR-09, FR-10)

| Метод и путь | Тело запроса | Ответ |
|---|---|---|
| `GET /plans/:planId/shopping-list` | — | `ShoppingGroup[]` |
| `PATCH /plans/:planId/shopping-list/:ingredientId` | `{ bought?: boolean; atHomeQty?: number }` | `ShoppingGroup[]` |

```ts
interface ShoppingGroup { category: string; lines: ShoppingLine[] }
interface ShoppingLine {
  ingredientId: number;
  name: string;
  category: string;
  unit: 'G' | 'ML' | 'PCS';
  required: number;   // сумма по всем блюдам; штуки округлены вверх
  atHome: number;
  toBuy: number;      // max(0, required − atHome)
  bought: boolean;
}
```

### Корзины и бюджет (FR-11…FR-15, NFR-03)

`GET /plans/:planId/baskets` → `BasketComparison`

```ts
interface BasketComparison {
  chains: { code: string; name: string }[];
  itemsCount: number;                                  // позиции к покупке без купленных
  baskets: ChainBasket[];                              // по одной на каждую из 5 сетей
  recommended: { chainCode: string; totalRub: number; savingVsNextRub: number | null } | null;
  split: { chains: [string, string]; totalRub: number; savingRub: number } | null;
  budget: { budgetRub: number; forecastRub: number; overBudgetRub: number; remainingRub: number; preliminary: boolean };
}

interface ChainBasket {
  chainCode: string;
  totalRub: number;
  complete: boolean;
  lines: { ingredientId: number; name: string; title: string; packs: number; packSize: number; unit: Unit; costRub: number; priceUpdatedAt: string }[];
  missing: { ingredientId: number; name: string }[];
  oldestPriceAt: string | null;
  hasStalePrices: boolean;                             // самая старая цена старше 72 часов
}
```

`recommended` — самая дешёвая из **полных** корзин, `null`, если полных нет. В этом случае прогноз берётся по самой дешёвой неполной корзине, и `budget.preliminary = true`. `split` заполняется, только если лучшая пара сетей дешевле лучшей одной сети на 200 ₽ или больше.

### ИИ-анализ (FR-17)

| Метод и путь | Ответ |
|---|---|
| `POST /plans/:planId/analysis` | `201 { createdAt; days: DayDeviation[]; recommendations: Recommendation[]; disclaimer: string }` или `503 AI_UNAVAILABLE` |
| `GET /plans/:planId/analysis` | последний успешный анализ или `null` |

```ts
interface Recommendation { dayIndex: number; dishId: number | null; text: string }
```

## 3. Внутренние интерфейсы сервера

Сервисы Nest зависят от доменного ядра, обратной зависимости нет. Ядро не знает о базе и HTTP, поэтому его можно тестировать без моков.

```ts
// domain/nutrition.ts
function dailyNorm(p: BodyParameters): DailyNorm;
function householdNorm(members: BodyParameters[]): DailyNorm;

// domain/plan-generator.ts
function generatePlan(req: GenerationRequest): { ok: true; meals: GeneratedMeal[] } | { ok: false; unfilled: UnfilledSlot[] };
function pickAlternatives(current: CandidateDish, pool: CandidateDish[], limit?: number): CandidateDish[];
function servingsFor(targetKcal: number, kcalPerServing: number): number;

// domain/shopping-list.ts
function buildShoppingList(meals: MealUsage[], marks: ShoppingMarkInfo[]): ShoppingGroup[];

// domain/basket.ts
function packsNeeded(quantity: number, packSize: number): number;
function compareBaskets(chainCodes: string[], needs: BasketNeed[], offers: ChainOffer[], now: Date): BasketComparison;
function budgetVerdict(budgetRub: number, forecastRub: number, preliminary: boolean): BudgetVerdict;

// domain/day-deviation.ts
function dayDeviation(dayIndex: number, meals: DayMealNutrition[], norm: DailyNorm): DayDeviation;
```

ИИ-советник подключается через порт и токен внедрения зависимостей:

```ts
// ai/ai-advisor.ts
export const AI_ADVISOR = Symbol('AI_ADVISOR');

export interface AiAdvisor {
  recommend(input: { norm: DailyNorm; days: DayDeviation[]; catalogDishIds: number[] }): Promise<Recommendation[]>;
}

export class AiAdvisorUnavailableError extends Error {}
```

`PlansModule` выбирает реализацию по переменной `AI_ADVISOR_MODE`: `stub` подставляет `StubAiAdvisor` (правила поверх рассчитанных отклонений), `unavailable` — `UnavailableAiAdvisor`, который всегда бросает `AiAdvisorUnavailableError`. Адаптер к настоящей языковой модели реализует тот же интерфейс и регистрируется так же. `PlanInsightsService` переводит `AiAdvisorUnavailableError` в HTTP 503. Рекомендации со ссылкой на блюдо, которого нет в рационе, сервис отбрасывает, кому бы ни принадлежал адаптер.
