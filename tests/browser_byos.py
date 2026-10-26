import functools,http.server,threading
from playwright.sync_api import sync_playwright
from browser_camera_fx import Handler,ROOT
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT/'public')))
threading.Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 page=browser.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,service_workers='block'); errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(f'http://127.0.0.1:{server.server_port}/',wait_until='domcontentloaded')
 page.wait_for_function('window.NFXPerformance?.byos&&window.NFXStudio?.storageReady')
 page.locator('#startBYOS').click()
 page.wait_for_function('!document.getElementById("start")')
 assert page.evaluate('NFXPerformance.byos.source')=='blank'
 assert page.evaluate('NFXPerformance.state.nodes.length')==0
 assert page.evaluate('NFXPerformance.byos.layout')==[]
 page.screenshot(path='/workspace/Neuroflux-BYOS-Blank.png')
 # Sources are explicit; adding a filter alone leaves the canvas blank.

 page.evaluate("NFXRig.guideOpen('quick')")
 page.locator('[data-byos=library]').click()
 page.locator('#nfxBYOSLibrary input').fill('kaleidoscope')
 page.locator('[data-add-tool="camera:kaleidoscope"]').click()
 assert page.evaluate('NFXPerformance.state.nodes[0].effect')=='kaleidoscope'
 assert page.evaluate('NFXPerformance.byos.source')=='blank'
 page.evaluate("NFXPerformance.byos.add('source:synth')")
 assert page.evaluate('NFXPerformance.byos.source')=='synth'
 page.evaluate('NFXPerformance.byos.restore([])')

 page.locator('[data-byos=library]').click()
 page.locator('#nfxBYOSLibrary input').fill('hue')
 page.locator('[data-add-tool=hue]').click()
 assert page.locator('.byos-native .hc[data-id=hue]').count()==1
 page.locator('#btnQuickSave').click()
 page.wait_for_function('NFXPerformance.saved.length>1')
 assert page.evaluate('NFXPerformance.saved.at(-1).preferences.byos')==['hue']
 page.evaluate('NFXPerformance.byos.restore([])')
 page.evaluate('NFXPerformance.apply(NFXPerformance.saved.at(-1))')
 assert page.locator('.byos-native .hc[data-id=hue]').count()==1
 page.locator('[data-byos=library]').click()
 page.route('**/api/ai',lambda r:r.fulfill(json={'ok':True,'ids':['camera:swirl','hue'],'explanation':'Swirl bends the image.','model':'test-flash','fallback':True}))
 page.locator('#nfxBYOSLibrary input').fill('liquid rainbow')
 page.locator('#nfxBYOSLibrary [type=submit]').click()
 page.wait_for_function("document.querySelector('.byos-search-status').textContent.includes('Flash fallback')")
 assert page.locator('.byos-results article').count()==2
 page.screenshot(path='/workspace/Neuroflux-BYOS-Library.png')
 page.locator('#nfxBYOSLibrary [data-close]').click()
 page.screenshot(path='/workspace/Neuroflux-BYOS.png')
 page.reload();page.wait_for_function('window.NFXPerformance?.byos')
 assert page.evaluate('NFXPerformance.byos.layout')==['hue']
 assert not errors,errors
 print('PASS: mobile library, camera add, native control, setup save/restore, labeled AI results, reload; no browser errors')
 browser.close()
server.shutdown()
