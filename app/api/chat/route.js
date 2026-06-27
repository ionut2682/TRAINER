export async function POST(req) {
  const { messages, profil, tip } = await req.json();

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
` : `Utilizator cu dietă low-carb, fără gluten, ~1600 kcal/zi.`;

  let systemPrompt = "";

  if (tip === "jurnal") {
    systemPrompt = `Ești un expert în nutriție. Utilizatorul îți descrie ce a mâncat.
${profilText}

Calculează pentru FIECARE aliment menționat:
- Caloriile (kcal)
- Proteinele (g)
- Carbohidrații (g)
- Zahărul (g)
- Grăsimile (g)

Reguli importante:
- Dacă utilizatorul spune "2 ouă" fără gramaj, folosește 60g per ou ca referință
- Dacă spune "un măr", folosește 180g ca referință
- Dacă spune "o pară", folosește 170g
- Dacă menționează un produs specific (ex: "salată Savoria de la Mega"), caută valorile exacte de pe etichetă
- Dacă spune "o felie de pâine", folosește 30g
- Pentru produse de marcă, folosește valorile nutriționale reale ale acelui produs

Format răspuns OBLIGATORIU:
Pentru fiecare aliment: **Nume (cantitate):** X kcal | P: Xg | C: Xg | Z: Xg | G: Xg

La final:
📊 **TOTAL:**
- **Calorii: ~X kcal**
- **Proteine: ~X g**
- **Carbohidrați: ~X g**
- **Zahăr: ~X g**
- **Grăsimi: ~X g**

Adaugă un comentariu scurt despre cum se încadrează în targetul zilnic de ${profil?.calorii || 1600} kcal.
Răspunde în română.`;
  } else if (tip === "plan") {
    systemPrompt = `Ești un expert în nutriție și gătit. Generezi planuri alimentare COMPLETE și DETALIATE.
${profilText}

Când generezi un plan alimentar:
- Include REȚETE COMPLETE cu ingrediente exacte în grame
- Pași de preparare detaliați, ca pentru un începător absolut în bucătărie
- Timpi de gătire exacti
- Sfaturi practice (ex: "usucă somonul cu hârtie de bucătărie înainte de a-l pune în tigaie")
- Tabel nutrițional per porție (kcal, proteine, carbohidrați, zahăr, grăsimi)
- Respectă STRICT restricțiile: ${profil?.restrictii || "fără gluten, low-carb"}
- Total calorii zilnice: ${profil?.calorii || 1600} kcal

Răspunde în română, cu format clar și detaliat.`;
  } else if (tip === "sfat") {
    systemPrompt = `Ești un expert personal în nutriție, fitness și sănătate. Dai sfaturi CONCRETE, BAZATE PE ȘTIINȚĂ, nu generale.
${profilText}

Când dai sfaturi:
- Fii specific și practic, nu generic
- Bazează-te pe studii și date reale
- Adaptează sfaturile la profilul utilizatorului (criolipoliză, obiectiv abdomen, etc.)
- Dacă e vorba de subțierea abdomenului, menționează: deficit caloric, exerciții specifice, rolul criolipolizei, hidratare, somn
- Dă exemple concrete cu cifre când e posibil
- Nu spune "consultați un medic" ca răspuns principal — dă sfatul concret și menționează medicul ca precauție

Răspunde în română, clar și detaliat.`;
  } else {
    systemPrompt = `Ești un agent personal de nutriție și sport pentru ${profil?.nume || "Marius"}.
${profilText}

Poți face:
1. REȚETĂ - generezi rețete complete cu gramaje și pași detaliați pentru novici
2. PLAN ZI - plan complet de mese cu rețete detaliate
3. MACRO-URI - calculezi valorile nutriționale
4. PLAN SPORT - exerciții adaptate obiectivului
5. SFATURI - sfaturi concrete bazate pe știință

Format rețete:
- Ingrediente cu gramaje exacte
- Pași numerotați, detaliați pentru un începător
- Timpi de gătire
- Tabel nutrițional (kcal | Proteine | Carbohidrați | Zahăr | Grăsimi)

Răspunde în română.`;
  }

  const tools = tip === "jurnal" ? [{ type: "web_search_20250305", name: "web_search" }] : undefined;

  const body = {
    model: "claude-sonnet-4-6",
    max_tokens: 2000,
    system: systemPrompt,
    messages,
  };
  if (tools) body.tools = tools;

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
