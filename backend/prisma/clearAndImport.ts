/**
 * Czyści historię i importuje nową bazę materiałów z "nowe towary.xlsx".
 *
 * Uruchomienie:
 *   1. docker cp "data/nowe towary.xlsx" kahma-backend:/tmp/nowe_towary.xlsx
 *   2. docker exec kahma-backend npx tsx prisma/clearAndImport.ts
 */

import { PrismaClient } from '@prisma/client'
import XLSX from 'xlsx'
import path from 'path'
import fs from 'fs'

const prisma = new PrismaClient()
const XLSX_PATH = '/tmp/nowe_towary.xlsx'

async function clearHistory() {
  console.log('\n=== CZYSZCZENIE HISTORII ===')

  // Kolejność ważna — najpierw tabele zależne (FK)
  const steps: [string, () => Promise<{ count: number }>][] = [
    ['material_alerts',    () => prisma.materialAlert.deleteMany()],
    ['material_usages',    () => prisma.materialUsage.deleteMany()],
    ['report_signatures',  () => prisma.reportSignature.deleteMany()],
    ['vehicle_usage',      () => prisma.vehicleUsage.deleteMany()],
    ['report_entries',     () => prisma.reportEntry.deleteMany()],
    ['daily_reports',      () => prisma.dailyReport.deleteMany()],
    ['equipment_issues',   () => prisma.equipmentIssue.deleteMany()],
    ['equipment_rentals',  () => prisma.equipmentRental.deleteMany()],
    ['equipment_items',    () => prisma.equipmentItem.deleteMany()],
    ['equipment_categories', () => prisma.equipmentCategory.deleteMany()],
    ['materials',          () => prisma.material.deleteMany()],
  ]

  for (const [table, fn] of steps) {
    const result = await fn()
    console.log(`  ✓ ${table}: usunięto ${result.count} wierszy`)
  }
}

async function importMaterials() {
  console.log('\n=== IMPORT MATERIAŁÓW ===')

  if (!fs.existsSync(XLSX_PATH)) {
    throw new Error(`Plik nie istnieje: ${XLSX_PATH}\nSkopiuj go: docker cp "data/nowe towary.xlsx" kahma-backend:/tmp/nowe_towary.xlsx`)
  }

  const wb = XLSX.readFile(XLSX_PATH)
  console.log(`Arkusze (${wb.SheetNames.length}): ${wb.SheetNames.join(', ')}`)

  // Zbierz wszystkie pozycje ze wszystkich arkuszy
  const toImport: { catalogNumber: string; name: string }[] = []
  const seen = new Set<string>()

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<{ Symbol: string; Nazwa: string }>(ws)

    let sheetCount = 0
    for (const row of rows) {
      const name   = row.Nazwa?.toString().trim()
      const symbol = row.Symbol?.toString().trim()

      if (!name) continue

      const key = name.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)

      toImport.push({ catalogNumber: symbol || '', name })
      sheetCount++
    }
    console.log(`  Arkusz "${sheetName}": ${sheetCount} pozycji`)
  }

  console.log(`\nDo importu łącznie: ${toImport.length} unikalnych pozycji`)

  // Batch insert
  const BATCH = 500
  let inserted = 0

  for (let i = 0; i < toImport.length; i += BATCH) {
    const batch = toImport.slice(i, i + BATCH).map(({ catalogNumber, name }) => ({
      catalogNumber: catalogNumber || null,
      name,
    }))
    const result = await prisma.material.createMany({ data: batch })
    inserted += result.count
    process.stdout.write(`\r  Wstawiono ${inserted}/${toImport.length}...`)
  }

  console.log(`\n\nImport zakończony. Wstawiono: ${inserted} rekordów.`)
}

async function main() {
  await clearHistory()
  await importMaterials()
  console.log('\n✅ Gotowe.\n')
}

main()
  .catch(err => { console.error('\n❌ Błąd:', err.message); process.exit(1) })
  .finally(() => prisma.$disconnect())
