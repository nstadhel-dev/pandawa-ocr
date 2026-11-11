// PANDAWA OCR - Auth (login/logout/me) - Pages Functions
import { corsHeaders, jsonResp, handleOptions, cleanStr, hashPassword, makeToken, ensureTables, seedAdmin } from '../_lib.js';
export async function onRequestOptions({ request }){ return handleOptions(request); }
export async function onRequestPost({ request, env }){
  try{
    const url = new URL(request.url);
    const action = url.searchParams.get('action') || 'login';
    await ensureTables(env.DB);
    await seedAdmin(env.DB);
    if(action === 'login'){
      const b = await request.json().catch(()=>({}));
      const username = cleanStr(b.username, 30);
      const password = cleanStr(b.password, 100);
      if(!username || !password) return jsonResp({ ok:false, error:'Username & password wajib' }, 400, request);
      const user = await env.DB.prepare(`SELECT * FROM users WHERE username = ?`).bind(username).first();
      if(!user) return jsonResp({ ok:false, error:'Username / password salah' }, 401, request);
      const hash = await hashPassword(password, user.salt);
      if(hash !== user.password_hash) return jsonResp({ ok:false, error:'Username / password salah' }, 401, request);
      const token = makeToken();
      const expires = Date.now() + 24*60*60*1000; // 24 jam
      await env.DB.prepare(`INSERT INTO sessions (token, username, role, expires_at, created_at) VALUES (?, ?, ?, ?, ?)`).bind(token, user.username, user.role, expires, Date.now()).run();
      return jsonResp({ ok:true, token, user:{ username:user.username, role:user.role, nama:user.nama } }, 200, request);
    }
    if(action === 'logout'){
      const auth = request.headers.get('Authorization') || '';
      const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
      if(token) await env.DB.prepare(`DELETE FROM sessions WHERE token = ?`).bind(token).run();
      return jsonResp({ ok:true }, 200, request);
    }
    return jsonResp({ ok:false, error:'action tidak dikenal' }, 400, request);
  }catch(e){ return jsonResp({ ok:false, error:String(e) }, 500, request); }
}
export async function onRequestGet({ request, env }){
  try{
    await ensureTables(env.DB);
    const auth = request.headers.get('Authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if(!token) return jsonResp({ ok:false, error:'Unauthorized' }, 401, request);
    const row = await env.DB.prepare(`SELECT * FROM sessions WHERE token = ?`).bind(token).first();
    if(!row || Date.now() > (row.expires_at || 0)) return jsonResp({ ok:false, error:'Sesi habis, login lagi' }, 401, request);
    return jsonResp({ ok:true, user:{ username:row.username, role:row.role } }, 200, request);
  }catch(e){ return jsonResp({ ok:false, error:String(e) }, 500, request); }
}
