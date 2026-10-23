"""Camera rack interaction tests with real touch pointers, knobs and camera pixels."""
import functools, http.server, pathlib, threading
from playwright.sync_api import sync_playwright
from browser_camera_fx import Handler, ROOT

def main():
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT/'public')))
 threading.Thread(target=server.serve_forever,daemon=True).start()
 try:
  with sync_playwright() as p:
   browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
   page=browser.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,service_workers='block');errors=[]
   page.on('pageerror',lambda error:errors.append(str(error)))
   page.route('https://fonts.googleapis.com/**',lambda r:r.abort());page.route('https://fonts.gstatic.com/**',lambda r:r.abort())
   page.add_init_script("localStorage.setItem('nfx.state.v1',JSON.stringify({P:{res:0,cx:0,mode:8}}));")
   page.goto(f'http://127.0.0.1:{server.server_port}/',wait_until='domcontentloaded')
   page.wait_for_function('window.NFXCameraFX&&window.NFXStudio?.storageReady')
   page.locator('#start [data-go=sim]').click();page.evaluate("NFXRig.guideOpen('cam');NFXCameraFX.selectTab('effects')")
   assert page.locator('[data-add]').count()==8
   assert page.locator('[data-add]>.nfx-fx-art').count()==8
   page.locator('#nfxFxCategory').select_option('all');assert page.locator('[data-add]').count()==129
   page.locator('#nfxFxCategory').select_option('mirror');assert page.locator('[data-add]').count()==9
   page.locator('[data-add=kaleidoscope]').click()
   assert page.locator('.nfx-fx-node[open] .nfx-dial-bank').first.locator('[role=slider]').count()==3
   assert page.locator('#nfxCameraEffects input[type=range]').count()==0
   splits=page.locator('.nfx-fx-node [data-param=count]');splits.focus();splits.press('End')
   assert page.evaluate('NFXCameraFX.state.nodes[0].params.count')==16
   splits.press('ArrowLeft');assert page.evaluate('NFXCameraFX.state.nodes[0].params.count')==15
   splits.press('Home');assert page.evaluate('NFXCameraFX.state.nodes[0].params.count')==1
   assert splits.evaluate('el=>el===document.activeElement')
   cdp=page.context.new_cdp_session(page)
   def touch_drag(locator,dx,dy):
    locator.scroll_into_view_if_needed();page.wait_for_timeout(220);rect=locator.bounding_box();x=rect['x']+rect['width']/2;y=rect['y']+rect['height']/2
    cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
    for step in range(1,7):cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x+dx*step/6,'y':y+dy*step/6}]})
    cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
   history=page.evaluate('NFXCameraFX.undo.length');touch_drag(splits,0,-60)
   assert page.evaluate('NFXCameraFX.state.nodes[0].params.count')>1
   assert page.evaluate('NFXCameraFX.undo.length')==history+1
   changed=page.evaluate('NFXCameraFX.state.nodes[0].params.count')
   page.locator('[data-stack=undo]').click();assert page.evaluate('NFXCameraFX.state.nodes[0].params.count')==1
   page.locator('[data-stack=redo]').click();assert page.evaluate('NFXCameraFX.state.nodes[0].params.count')==changed
   print('PASS visual library: quick picks, 129 modes, family selector, three native knobs; touch drag = one undo; keyboard focus, limits, redo',flush=True)
   # Camera data is generated locally. No physical camera or permission is needed.
   page.evaluate('''async()=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d');const data=ctx.createImageData(128,128);for(let y=0;y<128;y++)for(let x=0;x<128;x++)data.data.set([x*2,y*2,(x+y)%128*2,255],(y*128+x)*4);ctx.putImageData(data,0,0);const stream=canvas.captureStream(15);window.cameraFixture=canvas;navigator.mediaDevices.getUserMedia=async()=>stream;NFXRig.setParam('cam',1,'user');NFXRig.setParam('camMix',1,'user');window.hashCamera=()=>{const c=NFXRig.render('ui-test',128,128),data=c.getContext('2d').getImageData(0,0,128,128).data;let hash=0;for(const v of data)hash=Math.imul(hash^v,16777619);return hash;};}''')
   page.wait_for_function('NFXRig.guideState().services.camera');page.wait_for_timeout(250)
   wet=page.locator('.nfx-fx-node [data-param=wet]');wet.focus();wet.press('End');page.wait_for_timeout(100);effected=page.evaluate('hashCamera()')
   wet.press('Home');page.wait_for_timeout(100);assert page.evaluate('hashCamera()')!=effected
   wet.press('End');page.locator('.nfx-node-power').click();assert page.evaluate('NFXCameraFX.state.nodes[0].bypass')
   page.locator('.nfx-node-power').click();assert not page.evaluate('NFXCameraFX.state.nodes[0].bypass')
   page.locator('[data-library=open]').click();page.locator('#nfxFxCategory').select_option('warp');page.locator('[data-add=swirl]').click()
   active=page.locator('.nfx-fx-node[open]');assert page.locator('.nfx-fx-node[open]').count()==1
   assert active.locator('[data-param=count]').count()==0
   active.locator('[data-param=amount]').focus();active.locator('[data-param=amount]').press('End')
   assert page.evaluate('NFXCameraFX.state.nodes[1].params.amount')==1
   active.locator('[data-command=tweak]').click();history=page.evaluate('NFXCameraFX.undo.length');touch_drag(active.locator('[data-xy]'),40,-20)
   assert page.evaluate('NFXCameraFX.state.nodes[1].params.centerX')>.5,page.evaluate('NFXCameraFX.state.nodes[1].params')
   assert page.evaluate('NFXCameraFX.state.nodes[1].params.centerY')>.5
   assert page.evaluate('NFXCameraFX.undo.length')==history+1
   active.locator('[data-param=border]').select_option('repeat');assert page.evaluate('NFXCameraFX.state.nodes[1].params.border')=='repeat'
   active.locator('[data-command=animate]').click();assert page.evaluate('NFXCameraFX.state.nodes[1].params.autoplay')
   assert page.evaluate('NFXMotion.held&&!NFXMotion.simPlaying')
   active.locator('[data-mode="1"]').click();assert page.evaluate('NFXCameraFX.state.nodes[1].effect')=='twist'
   page.locator('[data-stack=undo]').click();assert page.evaluate('NFXCameraFX.state.nodes[1].effect')=='swirl'
   print('PASS actual camera pixels: wet/dry knob and bypass; independent node edits, XY center pad, selectors, mode audition and sound-gated animation',flush=True)
   active=page.locator('.nfx-fx-node[open]');active.locator('[data-command=tools]').click();active.locator('[data-command=up]').click()
   assert page.evaluate('NFXCameraFX.state.nodes[0].effect')=='swirl'
   # Auditioning from a source deformation into an ordinary face mode preserves stage order.
   page.evaluate("NFXRig.setParam('cam',0,'user');NFXCameraFX.commit({version:1,enabled:true,nodes:[]});NFXCameraFX.add('face-lens');NFXCameraFX.add('face-bulge');")
   for _ in range(2):page.locator('.nfx-fx-node[open] [data-mode="1"]').click()
   assert page.evaluate('NFXCameraFX.state.nodes.map(n=>n.effect)')==['face-lens','face-pixelate']
   page.locator('.nfx-fx-node[open] [data-command=tools]').click()
   assert page.locator('.nfx-fx-node[open] [data-command=up]').is_disabled()
   page.locator('[data-tab=looks]').click();assert page.locator('.nfx-look-tile').count()==12
   page.locator('.nfx-look-tile[data-look="0"]').click()
   assert page.evaluate('NFXCameraFX.state.nodes.length')==3
   assert page.locator('.nfx-stack').is_visible()
   assert page.evaluate('NFXCameraFX.tab')=='effects'
   page.locator('.nfx-fx-node').first.locator('summary').first.click() if page.locator('.nfx-fx-node').first.get_attribute('open') is None else None
   for width,height in [(320,740),(390,844),(844,390),(1280,800)]:
    page.set_viewport_size({'width':width,'height':height});page.wait_for_timeout(180)
    assert not page.evaluate('document.documentElement.scrollWidth>innerWidth'),(width,height)
    assert page.locator('.nfx-fx-node[open] .nfx-dial-bank').first.locator('.knob').evaluate_all('els=>els.every(e=>{const r=e.getBoundingClientRect();return r.width>=44&&r.height>=44;})')
   page.set_viewport_size({'width':390,'height':844});page.locator('#nfxCameraWorkspace').scroll_into_view_if_needed();page.wait_for_timeout(300);page.screenshot(path='/workspace/Neuroflux-Camera-FX-Controls.png')
   assert not page.evaluate('NFXGuide.enabled||NFXStudio.session')
   assert not errors,errors
   print('PASS rack reorder, visual looks, responsive phone/landscape/desktop layouts, accessible dial targets, walkthrough off, recorder untouched, no JS errors',flush=True)
   browser.close()
 finally:server.shutdown();server.server_close()

if __name__=='__main__':main()
