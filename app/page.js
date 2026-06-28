"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  getUserId, getSessions, saveSession, deleteSession,
  getFavorite, addFavorit, deleteFavorit,
  getJurnalZi, getJurnalRecent, getJurnalStats, saveJurnalEntry, deleteJurnalEntry,
  getProgres, addProgres, deleteProgres,
  getRetete, addReteta, deleteReteta,
  getMemory, addMemory,
  getSportZi, saveSportZi, getSportIstoric,
} from "./lib/supabase";

const TABS = ["💬 Chat", "❤️ Favorite", "📓 Jurnal", "📅 Săptămână", "⚖️ Progres", "🏃 Sport", "🔔 Remindere", "🔍 Produs", "📚 Rețete"];

const SUGGESTIONS = [
  "Vreau idei concrete pentru subțierea abdomenului",
  "Dă-mi un plan sport sigur pentru genunchii mei",
  "Am piept de pui 200g și broccoli. Ce fac?",
  "Cum elimin apa reținută în corp?",
  "Care e progresul meu până acum?",
];

function loadLS(key, def) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch { return def; }
}
function saveLS(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

async function apiFetch(messages, profil, tip, context) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, profil, tip, context: context || {} }),
  });
  const data = await res.json();
  return data.reply;
}

function FormatText({ text }) {
  if (!text) return null;
  return (
    <>
      {(text || "").split("\n").map((line, i) => {
        // Handle table rows
        if (line.startsWith("|")) {
          return <div key={i} style={{ fontFamily: "monospace", fontSize: 12, color: "#94a3b8", overflowX: "auto", whiteSpace: "nowrap" }}>{line}</div>;
        }
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        return (
          <p key={i} style={{ margin: "2px 0", minHeight: "1.1em" }}>
            {parts.map((p, j) => p.startsWith("**") && p.endsWith("**") ? <strong key={j}>{p.slice(2, -2)}</strong> : p)}
          </p>
        );
      })}
    </>
  );
}

// ─── MINI CHAT COMPONENT (reusabil) ──────────────────────────────────────────
function MiniChat({ messages, onSend, loading, placeholder, profil, context, tip }) {
  const [input, setInput] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  async function send() {
    const txt = input.trim(); if (!txt || loading) return;
    setInput("");
    await onSend(txt);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ maxHeight: 400, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
        {(messages || []).map((msg, i) => (
          <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{ maxWidth: "85%", padding: "10px 14px", borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px", background: msg.role === "user" ? "linear-gradient(135deg, #16a34a, #22c55e)" : "#0f1117", border: msg.role === "assistant" ? "1px solid #2a3040" : "none", color: msg.role === "user" ? "#fff" : "#e2e8f0", fontSize: 13, lineHeight: 1.6 }}>
              <FormatText text={msg.content} />
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex" }}>
            <div style={{ padding: "10px 14px", borderRadius: "16px 16px 16px 4px", background: "#0f1117", border: "1px solid #2a3040", display: "flex", gap: 4 }}>
              {[0,1,2].map(d => <div key={d} style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", animation: "bounce 1.2s infinite", animationDelay: `${d*0.2}s` }} />)}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div style={{ display: "flex", gap: 8, background: "#0f1117", border: "1px solid #2a3040", borderRadius: 12, padding: "6px 6px 6px 12px" }}>
        <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder={placeholder || "Scrie..."} rows={1} style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#e2e8f0", fontSize: 13, resize: "none", fontFamily: "inherit", paddingTop: 4 }} />
        <button onClick={send} disabled={!input.trim() || loading} style={{ width: 32, height: 32, borderRadius: 8, background: input.trim() && !loading ? "linear-gradient(135deg, #16a34a, #22c55e)" : "#2a3040", border: "none", color: "white", fontSize: 16, cursor: "pointer", flexShrink: 0 }}>↑</button>
      </div>
    </div>
  );
}

// ─── CHAT TAB ────────────────────────────────────────────────────────────────
function ChatTab({ profil, globalContext }) {
  const initMsg = { role: "assistant", content: `Salut${profil?.nume ? ", " + profil.nume : ""}! Sunt agentul tău personal.\n\n${globalContext?.memory?.length > 0 ? `🧠 Îmi amintesc ${globalContext.memory.length} conversații anterioare.\n` : ""}${globalContext?.progres?.length > 0 ? `📊 Urmăresc progresul tău (${globalContext.progres.length} măsurători).\n` : ""}\nCaut pe internet în timp real și filtrez pentru tine. Cu ce te ajut azi?` };
  const newSess = () => ({ id: "s_" + Math.random().toString(36).slice(2) + Date.now(), title: "Conversație nouă", messages: [initMsg] });

  const [sessions, setSessions] = useState([newSess()]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [imagine, setImagine] = useState(null);
  const [imaginePreview, setImaginePreview] = useState(null);
  const [docFile, setDocFile] = useState(null);
  const [docNume, setDocNume] = useState(null);
  const [userId, setUserId] = useState(null);
  const fileRef = useRef(null);
  const docRef = useRef(null);

  useEffect(() => {
    const uid = getUserId(); setUserId(uid);
    getSessions(uid).then(d => { if (d?.length) setSessions(d); });
  }, []);

  const sess = sessions[activeIdx] || sessions[0];
  const msgs = sess?.messages || [initMsg];

  async function newSession() {
    const s = newSess(); setSessions(p => [s, ...p]); setActiveIdx(0);
    if (userId) await saveSession(userId, s);
  }

  async function removeSession(idx) {
    const s = sessions[idx];
    if (userId && s.messages.length > 2) {
      try {
        const conv = s.messages.filter((_, i) => i > 0).map(m => `${m.role === "user" ? "U" : "A"}: ${(typeof m.content === "string" ? m.content : "").slice(0, 200)}`).join("\n");
        const rez = await apiFetch([{ role: "user", content: conv }], profil, "rezumat", {});
        await addMemory(userId, rez, "conversatie");
      } catch(e) { console.error(e); }
    }
    if (userId) await deleteSession(userId, s.id);
    if (sessions.length === 1) { const ns = newSess(); setSessions([ns]); setActiveIdx(0); return; }
    setSessions(p => p.filter((_, i) => i !== idx)); setActiveIdx(0);
  }

  function updateMsgs(newMsgs) {
    setSessions(prev => {
      const updated = [...prev];
      const firstUser = newMsgs.find(m => m.role === "user");
      const title = firstUser && updated[activeIdx]?.title === "Conversație nouă"
        ? (typeof firstUser.content === "string" ? firstUser.content : "Chat").slice(0, 35) + "..."
        : updated[activeIdx]?.title;
      updated[activeIdx] = { ...updated[activeIdx], messages: newMsgs, title };
      if (userId) saveSession(userId, updated[activeIdx]);
      return updated;
    });
  }

  function handleImg(e) {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => { setImagine({ data: r.result.split(",")[1], type: f.type }); setImaginePreview(r.result); setDocFile(null); setDocNume(null); };
    r.readAsDataURL(f);
  }

  function handleDoc(e) {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => { setDocFile({ data: r.result.split(",")[1], type: f.type }); setDocNume(f.name); setImagine(null); setImaginePreview(null); };
    r.readAsDataURL(f);
  }

  function clearAttach() {
    setImagine(null); setImaginePreview(null); setDocFile(null); setDocNume(null);
    if (fileRef.current) fileRef.current.value = "";
    if (docRef.current) docRef.current.value = "";
  }

  async function saveFav(content) {
    if (userId) await addFavorit(userId, { title: content.slice(0, 50) + "...", content });
    alert("✅ Salvat la favorite!");
  }

  function detectTip(text) {
    if (!text) return undefined;
    const t = text.toLowerCase();
    if (t.includes("sport") || t.includes("exerci") || t.includes("antren") || t.includes("miscare") || t.includes("mișcare") || t.includes("tai-chi") || t.includes("yoga") || t.includes("genunchi")) return "sport";
    return undefined;
  }

  async function sendMsg(txt) {
    let apiContent = [];
    if (imagine) {
      apiContent.push({ type: "image", source: { type: "base64", media_type: imagine.type, data: imagine.data } });
      apiContent.push({ type: "text", text: txt || "Analizează această imagine în contextul nutriției mele." });
    } else if (docFile) {
      apiContent.push({ type: "document", source: { type: "base64", media_type: docFile.type, data: docFile.data } });
      apiContent.push({ type: "text", text: txt || "Citește documentul și extrage informațiile relevante." });
    } else { apiContent = txt; }

    const dispMsg = { role: "user", content: txt || (imagine ? "📷 Poză" : `📄 ${docNume}`), imagine: imaginePreview, docNume };
    const newMsgs = [...msgs, dispMsg];
    updateMsgs(newMsgs);
    clearAttach();
    setLoading(true);

    const apiMsgs = newMsgs.map((m, i) => ({ role: m.role, content: i === newMsgs.length - 1 ? apiContent : (typeof m.content === "string" ? m.content : m.content) }));

    try {
      const tip = detectTip(txt);
      const reply = await apiFetch(apiMsgs, profil, tip, globalContext);
      updateMsgs([...newMsgs, { role: "assistant", content: reply }]);
    } catch { updateMsgs([...newMsgs, { role: "assistant", content: "Eroare. Încearcă din nou." }]); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <div style={{ display: "flex", gap: 6, padding: "0 20px 10px", overflowX: "auto" }}>
        <button onClick={newSession} style={{ background: "#22c55e", border: "none", borderRadius: 20, color: "white", padding: "5px 12px", fontSize: 12, cursor: "pointer", flexShrink: 0 }}>+ Nou</button>
        {sessions.map((s, i) => (
          <div key={s.id} onClick={() => setActiveIdx(i)} style={{ display: "flex", alignItems: "center", gap: 4, background: i === activeIdx ? "#1a2a1a" : "#1a1f2e", border: `1px solid ${i === activeIdx ? "#22c55e" : "#2a3040"}`, borderRadius: 20, padding: "4px 10px", cursor: "pointer", flexShrink: 0 }}>
            <span style={{ color: i === activeIdx ? "#22c55e" : "#94a3b8", fontSize: 11, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</span>
            <span onClick={e => { e.stopPropagation(); removeSession(i); }} style={{ color: "#ef4444", fontSize: 11, cursor: "pointer", marginLeft: 2 }}>✕</span>
          </div>
        ))}
      </div>

      <div style={{ flex: 1, padding: "0 20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, paddingBottom: 8 }}>
        {msgs.map((msg, i) => (
          <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", flexDirection: "column", alignItems: msg.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{ maxWidth: "85%", padding: "12px 16px", borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px", background: msg.role === "user" ? "linear-gradient(135deg, #16a34a, #22c55e)" : "#1a1f2e", border: msg.role === "assistant" ? "1px solid #2a3040" : "none", color: msg.role === "user" ? "#fff" : "#e2e8f0", fontSize: 14, lineHeight: 1.7 }}>
              {msg.imagine && <img src={msg.imagine} alt="" style={{ width: "100%", borderRadius: 8, marginBottom: 8, maxHeight: 200, objectFit: "cover" }} />}
              {msg.docNume && <div style={{ background: "rgba(255,255,255,0.15)", borderRadius: 8, padding: "6px 10px", marginBottom: 8, fontSize: 12 }}>📄 {msg.docNume}</div>}
              <FormatText text={typeof msg.content === "string" ? msg.content : ""} />
            </div>
            {msg.role === "assistant" && i > 0 && (
              <button onClick={() => saveFav(msg.content)} style={{ background: "transparent", border: "none", color: "#4ade80", fontSize: 11, cursor: "pointer", marginTop: 2 }}>❤️ Salvează</button>
            )}
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex" }}>
            <div style={{ padding: "12px 16px", borderRadius: "18px 18px 18px 4px", background: "#1a1f2e", border: "1px solid #2a3040", display: "flex", gap: 5, alignItems: "center" }}>
              {[0,1,2].map(d => <div key={d} style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", animation: "bounce 1.2s infinite", animationDelay: `${d*0.2}s` }} />)}
              <span style={{ color: "#4a5568", fontSize: 11, marginLeft: 4 }}>Caut + gândesc...</span>
            </div>
          </div>
        )}
      </div>

      {msgs.length <= 1 && (
        <div style={{ padding: "6px 20px", display: "flex", flexWrap: "wrap", gap: 6 }}>
          {SUGGESTIONS.map((s, i) => <button key={i} onClick={() => sendMsg(s)} style={{ background: "#1a1f2e", border: "1px solid #2a3a2a", borderRadius: 20, color: "#86efac", fontSize: 12, padding: "5px 10px", cursor: "pointer" }}>{s}</button>)}
        </div>
      )}

      {(imaginePreview || docNume) && (
        <div style={{ padding: "0 20px 6px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 10, padding: "5px 10px" }}>
            {imaginePreview && <img src={imaginePreview} alt="" style={{ height: 45, borderRadius: 6 }} />}
            {docNume && <span style={{ color: "#86efac", fontSize: 12 }}>📄 {docNume}</span>}
            <button onClick={clearAttach} style={{ width: 18, height: 18, borderRadius: "50%", background: "#ef4444", border: "none", color: "white", fontSize: 10, cursor: "pointer" }}>✕</button>
          </div>
        </div>
      )}

      <div style={{ padding: "6px 20px 14px" }}>
        <div style={{ display: "flex", gap: 6, background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 16, padding: "6px 6px 6px 12px", alignItems: "flex-end" }}>
          <button onClick={() => fileRef.current?.click()} style={{ width: 32, height: 32, borderRadius: 8, background: "#2a3040", border: "none", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>📷</button>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleImg} style={{ display: "none" }} />
          <button onClick={() => docRef.current?.click()} style={{ width: 32, height: 32, borderRadius: 8, background: "#2a3040", border: "none", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>📄</button>
          <input ref={docRef} type="file" accept=".pdf,.txt,.doc,.docx" onChange={handleDoc} style={{ display: "none" }} />
          <textarea onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); const v = e.target.value.trim(); if (v) { e.target.value = ""; sendMsg(v); } } }} placeholder="Întreabă orice — știu tot despre tine..." rows={1} style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#e2e8f0", fontSize: 14, resize: "none", fontFamily: "inherit", paddingTop: 4 }} />
          <button onClick={() => { const ta = document.querySelector("textarea"); const v = ta?.value?.trim(); if (v) { ta.value = ""; sendMsg(v); } }} style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #16a34a, #22c55e)", border: "none", cursor: "pointer", fontSize: 16, color: "white", flexShrink: 0 }}>↑</button>
        </div>
        <div style={{ textAlign: "center", color: "#1a2a1a", fontSize: 10, marginTop: 3 }}>🧠 Memorie · 🔍 Web search · 👤 Personalizat</div>
      </div>
    </div>
  );
}

// ─── FAVORITE TAB ─────────────────────────────────────────────────────────────
function FavoriteTab() {
  const [favorites, setFavorites] = useState([]);
  const [userId, setUserId] = useState(null);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => { const uid = getUserId(); setUserId(uid); getFavorite(uid).then(d => setFavorites(d || [])); }, []);
  async function sterge(id) { if (userId) await deleteFavorit(userId, id); setFavorites(p => p.filter(f => f.id !== id)); }

  return (
    <div style={{ padding: "0 20px", overflowY: "auto", flex: 1 }}>
      {!favorites.length ? (
        <div style={{ textAlign: "center", color: "#4a5568", padding: "60px 20px" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>❤️</div>
          <div>Nicio rețetă salvată.</div>
          <div style={{ fontSize: 12, marginTop: 8 }}>Apasă "❤️ Salvează" sub orice răspuns din Chat.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingBottom: 20 }}>
          {favorites.map(f => (
            <div key={f.id} style={{ background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 14, padding: "14px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ color: "#22c55e", fontSize: 13, fontWeight: 600 }}>{f.title}</span>
                <button onClick={() => sterge(f.id)} style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer" }}>🗑️</button>
              </div>
              <div style={{ color: "#4a5568", fontSize: 11, marginBottom: 8 }}>{new Date(f.created_at).toLocaleDateString("ro-RO")}</div>
              <div style={{ color: "#e2e8f0", fontSize: 13, lineHeight: 1.6, maxHeight: expanded === f.id ? "none" : 120, overflow: "hidden" }}>
                <FormatText text={f.content} />
              </div>
              {f.content?.length > 300 && (
                <button onClick={() => setExpanded(expanded === f.id ? null : f.id)} style={{ background: "transparent", border: "none", color: "#22c55e", fontSize: 12, cursor: "pointer", marginTop: 4 }}>
                  {expanded === f.id ? "▲ Mai puțin" : "▼ Vezi tot"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── JURNAL TAB ───────────────────────────────────────────────────────────────
const TIP_MASA_CONFIG = {
  mic_dejun: { label: "🌅 Mic dejun", color: "#f59e0b" },
  pranz: { label: "☀️ Prânz", color: "#22c55e" },
  cina: { label: "🌙 Cină", color: "#8b5cf6" },
  gustare: { label: "🍎 Gustare", color: "#3b82f6" },
  apa: { label: "💧 Apă", color: "#06b6d4" },
};

function JurnalMasaChat({ userId, data, tipMasa, profil, globalContext, onUpdate }) {
  const config = TIP_MASA_CONFIG[tipMasa];
  const [entry, setEntry] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [apaInput, setApaInput] = useState("");

  useEffect(() => {
    if (!userId || !data) return;
    setLoadingData(true);
    getJurnalZi(userId, data).then(entries => {
      const found = entries.find(e => e.tip_masa === tipMasa);
      setEntry(found || { tip_masa: tipMasa, messages: [], calorii: 0, proteine: 0, carbohidrati: 0, zaharuri: 0, grasimi: 0, sare: 0, apa_ml: 0 });
      setLoadingData(false);
    });
  }, [userId, data, tipMasa]);

  async function saveEntry(updatedEntry) {
    if (!userId) return;
    await saveJurnalEntry(userId, { data, ...updatedEntry });
    setEntry(updatedEntry);
    if (onUpdate) onUpdate();
  }

  async function sendMsg(txt) {
    if (!txt.trim() || !userId) return;
    const msgs = entry?.messages || [];

    // For apa tab
    if (tipMasa === "apa") {
      const ml = parseInt(txt.replace(/[^0-9]/g, "")) || 0;
      const newApa = (entry?.apa_ml || 0) + ml;
      const userMsg = { role: "user", content: txt };
      const assistantMsg = { role: "assistant", content: `💧 Ai adăugat **${ml} ml** apă.\n**Total apă azi: ${newApa} ml**\n\n${newApa >= 2000 ? "✅ Excelent! Ai atins minimul recomandat de hidratare." : `⚠️ Mai ai nevoie de aproximativ **${2000 - newApa} ml** pentru a atinge minimul de 2L.`}` };
      const newMsgs = [...msgs, userMsg, assistantMsg];
      await saveEntry({ ...entry, messages: newMsgs, apa_ml: newApa, item: "apa" });
      return;
    }

    setLoading(true);
    const userMsg = { role: "user", content: txt };
    const newMsgsTemp = [...msgs, userMsg];
    setEntry(prev => ({ ...prev, messages: newMsgsTemp }));

    try {
      const apiMsgs = newMsgsTemp.map(m => ({ role: m.role, content: m.content }));
      const reply = await apiFetch(apiMsgs, profil, "jurnal", globalContext);

      // Extract values from reply
      const getNum = (text, pat) => { const m = text.match(pat); return m ? parseFloat(m[1]) : 0; };
      const calorii = getNum(reply, /Calorii[^:]*:\s*~?([\d.]+)/i);
      const proteine = getNum(reply, /Proteine[^:]*:\s*~?([\d.]+)/i);
      const carbohidrati = getNum(reply, /Carbohidra[^:]*:\s*~?([\d.]+)/i);
      const zaharuri = getNum(reply, /Zah[^:]*:\s*~?([\d.]+)/i);
      const grasimi = getNum(reply, /Gr[aă]simi[^:]*:\s*~?([\d.]+)/i);
      const sare = getNum(reply, /Sare[^:]*:\s*~?([\d.]+)/i);

      const assistantMsg = { role: "assistant", content: reply };
      const newMsgsFinal = [...newMsgsTemp, assistantMsg];

      const updatedEntry = {
        ...entry,
        messages: newMsgsFinal,
        item: txt.slice(0, 100),
        calorii: Math.max(entry?.calorii || 0, calorii),
        proteine: Math.max(entry?.proteine || 0, proteine),
        carbohidrati: Math.max(entry?.carbohidrati || 0, carbohidrati),
        zaharuri: Math.max(entry?.zaharuri || 0, zaharuri),
        grasimi: Math.max(entry?.grasimi || 0, grasimi),
        sare: Math.max(entry?.sare || 0, sare),
        analiza: reply,
      };
      await saveEntry(updatedEntry);
    } catch(e) {
      console.error(e);
      const errMsg = { role: "assistant", content: "Eroare. Încearcă din nou." };
      const newMsgs = [...newMsgsTemp, errMsg];
      setEntry(prev => ({ ...prev, messages: newMsgs }));
    } finally { setLoading(false); }
  }

  if (loadingData) return <div style={{ textAlign: "center", color: "#4a5568", padding: "20px" }}>Se încarcă...</div>;

  const msgs = entry?.messages || [];

  return (
    <div style={{ background: "#1a1f2e", border: `1px solid ${config.color}33`, borderRadius: 14, padding: "14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ color: config.color, fontWeight: 700, fontSize: 14 }}>{config.label}</span>
        {entry?.calorii > 0 && tipMasa !== "apa" && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[["kcal", entry.calorii, config.color], ["P", entry.proteine + "g", "#3b82f6"], ["C", entry.carbohidrati + "g", "#f59e0b"], ["G", entry.grasimi + "g", "#8b5cf6"], ["🧂", entry.sare + "g", "#94a3b8"]].map(([l, v, c]) => (
              <span key={l} style={{ background: "#0f1117", borderRadius: 6, padding: "2px 8px", fontSize: 11, color: c }}>{l}: {typeof v === "number" ? Math.round(v) : v}</span>
            ))}
          </div>
        )}
        {tipMasa === "apa" && entry?.apa_ml > 0 && (
          <span style={{ color: "#06b6d4", fontWeight: 700, fontSize: 14 }}>💧 {entry.apa_ml} ml total</span>
        )}
      </div>

      {tipMasa === "apa" ? (
        <div>
          <MiniChat
            messages={msgs}
            onSend={sendMsg}
            loading={loading}
            placeholder="ex: 250 ml, 1 pahar, 500 ml apă minerală..."
            profil={profil}
            context={globalContext}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            {[150, 250, 330, 500].map(ml => (
              <button key={ml} onClick={() => sendMsg(`${ml} ml`)} style={{ flex: 1, padding: "6px", background: "#0f1117", border: "1px solid #06b6d4", borderRadius: 8, color: "#06b6d4", fontSize: 12, cursor: "pointer" }}>{ml}ml</button>
            ))}
          </div>
        </div>
      ) : (
        <MiniChat
          messages={msgs}
          onSend={sendMsg}
          loading={loading}
          placeholder={`Descrie ce ai mâncat la ${config.label.toLowerCase()}...`}
          profil={profil}
          context={globalContext}
        />
      )}
    </div>
  );
}

function JurnalTab({ profil, globalContext }) {
  const azi = new Date().toISOString().split("T")[0];
  const [data, setData] = useState(azi);
  const [userId, setUserId] = useState(null);
  const [activeMasa, setActiveMasa] = useState("mic_dejun");
  const [sumar, setSumar] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => { const uid = getUserId(); setUserId(uid); }, []);

  async function loadSumar() {
    if (!userId) return;
    const entries = await getJurnalZi(userId, data);
    if (!entries.length) { setSumar(null); return; }
    const totale = entries.reduce((acc, e) => ({
      calorii: acc.calorii + (parseFloat(e.calorii) || 0),
      proteine: acc.proteine + (parseFloat(e.proteine) || 0),
      carbohidrati: acc.carbohidrati + (parseFloat(e.carbohidrati) || 0),
      zaharuri: acc.zaharuri + (parseFloat(e.zaharuri) || 0),
      grasimi: acc.grasimi + (parseFloat(e.grasimi) || 0),
      sare: acc.sare + (parseFloat(e.sare) || 0),
      apa: acc.apa + (parseFloat(e.apa_ml) || 0),
    }), { calorii: 0, proteine: 0, carbohidrati: 0, zaharuri: 0, grasimi: 0, sare: 0, apa: 0 });
    setSumar(totale);
  }

  useEffect(() => { if (userId) loadSumar(); }, [userId, data, refreshKey]);

  const targetCalorii = parseInt(profil?.calorii) || 1600;
  const procentCal = sumar ? Math.min(100, Math.round((sumar.calorii / targetCalorii) * 100)) : 0;
  const apaRec = Math.round(((parseFloat(profil?.greutate) || 80) * 35) + (Math.max(0, (sumar?.sare || 0) - 2) * 200));

  return (
    <div style={{ padding: "0 20px", overflowY: "auto", flex: 1 }}>
      {/* Date */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input type="date" value={data} onChange={e => setData(e.target.value)} style={{ flex: 1, background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 10, color: "#e2e8f0", padding: "8px 12px", fontSize: 14, outline: "none" }} />
      </div>

      {/* Sumar zi */}
      {sumar && (
        <div style={{ background: "#1a2a1a", border: "1px solid #2a4a2a", borderRadius: 14, padding: "12px", marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ color: "#22c55e", fontSize: 13, fontWeight: 700 }}>📊 Sumar zi</span>
            <span style={{ color: procentCal > 100 ? "#ef4444" : "#22c55e", fontSize: 13, fontWeight: 700 }}>{Math.round(sumar.calorii)} / {targetCalorii} kcal</span>
          </div>
          <div style={{ background: "#2a3040", borderRadius: 4, height: 6, marginBottom: 8 }}>
            <div style={{ background: procentCal > 100 ? "#ef4444" : "linear-gradient(90deg, #22c55e, #4ade80)", height: "100%", width: `${procentCal}%`, borderRadius: 4 }} />
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[["P", sumar.proteine, "g", "#3b82f6"], ["C", sumar.carbohidrati, "g", "#f59e0b"], ["Z", sumar.zaharuri, "g", "#ec4899"], ["G", sumar.grasimi, "g", "#8b5cf6"], ["🧂", sumar.sare, "g", "#94a3b8"], ["💧", sumar.apa, "ml", "#06b6d4"]].map(([l, v, u, c]) => (
              <span key={l} style={{ background: "#0f1117", borderRadius: 6, padding: "2px 8px", fontSize: 11, color: c }}>{l}: {Math.round(v)}{u}</span>
            ))}
          </div>
          <div style={{ color: "#06b6d4", fontSize: 11, marginTop: 6 }}>💧 Apă recomandată azi: {apaRec} ml {sumar.apa >= apaRec ? "✅" : `(mai bei ${apaRec - Math.round(sumar.apa)} ml)`}</div>
        </div>
      )}

      {/* Tip masa tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12, overflowX: "auto" }}>
        {Object.entries(TIP_MASA_CONFIG).map(([key, cfg]) => (
          <button key={key} onClick={() => setActiveMasa(key)} style={{ flexShrink: 0, padding: "6px 12px", background: activeMasa === key ? cfg.color + "22" : "#1a1f2e", border: `1px solid ${activeMasa === key ? cfg.color : "#2a3040"}`, borderRadius: 20, color: activeMasa === key ? cfg.color : "#94a3b8", fontSize: 12, fontWeight: activeMasa === key ? 700 : 400, cursor: "pointer", whiteSpace: "nowrap" }}>
            {cfg.label}
          </button>
        ))}
      </div>

      {/* Active masa chat */}
      {userId && (
        <JurnalMasaChat
          key={`${userId}-${data}-${activeMasa}`}
          userId={userId}
          data={data}
          tipMasa={activeMasa}
          profil={profil}
          globalContext={globalContext}
          onUpdate={() => setRefreshKey(k => k + 1)}
        />
      )}
    </div>
  );
}

// ─── SAPTAMANA TAB ────────────────────────────────────────────────────────────
function SaptamanaTab({ profil }) {
  const [plan, setPlan] = useState(() => loadLS("plan_saptamana", null));
  const [loading, setLoading] = useState(false);

  async function genereaza() {
    setLoading(true);
    try {
      const reply = await apiFetch(
        [{ role: "user", content: `Generează plan alimentar COMPLET 7 zile. Pentru FIECARE masă:\n- Ingrediente cu gramaje EXACTE\n- Pași PAS CU PAS pentru un începător absolut\n- Timpi și temperaturi exacte\n- Sfaturi practice\n- Tabel: kcal | Proteine | Carbohidrați | Zahăr | Grăsimi | Sare\n- Total pe zi + apă recomandată\nRespectă: ${profil?.calorii || 1600} kcal/zi, ${profil?.restrictii || "fără gluten, low-carb"}.` }],
        profil, "plan", {}
      );
      setPlan(reply); saveLS("plan_saptamana", reply);
    } catch { alert("Eroare. Încearcă din nou."); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ padding: "0 20px", overflowY: "auto", flex: 1 }}>
      <button onClick={genereaza} disabled={loading} style={{ width: "100%", padding: "14px", background: loading ? "#2a3040" : "linear-gradient(135deg, #16a34a, #22c55e)", border: "none", borderRadius: 12, color: "white", fontSize: 15, fontWeight: 700, cursor: loading ? "default" : "pointer", marginBottom: 16 }}>
        {loading ? "⏳ Se generează (30-60 sec)..." : "🔄 Generează plan săptămânal cu rețete complete"}
      </button>
      {plan ? (
        <div style={{ background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 14, padding: "16px", color: "#e2e8f0", fontSize: 14, lineHeight: 1.8, paddingBottom: 20 }}>
          <FormatText text={plan} />
        </div>
      ) : (
        <div style={{ textAlign: "center", color: "#4a5568", padding: "60px 0" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📅</div>
          <div>Plan complet cu rețete detaliate pas cu pas.</div>
        </div>
      )}
    </div>
  );
}

// ─── PROGRES TAB ──────────────────────────────────────────────────────────────
function ProgresTab({ profil, globalContext }) {
  const [intrari, setIntrari] = useState([]);
  const [greutate, setGreutate] = useState("");
  const [abdomen, setAbdomen] = useState("");
  const [data, setData] = useState(new Date().toISOString().split("T")[0]);
  const [userId, setUserId] = useState(null);
  const [analiza, setAnaliza] = useState(null);
  const [loadingAnaliza, setLoadingAnaliza] = useState(false);

  useEffect(() => { const uid = getUserId(); setUserId(uid); getProgres(uid).then(d => setIntrari(d || [])); }, []);

  async function adauga() {
    if (!greutate && !abdomen) return;
    await addProgres(userId, { data, greutate: greutate ? parseFloat(greutate) : null, abdomen: abdomen ? parseFloat(abdomen) : null });
    const u = await getProgres(userId); setIntrari(u || []);
    setGreutate(""); setAbdomen("");
  }

  async function sterge(id) { await deleteProgres(userId, id); setIntrari(p => p.filter(i => i.id !== id)); }

  async function cereAnaliza() {
    setLoadingAnaliza(true);
    try {
      const reply = await apiFetch([{ role: "user", content: "Analizează progresul meu complet. Ce merge bine? Ce trebuie îmbunătățit? Cum elimin apa reținută? Cât mai am până la obiectiv?" }], profil, undefined, globalContext);
      setAnaliza(reply);
    } catch { alert("Eroare."); } finally { setLoadingAnaliza(false); }
  }

  const ultima = intrari[intrari.length - 1];
  const prima = intrari[0];
  const diffKg = ultima?.greutate && prima?.greutate && intrari.length > 1 ? (ultima.greutate - prima.greutate).toFixed(1) : null;
  const diffCm = ultima?.abdomen && prima?.abdomen && intrari.length > 1 ? (ultima.abdomen - prima.abdomen).toFixed(1) : null;
  const imcActual = ultima?.greutate && profil?.inaltime ? (ultima.greutate / Math.pow(profil.inaltime / 100, 2)).toFixed(1) : null;
  const progresAbd = diffCm ? Math.min(100, (Math.abs(parseFloat(diffCm)) / 8) * 100) : 0;

  function renderChart(field, color, label) {
    const vals = intrari.filter(i => i[field] != null).map(i => ({ val: parseFloat(i[field]) }));
    if (vals.length < 2) return null;
    const w = 320, h = 90, pad = 16;
    const min = Math.min(...vals.map(v => v.val)) - 0.5, max = Math.max(...vals.map(v => v.val)) + 0.5;
    const pts = vals.map((v, i) => { const x = pad + (i / (vals.length - 1)) * (w - 2*pad); const y = pad + ((max - v.val) / (max - min)) * (h - 2*pad); return `${x},${y}`; }).join(" ");
    return (
      <div style={{ background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 12, padding: "10px", marginBottom: 10 }}>
        <div style={{ color, fontSize: 12, marginBottom: 4 }}>{label}: {vals[0].val} → {vals[vals.length-1].val}</div>
        <svg width="100%" viewBox={`0 0 ${w} ${h}`}>
          <polyline fill="none" stroke={color} strokeWidth="2.5" points={pts} />
          {vals.map((v, i) => { const x = pad + (i / (vals.length-1)) * (w-2*pad); const y = pad + ((max-v.val)/(max-min)) * (h-2*pad); return <circle key={i} cx={x} cy={y} r="4" fill={color} />; })}
        </svg>
      </div>
    );
  }

  return (
    <div style={{ padding: "0 20px", overflowY: "auto", flex: 1 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {ultima?.greutate && <div style={{ flex: 1, minWidth: 70, background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 12, padding: "10px", textAlign: "center" }}><div style={{ color: "#22c55e", fontSize: 18, fontWeight: 700 }}>{ultima.greutate}</div><div style={{ color: "#4a5568", fontSize: 10 }}>kg actual</div></div>}
        {diffKg !== null && <div style={{ flex: 1, minWidth: 70, background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 12, padding: "10px", textAlign: "center" }}><div style={{ color: parseFloat(diffKg) <= 0 ? "#22c55e" : "#ef4444", fontSize: 18, fontWeight: 700 }}>{diffKg > 0 ? "+" : ""}{diffKg}</div><div style={{ color: "#4a5568", fontSize: 10 }}>kg total</div></div>}
        {ultima?.abdomen && <div style={{ flex: 1, minWidth: 70, background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 12, padding: "10px", textAlign: "center" }}><div style={{ color: "#3b82f6", fontSize: 18, fontWeight: 700 }}>{ultima.abdomen}</div><div style={{ color: "#4a5568", fontSize: 10 }}>cm abd.</div></div>}
        {diffCm !== null && <div style={{ flex: 1, minWidth: 70, background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 12, padding: "10px", textAlign: "center" }}><div style={{ color: parseFloat(diffCm) <= 0 ? "#22c55e" : "#ef4444", fontSize: 18, fontWeight: 700 }}>{diffCm > 0 ? "+" : ""}{diffCm}</div><div style={{ color: "#4a5568", fontSize: 10 }}>cm total</div></div>}
        {imcActual && <div style={{ flex: 1, minWidth: 70, background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 12, padding: "10px", textAlign: "center" }}><div style={{ color: "#f59e0b", fontSize: 18, fontWeight: 700 }}>{imcActual}</div><div style={{ color: "#4a5568", fontSize: 10 }}>IMC</div></div>}
      </div>

      {diffCm !== null && (
        <div style={{ background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 12, padding: "10px", marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ color: "#94a3b8", fontSize: 12 }}>🎯 Obiectiv: -8cm abdomen</span>
            <span style={{ color: "#3b82f6", fontSize: 12 }}>{Math.abs(parseFloat(diffCm)).toFixed(1)}/8cm</span>
          </div>
          <div style={{ background: "#2a3040", borderRadius: 4, height: 6 }}>
            <div style={{ background: "linear-gradient(90deg, #3b82f6, #22c55e)", height: "100%", width: `${progresAbd}%`, borderRadius: 4 }} />
          </div>
        </div>
      )}

      {renderChart("greutate", "#22c55e", "⚖️ Greutate (kg)")}
      {renderChart("abdomen", "#3b82f6", "📏 Abdomen (cm)")}

      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <input type="date" value={data} onChange={e => setData(e.target.value)} style={{ flex: 2, minWidth: 120, background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 10, color: "#e2e8f0", padding: "8px 12px", fontSize: 14, outline: "none" }} />
        <input value={greutate} onChange={e => setGreutate(e.target.value)} placeholder="kg" type="number" step="0.1" style={{ width: 65, background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 10, color: "#e2e8f0", padding: "8px 10px", fontSize: 14, outline: "none" }} />
        <input value={abdomen} onChange={e => setAbdomen(e.target.value)} placeholder="cm abd" type="number" step="0.5" style={{ width: 75, background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 10, color: "#e2e8f0", padding: "8px 10px", fontSize: 14, outline: "none" }} />
        <button onClick={adauga} style={{ background: "linear-gradient(135deg, #16a34a, #22c55e)", border: "none", borderRadius: 10, color: "white", padding: "8px 14px", cursor: "pointer", fontSize: 16 }}>+</button>
      </div>

      <button onClick={cereAnaliza} disabled={loadingAnaliza} style={{ width: "100%", padding: "10px", background: "#1a2030", border: "1px solid #3b82f6", borderRadius: 10, color: "#3b82f6", fontSize: 13, fontWeight: 600, cursor: "pointer", marginBottom: 12 }}>
        {loadingAnaliza ? "⏳ Analizez..." : "🤖 Analizează progresul meu cu AI"}
      </button>

      {analiza && <div style={{ background: "#1a2030", border: "1px solid #3b82f6", borderRadius: 14, padding: "14px", marginBottom: 12, color: "#e2e8f0", fontSize: 14, lineHeight: 1.7 }}><FormatText text={analiza} /></div>}

      {!intrari.length ? (
        <div style={{ textAlign: "center", color: "#4a5568", padding: "30px 0" }}><div style={{ fontSize: 36, marginBottom: 10 }}>⚖️</div><div>Adaugă prima înregistrare.</div></div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingBottom: 20 }}>
          {[...intrari].reverse().map(i => (
            <div key={i.id} style={{ background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 12, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "#94a3b8", fontSize: 13 }}>{new Date(i.data + "T12:00:00").toLocaleDateString("ro-RO")}</span>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                {i.greutate && <span style={{ color: "#22c55e", fontWeight: 700 }}>{i.greutate} kg</span>}
                {i.abdomen && <span style={{ color: "#3b82f6", fontWeight: 700 }}>{i.abdomen} cm</span>}
                <button onClick={() => sterge(i.id)} style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer" }}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── SPORT TAB ────────────────────────────────────────────────────────────────
function SportTab({ profil, globalContext }) {
  const azi = new Date().toISOString().split("T")[0];
  const [data, setData] = useState(azi);
  const [userId, setUserId] = useState(null);
  const [sportEntry, setSportEntry] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [planSport, setPlanSport] = useState(() => loadLS("plan_sport_3luni", null));
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [view, setView] = useState("chat"); // "chat" | "plan" | "calendar"
  const [istoricZile, setIstoricZile] = useState([]);

  useEffect(() => { const uid = getUserId(); setUserId(uid); }, []);

  useEffect(() => {
    if (!userId) return;
    setLoadingData(true);
    getSportZi(userId, data).then(entry => { setSportEntry(entry || { data, messages: [] }); setLoadingData(false); });
    getSportIstoric(userId).then(d => setIstoricZile(d || []));
  }, [userId, data]);

  async function sendMsg(txt) {
    if (!txt || !userId) return;
    const msgs = sportEntry?.messages || [];
    const isFirstMsg = msgs.length === 0;
    const tip = isFirstMsg ? "idei_zilnice" : undefined;

    setLoading(true);
    const userMsg = { role: "user", content: txt };
    const newMsgsTemp = [...msgs, userMsg];
    setSportEntry(prev => ({ ...prev, messages: newMsgsTemp }));

    try {
      const apiMsgs = newMsgsTemp.map(m => ({ role: m.role, content: m.content }));
      const reply = await apiFetch(apiMsgs, profil, tip, globalContext);
      const assistantMsg = { role: "assistant", content: reply };
      const newMsgsFinal = [...newMsgsTemp, assistantMsg];
      const updated = { ...sportEntry, data, messages: newMsgsFinal };
      setSportEntry(updated);
      await saveSportZi(userId, data, newMsgsFinal);
    } catch(e) {
      console.error(e);
      setSportEntry(prev => ({ ...prev, messages: [...newMsgsTemp, { role: "assistant", content: "Eroare. Încearcă din nou." }] }));
    } finally { setLoading(false); }
  }

  async function genereazaIdeiAzi() {
    await sendMsg("Dă-mi idei personalizate pentru ziua de azi bazate pe progresul și istoricul meu.");
  }

  async function genereazaPlan() {
    setLoadingPlan(true);
    try {
      const reply = await apiFetch([{ role: "user", content: "Creează-mi un plan sport COMPLET și PROGRESIV pentru 3 luni. Știi că am 44 ani, stil sedentar, genunchi sensibili și spate neantrenat. Vreau să mă apuc ușor-ușor, fără să mă rănesc. Include exerciții de tai-chi, stretching, yoga blând și mers progresiv. Explică EXACT cum se execută fiecare exercițiu." }], profil, "sport", globalContext);
      setPlanSport(reply); saveLS("plan_sport_3luni", reply);
    } catch { alert("Eroare."); } finally { setLoadingPlan(false); }
  }

  const msgs = sportEntry?.messages || [];

  return (
    <div style={{ padding: "0 20px", overflowY: "auto", flex: 1 }}>
      {/* View selector */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {[["chat", "💬 Chat zilnic"], ["plan", "📋 Plan 3 luni"], ["calendar", "📅 Calendar"]].map(([v, l]) => (
          <button key={v} onClick={() => setView(v)} style={{ flex: 1, padding: "8px", background: view === v ? "linear-gradient(135deg, #16a34a, #22c55e)" : "#1a1f2e", border: `1px solid ${view === v ? "transparent" : "#2a3040"}`, borderRadius: 10, color: view === v ? "white" : "#94a3b8", fontSize: 12, fontWeight: view === v ? 700 : 400, cursor: "pointer" }}>{l}</button>
        ))}
      </div>

      {view === "chat" && (
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input type="date" value={data} onChange={e => setData(e.target.value)} style={{ flex: 1, background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 10, color: "#e2e8f0", padding: "8px 12px", fontSize: 14, outline: "none" }} />
            <button onClick={genereazaIdeiAzi} disabled={loading} style={{ padding: "8px 14px", background: "linear-gradient(135deg, #f59e0b, #d97706)", border: "none", borderRadius: 10, color: "white", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
              💡 Idei azi
            </button>
          </div>

          {loadingData ? <div style={{ textAlign: "center", color: "#4a5568", padding: "20px" }}>Se încarcă...</div> : (
            <div style={{ background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 14, padding: "14px" }}>
              {msgs.length === 0 && (
                <div style={{ textAlign: "center", color: "#4a5568", padding: "20px 0", marginBottom: 10 }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🏃</div>
                  <div style={{ fontSize: 13 }}>Apasă "💡 Idei azi" sau pune o întrebare despre sport și mișcare.</div>
                </div>
              )}
              <MiniChat messages={msgs} onSend={sendMsg} loading={loading} placeholder="ex: Am mers 5km azi. Câte calorii am ars? Ce exerciții fac mâine?" profil={profil} context={globalContext} />
            </div>
          )}
        </div>
      )}

      {view === "plan" && (
        <div>
          <button onClick={genereazaPlan} disabled={loadingPlan} style={{ width: "100%", padding: "14px", background: loadingPlan ? "#2a3040" : "linear-gradient(135deg, #16a34a, #22c55e)", border: "none", borderRadius: 12, color: "white", fontSize: 15, fontWeight: 700, cursor: loadingPlan ? "default" : "pointer", marginBottom: 16 }}>
            {loadingPlan ? "⏳ Generez plan (30-60 sec)..." : "🏃 Generează plan sport 3 luni adaptat mie"}
          </button>
          {planSport ? (
            <div style={{ background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 14, padding: "16px", color: "#e2e8f0", fontSize: 14, lineHeight: 1.8, paddingBottom: 20 }}>
              <FormatText text={planSport} />
            </div>
          ) : (
            <div style={{ textAlign: "center", color: "#4a5568", padding: "40px 0" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🏃</div>
              <div>Plan adaptat pentru genunchii și spatele tău. Include tai-chi, stretching, mers progresiv.</div>
            </div>
          )}
        </div>
      )}

      {view === "calendar" && (
        <div>
          <div style={{ color: "#94a3b8", fontSize: 13, fontWeight: 600, marginBottom: 10 }}>📅 Zile cu activitate înregistrată:</div>
          {!istoricZile.length ? (
            <div style={{ textAlign: "center", color: "#4a5568", padding: "40px 0" }}>Nicio zi înregistrată încă. Începe din tab-ul Chat!</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingBottom: 20 }}>
              {istoricZile.map(zi => (
                <div key={zi.id} onClick={() => { setData(zi.data); setView("chat"); }}
                  style={{ background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 12, padding: "12px 16px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ color: "#22c55e", fontSize: 14, fontWeight: 600 }}>{new Date(zi.data + "T12:00:00").toLocaleDateString("ro-RO", { weekday: "long", day: "numeric", month: "long" })}</div>
                    <div style={{ color: "#4a5568", fontSize: 11, marginTop: 2 }}>{zi.messages?.length || 0} mesaje · Apasă pentru a vedea</div>
                  </div>
                  <span style={{ color: "#22c55e", fontSize: 18 }}>→</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── REMINDER TAB ─────────────────────────────────────────────────────────────
function ReminderTab() {
  const DEFAULT = [
    { id: 1, label: "Mic dejun", ora: "08:00", activ: true },
    { id: 2, label: "Gustare dimineață", ora: "10:30", activ: false },
    { id: 3, label: "Prânz", ora: "13:00", activ: true },
    { id: 4, label: "Gustare după-amiază", ora: "16:00", activ: false },
    { id: 5, label: "Cină", ora: "19:00", activ: true },
    { id: 6, label: "💧 Apă", ora: "09:00", activ: true },
    { id: 7, label: "💧 Apă", ora: "14:00", activ: true },
    { id: 8, label: "💧 Apă", ora: "18:00", activ: true },
    { id: 9, label: "🏃 Mișcare / Sport", ora: "17:30", activ: false },
  ];
  const [reminders, setReminders] = useState(() => loadLS("remindere", DEFAULT));
  const [permisiune, setPermisiune] = useState(null);
  const [nou, setNou] = useState({ label: "", ora: "12:00" });

  useEffect(() => { if ("Notification" in window) setPermisiune(Notification.permission); }, []);
  async function cerePermisiune() { const r = await Notification.requestPermission(); setPermisiune(r); }
  function toggle(id) { const u = reminders.map(r => r.id === id ? { ...r, activ: !r.activ } : r); setReminders(u); saveLS("remindere", u); }
  function updateOra(id, ora) { const u = reminders.map(r => r.id === id ? { ...r, ora } : r); setReminders(u); saveLS("remindere", u); }
  function adauga() { if (!nou.label.trim()) return; const u = [...reminders, { id: Date.now(), label: nou.label.trim(), ora: nou.ora, activ: true }]; setReminders(u); saveLS("remindere", u); setNou({ label: "", ora: "12:00" }); }
  function sterge(id) { const u = reminders.filter(r => r.id !== id); setReminders(u); saveLS("remindere", u); }

  return (
    <div style={{ padding: "0 20px", overflowY: "auto", flex: 1 }}>
      <div style={{ background: "#1a1f2e", border: `1px solid ${permisiune === "granted" ? "#2a4a2a" : "#4a3020"}`, borderRadius: 14, padding: "14px", marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ color: "#e2e8f0", fontSize: 14, fontWeight: 600 }}>Notificări browser</div>
            <div style={{ color: "#4a5568", fontSize: 12 }}>{permisiune === "granted" ? "✅ Active" : "⚠️ Neactivate — activează pentru remindere"}</div>
          </div>
          {permisiune !== "granted" && <button onClick={cerePermisiune} style={{ background: "linear-gradient(135deg, #16a34a, #22c55e)", border: "none", borderRadius: 10, color: "white", padding: "8px 14px", cursor: "pointer", fontSize: 13 }}>Activează</button>}
          {permisiune === "granted" && <button onClick={() => new Notification("Agent Nutriție 🥦", { body: "Funcționează!" })} style={{ background: "#1a2a1a", border: "1px solid #2a4a2a", borderRadius: 10, color: "#22c55e", padding: "8px 14px", cursor: "pointer", fontSize: 13 }}>Testează</button>}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
        {reminders.map(r => (
          <div key={r.id} style={{ background: "#1a1f2e", border: `1px solid ${r.activ ? "#2a4a2a" : "#2a3040"}`, borderRadius: 12, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={() => toggle(r.id)} style={{ width: 38, height: 22, borderRadius: 11, background: r.activ ? "#22c55e" : "#2a3040", border: "none", cursor: "pointer", position: "relative", flexShrink: 0 }}>
              <div style={{ width: 18, height: 18, borderRadius: "50%", background: "white", position: "absolute", top: 2, left: r.activ ? 18 : 2, transition: "left 0.2s" }} />
            </button>
            <span style={{ flex: 1, color: r.activ ? "#e2e8f0" : "#4a5568", fontSize: 13 }}>{r.label}</span>
            <input type="time" value={r.ora} onChange={e => updateOra(r.id, e.target.value)} style={{ background: "#0f1117", border: "1px solid #2a3040", borderRadius: 8, color: "#e2e8f0", padding: "4px 8px", fontSize: 12, outline: "none" }} />
            <button onClick={() => sterge(r.id)} style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 13 }}>✕</button>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, paddingBottom: 20 }}>
        <input value={nou.label} onChange={e => setNou(p => ({ ...p, label: e.target.value }))} placeholder="Nume reminder..." style={{ flex: 1, background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 10, color: "#e2e8f0", padding: "8px 12px", fontSize: 13, outline: "none" }} onKeyDown={e => e.key === "Enter" && adauga()} />
        <input type="time" value={nou.ora} onChange={e => setNou(p => ({ ...p, ora: e.target.value }))} style={{ background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 10, color: "#e2e8f0", padding: "8px 12px", fontSize: 13, outline: "none" }} />
        <button onClick={adauga} style={{ background: "linear-gradient(135deg, #16a34a, #22c55e)", border: "none", borderRadius: 10, color: "white", padding: "8px 14px", cursor: "pointer", fontSize: 15 }}>+</button>
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
  const camRef = useRef(null);

  function handleFile(e) {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => { setImagine({ data: r.result.split(",")[1], type: f.type }); setPreview(r.result); setRezultat(null); };
    r.readAsDataURL(f);
  }

  async function analizeaza() {
    if (!imagine) return; setLoading(true);
    try {
      const reply = await apiFetch([{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: imagine.type, data: imagine.data } }, { type: "text", text: `Analizează acest produs. Caută online valorile exacte dacă e un produs de marcă. Spune:\n1. Valori per 100g și per porție: kcal, proteine, carbohidrați, zahăr, grăsimi, sare\n2. Ingrediente principale\n3. ✅ DA sau ❌ NU pentru dieta mea (${profil?.restrictii || "fără gluten, low-carb"}) cu motiv\n4. Cât pot mânca pe zi respectând targetul meu de ${profil?.calorii || 1600} kcal.` }] }], profil, undefined, {});
      setRezultat(reply);
      const item = { id: Date.now(), preview, rezultat: reply, data: new Date().toLocaleDateString("ro-RO") };
      const u = [item, ...istoric].slice(0, 20); setIstoric(u); saveLS("istoric_produse", u);
    } catch { setRezultat("Eroare. Încearcă din nou."); } finally { setLoading(false); }
  }

  function reset() { setImagine(null); setPreview(null); setRezultat(null); if (fileRef.current) fileRef.current.value = ""; if (camRef.current) camRef.current.value = ""; }

  return (
    <div style={{ padding: "0 20px", overflowY: "auto", flex: 1 }}>
      {!preview ? (
        <div>
          <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
            <button onClick={() => camRef.current?.click()} style={{ flex: 1, padding: "14px", background: "linear-gradient(135deg, #16a34a, #22c55e)", border: "none", borderRadius: 14, color: "white", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>📷 Fotografiază produs</button>
            <button onClick={() => fileRef.current?.click()} style={{ flex: 1, padding: "14px", background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 14, color: "#94a3b8", fontSize: 14, cursor: "pointer" }}>🖼️ Din galerie</button>
          </div>
          <input ref={camRef} type="file" accept="image/*" capture="environment" onChange={handleFile} style={{ display: "none" }} />
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />
          <div style={{ color: "#4a5568", fontSize: 13, textAlign: "center", marginBottom: 14 }}>Fotografiază eticheta — agentul caută valorile exacte online și îți spune dacă e potrivit.</div>
          {!!istoric.length && (
            <div>
              <div style={{ color: "#94a3b8", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Analizate recent:</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingBottom: 20 }}>
                {istoric.slice(0, 5).map(item => (
                  <div key={item.id} style={{ background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 12, padding: "10px 14px", display: "flex", gap: 10, alignItems: "center" }}>
                    <img src={item.preview} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
                    <div style={{ flex: 1, overflow: "hidden" }}>
                      <div style={{ color: "#e2e8f0", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.rezultat?.slice(0, 60)}...</div>
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
          <img src={preview} alt="" style={{ width: "100%", borderRadius: 14, maxHeight: 220, objectFit: "cover", marginBottom: 12 }} />
          {!rezultat ? (
            <button onClick={analizeaza} disabled={loading} style={{ width: "100%", padding: "14px", background: loading ? "#2a3040" : "linear-gradient(135deg, #16a34a, #22c55e)", border: "none", borderRadius: 12, color: "white", fontSize: 15, fontWeight: 700, cursor: loading ? "default" : "pointer", marginBottom: 10 }}>
              {loading ? "🔍 Caut online + analizez..." : "🔍 Analizează produsul"}
            </button>
          ) : (
            <div style={{ background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 14, padding: "14px", color: "#e2e8f0", fontSize: 14, lineHeight: 1.7, marginBottom: 10 }}><FormatText text={rezultat} /></div>
          )}
          <button onClick={reset} style={{ width: "100%", padding: "10px", background: "transparent", border: "1px solid #2a3040", borderRadius: 12, color: "#94a3b8", fontSize: 14, cursor: "pointer" }}>← Analizează alt produs</button>
        </div>
      )}
    </div>
  );
}

// ─── RETETE TAB ───────────────────────────────────────────────────────────────
function ReteteTab({ profil }) {
  const [retete, setRetete] = useState([]);
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [loadingRetete, setLoadingRetete] = useState(true);
  const fileRef = useRef(null);

  useEffect(() => {
    const uid = getUserId();
    setUserId(uid);
    setLoadingRetete(true);
    getRetete(uid).then(d => {
      console.log("Retete loaded:", d);
      setRetete(d || []);
      setLoadingRetete(false);
    });
  }, []);

  async function handleUpload(e) {
    const f = e.target.files[0]; if (!f) return;
    setLoading(true);
    const r = new FileReader();
    r.onload = async () => {
      try {
        const base64 = r.result.split(",")[1];
        const mediaType = f.type.includes("pdf") ? "application/pdf" : "text/plain";
        const reply = await apiFetch(
          [{ role: "user", content: [
            { type: "document", source: { type: "base64", media_type: mediaType, data: base64 } },
            { type: "text", text: "Extrage TOATE rețetele din acest document. Pentru fiecare rețetă: **Nume rețetă** bold, ingrediente cu gramaje exacte, pași detaliați de preparare, valori nutriționale dacă există. Formatează clar cu separatoare între rețete." }
          ]}],
          profil, undefined, {}
        );
        const newReteta = { nume: f.name.replace(/\.[^/.]+$/, ""), continut: reply, tip: f.type };
        const result = await addReteta(userId, newReteta);
        console.log("Upload result:", result);
        if (result && result.length > 0) {
          setRetete(prev => [result[0], ...prev]);
          alert("✅ Rețetele au fost extrase și salvate în cloud!");
        } else {
          // Fallback: reload from DB
          const updated = await getRetete(userId);
          setRetete(updated || []);
          alert("✅ Rețetele au fost salvate!");
        }
      } catch(e) {
        console.error("Upload error:", e);
        alert("Eroare la procesare: " + e.message);
      } finally { setLoading(false); if (fileRef.current) fileRef.current.value = ""; }
    };
    r.readAsDataURL(f);
  }

  async function sterge(id) {
    await deleteReteta(userId, id);
    setRetete(prev => prev.filter(r => r.id !== id));
    if (selected?.id === id) setSelected(null);
  }

  async function reincarca() {
    setLoadingRetete(true);
    const d = await getRetete(userId);
    setRetete(d || []);
    setLoadingRetete(false);
  }

  if (selected) return (
    <div style={{ padding: "0 20px", overflowY: "auto", flex: 1 }}>
      <button onClick={() => setSelected(null)} style={{ background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 10, color: "#94a3b8", padding: "8px 14px", cursor: "pointer", fontSize: 13, marginBottom: 14 }}>← Înapoi la lista</button>
      <div style={{ color: "#22c55e", fontSize: 16, fontWeight: 700, marginBottom: 12 }}>📄 {selected.nume}</div>
      <div style={{ color: "#4a5568", fontSize: 11, marginBottom: 12 }}>{selected.created_at ? new Date(selected.created_at).toLocaleDateString("ro-RO") : ""}</div>
      <div style={{ color: "#e2e8f0", fontSize: 14, lineHeight: 1.8, paddingBottom: 20 }}><FormatText text={selected.continut} /></div>
    </div>
  );

  return (
    <div style={{ padding: "0 20px", overflowY: "auto", flex: 1 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <button onClick={() => fileRef.current?.click()} disabled={loading} style={{ flex: 1, padding: "14px", background: loading ? "#2a3040" : "linear-gradient(135deg, #16a34a, #22c55e)", border: "none", borderRadius: 12, color: "white", fontSize: 14, fontWeight: 700, cursor: loading ? "default" : "pointer" }}>
          {loading ? "⏳ Se procesează..." : "📤 Încarcă rețete (PDF sau Word)"}
        </button>
        <button onClick={reincarca} style={{ padding: "14px", background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 12, color: "#94a3b8", fontSize: 14, cursor: "pointer" }}>🔄</button>
      </div>
      <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.txt" onChange={handleUpload} style={{ display: "none" }} />
      <div style={{ color: "#4a5568", fontSize: 12, textAlign: "center", marginBottom: 16 }}>Agentul extrage rețetele, le salvează în cloud și le folosește când ceri recomandări în Chat.</div>

      {loadingRetete ? (
        <div style={{ textAlign: "center", color: "#4a5568", padding: "40px 0" }}>Se încarcă rețetele...</div>
      ) : !retete.length ? (
        <div style={{ textAlign: "center", color: "#4a5568", padding: "40px 0" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📚</div>
          <div>Nicio rețetă încărcată.</div>
          <div style={{ fontSize: 12, marginTop: 8 }}>Încarcă un PDF sau Word cu rețetele tale.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingBottom: 20 }}>
          {retete.map(r => (
            <div key={r.id} onClick={() => setSelected(r)} style={{ background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 12, padding: "12px 16px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ color: "#22c55e", fontSize: 14, fontWeight: 600 }}>📄 {r.nume}</div>
                <div style={{ color: "#4a5568", fontSize: 11, marginTop: 2 }}>{r.created_at ? new Date(r.created_at).toLocaleDateString("ro-RO") : ""} · Apasă pentru a citi</div>
              </div>
              <button onClick={e => { e.stopPropagation(); sterge(r.id); }} style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 16, padding: "4px 8px" }}>🗑️</button>
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
  const [globalContext, setGlobalContext] = useState({});

  useEffect(() => {
    const uid = getUserId();
    const saved = localStorage.getItem("profil_nutritie");
    if (saved) setProfil(JSON.parse(saved));

    Promise.all([
      getMemory(uid),
      getJurnalRecent(uid),
      getProgres(uid),
      getRetete(uid),
      getJurnalStats(uid),
    ]).then(([memory, jurnal, progres, retete, stats]) => {
      setGlobalContext({ memory: memory || [], jurnal: jurnal || [], progres: progres || [], retete: retete || [], stats });
    }).catch(e => console.error("Context load error:", e));
  }, []);

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: "#0f1117", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ width: "100%", maxWidth: 680, display: "flex", flexDirection: "column", height: "100vh" }}>
        <div style={{ padding: "12px 20px 0" }}>
          <div style={{ background: "linear-gradient(135deg, #1a2a1a, #0f1f0f)", border: "1px solid #2a4a2a", borderRadius: 16, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg, #22c55e, #16a34a)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>🥦</div>
            <div style={{ flex: 1 }}>
              <div style={{ color: "#22c55e", fontWeight: 700, fontSize: 13 }}>Agent Nutriție & Sport</div>
              <div style={{ color: "#4ade80", fontSize: 10, opacity: 0.8 }}>
                {profil?.nume ? `${profil.nume} · ${profil.calorii || 1600} kcal` : "Completează profilul"} · 🧠 {globalContext?.memory?.length || 0} amintiri
              </div>
            </div>
            <button onClick={() => router.push("/profil")} style={{ background: profil ? "#1a2a1a" : "linear-gradient(135deg, #16a34a, #22c55e)", border: profil ? "1px solid #2a4a2a" : "none", borderRadius: 8, color: profil ? "#22c55e" : "white", padding: "5px 10px", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
              {profil ? "👤 Profil" : "⚙️ Setează"}
            </button>
          </div>
          <div style={{ display: "flex", gap: 4, overflowX: "auto", paddingBottom: 4 }}>
            {TABS.map((t, i) => (
              <button key={i} onClick={() => setTab(i)} style={{ background: i === tab ? "linear-gradient(135deg, #16a34a, #22c55e)" : "#1a1f2e", border: `1px solid ${i === tab ? "transparent" : "#2a3040"}`, borderRadius: 20, color: i === tab ? "white" : "#94a3b8", padding: "5px 10px", cursor: "pointer", fontSize: 11, fontWeight: i === tab ? 700 : 400, flexShrink: 0, whiteSpace: "nowrap" }}>
                {t}
              </button>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", paddingTop: 10 }}>
          {tab === 0 && <ChatTab profil={profil} globalContext={globalContext} />}
          {tab === 1 && <FavoriteTab />}
          {tab === 2 && <JurnalTab profil={profil} globalContext={globalContext} />}
          {tab === 3 && <SaptamanaTab profil={profil} />}
          {tab === 4 && <ProgresTab profil={profil} globalContext={globalContext} />}
          {tab === 5 && <SportTab profil={profil} globalContext={globalContext} />}
          {tab === 6 && <ReminderTab />}
          {tab === 7 && <ProdusTab profil={profil} />}
          {tab === 8 && <ReteteTab profil={profil} />}
        </div>
      </div>
      <style>{`
        @keyframes bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-6px)} }
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:3px} ::-webkit-scrollbar-track{background:transparent} ::-webkit-scrollbar-thumb{background:#2a3040;border-radius:2px}
        input[type="date"]::-webkit-calendar-picker-indicator,input[type="time"]::-webkit-calendar-picker-indicator{filter:invert(1)}
        select option{background:#1a1f2e}
      `}</style>
    </div>
  );
}
