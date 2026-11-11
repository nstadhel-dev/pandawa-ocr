// PANDAWA OCR - Users CRUD (Admin saja) - Pages Functions
import { jsonResp, handleOptions, cleanStr, isValidUsername, isValidRole, hashPassword, makeSalt, ensureTables, seedAdmin, requireAdmin } from '../_lib.js';
export async function onRequestOptions({ request }){ return handleOptions(request); }
export async function onRequestGet({ request, env }){
  try{
    await ensureTables(env.DB); await seedAdmin(env.DB);
    const a = await requireAdmin(env.DB, request);
    if(a.error) return jsonResp({ ok:false, error:a.error }, a.status, request);
    const { results } = await env.DB.prepare(`SELECT username, role, nama, created_at FROM users ORDER BY created_at ASC`).all();
    return jsonResp({ ok:true, data:results }, 200, request);
  }catch(e){ return jsonResp({ ok:false, error:String(e) }, 500, request); }
}
export async function onRequestPost({ request, env }){
  try{
    await ensureTables(env.DB); await seedAdmin(env.DB);
    const a = await requireAdmin(env.DB, request);
    if(a.error) return jsonResp({ ok:false, error:a.error }, a.status, request);
    const b = await request.json().catch(()=>({}));
    const username = cleanStr(b.username, 30);
    const password = cleanStr(b.password, 100);
    const role = cleanStr(b.role, 10);
    const nama = cleanStr(b.nama, 100) || username;
    if(!isValidUsername(username)) return jsonResp({ ok:false, error:'Username 3-30 karakter (huruf, angka, _ . -)' }, 400, request);
    if(!isValidRole(role)) return jsonResp({ ok:false, error:'Role harus admin / user' }, 400, request);
    if(!password || password.length < 4) return jsonResp({ ok:false, error:'Password minimal 4 karakter' }, 400, request);
    const ada = await env.DB.prepare(`SELECT username FROM users WHERE username = ?`).bind(username).first();
    if(ada) return jsonResp({ ok:false, error:'Username sudah ada' }, 409, request);
    const salt = makeSalt();
    const hash = await hashPassword(password, salt);
    await env.DB.prepare(`INSERT INTO users (username, password_hash, salt, role, nama, created_at) VALUES (?, ?, ?, ?, ?, ?)`).bind(username, hash, salt, role, nama, Date.now()).run();
    return jsonResp({ ok:true, user:{ username, role, nama } }, 200, request);
  }catch(e){ return jsonResp({ ok:false, error:String(e) }, 500, request); }
}
export async function onRequestPut({ request, env }){
  try{
    await ensureTables(env.DB);
    const a = await requireAdmin(env.DB, request);
    if(a.error) return jsonResp({ ok:false, error:a.error }, a.status, request);
    const b = await request.json().catch(()=>({}));
    const username = cleanStr(b.username, 30);
    const password = cleanStr(b.password, 100);
    const role = cleanStr(b.role, 10);
    const nama = cleanStr(b.nama, 100);
    if(!username) return jsonResp({ ok:false, error:'Username wajib' }, 400, request);
    const user = await env.DB.prepare(`SELECT * FROM users WHERE username = ?`).bind(username).first();
    if(!user) return jsonResp({ ok:false, error:'User tidak ditemukan' }, 404, request);
    if(role && !isValidRole(role)) return jsonResp({ ok:false, error:'Role tidak valid' }, 400, request);
    // Cegah hapus admin terakhir: jika user ini admin dan diubah jadi user, cek masih ada admin lain
    if(user.role === 'admin' && role === 'user'){
      const cnt = await env.DB.prepare(`SELECT COUNT(*) as c FROM users WHERE role = 'admin'`).first();
      if((cnt?.c || 0) <= 1) return jsonResp({ ok:false, error:'Tidak bisa ubah admin terakhir jadi user' }, 400, request);
    }
    if(password){
      if(password.length < 4) return jsonResp({ ok:false, error:'Password minimal 4 karakter' }, 400, request);
      const salt = makeSalt();
      const hash = await hashPassword(password, salt);
      await env.DB.prepare(`UPDATE users SET password_hash = ?, salt = ?, role = COALESCE(NULLIF(?, ''), role), nama = COALESCE(NULLIF(?, ''), nama) WHERE username = ?`).bind(hash, salt, role || '', nama || '', username).run();
    } else {
      await env.DB.prepare(`UPDATE users SET role = COALESCE(NULLIF(?, ''), role), nama = COALESCE(NULLIF(?, ''), nama) WHERE username = ?`).bind(role || '', nama || '', username).run();
    }
    // Kalau password admin berubah, logout semua sesi user itu (paksa login ulang)
    if(password) await env.DB.prepare(`DELETE FROM sessions WHERE username = ?`).bind(username).run();
    return jsonResp({ ok:true }, 200, request);
  }catch(e){ return jsonResp({ ok:false, error:String(e) }, 500, request); }
}
export async function onRequestDelete({ request, env }){
  try{
    await ensureTables(env.DB);
    const a = await requireAdmin(env.DB, request);
    if(a.error) return jsonResp({ ok:false, error:a.error }, a.status, request);
    const url = new URL(request.url);
    const username = cleanStr(url.searchParams.get('username') || url.searchParams.get('id') || '', 30);
    if(!username) return jsonResp({ ok:false, error:'Username wajib' }, 400, request);
    if(username === a.sess.username) return jsonResp({ ok:false, error:'Tidak bisa hapus akun sendiri' }, 400, request);
    const user = await env.DB.prepare(`SELECT * FROM users WHERE username = ?`).bind(username).first();
    if(!user) return jsonResp({ ok:false, error:'User tidak ditemukan' }, 404, request);
    if(user.role === 'admin'){
      const cnt = await env.DB.prepare(`SELECT COUNT(*) as c FROM users WHERE role = 'admin'`).first();
      if((cnt?.c || 0) <= 1) return jsonResp({ ok:false, error:'Tidak bisa hapus admin terakhir' }, 400, request);
    }
    await env.DB.prepare(`DELETE FROM users WHERE username = ?`).bind(username).run();
    await env.DB.prepare(`DELETE FROM sessions WHERE username = ?`).bind(username).run();
    return jsonResp({ ok:true }, 200, request);
  }catch(e){ return jsonResp({ ok:false, error:String(e) }, 500, request); }
}
