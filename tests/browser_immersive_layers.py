"""Real 3D scene UI, touch chord, GPU stage taps and recorded words.

Camera input is an actual canvas MediaStream fixture. Recording/playback are real;
only the software GPU's capture admission probe is bypassed.
"""
import functools,http.server,threading
from playwright.sync_api import sync_playwright
from browser_camera_fx import Handler,ROOT

server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT/'public')))
threading.Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 page=b.new_page(viewport={'width':844,'height':390},is_mobile=True,has_touch=True,service_workers='block');errors=[];page.on('pageerror',lambda e:(errors.append(str(e)),print('BROWSER ERROR',str(e),flush=True)))
 page.route('https://fonts.googleapis.com/**',lambda r:r.abort());page.route('https://fonts.gstatic.com/**',lambda r:r.abort())
 page.goto(f'http://127.0.0.1:{server.server_port}/',wait_until='domcontentloaded');page.wait_for_function('window.NFXLayers&&window.NFXStudio?.storageReady')
 page.locator('#start [data-go=sim]').click();page.wait_for_function('!document.getElementById("start")');page.evaluate("NFXRig.setParam('res',0,'user')")
 cdp=page.context.new_cdp_session(page)
 def touch(kind,points=[]):cdp.send('Input.dispatchTouchEvent',{'type':kind,'touchPoints':[{'id':i+1,'x':x,'y':y} for i,(x,y) in enumerate(points)]})
 mode=page.evaluate('NFXRig.guideState().controls.mode')
 touch('touchStart',[(250,180),(310,180)]);page.wait_for_timeout(600);touch('touchEnd');assert not page.evaluate('NFXLayers.opened'),'Two fingers must keep their existing meaning'
 touch('touchStart',[(250,180),(310,180),(370,180)]);touch('touchMove',[(250,200),(310,200),(370,200)]);page.wait_for_timeout(600);touch('touchEnd');assert not page.evaluate('NFXLayers.opened'),'Moving fingers cancel the hold'
 touch('touchStart',[(250,180),(310,180),(370,180)]);page.wait_for_function('NFXLayers.opened');touch('touchEnd');page.wait_for_timeout(950)
 assert page.evaluate('NFXRig.guideState().controls.mode')==mode
 assert not page.evaluate('document.body.classList.contains("clean")'),'Touch cancellation must not trigger native double-tap clean mode'
 assert page.locator('[data-layer-card]').count()>=35
 assert page.evaluate('getComputedStyle(document.querySelector("#gl")).transform')!='none'
 assert page.locator('.nfx-layer-focused').count()==1
 assert page.evaluate('getComputedStyle(document.querySelector("#nfxLayerWorkspace")).borderTopWidth')=='0px'
 page.evaluate("NFXLayers.select('visual-mirror')");page.wait_for_timeout(750)
 positions=page.evaluate('''()=>{const items=NFXLayers.items(),index=items.findIndex(i=>i.id===NFXLayers.selected);return items.slice(index-1,index+2).map(i=>{const r=document.querySelector('[data-layer-card="'+i.id+'"]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})}''')
 assert positions[0]['x']>positions[1]['x']>positions[2]['x'] and positions[0]['y']<positions[1]['y']<positions[2]['y'],positions
 print('PASS three-finger hold, movement cancellation, two-finger preservation and live scene camera geometry',flush=True)
 # Live camera and incremental stage taps, with distinct actual image contents.
 page.evaluate('''async()=>{const c=window.stageCamera=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d');window.paintStageCamera=(offset=0)=>{const d=ctx.createImageData(128,128);for(let y=0;y<128;y++)for(let x=0;x<128;x++)d.data.set([(x*2+offset)%256,y*2,((x+y)%64)*4,255],(y*128+x)*4);ctx.putImageData(d,0,0)};paintStageCamera();navigator.mediaDevices.getUserMedia=async()=>c.captureStream(20);NFXRig.setParam('cam',1,'user');NFXPerformance.add('kaleidoscope');NFXPerformance.add('swirl');window.normalized=c=>{const t=document.createElement('canvas');t.width=t.height=128;t.getContext('2d').drawImage(c,0,0,128,128);return t.getContext('2d').getImageData(0,0,128,128).data};window.imageHash=c=>{let n=2166136261;for(const v of normalized(c))n=Math.imul(n^v,16777619);return n>>>0};}''')
 page.wait_for_function('NFXRig.layerStatus().camera');page.evaluate("NFXLayers.scope='root';NFXLayers.select(NFXPerformance.state.nodes[0].id)");page.wait_for_timeout(900)
 ids=page.evaluate('NFXPerformance.state.nodes.map(n=>n.id)')
 page.wait_for_function('(ids)=>ids.every(id=>NFXPerformance.renderer.previews.has(id))',arg=ids)
 hashes=page.evaluate('(ids)=>ids.map(id=>imageHash(NFXPerformance.renderer.previews.get(id)))',ids);assert hashes[0]!=hashes[1],hashes
 error=page.evaluate('''(id)=>{const a=normalized(NFXPerformance.renderer.previews.get(id)),b=normalized(NFXPerformance.cameraFrame);let error=0;for(let i=0;i<a.length;i++)error+=Math.abs(a[i]-b[i]);return error/a.length}''',ids[-1]);assert error<8,error
 old=hashes[0];page.evaluate('paintStageCamera(90)');page.wait_for_timeout(300);assert page.evaluate('(id)=>imageHash(NFXPerformance.renderer.previews.get(id))',ids[0])!=old
 assert not page.locator('[data-layer-card] .nfx-fx-art').count(),'Rendering stages must show actual pixels, not illustrations'
 print('PASS different live camera stages, final-stage agreement and changing camera feed',flush=True)
 # Native visual stage sound routing changes renderer inputs, without overwriting knobs.
 page.evaluate("NFXLayers.select('visual-sat')");page.wait_for_timeout(450)
 base=page.evaluate('NFXRig.guideState().controls.sat')
 page.locator('[data-scene-value=visualBeat]').evaluate('el=>{el.value="0.8";el.dispatchEvent(new Event("input",{bubbles:true}));el.dispatchEvent(new Event("change",{bubbles:true}))}')
 page.locator('[data-scene-band]').select_option('mid');assert page.evaluate('NFXLayers.state.audioLinks.sat')=={'amount':.8,'band':'mid'}
 assert page.evaluate('NFXRig.guideState().controls.sat')==base
 page.evaluate("NFXLayers.select('sound')");page.wait_for_timeout(450);assert page.locator('[data-layer-preview=sound]').is_visible()
 page.locator('[data-layer-action=scenePlay]').first.click();page.wait_for_function('!NFXMotion.held&&NFXRig.state().mid>.05')
 page.evaluate("NFXRig.setParam('fb',0,'user')");page.wait_for_timeout(150)
 routed=page.evaluate('''()=>{const link=NFXLayers.state.audioLinks.sat,amount=link.amount,a=imageHash(NFXRig.render('sound-proof',128,128,{solo:'visuals'}));link.amount=0;const b=imageHash(NFXRig.render('sound-proof',128,128,{solo:'visuals'}));link.amount=amount;return {a,b}}''')
 assert routed['a']!=routed['b'],'Real sound response must change rendered colors, not only a settings value'
 # More than the old eight effect slots; retain a bounded preview cache.
 page.evaluate("()=>{while(NFXPerformance.state.nodes.length<16)NFXPerformance.add('swirl');NFXLayers.scope='root';NFXLayers.select(NFXPerformance.state.nodes[8].id)}")
 page.wait_for_timeout(900);assert page.evaluate('NFXPerformance.state.nodes.length')==16
 assert page.evaluate('NFXLayers.items().filter(i=>i.kind==="effect").length')==16
 assert page.evaluate('NFXPerformance.renderer.previews.size')<=7
 assert page.evaluate('NFXLayers.previewTargets.size')<=7
 page.screenshot(path='/workspace/Neuroflux-Exploded-Landscape.png')
 print('PASS sixteen effects, per-layer sound routing, bounded live previews',flush=True)
 # Real words exist in the operator picture and in saved video; the inspection scene does not.
 page.evaluate("NFXLayers.select('words')");page.wait_for_timeout(450);page.locator('[data-scene-text]').fill('LIVE');page.locator('[data-scene-text]').press('Tab')
 assert page.evaluate('NFXLayers.state.words.text')=='LIVE'
 page.wait_for_function('NFXLayers.wordsCanvas.getContext("2d").getImageData(0,0,NFXLayers.wordsCanvas.width,NFXLayers.wordsCanvas.height).data.some((v,i)=>i%4===3&&v>0)',timeout=15000)
 setup=page.evaluate("NFXPerformance.snapshot('Exploded setup')");assert setup['layers']['words']['text']=='LIVE' and setup['layers']['audioLinks']['sat']['band']=='mid' and len(setup['camera']['nodes'])==16
 page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(600);page.screenshot(path='/workspace/Neuroflux-Exploded-Portrait.png')
 page.evaluate("()=>{const x=stageCamera.getContext('2d');x.fillStyle='#2060b0';x.fillRect(0,0,128,128);NFXPerformance.commit({...NFXPerformance.state,enabled:false});NFXLayers.transact(()=>{NFXLayers.updateLayer('camera',{visible:true,opacity:1,blend:'normal'});NFXLayers.updateLayer('visuals',{visible:false});NFXLayers.updateLayer('space',{visible:false});NFXLayers.state.words.size=.2;});Object.assign(NFXStudio.profiles[0],{width:128,height:128,fps:24,mode:'clean',title:''});Object.assign(NFXStudio.settings,{kind:'video',dual:false,stems:false,mixed:false,limit:0});NFXStudio.testOutputs=async()=>true;}")
 page.evaluate('NFXStudio.start()');page.wait_for_function('NFXStudio.session?.status==="recording"',timeout=30000);group=page.evaluate('NFXStudio.session.group');page.wait_for_timeout(650)
 page.evaluate("NFXLayers.select('visual-mirror')");page.wait_for_timeout(300);assert page.evaluate('NFXStudio.session.group')==group
 page.evaluate('NFXStudio.stop()');page.wait_for_function('!NFXStudio.session');page.evaluate('NFXStudio.phoneSave.suspend();NFXLayers.open(false)')
 decoded=page.evaluate('''async()=>{const asset=(await NFXStudio.store.list()).find(a=>a.kind==='video'),blob=await NFXStudio.store.blob(asset),url=URL.createObjectURL(blob),v=document.createElement('video');v.muted=true;v.playsInline=true;try{await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Video did not decode')),10000);v.onloadeddata=()=>{clearTimeout(timeout);resolve()};v.onerror=reject;v.src=url});await v.play();await new Promise(r=>v.requestVideoFrameCallback(r));const c=document.createElement('canvas');c.width=v.videoWidth;c.height=v.videoHeight;c.getContext('2d').drawImage(v,0,0);const d=c.getContext('2d').getImageData(0,0,128,128).data;let text=0;for(let y=70;y<110;y++)for(let x=20;x<108;x++){const i=(y*128+x)*4;if(d[i]>180&&d[i+1]>180&&d[i+2]>180)text++;}return {text,corner:Array.from(c.getContext('2d').getImageData(20,20,1,1).data)}}finally{v.pause();URL.revokeObjectURL(url)}}''')
 assert decoded['text']>50 and decoded['corner'][0]<80 and decoded['corner'][2]>130,decoded
 page.evaluate('(s)=>NFXPerformance.apply(s)',setup);assert page.evaluate('NFXLayers.state.words.text')=='LIVE';assert page.evaluate('NFXLayers.state.audioLinks.sat.band')=='mid'
 print('PASS real recorded video contains manual words and the final camera picture, with no exploded-scene UI; portable setup restore',flush=True)
 assert not errors,errors
 b.close()
server.shutdown()
