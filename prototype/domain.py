"""Pure domain functions; monetary calculations use integer kopecks."""
import math
from datetime import date,timedelta
from collections import Counter

class DomainError(ValueError):
 def __init__(self,message,fields=None):super().__init__(message);self.fields=fields or {}

def validate_settings(data):
 result={};errors={}
 for key,lo,hi,default in [('age',18,100,30),('height',100,250,180),('weight',30,300,80),('days',7,31,7),('budget',1,1000000,3500),('minutes',5,180,30),('meals',3,5,3),('repeat',1,7,2)]:
  try:
   v=float(data.get(key,default))
   if not math.isfinite(v) or not lo<=v<=hi or (key in ('age','days','meals','minutes','repeat') and not v.is_integer()):raise ValueError()
   result[key]=int(v) if key not in ('weight','height','budget') else v
  except (ValueError,TypeError):errors[key]=f'Введите число от {lo} до {hi}'
 result['sex']=data.get('sex','male');result['goal']=data.get('goal','lose')
 if result['sex'] not in ('male','female'):errors['sex']='Выберите значение'
 if result['goal'] not in ('lose','maintain','gain'):errors['goal']='Выберите цель'
 try:
  result['activity']=float(data.get('activity',1.55))
  if result['activity'] not in (1.2,1.375,1.55,1.725):raise ValueError()
 except (TypeError,ValueError):errors['activity']='Выберите активность'
 try:result['start_date']=date.fromisoformat(data.get('start_date',date.today().isoformat())).isoformat()
 except (TypeError,ValueError):errors['start_date']='Укажите дату'
 for key in ('allergens','excluded'):
  value=data.get(key,[])
  if not isinstance(value,list) or any(not isinstance(v,str) for v in value) or len(value)>100:errors[key]='Ожидается список значений'
  result[key]=value
 if errors:raise DomainError('Проверьте настройки',errors)
 base=10*result['weight']+6.25*result['height']-5*result['age']+(5 if result['sex']=='male' else -161)
 kcal=round(base*result['activity']*{'lose':.85,'maintain':1,'gain':1.15}[result['goal']])
 # Use the same round-half-up rule as the interface and the LR1 examples.
 result['target']={'kcal':kcal,'protein':math.floor(kcal*.3/4+.5),'fat':math.floor(kcal*.3/9+.5),'carbs':math.floor(kcal*.4/4+.5)}
 result['city']='Ижевск'
 return result

def nutrition(recipe,ingredients,scale=1):
 out={k:0 for k in ('kcal','protein','fat','carbs')}
 for ident,amount in recipe['ingredients'].items():
  ing=ingredients[ident];factor=amount*scale/(1 if ing['unit']=='шт' else 100)
  for k in out:out[k]+=ing[k]*factor
 return {k:round(v,1) for k,v in out.items()}

def allowed(recipe,settings,ingredients):
 prefs=set(settings.get('preferences',[]))
 if 'vegetarian' in prefs and set(recipe['ingredients'])&{'chicken','turkey','fish'}:return False
 if 'no_fish' in prefs and 'fish' in recipe['ingredients']:return False
 if 'no_milk' in prefs and any('молоко' in ingredients[i]['allergens'] for i in recipe['ingredients']):return False
 return (recipe['minutes']<=settings['minutes'] and not set(recipe['ingredients'])&set(settings['excluded'])
  and all(not set(ingredients[i]['allergens'])&set(settings['allergens']) for i in recipe['ingredients']))

def generate_plan(settings,recipes,ingredients):
 patterns={3:[('breakfast',.30),('lunch',.40),('dinner',.30)],4:[('breakfast',.25),('lunch',.35),('snack',.15),('dinner',.25)],5:[('breakfast',.25),('snack',.1),('lunch',.30),('snack',.1),('dinner',.25)]}
 items=[];used=Counter();missing=[]
 start=date.fromisoformat(settings['start_date'])
 for day in range(settings['days']):
  week=(start+timedelta(days=day)).isocalendar()[:2]
  for slot,(meal,fraction) in enumerate(patterns[settings['meals']]):
   pool=[r for r in recipes.values() if r['meal']==meal and allowed(r,settings,ingredients) and used[(week,r['id'])]<settings['repeat']]
   if not pool:missing.append({'day':day,'slot':slot,'meal':meal});continue
   pool.sort(key=lambda r:(used[(week,r['id'])],r['id']))
   recipe=pool[day%len(pool)];used[(week,recipe['id'])]+=1
   base=nutrition(recipe,ingredients)['kcal']
   items.append({'day':day,'slot':slot,'recipe_id':recipe['id'],'scale':settings['target']['kcal']*fraction/base})
 if missing:raise DomainError('Недостаточно подходящих блюд. Увеличьте время готовки или лимит повторов; исключения останутся в силе.',{'catalog':missing})
 return items

def shopping(items,recipes,ingredients,pantry):
 totals=Counter()
 for item in items:
  for ident,amount in recipes[item['recipe_id']]['ingredients'].items():totals[ident]+=amount*item['scale']
 result=[]
 for ident,amount in sorted(totals.items(),key=lambda t:(ingredients[t[0]]['category'],ingredients[t[0]]['name'])):
  ing=ingredients[ident];stock=pantry.get(ident,{});at_home=stock.get('amount',0);purchased=bool(stock.get('purchased',False))
  needed=0 if purchased else max(0,amount-at_home)
  result.append({'id':ident,'name':ing['name'],'unit':ing['unit'],'category':ing['category'],'required':round(amount,3),'at_home':at_home,'needed':round(needed,3),'purchased':purchased})
 return result

def calculate_baskets(lines,stores,offers,budget):
 baskets=[]
 for store in stores:
  positions=[];missing=[];total=0;dates=[]
  for line in lines:
   if line['needed']<=0:continue
   choices=[o for o in offers if o['store_id']==store['id'] and o['ingredient_id']==line['id'] and o['available'] and o['pack_size']>0]
   if not choices:missing.append(line['id']);continue
   o=min(choices,key=lambda o:math.ceil(line['needed']/o['pack_size'])*o['price_kopecks'])
   count=math.ceil(line['needed']/o['pack_size']);cost=count*o['price_kopecks'];total+=cost;dates.append(o['updated_at'])
   positions.append({**line,'offer_id':o['id'],'packs':count,'pack_size':o['pack_size'],'cost_kopecks':cost,'price_kopecks':o['price_kopecks'],'leftover':round(count*o['pack_size']-line['needed'],3)})
  baskets.append({**store,'total_kopecks':total,'complete':not missing,'missing':missing,'positions':positions,'oldest_price':min(dates) if dates else None,'over_budget_kopecks':max(0,total-round(budget*100))})
 baskets.sort(key=lambda b:(not b['complete'],b['total_kopecks']))
 full=[b for b in baskets if b['complete']]
 return {'baskets':baskets,'recommended':full[0]['id'] if full else None,'saving_kopecks':full[1]['total_kopecks']-full[0]['total_kopecks'] if len(full)>1 else 0}
