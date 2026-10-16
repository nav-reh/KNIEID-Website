import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../app/chatgpt-auth';
import { canManage, canRead } from './policy.mjs';
export function db():D1Database {if(!env.DB)throw new Error('Database unavailable');return env.DB;}
export async function currentUser(){
 const identity=await getChatGPTUser();if(!identity)return null;
 const database=db();const email=identity.email.trim().toLowerCase();
 const ownerSetting=await database.prepare("SELECT value FROM settings WHERE key='owner_user_id'").first<{value:string}>();
 const ownerEmail=(env as unknown as {ADMIN_OWNER_EMAIL?:string}).ADMIN_OWNER_EMAIL?.trim().toLowerCase();
 if(!ownerSetting && ownerEmail && email===ownerEmail){await database.prepare("INSERT OR IGNORE INTO settings (key,value) VALUES ('owner_user_id',?)").bind(identity.userId).run();}
 const anchor=ownerSetting??await database.prepare("SELECT value FROM settings WHERE key='owner_user_id'").first<{value:string}>();
 const owner=anchor?.value===identity.userId;
 // Bind invited accounts to the platform's stable verified identity, once only.
 let row=await database.prepare('SELECT * FROM portal_users WHERE user_id=?').bind(identity.userId).first<any>();
 if(!row){const invite=await database.prepare('SELECT * FROM portal_users WHERE email=? AND user_id IS NULL').bind(email).first<any>();
  if(invite)await database.prepare('UPDATE portal_users SET user_id=?,name=? WHERE id=? AND user_id IS NULL').bind(identity.userId,identity.displayName,invite.id).run();
  else await database.prepare('INSERT OR IGNORE INTO portal_users (id,user_id,email,name,role,blocked,created_at) VALUES (?,?,?,?,?,0,?)').bind(crypto.randomUUID(),identity.userId,email,identity.displayName,owner?'admin':'pending',new Date().toISOString()).run();
  row=await database.prepare('SELECT * FROM portal_users WHERE user_id=?').bind(identity.userId).first<any>();
 }
 if(!row)throw new Error('Unable to link this account; contact the administrator');
 return {...row,owner,blocked:owner?false:!!row.blocked,role:owner?'admin':row.role,userId:identity.userId,displayName:identity.displayName};
}
export async function readInformation(user:any){const result=await db().prepare('SELECT * FROM information ORDER BY updated_at DESC').all<any>();return result.results.filter(item=>canRead(user,item.audience));}
export {canManage,canRead};
