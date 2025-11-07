import express from "express";
import { PrismaClient } from "@prisma/client";
import cors from "cors";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const app = express();

app.use(cors());
app.use(express.json());

// --- LOGIN / REGISTER BAUER ---
app.post("/api/register", async (req, res) => {
  const { username, password } = req.body;
  const hashed = await bcrypt.hash(password, 10);
  try {
    const bauer = await prisma.bauer.create({
      data: { username, password: hashed },
    });
    res.json(bauer);
  } catch (err) {
    res.status(400).json({ error: "Benutzername bereits vorhanden." });
  }
});

app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  const bauer = await prisma.bauer.findUnique({ where: { username } });
  if (!bauer) return res.status(404).json({ error: "Benutzer nicht gefunden." });
  const valid = await bcrypt.compare(password, bauer.password);
  if (!valid) return res.status(401).json({ error: "Falsches Passwort." });
  res.json({ message: "Login erfolgreich", bauer });
});

// --- PRODUKTE CRUD ---
app.get("/api/produkte", async (req, res) => {
  const produkte = await prisma.produkt.findMany({ include: { kategorie: true } });
  res.json(produkte);
});

app.post("/api/produkte", async (req, res) => {
  const { name, beschreibung, preis, kategorieId } = req.body;
  const produkt = await prisma.produkt.create({
    data: { name, beschreibung, preis: parseFloat(preis), kategorieId },
  });
  res.json(produkt);
});

// --- KUNDEN / BESTELLUNGEN ---
app.get("/api/statistik/meistverkauft", async (req, res) => {
  const result = await prisma.bestelltesProdukt.groupBy({
    by: ["produktId"],
    _sum: { menge: true },
    orderBy: { _sum: { menge: "desc" } },
    take: 1,
  });
  if (result.length === 0) return res.json({ message: "Keine Verkäufe vorhanden" });
  const produkt = await prisma.produkt.findUnique({ where: { id: result[0].produktId } });
  res.json({ produkt, verkauft: result[0]._sum.menge });
});

app.listen(3000, () => console.log("🚜 Server läuft auf http://localhost:3000"));

app.use(express.static("public"));