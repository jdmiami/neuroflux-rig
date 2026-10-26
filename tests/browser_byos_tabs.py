import functools,http.server,threading
from playwright.sync_api import sync_playwright
from browser_camera_fx import Handler,ROOT
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT/'public')))
threading.Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 page=b.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,service_workers='block');errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(f'http://127.0.0.1:{server.server_port}/',wait_until='domcontentloaded');page.wait_for_function('window.NFXStudio?.storageReady')
 page.locator('#startBYOS').click();page.wait_for_function('!document.getElementById("start")')
 assert not page.locator('#tabs').is_visible()
 assert page.locator('#nfxBYOSTabs button').all_text_contents()==['Starter']
 page.evaluate("NFXRig.guideOpen('color')")
 assert page.evaluate('NFXRig.guideState().ui.page')=='quick'
 page.screenshot(path='/workspace/Neuroflux-BYOS-Starter-Only.png')
 page.locator('[data-byos=library]').click();page.locator('[data-library-kind=categories]').click()
 page.locator('[data-add-tool="category:color"]').click()
 assert page.locator('#nfxBYOSTabs button').all_text_contents()==['Starter','Color']
 assert page.locator('.byos-control').count()==0
 page.locator('[data-byos=library]').click();page.locator('[data-library-kind=tools]').click()
 page.locator('#nfxBYOSLibrary input').fill('hue');page.locator('[data-add-tool=hue]').click()
 assert page.locator('.byos-native .hc[data-id=hue]').is_visible()
 page.locator('[data-byos-tab=starter]').click();assert page.locator('.byos-control').count()==0
 page.locator('[data-byos-tab=color]').click();assert page.locator('.byos-native .hc[data-id=hue]').is_visible()
 page.locator('#btnQuickSave').click();page.wait_for_function('NFXPerformance.saved.length===2')
 saved=page.evaluate('NFXPerformance.saved.at(-1)');assert saved['preferences']['byosTabs']==['color'] and saved['preferences']['byosEnabled']
 page.evaluate('NFXPerformance.byos.tabs=[]');page.evaluate('NFXPerformance.apply(NFXPerformance.saved.at(-1))')
 assert page.locator('#nfxBYOSTabs button').all_text_contents()==['Starter','Color']
 page.locator('[data-byos-tab=color]').click();page.locator('[data-byos=remove-tab]').click()
 assert page.locator('#nfxBYOSTabs button').all_text_contents()==['Starter']
 assert page.locator('.byos-native .hc[data-id=hue]').is_visible()
 page.evaluate("NFXPerformance.byos.add('category:recording')")
 assert page.evaluate('NFXRig.guideState().ui.page')=='recording'
 page.locator('[data-byos-tab=starter]').click()
 page.locator('[data-byos=exit]').click();assert page.locator('#tabs').is_visible()
 assert not errors,errors
 print('PASS starter only, native route isolation, category creation, chosen tools only, tab switching/removal, saved tab restore, explicit recording tab and full studio exit')
 b.close()
server.shutdown()
