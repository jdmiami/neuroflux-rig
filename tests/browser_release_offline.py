import functools,http.server,threading
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]/'public'
class Handler(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(root)))
threading.Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 ctx=b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True);page=ctx.new_page();errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.route('**/vendor/**',lambda r:r.abort())
 page.goto(f'http://127.0.0.1:{server.server_port}/launch.html');page.wait_for_function('window.NFXStudio?.storageReady && navigator.serviceWorker.controller')
 assert page.locator('#startBYOS').count()==1
 ctx.set_offline(True);page.reload();page.wait_for_function('window.NFXStudio?.storageReady')
 assert page.locator('#startBYOS').count()==1
 assert not errors,errors
 print('PASS: core installs without optional vendor files and launches offline')
 b.close()
server.shutdown()
