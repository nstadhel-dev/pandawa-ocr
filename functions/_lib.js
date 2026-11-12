// PANDAWA OCR - Shared lib untuk Pages Functions (BUKAN worker.js)
// File ini tidak di-routing (awalan _), hanya di-import oleh functions/api/*.js
export function corsHeaders(request){
  const origin = request.headers.get('Origin') || '';
  const allowed = origin === '' || origin.endsWith('.pages.dev') || origin.includes('pandawa');
  return {
    'Access-Control-Allow-Origin': allowed ? (origin || '*') : 'null',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}
export function jsonResp(data, status=200, request=null, extraHeaders={}){
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...(request ? corsHeaders(request) : {}), ...extraHeaders }
  });
}
export function handleOptions(request){
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}
export function cleanStr(v, maxLen=500){
  if(v === null || v === undefined) return '';
  let s = String(v).slice(0, maxLen);
  s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  return s.trim();
}
export function cleanInt(v, def=0){
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : def;
}
export function isValidUsername(u){
  return /^[a-zA-Z0-9_.-]{3,30}$/.test(u);
}
export function isValidRole(r){
  return r === 'admin' || r === 'user';
}
export async function hashPassword(password, salt){
  const enc = new TextEncoder();
  const data = enc.encode(salt + ':' + password);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}
export function makeSalt(){
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b=>b.toString(16).padStart(2,'0')).join('');
}
export function makeToken(){
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b=>b.toString(16).padStart(2,'0')).join('');
}
export async function ensureTables(DB){
  await DB.prepare(`CREATE TABLE IF NOT EXISTS nota (id TEXT PRIMARY KEY, no_nota TEXT, tanggal TEXT, nama_kapal TEXT, feature_type TEXT, data TEXT, created_at INTEGER)`).run();
  await DB.prepare(`CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY, password_hash TEXT, salt TEXT, role TEXT, nama TEXT, created_at INTEGER)`).run();
  await DB.prepare(`CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, username TEXT, role TEXT, expires_at INTEGER, created_at INTEGER)`).run();
  await DB.prepare(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT, updated_at INTEGER)`).run();
  await DB.prepare(`CREATE TABLE IF NOT EXISTS gabungan (id TEXT PRIMARY KEY, data TEXT, created_at INTEGER)`).run();
  await DB.prepare(`CREATE TABLE IF NOT EXISTS login_attempts (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT, ip TEXT, attempted_at INTEGER, success INTEGER DEFAULT 0)`).run();
  await DB.prepare(`CREATE TABLE IF NOT EXISTS pending_2fa (token TEXT PRIMARY KEY, username TEXT, expires_at INTEGER, created_at INTEGER)`).run();
  try{ await DB.prepare(`ALTER TABLE users ADD COLUMN totp_secret TEXT`).run(); }catch{}
  try{ await DB.prepare(`ALTER TABLE users ADD COLUMN pending_totp_secret TEXT`).run(); }catch{}
}
export async function getSession(DB, request){
  const token = getAuthToken(request);
  if(!token) return null;
  const row = await DB.prepare(`SELECT * FROM sessions WHERE token = ?`).bind(token).first();
  if(!row) return null;
  if(Date.now() > (row.expires_at || 0)){
    await DB.prepare(`DELETE FROM sessions WHERE token = ?`).bind(token).run();
    return null;
  }
  return { username: row.username, role: row.role, token };
}
export async function requireAuth(DB, request){
  const sess = await getSession(DB, request);
  if(!sess) return { error: 'Unauthorized - login dulu', status: 401 };
  return { sess };
}
export async function requireAdmin(DB, request){
  const r = await requireAuth(DB, request);
  if(r.error) return r;
  if(r.sess.role !== 'admin') return { error: 'Forbidden - hanya Admin', status: 403 };
  return r;
}
export async function seedAdmin(DB){
  const row = await DB.prepare(`SELECT COUNT(*) as c FROM users`).first();
  if((row?.c || 0) > 0) return;
  const salt = makeSalt();
  const hash = await hashPassword('12345', salt);
  await DB.prepare(`INSERT INTO users (username, password_hash, salt, role, nama, created_at) VALUES (?, ?, ?, ?, ?, ?)`).bind('admin', hash, salt, 'admin', 'Administrator', Date.now()).run();
}

// ===== KEAMANAN: Cookie HttpOnly + TOTP (2FA) =====
export function parseCookies(request){
  const out = {};
  const raw = request.headers.get('Cookie') || '';
  raw.split(';').forEach(part=>{
    const idx = part.indexOf('=');
    if(idx > 0){
      const k = part.slice(0, idx).trim();
      const v = part.slice(idx+1).trim();
      if(k) out[k] = decodeURIComponent(v);
    }
  });
  return out;
}
export function getAuthToken(request){
  const auth = request.headers.get('Authorization') || '';
  if(auth.startsWith('Bearer ') && auth.slice(7).trim()) return auth.slice(7).trim();
  const cookies = parseCookies(request);
  return cookies['PANDAWA_TOKEN'] || '';
}
export function authCookieHeader(token, maxAgeSec){
  const parts = ['PANDAWA_TOKEN=' + encodeURIComponent(token), 'Path=/', 'HttpOnly', 'SameSite=Lax'];
  if(maxAgeSec > 0) parts.push('Max-Age=' + maxAgeSec);
  else parts.push('Max-Age=0');
  parts.push('Secure');
  return parts.join('; ');
}
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function base32Decode(str){
  const clean = String(str||'').toUpperCase().replace(/[^A-Z2-7]/g,'');
  let bits = 0, val = 0;
  const out = [];
  for(const ch of clean){
    val = (val << 5) | B32.indexOf(ch);
    bits += 5;
    if(bits >= 8){ bits -= 8; out.push((val >> bits) & 0xFF); }
  }
  return new Uint8Array(out);
}
export function makeTotpSecret(){
  const arr = new Uint8Array(20);
  crypto.getRandomValues(arr);
  let bits = 0, val = 0, out = '';
  for(const b of arr){
    val = (val << 8) | b;
    bits += 8;
    while(bits >= 5){ bits -= 5; out += B32[(val >> bits) & 31]; }
  }
  if(bits > 0) out += B32[(val << (5 - bits)) & 31];
  return out;
}
export async function totpVerify(secret, code, windowSteps=1){
  const codeStr = String(code||'').replace(/\D/g,'');
  if(!/^\d{6}$/.test(codeStr)) return false;
  try{
    const keyBytes = base32Decode(secret);
    const key = await crypto.subtle.importKey('raw', keyBytes, { name:'HMAC', hash:'SHA-1' }, false, ['sign']);
    const nowStep = Math.floor(Date.now()/1000/30);
    for(let w=-windowSteps; w<=windowSteps; w++){
      const counter = nowStep + w;
      const buf = new ArrayBuffer(8);
      const view = new DataView(buf);
      view.setUint32(0, Math.floor(counter / 4294967296));
      view.setUint32(4, counter >>> 0);
      const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, buf));
      const offset = sig[sig.length-1] & 0x0F;
      const bin = ((sig[offset] & 0x7F) << 24) | (sig[offset+1] << 16) | (sig[offset+2] << 8) | sig[offset+3];
      const otp = String(bin % 1000000).padStart(6, '0');
      if(otp === codeStr) return true;
    }
    return false;
  }catch{ return false; }
}
