"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  getUserId, getSessions, saveSession, deleteSession,
  getFavorite, addFavorit, deleteFavorit,
  getJurnal, addJurnal, deleteJurnal,
  getProgres, addProgres, deleteProgres,
  getRetete, addReteta, deleteReteta,
} from "./lib/supabase";

const TABS = ["💬 Chat", "❤️ Favorite", "📓 Jurnal", "📅 Săptămână", "⚖️ Progres", "🔔 Remindere", "🔍 Produs", "📚 Rețetele Mele"];

const SUGGESTIONS = [
  "Am piept de pui 200g și broccoli. Ce fac?",
  "Fă-mi un plan complet pentru azi",
  "Dă-mi un plan sport pentru azi",
  "Vreau idei pentru subțierea abdomenului",
  "Generează meniu pentru toată săptămâna",
];

function loadLS(key, def) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch { return def; }
}
function saveLS(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

async function apiFetch(messages, profil, tip) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, profil, tip }),
  });
  const data = await res.json();
  return data.reply;
}

// ─── CHAT TAB ────────────────────────────────────────────────────────────────
function ChatTab({ profil }) {
  const initMsg = { role: "assistant", content: "Salut! Sunt agentul tău personal de nutriție și sport.\n\nPot să:\n• 🥗 Generez rețete complete cu pași detaliați\n• 📅 Planific mesele pentru o zi întreagă\n• 📊 Calculez macro-urile oricărui preparat\n• 🏋️ Îți dau un plan sport adaptat obiectivelor tale\n• 📷 Analizez poze cu mâncare, frigider sau etichete\n• 💡 Îți dau sfaturi concrete pentru subțierea abdomenului\n\nCu ce te ajut azi?" };
  const newSessionObj = () => ({ id: "s_" + Math.random().toString(36).slice(2) + Date.now(), title: "Conversație nouă", messages: [initMsg] });

  const [sessions, setSessions] = useState([newSessionObj()]);
  const [activeSession, setActiveSession] = useState(0);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [imagine, setImagine] = useState(null);
  const [imaginePreview, setImaginePreview] = useState(null);
  const [document, setDocument] = useState(null);
  const [documentNume, setDocumentNume] = useState(null);
  const [userId, setUserId] = useState(null);
  const bottomRef = useRef(null);
  const fileRef = useRef(null);
  const docRef = useRef(null);

  useEffect(() => {
    const uid = getUserId(); setUserId(uid);
    getSessions(uid).then(data => { if (data && data.length > 0) setSessions(data); });
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [sessions, activeSession, loading]);

  const currentSession = sessions[activeSession] || sessions[0];
  const messages = currentSession?.messages || [initMsg];

  async function newSession() {
    const s = newSessionObj();
    const updated = [s, ...sessions];
    setSessions(updated); setActiveSession(0);
    if (userId) await saveSession(userId, s);
  }

  async function removeSession(idx) {
    const s = sessions[idx];
    if (userId) await deleteSession(userId, s.id);
    if (sessions.length === 1) { const ns = newSessionObj(); setSessions([ns]); setActiveSession(0); if (userId) await saveSession(userId, ns); return; }
    const updated = sessions.filter((_, i) => i !== idx);
    setSessions(updated); setActiveSession(0);
  }

  async function updateMessages(newMsgs) {
    setSessions(prev => {
      const updated = [...prev];
      const firstUser = newMsgs.find(m => m.role === "user");
      const title = firstUser && updated[activeSession]?.title === "Conversație nouă"
        ? (typeof firstUser.content === "string" ? firstUser.content : "Conversație").slice(0, 30) + "..."
        : updated[activeSession]?.title;
      updated[activeSession] = { ...updated[activeSession], messages: newMsgs, title };
      if (userId) saveSession(userId, updated[activeSession]);
      return updated;
    });
  }

  function handleImagine(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { setImagine({ data: reader.result.split(",")[1], type: file.type }); setImaginePreview(reader.result); setDocument(null); setDocumentNume(null); };
    reader.readAsDataURL(file);
  }

  function handleDocument(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { setDocument({ data: reader.result.split(",")[1], type: file.type }); setDocumentNume(file.name); setImagine(null); setImaginePreview(null); };
    reader.readAsDataURL(file);
  }

  function stergeAtasament() {
    setImagine(null); setImaginePreview(null); setDocument(null); setDocumentNume(null);
    if (fileRef.current) fileRef.current.value = "";
    if (docRef.current) docRef.current.value = "";
  }

  async function saveFavorite(content) {
    const item = { title: content.slice(0, 50) + "...", content };
    if (userId) await addFavorit(userId, item);
    alert("✅ Salvat la favorite!");
  }

  // Detect tip of message
  function detectTip(text) {
    if (!text) return undefined;
    const t = text.toLowerCase();
    if (t.includes("sfat") || t.includes("idei") || t.includes("subțier") || t.includes("subtier") || t.includes("abdomen") || t.includes("slăbit") || t.includes("slabit")) return "sfat";
    return undefined;
  }

  async function sendMessage(text) {
    const userText = text || input.trim();
    if ((!userText && !imagine && !document) || loading) return;
    setInput("");

    const displayMsg = {
      role: "user",
      content: userText || (imagine ? "📷 Am trimis o poză" : `📄 ${documentNume}`),
      imagine: imaginePreview,
      documentNume,
    };

    let apiContent = [];
    if (imagine) {
      apiContent.push({ type: "image", source: { type: "base64", media_type: imagine.type, data: imagine.data } });
      apiContent.push({ type: "text", text: userText || "Analizează această imagine în contextul nutriției mele." });
    } else if (document) {
      apiContent.push({ type: "document", source: { type: "base64", media_type: document.type, data: document.data } });
      apiContent.push({ type: "text", text: userText || "Citește documentul și extrage informațiile relevante." });
    } else {
      apiContent = userText;
    }

    const newMessages = [...messages, displayMsg];
    updateMessages(newMessages);
    stergeAtasament();
    setLoading(true);

    const apiMessages = newMessages.map((m, idx) => ({
      role: m.role,
      content: idx === newMessages.length - 1 ? apiContent : (typeof m.content === "string" ? m.content : m.content),
    }));

    try {
      const tip = detectTip(userText);
      const reply = await apiFetch(apiMessages, profil, tip);
      updateMessages([...newMessages, { role: "assistant", content: reply }]);
    } catch {
      updateMessages([...newMessages, { role: "assistant", content: "A apărut o eroare. Încearcă din nou." }]);
    } finally {
      setLoading(false);
    }
  }

  function formatMessage(text) {
    return text.split("\n").map((line, i) => {
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      return (
        <p key={i} style={{ margin: "2px 0", minHeight: "1.2em" }}>
          {parts.map((part, j) =>
            part.startsWith("**") && part.endsWith("**") ? <strong key={j}>{part.slice(2, -2)}</strong> : part
          )}
        </p>
      );
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <div style={{ display: "flex", gap: 8, padding: "0 20px 10px", overflowX: "auto" }}>
        <button onClick={newSession} style={{ background: "#22c55e", border: "none", borderRadius: 20, color: "white", padding: "5px 12px", fontSize: 12, cursor: "pointer", flexShrink: 0 }}>+ Nou</button>
        {sessions.map((s, i) => (
          <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 4, background: i === activeSession ? "#1a2a1a" : "#1a1f2e", border: `1px solid ${i === activeSession ? "#22c55e" : "#2a3040"}`, borderRadius: 20, padding: "4px 10px", cursor: "pointer", flexShrink: 0 }}
            onClick={() => setActiveSession(i)}>
            <span style={{ color: i === activeSession ? "#22c55e" : "#94a3b8", fontSize: 11, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</span>
            <span onClick={e => { e.stopPropagation(); removeSession(i); }} style={{ color: "#ef4444", fontSize: 11, cursor: "pointer", marginLeft: 2 }}>✕</span>
          </div>
        ))}
      </div>

      <div style={{ flex: 1, padding: "0 20px", display: "flex", flexDirection: "column", gap: 12, overflowY: "auto", paddingBottom: 8 }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", flexDirection: "column", alignItems: msg.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{ maxWidth: "82%", padding: "12px 16px", borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px", background: msg.role === "user" ? "linear-gradient(135deg, #16a34a, #22c55e)" : "#1a1f2e", border: msg.role === "assistant" ? "1px solid #2a3040" : "none", color: msg.role === "user" ? "#fff" : "#e2e8f0", fontSize: 14, lineHeight: 1.6 }}>
              {msg.imagine && <img src={msg.imagine} alt="uploaded" style={{ width: "100%", borderRadius: 8, marginBottom: 8, maxHeight: 200, objectFit: "cover" }} />}
              {msg.documentNume && <div style={{ background: "rgba(255,255,255,0.15)", borderRadius: 8, padding: "6px 10px", marginBottom: 8, fontSize: 12 }}>📄 {msg.documentNume}</div>}
              {formatMessage(typeof msg.content === "string" ? msg.content : "")}
            </div>
            {msg.role === "assistant" && i > 0 && (
              <button onClick={() => saveFavorite(msg.content)} style={{ background: "transparent", border: "none", color: "#4ade80", fontSize: 11, cursor: "pointer", marginTop: 4, padding: "2px 8px" }}>❤️ Salvează la favorite</button>
            )}
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div style={{ padding: "12px 16px", borderRadius: "18px 18px 18px 4px", background: "#1a1f2e", border: "1px solid #2a3040", display: "flex", gap: 5 }}>
              {[0,1,2].map(d => <div key={d} style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", animation: "bounce 1.2s infinite", animationDelay: `${d*0.2}s` }} />)}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {messages.length <= 1 && (
        <div style={{ padding: "8px 20px", display: "flex", flexWrap: "wrap", gap: 8 }}>
          {SUGGESTIONS.map((s, i) => (
            <button key={i} onClick={() => sendMessage(s)} style={{ background: "#1a1f2e", border: "1px solid #2a3a2a", borderRadius: 20, color: "#86efac", fontSize: 12, padding: "6px 12px", cursor: "pointer" }}>{s}</button>
          ))}
        </div>
      )}

      {(imaginePreview || documentNume) && (
        <div style={{ padding: "0 20px 8px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 10, padding: "6px 10px" }}>
            {imaginePreview && <img src={imaginePreview} alt="preview" style={{ height: 50, borderRadius: 6 }} />}
            {documentNume && <span style={{ color: "#86efac", fontSize: 13 }}>📄 {documentNume}</span>}
            <button onClick={stergeAtasament} style={{ width: 20, height: 20, borderRadius: "50%", background: "#ef4444", border: "none", color: "white", fontSize: 11, cursor: "pointer" }}>✕</button>
          </div>
        </div>
      )}

      <div style={{ padding: "8px 20px 16px" }}>
        <div style={{ display: "flex", gap: 8, background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 16, padding: "8px 8px 8px 12px", alignItems: "flex-end" }}>
          <button onClick={() => fileRef.current?.click()} style={{ width: 34, height: 34, borderRadius: 8, background: "#2a3040", border: "none", cursor: "pointer", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>📷</button>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleImagine} style={{ display: "none" }} />
          <button onClick={() => docRef.current?.click()} style={{ width: 34, height: 34, borderRadius: 8, background: "#2a3040", border: "none", cursor: "pointer", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>📄</button>
          <input ref={docRef} type="file" accept=".pdf,.txt,.doc,.docx" onChange={handleDocument} style={{ display: "none" }} />
          <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} placeholder="Scrie, trimite o poză sau document..." rows={1} style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#e2e8f0", fontSize: 14, resize: "none", lineHeight: 1.5, paddingTop: 6, fontFamily: "inherit" }} />
          <button onClick={() => sendMessage()} disabled={(!input.trim() && !imagine && !document) || loading} style={{ width: 34, height: 34, borderRadius: 10, background: (input.trim() || imagine || document) && !loading ? "linear-gradient(135deg, #16a34a, #22c55e)" : "#2a3040", border: "none", cursor: "pointer", fontSize: 18, color: "white", flexShrink: 0 }}>↑</button>
        </div>
      </div>
    </div>
  );
}

// ─── FAVORITE TAB ─────────────────────────────────────────────────────────────
function FavoriteTab() {
  const [favorites, setFavorites] = useState([]);
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    const uid = getUserId(); setUserId(uid);
    getFavorite(uid).then(data => setFavorites(data || []));
  }, []);

  async function sterge(id) {
    if (userId) await deleteFavorit(userId, id);
    setFavorites(prev => prev.filter(f => f.id !== id));
  }

  return (
    <div style={{ padding: "0 20px", overflowY: "auto", flex: 1 }}>
      {favorites.length === 0 ? (
        <div style={{ textAlign: "center", color: "#4a5568", padding: "60px 20px" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>❤️</div>
          <div>Nicio rețetă salvată încă.</div>
          <div style={{ fontSize: 12, marginTop: 8 }}>Apasă "❤️ Salvează la favorite" sub orice răspuns din Chat.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingBottom: 20 }}>
          {favorites.map(f => (
            <div key={f.id} style={{ background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 14, padding: "14px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ color: "#22c55e", fontSize: 13, fontWeight: 600 }}>{f.title}</span>
                <button onClick={() => sterge(f.id)} style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 13 }}>🗑️</button>
              </div>
              <div style={{ color: "#94a3b8", fontSize: 11, marginBottom: 8 }}>{new Date(f.created_at).toLocaleDateString("ro-RO")}</div>
              <div style={{ color: "#e2e8f0", fontSize: 13, lineHeight: 1.6, maxHeight: 150, overflowY: "auto" }}>{f.content?.slice(0, 400)}{f.content?.length > 400 ? "..." : ""}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── JURNAL TAB (cu calcul automat calorii) ───────────────────────────────────
function JurnalTab({ profil }) {
  const azi = new Date().toISOString().split("T")[0];
  const [intrari, setIntrari] = useState([]);
  const [data, setData] = useState(azi);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    const uid = getUserId(); setUserId(uid);
    getJurnal(uid, data).then(d => setIntrari(d || []));
  }, [data]);

  async function calculeaza() {
    if (!input.trim()) return;
    setLoading(true);
    try {
      const reply = await apiFetch(
        [{ role: "user", content: input.trim() }],
        profil,
        "jurnal"
      );
      const ora = new Date().toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" });
      const item = { data, item: input.trim(), calorii: 0, ora, analiza: reply };
      const result = await addJurnal(userId, { ...item, calorii: 0 });
      if (result && result[0]) {
        setIntrari(prev => [...prev, { ...result[0], analiza: reply }]);
      }
      setInput("");
    } catch { alert("Eroare. Încearcă din nou."); }
    finally { setLoading(false); }
  }

  async function sterge(id) {
    await deleteJurnal(userId, id);
    setIntrari(prev => prev.filter(i => i.id !== id));
  }

  return (
    <div style={{ padding: "0 20px", overflowY: "auto", flex: 1 }}>
      <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center" }}>
        <input type="date" value={data} onChange={e => setData(e.target.value)} style={{ background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 10, color: "#e2e8f0", padding: "8px 12px", fontSize: 14, flex: 1, outline: "none" }} />
      </div>

      <div style={{ background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 14, padding: "14px", marginBottom: 16 }}>
        <div style={{ color: "#94a3b8", fontSize: 12, marginBottom: 8 }}>Descrie ce ai mâncat (cantitate + aliment):</div>
        <textarea value={input} onChange={e => setInput(e.target.value)} placeholder="ex: 2 ouă, 400g cirese, o pungă Savoria de la Mega, 4 cârnăciori subțiri, 40g brânză..." rows={3}
          style={{ width: "100%", background: "#0f1117", border: "1px solid #2a3040", borderRadius: 10, color: "#e2e8f0", padding: "10px 12px", fontSize: 14, outline: "none", resize: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
        <button onClick={calculeaza} disabled={!input.trim() || loading}
          style={{ marginTop: 10, width: "100%", padding: "10px", background: !input.trim() || loading ? "#2a3040" : "linear-gradient(135deg, #16a34a, #22c55e)", border: "none", borderRadius: 10, color: "white", fontSize: 14, fontWeight: 700, cursor: !input.trim() || loading ? "default" : "pointer" }}>
          {loading ? "Se calculează..." : "🔍 Calculează calorii automat"}
        </button>
      </div>

      {intrari.length === 0 ? (
        <div style={{ textAlign: "center", color: "#4a5568", padding: "40px 0" }}>Nicio intrare pentru această zi.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingBottom: 20 }}>
          {intrari.map(i => (
            <div key={i.id} style={{ background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 12, padding: "12px 14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div style={{ color: "#94a3b8", fontSize: 12 }}>{i.ora} · {new Date(i.data + "T12:00:00").toLocaleDateString("ro-RO")}</div>
                <button onClick={() => sterge(i.id)} style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 13 }}>✕</button>
              </div>
              <div style={{ color: "#86efac", fontSize: 13, fontStyle: "italic", marginBottom: 8 }}>"{i.item}"</div>
              {i.analiza && (
                <div style={{ color: "#e2e8f0", fontSize: 13, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                  {i.analiza.split("\n").map((line, idx) => {
                    const parts = line.split(/(\*\*[^*]+\*\*)/g);
                    return <p key={idx} style={{ margin: "2px 0" }}>{parts.map((p, j) => p.startsWith("**") && p.endsWith("**") ? <strong key={j}>{p.slice(2,-2)}</strong> : p)}</p>;
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── SAPTAMANA TAB (cu rețete detaliate) ──────────────────────────────────────
function SaptamanaTab({ profil }) {
  const [plan, setPlan] = useState(() => loadLS("plan_saptamana", null));
  const [loading, setLoading] = useState(false);

  async function genereaza() {
    setLoading(true);
    try {
      const reply = await apiFetch(
        [{ role: "user", content: `Generează un plan alimentar complet pentru 7 zile (Luni-Duminică). Pentru fiecare zi include REȚETE COMPLETE cu:\n- Ingrediente exacte în grame\n- Mod de preparare pas cu pas (pentru un începător absolut în bucătărie)\n- Timpi de gătire\n- Tabel nutrițional (kcal, proteine, carbohidrați, zahăr, grăsimi)\n- Total calorii pe zi\n\nRespectă: ${profil?.calorii || 1600} kcal/zi, ${profil?.restrictii || "fără gluten, low-carb"}.` }],
        profil,
        "plan"
      );
      setPlan(reply);
      saveLS("plan_saptamana", reply);
    } catch { alert("Eroare. Încearcă din nou."); }
    finally { setLoading(false); }
  }

  function formatPlan(text) {
    return text.split("\n").map((line, i) => {
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      return <p key={i} style={{ margin: "2px 0", minHeight: "1.1em" }}>{parts.map((p, j) => p.startsWith("**") && p.endsWith("**") ? <strong key={j}>{p.slice(2,-2)}</strong> : p)}</p>;
    });
  }

  return (
    <div style={{ padding: "0 20px", overflowY: "auto", flex: 1 }}>
      <button onClick={genereaza} disabled={loading} style={{ width: "100%", padding: "12px", background: loading ? "#2a3040" : "linear-gradient(135deg, #16a34a, #22c55e)", border: "none", borderRadius: 12, color: "white", fontSize: 15, fontWeight: 700, cursor: loading ? "default" : "pointer", marginBottom: 16 }}>
        {loading ? "Se generează (poate dura 30 secunde)..." : "🔄 Generează plan nou cu rețete complete"}
      </button>
      {plan ? (
        <div style={{ background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 14, padding: "16px", color: "#e2e8f0", fontSize: 14, lineHeight: 1.8, paddingBottom: 20 }}>
          {formatPlan(plan)}
        </div>
      ) : (
        <div style={{ textAlign: "center", color: "#4a5568", padding: "60px 0" }}><div style={{ fontSize: 40, marginBottom: 12 }}>📅</div><div>Apasă butonul pentru a genera planul săptămânii cu rețete complete.</div></div>
      )}
    </div>
  );
}

// ─── PROGRES TAB (kg + cm abdomen) ────────────────────────────────────────────
function ProgresTab({ profil }) {
  const [intrari, setIntrari] = useState([]);
  const [greutate, setGreutate] = useState("");
  const [abdomen, setAbdomen] = useState("");
  const [data, setData] = useState(new Date().toISOString().split("T")[0]);
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    const uid = getUserId(); setUserId(uid);
    getProgres(uid).then(d => setIntrari(d || []));
  }, []);

  async function adauga() {
    if (!greutate && !abdomen) return;
    await addProgres(userId, { data, greutate: parseFloat(greutate) || null, abdomen: parseFloat(abdomen) || null });
    const updated = await getProgres(userId);
    setIntrari(updated || []);
    setGreutate(""); setAbdomen("");
  }

  async function sterge(id) {
    await deleteProgres(userId, id);
    setIntrari(prev => prev.filter(i => i.id !== id));
  }

  const ultima = intrari[intrari.length - 1];
  const prima = intrari[0];
  const diffKg = ultima && prima && intrari.length > 1 ? (ultima.greutate - prima.greutate).toFixed(1) : null;
  const diffCm = ultima && prima && intrari.length > 1 && ultima.abdomen && prima.abdomen ? (ultima.abdomen - prima.abdomen).toFixed(1) : null;
  const imcActual = ultima?.greutate && profil?.inaltime ? (ultima.greutate / Math.pow(profil.inaltime / 100, 2)).toFixed(1) : null;

  function renderChart(field, color) {
    const vals = intrari.filter(i => i[field]).map(i => ({ data: i.data, val: parseFloat(i[field]) }));
    if (vals.length < 2) return null;
    const w = 300, h = 100, pad = 16;
    const min = Math.min(...vals.map(v => v.val)) - 1;
    const max = Math.max(...vals.map(v => v.val)) + 1;
    const points = vals.map((item, i) => {
      const x = pad + (i / (vals.length - 1)) * (w - 2 * pad);
      const y = pad + ((max - item.val) / (max - min)) * (h - 2 * pad);
      return `${x},${y}`;
    }).join(" ");
    return (
      <svg width="100%" viewBox={`0 0 ${w} ${h}`}>
        <polyline fill="none" stroke={color} strokeWidth="2" points={points} />
        {vals.map((item, i) => {
          const x = pad + (i / (vals.length - 1)) * (w - 2 * pad);
          const y = pad + ((max - item.val) / (max - min)) * (h - 2 * pad);
          return <circle key={i} cx={x} cy={y} r="3" fill={color} />;
        })}
      </svg>
    );
  }

  return (
    <div style={{ padding: "0 20px", overflowY: "auto", flex: 1 }}>
      {/* Stats */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {ultima?.greutate && <div style={{ flex: 1, minWidth: 80, background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 12, padding: "10px", textAlign: "center" }}>
          <div style={{ color: "#22c55e", fontSize: 18, fontWeight: 700 }}>{ultima.greutate} kg</div>
          <div style={{ color: "#4a5568", fontSize: 11 }}>Greutate</div>
        </div>}
        {diffKg !== null && <div style={{ flex: 1, minWidth: 80, background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 12, padding: "10px", textAlign: "center" }}>
          <div style={{ color: parseFloat(diffKg) < 0 ? "#22c55e" : "#ef4444", fontSize: 18, fontWeight: 700 }}>{diffKg > 0 ? "+" : ""}{diffKg} kg</div>
          <div style={{ color: "#4a5568", fontSize: 11 }}>Variație</div>
        </div>}
        {ultima?.abdomen && <div style={{ flex: 1, minWidth: 80, background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 12, padding: "10px", textAlign: "center" }}>
          <div style={{ color: "#3b82f6", fontSize: 18, fontWeight: 700 }}>{ultima.abdomen} cm</div>
          <div style={{ color: "#4a5568", fontSize: 11 }}>Abdomen</div>
        </div>}
        {diffCm !== null && <div style={{ flex: 1, minWidth: 80, background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 12, padding: "10px", textAlign: "center" }}>
          <div style={{ color: parseFloat(diffCm) < 0 ? "#22c55e" : "#ef4444", fontSize: 18, fontWeight: 700 }}>{diffCm > 0 ? "+" : ""}{diffCm} cm</div>
          <div style={{ color: "#4a5568", fontSize: 11 }}>Variație cm</div>
        </div>}
        {imcActual && <div style={{ flex: 1, minWidth: 80, background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 12, padding: "10px", textAlign: "center" }}>
          <div style={{ color: "#22c55e", fontSize: 18, fontWeight: 700 }}>{imcActual}</div>
          <div style={{ color: "#4a5568", fontSize: 11 }}>IMC</div>
        </div>}
      </div>

      {/* Charts */}
      {intrari.filter(i => i.greutate).length >= 2 && (
        <div style={{ background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 12, padding: "12px", marginBottom: 12 }}>
          <div style={{ color: "#22c55e", fontSize: 12, marginBottom: 6 }}>⚖️ Greutate (kg)</div>
          {renderChart("greutate", "#22c55e")}
        </div>
      )}
      {intrari.filter(i => i.abdomen).length >= 2 && (
        <div style={{ background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 12, padding: "12px", marginBottom: 16 }}>
          <div style={{ color: "#3b82f6", fontSize: 12, marginBottom: 6 }}>📏 Circumferință abdomen (cm)</div>
          {renderChart("abdomen", "#3b82f6")}
        </div>
      )}

      {/* Add entry */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <input type="date" value={data} onChange={e => setData(e.target.value)} style={{ flex: 2, minWidth: 120, background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 10, color: "#e2e8f0", padding: "8px 12px", fontSize: 14, outline: "none" }} />
        <input value={greutate} onChange={e => setGreutate(e.target.value)} placeholder="kg" type="number" step="0.1" style={{ flex: 1, minWidth: 60, background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 10, color: "#e2e8f0", padding: "8px 12px", fontSize: 14, outline: "none" }} />
        <input value={abdomen} onChange={e => setAbdomen(e.target.value)} placeholder="cm abd." type="number" step="0.5" style={{ flex: 1, minWidth: 70, background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 10, color: "#e2e8f0", padding: "8px 12px", fontSize: 14, outline: "none" }} />
        <button onClick={adauga} style={{ background: "linear-gradient(135deg, #16a34a, #22c55e)", border: "none", borderRadius: 10, color: "white", padding: "8px 14px", cursor: "pointer", fontSize: 16 }}>+</button>
      </div>

      {intrari.length === 0 ? (
        <div style={{ textAlign: "center", color: "#4a5568", padding: "40px 0" }}><div style={{ fontSize: 40, marginBottom: 12 }}>⚖️</div><div>Adaugă prima înregistrare.</div></div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingBottom: 20 }}>
          {[...intrari].reverse().map(i => (
            <div key={i.id} style={{ background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 12, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "#94a3b8", fontSize: 13 }}>{new Date(i.data + "T12:00:00").toLocaleDateString("ro-RO")}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {i.greutate && <span style={{ color: "#22c55e", fontWeight: 700 }}>{i.greutate} kg</span>}
                {i.abdomen && <span style={{ color: "#3b82f6", fontWeight: 700 }}>{i.abdomen} cm</span>}
                <button onClick={() => sterge(i.id)} style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 13 }}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── REMINDER TAB ─────────────────────────────────────────────────────────────
function ReminderTab() {
  const DEFAULT_REMINDERS = [
    { id: 1, label: "Mic dejun", ora: "08:00", activ: true },
    { id: 2, label: "Gustare dimineață", ora: "10:30", activ: false },
    { id: 3, label: "Prânz", ora: "13:00", activ: true },
    { id: 4, label: "Gustare după-amiază", ora: "16:00", activ: false },
    { id: 5, label: "Cină", ora: "19:00", activ: true },
    { id: 6, label: "Sport", ora: "17:30", activ: false },
  ];
  const [reminders, setReminders] = useState(() => loadLS("remindere", DEFAULT_REMINDERS));
  const [permisiune, setPermisiune] = useState(null);
  const [nou, setNou] = useState({ label: "", ora: "12:00" });

  useEffect(() => { if ("Notification" in window) setPermisiune(Notification.permission); }, []);

  async function cerePermisiune() {
    const result = await Notification.requestPermission();
    setPermisiune(result);
  }

  function toggleActiv(id) { const u = reminders.map(r => r.id === id ? { ...r, activ: !r.activ } : r); setReminders(u); saveLS("remindere", u); }
  function updateOra(id, ora) { const u = reminders.map(r => r.id === id ? { ...r, ora } : r); setReminders(u); saveLS("remindere", u); }
  function adaugaReminder() {
    if (!nou.label.trim()) return;
    const u = [...reminders, { id: Date.now(), label: nou.label.trim(), ora: nou.ora, activ: true }];
    setReminders(u); saveLS("remindere", u); setNou({ label: "", ora: "12:00" });
  }
  function stergeReminder(id) { const u = reminders.filter(r => r.id !== id); setReminders(u); saveLS("remindere", u); }

  return (
    <div style={{ padding: "0 20px", overflowY: "auto", flex: 1 }}>
      <div style={{ background: "#1a1f2e", border: `1px solid ${permisiune === "granted" ? "#2a4a2a" : "#4a3020"}`, borderRadius: 14, padding: "14px 16px", marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ color: "#e2e8f0", fontSize: 14, fontWeight: 600 }}>Notificări browser</div>
            <div style={{ color: "#4a5568", fontSize: 12 }}>{permisiune === "granted" ? "✅ Active" : "⚠️ Neactivate"}</div>
          </div>
          {permisiune !== "granted" && <button onClick={cerePermisiune} style={{ background: "linear-gradient(135deg, #16a34a, #22c55e)", border: "none", borderRadius: 10, color: "white", padding: "8px 14px", cursor: "pointer", fontSize: 13 }}>Activează</button>}
          {permisiune === "granted" && <button onClick={() => new Notification("Agent Nutriție", { body: "Funcționează! 🥗" })} style={{ background: "#1a2a1a", border: "1px solid #2a4a2a", borderRadius: 10, color: "#22c55e", padding: "8px 14px", cursor: "pointer", fontSize: 13 }}>Testează</button>}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
        {reminders.map(r => (
          <div key={r.id} style={{ background: "#1a1f2e", border: `1px solid ${r.activ ? "#2a4a2a" : "#2a3040"}`, borderRadius: 12, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={() => toggleActiv(r.id)} style={{ width: 36, height: 20, borderRadius: 10, background: r.activ ? "#22c55e" : "#2a3040", border: "none", cursor: "pointer", position: "relative", flexShrink: 0 }}>
              <div style={{ width: 16, height: 16, borderRadius: "50%", background: "white", position: "absolute", top: 2, left: r.activ ? 18 : 2, transition: "left 0.2s" }} />
            </button>
            <span style={{ flex: 1, color: r.activ ? "#e2e8f0" : "#4a5568", fontSize: 14 }}>{r.label}</span>
            <input type="time" value={r.ora} onChange={e => updateOra(r.id, e.target.value)} style={{ background: "#0f1117", border: "1px solid #2a3040", borderRadius: 8, color: "#e2e8f0", padding: "4px 8px", fontSize: 13, outline: "none" }} />
            <button onClick={() => stergeReminder(r.id)} style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer" }}>✕</button>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, paddingBottom: 20 }}>
        <input value={nou.label} onChange={e => setNou(p => ({ ...p, label: e.target.value }))} placeholder="Nume reminder..." style={{ flex: 1, background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 10, color: "#e2e8f0", padding: "8px 12px", fontSize: 14, outline: "none" }} onKeyDown={e => e.key === "Enter" && adaugaReminder()} />
        <input type="time" value={nou.ora} onChange={e => setNou(p => ({ ...p, ora: e.target.value }))} style={{ background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 10, color: "#e2e8f0", padding: "8px 12px", fontSize: 14, outline: "none" }} />
        <button onClick={adaugaReminder} style={{ background: "linear-gradient(135deg, #16a34a, #22c55e)", border: "none", borderRadius: 10, color: "white", padding: "8px 14px", cursor: "pointer", fontSize: 16 }}>+</button>
      </div>
    </div>
  );
}

// ─── PRODUS TAB ───────────────────────────────────────────────────────────────
function ProdusTab({ profil }) {
  const [imagine, setImagine] = useState(null);
  const [preview, setPreview] = useState(null);
  const [rezultat, setRezultat] = useState(null);
  const [loading, setLoading] = useState(false);
  const [istoric, setIstoric] = useState(() => loadLS("istoric_produse", []));
  const fileRef = useRef(null);
  const cameraRef = useRef(null);

  function handleFile(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { setImagine({ data: reader.result.split(",")[1], type: file.type }); setPreview(reader.result); setRezultat(null); };
    reader.readAsDataURL(file);
  }

  async function analizeaza() {
    if (!imagine) return;
    setLoading(true);
    try {
      const reply = await apiFetch(
        [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: imagine.type, data: imagine.data } }, { type: "text", text: `Analizează acest produs alimentar. Extrage valorile nutriționale per 100g și per porție, ingredientele principale și spune dacă e potrivit pentru dieta mea (${profil?.restrictii || "fără gluten, low-carb"}). Recomandare clară: DA sau NU cu motivul.` }] }],
        profil,
        undefined
      );
      setRezultat(reply);
      const item = { id: Date.now(), preview, rezultat: reply, data: new Date().toLocaleDateString("ro-RO") };
      const updated = [item, ...istoric].slice(0, 20);
      setIstoric(updated); saveLS("istoric_produse", updated);
    } catch { setRezultat("Eroare. Încearcă din nou."); }
    finally { setLoading(false); }
  }

  function reset() { setImagine(null); setPreview(null); setRezultat(null); if (fileRef.current) fileRef.current.value = ""; if (cameraRef.current) cameraRef.current.value = ""; }

  return (
    <div style={{ padding: "0 20px", overflowY: "auto", flex: 1 }}>
      {!preview ? (
        <div>
          <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
            <button onClick={() => cameraRef.current?.click()} style={{ flex: 1, padding: "16px", background: "linear-gradient(135deg, #16a34a, #22c55e)", border: "none", borderRadius: 14, color: "white", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>📷 Fotografiază produs</button>
            <button onClick={() => fileRef.current?.click()} style={{ flex: 1, padding: "16px", background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 14, color: "#94a3b8", fontSize: 14, cursor: "pointer" }}>🖼️ Din galerie</button>
          </div>
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handleFile} style={{ display: "none" }} />
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />
          {istoric.length > 0 && (
            <div>
              <div style={{ color: "#94a3b8", fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Analizate recent:</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingBottom: 20 }}>
                {istoric.slice(0, 5).map(item => (
                  <div key={item.id} style={{ background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 12, padding: "10px 14px", display: "flex", gap: 12, alignItems: "center" }}>
                    <img src={item.preview} alt="" style={{ width: 48, height: 48, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
                    <div style={{ flex: 1, overflow: "hidden" }}>
                      <div style={{ color: "#e2e8f0", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.rezultat?.slice(0, 60)}...</div>
                      <div style={{ color: "#4a5568", fontSize: 11 }}>{item.data}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div>
          <img src={preview} alt="produs" style={{ width: "100%", borderRadius: 14, maxHeight: 220, objectFit: "cover", marginBottom: 14 }} />
          {!rezultat ? (
            <button onClick={analizeaza} disabled={loading} style={{ width: "100%", padding: "14px", background: loading ? "#2a3040" : "linear-gradient(135deg, #16a34a, #22c55e)", border: "none", borderRadius: 12, color: "white", fontSize: 15, fontWeight: 700, cursor: loading ? "default" : "pointer", marginBottom: 10 }}>
              {loading ? "Se analizează..." : "🔍 Analizează produsul"}
            </button>
          ) : (
            <div style={{ background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 14, padding: "16px", color: "#e2e8f0", fontSize: 14, lineHeight: 1.7, marginBottom: 10, whiteSpace: "pre-wrap" }}>{rezultat}</div>
          )}
          <button onClick={reset} style={{ width: "100%", padding: "10px", background: "transparent", border: "1px solid #2a3040", borderRadius: 12, color: "#94a3b8", fontSize: 14, cursor: "pointer" }}>← Analizează alt produs</button>
        </div>
      )}
    </div>
  );
}

// ─── RETETE PROPRII TAB ────────────────────────────────────────────────────────
function ReteteTab({ profil }) {
  const [retete, setRetete] = useState([]);
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedReteta, setSelectedReteta] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    const uid = getUserId(); setUserId(uid);
    getRetete(uid).then(d => setRetete(d || []));
  }, []);

  async function handleUpload(e) {
    const file = e.target.files[0]; if (!file) return;
    setLoading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result.split(",")[1];
      const tip = file.type;
      try {
        const reply = await apiFetch(
          [{ role: "user", content: [
            tip.includes("pdf") ? { type: "document", source: { type: "base64", media_type: tip, data: base64 } } : { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
            { type: "text", text: "Extrage toate rețetele din acest document. Pentru fiecare rețetă, păstrează: numele, ingredientele cu gramaje exacte, modul de preparare pas cu pas și valorile nutriționale dacă există. Formatează clar." }
          ]}],
          profil,
          undefined
        );
        const item = { nume: file.name.replace(/\.[^/.]+$/, ""), continut: reply, tip: file.type };
        const result = await addReteta(userId, item);
        if (result && result[0]) setRetete(prev => [result[0], ...prev]);
        alert("✅ Rețetele au fost extrase și salvate!");
      } catch { alert("Eroare la procesare. Încearcă din nou."); }
      finally { setLoading(false); if (fileRef.current) fileRef.current.value = ""; }
    };
    reader.readAsDataURL(file);
  }

  async function sterge(id) {
    await deleteReteta(userId, id);
    setRetete(prev => prev.filter(r => r.id !== id));
    if (selectedReteta?.id === id) setSelectedReteta(null);
  }

  if (selectedReteta) {
    return (
      <div style={{ padding: "0 20px", overflowY: "auto", flex: 1 }}>
        <button onClick={() => setSelectedReteta(null)} style={{ background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 10, color: "#94a3b8", padding: "8px 14px", cursor: "pointer", fontSize: 13, marginBottom: 16 }}>← Înapoi</button>
        <div style={{ color: "#22c55e", fontSize: 16, fontWeight: 700, marginBottom: 12 }}>{selectedReteta.nume}</div>
        <div style={{ color: "#e2e8f0", fontSize: 14, lineHeight: 1.8, whiteSpace: "pre-wrap", paddingBottom: 20 }}>
          {selectedReteta.continut?.split("\n").map((line, i) => {
            const parts = line.split(/(\*\*[^*]+\*\*)/g);
            return <p key={i} style={{ margin: "2px 0" }}>{parts.map((p, j) => p.startsWith("**") && p.endsWith("**") ? <strong key={j}>{p.slice(2,-2)}</strong> : p)}</p>;
          })}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "0 20px", overflowY: "auto", flex: 1 }}>
      <button onClick={() => fileRef.current?.click()} disabled={loading}
        style={{ width: "100%", padding: "14px", background: loading ? "#2a3040" : "linear-gradient(135deg, #16a34a, #22c55e)", border: "none", borderRadius: 12, color: "white", fontSize: 14, fontWeight: 700, cursor: loading ? "default" : "pointer", marginBottom: 8 }}>
        {loading ? "Se procesează documentul..." : "📤 Încarcă rețete (PDF sau Word)"}
      </button>
      <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.txt" onChange={handleUpload} style={{ display: "none" }} />
      <div style={{ color: "#4a5568", fontSize: 12, textAlign: "center", marginBottom: 20 }}>
        Agentul extrage rețetele și le ține minte permanent în cloud.
      </div>

      {retete.length === 0 ? (
        <div style={{ textAlign: "center", color: "#4a5568", padding: "40px 0" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📚</div>
          <div>Nicio rețetă încărcată încă.</div>
          <div style={{ fontSize: 12, marginTop: 8 }}>Încarcă un PDF sau document Word cu rețetele tale.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingBottom: 20 }}>
          {retete.map(r => (
            <div key={r.id} onClick={() => setSelectedReteta(r)}
              style={{ background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 12, padding: "12px 16px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ color: "#22c55e", fontSize: 14, fontWeight: 600 }}>{r.nume}</div>
                <div style={{ color: "#4a5568", fontSize: 11, marginTop: 2 }}>{new Date(r.created_at).toLocaleDateString("ro-RO")} · Apasă pentru a vedea</div>
              </div>
              <button onClick={e => { e.stopPropagation(); sterge(r.id); }} style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 16 }}>🗑️</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function Home() {
  const router = useRouter();
  const [tab, setTab] = useState(0);
  const [profil, setProfil] = useState(null);

  useEffect(() => {
    const saved = localStorage.getItem("profil_nutritie");
    if (saved) setProfil(JSON.parse(saved));
  }, []);

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: "#0f1117", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ width: "100%", maxWidth: 680, display: "flex", flexDirection: "column", height: "100vh" }}>
        <div style={{ padding: "16px 20px 0" }}>
          <div style={{ background: "linear-gradient(135deg, #1a2a1a, #0f1f0f)", border: "1px solid #2a4a2a", borderRadius: 16, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #22c55e, #16a34a)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>🥦</div>
            <div style={{ flex: 1 }}>
              <div style={{ color: "#22c55e", fontWeight: 700, fontSize: 14 }}>Agent Nutriție & Sport</div>
              <div style={{ color: "#4ade80", fontSize: 11, opacity: 0.7 }}>{profil?.nume ? `${profil.nume} · ${profil.calorii || 1600} kcal` : "Completează profilul"}</div>
            </div>
            <button onClick={() => router.push("/profil")} style={{ background: profil ? "#1a2a1a" : "linear-gradient(135deg, #16a34a, #22c55e)", border: profil ? "1px solid #2a4a2a" : "none", borderRadius: 10, color: profil ? "#22c55e" : "white", padding: "6px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
              {profil ? "👤 Profil" : "⚙️ Setează"}
            </button>
          </div>
          <div style={{ display: "flex", gap: 4, overflowX: "auto", paddingBottom: 4 }}>
            {TABS.map((t, i) => (
              <button key={i} onClick={() => setTab(i)} style={{ background: i === tab ? "linear-gradient(135deg, #16a34a, #22c55e)" : "#1a1f2e", border: `1px solid ${i === tab ? "transparent" : "#2a3040"}`, borderRadius: 20, color: i === tab ? "white" : "#94a3b8", padding: "6px 12px", cursor: "pointer", fontSize: 12, fontWeight: i === tab ? 700 : 400, flexShrink: 0, whiteSpace: "nowrap" }}>
                {t}
              </button>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", paddingTop: 12 }}>
          {tab === 0 && <ChatTab profil={profil} />}
          {tab === 1 && <FavoriteTab />}
          {tab === 2 && <JurnalTab profil={profil} />}
          {tab === 3 && <SaptamanaTab profil={profil} />}
          {tab === 4 && <ProgresTab profil={profil} />}
          {tab === 5 && <ReminderTab />}
          {tab === 6 && <ProdusTab profil={profil} />}
          {tab === 7 && <ReteteTab profil={profil} />}
        </div>
      </div>
      <style>{`
        @keyframes bounce { 0%, 60%, 100% { transform: translateY(0); } 30% { transform: translateY(-6px); } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: #2a3040; border-radius: 2px; }
        input[type="date"]::-webkit-calendar-picker-indicator, input[type="time"]::-webkit-calendar-picker-indicator { filter: invert(1); }
      `}</style>
    </div>
  );
}
