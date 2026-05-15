/**
 * Import materiałów z towary_kategorie.xlsx do bazy danych.
 * Wyklucza: kategorię "Pozostałe materiały" i pozycje z sprzet_wypozyczalnia.xlsx
 *
 * Uruchomienie (z katalogu backend/):
 *   DATABASE_URL="postgresql://kahma_user:Kahma2026Secure@localhost:5433/kahma" \
 *   npx tsx prisma/importMaterials.ts
 */

import { PrismaClient } from '@prisma/client'
import XLSX from 'xlsx'
import path from 'path'

const prisma = new PrismaClient()

const DATA_DIR       = path.resolve(__dirname, '../../data')
const SOURCE_FILE    = path.join(DATA_DIR, 'towary_kategorie.xlsx')
const EXCLUDE_FILE   = path.join(DATA_DIR, 'sprzet_wypozyczalnia.xlsx')
const SKIP_CATEGORY  = 'Pozostałe materiały'

async function main() {
  console.log('Wczytywanie pliku źródłowego...')
  const srcWb = XLSX.readFile(SOURCE_FILE)
  const srcWs = srcWb.Sheets[srcWb.SheetNames[0]]
  const srcData = XLSX.utils.sheet_to_json<{ Nazwa: string; Kategoria: string }>(srcWs)

  console.log(`Załadowano ${srcData.length} wierszy`)

  // Wczytaj listę sprzętu do wypożyczenia (wykluczamy)
  const excWb = XLSX.readFile(EXCLUDE_FILE)
  const excWs = excWb.Sheets[excWb.SheetNames[0]]
  const excData = XLSX.utils.sheet_to_json<{ Nazwa: string }>(excWs)
  const excludeNames = new Set(excData.map(r => r.Nazwa?.trim().toLowerCase()).filter(Boolean))
  console.log(`Znaleziono ${excludeNames.size} pozycji do wykluczenia (sprzęt wypożyczalnia)`)

  // Filtruj
  const toImport: string[] = []
  const seen = new Set<string>()

  for (const row of srcData) {
    const name     = row.Nazwa?.trim()
    const category = row.Kategoria?.trim()

    if (!name) continue
    if (category === SKIP_CATEGORY) continue
    if (excludeNames.has(name.toLowerCase())) continue

    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)

    toImport.push(name)
  }

  console.log(`Po filtrowaniu: ${toImport.length} unikalnych pozycji do importu`)

  // Sprawdź ile już jest w bazie
  const existing = await prisma.material.count()
  console.log(`Aktualnie w bazie: ${existing} materiałów`)

  if (existing > 0) {
    console.log('UWAGA: baza już zawiera materiały. Pomijam duplikaty (insert ignoruje istniejące nazwy).')
  }

  // Batch insert — pomijaj duplikaty (skipDuplicates)
  const BATCH = 500
  let inserted = 0

  for (let i = 0; i < toImport.length; i += BATCH) {
    const batch = toImport.slice(i, i + BATCH).map(name => ({ name }))
    const result = await prisma.material.createMany({
      data:          batch,
      skipDuplicates: false, // brak unique constraintu na name, więc wstawiamy wszystko
    })
    inserted += result.count
    process.stdout.write(`\r  Wstawiono ${inserted}/${toImport.length}...`)
  }

  console.log(`\nImport zakończony. Wstawiono: ${inserted} rekordów.`)
}

main()
  .catch(err => { console.error(err); process.exit(1) })
  .finally(() => prisma.$disconnect())
