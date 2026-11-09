import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useMarkShopping, usePlan, useShoppingList } from '../api/hooks';
import type { ShoppingLine } from '../api/types';
import { ErrorNotice, Loading } from '../components/ui';
import { CATEGORY_LABEL, formatPeriod, formatQty, UNIT_LABEL } from '../format';

export function ShoppingPage() {
  const { planId = '' } = useParams();
  const plan = usePlan(planId);
  const list = useShoppingList(planId);
  const mark = useMarkShopping(planId);

  if (list.isPending || plan.isPending) return <Loading />;
  if (list.isError) return <ErrorNotice error={list.error} />;

  const total = list.data.reduce((n, g) => n + g.lines.length, 0);
  const bought = list.data.reduce((n, g) => n + g.lines.filter((l) => l.bought).length, 0);

  return (
    <div className="stack">
      <header className="page__header page__header--row">
        <div>
          <h1>Список покупок</h1>
          <p className="muted">
            {plan.data ? `Рацион ${formatPeriod(plan.data.startDate, plan.data.days)} · ` : ''}
            {total} позиций, куплено {bought}
          </p>
        </div>
        <Link to={`/plans/${planId}/basket`} className="btn btn--primary">
          Сравнить цены в магазинах →
        </Link>
      </header>
      <ErrorNotice error={mark.error} />
      {list.data.map((group) => (
        <section key={group.category} className="card">
          <h2>{CATEGORY_LABEL[group.category] ?? group.category}</h2>
          <table className="table shopping">
            <thead>
              <tr>
                <th className="shopping__check" aria-label="Куплено" />
                <th>Продукт</th>
                <th className="num">Нужно</th>
                <th className="num">Есть дома</th>
                <th className="num">Купить</th>
              </tr>
            </thead>
            <tbody>
              {group.lines.map((line) => (
                <Row
                  key={`${line.ingredientId}:${line.unit}`}
                  line={line}
                  onToggle={() => mark.mutate({ ingredientId: line.ingredientId, bought: !line.bought })}
                  onAtHome={(atHomeQty) => mark.mutate({ ingredientId: line.ingredientId, atHomeQty })}
                />
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}

function Row({ line, onToggle, onAtHome }: { line: ShoppingLine; onToggle: () => void; onAtHome: (qty: number) => void }) {
  const [draft, setDraft] = useState(String(line.atHome));
  const commit = () => {
    const value = Number(draft.replace(',', '.'));
    if (Number.isFinite(value) && value >= 0 && value !== line.atHome) onAtHome(value);
    else setDraft(String(line.atHome));
  };
  return (
    <tr className={line.bought ? 'shopping__row--bought' : undefined}>
      <td className="shopping__check">
        <input type="checkbox" checked={line.bought} onChange={onToggle} aria-label={`Куплено: ${line.name}`} />
      </td>
      <td className="shopping__name">{line.name}</td>
      <td className="num">{formatQty(line.required, line.unit)}</td>
      <td className="num">
        <span className="qty-input">
          <input
            type="text"
            inputMode="decimal"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === 'Enter' && commit()}
            aria-label={`Есть дома: ${line.name}`}
          />
          <span className="small muted">{UNIT_LABEL[line.unit]}</span>
        </span>
      </td>
      <td className="num">{line.bought ? 'куплено' : formatQty(line.toBuy, line.unit)}</td>
    </tr>
  );
}
