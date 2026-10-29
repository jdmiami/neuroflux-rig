import functools,http.server,threading
from playwright.sync_api import sync_playwright
from browser_camera_fx import Handler,ROOT
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT/'public')));threading.Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 page=b.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,service_workers='block');errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(f'http://127.0.0.1:{server.server_port}/',wait_until='domcontentloaded');page.wait_for_function('window.NFXStudio?.storageReady');page.locator('#start [data-go=sim]').click();page.evaluate("NFXPerformance.add('swirl');NFXRig.guideOpen('cam');NFXPerformance.selectTab('effects')")
 shield=page.locator('#nfxCameraEffects [data-dial=amount] .nfx-range-shield');shield.scroll_into_view_if_needed();page.wait_for_timeout(600)
 input=page.locator('#nfxCameraEffects [data-param=amount][type=range]');before=input.input_value();shield.tap();assert input.input_value()==before
 cdp=page.context.new_cdp_session(page);box=shield.bounding_box();x=box['x']+box['width']/2;y=box['y']+box['height']/2
 def touch(kind,x=x,y=y):cdp.send('Input.dispatchTouchEvent',{'type':kind,'touchPoints':[] if kind=='touchEnd' else [{'x':x,'y':y}]})
 touch('touchStart');page.wait_for_timeout(550);assert 'armed' in shield.get_attribute('class');touch('touchMove',x+45,y);touch('touchEnd');assert input.input_value()!=before
 assert page.evaluate('NFXPerformance.undo.length')==2
 assert 'armed' not in shield.get_attribute('class')
 before=input.input_value();box=shield.bounding_box();x=box['x']+box['width']/2;y=box['y']+box['height']/2
 scroll_before=page.evaluate('Array.from(document.querySelectorAll("*")).reduce((n,e)=>n+e.scrollTop,0)')
 touch('touchStart');touch('touchMove',x,y-15);touch('touchMove',x,y-45);touch('touchMove',x,y-90);touch('touchEnd');page.wait_for_timeout(200);assert input.input_value()==before
 scroll_after=page.evaluate('Array.from(document.querySelectorAll("*")).reduce((n,e)=>n+e.scrollTop,0)');assert scroll_after>scroll_before,(scroll_before,scroll_after)

 assert not errors,errors
 print('PASS quick tap unchanged; hold then slide edits once; release locks; swipe unchanged; no browser errors');b.close()
server.shutdown()
