export async function POST(req) {
  const { messages, profil, tip, context } = await req.json();

  const profilText = profil ? `
PROFILUL UTILIZATORULUI:
- Nume: ${profil.nume || "Marius"}
- Vârstă: ${profil.varsta || "nespecificată"}
- Greutate inițială: ${profil.greutate || "nespecificată"} kg
- Înălțime: ${profil.inaltime || "nespecificată"} cm
- Obiectiv principal: ${profil.obiectiv || "scădere în greutate"}
- Obiectiv specific: ${profil.obiectivSpecific || "scăderea circumferinței abdomenului cu 8 cm"}
- Tratamente estetice: ${profil.tratamente || "criolipoliză 3 ședințe la interval de o lună"}
- Calorii zilnice țintă: ${profil.calorii || "1600"} kcal
- Restricții alimentare: ${profil.restrictii || "fără gluten, fără carbohidrați rafinați, low-carb"}
- Nivel activitate fizică: ${profil.activitate || "moderat"}
- Echipament sport disponibil: ${profil.echipament || "acasă, fără echipament"}
- Timp disponibil sport: ${profil.timpSport || "30 minute/zi"}
- Alte informații: ${profil.altele || ""}` : "Utilizator cu dietă low-carb, fără gluten, ~1600 kcal/zi.";

  const memoryText = context?.memory?.length > 0 ? `
MEMORIA PE TERMEN LUNG (conversații și evenimente anterioare):
${context.memory.map(m => `- ${m.content}`).join("\n")}` : "";

  const jurnalText = context?.jurnal?.length > 0 ? `
JURNALUL RECENT AL UTILIZATORULUI (ultimele mese înregistrate):
${context.jurnal.map(j => `- ${j.data}: ${j.item} (${j.analiza ? "analizat" : "neanaliat"})`).join("\n")}` : "";

  const progresText = context?.progres?.length > 0 ? `
PROGRESUL UTILIZATORULUI:
${context.progres.map(p => `- ${p.data}: ${p.greutate ? p.greutate + "kg" : ""} ${p.abdomen ? p.abdomen + "cm abdomen" : ""}`).join("\n")}` : "";

  const reteteText = context?.retete?.length > 0 ? `
REȚETELE PROPRII ALE UTILIZATORULUI (disponibile pentru recomandări):
${context.retete.map(r => `- ${r.nume}: ${r.continut?.slice(0, 200)}...`).join("\n")}` : "";

  let systemPrompt = `Ești agentul personal de nutriție și sport al lui ${profil?.nume || "Marius"}. Ești SUPERIOR Google AI pe nutriție pentru că:
1. Cunoști profilul complet al utilizatorului
2. Îți amintești toate conversațiile anterioare
3. Urmărești progresul real (greutate, circumferință abdomen)
4. Dai sfaturi CONCRETE, personalizate, bazate pe știință
5. Cunoști jurnalul alimentar și poți face analize reale

${profilText}
${memoryText}
${jurnalText}
${progresText}
${reteteText}

REGULI IMPORTANTE:
- Fii SPECIFIC și CONCRET, nu generic
- Referă-te la datele reale ale utilizatorului când e relevant
- Dacă utilizatorul a menționat ceva în trecut (din memorie), referă-te la asta
- Răspunde ÎNTOTDEAUNA în română
- Pentru rețete: include gramaje exacte și pași detaliați pentru un începător
- Pentru sfaturi: bazează-te pe știință, cu cifre concrete
- Nu spune "consultați un medic" ca răspuns principal — dă sfatul concret`;

  if (tip === "jurnal") {
    systemPrompt += `

TASK JURNAL: Calculează valorile nutriționale pentru alimentele descrise.
- Pentru fiecare aliment: kcal, proteine (g), carbohidrați (g), zahăr (g), grăsimi (g)
- Dacă nu e specificat gramajul: ou=60g, măr=180g, pară=170g, banană=120g, portocală=150g, felie pâine=30g
- Pentru produse de marcă românești, folosește valorile reale de pe etichetă
- Format OBLIGATORIU:

**[Aliment] ([cantitate]):** X kcal | P: Xg | C: Xg | Z: Xg | G: Xg

📊 **TOTAL:**
- **Calorii: ~X kcal** (din targetul de ${profil?.calorii || 1600} kcal/zi)
- **Proteine: ~X g**
- **Carbohidrați: ~X g**  
- **Zahăr: ~X g**
- **Grăsimi: ~X g**

Adaugă un comentariu scurt despre cum se încadrează în obiectivele utilizatorului.`;
  } else if (tip === "plan") {
    systemPrompt += `

TASK PLAN ALIMENTAR: Generează plan complet pentru 7 zile cu rețete DETALIATE.
Pentru fiecare masă:
- Ingrediente cu gramaje exacte
- Mod de preparare pas cu pas (pentru un începător absolut)
- Timpi exacti de gătire
- Sfaturi practice
- Tabel nutrițional complet (kcal | Proteine | Carbohidrați | Zahăr | Grăsimi)
- Total calorii pe zi`;
  } else if (tip === "rezumat") {
    systemPrompt = `Ești un sistem de memorie. Analizează această conversație și extrage un rezumat CONCIS (max 3-4 fraze) cu:
- Subiectele principale discutate
- Deciziile sau planurile stabilite
- Informații personale relevante menționate
- Progresul sau problemele discutate
Răspunde DOAR cu rezumatul, fără introducere.`;
  }

  const tools = [{ type: "web_search_20250305", name: "web_search" }];

  const body = {
    model: "claude-sonnet-4-6",
    max_tokens: tip === "plan" ? 4000 : 2000,
    system: systemPrompt,
    messages,
    tools,
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
  const text = data.content?.filter(b => b.type === "text").map(b => b.text).join("") || "Eroare.";
  return Response.json({ reply: text });
}
