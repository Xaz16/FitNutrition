"""Generate editable entry-flow and four-screen wireframes, SVG and draw.io."""
from pathlib import Path
from xml.sax.saxutils import escape
import xml.etree.ElementTree as ET

OUT=Path(__file__).resolve().parents[1]/'docs/lab2/diagrams'
class Diagram:
 def __init__(self,w,h,title):
  self.w=w;self.h=h;self.nodes=[];self.edges=[];self.title=title
 def box(self,x,y,w,h,text='',kind='box'):
  self.nodes.append((x,y,w,h,text,kind));return 'n'+str(len(self.nodes))
 def edge(self,source,target,points,label=''):
  self.edges.append((source,target,points,label))
 def save(self,name):
  svg=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.w}" height="{self.h}" viewBox="0 0 {self.w} {self.h}"><defs><marker id="arrow" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto"><path d="M0 0L9 4L0 8" fill="none" stroke="black"/></marker></defs><rect width="100%" height="100%" fill="white"/>',f'<text x="25" y="32" font-family="Times New Roman" font-size="23" font-weight="bold">{escape(self.title)}</text>']
  root=ET.Element('mxfile',host='app.diagrams.net');diagram=ET.SubElement(root,'diagram',name=self.title);graph=ET.SubElement(diagram,'mxGraphModel',pageWidth=str(self.w),pageHeight=str(self.h));cells=ET.SubElement(graph,'root');ET.SubElement(cells,'mxCell',id='0');ET.SubElement(cells,'mxCell',id='1',parent='0')
  for index,(x,y,w,h,text,kind) in enumerate(self.nodes,1):
   fill='#ededed' if kind in ('button','chosen') else 'white'
   if kind=='diamond':svg.append(f'<polygon points="{x+w/2},{y} {x+w},{y+h/2} {x+w/2},{y+h} {x},{y+h/2}" fill="white" stroke="black"/>')
   elif kind not in ('text','title'):svg.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{fill}" stroke="black"/>')
   lines=text.split('\n');font=18 if kind=='title' else 14
   for j,line in enumerate(lines):svg.append(f'<text x="{x+w/2}" y="{y+h/2-(len(lines)-1)*9+5+j*18}" text-anchor="middle" font-family="Times New Roman" font-size="{font}" font-weight="{"bold" if kind in ("title","button") else "normal"}">{escape(line)}</text>')
   style=('rhombus;' if kind=='diamond' else 'rounded=0;')+f'whiteSpace=wrap;html=0;fontFamily=Times New Roman;fontSize={font};fillColor={fill};strokeColor={"none" if kind in ("text","title") else "#000000"};'
   node=ET.SubElement(cells,'mxCell',id='n'+str(index),value=text,style=style,vertex='1',parent='1');ET.SubElement(node,'mxGeometry',x=str(x),y=str(y),width=str(w),height=str(h),attrib={'as':'geometry'})
  for index,(source,target,points,label) in enumerate(self.edges):
   svg.append('<polyline points="'+' '.join(f'{a},{b}' for a,b in points)+'" fill="none" stroke="black" marker-end="url(#arrow)"/>')
   if label:
    start,end=max(zip(points,points[1:]),key=lambda pair:abs(pair[1][0]-pair[0][0])+abs(pair[1][1]-pair[0][1]))
    a,b=(start[0]+end[0])/2,(start[1]+end[1])/2;vertical=start[0]==end[0]
    svg.append(f'<text x="{a+8 if vertical else a}" y="{b-9}" text-anchor="{"start" if vertical else "middle"}" font-family="Times New Roman" font-size="13">{escape(label)}</text>')
   attr={'id':'e'+str(index),'value':label,'style':'edgeStyle=orthogonalEdgeStyle;endArrow=open;html=0;fontFamily=Times New Roman;fontSize=13;','edge':'1','parent':'1'}
   if source:attr['source']=source
   if target:attr['target']=target
   cell=ET.SubElement(cells,'mxCell',**attr);geom=ET.SubElement(cell,'mxGeometry',relative='1',attrib={'as':'geometry'});ET.SubElement(geom,'mxPoint',x=str(points[0][0]),y=str(points[0][1]),attrib={'as':'sourcePoint'});ET.SubElement(geom,'mxPoint',x=str(points[-1][0]),y=str(points[-1][1]),attrib={'as':'targetPoint'})
   arr=ET.SubElement(geom,'Array',attrib={'as':'points'})
   for a,b in points[1:-1]:ET.SubElement(arr,'mxPoint',x=str(a),y=str(b))
  svg.append('</svg>');OUT.mkdir(parents=True,exist_ok=True);(OUT/f'{name}.svg').write_text('\n'.join(svg),encoding='utf-8');ET.ElementTree(root).write(OUT/f'{name}.drawio',encoding='utf-8',xml_declaration=True)

d=Diagram(1220,600,'Fit Nutrition Supply: поток входа')
register=d.box(30,110,220,85,'Регистрация\nИмя, email, пароль')
onboard=d.box(340,110,220,85,'Обязательный профиль\n3 шага + сводка')
dash=d.box(650,110,220,85,'Дашборд\nПриветствие и профиль')
plan=d.box(960,110,220,85,'Настройте ваш план\nМеню + расчёт корзины')
d.edge(register,onboard,[(250,152),(340,152)])
d.edge(onboard,dash,[(560,152),(650,152)],'Сохранить')
d.edge(dash,plan,[(870,152),(960,152)])
d.edge(plan,dash,[(1070,195),(1070,265),(760,265),(760,195)],'На главную')
login=d.box(30,350,220,70,'Повторный вход')
check=d.box(340,320,220,130,'Профиль\nсохранён?','diamond')
d.edge(login,check,[(250,385),(340,385)])
d.edge(check,onboard,[(450,320),(450,195)],'Нет')
d.edge(check,dash,[(560,385),(760,385),(760,195)],'Да')
d.box(850,340,330,110,'Прямой переход к плану\nбез профиля запрещён\nв интерфейсе и в API','text')
d.box(30,490,1150,75,'Профиль хранится отдельно в SQLite. Черновик шагов хранится в браузере по аккаунту.\nВозврат и перезагрузка не стирают черновик. План сохраняет снимок параметров.','text')
d.save('entry_flow')

d=Diagram(1260,1000,'Fit Nutrition Supply: онбординг профиля')
for index,(x,y) in enumerate([(25,70),(655,70),(25,530),(655,530)],1):
 d.box(x,y,580,420,'');d.box(x+15,y+10,550,30,f'Шаг {index} из 4','title')
 for bar in range(4):d.box(x+20+bar*140,y+47,130,4,'','chosen' if bar<index else 'box')
 if index==1:
  d.box(x+20,y+65,540,28,'Базовые параметры','title');d.box(x+20,y+110,90,35,'М','chosen');d.box(x+120,y+110,90,35,'Ж')
  for j,(label,value,limits) in enumerate([('Возраст','30 лет','14-90'),('Вес','80,5 кг','40-200, шаг 0,5'),('Рост','180 см','140-220, шаг 1')]):
   yy=y+165+j*63;d.box(x+20,yy,270,25,label,'text');d.box(x+400,yy,140,25,value,'title');d.box(x+25,yy+34,520,3,'');d.box(x+180,yy+28,12,15,'','chosen');d.box(x+20,yy+36,230,18,limits,'text')
 elif index==2:
  d.box(x+20,y+65,540,28,'Активность и цель','title')
  for j,(title,sub) in enumerate([('Низкая','Сидячий день'),('Лёгкая','1-3 тренировки в неделю'),('Средняя','3-5 тренировок в неделю'),('Высокая','Активная работа')]):d.box(x+20,y+103+j*49,540,42,f'○ {title}: {sub}','chosen' if j==1 else 'box')
  for j,label in enumerate(['Похудение','Поддержание','Набор']):d.box(x+20+j*183,y+315,174,40,label,'chosen' if j==0 else 'box')
 elif index==3:
  d.box(x+20,y+65,540,28,'Ограничения: можно пропустить','title')
  d.box(x+20,y+106,540,75,'Аллергии: множественный выбор\n□ Молоко   □ Рыба   □ Арахис   □ Другое')
  d.box(x+20,y+193,540,65,'Предпочтения\n□ Без мяса   □ Без рыбы   □ Без молочного')
  d.box(x+20,y+278,300,25,'Бюджет на неделю','text');d.box(x+380,y+278,180,25,'Не указан','title');d.box(x+25,y+321,520,3,'');d.box(x+20,y+333,540,20,'500-10000 ₽, шаг 100','text')
 else:
  d.box(x+20,y+65,540,28,'Проверьте профиль','title')
  for j,(title,sub) in enumerate([('Параметры','Пол, возраст, вес, рост'),('Активность и цель','Выбранные активность и цель'),('Ограничения','Аллергии, предпочтения, бюджет')]):
   yy=y+105+j*81;d.box(x+20,yy,530,70,title+'\n'+sub);d.box(x+415,yy+2,125,24,'Изменить','text')
  d.box(x+557,y+106,4,231,'','chosen')
 if index>1:d.box(x+20,y+372,110,32,'Назад')
 d.box(x+330,y+372,230,32,'Сохранить профиль' if index==4 else 'Далее','button')
d.save('onboarding_screens')
print(OUT)
