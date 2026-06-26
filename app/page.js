"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

const TABS = ["💬 Chat", "❤️ Favorite", "📓 Jurnal", "📅 Săptămână", "⚖️ Progres", "🔔 Remindere", "🔍 Produs"];

const SUGGESTIONS = [
  "Am piept de pui 200g și broccoli. Ce fac?",
  "Fă-mi un plan complet pentru azi",
  "Dă-mi un plan sport pentru azi",
  "Calculează macro-urile pentru omletă cu 3 ouă",
  "Generează meniu pentru toată săptămâna",
];

function loadLS(key, def) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch { return def; }
}
function saveLS(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

// ─── CHAT TAB ───────────────────────────────────────────────────────────────
function ChatTab({ profil }) {
  const initMsg = { role: "assistant", content: "Salut! Sunt agentul tău personal de nutriție și sport.\n\nPot să:\n• 🥗 Generez rețete din ingredientele tale\n• 📅 Planific mesele pentru o zi întreagă\n• 📊 Calculez macro-urile oricărui preparat\n• 🏋️ Îți dau un plan sport adaptat obiectivelor tale\n• 📷 Analizez poze cu mâncare, frigider sau etichete\n• 📄 Citesc documente PDF sau text\n\nCu ce te ajut azi?" };

  const [sessions, setSessions] = useState(() => loadLS("chat_sessions", [{ id: Date.now(), title: "Conversație nouă", messages: [initMsg] }]));
  const [activeSession, setActiveSession] = useState(0);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [imagine, setImagine] = useState(null);
  const [imaginePreview, setImaginePreview] = useState(null);
  const [document, setDocument] = useState(null);
  const [documentNume, setDocumentNume] = useState(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [favorites, setFavorites] = useState(() => loadLS("retete_favorite", []));
  const bottomRef = useRef(null);
  const fileRef = useRef(null);
  const docRef = useRef(null);

  const currentSession = sessions[activeSession] || sessions[0];
  const messages = currentSession?.messages || [initMsg];

  useEffect(() => { saveLS("chat_sessions", sessions); }, [sessions]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [sessions, activeSession, loading]);

  function newSession() {
    const s = { id: Date.now(), title: "Conversație nouă", messages: [initMsg] };
    const updated = [s, ...sessions];
    setSessions(updated);
    setActiveSession(0);
    setShowSidebar(false);
  }

  function deleteSession(idx) {
    if (sessions.length === 1) { setSessions([{ id: Date.now(), title: "Conversație nouă", messages: [initMsg] }]); setActiveSession(0); return; }
    const updated = sessions.filter((_, i) => i !== idx);
    setSessions(updated);
    setActiveSession(0);
  }

  function updateMessages(newMsgs) {
    setSessions(prev => {
      const updated = [...prev];
      updated[activeSession] = { ...updated[activeSession], messages: newMsgs };
      // Auto-title from first user message
      const firstUser = newMsgs.find(m => m.role === "user");
      if (firstUser && updated[activeSession].title === "Conversație nouă") {
        updated[activeSession].title = (firstUser.content?.toString() || "").slice(0, 30) + "...";
      }
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

  function saveFavorite(content) {
    const title = content.slice(0, 50) + "...";
    const fav = { id: Date.now(), title, content, data: new Date().toLocaleDateString("ro-RO") };
    const updated = [fav, ...favorites];
    setFavorites(updated);
    saveLS("retete_favorite", updated);
    alert("✅ Salvat la favorite!");
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
      apiContent.push({ type: "text", text: userText || "Analizează această imagine în contextul nutriției mele. Estimează caloriile și macro-urile dacă e mâncare, sugerează rețetă dacă e frigider, citește eticheta dacă e produs." });
    } else if (document) {
      apiContent.push({ type: "document", source: { type: "base64", media_type: document.type, data: document.data } });
      apiContent.push({ type: "text", text: userText || "Citește documentul și extrage informațiile relevante pentru nutriție, sănătate sau sport." });
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
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages, profil }),
      });
      const data = await res.json();
      updateMessages([...newMessages, { role: "assistant", content: data.reply }]);
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
      {/* Session bar */}
      <div style={{ display: "flex", gap: 8, padding: "0 20px 10px", overflowX: "auto" }}>
        <button onClick={newSession} style={{ background: "#22c55e", border: "none", borderRadius: 20, color: "white", padding: "5px 12px", fontSize: 12, cursor: "pointer", flexShrink: 0 }}>+ Nou</button>
        {sessions.map((s, i) => (
          <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 4, background: i === activeSession ? "#1a2a1a" : "#1a1f2e", border: `1px solid ${i === activeSession ? "#22c55e" : "#2a3040"}`, borderRadius: 20, padding: "4px 10px", cursor: "pointer", flexShrink: 0 }}
            onClick={() => setActiveSession(i)}>
            <span style={{ color: i === activeSession ? "#22c55e" : "#94a3b8", fontSize: 11, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</span>
            <span onClick={e => { e.stopPropagation(); deleteSession(i); }} style={{ color: "#ef4444", fontSize: 11, cursor: "pointer", marginLeft: 2 }}>✕</span>
          </div>
        ))}
      </div>

      {/* Messages */}
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

      {/* Suggestions */}
      {messages.length <= 1 && (
        <div style={{ padding: "8px 20px", display: "flex", flexWrap: "wrap", gap: 8 }}>
          {SUGGESTIONS.map((s, i) => (
            <button key={i} onClick={() => sendMessage(s)} style={{ background: "#1a1f2e", border: "1px solid #2a3a2a", borderRadius: 20, color: "#86efac", fontSize: 12, padding: "6px 12px", cursor: "pointer" }}>{s}</button>
          ))}
        </div>
      )}

      {/* Attachment preview */}
      {(imaginePreview || documentNume) && (
        <div style={{ padding: "0 20px 8px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 10, padding: "6px 10px" }}>
            {imaginePreview && <img src={imaginePreview} alt="preview" style={{ height: 50, borderRadius: 6 }} />}
            {documentNume && <span style={{ color: "#86efac", fontSize: 13 }}>📄 {documentNume}</span>}
            <button onClick={stergeAtasament} style={{ width: 20, height: 20, borderRadius: "50%", background: "#ef4444", border: "none", color: "white", fontSize: 11, cursor: "pointer" }}>✕</button>
          </div>
        </div>
      )}

      {/* Input */}
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

// ─── FAVORITE TAB ────────────────────────────────────────────────────────────
function FavoriteTab() {
  const [favorites, setFavorites] = useState(() => loadLS("retete_favorite", []));

  function sterge(id) {
    const updated = favorites.filter(f => f.id !== id);
    setFavorites(updated);
    saveLS("retete_favorite", updated);
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
              <div style={{ color: "#94a3b8", fontSize: 11, marginBottom: 8 }}>{f.data}</div>
              <div style={{ color: "#e2e8f0", fontSize: 13, lineHeight: 1.6, maxHeight: 120, overflowY: "auto" }}>
                {f.content.slice(0, 300)}{f.content.length > 300 ? "..." : ""}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── JURNAL TAB ──────────────────────────────────────────────────────────────
function JurnalTab() {
  const azi = new Date().toISOString().split("T")[0];
  const [jurnal, setJurnal] = useState(() => loadLS("jurnal_nutritie", {}));
  const [data, setData] = useState(azi);
  const [item, setItem] = useState("");
  const [calorii, setCalorii] = useState("");

  const intrariZi = jurnal[data] || [];
  const totalCalorii = intrariZi.reduce((sum, i) => sum + (parseInt(i.calorii) || 0), 0);

  function adauga() {
    if (!item.trim()) return;
    const noua = { id: Date.now(), item: item.trim(), calorii: parseInt(calorii) || 0, ora: new Date().toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" }) };
    const updated = { ...jurnal, [data]: [...intrariZi, noua] };
    setJurnal(updated);
    saveLS("jurnal_nutritie", updated);
    setItem(""); setCalorii("");
  }

  function sterge(id) {
    const updated = { ...jurnal, [data]: intrariZi.filter(i => i.id !== id) };
    setJurnal(updated);
    saveLS("jurnal_nutritie", updated);
  }

  return (
    <div style={{ padding: "0 20px", overflowY: "auto", flex: 1 }}>
      <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center" }}>
        <input type="date" value={data} onChange={e => setData(e.target.value)} style={{ background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 10, color: "#e2e8f0", padding: "8px 12px", fontSize: 14, flex: 1 }} />
        <div style={{ background: "#1a2a1a", border: "1px solid #2a4a2a", borderRadius: 10, padding: "8px 14px", color: "#22c55e", fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
          {totalCalorii} kcal
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input value={item} onChange={e => setItem(e.target.value)} placeholder="Ce ai mâncat?" style={{ flex: 2, background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 10, color: "#e2e8f0", padding: "8px 12px", fontSize: 14, outline: "none" }} onKeyDown={e => e.key === "Enter" && adauga()} />
        <input value={calorii} onChange={e => setCalorii(e.target.value)} placeholder="kcal" type="number" style={{ flex: 1, background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 10, color: "#e2e8f0", padding: "8px 12px", fontSize: 14, outline: "none" }} onKeyDown={e => e.key === "Enter" && adauga()} />
        <button onClick={adauga} style={{ background: "linear-gradient(135deg, #16a34a, #22c55e)", border: "none", borderRadius: 10, color: "white", padding: "8px 14px", cursor: "pointer", fontSize: 16 }}>+</button>
      </div>

      {intrariZi.length === 0 ? (
        <div style={{ textAlign: "center", color: "#4a5568", padding: "40px 0" }}>Nicio intrare pentru această zi.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingBottom: 20 }}>
          {intrariZi.map(i => (
            <div key={i.id} style={{ background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 12, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ color: "#e2e8f0", fontSize: 14 }}>{i.item}</div>
                <div style={{ color: "#4a5568", fontSize: 11 }}>{i.ora}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ color: "#22c55e", fontWeight: 700, fontSize: 14 }}>{i.calorii} kcal</span>
                <button onClick={() => sterge(i.id)} style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 13 }}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── SAPTAMANA TAB ───────────────────────────────────────────────────────────
function SaptamanaTab({ profil }) {
  const [plan, setPlan] = useState(() => loadLS("plan_saptamana", null));
  const [loading, setLoading] = useState(false);

  async function genereaza() {
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profil,
          messages: [{ role: "user", content: `Generează un plan alimentar complet pentru 7 zile (Luni-Duminică). Pentru fiecare zi include: Mic dejun, Prânz, Cină, Gustare. Respectă profilul meu: ${profil?.calorii || 1600} kcal/zi, fără gluten, low-carb. Format: Ziua X: Mic dejun: ... | Prânz: ... | Cină: ... | Gustare: ... | Total: ~X kcal` }],
        }),
      });
      const data = await res.json();
      setPlan(data.reply);
      saveLS("plan_saptamana", data.reply);
    } catch { alert("Eroare. Încearcă din nou."); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ padding: "0 20px", overflowY: "auto", flex: 1 }}>
      <button onClick={genereaza} disabled={loading} style={{ width: "100%", padding: "12px", background: loading ? "#2a3040" : "linear-gradient(135deg, #16a34a, #22c55e)", border: "none", borderRadius: 12, color: "white", fontSize: 15, fontWeight: 700, cursor: loading ? "default" : "pointer", marginBottom: 16 }}>
        {loading ? "Se generează..." : "🔄 Generează plan nou"}
      </button>
      {plan ? (
        <div style={{ background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 14, padding: "16px", color: "#e2e8f0", fontSize: 14, lineHeight: 1.8, whiteSpace: "pre-wrap", paddingBottom: 20 }}>
          {plan}
        </div>
      ) : (
        <div style={{ textAlign: "center", color: "#4a5568", padding: "60px 0" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📅</div>
          <div>Apasă butonul pentru a genera planul săptămânii.</div>
        </div>
      )}
    </div>
  );
}

// ─── PROGRES TAB ─────────────────────────────────────────────────────────────
function ProgresTab({ profil }) {
  const [intrari, setIntrari] = useState(() => loadLS("progres_greutate", []));
  const [greutate, setGreutate] = useState("");
  const [data, setData] = useState(new Date().toISOString().split("T")[0]);

  function adauga() {
    if (!greutate) return;
    const noua = { id: Date.now(), data, greutate: parseFloat(greutate) };
    const updated = [...intrari.filter(i => i.data !== data), noua].sort((a, b) => a.data.localeCompare(b.data));
    setIntrari(updated);
    saveLS("progres_greutate", updated);
    setGreutate("");
  }

  function sterge(id) {
    const updated = intrari.filter(i => i.id !== id);
    setIntrari(updated);
    saveLS("progres_greutate", updated);
  }

  const ultima = intrari[intrari.length - 1];
  const prima = intrari[0];
  const diferenta = ultima && prima && intrari.length > 1 ? (ultima.greutate - prima.greutate).toFixed(1) : null;

  // Simple SVG chart
  function renderChart() {
    if (intrari.length < 2) return null;
    const w = 320, h = 120, pad = 20;
    const vals = intrari.map(i => i.greutate);
    const min = Math.min(...vals) - 1;
    const max = Math.max(...vals) + 1;
    const points = intrari.map((item, i) => {
      const x = pad + (i / (intrari.length - 1)) * (w - 2 * pad);
      const y = pad + ((max - item.greutate) / (max - min)) * (h - 2 * pad);
      return `${x},${y}`;
    }).join(" ");

    return (
      <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ marginBottom: 16 }}>
        <polyline fill="none" stroke="#22c55e" strokeWidth="2" points={points} />
        {intrari.map((item, i) => {
          const x = pad + (i / (intrari.length - 1)) * (w - 2 * pad);
          const y = pad + ((max - item.greutate) / (max - min)) * (h - 2 * pad);
          return <circle key={i} cx={x} cy={y} r="4" fill="#22c55e" />;
        })}
      </svg>
    );
  }

  // IMC
  const imc = profil?.greutate && profil?.inaltime ? (profil.greutate / Math.pow(profil.inaltime / 100, 2)).toFixed(1) : null;
  const imcActual = ultima && profil?.inaltime ? (ultima.greutate / Math.pow(profil.inaltime / 100, 2)).toFixed(1) : null;

  return (
    <div style={{ padding: "0 20px", overflowY: "auto", flex: 1 }}>
      {/* Stats */}
      {diferenta !== null && (
        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          <div style={{ flex: 1, background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 12, padding: "12px", textAlign: "center" }}>
            <div style={{ color: "#22c55e", fontSize: 20, fontWeight: 700 }}>{ultima.greutate} kg</div>
            <div style={{ color: "#4a5568", fontSize: 11 }}>Greutate curentă</div>
          </div>
          <div style={{ flex: 1, background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 12, padding: "12px", textAlign: "center" }}>
            <div style={{ color: parseFloat(diferenta) < 0 ? "#22c55e" : "#ef4444", fontSize: 20, fontWeight: 700 }}>{diferenta > 0 ? "+" : ""}{diferenta} kg</div>
            <div style={{ color: "#4a5568", fontSize: 11 }}>Total modificare</div>
          </div>
          {imcActual && (
            <div style={{ flex: 1, background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 12, padding: "12px", textAlign: "center" }}>
              <div style={{ color: "#22c55e", fontSize: 20, fontWeight: 700 }}>{imcActual}</div>
              <div style={{ color: "#4a5568", fontSize: 11 }}>IMC actual</div>
            </div>
          )}
        </div>
      )}

      {/* Chart */}
      {renderChart()}

      {/* Add entry */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input type="date" value={data} onChange={e => setData(e.target.value)} style={{ flex: 1, background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 10, color: "#e2e8f0", padding: "8px 12px", fontSize: 14, outline: "none" }} />
        <input value={greutate} onChange={e => setGreutate(e.target.value)} placeholder="kg" type="number" step="0.1" style={{ width: 80, background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 10, color: "#e2e8f0", padding: "8px 12px", fontSize: 14, outline: "none" }} />
        <button onClick={adauga} style={{ background: "linear-gradient(135deg, #16a34a, #22c55e)", border: "none", borderRadius: 10, color: "white", padding: "8px 14px", cursor: "pointer", fontSize: 16 }}>+</button>
      </div>

      {/* Entries */}
      {intrari.length === 0 ? (
        <div style={{ textAlign: "center", color: "#4a5568", padding: "40px 0" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚖️</div>
          <div>Adaugă prima ta înregistrare de greutate.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingBottom: 20 }}>
          {[...intrari].reverse().map(i => (
            <div key={i.id} style={{ background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 12, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "#94a3b8", fontSize: 13 }}>{new Date(i.data).toLocaleDateString("ro-RO")}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ color: "#22c55e", fontWeight: 700 }}>{i.greutate} kg</span>
                <button onClick={() => sterge(i.id)} style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 13 }}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── REMINDER TAB ────────────────────────────────────────────────────────────
function ReminderTab() {
  const DEFAULT_REMINDERS = [
    { id: 1, label: "Mic dejun", ora: "08:00", activ: true },
    { id: 2, label: "Gustare dimineață", ora: "10:30", activ: false },
    { id: 3, label: "Prânz", ora: "13:00", activ: true },
    { id: 4, label: "Gustare după-amiază", ora: "16:00", activ: false },
    { id: 5, label: "Cină", ora: "19:00", activ: true },
    { id: 6, label: "Sport", ora: "17:30", activ: false },
    { id: 7, label: "Hidratare", ora: "09:00", activ: false },
  ];
  const [reminders, setReminders] = useState(() => loadLS("remindere", DEFAULT_REMINDERS));
  const [permisiune, setPermisiune] = useState(null);
  const [nou, setNou] = useState({ label: "", ora: "12:00" });

  useEffect(() => {
    if ("Notification" in window) setPermisiune(Notification.permission);
  }, []);

  async function cerePermisiune() {
    if (!("Notification" in window)) { alert("Browserul tău nu suportă notificări."); return; }
    const result = await Notification.requestPermission();
    setPermisiune(result);
  }

  function toggleActiv(id) {
    const updated = reminders.map(r => r.id === id ? { ...r, activ: !r.activ } : r);
    setReminders(updated);
    saveLS("remindere", updated);
  }

  function updateOra(id, ora) {
    const updated = reminders.map(r => r.id === id ? { ...r, ora } : r);
    setReminders(updated);
    saveLS("remindere", updated);
  }

  function adaugaReminder() {
    if (!nou.label.trim()) return;
    const r = { id: Date.now(), label: nou.label.trim(), ora: nou.ora, activ: true };
    const updated = [...reminders, r];
    setReminders(updated);
    saveLS("remindere", updated);
    setNou({ label: "", ora: "12:00" });
  }

  function stergeReminder(id) {
    const updated = reminders.filter(r => r.id !== id);
    setReminders(updated);
    saveLS("remindere", updated);
  }

  function testeazaNotificare() {
    if (permisiune === "granted") {
      new Notification("Agent Nutriție", { body: "Notificările funcționează! 🥗", icon: "/favicon.ico" });
    }
  }

  return (
    <div style={{ padding: "0 20px", overflowY: "auto", flex: 1 }}>
      {/* Permisiune */}
      <div style={{ background: "#1a1f2e", border: `1px solid ${permisiune === "granted" ? "#2a4a2a" : "#4a3020"}`, borderRadius: 14, padding: "14px 16px", marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ color: "#e2e8f0", fontSize: 14, fontWeight: 600 }}>Notificări browser</div>
            <div style={{ color: "#4a5568", fontSize: 12, marginTop: 2 }}>
              {permisiune === "granted" ? "✅ Active" : permisiune === "denied" ? "❌ Blocate în browser" : "⚠️ Neactivate"}
            </div>
          </div>
          {permisiune !== "granted" && permisiune !== "denied" && (
            <button onClick={cerePermisiune} style={{ background: "linear-gradient(135deg, #16a34a, #22c55e)", border: "none", borderRadius: 10, color: "white", padding: "8px 14px", cursor: "pointer", fontSize: 13 }}>Activează</button>
          )}
          {permisiune === "granted" && (
            <button onClick={testeazaNotificare} style={{ background: "#1a2a1a", border: "1px solid #2a4a2a", borderRadius: 10, color: "#22c55e", padding: "8px 14px", cursor: "pointer", fontSize: 13 }}>Testează</button>
          )}
        </div>
        {permisiune === "denied" && <div style={{ color: "#f97316", fontSize: 12, marginTop: 8 }}>Activează notificările din setările browserului pentru acest site.</div>}
      </div>

      {/* Remindere */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
        {reminders.map(r => (
          <div key={r.id} style={{ background: "#1a1f2e", border: `1px solid ${r.activ ? "#2a4a2a" : "#2a3040"}`, borderRadius: 12, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={() => toggleActiv(r.id)} style={{ width: 36, height: 20, borderRadius: 10, background: r.activ ? "#22c55e" : "#2a3040", border: "none", cursor: "pointer", position: "relative", flexShrink: 0, transition: "background 0.2s" }}>
              <div style={{ width: 16, height: 16, borderRadius: "50%", background: "white", position: "absolute", top: 2, left: r.activ ? 18 : 2, transition: "left 0.2s" }} />
            </button>
            <span style={{ flex: 1, color: r.activ ? "#e2e8f0" : "#4a5568", fontSize: 14 }}>{r.label}</span>
            <input type="time" value={r.ora} onChange={e => updateOra(r.id, e.target.value)} style={{ background: "#0f1117", border: "1px solid #2a3040", borderRadius: 8, color: "#e2e8f0", padding: "4px 8px", fontSize: 13, outline: "none" }} />
            <button onClick={() => stergeReminder(r.id)} style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 13 }}>✕</button>
          </div>
        ))}
      </div>

      {/* Adaugă reminder nou */}
      <div style={{ display: "flex", gap: 8, paddingBottom: 20 }}>
        <input value={nou.label} onChange={e => setNou(p => ({ ...p, label: e.target.value }))} placeholder="Nume reminder..." style={{ flex: 1, background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 10, color: "#e2e8f0", padding: "8px 12px", fontSize: 14, outline: "none" }} onKeyDown={e => e.key === "Enter" && adaugaReminder()} />
        <input type="time" value={nou.ora} onChange={e => setNou(p => ({ ...p, ora: e.target.value }))} style={{ background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 10, color: "#e2e8f0", padding: "8px 12px", fontSize: 14, outline: "none" }} />
        <button onClick={adaugaReminder} style={{ background: "linear-gradient(135deg, #16a34a, #22c55e)", border: "none", borderRadius: 10, color: "white", padding: "8px 14px", cursor: "pointer", fontSize: 16 }}>+</button>
      </div>

      <div style={{ color: "#4a5568", fontSize: 12, textAlign: "center", paddingBottom: 20 }}>
        💡 Notificările funcționează doar când browserul este deschis.
      </div>
    </div>
  );
}

// ─── PRODUS TAB (scanare/foto produs) ────────────────────────────────────────
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
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profil,
          messages: [{
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: imagine.type, data: imagine.data } },
              { type: "text", text: `Analizează acest produs alimentar. Extrage:
1. Numele produsului
2. Valorile nutriționale per 100g și per porție (dacă sunt vizibile): calorii, proteine, grăsimi, carbohidrați, zahăr, fibre
3. Lista de ingrediente (primele 5)
4. Este potrivit pentru dieta mea (${profil?.restrictii || "fără gluten, low-carb"})?
5. Recomandare: DA sau NU, cu motiv scurt.
Dacă nu e o etichetă alimentară, descrie ce vezi și estimează valorile nutriționale.` }
            ]
          }],
        }),
      });
      const data = await res.json();
      setRezultat(data.reply);
      const item = { id: Date.now(), preview, rezultat: data.reply, data: new Date().toLocaleDateString("ro-RO") };
      const updated = [item, ...istoric].slice(0, 20);
      setIstoric(updated);
      saveLS("istoric_produse", updated);
    } catch { setRezultat("Eroare la analiză. Încearcă din nou."); }
    finally { setLoading(false); }
  }

  function reset() { setImagine(null); setPreview(null); setRezultat(null); if (fileRef.current) fileRef.current.value = ""; if (cameraRef.current) cameraRef.current.value = ""; }

  return (
    <div style={{ padding: "0 20px", overflowY: "auto", flex: 1 }}>
      {!preview ? (
        <div>
          <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
            <button onClick={() => cameraRef.current?.click()} style={{ flex: 1, padding: "16px", background: "linear-gradient(135deg, #16a34a, #22c55e)", border: "none", borderRadius: 14, color: "white", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
              📷 Fotografiază produs
            </button>
            <button onClick={() => fileRef.current?.click()} style={{ flex: 1, padding: "16px", background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 14, color: "#94a3b8", fontSize: 14, cursor: "pointer" }}>
              🖼️ Din galerie
            </button>
          </div>
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handleFile} style={{ display: "none" }} />
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />

          <div style={{ color: "#4a5568", fontSize: 13, textAlign: "center", marginBottom: 20 }}>
            Fotografiază eticheta unui produs din magazin sau codul de bare — agentul analizează ingredientele și îți spune dacă e potrivit pentru dieta ta.
          </div>

          {/* Istoric */}
          {istoric.length > 0 && (
            <div>
              <div style={{ color: "#94a3b8", fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Produse analizate recent:</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingBottom: 20 }}>
                {istoric.slice(0, 5).map(item => (
                  <div key={item.id} style={{ background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 12, padding: "10px 14px", display: "flex", gap: 12, alignItems: "center" }}>
                    <img src={item.preview} alt="" style={{ width: 48, height: 48, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
                    <div style={{ flex: 1, overflow: "hidden" }}>
                      <div style={{ color: "#e2e8f0", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.rezultat.slice(0, 60)}...</div>
                      <div style={{ color: "#4a5568", fontSize: 11, marginTop: 2 }}>{item.data}</div>
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
            <div style={{ background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 14, padding: "16px", color: "#e2e8f0", fontSize: 14, lineHeight: 1.7, marginBottom: 10, whiteSpace: "pre-wrap" }}>
              {rezultat}
            </div>
          )}
          <button onClick={reset} style={{ width: "100%", padding: "10px", background: "transparent", border: "1px solid #2a3040", borderRadius: 12, color: "#94a3b8", fontSize: 14, cursor: "pointer" }}>
            ← Analizează alt produs
          </button>
        </div>
      )}
    </div>
  );
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
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
        {/* Header */}
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

          {/* Tabs */}
          <div style={{ display: "flex", gap: 4, overflowX: "auto", paddingBottom: 4 }}>
            {TABS.map((t, i) => (
              <button key={i} onClick={() => setTab(i)} style={{ background: i === tab ? "linear-gradient(135deg, #16a34a, #22c55e)" : "#1a1f2e", border: `1px solid ${i === tab ? "transparent" : "#2a3040"}`, borderRadius: 20, color: i === tab ? "white" : "#94a3b8", padding: "6px 12px", cursor: "pointer", fontSize: 12, fontWeight: i === tab ? 700 : 400, flexShrink: 0, whiteSpace: "nowrap" }}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", paddingTop: 12 }}>
          {tab === 0 && <ChatTab profil={profil} />}
          {tab === 1 && <FavoriteTab />}
          {tab === 2 && <JurnalTab />}
          {tab === 3 && <SaptamanaTab profil={profil} />}
          {tab === 4 && <ProgresTab profil={profil} />}
          {tab === 5 && <ReminderTab />}
          {tab === 6 && <ProdusTab profil={profil} />}
        </div>
      </div>

      <style>{`
        @keyframes bounce { 0%, 60%, 100% { transform: translateY(0); } 30% { transform: translateY(-6px); } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: #2a3040; border-radius: 2px; }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(1); }
      `}</style>
    </div>
  );
}
