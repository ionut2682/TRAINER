"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const CAMPURI = [
  { key: "nume", label: "Nume", placeholder: "ex: Marius", tip: "text" },
  { key: "varsta", label: "Vârstă", placeholder: "ex: 35", tip: "number" },
  { key: "greutate", label: "Greutate (kg)", placeholder: "ex: 85", tip: "number" },
  { key: "inaltime", label: "Înălțime (cm)", placeholder: "ex: 178", tip: "number" },
  { key: "obiectiv", label: "Obiectiv principal", placeholder: "ex: scădere în greutate, masă musculară", tip: "text" },
  { key: "obiectivSpecific", label: "Obiectiv specific", placeholder: "ex: scăderea circumferinței abdomenului cu 8 cm", tip: "text" },
  { key: "tratamente", label: "Tratamente estetice / medicale", placeholder: "ex: criolipoliză 3 ședințe la interval de o lună", tip: "text" },
  { key: "calorii", label: "Calorii zilnice țintă", placeholder: "ex: 1600", tip: "number" },
  { key: "restrictii", label: "Restricții alimentare", placeholder: "ex: fără gluten, low-carb", tip: "text" },
  { key: "activitate", label: "Nivel activitate fizică", placeholder: "ex: sedentar, moderat, activ", tip: "text" },
  { key: "echipament", label: "Echipament sport disponibil", placeholder: "ex: acasă fără echipament, sală, benzi elastice", tip: "text" },
  { key: "timpSport", label: "Timp disponibil pentru sport", placeholder: "ex: 30 minute/zi", tip: "text" },
  { key: "altele", label: "Alte informații relevante", placeholder: "orice altceva vrei să știe agentul", tip: "textarea" },
];

export default function Profil() {
  const router = useRouter();
  const [profil, setProfil] = useState({});
  const [salvat, setSalvat] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("profil_nutritie");
    if (saved) setProfil(JSON.parse(saved));
  }, []);

  function handleChange(key, value) {
    setProfil(prev => ({ ...prev, [key]: value }));
  }

  function salveaza() {
    localStorage.setItem("profil_nutritie", JSON.stringify(profil));
    setSalvat(true);
    setTimeout(() => setSalvat(false), 2000);
  }

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: "#0f1117", minHeight: "100vh", padding: "20px" }}>
      <div style={{ maxWidth: 600, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <button onClick={() => router.push("/")} style={{ background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 10, color: "#94a3b8", padding: "8px 14px", cursor: "pointer", fontSize: 14 }}>
            ← Înapoi
          </button>
          <div>
            <div style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 20 }}>Profilul Meu</div>
            <div style={{ color: "#64748b", fontSize: 12 }}>Agentul folosește aceste date pentru răspunsuri personalizate</div>
          </div>
        </div>

        {/* Form */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {CAMPURI.map(({ key, label, placeholder, tip }) => (
            <div key={key}>
              <label style={{ color: "#94a3b8", fontSize: 13, display: "block", marginBottom: 6 }}>{label}</label>
              {tip === "textarea" ? (
                <textarea
                  value={profil[key] || ""}
                  onChange={e => handleChange(key, e.target.value)}
                  placeholder={placeholder}
                  rows={3}
                  style={{ width: "100%", background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 10, color: "#e2e8f0", padding: "10px 14px", fontSize: 14, outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }}
                />
              ) : (
                <input
                  type={tip}
                  value={profil[key] || ""}
                  onChange={e => handleChange(key, e.target.value)}
                  placeholder={placeholder}
                  style={{ width: "100%", background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 10, color: "#e2e8f0", padding: "10px 14px", fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
                />
              )}
            </div>
          ))}
        </div>

        {/* Save Button */}
        <button
          onClick={salveaza}
          style={{ width: "100%", marginTop: 24, padding: "14px", background: salvat ? "#16a34a" : "linear-gradient(135deg, #16a34a, #22c55e)", border: "none", borderRadius: 12, color: "white", fontSize: 16, fontWeight: 700, cursor: "pointer", transition: "all 0.2s", marginBottom: 40 }}
        >
          {salvat ? "✓ Salvat!" : "Salvează Profilul"}
        </button>
      </div>
    </div>
  );
}
