"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  getUserId, getSessions, saveSession, deleteSession,
  getFavorite, addFavorit, deleteFavorit,
  getJurnal, getJurnalRecent, getJurnalStats, addJurnal, deleteJurnal,
  getProgres, addProgres, deleteProgres,
  getRetete, addReteta, deleteReteta,
  getMemory, addMemory,
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
      {text.split("\n").map((line, i) => {
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        return (
          <p key={i} style={{ margin: "2px 0", minHeight: "1.1em" }}>
            {parts.map((p, j) =>
              p.startsWith("**") && p.endsWith("**") ? <strong key={j}>{p.slice(2, -2)}</strong> : p
            )}
          </p>
        );
      })}
    </>
  );
}

// ─── CHAT TAB ────────────────────────────────────────────────────────────────
function ChatTab({ profil, globalContext }) {
  const initMsg = {
    role: "assistant",
    content: `Salut${profil?.nume ? ", " + profil.nume : ""}! Sunt agentul tău personal — mai bun decât Google AI pe nutriție pentru că te cunosc personal.\n\n${globalContext?.memory?.length > 0 ? `🧠 Îmi amintesc ${globalContext.memory.length} conversații anterioare cu tine.\n` : ""}${globalContext?.progres?.length > 0 ? `📊 Urmăresc progresul tău (${globalContext.progres.length} măsurători înregistrate).\n` : ""}\nPot să:\n• 🥗 Rețete complete cu pași detaliați\n• 📊 Calcul nutrițional detaliat\n• 💡 Sfaturi personalizate bazate pe istoricul tău\n• 🏃 Plan sport adaptat limitărilor tale fizice\n• 🔍 Caut pe internet și filtrez pentru tine\n• 💧 Calculez apa optimă de băut\n\nCu ce te ajut azi?`,
  };

  const newSess = () => ({ id: "s_" + Math.random().toString(36).slice(2) + Date.now(), title: "Conversație nouă", messages: [initMsg] });

  const [sessions, setSessions] = useState([newSess()]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [imagine, setImagine] = useState(null);
  const [imaginePreview, setImaginePreview] = useState(null);
  const [docFile, setDocFile] = useState(null);
  const [docNume, setDocNume] = useState(null);
  const [userId, setUserId] = useState(null);
  const bottomRef = useRef(null);
  const fileRef = useRef(null);
  const docRef = useRef(null);

  useEffect(() => {
    const uid = getUserId(); setUserId(uid);
    getSessions(uid).then(d => { if (d?.length) setSessions(d); });
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [sessions, activeIdx, loading]);

  const sess = sessions[activeIdx] || sessions[0];
  const msgs = sess?.messages || [initMsg];

  async function newSession() {
    const s = newSess(); setSessions(p => [s, ...p]); setActiveIdx(0);
    if (userId) await saveSession(userId, s);
  }

  async function removeSession(idx) {
    const s = sessions[idx];
    // Auto-save memory when closing session with content
    if (userId && s.messages.length > 2) {
      try {
        const conv = s.messages
          .filter((m, i) => i > 0)
          .map(m => `${m.role === "user" ? "Utilizator" : "Agent"}: ${typeof m.content === "string" ? m.content.slice(0, 300) : ""}`)
          .join("\n");
        const rezumat = await apiFetch([{ role: "user", content: `Conversație de rezumat:\n${conv}` }], profil, "rezumat", {});
        await addMemory(userId, rezumat, "conversatie");
      } catch (e) { console.error("Memory save error:", e); }
    }
    if (userId) await deleteSession(userId, s.id);
    if (sessions.length === 1) { const ns = newSess(); setSessions([ns]); setActiveIdx(0); if (userId) await saveSession(userId, ns); return; }
    setSessions(p => p.filter((_, i) => i !== idx));
    setActiveIdx(0);
  }

  function updateMsgs(newMsgs) {
    setSessions(prev => {
      const updated = [...prev];
      const firstUser = newMsgs.find(m => m.role === "user");
      const title = firstUser && updated[activeIdx]?.title === "Conversație nouă"
        ? (typeof firstUser.content === "string" ? firstUser.content : "Conversație").slice(0, 35) + "..."
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

  // Detect tip
  function detectTip(text) {
    if (!text) return undefined;
    const t = text.toLowerCase();
    if (t.includes("sport") || t.includes("exerci") || t.includes("antren") || t.includes("miscare") || t.includes("mișcare") || t.includes("tai-chi") || t.includes("yoga") || t.includes("genunchi") || t.includes("spate")) return "sport";
    return undefined;
  }

  async function send(text) {
    const ut = text || input.trim();
    if ((!ut && !imagine && !docFile) || loading) return;
    setInput("");

    const disp = { role: "user", content: ut || (imagine ? "📷 Poză" : `📄 ${docNume}`), imagine: imaginePreview, docNume };

    let apiContent = [];
    if (imagine) {
      apiContent.push({ type: "image", source: { type: "base64", media_type: imagine.type, data: imagine.data } });
      apiContent.push({ type: "text", text: ut || "Analizează această imagine în contextul nutriției și obiectivelor mele." });
    } else if (docFile) {
      apiContent.push({ type: "document", source: { type: "base64", media_type: docFile.type, data: docFile.data } });
      apiContent.push({ type: "text", text: ut || "Citește documentul și extrage informațiile relevante." });
    } else { apiContent = ut; }

    const newMsgs = [...msgs, disp];
    updateMsgs(newMsgs);
    clearAttach();
    setLoading(true);

    const apiMsgs = newMsgs.map((m, i) => ({
      role: m.role,
      content: i === newMsgs.length - 1 ? apiContent : (typeof m.content === "string" ? m.content : m.content),
    }));

    try {
      const tip = detectTip(ut);
      const reply = await apiFetch(apiMsgs, profil, tip, globalContext);
      updateMsgs([...newMsgs, { role: "assistant", content: reply }]);
    } catch {
      updateMsgs([...newMsgs, { role: "assistant", content: "A apărut o eroare. Încearcă din nou." }]);
    } finally { setLoading(false); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      {/* Session tabs */}
      <div style={{ display: "flex", gap: 8, padding: "0 20px 10px", overflowX: "auto" }}>
        <button onClick={newSession} style={{ background: "#22c55e", border: "none", borderRadius: 20, color: "white", padding: "5px 12px", fontSize: 12, cursor: "pointer", flexShrink: 0 }}>+ Nou</button>
        {sessions.map((s, i) => (
          <div key={s.id} onClick={() => setActiveIdx(i)}
            style={{ display: "flex", alignItems: "center", gap: 4, background: i === activeIdx ? "#1a2a1a" : "#1a1f2e", border: `1px solid ${i === activeIdx ? "#22c55e" : "#2a3040"}`, borderRadius: 20, padding: "4px 10px", cursor: "pointer", flexShrink: 0 }}>
            <span style={{ color: i === activeIdx ? "#22c55e" : "#94a3b8", fontSize: 11, maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</span>
            <span onClick={e => { e.stopPropagation(); removeSession(i); }} style={{ color: "#ef4444", fontSize: 11, cursor: "pointer", marginLeft: 2 }}>✕</span>
          </div>
        ))}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, padding: "0 20px", display: "flex", flexDirection: "column", gap: 12, overflowY: "auto", paddingBottom: 8 }}>
        {msgs.map((msg, i) => (
          <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", flexDirection: "column", alignItems: msg.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{ maxWidth: "85%", padding: "12px 16px", borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px", background: msg.role === "user" ? "linear-gradient(135deg, #16a34a, #22c55e)" : "#1a1f2e", border: msg.role === "assistant" ? "1px solid #2a3040" : "none", color: msg.role === "user" ? "#fff" : "#e2e8f0", fontSize: 14, lineHeight: 1.7 }}>
              {msg.imagine && <img src={msg.imagine} alt="" style={{ width: "100%", borderRadius: 8, marginBottom: 8, maxHeight: 200, objectFit: "cover" }} />}
              {msg.docNume && <div style={{ background: "rgba(255,255,255,0.15)", borderRadius: 8, padding: "6px 10px", marginBottom: 8, fontSize: 12 }}>📄 {msg.docNume}</div>}
              <FormatText text={typeof msg.content === "string" ? msg.content : ""} />
            </div>
            {msg.role === "assistant" && i > 0 && (
              <button onClick={() => saveFav(msg.content)} style={{ background: "transparent", border: "none", color: "#4ade80", fontSize: 11, cursor: "pointer", marginTop: 4, padding: "2px 8px" }}>❤️ Salvează la favorite</button>
            )}
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex" }}>
            <div style={{ padding: "12px 16px", borderRadius: "18px 18px 18px 4px", background: "#1a1f2e", border: "1px solid #2a3040", display: "flex", gap: 5, alignItems: "center" }}>
              {[0,1,2].map(d => <div key={d} style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", animation: "bounce 1.2s infinite", animationDelay: `${d*0.2}s` }} />)}
              <span style={{ color: "#4a5568", fontSize: 11, marginLeft: 6 }}>Caut + gândesc...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {msgs.length <= 1 && (
        <div style={{ padding: "8px 20px", display: "flex", flexWrap: "wrap", gap: 8 }}>
          {SUGGESTIONS.map((s, i) => (
            <button key={i} onClick={() => send(s)} style={{ background: "#1a1f2e", border: "1px solid #2a3a2a", borderRadius: 20, color: "#86efac", fontSize: 12, padding: "6px 12px", cursor: "pointer" }}>{s}</button>
          ))}
        </div>
      )}

      {(imaginePreview || docNume) && (
        <div style={{ padding: "0 20px 8px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 10, padding: "6px 10px" }}>
            {imaginePreview && <img src={imaginePreview} alt="" style={{ height: 50, borderRadius: 6 }} />}
            {docNume && <span style={{ color: "#86efac", fontSize: 13 }}>📄 {docNume}</span>}
            <button onClick={clearAttach} style={{ width: 20, height: 20, borderRadius: "50%", background: "#ef4444", border: "none", color: "white", fontSize: 11, cursor: "pointer" }}>✕</button>
          </div>
        </div>
      )}

      <div style={{ padding: "8px 20px 16px" }}>
        <div style={{ display: "flex", gap: 8, background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 16, padding: "8px 8px 8px 12px", alignItems: "flex-end" }}>
          <button onClick={() => fileRef.current?.click()} style={{ width: 34, height: 34, borderRadius: 8, background: "#2a3040", border: "none", cursor: "pointer", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>📷</button>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleImg} style={{ display: "none" }} />
          <button onClick={() => docRef.current?.click()} style={{ width: 34, height: 34, borderRadius: 8, background: "#2a3040", border: "none", cursor: "pointer", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>📄</button>
          <input ref={docRef} type="file" accept=".pdf,.txt,.doc,.docx" onChange={handleDoc} style={{ display: "none" }} />
          <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder="Întreabă orice — știu tot despre tine și caut pe internet..." rows={1} style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#e2e8f0", fontSize: 14, resize: "none", lineHeight: 1.5, paddingTop: 6, fontFamily: "inherit" }} />
          <button onClick={() => send()} disabled={(!input.trim() && !imagine && !docFile) || loading} style={{ width: 34, height: 34, borderRadius: 10, background: (input.trim() || imagine || docFile) && !loading ? "linear-gradient(135deg, #16a34a, #22c55e)" : "#2a3040", border: "none", cursor: "pointer", fontSize: 18, color: "white", flexShrink: 0 }}>↑</button>
        </div>
        <div style={{ textAlign: "center", color: "#2a3a2a", fontSize: 10, marginTop: 4 }}>🧠 Memorie permanentă · 🔍 Web search în timp real · 👤 Personalizat pentru tine</div>
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
                <button onClick={() => setExpanded(expanded === f.id ? null : f.id)} style={{ background: "transparent", border: "none", color: "#22c55e", fontSize: 12, cursor: "pointer", marginTop: 6 }}>
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
function JurnalTab({ profil }) {
  const azi = new Date().toISOString().split("T")[0];
  const [intrari, setIntrari] = useState([]);
  const [data, setData] = useState(azi);
  const [input, setInput] = useState("");
  const [tipMasa, setTipMasa] = useState("mic_dejun");
  const [oraMasa, setOraMasa] = useState(() => new Date().toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" }));
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const uid = getUserId(); setUserId(uid);
    getJurnal(uid, data).then(d => setIntrari(d || []));
    getJurnalStats(uid).then(s => setStats(s));
  }, [data]);

  // Totals for the day
  const totalZi = intrari.reduce((acc, i) => ({
    calorii: acc.calorii + (parseFloat(i.calorii) || 0),
    proteine: acc.proteine + (parseFloat(i.proteine) || 0),
    carbohidrati: acc.carbohidrati + (parseFloat(i.carbohidrati) || 0),
    zaharuri: acc.zaharuri + (parseFloat(i.zaharuri) || 0),
    grasimi: acc.grasimi + (parseFloat(i.grasimi) || 0),
    sare: acc.sare + (parseFloat(i.sare) || 0),
  }), { calorii: 0, proteine: 0, carbohidrati: 0, zaharuri: 0, grasimi: 0, sare: 0 });

  const targetCalorii = parseInt(profil?.calorii) || 1600;
  const procentCalorii = Math.min(100, Math.round((totalZi.calorii / targetCalorii) * 100));
  const apaRecomandata = Math.round(((parseFloat(profil?.greutate) || 80) * 35) + (Math.max(0, totalZi.sare - 2) * 200));

  async function calculeaza() {
    if (!input.trim() || !userId) return;
    setLoading(true);
    const textIntrat = input.trim();
    setInput("");
    try {
      const reply = await apiFetch(
        [{ role: "user", content: `[${tipMasa.replace("_", " ").toUpperCase()} - ora ${oraMasa}]\n${textIntrat}` }],
        profil, "jurnal", {}
      );

      // Extract numeric values from reply using regex
      const extractNum = (text, pattern) => {
        const m = text.match(pattern);
        return m ? parseFloat(m[1]) : 0;
      };

      // Try to extract totals from the response
      const totalMatch = reply.match(/TOTAL[^]*?Calorii[^:]*:\s*~?(\d+)/i);
      const calTotal = totalMatch ? parseFloat(totalMatch[1]) : 0;
      const protMatch = reply.match(/Proteine[^:]*:\s*~?([\d.]+)\s*g/i);
      const carbMatch = reply.match(/Carbohidra[^:]*:\s*~?([\d.]+)\s*g/i);
      const zahMatch = reply.match(/Zah[^:]*:\s*~?([\d.]+)\s*g/i);
      const grasMatch = reply.match(/Gr[aă]simi[^:]*:\s*~?([\d.]+)\s*g/i);
      const sareMatch = reply.match(/Sare[^:]*:\s*~?([\d.]+)\s*g/i);
      const apaMatch = reply.match(/APĂ[^:]*:\s*~?(\d+)\s*ml/i);

      const item = {
        data, item: textIntrat, tip_masa: tipMasa, ora_masa: oraMasa,
        calorii: calTotal, proteine: protMatch ? parseFloat(protMatch[1]) : 0,
        carbohidrati: carbMatch ? parseFloat(carbMatch[1]) : 0,
        zaharuri: zahMatch ? parseFloat(zahMatch[1]) : 0,
        grasimi: grasMatch ? parseFloat(grasMatch[1]) : 0,
        sare: sareMatch ? parseFloat(sareMatch[1]) : 0,
        apa_recomandata: apaMatch ? parseFloat(apaMatch[1]) : 0,
        analiza: reply,
      };

      const temp = { id: "temp_" + Date.now(), ...item };
      setIntrari(prev => [...prev, temp]);

      const result = await addJurnal(userId, item);
      if (result?.[0]) {
        setIntrari(prev => prev.map(e => e.id === temp.id ? { ...result[0], analiza: reply } : e));
      }
    } catch (e) { console.error(e); alert("Eroare. Încearcă din nou."); }
    finally { setLoading(false); }
  }

  async function sterge(id) { await deleteJurnal(userId, id); setIntrari(p => p.filter(i => i.id !== id)); }

  const tipLabel = { mic_dejun: "🌅 Mic dejun", pranz: "☀️ Prânz", cina: "🌙 Cină", intermediar: "🍎 Gustare" };

  return (
    <div style={{ padding: "0 20px", overflowY: "auto", flex: 1 }}>
      {/* Date selector */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input type="date" value={data} onChange={e => setData(e.target.value)} style={{ flex: 1, background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 10, color: "#e2e8f0", padding: "8px 12px", fontSize: 14, outline: "none" }} />
      </div>

      {/* Daily summary */}
      {intrari.length > 0 && (
        <div style={{ background: "#1a2a1a", border: "1px solid #2a4a2a", borderRadius: 14, padding: "12px 16px", marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ color: "#22c55e", fontSize: 13, fontWeight: 700 }}>📊 Sumar zi</span>
            <span style={{ color: procentCalorii > 100 ? "#ef4444" : "#22c55e", fontSize: 13, fontWeight: 700 }}>{Math.round(totalZi.calorii)} / {targetCalorii} kcal</span>
          </div>
          <div style={{ background: "#2a3040", borderRadius: 6, height: 6, marginBottom: 10 }}>
            <div style={{ background: procentCalorii > 100 ? "#ef4444" : "linear-gradient(90deg, #22c55e, #4ade80)", height: "100%", width: `${procentCalorii}%`, borderRadius: 6, transition: "width 0.3s" }} />
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[["P", totalZi.proteine, "g", "#3b82f6"], ["C", totalZi.carbohidrati, "g", "#f59e0b"], ["Z", totalZi.zaharuri, "g", "#ec4899"], ["G", totalZi.grasimi, "g", "#8b5cf6"], ["🧂", totalZi.sare, "g", "#94a3b8"]].map(([label, val, unit, color]) => (
              <div key={label} style={{ background: "#1a1f2e", borderRadius: 8, padding: "4px 10px", display: "flex", gap: 4, alignItems: "center" }}>
                <span style={{ color, fontSize: 11, fontWeight: 700 }}>{label}</span>
                <span style={{ color: "#e2e8f0", fontSize: 11 }}>{Math.round(val * 10) / 10}{unit}</span>
              </div>
            ))}
            <div style={{ background: "#1a1f2e", borderRadius: 8, padding: "4px 10px", display: "flex", gap: 4, alignItems: "center" }}>
              <span style={{ color: "#06b6d4", fontSize: 11, fontWeight: 700 }}>💧</span>
              <span style={{ color: "#e2e8f0", fontSize: 11 }}>{apaRecomandata}ml recomandat</span>
            </div>
          </div>
        </div>
      )}

      {/* Input form */}
      <div style={{ background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 14, padding: "14px", marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <select value={tipMasa} onChange={e => setTipMasa(e.target.value)} style={{ flex: 1, background: "#0f1117", border: "1px solid #2a3040", borderRadius: 8, color: "#e2e8f0", padding: "6px 10px", fontSize: 13, outline: "none" }}>
            <option value="mic_dejun">🌅 Mic dejun</option>
            <option value="pranz">☀️ Prânz</option>
            <option value="cina">🌙 Cină</option>
            <option value="intermediar">🍎 Gustare</option>
          </select>
          <input type="time" value={oraMasa} onChange={e => setOraMasa(e.target.value)} style={{ background: "#0f1117", border: "1px solid #2a3040", borderRadius: 8, color: "#e2e8f0", padding: "6px 10px", fontSize: 13, outline: "none" }} />
        </div>
        <textarea value={input} onChange={e => setInput(e.target.value)}
          placeholder="Descrie ce ai mâncat: ex. 2 ouă, 400g cireșe, o pungă Savoria, 40g brânză..."
          rows={3}
          style={{ width: "100%", background: "#0f1117", border: "1px solid #2a3040", borderRadius: 10, color: "#e2e8f0", padding: "10px 12px", fontSize: 14, outline: "none", resize: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
        <button onClick={calculeaza} disabled={!input.trim() || loading}
          style={{ marginTop: 10, width: "100%", padding: "12px", background: !input.trim() || loading ? "#2a3040" : "linear-gradient(135deg, #16a34a, #22c55e)", border: "none", borderRadius: 10, color: "white", fontSize: 14, fontWeight: 700, cursor: !input.trim() || loading ? "default" : "pointer" }}>
          {loading ? "⏳ Calculez cu web search..." : "🔍 Calculează nutrienți complet"}
        </button>
      </div>

      {/* Entries */}
      {!intrari.length ? (
        <div style={{ textAlign: "center", color: "#4a5568", padding: "30px 0" }}>📓 Nicio intrare pentru această zi.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingBottom: 20 }}>
          {intrari.map(i => (
            <div key={i.id} style={{ background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 12, padding: "12px 14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ color: "#22c55e", fontSize: 12, fontWeight: 600 }}>{tipLabel[i.tip_masa] || "🍽️ Masă"}</span>
                  {i.ora_masa && <span style={{ color: "#4a5568", fontSize: 11 }}>🕐 {i.ora_masa}</span>}
                </div>
                <button onClick={() => sterge(i.id)} style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 13 }}>✕</button>
              </div>
              <div style={{ color: "#86efac", fontSize: 13, fontStyle: "italic", marginBottom: 8 }}>"{i.item}"</div>
              {/* Mini macro bar */}
              {(i.calorii > 0 || i.proteine > 0) && (
                <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
                  {[["kcal", i.calorii, "#22c55e"], ["P", i.proteine + "g", "#3b82f6"], ["C", i.carbohidrati + "g", "#f59e0b"], ["G", i.grasimi + "g", "#8b5cf6"], ["🧂", i.sare + "g", "#94a3b8"]].map(([l, v, c]) => (
                    <span key={l} style={{ background: "#0f1117", borderRadius: 6, padding: "2px 8px", fontSize: 11, color: c }}>{l}: {typeof v === "number" ? Math.round(v * 10) / 10 : v}</span>
                  ))}
                </div>
              )}
              {i.analiza && (
                <div>
                  <div style={{ color: "#e2e8f0", fontSize: 13, lineHeight: 1.7, maxHeight: expanded === i.id ? "none" : 140, overflow: "hidden" }}>
                    <FormatText text={i.analiza} />
                  </div>
                  {i.analiza.length > 300 && (
                    <button onClick={() => setExpanded(expanded === i.id ? null : i.id)} style={{ background: "transparent", border: "none", color: "#22c55e", fontSize: 12, cursor: "pointer", marginTop: 4 }}>
                      {expanded === i.id ? "▲ Mai puțin" : "▼ Vezi analiza completă"}
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Overall stats */}
      {stats && (
        <div style={{ background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 14, padding: "12px 16px", marginBottom: 20 }}>
          <div style={{ color: "#22c55e", fontSize: 13, fontWeight: 700, marginBottom: 8 }}>📈 Statistici generale</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 80, textAlign: "center" }}>
              <div style={{ color: "#e2e8f0", fontSize: 18, fontWeight: 700 }}>{stats.zileCuJurnal}</div>
              <div style={{ color: "#4a5568", fontSize: 11 }}>Zile jurnal</div>
            </div>
            <div style={{ flex: 1, minWidth: 80, textAlign: "center" }}>
              <div style={{ color: "#e2e8f0", fontSize: 18, fontWeight: 700 }}>{stats.medieCalorii}</div>
              <div style={{ color: "#4a5568", fontSize: 11 }}>kcal/zi medie</div>
            </div>
            <div style={{ flex: 1, minWidth: 80, textAlign: "center" }}>
              <div style={{ color: "#e2e8f0", fontSize: 18, fontWeight: 700 }}>{stats.medieSare}g</div>
              <div style={{ color: "#4a5568", fontSize: 11 }}>Sare medie/masă</div>
            </div>
          </div>
        </div>
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
        [{ role: "user", content: `Generează un plan alimentar COMPLET pentru 7 zile (Luni-Duminică). \n\nPentru FIECARE masă (mic dejun, prânz, cină, gustare):\n- Ingrediente cu gramaje EXACTE\n- Mod de preparare PAS CU PAS (pentru un începător absolut)\n- Timpi EXACȚI de gătire și temperaturi\n- Sfaturi practice specifice\n- Tabel: kcal | Proteine | Carbohidrați | Zahăr | Grăsimi | Sare\n- Apă recomandată pentru ziua respectivă\n- Total pe zi\n\nRespectă STRICT: ${profil?.calorii || 1600} kcal/zi, ${profil?.restrictii || "fără gluten, low-carb"}.` }],
        profil, "plan", {}
      );
      setPlan(reply); saveLS("plan_saptamana", reply);
    } catch { alert("Eroare. Încearcă din nou."); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ padding: "0 20px", overflowY: "auto", flex: 1 }}>
      <button onClick={genereaza} disabled={loading} style={{ width: "100%", padding: "14px", background: loading ? "#2a3040" : "linear-gradient(135deg, #16a34a, #22c55e)", border: "none", borderRadius: 12, color: "white", fontSize: 15, fontWeight: 700, cursor: loading ? "default" : "pointer", marginBottom: 16 }}>
        {loading ? "⏳ Generez plan detaliat (30-60 sec)..." : "🔄 Generează plan săptămânal cu rețete complete"}
      </button>
      {plan ? (
        <div style={{ background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 14, padding: "16px", color: "#e2e8f0", fontSize: 14, lineHeight: 1.8, paddingBottom: 20 }}>
          <FormatText text={plan} />
        </div>
      ) : (
        <div style={{ textAlign: "center", color: "#4a5568", padding: "60px 0" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📅</div>
          <div>Apasă pentru plan cu rețete complete și pași detaliați.</div>
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
      const reply = await apiFetch(
        [{ role: "user", content: "Analizează progresul meu complet și dă-mi sfaturi concrete bazate pe datele reale. Ce merge bine? Ce trebuie îmbunătățit? Cum pot elimina apa reținută? Cât mai am până la obiectiv?" }],
        profil, undefined, globalContext
      );
      setAnaliza(reply);
    } catch { alert("Eroare."); }
    finally { setLoadingAnaliza(false); }
  }

  const ultima = intrari[intrari.length - 1];
  const prima = intrari[0];
  const diffKg = ultima?.greutate && prima?.greutate && intrari.length > 1 ? (ultima.greutate - prima.greutate).toFixed(1) : null;
  const diffCm = ultima?.abdomen && prima?.abdomen && intrari.length > 1 ? (ultima.abdomen - prima.abdomen).toFixed(1) : null;
  const imcActual = ultima?.greutate && profil?.inaltime ? (ultima.greutate / Math.pow(profil.inaltime / 100, 2)).toFixed(1) : null;
  const targetCm = 8;
  const progresAbdomen = diffCm ? Math.min(100, (Math.abs(parseFloat(diffCm)) / targetCm) * 100) : 0;

  function renderChart(field, color, label) {
    const vals = intrari.filter(i => i[field] != null).map(i => ({ val: parseFloat(i[field]), data: i.data }));
    if (vals.length < 2) return null;
    const w = 320, h = 100, pad = 20;
    const min = Math.min(...vals.map(v => v.val)) - 0.5;
    const max = Math.max(...vals.map(v => v.val)) + 0.5;
    const pts = vals.map((v, i) => {
      const x = pad + (i / (vals.length - 1)) * (w - 2 * pad);
      const y = pad + ((max - v.val) / (max - min)) * (h - 2 * pad);
      return `${x},${y}`;
    }).join(" ");
    return (
      <div style={{ background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 12, padding: "12px", marginBottom: 12 }}>
        <div style={{ color, fontSize: 12, marginBottom: 4 }}>{label}: {vals[0].val} → {vals[vals.length-1].val}</div>
        <svg width="100%" viewBox={`0 0 ${w} ${h}`}>
          <polyline fill="none" stroke={color} strokeWidth="2.5" points={pts} />
          {vals.map((v, i) => {
            const x = pad + (i / (vals.length - 1)) * (w - 2 * pad);
            const y = pad + ((max - v.val) / (max - min)) * (h - 2 * pad);
            return <circle key={i} cx={x} cy={y} r="4" fill={color} />;
          })}
        </svg>
      </div>
    );
  }

  return (
    <div style={{ padding: "0 20px", overflowY: "auto", flex: 1 }}>
      {/* Stats */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {ultima?.greutate && <div style={{ flex: 1, minWidth: 75, background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 12, padding: "10px", textAlign: "center" }}>
          <div style={{ color: "#22c55e", fontSize: 18, fontWeight: 700 }}>{ultima.greutate}</div>
          <div style={{ color: "#4a5568", fontSize: 10 }}>kg actual</div>
        </div>}
        {diffKg !== null && <div style={{ flex: 1, minWidth: 75, background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 12, padding: "10px", textAlign: "center" }}>
          <div style={{ color: parseFloat(diffKg) <= 0 ? "#22c55e" : "#ef4444", fontSize: 18, fontWeight: 700 }}>{diffKg > 0 ? "+" : ""}{diffKg}</div>
          <div style={{ color: "#4a5568", fontSize: 10 }}>kg total</div>
        </div>}
        {ultima?.abdomen && <div style={{ flex: 1, minWidth: 75, background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 12, padding: "10px", textAlign: "center" }}>
          <div style={{ color: "#3b82f6", fontSize: 18, fontWeight: 700 }}>{ultima.abdomen}</div>
          <div style={{ color: "#4a5568", fontSize: 10 }}>cm abd.</div>
        </div>}
        {diffCm !== null && <div style={{ flex: 1, minWidth: 75, background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 12, padding: "10px", textAlign: "center" }}>
          <div style={{ color: parseFloat(diffCm) <= 0 ? "#22c55e" : "#ef4444", fontSize: 18, fontWeight: 700 }}>{diffCm > 0 ? "+" : ""}{diffCm}</div>
          <div style={{ color: "#4a5568", fontSize: 10 }}>cm total</div>
        </div>}
        {imcActual && <div style={{ flex: 1, minWidth: 75, background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 12, padding: "10px", textAlign: "center" }}>
          <div style={{ color: "#f59e0b", fontSize: 18, fontWeight: 700 }}>{imcActual}</div>
          <div style={{ color: "#4a5568", fontSize: 10 }}>IMC</div>
        </div>}
      </div>

      {/* Obiectiv progress */}
      {diffCm !== null && (
        <div style={{ background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 12, padding: "12px", marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ color: "#94a3b8", fontSize: 12 }}>🎯 Obiectiv: -{targetCm}cm abdomen</span>
            <span style={{ color: "#3b82f6", fontSize: 12 }}>{Math.abs(parseFloat(diffCm)).toFixed(1)}/{targetCm}cm</span>
          </div>
          <div style={{ background: "#2a3040", borderRadius: 6, height: 8 }}>
            <div style={{ background: "linear-gradient(90deg, #3b82f6, #22c55e)", height: "100%", width: `${progresAbdomen}%`, borderRadius: 6, transition: "width 0.5s" }} />
          </div>
          <div style={{ color: "#4a5568", fontSize: 11, marginTop: 4 }}>{progresAbdomen.toFixed(0)}% din obiectiv atins</div>
        </div>
      )}

      {renderChart("greutate", "#22c55e", "⚖️ Greutate (kg)")}
      {renderChart("abdomen", "#3b82f6", "📏 Circumferință abdomen (cm)")}

      {/* Add */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <input type="date" value={data} onChange={e => setData(e.target.value)} style={{ flex: 2, minWidth: 120, background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 10, color: "#e2e8f0", padding: "8px 12px", fontSize: 14, outline: "none" }} />
        <input value={greutate} onChange={e => setGreutate(e.target.value)} placeholder="kg" type="number" step="0.1" style={{ width: 70, background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 10, color: "#e2e8f0", padding: "8px 10px", fontSize: 14, outline: "none" }} />
        <input value={abdomen} onChange={e => setAbdomen(e.target.value)} placeholder="cm abd" type="number" step="0.5" style={{ width: 80, background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 10, color: "#e2e8f0", padding: "8px 10px", fontSize: 14, outline: "none" }} />
        <button onClick={adauga} style={{ background: "linear-gradient(135deg, #16a34a, #22c55e)", border: "none", borderRadius: 10, color: "white", padding: "8px 14px", cursor: "pointer", fontSize: 16 }}>+</button>
      </div>

      {/* AI Analysis button */}
      <button onClick={cereAnaliza} disabled={loadingAnaliza} style={{ width: "100%", padding: "12px", background: loadingAnaliza ? "#2a3040" : "#1a2a3a", border: "1px solid #3b82f6", borderRadius: 12, color: "#3b82f6", fontSize: 14, fontWeight: 600, cursor: loadingAnaliza ? "default" : "pointer", marginBottom: 16 }}>
        {loadingAnaliza ? "⏳ Analizez progresul tău..." : "🤖 Analizează progresul meu cu AI"}
      </button>

      {analiza && (
        <div style={{ background: "#1a2030", border: "1px solid #3b82f6", borderRadius: 14, padding: "14px", marginBottom: 16, color: "#e2e8f0", fontSize: 14, lineHeight: 1.7 }}>
          <FormatText text={analiza} />
        </div>
      )}

      {!intrari.length ? (
        <div style={{ textAlign: "center", color: "#4a5568", padding: "30px 0" }}><div style={{ fontSize: 40, marginBottom: 12 }}>⚖️</div><div>Adaugă prima înregistrare.</div></div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingBottom: 20 }}>
          {[...intrari].reverse().map(i => (
            <div key={i.id} style={{ background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 12, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "#94a3b8", fontSize: 13 }}>{new Date(i.data + "T12:00:00").toLocaleDateString("ro-RO")}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
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
  const [plan, setPlan] = useState(() => loadLS("plan_sport", null));
  const [loading, setLoading] = useState(false);
  const [ideiZilnice, setIdeiZilnice] = useState(() => loadLS("idei_sport_azi", null));
  const [loadingIdei, setLoadingIdei] = useState(false);

  async function genereazaPlan() {
    setLoading(true);
    try {
      const reply = await apiFetch(
        [{ role: "user", content: "Creează-mi un plan sport COMPLET și PROGRESIV pentru 3 luni. Știi că am 44 ani, stil sedentar, genunchi sensibili și spate neantrenat. Vreau să mă apuc ușor-ușor, fără să mă rănesc. Include și exerciții de tai-chi dacă le consideri potrivite." }],
        profil, "sport", globalContext
      );
      setPlan(reply); saveLS("plan_sport", reply);
    } catch { alert("Eroare."); }
    finally { setLoading(false); }
  }

  async function genereazaIdeiZilnice() {
    setLoadingIdei(true);
    try {
      const reply = await apiFetch(
        [{ role: "user", content: "Dă-mi 5 idei concrete pentru ziua de azi: mișcare, nutriție, hidratare, wellbeing și un sfat zilnic personalizat pentru mine." }],
        profil, "idei_zilnice", globalContext
      );
      setIdeiZilnice(reply); saveLS("idei_sport_azi", reply);
    } catch { alert("Eroare."); }
    finally { setLoadingIdei(false); }
  }

  return (
    <div style={{ padding: "0 20px", overflowY: "auto", flex: 1 }}>
      {/* Idei zilnice */}
      <div style={{ marginBottom: 16 }}>
        <button onClick={genereazaIdeiZilnice} disabled={loadingIdei} style={{ width: "100%", padding: "12px", background: loadingIdei ? "#2a3040" : "#1a2030", border: "1px solid #f59e0b", borderRadius: 12, color: "#f59e0b", fontSize: 14, fontWeight: 600, cursor: loadingIdei ? "default" : "pointer", marginBottom: 10 }}>
          {loadingIdei ? "⏳ Generez idei..." : "💡 Idei personalizate pentru azi"}
        </button>
        {ideiZilnice && (
          <div style={{ background: "#1a1f2e", border: "1px solid #f59e0b", borderRadius: 14, padding: "14px", color: "#e2e8f0", fontSize: 14, lineHeight: 1.8 }}>
            <FormatText text={ideiZilnice} />
          </div>
        )}
      </div>

      {/* Plan sport */}
      <button onClick={genereazaPlan} disabled={loading} style={{ width: "100%", padding: "14px", background: loading ? "#2a3040" : "linear-gradient(135deg, #16a34a, #22c55e)", border: "none", borderRadius: 12, color: "white", fontSize: 15, fontWeight: 700, cursor: loading ? "default" : "pointer", marginBottom: 16 }}>
        {loading ? "⏳ Generez plan sport (30-60 sec)..." : "🏃 Generează plan sport 3 luni adaptat mie"}
      </button>

      {plan ? (
        <div style={{ background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 14, padding: "16px", color: "#e2e8f0", fontSize: 14, lineHeight: 1.8, paddingBottom: 20 }}>
          <FormatText text={plan} />
        </div>
      ) : (
        <div style={{ textAlign: "center", color: "#4a5568", padding: "40px 0" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🏃</div>
          <div>Plan sport adaptat pentru genunchii și spatele tău.</div>
          <div style={{ fontSize: 12, marginTop: 8, color: "#2a3040" }}>Include tai-chi, stretching, mers progresiv — zero risc de rănire.</div>
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
    { id: 6, label: "Sport / Mișcare", ora: "17:30", activ: false },
    { id: 7, label: "Apă (hidratare)", ora: "10:00", activ: true },
    { id: 8, label: "Apă (hidratare)", ora: "15:00", activ: true },
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
            <div style={{ color: "#4a5568", fontSize: 12 }}>{permisiune === "granted" ? "✅ Active" : "⚠️ Neactivate"}</div>
          </div>
          {permisiune !== "granted" && <button onClick={cerePermisiune} style={{ background: "linear-gradient(135deg, #16a34a, #22c55e)", border: "none", borderRadius: 10, color: "white", padding: "8px 14px", cursor: "pointer", fontSize: 13 }}>Activează</button>}
          {permisiune === "granted" && <button onClick={() => new Notification("Agent Nutriție 🥦", { body: "Funcționează!" })} style={{ background: "#1a2a1a", border: "1px solid #2a4a2a", borderRadius: 10, color: "#22c55e", padding: "8px 14px", cursor: "pointer", fontSize: 13 }}>Testează</button>}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
        {reminders.map(r => (
          <div key={r.id} style={{ background: "#1a1f2e", border: `1px solid ${r.activ ? "#2a4a2a" : "#2a3040"}`, borderRadius: 12, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={() => toggle(r.id)} style={{ width: 38, height: 22, borderRadius: 11, background: r.activ ? "#22c55e" : "#2a3040", border: "none", cursor: "pointer", position: "relative", flexShrink: 0 }}>
              <div style={{ width: 18, height: 18, borderRadius: "50%", background: "white", position: "absolute", top: 2, left: r.activ ? 18 : 2, transition: "left 0.2s" }} />
            </button>
            <span style={{ flex: 1, color: r.activ ? "#e2e8f0" : "#4a5568", fontSize: 14 }}>{r.label}</span>
            <input type="time" value={r.ora} onChange={e => updateOra(r.id, e.target.value)} style={{ background: "#0f1117", border: "1px solid #2a3040", borderRadius: 8, color: "#e2e8f0", padding: "4px 8px", fontSize: 13, outline: "none" }} />
            <button onClick={() => sterge(r.id)} style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer" }}>✕</button>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, paddingBottom: 20 }}>
        <input value={nou.label} onChange={e => setNou(p => ({ ...p, label: e.target.value }))} placeholder="Nume reminder..." style={{ flex: 1, background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 10, color: "#e2e8f0", padding: "8px 12px", fontSize: 14, outline: "none" }} onKeyDown={e => e.key === "Enter" && adauga()} />
        <input type="time" value={nou.ora} onChange={e => setNou(p => ({ ...p, ora: e.target.value }))} style={{ background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 10, color: "#e2e8f0", padding: "8px 12px", fontSize: 14, outline: "none" }} />
        <button onClick={adauga} style={{ background: "linear-gradient(135deg, #16a34a, #22c55e)", border: "none", borderRadius: 10, color: "white", padding: "8px 14px", cursor: "pointer", fontSize: 16 }}>+</button>
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
      const reply = await apiFetch(
        [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: imagine.type, data: imagine.data } }, { type: "text", text: `Analizează acest produs. Caută online valorile nutriționale exacte dacă e un produs de marcă românesc. Spune-mi:\n1. Valorile nutriționale per 100g și per porție (kcal, proteine, carbohidrați, zahăr, grăsimi, sare)\n2. Ingredientele principale\n3. ✅ DA sau ❌ NU pentru dieta mea (${profil?.restrictii || "fără gluten, low-carb"})\n4. Cât de mult pot mânca pe zi din acest produs respectând targetul meu.` }] }],
        profil, undefined, {}
      );
      setRezultat(reply);
      const item = { id: Date.now(), preview, rezultat: reply, data: new Date().toLocaleDateString("ro-RO") };
      const u = [item, ...istoric].slice(0, 20); setIstoric(u); saveLS("istoric_produse", u);
    } catch { setRezultat("Eroare. Încearcă din nou."); }
    finally { setLoading(false); }
  }

  function reset() { setImagine(null); setPreview(null); setRezultat(null); if (fileRef.current) fileRef.current.value = ""; if (camRef.current) camRef.current.value = ""; }

  return (
    <div style={{ padding: "0 20px", overflowY: "auto", flex: 1 }}>
      {!preview ? (
        <div>
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <button onClick={() => camRef.current?.click()} style={{ flex: 1, padding: "16px", background: "linear-gradient(135deg, #16a34a, #22c55e)", border: "none", borderRadius: 14, color: "white", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>📷 Fotografiază produs</button>
            <button onClick={() => fileRef.current?.click()} style={{ flex: 1, padding: "16px", background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 14, color: "#94a3b8", fontSize: 14, cursor: "pointer" }}>🖼️ Din galerie</button>
          </div>
          <input ref={camRef} type="file" accept="image/*" capture="environment" onChange={handleFile} style={{ display: "none" }} />
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />
          <div style={{ color: "#4a5568", fontSize: 13, textAlign: "center", marginBottom: 16 }}>Fotografiază eticheta sau produsul — agentul caută valorile exacte online.</div>
          {!!istoric.length && (
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
          <img src={preview} alt="" style={{ width: "100%", borderRadius: 14, maxHeight: 220, objectFit: "cover", marginBottom: 14 }} />
          {!rezultat ? (
            <button onClick={analizeaza} disabled={loading} style={{ width: "100%", padding: "14px", background: loading ? "#2a3040" : "linear-gradient(135deg, #16a34a, #22c55e)", border: "none", borderRadius: 12, color: "white", fontSize: 15, fontWeight: 700, cursor: loading ? "default" : "pointer", marginBottom: 10 }}>
              {loading ? "🔍 Caut online + analizez..." : "🔍 Analizează produsul"}
            </button>
          ) : (
            <div style={{ background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 14, padding: "16px", color: "#e2e8f0", fontSize: 14, lineHeight: 1.7, marginBottom: 10 }}><FormatText text={rezultat} /></div>
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
  const fileRef = useRef(null);

  useEffect(() => { const uid = getUserId(); setUserId(uid); getRetete(uid).then(d => setRetete(d || [])); }, []);

  async function handleUpload(e) {
    const f = e.target.files[0]; if (!f) return; setLoading(true);
    const r = new FileReader();
    r.onload = async () => {
      try {
        const base64 = r.result.split(",")[1];
        const reply = await apiFetch(
          [{ role: "user", content: [{ type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }, { type: "text", text: "Extrage TOATE rețetele din acest document. Pentru fiecare: nume bold, ingrediente cu gramaje, pași detaliați, valori nutriționale dacă există." }] }],
          profil, undefined, {}
        );
        const item = { nume: f.name.replace(/\.[^/.]+$/, ""), continut: reply, tip: f.type };
        const result = await addReteta(userId, item);
        if (result?.[0]) setRetete(p => [result[0], ...p]);
        alert("✅ Rețetele salvate în cloud!");
      } catch { alert("Eroare."); }
      finally { setLoading(false); if (fileRef.current) fileRef.current.value = ""; }
    };
    r.readAsDataURL(f);
  }

  async function sterge(id) { await deleteReteta(userId, id); setRetete(p => p.filter(r => r.id !== id)); if (selected?.id === id) setSelected(null); }

  if (selected) return (
    <div style={{ padding: "0 20px", overflowY: "auto", flex: 1 }}>
      <button onClick={() => setSelected(null)} style={{ background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 10, color: "#94a3b8", padding: "8px 14px", cursor: "pointer", fontSize: 13, marginBottom: 16 }}>← Înapoi</button>
      <div style={{ color: "#22c55e", fontSize: 16, fontWeight: 700, marginBottom: 12 }}>📄 {selected.nume}</div>
      <div style={{ color: "#e2e8f0", fontSize: 14, lineHeight: 1.8, paddingBottom: 20 }}><FormatText text={selected.continut} /></div>
    </div>
  );

  return (
    <div style={{ padding: "0 20px", overflowY: "auto", flex: 1 }}>
      <button onClick={() => fileRef.current?.click()} disabled={loading} style={{ width: "100%", padding: "14px", background: loading ? "#2a3040" : "linear-gradient(135deg, #16a34a, #22c55e)", border: "none", borderRadius: 12, color: "white", fontSize: 14, fontWeight: 700, cursor: loading ? "default" : "pointer", marginBottom: 8 }}>
        {loading ? "⏳ Se procesează..." : "📤 Încarcă rețete (PDF sau Word)"}
      </button>
      <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.txt" onChange={handleUpload} style={{ display: "none" }} />
      <div style={{ color: "#4a5568", fontSize: 12, textAlign: "center", marginBottom: 16 }}>Agentul extrage, salvează în cloud și le folosește când ceri recomandări.</div>
      {!retete.length ? (
        <div style={{ textAlign: "center", color: "#4a5568", padding: "40px 0" }}><div style={{ fontSize: 40, marginBottom: 12 }}>📚</div><div>Nicio rețetă încărcată.</div></div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingBottom: 20 }}>
          {retete.map(r => (
            <div key={r.id} onClick={() => setSelected(r)} style={{ background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 12, padding: "12px 16px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ color: "#22c55e", fontSize: 14, fontWeight: 600 }}>📄 {r.nume}</div>
                <div style={{ color: "#4a5568", fontSize: 11 }}>{new Date(r.created_at).toLocaleDateString("ro-RO")} · Apasă pentru a citi</div>
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
  const [globalContext, setGlobalContext] = useState({});

  useEffect(() => {
    const uid = getUserId();
    const saved = localStorage.getItem("profil_nutritie");
    if (saved) setProfil(JSON.parse(saved));

    // Load ALL context for memory
    Promise.all([
      getMemory(uid),
      getJurnalRecent(uid),
      getProgres(uid),
      getRetete(uid),
      getJurnalStats(uid),
    ]).then(([memory, jurnal, progres, retete, stats]) => {
      setGlobalContext({ memory, jurnal, progres, retete, stats });
    });
  }, []);

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: "#0f1117", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ width: "100%", maxWidth: 680, display: "flex", flexDirection: "column", height: "100vh" }}>
        {/* Header */}
        <div style={{ padding: "14px 20px 0" }}>
          <div style={{ background: "linear-gradient(135deg, #1a2a1a, #0f1f0f)", border: "1px solid #2a4a2a", borderRadius: 16, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #22c55e, #16a34a)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>🥦</div>
            <div style={{ flex: 1 }}>
              <div style={{ color: "#22c55e", fontWeight: 700, fontSize: 14 }}>Agent Nutriție & Sport</div>
              <div style={{ color: "#4ade80", fontSize: 11, opacity: 0.8 }}>
                {profil?.nume ? `${profil.nume} · ${profil.calorii || 1600} kcal` : "Completează profilul"} · 🧠 {globalContext?.memory?.length || 0} amintiri
              </div>
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

        {/* Content */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", paddingTop: 12 }}>
          {tab === 0 && <ChatTab profil={profil} globalContext={globalContext} />}
          {tab === 1 && <FavoriteTab />}
          {tab === 2 && <JurnalTab profil={profil} />}
          {tab === 3 && <SaptamanaTab profil={profil} />}
          {tab === 4 && <ProgresTab profil={profil} globalContext={globalContext} />}
          {tab === 5 && <SportTab profil={profil} globalContext={globalContext} />}
          {tab === 6 && <ReminderTab />}
          {tab === 7 && <ProdusTab profil={profil} />}
          {tab === 8 && <ReteteTab profil={profil} />}
        </div>
      </div>

      <style>{`
        @keyframes bounce { 0%, 60%, 100% { transform: translateY(0); } 30% { transform: translateY(-6px); } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: #2a3040; border-radius: 2px; }
        input[type="date"]::-webkit-calendar-picker-indicator, input[type="time"]::-webkit-calendar-picker-indicator { filter: invert(1); }
        select option { background: #1a1f2e; }
      `}</style>
    </div>
  );
}
