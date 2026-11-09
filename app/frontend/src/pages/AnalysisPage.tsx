import { Link, useParams } from 'react-router';
import { ApiError } from '../api/client';
import { useLatestAnalysis, usePlan, useRunAnalysis } from '../api/hooks';
import { ErrorNotice, Loading, Notice } from '../components/ui';
import { formatDateTime, formatDay } from '../format';

export function AnalysisPage() {
  const { planId = '' } = useParams();
  const plan = usePlan(planId);
  const latest = useLatestAnalysis(planId);
  const run = useRunAnalysis(planId);

  if (latest.isPending || plan.isPending) return <Loading />;
  if (latest.isError) return <ErrorNotice error={latest.error} />;

  const analysis = run.data ?? latest.data;
  const unavailable = run.error instanceof ApiError && run.error.code === 'AI_UNAVAILABLE' ? run.error : null;
  const dateOf = (dayIndex: number) => plan.data?.schedule[dayIndex]?.date;

  return (
    <div className="stack narrow">
      <header className="page__header page__header--row">
        <div>
          <h1>ИИ-анализ рациона</h1>
          <p className="muted">Отклонения по калориям и БЖУ считает сервер, агент формулирует рекомендации.</p>
        </div>
        <button type="button" className="btn btn--primary" onClick={() => run.mutate()} disabled={run.isPending}>
          {run.isPending ? 'Анализируем…' : analysis ? 'Проанализировать заново' : 'Запустить анализ'}
        </button>
      </header>

      {unavailable && (
        <Notice tone="error">
          <b>{unavailable.message}</b>
          <div className="actions">
            <button type="button" className="btn btn--small" onClick={() => run.mutate()}>
              Повторить
            </button>
            <Link to={`/plans/${planId}`} className="btn btn--ghost btn--small">
              Вернуться к рациону
            </Link>
          </div>
        </Notice>
      )}
      {run.isError && !unavailable && <ErrorNotice error={run.error} />}

      {analysis ? (
        <section className="card stack">
          <p className="small muted">Анализ от {formatDateTime(analysis.createdAt)}</p>
          <ul className="recommendations">
            {analysis.recommendations.map((r, i) => (
              <li key={i}>
                <span className="badge">{dateOf(r.dayIndex) ? formatDay(dateOf(r.dayIndex)!) : `День ${r.dayIndex + 1}`}</span>
                <span>{r.text}</span>
                {r.dishId !== null && (
                  <Link to={`/plans/${planId}`} className="small">
                    к рациону
                  </Link>
                )}
              </li>
            ))}
          </ul>
          <Notice tone="info">{analysis.disclaimer} Рацион не меняется без вашего подтверждения.</Notice>
        </section>
      ) : (
        !unavailable && <Notice tone="info">Анализ ещё не запускался.</Notice>
      )}
    </div>
  );
}
