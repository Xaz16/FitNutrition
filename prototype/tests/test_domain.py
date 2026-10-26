import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import unittest
from datetime import date,timedelta
from collections import Counter
from domain import validate_settings,DomainError,generate_plan,nutrition,shopping,calculate_baskets
import sqlite3
from catalog import seed
from server import catalog

class DomainTests(unittest.TestCase):
 def setUp(self):
  db=sqlite3.connect(':memory:');db.row_factory=sqlite3.Row;db.executescript((Path(__file__).resolve().parents[1]/'schema.sql').read_text());seed(db)
  self.ingredients,self.recipes=catalog(db);db.close()
  self.s=validate_settings({'age':30,'height':180,'weight':80,'activity':1.55,'goal':'lose','days':7,'meals':3,'budget':3500})
 def test_calorie_acceptance_example(self):self.assertEqual(self.s['target'],{'kcal':2345,'protein':176,'fat':78,'carbs':235})
 def test_reject_invalid_period_and_nan(self):
  for field,value in [('days',6),('days',32),('days',7.5),('budget',0),('weight',float('nan'))]:
   with self.subTest(field=field,value=value),self.assertRaises(DomainError):validate_settings({field:value})
 def test_seven_days_three_meals_and_calories(self):
  items=generate_plan(self.s,self.recipes,self.ingredients);self.assertEqual(len(items),21)
  for day in range(7):
   kcal=sum(nutrition(self.recipes[i['recipe_id']],self.ingredients,i['scale'])['kcal'] for i in items if i['day']==day)
   self.assertLess(abs(kcal-2345),1)
 def test_long_plan_five_meals_and_repeat_limits(self):
  self.s.update(days=31,meals=5);items=generate_plan(self.s,self.recipes,self.ingredients);self.assertEqual(len(items),155)
  counts=Counter(((date.fromisoformat(self.s['start_date'])+timedelta(days=i['day'])).isocalendar()[:2],i['recipe_id']) for i in items)
  self.assertLessEqual(max(counts.values()),2)
 def test_allergens_never_relaxed(self):
  self.s['allergens']=['арахис','орехи'];items=generate_plan(self.s,self.recipes,self.ingredients)
  for item in items:
   for ing in self.recipes[item['recipe_id']]['ingredients']:self.assertFalse(set(self.ingredients[ing]['allergens'])&set(self.s['allergens']))
 def test_no_silent_success_for_empty_catalog(self):
  self.s['minutes']=5
  with self.assertRaises(DomainError):generate_plan(self.s,self.recipes,self.ingredients)
 def test_pantry_and_package_math(self):
  recipes={'r':{'ingredients':{'rice':700}}};items=[{'recipe_id':'r','scale':1}]
  lines=shopping(items,recipes,self.ingredients,{'rice':{'amount':100}});self.assertEqual(lines[0]['needed'],600)
  offers=[{'id':'one','store_id':'s','ingredient_id':'rice','available':True,'pack_size':500,'price_kopecks':10000,'updated_at':'2026-10-25'}]
  result=calculate_baskets(lines,[{'id':'s','name':'Test'}],offers,150)['baskets'][0]
  self.assertEqual(result['total_kopecks'],20000);self.assertEqual(result['positions'][0]['packs'],2);self.assertEqual(result['positions'][0]['leftover'],400);self.assertEqual(result['over_budget_kopecks'],5000)
 def test_missing_price_is_not_zero_and_never_wins(self):
  lines=[{'id':'rice','needed':700,'name':'Рис'}]
  offers=[{'id':'x','ingredient_id':'rice','store_id':'full','available':True,'pack_size':500,'price_kopecks':10000,'updated_at':'2026-10-25'}]
  result=calculate_baskets(lines,[{'id':'empty','name':'Empty'},{'id':'full','name':'Full'}],offers,1000)
  self.assertEqual(result['recommended'],'full');self.assertFalse(result['baskets'][1]['complete'])
 def test_saving_compares_next_full_store(self):
  lines=[{'id':'rice','needed':500}];stores=[{'id':str(i)} for i in range(3)]
  offers=[{'id':str(i),'ingredient_id':'rice','store_id':str(i),'available':True,'pack_size':500,'price_kopecks':v,'updated_at':'2026-10-25'} for i,v in enumerate([125000,118000,121000])]
  self.assertEqual(calculate_baskets(lines,stores,offers,1000)['saving_kopecks'],3000)
if __name__=='__main__':unittest.main(verbosity=2)
