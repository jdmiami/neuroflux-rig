"""Reproduce an old offline shell surviving reload; recover without deleting takes.
Run: python -u tests/browser_app_update.py
"""
import functools
import gzip
import http.server
import json
import pathlib
import threading
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
ASSETS = ['/', '/index.html'] + [f'/c{i}.bin' for i in range(5)]
payload = gzip.decompress(b''.join((ROOT / 'public' / f'c{i}.bin').read_bytes() for i in range(5)))
payload = gzip.compress(payload.replace(b'<head>', b'<head><script>window.cachedUpdateTest="legacy";</script>', 1))
size = (len(payload) + 4) // 5
legacy_chunks = {f'/c{i}.bin': payload[i*size:(i+1)*size] for i in range(5)}
state = {'deployed': False}

class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        path = self.path.split('?')[0]
        data = None
        if path == '/sw.js':
            data = (ROOT / 'src/studio/sw.js').read_text().replace('__NFX_CACHE_VERSION__', 'test-current' if state['deployed'] else 'test-legacy').replace('__NFX_ASSETS__', json.dumps(ASSETS)).encode()
        elif not state['deployed'] and path in legacy_chunks:
            data = legacy_chunks[path]
        if data is None: return super().do_GET()
        self.send_response(200)
        self.send_header('Content-Type', 'text/javascript' if path == '/sw.js' else 'application/octet-stream')
        self.send_header('Cache-Control', 'no-cache')
        self.end_headers(); self.wfile.write(data)
    def log_message(self, *_): pass

def main():
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Handler, directory=str(ROOT / 'public')))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    origin = f'http://127.0.0.1:{server.server_port}'
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True,
                args=['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
            context = browser.new_context(viewport={'width':390, 'height':844})
            page = context.new_page(); errors = []
            page.on('pageerror', lambda e: errors.append(str(e)))
            page.route('https://fonts.googleapis.com/**', lambda r: r.abort())
            page.route('https://fonts.gstatic.com/**', lambda r: r.abort())
            page.add_init_script("localStorage.setItem('nfx.state.v1',JSON.stringify({P:{res:0,cx:0,mode:8}}))")
            page.goto(origin);page.wait_for_function('window.NFXStudio?.storageReady&&navigator.serviceWorker.controller')
            assert page.evaluate('window.cachedUpdateTest') == 'legacy'
            page.evaluate('''async()=>{
              const s=NFXStudio; s.settings.stems=false;s.persist();localStorage.setItem('nfx-update-keep','settings kept');
              for(const storage of ['idb','opfs']) await s.store.saveBlob(new Blob(['recording bytes preserved'],{type:'audio/wav'}),{name:storage,storage:s.store.root?storage:'idb'});
              await (await caches.open('unrelated-cache')).put('/keep',new Response('keep'));
            }''')
            state['deployed'] = True
            page.evaluate('navigator.serviceWorker.getRegistration().then(r=>r.update())')
            page.wait_for_function('navigator.serviceWorker.getRegistration().then(r=>!!r.waiting)')
            page.reload();page.wait_for_function('window.NFXStudio?.storageReady')
            assert page.evaluate('window.cachedUpdateTest') == 'legacy'
            print('PASS reproduction: an ordinary refresh still loads the cached older app while the new worker waits', flush=True)
            page.goto(origin+'/update.html')
            # A recording in another tab blocks cache recovery until it has stopped.
            blocker = context.new_page();blocker.goto(origin+'/update.html')
            blocker.evaluate("()=>{navigator.locks.request('neuroflux-capture',()=>new Promise(resolve=>window.releaseCapture=resolve));}")
            blocker.wait_for_function('typeof window.releaseCapture==="function"')
            page.locator('#update').click();page.wait_for_function('!document.querySelector("#update").disabled')
            assert 'recording is still active' in page.locator('#status').inner_text()
            blocker.evaluate('window.releaseCapture()');blocker.close()
            context.set_offline(True)
            page.locator('#update').click();page.wait_for_function('!document.querySelector("#update").disabled')
            assert page.evaluate('caches.has("neuroflux-local-test-legacy")')
            assert page.evaluate('navigator.serviceWorker.getRegistration().then(Boolean)')
            context.set_offline(False)
            page.locator('#update').click();page.wait_for_url('**/?updated=*');page.wait_for_function('window.NFXStudio?.storageReady')
            assert page.evaluate('window.cachedUpdateTest') is None
            assert page.evaluate('localStorage.getItem("nfx-update-keep")') == 'settings kept'
            assert not page.evaluate('NFXStudio.settings.stems')
            assert page.evaluate('caches.has("unrelated-cache")')
            assert page.evaluate('''async()=>{
              const assets=await NFXStudio.store.list();
              return assets.length===2&&(await Promise.all(assets.map(a=>NFXStudio.store.blob(a).then(b=>b.text())))).every(t=>t==='recording bytes preserved');
            }''')
            assert not page.evaluate('caches.has("neuroflux-local-test-legacy")')
            # Recovery remains reachable in the existing SYSTEM menu.
            page.locator('#start [data-go=sim]').click();page.locator('#btnMenu').click();page.locator('#tabs [data-p=sys]').click()
            page.locator('#btnAppUpdate').click();page.wait_for_url('**/update.html')
            assert not errors,errors
            print('PASS recovery: latest app loads; both saved recording backends, settings and unrelated caches survive; active recording and offline failures are safe; native SYSTEM update link works', flush=True)
            browser.close()
    finally: server.shutdown();server.server_close()

if __name__ == '__main__': main()
