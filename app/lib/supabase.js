const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_KEY;

async function sb(path, method = "GET", body = null) {
  const opts = {
    method,
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Prefer": method === "POST" ? "return=representation" : "return=representation",
    },
  };
  if (body) opts.body = JSON.stringify(body);
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, opts);
    const text = await res.text();
    if (!res.ok) { console.error("SB error:", method, path, res.status, text); return null; }
    return text ? JSON.parse(text) : [];
  } catch (e) { console.error("SB fetch error:", e); return null; }
}

export function getUserId() {
  if (typeof window === "undefined") return "server";
  let uid = localStorage.getItem("user_id");
  if (!uid) { uid = "u_" + Math.random().toString(36).slice(2) + Date.now(); localStorage.setItem("user_id", uid); }
  return uid;
}

// ── CHAT SESSIONS ──────────────────────────────────────────────────────────
export async function getSessions(userId) {
  return await sb(`chat_sessions?user_id=eq.${userId}&order=updated_at.desc&limit=20`) || [];
}
export async function upsertSession(userId, session) {
  return await sb("chat_sessions", "POST", {
    id: session.id, user_id: userId, title: session.title,
    messages: session.messages, updated_at: new Date().toISOString()
  });
}
export async function patchSession(userId, sessionId, data) {
  return await sb(`chat_sessions?user_id=eq.${userId}&id=eq.${sessionId}`, "PATCH", data);
}
export async function deleteSession(userId, sessionId) {
  return await sb(`chat_sessions?user_id=eq.${userId}&id=eq.${sessionId}`, "DELETE");
}

// ── MEMORY ─────────────────────────────────────────────────────────────────
export async function getMemory(userId) {
  return await sb(`memory?user_id=eq.${userId}&order=created_at.desc&limit=50`) || [];
}
export async function addMemory(userId, content, tip = "conversatie") {
  return await sb("memory", "POST", { user_id: userId, content, tip, rezolvat: false });
}

// ── JURNAL ─────────────────────────────────────────────────────────────────
export async function getJurnalZi(userId, data) {
  return await sb(`jurnal?user_id=eq.${userId}&data=eq.${data}&order=tip_masa.asc`) || [];
}
export async function getJurnalRecent(userId) {
  return await sb(`jurnal?user_id=eq.${userId}&order=updated_at.desc&limit=30`) || [];
}
export async function getJurnalStats(userId) {
  const all = await sb(`jurnal?user_id=eq.${userId}&order=data.asc`) || [];
  if (!all.length) return null;
  const zile = [...new Set(all.map(j => j.data))];
  const totalCal = all.reduce((s, j) => s + (parseFloat(j.calorii) || 0), 0);
  const totalSare = all.reduce((s, j) => s + (parseFloat(j.sare) || 0), 0);
  return { zileCuJurnal: zile.length, totalMese: all.length, medieCalorii: zile.length ? Math.round(totalCal / zile.length) : 0, medieSare: all.length ? (totalSare / all.length).toFixed(1) : 0 };
}
export async function upsertJurnal(userId, entry) {
  // Try PATCH first
  const existing = await sb(`jurnal?user_id=eq.${userId}&data=eq.${entry.data}&tip_masa=eq.${entry.tip_masa}`);
  if (existing && existing.length > 0) {
    const result = await sb(`jurnal?user_id=eq.${userId}&data=eq.${entry.data}&tip_masa=eq.${entry.tip_masa}`, "PATCH", {
      messages: entry.messages, item: entry.item || entry.tip_masa,
      calorii: entry.calorii || 0, proteine: entry.proteine || 0,
      carbohidrati: entry.carbohidrati || 0, zaharuri: entry.zaharuri || 0,
      grasimi: entry.grasimi || 0, sare: entry.sare || 0,
      apa_ml: entry.apa_ml || 0, analiza: entry.analiza || null,
      updated_at: new Date().toISOString(),
    });
    return result;
  } else {
    const result = await sb("jurnal", "POST", {
      user_id: userId, data: entry.data, tip_masa: entry.tip_masa,
      item: entry.item || entry.tip_masa, messages: entry.messages || [],
      calorii: entry.calorii || 0, proteine: entry.proteine || 0,
      carbohidrati: entry.carbohidrati || 0, zaharuri: entry.zaharuri || 0,
      grasimi: entry.grasimi || 0, sare: entry.sare || 0,
      apa_ml: entry.apa_ml || 0, analiza: entry.analiza || null,
    });
    return result;
  }
}
export async function deleteJurnalEntry(userId, data, tipMasa) {
  return await sb(`jurnal?user_id=eq.${userId}&data=eq.${data}&tip_masa=eq.${tipMasa}`, "DELETE");
}

// ── SAPTAMANA CHAT ──────────────────────────────────────────────────────────
export async function getSaptamanaChat(userId) {
  const result = await sb(`saptamana_chat?user_id=eq.${userId}`);
  return result?.length > 0 ? result[0] : null;
}
export async function upsertSaptamanaChat(userId, messages) {
  const existing = await sb(`saptamana_chat?user_id=eq.${userId}`);
  if (existing?.length > 0) {
    return await sb(`saptamana_chat?user_id=eq.${userId}`, "PATCH", { messages, updated_at: new Date().toISOString() });
  } else {
    return await sb("saptamana_chat", "POST", { user_id: userId, messages });
  }
}

// ── PROGRES ────────────────────────────────────────────────────────────────
export async function getProgres(userId) {
  return await sb(`progres?user_id=eq.${userId}&order=data.asc`) || [];
}
export async function upsertProgres(userId, item) {
  const existing = await sb(`progres?user_id=eq.${userId}&data=eq.${item.data}`);
  if (existing?.length > 0) {
    return await sb(`progres?user_id=eq.${userId}&data=eq.${item.data}`, "PATCH", { greutate: item.greutate, abdomen: item.abdomen });
  } else {
    return await sb("progres", "POST", { user_id: userId, data: item.data, greutate: item.greutate, abdomen: item.abdomen });
  }
}
export async function deleteProgres(userId, id) {
  return await sb(`progres?user_id=eq.${userId}&id=eq.${id}`, "DELETE");
}

// ── PROFIL ─────────────────────────────────────────────────────────────────
export async function getProfil(userId) {
  const data = await sb(`profil?user_id=eq.${userId}`);
  return data?.length > 0 ? data[0].date : null;
}
export async function saveProfil(userId, date) {
  const existing = await sb(`profil?user_id=eq.${userId}`);
  if (existing?.length > 0) {
    return await sb(`profil?user_id=eq.${userId}`, "PATCH", { date, updated_at: new Date().toISOString() });
  } else {
    return await sb("profil", "POST", { user_id: userId, date });
  }
}

// ── FAVORITE ───────────────────────────────────────────────────────────────
export async function getFavorite(userId) {
  return await sb(`favorite?user_id=eq.${userId}&order=created_at.desc`) || [];
}
export async function addFavorit(userId, item) {
  return await sb("favorite", "POST", { user_id: userId, title: item.title, content: item.content });
}
export async function deleteFavorit(userId, id) {
  return await sb(`favorite?user_id=eq.${userId}&id=eq.${id}`, "DELETE");
}

// ── RETETE ─────────────────────────────────────────────────────────────────
export async function getRetete(userId) {
  return await sb(`retete_proprii?user_id=eq.${userId}&order=created_at.desc`) || [];
}
export async function addReteta(userId, item) {
  return await sb("retete_proprii", "POST", { user_id: userId, nume: item.nume, continut: item.continut, tip: item.tip || "pdf", file_url: item.file_url || null });
}
export async function deleteReteta(userId, id) {
  return await sb(`retete_proprii?user_id=eq.${userId}&id=eq.${id}`, "DELETE");
}

// ── SPORT ──────────────────────────────────────────────────────────────────
export async function getSportZi(userId, data) {
  const result = await sb(`sport_jurnal?user_id=eq.${userId}&data=eq.${data}`);
  return result?.length > 0 ? result[0] : null;
}
export async function upsertSportZi(userId, data, messages) {
  const existing = await sb(`sport_jurnal?user_id=eq.${userId}&data=eq.${data}`);
  if (existing?.length > 0) {
    return await sb(`sport_jurnal?user_id=eq.${userId}&data=eq.${data}`, "PATCH", { messages, updated_at: new Date().toISOString() });
  } else {
    return await sb("sport_jurnal", "POST", { user_id: userId, data, messages });
  }
}
export async function getSportIstoric(userId) {
  return await sb(`sport_jurnal?user_id=eq.${userId}&order=data.desc&limit=60`) || [];
}
