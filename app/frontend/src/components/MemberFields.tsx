import { useAllergens, useIngredients } from '../api/hooks';
import type { Goal, MemberInput, Sex } from '../api/types';
import { ACTIVITY_OPTIONS, GOAL_LABEL } from '../format';
import { Field, NumberInput, fieldError } from './ui';

export type MemberDraft = Omit<MemberInput, 'age' | 'heightCm' | 'weightKg'> & {
  age: number | '';
  heightCm: number | '';
  weightKg: number | '';
};

export const emptyMember: MemberDraft = {
  name: '',
  sex: 'MALE',
  age: '',
  heightCm: '',
  weightKg: '',
  activityFactor: 1.55,
  goal: 'MAINTAIN',
  allergens: [],
  excludedIngredientIds: [],
};

export function toMemberInput(d: MemberDraft): MemberInput {
  return {
    ...d,
    age: d.age === '' ? NaN : d.age,
    heightCm: d.heightCm === '' ? NaN : d.heightCm,
    weightKg: d.weightKg === '' ? NaN : d.weightKg,
  };
}

export function MemberFields({
  value,
  onChange,
  error,
}: {
  value: MemberDraft;
  onChange: (next: MemberDraft) => void;
  error: unknown;
}) {
  const allergens = useAllergens();
  const ingredients = useIngredients();
  const set = <K extends keyof MemberDraft>(key: K, v: MemberDraft[K]) => onChange({ ...value, [key]: v });
  const toggleAllergen = (code: string) =>
    set('allergens', value.allergens.includes(code) ? value.allergens.filter((c) => c !== code) : [...value.allergens, code]);
  const excluded = new Set(value.excludedIngredientIds);

  return (
    <>
      <div className="grid grid--2">
        <Field label="Имя" error={fieldError(error, 'name')}>
          <input value={value.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label="Пол" error={fieldError(error, 'sex')}>
          <div className="segmented">
            {(['MALE', 'FEMALE'] as Sex[]).map((s) => (
              <label key={s} className={`segmented__item${value.sex === s ? ' segmented__item--active' : ''}`}>
                <input type="radio" name="sex" checked={value.sex === s} onChange={() => set('sex', s)} />
                {s === 'MALE' ? 'Мужской' : 'Женский'}
              </label>
            ))}
          </div>
        </Field>
        <Field label="Возраст, лет" error={fieldError(error, 'age')}>
          <NumberInput value={value.age} onChange={(v) => set('age', v)} min={14} max={100} />
        </Field>
        <Field label="Рост, см" error={fieldError(error, 'heightCm')}>
          <NumberInput value={value.heightCm} onChange={(v) => set('heightCm', v)} min={100} max={250} />
        </Field>
        <Field label="Вес, кг" error={fieldError(error, 'weightKg')}>
          <NumberInput value={value.weightKg} onChange={(v) => set('weightKg', v)} min={30} max={300} step={0.1} />
        </Field>
        <Field label="Активность" error={fieldError(error, 'activityFactor')}>
          <select value={value.activityFactor} onChange={(e) => set('activityFactor', Number(e.target.value))}>
            {ACTIVITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Цель" error={fieldError(error, 'goal')}>
        <div className="segmented">
          {(Object.keys(GOAL_LABEL) as Goal[]).map((g) => (
            <label key={g} className={`segmented__item${value.goal === g ? ' segmented__item--active' : ''}`}>
              <input type="radio" name="goal" checked={value.goal === g} onChange={() => set('goal', g)} />
              {GOAL_LABEL[g]}
            </label>
          ))}
        </div>
      </Field>
      <fieldset className="fieldset">
        <legend>Аллергены</legend>
        <div className="chips">
          {allergens.data?.map((a) => (
            <label key={a.code} className={`chip${value.allergens.includes(a.code) ? ' chip--on' : ''}`}>
              <input type="checkbox" checked={value.allergens.includes(a.code)} onChange={() => toggleAllergen(a.code)} />
              {a.name}
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="Не люблю / исключить продукты" error={fieldError(error, 'allergens')}>
        <select
          value=""
          onChange={(e) => e.target.value && set('excludedIngredientIds', [...value.excludedIngredientIds, Number(e.target.value)])}
        >
          <option value="">Добавить продукт…</option>
          {ingredients.data
            ?.filter((i) => !excluded.has(i.id))
            .map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
        </select>
      </Field>
      {value.excludedIngredientIds.length > 0 && (
        <div className="chips">
          {value.excludedIngredientIds.map((id) => (
            <button
              key={id}
              type="button"
              className="chip chip--on"
              onClick={() => set('excludedIngredientIds', value.excludedIngredientIds.filter((x) => x !== id))}
              title="Убрать из исключений"
            >
              {ingredients.data?.find((i) => i.id === id)?.name ?? id} ✕
            </button>
          ))}
        </div>
      )}
    </>
  );
}
