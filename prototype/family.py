"""Account-owned family profiles and proportional portions of shared dishes."""
import json
from domain import DomainError,nutrition
from profiles import current_profile,plan_settings,profile_fingerprint

def family_profiles(db,user):
 return [{'id':r['id'],**current_profile(json.loads(r['settings_json']))} for r in db.execute('SELECT * FROM family_profiles WHERE user_id=? ORDER BY created_at,id',(user,))]

def family_settings(db,user,profile,options,ingredients):
 ids=options.get('member_ids',[])
 if not isinstance(ids,list) or len(ids)>9 or any(not isinstance(v,str) for v in ids) or len(set(ids))!=len(ids):raise DomainError('Выберите не более 9 разных членов семьи')
 available={p['id']:p for p in family_profiles(db,user)}
 if any(ident not in available for ident in ids):raise DomainError('Профиль участника недоступен')
 profiles=[('self',profile)]+[(ident,{k:v for k,v in available[ident].items() if k!='id'}) for ident in ids]
 settings=plan_settings(profile,options,ingredients);participants=[];individual=[]
 for ident,p in profiles:
  # Plan preferences can add restrictions, but cannot remove a participant's preferences.
  requested=options.get('preferences',p.get('preferences',[]))
  if not isinstance(requested,list):raise DomainError('Проверьте предпочтения')
  prefs=list(dict.fromkeys(p.get('preferences',[])+requested))
  try:personal=plan_settings(p,{**options,'preferences':prefs},ingredients)
  except DomainError as error:raise DomainError(p['name']+': '+str(error),error.fields) from error
  individual.append(personal);participants.append({'id':ident,'name':p['name'],'goal':p['goal'],'target':personal['target'],'fingerprint':profile_fingerprint(p)})
 settings['member_ids']=ids;settings['participants']=participants
 if ids:
  for key in ('allergens','excluded','preferences'):settings[key]=sorted({v for p in individual for v in p[key]})
  settings['target']={key:sum(p['target'][key] for p in individual) for key in settings['target']}
 return settings

def plan_matches_profiles(db,user,settings,profile):
 if not profile or not profile.get('completed') or settings.get('profile_fingerprint')!=profile_fingerprint(profile):return False
 members={p['id']:p for p in family_profiles(db,user)}
 for person in settings.get('participants',[]):
  if person['id']=='self':continue
  member=members.get(person['id'])
  if not member:return False
  if person['fingerprint']!=profile_fingerprint({k:v for k,v in member.items() if k!='id'}):return False
 return True

def add_portions(item,settings,recipe,ingredients):
 people=settings.get('participants',[])
 if len(people)>1:
  item['portions']=[{'id':p['id'],'name':p['name'],'nutrition':nutrition(recipe,ingredients,item['scale']*p['target']['kcal']/settings['target']['kcal'])} for p in people]
