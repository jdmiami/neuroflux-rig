"""Layer deck, real GPU composition, camera chain folders and recording isolation.

The camera fixture is a real canvas MediaStream, not physical phone certification.
"""
import functools,http.server,threading,struct
from playwright.sync_api import sync_playwright
from browser_camera_fx import Handler,ROOT

server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT/'public')))
threading.Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 page=b.new_page(viewport={'width':844,'height':390},is_mobile=True,has_touch=True,service_workers='block')
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.route('https://fonts.googleapis.com/**',lambda r:r.abort());page.route('https://fonts.gstatic.com/**',lambda r:r.abort())
 page.goto(f'http://127.0.0.1:{server.server_port}/',wait_until='domcontentloaded');page.wait_for_function('window.NFXLayers&&window.NFXStudio?.storageReady')
 page.locator('#start [data-go=sim]').click()
 def set_range(selector,value):
  page.locator(selector).evaluate('(el,value)=>{el.value=String(value);el.dispatchEvent(new Event("input",{bubbles:true}));}',value)
  page.locator(selector).dispatch_event('change')
 page.evaluate('''()=>{window.hash=c=>{const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let h=2166136261;for(let i=0;i<d.length;i++)h=Math.imul(h^d[i],16777619);return h>>>0};window.output=()=>hash(NFXRig.render('layers-test',128,128));}''')
 initial=page.evaluate('output()');page.locator('#btnLayers').click();page.wait_for_timeout(300)
 assert page.locator('#nfxLayerWorkspace').is_visible();assert page.locator('[data-layer-card]').count()>=30
 page.evaluate("window.originalLayerCanvas=document.querySelector('[data-layer-preview=camera]');NFXLayers.select('space');NFXLayers.select('camera')")
 assert page.evaluate("originalLayerCanvas===document.querySelector('[data-layer-preview=camera]')"),'Rolodex browsing must preserve live card canvases'
 assert not page.evaluate('NFXLayers.state.enabled'), 'Browsing must not change the mix'
 assert page.evaluate('output()')==initial
 print('PASS open deck preserves existing mix',flush=True)
 # Live hardware API path, driven by a deterministic actual MediaStream fixture.
 page.evaluate('''async()=>{const c=window.layerCamera=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');x.fillStyle='#2060b0';x.fillRect(0,0,128,128);x.fillStyle='#f04070';x.fillRect(0,0,64,64);const stream=c.captureStream(15);navigator.mediaDevices.getUserMedia=async()=>stream;NFXRig.setParam('cam',1,'user');}''')
 page.wait_for_function('NFXRig.layerStatus().camera');page.wait_for_timeout(300)
 page.evaluate("()=>{NFXLayers.transact(()=>{NFXLayers.updateLayer('visuals',{opacity:1,visible:true,blend:'normal'});NFXLayers.updateLayer('camera',{opacity:1,visible:true,blend:'normal'});NFXLayers.updateLayer('space',{opacity:1,visible:true});NFXLayers.state.order=['visuals','space','camera'];});}")
 camera=page.evaluate('output()')
 page.evaluate("()=>{NFXLayers.transact(()=>NFXLayers.updateLayer('camera',{visible:false}));}")
 visual=page.evaluate('output()');assert camera!=visual
 page.evaluate("()=>{NFXLayers.transact(()=>{NFXLayers.updateLayer('camera',{visible:true});NFXLayers.state.order=['camera','space','visuals'];});}")
 assert page.evaluate('output()')==visual, 'Normal top visual must cover the camera'
 page.evaluate("()=>{NFXLayers.transact(()=>NFXLayers.state.order=['visuals','space','camera']);}")
 assert page.evaluate('output()')==camera
 page.evaluate("()=>{NFXLayers.transact(()=>NFXLayers.updateLayer('camera',{opacity:.4}));}")
 assert page.evaluate('output()') not in [visual,camera]
 page.evaluate("()=>{NFXLayers.transact(()=>NFXLayers.updateLayer('camera',{opacity:1,blend:'screen'}));}")
 assert page.evaluate('output()')!=camera
 page.evaluate("()=>{NFXLayers.transact(()=>NFXLayers.updateLayer('camera',{blend:'normal'}));NFXLayers.previewSolo='visuals';NFXLayers.paint();}")
 assert page.evaluate('output()')==camera, 'Preview solo must never leak into recording render targets'
 assert page.evaluate("hash(NFXRig.render('layers-test',128,128,{solo:'visuals'}))")==visual
 page.evaluate('NFXLayers.previewSolo=null')
 print('PASS GPU camera/visual order, visibility, opacity, blend and recording-safe solo',flush=True)
 # Load a real binary splat through the existing loader; test independent 3D pixels.
 splat=b''.join(struct.pack('<6f8B',x,y,z,.12,.12,.12,255,120,30,255,128,128,128,128) for x,y,z in [(-.4,-.3,0),(.4,.3,0),(-.4,.3,0),(.4,-.3,0),(0,0,0)])
 page.locator('#splatFile').set_input_files({'name':'layer-test.splat','mimeType':'application/octet-stream','buffer':splat})
 page.wait_for_function('NFXRig.layerStatus().space')
 page.evaluate("()=>{NFXLayers.transact(()=>{NFXLayers.updateLayer('camera',{visible:false});NFXLayers.updateLayer('visuals',{visible:false});});}")
 space=page.evaluate('output()')
 nonzero=page.evaluate("()=>{const c=NFXRig.render('space-check',128,128),d=c.getContext('2d').getImageData(0,0,128,128).data;return d.some((v,i)=>i%4!==3&&v>0)}")
 assert nonzero,'Loaded 3D source must draw real independent pixels'
 page.evaluate("()=>{NFXLayers.transact(()=>NFXLayers.updateLayer('space',{opacity:0}));}")
 black=page.evaluate('output()');assert space!=black
 assert page.evaluate("()=>{const c=NFXRig.render('black-check',128,128),d=c.getContext('2d').getImageData(0,0,128,128).data;return d.every((v,i)=>i%4===3||v===0)}")
 page.evaluate("()=>{NFXLayers.transact(()=>NFXLayers.updateLayer('space',{opacity:1}));}")
 assert page.evaluate('output()')==space
 print('PASS loaded 3D source is independent from visual and camera layers',flush=True)
 # Real UI changes, undo, locks, native nested controls, grouping, pinned order.
 page.evaluate("NFXLayers.select('camera')")
 set_range('[data-layer-value=opacity]',.45)
 assert page.evaluate('NFXLayers.state.layers.camera.opacity')==.45
 page.locator('[data-layer-action=undo]').click();assert page.evaluate('NFXLayers.state.layers.camera.opacity')==1
 page.locator('[data-layer-action=redo]').click();assert page.evaluate('NFXLayers.state.layers.camera.opacity')==.45
 page.locator('[data-layer-action=lock]').click();assert page.locator('[data-layer-value=opacity]').is_disabled()
 page.locator('[data-layer-action=lock]').click()
 page.evaluate("NFXLayers.select('visuals')");page.locator('[data-layer-action=enter]').click();page.evaluate("NFXLayers.select('color')")
 assert 0<page.locator('.nfx-layer-native .hc').count()<=4
 native=page.locator('.nfx-layer-native input[type=range]').first;native_id=native.evaluate('el=>el.closest("[data-id]").dataset.id');old_value=page.evaluate('(id)=>NFXRig.guideState().controls[id]',native_id);native.focus();native.press('End')
 assert page.evaluate('(id)=>NFXRig.guideState().controls[id]',native_id)!=old_value,'Nested native sliders must edit the actual rig'
 assert page.evaluate('''()=>{const box=document.querySelector('.nfx-layer-inspector').getBoundingClientRect();return [...document.querySelector('.nfx-layer-native').children].every(el=>el.getBoundingClientRect().bottom<=box.bottom+1)}'''),'Four native controls must fit in the landscape console'
 page.screenshot(path='/workspace/Neuroflux-Layers-Native-Controls.png')
 page.evaluate("NFXLayers.scope='camera';NFXPerformance.add('swirl');NFXPerformance.add('kaleidoscope');NFXLayers.paint()")
 page.locator('[data-layer-action=group]').click()
 for button in page.locator('[data-layer-action=chooseGroup]').all():button.click()
 page.locator('[data-layer-action=createGroup]').click()
 assert page.evaluate('NFXLayers.state.groups.length')==1
 group=page.evaluate('NFXLayers.state.groups[0].id');page.evaluate('(id)=>NFXLayers.select(id)',group)
 set_range('[data-layer-value=groupStrength]',.3)
 assert page.evaluate('NFXLayers.cameraState(NFXPerformance.state).nodes.every(n=>n.wet===.3)')
 page.locator('[data-layer-action=groupBypass]').click();assert page.evaluate('NFXLayers.cameraState(NFXPerformance.state).nodes.every(n=>n.bypass)')
 page.locator('[data-layer-action=enter]').click();assert page.locator('[data-layer-card]').count()==2
 page.evaluate("NFXLayers.select(NFXPerformance.state.nodes[0].id)");page.locator('[data-layer-action=lower]').click()
 assert page.evaluate('NFXPerformance.state.nodes[0].effect')=='kaleidoscope'
 page.locator('[data-layer-action=duplicate]').click();assert page.evaluate('NFXLayers.state.groups[0].nodes.length')==3
 page.locator('[data-layer-action=remove]').click();assert page.evaluate('NFXLayers.state.groups[0].nodes.length')==2
 page.locator('[data-layer-action=library]').click();page.locator('[data-layer-search]').fill('fisheye');page.locator('[data-effect=fisheye]').click()
 assert page.evaluate('NFXLayers.state.groups[0].nodes.length')==3
 page.locator('[data-layer-action=library]').click();page.locator('[data-layer-action=back]').click();assert page.evaluate('NFXLayers.scope.startsWith("group:")')
 page.locator('[data-layer-action=back]').click()
 print('PASS opacity UI, undo/redo, locking, nested native controls, effect folders and real effect order',flush=True)
 # Portable setups include the complete composition, and older files migrate.
 saved=page.evaluate("NFXPerformance.snapshot('Layer round trip')")
 assert saved['layers']['groups'][0]['strength']==.3
 page.evaluate("()=>{NFXLayers.transact(()=>NFXLayers.updateLayer('visuals',{opacity:.12}));NFXLayers.open(false)}")
 page.evaluate('(s)=>NFXPerformance.apply(s)',saved)
 assert page.evaluate('NFXLayers.state')==saved['layers']
 # Phone deck swipe selects without changing composition, plus mirrored layouts.
 page.set_viewport_size({'width':390,'height':844});page.locator('#btnLayers').tap();page.evaluate("NFXLayers.scope='root';NFXLayers.select('camera')")
 before=page.evaluate('JSON.stringify(NFXLayers.state)');cdp=page.context.new_cdp_session(page);box=page.locator('.nfx-layer-deck').bounding_box();x=box['x']+box['width']/2;y=box['y']+box['height']/2
 cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]});cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x,'y':y-60}]});cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
 assert page.evaluate('NFXLayers.selected')!='camera';assert page.evaluate('JSON.stringify(NFXLayers.state)')==before
 # Scrolling over a touch slider is safe; holding arms it for adjustment.
 page.evaluate("NFXLayers.select('camera')");page.wait_for_timeout(650);before_opacity=page.evaluate('NFXLayers.state.layers.camera.opacity');slider=page.locator('[data-layer-value=opacity]').bounding_box();sx=slider['x']+slider['width']/2;sy=slider['y']+slider['height']/2
 cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':sx,'y':sy}]});cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':sx,'y':sy-35}]});cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
 assert page.evaluate('NFXLayers.state.layers.camera.opacity')==before_opacity
 page.locator('.nfx-layer-inspector').evaluate('el=>el.scrollTop=0');slider=page.locator('[data-layer-value=opacity]').bounding_box();sx=slider['x']+slider['width']/2;sy=slider['y']+slider['height']/2
 cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':sx,'y':sy}]});page.wait_for_timeout(550);cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':sx+45,'y':sy}]});cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
 assert page.evaluate('NFXLayers.state.layers.camera.opacity')>before_opacity
 page.evaluate("()=>{NFXLayers.transact(()=>{for(const id of ['camera','visuals','space'])NFXLayers.updateLayer(id,{visible:true});});NFXLayers.select('camera');}");page.wait_for_timeout(450)
 page.screenshot(path='/workspace/Neuroflux-Layers-Portrait.png')
 for width,height in [(844,390),(640,360),(390,844)]:
  page.set_viewport_size({'width':width,'height':height});page.wait_for_timeout(120)
  for left in [False,True]:
   page.evaluate('(left)=>{NFXLayers.hand=left?"left":"right";NFXLayers.rootElement.classList.toggle("nfx-layer-left",left)}',left)
   bounds=page.locator('.nfx-layer-inspector').bounding_box();assert bounds['x']>=0 and bounds['y']>=0 and bounds['x']+bounds['width']<=width and bounds['y']+bounds['height']<=height
   if width>height:assert bounds['y']>height*.5
 page.set_viewport_size({'width':844,'height':390});page.wait_for_timeout(450);page.screenshot(path='/workspace/Neuroflux-Layers-Landscape.png')
 # Only the hardware performance probe is bypassed for this software GPU.
 # MediaRecorder, output rendering, local storage and decoded playback stay real.
 page.evaluate("()=>{NFXLayers.transact(()=>{NFXLayers.updateLayer('camera',{visible:true,opacity:1,blend:'normal'});NFXLayers.updateLayer('visuals',{visible:false});NFXLayers.updateLayer('space',{visible:false});});NFXLayers.previewSolo='visuals';Object.assign(NFXStudio.profiles[0],{width:128,height:128,fps:24,mode:'clean',title:''});Object.assign(NFXStudio.settings,{kind:'video',dual:false,stems:false,mixed:false,limit:0});NFXStudio.testOutputs=async()=>true;}")
 page.evaluate('NFXStudio.start()');page.wait_for_function('NFXStudio.session?.status==="recording"',timeout=30000);page.wait_for_timeout(700)
 assert page.locator('#nfxLayerWorkspace').is_visible(), 'Layer editing remains available in advanced recording'
 pixel=page.evaluate('Array.from(NFXStudio.outputs[0].canvas.getContext("2d").getImageData(96,100,1,1).data)');assert pixel[2]>130 and pixel[0]<80,pixel
 page.evaluate('NFXStudio.stop()');page.wait_for_function('!NFXStudio.session');page.evaluate('NFXLayers.open(false);NFXStudio.phoneSave.suspend()')
 decoded=page.evaluate('''async()=>{const a=(await NFXStudio.store.list()).find(a=>a.kind==='video'),blob=await NFXStudio.store.blob(a),v=document.createElement('video'),url=URL.createObjectURL(blob);v.muted=true;v.playsInline=true;try{await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Saved video did not decode')),10000);v.onloadeddata=()=>{clearTimeout(timer);resolve()};v.onerror=()=>reject(Error('Saved video is unplayable'));v.src=url;});await v.play();await new Promise(resolve=>v.requestVideoFrameCallback? v.requestVideoFrameCallback(resolve):requestAnimationFrame(()=>requestAnimationFrame(resolve)));const c=document.createElement('canvas');c.width=v.videoWidth;c.height=v.videoHeight;c.getContext('2d').drawImage(v,0,0);return {width:c.width,height:c.height,pixel:Array.from(c.getContext('2d').getImageData(96,100,1,1).data)}}finally{v.pause();URL.revokeObjectURL(url)}}''')
 assert decoded['width']==128 and decoded['height']==128 and decoded['pixel'][2]>130 and decoded['pixel'][0]<80,decoded
 print('PASS actual recorded video decodes to the final camera layer while the deck and visual solo are open',flush=True)
 assert not errors,errors
 print('PASS setup round trip, touch browse leaves settings intact, portrait and mirrored landscape; no browser errors',flush=True)
 b.close()
server.shutdown()
