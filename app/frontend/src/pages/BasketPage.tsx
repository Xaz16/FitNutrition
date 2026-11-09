import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { useBaskets, useSetBudget } from '../api/hooks';
import type { BasketComparison, ChainBasket } from '../api/types';
import { ErrorNotice, Field, Loading, Notice, NumberInput, fieldError } from '../components/ui';
import { formatDateTime, formatQty, formatRub } from '../format';

export function BasketPage() {
  const { planId = '' } = useParams();
  const baskets = useBaskets(planId);
  const [open, setOpen] = useState<string | null>(null);

  if (baskets.isPending) return <Loading label="Считаем корзины в пяти сетях…" />;
  if (baskets.isError) return <ErrorNotice error={baskets.error} />;

  const data = baskets.data;
  const chainName = (code: string) => data.chains.find((c) => c.code === code)?.name ?? code;
  const sorted = [...data.baskets].sort((a, b) => Number(b.complete) - Number(a.complete) || a.totalRub - b.totalRub);

  return (
    <div className="stack">
      <header className="page__header page__header--row">
        <div>
          <h1>Сравнение корзин</h1>
          <p className="muted">{data.itemsCount} позиций к покупке · цены с учётом фасовки</p>
        </div>
        <Link to={`/plans/${planId}/shopping`} className="btn btn--ghost">
          ← Список покупок
        </Link>
      </header>

      <BudgetPanel planId={planId} budget={data.budget} />

      {data.itemsCount === 0 && <Notice tone="ok">Всё уже куплено или есть дома — покупать нечего.</Notice>}

      {data.recommended ? (
        <Notice tone="ok">
          Выгоднее всего — <b>{chainName(data.recommended.chainCode)}</b>: {formatRub(data.recommended.totalRub)}
          {data.recommended.savingVsNextRub !== null && <>, на {formatRub(data.recommended.savingVsNextRub)} дешевле следующей сети</>}.
        </Notice>
      ) : (
        data.itemsCount > 0 && <Notice tone="warn">Ни в одной сети нет полной корзины. Прогноз предварительный.</Notice>
      )}

      {data.split && (
        <Notice tone="info">
          <b>Совет:</b> купить часть в «{chainName(data.split.chains[0])}», часть в «{chainName(data.split.chains[1])}» —{' '}
          {formatRub(data.split.totalRub)}, экономия {formatRub(data.split.savingRub)}.
        </Notice>
      )}

      <div className="baskets">
        {sorted.map((b) => (
          <BasketCard
            key={b.chainCode}
            basket={b}
            name={chainName(b.chainCode)}
            recommended={data.recommended?.chainCode === b.chainCode}
            expanded={open === b.chainCode}
            onToggle={() => setOpen(open === b.chainCode ? null : b.chainCode)}
          />
        ))}
      </div>
      <p className="small muted">Неполная корзина не рекомендуется, даже если она дешевле. Цены старше 72 часов помечаются как устаревшие.</p>
    </div>
  );
}

function BudgetPanel({ planId, budget }: { planId: string; budget: BasketComparison['budget'] }) {
  const setBudget = useSetBudget(planId);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState<number | ''>(budget.budgetRub);
  const over = budget.overBudgetRub > 0;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setBudget.mutate(value === '' ? NaN : value, { onSuccess: () => setEditing(false) });
  };

  return (
    <section className={`card budget${over ? ' budget--over' : ' budget--ok'}`}>
      <div className="budget__figures">
        <div>
          <span className="small muted">Бюджет на период</span>
          <b>{formatRub(budget.budgetRub)}</b>
        </div>
        <div>
          <span className="small muted">Прогноз{budget.preliminary ? ' (предварительный)' : ''}</span>
          <b>{formatRub(budget.forecastRub)}</b>
        </div>
        <div>
          <span className="small muted">{over ? 'Превышение' : 'Остаётся'}</span>
          <b className={over ? 'text-danger' : 'text-ok'}>{formatRub(over ? budget.overBudgetRub : budget.remainingRub)}</b>
        </div>
      </div>
      {over && (
        <p className="small">
          Превышение бюджета на {formatRub(budget.overBudgetRub)}. Замените дорогие блюда в <Link to={`/plans/${planId}`}>рационе</Link> или
          отметьте продукты, которые уже есть дома.
        </p>
      )}
      {editing ? (
        <form className="row" onSubmit={submit} noValidate>
          <Field label="Новый бюджет, ₽" error={fieldError(setBudget.error, 'budgetRub')}>
            <NumberInput value={value} onChange={setValue} min={1} autoFocus />
          </Field>
          <button type="submit" className="btn btn--primary" disabled={setBudget.isPending}>
            Сохранить
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => setEditing(false)}>
            Отмена
          </button>
        </form>
      ) : (
        <button type="button" className="btn btn--ghost btn--small" onClick={() => setEditing(true)}>
          Изменить бюджет
        </button>
      )}
    </section>
  );
}

function BasketCard({
  basket,
  name,
  recommended,
  expanded,
  onToggle,
}: {
  basket: ChainBasket;
  name: string;
  recommended: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <article className={`card basket${recommended ? ' basket--best' : ''}${basket.complete ? '' : ' basket--incomplete'}`}>
      <header className="basket__header">
        <div>
          <h3>
            {name} {recommended && <span className="badge badge--ok">выгоднее всего</span>}
          </h3>
          <p className="small muted">
            {basket.oldestPriceAt ? `Цены от ${formatDateTime(basket.oldestPriceAt)}` : 'Нет цен'}
            {basket.hasStalePrices && <span className="badge badge--warn">устарели</span>}
          </p>
        </div>
        <b className="basket__total">{formatRub(basket.totalRub)}</b>
      </header>
      {basket.complete ? (
        <p className="small text-ok">Полная корзина</p>
      ) : (
        <p className="small text-danger">Нет в наличии: {basket.missing.map((m) => m.name).join(', ')}</p>
      )}
      <button type="button" className="btn btn--ghost btn--small" onClick={onToggle} aria-expanded={expanded}>
        {expanded ? 'Скрыть состав' : 'Состав корзины'}
      </button>
      {expanded && (
        <table className="table small">
          <tbody>
            {basket.lines.map((l) => (
              <tr key={l.ingredientId}>
                <td>{l.title}</td>
                <td className="num">
                  {l.packs} × {formatQty(l.packSize, l.unit)}
                </td>
                <td className="num">{formatRub(l.costRub)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </article>
  );
}
