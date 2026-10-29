import functools,http.server,threading
from playwright.sync_api import sync_playwright
from browser_camera_fx import Handler,ROOT
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT/'public')))
threading.Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 page=b.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,service_workers='block'); errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(f'http://127.0.0.1:{server.server_port}/',wait_until='domcontentloaded');page.wait_for_function('window.NFXStudio?.storageReady')
 page.locator('#start [data-go=sim]').click();page.evaluate("NFXRig.guideOpen('color')")
 hue=page.locator('.hc[data-id=hue] input[type=range]').first;hue.wait_for(state='visible')
 before=page.evaluate('NFXRig.guideState().controls.hue');hue.focus();hue.press('End');assert page.evaluate('NFXRig.guideState().controls.hue')!=before
 assert hue.get_attribute('aria-valuetext')
 page.locator('.hc[data-id=hue] .nfx-range-shield').first.tap();assert int(hue.input_value())==1000

 page.evaluate("NFXPerformance.add('kaleidoscope');NFXRig.guideOpen('cam');NFXPerformance.selectTab('effects')")
 slider=page.locator('#nfxCameraEffects [data-param=count][type=range]').first;slider.wait_for(state='visible');slider.focus();slider.press('End')
 assert page.evaluate('NFXPerformance.state.nodes[0].params.count')==16
 assert page.evaluate('NFXPerformance.undo.length')==2
 slider=page.locator('#nfxCameraEffects [data-param=count][type=range]').first;slider.focus();slider.press('Home')
 assert page.evaluate('NFXPerformance.state.nodes[0].params.count')==1
 page.screenshot(path='/workspace/Neuroflux-Sliders.png')
 assert not errors,errors
 print('PASS: native and Camera FX sliders update values, accessible keyboard interaction and one undo per change')
 b.close()
server.shutdown()
