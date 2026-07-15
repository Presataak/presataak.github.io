import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Initialize Gemini client lazily to avoid crashing on startup if key is missing!
  let aiClient: GoogleGenAI | null = null;
  function getAiClient() {
    if (!aiClient) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (apiKey) {
        aiClient = new GoogleGenAI({
          apiKey: apiKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            }
          }
        });
      }
    }
    return aiClient;
  }

  // API endpoint for country details
  app.post("/api/country-details", async (req, res) => {
    const { countryCode, dutchName, englishName } = req.body;
    if (!dutchName || !englishName) {
      return res.status(400).json({ error: "Missing country names" });
    }

    // Default fallbacks based on country code for all 51 countries in the game!
    const fallbacks: Record<string, { continent: string; temperature: string; location: string; size: string; funFact: string }> = {
      NLD: { continent: "Europa", temperature: "koud", location: "in het midden", size: "klein (kleiner dan 500.000 km²)", funFact: "Wist je dat een derde van Nederland onder de zeespiegel ligt?" },
      DEU: { continent: "Europa", temperature: "koud", location: "in het midden", size: "klein (kleiner dan 500.000 km²)", funFact: "Wist je dat Duitsland meer dan 20.000 kastelen heeft?" },
      FRA: { continent: "Europa", temperature: "warm", location: "in het midden", size: "middelmatig (500.000 km² tot 2.000.000 km²)", funFact: "Wist je dat Frankrijk het meest bezochte land ter wereld is?" },
      BEL: { continent: "Europa", temperature: "koud", location: "in het midden", size: "klein (kleiner dan 500.000 km²)", funFact: "Wist je dat België de meeste kastelen per vierkante kilometer heeft?" },
      ESP: { continent: "Europa", temperature: "warm", location: "in het midden", size: "middelmatig (500.000 km² tot 2.000.000 km²)", funFact: "Wist je dat Spanje de enige echte woestijn van Europa heeft?" },
      ITA: { continent: "Europa", temperature: "warm", location: "in het midden", size: "klein (kleiner dan 500.000 km²)", funFact: "Wist je dat Italië drie actieve vulkanen heeft, waaronder de Etna?" },
      GBR: { continent: "Europa", temperature: "koud", location: "in het midden", size: "klein (kleiner dan 500.000 km²)", funFact: "Wist je dat je in het Verenigd Koninkrijk nergens meer dan 120 km van zee bent?" },
      PRT: { continent: "Europa", temperature: "warm", location: "in het midden", size: "klein (kleiner dan 500.000 km²)", funFact: "Wist je dat de oudste boekwinkel ter wereld in Lissabon (Portugal) staat?" },
      DNK: { continent: "Europa", temperature: "koud", location: "in het midden", size: "klein (kleiner dan 500.000 km²)", funFact: "Wist je dat Denemarken geen bergen heeft en het hoogste punt maar 170 meter is?" },
      NOR: { continent: "Europa", temperature: "koud", location: "in het midden", size: "klein (kleiner dan 500.000 km²)", funFact: "Wist je dat de langste autotunnel ter wereld (24,5 km) in Noorwegen ligt?" },
      SWE: { continent: "Europa", temperature: "koud", location: "in het midden", size: "klein (kleiner dan 500.000 km²)", funFact: "Wist je dat Zweden meer eilanden heeft dan welk ander land ter wereld ook?" },
      FIN: { continent: "Europa", temperature: "koud", location: "in het midden", size: "klein (kleiner dan 500.000 km²)", funFact: "Wist je dat Finland de meeste sauna's ter wereld heeft, wel bijna drie miljoen?" },
      POL: { continent: "Europa", temperature: "koud", location: "in het midden", size: "klein (kleiner dan 500.000 km²)", funFact: "Wist je dat Polen het grootste kasteel ter wereld heeft, het kasteel van Malbork?" },
      CHE: { continent: "Europa", temperature: "koud", location: "in het midden", size: "klein (kleiner dan 500.000 km²)", funFact: "Wist je dat het in Zwitserland verboden is om slechts één cavia te bezitten?" },
      AUT: { continent: "Europa", temperature: "koud", location: "in het midden", size: "klein (kleiner dan 500.000 km²)", funFact: "Wist je dat de oudste nog bestaande dierentuin ter wereld in Wenen staat?" },
      GRC: { continent: "Europa", temperature: "warm", location: "in het midden", size: "klein (kleiner dan 500.000 km²)", funFact: "Wist je dat Griekenland meer dan 2.000 prachtige eilanden heeft?" },
      TUR: { continent: "Europa", temperature: "warm", location: "in het midden", size: "middelmatig (500.000 km² tot 2.000.000 km²)", funFact: "Wist je dat de stad Istanbul in twee werelddelen tegelijk ligt: Europa en Azië?" },
      RUS: { continent: "Europa", temperature: "koud", location: "rechts", size: "groot (2.000.000 km² of groter)", funFact: "Wist je dat Rusland groter is dan de dwergplaneet Pluto?" },
      USA: { continent: "Noord-Amerika", temperature: "warm", location: "links", size: "groot (2.000.000 km² of groter)", funFact: "Wist je dat de Verenigde Staten geen officiële nationale taal hebben?" },
      CAN: { continent: "Noord-Amerika", temperature: "koud", location: "links", size: "groot (2.000.000 km² of groter)", funFact: "Wist je dat Canada meer meren heeft dan alle andere landen op aarde samen?" },
      MEX: { continent: "Noord-Amerika", temperature: "warm", location: "links", size: "middelmatig (500.000 km² tot 2.000.000 km²)", funFact: "Wist je dat de grootste piramide ter wereld niet in Egypte staat, maar in Mexico?" },
      BRA: { continent: "Zuid-Amerika", temperature: "warm", location: "links", size: "groot (2.000.000 km² of groter)", funFact: "Wist je dat Brazilië grenst aan bijna elk land in Zuid-Amerika behalve twee?" },
      ARG: { continent: "Zuid-Amerika", temperature: "warm", location: "links", size: "groot (2.000.000 km² of groter)", funFact: "Wist je dat de breedste straat ter wereld (Avenida 9 de Julio) in Buenos Aires ligt?" },
      COL: { continent: "Zuid-Amerika", temperature: "warm", location: "links", size: "middelmatig (500.000 km² tot 2.000.000 km²)", funFact: "Wist je dat Colombia de grootste producent is van prachtige smaragden ter wereld?" },
      CHL: { continent: "Zuid-Amerika", temperature: "warm", location: "links", size: "middelmatig (500.000 km² tot 2.000.000 km²)", funFact: "Wist je dat Chili het smalste en langste land ter wereld is?" },
      ZAF: { continent: "Afrika", temperature: "warm", location: "in het midden", size: "middelmatig (500.000 km² tot 2.000.000 km²)", funFact: "Wist je dat Zuid-Afrika wel drie verschillende officiële hoofdsteden heeft?" },
      EGY: { continent: "Afrika", temperature: "warm", location: "in het midden", size: "middelmatig (500.000 km² tot 2.000.000 km²)", funFact: "Wist je dat de oude Egyptenaren kussens van steen gebruikten?" },
      MAR: { continent: "Afrika", temperature: "warm", location: "in het midden", size: "klein (kleiner dan 500.000 km²)", funFact: "Wist je dat de oudste universiteit ter wereld in Fez, Marokko, staat?" },
      KEN: { continent: "Afrika", temperature: "warm", location: "in het midden", size: "middelmatig (500.000 km² tot 2.000.000 km²)", funFact: "Wist je dat in Kenia de 'Big Five' wilde dieren heel gemakkelijk te spotten zijn?" },
      NGA: { continent: "Afrika", temperature: "warm", location: "in het midden", size: "middelmatig (500.000 km² tot 2.000.000 km²)", funFact: "Wist je dat Nigeria de grootste filmindustrie van Afrika heeft, genaamd Nollywood?" },
      CHN: { continent: "Azië", temperature: "warm", location: "rechts", size: "groot (2.000.000 km² of groter)", funFact: "Wist je dat de Chinese Muur meer dan 21.000 kilometer lang is?" },
      IND: { continent: "Azië", temperature: "warm", location: "rechts", size: "groot (2.000.000 km² of groter)", funFact: "Wist je dat India de grootste producent van specerijen ter wereld is?" },
      JPN: { continent: "Azië", temperature: "warm", location: "rechts", size: "klein (kleiner dan 500.000 km²)", funFact: "Wist je dat Japan uit meer dan 6.800 eilanden bestaat?" },
      KOR: { continent: "Azië", temperature: "warm", location: "rechts", size: "klein (kleiner dan 500.000 km²)", funFact: "Wist je dat in Zuid-Korea baby's bij de geboorte al één jaar oud worden genoemd?" },
      IDN: { continent: "Azië", temperature: "warm", location: "rechts", size: "middelmatig (500.000 km² tot 2.000.000 km²)", funFact: "Wist je dat Indonesië de grootste eilandenstaat ter wereld is met ruim 17.000 eilanden?" },
      AUS: { continent: "Oceanië", temperature: "warm", location: "rechts", size: "groot (2.000.000 km² of groter)", funFact: "Wist je dat er in Australië meer kangoeroes dan mensen wonen?" },
      NZL: { continent: "Oceanië", temperature: "warm", location: "rechts", size: "klein (kleiner dan 500.000 km²)", funFact: "Wist je dat Nieuw-Zeeland het eerste land was waar vrouwen mochten stemmen?" },
      KAZ: { continent: "Azië", temperature: "koud", location: "rechts", size: "groot (2.000.000 km² of groter)", funFact: "Wist je dat de grootste ruimtehaven ter wereld (Baikonur) in Kazachstan ligt?" },
      SAU: { continent: "Azië", temperature: "warm", location: "rechts", size: "groot (2.000.000 km² of groter)", funFact: "Wist je dat Saoedi-Arabië het grootste land ter wereld is zonder een permanente river?" },
      IRN: { continent: "Azië", temperature: "warm", location: "rechts", size: "middelmatig (500.000 km² tot 2.000.000 km²)", funFact: "Wist je dat Iran een van de oudste ononderbroken beschavingen ter wereld heeft?" },
      IRQ: { continent: "Azië", temperature: "warm", location: "rechts", size: "klein (kleiner dan 500.000 km²)", funFact: "Wist je dat het oudste bekende schrift ter wereld (spijkerschrift) is uitgevonden in Irak?" },
      UKR: { continent: "Europa", temperature: "koud", location: "in het midden", size: "middelmatig (500.000 km² tot 2.000.000 km²)", funFact: "Wist je dat de diepste metrohalte ter wereld (105,5 meter diep) in Kiev ligt?" },
      ISL: { continent: "Europa", temperature: "koud", location: "in het midden", size: "klein (kleiner dan 500.000 km²)", funFact: "Wist je dat IJsland geen muggen heeft en dat er bijna geen bossen zijn?" },
      GRL: { continent: "Noord-Amerika", temperature: "koud", location: "links", size: "groot (2.000.000 km² of groter)", funFact: "Wist je dat Groenland het grootste eiland ter wereld is, maar bijna helemaal bedekt is met ijs?" },
      MDG: { continent: "Afrika", temperature: "warm", location: "in het midden", size: "middelmatig (500.000 km² tot 2.000.000 km²)", funFact: "Wist je dat 90% van de planten en dieren op Madagaskar nergens anders op aarde voorkomen?" },
      MNG: { continent: "Azië", temperature: "koud", location: "rechts", size: "middelmatig (500.000 km² tot 2.000.000 km²)", funFact: "Wist je dat Mongolië het dunst bevolkte onafhankelijke land ter wereld is?" },
      THA: { continent: "Azië", temperature: "warm", location: "rechts", size: "middelmatig (500.000 km² tot 2.000.000 km²)", funFact: "Wist je dat Thailand het enige Zuidoost-Aziatische land is dat nooit door Europeanen is gekoloniseerd?" },
      VNM: { continent: "Azië", temperature: "warm", location: "rechts", size: "klein (kleiner dan 500.000 km²)", funFact: "Wist je dat Vietnam de grootste exporteur van cashewnoten ter wereld is?" },
      MYS: { continent: "Azië", temperature: "warm", location: "rechts", size: "klein (kleiner dan 500.000 km²)", funFact: "Wist je dat de Petronas Towers in Maleisië ooit de hoogste gebouwen ter wereld waren?" },
      PHL: { continent: "Azië", temperature: "warm", location: "rechts", size: "klein (kleiner dan 500.000 km²)", funFact: "Wist je dat de Filipijnen bestaat uit 7.641 eilanden en superveel mooie stranden heeft?" },
      PAK: { continent: "Azië", temperature: "warm", location: "rechts", size: "middelmatig (500.000 km² tot 2.000.000 km²)", funFact: "Wist je dat de hoogste verharde internationale weg ter wereld (Karakoram Highway) in Pakistan ligt?" }
    };

    const fallback = fallbacks[countryCode] || {
      continent: "Europa",
      temperature: "gematigd",
      location: "in het midden",
      size: "middelmatig (500.000 km² tot 2.000.000 km²)",
      funFact: `Wist je dat ${dutchName} een prachtig land is om te ontdekken!`
    };

    const ai = getAiClient();
    if (!ai) {
      console.log("No GEMINI_API_KEY found or server starting. Serving high-quality offline fallbacks.");
      return res.json({ ...fallback, source: "fallback" });
    }

    try {
      const promptText = `Using the Google Maps grounding tool, find detailed and accurate geographical information for the country "${englishName}" (also known as "${dutchName}" in Dutch).
Provide the response strictly in the following format, with each field on a new line. Do not include any markdown formatting, asterisks, or other text before or after this format:

Continent: [write the continent in Dutch, e.g., Europa, Azië, Noord-Amerika, Zuid-Amerika, Afrika, Oceanië]
Temperatuur: [write 'warm' or 'koud' based on average climate in Dutch]
Locatie: [write 'links', 'rechts', or 'in het midden' representing its relative horizontal position on a standard flat world map centered on Europe/Africa]
Grootte: [classify strictly by the country's actual surface area: 'klein (kleiner dan 500.000 km²)' if 499999 km2 and lower, 'middelmatig (500.000 km² tot 2.000.000 km²)' if 500000 km2 and higher, 'groot (2.000.000 km² of groter)' if 2000000 km2 and higher]
Weetje: [write an extremely short, simple, engaging, unique fun fact (maximum 15 words) for an 11-13 year old student in Dutch, starting with 'Wist je dat...']`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: promptText,
        config: {
          tools: [{ googleMaps: {} }]
        }
      });

      const text = response.text || "";
      console.log("Gemini raw response with Maps grounding:", text);

      const lines = text.split("\n");
      let continent = "";
      let temperature = "";
      let location = "";
      let size = "";
      let funFact = "";

      for (const line of lines) {
        const cleanLine = line.trim();
        const lowerLine = cleanLine.toLowerCase();
        if (lowerLine.startsWith("continent:")) {
          continent = cleanLine.substring("continent:".length).trim();
        } else if (lowerLine.startsWith("temperatuur:")) {
          temperature = cleanLine.substring("temperatuur:".length).trim();
        } else if (lowerLine.startsWith("locatie:")) {
          location = cleanLine.substring("locatie:".length).trim();
        } else if (lowerLine.startsWith("grootte:")) {
          size = cleanLine.substring("grootte:".length).trim();
        } else if (lowerLine.startsWith("weetje:")) {
          funFact = cleanLine.substring("weetje:".length).trim();
        }
      }

      // Parse with regex if exact prefix fails
      if (!continent) {
        const match = text.match(/Continent:\s*([^\n]+)/i);
        if (match) continent = match[1].trim();
      }
      if (!temperature) {
        const match = text.match(/Temperatuur:\s*([^\n]+)/i);
        if (match) temperature = match[1].trim();
      }
      if (!location) {
        const match = text.match(/Locatie:\s*([^\n]+)/i);
        if (match) location = match[1].trim();
      }
      if (!size) {
        const match = text.match(/Grootte:\s*([^\n]+)/i);
        if (match) size = match[1].trim();
      }
      if (!funFact) {
        const match = text.match(/Weetje:\s*([^\n]+)/i);
        if (match) funFact = match[1].trim();
      }

      // Format outputs to match required Dutch text exactly
      continent = continent || fallback.continent;
      temperature = temperature || fallback.temperature;
      location = location || fallback.location;
      size = size || fallback.size;
      funFact = funFact || fallback.funFact;

      // Ensure some cleaning
      if (temperature.toLowerCase().includes("warm")) temperature = "warm";
      else if (temperature.toLowerCase().includes("koud")) temperature = "koud";

      if (location.toLowerCase().includes("midden")) location = "in het midden";
      else if (location.toLowerCase().includes("links")) location = "links";
      else if (location.toLowerCase().includes("rechts")) location = "rechts";

      if (size.toLowerCase().includes("klein") || size.toLowerCase().includes("499") || size.toLowerCase().includes("lower") || size.toLowerCase().includes("minder")) {
        size = "klein (kleiner dan 500.000 km²)";
      } else if (size.toLowerCase().includes("groot") || size.toLowerCase().includes("2.000.000") || size.toLowerCase().includes("2000000") || size.toLowerCase().includes("higher") || size.toLowerCase().includes("groter")) {
        size = "groot (2.000.000 km² of groter)";
      } else {
        size = "middelmatig (500.000 km² tot 2.000.000 km²)";
      }

      // Extract maps URLs from grounding chunks to meet requirements!
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const sources: Array<{ title: string; url: string }> = [];
      for (const chunk of groundingChunks) {
        if (chunk.web?.uri) {
          sources.push({
            title: chunk.web.title || "Informatiebron",
            url: chunk.web.uri
          });
        }
      }

      return res.json({
        continent,
        temperature,
        location,
        size,
        funFact,
        sources,
        source: "gemini"
      });

    } catch (err: any) {
      const errMsg = err?.message || String(err);
      const isQuotaExhausted = errMsg.includes("RESOURCE_EXHAUSTED") || errMsg.includes("429") || errMsg.includes("quota");
      
      if (isQuotaExhausted) {
        console.warn("Gemini API-quota is uitgeput (RESOURCE_EXHAUSTED / 429). We leveren direct offline fallback data.");
      } else {
        console.error("Fout bij het aanroepen van de Gemini API:", errMsg);
      }
      return res.json({ ...fallback, source: "fallback-error" });
    }
  });

  // Serve static files / Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
