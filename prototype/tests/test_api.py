import sys, unittest, tempfile, threading, json, urllib.request, urllib.error, http.cookiejar
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import server

class ApiTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.temp=tempfile.TemporaryDirectory();server.DB_PATH=Path(cls.temp.name)/'test.sqlite3';server.initialize()
  cls.http=server.ThreadingHTTPServer(('127.0.0.1',0),server.Handler);cls.url=f'http://127.0.0.1:{cls.http.server_port}'
  cls.thread=threading.Thread(target=cls.http.serve_forever,daemon=True);cls.thread.start()
 @classmethod
 def tearDownClass(cls):cls.http.shutdown();cls.http.server_close();cls.temp.cleanup()
 def setUp(self):self.client=self.new_client()
 def new_client(self):return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
 def request(self,path,data=None,method=None,client=None,headers=None):
  req=urllib.request.Request(self.url+'/api'+path,data=json.dumps(data).encode() if data is not None else None,method=method,headers={'Content-Type':'application/json',**(headers or {})})
  try:
   with (client or self.client).open(req) as r:return r.status,json.load(r)
  except urllib.error.HTTPError as e:return e.code,json.load(e)
 def save_profile(self,**changes):
  return self.request('/profile',{'name':'Азамат','age':30,'sex':'male','height':180,'weight':80,'activity':1.55,'goal':'lose',**changes},method='PUT')
 def demo(self):
  self.assertEqual(self.request('/auth/demo',{})[0],200);self.assertEqual(self.save_profile()[0],200)
 def test_birth_date_and_single_field_edit(self):
  self.demo();before=self.request('/state')[1]['profile']
  code,view=self.request('/profile',{'weight':81.5},method='PATCH')
  self.assertEqual(code,200);self.assertEqual(view['profile']['weight'],81.5)
  self.assertEqual({k:v for k,v in view['profile'].items() if k!='weight'},{k:v for k,v in before.items() if k!='weight'})
  code,view=self.request('/profile',{'birth_date':'1996-05-12'},method='PATCH')
  self.assertEqual(code,200);self.assertEqual(view['profile']['age'],server.current_profile({'birth_date':'1996-05-12'})['age'])
  self.assertEqual(view['profile']['birth_date'],'1996-05-12')
  self.assertEqual(self.request('/plan',{})[0],201)
  self.assertEqual(self.request('/profile',{'height':181},method='PATCH')[1]['plan'],None)
  self.assertEqual(self.request('/profile',{'weight':82,'height':182},method='PATCH')[0],422)
  self.assertEqual(self.request('/profile',{'age':20},method='PATCH')[0],422)
  self.assertEqual(self.request('/profile',{'birth_date':'2999-01-01'},method='PATCH')[0],422)
  self.assertEqual(self.request('/profile',{'birth_date':''},method='PATCH')[0],422)
  self.assertEqual(self.request('/state')[1]['profile']['birth_date'],'1996-05-12')
 def family_member(self,**changes):
  from datetime import date
  data={'name':'Участник','birth_date':f'{date.today().year-30}-01-01','sex':'male','height':180,'weight':80,'activity':1.55,'goal':'lose',**changes}
  code,view=self.request('/family',data);self.assertEqual(code,201)
  return view['family_profiles'][-1]['id']
 def test_family_portions_and_combined_shopping(self):
  self.demo();solo=self.request('/plan',{})[1];ident=self.family_member()
  code,view=self.request('/plan',{'member_ids':[ident]});self.assertEqual(code,201)
  self.assertEqual(view['plan']['settings']['target']['kcal'],2*solo['plan']['settings']['target']['kcal'])
  self.assertEqual(view['plan']['settings']['budget'],solo['plan']['settings']['budget'])
  self.assertEqual(len(view['plan']['settings']['participants']),2)
  for a,b in zip(view['plan']['items'],solo['plan']['items']):
   self.assertEqual(a['recipe_id'],b['recipe_id']);self.assertAlmostEqual(a['scale'],2*b['scale'])
   self.assertEqual(len(a['portions']),2);self.assertAlmostEqual(sum(p['nutrition']['kcal'] for p in a['portions']),a['nutrition']['kcal'],delta=.2)
  for a,b in zip(view['shopping'],solo['shopping']):self.assertAlmostEqual(a['required'],2*b['required'],delta=.002)
  item=view['plan']['items'][0];preview=self.request('/alternatives?item_id='+item['id'])[1];candidate=preview['alternatives'][0]
  replaced=self.request('/replace',{'item_id':item['id'],'recipe_id':candidate['id'],'expected_revision':0})[1]
  total=next(b['total_kopecks'] for b in replaced['baskets'] if b['id']==replaced['recommended'])
  self.assertEqual(total,candidate['cart_total_kopecks']);self.assertEqual(len(replaced['plan']['items'][0]['portions']),2)
 def test_family_restrictions_and_owner_isolation(self):
  self.demo();ident=self.family_member(allergens=['молоко'],preferences=['no_fish'])
  code,view=self.request('/plan',{'member_ids':[ident],'repeat':7,'preferences':[]});self.assertEqual(code,201)
  self.assertIn('молоко',view['plan']['settings']['allergens']);self.assertIn('no_fish',view['plan']['settings']['preferences'])
  ingredients={i['id']:i for i in view['ingredients']};recipes={r['id']:r for r in view['recipes']}
  for item in view['plan']['items']:
   recipe=recipes[item['recipe_id']];self.assertNotIn('fish',recipe['ingredients'])
   self.assertTrue(all('молоко' not in ingredients[i]['allergens'] for i in recipe['ingredients']))
  other=self.new_client();self.request('/auth/demo',{},client=other);self.request('/profile',{'name':'Другой','age':30,'sex':'male','height':180,'weight':80,'activity':1.55,'goal':'lose'},method='PUT',client=other)
  self.assertEqual(self.request('/state',client=other)[1]['family_profiles'],[])
  self.assertEqual(self.request('/plan',{'member_ids':[ident]},client=other)[0],422)
  self.assertEqual(self.request('/plan',{'member_ids':[ident,ident]})[0],422)
 def test_underage_family_does_not_destroy_existing_plan(self):
  from datetime import date
  self.demo();before=self.request('/plan',{})[1]['plan']['id']
  ident=self.family_member(birth_date=f'{date.today().year-16}-01-01')
  self.assertEqual(self.request('/plan',{'member_ids':[ident]})[0],422)
  self.assertEqual(self.request('/state')[1]['plan']['id'],before)
 def test_register_login_hash_and_shared_account(self):
  credentials={'email':'account@example.org','password':'Long-pass-123'}
  self.assertEqual(self.request('/auth/register',credentials)[0],200)
  self.assertEqual(self.request('/auth/register',credentials)[0],422)
  self.assertEqual(self.save_profile()[0],200)
  self.assertEqual(self.request('/plan',{})[0],201)
  with server.connect() as db:
   hashed=db.execute('SELECT password_hash FROM users WHERE email=?',(credentials['email'],)).fetchone()[0]
   self.assertTrue(hashed.startswith('$2b$12$'));self.assertNotIn(credentials['password'],hashed)
  other=self.new_client();self.assertEqual(self.request('/auth/login',credentials,client=other)[0],200)
  self.assertEqual(self.request('/state',client=other)[1]['plan']['days'],7)
 def test_rate_limit(self):
  for _ in range(5):self.assertEqual(self.request('/auth/login',{'email':'unknown@example.org','password':'wrongpassword'})[0],401)
  self.assertEqual(self.request('/auth/login',{'email':'unknown@example.org','password':'wrongpassword'})[0],429)
 def test_validation_keeps_previous_plan(self):
  self.demo();before=self.request('/plan',{})[1]
  self.assertEqual(self.request('/plan',{'days':6})[0],422)
  self.assertEqual(self.request('/state')[1]['plan']['id'],before['plan']['id'])
  self.assertEqual(self.request('/plan',{'minutes':5})[0],422)
  self.assertEqual(self.request('/state')[1]['plan']['id'],before['plan']['id'])
 def test_owner_isolation(self):
  self.demo();plan=self.request('/plan',{})[1];ident=plan['plan']['items'][0]['id']
  other=self.new_client();self.request('/auth/demo',{},client=other)
  self.assertEqual(self.request('/alternatives?item_id='+ident,client=other)[0],404)
  self.assertIsNone(self.request('/state',client=other)[1]['plan'])
 def test_source_failure_preserves_all_data(self):
  self.demo();before=self.request('/plan',{})[1]
  self.assertEqual(self.request('/prices/refresh',{'simulate_failure':True})[0],503)
  after=self.request('/state')[1];self.assertEqual(before['baskets'],after['baskets'])
 def test_cross_origin_rejected(self):
  self.assertEqual(self.request('/auth/demo',{},headers={'Origin':'https://other.example'})[0],403)
 def test_logout_revokes_session(self):
  self.demo();self.assertEqual(self.request('/auth/logout',{})[0],200);self.assertEqual(self.request('/state')[0],401)
 def test_plan_requires_saved_valid_profile(self):
  self.request('/auth/demo',{})
  self.assertFalse(self.request('/state')[1]['profile_complete'])
  self.assertEqual(self.request('/plan',{'age':30})[0],422)
  self.assertEqual(self.request('/profile',{'completed':True},method='PUT')[0],422)
  self.assertEqual(self.save_profile()[0],200)
  self.assertTrue(self.request('/state')[1]['profile_complete'])
 def test_plan_does_not_overwrite_profile(self):
  self.demo();self.save_profile(budget_week=3500,preferences=['no_fish'])
  before=self.request('/state')[1]['profile']
  status,result=self.request('/plan',{'age':19,'allergens':[],'days':14})
  self.assertEqual(status,201);self.assertEqual(result['profile'],before)
  self.assertEqual(result['plan']['settings']['age'],30);self.assertEqual(result['plan']['settings']['budget'],7000)
  fish_items=[r['id'] for r in result['recipes'] if 'fish' in r['ingredients']]
  self.assertFalse(any(i['recipe_id'] in fish_items for i in result['plan']['items']))
 def test_profile_edit_preserves_but_invalidates_old_plan(self):
  self.demo();old=self.request('/plan',{})[1]['plan'];self.save_profile(weight=80.5)
  result=self.request('/state')[1];self.assertIsNone(result['plan']);self.assertTrue(result['previous_plan_requires_update'])
  with server.connect() as db:self.assertIsNotNone(db.execute('SELECT id FROM plans WHERE id=?',(old['id'],)).fetchone())
 def test_optional_profile_fields_and_boundaries(self):
  self.demo()
  status,result=self.save_profile(age=14,weight=40.5,height=140)
  self.assertEqual(status,200);self.assertIsNone(result['profile']['budget_week']);self.assertEqual(self.request('/plan',{})[0],422)
  self.assertEqual(self.save_profile(age=90,weight=200,height=220,budget_week=10000)[0],200)
  for changes in [{'age':13},{'age':91},{'weight':40.25},{'height':180.5},{'budget_week':550}]:self.assertEqual(self.save_profile(**changes)[0],422)
 def test_replacement_preview_matches_actual_basket_and_does_not_write(self):
  self.demo();before=self.request('/plan',{})[1];item=before['plan']['items'][0]
  status,preview=self.request('/alternatives?item_id='+item['id']);self.assertEqual(status,200);self.assertTrue(preview['alternatives'])
  self.assertEqual(self.request('/state')[1],before)
  candidate=preview['alternatives'][0]
  self.assertLess(abs(candidate['planned_nutrition']['kcal']-item['nutrition']['kcal']),.2)
  status,after=self.request('/replace',{'item_id':item['id'],'recipe_id':candidate['id'],'expected_revision':preview['plan_revision']})
  self.assertEqual(status,200);self.assertEqual(after['plan']['revision'],1)
  changed=[i for i,j in zip(before['plan']['items'],after['plan']['items']) if i['recipe_id']!=j['recipe_id']]
  self.assertEqual(len(changed),1);self.assertEqual(changed[0]['id'],item['id'])
  total=next(b['total_kopecks'] for b in after['baskets'] if b['id']==after['recommended'])
  self.assertEqual(total,candidate['cart_total_kopecks']);self.assertEqual(total-preview['baseline_cart_kopecks'],candidate['cart_delta_kopecks'])
  self.assertEqual(self.request('/replace',{'item_id':item['id'],'recipe_id':candidate['id'],'expected_revision':0})[0],409)
 def test_save_persists_and_replacement_returns_to_draft(self):
  self.demo();state=self.request('/plan',{})[1];p=state['plan']
  self.assertEqual(p['status'],'draft')
  status,saved=self.request('/plan/save',{'plan_id':p['id'],'expected_revision':p['revision']})
  self.assertEqual(status,200);self.assertEqual(saved['plan']['status'],'saved');self.assertTrue(saved['plan']['saved_at'])
  self.assertEqual(self.request('/state')[1]['plan']['status'],'saved')
  item=p['items'][0];preview=self.request('/alternatives?item_id='+item['id'])[1];candidate=preview['alternatives'][0]
  after=self.request('/replace',{'item_id':item['id'],'recipe_id':candidate['id'],'expected_revision':0})[1]
  self.assertEqual(after['plan']['status'],'draft');self.assertIsNone(after['plan']['saved_at'])
  self.assertEqual(self.request('/plan/save',{'plan_id':p['id'],'expected_revision':0})[0],409)
 def test_replacement_respects_profile_restrictions_and_calorie_band(self):
  self.demo();self.save_profile(allergens=['молоко'],preferences=['no_fish'])
  state=self.request('/plan',{'repeat':7})[1];item=state['plan']['items'][0];recipes={r['id']:r for r in state['recipes']};ingredients={r['id']:r for r in state['ingredients']}
  preview=self.request('/alternatives?item_id='+item['id'])[1]
  from domain import nutrition
  self.assertTrue(preview['alternatives'])
  for candidate in preview['alternatives']:
   self.assertNotIn('fish',candidate['ingredients'])
   self.assertTrue(all('молоко' not in ingredients[i]['allergens'] for i in candidate['ingredients']))
   kcal=nutrition(candidate,ingredients,item['scale'])['kcal'];self.assertLessEqual(abs(kcal-item['nutrition']['kcal']),item['nutrition']['kcal']*.15+.01)
 def test_recipe_prices_are_nullable_and_not_purchase_totals(self):
  self.demo();state=self.request('/plan',{})[1]
  self.assertTrue(all(isinstance(i['estimated_cost_kopecks'],int) for i in state['plan']['items']))
  with server.connect() as db:db.execute('UPDATE offers SET available=0')
  try:
   missing=self.request('/state')[1];self.assertIsNone(missing['recommended']);self.assertTrue(all(i['estimated_cost_kopecks'] is None for i in missing['plan']['items']))
   preview=self.request('/alternatives?item_id='+missing['plan']['items'][0]['id'])[1]
   self.assertTrue(all(a['cart_delta_kopecks'] is None for a in preview['alternatives']))
  finally:
   with server.connect() as db:db.execute("UPDATE offers SET available=CASE WHEN store_id='auchan' AND ingredient_id IN ('fish','nuts') THEN 0 ELSE 1 END")
if __name__=='__main__':unittest.main(verbosity=2)
