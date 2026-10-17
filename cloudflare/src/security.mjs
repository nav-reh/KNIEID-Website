const enc=new TextEncoder();
export const PASSWORD_ITERATIONS=100000;
export const SESSION_SECONDS=8*60*60;
export const normalise=v=>String(v||'').trim().toLowerCase();
export const validUsername=v=>/^[a-z0-9][a-z0-9_.-]{2,47}$/.test(v);
export const hex=buffer=>Array.from(new Uint8Array(buffer),b=>b.toString(16).padStart(2,'0')).join('');
const bytes=h=>Uint8Array.from(h.match(/.{2}/g)||[],s=>parseInt(s,16));
export const randomToken=()=>hex(crypto.getRandomValues(new Uint8Array(32)));
export async function digest(s){return hex(await crypto.subtle.digest('SHA-256',enc.encode(s)));}
export function equal(a,b){if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let n=0;for(let i=0;i<a.length;i++)n|=a.charCodeAt(i)^b.charCodeAt(i);return n===0;}
export async function peppered(password,pepper){const key=await crypto.subtle.importKey('raw',enc.encode(pepper),{name:'HMAC',hash:'SHA-256'},false,['sign']);return crypto.subtle.sign('HMAC',key,enc.encode(password));}
export async function hashPassword(password,pepper,salt=hex(crypto.getRandomValues(new Uint8Array(32)))){const material=await peppered(password,pepper);const key=await crypto.subtle.importKey('raw',material,'PBKDF2',false,['deriveBits']);const hash=hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:bytes(salt),iterations:PASSWORD_ITERATIONS},key,256));return {hash,salt};}
export async function verifyPassword(password,pepper,user){return equal((await hashPassword(password,pepper,user.password_salt)).hash,user.password_hash);}
export function strongPassword(p,username){return typeof p==='string'&&p.length>=14&&p.length<=128&&!p.toLowerCase().includes(username)&&new Set(p).size>=6;}
export function canManage(user){return !!user&&!user.blocked&&!user.must_change&&(!!user.owner||user.role==='admin');}
export function canRead(user,a){if(a==='public')return true;if(!user||user.blocked||user.must_change)return false;if(canManage(user))return true;return a==='member'?['member','committee'].includes(user.role):a==='committee'?user.role==='committee':false;}
export function validOrigin(r){return r.headers.get('origin')===new URL(r.url).origin;}
export function cookie(token,seconds=SESSION_SECONDS){return `__Host-knieid_session=${token}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${seconds}`;}
export function sessionToken(r){const match=(r.headers.get('cookie')||'').match(/(?:^|;\s*)__Host-knieid_session=([a-f0-9]{64})(?:;|$)/);return match?.[1]||null;}
