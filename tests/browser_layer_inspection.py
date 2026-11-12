"""Responsive layer scene, bounded zoom and real same-frame effect comparisons."""
import functools,http.server,threading
from playwright.sync_api import sync_playwright
from browser_camera_fx import Handler,ROOT
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT/'public')))
threading.Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 page=b.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,service_workers='block');errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.route('https://fonts.googleapis.com/**',lambda r:r.abort());page.route('https://fonts.gstatic.com/**',lambda r:r.abort())
 page.goto(f'http://127.0.0.1:{server.server_port}/',wait_until='domcontentloaded');page.wait_for_function('window.NFXLayers&&window.NFXStudio?.storageReady')
 page.locator('#start [data-go=sim]').click();page.wait_for_function('!document.getElementById("start")');page.evaluate("NFXRig.setParam('res',0,'user');NFXLayers.open();NFXLayers.select('visual-contrast')")
 page.wait_for_timeout(600)
 # The paired post passes share the very same feedback texture and clock.
 page.evaluate('''()=>{window.measurePair=async(control,value)=>{NFXRig.setParam(control,value,'user');await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const after=NFXRig.render('comparison-proof',192,192,{solo:'visuals',stage:'visual-'+control,compare:true}),before=after.layerBefore,a=after.getContext('2d').getImageData(0,0,192,192).data,b=before.getContext('2d').getImageData(0,0,192,192).data;let delta=0;for(let i=0;i<a.length;i+=4)for(let c=0;c<3;c++)delta+=Math.abs(a[i+c]-b[i+c]);return delta/(192*192*3)};}''')
 for control,value in [('contrast',1.8),('bright',1.6),('sat',0)]:
  neutral=page.evaluate('c=>measurePair(c,1)',control);changed=page.evaluate('([c,v])=>measurePair(c,v)',[control,value]);assert neutral<.1,(control,neutral);assert changed>2,(control,changed)
  page.evaluate('(c)=>NFXRig.setParam(c,1,"user")',control)
 print('PASS brightness, contrast and saturation compare actual before/after pixels; neutral operations are identical',flush=True)
 page.wait_for_function('document.querySelector(".nfx-scene-context").textContent.includes("Neutral")')
 page.locator('[data-layer-action=previewMode]').click();page.wait_for_function('NFXLayers.previewMode==="difference"');page.wait_for_timeout(250)
 page.wait_for_function('''()=>{const c=document.querySelector('[data-layer-preview="visual-contrast"]'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;return d.every((v,i)=>i%4===3||v<=2)}''',timeout=15000)
 page.evaluate("NFXRig.setParam('contrast',1.8,'user')");page.wait_for_timeout(400)
 assert page.evaluate('''()=>{const c=document.querySelector('[data-layer-preview="visual-contrast"]');return c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4!==3&&v>10)}''')
 page.locator('[data-layer-action=previewMode]').click();page.locator('[data-layer-action=previewMode]').click();assert page.evaluate('NFXLayers.previewMode')=='compare'
 # Each phone layout reserves separate, nonoverlapping regions. The selected
 # card and its title fit at both zoom limits, regardless of original aspect.
 for width,height in [(320,568),(390,844),(430,932),(844,390),(667,375),(1024,768)]:
  page.set_viewport_size({'width':width,'height':height});page.wait_for_timeout(200)
  for zoom in [.7,1,1.25]:
   page.evaluate('(z)=>NFXLayers.setZoom(z)',zoom);page.wait_for_timeout(380)
   bounds=page.evaluate('''()=>{const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height}},card=rect('[data-layer-card][aria-selected=true]'),stage=rect('.nfx-layer-stage'),head=rect('.nfx-layer-header'),inspector=rect('.nfx-layer-inspector'),footer=rect('.nfx-scene-footer'),title=rect('[data-layer-card][aria-selected=true] .nfx-layer-card-top');return {card,stage,head,inspector,footer,title,buttons:[...document.querySelectorAll('.nfx-layer-header button,.nfx-scene-footer button')].map(b=>{const r=b.getBoundingClientRect();return {x:r.x,right:r.right,w:r.width,h:r.height}})}}''')
   card,stage=bounds['card'],bounds['stage'];assert card['x']>=stage['x']-2 and card['right']<=stage['right']+2,(width,height,zoom,bounds)
   assert card['y']>=stage['y']-2 and card['bottom']<=stage['bottom']+2,(width,height,zoom,bounds)
   assert bounds['head']['bottom']<=stage['y']+1 and stage['bottom']<=bounds['inspector']['y']+1 and bounds['inspector']['bottom']<=bounds['footer']['y']+1,bounds
   assert bounds['title']['y']>=stage['y']-1 and bounds['title']['bottom']<=stage['bottom']+1,bounds
   assert all(button['w']>=43 and button['h']>=43 and button['x']>=0 and button['right']<=width for button in bounds['buttons']),bounds
  page.evaluate("NFXLayers.select('visual-bright')");assert page.evaluate('NFXLayers.sceneZoom')==1.25,'Browsing must preserve zoom'
  page.locator('[data-layer-action=zoomFit]').click();assert page.evaluate('NFXLayers.sceneZoom')==1
  page.screenshot(path=f'/workspace/Neuroflux-Layer-Fit-{width}x{height}.png')
 print('PASS titles, 44px buttons and selected cards fit six screen sizes at all zoom limits; browsing keeps zoom',flush=True)
 page.evaluate('NFXLayers.setZoom(100)');assert page.evaluate('NFXLayers.sceneZoom')==1.25;assert page.locator('[data-layer-action=zoomIn]').is_disabled()
 page.evaluate('NFXLayers.setZoom(-100)');assert page.evaluate('NFXLayers.sceneZoom')==.7;assert page.locator('[data-layer-action=zoomOut]').is_disabled()
 # Trusted touch pinch cannot accidentally browse, reorder or toggle controls.
 page.set_viewport_size({'width':390,'height':844});page.locator('[data-layer-action=zoomFit]').click();page.wait_for_timeout(450)
 cdp=page.context.new_cdp_session(page)
 def touch(kind,points=[]):cdp.send('Input.dispatchTouchEvent',{'type':kind,'touchPoints':[{'id':i+1,'x':x,'y':y} for i,(x,y) in enumerate(points)]})
 y=page.locator('.nfx-layer-stage').bounding_box()['y']+110;selected=page.evaluate('NFXLayers.selected');touch('touchStart',[(160,y),(230,y)]);touch('touchMove',[(100,y),(290,y)]);touch('touchEnd');page.wait_for_timeout(400)
 assert page.evaluate('NFXLayers.sceneZoom')==1.25;assert page.evaluate('NFXLayers.selected')==selected
 touch('touchStart',[(160,y),(230,y)]);touch('touchMove',[(185,y),(205,y)]);touch('touchEnd');page.wait_for_timeout(400)
 assert page.evaluate('NFXLayers.sceneZoom')==.7;assert page.evaluate('NFXLayers.selected')==selected
 page.locator('[data-layer-action=zoomFit]').click()
 touch('touchStart',[(120,y),(190,y),(260,y)]);page.wait_for_function('!NFXLayers.opened');touch('touchEnd');page.wait_for_timeout(450)
 page.evaluate('NFXLayers.open()')
 print('PASS real touch pinch clamps at both limits without browsing, and the three-finger exit still works afterward',flush=True)
 # Camera snapshots are taken in the production pipeline, immediately before
 # and after each operation, without advancing temporal effects twice.
 page.evaluate('''async()=>{const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');x.fillStyle='#537ba2';x.fillRect(0,0,128,128);x.fillStyle='#f5af43';x.fillRect(0,0,50,80);navigator.mediaDevices.getUserMedia=async()=>c.captureStream(15);NFXRig.setParam('cam',1,'user');NFXPerformance.add('swirl');NFXLayers.scope='root';NFXLayers.select(NFXPerformance.state.nodes[0].id);}''')
 page.wait_for_function('NFXRig.layerStatus().camera');page.wait_for_function('NFXPerformance.renderer?.previews.has("before:"+NFXLayers.selected)')
 page.evaluate('''()=>{const id=NFXLayers.selected,renderer=NFXPerformance.renderer,delta=(a,b)=>{const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d');x.drawImage(a,0,0,64,64);x.globalCompositeOperation='difference';x.drawImage(b,0,0,64,64);return x.getImageData(0,0,64,64).data.some((v,i)=>i%4!==3&&v>5)};if(!delta(renderer.previews.get(id),renderer.previews.get('before:'+id)))throw Error('Camera before and after are identical');}''')
 page.locator('[data-layer-action=bypass]').click();page.wait_for_function('document.querySelector(".nfx-scene-context").textContent.includes("Bypassed")')
 print('PASS camera before/after snapshots and explicit bypass state',flush=True)
 assert not errors,errors
 b.close()
server.shutdown()
