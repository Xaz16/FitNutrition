import { useNavigate, useParams, useSearchParams } from 'react-router';
import { useAllergens, useRecipe } from '../api/hooks';
import { ErrorNotice, Loading } from '../components/ui';
import { formatNumber, formatQty, formatServings, MEAL_LABEL } from '../format';

const SERVING_STEP = 0.25;

function macro(value: number | null, unit = 'г'): string {
  return value === null ? 'нет данных' : `${formatNumber(value)} ${unit}`;
}

export function RecipePage() {
  const { dishId = '' } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const servings = Number(params.get('servings') ?? 2) || 2;
  const recipe = useRecipe(Number(dishId), servings);
  const allergens = useAllergens();

  const setServings = (value: number) => setParams({ servings: String(Math.max(SERVING_STEP, value)) }, { replace: true });

  if (recipe.isPending) return <Loading />;
  if (recipe.isError) return <ErrorNotice error={recipe.error} />;
  const r = recipe.data;
  const allergenName = (code: string) => allergens.data?.find((a) => a.code === code)?.name ?? code;

  return (
    <article className="stack narrow">
      <button type="button" className="btn btn--ghost btn--back" onClick={() => navigate(-1)}>
        ← Назад
      </button>
      <header className="page__header">
        <h1>{r.name}</h1>
        <p className="muted">
          {MEAL_LABEL[r.mealType]} · {r.cookTimeMin} мин
        </p>
      </header>
      <section className="card stack">
        <div className="row row--between">
          <h2>Ингредиенты</h2>
          <div className="stepper" aria-label="Число порций">
            <button type="button" className="btn btn--small" onClick={() => setServings(servings - SERVING_STEP)}>
              −
            </button>
            <span>
              <b>{formatServings(servings)}</b> порц.
            </span>
            <button type="button" className="btn btn--small" onClick={() => setServings(servings + SERVING_STEP)}>
              +
            </button>
          </div>
        </div>
        <table className="table">
          <tbody>
            {r.ingredients.map((i) => (
              <tr key={i.ingredientId}>
                <td>
                  {i.name}
                  {i.allergens.length > 0 && <span className="small muted"> · {i.allergens.map(allergenName).join(', ')}</span>}
                </td>
                <td className="num">{formatQty(i.quantity, i.unit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="card">
        <h2>На одну порцию</h2>
        <div className="macros">
          <div>
            <b>{r.perServing.kcal}</b>
            <span>ккал</span>
          </div>
          <div>
            <b>{macro(r.perServing.proteinG)}</b>
            <span>белки</span>
          </div>
          <div>
            <b>{macro(r.perServing.fatG)}</b>
            <span>жиры</span>
          </div>
          <div>
            <b>{macro(r.perServing.carbsG)}</b>
            <span>углеводы</span>
          </div>
        </div>
      </section>
      <section className="card">
        <h2>Приготовление</h2>
        <ol className="steps">
          {r.steps.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      </section>
    </article>
  );
}
