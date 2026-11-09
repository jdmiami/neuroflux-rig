'use strict';
module.exports=async(req,res)=>{
 const auth=require('../lib/owner/auth.cjs');res.setHeader('Cache-Control','no-store');
 if(!auth.configured()){res.statusCode=503;res.end('Owner sign-in is not configured.');return;}
 try{
  const {Auth}=await import('@auth/core');const incoming=new URL(req.url,auth.base());const part=incoming.searchParams.get('authPath')||incoming.pathname.replace(/^\/api\/auth\/?/,'');
  if(!/^[a-z-]+(?:\/[a-z-]+)?$/.test(part)){res.statusCode=404;res.end();return;}
  const url=new URL('/api/auth/'+part,auth.base());for(const [k,v]of incoming.searchParams)if(k!=='authPath')url.searchParams.set(k,v);
  let body;if(!['GET','HEAD'].includes(req.method)){body=typeof req.body==='string'?req.body:String(req.headers['content-type']).includes('application/x-www-form-urlencoded')?new URLSearchParams(req.body||{}).toString():JSON.stringify(req.body||{});}
  const response=await Auth(new Request(url,{method:req.method,headers:req.headers,body}),await auth.config());
  res.statusCode=response.status;for(const [key,value]of response.headers)if(key!=='set-cookie')res.setHeader(key,value);const cookies=response.headers.getSetCookie();if(cookies.length)res.setHeader('set-cookie',cookies);res.end(Buffer.from(await response.arrayBuffer()));
 }catch{res.statusCode=500;res.end('Owner sign-in failed. Try again.');}
};
