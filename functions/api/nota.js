// PANDAWA OCR - Nota CRUD (D1) - Pages Functions
// Semua query parameterized (.bind) - anti SQL injection.
import { jsonResp, handleOptions, cleanStr, cleanInt, ensureTables, requireAuth } from '../_lib.js';
export async function onRequestOptions({ request }){ return handleOptions(request); }
export async function onRequestGet({ request, env }){
  try{
    await ensureTables(env.DB);
    const a = await requireAuth(env.DB, request);
    if(a.error) return jsonResp({ ok:false, error:a.error }, a.status, request);
    const url = new URL(request.url);
    const id = cleanStr(url.searchParams.get('id') || '', 100);
    const limit = Math.min(500, Math.max(1, cleanInt(url.searchParams.get('limit'), 500)));
    if(id){
      const r = await env.DB.prepare(`SELECT * FROM nota WHERE id = ?`).bind(id).first();
      if(!r) return jsonResp({ ok:false, error:'Nota tidak ditemukan' }, 404, request);
      let parsed={}; try{ parsed=JSON.parse(r.data||'{}'); }catch{}
      return jsonResp({ ok:true, data:{ id:String(r.id), no_nota:r.no_nota, tanggal:r.tanggal, nama_kapal:r.nama_kapal, feature_type:r.feature_type, created_at:r.created_at, items:parsed.items||[], headers:parsed.headers||[], resiko1:parsed.resiko1||0, resiko2:parsed.resiko2||0, image_base64:parsed.image_base64||parsed.image_url||'', image_url:parsed.image_url||parsed.image_base64||'' } }, 200, request);
    }
    const { results } = await env.DB.prepare(`SELECT * FROM nota ORDER BY tanggal DESC, created_at DESC LIMIT ?`).bind(limit).all();
    const data = results.map(r=>{
      let parsed={}; try{ parsed=JSON.parse(r.data||'{}'); }catch{}
      return { id:String(r.id), no_nota:r.no_nota, tanggal:r.tanggal, nama_kapal:r.nama_kapal, feature_type:r.feature_type, created_at:r.created_at, items:parsed.items||[], headers:parsed.headers||[], resiko1:parsed.resiko1||0, resiko2:parsed.resiko2||0, image_base64:parsed.image_base64||parsed.image_url||'', image_url:parsed.image_url||parsed.image_base64||'' };
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
    const no_nota = cleanStr(b.no_nota, 100);
    const tanggal = cleanStr(b.tanggal, 20);
    const nama_kapal = cleanStr(b.nama_kapal, 100);
    const feature_type = ['STANDART','KNC_KNT_KNB','RINCIAN','OTOMATIS','GABUNGAN'].includes(b.feature_type) ? b.feature_type : 'STANDART';
    const items = Array.isArray(b.items) ? b.items.slice(0,500) : [];
    const img = cleanStr(b.image_base64 || b.image_url || '', 120000);
    const safe = JSON.stringify({ items, headers: Array.isArray(b.headers) ? b.headers.slice(0,50) : [], resiko1: Number(b.resiko1)||0, resiko2: Number(b.resiko2)||0, image_base64: img, image_url: img }).slice(0, 250000);
    await env.DB.prepare(`INSERT OR REPLACE INTO nota (id, no_nota, tanggal, nama_kapal, feature_type, data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(id, no_nota, tanggal, nama_kapal, feature_type, safe, Date.now()).run();
    return jsonResp({ ok:true, id }, 200, request);
  }catch(e){ return jsonResp({ ok:false, error:String(e) }, 500, request); }
}
export async function onRequestDelete({ request, env }){
  try{
    await ensureTables(env.DB);
    const a = await requireAuth(env.DB, request);
    if(a.error) return jsonResp({ ok:false, error:a.error }, a.status, request);
    // Hapus semua hanya Admin
    const url = new URL(request.url);
    const id = cleanStr(url.searchParams.get('id') || '', 100);
    const all = url.searchParams.get('all') === '1';
    if(all){
      if(a.sess.role !== 'admin') return jsonResp({ ok:false, error:'Hanya Admin bisa hapus semua' }, 403, request);
      await env.DB.prepare(`DELETE FROM nota`).run();
      return jsonResp({ ok:true, deleted:'all' }, 200, request);
    }
    if(!id) return jsonResp({ ok:false, error:'id wajib' }, 400, request);
    await env.DB.prepare(`DELETE FROM nota WHERE id = ?`).bind(id).run();
    return jsonResp({ ok:true, id }, 200, request);
  }catch(e){ return jsonResp({ ok:false, error:String(e) }, 500, request); }
}
