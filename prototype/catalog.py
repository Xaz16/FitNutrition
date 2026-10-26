"""Educational fixtures: quantities, nutrition and prices are demonstration data."""
import json
from datetime import datetime, timezone

ALLERGENS=['глютен','ракообразные','яйца','рыба','арахис','соя','молоко','орехи','сельдерей','горчица','кунжут','сульфиты','люпин','моллюски']
# Nutrition per 100 g, or per piece where unit is шт. Rounded educational values.
INGREDIENTS=[
 ('oats','Овсяные хлопья','Крупы','г',366,12,6,62,['глютен']),
 ('rice','Рис','Крупы','г',344,7,1,78,[]),
 ('buckwheat','Гречка','Крупы','г',343,13,3,62,[]),
 ('pasta','Макароны','Крупы','г',350,12,2,70,['глютен']),
 ('milk','Молоко','Молочные продукты','мл',52,3,2.5,5,['молоко']),
 ('curd','Творог','Молочные продукты','г',121,17,5,3,['молоко']),
 ('yogurt','Йогурт','Молочные продукты','г',60,4,2,6,['молоко']),
 ('egg','Яйца','Белковые продукты','шт',72,6.3,4.8,.4,['яйца']),
 ('chicken','Куриное филе','Белковые продукты','г',110,23,2,0,[]),
 ('turkey','Индейка','Белковые продукты','г',114,24,2,0,[]),
 ('fish','Минтай','Белковые продукты','г',72,16,1,0,['рыба']),
 ('lentils','Чечевица','Крупы','г',310,24,1,50,[]),
 ('potato','Картофель','Овощи','г',77,2,.1,17,[]),
 ('carrot','Морковь','Овощи','г',35,1,.1,7,[]),
 ('cabbage','Капуста','Овощи','г',27,2,.1,5,[]),
 ('tomato','Помидоры','Овощи','г',20,1,.2,4,[]),
 ('cucumber','Огурцы','Овощи','г',15,1,.1,3,[]),
 ('broccoli','Брокколи','Овощи','г',34,3,.4,7,[]),
 ('apple','Яблоки','Фрукты','г',52,.3,.2,14,[]),
 ('banana','Бананы','Фрукты','г',89,1,.3,23,[]),
 ('berries','Ягоды','Фрукты','г',45,1,.5,10,[]),
 ('oil','Растительное масло','Бакалея','мл',828,0,92,0,[]),
 ('bread','Цельнозерновой хлеб','Бакалея','г',230,8,3,43,['глютен']),
 ('nuts','Грецкие орехи','Бакалея','г',654,15,65,14,['орехи']),
 ('peanut','Арахис','Бакалея','г',567,26,49,16,['арахис']),
]
# Each tuple represents one base serving, scaled by the planner to meal energy.
RECIPES=[
 ('Овсянка с яблоком','breakfast',15,{'oats':60,'milk':180,'apple':100}),
 ('Овсянка с бананом','breakfast',12,{'oats':60,'milk':150,'banana':100}),
 ('Творог с ягодами','breakfast',5,{'curd':180,'berries':100,'oats':25}),
 ('Омлет с помидорами','breakfast',15,{'egg':2,'tomato':120,'bread':60,'oil':5}),
 ('Рисовая каша','breakfast',25,{'rice':65,'milk':180,'apple':80}),
 ('Гречка с яйцом','breakfast',20,{'buckwheat':65,'egg':1,'oil':5}),
 ('Тост с творогом','breakfast',8,{'bread':90,'curd':120,'cucumber':100}),
 ('Йогурт с хлопьями','breakfast',5,{'yogurt':200,'oats':60,'berries':80}),
 ('Гречка с курицей','lunch',25,{'buckwheat':80,'chicken':160,'carrot':80,'oil':10}),
 ('Рис с индейкой','lunch',30,{'rice':80,'turkey':160,'tomato':100,'oil':8}),
 ('Макароны с курицей','lunch',25,{'pasta':85,'chicken':150,'tomato':120,'oil':8}),
 ('Чечевица с овощами','lunch',30,{'lentils':90,'carrot':100,'tomato':100,'oil':10}),
 ('Рыба с картофелем','lunch',30,{'fish':180,'potato':250,'cucumber':100,'oil':10}),
 ('Рис с яйцом','lunch',20,{'rice':85,'egg':2,'carrot':80,'oil':8}),
 ('Гречка с индейкой','lunch',25,{'buckwheat':80,'turkey':150,'cabbage':120,'oil':8}),
 ('Тёплый салат с курицей','lunch',25,{'chicken':180,'potato':200,'tomato':150,'oil':10}),
 ('Минтай с брокколи','dinner',25,{'fish':180,'broccoli':180,'rice':55,'oil':10}),
 ('Индейка с овощами','dinner',25,{'turkey':160,'cabbage':180,'buckwheat':55,'oil':10}),
 ('Курица с рисом','dinner',30,{'chicken':160,'rice':65,'cucumber':150,'oil':8}),
 ('Овощное рагу с чечевицей','dinner',30,{'lentils':70,'potato':150,'carrot':120,'oil':10}),
 ('Омлет с брокколи','dinner',20,{'egg':2,'broccoli':160,'bread':70,'oil':8}),
 ('Рыба с гречкой','dinner',25,{'fish':180,'buckwheat':70,'tomato':150,'oil':10}),
 ('Индейка с макаронами','dinner',25,{'turkey':160,'pasta':70,'tomato':150,'oil':8}),
 ('Творог с овощами и тостом','dinner',10,{'curd':200,'bread':80,'cucumber':150,'oil':5}),
 ('Йогурт и яблоко','snack',3,{'yogurt':150,'apple':150}),
 ('Банан и орехи','snack',3,{'banana':120,'nuts':15}),
 ('Творог с яблоком','snack',5,{'curd':100,'apple':120}),
 ('Ягодный йогурт','snack',3,{'yogurt':180,'berries':100}),
 ('Хлебец с яйцом','snack',12,{'bread':35,'egg':1,'cucumber':80}),
 ('Яблоко с арахисом','snack',3,{'apple':150,'peanut':20}),
 ('Йогурт с бананом','snack',3,{'yogurt':150,'banana':80}),
 ('Творог с ягодами на перекус','snack',3,{'curd':100,'berries':80}),
 ('Морковь с орехами','snack',5,{'carrot':150,'nuts':20}),
 ('Тост с огурцом','snack',5,{'bread':50,'cucumber':120,'oil':5}),
]
STORES=[('lenta','Лента'),('auchan','Ашан'),('perekrestok','Перекрёсток'),('pyaterochka','Пятёрочка'),('magnit','Магнит')]

def seed(db):
 if db.execute('SELECT COUNT(*) FROM recipes').fetchone()[0]:return
 db.executemany('INSERT INTO ingredients VALUES (?,?,?,?,?,?,?,?,?)',[(a,b,c,d,e,f,g,h,json.dumps(i,ensure_ascii=False)) for a,b,c,d,e,f,g,h,i in INGREDIENTS])
 for i,(name,meal,minutes,ingredients) in enumerate(RECIPES):
  steps=['Подготовьте и отмерьте ингредиенты.','Приготовьте крупу или основной продукт до готовности; овощи вымойте и нарежьте.','Соедините компоненты и разделите на нужное число порций.']
  db.execute('INSERT INTO recipes VALUES (?,?,?,?,?,?)',(f'r{i+1:02}',name,meal,minutes,json.dumps(ingredients),json.dumps(steps,ensure_ascii=False)))
 db.executemany('INSERT INTO stores VALUES (?,?)',STORES)
 updated=datetime.now(timezone.utc).isoformat()
 for si,(store,_) in enumerate(STORES):
  for ii,ing in enumerate(INGREDIENTS):
   ident,_,_,unit,*_=ing
   pack=10 if unit=='шт' else 900 if unit=='мл' else 500
   price=(8500+(ii*1739)%24000)*(1+(.04*si))+((ii+si)%3)*1200
   available=not (store=='auchan' and ident in ('fish','nuts'))
   db.execute('INSERT INTO offers VALUES (?,?,?,?,?,?,?,?,?)',(f'{store}-{ident}',store,ident,pack,round(price),int(available),updated,'Демонстрационный набор, не цены магазинов','Ижевск'))
