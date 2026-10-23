"""Exercise the native guided-walkthrough UI and real rig with a deterministic AI response.
The actual Gemini/structured-output boundary is tested separately by guide.test.mjs and live deployment checks.
"""
import functools,http.server,json,pathlib,tempfile,threading
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[1]
requests=[]
delayed=threading.Event()
def plan(goal):
 def step(title,action,expected='The setting changes in the app.'):
  return {'title':title,'instruction':'Use the highlighted control, or apply this step.','action':action,'expected':expected,'sources':['control-mirror']}
 def action(kind,key='',value=None,output=None):return {'type':kind,'key':key,'value':value,'output':output}
 steps=[step('Make six mirror splits',action('set_control','mirror',5)),step('Add a swirl',action('set_control','swirl',.2)),
        step('Choose a minimal recorded interface',action('set_output','mode','minimal','a')),
        step('Review your library',action('show','recording.library'))]
 if 'camera fx' in goal.lower():
  steps=[step('Add camera kaleidoscope',action('camera_add','kaleidoscope')),step('Choose six divisions',action('camera_set','0.count',6)),step('Change motion preference',action('set_motion','silenceStop',False)),step('Review camera effects',action('show','camera.effects'))]
 if 'audio' in goal.lower():
  steps=[step('Choose audio-only capture',action('set_recording','kind','audio')),step('Start a take',action('start_recording')),
         step('Stop and save',action('stop_recording')),step('Review the saved take',action('show','recording.library'))]
 return {'ok':True,'title':'Your fresh walkthrough','intro':'Make a look with the current setup.','model':'gemini-3.5-flash','requestedModel':'gemini-3.8-flash','fallback':True,
 'steps':steps,'sources':[{'id':'control-mirror','title':'FX controls','anchor':'control-mirror','excerpt':'Mirror has 5 through 16 radial splits.'}]}
class Handler(http.server.SimpleHTTPRequestHandler):
 def do_GET(self):
  if self.path.startswith('/api/ai'):
   return self.json({'ok':True,'key':True,'models':{'scene':'gemini-3.8-flash'}})
  super().do_GET()
 def do_POST(self):
  body=json.loads(self.rfile.read(int(self.headers.get('content-length',0))))
  requests.append(body)
  if body.get('goal','').startswith('Delayed'):delayed.wait(10)
  self.json(plan(body.get('goal','')))
 def json(self,value):
  self.send_response(200);self.send_header('content-type','application/json');self.end_headers()
  try:self.wfile.write(json.dumps(value).encode())
  except BrokenPipeError:pass
 def log_message(self,*_):pass

def main():
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT/'public')))
 threading.Thread(target=server.serve_forever,daemon=True).start()
 try:
  with sync_playwright() as p:
   browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
   context=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,service_workers='block')
   page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.route('https://fonts.googleapis.com/**',lambda r:r.abort());page.route('https://fonts.gstatic.com/**',lambda r:r.abort())
   page.add_init_script("localStorage.setItem('nfx.state.v1',JSON.stringify({P:{res:0,cx:0,mode:8,mirror:0}}));localStorage.setItem('nfx.studio.v1',JSON.stringify({profiles:[{width:128,height:128,fps:24},{width:128,height:192,fps:24}],settings:{stems:false}}));")
   page.goto(f'http://127.0.0.1:{server.server_port}/',wait_until='domcontentloaded');page.wait_for_function('window.NFXGuide&&NFXStudio.storageReady')
   page.locator('#start [data-go=sim]').click();page.locator('#btnMenu').click();page.locator('#tabs [data-p=ai]').click()
   assert not page.locator('#nfxGuideEnabled').is_checked()
   assert page.locator('#nfxGuideHome').is_hidden() and page.locator('#nfxGuideStep').is_hidden()
   assert not requests,'Default-off guide made a model request'
   page.locator('#nfxGuideEnabled').check()
   page.locator('#nfxGuideGoal').fill('Help me make six mirror splits and swirl');page.locator('#nfxGuideBuild').click()
   page.locator('[data-guide=begin]').wait_for();assert 'fallback' in page.locator('.nfx-guide-model').inner_text().lower()
   assert page.evaluate('NFXRig.guideState().controls.mirror')==0,'Generating a plan mutated the app'
   assert requests[0]['state']['controls']['mirror']==0
   assert requests[0]['knowledgeVersion']
   assert 'fileName' not in json.dumps(requests[0]['state'])
   page.locator('[data-guide=begin]').click();page.wait_for_timeout(1000)
   page.wait_for_function('!document.querySelector("#nfxGuideSpotlight").hidden')
   assert page.locator('#sheet #nfxGuideStep').count()==1
   page.locator('[data-guide=apply]').click();page.wait_for_function('NFXRig.guideState().controls.mirror===5')
   assert page.locator('#pages [data-id=mirror] .sv span').inner_text()=='6-SPLIT'
   page.locator('[data-guide=next]').click();page.locator('[data-guide=apply]').click()
   page.wait_for_function('Math.abs(NFXRig.guideState().controls.swirl-.2)<.001')
   page.locator('[data-guide=undo]').click();page.wait_for_function('NFXRig.guideState().controls.swirl===0')
   assert page.locator('[data-guide=next]').is_disabled()
   slider=page.locator('#pages [data-id=swirl][role=slider]');slider.focus()
   for _ in range(10):slider.press('ArrowRight')
   page.wait_for_function('Math.abs(NFXRig.guideState().controls.swirl-.2)<.001')
   page.locator('[data-guide=next]').click();page.locator('[data-guide=apply]').click()
   page.wait_for_function('NFXStudio.profiles[0].mode==="minimal"')
   for width,height in [(320,740),(390,844),(844,390),(1280,800)]:
    page.set_viewport_size({'width':width,'height':height});page.wait_for_timeout(160)
    assert not page.evaluate('document.documentElement.scrollWidth>innerWidth'),(width,height)
   page.set_viewport_size({'width':390,'height':844});page.screenshot(path=str(pathlib.Path(tempfile.gettempdir())/'neuroflux-guide-step.png'))
   page.locator('[data-guide=next]').click()
   assert 'cannot verify' in page.locator('#nfxGuideObserved').inner_text()
   page.locator('[data-guide=next]').click();assert page.locator('#nfxGuideStep').is_hidden()
   print('PASS guide: manual-grounded plan, labeled fallback, no automatic mutations, native navigation, spotlight, apply/verify, undo, manual edits, recording fields, responsive layout and honest review steps',flush=True)
   page.locator('#tabs [data-p=ai]').click();page.locator('#nfxGuideGoal').fill('Help me use camera fx')
   page.locator('#nfxGuideBuild').click();page.locator('[data-guide=begin]').wait_for();page.locator('[data-guide=begin]').click()
   page.wait_for_function('!document.querySelector("#nfxGuideSpotlight").hidden')
   page.locator('[data-guide=apply]').click();page.wait_for_function('NFXCameraFX.state.nodes.length===1')
   page.locator('[data-guide=next]').click();page.locator('[data-guide=apply]').click()
   page.wait_for_function('NFXCameraFX.state.nodes[0].params.count===6');page.locator('[data-guide=next]').click()
   page.locator('[data-guide=apply]').click();page.wait_for_function('NFXMotion.settings.silenceStop===false')
   page.locator('[data-guide=next]').click();page.locator('[data-guide=next]').click()
   assert not page.evaluate('NFXRig.guideState().controls.cam'),'Guide stack tools activated the camera'
   print('PASS Camera FX guide tools: native Add highlight, explicit stack add/parameter editing, motion settings, verification and no camera activation',flush=True)
   # Off cancels an in-flight request and cannot accept a late response.
   page.locator('#tabs [data-p=ai]').click();page.locator('#nfxGuideGoal').fill('Delayed walkthrough request')
   page.locator('#nfxGuideBuild').click()
   for _ in range(100):
    if requests[-1].get('goal','').startswith('Delayed'):break
    page.wait_for_timeout(50)
   assert requests[-1]['goal'].startswith('Delayed')
   page.locator('#nfxGuideEnabled').uncheck();delayed.set()
   page.wait_for_function('!NFXGuide.loading')
   page.locator('#nfxGuideEnabled').check();page.wait_for_timeout(200)
   assert page.locator('[data-guide=begin]').count()==0 and not page.evaluate('NFXGuide.plan||NFXGuide.active')
   # Exercise real recording/countdown tools; the guide must not capture until explicit Apply.
   page.locator('#tabs [data-p=ai]').click();page.locator('#nfxGuideGoal').fill('Help me record audio only')
   page.locator('#nfxGuideBuild').click();page.locator('[data-guide=begin]').wait_for();page.locator('[data-guide=begin]').click()
   page.locator('[data-guide=apply]').click();page.wait_for_function('NFXStudio.settings.kind==="audio"')
   page.locator('[data-guide=next]').click();assert page.evaluate('NFXStudio.session') is None
   page.locator('[data-guide=apply]').click();page.wait_for_function('NFXStudio.session?.status==="recording"')
   page.wait_for_function('!NFXGuide.applying');page.locator('[data-guide=expand]').click()
   page.locator('[data-guide=next]').click();page.locator('[data-guide=apply]').click();page.wait_for_function('!NFXStudio.session')
   page.locator('[data-guide=next]').click();page.locator('[data-guide=next]').click()
   assert page.evaluate('NFXStudio.store.list().then(a=>a.some(x=>x.status==="complete"&&x.bytes>0))')
   # Turning the guide off also clears an active/resumable plan, and survives reload.
   page.locator('#tabs [data-p=ai]').click();page.locator('#nfxGuideBuild').click()
   page.locator('[data-guide=begin]').wait_for();page.locator('[data-guide=begin]').click()
   page.locator('[data-guide=end]').click()
   assert page.locator('#nfxGuideStep').is_hidden() and page.locator('#nfxGuideSpotlight').is_hidden()
   assert not page.evaluate('NFXGuide.enabled')
   assert page.evaluate('sessionStorage.getItem("nfx.guide.v1")') is None
   request_count=len(requests);page.reload(wait_until='domcontentloaded')
   page.wait_for_function('window.NFXGuide')
   assert not page.evaluate('NFXGuide.enabled||NFXGuide.active')
   assert not page.locator('#nfxGuideEnabled').is_checked() and page.locator('#nfxGuideHome').is_hidden()
   assert len(requests)==request_count,'Reload started another guide request'
   assert not errors,errors
   print('PASS guide mode: off on first use; explicit opt-in; × turns mode off, clears resume, removes overlays, stays off after reload and makes no AI requests',flush=True)
   print('PASS guide recording tools: explicit start, mandatory countdown, floating/collapsed coaching, stop/save and intact local take; no JavaScript errors',flush=True)
   browser.close()
 finally:server.shutdown();server.server_close()
if __name__=='__main__':main()
