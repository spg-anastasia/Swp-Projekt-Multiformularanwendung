-- CreateTable
CREATE TABLE "Bauer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Kategorie" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Produkt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "beschreibung" TEXT NOT NULL,
    "preis" REAL NOT NULL,
    "kategorieId" TEXT NOT NULL,
    CONSTRAINT "Produkt_kategorieId_fkey" FOREIGN KEY ("kategorieId") REFERENCES "Kategorie" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Kunde" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Bestellung" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "datum" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kundeId" TEXT NOT NULL,
    "gesamtpreis" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "Bestellung_kundeId_fkey" FOREIGN KEY ("kundeId") REFERENCES "Kunde" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BestelltesProdukt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bestellungId" TEXT NOT NULL,
    "produktId" TEXT NOT NULL,
    "menge" INTEGER NOT NULL DEFAULT 1,
    "einzelpreis" REAL NOT NULL,
    CONSTRAINT "BestelltesProdukt_bestellungId_fkey" FOREIGN KEY ("bestellungId") REFERENCES "Bestellung" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BestelltesProdukt_produktId_fkey" FOREIGN KEY ("produktId") REFERENCES "Produkt" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Bauer_username_key" ON "Bauer"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Kunde_email_key" ON "Kunde"("email");

-- CreateIndex
CREATE UNIQUE INDEX "BestelltesProdukt_bestellungId_produktId_key" ON "BestelltesProdukt"("bestellungId", "produktId");
