import {currentUser,db,readInformation,canManage} from '../../../lib/portal';
import {roles,audiences,sameOrigin} from '../../../lib/policy.mjs';
export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export async function GET(request:Request){try{const user=await currentUser();const action=new URL(request.url).searchParams.get('action');
 if(action==='admin'){if(!user)return json({error:'Sign in required'},401);if(!canManage(user))return json({error:'Administrator access required'},403);
 const users=await db().prepare("SELECT id,user_id,email,name,role,blocked,created_at FROM portal_users ORDER BY created_at DESC").all();
 const ownerId=await db().prepare("SELECT value FROM settings WHERE key='owner_user_id'").first<{value:string}>();
 const logs=await db().prepare('SELECT * FROM audit_log ORDER BY at DESC LIMIT 50').all();
 return json({user:clean(user),users:users.results.map((u:any)=>({...u,owner:u.user_id===ownerId?.value})),information:await readInformation(user),audit:logs.results});}
 return json({user:user?clean(user):null,information:await readInformation(user)});
 }catch(error){console.error('Portal request failed',error);return json({error:'Service unavailable. Please try again.'},503);}}
function clean(u:any){return {id:u.id,email:u.email,name:u.displayName,role:u.role,blocked:u.blocked,owner:u.owner};}
export async function POST(request:Request){if(!sameOrigin(request))return json({error:'Invalid request origin'},403);
 if(!request.headers.get('content-type')?.includes('application/json'))return json({error:'JSON required'},415);
 if(+(request.headers.get('content-length')||0)>50000)return json({error:'Request too large'},413);
 try{const user=await currentUser();if(!user)return json({error:'Sign in required'},401);if(!canManage(user))return json({error:'Administrator access required'},403);
 const raw=await request.text();if(raw.length>50000)return json({error:'Request too large'},413);let body;try{body=JSON.parse(raw)}catch{return json({error:'Invalid JSON'},400)}
 const database=db(),at=new Date().toISOString();let statement:D1PreparedStatement,target:string;
 if(body.action==='saveUser'){
  const email=String(body.email||'').trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||!roles.includes(body.role)||typeof body.blocked!=='boolean')return json({error:'Invalid user details'},400);
  const existing=body.id?await database.prepare('SELECT * FROM portal_users WHERE id=?').bind(body.id).first<any>():await database.prepare('SELECT * FROM portal_users WHERE email=?').bind(email).first<any>();
  const anchor=await database.prepare("SELECT value FROM settings WHERE key='owner_user_id'").first<{value:string}>();
  if(existing?.user_id===anchor?.value)return json({error:'The site owner cannot be changed or blocked'},400);
  if(existing?.id===user.id)return json({error:'Ask another administrator to change your own access'},400);
  // Administrators can approve users; only the owner can grant/revoke admin access.
  if(!user.owner&&(body.role==='admin'||existing?.role==='admin'))return json({error:'Only the owner can manage administrator access'},403);
  if(body.id&&!existing)return json({error:'User not found'},404);
  target=existing?.id||crypto.randomUUID();
  // A linked account's email is a display field; never retarget its identity.
  if(existing && existing.email!==email)return json({error:'An existing account email cannot be changed'},400);
  statement=existing?database.prepare('UPDATE portal_users SET role=?,blocked=? WHERE id=?').bind(body.role,body.blocked?1:0,target):database.prepare('INSERT INTO portal_users (id,email,name,role,blocked,created_at) VALUES (?,?,?,?,?,?)').bind(target,email,'',body.role,body.blocked?1:0,at);
 }else if(body.action==='saveInformation'){
  const values=['title_de','title_en','body_de','body_en'].map(k=>typeof body[k]==='string'?body[k].trim():'');
  if(!values.every(Boolean)||values[0].length>200||values[1].length>200||values[2].length>15000||values[3].length>15000||!audiences.includes(body.audience))return json({error:'Complete both languages and select a valid audience'},400);
  target=typeof body.id==='string'&&body.id?body.id:crypto.randomUUID();statement=database.prepare('INSERT INTO information (id,title_de,title_en,body_de,body_en,audience,updated_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title_de=excluded.title_de,title_en=excluded.title_en,body_de=excluded.body_de,body_en=excluded.body_en,audience=excluded.audience,updated_at=excluded.updated_at').bind(target,...values,body.audience,at);
 }else if(body.action==='deleteInformation'){
  if(typeof body.id!=='string'||!body.id)return json({error:'Invalid information ID'},400);target=body.id;statement=database.prepare('DELETE FROM information WHERE id=?').bind(target);
 }else return json({error:'Unknown action'},400);
 await database.batch([statement,database.prepare('INSERT INTO audit_log (id,actor,action,target,at) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),user.userId,body.action,target,at)]);return json({ok:true});
 }catch(error){console.error('Portal mutation failed',error);return json({error:'Unable to save. Please try again.'},503);}}
