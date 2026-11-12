import functools,http.server,threading
from playwright.sync_api import sync_playwright
from browser_camera_fx import Handler,ROOT
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT/'public')));threading.Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 page=b.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,service_workers='block');errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(f'http://127.0.0.1:{server.server_port}/',wait_until='domcontentloaded');page.wait_for_function('window.NFXStudio?.storageReady');page.locator('#start [data-go=sim]').click()
 # Software GPU cannot certify phone frame-rate admission; only that probe is bypassed.
 # Capture, countdown, MediaRecorder, local storage, and UI gestures stay real.
 page.evaluate("Object.assign(NFXStudio.profiles[0],{width:128,height:128,fps:24,mode:'full'});Object.assign(NFXStudio.settings,{kind:'audio',dual:true,stems:true,mixed:true,limit:17});NFXStudio.testOutputs=async()=>true;")
 cdp=page.context.new_cdp_session(page)
 def touch(kind,x=0,y=0):cdp.send('Input.dispatchTouchEvent',{'type':kind,'touchPoints':[] if kind=='touchEnd' else [{'x':x,'y':y}]})
 box=page.locator('#btnRecord').bounding_box();touch('touchStart',box['x']+box['width']/2,box['y']+box['height']/2);page.wait_for_function('NFXStudio.session?.status==="recording"',timeout=30000)
 assert page.evaluate('NFXStudio.simple.pointer?.held'), 'Long hold lost its pointer during startup'
 assert page.evaluate('NFXStudio.settings.kind')=='video' and page.evaluate('NFXStudio.profiles[0].mode')=='clean'
 target=page.locator('.nfx-simple-target').bounding_box();touch('touchMove',target['x']+target['width']/2,target['y']+target['height']/2);touch('touchEnd');assert page.evaluate('NFXStudio.simple.locked')
 group=page.evaluate('NFXStudio.session.group');page.touchscreen.tap(100,180);page.touchscreen.tap(100,180);page.touchscreen.tap(200,250)
 assert page.evaluate('NFXStudio.session.group')==group
 assert page.evaluate('NFXStudio.session.status')=='recording'
 page.locator('#btnRecord').tap();assert page.evaluate('NFXStudio.session.status')=='recording'
 # Releasing a new hold without dragging also cannot stop a locked take.
 box=page.locator('#btnRecord').bounding_box();touch('touchStart',box['x']+32,box['y']+32);page.wait_for_timeout(550);touch('touchEnd');assert page.evaluate('NFXStudio.session.status')=='recording'
 page.wait_for_timeout(250);page.screenshot(path='/workspace/Neuroflux-Simple-Recording.png')
 box=page.locator('#btnRecord').bounding_box();touch('touchStart',box['x']+32,box['y']+32);page.wait_for_timeout(550);target=page.locator('.nfx-simple-target').bounding_box();touch('touchMove',target['x']+32,target['y']+27);touch('touchEnd');page.wait_for_function('!NFXStudio.session&&!NFXStudio.simple.engaged',timeout=30000)
 assert not page.evaluate('document.body.classList.contains("nfx-simple-record")')
 assert page.evaluate('NFXStudio.settings.kind')=='audio' and page.evaluate('NFXStudio.settings.limit')==17 and page.evaluate('NFXStudio.profiles[0].mode')=='full'
 assets=page.evaluate('NFXStudio.store.list()');assert any(a['kind']=='video' and a['bytes']>0 and a.get('profile',{}).get('mode')=='clean' for a in assets),assets
 # A real finalized clean video is offered without blocking recorder cleanup.
 page.wait_for_function('NFXStudio.phoneSave.entries.length===1')
 assert page.locator('#nfxPhoneSave').is_visible()
 assert page.evaluate('NFXStudio.phoneSave.entries[0].file.size===NFXStudio.phoneSave.entries[0].asset.bytes')
 page.evaluate('''()=>{window.sharedTake=null;navigator.canShare=({files})=>files[0] instanceof File;navigator.share=async({files})=>{window.sharedTake={bytes:files[0].size,type:files[0].type,active:navigator.userActivation.isActive}};NFXStudio.phoneSave.paint()}''')
 page.locator('[data-phone-save]').tap()
 assert page.evaluate('sharedTake.active&&sharedTake.bytes>0&&sharedTake.type.startsWith("video/")')
 assert len(page.evaluate('NFXStudio.store.list()'))==len(assets)
 # A short tap during preparation cancels and restores advanced settings.
 page.locator('#btnRecord').tap();page.wait_for_function('NFXStudio.starting')
 assert page.locator('#nfxPhoneSave').is_hidden()
 page.locator('#btnRecord').tap();page.wait_for_function('!NFXStudio.starting&&!NFXStudio.simple.engaged',timeout=30000)
 assert page.evaluate('NFXStudio.settings.kind')=='audio'
 # Failed admission must not leave hidden controls or altered modes.
 page.evaluate('NFXStudio.testOutputs=async()=>false')
 page.locator('#btnRecord').tap();page.wait_for_function('!NFXStudio.starting&&!NFXStudio.simple.engaged',timeout=30000)
 assert page.evaluate('NFXStudio.profiles[0].mode')=='full'
 assert not page.evaluate('document.body.classList.contains("nfx-simple-record")')
 assert not errors,errors
 print('PASS hold/slide lock, real clean video capture, canvas touches and taps do not stop, deliberate unlock saves, prior settings restored');b.close()
server.shutdown()
