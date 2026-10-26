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
if __name__=='__main__':unittest.main(verbosity=2)
