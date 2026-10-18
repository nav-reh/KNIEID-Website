const ARCHIVE_ID='committee-facebook-archive';
import {normalise,validUsername,randomToken,digest,hashPassword,verifyPassword,strongPassword,canManage,canRead,validOrigin,cookie,sessionToken,SESSION_SECONDS,equal,peppered,hex} from './security.mjs';
const roles=['member','committee','admin'],audiences=['public','member','committee','admin'];
const json=(body,status=200,extra={})=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra}});
const clean=u=>u?({id:u.id,username:u.display_username,email:u.email,name:u.name,role:u.role,owner:!!u.owner,blocked:!!u.blocked,must_change:!!u.must_change}):null;
async function currentUser(request,env){const token=sessionToken(request);if(!token)return null;return env.DB.prepare('SELECT u.*,s.token_hash AS session_hash FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.blocked=0').bind(await digest(token),Date.now()).first();}
async function audit(env,user,action,target,statements=[]){await env.DB.batch([...statements,env.DB.prepare('INSERT INTO audit_log(id,actor,action,target,at) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),user.id,action,target,new Date().toISOString())]);}
async function limit(env,key,max){const now=Date.now();const row=await env.DB.prepare('INSERT INTO rate_limits(key,attempts,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN expires_at<=? THEN 1 ELSE attempts+1 END,expires_at=CASE WHEN expires_at<=? THEN excluded.expires_at ELSE expires_at END RETURNING attempts').bind(key,now+15*60000,now,now).first();return row.attempts<=max;}
async function session(env,user){const token=randomToken();await env.DB.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').bind(await digest(token),user.id,Date.now()+SESSION_SECONDS*1000).run();return json({ok:true,user:clean(user)},200,{'Set-Cookie':cookie(token)});}
async function body(request){if(!request.headers.get('content-type')?.includes('application/json'))throw {status:415,message:'JSON required'};const text=await request.text();if(text.length>50000)throw {status:413,message:'Request too large'};try{return JSON.parse(text)}catch{throw {status:400,message:'Invalid JSON'}}}
async function login(request,env,b){const username=normalise(b.username);if(!validUsername(username)||typeof b.password!=='string'||b.password.length>128)return json({error:'Invalid username or password'},401);
 const ip=request.headers.get('CF-Connecting-IP');if(!ip&&new URL(request.url).hostname!=='localhost')return json({error:'Unable to verify request'},403);
 const ipKey='ip:'+await digest(ip||'local'),userKey='user:'+await digest(username);
 if(!(await limit(env,ipKey,30))||!(await limit(env,userKey,10)))return json({error:'Too many sign-in attempts. Try again in 15 minutes.'},429,{'Retry-After':'900'});
 await env.DB.batch([env.DB.prepare('DELETE FROM sessions WHERE expires_at<=?').bind(Date.now()),env.DB.prepare('DELETE FROM rate_limits WHERE expires_at<=?').bind(Date.now())]);
 let user=await env.DB.prepare('SELECT * FROM users WHERE username=?').bind(username).first();
 if(!user&&username==='superadmin'&&env.BOOTSTRAP_ADMIN_PASSWORD){const owner=await env.DB.prepare('SELECT id FROM users WHERE owner=1').first();if(!owner){const supplied=hex(await peppered(b.password,env.AUTH_PEPPER));const expected=hex(await peppered(env.BOOTSTRAP_ADMIN_PASSWORD,env.AUTH_PEPPER));if(equal(supplied,expected)){const p=await hashPassword(b.password,env.AUTH_PEPPER);const id=crypto.randomUUID();await env.DB.prepare('INSERT OR IGNORE INTO users(id,username,display_username,name,email,role,password_hash,password_salt,owner,must_change,created_at) VALUES(?,?,?,?,?,?,?,?,1,1,?)').bind(id,'superadmin','SuperAdmin','SuperAdmin',env.OWNER_EMAIL||'','admin',p.hash,p.salt,new Date().toISOString()).run();user=await env.DB.prepare("SELECT * FROM users WHERE username='superadmin'").first();}}}
 // Unknown accounts perform the same expensive password operation; responses do not reveal account existence.
 const valid=await verifyPassword(b.password,env.AUTH_PEPPER,user||{password_salt:'00'.repeat(32),password_hash:'00'.repeat(32)});
 if(!user||!valid||user.blocked)return json({error:'Invalid username or password'},401);
 return session(env,user);
}
async function mutate(request,env,user,b){const now=new Date().toISOString();
 if(b.action==='changePassword'){
  if(typeof b.currentPassword!=='string'||b.currentPassword.length>128||!strongPassword(b.newPassword,user.username))return json({error:'Use a unique password of 14–128 characters, without your username.'},400);
  if(!(await limit(env,'change:'+user.id,10)))return json({error:'Too many attempts. Try again later.'},429);
  if(!(await verifyPassword(b.currentPassword,env.AUTH_PEPPER,user)))return json({error:'Current password is incorrect'},400);
  if(equal(b.currentPassword,b.newPassword))return json({error:'Choose a different password'},400);
  const p=await hashPassword(b.newPassword,env.AUTH_PEPPER);await audit(env,user,'password_changed',user.id,[env.DB.prepare('UPDATE users SET password_hash=?,password_salt=?,must_change=0 WHERE id=?').bind(p.hash,p.salt,user.id),env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(user.id)]);return session(env,{...user,password_hash:p.hash,password_salt:p.salt,must_change:0});
 }
 if(!canManage(user))return json({error:user.must_change?'Change your password first':'Administrator access required'},403);
 if(b.action==='saveUser'){
  const username=normalise(b.username),display=String(b.username||'').trim(),email=String(b.email||'').trim(),name=String(b.name||'').trim();
  if(!validUsername(username)||!roles.includes(b.role)||typeof b.blocked!=='boolean'||email.length>254||name.length>150||(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))return json({error:'Invalid account details'},400);
  const old=b.id?await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(String(b.id)).first():null;
  if(b.id&&!old)return json({error:'Account not found'},404);
  if(old?.owner||old?.id===user.id)return json({error:'This account cannot be changed here'},400);
  if(!user.owner&&(b.role==='admin'||old?.role==='admin'))return json({error:'Only SuperAdmin can manage administrators'},403);
  const duplicate=await env.DB.prepare('SELECT id FROM users WHERE username=?').bind(username).first();if(duplicate&&duplicate.id!==old?.id)return json({error:'Username is already in use'},409);
  if(!old&&username==='superadmin')return json({error:'This username is reserved'},400);
  const changePassword=!old||!!b.password;
  if(changePassword&&!strongPassword(b.password,username))return json({error:'Use a temporary password of 14–128 characters without the username.'},400);
  const id=old?.id||crypto.randomUUID();let statements=[];
  if(old){statements.push(env.DB.prepare('UPDATE users SET username=?,display_username=?,name=?,email=?,role=?,blocked=? WHERE id=?').bind(username,display,name,email,b.role,b.blocked?1:0,id));if(changePassword){const p=await hashPassword(b.password,env.AUTH_PEPPER);statements.push(env.DB.prepare('UPDATE users SET password_hash=?,password_salt=?,must_change=1 WHERE id=?').bind(p.hash,p.salt,id));}statements.push(env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(id));}
  else{const p=await hashPassword(b.password,env.AUTH_PEPPER);statements.push(env.DB.prepare('INSERT INTO users(id,username,display_username,name,email,role,password_hash,password_salt,blocked,must_change,created_at) VALUES(?,?,?,?,?,?,?,?,?,1,?)').bind(id,username,display,name,email,b.role,p.hash,p.salt,b.blocked?1:0,now));}
  await audit(env,user,old?'account_updated':'account_created',id,statements);return json({ok:true});
 }
 if(b.action==='saveInformation'){
  if(b.id===ARCHIVE_ID)return json({error:'Use the committee archive importer'},400);
  const fields=['title_de','title_en','body_de','body_en'].map(k=>typeof b[k]==='string'?b[k].trim():'');if(!fields.every(Boolean)||fields[0].length>200||fields[1].length>200||fields[2].length>15000||fields[3].length>15000||!audiences.includes(b.audience))return json({error:'Complete both languages and select a valid audience'},400);
  const id=typeof b.id==='string'&&b.id?b.id:crypto.randomUUID();await audit(env,user,'information_saved',id,[env.DB.prepare('INSERT INTO information(id,title_de,title_en,body_de,body_en,audience,updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title_de=excluded.title_de,title_en=excluded.title_en,body_de=excluded.body_de,body_en=excluded.body_en,audience=excluded.audience,updated_at=excluded.updated_at').bind(id,...fields,b.audience,now)]);return json({ok:true});
 }
 if(b.action==='deleteInformation'&&typeof b.id==='string'){if(b.id===ARCHIVE_ID)return json({error:'Use the committee archive importer'},400);await audit(env,user,'information_deleted',b.id,[env.DB.prepare('DELETE FROM information WHERE id=?').bind(b.id)]);return json({ok:true});}
 return json({error:'Unknown action'},400);
}
async function api(request,env){const url=new URL(request.url);if(!['/api/portal','/api/auth/login','/api/auth/logout','/api/committee-archive'].includes(url.pathname)&&!url.pathname.startsWith('/api/committee-archive/media/'))return json({error:'Not found'},404);if(!env.DB||!env.AUTH_PEPPER||env.AUTH_PEPPER.length<32)return json({error:'Portal setup is incomplete. Contact the administrator.'},503);

 if(url.pathname==='/api/committee-archive'||url.pathname.startsWith('/api/committee-archive/media/')){
  const viewer=await currentUser(request,env);
  if(!viewer)return json({error:'Sign in required'},401);
  if(!canRead(viewer,'committee'))return json({error:'Committee access required'},403);
  if(request.method==='POST'&&url.pathname==='/api/committee-archive'){
   if(!canManage(viewer))return json({error:'Administrator access required'},403);
   if(!validOrigin(request))return json({error:'Invalid request origin'},403);
   if(!request.headers.get('content-type')?.includes('application/json'))return json({error:'JSON required'},415);
   const bytes=await request.text();if(bytes.length>2000000)return json({error:'Archive too large'},413);
   let bundle;try{bundle=JSON.parse(bytes)}catch{return json({error:'Invalid archive JSON'},400)}
   const a=bundle.archive,images=bundle.images;
   if(!a||!Array.isArray(a.sections)||a.sections.length>50||!Array.isArray(a.photos)||a.photos.length>100||!Array.isArray(a.links)||a.links.length>100||!Array.isArray(a.transcripts)||a.transcripts.length>50||!images||typeof images!=='object'||Array.isArray(images))return json({error:'Invalid archive structure'},400);
   const safeUrl=v=>typeof v==='string'&&v.length<2048&&v.startsWith('https://')&&!/[<>"\s]/.test(v);
   if(!a.sections.every(x=>['title_en','title_de','body_en','body_de'].every(k=>typeof x[k]==='string'&&x[k].length<=50000))||!a.links.every(x=>typeof x.label==='string'&&safeUrl(x.url))||!a.photos.every(x=>/^\d{1,30}$/.test(x.id)&&safeUrl(x.source))||!a.transcripts.every(x=>typeof x==='string'&&x.length<=150000)||!Object.entries(images).every(([id,v])=>/^\d{1,30}$/.test(id)&&typeof v==='string'&&v.length<500000&&/^[A-Za-z0-9+/]+={0,2}$/.test(v)))return json({error:'Invalid archive fields'},400);
   await audit(env,viewer,'committee_archive_imported',ARCHIVE_ID,[env.DB.prepare("INSERT INTO information(id,title_de,title_en,body_de,body_en,audience,updated_at) VALUES(?,?,?,?,?,'committee',?) ON CONFLICT(id) DO UPDATE SET body_en=excluded.body_en,audience='committee',updated_at=excluded.updated_at").bind(ARCHIVE_ID,'Facebook-Archiv','Facebook archive','',JSON.stringify(bundle),new Date().toISOString())]);return json({ok:true});
  }
  if(request.method!=='GET')return json({error:'Method not allowed'},405);
  const stored=await env.DB.prepare('SELECT body_en FROM information WHERE id=?').bind(ARCHIVE_ID).first();
  if(!stored)return url.pathname==='/api/committee-archive'?json({available:false}):json({error:'Not found'},404);
  const bundle=JSON.parse(stored.body_en);
  if(url.pathname==='/api/committee-archive')return json({...bundle.archive,available:true});
  const id=url.pathname.slice('/api/committee-archive/media/'.length);
  const encoded=Object.hasOwn(bundle.images,id)?bundle.images[id]:null;
  if(!encoded)return json({error:'Not found'},404);
  return new Response(Uint8Array.from(atob(encoded),c=>c.charCodeAt(0)),{headers:{'Content-Type':encoded.startsWith('iVBOR')?'image/png':'image/jpeg','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Cross-Origin-Resource-Policy':'same-origin'}});
 }
 if(request.method==='POST'){
  if(!validOrigin(request))return json({error:'Invalid request origin'},403);const b=await body(request);
  if(url.pathname==='/api/auth/login')return login(request,env,b);
  const user=await currentUser(request,env);
  if(url.pathname==='/api/auth/logout'){if(user)await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(user.session_hash).run();return json({ok:true},200,{'Set-Cookie':cookie('',0)});}
  if(!user)return json({error:'Sign in required'},401);return mutate(request,env,user,b);
 }
 if(request.method!=='GET')return json({error:'Method not allowed'},405);
 const user=await currentUser(request,env);let information=await env.DB.prepare("SELECT * FROM information WHERE id <> 'committee-facebook-archive' ORDER BY updated_at DESC").all();information=information.results.filter(i=>canRead(user,i.audience));
 if(url.searchParams.get('action')==='admin'){
  if(!user)return json({error:'Sign in required'},401);if(!canManage(user))return json({error:'Administrator access required'},403);
  const users=await env.DB.prepare('SELECT id,display_username AS username,name,email,role,blocked,must_change,owner,created_at FROM users ORDER BY owner DESC,created_at DESC').all();const logs=await env.DB.prepare('SELECT id,actor,action,target,at FROM audit_log ORDER BY at DESC LIMIT 100').all();return json({user:clean(user),users:users.results,information,audit:logs.results});
 }return json({user:clean(user),information});
}
export default {async fetch(request,env){try{const u=new URL(request.url);if(u.pathname.startsWith('/api/'))return await api(request,env);if(['/admin','/members','/committee','/login','/change-password'].includes(u.pathname)){const asset=await env.ASSETS.fetch(new Request(new URL('/portal',request.url),request));const h=new Headers(asset.headers);h.set('Cache-Control','no-store');h.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");h.set('X-Frame-Options','DENY');h.set('X-Content-Type-Options','nosniff');return new Response(asset.body,{status:asset.status,headers:h});}return env.ASSETS.fetch(request);}catch(e){console.error('Portal error',e?.status||500);return json({error:e?.message&&e?.status?e.message:'Service unavailable. Please try again.'},e?.status||503);}}};
