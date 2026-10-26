// Graphviz calculates layout; exported draw.io cells remain individually editable.
const fs=require('node:fs'),path=require('node:path');
const modules=process.env.ARTIFACT_NODE_MODULES||path.resolve(__dirname,'../tools/node_modules');
const {instance}=require(path.join(modules,'@viz-js/viz'));
const sharp=require(path.join(modules,'sharp'));
const out=path.resolve(__dirname,'../docs/lab2/diagrams');
const x=s=>String(s).replace(/[<>&"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));
const n=(name,label,shape='box')=>({name,attributes:{label,shape}});
const e=(tail,head,label='',extra={})=>({tail,head,attributes:{label,...extra}});
const base=(nodes,edges,rankdir='TB')=>({directed:true,graphAttributes:{rankdir,bgcolor:'white',pad:.2,nodesep:.35,ranksep:.45,splines:'polyline'},nodeAttributes:{fontname:'Times New Roman',fontsize:13,margin:'0.15,0.12',style:'solid',color:'black'},edgeAttributes:{fontname:'Times New Roman',fontsize:11,arrowsize:.65},nodes,edges});
const graphs={};
graphs.structure=base([
 n('ui','Браузерный интерфейс\nHTML / CSS / JavaScript'),n('http','HTTP API\nМаршруты, JSON, ошибки, сессия'),n('auth','AuthService\nРегистрация, вход, bcrypt'),n('domain','Прикладные функции domain.py\nНормы → меню → список → корзины'),n('provider','DemoPriceProvider\nУчебные предложения\nБудущий внешний адаптер'),n('repo','Repository / server.py\nSQL, владение данными, транзакции'),n('db','SQLite\nУчётные записи, планы, каталог, цены','cylinder')
],[e('ui','http','HTTP / JSON'),e('http','auth'),e('http','domain'),e('http','repo'),e('provider','repo','fixtures / offers'),e('domain','repo','данные через API-обработчик',{dir:'both'}),e('auth','repo'),e('repo','db','SQL + параметры')]);
graphs.usecase=base([n('actor','Пользователь\n(взрослый)','plaintext'),n('login','Зарегистрироваться / войти','ellipse'),n('prefs','Задать параметры,\nбюджет и исключения','ellipse'),n('plan','Составить меню','ellipse'),n('replace','Заменить блюдо','ellipse'),n('recipe','Просмотреть рецепт','ellipse'),n('list','Получить список покупок','ellipse'),n('stock','Учесть домашние запасы','ellipse'),n('basket','Сравнить полные корзины','ellipse'),n('packs','Рассчитать целые упаковки','ellipse')],[...['login','prefs','plan','replace','recipe','list','stock','basket'].map(id=>e('actor',id,'',{arrowhead:'none'})),e('plan','list','«include»',{style:'dashed'}),e('basket','packs','«include»',{style:'dashed'}),e('replace','list','«include»',{style:'dashed'})],'LR');
 graphs.usecase.subgraphs=[{name:'cluster_system',graphAttributes:{label:'Fit Nutrition Supply',fontname:'Times New Roman',fontsize:15},nodes:graphs.usecase.nodes.filter(v=>v.name!=='actor')}];graphs.usecase.nodes=graphs.usecase.nodes.filter(v=>v.name==='actor');
graphs.activity_main=base([n('start','', 'point'),n('settings','Ввести параметры, период,\nбюджет и исключения'),n('validate','Ввод корректен?','diamond'),n('error','Показать ошибки полей'),n('build','Подобрать блюда\nс учётом ограничений'),n('ready','Меню полное?','diamond'),n('missing','Показать нехватку блюд\nПрежний план сохранить'),n('save','Сохранить план одной транзакцией'),n('list','Суммировать продукты\nи вычесть домашние запасы'),n('compare','Рассчитать упаковки\nи сравнить полные корзины'),n('show','Показать магазин, сумму,\nдату цен и бюджет'),n('end','','doublecircle')],[e('start','settings'),e('settings','validate'),e('validate','error','[нет]'),e('error','settings'),e('validate','build','[да]'),e('build','ready'),e('ready','missing','[нет]'),e('missing','settings'),e('ready','save','[да]'),e('save','list'),e('list','compare'),e('compare','show'),e('show','end')]);
graphs.activity_alternative=base([n('start','','point'),n('open','Открыть блюдо и запросить замены'),n('filter','Проверить состав, время,\nтип приёма и лимит повторов'),n('exists','Есть варианты?','diamond'),n('none','Сообщить об отсутствии вариантов\nБлюдо оставить'),n('choose','Выбрать альтернативу'),n('confirm','Замена подтверждена?','diamond'),n('cancel','Закрыть без изменения плана'),n('update','Проверить владельца и ограничения\nСохранить новую позицию'),n('recalc','Пересчитать день, список и корзины'),n('end','','doublecircle')],[e('start','open'),e('open','filter'),e('filter','exists'),e('exists','none','[нет]'),e('none','end'),e('exists','choose','[да]'),e('choose','confirm'),e('confirm','cancel','[нет]'),e('cancel','end'),e('confirm','update','[да]'),e('update','recalc'),e('recalc','end')]);
graphs.activity_exception=base([n('start','','point'),n('request','Запросить обновление цен'),n('provider','Обратиться к PriceProvider'),n('ok','Источник ответил?','diamond'),n('update','Атомарно сохранить цены\nи дату набора'),n('keep','Оставить предыдущие цены\nОтветить 503 с кодом ошибки'),n('show','Показать сообщение и дату\nНе подставлять нулевые цены'),n('retry','Повторить запрос?','diamond'),n('end','','doublecircle')],[e('start','request'),e('request','provider'),e('provider','ok'),e('ok','update','[да]'),e('update','end'),e('ok','keep','[нет]'),e('keep','show'),e('show','retry'),e('retry','request','[да]'),e('retry','end','[нет]')]);
const tables={
 users:'id TEXT PK\nemail TEXT UNIQUE\npassword_hash TEXT\ncreated_at TEXT',
 sessions:'token_hash TEXT PK\nuser_id TEXT FK\nexpires_at REAL',
 login_attempts:'email TEXT PK(1)\nattempted_at REAL PK(2)',
 profiles:'user_id TEXT PK FK\nsettings_json TEXT',
 plans:'id TEXT PK\nuser_id TEXT FK\nstart_date TEXT\ndays INTEGER\nsettings_json TEXT\ncreated_at TEXT',
 plan_items:'id TEXT PK\nplan_id TEXT FK\nday INTEGER\nslot INTEGER\nrecipe_id TEXT FK\nscale REAL\nUNIQUE(plan_id, day, slot)',
 recipes:'id TEXT PK\nname TEXT\nmeal TEXT\nminutes INTEGER\ningredients_json TEXT\nsteps_json TEXT',
 ingredients:'id TEXT PK\nname TEXT\ncategory TEXT\nunit TEXT\nkcal REAL\nprotein REAL\nfat REAL\ncarbs REAL\nallergens_json TEXT',
 stores:'id TEXT PK\nname TEXT',
 offers:'id TEXT PK\nstore_id TEXT FK\ningredient_id TEXT FK\npack_size REAL\nprice_kopecks INTEGER\navailable INTEGER\nupdated_at TEXT\nsource TEXT\ncity TEXT',
 pantry:'user_id TEXT PK(1) FK\ningredient_id TEXT PK(2) FK\namount REAL\npurchased INTEGER'
};
graphs.er=base(Object.entries(tables).map(([id,attrs])=>n(id,id.toUpperCase()+'\n────────────\n'+attrs)),[['users','sessions'],['users','plans'],['plans','plan_items'],['recipes','plan_items'],['stores','offers'],['ingredients','offers'],['users','pantry'],['ingredients','pantry'],['users','profiles']].map(([a,b])=>e(a,b,'',{dir:'none',taillabel:'1',headlabel:b==='profiles'?'0..1':'0..*',labeldistance:2})).concat([e('recipes','ingredients','ссылки id в JSON\nбез SQL FK',{style:'dashed',dir:'none'})]),'LR');
graphs.er.nodeAttributes.fontsize=12;

(async()=>{
 fs.mkdirSync(out,{recursive:true});const viz=await instance();
 for(const [name,graph] of Object.entries(graphs)){
  fs.writeFileSync(path.join(out,name+'.json'),JSON.stringify(graph,null,2));
  fs.writeFileSync(path.join(out,name+'.dot'),viz.renderString(graph,{format:'canon'}));
  let svg=viz.renderString(graph,{format:'svg'});
  // Graphviz's actor placeholder is replaced by a proper UML stick figure.
  if(name==='usecase')svg=svg.replace(/(<g id="[^"]*" class="node">\s*<title>actor<\/title>)([\s\S]*?)(<\/g>)/,(_m,pre,inside,post)=>{const tx=inside.match(/<text[^>]*x="([\d.-]+)"[^>]*y="([\d.-]+)"/);if(!tx)return pre+inside+post;const xx=Number(tx[1]),yy=Number(tx[2])-78;return pre+`<circle cx="${xx}" cy="${yy}" r="10" fill="none" stroke="black"/><path d="M${xx},${yy+10}v27m-20,-20h40m-20,20 -17,20m17,-20 17,20" stroke="black" fill="none"/>`+inside+post;});
  fs.writeFileSync(path.join(out,name+'.svg'),svg);await sharp(Buffer.from(svg),{density:170}).png().toFile(path.join(out,name+'.png'));
  const layout=viz.renderJSON(graph),bb=layout.bb.split(',').map(Number),height=bb[3];
  let xml=`<?xml version="1.0" encoding="UTF-8"?><mxfile host="app.diagrams.net"><diagram name="${name}"><mxGraphModel pageWidth="${Math.ceil(bb[2]+50)}" pageHeight="${Math.ceil(height+50)}"><root><mxCell id="0"/><mxCell id="1" parent="0"/>`;
  const objects=layout.objects||[];
  for(const o of objects){if(o.name?.startsWith('cluster_')&&o.bb){const [a,b,c,d]=o.bb.split(',').map(Number);xml+=`<mxCell id="cluster" value="Fit Nutrition Supply" style="rounded=0;fillColor=none;verticalAlign=top;align=left;spacing=8;" vertex="1" parent="1"><mxGeometry x="${a+20}" y="${height-d+20}" width="${c-a}" height="${d-b}" as="geometry"/></mxCell>`;}}
  for(const o of objects){if(!o.pos)continue;const [cx,cy]=o.pos.split(',').map(Number),w=Number(o.width)*72,h=Number(o.height)*72;const shape=o.name==='actor'?'shape=umlActor;':o.shape==='ellipse'?'ellipse;':o.shape==='diamond'?'rhombus;':o.shape==='point'?'ellipse;fillColor=#000000;':o.shape==='doublecircle'?'shape=doubleEllipse;':'rounded=0;';xml+=`<mxCell id="n${o._gvid}" value="${x(o.label||'')}" style="${shape}whiteSpace=wrap;html=0;fontFamily=Times New Roman;fontSize=13;strokeColor=#000000;" vertex="1" parent="1"><mxGeometry x="${cx-w/2+20}" y="${height-cy-h/2+20}" width="${w}" height="${h}" as="geometry"/></mxCell>`;}
  for(const [i,ed] of (layout.edges||[]).entries()){const edgeLabel=ed.label||(ed.taillabel?`${ed.taillabel} : ${ed.headlabel}`:'');xml+=`<mxCell id="e${i}" value="${x(edgeLabel)}" source="n${ed.tail}" target="n${ed.head}" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=0;endArrow=${ed.arrowhead==='none'||ed.dir==='none'?'none':'open'};dashed=${ed.style==='dashed'?1:0};fontFamily=Times New Roman;fontSize=11;" edge="1" parent="1"><mxGeometry relative="1" as="geometry"/></mxCell>`;}
  xml+='</root></mxGraphModel></diagram></mxfile>';fs.writeFileSync(path.join(out,name+'.drawio'),xml);
 }
 await sharp(fs.readFileSync(path.join(out,'wireframes.svg')),{density:144}).png().toFile(path.join(out,'wireframes.png'));
 console.log('Generated structural, UML use case, 3 activity and ER diagrams in SVG, PNG, draw.io, DOT and JSON.');
})().catch(e=>{console.error(e);process.exit(1)});
