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
    if (!res.ok) { console.error("Supabase error:", await res.text()); return null; }
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  } catch (e) { console.error("Supabase fetch error:", e); return null; }
}

export function getUserId() {
  if (typeof window === "undefined") return "server";
  let uid = localStorage.getItem("user_id");
  if (!uid) { uid = "u_" + Math.random().toString(36).slice(2) + Date.now(); localStorage.setItem("user_id", uid); }
  return uid;
}

// CHAT SESSIONS
export async function getSessions(userId) {
  const data = await sb(`chat_sessions?user_id=eq.${userId}&order=updated_at.desc&limit=20`);
  return data || [];
}
export async function saveSession(userId, session) {
  const existing = await sb(`chat_sessions?user_id=eq.${userId}&id=eq.${session.id}`);
  if (existing && existing.length > 0) {
    await sb(`chat_sessions?user_id=eq.${userId}&id=eq.${session.id}`, "PATCH", { messages: session.messages, title: session.title, updated_at: new Date().toISOString() });
  } else {
    await sb("chat_sessions", "POST", { id: session.id, user_id: userId, title: session.title, messages: session.messages });
  }
}
export async function deleteSession(userId, sessionId) {
  await sb(`chat_sessions?user_id=eq.${userId}&id=eq.${sessionId}`, "DELETE");
}

// MEMORY - rezumate conversatii pentru memorie pe termen lung
export async function getMemory(userId) {
  const data = await sb(`memory?user_id=eq.${userId}&order=created_at.desc&limit=50`);
  return data || [];
}
export async function addMemory(userId, content) {
  return await sb("memory", "POST", { user_id: userId, content });
}
export async function deleteAllMemory(userId) {
  await sb(`memory?user_id=eq.${userId}`, "DELETE");
}

// FAVORITE
export async function getFavorite(userId) {
  const data = await sb(`favorite?user_id=eq.${userId}&order=created_at.desc`);
  return data || [];
}
export async function addFavorit(userId, item) {
  return await sb("favorite", "POST", { user_id: userId, title: item.title, content: item.content });
}
export async function deleteFavorit(userId, id) {
  await sb(`favorite?user_id=eq.${userId}&id=eq.${id}`, "DELETE");
}

// JURNAL
export async function getJurnal(userId, data) {
  const result = await sb(`jurnal?user_id=eq.${userId}&data=eq.${data}&order=created_at.asc`);
  return result || [];
}
export async function getJurnalRecent(userId) {
  const result = await sb(`jurnal?user_id=eq.${userId}&order=created_at.desc&limit=20`);
  return result || [];
}
export async function addJurnal(userId, item) {
  return await sb("jurnal", "POST", { user_id: userId, data: item.data, item: item.item, calorii: item.calorii || 0, ora: item.ora, analiza: item.analiza || null });
}
export async function deleteJurnal(userId, id) {
  await sb(`jurnal?user_id=eq.${userId}&id=eq.${id}`, "DELETE");
}

// PROGRES
export async function getProgres(userId) {
  const data = await sb(`progres?user_id=eq.${userId}&order=data.asc`);
  return data || [];
}
export async function addProgres(userId, item) {
  const existing = await sb(`progres?user_id=eq.${userId}&data=eq.${item.data}`);
  if (existing && existing.length > 0) {
    await sb(`progres?user_id=eq.${userId}&data=eq.${item.data}`, "PATCH", { greutate: item.greutate, abdomen: item.abdomen, updated_at: new Date().toISOString() });
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
  return data && data.length > 0 ? data[0].date : null;
}
export async function saveProfil(userId, date) {
  const existing = await sb(`profil?user_id=eq.${userId}`);
  if (existing && existing.length > 0) {
    await sb(`profil?user_id=eq.${userId}`, "PATCH", { date, updated_at: new Date().toISOString() });
  } else {
    await sb("profil", "POST", { user_id: userId, date });
  }
}

// RETETE PROPRII
export async function getRetete(userId) {
  const data = await sb(`retete_proprii?user_id=eq.${userId}&order=created_at.desc`);
  return data || [];
}
export async function addReteta(userId, item) {
  return await sb("retete_proprii", "POST", { user_id: userId, nume: item.nume, continut: item.continut, tip: item.tip });
}
export async function deleteReteta(userId, id) {
  await sb(`retete_proprii?user_id=eq.${userId}&id=eq.${id}`, "DELETE");
}
