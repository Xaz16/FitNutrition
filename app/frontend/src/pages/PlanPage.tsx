import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useAlternatives, usePlan, useReplaceMeal } from '../api/hooks';
import type { Plan, PlannedMeal } from '../api/types';
import { ErrorNotice, Loading, Modal, Notice } from '../components/ui';
import { currentPlan } from '../session';
import { formatDay, formatNumber, formatPct, formatPeriod, formatServings, MEAL_LABEL } from '../format';

export function PlanPage() {
  const { planId = '' } = useParams();
  const plan = usePlan(planId);
  const [week, setWeek] = useState(0);
  const [replacing, setReplacing] = useState<{ meal: PlannedMeal; date: string } | null>(null);

  useEffect(() => {
    if (plan.data) currentPlan.set(plan.data.id);
  }, [plan.data]);

  if (plan.isPending) return <Loading />;
  if (plan.isError) return <ErrorNotice error={plan.error} />;

  const p = plan.data;
  const weeks = Math.ceil(p.days / 7);
  const visibleDays = p.schedule.slice(week * 7, week * 7 + 7);
  const slots = p.schedule[0]?.meals.map((m) => m.mealType) ?? [];

  return (
    <div className="stack">
      <header className="page__header page__header--row">
        <div>
          <h1>Рацион: {formatPeriod(p.startDate, p.days)}</h1>
          <p className="muted">
            Цель {formatNumber(p.dailyKcalTarget)} ккал в день · допустимое отклонение ±10 %
          </p>
        </div>
        <div className="actions">
          <Link to={`/plans/${p.id}/analysis`} className="btn btn--ghost">
            ИИ-анализ
          </Link>
          <Link to={`/plans/${p.id}/shopping`} className="btn btn--primary">
            Список покупок →
          </Link>
        </div>
      </header>

      {p.violations.length > 0 && (
        <Notice tone="warn">
          Профиль изменился: {p.violations.length} блюд(а) больше не подходят по аллергиям или исключениям. Они отмечены ниже — замените их.
        </Notice>
      )}

      {weeks > 1 && (
        <div className="pager">
          <button type="button" className="btn btn--ghost" disabled={week === 0} onClick={() => setWeek(week - 1)}>
            ← Неделя {week}
          </button>
          <b>Неделя {week + 1} из {weeks}</b>
          <button type="button" className="btn btn--ghost" disabled={week === weeks - 1} onClick={() => setWeek(week + 1)}>
            Неделя {week + 2} →
          </button>
        </div>
      )}

      <div className="schedule" style={{ ['--slots' as string]: slots.length }}>
        <div className="schedule__head">
          <span>День</span>
          {slots.map((type, i) => (
            <span key={i}>{MEAL_LABEL[type]}</span>
          ))}
          <span>Итого</span>
        </div>
        {visibleDays.map((day) => (
          <div key={day.dayIndex} className="schedule__row">
            <div className="schedule__day">
              <b>{formatDay(day.date)}</b>
            </div>
            {day.meals.map((meal) => (
              <MealCell key={meal.id} plan={p} meal={meal} onReplace={() => setReplacing({ meal, date: day.date })} />
            ))}
            <div className={`schedule__total${day.withinTolerance ? '' : ' schedule__total--off'}`}>
              <b>{formatNumber(day.kcal)} ккал</b>
              <span className="small">{formatPct(day.kcalDeviationPct)}</span>
            </div>
          </div>
        ))}
      </div>

      {replacing && <ReplaceDialog plan={p} meal={replacing.meal} date={replacing.date} onClose={() => setReplacing(null)} />}
    </div>
  );
}

function MealCell({ plan, meal, onReplace }: { plan: Plan; meal: PlannedMeal; onReplace: () => void }) {
  return (
    <div className={`meal${meal.violatesRestrictions ? ' meal--violation' : ''}`}>
      <span className="meal__type">{MEAL_LABEL[meal.mealType]}</span>
      <Link to={`/plans/${plan.id}/dishes/${meal.dish.id}?servings=${meal.servings}`} className="meal__name">
        {meal.dish.name}
      </Link>
      <span className="small muted">
        {formatServings(meal.servings)} порц. · {formatNumber(meal.kcal)} ккал
      </span>
      <button type="button" className="btn btn--small" onClick={onReplace}>
        ⇄ Заменить
      </button>
    </div>
  );
}

function ReplaceDialog({ plan, meal, date, onClose }: { plan: Plan; meal: PlannedMeal; date: string; onClose: () => void }) {
  const alternatives = useAlternatives(plan.id, meal.id);
  const replace = useReplaceMeal(plan.id);
  return (
    <Modal title={`Заменить «${meal.dish.name}»`} onClose={onClose}>
      <p className="muted">
        {MEAL_LABEL[meal.mealType]}, {formatDay(date)} · {formatNumber(meal.kcal)} ккал
      </p>
      {alternatives.isPending && <Loading />}
      <ErrorNotice error={alternatives.error ?? replace.error} />
      {alternatives.data?.length === 0 && <Notice tone="warn">Подходящих замен нет: все блюда этого приёма пищи отличаются по калорийности больше чем на 15 % или содержат исключённые продукты.</Notice>}
      <ul className="options">
        {alternatives.data?.map((alt) => (
          <li key={alt.dishId} className="option">
            <div>
              <b>{alt.name}</b>
              <div className="small muted">
                {alt.kcalPerServing} ккал/порц. · {formatServings(alt.servings)} порц. = {formatNumber(alt.kcal)} ккал · {alt.cookTimeMin} мин
              </div>
            </div>
            <button
              type="button"
              className="btn btn--primary btn--small"
              disabled={replace.isPending}
              onClick={() => replace.mutate({ mealId: meal.id, dishId: alt.dishId }, { onSuccess: onClose })}
            >
              Выбрать
            </button>
          </li>
        ))}
      </ul>
      <p className="small muted">Показаны блюда того же приёма пищи в пределах ±15 % калорий без исключённых продуктов. Список покупок и стоимость пересчитаются.</p>
    </Modal>
  );
}
