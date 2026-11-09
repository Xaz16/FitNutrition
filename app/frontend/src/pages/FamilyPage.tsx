import { useState, type FormEvent } from 'react';
import { useAllergens, useMemberMutations, useProfile } from '../api/hooks';
import type { Member } from '../api/types';
import { emptyMember, MemberFields, toMemberInput, type MemberDraft } from '../components/MemberFields';
import { ErrorNotice, Loading, Modal, Notice, hasFieldErrors } from '../components/ui';
import { formatNumber } from '../format';

const MAX_PROFILES = 6;

export function FamilyPage() {
  const profile = useProfile();
  const allergens = useAllergens();
  const { add, update, remove } = useMemberMutations();
  const [editing, setEditing] = useState<{ id: string | null; draft: MemberDraft } | null>(null);

  if (profile.isPending) return <Loading />;
  if (profile.isError || !profile.data) return <ErrorNotice error={profile.error} />;

  const members = profile.data.members;
  const allergenName = (code: string) => allergens.data?.find((a) => a.code === code)?.name ?? code;
  const mutation = editing?.id ? update : add;

  const open = (member: Member | null) => {
    add.reset();
    update.reset();
    setEditing({ id: member?.id ?? null, draft: member ? { ...member } : emptyMember });
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const input = toMemberInput(editing.draft);
    const onSuccess = () => setEditing(null);
    if (editing.id) {
      update.mutate({ id: editing.id, input }, { onSuccess });
    } else {
      add.mutate(input, { onSuccess });
    }
  };

  return (
    <div className="stack">
      <header className="page__header page__header--row">
        <div>
          <h1>Семья</h1>
          <p className="muted">
            {members.length} из {MAX_PROFILES} профилей · общая норма <b>{formatNumber(profile.data.householdNorm.kcal)} ккал</b> в день
          </p>
        </div>
        <button type="button" className="btn btn--primary" onClick={() => open(null)} disabled={members.length >= MAX_PROFILES}>
          + Добавить
        </button>
      </header>
      {members.length >= MAX_PROFILES && <Notice tone="warn">Добавлено максимальное число профилей.</Notice>}
      <ul className="member-list">
        {members.map((m) => (
          <li key={m.id} className="card member">
            <div>
              <h3>
                {m.name} {m.isOwner && <span className="badge">вы</span>}
              </h3>
              <p className="muted">
                {m.sex === 'MALE' ? 'М' : 'Ж'}, {m.age} лет, {m.heightCm} см, {formatNumber(m.weightKg)} кг
              </p>
              <p className="small">{m.allergens.length ? `Аллергии: ${m.allergens.map(allergenName).join(', ')}` : 'Без аллергий'}</p>
            </div>
            <div className="member__side">
              <b>{formatNumber(m.norm.kcal)} ккал</b>
              {!m.isOwner && (
                <div className="actions">
                  <button type="button" className="btn btn--ghost" onClick={() => open(m)}>
                    Изменить
                  </button>
                  <button type="button" className="btn btn--ghost btn--danger" onClick={() => remove.mutate(m.id)}>
                    Удалить
                  </button>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
      <p className="muted small">Аллергии и исключения любого члена семьи исключают блюдо из общего рациона, порции считаются на всех.</p>
      <ErrorNotice error={remove.error} />
      {editing && (
        <Modal title={editing.id ? 'Изменить профиль' : 'Новый член семьи'} onClose={() => setEditing(null)}>
          <form className="stack" onSubmit={submit} noValidate>
            <MemberFields value={editing.draft} onChange={(draft) => setEditing({ ...editing, draft })} error={mutation.error} />
            {mutation.isError && !hasFieldErrors(mutation.error) && <ErrorNotice error={mutation.error} />}
            <div className="actions">
              <button type="submit" className="btn btn--primary" disabled={mutation.isPending}>
                Сохранить
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => setEditing(null)}>
                Отмена
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
