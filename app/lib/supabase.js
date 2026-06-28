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
    if (!res.ok) {
      const err = await res.text();
      console.error("SB error:", path, method, err);
      return null;
    }
    const text = await res.text();
    return text ? JSON.parse(text) : [];
  } catch (e) { console.error("SB fetch error:", e); return null; }
}

export function getUserId() {
  if (typeof window === "undefined") return "server";
  let uid = localStorage.getItem("user_id");
  if (!uid) { uid = "u_" + Math.random().toString(36).slice(2) + Date.now(); localStorage.setItem("user_id", uid); }
  return uid;
}

// CHAT SESSIONS
export async function getSessions(userId) {
  return await sb(`chat_sessions?user_id=eq.${encodeURIComponent(userId)}&order=updated_at.desc&limit=20`) || [];
}
export async function saveSession(userId, session) {
  const existing = await sb(`chat_sessions?user_id=eq.${encodeURIComponent(userId)}&id=eq.${session.id}`);
  if (existing?.length > 0) {
    await sb(`chat_sessions?user_id=eq.${encodeURIComponent(userId)}&id=eq.${session.id}`, "PATCH", {
      messages: session.messages, title: session.title, updated_at: new Date().toISOString()
    });
  } else {
    await sb("chat_sessions", "POST", { id: session.id, user_id: userId, title: session.title, messages: session.messages });
  }
}
export async function deleteSession(userId, sessionId) {
  await sb(`chat_sessions?user_id=eq.${encodeURIComponent(userId)}&id=eq.${sessionId}`, "DELETE");
}

// MEMORY
export async function getMemory(userId) {
  return await sb(`memory?user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc&limit=50`) || [];
}
export async function addMemory(userId, content, tip = "conversatie") {
  return await sb("memory", "POST", { user_id: userId, content, tip, rezolvat: false });
}

// JURNAL - chat-based per zi per tip masa
export async function getJurnalZi(userId, data) {
  return await sb(`jurnal?user_id=eq.${encodeURIComponent(userId)}&data=eq.${data}&order=created_at.asc`) || [];
}
export async function getJurnalRecent(userId) {
  return await sb(`jurnal?user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc&limit=30`) || [];
}
export async function getJurnalStats(userId) {
  const all = await sb(`jurnal?user_id=eq.${encodeURIComponent(userId)}&order=data.asc`) || [];
  if (!all.length) return null;
  const zileUnice = [...new Set(all.map(j => j.data))];
  const totalCalorii = all.reduce((s, j) => s + (parseFloat(j.calorii) || 0), 0);
  const totalSare = all.reduce((s, j) => s + (parseFloat(j.sare) || 0), 0);
  return {
    zileCuJurnal: zileUnice.length,
    totalMese: all.length,
    medieCalorii: zileUnice.length ? Math.round(totalCalorii / zileUnice.length) : 0,
    medieSare: all.length ? (totalSare / all.length).toFixed(1) : 0,
  };
}
export async function saveJurnalEntry(userId, entry) {
  // entry: { data, tip_masa, messages, calorii, proteine, carbohidrati, zaharuri, grasimi, sare, apa_ml }
  const existing = await sb(`jurnal?user_id=eq.${encodeURIComponent(userId)}&data=eq.${entry.data}&tip_masa=eq.${entry.tip_masa}`);
  if (existing?.length > 0) {
    return await sb(`jurnal?user_id=eq.${encodeURIComponent(userId)}&data=eq.${entry.data}&tip_masa=eq.${entry.tip_masa}`, "PATCH", {
      messages: entry.messages,
      calorii: entry.calorii || 0,
      proteine: entry.proteine || 0,
      carbohidrati: entry.carbohidrati || 0,
      zaharuri: entry.zaharuri || 0,
      grasimi: entry.grasimi || 0,
      sare: entry.sare || 0,
      apa_ml: entry.apa_ml || 0,
      analiza: entry.analiza || null,
      updated_at: new Date().toISOString(),
    });
  } else {
    return await sb("jurnal", "POST", {
      user_id: userId,
      data: entry.data,
      tip_masa: entry.tip_masa,
      item: entry.item || entry.tip_masa,
      messages: entry.messages || [],
      calorii: entry.calorii || 0,
      proteine: entry.proteine || 0,
      carbohidrati: entry.carbohidrati || 0,
      zaharuri: entry.zaharuri || 0,
      grasimi: entry.grasimi || 0,
      sare: entry.sare || 0,
      apa_ml: entry.apa_ml || 0,
      analiza: entry.analiza || null,
    });
  }
}
export async function deleteJurnalEntry(userId, data, tipMasa) {
  await sb(`jurnal?user_id=eq.${encodeURIComponent(userId)}&data=eq.${data}&tip_masa=eq.${tipMasa}`, "DELETE");
}

// PROGRES
export async function getProgres(userId) {
  return await sb(`progres?user_id=eq.${encodeURIComponent(userId)}&order=data.asc`) || [];
}
export async function addProgres(userId, item) {
  const existing = await sb(`progres?user_id=eq.${encodeURIComponent(userId)}&data=eq.${item.data}`);
  if (existing?.length > 0) {
    await sb(`progres?user_id=eq.${encodeURIComponent(userId)}&data=eq.${item.data}`, "PATCH", { greutate: item.greutate, abdomen: item.abdomen });
  } else {
    await sb("progres", "POST", { user_id: userId, data: item.data, greutate: item.greutate, abdomen: item.abdomen });
  }
}
export async function deleteProgres(userId, id) {
  await sb(`progres?user_id=eq.${encodeURIComponent(userId)}&id=eq.${id}`, "DELETE");
}

// PROFIL
export async function getProfil(userId) {
  const data = await sb(`profil?user_id=eq.${encodeURIComponent(userId)}`);
  return data?.length > 0 ? data[0].date : null;
}
export async function saveProfil(userId, date) {
  const existing = await sb(`profil?user_id=eq.${encodeURIComponent(userId)}`);
  if (existing?.length > 0) {
    await sb(`profil?user_id=eq.${encodeURIComponent(userId)}`, "PATCH", { date, updated_at: new Date().toISOString() });
  } else {
    await sb("profil", "POST", { user_id: userId, date });
  }
}

// FAVORITE
export async function getFavorite(userId) {
  return await sb(`favorite?user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc`) || [];
}
export async function addFavorit(userId, item) {
  return await sb("favorite", "POST", { user_id: userId, title: item.title, content: item.content });
}
export async function deleteFavorit(userId, id) {
  await sb(`favorite?user_id=eq.${encodeURIComponent(userId)}&id=eq.${id}`, "DELETE");
}

// RETETE PROPRII
export async function getRetete(userId) {
  const result = await sb(`retete_proprii?user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc`);
  console.log("getRetete result:", result);
  return result || [];
}
export async function addReteta(userId, item) {
  const result = await sb("retete_proprii", "POST", { user_id: userId, nume: item.nume, continut: item.continut, tip: item.tip || "pdf" });
  console.log("addReteta result:", result);
  return result;
}
export async function deleteReteta(userId, id) {
  await sb(`retete_proprii?user_id=eq.${encodeURIComponent(userId)}&id=eq.${id}`, "DELETE");
}

// SPORT - idei zilnice chat
export async function getSportZi(userId, data) {
  const result = await sb(`sport_jurnal?user_id=eq.${encodeURIComponent(userId)}&data=eq.${data}`);
  return result?.length > 0 ? result[0] : null;
}
export async function saveSportZi(userId, data, messages) {
  const existing = await sb(`sport_jurnal?user_id=eq.${encodeURIComponent(userId)}&data=eq.${data}`);
  if (existing?.length > 0) {
    return await sb(`sport_jurnal?user_id=eq.${encodeURIComponent(userId)}&data=eq.${data}`, "PATCH", { messages, updated_at: new Date().toISOString() });
  } else {
    return await sb("sport_jurnal", "POST", { user_id: userId, data, messages });
  }
}
export async function getSportIstoric(userId) {
  return await sb(`sport_jurnal?user_id=eq.${encodeURIComponent(userId)}&order=data.desc&limit=30`) || [];
}
