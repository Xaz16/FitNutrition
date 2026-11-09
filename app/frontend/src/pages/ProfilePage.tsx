import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { useProfile, useSaveProfile } from '../api/hooks';
import type { Profile } from '../api/types';
import { emptyMember, MemberFields, toMemberInput, type MemberDraft } from '../components/MemberFields';
import { ErrorNotice, Field, Loading, Notice, NumberInput, fieldError, hasFieldErrors } from '../components/ui';
import { useSession } from '../session';
import { formatNumber } from '../format';

interface SettingsDraft {
  mealsPerDay: number;
  repeatLimitPerWeek: number;
  monthlyBudgetRub: number | '';
}

function draftsFrom(profile: Profile | null | undefined): { member: MemberDraft; settings: SettingsDraft } {
  const owner = profile?.members.find((m) => m.isOwner);
  return {
    member: owner
      ? {
          name: owner.name,
          sex: owner.sex,
          age: owner.age,
          heightCm: owner.heightCm,
          weightKg: owner.weightKg,
          activityFactor: owner.activityFactor,
          goal: owner.goal,
          allergens: owner.allergens,
          excludedIngredientIds: owner.excludedIngredientIds,
        }
      : emptyMember,
    settings: profile
      ? { mealsPerDay: profile.mealsPerDay, repeatLimitPerWeek: profile.repeatLimitPerWeek, monthlyBudgetRub: profile.monthlyBudgetRub }
      : { mealsPerDay: 3, repeatLimitPerWeek: 2, monthlyBudgetRub: '' },
  };
}

export function ProfilePage() {
  const profile = useProfile();
  if (profile.isPending) return <Loading />;
  if (profile.isError) return <ErrorNotice error={profile.error} />;
  return <ProfileForm profile={profile.data} />;
}

function ProfileForm({ profile }: { profile: Profile | null }) {
  const navigate = useNavigate();
  const { user, markProfileFilled } = useSession();
  const save = useSaveProfile();
  const initial = draftsFrom(profile);
  const [member, setMember] = useState(initial.member);
  const [settings, setSettings] = useState(initial.settings);
  const isOnboarding = !user?.hasProfile;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate(
      {
        ...toMemberInput(member),
        ...settings,
        monthlyBudgetRub: settings.monthlyBudgetRub === '' ? NaN : settings.monthlyBudgetRub,
      },
      {
        onSuccess: () => {
          if (isOnboarding) {
            markProfileFilled();
            navigate('/plans/new');
          }
        },
      },
    );
  };

  const owner = save.data?.members.find((m) => m.isOwner) ?? profile?.members.find((m) => m.isOwner);
  return (
    <form className="stack" onSubmit={submit} noValidate>
      <header className="page__header">
        <h1>{isOnboarding ? 'Расскажите о себе' : 'Профиль'}</h1>
        {isOnboarding && <p className="muted">По этим данным рассчитаем норму калорий и БЖУ и исключим неподходящие блюда.</p>}
      </header>
      <section className="card stack">
        <h2>Мои параметры</h2>
        <MemberFields value={member} onChange={setMember} error={save.error} />
      </section>
      <section className="card stack">
        <h2>Настройки рациона</h2>
        <div className="grid grid--3">
          <Field label="Приёмов пищи в день" error={fieldError(save.error, 'mealsPerDay')}>
            <select value={settings.mealsPerDay} onChange={(e) => setSettings({ ...settings, mealsPerDay: Number(e.target.value) })}>
              {[3, 4, 5].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </Field>
          <Field label="Повторов блюда в неделю" error={fieldError(save.error, 'repeatLimitPerWeek')}>
            <select
              value={settings.repeatLimitPerWeek}
              onChange={(e) => setSettings({ ...settings, repeatLimitPerWeek: Number(e.target.value) })}
            >
              {[1, 2, 3, 4].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </Field>
          <Field label="Бюджет на месяц, ₽" error={fieldError(save.error, 'monthlyBudgetRub')}>
            <NumberInput value={settings.monthlyBudgetRub} onChange={(v) => setSettings({ ...settings, monthlyBudgetRub: v })} min={1} />
          </Field>
        </div>
      </section>
      {owner && (
        <Notice tone="ok">
          Ваша норма: <b>{formatNumber(owner.norm.kcal)} ккал</b> · Б {owner.norm.proteinG} г · Ж {owner.norm.fatG} г · У{' '}
          {owner.norm.carbsG} г
        </Notice>
      )}
      {save.isError &&
        (hasFieldErrors(save.error) ? <Notice tone="error">Проверьте поля, отмеченные красным</Notice> : <ErrorNotice error={save.error} />)}
      {save.isSuccess && !isOnboarding && <Notice tone="ok">Профиль сохранён</Notice>}
      <div className="actions">
        <button type="submit" className="btn btn--primary" disabled={save.isPending}>
          {isOnboarding ? 'Сохранить и составить рацион' : 'Сохранить'}
        </button>
      </div>
    </form>
  );
}
