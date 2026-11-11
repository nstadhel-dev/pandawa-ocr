// PANDAWA OCR - Settings (API Key di D1, tidak pernah ke browser) - Pages Functions
// GET: kembalikan STATUS saja (ada/tidak, jumlah key), BUKAN isi key.
// POST: simpan key (Admin saja). Key disimpan di D1, browser tidak pernah baca isinya.
import { jsonResp, handleOptions, cleanStr, ensureTables, requireAdmin, requireAuth } from '../_lib.js';
export async function onRequestOptions({ request }){ return handleOptions(request); }
export async function onRequestGet({ request, env }){
  try{
    await ensureTables(env.DB);
    const a = await requireAuth(env.DB, request);
    if(a.error) return jsonResp({ ok:false, error:a.error }, a.status, request);
    const row = await env.DB.prepare(`SELECT value FROM settings WHERE key = ?`).bind('gemini_keys').first();
    let keys = [];
    try{ keys = JSON.parse(row?.value || '[]'); }catch{ keys = []; }
    // Kembalikan STATUS saja, bukan isi key
    return jsonResp({ ok:true, hasKeys: Array.isArray(keys) && keys.length > 0, keyCount: Array.isArray(keys) ? keys.length : 0 }, 200, request);
  }catch(e){ return jsonResp({ ok:false, error:String(e) }, 500, request); }
}
export async function onRequestPost({ request, env }){
  try{
    await ensureTables(env.DB);
    const a = await requireAdmin(env.DB, request);
    if(a.error) return jsonResp({ ok:false, error:a.error }, a.status, request);
    const b = await request.json().catch(()=>({}));
    const keys = Array.isArray(b.keys) ? b.keys : [];
    // Validasi: key Gemini diawali "AIza" dan panjang wajar
    const bersih = [];
    for(const k of keys.slice(0,3)){
      const s = cleanStr(k, 100);
      if(s && s.startsWith('AIza') && s.length >= 20 && s.length <= 100) bersih.push(s);
    }
    if(!bersih.length) return jsonResp({ ok:false, error:'Tidak ada key valid (harus diawali AIza)' }, 400, request);
    await env.DB.prepare(`INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)`).bind('gemini_keys', JSON.stringify(bersih), Date.now()).run();
    return jsonResp({ ok:true, keyCount: bersih.length }, 200, request);
  }catch(e){ return jsonResp({ ok:false, error:String(e) }, 500, request); }
}
