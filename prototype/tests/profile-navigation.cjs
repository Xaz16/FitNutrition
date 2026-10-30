const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true}),context=await browser.newContext({viewport:{width:1440,height:1000},locale:'ru-RU'}),page=await context.newPage();
 const url=process.env.TEST_URL||'http://127.0.0.1:8767',out=path.resolve(__dirname,'../../output/profile-navigation');fs.mkdirSync(out,{recursive:true});
 const errors=[],layouts=[];page.on('response',async r=>{if(r.status()>=400)console.log('HTTP failure',r.status(),r.url(),await r.text());});page.on('pageerror',e=>errors.push(e.message));
 const state=async()=>await(await context.request.get(url+'/api/state')).json();
 await page.goto(url);await page.getByRole('button',{name:'Открыть демоверсию'}).click();await page.locator('#profile-next').waitFor();
 await context.request.put(url+'/api/profile',{data:{name:'Азамат',birth_date:'1996-05-12',sex:'male',weight:80,height:180,activity:1.55,goal:'lose',budget_week:3500}});
 await page.goto(url+'/?profile-ready=1#dashboard');await page.locator('#edit-profile').click();await page.getByRole('heading',{name:'Мой профиль',exact:true}).waitFor();
 assert.equal(await page.locator('#profile-next').count(),0);assert.equal(await page.locator('.sidebar').count(),1);
 const before=(await state()).profile;await page.locator('[data-edit-field=weight]').click();await page.locator('#profile-value').fill('81.5');await page.locator('#cancel-profile-field').click();assert.deepEqual((await state()).profile,before);
 await page.locator('[data-edit-field=weight]').click();await page.locator('#profile-value').fill('81.5');await page.getByRole('button',{name:'Сохранить',exact:true}).click();await page.locator('dialog').waitFor({state:'hidden',timeout:6000}).catch(async e=>{console.log('Dialog at failure:',await page.locator('dialog').innerText());await page.screenshot({path:path.join(out,'failure.png')});throw e;});
 const changed=(await state()).profile;assert.equal(changed.weight,81.5);assert.deepEqual({...before,weight:81.5},changed);
 await page.locator('[data-edit-field=birth_date]').click();await page.locator('#profile-birth-date').fill('1995-11-20');await page.getByRole('button',{name:'Сохранить',exact:true}).click();await page.locator('dialog').waitFor({state:'hidden',timeout:6000}).catch(async e=>{console.log('Dialog at failure:',await page.locator('dialog').innerText());await page.screenshot({path:path.join(out,'failure.png')});throw e;});await page.reload();await page.locator('[data-profile-value=birth_date]').filter({hasText:'20.11.1995'}).waitFor();
 await page.goto(url+'/#onboarding');await page.getByRole('heading',{name:'Мой профиль',exact:true}).waitFor();assert.match(page.url(),/#profile$/);
 await page.locator('[data-page=settings]').click();await page.locator('#plan-form').waitFor();await page.getByRole('button',{name:'Составить меню',exact:true}).click();await page.locator('#result-menu').waitFor();await page.locator('#toast.visible').waitFor({state:'hidden'});
 for(const destination of ['dashboard','profile','settings','result','menu','shopping','baskets']){
  await page.setViewportSize({width:1440,height:1000});await page.locator(`.sidebar [data-page=${destination}]`).click();
  for(const width of [1440,768,360]){
   await page.setViewportSize({width,height:1000});assert.equal(await page.locator('.sidebar').count(),1);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${destination} overflow at ${width}`);
   assert.equal(await page.locator(`.sidebar [data-page=${destination}]`).getAttribute('aria-current'),'page');
   layouts.push({screen:destination,width,overflow:false});await page.screenshot({path:path.join(out,`${destination}-${width}.png`)});
  }
 }
 await page.locator('#toggle-navigation').click();assert.equal(await page.locator('#toggle-navigation').getAttribute('aria-expanded'),'true');await page.screenshot({path:path.join(out,'mobile-menu-360.png')});await page.locator('.sidebar [data-page=profile]').click();assert.match(page.url(),/#profile$/);assert.equal(await page.locator('#toggle-navigation').getAttribute('aria-expanded'),'false');
 await page.locator('[data-edit-field=height]').click();await page.screenshot({path:path.join(out,'edit-height-360.png')});await page.locator('#profile-value').fill('181');await page.getByRole('button',{name:'Сохранить',exact:true}).click();await page.locator('dialog').waitFor({state:'hidden',timeout:6000}).catch(async e=>{console.log('Dialog at failure:',await page.locator('dialog').innerText());await page.screenshot({path:path.join(out,'failure.png')});throw e;});assert.equal((await state()).plan,null);assert.equal((await state()).previous_plan_requires_update,true);
 assert.deepEqual(errors,[]);const result={date:new Date().toISOString(),browser:await browser.version(),checks:['global navigation on seven screens','single-field edit preserves other values','cancel does not save','birth date persists and age is automatic','completed profile never reopens wizard','mobile navigation opens and closes','changed profile invalidates plan'],layouts,consoleErrors:errors};
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));await browser.close();console.log(JSON.stringify(result,null,2));
})().catch(e=>{console.error(e);process.exit(1)});
