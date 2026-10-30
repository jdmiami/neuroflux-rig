import functools,http.server,threading
from playwright.sync_api import sync_playwright
from browser_camera_fx import Handler,ROOT
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT/'public')));threading.Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 page=b.new_page(viewport={'width':844,'height':390},is_mobile=True,has_touch=True,service_workers='block');errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(f'http://127.0.0.1:{server.server_port}/',wait_until='domcontentloaded');page.wait_for_function('window.NFXStudio?.storageReady');page.locator('#startLandscapeTake').click();page.wait_for_function('NFXPerformance.take.enabled');page.wait_for_timeout(600)
 def rect(id):return page.locator(id).bounding_box()
 assert abs(rect('#gl')['width']-422)<2 and abs(rect('#sheet')['width']-422)<2
 assert rect('#sheet')['x']==422
 for cat in ['color','motion','fx','cam','recording']:
  page.locator(f'[data-take-page={cat}]').click();assert page.evaluate('NFXRig.guideState().ui.page')==cat
 page.locator('[data-take-page=color]').click();page.locator('[data-take=hand]').click();assert rect('#sheet')['x']==0 and rect('#gl')['x']==422
 profile=page.evaluate('JSON.stringify(NFXStudio.profiles)')
 page.locator('[data-take=view]').click();assert rect('#gl')['width']==844 and page.locator('#nfxTakeRestore').is_visible()
 page.locator('#nfxTakeRestore').click();assert rect('#gl')['width']==422
 page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(300);assert rect('#gl')['height']==422
 assert page.evaluate('JSON.stringify(NFXStudio.profiles)')==profile
 page.set_viewport_size({'width':844,'height':390});page.wait_for_timeout(300);page.screenshot(path='/workspace/Neuroflux-Landscape-Take.png')
 page.evaluate("Object.assign(NFXStudio.settings,{kind:'audio',stems:false,mixed:false,limit:0})")
 page.locator('#btnRecord').click();page.wait_for_function('NFXStudio.session?.status==="recording"',timeout=30000)
 assert page.locator('#sheet').is_visible()
 for width,height in [(640,360),(844,390),(1024,768)]:
  page.set_viewport_size({'width':width,'height':height});page.wait_for_timeout(200)
  assert page.evaluate('''()=>{let d=document.querySelector('#dock').getBoundingClientRect();return [...document.querySelectorAll('#dock button')].map(e=>e.getBoundingClientRect()).filter(r=>r.width>0).every(r=>r.left>=d.left-1&&r.right<=d.right+1)}''')
 page.locator('#dock [data-action=pause]').click();page.wait_for_function('NFXStudio.session.status==="paused"');page.locator('#dock [data-action=pause]').click()
 page.locator('#btnRecord').click();page.wait_for_function('!NFXStudio.session',timeout=30000)
 assert 'saved' in page.locator('#nfxTakeFeedback span').text_content()
 assert page.evaluate('NFXPerformance.take.enabled')
 page.locator('[data-take=exit]').click();assert not page.evaluate('NFXPerformance.take.enabled')
 assert not errors,errors
 print('PASS landscape split, categories, mirrored hand, full preview, portrait rotation, recording profiles unchanged, exit; no browser errors');b.close()
server.shutdown()
