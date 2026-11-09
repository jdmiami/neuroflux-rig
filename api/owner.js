'use strict';
const auth=require('../lib/owner/auth.cjs');
const hits=new Map();
module.exports=async(req,res)=>{
 const send=(code,data)=>{res.statusCode=code;res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(data));};
 try{
 const user=await auth.owner(req);if(req.method==='GET'){send(200,{owner:!!user,configured:auth.configured()});return;}
 if(!user){send(401,{error:'Owner sign-in required.'});return;}
 if(req.method!=='POST'||!auth.sameOrigin(req)){send(403,{error:'Use the owner chat on this app.'});return;}
 let body=req.body;if(typeof body==='string')try{body=JSON.parse(body);}catch{send(400,{error:'Invalid request.'});return;}
 if(!body||Buffer.byteLength(JSON.stringify(body))>45000){send(400,{error:'Request is too large.'});return;}
 const now=Date.now(),bucket=hits.get(user.ownerId)||{at:now,count:0};if(now-bucket.at>60000){bucket.at=now;bucket.count=0;}bucket.count++;hits.set(user.ownerId,bucket);if(bucket.count>15){send(429,{error:'Please wait a moment before sending more requests.'});return;}
 if(body.action==='chat'){
  if(!process.env.GEMINI_API_KEY){send(503,{error:'The assistant is not configured.'});return;}
  if(!Array.isArray(body.messages)||!body.messages.length||body.messages.length>14||body.messages.some(m=>!['user','assistant'].includes(m.role)||typeof m.content!=='string'||!m.content.trim()||m.content.length>4000)){send(400,{error:'Invalid conversation.'});return;}
  send(200,{ok:true,...await require('../lib/owner/chat.cjs').chat(body)});return;
 }
 if(body.action==='submit'){send(200,{ok:true,...await require('../lib/owner/github.cjs').submit(user.accessToken,body.proposal)});return;}
 if(body.action==='run'){send(200,{ok:true,...await require('../lib/owner/github.cjs').run(user.accessToken,body.number)});return;}
 send(400,{error:'Unknown owner action.'});
 }catch{send(502,{error:'The owner request could not be completed. Sign in again or retry.'});}
};
