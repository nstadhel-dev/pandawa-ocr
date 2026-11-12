// PANDAWA OCR - Storage D1: Backup, Stats, Restore, Hapus isi tabel (Admin saja)
import { jsonResp, handleOptions, cleanStr, ensureTables, requireAdmin, requireAuth } from '../_lib.js';
export async function onRequestOptions({ request }){ return handleOptions(request); }
const LIMIT_BYTES = 5 * 1024 * 1024 * 1024;
export async function onRequestGet({ request, env }){
  try{
    await ensureTables(env.DB);
    const url = new URL(request.url);
    const action = url.searchParams.get('action') || 'stats';
    if(action === 'backup'){
      const a = await requireAdmin(env.DB, request);
      if(a.error) return jsonResp({ ok:false, error:a.error }, a.status, request);
      const nota = await env.DB.prepare(`SELECT id, no_nota, tanggal, nama_kapal, feature_type, data, created_at FROM nota ORDER BY created_at ASC`).all();
      const gabungan = await env.DB.prepare(`SELECT id, data, created_at FROM gabungan ORDER BY created_at ASC`).all();
      const users = await env.DB.prepare(`SELECT username, password_hash, salt, role, nama, created_at FROM users ORDER BY created_at ASC`).all();
      const settings = await env.DB.prepare(`SELECT key, value, updated_at FROM settings ORDER BY key ASC`).all();
      return jsonResp({ ok:true, app:'PANDAWA OCR', type:'PANDAWA_D1_BACKUP', version:1, backupAt:new Date().toISOString(),
        counts:{ nota: nota.results.length, gabungan: gabungan.results.length, users: users.results.length, settings: settings.results.length },
        tables:{ nota: nota.results, gabungan: gabungan.results, users: users.results, settings: settings.results } }, 200, request);
    }
    const a2 = await requireAuth(env.DB, request);
    if(a2.error) return jsonResp({ ok:false, error:a2.error }, a2.status, request);
    const notaStat = await env.DB.prepare(`SELECT COUNT(*) as c, COALESCE(SUM(LENGTH(data)),0) as bytes, COALESCE(SUM(LENGTH(no_nota)+LENGTH(tanggal)+LENGTH(nama_kapal)+LENGTH(feature_type)),0) as meta FROM nota`).first();
    const gabStat = await env.DB.prepare(`SELECT COUNT(*) as c, COALESCE(SUM(LENGTH(data)),0) as bytes FROM gabungan`).first();
    const userStat = await env.DB.prepare(`SELECT COUNT(*) as c, COALESCE(SUM(LENGTH(username)+LENGTH(password_hash)+LENGTH(salt)+LENGTH(role)+LENGTH(nama)),0) as bytes FROM users`).first();
    const setStat = await env.DB.prepare(`SELECT COUNT(*) as c, COALESCE(SUM(LENGTH(key)+LENGTH(value)),0) as bytes FROM settings`).first();
    const sessStat = await env.DB.prepare(`SELECT COUNT(*) as c, COALESCE(SUM(LENGTH(token)+LENGTH(username)+LENGTH(role)),0) as bytes FROM sessions`).first();
    const notaBytes = (notaStat?.bytes||0) + (notaStat?.meta||0) + (notaStat?.c||0)*300;
    const totalUsed = notaBytes + (gabStat?.bytes||0) + (userStat?.bytes||0) + (setStat?.bytes||0) + (sessStat?.bytes||0);
    const pct = Math.min(100, (totalUsed / LIMIT_BYTES) * 100);
    const biggest = await env.DB.prepare(`SELECT id, no_nota, tanggal, nama_kapal, feature_type, LENGTH(data) as bytes FROM nota ORDER BY bytes DESC LIMIT 5`).all();
    const smallest = await env.DB.prepare(`SELECT id, no_nota, tanggal, nama_kapal, feature_type, LENGTH(data) as bytes FROM nota ORDER BY bytes ASC LIMIT 5`).all();
    return jsonResp({ ok:true, d1:{
      totalUsed, limitBytes: LIMIT_BYTES, remainingBytes: Math.max(0, LIMIT_BYTES - totalUsed), pctUsed: Math.round(pct*100)/100,
      hampirPenuh: pct >= 80, penuh: pct >= 95,
      tables:[
        { name:'nota', label:'Arsip Nota', count: notaStat?.c||0, bytes: notaBytes },
        { name:'gabungan', label:'Data Gabungan', count: gabStat?.c||0, bytes: gabStat?.bytes||0 },
        { name:'users', label:'User', count: userStat?.c||0, bytes: userStat?.bytes||0 },
        { name:'settings', label:'Pengaturan', count: setStat?.c||0, bytes: setStat?.bytes||0 },
        { name:'sessions', label:'Sesi Login', count: sessStat?.c||0, bytes: sessStat?.bytes||0 }
      ],
      biggest: biggest.results || [], smallest: smallest.results || []
    } }, 200, request);
  }catch(e){ return jsonResp({ ok:false, error:String(e) }, 500, request); }
}
export async function onRequestPost({ request, env }){
  try{
    await ensureTables(env.DB);
    const url = new URL(request.url);
    const action = url.searchParams.get('action') || '';
    if(action !== 'restore') return jsonResp({ ok:false, error:'action tidak dikenal' }, 400, request);
    const a = await requireAdmin(env.DB, request);
    if(a.error) return jsonResp({ ok:false, error:a.error }, a.status, request);
    const b = await request.json().catch(()=>({}));
    if(b.type !== 'PANDAWA_D1_BACKUP' || !b.tables || typeof b.tables !== 'object') return jsonResp({ ok:false, error:'File bukan backup PANDAWA D1 (type tidak cocok)' }, 400, request);
    const t = b.tables;
    const stmts = [];
    if(Array.isArray(t.nota)){
      stmts.push(env.DB.prepare(`DELETE FROM nota`));
      for(const r of t.nota.slice(0, 2000)){
        stmts.push(env.DB.prepare(`INSERT OR REPLACE INTO nota (id, no_nota, tanggal, nama_kapal, feature_type, data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(
          cleanStr(r.id||'',100), cleanStr(r.no_nota||'',100), cleanStr(r.tanggal||'',20), cleanStr(r.nama_kapal||'',100), cleanStr(r.feature_type||'STANDART',50), String(r.data||''), Number(r.created_at)||Date.now()));
      }
    }
    if(Array.isArray(t.gabungan)){
      stmts.push(env.DB.prepare(`DELETE FROM gabungan`));
      for(const r of t.gabungan.slice(0, 1000)){
        stmts.push(env.DB.prepare(`INSERT OR REPLACE INTO gabungan (id, data, created_at) VALUES (?, ?, ?)`).bind(cleanStr(r.id||'',100), String(r.data||''), Number(r.created_at)||Date.now()));
      }
    }
    if(Array.isArray(t.users)){
      stmts.push(env.DB.prepare(`DELETE FROM users`));
      for(const r of t.users.slice(0, 500)){
        stmts.push(env.DB.prepare(`INSERT OR REPLACE INTO users (username, password_hash, salt, role, nama, created_at) VALUES (?, ?, ?, ?, ?, ?)`).bind(
          cleanStr(r.username||'',30), String(r.password_hash||''), String(r.salt||''), cleanStr(r.role||'user',10), cleanStr(r.nama||'',100), Number(r.created_at)||Date.now()));
      }
    }
    if(Array.isArray(t.settings)){
      stmts.push(env.DB.prepare(`DELETE FROM settings`));
      for(const r of t.settings.slice(0, 500)){
        stmts.push(env.DB.prepare(`INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)`).bind(cleanStr(r.key||'',100), String(r.value||''), Number(r.updated_at)||Date.now()));
      }
    }
    if(!stmts.length) return jsonResp({ ok:false, error:'Backup kosong, tidak ada tabel yang direstore' }, 400, request);
    for(let i=0;i<stmts.length;i+=500){ await env.DB.batch(stmts.slice(i, i+500)); }
    await env.DB.prepare(`DELETE FROM sessions`).run();
    return jsonResp({ ok:true, restored:{ nota: Array.isArray(t.nota)?t.nota.length:0, gabungan: Array.isArray(t.gabungan)?t.gabungan.length:0, users: Array.isArray(t.users)?t.users.length:0, settings: Array.isArray(t.settings)?t.settings.length:0 } }, 200, request);
  }catch(e){ return jsonResp({ ok:false, error:String(e) }, 500, request); }
}
export async function onRequestDelete({ request, env }){
  try{
    await ensureTables(env.DB);
    const a = await requireAdmin(env.DB, request);
    if(a.error) return jsonResp({ ok:false, error:a.error }, a.status, request);
    const url = new URL(request.url);
    const table = cleanStr(url.searchParams.get('table') || '', 30);
    const allowed = ['nota','gabungan','sessions','settings'];
    if(!allowed.includes(table)) return jsonResp({ ok:false, error:'Tabel tidak bisa dihapus (hanya: nota, gabungan, sessions, settings). User dihapus satu per satu di Daftar User.' }, 400, request);
    const cnt = await env.DB.prepare(`SELECT COUNT(*) as c FROM ${table}`).first();
    await env.DB.prepare(`DELETE FROM ${table}`).run();
    return jsonResp({ ok:true, table, deleted: cnt?.c||0 }, 200, request);
  }catch(e){ return jsonResp({ ok:false, error:String(e) }, 500, request); }
}
