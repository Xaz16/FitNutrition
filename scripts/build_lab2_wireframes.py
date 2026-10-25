"""Editable draw.io wireframes and a matching SVG preview, no application code."""
from pathlib import Path
import xml.etree.ElementTree as ET
from xml.sax.saxutils import escape

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs/lab2/diagrams'
OUT.mkdir(parents=True,exist_ok=True)
W,H=1200,850
items=[];edges=[]
def box(x,y,w,h,text='',kind='box'):
 items.append((x,y,w,h,text,kind));return len(items)+1
def panel(x,y,title,n):
 box(x,y,370,360,'','panel');box(x+12,y+12,346,32,f'{n}. {title}','title')
 box(x+12,y+50,346,24,'Настройки   Меню   Список   Корзины','nav')
def field(x,y,w,label):box(x,y,w,32,label,'field')
panel(15,65,'Настройки',1)
field(30,155,160,'Город: Ижевск');field(200,155,170,'Период: 7 дней')
field(30,197,160,'Бюджет: 3 000 ₽');field(200,197,170,'Готовка: до 30 мин')
field(30,239,340,'Возраст, пол, рост, вес, активность')
field(30,281,340,'Исключения: арахис ×   + добавить')
box(30,325,340,30,'Ошибки показываются рядом с полем','hint')
box(30,370,340,35,'Составить меню →','button')
panel(415,65,'Меню',2)
box(430,152,340,28,'Пн  Вт  Ср  Чт  Пт  Сб  Вс','nav')
box(430,192,340,46,'Завтрак: овсяная каша   ·   Рецепт →','field')
box(430,248,340,46,'Обед: гречка с курицей   ·   Заменить','field')
box(430,304,340,46,'Ужин: овощи с рыбой   ·   Заменить','field')
box(430,367,340,35,'К списку продуктов →','button')
panel(815,65,'Рецепт и замена',3)
box(830,151,340,30,'Гречка с курицей · 25 мин · 1 порция','title')
box(830,193,340,62,'Ингредиенты и количества\nШаги приготовления\nКалории и БЖУ на порцию','field')
box(830,270,340,30,'Подходящие альтернативы:','hint')
box(830,308,340,34,'○ Рис с индейкой     ○ Другая замена','field')
box(830,369,160,34,'Отмена','field');box(1000,369,170,34,'Подтвердить','button')
panel(15,465,'Список продуктов',4)
box(30,552,340,35,'Овощи / крупы / молочные продукты','nav')
box(30,599,340,44,'□ Рис: нужно 700 г · дома [100 г]','field')
box(30,653,340,44,'☑ Молоко: уже куплено','field')
box(30,708,340,30,'После изменения запаса сумма обновится','hint')
box(30,770,340,35,'Сравнить корзины →','button')
panel(415,465,'Сравнение корзин',5)
box(430,551,340,28,'Тестовые цены · Ижевск · дата набора','hint')
box(430,590,340,36,'Магнит     2 800 ₽     Полная ✓','field')
box(430,633,340,36,'Лента        2 950 ₽     Полная','field')
box(430,676,340,36,'Другие сети →       Неполные отдельно','field')
box(430,722,340,30,'Бюджет 3 000 ₽ · осталось 200 ₽','hint')
box(430,768,340,36,'Состав корзины и целые упаковки →','button')
box(815,465,370,360,'','panel')
box(830,480,340,32,'Маршруты и состояния','title')
box(830,530,340,230,'Основной: 1 → 2 → 4 → 5\nЗамена: 2 → 3 → 2, пересчёт 4 и 5\n\nДополнительно: вход / регистрация\nПустой каталог → сообщение\nНеверный ввод → ошибки полей\nСбой цен → предыдущие данные с датой\nНеполная корзина ≠ самая выгодная\n\nЧерновик UI, ожидает согласования\nЧисла на схемах — примеры','hint')

svg=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">', '<rect width="100%" height="100%" fill="white"/>', '<text x="15" y="32" font-family="Arial" font-size="22" font-weight="bold">Fit Nutrition Supply · Предварительные экранные формы</text>']
root=ET.Element('mxfile',host='app.diagrams.net');diagram=ET.SubElement(root,'diagram',name='Wireframes');model=ET.SubElement(diagram,'mxGraphModel',pageWidth=str(W),pageHeight=str(H));mxroot=ET.SubElement(model,'root');ET.SubElement(mxroot,'mxCell',id='0');ET.SubElement(mxroot,'mxCell',id='1',parent='0')
for i,(x,y,w,h,text,kind) in enumerate(items,2):
 fill={'panel':'#ffffff','button':'#e5e7eb','field':'#f9fafb','nav':'#f0f1f2'}.get(kind,'white')
 stroke='#222' if kind not in ('hint','title') else 'none'
 svg.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{fill}" stroke="{stroke}"/>')
 lines=text.split('\n')
 for j,line in enumerate(lines):
  yy=y+(h-(len(lines)-1)*21)/2+5+j*21
  svg.append(f'<text x="{x+8}" y="{yy}" font-family="Arial" font-size="{15 if kind=="title" else 13}" font-weight="{"bold" if kind in ("title","button") else "normal"}">{escape(line)}</text>')
 cell=ET.SubElement(mxroot,'mxCell',id=str(i),value=text,style=f'rounded=0;whiteSpace=wrap;html=0;align=left;spacingLeft=8;fillColor={fill};strokeColor={stroke};fontSize=13;',vertex='1',parent='1')
 ET.SubElement(cell,'mxGeometry',x=str(x),y=str(y),width=str(w),height=str(h),attrib={'as':'geometry'})
svg.append('</svg>')
(OUT/'wireframes.svg').write_text('\n'.join(svg),encoding='utf-8')
ET.ElementTree(root).write(OUT/'wireframes.drawio',encoding='utf-8',xml_declaration=True)
print(OUT)
