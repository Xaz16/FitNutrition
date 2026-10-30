"""Saved user profile, separate from the settings snapshot of a particular plan."""
import math
import hashlib,json
from datetime import date
from domain import DomainError,validate_settings
from catalog import ALLERGENS

PREFERENCES={'vegetarian','no_fish','no_milk'}

def age_on(birth_date,today=None):
 today=today or date.today()
 if not isinstance(birth_date,str) or len(birth_date)!=10:raise ValueError('Некорректная дата')
 born=date.fromisoformat(birth_date)
 if born>today:raise ValueError('Дата в будущем')
 return today.year-born.year-((today.month,today.day)<(born.month,born.day))

def current_profile(profile):
 if not profile:return profile
 return {**profile,'age':age_on(profile['birth_date'])} if profile.get('birth_date') else dict(profile)

def profile_fingerprint(profile):
 profile=current_profile(profile)
 relevant={k:v for k,v in profile.items() if k not in ('name','completed')}
 return hashlib.sha256(json.dumps(relevant,sort_keys=True,ensure_ascii=False).encode()).hexdigest()

def validate_profile(data):
 result={};errors={}
 data=dict(data)
 if data.get('birth_date') not in (None,''):
  try:
   data['age']=age_on(data['birth_date'])
   if not 14<=data['age']<=90:raise ValueError()
   result['birth_date']=data['birth_date']
  except (TypeError,ValueError):errors['birth_date']='Укажите дату рождения: возраст от 14 до 90 лет'
 for key,lo,hi,step in [('age',14,90,1),('weight',40,200,.5),('height',140,220,1)]:
  try:
   value=float(data[key])
   if isinstance(data[key],bool) or not math.isfinite(value) or not lo<=value<=hi or abs(value/step-round(value/step))>1e-7:raise ValueError()
   result[key]=value if key=='weight' else int(value)
  except (KeyError,ValueError,TypeError):errors[key]=f'Укажите значение от {lo} до {hi}'
 result['sex']=data.get('sex');result['goal']=data.get('goal')
 if result['sex'] not in ('male','female'):errors['sex']='Выберите пол'
 if result['goal'] not in ('lose','maintain','gain'):errors['goal']='Выберите цель'
 try:
  result['activity']=float(data['activity'])
  if result['activity'] not in (1.2,1.375,1.55,1.725):raise ValueError()
 except (KeyError,ValueError,TypeError):errors['activity']='Выберите активность'
 name=data.get('name','')
 if not isinstance(name,str) or not 1<=len(name.strip())<=60:errors['name']='Укажите имя до 60 символов'
 else:result['name']=name.strip()
 for key,allowed in [('allergens',set(ALLERGENS)),('preferences',PREFERENCES)]:
  value=data.get(key,[])
  if not isinstance(value,list) or any(not isinstance(v,str) or v not in allowed for v in value):errors[key]='Проверьте выбранные значения'
  else:result[key]=list(dict.fromkeys(value))
 other=data.get('other_allergies','')
 if not isinstance(other,str) or len(other)>200:errors['other_allergies']='Не более 200 символов'
 else:result['other_allergies']=other.strip()
 result['budget_week']=None
 if data.get('budget_week') not in (None,''):
  try:
   budget=float(data['budget_week'])
   if not math.isfinite(budget) or not 500<=budget<=10000 or (budget-500)%100:raise ValueError()
   result['budget_week']=int(budget)
  except (TypeError,ValueError):errors['budget_week']='Бюджет от 500 до 10000 с шагом 100'
 if errors:raise DomainError('Проверьте профиль',errors)
 result['completed']=True
 return result

def plan_settings(profile,options,ingredients):
 profile=current_profile(profile)
 if not profile or not profile.get('completed'):raise DomainError('Сначала сохраните профиль',{'profile':'Профиль не заполнен'})
 if profile['age']<18:raise DomainError('Профиль сохранён. Автоматический рацион пока доступен с 18 лет.',{'age':'Расчёт для взрослых'})
 # Account-level allergies cannot be disabled by sending a different plan payload.
 data={**profile,**{k:v for k,v in options.items() if k in ('days','meals','minutes','repeat','start_date','budget','preferences')}}
 if 'budget' not in options:data['budget']=profile.get('budget_week') or 3500
 prefs=data.get('preferences',[])
 if not isinstance(prefs,list) or any(not isinstance(v,str) or v not in PREFERENCES for v in prefs):raise DomainError('Проверьте предпочтения')
 excluded=[]
 if profile.get('other_allergies'):
  names={i['name'].casefold():ident for ident,i in ingredients.items()}
  for word in profile['other_allergies'].split(','):
   word=word.strip().casefold()
   if not word:continue
   if word not in names:raise DomainError('Уточните другие аллергии в профиле: каталог не распознал '+word,{'other_allergies':'Нужно точное название продукта из каталога'})
   excluded.append(names[word])
 data['excluded']=excluded
 settings=validate_settings(data);settings['preferences']=list(dict.fromkeys(prefs))
 settings['profile_fingerprint']=profile_fingerprint(profile)
 if 'budget' not in options:settings['budget']=round((profile.get('budget_week') or 3500)*settings['days']/7,2)
 return settings
