import functools,http.server,threading
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]/'public'
class Handler(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(root)))
threading.Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 ctx=b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True);page=ctx.new_page();errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)));page.goto(f'http://127.0.0.1:{server.server_port}/launch.html',wait_until='domcontentloaded')
 page.wait_for_function('window.NFXStudio?.storageReady && navigator.serviceWorker.controller')
 manifest=ctx.new_cdp_session(page).send('Page.getAppManifest');assert not manifest['errors'],manifest['errors']; assert '"standalone"' in manifest['data']
 assert page.locator('#nfxInstallApp').is_visible();page.locator('#nfxInstallApp').click();assert page.locator('#nfxInstallHelp').is_visible()
 ctx.set_offline(True);page.reload(wait_until='domcontentloaded');page.wait_for_function('window.NFXStudio?.storageReady');assert page.locator('#startBYOS').count()==1
 assert not errors,errors
 print('PASS manifest parsed, install guidance visible, service worker and offline standalone start')
 b.close()
server.shutdown()
