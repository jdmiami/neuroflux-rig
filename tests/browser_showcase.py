import functools,http.server,threading
from playwright.sync_api import sync_playwright
from browser_camera_fx import Handler,ROOT
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT/'public')))
threading.Thread(target=server.serve_forever,daemon=True).start()
url=f'http://127.0.0.1:{server.server_port}/showcase/'
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream'])
 page=b.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True);errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(url.replace('/showcase/','/'),wait_until='domcontentloaded');page.wait_for_function('window.NFXPerformance')
 entry=page.locator('#nfxFuzzyCamera');assert entry.is_visible();assert 0<=entry.bounding_box()['y']<844
 entry.click();assert page.url.endswith('/showcase/')
 page.wait_for_timeout(1500);page.screenshot(path='/workspace/Fuzzy-Camera-Orb.png')
 page.locator('#orb').tap();page.wait_for_selector('[data-state=choices]');page.screenshot(path='/workspace/Fuzzy-Camera-Choices.png')
 page.locator('[data-choice=camera]').tap();page.wait_for_function('document.querySelector("#preview").videoWidth>0')
 assert page.evaluate('document.querySelector("#preview").srcObject.getVideoTracks()[0].readyState')=='live'
 page.screenshot(path='/workspace/Fuzzy-Camera-Preview.png')
 page.locator('#shutter').tap();page.wait_for_selector('[data-state=result]');assert page.locator('#photo').get_attribute('src').startswith('blob:')
 page.locator('#retake').tap();page.locator('#flip').tap();page.wait_for_function('document.querySelector("#preview").srcObject?.getVideoTracks()[0].readyState==="live"')
 page.locator('#close').tap();assert page.evaluate('document.querySelector("#preview").srcObject') is None
 assert not errors,errors
 drag=b.new_page(viewport={'width':390,'height':844})
 drag.goto(url,wait_until='domcontentloaded');drag.locator('#orb').wait_for(state='visible')
 box=drag.locator('#orb').bounding_box();drag.mouse.move(box['x']+box['width']/2,box['y']+box['height']/2);drag.mouse.down()
 drag.wait_for_selector('[data-state=choices]');drag.wait_for_timeout(550)
 choice=drag.locator('[data-choice=camera]').bounding_box();drag.mouse.move(choice['x']+choice['width']/2,choice['y']+choice['height']/2);drag.mouse.up()
 drag.wait_for_function('document.querySelector("#preview").videoWidth>0');drag.locator('#close').click();drag.close()
 denied=b.new_page(viewport={'width':390,'height':844})
 denied.add_init_script("navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('Denied','NotAllowedError')}")
 denied.goto(url,wait_until='domcontentloaded');denied.locator('#orb').click();denied.locator('[data-choice=camera]').click();denied.wait_for_function("document.querySelector('#status').textContent.includes('denied')")
 assert denied.locator('#app').get_attribute('data-state')=='choices'
 denied.close()
 print('PASS fake camera fixture: orb, camera, real MediaStream pipeline, capture blob, flip, stop; no browser errors')
 b.close()
server.shutdown()
