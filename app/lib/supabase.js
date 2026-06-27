const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_KEY;

async function sb(path, method = "GET", body = null) {
  const opts = {
    method,
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Prefer": method === "POST" ? "return=representation" : "",
    },
  };
  if (body) opts.body = JSON.stringify(body);
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, opts);
    if (!res.ok) { console.error("SB error:", await res.text()); return null; }
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  } catch (e) { console.error("SB fetch:", e); return null; }
}

export function getUserId() {
  if (typeof window === "undefined") return "server";
  let uid = localStorage.getItem("user_id");
  if (!uid) { uid = "u_" + Math.random().toString(36).slice(2) + Date.now(); localStorage.setItem("user_id", uid); }
  return uid;
}

// CHAT SESSIONS
export async function getSessions(userId) {
  return await sb(`chat_sessions?user_id=eq.${userId}&order=updated_at.desc&limit=20`) || [];
}
export async function saveSession(userId, session) {
  const existing = await sb(`chat_sessions?user_id=eq.${userId}&id=eq.${session.id}`);
  if (existing?.length > 0) {
    await sb(`chat_sessions?user_id=eq.${userId}&id=eq.${session.id}`, "PATCH", { messages: session.messages, title: session.title, updated_at: new Date().toISOString() });
  } else {
    await sb("chat_sessions", "POST", { id: session.id, user_id: userId, title: session.title, messages: session.messages });
  }
}
export async function deleteSession(userId, sessionId) {
  await sb(`chat_sessions?user_id=eq.${userId}&id=eq.${sessionId}`, "DELETE");
}

// MEMORY
export async function getMemory(userId) {
  return await sb(`memory?user_id=eq.${userId}&order=created_at.desc&limit=50`) || [];
}
export async function addMemory(userId, content, tip = "conversatie") {
  return await sb("memory", "POST", { user_id: userId, content, tip });
}
export async function markMemoryRezolvat(userId, id) {
  await sb(`memory?user_id=eq.${userId}&id=eq.${id}`, "PATCH", { rezolvat: true });
}

// JURNAL
export async function getJurnal(userId, data) {
  return await sb(`jurnal?user_id=eq.${userId}&data=eq.${data}&order=created_at.asc`) || [];
}
export async function getJurnalRecent(userId) {
  return await sb(`jurnal?user_id=eq.${userId}&order=created_at.desc&limit=30`) || [];
}
export async function getJurnalStats(userId) {
  const all = await sb(`jurnal?user_id=eq.${userId}&order=data.asc`) || [];
  if (!all.length) return null;
  // Zile unice cu jurnal
  const zileUnice = [...new Set(all.map(j => j.data))];
  // Calcul medii
  const totalCalorii = all.reduce((s, j) => s + (parseFloat(j.calorii) || 0), 0);
  const totalSare = all.reduce((s, j) => s + (parseFloat(j.sare) || 0), 0);
  // Zile in target (presupunem target din profil = 1600, dar nu avem acces la profil here)
  return {
    zileCuJurnal: zileUnice.length,
    totalMese: all.length,
    medieCalorii: zileUnice.length ? Math.round(totalCalorii / zileUnice.length) : 0,
    medieSare: all.length ? (totalSare / all.length).toFixed(1) : 0,
  };
}
export async function addJurnal(userId, item) {
  return await sb("jurnal", "POST", {
    user_id: userId,
    data: item.data,
    item: item.item,
    calorii: item.calorii || 0,
    proteine: item.proteine || 0,
    carbohidrati: item.carbohidrati || 0,
    zaharuri: item.zaharuri || 0,
    grasimi: item.grasimi || 0,
    sare: item.sare || 0,
    apa_recomandata: item.apa_recomandata || 0,
    tip_masa: item.tip_masa || "intermediar",
    ora_masa: item.ora_masa || null,
    analiza: item.analiza || null,
  });
}
export async function deleteJurnal(userId, id) {
  await sb(`jurnal?user_id=eq.${userId}&id=eq.${id}`, "DELETE");
}

// PROGRES
export async function getProgres(userId) {
  return await sb(`progres?user_id=eq.${userId}&order=data.asc`) || [];
}
export async function addProgres(userId, item) {
  const existing = await sb(`progres?user_id=eq.${userId}&data=eq.${item.data}`);
  if (existing?.length > 0) {
    await sb(`progres?user_id=eq.${userId}&data=eq.${item.data}`, "PATCH", { greutate: item.greutate, abdomen: item.abdomen });
  } else {
    await sb("progres", "POST", { user_id: userId, data: item.data, greutate: item.greutate, abdomen: item.abdomen });
  }
}
export async function deleteProgres(userId, id) {
  await sb(`progres?user_id=eq.${userId}&id=eq.${id}`, "DELETE");
}

// PROFIL
export async function getProfil(userId) {
  const data = await sb(`profil?user_id=eq.${userId}`);
  return data?.length > 0 ? data[0].date : null;
}
export async function saveProfil(userId, date) {
  const existing = await sb(`profil?user_id=eq.${userId}`);
  if (existing?.length > 0) {
    await sb(`profil?user_id=eq.${userId}`, "PATCH", { date, updated_at: new Date().toISOString() });
  } else {
    await sb("profil", "POST", { user_id: userId, date });
  }
}

// FAVORITE
export async function getFavorite(userId) {
  return await sb(`favorite?user_id=eq.${userId}&order=created_at.desc`) || [];
}
export async function addFavorit(userId, item) {
  return await sb("favorite", "POST", { user_id: userId, title: item.title, content: item.content });
}
export async function deleteFavorit(userId, id) {
  await sb(`favorite?user_id=eq.${userId}&id=eq.${id}`, "DELETE");
}

// RETETE PROPRII
export async function getRetete(userId) {
  return await sb(`retete_proprii?user_id=eq.${userId}&order=created_at.desc`) || [];
}
export async function addReteta(userId, item) {
  return await sb("retete_proprii", "POST", { user_id: userId, nume: item.nume, continut: item.continut, tip: item.tip });
}
export async function deleteReteta(userId, id) {
  await sb(`retete_proprii?user_id=eq.${userId}&id=eq.${id}`, "DELETE");
}
