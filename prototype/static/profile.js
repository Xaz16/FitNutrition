'use strict';
const navigationItems=[['dashboard','⌂','Главная'],['profile','◌','Мой профиль'],['settings','◌','Настройки плана'],['result','▤','Результат плана'],['menu','▦','Моё меню'],['shopping','≡','Список покупок'],['baskets','◇','Сравнить корзины']];
function sidebarMarkup(){return `<aside class="sidebar">${brand()}<button class="secondary mobile-navigation" id="toggle-navigation" aria-expanded="false" aria-controls="global-navigation">Меню</button><nav id="global-navigation" aria-label="Основная навигация">${navigationItems.map(([id,icon,label])=>`<button data-page="${id}" class="${page===id||page==='onboarding'&&id==='profile'?'active':''}" ${page===id||page==='onboarding'&&id==='profile'?'aria-current="page"':''} ${!profileIsSaved()&&id!=='profile'?'disabled title="Сначала сохраните профиль"':''}><span class="nav-icon" aria-hidden="true">${icon}</span>${label}</button>`).join('')}</nav><div class="side-bottom"><span>${esc(session?.email?.startsWith('demo-')?'Демонстрационный аккаунт':session?.email)}</span><button id="logout">Выйти из аккаунта</button></div></aside>`;}
function bindGlobalNavigation(){
 app.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>navigate(b.dataset.page));
 const toggle=document.querySelector('#toggle-navigation');if(toggle)toggle.onclick=()=>{const opened=toggle.closest('.sidebar').classList.toggle('nav-open');toggle.setAttribute('aria-expanded',String(opened));toggle.textContent=opened?'Закрыть меню':'Меню';};
 const logout=document.querySelector('#logout');if(logout)logout.onclick=e=>busy(e.target,async()=>{await api('/auth/logout','POST',{});state=null;profileDraft=null;profileIdentity=null;history.replaceState(null,'',location.pathname);renderAuth();});
}
function mountGlobalLayout(){
 if(!app.querySelector('.shell')){
  const shell=document.createElement('div');shell.className='shell global-shell';
  const content=document.createElement('div');content.className='global-content';
  while(app.firstChild)content.append(app.firstChild);
  shell.innerHTML=sidebarMarkup();shell.append(content);app.append(shell);
 }
 bindGlobalNavigation();
}
function ageFromBirth(value){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return null;
 const [y,m,d]=value.split('-').map(Number),born=new Date(y,m-1,d),today=new Date();
 if(born.getFullYear()!==y||born.getMonth()!==m-1||born.getDate()!==d||born>today)return null;
 return today.getFullYear()-y-(today.getMonth()<m-1||today.getMonth()===m-1&&today.getDate()<d?1:0);
}
function birthField(value){return `<div class="field"><label for="profile-birth-date">Дата рождения</label><input id="profile-birth-date" type="date" autocomplete="bday" value="${esc(value||'')}" max="${new Date().toLocaleDateString('en-CA')}" required><p class="small muted" id="birth-age" aria-live="polite">${ageFromBirth(value)===null?'Возраст рассчитается автоматически':'Возраст: '+ageFromBirth(value)+' лет'}</p></div>`;}
const profileFields=[['name','Имя'],['sex','Пол'],['birth_date','Дата рождения'],['weight','Вес'],['height','Рост'],['goal','Цель'],['activity','Активность'],['budget_week','Бюджет на неделю'],['allergens','Аллергии'],['preferences','Предпочтения'],['other_allergies','Другие исключения']];
function profileValue(p,key){
 if(key==='birth_date')return p.birth_date?dateLabel(p.birth_date+'T12:00:00')+' · '+p.age+' лет':'Не указана · сохранённый возраст '+p.age+' лет';
 if(key==='sex')return p.sex==='male'?'Мужской':'Женский';
 if(key==='goal')return goalLabels[p.goal];
 if(key==='activity')return activityChoices.find(a=>a[0]===Number(p.activity))?.[1];
 if(key==='weight')return num(p.weight)+' кг';if(key==='height')return p.height+' см';
 if(key==='budget_week')return p.budget_week==null?'Не указан':money(p.budget_week*100);
 if(key==='allergens')return p.allergens?.join(', ')||'Не указаны';
 if(key==='preferences')return p.preferences?.map(v=>preferenceLabels[v]).join(', ')||'Без ограничений';
 return p[key]||'Не указаны';
}
function renderProfile(){
 const p=state.profile;app.innerHTML=`${flowHeader()}<main class="profile-page"><div class="eyebrow">ЛИЧНЫЕ ДАННЫЕ</div><h1>Мой профиль</h1><p class="muted">Меняйте параметры по одному. Возраст рассчитывается по дате рождения.</p><div id="page-error" class="error" role="alert"></div>${state.previous_plan_requires_update?'<p class="note amber">Профиль изменён. Составьте меню заново, чтобы учесть новые параметры.</p>':''}<section class="panel profile-card" aria-label="Данные профиля">${profileFields.map(([key,label])=>`<div class="profile-row"><div><span class="muted">${label}</span><strong data-profile-value="${key}">${esc(profileValue(p,key))}</strong></div><button class="secondary" data-edit-field="${key}" aria-label="Изменить: ${label}">Изменить</button></div>`).join('')}</section></main>`;
 bindFlowHeader();app.querySelectorAll('[data-edit-field]').forEach(b=>b.onclick=()=>editProfileField(b.dataset.editField));
}
function editProfileField(key){
 const p=state.profile,label=profileFields.find(f=>f[0]===key)[1];let input='';
 const options={sex:[['male','Мужской'],['female','Женский']],goal:Object.entries(goalLabels),activity:activityChoices.map(a=>[a[0],a[1]+' · '+a[2]])};
 if(key==='birth_date')input=birthField(p.birth_date);
 else if(options[key])input=`<label for="profile-value">${label}</label><select id="profile-value">${options[key].map(([v,text])=>`<option value="${v}" ${String(p[key])===String(v)?'selected':''}>${esc(text)}</option>`).join('')}</select>`;
 else if(['allergens','preferences'].includes(key)){const choices=key==='allergens'?state.allergens.map(a=>[a,a]):Object.entries(preferenceLabels);input=`<fieldset class="choice-field"><legend>${label}</legend><div class="check-grid">${choices.map(([v,text])=>`<label class="check"><input type="checkbox" name="profile-choice" value="${esc(v)}" ${(p[key]||[]).includes(v)?'checked':''}>${esc(text)}</label>`).join('')}</div></fieldset>`;}
 else{const attrs={weight:'type="number" min="40" max="200" step="0.5" required',height:'type="number" min="140" max="220" step="1" required',budget_week:'type="number" min="500" max="10000" step="100"',name:'type="text" maxlength="60" required',other_allergies:'type="text" maxlength="200"'};input=`<label for="profile-value">${label}</label><input id="profile-value" ${attrs[key]} value="${esc(p[key]??'')}">${key==='budget_week'?'<p class="small muted">Оставьте пустым, если бюджет не задан.</p>':''}`;}
 dialog.innerHTML=`<form id="edit-profile-field"><div class="dialog-head"><h2 id="recipe-title">${label}</h2><button type="button" class="secondary" id="cancel-profile-edit" aria-label="Закрыть">×</button></div><div class="error" id="profile-field-error" role="alert"></div><div class="field">${input}</div><p class="small muted">Изменение расчётных параметров потребует составить меню заново.</p><div class="button-row"><button type="submit">Сохранить</button><button type="button" class="secondary" id="cancel-profile-field">Отмена</button></div></form>`;
 dialog.onclose=()=>{if(!dialog.open)document.querySelector(`[data-edit-field="${key}"]`)?.focus();};dialog.showModal();
 for(const id of ['cancel-profile-edit','cancel-profile-field'])document.querySelector('#'+id).onclick=()=>dialog.close();
 if(key==='birth_date')document.querySelector('#profile-birth-date').oninput=e=>{const age=ageFromBirth(e.target.value);document.querySelector('#birth-age').textContent=age===null?'Укажите корректную дату':'Возраст: '+age+' лет';};
 document.querySelector('#edit-profile-field').onsubmit=async e=>{
  e.preventDefault();let value;
  if(key==='birth_date')value=document.querySelector('#profile-birth-date').value;
  else if(['allergens','preferences'].includes(key))value=[...dialog.querySelectorAll('input:checked')].map(i=>i.value);
  else{value=document.querySelector('#profile-value').value;if(['weight','height','activity','budget_week'].includes(key))value=value===''?null:Number(value);}
  const button=e.submitter;button.disabled=true;document.querySelector('#profile-field-error').textContent='';
  try{state=await api('/profile','PATCH',{[key]:value});profileDraft=null;profileIdentity=null;try{localStorage.removeItem(draftKey());}catch{}dialog.close();renderProfile();document.querySelector(`[data-edit-field="${key}"]`)?.focus();toast('Изменения сохранены');}
  catch(error){document.querySelector('#profile-field-error').textContent=error.fields?.[key]||error.message;button.disabled=false;}
 };
}
