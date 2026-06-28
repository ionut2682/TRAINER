export async function POST(req) {
  const { messages, profil, tip, context } = await req.json();

  const p = profil || {};
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

  const ctx = context || {};
  const memoryText = ctx.memory?.length ? `\nMEMORIE ANTERIOARĂ:\n${ctx.memory.slice(0,20).map((m,i) => `${i+1}. ${m.content}`).join("\n")}` : "";
  const progresText = ctx.progres?.length > 1 ? (() => {
    const prima = ctx.progres[0], ultima = ctx.progres[ctx.progres.length-1];
    const dKg = prima.greutate && ultima.greutate ? (ultima.greutate - prima.greutate).toFixed(1) : null;
    const dCm = prima.abdomen && ultima.abdomen ? (ultima.abdomen - prima.abdomen).toFixed(1) : null;
    return `\nPROGRES: Greutate ${prima.greutate}→${ultima.greutate}kg ${dKg?`(${dKg}kg)`:""}. Abdomen ${prima.abdomen}→${ultima.abdomen}cm ${dCm?`(${dCm}cm)`:""}`;
  })() : "";
  const reteteText = ctx.retete?.length ? `\nRETETE PROPRII: ${ctx.retete.map(r=>`"${r.nume}"`).join(", ")}` : "";

  const systemBase = `Ești agentul personal de nutriție și sport al lui ${p.nume || "Marius"}. Ești mai bun decât Google AI pentru că îl cunoști complet.
${profilText}${memoryText}${progresText}${reteteText}

REGULI:
- Răspunde ÎNTOTDEAUNA în română
- Fii SPECIFIC, nu generic — folosește datele reale ale utilizatorului
- Pentru sport: NICIODATĂ alergat, genuflexiuni cu impact — adaptează pentru genunchi sensibili
- Caută ÎNTOTDEAUNA online pentru produse specifice românești (Mega Image, Kaufland, Lidl etc.)
- Când cauți un produs românesc specific (ex: salată Fiesta Mega Image), caută exact gramajul real`;

  let system = systemBase;

  if (tip === "jurnal") {
    system += `\n\nTASK: Calculează nutrienți complet pentru alimentele descrise.
IMPORTANT: Caută online gramajul exact al produselor românești specifice (ex: salată Fiesta Mega Image = 120g, nu 150g).
Referințe fără gramaj: ou=60g, măr=180g, pară=170g, banană=120g, felie pâine=30g.

FORMAT RĂSPUNS:
| Aliment | Cantitate | kcal | Proteine | Carbohidrați | Zahăr | Grăsimi | Sare |
|---------|-----------|------|----------|--------------|-------|---------|------|

📊 **TOTAL:**
- **Calorii: ~X kcal** (target: ${p.calorii||1600} kcal/zi)
- **Proteine: ~Xg | Carbohidrați: ~Xg | Zahăr: ~Xg | Grăsimi: ~Xg | Sare: ~Xg**
💧 **Apă recomandată:** Xml
💡 **Observație:** [personalizată]`;
  } else if (tip === "plan") {
    system += `\n\nTASK: Plan alimentar COMPLET 7 zile.
IMPORTANT: Generează TOATE cele 7 zile complet. Nu te opri la mijloc.
Pentru fiecare masă: ingrediente exacte în grame, pași detaliați pentru începător, timpi de gătire, tabel nutrițional complet.
Dacă nu poți genera toate 7 zile complet într-un răspuns, generează 3-4 zile COMPLETE și menționează că utilizatorul poate cere continuarea.`;
  } else if (tip === "sport") {
    system += `\n\nTASK: Plan sport PROGRESIV și SIGUR.
- 44 ani, sedentar, genunchi sensibili, spate neantrenat
- Include: tai-chi, stretching, yoga blând, mers progresiv
- NICIODATĂ: alergat, genuflexiuni cu greutăți, impact mare
- Explică EXACT fiecare exercițiu
- Plan pe 3 luni cu progresie graduală`;
  } else if (tip === "idei") {
    system += `\n\nTASK: 5 idei concrete pentru azi:
🥗 **Nutriție:** [idee specifică cu cifre]
🏃 **Mișcare:** [exercițiu SAFE, cu durată exactă]
💧 **Hidratare:** [cantitate specifică]
🧘 **Wellbeing:** [somn, stres, recuperare]
💡 **Sfat zilnic:** [personalizat din istoricul său]`;
  } else if (tip === "rezumat") {
    system = `Creează un rezumat CONCIS (3-4 fraze) al acestei conversații pentru memorie pe termen lung. Include subiecte principale, decizii, info personale importante. Răspunde DOAR cu rezumatul.`;
  }

  const body = {
    model: "claude-sonnet-4-6",
    max_tokens: tip === "plan" ? 4000 : 2000,
    system,
    messages,
    tools: [{ type: "web_search_20250305", name: "web_search" }],
  };

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "web-search-2025-03-05",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  if (data.error) return Response.json({ reply: "Eroare: " + data.error.message });
  const text = data.content?.filter(b => b.type === "text").map(b => b.text).join("") || "Eroare la răspuns.";
  return Response.json({ reply: text });
}
