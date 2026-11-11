// PANDAWA OCR - Gabungan CRUD (D1) - Pages Functions
import { jsonResp, handleOptions, cleanStr, ensureTables, requireAuth } from '../_lib.js';
export async function onRequestOptions({ request }){ return handleOptions(request); }
export async function onRequestGet({ request, env }){
  try{
    await ensureTables(env.DB);
    const a = await requireAuth(env.DB, request);
    if(a.error) return jsonResp({ ok:false, error:a.error }, a.status, request);
    const { results } = await env.DB.prepare(`SELECT id, data, created_at FROM gabungan ORDER BY created_at DESC LIMIT 500`).all();
    const data = results.map(r=>{
      try{ const e=JSON.parse(r.data||'{}'); e.id=String(e.id||r.id); return e; }catch{ return { id:String(r.id) }; }
    });
    return jsonResp({ ok:true, data }, 200, request);
  }catch(e){ return jsonResp({ ok:false, error:String(e) }, 500, request); }
}
export async function onRequestPost({ request, env }){
  try{
    await ensureTables(env.DB);
    const a = await requireAuth(env.DB, request);
    if(a.error) return jsonResp({ ok:false, error:a.error }, a.status, request);
    const b = await request.json().catch(()=>({}));
    const id = cleanStr(b.id || (Date.now()+'-'+Math.random().toString(36).slice(2)), 100);
    const entry = {
      id,
      tanggalSimpan: cleanStr(b.tanggalSimpan || new Date().toISOString().slice(0,10), 20),
      fitur: cleanStr(b.fitur || '', 50),
      no_nota: cleanStr(b.no_nota || '', 100),
      tanggalNota: cleanStr(b.tanggalNota || '', 30),
      nama_kapal: cleanStr(b.nama_kapal || '', 100),
      jumlahNota: Number(b.jumlahNota)||0,
      jumlahBaris: Number(b.jumlahBaris)||0,
      headers: Array.isArray(b.headers) ? b.headers.slice(0,50) : [],
      items: Array.isArray(b.items) ? b.items.slice(0,500) : [],
      _gabungSumber: Array.isArray(b._gabungSumber) ? b._gabungSumber.slice(0,200) : [],
      _gabungDari: Array.isArray(b._gabungDari) ? b._gabungDari.slice(0,200) : []
    };
    const safe = JSON.stringify(entry).slice(0, 600000);
    await env.DB.prepare(`INSERT OR REPLACE INTO gabungan (id, data, created_at) VALUES (?, ?, ?)`).bind(id, safe, Date.now()).run();
    return jsonResp({ ok:true, id }, 200, request);
  }catch(e){ return jsonResp({ ok:false, error:String(e) }, 500, request); }
}
export async function onRequestDelete({ request, env }){
  try{
    await ensureTables(env.DB);
    const a = await requireAuth(env.DB, request);
    if(a.error) return jsonResp({ ok:false, error:a.error }, a.status, request);
    const url = new URL(request.url);
    const id = cleanStr(url.searchParams.get('id') || '', 100);
    if(!id) return jsonResp({ ok:false, error:'id wajib' }, 400, request);
    await env.DB.prepare(`DELETE FROM gabungan WHERE id = ?`).bind(id).run();
    return jsonResp({ ok:true, id }, 200, request);
  }catch(e){ return jsonResp({ ok:false, error:String(e) }, 500, request); }
}
