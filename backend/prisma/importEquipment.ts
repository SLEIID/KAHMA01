/**
 * Skrypt: wyczyść cały sprzęt wypożyczalni i zaimportuj nową listę.
 * Uruchomienie (lokalnie): DATABASE_URL=... npx tsx prisma/importEquipment.ts
 * Uruchomienie w kontenerze: docker exec kahma-backend node -e "require('./dist/prisma/importEquipment.js')"
 *   (po zbudowaniu przez tsup)
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ── Kategorie i sprzęt ────────────────────────────────────────────────────────

const categories: Array<{
  name: string
  items: Array<{ name: string; serialNumber?: string; notes?: string }>
}> = [
  {
    name: 'Samochody osobowe',
    items: [
      { name: 'Fiat Punto',         serialNumber: 'WGS2EF7' },
      { name: 'Audi A6 Allroad — ciągnik pod przyczepkę', serialNumber: 'WGS8MK1' },
      { name: 'Renault Clio',       serialNumber: 'WGS99E8' },
      { name: 'VW Passat',          serialNumber: 'WGS44SS' },
    ],
  },
  {
    name: 'Samochody dostawcze',
    items: [
      { name: 'Renault Master czerwony',        serialNumber: 'WGS99F8' },
      { name: 'VW Caddy',                       serialNumber: 'WGS99R8' },
      { name: 'VW Caravelle T5 (biały stary)',  serialNumber: 'WGS4EP5' },
      { name: 'VW Transporter (biały nowy)',    serialNumber: 'WGS3KL1' },
      { name: 'VW Transporter czerwony',        serialNumber: 'WGS1C22' },
      { name: 'Fiat Ducato',                    serialNumber: 'WGS6HL6' },
      { name: 'Mercedes-Benz Vario warsztatowy',serialNumber: 'WGS7MN9' },
      { name: 'Renault Master żółty',           serialNumber: 'WGS6KA2' },
    ],
  },
  {
    name: 'Pojazdy ciężarowe',
    items: [
      { name: 'MAN — dźwig HDS 6t',       serialNumber: 'WGS8FM1' },
      { name: 'Scania 114 — dźwig HDS 12t', serialNumber: 'WGS1KH3' },
      { name: 'Walter laweta ciężarowa',   serialNumber: 'WGS30U9' },
      { name: 'Mercedes-Benz Atego laweta',serialNumber: 'WGS9SE5' },
      { name: 'Mercedes-Benz mandaryna — podnośnik koszowy 16m', serialNumber: 'WGS8AY4' },
    ],
  },
  {
    name: 'Przyczepy i agregaty',
    items: [
      { name: 'Przyczepa Tamared — przyczepa koparki', serialNumber: 'WGS6UF9' },
      { name: 'Przyczepa z agregatem 150 kVA TA-NO',   serialNumber: 'WGS8UN4' },
      { name: 'Brenderup przyczepka — biały furgon',   serialNumber: 'WGS5UL5' },
      { name: 'Agregat 410 kVA Iwanitzky',             serialNumber: 'WGS99U7' },
    ],
  },
  {
    name: 'Podnośniki',
    items: [
      { name: 'Genie GR-15 masztowy — 6,5 m roboczej',              serialNumber: 'GENIE-GR15-01',  notes: 'Wysokość robocza 6,5 m' },
      { name: 'Genie GR-20 masztowy — 8 m roboczej (1)',             serialNumber: 'GENIE-GR20-01',  notes: 'Wysokość robocza 8 m' },
      { name: 'Genie GR-20 masztowy — 8 m roboczej (2)',             serialNumber: 'GENIE-GR20-02',  notes: 'Wysokość robocza 8 m' },
      { name: 'Genie GS-1932m nożycowa — 10 m roboczej',             serialNumber: 'GENIE-GS1932-01',notes: 'Nożycowa, wysokość robocza 10 m' },
      { name: 'Haulotte Star 10 masztowy z zasięgiem bocznym 2m (stary)', serialNumber: 'HAULOTTE-STAR10-01', notes: 'Wysokość robocza 10 m, zasięg boczny 2 m' },
      { name: 'Haulotte Star 10 masztowy z zasięgiem bocznym 2m (nowy)',  serialNumber: 'HAULOTTE-STAR10-02', notes: 'Wysokość robocza 10 m, zasięg boczny 2 m' },
      { name: 'Haulotte HA12CJ+ przegubowo-teleskopowy — 12 m roboczej',  serialNumber: 'HAULOTTE-HA12CJ-01', notes: 'Wysokość robocza 12 m, zasięg boczny 6 m' },
      { name: 'Immer podest nożycowy — 16 m roboczej',               serialNumber: 'IMMER-NOZYCOWY-01',notes: 'Nożycowy, wysokość robocza 16 m' },
    ],
  },
]

// ── Główna logika ─────────────────────────────────────────────────────────────

async function main() {
  console.log('🗑  Czyszczenie sprzętu...')

  // Zamknij aktywne wypożyczenia
  await prisma.equipmentRental.updateMany({
    where: { returnedAt: null },
    data:  { returnedAt: new Date(), returnNotes: 'Zamknięto automatycznie przy imporcie sprzętu' },
  })

  // Usuń zgłoszenia i wypożyczenia (brak kaskady na kategorię)
  await prisma.equipmentIssue.deleteMany({})
  await prisma.equipmentRental.deleteMany({})
  await prisma.equipmentItem.deleteMany({})
  await prisma.equipmentCategory.deleteMany({})

  console.log('✅ Wyczyszczono.')
  console.log('📦 Importuję nowy sprzęt...')

  let totalItems = 0

  for (const cat of categories) {
    const category = await prisma.equipmentCategory.create({
      data: { name: cat.name },
    })

    for (const item of cat.items) {
      await prisma.equipmentItem.create({
        data: {
          categoryId:   category.id,
          name:         item.name,
          serialNumber: item.serialNumber ?? null,
          notes:        item.notes ?? null,
          status:       'available',
        },
      })
      totalItems++
    }

    console.log(`  ✓ ${cat.name} — ${cat.items.length} pozycji`)
  }

  console.log(`\n🎉 Zaimportowano ${totalItems} pozycji w ${categories.length} kategoriach.`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
