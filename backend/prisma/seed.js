const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const bauer = await prisma.bauer.upsert({
    where: { username: "bauer1" },
    update: {},
    create: { username: "bauer1", password: "1234" },
  });

  const obst = await prisma.kategorie.upsert({
    where: { name: "Obst" },
    update: {},
    create: { name: "Obst" },
  });

  const gemuese = await prisma.kategorie.upsert({
    where: { name: "Gemüse" },
    update: {},
    create: { name: "Gemüse" },
  });

  const apfel = await prisma.produkt.upsert({
    where: { name: "Apfel" },
    update: {},
    create: { name: "Apfel", beschreibung: "Roter Apfel", preis: 1.5, kategorieId: obst.id },
  });

  const karotte = await prisma.produkt.upsert({
    where: { name: "Karotte" },
    update: {},
    create: { name: "Karotte", beschreibung: "Frische Karotte", preis: 0.8, kategorieId: gemuese.id },
  });

  const max = await prisma.kunde.upsert({
    where: { email: "max@test.de" },
    update: {},
    create: { name: "Max Mustermann", email: "max@test.de" },
  });

  await prisma.bestellung.upsert({
    where: { id: "best1" },
    update: {},
    create: {
      id: "best1",
      kundeId: max.id,
      gesamtpreis: apfel.preis * 2 + karotte.preis * 3,
      bestellteProdukte: {
        create: [
          { produktId: apfel.id, menge: 2, einzelpreis: apfel.preis },
          { produktId: karotte.id, menge: 3, einzelpreis: karotte.preis },
        ],
      },
    },
  });

  console.log("Seed abgeschlossen!");
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
