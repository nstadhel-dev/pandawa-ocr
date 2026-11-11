// PANDAWA OCR - Storage info (D1) - Pages Functions
import { jsonResp, handleOptions, ensureTables, requireAuth } from '../_lib.js';
export async function onRequestOptions({ request }){ return handleOptions(request); }
export async function onRequestGet({ request, env }){
  try{
    await ensureTables(env.DB);
    const a = await requireAuth(env.DB, request);
    if(a.error) return jsonResp({ ok:false, error:a.error }, a.status, request);
    const cnt = await env.DB.prepare(`SELECT COUNT(*) as c FROM nota`).first();
    const { results } = await env.DB.prepare(`SELECT data FROM nota LIMIT 500`).all();
    let estBytes = 0; let itemCount = 0;
    for(const r of results){
      const s = String(r.data || '');
      estBytes += new Blob([s]).size;
      try{ const p = JSON.parse(s); if(Array.isArray(p.items)) itemCount += p.items.length; }catch{}
    }
    // Estimasi total (data + metadata kolom)
    estBytes += (cnt?.c || 0) * 300;
    const LIMIT = 5 * 1024 * 1024 * 1024; // 5 GB
    return jsonResp({ ok:true, d1:{ count: cnt?.c || 0, itemCount, estBytes, limitBytes: LIMIT, remainingBytes: Math.max(0, LIMIT - estBytes) } }, 200, request);
  }catch(e){ return jsonResp({ ok:false, error:String(e) }, 500, request); }
}
