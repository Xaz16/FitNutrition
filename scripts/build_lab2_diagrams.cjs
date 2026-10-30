// Graphviz calculates layout; exported draw.io cells remain individually editable.
const fs=require('node:fs'),path=require('node:path');
const modules=process.env.ARTIFACT_NODE_MODULES||path.resolve(__dirname,'../tools/node_modules');
const {instance}=require(path.join(modules,'@viz-js/viz'));
const sharp=require(path.join(modules,'sharp'));
const out=path.resolve(__dirname,'../docs/lab2/diagrams');
const x=s=>String(s).replace(/[<>&"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c])).replace(/\n/g,'&#xa;');
const n=(name,label,shape='box')=>({name,attributes:{label,shape}});
const e=(tail,head,label='',extra={})=>({tail,head,attributes:{label,...extra}});
const base=(nodes,edges,rankdir='TB')=>({directed:true,graphAttributes:{rankdir,bgcolor:'white',pad:.2,nodesep:.35,ranksep:.45,splines:'polyline'},nodeAttributes:{fontname:'Times New Roman',fontsize:13,margin:'0.15,0.12',style:'solid',color:'black'},edgeAttributes:{fontname:'Times New Roman',fontsize:11,arrowsize:.65},nodes,edges});
const graphs={};
graphs.structure=base([
 n('ui','Браузер: index.html / app.js / style.css\nВход, навигация, каталог и закупки'),
 n('onboarding','flow.js / profile.js / family.js\nОбщий каркас, профиль и онбординг\nУчастники и настройки плана'),
 n('result','result.js\nРезультат меню, окно альтернатив\nПрогноз цены и выбор замены'),
 n('http','server.py / Handler\nHTTP / JSON, сессия, маршруты\nОркестрация расчётов и сохранения'),
 n('profile','profiles.py / family.py\nДата рождения, профиль и участники\nИндивидуальные нормы, общий план'),
 n('replacement','replacements.py\nreplacement_candidates\npreview_replacements, meal_cost'),
 n('domain','domain.py\nНормы, подбор меню, allowed\nСписок и расчёт полных корзин'),
 n('provider','prices.py / DemoPriceProvider\nУчебные предложения\nЧтение и обновление offers'),
 n('storage','server.py / SQLite\nРегистрация, bcrypt и cookie-сессии\nПрофили, планы, SQL и транзакции'),
 n('db','SQLite / schema.sql\nusers, sessions, profiles, plans, plan_items\nrecipes, ingredients, offers, pantry','cylinder')
],[e('ui','onboarding','формы'),e('ui','result','результат'),e('ui','http','остальные API'),
 e('onboarding','http','PUT /profile; POST /plan'),
 e('result','http','GET /alternatives; POST /replace; /plan/save'),
 e('http','profile','валидация профиля'),e('http','replacement','кандидаты и прогноз'),
 e('profile','domain','validate_settings'),e('replacement','domain','фильтр, КБЖУ, корзины'),
 e('http','domain','генерация и снимок'),e('http','provider','цены'),
 e('http','storage','данные, владение, revision'),e('provider','db','чтение / запись offers'),
 e('storage','db','параметризованный SQL'),e('profile','db','family.py: чтение профилей семьи')]);
graphs.usecase=base([n('actor','Пользователь\n(взрослый)','plaintext'),n('login','Зарегистрироваться / войти','ellipse'),n('prefs','Задать параметры,\nбюджет и исключения','ellipse'),n('plan','Составить меню','ellipse'),n('replace','Заменить блюдо','ellipse'),n('recipe','Просмотреть рецепт','ellipse'),n('list','Получить список покупок','ellipse'),n('stock','Учесть домашние запасы','ellipse'),n('basket','Сравнить полные корзины','ellipse'),n('packs','Рассчитать целые упаковки','ellipse')],[...['login','prefs','plan','replace','recipe','list','stock','basket'].map(id=>e('actor',id,'',{arrowhead:'none'})),e('plan','list','«include»',{style:'dashed'}),e('basket','packs','«include»',{style:'dashed'}),e('replace','list','«include»',{style:'dashed'})],'LR');
 graphs.usecase.subgraphs=[{name:'cluster_system',graphAttributes:{label:'Fit Nutrition Supply',fontname:'Times New Roman',fontsize:15},nodes:graphs.usecase.nodes.filter(v=>v.name!=='actor')}];graphs.usecase.nodes=graphs.usecase.nodes.filter(v=>v.name==='actor');
graphs.usecase.edgeAttributes.arrowhead='open';
graphs.activity_main=base([n('start','', 'point'),n('settings','Ввести параметры, период,\nбюджет и исключения'),n('validate','Ввод корректен?','diamond'),n('error','Показать ошибки полей'),n('build','Подобрать блюда\nс учётом ограничений'),n('ready','Меню полное?','diamond'),n('missing','Показать нехватку блюд\nПрежний план сохранить'),n('save','Сохранить план одной транзакцией'),n('list','Суммировать продукты\nи вычесть домашние запасы'),n('compare','Рассчитать упаковки\nи сравнить полные корзины'),n('show','Показать магазин, сумму,\nдату цен и бюджет'),n('end','','doublecircle')],[e('start','settings'),e('settings','validate'),e('validate','error','[нет]'),e('error','settings'),e('validate','build','[да]'),e('build','ready'),e('ready','missing','[нет]'),e('missing','settings'),e('ready','save','[да]'),e('save','list'),e('list','compare'),e('compare','show'),e('show','end')]);
graphs.activity_alternative=base([
 n('start','','point'),n('open','Нажать «Заменить» у блюда'),
 n('filter','Отфильтровать: тип приёма, аллергии,\nпредпочтения, время, повторы,\nкалории в пределах ±15%'),
 n('exists','Есть варианты?','diamond'),n('none','Показать отсутствие альтернатив\nПлан не изменять'),
 n('preview','Для каждого варианта пересчитать\nсписок, запасы и целые упаковки'),
 n('show','Показать название, калории\nи разницу полной корзины'),
 n('choose','Вариант выбран?','diamond'),n('cancel','Закрыть без изменений'),
 n('version','Версия плана актуальна?','diamond'),n('conflict','Показать 409\nЗапросить свежий результат'),
 n('write','Повторить проверку ограничений\nЗаменить одну позицию транзакцией'),
 n('recalc','Пересчитать меню и корзины\nОтметить план черновиком'),
 n('ui','Обновить блюда, сумму и бюджет\nбез перезагрузки страницы'),n('end','','doublecircle')
],[e('start','open'),e('open','filter'),e('filter','exists'),e('exists','none','[нет]'),e('none','end'),e('exists','preview','[да]'),e('preview','show'),e('show','choose'),e('choose','cancel','[нет]'),e('cancel','end'),e('choose','version','[да]'),e('version','conflict','[нет]'),e('conflict','filter'),e('version','write','[да]'),e('write','recalc'),e('recalc','ui'),e('ui','end')]);
graphs.activity_alternative.nodes.forEach(node=>{if(node.attributes.shape==='box')node.attributes.style='rounded';});
graphs.activity_exception=base([n('start','','point'),n('request','Запросить обновление цен'),n('provider','Обратиться к PriceProvider'),n('ok','Источник ответил?','diamond'),n('update','Атомарно сохранить цены\nи дату набора'),n('keep','Оставить предыдущие цены\nОтветить 503 с кодом ошибки'),n('show','Показать сообщение и дату\nНе подставлять нулевые цены'),n('retry','Повторить запрос?','diamond'),n('end','','doublecircle')],[e('start','request'),e('request','provider'),e('provider','ok'),e('ok','update','[да]'),e('update','end'),e('ok','keep','[нет]'),e('keep','show'),e('show','retry'),e('retry','request','[да]'),e('retry','end','[нет]')]);
const tables={
 users:'id TEXT PK\nemail TEXT UNIQUE\npassword_hash TEXT\ncreated_at TEXT',
 sessions:'token_hash TEXT PK\nuser_id TEXT FK\nexpires_at REAL',
 login_attempts:'email TEXT PK(1)\nattempted_at REAL PK(2)',
 profiles:'user_id TEXT PK FK\nsettings_json TEXT',
 family_profiles:'id TEXT PK\nuser_id TEXT FK\nsettings_json TEXT\ncreated_at TEXT',
 plans:'id TEXT PK\nuser_id TEXT FK\nstart_date TEXT\ndays INTEGER\nsettings_json TEXT\ncreated_at TEXT\nstatus TEXT\nrevision INTEGER\nsaved_at TEXT',
 plan_items:'id TEXT PK\nplan_id TEXT FK\nday INTEGER\nslot INTEGER\nrecipe_id TEXT FK\nscale REAL\nUNIQUE(plan_id, day, slot)',
 recipes:'id TEXT PK\nname TEXT\nmeal TEXT\nminutes INTEGER\ningredients_json TEXT\nsteps_json TEXT',
 ingredients:'id TEXT PK\nname TEXT\ncategory TEXT\nunit TEXT\nkcal REAL\nprotein REAL\nfat REAL\ncarbs REAL\nallergens_json TEXT',
 stores:'id TEXT PK\nname TEXT',
 offers:'id TEXT PK\nstore_id TEXT FK\ningredient_id TEXT FK\npack_size REAL\nprice_kopecks INTEGER\navailable INTEGER\nupdated_at TEXT\nsource TEXT\ncity TEXT',
 pantry:'user_id TEXT PK(1) FK\ningredient_id TEXT PK(2) FK\namount REAL\npurchased INTEGER'
};
graphs.er=base(Object.entries(tables).map(([id,attrs])=>n(id,id.toUpperCase()+'\n────────────\n'+attrs)),[['users','sessions'],['users','plans'],['plans','plan_items'],['recipes','plan_items'],['stores','offers'],['ingredients','offers'],['users','pantry'],['ingredients','pantry'],['users','profiles'],['users','family_profiles']].map(([a,b])=>e(a,b,'',{dir:'none',taillabel:'1',headlabel:b==='profiles'?'0..1':'0..*',labeldistance:2})).concat([e('recipes','ingredients','ссылки id в JSON\nбез SQL FK',{style:'dashed',dir:'none'}),e('plans','family_profiles','member_ids / participants в JSON\nбез SQL FK',{style:'dashed',dir:'none'})]),'LR');
graphs.er.nodeAttributes.fontsize=12;

// Six domain entities mapped to physical tables. Dashed composition is JSON, not an SQL FK.
graphs.er_domain=base([
 n('user','Пользователь User / users\nid TEXT PK\nemail TEXT UNIQUE\npassword_hash TEXT\ncreated_at TEXT'),
 n('profile','Профиль Profile / profiles\nuser_id TEXT PK FK → users\nsettings_json TEXT\nпараметры, ограничения, completed'),
 n('plan','План Plan / plans\nid TEXT PK\nuser_id TEXT FK → users\nstart_date TEXT; days INTEGER\nsettings_json TEXT; created_at TEXT\nstatus TEXT; revision INTEGER\nsaved_at TEXT nullable'),
 n('meal','Приём пищи Meal / plan_items\nid TEXT PK\nplan_id TEXT FK → plans\nrecipe_id TEXT FK → recipes\nday INTEGER; slot INTEGER; scale REAL\nUNIQUE(plan_id, day, slot)'),
 n('dish','Блюдо Dish / recipes\nid TEXT PK; name TEXT\nmeal TEXT; minutes INTEGER\ningredients_json TEXT\nsteps_json TEXT'),
 n('ingredient','Ингредиент Ingredient / ingredients\nid TEXT PK; name TEXT\ncategory TEXT; unit TEXT\nkcal, protein, fat, carbs REAL\nallergens_json TEXT')
],[
 e('user','profile','',{dir:'none',taillabel:'1',headlabel:'0..1',labeldistance:2}),
 e('user','plan','',{dir:'none',taillabel:'1',headlabel:'0..N',labeldistance:2}),
 e('plan','meal','',{dir:'none',taillabel:'1',headlabel:'0..N',labeldistance:2}),
 e('dish','meal','',{dir:'none',taillabel:'1',headlabel:'0..N',labeldistance:2}),
 e('dish','ingredient','M:N состав\nколичество в ingredients_json\nлогическая связь без SQL FK',{dir:'none',style:'dashed'})
],'TB');
graphs.er_domain.nodeAttributes.fontsize=12;

graphs.activity_registration=base([
 n('start','','point'),n('form','Ввести имя, email и пароль'),
 n('register','POST /api/auth/register\nПроверить ввод и уникальность email'),
 n('valid','Регистрация успешна?','diamond'),n('error','Показать ошибки\nОстаться в форме'),
 n('account','Создать User и Profile completed=false\nУстановить cookie сессии'),
 n('basics','Шаг 1: пол, возраст, вес, рост\nДалее только при корректном вводе'),
 n('goal','Шаг 2: активность и цель\nДалее только после выбора'),
 n('limits','Шаг 3: ограничения и бюджет\nЗаполнение необязательно'),
 n('summary','Шаг 4: сводка\nЧерновик сохраняется при возврате'),
 n('edit','Нужно исправить?','diamond'),n('back','Открыть выбранный шаг\nСохранить остальной ввод'),
 n('save','Нажать «Сохранить профиль»\nPUT /api/profile'),n('saved','Профиль принят?','diamond'),
 n('invalid','Показать ошибки\nСохранить ввод'),n('dashboard','Записать completed=true\nОткрыть дашборд'),n('end','','doublecircle')
],[e('start','form'),e('form','register'),e('register','valid'),e('valid','error','[нет]'),e('error','form'),e('valid','account','[да]'),e('account','basics'),e('basics','goal'),e('goal','limits'),e('limits','summary'),e('summary','edit'),e('edit','back','[да]'),e('back','summary','[после редактирования]'),e('edit','save','[нет]'),e('save','saved'),e('saved','invalid','[нет]'),e('invalid','summary'),e('saved','dashboard','[да]'),e('dashboard','end')]);

graphs.activity_generation=base([
 n('start','','point'),n('input','Задать период, бюджет, предпочтения\nНажать «Составить меню»'),
 n('request','POST /api/plan\nПроверить сессию и готовый профиль'),
 n('valid','Ввод допустим?','diamond'),n('invalid','Показать 401 или 422\nПредыдущий план не менять'),
 n('settings','Объединить профиль с параметрами\nРассчитать целевую энергию и БЖУ'),
 n('filter','Для каждого дня и приёма\nучесть состав, время и повторы'),
 n('complete','Все позиции подобраны?','diamond'),n('missing','Ответить 422\nСохранить прежний план'),
 n('portions','Масштабировать порции\nпо энергетической доле приёма'),
 n('write','Одной транзакцией записать\nPlan draft и все Meal'),
 n('cart','Суммировать продукты, вычесть запасы\nРассчитать упаковки и полные корзины'),
 n('response','HTTP 201: снимок состояния\nМеню, калории, цены и бюджет'),
 n('result','Показать результат\nПревышение бюджета выделить красным'),n('end','','doublecircle')
],[e('start','input'),e('input','request'),e('request','valid'),e('valid','invalid','[нет]'),e('invalid','end'),e('valid','settings','[да]'),e('settings','filter'),e('filter','complete'),e('complete','missing','[нет]'),e('missing','end'),e('complete','portions','[да]'),e('portions','write'),e('write','cart'),e('cart','response'),e('response','result'),e('result','end')]);
for(const graph of [graphs.activity_registration,graphs.activity_generation])graph.nodes.forEach(node=>{if(node.attributes.shape==='box')node.attributes.style='rounded';});

(async()=>{
 fs.mkdirSync(out,{recursive:true});const viz=await instance();
 for(const [name,graph] of Object.entries(graphs)){
  fs.writeFileSync(path.join(out,name+'.json'),JSON.stringify(graph,null,2));
  fs.writeFileSync(path.join(out,name+'.dot'),viz.renderString(graph,{format:'canon'}));
  let svg=viz.renderString(graph,{format:'svg'});
  if(name.startsWith('activity_'))svg=svg.replace(/(<title>end<\/title>\s*<ellipse )fill="none"/,'$1fill="black"');
  // Graphviz's actor placeholder is replaced by a proper UML stick figure.
  if(name==='usecase')svg=svg.replace(/(<g id="[^"]*" class="node">\s*<title>actor<\/title>)([\s\S]*?)(<\/g>)/,(_m,pre,inside,post)=>{const tx=inside.match(/<text[^>]*x="([\d.-]+)"[^>]*y="([\d.-]+)"/);if(!tx)return pre+inside+post;const xx=Number(tx[1]),yy=Number(tx[2])-78;return pre+`<circle cx="${xx}" cy="${yy}" r="10" fill="none" stroke="black"/><path d="M${xx},${yy+10}v27m-20,-20h40m-20,20 -17,20m17,-20 17,20" stroke="black" fill="none"/>`+inside+post;});
  fs.writeFileSync(path.join(out,name+'.svg'),svg);await sharp(Buffer.from(svg),{density:170}).png().toFile(path.join(out,name+'.png'));
  const layout=viz.renderJSON(graph),bb=layout.bb.split(',').map(Number),height=bb[3];
  let xml=`<?xml version="1.0" encoding="UTF-8"?><mxfile host="app.diagrams.net"><diagram name="${name}"><mxGraphModel pageWidth="${Math.ceil(bb[2]+50)}" pageHeight="${Math.ceil(height+50)}"><root><mxCell id="0"/><mxCell id="1" parent="0"/>`;
  const objects=layout.objects||[];
  for(const o of objects){if(o.name?.startsWith('cluster_')&&o.bb){const [a,b,c,d]=o.bb.split(',').map(Number);xml+=`<mxCell id="cluster" value="Fit Nutrition Supply" style="rounded=0;fillColor=none;verticalAlign=top;align=left;spacing=8;" vertex="1" parent="1"><mxGeometry x="${a+20}" y="${height-d+20}" width="${c-a}" height="${d-b}" as="geometry"/></mxCell>`;}}
  for(const o of objects){if(!o.pos)continue;const [cx,cy]=o.pos.split(',').map(Number),w=Number(o.width)*72,h=Number(o.height)*72;const shape=o.name==='actor'?'shape=umlActor;':o.shape==='ellipse'?'ellipse;':o.shape==='diamond'?'rhombus;':o.shape==='point'?'ellipse;fillColor=#000000;':o.shape==='doublecircle'?'shape=doubleEllipse;':`rounded=${String(o.style).includes('rounded')?1:0};`;xml+=`<mxCell id="n${o._gvid}" value="${x(o.label||'')}" style="${shape}whiteSpace=wrap;html=0;fontFamily=Times New Roman;fontSize=13;strokeColor=#000000;" vertex="1" parent="1"><mxGeometry x="${cx-w/2+20}" y="${height-cy-h/2+20}" width="${w}" height="${h}" as="geometry"/></mxCell>`;}
  for(const [i,ed] of (layout.edges||[]).entries()){const edgeLabel=ed.label||(ed.taillabel?`${ed.taillabel} : ${ed.headlabel}`:'');xml+=`<mxCell id="e${i}" value="${x(edgeLabel)}" source="n${ed.tail}" target="n${ed.head}" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=0;endArrow=${ed.arrowhead==='none'||ed.dir==='none'?'none':'open'};dashed=${ed.style==='dashed'?1:0};fontFamily=Times New Roman;fontSize=11;" edge="1" parent="1"><mxGeometry relative="1" as="geometry"/></mxCell>`;}
  if(name.startsWith('activity_')){
   const final=objects.find(o=>o.name==='end');
   if(final){const [cx,cy]=final.pos.split(',').map(Number),r=Number(final.width)*72*.27;xml+=`<mxCell id="final-dot" value="" style="ellipse;fillColor=#000000;strokeColor=#000000;" vertex="1" parent="1"><mxGeometry x="${cx-r+20}" y="${height-cy-r+20}" width="${r*2}" height="${r*2}" as="geometry"/></mxCell>`;}
  }
  xml+='</root></mxGraphModel></diagram></mxfile>';fs.writeFileSync(path.join(out,name+'.drawio'),xml);
 }
 await sharp(fs.readFileSync(path.join(out,'wireframes.svg')),{density:144}).png().toFile(path.join(out,'wireframes.png'));
 console.log('Generated structure, use case, five activity and two ER diagrams in SVG, PNG, draw.io, DOT and JSON.');
})().catch(e=>{console.error(e);process.exit(1)});
