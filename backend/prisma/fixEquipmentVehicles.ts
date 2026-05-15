/**
 * Naprawia podział sprzętu:
 * - Usuwa pojazdy z wypożyczalni (były błędnie tam dodane)
 * - Dodaje/aktualizuje wszystkie pojazdy z tablicami w tabeli vehicles (flota)
 * - Zostawia w wypożyczalni tylko podnośniki
 * - Dezaktywuje pojazdy we flocie spoza nowej listy
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ── Flota (vehicles) — pojazdy z tablicami rejestracyjnymi ───────────────────

const vehicles = [
  { plateNumber: 'WGS6UF9', name: 'Przyczepa Tamared — przyczepa koparki' },
  { plateNumber: 'WGS8FM1', name: 'MAN — dźwig HDS 6t' },
  { plateNumber: 'WGS99F8', name: 'Renault Master czerwony' },
  { plateNumber: 'WGS2EF7', name: 'Fiat Punto' },
  { plateNumber: 'WGS8MK1', name: 'Audi A6 Allroad' },
  { plateNumber: 'WGS8UN4', name: 'Przyczepa z agregatem 150 kVA TA-NO' },
  { plateNumber: 'WGS8AY4', name: 'Mercedes-Benz mandaryna — podnośnik koszowy 16m' },
  { plateNumber: 'WGS99R8', name: 'VW Caddy' },
  { plateNumber: 'WGS99E8', name: 'Renault Clio' },
  { plateNumber: 'WGS1KH3', name: 'Scania 114 — dźwig HDS 12t' },
  { plateNumber: 'WGS4EP5', name: 'VW Caravelle T5 (biały stary)' },
  { plateNumber: 'WGS30U9', name: 'Walter laweta ciężarowa' },
  { plateNumber: 'WGS6HL6', name: 'Fiat Ducato' },
  { plateNumber: 'WGS3KL1', name: 'VW Transporter (biały nowy)' },
  { plateNumber: 'WGS44SS', name: 'VW Passat' },
  { plateNumber: 'WGS7MN9', name: 'Mercedes-Benz Vario warsztatowy' },
  { plateNumber: 'WGS6KA2', name: 'Renault Master żółty' },
  { plateNumber: 'WGS1C22', name: 'VW Transporter czerwony' },
  { plateNumber: 'WGS5UL5', name: 'Brenderup przyczepka — biały furgon' },
  { plateNumber: 'WGS9SE5', name: 'Mercedes-Benz Atego laweta' },
  { plateNumber: 'WGS99U7', name: 'Agregat 410 kVA Iwanitzky' },
]

// ── Podnośniki (pozostają w wypożyczalni) ─────────────────────────────────────

const lifts = [
  { name: 'Genie GR-15 masztowy — 6,5 m roboczej',                   serialNumber: 'GENIE-GR15-01',      notes: 'Wysokość robocza 6,5 m' },
  { name: 'Genie GR-20 masztowy — 8 m roboczej (1)',                  serialNumber: 'GENIE-GR20-01',      notes: 'Wysokość robocza 8 m' },
  { name: 'Genie GR-20 masztowy — 8 m roboczej (2)',                  serialNumber: 'GENIE-GR20-02',      notes: 'Wysokość robocza 8 m' },
  { name: 'Genie GS-1932m nożycowa — 10 m roboczej',                  serialNumber: 'GENIE-GS1932-01',    notes: 'Nożycowa, wysokość robocza 10 m' },
  { name: 'Haulotte Star 10 masztowy z zasięgiem bocznym 2m (stary)', serialNumber: 'HAULOTTE-STAR10-01', notes: 'Wysokość robocza 10 m, zasięg boczny 2 m' },
  { name: 'Haulotte Star 10 masztowy z zasięgiem bocznym 2m (nowy)',  serialNumber: 'HAULOTTE-STAR10-02', notes: 'Wysokość robocza 10 m, zasięg boczny 2 m' },
  { name: 'Haulotte HA12CJ+ przegubowo-teleskopowy — 12 m roboczej',  serialNumber: 'HAULOTTE-HA12CJ-01', notes: 'Wysokość robocza 12 m, zasięg boczny 6 m' },
  { name: 'Immer podest nożycowy — 16 m roboczej',                    serialNumber: 'IMMER-NOZYCOWY-01',  notes: 'Nożycowy, wysokość robocza 16 m' },
]

// ── Główna logika ─────────────────────────────────────────────────────────────

async function main() {
  // 1. Flota — upsert wszystkich 21 pojazdów
  console.log('🚗 Aktualizuję flotę (vehicles)...')
  const newPlates = new Set(vehicles.map(v => v.plateNumber))

  for (const v of vehicles) {
    await prisma.vehicle.upsert({
      where:  { plateNumber: v.plateNumber },
      update: { name: v.name, isActive: true },
      create: { plateNumber: v.plateNumber, name: v.name, isActive: true },
    })
  }
  console.log(`  ✓ Dodano/zaktualizowano ${vehicles.length} pojazdów`)

  // Dezaktywuj pojazdy spoza nowej listy
  const deactivated = await prisma.vehicle.updateMany({
    where: { plateNumber: { notIn: [...newPlates] } },
    data:  { isActive: false },
  })
  if (deactivated.count > 0) {
    console.log(`  ⚠  Dezaktywowano ${deactivated.count} starych pojazdów spoza listy`)
  }

  // 2. Wypożyczalnia — wyczyść wszystko i zostaw tylko podnośniki
  console.log('\n🔧 Naprawiam wypożyczalnię (equipment)...')

  // Zamknij aktywne wypożyczenia
  const closed = await prisma.equipmentRental.updateMany({
    where: { returnedAt: null },
    data:  { returnedAt: new Date(), returnNotes: 'Zamknięto przy reorganizacji sprzętu' },
  })
  if (closed.count > 0) console.log(`  ⚠  Zamknięto ${closed.count} aktywnych wypożyczeń`)

  await prisma.equipmentIssue.deleteMany({})
  await prisma.equipmentRental.deleteMany({})
  await prisma.equipmentItem.deleteMany({})
  await prisma.equipmentCategory.deleteMany({})

  // Utwórz kategorię i dodaj podnośniki
  const category = await prisma.equipmentCategory.create({
    data: { name: 'Podnośniki' },
  })

  for (const lift of lifts) {
    await prisma.equipmentItem.create({
      data: {
        categoryId:   category.id,
        name:         lift.name,
        serialNumber: lift.serialNumber,
        notes:        lift.notes,
        status:       'available',
      },
    })
  }
  console.log(`  ✓ Kategoria "Podnośniki" — ${lifts.length} pozycji`)

  // Podsumowanie
  console.log('\n✅ Gotowe!')
  console.log(`   Flota: ${vehicles.length} pojazdów`)
  console.log(`   Wypożyczalnia: ${lifts.length} podnośników`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
