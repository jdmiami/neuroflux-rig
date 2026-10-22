"""Smoke the real WebGL rig and Studio at a mobile viewport (software GPU).
This does not certify physical-device performance or mobile background behavior.
"""
import functools
import http.server
import pathlib
import tempfile
import threading
from playwright.sync_api import sync_playwright
from browser_studio import Handler, ROOT

def main():
    server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT/'public')))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    try:
        with sync_playwright() as p:
            browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,
                args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
            context=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=1,service_workers='block')
            page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
            page.route('https://fonts.googleapis.com/**',lambda r:r.abort());page.route('https://fonts.gstatic.com/**',lambda r:r.abort())
            page.route('**/api/ai**',lambda r:r.fulfill(json={'ok':True,'key':False,'models':{}}))
            page.add_init_script("""localStorage.setItem('nfx.state.v1',JSON.stringify({P:{res:0,cx:0,bloom:0,fb:0,mode:8}}));
              localStorage.setItem('nfx.studio.v1',JSON.stringify({profiles:[{width:128,height:128,fps:24},{width:128,height:192,fps:24}],settings:{countdown:0,stems:false}}));""")
            page.goto(f'http://127.0.0.1:{server.server_port}/',wait_until='domcontentloaded')
            page.wait_for_function('window.NFXStudio?.storageReady');page.locator('#start [data-go=sim]').click()
            page.wait_for_timeout(800);page.locator('#btnMenu').click()
            page.locator('#tabs [data-p="recording"]').click()
            page.wait_for_timeout(500)
            assert page.locator('#nfxStudioBar').count()==0
            assert page.locator('#dock #btnRecord').count()==1
            assert page.locator('#pages #nfxStudioPanel').count()==1
            assert page.locator('#shName').inner_text()=='RECORD'
            page.locator('#nfx-tab-output').click()
            page.locator('[data-field="output.mode"]').select_option('full')
            page.wait_for_timeout(500)
            assert page.evaluate('window.NFXStudio.outputs[0].canvas.width')==128
            assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
            assert page.locator('#nfxStudioPanel').bounding_box()['width']<=390
            # Every shader core can update while the independent output is rendered.
            for mode in range(9):
                page.evaluate('mode=>window.NFXRig.setParam("mode",mode,"user")',mode)
                page.wait_for_timeout(150)
            page.locator('[data-field="output.rotation"]').select_option('90');page.wait_for_timeout(150)
            page.locator('[data-output="1"]').click()
            page.wait_for_timeout(150)
            page.locator('[data-field="output.rotation"]').select_option('90');page.wait_for_timeout(150)
            page.wait_for_function('window.NFXStudio.outputs[1].canvas.width===192')
            assert page.evaluate('window.NFXStudio.outputs[1].canvas.height')==128
            page.locator('#nfx-tab-audio').click();page.locator('#nfx-tab-library').click()
            assert not errors,errors
            page.screenshot(path=str(pathlib.Path(tempfile.gettempdir())/'neuroflux-mobile-studio.png'))
            # The existing menu button closes the recording page as it does any other page.
            page.locator('#btnMenu').click();page.wait_for_function('!window.NFXStudio.opened')
            for width,height in [(320,740),(390,844),(844,390),(1280,800)]:
                page.set_viewport_size({'width':width,'height':height});page.wait_for_timeout(180)
                assert page.evaluate('''()=>{
                  const dock=document.querySelector('#dock').getBoundingClientRect();
                  const ids=['btnSrc','btnPlay','btnAI','btnRecord','btnMenu'];
                  const boxes=ids.map(id=>document.getElementById(id).getBoundingClientRect()).sort((a,b)=>a.x-b.x);
                  return boxes.every((r,i)=>r.x>=dock.x&&r.right<=dock.right+1&&r.y>=dock.y&&r.bottom<=dock.bottom+1&&(!i||r.x>=boxes[i-1].right-1));
                }'''),f'Dock overlap at {width}×{height}'
            page.set_viewport_size({'width':390,'height':844})
            page.evaluate('()=>{const s=window.NFXStudio;s.settings.kind="audio";s.settings.stems=false;s.settings.mixed=false;s.settings.limit=0;}')
            page.locator('#btnRecord').click()
            page.wait_for_function('!document.querySelector("#nfxStudioCountdown").hidden')
            page.screenshot(path=str(pathlib.Path(tempfile.gettempdir())/'neuroflux-native-countdown.png'))
            page.locator('[data-action=cancelCountdown]').click()
            page.wait_for_function('!window.NFXStudio.starting')
            assert page.evaluate('window.NFXStudio.store.list().then(a=>a.length)')==0
            page.locator('#btnRecord').click()
            page.wait_for_function('window.NFXStudio.session?.status==="recording"')
            assert not page.evaluate('window.NFXStudio.opened')
            page.set_viewport_size({'width':320,'height':740});page.wait_for_timeout(300)
            assert page.evaluate('''()=>{
              const d=document.querySelector('#dock').getBoundingClientRect();
              const boxes=Array.from(document.querySelectorAll('#dock button')).map(e=>e.getBoundingClientRect()).filter(r=>r.width&&r.height).sort((a,b)=>a.x-b.x);
              return boxes.every((r,i)=>r.x>=d.x&&r.right<=d.right+1&&(!i||r.x>=boxes[i-1].right-1));
            }'''),'Active recording dock overlaps at 320px'
            page.screenshot(path=str(pathlib.Path(tempfile.gettempdir())/'neuroflux-native-recording.png'))
            page.locator('#nfxRecordControls [data-action=pause]').click()
            page.wait_for_function('window.NFXStudio.session.status==="paused"')
            page.locator('#nfxRecordControls [data-action=pause]').click()
            page.wait_for_function('window.NFXStudio.session.status==="recording"')
            page.locator('#btnRecord').click();page.wait_for_function('!window.NFXStudio.session')
            assert page.evaluate('window.NFXStudio.store.list().then(a=>a.some(x=>x.status==="complete"&&x.bytes>0))')
            assert not errors,errors
            print('PASS real rig: native recording menu/dock, nine WebGL scenes, rotation, portrait/landscape/desktop layout; no JS errors')
            print('PASS real dock: tap-to-record, cancelable countdown, compact active controls at 320px, pause/resume, stop/save')
            browser.close()
    finally:server.shutdown();server.server_close()

if __name__=='__main__':main()
