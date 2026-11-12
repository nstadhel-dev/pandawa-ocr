// PANDAWA OCR - Gemini Proxy (Key TIDAK PERNAH ke browser) - Pages Functions
// Browser kirim: { image_base64, prompt, model }. Server ambil key dari D1, panggil Gemini, kembalikan hasil.
// Key tidak pernah dikirim ke browser, tidak bisa dicuri via DevTools / View Source / copas.
import { jsonResp, handleOptions, cleanStr, ensureTables, requireAuth } from '../_lib.js';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/';
export async function onRequestOptions({ request }){ return handleOptions(request); }
export async function onRequestPost({ request, env }){
  try{
    await ensureTables(env.DB);
    const a = await requireAuth(env.DB, request);
    if(a.error) return jsonResp({ ok:false, error:a.error }, a.status, request);
    const b = await request.json().catch(()=>({}));
    const image = cleanStr(b.image_base64 || '', 2000000); // base64 foto (tanpa prefix data:)
    const prompt = cleanStr(b.prompt || '', 10000);
    let model = cleanStr(b.model || 'gemini-3.8-flash', 50);
    // Whitelist model (cegah SSRF / model aneh)
    const allowedModels = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-3-flash', 'gemini-3-pro'];
    if(!allowedModels.includes(model)) model = 'gemini-3.8-flash';
    if(!image) return jsonResp({ ok:false, error:'image_base64 wajib' }, 400, request);
    if(!prompt) return jsonResp({ ok:false, error:'prompt wajib' }, 400, request);
    // Ambil key dari D1 (atau env GEMINI_API_KEY jika diset)
    let keys = [];
    if(env.GEMINI_API_KEY) keys = [String(env.GEMINI_API_KEY)];
    else {
      const row = await env.DB.prepare(`SELECT value FROM settings WHERE key = ?`).bind('gemini_keys').first();
      try{ keys = JSON.parse(row?.value || '[]'); }catch{ keys = []; }
    }
    if(!Array.isArray(keys) || !keys.length) return jsonResp({ ok:false, error:'Gemini API Key belum diset (Admin: Kelola User > Set Key)' }, 400, request);
    // Coba key satu per satu (auto-fallback kalau quota habis)
    let lastErr = '';
    for(const key of keys.slice(0,3)){
      try{
        const res = await fetch(GEMINI_URL + model + ':generateContent?key=' + encodeURIComponent(key), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [ { text: prompt }, { inline_data: { mime_type: 'image/jpeg', data: image } } ] }],
            generationConfig: { temperature: 0, maxOutputTokens: 8192 }
          })
        });
        const j = await res.json().catch(()=>({}));
        if(!res.ok){
          lastErr = (j?.error?.message || 'HTTP ' + res.status);
          continue; // coba key berikutnya
        }
        const text = j?.candidates?.[0]?.content?.parts?.map(p=>p.text || '').join('') || '';
        if(!text) { lastErr = 'Gemini tidak kembalikan teks'; continue; }
        return jsonResp({ ok:true, text, model }, 200, request);
      }catch(e){ lastErr = String(e); continue; }
    }
    return jsonResp({ ok:false, error:'Gemini gagal (semua key): ' + lastErr }, 502, request);
  }catch(e){ return jsonResp({ ok:false, error:String(e) }, 500, request); }
}
