export const roles = ['pending','member','committee','admin'];
export const audiences = ['public','member','committee','admin'];
export function canManage(user){return !!user && !user.blocked && (user.owner || user.role==='admin');}
export function canRead(user,audience){if(audience==='public')return true;if(!user||user.blocked)return false;if(canManage(user))return true;if(audience==='member')return ['member','committee'].includes(user.role);if(audience==='committee')return user.role==='committee';return false;}
export function sameOrigin(request){const origin=request.headers.get('origin');return !!origin && origin===new URL(request.url).origin;}
