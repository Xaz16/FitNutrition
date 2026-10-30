'use strict';
let familySelection=null,familySelectionIdentity=null;
function selectedFamily(){
 if(familySelectionIdentity!==session.email){familySelectionIdentity=session.email;familySelection=null;}
 if(familySelection===null)familySelection=[...(state.plan?.settings.member_ids||[])];
 const available=new Set((state.family_profiles||[]).map(p=>p.id));familySelection=familySelection.filter(id=>available.has(id));return familySelection;
}
function familySummary(){
 const people=state.plan?.settings.participants||[];if(people.length<2)return '';
 return `<section class="note family-summary" aria-label="Участники плана"><strong>План на ${people.length} человек · ${num(state.plan.settings.target.kcal)} ккал в день на всех</strong><div>${people.map(p=>`<span>${esc(p.name)}${p.goal?' · '+goalLabels[p.goal]:''}: ${num(p.target.kcal)} ккал/день</span>`).join('')}</div><small>Общие блюда, индивидуальные порции. Корзина рассчитана на всех участников.</small></section>`;
}
function renderFamilySelection(){
 const el=document.querySelector('#family-selection');if(!el)return;
 const ids=selectedFamily(),people=(state.family_profiles||[]).filter(p=>ids.includes(p.id));
 el.innerHTML=`<div class="summary-block-head"><h3>Для кого составляем план</h3><button type="button" class="secondary" id="add-family-member">Добавить члена семьи</button></div><div class="family-chips"><span>${esc(state.profile.name)} · вы</span>${people.map(p=>`<span>${esc(p.name)}<button type="button" data-remove-member="${p.id}" aria-label="Убрать ${esc(p.name)} из плана">×</button></span>`).join('')}</div><p class="small muted">Бюджет плана относится ко всей семье. Аллергии и исключения участников учитываются вместе.</p>`;
 document.querySelector('#add-family-member').onclick=openFamilyPicker;
 el.querySelectorAll('[data-remove-member]').forEach(b=>b.onclick=()=>{familySelection=ids.filter(id=>id!==b.dataset.removeMember);renderFamilySelection();});
}
function familyDialog(html){if(dialog.open)dialog.close();dialog.onclose=null;dialog.innerHTML=html;dialog.showModal();}
function openFamilyPicker(){
 const ids=selectedFamily(),people=state.family_profiles||[];
 familyDialog(`<div class="dialog-head"><h2 id="recipe-title">Кого добавить в план</h2><button class="secondary" id="close-family" aria-label="Закрыть">×</button></div><p class="small muted">Ваш профиль уже включён. Выберите сохранённые профили или создайте новый.</p><div class="family-picker">${people.length?people.map(p=>`<label class="choice-card"><input type="checkbox" data-family-id="${p.id}" ${ids.includes(p.id)?'checked':''}><span><strong>${esc(p.name)}</strong><small>${p.age} лет · ${goalLabels[p.goal]}</small></span></label>`).join(''):'<p class="note">Пока нет семейных профилей. Создайте первый, он сохранится для следующих планов.</p>'}</div><div class="button-row"><button id="apply-family">Добавить выбранных</button><button class="secondary" id="new-family">Создать новый профиль</button></div>`);
 document.querySelector('#close-family').onclick=()=>dialog.close();document.querySelector('#new-family').onclick=renderFamilyForm;
 document.querySelector('#apply-family').onclick=()=>{familySelection=[...dialog.querySelectorAll('[data-family-id]:checked')].map(i=>i.dataset.familyId);dialog.close();renderFamilySelection();};
}
function renderFamilyForm(){
 const field=(key,label,type,attrs='')=>`<div class="field"><label for="family-${key}">${label}</label><input name="${key}" id="family-${key}" type="${type}" ${attrs} required></div>`;
 familyDialog(`<form id="family-form"><div class="dialog-head"><h2 id="recipe-title">Новый член семьи</h2><button type="button" class="secondary" id="cancel-family" aria-label="Закрыть">×</button></div><p class="small muted">Автоматический план доступен с 18 лет. У каждого участника своя цель и порция.</p><div class="error" id="family-error" role="alert"></div><div class="form-grid">${field('name','Имя','text','maxlength="60"')}${field('birth_date','Дата рождения','date',`max="${new Date().toLocaleDateString('en-CA')}"`)}<div class="field"><label for="family-sex">Пол</label><select name="sex" id="family-sex"><option value="female">Женский</option><option value="male">Мужской</option></select></div>${field('weight','Вес, кг','number','min="40" max="200" step="0.5"')}${field('height','Рост, см','number','min="140" max="220" step="1"')}<div class="field"><label for="family-activity">Активность</label><select name="activity" id="family-activity">${activityChoices.map(([v,t])=>`<option value="${v}">${t}</option>`).join('')}</select></div><div class="field"><label for="family-goal">Цель</label><select name="goal" id="family-goal">${Object.entries(goalLabels).map(([v,t])=>`<option value="${v}">${t}</option>`).join('')}</select></div></div><fieldset class="choice-field family-restrictions"><legend>Аллергии</legend><div class="check-grid">${state.allergens.map(a=>`<label class="check"><input type="checkbox" name="allergens" value="${esc(a)}">${esc(a)}</label>`).join('')}</div></fieldset><fieldset class="choice-field"><legend>Предпочтения</legend><div class="check-grid">${Object.entries(preferenceLabels).map(([v,t])=>`<label class="check"><input type="checkbox" name="preferences" value="${v}">${t}</label>`).join('')}</div></fieldset><div class="field"><label for="family-other">Другие исключения</label><input id="family-other" name="other_allergies" maxlength="200" placeholder="Точные названия продуктов через запятую"></div><div class="button-row family-actions"><button type="submit">Сохранить и добавить</button><button type="button" class="secondary" id="back-family">Назад</button></div></form>`);
 document.querySelector('#cancel-family').onclick=()=>dialog.close();document.querySelector('#back-family').onclick=openFamilyPicker;
 document.querySelector('#family-form').onsubmit=async e=>{e.preventDefault();const form=new FormData(e.target),data=Object.fromEntries(form);data.allergens=form.getAll('allergens');data.preferences=form.getAll('preferences');const button=e.submitter;button.disabled=true;
  try{const before=new Set((state.family_profiles||[]).map(p=>p.id));state=await api('/family','POST',data);const created=state.family_profiles.find(p=>!before.has(p.id));familySelection=[...selectedFamily(),created.id];dialog.close();renderFamilySelection();toast('Профиль добавлен в план');}
  catch(error){document.querySelector('#family-error').textContent=Object.values(error.fields||{}).join('. ')||error.message;button.disabled=false;}
 };
}
