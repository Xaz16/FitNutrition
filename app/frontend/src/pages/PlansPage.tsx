import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { ApiError } from '../api/client';
import { useCreatePlan, usePlans, useProfile } from '../api/hooks';
import { ErrorNotice, Field, Loading, Notice, NumberInput, fieldError } from '../components/ui';
import { currentPlan } from '../session';
import { formatNumber, formatPeriod, formatRub, MEAL_LABEL, pluralDays } from '../format';
import type { MealType } from '../api/types';

export function PlansIndexPage() {
  const plans = usePlans();
  if (plans.isPending) return <Loading />;
  if (plans.isError) return <ErrorNotice error={plans.error} />;
  if (plans.data.length === 0) return <Navigate to="/plans/new" replace />;
  const remembered = currentPlan.get();
  const target = plans.data.find((p) => p.id === remembered) ?? plans.data[0];
  return <Navigate to={`/plans/${target.id}`} replace />;
}

export function PlansListPage() {
  const plans = usePlans();
  if (plans.isPending) return <Loading />;
  if (plans.isError) return <ErrorNotice error={plans.error} />;
  return (
    <div className="stack">
      <header className="page__header page__header--row">
        <h1>Мои рационы</h1>
        <Link to="/plans/new" className="btn btn--primary">
          Новый рацион
        </Link>
      </header>
      <ul className="member-list">
        {plans.data.map((p) => (
          <li key={p.id} className="card member">
            <div>
              <h3>
                <Link to={`/plans/${p.id}`}>{formatPeriod(p.startDate, p.days)}</Link>
              </h3>
              <p className="muted">
                {pluralDays(p.days)} · {p.mealsPerDay} приёма пищи · бюджет {formatRub(p.budgetRub)}
              </p>
            </div>
            {p.needsRecheck && <span className="badge badge--warn">нужна перепроверка</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

const PRESETS = [7, 14, 31];

function tomorrow(): string {
  return new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
}

export function NewPlanPage() {
  const navigate = useNavigate();
  const profile = useProfile();
  const create = useCreatePlan();
  const [startDate, setStartDate] = useState(tomorrow);
  const [days, setDays] = useState<number | ''>(7);
  const [budget, setBudget] = useState<number | ''>('');

  if (profile.isPending) return <Loading />;
  if (!profile.data) return <Navigate to="/profile" replace />;

  const defaultBudget = typeof days === 'number' ? Math.round((profile.data.monthlyBudgetRub * days) / 30) : null;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate(
      { startDate, days: days === '' ? NaN : days, ...(budget !== '' && { budgetRub: budget }) },
      {
        onSuccess: (plan) => {
          currentPlan.set(plan.id);
          navigate(`/plans/${plan.id}`);
        },
      },
    );
  };

  const shortage = create.error instanceof ApiError && create.error.code === 'NOT_ENOUGH_DISHES' ? create.error : null;
  const unfilled = (shortage?.details.unfilledByMealType ?? {}) as Partial<Record<MealType, number>>;

  return (
    <form className="stack narrow" onSubmit={submit} noValidate>
      <header className="page__header">
        <h1>Составить рацион</h1>
        <p className="muted">
          Норма {profile.data.members.length > 1 ? 'семьи' : ''}: <b>{formatNumber(profile.data.householdNorm.kcal)} ккал</b> в день ·{' '}
          {profile.data.mealsPerDay} приёма пищи · не чаще {profile.data.repeatLimitPerWeek} раз в неделю одно блюдо
        </p>
      </header>
      <section className="card stack">
        <Field label="Дата начала" error={fieldError(create.error, 'startDate')}>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </Field>
        <Field label="Срок, дней" error={fieldError(create.error, 'days')} hint="От 7 до 31 дня">
          <div className="row">
            <div className="segmented">
              {PRESETS.map((n) => (
                <button key={n} type="button" className={`segmented__item${days === n ? ' segmented__item--active' : ''}`} onClick={() => setDays(n)}>
                  {pluralDays(n)}
                </button>
              ))}
            </div>
            <NumberInput value={days} onChange={setDays} min={7} max={31} className="input--short" aria-label="Свой срок" />
          </div>
        </Field>
        <Field
          label="Бюджет на период, ₽"
          error={fieldError(create.error, 'budgetRub')}
          hint={defaultBudget ? `Если не указать — ${formatRub(defaultBudget)} из месячного бюджета` : undefined}
        >
          <NumberInput value={budget} onChange={setBudget} min={1} placeholder={defaultBudget ? String(defaultBudget) : ''} />
        </Field>
      </section>
      {shortage && (
        <Notice tone="warn">
          <b>{shortage.message}</b>
          <br />
          Не заполнено:{' '}
          {Object.entries(unfilled)
            .map(([type, count]) => `${MEAL_LABEL[type as MealType].toLowerCase()} — ${count}`)
            .join(', ')}
          . {String(shortage.details.suggestion ?? '')}. <Link to="/profile">Изменить настройки</Link>
        </Notice>
      )}
      {create.isError && !shortage && !(create.error instanceof ApiError && create.error.fields.length) && <ErrorNotice error={create.error} />}
      <div className="actions">
        <button type="submit" className="btn btn--primary" disabled={create.isPending}>
          {create.isPending ? 'Составляем…' : 'Составить рацион'}
        </button>
        <Link to="/plans/all" className="btn btn--ghost">
          Все рационы
        </Link>
      </div>
    </form>
  );
}
