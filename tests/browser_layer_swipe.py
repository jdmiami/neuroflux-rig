"""Trusted touch: continuous card motion, momentum, interruption and cancellation."""
import functools,http.server,threading,time
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
 page.wait_for_function('!NFXLayers.deckMotion.busy')
 page.evaluate('''()=>{window.paintCount=0;const paint=NFXLayers.paint.bind(NFXLayers);NFXLayers.paint=()=>{paintCount++;return paint()};window.busyRenderCounts=[];let count=0;const render=NFXRig.render.bind(NFXRig);NFXRig.render=(...args)=>{count++;return render(...args)};const frame=NFXLayers.frame.bind(NFXLayers);NFXLayers.frame=(now)=>{count=0;const busy=NFXLayers.deckMotion.busy;frame(now);if(busy)busyRenderCounts.push(count)};}''')
 cdp=page.context.new_cdp_session(page)
 def touch(kind,points=[]):cdp.send('Input.dispatchTouchEvent',{'type':kind,'touchPoints':[{'id':i+1,'x':x,'y':y} for i,(x,y) in enumerate(points)]})
 def center():
  box=page.locator('.nfx-layer-stage').bounding_box();return (box['x']+box['width']/2,box['y']+box['height']/2)
 def settle():page.wait_for_function('!NFXLayers.deckMotion.busy');page.wait_for_timeout(40)
 def select(id):page.evaluate('(id)=>NFXLayers.select(id)',id);settle()
 def idx():return page.evaluate('NFXLayers.items().findIndex(i=>i.id===NFXLayers.selected)')
 # Continuous movement is observable before release, without rebuilding any
 # cards or inspector. A slow, held 0.6-card drag settles to exactly one card.
 start=idx();state=page.evaluate('JSON.stringify(NFXLayers.state)');x,y=center();paints=page.evaluate('paintCount');step=page.evaluate('Math.max(64,Math.min(115,NFXLayers.deck.clientHeight*.28))')
 touch('touchStart',[(x,y)]);positions=[]
 for delta in [.15,.3,.5,.6]:
  touch('touchMove',[(x,y-step*delta)]);page.wait_for_function('(v)=>Math.abs(NFXLayers.deckMotion.position-v)<.02',arg=start+delta);positions.append(page.evaluate('NFXLayers.deckMotion.position'))
 assert all(a<b for a,b in zip(positions,positions[1:])) and .5<positions[-1]-start<.8,positions
 assert page.evaluate('paintCount')==paints,'Pointer moves must not rebuild inspector/card DOM'
 assert page.evaluate('getComputedStyle(NFXLayers.deck.querySelector("[aria-selected=true]")).transitionDuration')=='0s','No CSS lag while finger is down'

 lanes=page.evaluate('''()=>{const items=NFXLayers.items(),i=items.findIndex(i=>i.id===NFXLayers.selected),cards=[items[i],items[i+1]].map(item=>document.querySelector('[data-layer-card="'+item.id+'"]'));return cards.map(card=>{const r=card.getBoundingClientRect(),style=getComputedStyle(card),m=new DOMMatrixReadOnly(style.transform);return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,scale:Math.hypot(m.m11,m.m12,m.m13),transition:style.transitionProperty}})}''')
 left,right=lanes;assert left['x']>=right['right'] or right['x']>=left['right'] or left['y']>=right['bottom'] or right['y']>=left['bottom'],lanes
 assert all(c['scale']<page.evaluate('NFXLayers.sceneZoom')*.85 for c in lanes),lanes
 page.screenshot(path='/workspace/Neuroflux-Swipe-Mid-Drag.png')
 page.wait_for_timeout(150);touch('touchEnd');settle();assert idx()==start+1,(start,idx(),positions)
 assert page.evaluate('JSON.stringify(NFXLayers.state)')==state
 assert page.evaluate('getComputedStyle(NFXLayers.deck.querySelector("[aria-selected=true]")).transitionProperty').find('transform')<0,'Release must follow the orbit, not a straight transform interpolation'
 assert page.evaluate('paintCount')==paints+1,'Only the settled selection should paint'
 print('PASS finger-following fractional motion, one paint per swipe, predictable slow snap, unchanged mix',flush=True)
 # The main interaction takes at most one auxiliary GPU render per refresh.
 assert page.evaluate('busyRenderCounts.length>0&&Math.max(...busyRenderCounts)<=1')
 assert page.evaluate('NFXLayers.previewTargets.size')<=9
 print('PASS one-render preview budget during motion; no pointermove inspector rebuilds',flush=True)
 # Cancelling and reversing never commit a stray card or retain old velocity.
 select('visual-contrast');start=idx();x,y=center();touch('touchStart',[(x,y)]);touch('touchMove',[(x,y-step*.6)]);page.wait_for_timeout(70);touch('touchCancel');settle();assert idx()==start
 touch('touchStart',[(x,y)]);touch('touchMove',[(x,y-step*.8)]);page.wait_for_timeout(70);touch('touchMove',[(x,y-step*.1)]);page.wait_for_timeout(160);touch('touchEnd');settle();assert idx()==start
 print('PASS cancellation, reverse drag and stale velocity rejection',flush=True)
 # Horizontal drags use the same diagonal stack, and bounds resist overscroll.
 touch('touchStart',[(x,y)]);touch('touchMove',[(x+60,y)]);page.wait_for_timeout(160);touch('touchEnd');settle();assert idx()==start+1
 page.evaluate('NFXLayers.select(NFXLayers.items()[0].id)');settle();x,y=center();touch('touchStart',[(x,y)]);touch('touchMove',[(x,y+100)]);page.wait_for_timeout(70);assert page.evaluate('NFXLayers.deckMotion.position')>=-.221;touch('touchEnd');settle();assert idx()==0
 page.evaluate('NFXLayers.select(NFXLayers.items().at(-1).id)');settle();last=idx();x,y=center();touch('touchStart',[(x,y)]);touch('touchMove',[(x,y-100)]);page.wait_for_timeout(70);assert page.evaluate('NFXLayers.deckMotion.position')<=last+.221;touch('touchEnd');settle();assert idx()==last
 print('PASS horizontal browsing and resisted boundaries',flush=True)
 # A quick physical swipe carries momentum beyond a slow drag, with bounded
 # travel even when input events have been coalesced by the browser.
 select('visual-contrast');start=idx();x,y=center();stamp=time.time()
 for kind,point,at in [('touchStart',[(x,y)],stamp-.09),('touchMove',[(x,y-step*.6)],stamp-.03),('touchEnd',[],stamp)]:
  cdp.send('Input.dispatchTouchEvent',{'type':kind,'timestamp':at,'touchPoints':[{'id':1,'x':a,'y':b} for a,b in point]})
 settle();assert start+1<=idx()<=start+3,(start,idx())
 print('PASS bounded swipe momentum',flush=True)

 # Grabbing a card during its glide starts from the visible transform, rather
 # than teleporting to the destination. Inspect both sides in one JS task.
 select('visual-contrast')
 page.evaluate('NFXLayers.browse(2)');page.wait_for_timeout(60)
 page.evaluate('''()=>{const deck=NFXLayers.deck;deck.addEventListener('pointerdown',()=>{window.grabBefore=new DOMMatrixReadOnly(getComputedStyle(deck.querySelector('[aria-selected=true]')).transform).m41},{capture:true,once:true});deck.addEventListener('pointerdown',()=>{window.grabAfter=new DOMMatrixReadOnly(getComputedStyle(deck.querySelector('[aria-selected=true]')).transform).m41},{once:true});}''')
 x,y=center();page.mouse.move(x,y);page.mouse.down()
 before,after=page.evaluate('[grabBefore,grabAfter]')
 assert abs(before-after)<1,(before,after)
 page.mouse.up();settle()
 print('PASS grabbing an in-flight glide preserves its visible position',flush=True)
 # The same fractional motion works in short landscape screens. Dedicated
 # grip dragging retains its separate, intentional effect-order operation.
 page.set_viewport_size({'width':844,'height':390});select('visual-contrast');start=idx();x,y=center();step=page.evaluate('Math.max(64,Math.min(115,NFXLayers.deck.clientHeight*.28))')
 touch('touchStart',[(x,y)]);touch('touchMove',[(x,y-step*.6)]);page.wait_for_function('(v)=>Math.abs(NFXLayers.deckMotion.position-v)<.02',arg=start+.6);page.wait_for_timeout(160);touch('touchEnd');settle();assert idx()==start+1
 page.evaluate("NFXPerformance.add('swirl');NFXPerformance.add('horizontal-mirror');NFXLayers.select(NFXPerformance.state.nodes[0].id)");settle()
 order=page.evaluate('NFXPerformance.state.nodes.map(n=>n.id)');page.locator('[data-layer-grip]').hover();grip=page.locator('[data-layer-grip]').bounding_box();gx=grip['x']+grip['width']/2;gy=grip['y']+grip['height']/2
 page.mouse.move(gx,gy);page.mouse.down();page.mouse.move(gx,gy-55,steps=3);page.mouse.up();settle();assert page.evaluate('NFXPerformance.state.nodes.map(n=>n.id)')==order[::-1],{'before':order,'after':page.evaluate('NFXPerformance.state.nodes.map(n=>n.id)'),'selected':page.evaluate('NFXLayers.selected')}
 print('PASS landscape finger tracking and separate grip-based effect reordering',flush=True)
 page.set_viewport_size({'width':390,'height':844})
 # Pinch must cancel one-finger navigation, and a three-finger hold still exits.
 select('visual-contrast');start=idx();x,y=center();touch('touchStart',[(x-35,y),(x+35,y)]);touch('touchMove',[(x-95,y),(x+95,y)]);touch('touchEnd');settle();assert idx()==start and page.evaluate('NFXLayers.sceneZoom')==1.25
 touch('touchStart',[(x-60,y),(x,y),(x+60,y)]);page.wait_for_function('!NFXLayers.opened');touch('touchEnd')
 assert not errors,errors
 print('PASS pinch and three-finger hold remain independent from card browsing',flush=True)
 b.close()
server.shutdown()
