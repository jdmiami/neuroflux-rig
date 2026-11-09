import functools,http.server,threading
from playwright.sync_api import sync_playwright
from browser_camera_fx import Handler,ROOT
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT/'public')));threading.Thread(target=server.serve_forever,daemon=True).start()
origin=f'http://127.0.0.1:{server.server_port}'
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 anonymous=b.new_page(viewport={'width':390,'height':844},service_workers='block');anonymous.route('**/api/owner',lambda r:r.fulfill(json={'owner':False,'configured':True}));anonymous.goto(origin,wait_until='domcontentloaded');anonymous.wait_for_function('window.NFXPerformance');assert anonymous.locator('#nfxOwnerChatButton').count()==0;anonymous.close()
 page=b.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,service_workers='block');errors=[];requests=[];page.on('pageerror',lambda e:errors.append(str(e)))
 def api(route):
  if route.request.method=='GET':return route.fulfill(json={'owner':True,'configured':True})
  body=route.request.post_data_json;requests.append(body)
  if body['action']=='chat':return route.fulfill(json={'ok':True,'reply':'Try a gentler hue. I can also prepare a wider layout.','model':'gemini-test-flash','requestedModel':'gemini-3.8-flash','fallback':True,'actions':[{'label':'Set hue to 40%','action':{'type':'set_control','key':'hue','value':.4,'output':None}}],'proposal':{'title':'Wider controls','body':'Increase slider spacing on small screens.'}})
  if body['action']=='submit':return route.fulfill(json={'ok':True,'number':41,'url':'https://github.com/jdmiami/neuroflux-rig/issues/41'})
  if body['action']=='run':return route.fulfill(json={'ok':True,'url':'https://github.com/jdmiami/neuroflux-rig/actions/workflows/owner-improvement.yml'})
 page.route('**/api/owner',api);page.goto(origin,wait_until='domcontentloaded');page.wait_for_function('window.NFXGuide&&window.NFXStudio?.storageReady');page.locator('#start [data-go=sim]').click()
 before=page.evaluate('NFXRig.guideState().controls.hue');page.locator('#nfxOwnerChatButton').click();page.locator('#nfxOwnerMessage').fill('Make the hue softer and give sliders more space');page.locator('#nfxOwnerChat form button').click();page.wait_for_selector('.nfx-owner-actions button')
 assert page.evaluate('NFXRig.guideState().controls.hue')==before
 page.locator('.nfx-owner-actions button').first.click();page.wait_for_function('NFXRig.guideState().controls.hue===.4');assert page.evaluate('NFXGuide.enabled')==False
 page.get_by_text('UNDO LAST ADJUSTMENT',exact=True).click();page.wait_for_function(f'NFXRig.guideState().controls.hue==={before}')
 page.locator('.nfx-owner-proposal summary').click();page.locator('[data-owner=submit]').click();page.wait_for_selector('[data-owner=run]:not([hidden])');assert requests[-1]['action']=='submit'
 page.locator('[data-owner=run]').click();page.wait_for_selector('[data-owner=job]:not([hidden])');assert requests[-1]['action']=='run'
 assert all('cameraFrame' not in str(r) for r in requests)
 page.screenshot(path='/workspace/Neuroflux-Owner-Chat.png');assert not errors,errors
 print('PASS anonymous hidden, owner conversation, explicit Apply/Undo with walkthrough off, separate submit and developer job, no browser errors');b.close()
server.shutdown()
