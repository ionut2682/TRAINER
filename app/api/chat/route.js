export async function POST(req) {
  const { messages, profil, tip, context } = await req.json();

  const profilText = profil ? `
PROFILUL COMPLET:
- Nume: ${profil.nume || "Marius"}, VĂ˘rstÄ: ${profil.varsta || 44} ani
- Greutate: ${profil.greutate || "?"} kg, ĂŽnÄlČ›ime: ${profil.inaltime || "?"} cm
- Obiectiv: ${profil.obiectivSpecific || "scÄderea circumferinČ›ei abdomenului cu 8 cm"}
- Tratamente: ${profil.tratamente || "criolipolizÄ 3 Č™edinČ›e"}
- Calorii Č›intÄ: ${profil.calorii || 1600} kcal/zi
- RestricČ›ii: ${profil.restrictii || "fÄrÄ gluten, low-carb"}
- Activitate: ${profil.activitate || "sedentar"}
- Echipament: ${profil.echipament || "acasÄ, fÄrÄ echipament"}
- Timp sport: ${profil.timpSport || "30 min/zi"}
- LimitÄri fizice: genunchi sensibili (nu poate alerga, genuflexiuni dor), spate neantrenat, 44 ani â€” program PROGRESIV Č™i BLĂ‚ND
- Alte info: ${profil.altele || ""}` : "Utilizator 44 ani, low-carb fÄrÄ gluten, ~1600 kcal/zi, limitÄri genunchi Č™i spate.";

  const memoryText = context?.memory?.length > 0 ? `
MEMORIA PE TERMEN LUNG (foloseČ™te activ):
${context.memory.slice(0, 25).map((m, i) => `${i+1}. [${m.tip || "conv"}${m.rezolvat ? " âś“REZOLVAT" : ""}] ${m.content}`).join("\n")}` : "";

  const jurnalText = context?.jurnal?.length > 0 ? `
JURNAL RECENT (ultimele mese):
${context.jurnal.slice(0, 15).map(j => `- ${j.data} [${j.tip_masa}]: ${j.item || ""} | ${j.calorii || 0}kcal P:${j.proteine||0}g C:${j.carbohidrati||0}g G:${j.grasimi||0}g`).join("\n")}` : "";

  const progresText = context?.progres?.length > 0 ? (() => {
    const p = context.progres;
    const prima = p[0]; const ultima = p[p.length - 1];
    const dKg = prima?.greutate && ultima?.greutate ? (ultima.greutate - prima.greutate).toFixed(1) : null;
    const dCm = prima?.abdomen && ultima?.abdomen ? (ultima.abdomen - prima.abdomen).toFixed(1) : null;
    return `
PROGRES REAL:
- Greutate: ${prima?.greutate || "?"}kg â†’ ${ultima?.greutate || "?"}kg ${dKg ? `(${parseFloat(dKg)<0?"slÄbit":"luat"} ${Math.abs(dKg)}kg)` : ""}
- Abdomen: ${prima?.abdomen || "?"}cm â†’ ${ultima?.abdomen || "?"}cm ${dCm ? `(${parseFloat(dCm)<0?"redus":"crescut"} ${Math.abs(dCm)}cm)` : ""}`;
  })() : "";

  const statsText = context?.stats ? `
STATISTICI DIETÄ‚: ${context.stats.zileCuJurnal} zile jurnal, medie ${context.stats.medieCalorii} kcal/zi` : "";

  const reteteText = context?.retete?.length > 0 ? `
REČšETE PROPRII (foloseČ™te cĂ˘nd dai recomandÄri):
${context.retete.map(r => `- "${r.nume}": ${r.continut?.slice(0, 100)}...`).join("\n")}` : "";

  let systemPrompt = `EČ™ti agentul personal de nutriČ›ie Č™i sport al lui ${profil?.nume || "Marius"}.
E™ti SUPERIOR Google AI pe nutriČ›ie personalizatÄ pentru cÄ Ă®l cunoČ™ti complet Č™i Ă®Č›i aminteČ™ti TOT.

${profilText}
${memoryText}
${jurnalText}
${progresText}
${statsText}
${reteteText}

REGULI DE AUR:
- RÄspunde ĂŽNTOTDEAUNA Ă®n romĂ˘nÄ
- Fii SPECIFIC cu date reale din istoricul utilizatorului
- Pentru sport: NICIODATÄ‚ alergat, genuflexiuni grele â€” adapteazÄ pentru genunchi sensibili Č™i spate neantrenat
- CalculeazÄ apa: (${profil?.greutate || 80}kg Ă— 35ml) + (200ml Ă— fiecare gram sare peste 2g/zi)
- ReferÄ-te la conversaČ›ii anterioare cĂ˘nd sunt relevante`;

  if (tip === "jurnal") {
    systemPrompt += `

TASK JURNAL â€” CALCUL COMPLET:
CalculeazÄ pentru FIECARE aliment Č™i oferÄ tabelul complet.

ReferinČ›e fÄrÄ gramaj: ou=60g, mÄr=180g, parÄ=170g, bananÄ=120g, felie pĂ˘ine=30g, lingurÄ ulei=10g
Pentru produse romĂ˘neČ™ti de marcÄ â†’ cautÄ online valorile exacte.

FORMAT OBLIGATORIU:

| Aliment | Cantitate | kcal | Proteine | CarbohidraČ›i | ZahÄr | GrÄsimi | Sare |
|---------|-----------|------|----------|--------------|-------|---------|------|
| ... | ... | ... | ... | ... | ... | ... | ... |

đź“Š **TOTAL:**
- **Calorii: ~X kcal** (din targetul de ${profil?.calorii || 1600} kcal/zi)
- **Proteine: ~Xg | CarbohidraČ›i: ~Xg | ZahÄr: ~Xg | GrÄsimi: ~Xg | Sare: ~Xg**

đź’§ **APÄ‚ RECOMANDATÄ‚:** X ml
âš ď¸Ź **ObservaČ›ie personalizatÄ:** [bazatÄ pe istoricul Č™i obiectivele utilizatorului]`;
  } else if (tip === "plan") {
    systemPrompt += `

TASK PLAN ALIMENTAR â€” NIVEL EXCELENČšÄ‚:
7 zile complete. Pentru FIECARE masÄ:
- Ingrediente cu gramaje EXACTE
- PaČ™i de preparare DETALIAČšI pentru un Ă®ncepÄtor absolut
- Timpi exacČ›i Č™i temperaturi
- Sfaturi practice specifice
- Tabel: kcal | Proteine | CarbohidraČ›i | ZahÄr | GrÄsimi | Sare
- ApÄ recomandatÄ pe zi
- Total macro-uri zilnice`;
  } else if (tip === "sport") {
    systemPrompt += `

TASK SPORT â€” ADAPTAT LIMITÄ‚RILOR:
Plan PROGRESIV Č™i SIGUR. Čšine cont de:
- 44 ani, stil sedentar, genunchi sensibili, spate neantrenat
- NICIODATÄ‚: alergat, genuflexiuni cu greutÄČ›i, exerciČ›ii cu impact mare
- Include: tai-chi, stretching, yoga blĂ˘nd, mers progresiv, exerciČ›ii Ă®n Č™ezut/culcat
- ExplicÄ EXACT cum se executÄ fiecare exerciČ›iu
- MenČ›ioneazÄ semnale de alarmÄ (cĂ˘nd sÄ se opreascÄ)
- Plan pe 3 luni cu progresie gradualÄ`;
  } else if (tip === "idei_zilnice") {
    systemPrompt += `

TASK IDEI ZILNICE:
5 idei concrete pentru azi, bazate pe istoricul Č™i progresul real:

đźĄ— **NutriČ›ie:** [idee specificÄ cu cifre]
đźŹ **MiČ™care:** [exerciČ›iu SAFE pentru genunchi/spate, cu duratÄ exactÄ]
đź’§ **Hidratare:** [cantitate specificÄ bazatÄ pe greutate Č™i sare consumatÄ ieri]
đź§ **Wellbeing:** [somn, stres, recuperare]
đź’ˇ **Sfat zilnic:** [observaČ›ie personalizatÄ din istoricul sÄu specific]`;
  } else if (tip === "rezumat") {
    systemPrompt = `CreeazÄ un rezumat CONCIS (3-4 fraze) al acestei conversaČ›ii pentru memorie pe termen lung. Include: subiecte principale, decizii luate, informaČ›ii personale importante, dacÄ o problemÄ e rezolvatÄ sau Ă®n curs. RÄspunde DOAR cu rezumatul, fÄrÄ introducere.`;
  }

  const body = {
    model: "claude-sonnet-4-6",
    max_tokens: tip === "plan" ? 4000 : tip === "sport" ? 3000 : 2000,
    system: systemPrompt,
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
  if (data.error) { console.error("API error:", data.error); return Response.json({ reply: "Eroare API: " + data.error.message }); }
  const text = data.content?.filter(b => b.type === "text").map(b => b.text).join("") || "Eroare la rÄspuns.";
  return Response.json({ reply: text });
}
