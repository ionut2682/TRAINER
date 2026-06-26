export async function POST(req) {
  const { messages, profil } = await req.json();

  const profilText = profil ? `
PROFILUL UTILIZATORULUI:
- Nume: ${profil.nume || "Marius"}
- Vârstă: ${profil.varsta || "nespecificată"}
- Greutate: ${profil.greutate || "nespecificată"} kg
- Înălțime: ${profil.inaltime || "nespecificată"} cm
- Obiectiv principal: ${profil.obiectiv || "scădere în greutate"}
- Obiectiv specific: ${profil.obiectivSpecific || "scăderea circumferinței abdomenului cu 8 cm"}
- Tratamente estetice: ${profil.tratamente || "criolipoliză 3 ședințe la interval de o lună"}
- Calorii zilnice țintă: ${profil.calorii || "1600"} kcal
- Restricții alimentare: ${profil.restrictii || "fără gluten, fără carbohidrați rafinați, low-carb"}
- Nivel activitate fizică: ${profil.activitate || "moderat"}
- Echipament sport disponibil: ${profil.echipament || "acasă, fără echipament"}
- Timp disponibil sport: ${profil.timpSport || "30 minute/zi"}
- Alte informații: ${profil.altele || ""}
` : `
PROFILUL UTILIZATORULUI:
- Nume: Marius
- Obiectiv: scăderea circumferinței abdomenului cu 8 cm
- Tratamente: criolipoliză 3 ședințe la interval de o lună
- Calorii: ~1600 kcal/zi
- Dietă: fără gluten, fără carbohidrați rafinați, low-carb
`;

  const systemPrompt = `Ești un agent personal de nutriție și sport.

${profilText}

Poți face:
1. REȚETĂ - generezi rețete din ingrediente disponibile, adaptate profilului
2. PLAN ZI - plan complet de mese pentru o zi (mic dejun, prânz, cină, gustări)
3. MACRO-URI - calculezi proteine/grăsimi/carbohidrați/calorii
4. PLAN SPORT - exerciții ușoare/moderate adaptate obiectivului de slăbire abdominală
5. SFATURI - sfaturi personalizate bazate pe obiectivele și tratamentele utilizatorului

Format răspuns:
- Include mereu tabelul de macro-uri când dai rețete (Proteine | Grăsimi | Carbohidrați | Calorii)
- Pași numerotați clari
- Cantități în grame
- Limbă română
- Răspunsuri concise și practice
- Când dai plan sport, menționează că exercițiile abdominale ajută circulația după criolipoliză`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system: systemPrompt,
      messages,
    }),
  });

  const data = await response.json();
  const text = data.content?.map((b) => b.text || "").join("") || "Eroare.";
  return Response.json({ reply: text });
}
