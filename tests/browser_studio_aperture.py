"""Verify the real studio aperture with browser touch input and native tool routes."""
import functools, http.server, math, threading
from playwright.sync_api import sync_playwright

from browser_camera_fx import Handler, ROOT

server = http.server.ThreadingHTTPServer(('127.0.0.1',0), functools.partial(Handler,directory=str(ROOT/'public')))
threading.Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    page = browser.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,service_workers='block')
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.route('https://fonts.googleapis.com/**',lambda route:route.abort())
    page.route('https://fonts.gstatic.com/**',lambda route:route.abort())
    page.add_init_script("localStorage.setItem('nfx.state.v1', JSON.stringify({P:{res:0,mode:0,fb:.45}}));")
    page.goto(f'http://127.0.0.1:{server.server_port}/',wait_until='domcontentloaded')
    page.wait_for_function('window.NFXPerformance?.layers&&window.NFXStudio?.storageReady')
    page.locator('#start [data-go=sim]').click()
    page.wait_for_function('!document.getElementById("start")')
    dialog = page.locator('#nfxStudioTools')
    trigger = page.locator('#btnMenu')
    active = dialog.locator('[data-studio-group][aria-pressed=true]')
    def open_tools():
        trigger.click()
        dialog.wait_for(state='visible')
        page.wait_for_function('document.querySelector("#nfxStudioTools").style.getPropertyValue("--lens-exposure")==="1.000"')
    def choose(term,label):
        open_tools()
        dialog.get_by_role('button', name='Find a tool').click()
        dialog.get_by_role('searchbox').fill(term)
        dialog.get_by_role('button',name=label, exact=True).click()
        dialog.wait_for(state='hidden')
    def close_editor():
        assert page.evaluate('NFXRig.guideState().ui.menuOpen')
        page.locator('#shClose').click()
    open_tools()
    assert active.inner_text() == 'Create'
    cdp = page.context.new_cdp_session(page)
    def turn_once():
        stage = dialog.locator('.nfx-aperture').bounding_box()
        x,y = stage['x']+stage['width']/2,stage['y']+stage['height']/2
        r = min(stage['width']*.31,stage['height']*.39,178)*.88
        params=lambda angle: {'touchPoints':[{'x':x+math.cos(angle)*r,'y':y+math.sin(angle)*r}]}
        start=-1.3
        cdp.send('Input.dispatchTouchEvent',{'type':'touchStart',**params(start)})
        for step in range(1,9):
            cdp.send('Input.dispatchTouchEvent',{'type':'touchMove',**params(start-step*.135)})
        page.wait_for_timeout(160)
        cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
    turn_once()
    assert active.inner_text() == 'Camera & 3D',active.inner_text()
    assert dialog.get_by_role('button',name='Camera effects',exact=True).is_visible()
    page.wait_for_timeout(600)
    active.focus()
    page.keyboard.press('ArrowRight')
    assert active.inner_text()=='Perform'
    dialog.get_by_role('button',name='Sound input',exact=True).click()
    dialog.wait_for(state='hidden')
    assert page.evaluate('NFXRig.guideState().ui.page')=='input'
    close_editor()
    open_tools()
    page.keyboard.press('Escape')
    dialog.wait_for(state='hidden')
    assert trigger.evaluate('(el)=>document.activeElement===el')
    print('PASS trusted thumb rotation, detent, group routing, arrow keys and return focus',flush=True)
    for (term,label,target) in [('kaleidoscope','Camera effects','cam'),('portrait fps','Output framing','recording'),('saved takes','Library','recording'),('offline','System','sys')]:
        choose(term,label)
        assert page.evaluate('NFXRig.guideState().ui.page')==target
        close_editor()
    choose('reorder','Live layers')
    assert page.evaluate('NFXLayers.opened')
    page.locator('[data-layer-action=close]').click()
    page.locator('#nfxLayerWorkspace').wait_for(state='hidden')
    open_tools()
    dialog.get_by_role('button',name='All controls').click()
    close_editor()
    print('PASS real Camera FX, recording output, Library, System and Layers routes plus full menu',flush=True)
    for w,h in [(320,568),(390,844),(844,390),(1280,800)]:
        page.set_viewport_size({'width':w,'height':h})
        open_tools()
        page.wait_for_timeout(400)
        boxes=dialog.locator('[data-studio-group]').evaluate_all('(buttons)=>buttons.map(b=>{const r=b.getBoundingClientRect();return [r.left,r.top,r.right,r.bottom]})')
        assert all(0<=x1<x2<=w and 0<=y1<y2<=h for x1,y1,x2,y2 in boxes),(w,h,boxes)
        for index,a in enumerate(boxes):
            for b in boxes[index+1:]:
                assert a[2]<=b[0] or b[2]<=a[0] or a[3]<=b[1] or b[3]<=a[1],(w,h,a,b)
        dialog.get_by_role('button',name='Close tools').click()
        dialog.wait_for(state='hidden')
    page.emulate_media(reduced_motion='reduce')
    open_tools()
    assert dialog.evaluate('el=>el.getAnimations({subtree:true}).length')==0
    before = active.get_attribute('data-studio-group')
    turn_once()
    assert int(active.get_attribute('data-studio-group'))==(int(before)+1)%6
    page.keyboard.press('Escape')
    dialog.wait_for(state='hidden')
    page.evaluate('NFXPerformance.byos.setMode(true)')
    trigger.click()
    assert not dialog.is_visible() and page.evaluate('NFXRig.guideState().ui.menuOpen')
    close_editor()
    page.evaluate('NFXPerformance.take.enter()')
    assert not dialog.is_visible() and page.evaluate('NFXPerformance.take.enabled')
    assert not errors,errors
    print('PASS bounds and label clearance on four screens, reduced motion, BYOS and Landscape Take',flush=True)
    browser.close()
server.shutdown()
