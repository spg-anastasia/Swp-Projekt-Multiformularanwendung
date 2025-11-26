// server.js
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");
const path = require("path");

const prisma = new PrismaClient();
const app = express();

// Middleware
app.use(cors()); // erlaubt alle Domains; ggf. anpassen
app.use(express.json());

// static frontend ausliefern
const frontendDir = path.resolve(__dirname, "../../frontend");
app.use(express.static(frontendDir));
app.get("/", (req, res) => res.sendFile(path.join(frontendDir, "anmelden.html")));


// Weiterleitungen für alte Pfade
app.get("/anmelden.html", (req, res) => res.sendFile(path.join(frontendDir, "anmelden.html")));
app.get("/registrieren.html", (req, res) => res.sendFile(path.join(frontendDir, "registrieren.html")));
app.get("/register", (req, res) => res.sendFile(path.join(frontendDir, "registrieren.html")));

// Debug Logging
app.use((req, res, next) => {
  console.log(new Date().toISOString(), req.method, req.originalUrl);
  next();
});

// ========================================================
// BAUER REGISTER + LOGIN
// ========================================================

// REGISTER
app.post("/api/register", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username und Passwort erforderlich" });
  }

  try {
    const hashed = await bcrypt.hash(password, 10);
    const bauer = await prisma.bauer.create({
      data: { username, password: hashed },
    });

    // Entferne password aus der Antwort
    const { password: _, ...safeBauer } = bauer;

    // 201 Created
    return res.status(201).json({ message: "Bauer registriert", bauer: safeBauer });
  } catch (err) {
    console.error("Fehler beim Registrieren:", err);

    // Prisma unique constraint -> 409
    if (err.code === "P2002") {
      return res.status(409).json({ error: "Benutzername bereits vorhanden" });
    }
    return res.status(500).json({ error: "Serverfehler" });
  }
});

// LOGIN
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Username und Passwort erforderlich" });
  }

  try {
    const bauer = await prisma.bauer.findUnique({ where: { username } });
    if (!bauer) return res.status(404).json({ error: "Benutzer nicht gefunden" });

    const valid = await bcrypt.compare(password, bauer.password);
    if (!valid) return res.status(401).json({ error: "Falsches Passwort" });

    // keine Passwörter in Antworten zurückgeben
    const { password: _, ...safeBauer } = bauer;
    return res.json({ message: "Login erfolgreich", bauer: safeBauer });
  } catch (err) {
    console.error("Login Fehler:", err);
    return res.status(500).json({ error: "Serverfehler" });
  }
});

// ========================================================
// KATEGORIEN
// ========================================================
app.get("/api/kategorien", async (req, res) => {
  try {
    const kategorien = await prisma.kategorie.findMany();
    return res.json(kategorien);
  } catch (err) {
    console.error("Fehler Kategorien:", err);
    return res.status(500).json({ error: "Kategorien konnten nicht geladen werden" });
  }
});

// ========================================================
// PRODUKTE CRUD
// ========================================================

// ALLE PRODUKTE (inkl. Kategorie)
app.get("/api/produkte", async (req, res) => {
  try {
    const produkte = await prisma.produkt.findMany({ include: { kategorie: true } });
    return res.json(produkte);
  } catch (err) {
    console.error("Fehler Produkte laden:", err);
    return res.status(500).json({ error: "Produkte konnten nicht geladen werden" });
  }
});

// PRODUKT ERSTELLEN
app.post("/api/produkte", async (req, res) => {
  const { name, beschreibung, preis, kategorieId, kategorieName } = req.body;

  if (!name || beschreibung === undefined || preis === undefined) {
    return res.status(400).json({ error: "name, beschreibung und preis sind erforderlich" });
  }

  try {
    const preisNum = Number(preis);
    if (Number.isNaN(preisNum)) return res.status(400).json({ error: "preis muss eine Zahl sein" });

    const data = { name, beschreibung, preis: preisNum };

    if (kategorieId) {
      data.kategorie = { connect: { id: kategorieId } };
    } else if (kategorieName) {
      data.kategorie = {
        connectOrCreate: {
          where: { name: kategorieName },
          create: { name: kategorieName }
        }
      };
    } else {
      // Default-Kategorie falls benötigt
      data.kategorie = {
        connectOrCreate: {
          where: { name: "Unkategorisiert" },
          create: { name: "Unkategorisiert" }
        }
      };
    }

    const produkt = await prisma.produkt.create({ data, include: { kategorie: true } });
    return res.status(201).json(produkt);
  } catch (err) {
    console.error("Fehler Produkt erstellen:", err);
    if (err.code === "P2002") return res.status(409).json({ error: "Produktname bereits vorhanden" });
    return res.status(500).json({ error: "Produkt konnte nicht erstellt werden", details: err.message });
  }
});

// PRODUKT AKTUALISIEREN (PUT + PATCH unterstützen)
async function updateProduktById(id, body) {
  const { name, beschreibung, preis, kategorieId } = body;
  if (!name || beschreibung === undefined || preis === undefined || !kategorieId) {
    const err = new Error("name, beschreibung, preis und kategorieId erforderlich");
    err.status = 400;
    throw err;
  }

  return prisma.produkt.update({
    where: { id },
    data: {
      name,
      beschreibung,
      preis: Number(preis),
      kategorie: { connect: { id: kategorieId } }
    },
    include: { kategorie: true }
  });
}

app.put("/api/produkte/:id", async (req, res) => {
  const id = req.params.id;
  try {
    const updated = await updateProduktById(id, req.body);
    return res.json(updated);
  } catch (err) {
    console.error("Fehler beim Aktualisieren Produkt (PUT):", err);
    if (err.status) return res.status(err.status).json({ error: err.message });
    if (err.code === "P2002") return res.status(409).json({ error: "Produktname bereits vorhanden" });
    return res.status(500).json({ error: "Produkt konnte nicht aktualisiert werden", details: err.message });
  }
});

app.patch("/api/produkte/:id", async (req, res) => {
  // PATCH führt dieselbe Validierung/Aktualisierung durch wie PUT in deinem Fall
  const id = req.params.id;
  try {
    const updated = await updateProduktById(id, req.body);
    return res.json(updated);
  } catch (err) {
    console.error("Fehler beim Aktualisieren Produkt (PATCH):", err);
    if (err.status) return res.status(err.status).json({ error: err.message });
    if (err.code === "P2002") return res.status(409).json({ error: "Produktname bereits vorhanden" });
    return res.status(500).json({ error: "Produkt konnte nicht aktualisiert werden", details: err.message });
  }
});

// PRODUKT LÖSCHEN
app.delete("/api/produkte/:id", async (req, res) => {
  const { id } = req.params;

  try {
    await prisma.produkt.delete({ where: { id } });
    return res.sendStatus(204); // No Content
  } catch (err) {
    console.error("Fehler Produkt löschen:", err);
    return res.status(500).json({ error: "Produkt konnte nicht gelöscht werden", details: err.message });
  }
});

// ========================================================
// KUNDEN ENDPOINTS
// ========================================================

// Kunden erstellen
app.post("/api/kunden", async (req, res) => {
  console.log("POST /api/kunden body:", req.body);
  try {
    const { name, email } = req.body;
    if (!name || !email) return res.status(400).json({ error: "Name und Email erforderlich" });

    const kunde = await prisma.kunde.create({ data: { name, email } });
    return res.status(201).json(kunde);
  } catch (err) {
    console.error("Fehler beim Erstellen Kunde:", err);
    if (err.code === "P2002") return res.status(409).json({ error: "Email bereits vorhanden" });
    return res.status(500).json({ error: "Kunde konnte nicht erstellt werden", details: err.message });
  }
});

// Kundenliste
app.get("/api/kunden", async (req, res) => {
  try {
    const kunden = await prisma.kunde.findMany();
    return res.json(kunden);
  } catch (err) {
    console.error("Fehler beim Laden Kunden:", err);
    return res.status(500).json({ error: "Kunden konnten nicht geladen werden" });
  }
});

// ========================================================
// BESTELLUNGEN
// ========================================================

// BESTELLUNGEN ABRUFEN (GET)
app.get("/api/bestellungen", async (req, res) => {
  try {
    const bestellungen = await prisma.bestellung.findMany({
      include: {
        kunde: true,
        bestellteProdukte: { include: { produkt: true } }
      },
      orderBy: { datum: "desc" }
    });
    return res.json(bestellungen);
  } catch (err) {
    console.error("Fehler beim Laden Bestellungen:", err);
    return res.status(500).json({ error: "Bestellungen konnten nicht geladen werden", details: err.message });
  }
});

// BESTELLUNGEN — nur POST (Bestellung speichern)
app.post("/api/bestellungen", async (req, res) => {
  console.log("POST /api/bestellungen body:", JSON.stringify(req.body));
  try {
    const { kundeId, produkte } = req.body;
    if (!kundeId || !Array.isArray(produkte) || produkte.length === 0) {
      return res.status(400).json({ error: "kundeId und produkte (Array) erforderlich" });
    }

    const kunde = await prisma.kunde.findUnique({ where: { id: kundeId } });
    if (!kunde) return res.status(400).json({ error: "Kunde nicht gefunden" });

    // Zusammenfassen gleicher produktId -> menge summieren
    const map = new Map();
    for (const p of produkte) {
      if (!p.produktId) return res.status(400).json({ error: "produktId fehlt in einem Eintrag" });
      const menge = Number(p.menge);
      const einzelpreis = Number(p.einzelpreis ?? p.preis ?? 0);
      if (!Number.isFinite(menge) || menge <= 0) return res.status(400).json({ error: "Ungültige Menge" });
      if (!Number.isFinite(einzelpreis) || einzelpreis < 0) return res.status(400).json({ error: "Ungültiger Einzelpreis" });

      const existing = map.get(p.produktId);
      if (existing) {
        // Menge aufsummieren, behalten des ersten Einzelpreises (oder wähle eine Logik)
        existing.menge += menge;
      } else {
        map.set(p.produktId, { produktId: p.produktId, menge, einzelpreis });
      }
    }

    // Prüfe Produkte existieren und berechne Gesamt
    let gesamt = 0;
    const items = [];
    for (const entry of map.values()) {
      const produkt = await prisma.produkt.findUnique({ where: { id: entry.produktId } });
      if (!produkt) return res.status(400).json({ error: `Produkt nicht gefunden: ${entry.produktId}` });
      gesamt += entry.menge * entry.einzelpreis;
      items.push({
        produkt: { connect: { id: entry.produktId } },
        menge: entry.menge,
        einzelpreis: entry.einzelpreis
      });
    }

    const bestellung = await prisma.bestellung.create({
      data: {
        kunde: { connect: { id: kundeId } },
        gesamtpreis: gesamt,
        bestellteProdukte: { create: items } // passt zum deinem schema
      },
      include: {
        kunde: true,
        bestellteProdukte: { include: { produkt: true } }
      }
    });

    return res.status(201).json(bestellung);
  } catch (err) {
    console.error("Fehler beim Erstellen Bestellung:", err);
    if (err.code === "P2002") {
      return res.status(409).json({ error: "Konflikt: doppelte Einträge in Bestellung" });
    }
    return res.status(500).json({ error: "Bestellung konnte nicht gespeichert werden", details: err.message || String(err) });
  }
});

// ========================================================
// STATISTIKEN
// ========================================================
app.get("/api/statistik/produkte", async (req, res) => {
  try {
    // gruppiere Bestellzeilen nach produktId: Summe der Menge und Anzahl der Bestellzeilen
    const grouped = await prisma.bestelltesProdukt.groupBy({
      by: ["produktId"],
      _sum: { menge: true },
      _count: { bestellungId: true },
      orderBy: { _sum: { menge: "desc" } }
    });

    const produktIds = grouped.map(g => g.produktId);
    const produkte = await prisma.produkt.findMany({ where: { id: { in: produktIds } } });
    const produktMap = new Map(produkte.map(p => [p.id, p.name]));

    const stats = grouped.map(g => ({
      produktId: g.produktId,
      produkt: produktMap.get(g.produktId) || "Unbekannt",
      gesamtMenge: g._sum?.menge ?? 0,
      bestellZeilen: g._count?.bestellungId ?? 0
    }));

    return res.json(stats);
  } catch (err) {
    console.error("Fehler Statistik Produkte:", err);
    return res.status(500).json({ error: "Statistik konnte nicht geladen werden", details: err.message });
  }
});

// ========================================================
// SERVER START
// ========================================================

const PORT = 3000;
app.listen(PORT, () => console.log(`🚜 Server läuft auf http://localhost:${PORT}`));

// Prisma sauber trennen bei Exit
process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit();
});
process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit();
});
