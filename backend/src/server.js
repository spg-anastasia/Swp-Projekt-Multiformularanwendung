import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const app = express();

app.use(cors());
app.use(express.json());

/* ========================================================
   BAUER REGISTER + LOGIN
======================================================== */

// REGISTER
app.post("/api/register", async (req, res) => {
  const { username, password } = req.body;
  try {
    const hashed = await bcrypt.hash(password, 10);
    const bauer = await prisma.bauer.create({
      data: { username, password: hashed },
    });
    res.json({ message: "Bauer registriert", bauer });
  } catch (err) {
    res.status(400).json({ error: "Benutzername bereits vorhanden" });
  }
});

// LOGIN
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;

  const bauer = await prisma.bauer.findUnique({ where: { username } });
  if (!bauer) return res.status(404).json({ error: "Benutzer nicht gefunden" });

  const valid = await bcrypt.compare(password, bauer.password);
  if (!valid) return res.status(401).json({ error: "Falsches Passwort" });

  res.json({ message: "Login erfolgreich", bauer });
});

/* ========================================================
   KATEGORIEN
======================================================== */

// Für Produkt-Formular (Dropdown)
app.get("/api/kategorien", async (req, res) => {
  const kategorien = await prisma.kategorie.findMany();
  res.json(kategorien);
});

/* ========================================================
   PRODUKTE CRUD
======================================================== */

// ALLE PRODUKTE
app.get("/api/produkte", async (req, res) => {
  const produkte = await prisma.produkt.findMany({
    include: { kategorie: true },
  });
  res.json(produkte);
});

// PRODUKT ERSTELLEN
app.post("/api/produkte", async (req, res) => {
  const { name, beschreibung, preis, kategorieId } = req.body;

  try {
    const produkt = await prisma.produkt.create({
      data: {
        name,
        beschreibung,
        preis: parseFloat(preis),
        kategorieId,
      },
    });
    res.json(produkt);
  } catch (err) {
    console.log(err);
    res.status(400).json({ error: "Produkt konnte nicht erstellt werden" });
  }
});

// PRODUKT BEARBEITEN
app.patch("/api/produkte/:id", async (req, res) => {
  const { id } = req.params;
  const { name, beschreibung, preis, kategorieId } = req.body;

  const produkt = await prisma.produkt.update({
    where: { id },
    data: {
      name,
      beschreibung,
      preis: parseFloat(preis),
      kategorieId,
    },
  });
  res.json(produkt);
});

// PRODUKT LÖSCHEN
app.delete("/api/produkte/:id", async (req, res) => {
  const { id } = req.params;

  await prisma.produkt.delete({ where: { id } });
  res.json({ message: "Produkt gelöscht" });
});

/* ========================================================
   KUNDEN CRUD
======================================================== */

// ALLE KUNDEN
app.get("/api/kunden", async (req, res) => {
  const kunden = await prisma.kunde.findMany();
  res.json(kunden);
});

// KUNDE ERSTELLEN
app.post("/api/kunden", async (req, res) => {
  const { name, email } = req.body;

  try {
    const kunde = await prisma.kunde.create({
      data: { name, email },
    });
    res.json(kunde);
  } catch (err) {
    res.status(400).json({ error: "Email bereits vergeben" });
  }
});

// KUNDE BEARBEITEN
app.patch("/api/kunden/:id", async (req, res) => {
  const { id } = req.params;
  const { name, email } = req.body;

  const kunde = await prisma.kunde.update({
    where: { id },
    data: { name, email },
  });
  res.json(kunde);
});

// KUNDE LÖSCHEN
app.delete("/api/kunden/:id", async (req, res) => {
  const { id } = req.params;
  await prisma.kunde.delete({ where: { id } });
  res.json({ message: "Kunde gelöscht" });
});

/* ========================================================
   BESTELLUNGEN
======================================================== */

// BESTELLUNG ERSTELLEN
app.post("/api/bestellungen", async (req, res) => {
  const { kundeId, produkte } = req.body;

  try {
    // Gesamtpreis berechnen
    let gesamtpreis = 0;

    produkte.forEach((p) => {
      gesamtpreis += p.menge * p.einzelpreis;
    });

    // Bestellung anlegen
    const bestellung = await prisma.bestellung.create({
      data: {
        kundeId,
        gesamtpreis,
        bestellteProdukte: {
          create: produkte.map((p) => ({
            produktId: p.produktId,
            menge: p.menge,
            einzelpreis: p.einzelpreis,
          })),
        },
      },
      include: { bestellteProdukte: true },
    });

    res.json(bestellung);
  } catch (err) {
    console.log(err);
    res.status(400).json({ error: "Bestellung konnte nicht erstellt werden" });
  }
});

// ALLE BESTELLUNGEN (optional, falls benötigt)
app.get("/api/bestellungen", async (req, res) => {
  const bestellungen = await prisma.bestellung.findMany({
    include: {
      kunde: true,
      bestellteProdukte: { include: { produkt: true } },
    },
  });
  res.json(bestellungen);
});

/* ========================================================
   STATISTIK
======================================================== */

// (1) KOMPLETTE STATISTIK FÜR ALLE PRODUKTE
app.get("/api/statistik/produkte", async (req, res) => {
  const grouped = await prisma.bestelltesProdukt.groupBy({
    by: ["produktId"],
    _sum: { menge: true },
  });

  const result = [];

  for (let g of grouped) {
    const produkt = await prisma.produkt.findUnique({
      where: { id: g.produktId },
    });

    result.push({
      produkt: produkt.name,
      anzahl: g._sum.menge,
    });
  }

  // Sortieren: meist verkauft -> oben
  result.sort((a, b) => b.anzahl - a.anzahl);

  res.json(result);
});

// (2) MEISTVERKAUFTES PRODUKT
app.get("/api/statistik/meistverkauft", async (req, res) => {
  const result = await prisma.bestelltesProdukt.groupBy({
    by: ["produktId"],
    _sum: { menge: true },
    orderBy: { _sum: { menge: "desc" } },
    take: 1,
  });

  if (result.length === 0)
    return res.json({ message: "Keine Verkäufe vorhanden" });

  const produkt = await prisma.produkt.findUnique({
    where: { id: result[0].produktId },
  });

  res.json({
    produkt,
    verkauft: result[0]._sum.menge,
  });
});

/* ========================================================
   SERVER START
======================================================== */

app.listen(3000, () =>
  console.log("🚜 Server läuft auf http://localhost:3000")
);
