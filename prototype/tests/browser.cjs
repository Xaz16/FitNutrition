const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs');const path=require('node:path');
(async()=>{
 const output=path.resolve(__dirname,'../../tmp/lab2/browser-qa');fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'ru-RU'});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const url=process.env.TEST_URL||'http://127.0.0.1:8765';
 await page.goto(url);await page.getByRole('button',{name:'Открыть демоверсию'}).waitFor();
 await page.screenshot({path:path.join(output,'auth.png'),fullPage:true});
 await page.getByRole('button',{name:'Открыть демоверсию'}).click();await page.locator('#settings-form').waitFor();
 await page.screenshot({path:path.join(output,'settings.png'),fullPage:true});
 await page.locator('#settings-form button[type=submit]').click();await page.getByRole('heading',{name:'Меню без лишних решений'}).waitFor();
 if(await page.locator('.meal').count()!==3)throw Error('Wrong meal count');
 await page.screenshot({path:path.join(output,'menu.png'),fullPage:true});
 await page.getByRole('button',{name:'Заменить ↗'}).first().click();await page.locator('#replace-form').waitFor();
 await page.screenshot({path:path.join(output,'recipe.png'),fullPage:true});
 await page.getByRole('button',{name:'Подтвердить замену'}).click();await page.locator('dialog').waitFor({state:'hidden'});
 await page.getByRole('button',{name:'Список покупок',exact:true}).click();await page.getByRole('heading',{name:/На 7 дней/}).waitFor();
 await page.locator('[data-stock]').first().fill('100');await page.locator('[data-stock]').first().press('Tab');await page.waitForTimeout(300);
 await page.screenshot({path:path.join(output,'shopping.png'),fullPage:true});
 await page.getByRole('button',{name:'Сравнить корзины',exact:true}).click();await page.locator('.store').first().waitFor();
 if(await page.locator('.store').count()!==5)throw Error('Five stores expected');
 await page.screenshot({path:path.join(output,'baskets.png'),fullPage:true});
 const before=await page.locator('.store-price').allTextContents();await page.getByRole('button',{name:'Показать сбой источника'}).click();await page.locator('#page-error').filter({hasText:'Предыдущие цены сохранены'}).waitFor();
 const after=await page.locator('.store-price').allTextContents();if(JSON.stringify(before)!==JSON.stringify(after))throw Error('Failure changed basket');
 await page.reload();await page.getByRole('heading',{name:'Меню без лишних решений'}).waitFor();
 const layouts=[];
 for(const width of [360,768,1920]){
  await page.setViewportSize({width,height:1000});
  for(const [screen,label] of [['settings','Мои настройки'],['menu','Меню на неделю'],['shopping','Список покупок'],['baskets','Сравнить корзины']]){
   await page.getByRole('button',{name:label,exact:true}).click();
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
   layouts.push({width,screen,overflow});if(overflow)throw Error(`Horizontal overflow ${screen} ${width}`);
   await page.screenshot({path:path.join(output,`${screen}-${width}.png`),fullPage:true});
  }
 }
 // Verify that protected state is not exposed to another browser session.
 const isolated=await browser.newContext();const response=await isolated.request.get(url+'/api/state');if(response.status()!==401)throw Error('Auth isolation failed');await isolated.close();
 const report={browser:await browser.version(),date:new Date().toISOString(),layouts,consoleErrors:errors,checks:['demo','generate','replace','pantry','five stores','price failure retains data','reload persists plan','anonymous denied']};
 fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(report,null,2));await browser.close();
 if(errors.length)throw Error(errors.join('\n'));console.log(JSON.stringify(report,null,2));
})().catch(e=>{console.error(e);process.exit(1)});
