"""Local teaching prototype. Bind to loopback; deploy behind HTTPS for real use."""
import argparse
import hashlib
import json
import math
import re
import secrets
import sqlite3
import time
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse, parse_qs
import bcrypt
from catalog import seed, ALLERGENS
from domain import DomainError, validate_settings, nutrition, allowed, generate_plan, shopping, calculate_baskets
from prices import DemoPriceProvider,PriceSourceUnavailable

ROOT=Path(__file__).resolve().parent
DB_PATH=ROOT/'data/fitnutrition.sqlite3'

def now():return datetime.now(timezone.utc).isoformat()
@contextmanager
def connect():
 db=sqlite3.connect(DB_PATH,timeout=10);db.row_factory=sqlite3.Row
 db.execute('PRAGMA foreign_keys=ON')
 try:
  with db:yield db
 finally:db.close()
def initialize():
 DB_PATH.parent.mkdir(parents=True,exist_ok=True)
 with connect() as db:
  db.executescript((ROOT/'schema.sql').read_text(encoding='utf-8'))
  if not any(row['pk'] for row in db.execute('PRAGMA table_info(login_attempts)')):
   db.execute('ALTER TABLE login_attempts RENAME TO login_attempts_v0')
   db.execute('CREATE TABLE login_attempts (email TEXT NOT NULL, attempted_at REAL NOT NULL, PRIMARY KEY(email, attempted_at))')
   db.execute('INSERT OR IGNORE INTO login_attempts SELECT email,attempted_at FROM login_attempts_v0')
   db.execute('DROP TABLE login_attempts_v0')
  seed(db)
def catalog(db):
 ingredients={}
 for row in db.execute('SELECT * FROM ingredients'):
  i=dict(row);i['allergens']=json.loads(i.pop('allergens_json'));ingredients[i['id']]=i
 recipes={}
 for row in db.execute('SELECT * FROM recipes'):
  r=dict(row);r['ingredients']=json.loads(r.pop('ingredients_json'));r['steps']=json.loads(r.pop('steps_json'));r['nutrition']=nutrition(r,ingredients);recipes[r['id']]=r
 return ingredients,recipes

def snapshot(db,user):
 ingredients,recipes=catalog(db)
 profile=db.execute('SELECT settings_json FROM profiles WHERE user_id=?',(user,)).fetchone()
 plan=db.execute('SELECT * FROM plans WHERE user_id=? ORDER BY created_at DESC,id DESC LIMIT 1',(user,)).fetchone()
 result={'profile':json.loads(profile[0]) if profile else None,'ingredients':list(ingredients.values()),'recipes':list(recipes.values()),'allergens':ALLERGENS,'plan':None,'test_data':True}
 if not plan:return result
 settings=json.loads(plan['settings_json'])
 items=[dict(r) for r in db.execute('SELECT * FROM plan_items WHERE plan_id=? ORDER BY day,slot',(plan['id'],))]
 for item in items:item['nutrition']=nutrition(recipes[item['recipe_id']],ingredients,item['scale'])
 pantry={r['ingredient_id']:dict(r) for r in db.execute('SELECT * FROM pantry WHERE user_id=?',(user,))}
 lines=shopping(items,recipes,ingredients,pantry)
 stores=[dict(r) for r in db.execute('SELECT * FROM stores')]
 offers=DemoPriceProvider().read(db)
 result.update(plan={**dict(plan),'settings':settings,'items':items},shopping=lines,**calculate_baskets(lines,stores,offers,settings['budget']))
 result['plan'].pop('settings_json')
 result['price_source']='Демонстрационные предложения. Это не актуальные цены магазинов.'
 return result

class Handler(BaseHTTPRequestHandler):
 server_version='FitNutrition/0.2'
 def log_message(self,*args):pass  # Never log authentication bodies or tokens.
 def send_json(self,data,status=200,cookie=None):
  body=json.dumps(data,ensure_ascii=False,allow_nan=False).encode()
  self.send_response(status);self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Content-Length',str(len(body)));self.send_header('Cache-Control','no-store');self.send_header('X-Content-Type-Options','nosniff')
  if cookie:self.send_header('Set-Cookie',cookie)
  self.end_headers();self.wfile.write(body)
 def read_json(self):
  try:
   length=int(self.headers.get('Content-Length','0'))
   if length<0 or length>65536:raise DomainError('Некорректный размер запроса')
   value=json.loads(self.rfile.read(length))
   if not isinstance(value,dict):raise ValueError()
   return value
  except (ValueError,UnicodeError):raise DomainError('Некорректный JSON')
 def current_user(self,db):
  cookie=SimpleCookie()
  try:cookie.load(self.headers.get('Cookie',''))
  except Exception:return None
  token=cookie.get('session')
  if not token:return None
  row=db.execute('SELECT user_id FROM sessions WHERE token_hash=? AND expires_at>?',(hashlib.sha256(token.value.encode()).hexdigest(),time.time())).fetchone()
  return row[0] if row else None
 def require_user(self,db):
  user=self.current_user(db)
  if not user:raise PermissionError('Войдите в аккаунт')
  return user
 def new_session(self,db,user):
  token=secrets.token_urlsafe(32)
  db.execute('DELETE FROM sessions WHERE expires_at<?',(time.time(),))
  db.execute('INSERT INTO sessions VALUES (?,?,?)',(hashlib.sha256(token.encode()).hexdigest(),user,time.time()+86400*7))
  db.commit()
  return f'session={token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800'
 def do_GET(self):self.handle_request('GET')
 def do_POST(self):self.handle_request('POST')
 def do_PUT(self):self.handle_request('PUT')
 def handle_request(self,method):
  path=urlparse(self.path).path
  try:
   if not path.startswith('/api/'):
    if method!='GET':return self.send_json({'error':'Метод не поддерживается'},405)
    filename={'/':'index.html','/index.html':'index.html','/app.js':'app.js','/style.css':'style.css'}.get(path)
    if not filename:return self.send_json({'error':'Не найдено'},404)
    body=(ROOT/'static'/filename).read_bytes()
    self.send_response(200);self.send_header('Content-Type',{'html':'text/html; charset=utf-8','js':'text/javascript; charset=utf-8','css':'text/css; charset=utf-8'}[filename.rsplit('.',1)[-1]])
    self.send_header('Content-Length',str(len(body)));self.send_header('X-Content-Type-Options','nosniff')
    self.send_header('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'")
    self.end_headers();self.wfile.write(body);return
   if method!='GET':
    origin=self.headers.get('Origin')
    if origin and origin not in (f'http://127.0.0.1:{self.server.server_port}',f'http://localhost:{self.server.server_port}'):return self.send_json({'error':'Недопустимый источник запроса'},403)
   with connect() as db:
    if path=='/api/session' and method=='GET':
     user=self.current_user(db);row=db.execute('SELECT email FROM users WHERE id=?',(user,)).fetchone() if user else None
     return self.send_json({'authenticated':bool(user),'email':row[0] if row else None})
    if path=='/api/auth/logout' and method=='POST':
     cookie=SimpleCookie(self.headers.get('Cookie',''));token=cookie.get('session')
     if token:db.execute('DELETE FROM sessions WHERE token_hash=?',(hashlib.sha256(token.value.encode()).hexdigest(),))
     return self.send_json({'ok':True},cookie='session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0')
    if path in ('/api/auth/register','/api/auth/login','/api/auth/demo') and method=='POST':
     data=self.read_json();email=str(data.get('email','')).strip().lower();password=str(data.get('password',''))
     if path.endswith('/demo'):
      user=uuid.uuid4().hex
      db.execute('INSERT INTO users VALUES (?,?,?,?)',(user,f'demo-{user[:8]}@example.invalid','!disabled',now()))
      return self.send_json({'ok':True,'demo':True},cookie=self.new_session(db,user))
     if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+',email) or len(email)>254:raise DomainError('Укажите корректный email',{'email':'Проверьте email'})
     if not 8<=len(password) or len(password.encode())>72:raise DomainError('Пароль: от 8 символов, не более 72 байт',{'password':'Проверьте длину пароля'})
     if path.endswith('/register'):
      if db.execute('SELECT id FROM users WHERE email=?',(email,)).fetchone():raise DomainError('Этот email уже зарегистрирован',{'email':'Email занят'})
      user=uuid.uuid4().hex;hashed=bcrypt.hashpw(password.encode(),bcrypt.gensalt(rounds=12)).decode()
      db.execute('INSERT INTO users VALUES (?,?,?,?)',(user,email,hashed,now()))
     else:
      failures=db.execute('SELECT attempted_at FROM login_attempts WHERE email=? AND attempted_at>? ORDER BY attempted_at DESC',(email,time.time()-900)).fetchall()
      if len(failures)>=5:return self.send_json({'error':'Слишком много попыток. Повторите вход через 15 минут.'},429)
      row=db.execute('SELECT id,password_hash FROM users WHERE email=?',(email,)).fetchone()
      if not row or row[1]=='!disabled' or not bcrypt.checkpw(password.encode(),row[1].encode()):
       db.execute('INSERT INTO login_attempts VALUES (?,?)',(email,time.time()));db.commit()
       return self.send_json({'error':'Неверные учётные данные'},401)
      user=row[0];db.execute('DELETE FROM login_attempts WHERE email=?',(email,))
     return self.send_json({'ok':True},cookie=self.new_session(db,user))
    user=self.require_user(db)
    if path=='/api/state' and method=='GET':return self.send_json(snapshot(db,user))
    if path=='/api/plan' and method=='POST':
     settings=validate_settings(self.read_json());ingredients,recipes=catalog(db)
     if not set(settings['allergens'])<=set(ALLERGENS) or not set(settings['excluded'])<=set(ingredients):raise DomainError('Неизвестное исключение')
     items=generate_plan(settings,recipes,ingredients);ident=uuid.uuid4().hex
     db.execute('INSERT INTO plans VALUES (?,?,?,?,?,?)',(ident,user,settings['start_date'],settings['days'],json.dumps(settings),now()))
     db.executemany('INSERT INTO plan_items VALUES (?,?,?,?,?,?)',[(uuid.uuid4().hex,ident,i['day'],i['slot'],i['recipe_id'],i['scale']) for i in items])
     db.execute('INSERT INTO profiles VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET settings_json=excluded.settings_json',(user,json.dumps(settings)))
     return self.send_json(snapshot(db,user),201)
    if path in ('/api/alternatives','/api/replace'):
     data=self.read_json() if method=='POST' else {k:v[0] for k,v in parse_qs(urlparse(self.path).query).items()}
     row=db.execute('SELECT i.*,p.settings_json FROM plan_items i JOIN plans p ON p.id=i.plan_id WHERE i.id=? AND p.user_id=?',(data.get('item_id'),user)).fetchone()
     if not row:return self.send_json({'error':'Позиция не найдена'},404)
     ingredients,recipes=catalog(db);settings=json.loads(row['settings_json']);original=recipes[row['recipe_id']]
     alternatives=[r for r in recipes.values() if r['meal']==original['meal'] and r['id']!=original['id'] and allowed(r,settings,ingredients)]
     # Respect the repetition limit in the actual calendar week of the selected slot.
     from datetime import date,timedelta
     target_week=(date.fromisoformat(settings['start_date'])+timedelta(days=row['day'])).isocalendar()[:2]
     counts={}
     for r in db.execute('SELECT day,recipe_id FROM plan_items WHERE plan_id=? AND id<>?',(row['plan_id'],row['id'])):
      if (date.fromisoformat(settings['start_date'])+timedelta(days=r['day'])).isocalendar()[:2]==target_week:counts[r['recipe_id']]=counts.get(r['recipe_id'],0)+1
     alternatives=[r for r in alternatives if counts.get(r['id'],0)<settings['repeat']]
     if path=='/api/alternatives' and method=='GET':return self.send_json({'alternatives':alternatives})
     if path=='/api/replace' and method=='POST':
      replacement=next((r for r in alternatives if r['id']==data.get('recipe_id')),None)
      if not replacement:raise DomainError('Эта замена недоступна с текущими ограничениями')
      energy=nutrition(original,ingredients,row['scale'])['kcal'];scale=energy/replacement['nutrition']['kcal']
      db.execute('UPDATE plan_items SET recipe_id=?,scale=? WHERE id=?',(replacement['id'],scale,row['id']))
      return self.send_json(snapshot(db,user))
    if path=='/api/pantry' and method=='PUT':
     data=self.read_json();ident=data.get('ingredient_id');amount=data.get('amount',0);purchased=data.get('purchased',False)
     if not isinstance(amount,(int,float)) or not math.isfinite(amount) or not 0<=amount<=1000000 or not isinstance(purchased,bool):raise DomainError('Количество должно быть неотрицательным числом')
     if not db.execute('SELECT id FROM ingredients WHERE id=?',(ident,)).fetchone():raise DomainError('Неизвестный продукт')
     db.execute('INSERT INTO pantry VALUES (?,?,?,?) ON CONFLICT(user_id,ingredient_id) DO UPDATE SET amount=excluded.amount,purchased=excluded.purchased',(user,ident,amount,int(purchased)))
     return self.send_json(snapshot(db,user))
    if path=='/api/prices/refresh' and method=='POST':
     data=self.read_json()
     DemoPriceProvider().refresh(db,bool(data.get('simulate_failure')))
     return self.send_json(snapshot(db,user))
    return self.send_json({'error':'Не найдено'},404)
  except PriceSourceUnavailable as e:self.send_json({'error':str(e),'code':'PRICE_SOURCE_UNAVAILABLE'},503)
  except DomainError as e:self.send_json({'error':str(e),'fields':e.fields},422)
  except PermissionError as e:self.send_json({'error':str(e)},401)
  except (sqlite3.Error,KeyError,TypeError,ValueError):self.send_json({'error':'Не удалось выполнить запрос. Данные не изменены.'},500)

def main():
 global DB_PATH
 parser=argparse.ArgumentParser();parser.add_argument('--port',type=int,default=8765);parser.add_argument('--db',type=Path);parser.add_argument('--open',action='store_true');args=parser.parse_args()
 if args.db:DB_PATH=args.db.resolve()
 initialize();server=ThreadingHTTPServer(('127.0.0.1',args.port),Handler)
 print(f'Fit Nutrition Supply: http://127.0.0.1:{args.port}',flush=True)
 if args.open:
  import webbrowser
  webbrowser.open(f'http://127.0.0.1:{args.port}')
 try:server.serve_forever()
 except KeyboardInterrupt:pass
 finally:server.server_close()
if __name__=='__main__':main()
