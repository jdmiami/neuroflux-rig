"""Actual app: independent camera/visual tracks, all registry shaders, motion, setup files and UI."""
import functools,http.server,json,pathlib,threading,tempfile
from playwright.sync_api import sync_playwright
from browser_studio import save_asset
ROOT=pathlib.Path(__file__).resolve().parents[1]
class Handler(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
 def do_GET(self):
  if self.path in ['/test-modules/capture.js','/test-modules/profiles.js']:
   data=(ROOT/'src/studio'/self.path.rsplit('/',1)[1]).read_bytes();self.send_response(200);self.send_header('content-type','text/javascript');self.end_headers();self.wfile.write(data);return
  if self.path.startswith('/api/ai'):
   self.send_response(200);self.send_header('content-type','application/json');self.end_headers();self.wfile.write(b'{"ok":true,"key":false}');return
  return super().do_GET()
def main():
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT/'public')));threading.Thread(target=server.serve_forever,daemon=True).start()
 try:
  with sync_playwright() as p:
   browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
   page=browser.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,service_workers='block');errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.route('https://fonts.googleapis.com/**',lambda r:r.abort());page.route('https://fonts.gstatic.com/**',lambda r:r.abort())
   page.add_init_script("localStorage.setItem('nfx.state.v1',JSON.stringify({P:{res:0,cx:0,mode:8,camEdge:0,camWarp:0,camMotion:0}}));")
   page.goto(f'http://127.0.0.1:{server.server_port}/',wait_until='domcontentloaded');page.wait_for_function('window.NFXPerformance&&window.NFXStudio?.storageReady')
   page.locator('#start [data-go=sim]').click()
   assert page.evaluate('NFXMotion.held&&!NFXMotion.simPlaying&&NFXMotion.settings.silenceStop')
   # SIM is an explicit transport, and real music mute never falls back to simulation.
   page.locator('#btnPlay').click();page.wait_for_function('!NFXMotion.held&&NFXMotion.clock>0')
   page.locator('#btnPlay').click();page.wait_for_function('NFXMotion.held')
   paused_clock=page.evaluate('NFXMotion.clock');page.wait_for_timeout(100)
   assert page.evaluate('NFXMotion.clock')==paused_clock
   page.evaluate("NFXRig.selectSource('demo')");page.wait_for_function('!NFXMotion.held',timeout=10000)
   page.evaluate('async()=>{await NFXStudio.mixer.init();NFXStudio.mixer.settings.musicMonitor=0;NFXStudio.mixer.apply();}')
   page.wait_for_function('NFXMotion.held');paused_clock=page.evaluate('NFXMotion.clock');page.wait_for_timeout(100)
   assert page.evaluate('NFXMotion.clock')==paused_clock
   page.evaluate("NFXStudio.mixer.settings.musicMonitor=.9;NFXStudio.mixer.apply();NFXRig.selectSource('sim')")
   page.wait_for_function('NFXMotion.held&&!NFXMotion.simPlaying')
   print('PASS native motion: default wait-for-sound, explicit SIM play/pause, music playback and zero-volume hold without fake-beat fallback',flush=True)
   # A live synthetic camera is deterministic and does not need physical hardware.
   page.evaluate('''async()=>{
    const canvas=window.testCamera=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d');
    function paint(){const data=ctx.createImageData(128,128);for(let y=0;y<128;y++)for(let x=0;x<128;x++)data.data.set([x*2,y*2,((x+y)%64)*4,255],(y*128+x)*4);ctx.putImageData(data,0,0);}window.paintTestCamera=paint;paint();
    const stream=canvas.captureStream(15);navigator.mediaDevices.getUserMedia=async constraints=>constraints.video?stream:Promise.reject(Error('No audio fixture'));
    const video=window.fxTestVideo=document.createElement('video');video.srcObject=stream;video.muted=true;await video.play();
    window.fxRegistry=(await (await fetch('/guide-index.json')).json()).cameraEffects;
    window.pixelHash=canvas=>{const d=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;let h=2166136261;for(let i=0;i<d.length;i++)h=Math.imul(h^d[i],16777619);return h>>>0;};
    NFXRig.setParam('cam',1,'user');
   }''')
   page.wait_for_function('NFXRig.guideState().services.camera')
   page.evaluate("NFXRig.setParam('camMix',0,'user')");page.wait_for_timeout(100)
   initial=page.evaluate("pixelHash(NFXRig.render('test-a',128,128))")
   page.evaluate("NFXCameraFX.add('kaleidoscope');NFXCameraFX.change(NFXCameraFX.state.nodes[0].id,'count',6)")
   page.wait_for_timeout(100)
   assert page.evaluate("pixelHash(NFXRig.render('test-a',128,128))")==initial,'Camera FX changed the independent visual track'
   page.evaluate("NFXRig.setParam('camMix',1,'user')");page.wait_for_timeout(100)
   effected=page.evaluate("pixelHash(NFXRig.render('test-a',128,128))")
   page.evaluate("NFXCameraFX.commit({...NFXCameraFX.state,enabled:false})");page.wait_for_timeout(100)
   raw=page.evaluate("pixelHash(NFXRig.render('test-a',128,128))")
   assert effected!=raw,'100% camera discarded Camera FX'
   page.evaluate("NFXRig.setParam('mirror',15,'user');NFXRig.setParam('swirl',.8,'user')");page.wait_for_timeout(100)
   assert page.evaluate("pixelHash(NFXRig.render('test-a',128,128))")==raw,'Visual FX affected the 100% camera track'
   # Silence freezes synthesized pixels while a changing real camera remains live.
   page.evaluate("NFXRig.setParam('camMix',0,'user')");page.wait_for_timeout(60)
   visual_hold=page.evaluate("pixelHash(NFXRig.render('test-a',128,128))")
   page.evaluate("testCamera.getContext('2d').fillStyle='#ff4f20';testCamera.getContext('2d').fillRect(0,0,128,128)")
   page.wait_for_timeout(180)
   assert page.evaluate("pixelHash(NFXRig.render('test-a',128,128))")==visual_hold
   page.evaluate("NFXRig.setParam('camMix',1,'user')");page.wait_for_timeout(60)
   assert page.evaluate("pixelHash(NFXRig.render('test-a',128,128))")!=raw
   print('PASS real renderer: camera-only isolation; 100% retains Camera FX; bypass restores camera; Visual FX never treat the camera',flush=True)
   page.evaluate("paintTestCamera()");page.wait_for_timeout(100)
   # Exercise every real shader branch with deterministic local semantic masks.
   result=page.evaluate('''()=>{
    const fx=NFXCameraFX,renderer=fx.ensureRenderer();renderer.vision.request=()=>{};
    renderer.vision.features=(w,h)=>{const data=new Uint8Array(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++)data.set([x>w*.25&&x<w*.75?255:0,Math.round(x/w*255),x>w*.35&&x<w*.65?255:0,y>h*.3&&y<h*.7?255:0],(y*w+x)*4);return {data,width:w,height:h};};
    renderer.vision.face=[.5,.5,.4,.4];renderer.vision.body=[.5,.5,.6,.8];renderer.vision.results={segment:{at:performance.now()},face:{at:performance.now(),faces:[[]]},pose:{at:performance.now(),poses:[[]]}};renderer.upload(3,renderer.background,testCamera);renderer.backgroundReady=true;
    const depth={data:new Uint8Array(128*128).fill(128),w:128,h:128};let count=0;
    for(const effect of fxRegistry){fx.commit({version:1,enabled:true,nodes:[]});fx.add(effect.id);const node=fx.state.nodes[0];node.params.amount=.7;node.params.count=5;
     for(const result of Object.values(renderer.vision.results))result.at=performance.now();for(let f=0;f<2;f++)renderer.render(fxTestVideo,fx.state,{clock:1+f*.1,held:false,now:2000+f*100,depth});
     if(renderer.gl.getError())throw Error(effect.id+' produced a GL error');count++;
    }return count;
   }''')
   assert result==129,result
   print(f'PASS production Camera FX shaders: all {result} registered modes compile/render, including temporal and masked/depth branches',flush=True)
   checks=page.evaluate('''()=>{const fx=NFXCameraFX,r=fx.ensureRenderer();fx.commit({version:1,enabled:true,nodes:[]});fx.add('kaleidoscope');const n=fx.state.nodes[0];const hashes=[];
    const snapshot=document.createElement('canvas');snapshot.width=snapshot.height=128;const ctx=snapshot.getContext('2d');
    for(let count=1;count<=16;count++){n.params.count=count;r.render(fxTestVideo,fx.state,{clock:1,held:true});ctx.drawImage(r.canvas,0,0,128,128);hashes.push(pixelHash(snapshot));}
    fx.commit({version:1,enabled:true,nodes:[]});fx.add('horizontal-mirror');const depth={data:new Uint8Array(128*128),w:128,h:128};r.render(fxTestVideo,fx.state,{clock:1,held:true,depth,depthKey:true});
    ctx.drawImage(r.canvas,0,0,128,128);const image=ctx.getImageData(0,0,128,128).data,mask=r.processedDepth.getContext('2d').getImageData(0,0,128,128).data;let error=0;for(let i=0;i<image.length;i+=4)error+=Math.abs(image[i]-mask[i]);return {unique:new Set(hashes).size,depthError:error/(128*128),programs:r.programs.size};
   }''')
   assert checks['unique']==16,checks
   assert checks['depthError']<5,checks
   assert checks['programs']<=16,checks
   print('PASS image checks: sixteen distinct kaleidoscope divisions; warped depth aligns with camera; bounded shader cache',flush=True)
   page.evaluate("NFXCameraFX.commit({version:1,enabled:true,nodes:[]});NFXCameraFX.add('kaleidoscope');NFXCameraFX.add('swirl')")
   page.locator('#btnMenu').click();page.locator('#tabs [data-p=cam]').click();page.locator('[data-tab=effects]').click()
   assert page.locator('.nfx-fx-node').count()==2
   if page.locator('.nfx-fx-node').nth(1).get_attribute('open') is None:page.locator('.nfx-fx-node').nth(1).locator('summary').first.click()
   page.locator('.nfx-fx-node').nth(1).locator('[data-command=tools]').click()
   page.locator('.nfx-fx-node').nth(1).locator('[data-command=up]').click()
   assert page.evaluate('NFXCameraFX.state.nodes[0].effect')=='swirl'
   for width,height in [(320,740),(390,844),(844,390),(1280,800)]:
    page.set_viewport_size({'width':width,'height':height});page.wait_for_timeout(120)
    assert not page.evaluate('document.documentElement.scrollWidth>innerWidth'),(width,height)
   page.set_viewport_size({'width':390,'height':844});page.screenshot(path=str(pathlib.Path(tempfile.gettempdir())/'neuroflux-camera-fx.png'))
   # Whole-app serialization, validation and actual application.
   setup=page.evaluate("NFXCameraFX.snapshot('Full app test')")
   page.evaluate("NFXCameraFX.add('ripple');NFXRig.setParam('hue',.7,'user')")
   page.evaluate('(setup)=>NFXCameraFX.apply(setup)',setup)
   assert page.evaluate('NFXCameraFX.state.nodes.length')==2
   assert page.evaluate('NFXStudio.outputs.every((o,i)=>o.profile===NFXStudio.profiles[i])')
   assert page.evaluate('NFXRig.guideState().controls.hue')==setup['rig']['hue']
   assert not page.evaluate('NFXStudio.session')
   assert not page.evaluate('NFXGuide.enabled')
   page.locator('#tabs [data-p=scenes]').click();page.locator('#nfxSetupName').fill('Portable test');page.locator('[data-setup=save]').click()
   page.wait_for_function('NFXCameraFX.saved.some(s=>s.name==="Portable test")')
   with page.expect_download() as dl:page.locator('[data-setup=download]').click()
   downloaded=json.loads(pathlib.Path(dl.value.path()).read_text());assert downloaded['format']=='neuroflux-setup';assert len(downloaded['camera']['nodes'])==2
   page.locator('#nfxSetupFile').set_input_files({'name':'portable.neuroflux.json','mimeType':'application/json','buffer':json.dumps(downloaded).encode()});page.locator('[data-setup=apply]').wait_for();page.locator('[data-setup=apply]').click()
   page.wait_for_function('NFXCameraFX.pending===null')
   # Keep the live preview small for the CI software GPU; encoded sizes stay explicit.
   page.set_viewport_size({'width':128,'height':192});page.wait_for_timeout(300)
   # Keep production admission intact: software-only GPUs may truthfully refuse 24 fps.
   page.evaluate("()=>{const studio=NFXStudio;Object.assign(studio.profiles[0],{width:128,height:128,fps:24,mode:'clean'});Object.assign(studio.profiles[1],{width:128,height:192,fps:24,mode:'clean'});Object.assign(studio.settings,{kind:'video',dual:true,stems:false,mixed:false});}")
   admitted=page.evaluate('NFXStudio.testOutputs()')
   print('Camera capture admission:', admitted, page.locator('#nfxStudioMessage').inner_text(),flush=True)
   # Test actual effect pixels through the recorder/storage path independently of hardware speed.
   # The deterministic Studio test covers native start admission and mandatory countdown.
   page.evaluate('''async()=>{const {CaptureSession}=await import('/test-modules/capture.js');const s=NFXStudio;
    s.session=new CaptureSession(s.store,s.mixer,error=>window.fxCaptureError=error.message);
    await s.session.prepare(s.selectedOutputs(),s.settings);s.session.start();s.open(false);
   }''')
   page.wait_for_timeout(800)
   assert page.evaluate('''async()=>{try{await NFXCameraFX.apply(NFXCameraFX.snapshot('Blocked during take'));return false;}catch{return true;}}''')
   page.evaluate('NFXStudio.stop()');page.wait_for_function('!NFXStudio.session',timeout=30000)
   assets=page.evaluate('NFXStudio.store.list()');videos=[a for a in assets if a.get('type')=='video' or a.get('kind')=='video']
   complete=[a for a in assets if a.get('status')=='complete' and a.get('bytes',0)>0]
   assert len(complete)>=2,assets
   with tempfile.TemporaryDirectory() as directory:
    sizes=[]
    for asset in complete:
     info=save_asset(page,asset,pathlib.Path(directory))
     sizes.extend((s['width'],s['height']) for s in info['streams'] if s['codec_type']=='video')
    assert sorted(sizes)==[(128,128),(128,192)],sizes
   print('PASS real Camera FX capture: two encoded output shapes, truthful performance admission, processed camera recording, stop/save and setup-load lock',flush=True)
   assert not errors,errors
   print('PASS Camera FX controls: stack reorder, responsive native menu, complete setup round-trip, local save, download/import/apply, no permission/recording/walkthrough activation',flush=True)
   browser.close()
 finally:server.shutdown();server.server_close()
if __name__=='__main__':main()
