import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {encode} from '@auth/core/jwt';
const require=createRequire(import.meta.url),auth=require('../lib/owner/auth.cjs'),handler=require('../api/owner.js'),policy=require('../lib/owner/change-policy.cjs');
process.env.AUTH_URL='http://localhost:4173';process.env.AUTH_SECRET='test-secret-for-owner-session-verification-only';process.env.AUTH_GITHUB_ID='test-client';process.env.AUTH_GITHUB_SECRET='test-client-secret';
async function cookie(id='75132410'){return 'authjs.session-token='+await encode({secret:process.env.AUTH_SECRET,salt:'authjs.session-token',token:{ownerId:id,accessToken:'test-not-real'}});}
async function request({method='POST',body={action:'run',number:1},headers={}}={}){let status,output;const res={setHeader(){},set statusCode(v){status=v},end(s){output=JSON.parse(s)}};await handler({method,body,headers},res);return {status,output};}
test('owner endpoints reject anonymous, forged and other-account sessions',async()=>{
 assert.equal((await request()).status,401);
 assert.equal((await request({headers:{cookie:'authjs.session-token=forged'}})).status,401);
 assert.equal((await request({headers:{cookie:await cookie('999')}})).status,401);
 const r=await request({method:'GET',headers:{cookie:await cookie()}});assert.equal(r.output.owner,true);assert.equal(r.output.accessToken,undefined);
});
test('valid owner session still requires same-origin JSON and custom header',async()=>{
 const c=await cookie();assert.equal((await request({headers:{cookie:c,origin:'https://evil.example','content-type':'application/json','x-nfx-owner':'1'}})).status,403);
 assert.equal((await request({headers:{cookie:c,origin:'http://localhost:4173','content-type':'application/json'}})).status,403);
});
test('owner chat validates all proposed live actions against registered controls',()=>{
 const {validate}=require('../lib/owner/chat.cjs');const base={reply:'Try this.',proposal:null};
 assert.throws(()=>validate({...base,actions:[{label:'Bad',action:{type:'eval',key:'',value:null,output:null}}]}));
 assert.throws(()=>validate({...base,actions:[{label:'Bad',action:{type:'set_control',key:'hue',value:999,output:null}}]}));
 assert.equal(validate({...base,actions:[{label:'Hue',action:{type:'set_control',key:'hue',value:.4,output:null}}]}).actions[0].action.key,'hue');
});
test('developer patch boundaries reject traversal, secrets, owner code and ambiguous anchors',()=>{
 for(const file of ['.env','../src/a.js','src/../api/ai.js','src//owner/chat.js','lib/owner/auth.cjs','.github/workflows/a.yml','package.json','scripts/build.cjs'])assert.equal(policy.allowed(file),false,file);
 const root=mkdtempSync(join(tmpdir(),'nfx-owner-'));mkdirSync(join(root,'src'));writeFileSync(join(root,'src/a.js'),'let value=1;');
 try{assert.throws(()=>policy.applyPlan({edits:[{path:'src/a.js',find:'missing',replace:'x'}],creates:[]},root));assert.equal(readFileSync(join(root,'src/a.js'),'utf8'),'let value=1;');policy.applyPlan({edits:[{path:'src/a.js',find:'value=1',replace:'value="$&"'}],creates:[]},root);assert.equal(readFileSync(join(root,'src/a.js'),'utf8'),'let value="$&";');}finally{rmSync(root,{recursive:true,force:true});}
});
test('Auth.js sign-in accepts only the immutable owner identity and never exposes provider tokens in sessions',async()=>{
 const config=await auth.config();assert.equal(await config.callbacks.signIn({profile:{id:75132410}}),true);assert.equal(await config.callbacks.signIn({profile:{id:123}}),false);
 const session=await config.callbacks.session({session:{expires:'later'},token:{ownerId:'75132410',accessToken:'must-stay-server-side',name:'Owner'}});assert.equal(session.owner,true);assert.equal(JSON.stringify(session).includes('must-stay-server-side'),false);
 const handler=require('../api/owner-auth.js');let status,html;const res={statusCode:0,setHeader(){},end(s){html=String(s);status=this.statusCode}};
 await handler({url:'/api/auth/signin?callbackUrl=%2Flaunch.html',method:'GET',headers:{host:'localhost:4173'}},res);assert.equal(status,200);assert.match(html,/GitHub/);
});
