import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {microsoftEmailNotifier} from '../email.js';
import {createServer} from '../server.js';
const emailNotifier = options => microsoftEmailNotifier({tenantId:'11111111-1111-1111-1111-111111111111',clientId:'test-client',clientSecret:'test-key',from:'manager@landrument.com',...options});
const body={employee:{name:'Test Employee',email:'employee@example.com'},items:[{id:'UNISEX-SET',size:'M',inseam:'Regular',color:'Black',quantity:3},{id:'UNISEX-SET',size:'M',inseam:'Tall',color:'Navy',quantity:2}]};
async function serverTest(notifier,run){
 const dir=await mkdtemp(path.join(os.tmpdir(),'scrubs-email-'));const server=createServer({storage:'local',dataDir:dir,adminToken:'test-only',notifier});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{await run('http://127.0.0.1:'+server.address().port);}finally{await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true});}
}
const post=(base)=>fetch(base+'/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
const orders=async base=>(await fetch(base+'/api/admin/orders',{headers:{Authorization:'Bearer test-only'}})).json();
test('saved order emails include approved order details and record Microsoft acceptance',async()=>{
 let payload,headers,calls=0;
 const notifier=emailNotifier({fetchImpl:async(url,options)=>{
  if(url.startsWith('https://login.microsoftonline.com/')) return Response.json({access_token:'test-token',expires_in:3600});
  calls++;assert.equal(url,'https://graph.microsoft.com/v1.0/users/manager%40landrument.com/sendMail');payload=JSON.parse(options.body);headers=options.headers;return new Response(null,{status:202});
 }});
 await serverTest(notifier,async base=>{
  const response=await post(base);assert.equal(response.status,201);const result=await response.json();assert.equal(result.emailStatus,'sent');
  assert.equal(payload.message.toRecipients[0].emailAddress.address,'manager@landrument.com');assert.equal(payload.message.replyTo[0].emailAddress.address,'employee@example.com');assert.match(payload.message.body.content,/Inseam Tall/);assert.match(payload.message.body.content,/3 ×/);assert.match(payload.message.body.content, /Estimated total value: \$160.00/);assert.equal(headers['client-request-id'],result.id);assert.equal(payload.saveToSentItems,true);
  assert.equal((await orders(base))[0].emailNotification.status,'sent');
  const retry=await fetch(base+'/api/admin/orders/'+result.id+'/email',{method:'POST',headers:{Authorization:'Bearer test-only'}});assert.equal(retry.status,200);assert.equal(calls,1);
 });
});
test('provider failure keeps the order and permits an authenticated retry',async()=>{
 let fail=true,calls=0;const keys=[];
 const notifier=emailNotifier({fetchImpl:async(url,options)=>{if(url.startsWith('https://login.microsoftonline.com/'))return Response.json({access_token:'test-token',expires_in:3600});calls++;keys.push(options.headers['client-request-id']);return fail?new Response('Unavailable',{status:503}):new Response(null,{status:202});}});
 await serverTest(notifier,async base=>{
  const response=await post(base);assert.equal(response.status,201);const result=await response.json();assert.equal(result.emailStatus,'failed');assert.equal((await orders(base)).length,1);
  const endpoint=base+'/api/admin/orders/'+result.id+'/email';assert.equal((await fetch(endpoint,{method:'POST'})).status,401);assert.equal(calls,1);
  fail=false;assert.equal((await fetch(endpoint,{method:'POST',headers:{Authorization:'Bearer test-only'}})).status,200);assert.equal((await orders(base))[0].emailNotification.status,'sent');assert.equal(keys[0],keys[1]);
 });
});
test('missing email configuration still saves orders and clearly marks notifications pending setup',async()=>{
 const notifier=emailNotifier({tenantId:'',clientId:'',clientSecret:'',fetchImpl:()=>{throw Error('Unexpected email request');}});
 await serverTest(notifier,async base=>{
  const result=await (await post(base)).json();assert.equal(result.emailStatus,'not_configured');assert.equal((await orders(base))[0].emailNotification.status,'not_configured');
 });
});
test('failed persistence never sends an email',async()=>{
 let sent=false;const server=createServer({storage:'local',adminToken:'test-only',store:{loadCatalog:async()=>(await import('../catalog.js')).catalog,saveOrder:async()=>{throw Error('Failed storage');}},notifier:{configured:true,to:'manager@landrument.com',send:async()=>{sent=true;}}});await new Promise(r=>server.listen(0,'127.0.0.1',r));try{assert.equal((await post('http://127.0.0.1:'+server.address().port)).status,500);assert.equal(sent,false);}finally{await new Promise(r=>server.close(r));}
});

test('Microsoft token failures prevent send requests and send timeouts report uncertainty',async()=>{
 let sends=0;
 const denied=emailNotifier({fetchImpl:async url=>{if(url.startsWith('https://login.microsoftonline.com/'))return new Response(null,{status:401});sends++;throw Error('Unexpected send');}});
 await serverTest(denied,async base=>{const result=await (await post(base)).json();assert.equal(result.emailStatus,'failed');assert.equal(sends,0);});
 const timeout=emailNotifier({fetchImpl:async url=>{if(url.startsWith('https://login.microsoftonline.com/'))return Response.json({access_token:'test',expires_in:3600});throw Error('Timeout');}});
 await serverTest(timeout,async base=>{const result=await (await post(base)).json();assert.equal(result.emailStatus,'uncertain');assert.equal((await orders(base))[0].emailNotification.status,'uncertain');});
});
