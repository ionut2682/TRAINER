export async function POST(req) {
  const { messages, profil, tip, context } = await req.json();

  const profilText = profil ? `
PROFILUL COMPLET AL UTILIZATORULUI:
- Nume: ${profil.nume || "Marius"}
- Vârstă: ${profil.varsta || 44} ani
- Greutate inițială: ${profil.greutate || "nespecificată"} kg
- Înălțime: ${profil.inaltime || "nespecificată"} cm
- Obiectiv principal: ${profil.obiectiv || "slăbit și tonifiere"}
- Obiectiv specific: ${profil.obiectivSpecific || "scăderea circumferinței abdomenului cu 8 cm"}
- Tratamente estetice: ${profil.tratamente || "criolipoliză 3 ședințe la interval de o lună"}
- Calorii zilnice țintă: ${profil.calorii || 1600} kcal
- Restricții alimentare: ${profil.restrictii || "fără gluten, fără carbohidrați rafinați, low-carb"}
- Nivel activitate fizică: ${profil.activitate || "sedentar"}
- Echipament sport: ${profil.echipament || "acasă, fără echipament"}
- Timp disponibil sport: ${profil.timpSport || "30 minute/zi"}
- Limitări fizice: genunchi sensibili (durere la alergat 3km, genuflexiuni), spate neantrenat (durere la exerciții intense), vârstă 44 ani — necesită program sport PROGRESIV și BLÂND
- Obiective sport: slăbire + tonifiere + întărire abdomen + formă fizică mai bună — fără sala, acasă
- Alte informații: ${profil.altele || ""}` : "Utilizator de 44 ani, dietă low-carb fără gluten, ~1600 kcal/zi, limitări fizice la genunchi și spate.";

  // Memorie pe termen lung
  const memoryText = context?.memory?.length > 0 ? `
MEMORIA PE TERMEN LUNG (tot ce s-a discutat anterior — FOLOSEȘTE ACTIV aceste informații):
${context.memory.slice(0, 30).map((m, i) => `${i+1}. [${m.tip || "conversatie"}${m.rezolvat ? " - REZOLVAT" : ""}] ${m.content}`).join("\n")}` : "";

  // Jurnal recent
  const jurnalText = context?.jurnal?.length > 0 ? `
JURNALUL ALIMENTAR RECENT (ultimele 30 mese înregistrate):
${context.jurnal.map(j => `- ${j.data} ${j.ora_masa || ""} [${j.tip_masa || "masă"}]: ${j.item} | ${j.analiza ? j.analiza.slice(0, 150) + "..." : "neanalizat"}`).join("\n")}` : "";

  // Progres
  const progresText = context?.progres?.length > 0 ? (() => {
    const p = context.progres;
    const prima = p[0];
    const ultima = p[p.length - 1];
    const diffKg = prima?.greutate && ultima?.greutate ? (ultima.greutate - prima.greutate).toFixed(1) : null;
    const diffCm = prima?.abdomen && ultima?.abdomen ? (ultima.abdomen - prima.abdomen).toFixed(1) : null;
    return `
PROGRESUL REAL AL UTILIZATORULUI:
- Greutate inițială: ${prima?.greutate || "?"} kg → Greutate actuală: ${ultima?.greutate || "?"} kg ${diffKg ? `(${parseFloat(diffKg) < 0 ? "❤️ slăbit " + Math.abs(diffKg) : "luat " + diffKg} kg total)` : ""}
- Abdomen inițial: ${prima?.abdomen || "?"}cm → Abdomen actual: ${ultima?.abdomen || "?"}cm ${diffCm ? `(${parseFloat(diffCm) < 0 ? "✅ redus " + Math.abs(diffCm) : "crescut " + diffCm} cm)` : ""}
- Număr măsurători: ${p.length}
- Prima măsurătoare: ${prima?.data || "?"} | Ultima: ${ultima?.data || "?"}`;
  })() : "";

  // Statistici jurnal
  const statsText = context?.stats ? `
STATISTICI DIETĂ:
- Zile cu jurnal completat: ${context.stats.zileCuJurnal || 0}
- Medie calorii zilnice: ${context.stats.medieCalorii || 0} kcal (target: ${profil?.calorii || 1600} kcal)
- Zile în target caloric: ${context.stats.zieleInTarget || 0} din ${context.stats.zileCuJurnal || 0} (${context.stats.procentRespectare || 0}%)
- Total sare consumată (medie/zi): ${context.stats.medieSare || 0}g` : "";

  // Rețete proprii
  const reteteText = context?.retete?.length > 0 ? `
REȚETELE PROPRII ALE UTILIZATORULUI (folosește-le când dai recomandări):
${context.retete.map(r => `- "${r.nume}": ${r.continut?.slice(0, 150)}...`).join("\n")}` : "";

  let systemPrompt = `Ești agentul personal de nutriție și sport al lui ${profil?.nume || "Marius"}. 

MISIUNEA TA: Să fii MAI BUN decât Google AI, ChatGPT și Claude standard pe nutriție și sport PERSONALIZAT, pentru că:
1. Îl cunoști COMPLET pe utilizator — profil, istoric, limitări fizice, obiective
2. Îți amintești TOT ce s-a discutat vreodată — și probleme rezolvate, și în curs
3. Urmărești progresul REAL în timp — kg, cm abdomen, % respectare dietă
4. Dai sfaturi CONCRETE, personalizate, bazate pe știință și pe ISTORICUL LUI SPECIFIC
5. Cauți pe internet în timp real și filtrezi prin prisma profilului său
6. Știi limitările fizice și dai exerciții SIGURE pentru vârsta și condiția sa

${profilText}
${memoryText}
${jurnalText}
${progresText}
${statsText}
${reteteText}

REGULI DE AUR:
- Fii SPECIFIC — menționează date reale din istoricul utilizatorului când sunt relevante
- NICIODATĂ sfaturi generice — întotdeauna personalizate pe profilul și istoricul său
- Dacă găsești pe web ceva relevant DAR care contrazice ce știi despre el → spune-i explicit
- Pentru sport: NICIODATĂ exerciții care implică alergat, genuflexiuni grele, ridicări de greutăți mari — adaptează pentru genunchi sensibili și spate neantrenat
- Răspunde ÎNTOTDEAUNA în română
- Când calculezi apa: 35ml/kg greutate corporală + 200ml extra pentru fiecare gram de sare peste 2g/zi
- Când menționezi progresul: fii încurajator dar realist`;

  if (tip === "jurnal") {
    systemPrompt += `

TASK JURNAL — CALCUL COMPLET NUTRIȚIONAL:
Calculează pentru FIECARE aliment menționat și oferă un tabel complet.

Valori de referință pentru produse fără gramaj specificat:
- Ou: 60g | Măr mediu: 180g | Pară: 170g | Banană: 120g | Portocală: 150g
- Felie pâine: 30g | Lingură ulei: 10g | Linguriță sare: 5g | Cană lapte: 240ml
- Pentru produse românești de marcă (Savoria, Napolact, etc.) → caută valorile exacte online

FORMAT OBLIGATORIU:

**[Tip masă] — [Ora]**

| Aliment | Cantitate | kcal | Proteine | Carbohidrați | Zahăr | Grăsimi | Sare |
|---------|-----------|------|----------|--------------|-------|---------|------|
| [nume] | [g/buc] | X | Xg | Xg | Xg | Xg | Xg |

📊 **TOTAL MASĂ:**
- Calorii: X kcal (din targetul de ${profil?.calorii || 1600} kcal/zi)
- Proteine: Xg | Carbohidrați: Xg | Zahăr: Xg | Grăsimi: Xg | **Sare: Xg**

💧 **APĂ RECOMANDATĂ după această masă:** X ml
(Calculat: ${profil?.greutate || 80}kg × 35ml + extra pentru sare consumată)

⚠️ **Observație:** [dacă sarea e mare → explică cum să elimine apa reținută: hidratare, mișcare ușoară, alimente diuretice naturale]

**Cum se încadrează în obiectivele tale:** [comentariu personalizat bazat pe istoricul și obiectivele sale]`;
  } else if (tip === "plan") {
    systemPrompt += `

TASK PLAN ALIMENTAR SĂPTĂMÂNAL — NIVEL EXCELENȚĂ:
Generează plan complet 7 zile cu rețete DETALIATE.

Pentru FIECARE masă:
- Ingrediente cu gramaje EXACTE în grame
- Mod de preparare PAS CU PAS (pentru un începător absolut)
- Timpi EXACȚI de gătire și temperaturi
- Sfaturi practice ("usucă carnea cu hârtie înainte", "nu pune capac la tigaie dacă vrei crustă")
- Tabel nutrițional complet: kcal | Proteine | Carbohidrați | Zahăr | Grăsimi | Sare
- Total calorii + macro-uri pe zi
- Recomandare apă zilnică bazată pe sarea totală din ziua respectivă

Respectă STRICT: ${profil?.calorii || 1600} kcal/zi, ${profil?.restrictii || "fără gluten, low-carb"}`;
  } else if (tip === "sport") {
    systemPrompt += `

TASK PLAN SPORT PERSONALIZAT:
Creează un plan sport PROGRESIV și SIGUR pentru:
- Vârstă: 44 ani, stil de viață sedentar până acum
- Limitări: genunchi sensibili (nu poate alerga, genuflexiuni dor), spate neantrenat (doare la exerciții intense)
- Obiective: slăbire + tonifiere + întărire abdomen + formă fizică mai bună
- Echipament: acasă, fără echipament special

PRINCIPII:
- Începe FOARTE UȘOR — săptămâna 1 max 15-20 minute/zi
- Progresie graduală pe 3-6 luni
- Prioritate: articulații protejate, spate întărit treptat
- Include: stretching, tai-chi, yoga, mers pe jos progresiv, înot dacă e disponibil
- Exerciții abdomen SAFE: plank pe genunchi, contracții izometrice, exerciții în poziție culcat
- Explică EXACT cum se execută fiecare exercițiu și ce mușchi lucrează
- Menționează semnalele de alarmă (când să se oprească)`;
  } else if (tip === "rezumat") {
    systemPrompt = `Ești un sistem de memorie AI. Analizează această conversație și creează un rezumat CONCIS și UTIL (max 4-5 fraze) care să conțină:
- Subiectele principale discutate
- Deciziile sau planurile stabilite
- Informații personale importante menționate (greutate, simptome, alimente, etc.)
- Dacă o problemă a fost rezolvată sau e în curs
- Orice detaliu specific care ar fi util în conversații viitoare (ex: "utilizatorul a spus că pune 100ml lapte în cafea")
Răspunde DOAR cu rezumatul, fără titlu sau introducere.`;
  } else if (tip === "idei_zilnice") {
    systemPrompt += `

TASK IDEI ZILNICE PERSONALIZATE:
Generează 5 idei concrete pentru ziua de azi, bazate pe:
- Progresul recent al utilizatorului
- Ce a mâncat recent (din jurnal)
- Obiectivele sale specifice
- Limitările fizice

Format:
🥗 **Nutriție:** [idee concretă cu cifre]
🏃 **Mișcare:** [exercițiu SAFE pentru genunchi/spate, cu durată exactă]
💧 **Hidratare:** [cantitate specifică bazată pe greutate și sare consumată]
🧘 **Wellbeing:** [idee pentru stres, somn, recuperare]
💡 **Sfat zilnic:** [observație personalizată din istoricul său]`;
  }

  const tools = [{ type: "web_search_20250305", name: "web_search" }];

  const body = {
    model: "claude-sonnet-4-6",
    max_tokens: tip === "plan" ? 4000 : tip === "sport" ? 3000 : 2000,
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
