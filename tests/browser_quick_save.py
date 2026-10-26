"""Quick-save durability, clean-mode access, shortcuts and active-recording dock layout."""
import functools,http.server,threading
from playwright.sync_api import sync_playwright
from browser_camera_fx import Handler,ROOT

def main():
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT/'public')))
 threading.Thread(target=server.serve_forever,daemon=True).start()
 try:
  with sync_playwright() as p:
   browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
   page=browser.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,service_workers='block');errors=[];downloads=[]
   page.on('pageerror',lambda e:errors.append(str(e)));page.on('download',lambda d:downloads.append(d))
   page.route('https://fonts.googleapis.com/**',lambda r:r.abort());page.route('https://fonts.gstatic.com/**',lambda r:r.abort())
   page.add_init_script("localStorage.setItem('nfx.state.v1',JSON.stringify({P:{res:0,cx:0,mode:8}}));")
   origin=f'http://127.0.0.1:{server.server_port}/';page.goto(origin,wait_until='domcontentloaded')
   page.wait_for_function('window.NFXStudio?.storageReady&&window.NFXCameraFX?.saved')
   page.locator('#start [data-go=sim]').click();page.wait_for_function('!document.getElementById("start")')
   page.wait_for_function('!document.getElementById("btnQuickSave").disabled')
   page.evaluate("NFXRig.setParam('hue',.21,'user');NFXCameraFX.add('kaleidoscope');NFXCameraFX.change(NFXCameraFX.state.nodes[0].id,'count',5);Object.assign(NFXStudio.profiles[0],{width:128,height:128,fps:24});Object.assign(NFXStudio.profiles[1],{width:128,height:192,fps:24});")
   # Force identical timestamps: an IndexedDB add collision must create a distinct save.
   page.evaluate("()=>{window.RealDate=Date;window.Date=class extends RealDate{constructor(...args){super(...(args.length?args:['2026-10-26T12:00:00.123Z']));}};}")
   page.locator('#btnQuickSave').click();page.wait_for_function('NFXCameraFX.saved.length===1')
   first=page.evaluate('NFXCameraFX.saved[0]');assert first['rig']['hue']==.21 and first['camera']['nodes'][0]['params']['count']==5
   assert first['studio']['profiles'][1]['height']==192
   page.evaluate("NFXRig.setParam('hue',.72,'user');NFXCameraFX.change(NFXCameraFX.state.nodes[0].id,'count',9)")
   page.locator('#btnQuickSave').click();page.wait_for_function('NFXCameraFX.saved.length===2')
   saves=page.evaluate('NFXCameraFX.saved');assert len({s['name'] for s in saves})==2
   assert next(s for s in saves if s['name']==first['name'])['rig']['hue']==.21
   assert any(s['rig']['hue']==.72 and s['camera']['nodes'][0]['params']['count']==9 for s in saves)
   page.evaluate('()=>{window.Date=RealDate;}')
   assert page.locator('#btnQuickSave').get_attribute('data-state')=='saved'
   assert not page.evaluate('NFXStudio.session||NFXGuide.enabled||NFXRig.guideState().services.camera')
   print('PASS one-tap complete setup snapshots, duplicate timestamp collision, no overwrites, confirmation and no input/recording activation',flush=True)
   # Clean performance mode keeps the same save button accessible beside Reveal.
   page.evaluate('document.activeElement.blur()');page.keyboard.press('h');page.wait_for_function('document.body.classList.contains("clean")&&document.getElementById("btnQuickSave").parentElement===document.body')
   page.locator('#btnQuickSave').click();page.wait_for_function('NFXCameraFX.saved.length===3')
   assert page.evaluate('document.body.classList.contains("clean")')
   page.locator('#unhide').click();page.wait_for_function('document.getElementById("btnQuickSave").parentElement.id==="dock"')
   page.evaluate("NFXRig.guideOpen('scenes')");page.locator('#nfxSetupName').fill('Draft name')
   page.locator('#nfxSetupName').press('Control+s');page.wait_for_function('NFXCameraFX.saved.length===4')
   assert page.locator('#nfxSetupName').input_value()=='Draft name'
   page.locator('#nfxSetupName').press('Meta+s');page.wait_for_function('NFXCameraFX.saved.length===5')
   assert not downloads
   print('PASS clean-mode access without revealing menus, Ctrl/Cmd+S inside a text field and no browser-page download',flush=True)
   # A failed storage write must never announce success or alter saved setups.
   page.evaluate("()=>{window.realCreate=NFXCameraFX.store.create;NFXCameraFX.store.create=async()=>{throw new DOMException('Device storage is full.','QuotaExceededError');};}")
   page.locator('#btnQuickSave').click();page.wait_for_function('document.getElementById("btnQuickSave").dataset.state==="error"')
   assert page.evaluate('NFXCameraFX.saved.length')==5
   assert 'Could not save' in page.locator('.nfx-save-feedback').text_content()
   assert not page.locator('#btnQuickSave').is_disabled()
   page.evaluate('()=>{NFXCameraFX.store.create=realCreate;}')
   # Save is independent of the capture lock: it cannot pause or stop a take.
   page.evaluate("Object.assign(NFXStudio.settings,{kind:'audio',stems:false,mixed:false,limit:0});")
   page.locator('#btnRecord').click();page.wait_for_function('NFXStudio.session?.status==="recording"',timeout=30000)
   before=page.evaluate('({group:NFXStudio.session.group,seconds:NFXStudio.session.seconds})')
   page.locator('#btnQuickSave').click();page.wait_for_function('NFXCameraFX.saved.length===6')
   assert 'Could not save' not in page.locator('#nfxSetupPanel .nfx-performance-status').text_content()
   assert page.evaluate('NFXStudio.session.status')=='recording'
   assert page.evaluate('NFXStudio.session.group')==before['group']
   assert page.evaluate('NFXStudio.session.seconds')>=before['seconds']
   def dock_fits():
    return page.evaluate('''()=>{const dock=document.getElementById('dock').getBoundingClientRect();const boxes=[...document.querySelectorAll('#dock button')].map(el=>el.getBoundingClientRect()).filter(r=>r.width&&r.height).sort((a,b)=>a.x-b.x);return boxes.every((r,i)=>r.x>=dock.x&&r.right<=dock.right+1&&r.y>=dock.y&&r.bottom<=dock.bottom+1&&(!i||r.x>=boxes[i-1].right-1));}''')
   for width,height in [(320,740),(360,800),(390,844),(844,390),(1280,800)]:
    page.set_viewport_size({'width':width,'height':height});page.wait_for_timeout(150);assert dock_fits(),('recording',width,height)
   page.set_viewport_size({'width':320,'height':740});page.screenshot(path='/workspace/Neuroflux-Quick-Save-Recording.png')
   page.locator('#btnRecord').click();page.wait_for_function('!NFXStudio.session',timeout=30000)
   for width,height in [(320,740),(390,844),(844,390),(1280,800)]:
    page.set_viewport_size({'width':width,'height':height});page.wait_for_timeout(150);assert dock_fits(),('idle',width,height)
   page.reload(wait_until='domcontentloaded');page.wait_for_function('window.NFXCameraFX?.saved?.length===6&&window.NFXStudio?.storageReady')
   saved=page.evaluate('(name)=>NFXCameraFX.saved.find(s=>s.name===name)',first['name'])
   page.evaluate('(setup)=>NFXCameraFX.apply(setup)',saved)
   assert page.evaluate('NFXRig.guideState().controls.hue')==.21
   assert page.evaluate('NFXCameraFX.state.nodes[0].params.count')==5
   assert not page.evaluate('NFXStudio.session||NFXGuide.enabled||NFXRig.guideState().services.camera')
   assert not errors,errors
   print('PASS storage error/retry, save during uninterrupted recording, idle/active dock layouts down to 320px, durable reload and exact settings restore',flush=True)
   browser.close()
 finally:server.shutdown();server.server_close()

if __name__=='__main__':main()
