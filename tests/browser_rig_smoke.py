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
            page.wait_for_timeout(800);page.locator('#nfxStudioBar [data-action=open]').click()
            page.wait_for_timeout(500)
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
            assert page.evaluate('window.NFXStudio.outputs[1].canvas.width')==192
            assert page.evaluate('window.NFXStudio.outputs[1].canvas.height')==128
            page.locator('#nfx-tab-audio').click();page.locator('#nfx-tab-library').click()
            assert not errors,errors
            page.screenshot(path=str(pathlib.Path(tempfile.gettempdir())/'neuroflux-mobile-studio.png'))
            print('PASS real rig: nine WebGL scenes, Studio modes, rotation, mobile layout, audio/library navigation; no JS errors')
            browser.close()
    finally:server.shutdown();server.server_close()

if __name__=='__main__':main()
