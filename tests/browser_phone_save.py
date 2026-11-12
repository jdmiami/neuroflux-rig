"""Exercise OS handoff outcomes with real browser Files and local storage.

OS destination UI is mocked; choosing Photos/Gallery needs a physical phone.
Actual MediaRecorder-to-share integration lives in browser_simple_record.py.
"""
import functools,http.server,threading
from playwright.sync_api import sync_playwright
from browser_camera_fx import Handler,ROOT

server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT/'public')))
threading.Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 page=b.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,service_workers='block')
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(f'http://127.0.0.1:{server.server_port}/',wait_until='domcontentloaded')
 page.wait_for_function('window.NFXStudio?.storageReady');page.locator('#start [data-go=sim]').click()
 page.evaluate('''async()=>{
   window.calls=[];window.outcome='AbortError';window.shareActive=false;
   Object.defineProperty(navigator,'userActivation',{configurable:true,value:{get isActive(){return window.shareActive}}});
   navigator.canShare=({files})=>files.length===1&&files[0] instanceof File;
   navigator.share=async({files})=>{calls.push({name:files[0].name,bytes:files[0].size,type:files[0].type});if(outcome)throw new DOMException('Test outcome',outcome)};
   const a=await NFXStudio.store.saveBlob(new Blob(['original-video-A'],{type:'video/webm'}),{name:'Take A',kind:'video'});
   const b=await NFXStudio.store.saveBlob(new Blob(['original-video-B'],{type:'video/mp4'}),{name:'Take B',kind:'video'});
   const stem=await NFXStudio.store.saveBlob(new Blob(['audio'],{type:'audio/wav'}),{name:'Stem',kind:'audio'});
   window.saved=[a,b,stem];await NFXStudio.phoneSave.offer(saved);
 }''')
 assert page.evaluate('calls.length')==0, 'Must not auto-share without user activation'
 assert page.locator('#nfxPhoneSave select option').count()==2, 'Audio companions stay in Library'
 page.locator('[data-phone-save]').tap()
 assert 'safe in Library' in page.locator('.nfx-phone-status').text_content()
 assert len(page.evaluate('NFXStudio.store.list()'))==3
 page.evaluate("outcome='NotAllowedError'");page.locator('[data-phone-save]').tap()
 assert 'again' in page.locator('.nfx-phone-status').text_content()
 page.evaluate("outcome=''");page.locator('#nfxPhoneSave select').select_option('1');page.locator('[data-phone-save]').tap()
 assert page.evaluate('calls.at(-1).name.endsWith(".mp4")&&calls.at(-1).bytes===16')
 assert 'Check the destination' in page.locator('.nfx-phone-status').text_content()
 # A canceled automatic attempt must not loop, and must remain retryable.
 page.evaluate("async()=>{shareActive=true;outcome='AbortError';await NFXStudio.phoneSave.offer([saved[0]])}")
 page.wait_for_function("document.querySelector('.nfx-phone-status').textContent.includes('safe in Library')")
 assert page.evaluate('calls.length')==4
 # Unsupported browsers get an explicit download, with the real extension.
 page.evaluate('navigator.canShare=()=>false;NFXStudio.phoneSave.paint()')
 assert page.locator('[data-phone-save]').is_hidden()
 with page.expect_download() as download:page.locator('[data-phone-download]').tap()
 assert download.value.suggested_filename=='Take A.webm'
 assert 'does not automatically' in page.locator('.nfx-phone-status').text_content()
 # Dismissing during async file preparation must not resurrect the card.
 page.evaluate('''async()=>{const original=NFXStudio.store.blob.bind(NFXStudio.store);NFXStudio.store.blob=async a=>{await new Promise(r=>setTimeout(r,100));return original(a)};const pending=NFXStudio.phoneSave.offer(saved);NFXStudio.phoneSave.suspend();await pending;NFXStudio.store.blob=original}''')
 assert page.locator('#nfxPhoneSave').is_hidden()
 # Library shares use their preloaded File directly from the click.
 page.evaluate('''async()=>{shareActive=false;outcome='';navigator.canShare=()=>true;NFXStudio.tab='library';NFXStudio.open(true);await NFXStudio.showAsset(saved[1].id);window.originalGet=NFXStudio.store.get;NFXStudio.store.get=()=>{throw Error('Share must not await storage')}}''')
 page.locator('#nfxStudioPanel [data-action=share]').scroll_into_view_if_needed()
 page.screenshot(path='/workspace/Neuroflux-Library-Save.png')
 page.locator('#nfxStudioPanel [data-action=share]').click()
 assert page.evaluate('calls.length')==5
 assert page.evaluate('calls.at(-1).name.endsWith(".mp4")')
 # Mirrored side-console card stays on screen at phone sizes.
 page.evaluate("async()=>{NFXStudio.store.get=originalGet;NFXStudio.open(false);await NFXStudio.phoneSave.offer([saved[0]],{automatic:false});document.body.classList.add('nfx-landscape-take')}")
 for width,height,left in [(844,390,False),(844,390,True),(390,844,True)]:
  page.set_viewport_size({'width':width,'height':height});page.evaluate('(left)=>document.body.classList.toggle("nfx-take-left",left)',left)
  page.wait_for_timeout(200);box=page.locator('#nfxPhoneSave').bounding_box()
  assert box['x']>=0 and box['y']>=0 and box['x']+box['width']<=width and box['y']+box['height']<=height,box
  if width>height: assert (box['x']<width/2)==left
 assert not errors,errors
 page.screenshot(path='/workspace/Neuroflux-Phone-Save.png')
 print('PASS phone share: activation fallback, cancel/retry, auto-once, A/B selector, original format/download, local backup, stale offer, Library gesture, mirrored layout')
 b.close()
server.shutdown()
