const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'ru-RU'}),page=await context.newPage();
 const out=path.resolve(__dirname,'../../tmp/onboarding-qa');fs.mkdirSync(out,{recursive:true});
 const errors=[],layouts=[];page.on('pageerror',e=>errors.push(e.message));
 const url=process.env.TEST_URL||'http://127.0.0.1:8766';
 async function capture(name){for(const width of [360,768,1440]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`Overflow ${name} ${width}`);layouts.push({screen:name,width,overflow:false});await page.screenshot({path:path.join(out,`${name}-${width}.png`),fullPage:true});}}
 async function range(id,value){await page.locator('#profile-'+id).evaluate((el,v)=>{el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));},String(value));}
 await page.goto(url);await page.getByRole('button',{name:'Регистрация',exact:true}).click();
 await page.locator('#name').fill('Азамат');await page.locator('#email').fill(`onboarding-${Date.now()}@example.org`);await page.locator('#password').fill('Test-password-123');await page.getByRole('button',{name:'Создать аккаунт →'}).click();
 await page.getByRole('heading',{name:'Настройте ваш профиль'}).waitFor();assert.equal(await page.locator('#profile-next').isDisabled(),true);
 // A direct URL cannot skip onboarding.
 await page.goto(url+'/#settings');await page.getByRole('heading',{name:'Настройте ваш профиль'}).waitFor();assert.match(page.url(),/#onboarding$/);
 await page.getByText('М',{exact:true}).click();await page.locator('#profile-birth-date').fill('1996-05-12');await range('weight',80.5);await range('height',180);assert.equal(await page.locator('#profile-next').isEnabled(),true);
 await capture('step1');await page.locator('#profile-next').click();assert.equal(await page.locator('#profile-next').isDisabled(),true);
 await page.getByText('Средняя',{exact:true}).click();await page.getByText('Похудение',{exact:true}).click();await capture('step2');
 await page.reload();await page.getByText('Шаг 2 из 4',{exact:true}).waitFor();await page.locator('#profile-prev').click();assert.match(await page.locator('#value-weight').innerText(),/80,5/);await page.locator('#profile-next').click();assert.equal(await page.locator('input[name=goal][value=lose]').isChecked(),true);await page.locator('#profile-next').click();
 assert.equal(await page.locator('#profile-next').isEnabled(),true);
 await page.locator('#has-other-allergy').check();await page.locator('#other-allergies').fill('яблоки');await range('budget_week',10000);await page.locator('#profile-prev').click();await page.locator('#profile-next').click();assert.equal(await page.locator('#has-other-allergy').isChecked(),true);assert.equal(await page.locator('#other-allergies').inputValue(),'яблоки');assert.match(await page.locator('#value-budget_week').innerText(),/10/);
 await page.locator('#has-other-allergy').uncheck();await page.locator('#clear-budget').click();
 await capture('step3');await page.locator('#profile-next').click();await capture('step4');
 await page.locator('[data-edit-step="2"]').click();await page.getByText('Лёгкая',{exact:true}).click();await page.getByRole('button',{name:'К сводке'}).click();assert.match(await page.locator('.profile-review').innerText(),/Лёгкая/);
 await page.getByRole('button',{name:'Сохранить профиль'}).click();await page.getByRole('heading',{name:'Здравствуйте, Азамат!'}).waitFor();await capture('dashboard');
 const profile=(await (await context.request.get(url+'/api/state')).json()).profile;
 assert.equal(profile.budget_week,null);assert.deepEqual(profile.allergens,[]);
 await page.getByRole('button',{name:/Настройте ваш план/}).click();await page.getByRole('button',{name:'Составить меню',exact:true}).click();await page.locator('#result-menu').waitFor();assert.equal((await(await context.request.get(url+'/api/state')).json()).baskets.length,5);await capture('plan');
 assert.deepEqual((await (await context.request.get(url+'/api/state')).json()).profile,profile);
 await page.locator('#back-home').click();await page.locator('#edit-profile').click();await page.getByRole('heading',{name:'Мой профиль',exact:true}).waitFor();await page.locator('[data-edit-field=weight]').click();await page.locator('#profile-value').fill('81');await page.getByRole('button',{name:'Сохранить',exact:true}).click();await page.locator('dialog').waitFor({state:'hidden'});
 const edited=await(await context.request.get(url+'/api/state')).json();assert.equal(edited.profile.weight,81);assert.equal(edited.plan,null);assert.equal(edited.previous_plan_requires_update,true);
 assert.deepEqual(errors,[]);const result={browser:await browser.version(),date:new Date().toISOString(),checks:['registration name','onboarding guard','required steps','back retains values','reload retains draft','optional step skipped','summary editing','dashboard redirect','inline baskets','profile independent from plan','stale plan retained safely'],layouts,consoleErrors:errors};fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));await browser.close();console.log(JSON.stringify(result,null,2));
})().catch(e=>{console.error(e);process.exit(1)});
