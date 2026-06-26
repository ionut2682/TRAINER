"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

const SUGGESTIONS = [
  "Am piept de pui 200g și broccoli. Ce fac?",
  "Fă-mi un plan complet pentru azi",
  "Dă-mi un plan sport pentru azi",
  "Calculează macro-urile pentru omletă cu 3 ouă",
  "Ce exerciții ajută la reducerea abdomenului?",
];

export default function Home() {
  const router = useRouter();
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Salut! Sunt agentul tău personal de nutriție și sport.\n\nPot să:\n• 🥗 Generez rețete din ingredientele tale\n• 📅 Planific mesele pentru o zi întreagă\n• 📊 Calculez macro-urile oricărui preparat\n• 🏋️ Îți dau un plan sport adaptat obiectivelor tale\n• 📷 Analizez poze cu mâncare, frigider sau etichete\n\nCu ce te ajut azi?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [profil, setProfil] = useState(null);
  const [imagine, setImagine] = useState(null); // base64
  const [imaginePreview, setImaginePreview] = useState(null);
  const bottomRef = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => {
    const saved = localStorage.getItem("profil_nutritie");
    if (saved) setProfil(JSON.parse(saved));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  function handleImagine(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(",")[1];
      setImagine({ data: base64, type: file.type });
      setImaginePreview(reader.result);
    };
    reader.readAsDataURL(file);
  }

  function stergeImagine() {
    setImagine(null);
    setImaginePreview(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function sendMessage(text) {
    const userText = text || input.trim();
    if ((!userText && !imagine) || loading) return;
    setInput("");

    // Build user message for display
    const displayMsg = {
      role: "user",
      content: userText || "📷 Am trimis o poză",
      imagine: imaginePreview,
    };

    // Build API message
    let apiContent = [];
    if (imagine) {
      apiContent.push({
        type: "image",
        source: { type: "base64", media_type: imagine.type, data: imagine.data },
      });
    }
    if (userText) {
      apiContent.push({ type: "text", text: userText });
    } else if (imagine) {
      apiContent.push({ type: "text", text: "Analizează această imagine în contextul nutriției și obiectivelor mele. Dacă e mâncare, estimează caloriile și macro-urile. Dacă e frigider, sugerează o rețetă. Dacă e etichetă, citește valorile nutriționale." });
    }

    const newMessages = [...messages, displayMsg];
    setMessages(newMessages);
    setImagine(null);
    setImaginePreview(null);
    if (fileRef.current) fileRef.current.value = "";
    setLoading(true);

    // Build API messages without imagine preview field
    const apiMessages = newMessages.map((m) => ({
      role: m.role,
      content: m.role === "user" && m === displayMsg
        ? apiContent
        : m.content,
    }));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages, profil }),
      });
      const data = await res.json();
      setMessages([...newMessages, { role: "assistant", content: data.reply }]);
    } catch {
      setMessages([...newMessages, { role: "assistant", content: "A apărut o eroare. Încearcă din nou." }]);
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
            part.startsWith("**") && part.endsWith("**")
              ? <strong key={j}>{part.slice(2, -2)}</strong>
              : part
          )}
        </p>
      );
    });
  }

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: "#0f1117", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center" }}>
      {/* Header */}
      <div style={{ width: "100%", maxWidth: 680, padding: "20px 20px 0" }}>
        <div style={{ background: "linear-gradient(135deg, #1a2a1a, #0f1f0f)", border: "1px solid #2a4a2a", borderRadius: 16, padding: "14px 18px", display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg, #22c55e, #16a34a)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>🥦</div>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#22c55e", fontWeight: 700, fontSize: 15 }}>Agent Nutriție & Sport</div>
            <div style={{ color: "#4ade80", fontSize: 11, opacity: 0.7 }}>
              {profil?.nume ? `${profil.nume} · ${profil.calorii || 1600} kcal` : "Completează profilul pentru personalizare"}
            </div>
          </div>
          <button onClick={() => router.push("/profil")} style={{ background: profil ? "#1a2a1a" : "linear-gradient(135deg, #16a34a, #22c55e)", border: profil ? "1px solid #2a4a2a" : "none", borderRadius: 10, color: profil ? "#22c55e" : "white", padding: "7px 14px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
            {profil ? "👤 Profil" : "⚙️ Setează Profil"}
          </button>
        </div>
      </div>

      {/* Chat */}
      <div style={{ width: "100%", maxWidth: 680, flex: 1, padding: "0 20px", display: "flex", flexDirection: "column", gap: 12, paddingBottom: 8, overflowY: "auto" }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{ maxWidth: "82%", padding: "12px 16px", borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px", background: msg.role === "user" ? "linear-gradient(135deg, #16a34a, #22c55e)" : "#1a1f2e", border: msg.role === "assistant" ? "1px solid #2a3040" : "none", color: msg.role === "user" ? "#fff" : "#e2e8f0", fontSize: 14, lineHeight: 1.6 }}>
              {msg.imagine && (
                <img src={msg.imagine} alt="uploaded" style={{ width: "100%", borderRadius: 8, marginBottom: 8, maxHeight: 200, objectFit: "cover" }} />
              )}
              {formatMessage(msg.content)}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div style={{ padding: "12px 16px", borderRadius: "18px 18px 18px 4px", background: "#1a1f2e", border: "1px solid #2a3040", display: "flex", gap: 5, alignItems: "center" }}>
              {[0,1,2].map(d => <div key={d} style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", animation: "bounce 1.2s infinite", animationDelay: `${d*0.2}s` }} />)}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions */}
      {messages.length <= 1 && (
        <div style={{ width: "100%", maxWidth: 680, padding: "8px 20px", display: "flex", flexWrap: "wrap", gap: 8 }}>
          {SUGGESTIONS.map((s, i) => (
            <button key={i} onClick={() => sendMessage(s)} style={{ background: "#1a1f2e", border: "1px solid #2a3a2a", borderRadius: 20, color: "#86efac", fontSize: 12, padding: "6px 12px", cursor: "pointer" }}>
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Image preview */}
      {imaginePreview && (
        <div style={{ width: "100%", maxWidth: 680, padding: "0 20px" }}>
          <div style={{ position: "relative", display: "inline-block" }}>
            <img src={imaginePreview} alt="preview" style={{ height: 80, borderRadius: 10, border: "2px solid #22c55e" }} />
            <button onClick={stergeImagine} style={{ position: "absolute", top: -8, right: -8, width: 22, height: 22, borderRadius: "50%", background: "#ef4444", border: "none", color: "white", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
          </div>
        </div>
      )}

      {/* Input */}
      <div style={{ width: "100%", maxWidth: 680, padding: "12px 20px 24px" }}>
        <div style={{ display: "flex", gap: 10, background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 16, padding: "8px 8px 8px 12px", alignItems: "flex-end" }}>
          {/* Camera button */}
          <button onClick={() => fileRef.current?.click()} style={{ width: 36, height: 36, borderRadius: 8, background: "#2a3040", border: "none", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            📷
          </button>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleImagine} style={{ display: "none" }} />

          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder="Scrie sau trimite o poză..."
            rows={1}
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#e2e8f0", fontSize: 14, resize: "none", lineHeight: 1.5, paddingTop: 6, fontFamily: "inherit" }}
          />
          <button onClick={() => sendMessage()} disabled={(!input.trim() && !imagine) || loading} style={{ width: 36, height: 36, borderRadius: 10, background: (input.trim() || imagine) && !loading ? "linear-gradient(135deg, #16a34a, #22c55e)" : "#2a3040", border: "none", cursor: (input.trim() || imagine) && !loading ? "pointer" : "default", fontSize: 18, color: "white", flexShrink: 0 }}>
            ↑
          </button>
        </div>
        <div style={{ textAlign: "center", color: "#4a5568", fontSize: 11, marginTop: 6 }}>
          📷 Poți trimite poze cu frigiderul, mâncare sau etichete nutriționale
        </div>
      </div>

      <style>{`
        @keyframes bounce { 0%, 60%, 100% { transform: translateY(0); } 30% { transform: translateY(-6px); } }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  );
}
