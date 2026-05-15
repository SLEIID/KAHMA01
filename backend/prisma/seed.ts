import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // ── Role ────────────────────────────────────────────────────────────────────
  const adminRole = await prisma.role.upsert({
    where: { name: 'admin' },
    update: {},
    create: { name: 'admin' },
  })

  await prisma.role.upsert({
    where: { name: 'pracownik' },
    update: {},
    create: { name: 'pracownik' },
  })

  // ── Konto admina ─────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('admin1234', 12)
  await prisma.user.upsert({
    where: { login: 'admin' },
    update: {},
    create: {
      login: 'admin',
      passwordHash,
      fullName: 'Administrator',
      roleId: adminRole.id,
      isActive: true,
    },
  })

  // ── Sprzęt — kategorie i pozycje ─────────────────────────────────────────────
  const existing = await prisma.equipmentCategory.count()
  if (existing === 0) {
    // Kategorie
    const catElektro = await prisma.equipmentCategory.create({ data: { name: 'Elektronarzędzia' } })
    const catPomiar  = await prisma.equipmentCategory.create({ data: { name: 'Sprzęt pomiarowy' } })
    const catOchrona = await prisma.equipmentCategory.create({ data: { name: 'Ochrona osobista' } })
    const catReczne  = await prisma.equipmentCategory.create({ data: { name: 'Narzędzia ręczne' } })

    // Elektronarzędzia
    await prisma.equipmentItem.createMany({
      data: [
        { categoryId: catElektro.id, name: 'Wiertarka udarowa Bosch GSB 18V', serialNumber: 'BSH-001' },
        { categoryId: catElektro.id, name: 'Szlifierka kątowa 125mm Makita',  serialNumber: 'MKT-001' },
        { categoryId: catElektro.id, name: 'Wyrzynarka Bosch PST 700',        serialNumber: 'BSH-002' },
        { categoryId: catElektro.id, name: 'Wiertarko-wkrętarka Makita DDF',  serialNumber: 'MKT-002' },
      ],
    })

    // Sprzęt pomiarowy
    await prisma.equipmentItem.createMany({
      data: [
        { categoryId: catPomiar.id, name: 'Miara laserowa Leica Disto D2', serialNumber: 'LEI-001' },
        { categoryId: catPomiar.id, name: 'Poziomnica aluminiowa 120cm Stanley' },
        { categoryId: catPomiar.id, name: 'Dalmierz laserowy Stanley' },
      ],
    })

    // Ochrona osobista
    await prisma.equipmentItem.createMany({
      data: [
        { categoryId: catOchrona.id, name: 'Kask ochronny biały' },
        { categoryId: catOchrona.id, name: 'Kask ochronny żółty' },
        { categoryId: catOchrona.id, name: 'Szelki bezpieczeństwa kompletne', serialNumber: 'SZ-001' },
      ],
    })

    // Narzędzia ręczne
    await prisma.equipmentItem.createMany({
      data: [
        { categoryId: catReczne.id, name: 'Młotek murarski 1kg' },
        { categoryId: catReczne.id, name: 'Zestaw wkrętaków Stanley (8 szt.)' },
        { categoryId: catReczne.id, name: 'Przedłużacz 20m / 3 gniazda' },
      ],
    })

    console.log('✅ Dodano 4 kategorie i 13 pozycji sprzętu.')
  } else {
    console.log('ℹ️  Sprzęt już istnieje — pominięto seed sprzętu.')
  }

  console.log('✅ Seed wykonany. Login: admin | Hasło: admin1234')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
