"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  getUserId,
  getSessions, upsertSession, patchSession, deleteSession,
  getMemory, addMemory,
  getJurnalZi, getJurnalRecent, getJurnalStats, upsertJurnal, deleteJurnalEntry,
  getSaptamanaChat, upsertSaptamanaChat,
  getProgres, upsertProgres, deleteProgres,
  getProfil,
  getFavorite, addFavorit, deleteFavorit,
  getRetete, addReteta, deleteReteta,
  getSportZi, upsertSportZi, getSportIstoric,
} from "./lib/supabase";

const TABS = ["💬 Chat", "❤️ Favorite", "📓 Jurnal", "📅 Săptămână", "⚖️ Progres", "🏃 Sport", "🔔 Remindere", "🔍 Produs", "📚 Rețete"];

const SUGGESTIONS = [
  "Vreau idei concrete pentru subțierea abdomenului",
  "Dă-mi un plan sport sigur pentru genunchii mei",
  "Am piept de pui 200g și broccoli. Ce fac?",
  "Cum elimin apa reținută în corp?",
  "Care e progresul meu până acum?",
];

function saveLS(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }
function loadLS(key, def) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch { return def; } }

async function callAPI(messages, profil, tip, context) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, profil, tip, context: context || {} }),
  });
  const d = await res.json();
  return d.reply || "Eroare.";
}

function Txt({ text }) {
  if (!text) return null;
  return <>
    {text.split("\n").map((line, i) => {
      if (line.match(/^\|/)) return <div key={i} style={{ fontFamily: "monospace", fontSize: 12, color: "#94a3b8", whiteSpace: "nowrap", overflowX: "auto" }}>{line}</div>;
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      return <p key={i} style={{ margin: "2px 0", minHeight: "1em" }}>{parts.map((p, j) => p.startsWith("**") && p.endsWith("**") ? <strong key={j}>{p.slice(2,-2)}</strong> : p)}</p>;
    })}
  </>;
}

function ChatBubbles({ messages, loading }) {
  const ref = useRef(null);
  useEffect(() => { ref.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {(messages||[]).map((m, i) => (
        <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
          <div style={{ maxWidth: "85%", padding: "10px 14px", borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px", background: m.role === "user" ? "linear-gradient(135deg,#16a34a,#22c55e)" : "#1a1f2e", border: m.role === "assistant" ? "1px solid #2a3040" : "none", color: m.role === "user" ? "#fff" : "#e2e8f0", fontSize: 14, lineHeight: 1.7 }}>
            <Txt text={m.content} />
          </div>
        </div>
      ))}
      {loading && <div style={{ display: "flex" }}><div style={{ padding: "10px 14px", borderRadius: "16px 16px 16px 4px", background: "#1a1f2e", border: "1px solid #2a3040", display: "flex", gap: 5 }}>{[0,1,2].map(d => <div key={d} style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", animation: "bounce 1.2s infinite", animationDelay: `${d*0.2}s` }} />)}</div></div>}
      <div ref={ref} />
    </div>
  );
}

function ChatInput({ onSend, loading, placeholder, extraButtons }) {
  const [val, setVal] = useState("");
  function send() { const t = val.trim(); if (!t || loading) return; setVal(""); onSend(t); }
  return (
    <div>
      {extraButtons && <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>{extraButtons}</div>}
      <div style={{ display: "flex", gap: 8, background: "#0f1117", border: "1px solid #2a3040", borderRadius: 12, padding: "6px 6px 6px 12px" }}>
        <textarea value={val} onChange={e => setVal(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder={placeholder || "Scrie..."} rows={1} style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#e2e8f0", fontSize: 14, resize: "none", fontFamily: "inherit", paddingTop: 4 }} />
        <button onClick={send} disabled={!val.trim() || loading} style={{ width: 34, height: 34, borderRadius: 8, background: val.trim() && !loading ? "linear-gradient(135deg,#16a34a,#22c55e)" : "#2a3040", border: "none", color: "white", fontSize: 18, cursor: "pointer", flexShrink: 0 }}>↑</button>
      </div>
    </div>
  );
}

// ── CHAT TAB ─────────────────────────────────────────────────────────────────
function ChatTab({ profil, ctx }) {
  const initMsg = { role: "assistant", content: `Salut${profil?.nume ? ", " + profil.nume : ""}! Sunt agentul tău personal.\n🧠 ${ctx?.memory?.length || 0} amintiri · 🔍 Web search activ · 👤 Profilul tău complet\n\nCu ce te ajut azi?` };
  const mkSess = () => ({ id: "s_" + Math.random().toString(36).slice(2) + Date.now(), title: "Conversație nouă", messages: [initMsg] });

  const [sessions, setSessions] = useState([mkSess()]);
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState(null);
  const [imgAttach, setImgAttach] = useState(null);
  const [imgPrev, setImgPrev] = useState(null);
  const [docAttach, setDocAttach] = useState(null);
  const [docName, setDocName] = useState(null);
  const imgRef = useRef(null);
  const docRef = useRef(null);

  useEffect(() => {
    const uid = getUserId(); setUserId(uid);
    getSessions(uid).then(d => { if (d?.length) setSessions(d); });
  }, []);

  const sess = sessions[idx] || sessions[0];
  const msgs = sess?.messages || [initMsg];

  async function saveCurrentSession(newMsgs, newTitle) {
    if (!userId || !sess) return;
    const updated = { ...sess, messages: newMsgs, title: newTitle || sess.title, updated_at: new Date().toISOString() };
    // Check if exists
    const existing = sessions.find((s, i) => i === idx);
    if (existing?.id && !existing.id.startsWith("s_new")) {
      await patchSession(userId, sess.id, { messages: newMsgs, title: updated.title, updated_at: updated.updated_at });
    } else {
      await upsertSession(userId, { ...updated, user_id: userId });
    }
    setSessions(prev => { const u = [...prev]; u[idx] = updated; return u; });
  }

  async function newSess() {
    const s = mkSess();
    await upsertSession(userId, { ...s, user_id: userId });
    setSessions(p => [s, ...p]); setIdx(0);
  }

  async function removeSess(i) {
    const s = sessions[i];
    if (userId && s.messages?.length > 2) {
      try {
        const conv = s.messages.slice(1).map(m => `${m.role==="user"?"U":"A"}: ${m.content?.slice(0,200)}`).join("\n");
        const rez = await callAPI([{role:"user",content:conv}], profil, "rezumat", {});
        await addMemory(userId, rez);
      } catch {}
    }
    if (userId) await deleteSession(userId, s.id);
    if (sessions.length === 1) { const ns = mkSess(); setSessions([ns]); setIdx(0); return; }
    setSessions(p => p.filter((_,j) => j !== i)); setIdx(0);
  }

  function handleImg(e) {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => { setImgAttach({data:r.result.split(",")[1],type:f.type}); setImgPrev(r.result); setDocAttach(null); setDocName(null); };
    r.readAsDataURL(f);
  }

  function handleDoc(e) {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => { setDocAttach({data:r.result.split(",")[1],type:f.type}); setDocName(f.name); setImgAttach(null); setImgPrev(null); };
    r.readAsDataURL(f);
  }

  function clearAttach() { setImgAttach(null); setImgPrev(null); setDocAttach(null); setDocName(null); if(imgRef.current)imgRef.current.value=""; if(docRef.current)docRef.current.value=""; }

  async function saveFav(content) { if(userId) await addFavorit(userId,{title:content.slice(0,50)+"...",content}); alert("✅ Salvat!"); }

  async function send(txt) {
    let apiContent = txt;
    if (imgAttach) { apiContent = [{type:"image",source:{type:"base64",media_type:imgAttach.type,data:imgAttach.data}},{type:"text",text:txt||"Analizează imaginea în contextul nutriției mele."}]; }
    else if (docAttach) { apiContent = [{type:"document",source:{type:"base64",media_type:docAttach.type,data:docAttach.data}},{type:"text",text:txt||"Extrage informațiile relevante."}]; }

    const dispMsg = { role:"user", content: txt||(imgAttach?"📷 Poză":`📄 ${docName}`), imgPrev, docName };
    const newMsgs = [...msgs, dispMsg];

    // Update UI immediately
    setSessions(prev => { const u=[...prev]; u[idx]={...u[idx],messages:newMsgs}; return u; });
    clearAttach(); setLoading(true);

    const apiMsgs = newMsgs.map((m,i) => ({ role:m.role, content: i===newMsgs.length-1 ? apiContent : (typeof m.content==="string"?m.content:m.content) }));
    const tip = txt?.toLowerCase().match(/sport|exerci|antren|miscare|mișcare|genunchi|tai.chi|yoga/) ? "sport" : undefined;

    try {
      const reply = await callAPI(apiMsgs, profil, tip, ctx);
      const finalMsgs = [...newMsgs, {role:"assistant",content:reply}];
      const title = sess.title==="Conversație nouă" ? txt?.slice(0,35)+"..." : sess.title;
      await saveCurrentSession(finalMsgs, title);
    } catch {
      const finalMsgs = [...newMsgs, {role:"assistant",content:"Eroare. Încearcă din nou."}];
      setSessions(prev => { const u=[...prev]; u[idx]={...u[idx],messages:finalMsgs}; return u; });
    } finally { setLoading(false); }
  }

  return (
    <div style={{display:"flex",flexDirection:"column",flex:1,minHeight:0}}>
      {/* Session bar */}
      <div style={{display:"flex",gap:6,padding:"0 20px 8px",overflowX:"auto"}}>
        <button onClick={newSess} style={{background:"#22c55e",border:"none",borderRadius:20,color:"white",padding:"4px 12px",fontSize:12,cursor:"pointer",flexShrink:0}}>+ Nou</button>
        {sessions.map((s,i) => (
          <div key={s.id} onClick={()=>setIdx(i)} style={{display:"flex",alignItems:"center",gap:4,background:i===idx?"#1a2a1a":"#1a1f2e",border:`1px solid ${i===idx?"#22c55e":"#2a3040"}`,borderRadius:20,padding:"4px 10px",cursor:"pointer",flexShrink:0}}>
            <span style={{color:i===idx?"#22c55e":"#94a3b8",fontSize:11,maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.title}</span>
            <span onClick={e=>{e.stopPropagation();removeSess(i);}} style={{color:"#ef4444",fontSize:11,cursor:"pointer",marginLeft:2}}>✕</span>
          </div>
        ))}
      </div>

      {/* Messages */}
      <div style={{flex:1,padding:"0 20px",overflowY:"auto",paddingBottom:8}}>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {msgs.map((m,i) => (
            <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start",flexDirection:"column",alignItems:m.role==="user"?"flex-end":"flex-start"}}>
              <div style={{maxWidth:"85%",padding:"12px 16px",borderRadius:m.role==="user"?"18px 18px 4px 18px":"18px 18px 18px 4px",background:m.role==="user"?"linear-gradient(135deg,#16a34a,#22c55e)":"#1a1f2e",border:m.role==="assistant"?"1px solid #2a3040":"none",color:m.role==="user"?"#fff":"#e2e8f0",fontSize:14,lineHeight:1.7}}>
                {m.imgPrev && <img src={m.imgPrev} alt="" style={{width:"100%",borderRadius:8,marginBottom:8,maxHeight:200,objectFit:"cover"}} />}
                {m.docName && <div style={{background:"rgba(255,255,255,0.15)",borderRadius:8,padding:"4px 8px",marginBottom:8,fontSize:12}}>📄 {m.docName}</div>}
                <Txt text={typeof m.content==="string"?m.content:""} />
              </div>
              {m.role==="assistant" && i>0 && <button onClick={()=>saveFav(m.content)} style={{background:"transparent",border:"none",color:"#4ade80",fontSize:11,cursor:"pointer",marginTop:2}}>❤️ Salvează</button>}
            </div>
          ))}
          {loading && <div style={{display:"flex"}}><div style={{padding:"12px 16px",borderRadius:"18px 18px 18px 4px",background:"#1a1f2e",border:"1px solid #2a3040",display:"flex",gap:5,alignItems:"center"}}>{[0,1,2].map(d=><div key={d} style={{width:7,height:7,borderRadius:"50%",background:"#22c55e",animation:"bounce 1.2s infinite",animationDelay:`${d*0.2}s`}} />)}<span style={{color:"#4a5568",fontSize:11,marginLeft:4}}>Caut + gândesc...</span></div></div>}
        </div>
        {msgs.length<=1 && <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:12}}>{SUGGESTIONS.map((s,i)=><button key={i} onClick={()=>send(s)} style={{background:"#1a1f2e",border:"1px solid #2a3a2a",borderRadius:20,color:"#86efac",fontSize:12,padding:"5px 10px",cursor:"pointer"}}>{s}</button>)}</div>}
      </div>

      {(imgPrev||docName) && <div style={{padding:"0 20px 6px"}}><div style={{display:"inline-flex",alignItems:"center",gap:8,background:"#1a1f2e",border:"1px solid #2a3040",borderRadius:10,padding:"5px 10px"}}>{imgPrev&&<img src={imgPrev} alt="" style={{height:44,borderRadius:6}} />}{docName&&<span style={{color:"#86efac",fontSize:12}}>📄 {docName}</span>}<button onClick={clearAttach} style={{width:18,height:18,borderRadius:"50%",background:"#ef4444",border:"none",color:"white",fontSize:10,cursor:"pointer"}}>✕</button></div></div>}

      <div style={{padding:"6px 20px 14px"}}>
        <div style={{display:"flex",gap:6,background:"#1a1f2e",border:"1px solid #2a3040",borderRadius:16,padding:"6px 6px 6px 12px",alignItems:"flex-end"}}>
          <button onClick={()=>imgRef.current?.click()} style={{width:32,height:32,borderRadius:8,background:"#2a3040",border:"none",cursor:"pointer",fontSize:14,flexShrink:0}}>📷</button>
          <input ref={imgRef} type="file" accept="image/*" onChange={handleImg} style={{display:"none"}} />
          <button onClick={()=>docRef.current?.click()} style={{width:32,height:32,borderRadius:8,background:"#2a3040",border:"none",cursor:"pointer",fontSize:14,flexShrink:0}}>📄</button>
          <input ref={docRef} type="file" accept=".pdf,.txt,.doc,.docx" onChange={handleDoc} style={{display:"none"}} />
          <textarea onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();const v=e.target.value.trim();if(v){e.target.value="";send(v);}}}} placeholder="Întreabă orice — știu tot despre tine..." rows={1} style={{flex:1,background:"transparent",border:"none",outline:"none",color:"#e2e8f0",fontSize:14,resize:"none",fontFamily:"inherit",paddingTop:4}} />
          <button onClick={()=>{const ta=document.querySelector("textarea[placeholder='Întreabă orice — știu tot despre tine...']");const v=ta?.value?.trim();if(v){ta.value="";send(v);}}} style={{width:32,height:32,borderRadius:8,background:"linear-gradient(135deg,#16a34a,#22c55e)",border:"none",color:"white",fontSize:18,cursor:"pointer",flexShrink:0}}>↑</button>
        </div>
      </div>
    </div>
  );
}

// ── FAVORITE TAB ──────────────────────────────────────────────────────────────
function FavoriteTab() {
  const [favs, setFavs] = useState([]);
  const [userId, setUserId] = useState(null);
  const [exp, setExp] = useState(null);
  useEffect(()=>{ const uid=getUserId(); setUserId(uid); getFavorite(uid).then(d=>setFavs(d||[])); },[]);
  async function del(id) { await deleteFavorit(userId,id); setFavs(p=>p.filter(f=>f.id!==id)); }
  return (
    <div style={{padding:"0 20px",overflowY:"auto",flex:1}}>
      {!favs.length ? <div style={{textAlign:"center",color:"#4a5568",padding:"60px 20px"}}><div style={{fontSize:40,marginBottom:12}}>❤️</div><div>Nicio rețetă salvată.</div><div style={{fontSize:12,marginTop:8}}>Apasă "❤️ Salvează" sub orice răspuns din Chat.</div></div> : (
        <div style={{display:"flex",flexDirection:"column",gap:12,paddingBottom:20}}>
          {favs.map(f=>(
            <div key={f.id} style={{background:"#1a1f2e",border:"1px solid #2a3040",borderRadius:14,padding:"14px 16px"}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{color:"#22c55e",fontSize:13,fontWeight:600}}>{f.title}</span><button onClick={()=>del(f.id)} style={{background:"transparent",border:"none",color:"#ef4444",cursor:"pointer"}}>🗑️</button></div>
              <div style={{color:"#4a5568",fontSize:11,marginBottom:8}}>{new Date(f.created_at).toLocaleDateString("ro-RO")}</div>
              <div style={{color:"#e2e8f0",fontSize:13,lineHeight:1.6,maxHeight:exp===f.id?"none":120,overflow:"hidden"}}><Txt text={f.content} /></div>
              {f.content?.length>300 && <button onClick={()=>setExp(exp===f.id?null:f.id)} style={{background:"transparent",border:"none",color:"#22c55e",fontSize:12,cursor:"pointer",marginTop:4}}>{exp===f.id?"▲ Mai puțin":"▼ Vezi tot"}</button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── JURNAL TAB ────────────────────────────────────────────────────────────────
const MESE = { mic_dejun:{label:"🌅 Mic dejun",color:"#f59e0b"}, pranz:{label:"☀️ Prânz",color:"#22c55e"}, cina:{label:"🌙 Cină",color:"#8b5cf6"}, gustare:{label:"🍎 Gustare",color:"#3b82f6"}, apa:{label:"💧 Apă",color:"#06b6d4"} };

function JurnalMasa({ userId, data, tip, profil, ctx }) {
  const cfg = MESE[tip];
  const [entry, setEntry] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(()=>{
    if(!userId||!data) return;
    getJurnalZi(userId,data).then(rows=>{
      const found = rows.find(r=>r.tip_masa===tip);
      setEntry(found || {tip_masa:tip,messages:[],calorii:0,proteine:0,carbohidrati:0,zaharuri:0,grasimi:0,sare:0,apa_ml:0});
    });
  },[userId,data,tip]);

  async function save(updEntry) {
    if(!userId) return;
    setSaving(true);
    await upsertJurnal(userId,{data,...updEntry});
    setSaving(false);
  }

  async function send(txt) {
    if(!txt||!userId) return;
    const msgs = entry?.messages||[];

    if(tip==="apa") {
      // Convert litri to ml
      let ml = 0;
      const litrMatch = txt.match(/([\d.]+)\s*l(itri?)?/i);
      const mlMatch = txt.match(/([\d.]+)\s*ml/i);
      const paharMatch = txt.match(/(\d+)\s*pahar/i);
      if (litrMatch) ml = Math.round(parseFloat(litrMatch[1]) * 1000);
      else if (mlMatch) ml = parseInt(mlMatch[1]);
      else if (paharMatch) ml = parseInt(paharMatch[1]) * 250;
      else ml = parseInt(txt.replace(/[^0-9]/g,"")) || 0;

      const newApa = (entry?.apa_ml||0) + ml;
      const reply = `💧 Adăugat **${ml} ml**.\n**Total azi: ${newApa} ml** ${newApa>=2000?"✅ Hidratare optimă!":`— mai ai nevoie de ${2000-newApa} ml pentru minimul recomandat.`}`;
      const newMsgs = [...msgs,{role:"user",content:txt},{role:"assistant",content:reply}];
      const upd = {...entry,messages:newMsgs,apa_ml:newApa,item:"apa"};
      setEntry(upd);
      await save(upd);
      return;
    }

    setLoading(true);
    const newMsgsTemp = [...msgs,{role:"user",content:txt}];
    setEntry(prev=>({...prev,messages:newMsgsTemp}));

    try {
      const apiMsgs = newMsgsTemp.map(m=>({role:m.role,content:m.content}));
      const reply = await callAPI(apiMsgs, profil, "jurnal", ctx);

      // More robust extraction - try multiple patterns
      const getN = (text, pats) => {
        for (const pat of pats) {
          const m = text.match(pat);
          if (m) return parseFloat(m[1]);
        }
        return 0;
      };

      const cal = getN(reply, [/\*\*Calorii[^:*]*:\s*~?([\d.]+)/i, /Calorii[^:]*:\s*~?([\d.]+)/i, /TOTAL[^]*?~?([\d.]+)\s*kcal/i]);
      const prot = getN(reply, [/\*\*Proteine[^:*]*:\s*~?([\d.]+)/i, /Proteine[^:]*:\s*~?([\d.]+)/i]);
      const carb = getN(reply, [/\*\*Carbohidra[^:*]*:\s*~?([\d.]+)/i, /Carbohidra[^:]*:\s*~?([\d.]+)/i]);
      const zah = getN(reply, [/\*\*Zah[^:*]*:\s*~?([\d.]+)/i, /Zah[^:]*:\s*~?([\d.]+)/i]);
      const gras = getN(reply, [/\*\*Gr[aă]simi[^:*]*:\s*~?([\d.]+)/i, /Gr[aă]simi[^:]*:\s*~?([\d.]+)/i]);
      const sare = getN(reply, [/\*\*Sare[^:*]*:\s*~?([\d.]+)/i, /Sare[^:]*:\s*~?([\d.]+)/i]);

      const newMsgs = [...newMsgsTemp,{role:"assistant",content:reply}];
      const upd = {
        ...entry, messages:newMsgs, item:txt.slice(0,100),
        calorii: cal > 0 ? cal : (entry?.calorii||0),
        proteine: prot > 0 ? prot : (entry?.proteine||0),
        carbohidrati: carb > 0 ? carb : (entry?.carbohidrati||0),
        zaharuri: zah > 0 ? zah : (entry?.zaharuri||0),
        grasimi: gras > 0 ? gras : (entry?.grasimi||0),
        sare: sare > 0 ? sare : (entry?.sare||0),
        analiza:reply,
      };
      setEntry(upd);
      await save(upd);
    } catch(e) {
      const newMsgs=[...newMsgsTemp,{role:"assistant",content:"Eroare. Încearcă din nou."}];
      setEntry(prev=>({...prev,messages:newMsgs}));
    } finally { setLoading(false); }
  }

  async function manualSave() {
    if(entry) await save(entry);
    alert("✅ Salvat!");
  }

  if(!entry) return <div style={{textAlign:"center",color:"#4a5568",padding:"20px"}}>Se încarcă...</div>;

  const msgs = entry.messages||[];

  return (
    <div style={{background:"#1a1f2e",border:`1px solid ${cfg.color}44`,borderRadius:14,padding:"14px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <span style={{color:cfg.color,fontWeight:700,fontSize:14}}>{cfg.label}</span>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          {saving && <span style={{color:"#4a5568",fontSize:11}}>Salvez...</span>}
          {tip==="apa" && entry.apa_ml>0 && <span style={{color:"#06b6d4",fontSize:13,fontWeight:700}}>💧 {entry.apa_ml}ml</span>}
          {tip!=="apa" && entry.calorii>0 && <span style={{color:cfg.color,fontSize:12,fontWeight:600}}>{Math.round(entry.calorii)} kcal</span>}
          <button onClick={manualSave} style={{background:cfg.color+"22",border:`1px solid ${cfg.color}`,borderRadius:8,color:cfg.color,padding:"3px 10px",fontSize:11,cursor:"pointer"}}>💾 Save</button>
        </div>
      </div>

      {/* Macro mini bar */}
      {tip!=="apa" && entry.calorii>0 && (
        <div style={{display:"flex",gap:5,marginBottom:10,flexWrap:"wrap"}}>
          {[["P",entry.proteine,"#3b82f6"],["C",entry.carbohidrati,"#f59e0b"],["Z",entry.zaharuri,"#ec4899"],["G",entry.grasimi,"#8b5cf6"],["🧂",entry.sare,"#94a3b8"]].map(([l,v,c])=>(
            <span key={l} style={{background:"#0f1117",borderRadius:6,padding:"2px 8px",fontSize:11,color:c}}>{l}: {Math.round((v||0)*10)/10}g</span>
          ))}
        </div>
      )}

      {/* Chat */}
      <div style={{maxHeight:350,overflowY:"auto",marginBottom:10}}>
        <ChatBubbles messages={msgs} loading={loading} />
      </div>

      <ChatInput
        onSend={send}
        loading={loading}
        placeholder={tip==="apa" ? "ex: 250 ml, 1 pahar, 500 ml apă plată..." : `Descrie ce ai mâncat la ${cfg.label.toLowerCase()}...`}
        extraButtons={tip==="apa" ? [150,250,330,500].map(ml=>(
          <button key={ml} onClick={()=>send(`${ml} ml`)} style={{flex:1,padding:"5px",background:"#0f1117",border:"1px solid #06b6d4",borderRadius:8,color:"#06b6d4",fontSize:12,cursor:"pointer"}}>{ml}ml</button>
        )) : null}
      />
    </div>
  );
}

function JurnalTab({ profil, ctx }) {
  const azi = new Date().toISOString().split("T")[0];
  const [data, setData] = useState(azi);
  const [userId, setUserId] = useState(null);
  const [activeMasa, setActiveMasa] = useState("mic_dejun");
  const [sumar, setSumar] = useState(null);

  const [refreshSumar, setRefreshSumar] = useState(0);

  useEffect(()=>{ const uid=getUserId(); setUserId(uid); },[]);

  useEffect(()=>{
    if(!userId) return;
    getJurnalZi(userId,data).then(rows=>{
      if(!rows.length){setSumar(null);return;}
      const tot = rows.reduce((acc,r)=>({
        calorii:acc.calorii+(parseFloat(r.calorii)||0),
        proteine:acc.proteine+(parseFloat(r.proteine)||0),
        carbohidrati:acc.carbohidrati+(parseFloat(r.carbohidrati)||0),
        zaharuri:acc.zaharuri+(parseFloat(r.zaharuri)||0),
        grasimi:acc.grasimi+(parseFloat(r.grasimi)||0),
        sare:acc.sare+(parseFloat(r.sare)||0),
        apa:acc.apa+(parseFloat(r.apa_ml)||0),
      }),{calorii:0,proteine:0,carbohidrati:0,zaharuri:0,grasimi:0,sare:0,apa:0});
      setSumar(tot);
    });
  },[userId,data,activeMasa,refreshSumar]);

  const target = parseInt(profil?.calorii)||1600;
  const pct = sumar?Math.min(100,Math.round((sumar.calorii/target)*100)):0;
  const apaRec = Math.round(((parseFloat(profil?.greutate)||80)*35)+(Math.max(0,(sumar?.sare||0)-2)*200));

  return (
    <div style={{padding:"0 20px",overflowY:"auto",flex:1}}>
      <input type="date" value={data} onChange={e=>setData(e.target.value)} style={{width:"100%",background:"#1a1f2e",border:"1px solid #2a3040",borderRadius:10,color:"#e2e8f0",padding:"8px 12px",fontSize:14,outline:"none",marginBottom:12}} />

      {sumar && (
        <div style={{background:"#1a2a1a",border:"1px solid #2a4a2a",borderRadius:14,padding:"12px",marginBottom:12}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
            <span style={{color:"#22c55e",fontSize:13,fontWeight:700}}>📊 Sumar {new Date(data+"T12:00:00").toLocaleDateString("ro-RO")}</span>
            <span style={{color:pct>100?"#ef4444":"#22c55e",fontSize:13,fontWeight:700}}>{Math.round(sumar.calorii)}/{target} kcal</span>
          </div>
          <div style={{background:"#2a3040",borderRadius:4,height:6,marginBottom:8}}><div style={{background:pct>100?"#ef4444":"linear-gradient(90deg,#22c55e,#4ade80)",height:"100%",width:`${pct}%`,borderRadius:4}} /></div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {[["P",sumar.proteine,"g","#3b82f6"],["C",sumar.carbohidrati,"g","#f59e0b"],["Z",sumar.zaharuri,"g","#ec4899"],["G",sumar.grasimi,"g","#8b5cf6"],["🧂",sumar.sare,"g","#94a3b8"],["💧",sumar.apa,"ml","#06b6d4"]].map(([l,v,u,c])=>(
              <span key={l} style={{background:"#0f1117",borderRadius:6,padding:"2px 8px",fontSize:11,color:c}}>{l}: {Math.round(v)}{u}</span>
            ))}
          </div>
          <div style={{color:"#06b6d4",fontSize:11,marginTop:6}}>💧 Apă recomandată: {apaRec}ml {sumar.apa>=apaRec?"✅":`(mai bei ${apaRec-Math.round(sumar.apa)}ml)`}</div>
        </div>
      )}

      <div style={{display:"flex",gap:5,marginBottom:12,overflowX:"auto"}}>
        {Object.entries(MESE).map(([k,v])=>(
          <button key={k} onClick={()=>setActiveMasa(k)} style={{flexShrink:0,padding:"6px 12px",background:activeMasa===k?v.color+"22":"#1a1f2e",border:`1px solid ${activeMasa===k?v.color:"#2a3040"}`,borderRadius:20,color:activeMasa===k?v.color:"#94a3b8",fontSize:12,fontWeight:activeMasa===k?700:400,cursor:"pointer",whiteSpace:"nowrap"}}>{v.label}</button>
        ))}
      </div>

      {userId && <JurnalMasa key={`${userId}-${data}-${activeMasa}`} userId={userId} data={data} tip={activeMasa} profil={profil} ctx={ctx} />}
    </div>
  );
}

// ── SAPTAMANA TAB ─────────────────────────────────────────────────────────────
function SaptamanaTab({ profil, ctx }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(()=>{
    const uid = getUserId(); setUserId(uid);
    getSaptamanaChat(uid).then(d=>{ if(d?.messages?.length) setMessages(d.messages); });
  },[]);

  async function saveMessages(msgs) {
    if(!userId) return;
    setSaving(true);
    await upsertSaptamanaChat(userId, msgs);
    setSaving(false);
  }

  async function genereaza() {
    setLoading(true);
    const userMsg = {role:"user",content:`Generează plan alimentar COMPLET pentru 7 zile. Pentru fiecare masă: ingrediente cu gramaje exacte, pași detaliați pentru un începător absolut, timpi de gătire, tabel nutrițional (kcal|Proteine|Carbohidrați|Zahăr|Grăsimi|Sare). Dacă nu poți toate 7 zile dintr-o dată, generează 3-4 zile COMPLETE și spune-mi să cer continuarea. Respectă: ${profil?.calorii||1600} kcal/zi, ${profil?.restrictii||"fără gluten, low-carb"}.`};
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    try {
      const reply = await callAPI(newMsgs.map(m=>({role:m.role,content:m.content})), profil, "plan", ctx);
      const finalMsgs = [...newMsgs, {role:"assistant",content:reply}];
      setMessages(finalMsgs);
      await saveMessages(finalMsgs);
    } catch { setMessages(prev=>[...prev,{role:"assistant",content:"Eroare. Încearcă din nou."}]); }
    finally { setLoading(false); }
  }

  async function send(txt) {
    setLoading(true);
    const userMsg = {role:"user",content:txt};
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    try {
      const reply = await callAPI(newMsgs.map(m=>({role:m.role,content:m.content})), profil, "plan", ctx);
      const finalMsgs = [...newMsgs, {role:"assistant",content:reply}];
      setMessages(finalMsgs);
      await saveMessages(finalMsgs);
    } catch { setMessages(prev=>[...prev,{role:"assistant",content:"Eroare. Încearcă din nou."}]); }
    finally { setLoading(false); }
  }

  return (
    <div style={{padding:"0 20px",overflowY:"auto",flex:1,display:"flex",flexDirection:"column",gap:12}}>
      <div style={{display:"flex",gap:8}}>
        <button onClick={genereaza} disabled={loading} style={{flex:1,padding:"12px",background:loading?"#2a3040":"linear-gradient(135deg,#16a34a,#22c55e)",border:"none",borderRadius:12,color:"white",fontSize:14,fontWeight:700,cursor:loading?"default":"pointer"}}>
          {loading?"⏳ Generez...":"🔄 Generează plan săptămânal"}
        </button>
        {saving && <span style={{color:"#4a5568",fontSize:11,alignSelf:"center"}}>Salvez...</span>}
      </div>

      {messages.length>0 ? (
        <div style={{flex:1}}>
          <ChatBubbles messages={messages} loading={loading} />
          <div style={{marginTop:12}}>
            <ChatInput onSend={send} loading={loading} placeholder="Cere continuarea sau pune o întrebare despre plan..." />
          </div>
        </div>
      ) : (
        <div style={{textAlign:"center",color:"#4a5568",padding:"40px 0"}}><div style={{fontSize:40,marginBottom:12}}>📅</div><div>Apasă butonul pentru plan cu rețete complete.</div></div>
      )}
    </div>
  );
}

// ── PROGRES TAB ───────────────────────────────────────────────────────────────
function ProgresTab({ profil, ctx }) {
  const [intrari, setIntrari] = useState([]);
  const [gr, setGr] = useState(""); const [abd, setAbd] = useState("");
  const [data, setData] = useState(new Date().toISOString().split("T")[0]);
  const [userId, setUserId] = useState(null);
  const [analiza, setAnaliza] = useState(null);
  const [loadingA, setLoadingA] = useState(false);

  useEffect(()=>{ const uid=getUserId(); setUserId(uid); getProgres(uid).then(d=>setIntrari(d||[])); },[]);

  async function add() {
    if(!gr&&!abd) return;
    await upsertProgres(userId,{data,greutate:gr?parseFloat(gr):null,abdomen:abd?parseFloat(abd):null});
    getProgres(userId).then(d=>setIntrari(d||[]));
    setGr(""); setAbd("");
  }
  async function del(id) { await deleteProgres(userId,id); setIntrari(p=>p.filter(i=>i.id!==id)); }
  async function analizeaza() {
    setLoadingA(true);
    try { const r=await callAPI([{role:"user",content:"Analizează progresul meu complet. Ce merge bine? Ce trebuie îmbunătățit? Cum elimin apa reținută? Cât mai am până la obiectiv?"}],profil,undefined,ctx); setAnaliza(r); }
    catch{} finally{setLoadingA(false);}
  }

  const ul=intrari[intrari.length-1], pr=intrari[0];
  const dKg=ul?.greutate&&pr?.greutate&&intrari.length>1?(ul.greutate-pr.greutate).toFixed(1):null;
  const dCm=ul?.abdomen&&pr?.abdomen&&intrari.length>1?(ul.abdomen-pr.abdomen).toFixed(1):null;
  const imc=ul?.greutate&&profil?.inaltime?(ul.greutate/Math.pow(profil.inaltime/100,2)).toFixed(1):null;

  function Chart({field,color,label}) {
    const vals=intrari.filter(i=>i[field]!=null).map(i=>parseFloat(i[field]));
    if(vals.length<2) return null;
    const w=300,h=80,p=14,mn=Math.min(...vals)-0.5,mx=Math.max(...vals)+0.5;
    const pts=vals.map((v,i)=>{const x=p+(i/(vals.length-1))*(w-2*p);const y=p+((mx-v)/(mx-mn))*(h-2*p);return `${x},${y}`;}).join(" ");
    return <div style={{background:"#1a1f2e",border:"1px solid #2a3040",borderRadius:12,padding:"10px",marginBottom:10}}>
      <div style={{color,fontSize:12,marginBottom:4}}>{label}: {vals[0]} → {vals[vals.length-1]}</div>
      <svg width="100%" viewBox={`0 0 ${w} ${h}`}><polyline fill="none" stroke={color} strokeWidth="2.5" points={pts} />{vals.map((v,i)=>{const x=p+(i/(vals.length-1))*(w-2*p);const y=p+((mx-v)/(mx-mn))*(h-2*p);return <circle key={i} cx={x} cy={y} r="4" fill={color} />;})}</svg>
    </div>;
  }

  return (
    <div style={{padding:"0 20px",overflowY:"auto",flex:1}}>
      <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
        {ul?.greutate&&<div style={{flex:1,minWidth:70,background:"#1a1f2e",border:"1px solid #2a3040",borderRadius:12,padding:"10px",textAlign:"center"}}><div style={{color:"#22c55e",fontSize:18,fontWeight:700}}>{ul.greutate}</div><div style={{color:"#4a5568",fontSize:10}}>kg actual</div></div>}
        {dKg!==null&&<div style={{flex:1,minWidth:70,background:"#1a1f2e",border:"1px solid #2a3040",borderRadius:12,padding:"10px",textAlign:"center"}}><div style={{color:parseFloat(dKg)<=0?"#22c55e":"#ef4444",fontSize:18,fontWeight:700}}>{dKg>0?"+":""}{dKg}</div><div style={{color:"#4a5568",fontSize:10}}>kg total</div></div>}
        {ul?.abdomen&&<div style={{flex:1,minWidth:70,background:"#1a1f2e",border:"1px solid #2a3040",borderRadius:12,padding:"10px",textAlign:"center"}}><div style={{color:"#3b82f6",fontSize:18,fontWeight:700}}>{ul.abdomen}</div><div style={{color:"#4a5568",fontSize:10}}>cm abd.</div></div>}
        {dCm!==null&&<div style={{flex:1,minWidth:70,background:"#1a1f2e",border:"1px solid #2a3040",borderRadius:12,padding:"10px",textAlign:"center"}}><div style={{color:parseFloat(dCm)<=0?"#22c55e":"#ef4444",fontSize:18,fontWeight:700}}>{dCm>0?"+":""}{dCm}</div><div style={{color:"#4a5568",fontSize:10}}>cm total</div></div>}
        {imc&&<div style={{flex:1,minWidth:70,background:"#1a1f2e",border:"1px solid #2a3040",borderRadius:12,padding:"10px",textAlign:"center"}}><div style={{color:"#f59e0b",fontSize:18,fontWeight:700}}>{imc}</div><div style={{color:"#4a5568",fontSize:10}}>IMC</div></div>}
      </div>

      {dCm!==null&&<div style={{background:"#1a1f2e",border:"1px solid #2a3040",borderRadius:12,padding:"10px",marginBottom:10}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{color:"#94a3b8",fontSize:12}}>🎯 Obiectiv: -8cm abdomen</span><span style={{color:"#3b82f6",fontSize:12}}>{Math.abs(parseFloat(dCm)).toFixed(1)}/8cm</span></div><div style={{background:"#2a3040",borderRadius:4,height:6}}><div style={{background:"linear-gradient(90deg,#3b82f6,#22c55e)",height:"100%",width:`${Math.min(100,(Math.abs(parseFloat(dCm))/8)*100)}%`,borderRadius:4}} /></div></div>}

      <Chart field="greutate" color="#22c55e" label="⚖️ Greutate (kg)" />
      <Chart field="abdomen" color="#3b82f6" label="📏 Abdomen (cm)" />

      <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
        <input type="date" value={data} onChange={e=>setData(e.target.value)} style={{flex:2,minWidth:120,background:"#1a1f2e",border:"1px solid #2a3040",borderRadius:10,color:"#e2e8f0",padding:"8px 12px",fontSize:14,outline:"none"}} />
        <input value={gr} onChange={e=>setGr(e.target.value)} placeholder="kg" type="number" step="0.1" style={{width:65,background:"#1a1f2e",border:"1px solid #2a3040",borderRadius:10,color:"#e2e8f0",padding:"8px 10px",fontSize:14,outline:"none"}} />
        <input value={abd} onChange={e=>setAbd(e.target.value)} placeholder="cm" type="number" step="0.5" style={{width:65,background:"#1a1f2e",border:"1px solid #2a3040",borderRadius:10,color:"#e2e8f0",padding:"8px 10px",fontSize:14,outline:"none"}} />
        <button onClick={add} style={{background:"linear-gradient(135deg,#16a34a,#22c55e)",border:"none",borderRadius:10,color:"white",padding:"8px 14px",cursor:"pointer",fontSize:16}}>+</button>
      </div>

      <button onClick={analizeaza} disabled={loadingA} style={{width:"100%",padding:"10px",background:"#1a2030",border:"1px solid #3b82f6",borderRadius:10,color:"#3b82f6",fontSize:13,fontWeight:600,cursor:"pointer",marginBottom:12}}>
        {loadingA?"⏳ Analizez...":"🤖 Analizează progresul meu cu AI"}
      </button>
      {analiza&&<div style={{background:"#1a2030",border:"1px solid #3b82f6",borderRadius:14,padding:"14px",marginBottom:12,color:"#e2e8f0",fontSize:14,lineHeight:1.7}}><Txt text={analiza} /></div>}

      <div style={{display:"flex",flexDirection:"column",gap:8,paddingBottom:20}}>
        {[...intrari].reverse().map(i=>(
          <div key={i.id} style={{background:"#1a1f2e",border:"1px solid #2a3040",borderRadius:12,padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{color:"#94a3b8",fontSize:13}}>{new Date(i.data+"T12:00:00").toLocaleDateString("ro-RO")}</span>
            <div style={{display:"flex",gap:10,alignItems:"center"}}>
              {i.greutate&&<span style={{color:"#22c55e",fontWeight:700}}>{i.greutate} kg</span>}
              {i.abdomen&&<span style={{color:"#3b82f6",fontWeight:700}}>{i.abdomen} cm</span>}
              <button onClick={()=>del(i.id)} style={{background:"transparent",border:"none",color:"#ef4444",cursor:"pointer"}}>✕</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── SPORT TAB ─────────────────────────────────────────────────────────────────
function SportTab({ profil, ctx }) {
  const azi = new Date().toISOString().split("T")[0];
  const [data, setData] = useState(azi);
  const [userId, setUserId] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState("chat");
  const [plan, setPlan] = useState(()=>loadLS("plan_sport",null));
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [istoric, setIstoric] = useState([]);

  useEffect(()=>{ const uid=getUserId(); setUserId(uid); getSportIstoric(uid).then(d=>setIstoric(d||[])); },[]);

  useEffect(()=>{
    if(!userId) return;
    getSportZi(userId,data).then(d=>{ setMsgs(d?.messages||[]); });
  },[userId,data]);

  async function savemsgs(newMsgs) {
    if(!userId) return;
    setSaving(true);
    await upsertSportZi(userId,data,newMsgs);
    setSaving(false);
    getSportIstoric(userId).then(d=>setIstoric(d||[]));
  }

  async function send(txt) {
    setLoading(true);
    const isFirst = msgs.length===0;
    const userMsg={role:"user",content:txt};
    const newMsgsTemp=[...msgs,userMsg];
    setMsgs(newMsgsTemp);
    try {
      const reply=await callAPI(newMsgsTemp.map(m=>({role:m.role,content:m.content})),profil,isFirst?"idei":undefined,ctx);
      const finalMsgs=[...newMsgsTemp,{role:"assistant",content:reply}];
      setMsgs(finalMsgs);
      await savemsgs(finalMsgs);
    } catch {
      setMsgs(prev=>[...prev,{role:"assistant",content:"Eroare."}]);
    } finally{setLoading(false);}
  }

  async function ideiAzi() { await send("Dă-mi 5 idei personalizate pentru ziua de azi: mișcare, nutriție, hidratare, wellbeing și un sfat zilnic."); }

  async function genPlan() {
    setLoadingPlan(true);
    try {
      const r=await callAPI([{role:"user",content:"Creează plan sport COMPLET 3 luni, progresiv și sigur pentru 44 ani cu genunchi sensibili și spate neantrenat. Include tai-chi, stretching, yoga blând, mers progresiv. Explică EXACT fiecare exercițiu."}],profil,"sport",ctx);
      setPlan(r); saveLS("plan_sport",r);
    } catch{} finally{setLoadingPlan(false);}
  }

  return (
    <div style={{padding:"0 20px",overflowY:"auto",flex:1}}>
      <div style={{display:"flex",gap:6,marginBottom:12}}>
        {[["chat","💬 Chat zilnic"],["plan","📋 Plan 3 luni"],["calendar","📅 Calendar"]].map(([v,l])=>(
          <button key={v} onClick={()=>setView(v)} style={{flex:1,padding:"8px",background:view===v?"linear-gradient(135deg,#16a34a,#22c55e)":"#1a1f2e",border:`1px solid ${view===v?"transparent":"#2a3040"}`,borderRadius:10,color:view===v?"white":"#94a3b8",fontSize:12,fontWeight:view===v?700:400,cursor:"pointer"}}>{l}</button>
        ))}
      </div>

      {view==="chat" && (
        <div>
          <div style={{display:"flex",gap:8,marginBottom:12}}>
            <input type="date" value={data} onChange={e=>setData(e.target.value)} style={{flex:1,background:"#1a1f2e",border:"1px solid #2a3040",borderRadius:10,color:"#e2e8f0",padding:"8px 12px",fontSize:14,outline:"none"}} />
            <button onClick={ideiAzi} disabled={loading} style={{padding:"8px 14px",background:"linear-gradient(135deg,#f59e0b,#d97706)",border:"none",borderRadius:10,color:"white",fontSize:13,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}>💡 Idei azi</button>
            {saving&&<span style={{color:"#4a5568",fontSize:11,alignSelf:"center"}}>Salvez...</span>}
          </div>
          <div style={{background:"#1a1f2e",border:"1px solid #2a3040",borderRadius:14,padding:"14px"}}>
            {msgs.length===0&&<div style={{textAlign:"center",color:"#4a5568",padding:"20px 0",marginBottom:10}}><div style={{fontSize:32,marginBottom:8}}>🏃</div><div>Apasă "💡 Idei azi" sau pune o întrebare.</div></div>}
            <div style={{maxHeight:400,overflowY:"auto",marginBottom:10}}><ChatBubbles messages={msgs} loading={loading} /></div>
            <ChatInput onSend={send} loading={loading} placeholder="ex: Am mers 5km azi. Câte calorii am ars?" />
          </div>
        </div>
      )}

      {view==="plan" && (
        <div>
          <button onClick={genPlan} disabled={loadingPlan} style={{width:"100%",padding:"14px",background:loadingPlan?"#2a3040":"linear-gradient(135deg,#16a34a,#22c55e)",border:"none",borderRadius:12,color:"white",fontSize:15,fontWeight:700,cursor:loadingPlan?"default":"pointer",marginBottom:16}}>
            {loadingPlan?"⏳ Generez plan (30-60 sec)...":"🏃 Generează plan sport 3 luni adaptat mie"}
          </button>
          {plan?<div style={{background:"#1a1f2e",border:"1px solid #2a3040",borderRadius:14,padding:"16px",color:"#e2e8f0",fontSize:14,lineHeight:1.8,paddingBottom:20}}><Txt text={plan} /></div>:<div style={{textAlign:"center",color:"#4a5568",padding:"40px 0"}}><div style={{fontSize:40,marginBottom:12}}>🏃</div><div>Plan adaptat pentru genunchii și spatele tău.</div></div>}
        </div>
      )}

      {view==="calendar" && (
        <div>
          <div style={{color:"#94a3b8",fontSize:13,fontWeight:600,marginBottom:10}}>📅 Zile cu activitate înregistrată:</div>
          {!istoric.length?<div style={{textAlign:"center",color:"#4a5568",padding:"40px 0"}}>Nicio zi înregistrată încă.</div>:(
            <div style={{display:"flex",flexDirection:"column",gap:8,paddingBottom:20}}>
              {istoric.map(zi=>(
                <div key={zi.id} onClick={()=>{setData(zi.data);setView("chat");}} style={{background:"#1a1f2e",border:"1px solid #2a3040",borderRadius:12,padding:"12px 16px",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <div style={{color:"#22c55e",fontSize:14,fontWeight:600}}>{new Date(zi.data+"T12:00:00").toLocaleDateString("ro-RO",{weekday:"long",day:"numeric",month:"long"})}</div>
                    <div style={{color:"#4a5568",fontSize:11,marginTop:2}}>{zi.messages?.length||0} mesaje · Click pentru a vedea</div>
                  </div>
                  <span style={{color:"#22c55e",fontSize:18}}>→</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── REMINDER TAB ──────────────────────────────────────────────────────────────
function ReminderTab() {
  const DEF=[{id:1,label:"🌅 Mic dejun",ora:"08:00",activ:true},{id:2,label:"☀️ Prânz",ora:"13:00",activ:true},{id:3,label:"🌙 Cină",ora:"19:00",activ:true},{id:4,label:"💧 Apă",ora:"09:00",activ:true},{id:5,label:"💧 Apă",ora:"13:30",activ:true},{id:6,label:"💧 Apă",ora:"18:00",activ:true},{id:7,label:"🏃 Mișcare",ora:"17:30",activ:false},{id:8,label:"🍎 Gustare",ora:"10:30",activ:false}];
  const [rem,setRem]=useState(()=>loadLS("remindere",DEF));
  const [perm,setPerm]=useState(null);
  const [nou,setNou]=useState({label:"",ora:"12:00"});
  useEffect(()=>{if("Notification"in window)setPerm(Notification.permission);},[]);
  async function cerePerm(){const r=await Notification.requestPermission();setPerm(r);}
  function tog(id){const u=rem.map(r=>r.id===id?{...r,activ:!r.activ}:r);setRem(u);saveLS("remindere",u);}
  function updOra(id,ora){const u=rem.map(r=>r.id===id?{...r,ora}:r);setRem(u);saveLS("remindere",u);}
  function add(){if(!nou.label.trim())return;const u=[...rem,{id:Date.now(),label:nou.label.trim(),ora:nou.ora,activ:true}];setRem(u);saveLS("remindere",u);setNou({label:"",ora:"12:00"});}
  function del(id){const u=rem.filter(r=>r.id!==id);setRem(u);saveLS("remindere",u);}
  return (
    <div style={{padding:"0 20px",overflowY:"auto",flex:1}}>
      <div style={{background:"#1a1f2e",border:`1px solid ${perm==="granted"?"#2a4a2a":"#4a3020"}`,borderRadius:14,padding:"14px",marginBottom:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div><div style={{color:"#e2e8f0",fontSize:14,fontWeight:600}}>Notificări browser</div><div style={{color:"#4a5568",fontSize:12}}>{perm==="granted"?"✅ Active":"⚠️ Neactivate"}</div></div>
          {perm!=="granted"&&<button onClick={cerePerm} style={{background:"linear-gradient(135deg,#16a34a,#22c55e)",border:"none",borderRadius:10,color:"white",padding:"8px 14px",cursor:"pointer",fontSize:13}}>Activează</button>}
          {perm==="granted"&&<button onClick={()=>new Notification("Agent Nutriție 🥦",{body:"Funcționează!"})} style={{background:"#1a2a1a",border:"1px solid #2a4a2a",borderRadius:10,color:"#22c55e",padding:"8px 14px",cursor:"pointer",fontSize:13}}>Testează</button>}
        </div>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:14}}>
        {rem.map(r=>(
          <div key={r.id} style={{background:"#1a1f2e",border:`1px solid ${r.activ?"#2a4a2a":"#2a3040"}`,borderRadius:12,padding:"10px 14px",display:"flex",alignItems:"center",gap:10}}>
            <button onClick={()=>tog(r.id)} style={{width:38,height:22,borderRadius:11,background:r.activ?"#22c55e":"#2a3040",border:"none",cursor:"pointer",position:"relative",flexShrink:0}}><div style={{width:18,height:18,borderRadius:"50%",background:"white",position:"absolute",top:2,left:r.activ?18:2,transition:"left 0.2s"}} /></button>
            <span style={{flex:1,color:r.activ?"#e2e8f0":"#4a5568",fontSize:13}}>{r.label}</span>
            <input type="time" value={r.ora} onChange={e=>updOra(r.id,e.target.value)} style={{background:"#0f1117",border:"1px solid #2a3040",borderRadius:8,color:"#e2e8f0",padding:"4px 8px",fontSize:12,outline:"none"}} />
            <button onClick={()=>del(r.id)} style={{background:"transparent",border:"none",color:"#ef4444",cursor:"pointer"}}>✕</button>
          </div>
        ))}
      </div>
      <div style={{display:"flex",gap:8,paddingBottom:20}}>
        <input value={nou.label} onChange={e=>setNou(p=>({...p,label:e.target.value}))} placeholder="Nume reminder..." style={{flex:1,background:"#1a1f2e",border:"1px solid #2a3040",borderRadius:10,color:"#e2e8f0",padding:"8px 12px",fontSize:13,outline:"none"}} onKeyDown={e=>e.key==="Enter"&&add()} />
        <input type="time" value={nou.ora} onChange={e=>setNou(p=>({...p,ora:e.target.value}))} style={{background:"#1a1f2e",border:"1px solid #2a3040",borderRadius:10,color:"#e2e8f0",padding:"8px 12px",fontSize:13,outline:"none"}} />
        <button onClick={add} style={{background:"linear-gradient(135deg,#16a34a,#22c55e)",border:"none",borderRadius:10,color:"white",padding:"8px 14px",cursor:"pointer",fontSize:15}}>+</button>
      </div>
    </div>
  );
}

// ── PRODUS TAB ────────────────────────────────────────────────────────────────
function ProdusTab({ profil }) {
  const [img,setImg]=useState(null);const [prev,setPrev]=useState(null);const [rez,setRez]=useState(null);const [loading,setLoading]=useState(false);
  const [ist,setIst]=useState(()=>loadLS("ist_produse",[]));
  const fRef=useRef(null);const cRef=useRef(null);
  function hFile(e){const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{setImg({data:r.result.split(",")[1],type:f.type});setPrev(r.result);setRez(null);};r.readAsDataURL(f);}
  async function analizeaza(){if(!img)return;setLoading(true);try{const r=await callAPI([{role:"user",content:[{type:"image",source:{type:"base64",media_type:img.type,data:img.data}},{type:"text",text:`Caută ONLINE gramajul și valorile nutriționale exacte ale acestui produs (în special dacă e un produs românesc specific). Spune: 1) Valori per 100g și per porție (kcal, proteine, carbohidrați, zahăr, grăsimi, sare) 2) Ingrediente principale 3) ✅ DA sau ❌ NU pentru dieta mea (${profil?.restrictii||"fără gluten, low-carb"}) 4) Cât pot mânca/zi respectând ${profil?.calorii||1600} kcal.`}]}],profil,undefined,{});setRez(r);const item={id:Date.now(),prev,rez:r,data:new Date().toLocaleDateString("ro-RO")};const u=[item,...ist].slice(0,20);setIst(u);saveLS("ist_produse",u);}catch{setRez("Eroare.");}finally{setLoading(false);}}
  function reset(){setImg(null);setPrev(null);setRez(null);if(fRef.current)fRef.current.value="";if(cRef.current)cRef.current.value="";}
  return (
    <div style={{padding:"0 20px",overflowY:"auto",flex:1}}>
      {!prev?(<div>
        <div style={{display:"flex",gap:10,marginBottom:14}}>
          <button onClick={()=>cRef.current?.click()} style={{flex:1,padding:"14px",background:"linear-gradient(135deg,#16a34a,#22c55e)",border:"none",borderRadius:14,color:"white",fontSize:14,fontWeight:700,cursor:"pointer"}}>📷 Fotografiază</button>
          <button onClick={()=>fRef.current?.click()} style={{flex:1,padding:"14px",background:"#1a1f2e",border:"1px solid #2a3040",borderRadius:14,color:"#94a3b8",fontSize:14,cursor:"pointer"}}>🖼️ Galerie</button>
        </div>
        <input ref={cRef} type="file" accept="image/*" capture="environment" onChange={hFile} style={{display:"none"}} />
        <input ref={fRef} type="file" accept="image/*" onChange={hFile} style={{display:"none"}} />
        <div style={{color:"#4a5568",fontSize:13,textAlign:"center",marginBottom:14}}>Fotografiază eticheta — agentul caută gramajul exact online.</div>
        {!!ist.length&&<div>{<div style={{color:"#94a3b8",fontSize:13,fontWeight:600,marginBottom:8}}>Recent:</div>}{ist.slice(0,5).map(i=><div key={i.id} style={{background:"#1a1f2e",border:"1px solid #2a3040",borderRadius:12,padding:"10px",display:"flex",gap:10,alignItems:"center",marginBottom:8}}><img src={i.prev} alt="" style={{width:44,height:44,borderRadius:8,objectFit:"cover",flexShrink:0}} /><div style={{flex:1,overflow:"hidden"}}><div style={{color:"#e2e8f0",fontSize:12,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{i.rez?.slice(0,60)}...</div><div style={{color:"#4a5568",fontSize:11}}>{i.data}</div></div></div>)}</div>}
      </div>):(<div>
        <img src={prev} alt="" style={{width:"100%",borderRadius:14,maxHeight:220,objectFit:"cover",marginBottom:12}} />
        {!rez?<button onClick={analizeaza} disabled={loading} style={{width:"100%",padding:"14px",background:loading?"#2a3040":"linear-gradient(135deg,#16a34a,#22c55e)",border:"none",borderRadius:12,color:"white",fontSize:15,fontWeight:700,cursor:loading?"default":"pointer",marginBottom:10}}>{loading?"🔍 Caut online...":"🔍 Analizează"}</button>:<div style={{background:"#1a1f2e",border:"1px solid #2a3040",borderRadius:14,padding:"14px",color:"#e2e8f0",fontSize:14,lineHeight:1.7,marginBottom:10}}><Txt text={rez} /></div>}
        <button onClick={reset} style={{width:"100%",padding:"10px",background:"transparent",border:"1px solid #2a3040",borderRadius:12,color:"#94a3b8",fontSize:14,cursor:"pointer"}}>← Înapoi</button>
      </div>)}
    </div>
  );
}

// ── RETETE TAB ────────────────────────────────────────────────────────────────
function ReteteTab({ profil }) {
  const [retete,setRetete]=useState([]);
  const [userId,setUserId]=useState(null);
  const [loading,setLoading]=useState(false);
  const [sel,setSel]=useState(null);
  const [loadingR,setLoadingR]=useState(true);
  const fRef=useRef(null);

  async function reload(uid) {
    setLoadingR(true);
    const d = await getRetete(uid||userId);
    console.log("Retete from DB:", d);
    setRetete(d||[]);
    setLoadingR(false);
  }

  useEffect(()=>{ const uid=getUserId(); setUserId(uid); reload(uid); },[]);

  async function upload(e) {
    const f=e.target.files[0]; if(!f) return;
    setLoading(true);
    const r=new FileReader();
    r.onload=async()=>{
      try {
        const b64=r.result.split(",")[1];
        // Gemini accepta inline_data pentru PDF
        const isPdf = f.type.includes("pdf");
        let content;
        if(isPdf) {
          content = [
            { inline_data: { mime_type: "application/pdf", data: b64 } },
            { text: "Extrage TOATE rețetele din acest document. Pentru fiecare rețetă: **Nume rețetă** bold, ingrediente cu gramaje exacte, pași detaliați de preparare, valori nutriționale dacă există. Separă rețetele clar cu linie orizontală." }
          ];
        } else {
          // Pentru Word/txt - citim ca text
          const text = atob(b64);
          content = `Extrage TOATE rețetele din acest document:\n\n${text.slice(0,30000)}\n\nPentru fiecare rețetă: **Nume** bold, ingrediente cu gramaje, pași detaliați, valori nutriționale. Separă rețetele clar.`;
        }
        const reply = await callAPI([{role:"user",content}], profil, undefined, {});
        const result = await addReteta(userId,{nume:f.name.replace(/\.[^/.]+$/,""),continut:reply,tip:f.type});
        console.log("addReteta result:",result);
        await reload(userId);
        alert("✅ Rețetele salvate în cloud!");
      } catch(e){ console.error(e); alert("Eroare: "+e.message); }
      finally{ setLoading(false); if(fRef.current)fRef.current.value=""; }
    };
    r.readAsDataURL(f);
  }

  async function del(id){ await deleteReteta(userId,id); setRetete(p=>p.filter(r=>r.id!==id)); if(sel?.id===id)setSel(null); }

  if(sel) return (
    <div style={{padding:"0 20px",overflowY:"auto",flex:1}}>
      <button onClick={()=>setSel(null)} style={{background:"#1a1f2e",border:"1px solid #2a3040",borderRadius:10,color:"#94a3b8",padding:"8px 14px",cursor:"pointer",fontSize:13,marginBottom:14}}>← Lista rețete</button>
      <div style={{color:"#22c55e",fontSize:16,fontWeight:700,marginBottom:6}}>📄 {sel.nume}</div>
      <div style={{color:"#4a5568",fontSize:11,marginBottom:12}}>{sel.created_at?new Date(sel.created_at).toLocaleDateString("ro-RO"):""}</div>
      <div style={{color:"#e2e8f0",fontSize:14,lineHeight:1.8,paddingBottom:20}}><Txt text={sel.continut} /></div>
    </div>
  );

  return (
    <div style={{padding:"0 20px",overflowY:"auto",flex:1}}>
      <div style={{display:"flex",gap:8,marginBottom:8}}>
        <button onClick={()=>fRef.current?.click()} disabled={loading} style={{flex:1,padding:"14px",background:loading?"#2a3040":"linear-gradient(135deg,#16a34a,#22c55e)",border:"none",borderRadius:12,color:"white",fontSize:14,fontWeight:700,cursor:loading?"default":"pointer"}}>
          {loading?"⏳ Se procesează...":"📤 Încarcă rețete (PDF/Word)"}
        </button>
        <button onClick={()=>reload(userId)} style={{padding:"14px",background:"#1a1f2e",border:"1px solid #2a3040",borderRadius:12,color:"#94a3b8",fontSize:14,cursor:"pointer"}} title="Reîncarcă din cloud">🔄</button>
      </div>
      <input ref={fRef} type="file" accept=".pdf,.doc,.docx,.txt" onChange={upload} style={{display:"none"}} />
      <div style={{color:"#4a5568",fontSize:12,textAlign:"center",marginBottom:14}}>Agentul extrage rețetele și le salvează permanent în cloud. Apasă 🔄 dacă nu apar imediat.</div>

      {loadingR?<div style={{textAlign:"center",color:"#4a5568",padding:"40px 0"}}>Se încarcă rețetele din cloud...</div>:
      !retete.length?<div style={{textAlign:"center",color:"#4a5568",padding:"40px 0"}}><div style={{fontSize:40,marginBottom:12}}>📚</div><div>Nicio rețetă încărcată.</div><div style={{fontSize:12,marginTop:8}}>Apasă butonul pentru a încărca un PDF sau Word.</div></div>:(
        <div style={{display:"flex",flexDirection:"column",gap:10,paddingBottom:20}}>
          {retete.map(r=>(
            <div key={r.id} onClick={()=>setSel(r)} style={{background:"#1a1f2e",border:"1px solid #2a3040",borderRadius:12,padding:"12px 16px",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{color:"#22c55e",fontSize:14,fontWeight:600}}>📄 {r.nume}</div>
                <div style={{color:"#4a5568",fontSize:11,marginTop:2}}>{r.created_at?new Date(r.created_at).toLocaleDateString("ro-RO"):""} · Click pentru a citi</div>
              </div>
              <button onClick={e=>{e.stopPropagation();del(r.id);}} style={{background:"transparent",border:"none",color:"#ef4444",cursor:"pointer",fontSize:16,padding:"4px 8px"}}>🗑️</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
export default function Home() {
  const router = useRouter();
  const [tab, setTab] = useState(0);
  const [profil, setProfil] = useState(null);
  const [ctx, setCtx] = useState({});

  useEffect(()=>{
    const uid = getUserId();
    const saved = localStorage.getItem("profil_nutritie");
    if(saved) setProfil(JSON.parse(saved));

    Promise.all([getMemory(uid), getJurnalRecent(uid), getProgres(uid), getRetete(uid), getJurnalStats(uid)])
      .then(([memory,jurnal,progres,retete,stats])=>{
        setCtx({memory:memory||[],jurnal:jurnal||[],progres:progres||[],retete:retete||[],stats});
      }).catch(e=>console.error("Context error:",e));
  },[]);

  return (
    <div style={{fontFamily:"'Inter',system-ui,sans-serif",background:"#0f1117",minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center"}}>
      <div style={{width:"100%",maxWidth:680,display:"flex",flexDirection:"column",height:"100vh"}}>
        <div style={{padding:"12px 20px 0"}}>
          <div style={{background:"linear-gradient(135deg,#1a2a1a,#0f1f0f)",border:"1px solid #2a4a2a",borderRadius:16,padding:"10px 14px",display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
            <div style={{width:34,height:34,borderRadius:10,background:"linear-gradient(135deg,#22c55e,#16a34a)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>🥦</div>
            <div style={{flex:1}}>
              <div style={{color:"#22c55e",fontWeight:700,fontSize:13}}>Agent Nutriție & Sport</div>
              <div style={{color:"#4ade80",fontSize:10,opacity:0.8}}>{profil?.nume?`${profil.nume} · ${profil.calorii||1600} kcal`:"Completează profilul"} · 🧠 {ctx?.memory?.length||0} amintiri</div>
            </div>
            <button onClick={()=>router.push("/profil")} style={{background:profil?"#1a2a1a":"linear-gradient(135deg,#16a34a,#22c55e)",border:profil?"1px solid #2a4a2a":"none",borderRadius:8,color:profil?"#22c55e":"white",padding:"5px 10px",cursor:"pointer",fontSize:11,fontWeight:600}}>{profil?"👤 Profil":"⚙️ Setează"}</button>
          </div>
          <div style={{display:"flex",gap:4,overflowX:"auto",paddingBottom:4}}>
            {TABS.map((t,i)=>(
              <button key={i} onClick={()=>setTab(i)} style={{background:i===tab?"linear-gradient(135deg,#16a34a,#22c55e)":"#1a1f2e",border:`1px solid ${i===tab?"transparent":"#2a3040"}`,borderRadius:20,color:i===tab?"white":"#94a3b8",padding:"5px 10px",cursor:"pointer",fontSize:11,fontWeight:i===tab?700:400,flexShrink:0,whiteSpace:"nowrap"}}>{t}</button>
            ))}
          </div>
        </div>
        <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",paddingTop:10}}>
          {tab===0&&<ChatTab profil={profil} ctx={ctx} />}
          {tab===1&&<FavoriteTab />}
          {tab===2&&<JurnalTab profil={profil} ctx={ctx} />}
          {tab===3&&<SaptamanaTab profil={profil} ctx={ctx} />}
          {tab===4&&<ProgresTab profil={profil} ctx={ctx} />}
          {tab===5&&<SportTab profil={profil} ctx={ctx} />}
          {tab===6&&<ReminderTab />}
          {tab===7&&<ProdusTab profil={profil} />}
          {tab===8&&<ReteteTab profil={profil} />}
        </div>
      </div>
      <style>{`@keyframes bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-6px)}}*{box-sizing:border-box}::-webkit-scrollbar{width:3px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:#2a3040;border-radius:2px}input[type="date"]::-webkit-calendar-picker-indicator,input[type="time"]::-webkit-calendar-picker-indicator{filter:invert(1)}`}</style>
    </div>
  );
}
