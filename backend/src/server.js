import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const app = express();

app.use(cors());
app.use(express.json());

// --- BAUER LOGIN / REGISTER ---
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

app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  const bauer = await prisma.bauer.findUnique({ where: { username } });
  if (!bauer) return res.status(404).json({ error: "Benutzer nicht gefunden" });
  const valid = await bcrypt.compare(password, bauer.password);
  if (!valid) return res.status(401).json({ error: "Falsches Passwort" });
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

app.patch("/api/produkte/:id", async (req, res) => {
  const { id } = req.params;
  const { name, beschreibung, preis, kategorieId } = req.body;
  const produkt = await prisma.produkt.update({
    where: { id },
    data: { name, beschreibung, preis: parseFloat(preis), kategorieId },
  });
  res.json(produkt);
});

app.delete("/api/produkte/:id", async (req, res) => {
  const { id } = req.params;
  await prisma.produkt.delete({ where: { id } });
  res.json({ message: "Produkt gelöscht" });
});

// --- KUNDEN CRUD ---
app.get("/api/kunden", async (req, res) => {
  const kunden = await prisma.kunde.findMany();
  res.json(kunden);
});

app.post("/api/kunden", async (req, res) => {
  const { name, email } = req.body;
  const kunde = await prisma.kunde.create({ data: { name, email } });
  res.json(kunde);
});

app.patch("/api/kunden/:id", async (req, res) => {
  const { id } = req.params;
  const { name, email } = req.body;
  const kunde = await prisma.kunde.update({ where: { id }, data: { name, email } });
  res.json(kunde);
});

app.delete("/api/kunden/:id", async (req, res) => {
  await prisma.kunde.delete({ where: { id } });
  res.json({ message: "Kunde gelöscht" });
});

// --- STATISTIK: meistverkauftes Produkt ---
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

// --- SERVER START ---
app.listen(3000, () => console.log("🚜 Server läuft auf http://localhost:3000"));
