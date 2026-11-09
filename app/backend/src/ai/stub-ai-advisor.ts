import type { AdvisorInput, AiAdvisor, Recommendation } from './ai-advisor.js';
import { AiAdvisorUnavailableError } from './ai-advisor.js';
import type { DayDeviation } from '../domain/day-deviation.js';

const NOTICEABLE_DEVIATION_PCT = 5;

const MACRO_ADVICE = {
  protein: {
    label: 'белка',
    low: 'Добавьте блюдо с птицей, рыбой или творогом из каталога.',
    high: 'Замените одно мясное блюдо на овощное или крупяное.',
  },
  fat: {
    label: 'жиров',
    low: 'Можно добавить немного растительного масла или орехов, если нет аллергии.',
    high: 'Замените самое калорийное блюдо дня на более лёгкое того же приёма пищи.',
  },
  carbs: {
    label: 'углеводов',
    low: 'Добавьте гарнир из крупы или цельнозерновой хлеб.',
    high: 'Уменьшите порцию гарнира или замените выпечку на овощи.',
  },
} as const;

type Macro = keyof typeof MACRO_ADVICE;

const deviationOf: Record<Macro, (d: DayDeviation) => number> = {
  protein: (d) => d.proteinDeviationPct,
  fat: (d) => d.fatDeviationPct,
  carbs: (d) => d.carbsDeviationPct,
};

function worst(days: DayDeviation[], pick: (d: DayDeviation) => number): DayDeviation {
  return days.reduce((a, b) => (Math.abs(pick(b)) > Math.abs(pick(a)) ? b : a));
}

function dayLabel(d: DayDeviation): string {
  return `День ${d.dayIndex + 1}`;
}

function macroRecommendation(days: DayDeviation[], macro: Macro): Recommendation {
  const day = worst(days, deviationOf[macro]);
  const deviation = deviationOf[macro](day);
  const advice = MACRO_ADVICE[macro];
  if (Math.abs(deviation) <= NOTICEABLE_DEVIATION_PCT) {
    return {
      dayIndex: day.dayIndex,
      dishId: null,
      text: `${dayLabel(day)}: количество ${advice.label} близко к норме (отклонение ${deviation} %), менять ничего не нужно.`,
    };
  }
  const direction = deviation < 0 ? 'меньше' : 'больше';
  return {
    dayIndex: day.dayIndex,
    dishId: day.topDish?.dishId ?? null,
    text: `${dayLabel(day)}: ${advice.label} на ${Math.abs(deviation)} % ${direction} нормы. ${deviation < 0 ? advice.low : advice.high}`,
  };
}

export class StubAiAdvisor implements AiAdvisor {
  async recommend({ days }: AdvisorInput): Promise<Recommendation[]> {
    if (days.length === 0) {
      return [];
    }
    const measurable = days.filter((d) => !d.incompleteNutrition);
    const result: Recommendation[] = [];
    if (measurable.length > 0) {
      result.push(macroRecommendation(measurable, 'protein'), macroRecommendation(measurable, 'fat'), macroRecommendation(measurable, 'carbs'));
    }

    const kcal = worst(days, (d) => d.kcalDeviationPct);
    result.push({
      dayIndex: kcal.dayIndex,
      dishId: kcal.topDish?.dishId ?? null,
      text: `${dayLabel(kcal)}: калорийность отличается от нормы на ${kcal.kcalDeviationPct} %. Самое калорийное блюдо дня — «${kcal.topDish?.dishName}» (${kcal.topDish?.kcal} ккал).`,
    });

    const incomplete = days.filter((d) => d.incompleteNutrition);
    if (incomplete.length > 0) {
      result.push({
        dayIndex: incomplete[0].dayIndex,
        dishId: null,
        text: `Дни ${incomplete.map((d) => d.dayIndex + 1).join(', ')}: для части блюд нет данных о БЖУ, эти дни в оценке белков, жиров и углеводов не учитывались.`,
      });
    }
    return result;
  }
}

export class UnavailableAiAdvisor implements AiAdvisor {
  async recommend(): Promise<Recommendation[]> {
    throw new AiAdvisorUnavailableError('LLM provider did not respond');
  }
}
