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
 def demo(self):self.assertEqual(self.request('/auth/demo',{})[0],200)
 def test_register_login_hash_and_shared_account(self):
  credentials={'email':'account@example.org','password':'Long-pass-123'}
  self.assertEqual(self.request('/auth/register',credentials)[0],200)
  self.assertEqual(self.request('/auth/register',credentials)[0],422)
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
if __name__=='__main__':unittest.main(verbosity=2)
