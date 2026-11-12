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
export function jsonResp(data, status=200, request=null){
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...(request ? corsHeaders(request) : {}) }
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
}
export async function getSession(DB, request){
  const auth = request.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
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
