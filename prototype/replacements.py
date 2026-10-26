"""Calorie-safe candidates and full-plan price previews, without database writes."""
from datetime import date,timedelta
from collections import Counter
import math
from domain import DomainError,allowed,nutrition,shopping,calculate_baskets

def best_total(result):
 return next((b['total_kopecks'] for b in result['baskets'] if b['id']==result['recommended']),None)

def meal_cost(recipe,scale,offers,store_id):
 if not store_id:return None
 total=0
 for ident,amount in recipe['ingredients'].items():
  choices=[o for o in offers if o['store_id']==store_id and o['ingredient_id']==ident and o['available'] and o['pack_size']>0]
  if not choices:return None
  offer=min(choices,key=lambda o:o['price_kopecks']/o['pack_size'])
  total+=amount*scale/offer['pack_size']*offer['price_kopecks']
 return math.floor(total+.5)

def replacement_candidates(items,item_id,settings,recipes,ingredients):
 item=next((i for i in items if i['id']==item_id),None)
 if not item:raise DomainError('Позиция не найдена')
 original=recipes[item['recipe_id']];energy=nutrition(original,ingredients,item['scale'])['kcal']
 start=date.fromisoformat(settings['start_date']);week=lambda d:(start+timedelta(days=d)).isocalendar()[:2]
 counts=Counter(i['recipe_id'] for i in items if i['id']!=item_id and week(i['day'])==week(item['day']))
 result=[]
 for recipe in recipes.values():
  if recipe['id']==original['id'] or recipe['meal']!=original['meal'] or not allowed(recipe,settings,ingredients):continue
  if counts[recipe['id']]>=settings['repeat']:continue
  # Compare equal-size base portions before adjustment, not an arbitrary calorie match.
  comparable=nutrition(recipe,ingredients,item['scale'])['kcal']
  if abs(comparable-energy)>energy*.15+1e-8:continue
  base=nutrition(recipe,ingredients)['kcal']
  if base<=0:continue
  scale=energy/base
  result.append({**recipe,'scale':scale,'planned_nutrition':nutrition(recipe,ingredients,scale)})
 return result

def preview_replacements(items,item_id,settings,recipes,ingredients,pantry,stores,offers):
 before=calculate_baskets(shopping(items,recipes,ingredients,pantry),stores,offers,settings['budget']);baseline=best_total(before)
 result=[]
 for recipe in replacement_candidates(items,item_id,settings,recipes,ingredients):
  changed=[{**i,'recipe_id':recipe['id'],'scale':recipe['scale']} if i['id']==item_id else dict(i) for i in items]
  after=calculate_baskets(shopping(changed,recipes,ingredients,pantry),stores,offers,settings['budget']);total=best_total(after)
  result.append({**recipe,'cart_total_kopecks':total,'cart_delta_kopecks':total-baseline if baseline is not None and total is not None else None,'recommended_store':after['recommended']})
 result.sort(key=lambda r:(r['cart_total_kopecks'] is None,r['cart_total_kopecks'] or 0,r['name']))
 return {'alternatives':result,'baseline_cart_kopecks':baseline,'baseline_store':before['recommended']}
