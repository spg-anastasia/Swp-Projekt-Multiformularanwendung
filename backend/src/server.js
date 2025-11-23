// server.js
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const app = express();

// Middleware
app.use(cors()); // erlaubt alle Domains; ggf. anpassen
app.use(express.json());

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
    return res.json({ message: "Bauer registriert", bauer });
  } catch (err) {
    console.error("Fehler beim Registrieren:", err);
    return res.status(400).json({ error: "Benutzername bereits vorhanden" });
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

    return res.json({ message: "Login erfolgreich", bauer });
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

// ALLE PRODUKTE
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
    return res.json(produkt);
  } catch (err) {
    console.error("Fehler Produkt erstellen:", err);
    return res.status(400).json({ error: "Produkt konnte nicht erstellt werden" });
  }
});

// PRODUKT BEARBEITEN
app.patch("/api/produkte/:id", async (req, res) => {
  const { id } = req.params;
  const { name, beschreibung, preis, kategorieId } = req.body;

  try {
    const produkt = await prisma.produkt.update({
      where: { id },
      data: { name, beschreibung, preis: parseFloat(preis), kategorieId },
    });
    return res.json(produkt);
  } catch (err) {
    console.error("Fehler Produkt aktualisieren:", err);
    return res.status(400).json({ error: "Produkt konnte nicht aktualisiert werden" });
  }
});

// PRODUKT LÖSCHEN
app.delete("/api/produkte/:id", async (req, res) => {
  const { id } = req.params;

  try {
    await prisma.produkt.delete({ where: { id } });
    return res.json({ message: "Produkt gelöscht" });
  } catch (err) {
    console.error("Fehler Produkt löschen:", err);
    return res.status(400).json({ error: "Produkt konnte nicht gelöscht werden" });
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
