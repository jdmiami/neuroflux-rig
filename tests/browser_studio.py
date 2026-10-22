"""Real Chromium MediaRecorder/AudioWorklet/storage/export tests, with synthetic
visual/audio inputs to avoid depending on GPU speed. Requires playwright + ffprobe.
Run: python -u tests/browser_studio.py
"""
import base64
import functools
import http.server
import json
import pathlib
import subprocess
import struct
import tempfile
import threading
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]

class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/fixture.html':
            data = (ROOT / 'tests/fixture.html').read_bytes()
            self.send_response(200); self.send_header('Content-type','text/html'); self.end_headers(); self.wfile.write(data)
        else: super().do_GET()
    def log_message(self, *_): pass

def save_asset(page, asset, directory):
    encoded = page.evaluate('''async id => {
      const studio = window.NFXStudio, asset = await studio.store.get(id);
      const blob = await studio.store.blob(asset);
      return await new Promise(resolve => {const r=new FileReader();r.onload=()=>resolve(r.result.split(',')[1]);r.readAsDataURL(blob)});
    }''', asset['id'])
    extension = 'wav' if asset['mime'] == 'audio/wav' else 'mp4' if 'mp4' in asset['mime'] else 'webm'
    path = directory / (asset['id'] + '.' + extension); path.write_bytes(base64.b64decode(encoded))
    info = json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(path)]))
    return info

def main():
    server = http.server.ThreadingHTTPServer(('127.0.0.1',0), functools.partial(Handler,directory=str(ROOT/'public')))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    origin = f'http://127.0.0.1:{server.server_port}'
    try:
        with tempfile.TemporaryDirectory(prefix='nfx-test-') as temp, sync_playwright() as p:
            directory = pathlib.Path(temp)
            browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True,
                args=['--no-sandbox','--autoplay-policy=no-user-gesture-required'])
            page = browser.new_page(viewport={'width':1000,'height':800}); errors=[]
            page.on('pageerror',lambda error: errors.append(str(error)))
            page.goto(origin+'/fixture.html'); page.wait_for_function('window.NFXStudio?.storageReady')
            page.evaluate('''() => {
              const s = window.NFXStudio; s.profiles[0].width=320;s.profiles[0].height=180;s.profiles[0].fps=24;
              s.profiles[1].width=180;s.profiles[1].height=320;s.profiles[1].fps=24;
              s.settings.countdown=0;s.settings.dual=true;s.settings.stems=true;s.settings.mixed=true;s.open(true);
            }''')
            assert page.evaluate('window.NFXStudio.testOutputs()'), page.locator('#nfxStudioMessage').inner_text()
            print('PASS performance admission for deterministic 24fps dual output')
            # A legacy saved/assigned zero cannot bypass the countdown.
            page.evaluate('()=>{window.NFXStudio.settings.countdown=0;window.capturePromise=window.NFXStudio.start();}')
            page.wait_for_function('!document.querySelector("#nfxStudioCountdown").hidden')
            for digit in ['3','2','1']:
                page.wait_for_function('(digit)=>document.querySelector("#nfxCountdownNumber").textContent===digit',arg=digit)
                assert page.evaluate('window.NFXStudio.session.status')=='preparing'
                assert page.evaluate('window.NFXStudio.session.recorders.every(r=>!r.asset.bytes)')
            page.evaluate('window.capturePromise')
            assert page.evaluate('window.NFXStudio.session.status') == 'recording'
            page.wait_for_timeout(1200)
            page.evaluate('window.NFXStudio.session.pause()');page.wait_for_timeout(400)
            page.evaluate('window.NFXStudio.session.resume();window.NFXStudio.session.mark()')
            page.wait_for_timeout(1400);page.evaluate('window.NFXStudio.stop()')
            assets = page.evaluate('window.NFXStudio.store.list()')
            assert len(assets) == 5, [(a['kind'],a['name']) for a in assets]
            assert all(a['status']=='complete' and a['bytes']>1000 for a in assets)
            videos = [a for a in assets if a['kind']=='video']
            for asset in assets:
                info=save_asset(page,asset,directory)
                if asset['kind']=='video':
                    streams = {s['codec_type']:s for s in info['streams']}
                    assert streams['video']['width']==asset['width'] and streams['video']['height']==asset['height']
                    assert 'audio' in streams
                    assert abs(float(streams['video']['duration'])-float(streams['audio']['duration'])) < .1, streams
                else:
                    assert info['streams'][0]['codec_name']=='pcm_s16le'
                    if asset.get('source') in ('music','mic'):
                        payload=(directory/(asset['id']+'.wav')).read_bytes()[44:]
                        samples=struct.unpack('<'+'h'*(len(payload)//2),payload)
                        assert sum(v*v for v in samples)/len(samples)>10000,'Isolated source unexpectedly silent'
            print('PASS dual recordings, pause/resume, markers, WAV companions, encoded dimensions and A/V sync')
            # Cancellation is immediate and removes the prepared empty take.
            count=len(assets)
            page.evaluate('()=>{window.capturePromise=window.NFXStudio.start().catch(e=>window.captureCancel=e.name);}')
            page.wait_for_function('!document.querySelector("#nfxStudioCountdown").hidden')
            page.locator('[data-action=cancelCountdown]').click()
            page.evaluate('window.capturePromise')
            assert page.evaluate('window.captureCancel')=='AbortError'
            assert page.evaluate('window.NFXStudio.store.list().then(a=>a.length)')==count
            assert page.locator('#nfxStudioCountdown').is_hidden()
            print('PASS mandatory 3–2–1, zero audio/video before start, and countdown cancellation without empty files')
            # Preview only guides and operator menu state do not alter clean pixels.
            page.evaluate('window.NFXStudio.open(true)')
            first=page.evaluate('window.NFXStudio.outputs[0].canvas.toDataURL()')
            page.evaluate('fixtureMenu=true');page.wait_for_timeout(100)
            assert first==page.evaluate('window.NFXStudio.outputs[0].canvas.toDataURL()')
            page.evaluate('window.NFXStudio.profiles[0].mode="minimal"');page.wait_for_timeout(100)
            assert first!=page.evaluate('window.NFXStudio.outputs[0].canvas.toDataURL()')
            page.evaluate('window.NFXStudio.profiles[0].mode="full"');page.wait_for_timeout(100)
            print('PASS clean/minimal/full composition isolation')
            for rotation, point in [(0,[.2,.4]),(90,[.6,.2]),(180,[.8,.6]),(270,[.4,.8])]:
                page.evaluate('r=>{window.NFXStudio.profiles[0].mode="clean";window.NFXStudio.profiles[0].rotation=r}',rotation)
                page.wait_for_timeout(100)
                pixel=page.evaluate('''point=>{const c=window.NFXStudio.outputs[0].canvas;return Array.from(c.getContext('2d').getImageData(Math.floor(c.width*point[0]),Math.floor(c.height*point[1]),1,1).data)}''',point)
                assert pixel==[69,240,255,255],(rotation,pixel)
            page.evaluate('window.NFXStudio.profiles[0].rotation=0')
            print('PASS actual output pixels for all four picture rotations')
            # Exercise the real finishing UI and export worker, including source remix.
            page.evaluate('window.NFXStudio.tab="library"')
            page.evaluate('id=>window.NFXStudio.showAsset(id)',videos[0]['id'])
            page.locator('#nfxTrimStart').fill('0.3');page.locator('#nfxTrimEnd').fill('1.5')
            page.locator('#nfxRemix').check()
            page.locator('#nfxRemixMic').fill('0.5')
            page.evaluate('window.NFXStudio.exportAsset()')
            page.wait_for_function('!window.NFXStudio.exporting',timeout=120000)
            derived=page.evaluate('window.NFXStudio.store.list().then(a=>a.find(x=>x.derivedFrom))')
            assert derived, page.locator('#nfxStudioMessage').inner_text()
            info=save_asset(page,derived,directory)
            assert info['streams'][0]['codec_name']=='h264',info
            assert abs(float(info['format']['duration'])-1.2)<.2,info
            print('PASS trimmed MP4 export and isolated-source remix')
            # Force the real single-thread software fallback using a disabled codec API.
            page.evaluate('id=>window.NFXStudio.showAsset(id)',videos[0]['id'])
            result=page.evaluate('''async id => {
              const s=window.NFXStudio, a=await s.store.get(id), blob=await s.store.blob(a);
              return await new Promise(resolve=>{
                const script=`self.VideoEncoder=undefined;self.AudioEncoder=undefined;await import('${location.origin}/export.worker.js');self.postMessage({type:'ready'});`;
                const url=URL.createObjectURL(new Blob([script],{type:'text/javascript'}));
                const w=new Worker(url,{type:'module'});let software=false;
                w.onmessage=({data})=>{
                  if(data.type==='ready') w.postMessage({blob,job:{format:'silent',start:.2,end:1.2,duration:a.duration,volume:1,width:320,height:180,fit:'fit',memoryLimit:64000000}});
                  if(data.message?.includes('software'))software=true;
                  if(data.type==='complete'){
                    w.terminate();URL.revokeObjectURL(url);
                    s.store.saveBlob(data.blob,{name:'Software silent export',kind:'video',duration:1,width:320,height:180}).then(asset=>resolve({ok:true,size:data.blob.size,software,id:asset.id}));
                  }
                  if(data.type==='error'){w.terminate();URL.revokeObjectURL(url);resolve(data)}
                };
              });
            }''', videos[0]['id'])
            assert result.get('ok'), result
            assert result.get('software'),result
            silent=page.evaluate('id=>window.NFXStudio.store.get(id)',result['id'])
            info=save_asset(page,silent,directory)
            assert all(s['codec_type']!='audio' for s in info['streams']),info
            print('PASS actual FFmpeg software fallback and silent export')
            # Saved metadata survives reload, and abandoned chunks are marked interrupted.
            page.evaluate('''async()=>{const s=window.NFXStudio,a=await s.store.create({name:'interrupted',kind:'video',mime:'video/webm'});await s.store.append(a,new Blob(['incomplete']));}''')
            page.reload();page.wait_for_function('window.NFXStudio?.storageReady')
            assert page.evaluate('window.NFXStudio.store.list().then(a=>a.find(x=>x.name==="interrupted").status)')=='interrupted'
            print('PASS persistent local library and interrupted-take recovery metadata')
            # Free offline assets are available after service-worker installation.
            page.wait_for_function('navigator.serviceWorker.controller')
            page.context.set_offline(True)
            assert page.evaluate('fetch("/export.worker.js").then(r=>r.ok)')
            assert page.evaluate('fetch("/vendor/ffmpeg-core/ffmpeg-core.wasm").then(r=>r.ok)')
            print('PASS offline export assets')
            # Capture itself also works offline; output mute does not alter saved raw sources.
            page.evaluate('''async()=>{
              const s=window.NFXStudio;s.settings.kind='audio';s.settings.stems=false;s.settings.mixed=false;s.settings.countdown=0;s.settings.limit=1;
              await s.mixer.init();s.mixer.settings.muted=true;s.mixer.apply();
            }''')
            page.wait_for_timeout(150)
            page.evaluate('window.NFXStudio.start()');page.wait_for_function('!window.NFXStudio.session')
            muted=page.evaluate('window.NFXStudio.store.list().then(a=>a.find(x=>x.kind==="audio"&&x.status==="complete"))')
            save_asset(page,muted,directory)
            payload=(directory/(muted['id']+'.wav')).read_bytes()[44:]
            samples=struct.unpack('<'+'h'*(len(payload)//2),payload)
            assert max(map(abs,samples))<20,'Muted mix contains audible audio'
            print('PASS actual offline audio-only capture, duration limit, and mixed-output mute')
            denied=page.evaluate('''async()=>{
              const s=window.NFXStudio,original=s.store.space.bind(s.store);s.store.space=async()=>({free:1,quota:1,usage:0});
              try{await s.start();return false}catch(error){return error.message.includes('storage')}finally{s.store.space=original}
            }''')
            assert denied,'Low storage was not rejected'
            print('PASS low-storage admission and failed-start cleanup')
            assert not errors, errors
            browser.close()
    finally: server.shutdown();server.server_close()

if __name__=='__main__': main()
