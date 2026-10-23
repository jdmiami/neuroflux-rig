"""Optional online check: real local MediaPipe inference on its public reference portrait.
Downloads public model assets; no user media is uploaded to an inference service.
"""
import functools,http.server,json,pathlib,threading,urllib.request
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[1]
def main():
 with urllib.request.urlopen('https://storage.googleapis.com/mediapipe-assets/portrait.jpg',timeout=30) as response:portrait=response.read()
 class Handler(http.server.SimpleHTTPRequestHandler):
  def do_GET(self):
   if self.path=='/reference-portrait.jpg':
    self.send_response(200);self.send_header('content-type','image/jpeg');self.end_headers();self.wfile.write(portrait);return
   super().do_GET()
  def log_message(self,*a):pass
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT/'public')));threading.Thread(target=server.serve_forever,daemon=True).start()
 try:
  with sync_playwright() as p:
   browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']);page=browser.new_page()
   page.goto(f'http://127.0.0.1:{server.server_port}/manual.html')
   page.evaluate('''()=>{window.events=[];window.worker=new Worker('/vision.worker.js');worker.onmessage=e=>events.push(e.data);worker.onerror=e=>events.push({type:'workerError',message:e.message});window.send=async kind=>{const response=await fetch('/reference-portrait.jpg');const bitmap=await createImageBitmap(await response.blob());worker.postMessage({kind,bitmap,stamp:performance.now()},[bitmap]);};}''')
   for kind in ['segment','face','pose']:
    page.evaluate('(kind)=>send(kind)',kind)
    page.wait_for_function('(kind)=>events.some(e=>(e.type==="result"||e.type==="error")&&e.kind===kind)||events.some(e=>e.type==="workerError")',arg=kind,timeout=90000)
    result=page.evaluate('(kind)=>events.filter(e=>e.kind===kind||e.type==="workerError").map(e=>({type:e.type,kind:e.kind,message:e.message,width:e.width,height:e.height,personPixels:e.mask?.reduce((s,n)=>s+(n>0),0),faces:e.faces?.length,poses:e.poses?.length}))',kind)
    actual=next((r for r in result if r['type']=='result'),None);assert actual,result
    if kind=='segment':assert actual['personPixels']>0,actual
    if kind=='face':assert actual['faces']>0,actual
    if kind=='pose':assert actual['poses']>0,actual
    print('PASS local model:',json.dumps(actual),flush=True)
   browser.close()
 finally:server.shutdown();server.server_close()
if __name__=='__main__':main()
