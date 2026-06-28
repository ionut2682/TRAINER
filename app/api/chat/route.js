export async function POST(req) {
  const { messages, profil, tip, context } = await req.json();

  const p = profil || {};
  const ctx = context || {};

  const profilText = `
PROFILUL UTILIZATORULUI:
- Nume: ${p.nume || "Marius"}, Vârstă: ${p.varsta || 44} ani
- Greutate: ${p.greutate || "?"} kg, Înălțime: ${p.inaltime || "?"} cm
- Obiectiv: ${p.obiectivSpecific || "scăderea circumferinței abdomenului cu 8 cm"}
- Tratamente: ${p.tratamente || "criolipoliză 3 ședințe"}
- Calorii țintă: ${p.calorii || 1600} kcal/zi
- Restricții: ${p.restrictii || "fără gluten, low-carb"}
- Limitări fizice: genunchi sensibili, spate neantrenat, 44 ani, stil sedentar
- Echipament: ${p.echipament || "acasă, fără echipament"}`;

  const memoryText = ctx.memory?.length
    ? `\nMEMORIE ANTERIOARĂ:\n${ctx.memory.slice(0, 20).map((m, i) => `${i + 1}. ${m.content}`).join("\n")}`
    : "";

  const progresText = ctx.progres?.length > 1 ? (() => {
    const prima = ctx.progres[0], ultima = ctx.progres[ctx.progres.length - 1];
    const dKg = prima.greutate && ultima.greutate ? (ultima.greutate - prima.greutate).toFixed(1) : null;
    const dCm = prima.abdomen && ultima.abdomen ? (ultima.abdomen - prima.abdomen).toFixed(1) : null;
    return `\nPROGRES: Greutate ${prima.greutate}→${ultima.greutate}kg${dKg ? ` (${dKg}kg)` : ""}. Abdomen ${prima.abdomen}→${ultima.abdomen}cm${dCm ? ` (${dCm}cm)` : ""}`;
  })() : "";

  const reteteText = ctx.retete?.length
    ? `\nRETETE PROPRII: ${ctx.retete.map(r => `"${r.nume}"`).join(", ")}`
    : "";

  let systemPrompt = `Ești agentul personal de nutriție și sport al lui ${p.nume || "Marius"}. Ești mai bun decât Google AI pentru că îl cunoști complet și îți amintești tot.
${profilText}${memoryText}${progresText}${reteteText}

REGULI:
- Răspunde ÎNTOTDEAUNA în română
- Fii SPECIFIC, nu generic — folosește datele reale ale utilizatorului
- Pentru sport: NICIODATĂ alergat, genuflexiuni cu impact — adaptează pentru genunchi sensibili și spate neantrenat
- Caută ÎNTOTDEAUNA online pentru produse specifice românești (Mega Image, Kaufland, Lidl etc.)
- Când menționezi un produs românesc specific, caută gramajul și valorile nutriționale exacte`;

  if (tip === "jurnal") {
    systemPrompt += `

TASK: Calculează nutrienți complet pentru alimentele descrise.
IMPORTANT: Caută online gramajul exact al produselor românești (ex: salată Fiesta Mega Image = 120g).
Referințe: ou=60g, măr=180g, pară=170g, banană=120g, felie pâine=30g.

FORMAT RĂSPUNS:
| Aliment | Cantitate | kcal | Proteine | Carbohidrați | Zahăr | Grăsimi | Sare |
|---------|-----------|------|----------|--------------|-------|---------|------|

📊 **TOTAL:**
- **Calorii: ~X kcal** (target: ${p.calorii || 1600} kcal/zi)
- **Proteine: ~Xg | Carbohidrați: ~Xg | Zahăr: ~Xg | Grăsimi: ~Xg | Sare: ~Xg**
💧 **Apă recomandată:** Xml
💡 **Observație:** [personalizată]`;
  } else if (tip === "plan") {
    systemPrompt += `

TASK: Plan alimentar COMPLET 7 zile.
Generează TOATE cele 7 zile. Dacă nu poți dintr-o dată, generează 3-4 zile COMPLETE și spune utilizatorului să ceară continuarea.
Pentru fiecare masă: ingrediente exacte în grame, pași detaliați pentru începător, timpi de gătire, tabel nutrițional complet.`;
  } else if (tip === "sport") {
    systemPrompt += `

TASK: Plan sport PROGRESIV și SIGUR pentru 44 ani, sedentar, genunchi sensibili, spate neantrenat.
Include: tai-chi, stretching, yoga blând, mers progresiv. NICIODATĂ alergat sau impact mare.
Explică EXACT fiecare exercițiu. Plan pe 3 luni cu progresie graduală.`;
  } else if (tip === "idei") {
    systemPrompt += `

TASK: 5 idei concrete pentru azi:
🥗 **Nutriție:** [idee specifică cu cifre]
🏃 **Mișcare:** [exercițiu SAFE, durată exactă]
💧 **Hidratare:** [cantitate specifică]
🧘 **Wellbeing:** [somn, stres, recuperare]
💡 **Sfat zilnic:** [personalizat din istoricul său]`;
  } else if (tip === "rezumat") {
    systemPrompt = `Creează un rezumat CONCIS (3-4 fraze) al acestei conversații pentru memorie pe termen lung. Include subiecte principale, decizii, info personale importante. Răspunde DOAR cu rezumatul.`;
  }

  // Convert messages to Gemini format
  const geminiMessages = messages.map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: typeof m.content === "string" ? m.content : JSON.stringify(m.content) }]
  }));

  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: geminiMessages,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: tip === "plan" ? 4000 : 2000,
    },
    tools: [{ google_search: {} }],
  };

  const model = "gemini-1.5-flash";
  const apiKey = process.env.GEMINI_API_KEY;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  const data = await response.json();

  if (data.error) {
    console.error("Gemini error:", data.error);
    return Response.json({ reply: "Eroare Gemini: " + data.error.message });
  }

  const text = data.candidates?.[0]?.content?.parts
    ?.filter(p => p.text)
    ?.map(p => p.text)
    ?.join("") || "Eroare la răspuns.";

  return Response.json({ reply: text });
}
