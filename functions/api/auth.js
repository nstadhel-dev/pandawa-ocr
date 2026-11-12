// PANDAWA OCR - Auth (login/logout/me + 2FA + anti brute force) - Pages Functions
import { jsonResp, handleOptions, cleanStr, hashPassword, makeToken, makeTotpSecret, totpVerify, ensureTables, seedAdmin, getAuthToken, authCookieHeader, getSession, requireAdmin } from '../_lib.js';
export async function onRequestOptions({ request }){ return handleOptions(request); }
function getClientIp(request){
  return cleanStr(request.headers.get('CF-Connecting-IP') || (request.headers.get('X-Forwarded-For')||'').split(',')[0] || 'unknown', 60);
}
async function isLocked(DB, username, ip){
  const now = Date.now();
  const windowStart = now - 15*60*1000;
  const row1 = await DB.prepare(`SELECT COUNT(*) as c FROM login_attempts WHERE username = ? AND ip = ? AND success = 0 AND attempted_at >= ?`).bind(username, ip, windowStart).first();
  if((row1?.c||0) >= 5){
    const last = await DB.prepare(`SELECT MAX(attempted_at) as t FROM login_attempts WHERE username = ? AND ip = ? AND success = 0`).bind(username, ip).first();
    const unlockAt = (last?.t||0) + 15*60*1000;
    return { locked:true, retryAfterSec: Math.max(0, Math.ceil((unlockAt - now)/1000)) };
  }
  const row2 = await DB.prepare(`SELECT COUNT(*) as c FROM login_attempts WHERE ip = ? AND success = 0 AND attempted_at >= ?`).bind(ip, windowStart).first();
  if((row2?.c||0) >= 20){
    const last = await DB.prepare(`SELECT MAX(attempted_at) as t FROM login_attempts WHERE ip = ? AND success = 0`).bind(ip).first();
    const unlockAt = (last?.t||0) + 15*60*1000;
    return { locked:true, retryAfterSec: Math.max(0, Math.ceil((unlockAt - now)/1000)) };
  }
  return { locked:false };
}
async function recordAttempt(DB, username, ip, success){
  await DB.prepare(`INSERT INTO login_attempts (username, ip, attempted_at, success) VALUES (?, ?, ?, ?)`).bind(username, ip, Date.now(), success?1:0).run();
  await DB.prepare(`DELETE FROM login_attempts WHERE attempted_at < ?`).bind(Date.now() - 60*60*1000).run().catch(()=>{});
}
async function clearAttempts(DB, username, ip){
  await DB.prepare(`DELETE FROM login_attempts WHERE username = ? AND ip = ?`).bind(username, ip).run().catch(()=>{});
}
export async function onRequestPost({ request, env }){
  try{
    const url = new URL(request.url);
    const action = url.searchParams.get('action') || 'login';
    await ensureTables(env.DB);
    await seedAdmin(env.DB);
    const ip = getClientIp(request);
    if(action === 'login'){
      const b = await request.json().catch(()=>({}));
      const username = cleanStr(b.username, 30);
      const password = cleanStr(b.password, 100);
      if(!username || !password) return jsonResp({ ok:false, error:'Username & password wajib' }, 400, request);
      const lock = await isLocked(env.DB, username, ip);
      if(lock.locked) return jsonResp({ ok:false, error:'Terlalu banyak percobaan login gagal. Coba lagi dalam ' + Math.ceil(lock.retryAfterSec/60) + ' menit.' }, 429, request);
      const user = await env.DB.prepare(`SELECT * FROM users WHERE username = ?`).bind(username).first();
      if(!user){ await recordAttempt(env.DB, username, ip, false); return jsonResp({ ok:false, error:'Username / password salah' }, 401, request); }
      const hash = await hashPassword(password, user.salt);
      if(hash !== user.password_hash){ await recordAttempt(env.DB, username, ip, false); return jsonResp({ ok:false, error:'Username / password salah' }, 401, request); }
      await clearAttempts(env.DB, username, ip);
      if(user.totp_secret){
        const tempToken = makeToken();
        const expires = Date.now() + 5*60*1000;
        await env.DB.prepare(`DELETE FROM pending_2fa WHERE username = ?`).bind(username).run().catch(()=>{});
        await env.DB.prepare(`INSERT INTO pending_2fa (token, username, expires_at, created_at) VALUES (?, ?, ?, ?)`).bind(tempToken, username, expires, Date.now()).run();
        return jsonResp({ ok:true, need2fa:true, tempToken, user:{ username:user.username, role:user.role, nama:user.nama } }, 200, request);
      }
      const token = makeToken();
      const expires = Date.now() + 24*60*60*1000;
      await env.DB.prepare(`INSERT INTO sessions (token, username, role, expires_at, created_at) VALUES (?, ?, ?, ?, ?)`).bind(token, user.username, user.role, expires, Date.now()).run();
      return jsonResp({ ok:true, user:{ username:user.username, role:user.role, nama:user.nama } }, 200, request, { 'Set-Cookie': authCookieHeader(token, 24*60*60) });
    }
    if(action === 'login-2fa'){
      const b = await request.json().catch(()=>({}));
      const tempToken = cleanStr(b.tempToken, 100);
      const code = cleanStr(b.code, 10);
      if(!tempToken || !code) return jsonResp({ ok:false, error:'Token & kode 2FA wajib' }, 400, request);
      const pend = await env.DB.prepare(`SELECT * FROM pending_2fa WHERE token = ?`).bind(tempToken).first();
      if(!pend) return jsonResp({ ok:false, error:'Sesi 2FA tidak valid / sudah kedaluwarsa. Login ulang.' }, 401, request);
      if(Date.now() > (pend.expires_at||0)){
        await env.DB.prepare(`DELETE FROM pending_2fa WHERE token = ?`).bind(tempToken).run();
        return jsonResp({ ok:false, error:'Kode 2FA kedaluwarsa (5 menit). Login ulang.' }, 401, request);
      }
      const user = await env.DB.prepare(`SELECT * FROM users WHERE username = ?`).bind(pend.username).first();
      if(!user || !user.totp_secret){
        await env.DB.prepare(`DELETE FROM pending_2fa WHERE token = ?`).bind(tempToken).run();
        return jsonResp({ ok:false, error:'2FA tidak aktif untuk user ini.' }, 401, request);
      }
      const okCode = await totpVerify(user.totp_secret, code);
      if(!okCode){
        await recordAttempt(env.DB, pend.username, ip, false);
        const lock = await isLocked(env.DB, pend.username, ip);
        if(lock.locked){
          await env.DB.prepare(`DELETE FROM pending_2fa WHERE token = ?`).bind(tempToken).run();
          return jsonResp({ ok:false, error:'Terlalu banyak kode 2FA salah. Coba lagi dalam ' + Math.ceil(lock.retryAfterSec/60) + ' menit.' }, 429, request);
        }
        return jsonResp({ ok:false, error:'Kode 2FA salah. Cek kode di Google Authenticator (berubah tiap 30 detik).' }, 401, request);
      }
      await env.DB.prepare(`DELETE FROM pending_2fa WHERE token = ?`).bind(tempToken).run();
      await clearAttempts(env.DB, pend.username, ip);
      const token = makeToken();
      const expires = Date.now() + 24*60*60*1000;
      await env.DB.prepare(`INSERT INTO sessions (token, username, role, expires_at, created_at) VALUES (?, ?, ?, ?, ?)`).bind(token, user.username, user.role, expires, Date.now()).run();
      return jsonResp({ ok:true, user:{ username:user.username, role:user.role, nama:user.nama } }, 200, request, { 'Set-Cookie': authCookieHeader(token, 24*60*60) });
    }
    if(action === 'setup-2fa'){
      const a = await requireAdmin(env.DB, request);
      if(a.error) return jsonResp({ ok:false, error:a.error }, a.status, request);
      const b = await request.json().catch(()=>({}));
      const target = cleanStr(b.username, 30);
      if(!target) return jsonResp({ ok:false, error:'Username wajib' }, 400, request);
      const user = await env.DB.prepare(`SELECT * FROM users WHERE username = ?`).bind(target).first();
      if(!user) return jsonResp({ ok:false, error:'User tidak ditemukan' }, 404, request);
      const secret = makeTotpSecret();
      await env.DB.prepare(`UPDATE users SET pending_totp_secret = ? WHERE username = ?`).bind(secret, target).run();
      const otpauth = 'otpauth://totp/PANDAWA%20OCR:' + encodeURIComponent(target) + '?secret=' + secret + '&issuer=PANDAWA%20OCR';
      return jsonResp({ ok:true, secret, otpauth, username: target }, 200, request);
    }
    if(action === 'confirm-2fa'){
      const a = await requireAdmin(env.DB, request);
      if(a.error) return jsonResp({ ok:false, error:a.error }, a.status, request);
      const b = await request.json().catch(()=>({}));
      const target = cleanStr(b.username, 30);
      const code = cleanStr(b.code, 10);
      if(!target || !code) return jsonResp({ ok:false, error:'Username & kode wajib' }, 400, request);
      const user = await env.DB.prepare(`SELECT * FROM users WHERE username = ?`).bind(target).first();
      if(!user || !user.pending_totp_secret) return jsonResp({ ok:false, error:'Belum ada kode 2FA yang dibuat. Klik "Buat Kode 2FA" dulu.' }, 400, request);
      const okCode = await totpVerify(user.pending_totp_secret, code);
      if(!okCode) return jsonResp({ ok:false, error:'Kode 2FA salah. Pastikan kode dari Google Authenticator benar (berubah tiap 30 detik).' }, 401, request);
      await env.DB.prepare(`UPDATE users SET totp_secret = ?, pending_totp_secret = NULL WHERE username = ?`).bind(user.pending_totp_secret, target).run();
      return jsonResp({ ok:true, message:'2FA aktif untuk ' + target }, 200, request);
    }
    if(action === 'disable-2fa'){
      const a = await requireAdmin(env.DB, request);
      if(a.error) return jsonResp({ ok:false, error:a.error }, a.status, request);
      const b = await request.json().catch(()=>({}));
      const target = cleanStr(b.username, 30);
      if(!target) return jsonResp({ ok:false, error:'Username wajib' }, 400, request);
      await env.DB.prepare(`UPDATE users SET totp_secret = NULL, pending_totp_secret = NULL WHERE username = ?`).bind(target).run();
      return jsonResp({ ok:true, message:'2FA dinonaktifkan untuk ' + target }, 200, request);
    }
    if(action === 'logout'){
      const token = getAuthToken(request);
      if(token) await env.DB.prepare(`DELETE FROM sessions WHERE token = ?`).bind(token).run();
      return jsonResp({ ok:true }, 200, request, { 'Set-Cookie': authCookieHeader('', 0) });
    }
    return jsonResp({ ok:false, error:'action tidak dikenal' }, 400, request);
  }catch(e){ return jsonResp({ ok:false, error:String(e) }, 500, request); }
}
export async function onRequestGet({ request, env }){
  try{
    await ensureTables(env.DB);
    const url = new URL(request.url);
    const action = url.searchParams.get('action') || '';
    if(action === '2fa-status'){
      const a = await requireAdmin(env.DB, request);
      if(a.error) return jsonResp({ ok:false, error:a.error }, a.status, request);
      const username = cleanStr(url.searchParams.get('username')||'', 30);
      const user = await env.DB.prepare(`SELECT totp_secret FROM users WHERE username = ?`).bind(username).first();
      return jsonResp({ ok:true, username, has2fa: !!(user && user.totp_secret) }, 200, request);
    }
    const sess = await getSession(env.DB, request);
    if(!sess) return jsonResp({ ok:false, error:'Sesi habis, login lagi' }, 401, request);
    return jsonResp({ ok:true, user:{ username:sess.username, role:sess.role } }, 200, request);
  }catch(e){ return jsonResp({ ok:false, error:String(e) }, 500, request); }
}
