# Moduł 7: Faktury Sprzedażowe — Dokument Wdrożeniowy

> **Status:** Do wdrożenia  
> **Priorytet:** Wysoki  
> **Szacowany czas:** 4 tygodnie (4 fazy)  
> **Dotyczy:** Backend (Express/Prisma) + Frontend (React/Vite)

---

## 1. Kontekst i cel

Moduł faktur grupuje **raporty dnia** i **wypożyczenia sprzętu** pod jedną fakturę sprzedażową wystawioną dla konkretnego kontrahenta. Na tej podstawie system generuje automatyczną rozpiskę materiałową (z cenami) i oblicza wartość robocizny.

Dane są już w systemie — moduł tylko je agreguje. Pracownicy **nie zmieniają sposobu pracy**.

### Łańcuch powiązań

```
Kontrahent (contractors)
  └── Lokalizacja (locations.contractor_id)
        ├── Raport dnia (daily_reports) → Wpisy (report_entries)
        │     └── Zużycia materiałów (material_usages)  ← ceny z materials.unit_price
        └── Wypożyczenie sprzętu (equipment_rentals.location_id)
```

Faktura wiąże się z raportami przez `invoice_reports` i z wypożyczeniami przez `invoice_rentals`.

---

## 2. Konwencje projektu (obowiązują bezwzględnie)

- API: `{ success: true, data: {...} }` / `{ success: false, error: "..." }`
- Funkcje pomocnicze backendu: `ok(res, data)` i `created(res, data)` z `shared/response.ts`
- Błędy: `ApiError.notFound()`, `ApiError.badRequest()`, `ApiError.forbidden()`, `ApiError.conflict()`
- Każdy moduł backendu: `schemas.ts` → `service.ts` → `controller.ts` → `routes.ts`
- Rejestracja routera w `backend/src/index.ts`
- Zakładka nawigacyjna: dodać w `frontend/src/layouts/AppLayout.tsx` w tablicy `navItems` (adminOnly: true)
- Trasa React Router: dodać w `frontend/src/router/index.tsx` opakowana w `<RequireAdmin>`
- Styl: paleta "Sapphire Navy" — `#0c1e3c` sidebar, `#2761eb` primary, `#edf2fb` tło
- Komponenty UI: Button, Input, Select, Badge, Modal, Spinner z `@/components/ui/`
- Migracje: automatycznie przy starcie kontenera (`prisma migrate deploy`)

---

## 3. Model danych

### 3.1 Zmiany na istniejących tabelach

```sql
-- Cena jednostkowa materiału (0 = brak ceny, łatwe do filtrowania)
ALTER TABLE materials
  ADD COLUMN unit_price DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Flaga zafakturowania na raportach
ALTER TABLE daily_reports
  ADD COLUMN is_invoiced BOOLEAN NOT NULL DEFAULT false;

-- Flaga zafakturowania na wypożyczeniach
ALTER TABLE equipment_rentals
  ADD COLUMN is_invoiced BOOLEAN NOT NULL DEFAULT false;
```

### 3.2 Nowe tabele

```sql
-- Singleton ustawień modułu faktur (zawsze 1 wiersz, id=1)
CREATE TABLE invoice_settings (
  id            SERIAL PRIMARY KEY,
  prefix        VARCHAR(20)   NOT NULL DEFAULT 'FV',
  pattern       VARCHAR(30)   NOT NULL DEFAULT 'PREFIX/YYYY/MM/NNN',
  -- Dozwolone wzorce:
  --   'PREFIX/YYYY/MM/NNN'  → FV/2026/05/001  (reset: miesięcznie)
  --   'PREFIX/YYYY/NNN'     → FV/2026/001      (reset: rocznie)
  --   'YYYY/MM/NNN'         → 2026/05/001      (reset: miesięcznie)
  --   'YYYY/NNN'            → 2026/001         (reset: rocznie)
  --   'MANUAL'              → admin wpisuje ręcznie (brak auto-numeru)
  reset_period  VARCHAR(10)   NOT NULL DEFAULT 'monthly',
  -- 'monthly' | 'yearly' | 'never'
  next_number   INT           NOT NULL DEFAULT 1,
  labor_rate    DECIMAL(10,2) NOT NULL DEFAULT 0
  -- domyślna stawka robocizny PLN/h dla nowych faktur
);

CREATE TABLE invoices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type            VARCHAR(10)   NOT NULL DEFAULT 'sale',
  -- 'sale' = sprzedażowa | 'purchase' = zakupowa (przyszłość, nie wdrażamy teraz)
  contractor_id   UUID          NOT NULL REFERENCES contractors(id),
  invoice_number  VARCHAR(100)  UNIQUE NOT NULL,
  status          VARCHAR(20)   NOT NULL DEFAULT 'draft',
  -- 'draft' | 'issued' | 'paid' | 'cancelled'
  issued_at       DATE          NOT NULL,
  due_at          DATE,
  labor_rate      DECIMAL(10,2) NOT NULL DEFAULT 0,
  -- stawka PLN/h dla tej konkretnej faktury (kopiowana z invoice_settings przy tworzeniu)
  notes           TEXT,
  created_by      UUID          NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE TABLE invoice_reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id  UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  report_id   UUID NOT NULL REFERENCES daily_reports(id),
  UNIQUE(invoice_id, report_id)
);

CREATE TABLE invoice_rentals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id  UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  rental_id   UUID NOT NULL REFERENCES equipment_rentals(id),
  UNIQUE(invoice_id, rental_id)
);
```

### 3.3 Prisma schema — nowe modele (dodać do schema.prisma)

```prisma
model InvoiceSettings {
  id          Int     @id @default(autoincrement())
  prefix      String  @default("FV") @db.VarChar(20)
  pattern     String  @default("PREFIX/YYYY/MM/NNN") @db.VarChar(30)
  resetPeriod String  @default("monthly") @map("reset_period") @db.VarChar(10)
  nextNumber  Int     @default(1) @map("next_number")
  laborRate   Decimal @default(0) @map("labor_rate") @db.Decimal(10, 2)

  @@map("invoice_settings")
}

model Invoice {
  id             String    @id @default(uuid())
  type           String    @default("sale") @db.VarChar(10)
  contractorId   String    @map("contractor_id")
  invoiceNumber  String    @unique @map("invoice_number") @db.VarChar(100)
  status         String    @default("draft") @db.VarChar(20)
  issuedAt       DateTime  @map("issued_at") @db.Date
  dueAt          DateTime? @map("due_at") @db.Date
  laborRate      Decimal   @default(0) @map("labor_rate") @db.Decimal(10, 2)
  notes          String?
  createdBy      String    @map("created_by")
  createdAt      DateTime  @default(now()) @map("created_at")
  updatedAt      DateTime  @updatedAt @map("updated_at")

  contractor     Contractor       @relation(fields: [contractorId], references: [id])
  creator        User             @relation("InvoiceCreator", fields: [createdBy], references: [id])
  invoiceReports InvoiceReport[]
  invoiceRentals InvoiceRental[]

  @@map("invoices")
}

model InvoiceReport {
  id         String      @id @default(uuid())
  invoiceId  String      @map("invoice_id")
  reportId   String      @map("report_id")

  invoice    Invoice     @relation(fields: [invoiceId], references: [id], onDelete: Cascade)
  report     DailyReport @relation(fields: [reportId], references: [id])

  @@unique([invoiceId, reportId])
  @@map("invoice_reports")
}

model InvoiceRental {
  id         String         @id @default(uuid())
  invoiceId  String         @map("invoice_id")
  rentalId   String         @map("rental_id")

  invoice    Invoice        @relation(fields: [invoiceId], references: [id], onDelete: Cascade)
  rental     EquipmentRental @relation(fields: [rentalId], references: [id])

  @@unique([invoiceId, rentalId])
  @@map("invoice_rentals")
}
```

### 3.4 Zmiany w istniejących modelach Prisma

```prisma
// W modelu Material — dodać:
unitPrice  Decimal  @default(0) @map("unit_price") @db.Decimal(10, 2)

// W modelu DailyReport — dodać:
isInvoiced Boolean  @default(false) @map("is_invoiced")
invoiceReports InvoiceReport[]

// W modelu EquipmentRental — dodać:
isInvoiced Boolean  @default(false) @map("is_invoiced")
invoiceRentals InvoiceRental[]

// W modelu Contractor — dodać:
invoices Invoice[]

// W modelu User — dodać:
createdInvoices Invoice[] @relation("InvoiceCreator")
```

### 3.5 Plik migracji

Nazwa: `20260515000000_add_invoices`

Plik migracji zawiera: CREATE TABLE invoice_settings (z INSERT INTO invoice_settings DEFAULT VALUES), ALTER TABLE materials, ALTER TABLE daily_reports, ALTER TABLE equipment_rentals, CREATE TABLE invoices, CREATE TABLE invoice_reports, CREATE TABLE invoice_rentals.

---

## 4. Backend — API

### 4.1 Struktura plików

```
backend/src/modules/
  invoices/
    invoices.schemas.ts
    invoices.service.ts
    invoices.controller.ts
    invoices.routes.ts
  invoiceSettings/
    invoiceSettings.schemas.ts
    invoiceSettings.service.ts
    invoiceSettings.controller.ts
    invoiceSettings.routes.ts
```

### 4.2 Endpointy — Invoice Settings `/api/v1/invoice-settings`

Wszystkie tylko dla admina.

| Metoda | Endpoint | Opis |
|--------|----------|------|
| GET    | `/`      | Pobierz ustawienia (singleton) — tworzy wiersz jeśli brak |
| PATCH  | `/`      | Zaktualizuj ustawienia (prefix, pattern, resetPeriod, laborRate) |

**Logika get-or-create:** `prisma.invoiceSettings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} })`

**Walidacja PATCH (`updateSettingsSchema`):**
```typescript
z.object({
  prefix:      z.string().min(1).max(20).optional(),
  pattern:     z.enum(['PREFIX/YYYY/MM/NNN','PREFIX/YYYY/NNN','YYYY/MM/NNN','YYYY/NNN','MANUAL']).optional(),
  resetPeriod: z.enum(['monthly','yearly','never']).optional(),
  laborRate:   z.coerce.number().min(0).optional(),
})
```

**Logika generowania numeru FV** (`generateInvoiceNumber(settings)` — wywołać wewnątrz `$transaction`):
```
1. Pobierz aktualne settings (SELECT FOR UPDATE — Prisma: $queryRaw lub $transaction)
2. Zbuduj numer wg wzorca:
   - PREFIX/YYYY/MM/NNN: `${prefix}/${year}/${month}/${pad(nextNumber, 3)}`
   - PREFIX/YYYY/NNN:    `${prefix}/${year}/${pad(nextNumber, 3)}`
   - YYYY/MM/NNN:        `${year}/${month}/${pad(nextNumber, 3)}`
   - YYYY/NNN:           `${year}/${pad(nextNumber, 3)}`
   - MANUAL:             zwróć null (caller musi podać numer ręcznie)
3. Inkrementuj next_number
4. Jeśli reset_period = 'monthly': sprawdź czy miesiąc/rok się zmienił od poprzedniego numeru
   — jeśli tak, zresetuj next_number do 1 przed inkrementacją
   (Najprostsze: trzymać last_reset_at TIMESTAMPTZ w settings i porównywać)
5. Zapisz zaktualizowane next_number
```

Uwaga: logika resetu licznika może być uproszczona w V1 — można zresetować ręcznie przez PATCH settings z `next_number`.

### 4.3 Endpointy — Invoices `/api/v1/invoices`

Wszystkie tylko dla admina.

| Metoda | Endpoint | Opis |
|--------|----------|------|
| GET    | `/`                        | Lista faktur z filtrami |
| GET    | `/:id`                     | Szczegóły faktury z rozpiską |
| POST   | `/`                        | Utwórz fakturę (szkic) |
| PATCH  | `/:id`                     | Edytuj fakturę (tylko draft) |
| PATCH  | `/:id/status`              | Zmień status (issued/paid/cancelled) |
| POST   | `/:id/reports`             | Dodaj raport do faktury |
| DELETE | `/:id/reports/:reportId`   | Usuń raport z faktury |
| POST   | `/:id/rentals`             | Dodaj wypożyczenie do faktury |
| DELETE | `/:id/rentals/:rentalId`   | Usuń wypożyczenie z faktury |
| GET    | `/:id/export`              | Eksport XLSX (blob) |
| GET    | `/unmatched`               | Niezafakturowane raporty per kontrahent (dashboard) |

### 4.4 Schematy walidacji (`invoices.schemas.ts`)

```typescript
export const createInvoiceSchema = z.object({
  contractorId:  z.string().uuid(),
  invoiceNumber: z.string().min(1).max(100).optional(), // wymagane gdy pattern=MANUAL
  issuedAt:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dueAt:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  laborRate:     z.coerce.number().min(0).optional(),
  notes:         z.string().optional(),
})

export const updateInvoiceSchema = z.object({
  issuedAt:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dueAt:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  laborRate: z.coerce.number().min(0).optional(),
  notes:     z.string().nullable().optional(),
})

export const updateStatusSchema = z.object({
  status: z.enum(['issued', 'paid', 'cancelled']),
})

export const addReportSchema = z.object({
  reportId: z.string().uuid(),
})

export const addRentalSchema = z.object({
  rentalId: z.string().uuid(),
})

export const listInvoicesSchema = z.object({
  status:       z.enum(['draft','issued','paid','cancelled']).optional(),
  contractorId: z.string().uuid().optional(),
  from:         z.string().optional(),
  to:           z.string().optional(),
})
```

### 4.5 Logika serwisu (`invoices.service.ts`)

#### Select do fetchowania faktur

```typescript
const invoiceSelect = {
  id: true,
  type: true,
  invoiceNumber: true,
  status: true,
  issuedAt: true,
  dueAt: true,
  laborRate: true,
  notes: true,
  createdAt: true,
  contractor: { select: { id: true, name: true, nip: true, city: true, street: true, buildingNumber: true, postalCode: true, isVatPayer: true } },
  creator: { select: { id: true, fullName: true } },
  invoiceReports: {
    select: {
      id: true,
      report: {
        select: {
          id: true,
          reportDate: true,
          isInvoiced: true,
          user: { select: { id: true, fullName: true } },
          entries: {
            select: {
              id: true,
              workStart: true,
              workEnd: true,
              location: { select: { id: true, name: true } },
              description: true,
              materialUsages: {
                select: {
                  id: true,
                  quantity: true,
                  unit: true,
                  material: { select: { id: true, name: true, unitPrice: true } },
                },
              },
            },
          },
        },
      },
    },
  },
  invoiceRentals: {
    select: {
      id: true,
      rental: {
        select: {
          id: true,
          rentedAt: true,
          returnedAt: true,
          location: { select: { id: true, name: true } },
          item: { select: { id: true, name: true, category: { select: { name: true } } } },
          user: { select: { id: true, fullName: true } },
        },
      },
    },
  },
} as const
```

#### `create(userId, dto)` — tworzenie faktury

```
1. Sprawdź czy contractor istnieje
2. Pobierz invoice_settings (upsert)
3. Generuj numer FV wg wzorca (w $transaction z inkrementacją next_number)
   - jeśli pattern=MANUAL: dto.invoiceNumber musi być podany (walidacja przed)
   - jeśli auto: zignoruj dto.invoiceNumber
4. Sprawdź unikalność numeru (Prisma P2002 → 409 Conflict)
5. Utwórz Invoice z laborRate z dto lub z settings.laborRate
```

#### `addReport(invoiceId, reportId)` — dodanie raportu

```
1. Pobierz fakturę — sprawdź status === 'draft' (400 jeśli nie)
2. Pobierz raport — sprawdź czy report.isInvoiced === false (409 "Raport jest już przypisany do innej faktury")
3. Sprawdź czy report.location.contractor_id === invoice.contractor_id
   dla każdego entry raportu — ostrzeżenie jeśli niezgodność (nie blokuj, ale zanotuj)
4. W $transaction:
   - prisma.invoiceReport.create({ data: { invoiceId, reportId } })
   - prisma.dailyReport.update({ where: { id: reportId }, data: { isInvoiced: true } })
```

#### `removeReport(invoiceId, reportId)` — usunięcie raportu

```
1. Sprawdź status faktury === 'draft'
2. W $transaction:
   - prisma.invoiceReport.delete(...)
   - prisma.dailyReport.update({ data: { isInvoiced: false } })
```

#### `addRental(invoiceId, rentalId)` — analogicznie do addReport

```
1. Sprawdź status === 'draft'
2. Sprawdź rental.isInvoiced === false (409 jeśli już zafakturowane)
3. Sprawdź rental.returnedAt !== null (400 "Wypożyczenie nie zostało zwrócone")
4. W $transaction: utwórz invoice_rental + ustaw rental.isInvoiced = true
```

#### `removeRental(invoiceId, rentalId)` — analogicznie

#### `updateStatus(invoiceId, newStatus)` — zmiana statusu

```
Dozwolone przejścia:
  draft → issued
  issued → paid
  issued → cancelled
  draft → cancelled

Przy przejściu draft → issued:
  - Sprawdź czy faktura ma co najmniej 1 raport lub 1 wypożyczenie (400 jeśli pusta)

Przy przejściu * → cancelled:
  - W $transaction:
    - zaktualizuj invoice.status = 'cancelled'
    - ustaw isInvoiced = false na wszystkich powiązanych raportach
    - ustaw isInvoiced = false na wszystkich powiązanych wypożyczeniach
```

#### `getBreakdown(invoice)` — agregacja do rozpiski (helper)

Wywołany wewnątrz getById i export. Zwraca:

```typescript
{
  materials: {
    materialId: number
    name: string
    totalQuantity: Decimal   // suma z wszystkich wpisów
    unit: string             // jednostka (bierzemy z pierwszego wpisu — materiał ma jedną jednostkę)
    unitPrice: Decimal
    totalValue: Decimal      // totalQuantity * unitPrice
    hasPrice: boolean        // unitPrice > 0
  }[]
  laborHours: number         // suma godzin ze wszystkich wpisów
  laborValue: Decimal        // laborHours * invoice.laborRate
  rentals: {
    rentalId: string
    itemName: string
    categoryName: string
    userName: string
    locationName: string
    rentedAt: Date
    returnedAt: Date
    durationHours: number
  }[]
  totalMaterialValue: Decimal   // suma totalValue (tylko gdzie hasPrice=true)
  grandTotal: Decimal           // totalMaterialValue + laborValue
}
```

**Logika sumowania godzin:**
```typescript
function calcHours(workStart: string, workEnd: string): number {
  const [sh, sm] = workStart.split(':').map(Number)
  const [eh, em] = workEnd.split(':').map(Number)
  return ((eh * 60 + em) - (sh * 60 + sm)) / 60
}
```

#### `exportXlsx(invoiceId)` — eksport XLSX (SheetJS)

Trzy arkusze:

**Arkusz 1 — "Faktura"**
Nagłówek faktury: numer, data wystawienia, termin płatności, kontrahent (nazwa, NIP, adres), uwagi. Wartości zbiorcze: suma materiałów, robocizna (h × stawka), suma ogółem.

**Arkusz 2 — "Materiały"**
Kolumny: Materiał | Ilość | Jednostka | Cena jedn. (zł) | Wartość netto (zł) | Uwaga
Wiersze z `unitPrice = 0` mają wartość "—" i adnotację "brak ceny".

**Arkusz 3 — "Szczegóły prac"**
Kolumny: Data | Pracownik | Lokalizacja | Opis | Od | Do | Godziny | Materiały (skrót)
Jeden wiersz per wpis (entry) ze wszystkich przypiętych raportów.

#### `getUnmatched()` — niezafakturowane raporty per kontrahent

```typescript
// Zwraca pogrupowane dane dla dashboardu:
// Dla każdego kontrahenta: liczba niezafakturowanych raportów, łączne godziny
const reports = await prisma.dailyReport.findMany({
  where: { isInvoiced: false, entries: { some: {} } },
  include: {
    entries: { include: { location: { include: { contractor: true } }, materialUsages: true } },
    user: { select: { id: true, fullName: true } },
  },
})
// Grupuj po contractor z pierwszego entry raportu
```

### 4.6 Dostęp — wszystkie endpointy tylko admin

W routes.ts: `router.use(authenticate, authorize('admin'))`

---

## 5. Frontend

### 5.1 API client (`frontend/src/api/invoices.api.ts`)

```typescript
import client from './client'

export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'cancelled'
export type InvoicePattern = 'PREFIX/YYYY/MM/NNN' | 'PREFIX/YYYY/NNN' | 'YYYY/MM/NNN' | 'YYYY/NNN' | 'MANUAL'

export interface InvoiceSettings {
  id: number
  prefix: string
  pattern: InvoicePattern
  resetPeriod: 'monthly' | 'yearly' | 'never'
  nextNumber: number
  laborRate: number
}

export interface InvoiceMaterialLine {
  materialId: number
  name: string
  totalQuantity: number
  unit: string
  unitPrice: number
  totalValue: number
  hasPrice: boolean
}

export interface InvoiceRentalLine {
  rentalId: string
  itemName: string
  categoryName: string
  userName: string
  locationName: string
  rentedAt: string
  returnedAt: string
  durationHours: number
}

export interface InvoiceBreakdown {
  materials: InvoiceMaterialLine[]
  laborHours: number
  laborValue: number
  rentals: InvoiceRentalLine[]
  totalMaterialValue: number
  grandTotal: number
}

export interface InvoiceReport {
  id: string
  report: {
    id: string
    reportDate: string
    user: { id: string; fullName: string }
    entries: {
      id: string
      workStart: string
      workEnd: string
      location: { id: number; name: string }
      description: string
    }[]
  }
}

export interface InvoiceRental {
  id: string
  rental: {
    id: string
    rentedAt: string
    returnedAt: string | null
    location: { id: number; name: string }
    item: { id: number; name: string; category: { name: string } }
    user: { id: string; fullName: string }
  }
}

export interface Invoice {
  id: string
  type: string
  invoiceNumber: string
  status: InvoiceStatus
  issuedAt: string
  dueAt: string | null
  laborRate: number
  notes: string | null
  createdAt: string
  contractor: {
    id: string; name: string; nip: string | null; city: string | null
    street: string | null; buildingNumber: string | null; postalCode: string | null
    isVatPayer: boolean
  }
  creator: { id: string; fullName: string }
  invoiceReports: InvoiceReport[]
  invoiceRentals: InvoiceRental[]
  breakdown?: InvoiceBreakdown
}

type Resp<T> = { success: true; data: T }

export const invoiceSettingsApi = {
  get: () =>
    client.get<Resp<InvoiceSettings>>('/invoice-settings'),
  update: (payload: Partial<Omit<InvoiceSettings, 'id' | 'nextNumber'>>) =>
    client.patch<Resp<InvoiceSettings>>('/invoice-settings', payload),
}

export const invoicesApi = {
  list: (params?: { status?: InvoiceStatus; contractorId?: string; from?: string; to?: string }) =>
    client.get<Resp<Invoice[]>>('/invoices', { params }),

  getById: (id: string) =>
    client.get<Resp<Invoice>>(`/invoices/${id}`),

  create: (payload: {
    contractorId: string; invoiceNumber?: string; issuedAt: string
    dueAt?: string; laborRate?: number; notes?: string
  }) =>
    client.post<Resp<Invoice>>('/invoices', payload),

  update: (id: string, payload: { issuedAt?: string; dueAt?: string | null; laborRate?: number; notes?: string | null }) =>
    client.patch<Resp<Invoice>>(`/invoices/${id}`, payload),

  updateStatus: (id: string, status: 'issued' | 'paid' | 'cancelled') =>
    client.patch<Resp<Invoice>>(`/invoices/${id}/status`, { status }),

  addReport: (id: string, reportId: string) =>
    client.post<Resp<Invoice>>(`/invoices/${id}/reports`, { reportId }),

  removeReport: (id: string, reportId: string) =>
    client.delete(`/invoices/${id}/reports/${reportId}`),

  addRental: (id: string, rentalId: string) =>
    client.post<Resp<Invoice>>(`/invoices/${id}/rentals`, { rentalId }),

  removeRental: (id: string, rentalId: string) =>
    client.delete(`/invoices/${id}/rentals/${rentalId}`),

  exportXlsx: (id: string) =>
    client.get(`/invoices/${id}/export`, { responseType: 'blob' }),

  getUnmatched: () =>
    client.get<Resp<{ contractorId: string; contractorName: string; reportCount: number; totalHours: number }[]>>('/invoices/unmatched'),
}
```

### 5.2 Strona główna — `/admin/faktury` (`InvoicesPage.tsx`)

**Lokalizacja:** `frontend/src/pages/invoices/InvoicesPage.tsx`

**Trasa:** `<Route path="/admin/faktury" element={<RequireAdmin><InvoicesPage /></RequireAdmin>} />`

**NavItem w AppLayout.tsx:**
```typescript
{ path: '/admin/faktury', label: 'Faktury', icon: Receipt, adminOnly: true }
```
(ikona `Receipt` z lucide-react)

**Layout strony:**

```
[Nagłówek: "Faktury sprzedażowe"]    [Przycisk: + Nowa faktura]

[Filtry: status (All/Draft/Issued/Paid/Cancelled) | kontrahent | zakres dat]

[Lista faktur — karty]
  Karta faktury:
    - Numer FV | Status badge | Data wystawienia | Termin płatności
    - Kontrahent (nazwa)
    - Liczba raportów + liczba wypożyczeń
    - Wartość ogółem (z rozpiski)
    - Przycisk "Otwórz"

[Sekcja dashboard — niezafakturowane]
  "Niezafakturowane" — karty per kontrahent:
    Kontrahent | Liczba raportów | Łączne godziny
```

**Status badges:**
- `draft` → badge szary "Szkic"
- `issued` → badge niebieski "Wystawiona"
- `paid` → badge zielony "Zapłacona"
- `cancelled` → badge czerwony "Anulowana"

### 5.3 Szczegóły faktury / kreator (`InvoiceDetailPage.tsx` lub modal)

**Rekomendacja:** Osobna strona `/admin/faktury/:id`, nie modal — ze względu na złożoność.

**Sekcje strony:**

#### Nagłówek faktury
- Numer FV, status, kontrahent
- Data wystawienia, termin płatności, uwagi
- Stawka robocizny
- Przyciski zmiany statusu (zależnie od aktualnego statusu):
  - `draft`: [Wystaw fakturę] [Anuluj]
  - `issued`: [Oznacz jako zapłaconą] [Anuluj fakturę]
  - `paid/cancelled`: brak akcji
- Przycisk [Eksportuj XLSX] — zawsze widoczny

#### Panel — Raporty dnia
```
[Przycisk: + Dodaj raport]  (tylko dla draft)

Lista dodanych raportów:
  Karta raportu: data | pracownik | liczba wpisów | godziny | lokalizacje
  [Usuń] (tylko draft)
```

**Modal dodawania raportu:**
- Filtr: kontrahent (pre-filled z faktury) → lokalizacje → zakres dat
- Lista raportów `isInvoiced = false` z lokalizacji tego kontrahenta
- Kliknięcie → `invoicesApi.addReport(invoiceId, reportId)`

#### Panel — Wypożyczenia sprzętu
```
[Przycisk: + Dodaj wypożyczenie]  (tylko draft)

Lista dodanych wypożyczeń:
  Karta: urządzenie | pracownik | lokalizacja | od–do | czas trwania
  [Usuń] (tylko draft)
```

**Modal dodawania wypożyczenia:**
- Filtr: lokalizacje kontrahenta + zakres dat
- Lista zwróconych wypożyczeń (`isInvoiced = false, returnedAt != null`) z tych lokalizacji
- Kliknięcie → `invoicesApi.addRental(invoiceId, rentalId)`

#### Panel — Rozpiska (zawsze widoczna)
```
MATERIAŁY
┌─────────────────────────────────────────────────────────────┐
│ Materiał        │ Ilość │ Jedn │ Cena jedn │ Wartość netto  │
│ Kabel YKY 3×2,5 │ 45,5  │ mb   │  4,20 zł  │   191,10 zł   │
│ ⚠ Śruby M6×30  │  200  │ szt  │  — brak —  │       —       │
└─────────────────────────────────────────────────────────────┘
Suma materiałów: 278,70 zł  (⚠ 2 materiały bez ceny)

ROBOCIZNA
18,5 h × 80,00 zł/h = 1 480,00 zł

SPRZĘT
Podnośnik 12m · Jan Kowalski · Budowa Mława · 8h

RAZEM NETTO: 1 758,70 zł
```

Materiały z `unitPrice = 0` wyróżnione kolorem amber + ikona ⚠.

### 5.4 Kreator nowej faktury (modal `NewInvoiceModal`)

**Pola:**
1. Kontrahent (select z listy aktywnych kontrahentów)
2. Numer FV:
   - Jeśli `pattern !== 'MANUAL'`: pole disabled z podglądem "Zostanie wygenerowany automatycznie: FV/2026/05/001"
   - Jeśli `pattern === 'MANUAL'`: pole tekstowe wymagane
3. Data wystawienia (date input, domyślnie dziś)
4. Termin płatności (date input, opcjonalne)
5. Stawka robocizny (number input, domyślnie z invoice_settings.laborRate)
6. Uwagi (textarea, opcjonalne)

**Po zapisie:** navigate do `/admin/faktury/:newId`

### 5.5 Ustawienia faktury (`InvoiceSettingsModal`)

Dostępny przez przycisk ⚙ na stronie `/admin/faktury`.

**Pola:**
- Prefix (text input) — nieaktywne gdy pattern nie zawiera PREFIX
- Wzorzec numerowania (select z 5 opcji + podgląd wygenerowanego numeru)
- Reset licznika (select: miesięcznie / rocznie / nigdy) — nieaktywne dla MANUAL
- Domyślna stawka robocizny (number input)

### 5.6 Zmiany w istniejących plikach

#### `MaterialsPage.tsx` (AdminView)
Dodać pole `unit_price` w formularzu dodawania/edycji materiału:
- Input `Cena jednostkowa (zł)` — number, min 0, step 0.01, domyślnie 0
- Filtr "brak ceny" (checkbox) — pokazuje tylko `unitPrice === 0`

#### `materials.api.ts`
- Dodać `unitPrice: number` do interfejsu `Material`
- Dodać `unitPrice?: number` do payloadów create i update

#### `ReportForm.tsx`
- Na karcie raportu (w sekcji nagłówka) dodać badge gdy `report.isInvoiced === true`:
  ```tsx
  {report.isInvoiced && (
    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
      style={{ background: t.blue.bg, color: t.blue.text }}>
      Zafakturowany
    </span>
  )}
  ```
- Typ `Report` w `reports.api.ts`: dodać `isInvoiced: boolean`

#### `equipment.api.ts`
- Typ `EquipmentRental`: dodać `isInvoiced: boolean`

---

## 6. Szczegółowy plan wdrożenia

### Faza 1 — Fundament danych (Backend)

**Cel:** Migracje + ustawienia + generowanie numeru FV

Kroki:
1. Utwórz plik migracji `20260515000000_add_invoices` z całym SQL z sekcji 3.
2. Zaktualizuj `schema.prisma`: nowe modele + zmiany w istniejących.
3. Utwórz moduł `backend/src/modules/invoiceSettings/`:
   - `invoiceSettings.schemas.ts` — `updateSettingsSchema`
   - `invoiceSettings.service.ts` — `getSettings()`, `updateSettings()`, `generateInvoiceNumber()` (wewnątrz `$transaction`)
   - `invoiceSettings.controller.ts` — `getHandler`, `updateHandler`
   - `invoiceSettings.routes.ts` — GET `/`, PATCH `/` (authenticate + authorize('admin'))
4. Zarejestruj router w `index.ts`: `app.use('/api/v1/invoice-settings', invoiceSettingsRouter)`
5. Przetestuj: `GET /api/v1/invoice-settings` → 200 z domyślnymi wartościami

### Faza 2 — Logika faktur (Backend)

**Cel:** Pełne CRUD faktur + dyspozycja raportami/wypożyczeniami + eksport

Kroki:
1. Utwórz moduł `backend/src/modules/invoices/`:
   - `invoices.schemas.ts` — wszystkie schematy z sekcji 4.4
   - `invoices.service.ts` — wszystkie funkcje z sekcji 4.5
   - `invoices.controller.ts` — handlery dla każdego endpointu
   - `invoices.routes.ts` — pełny routing z sekcji 4.3

2. W `invoices.service.ts` zaimplementuj w kolejności:
   - `list(query)` — `findMany` z `invoiceSelect` (lean — bez breakdown), filtry
   - `getById(id)` — `findUnique` + wywołaj `getBreakdown(invoice)`
   - `create(userId, dto)` — z logiką generowania numeru
   - `update(id, dto)` — tylko draft
   - `addReport(id, reportId)` — z transakcją
   - `removeReport(id, reportId)` — z transakcją
   - `addRental(id, rentalId)` — z transakcją
   - `removeRental(id, rentalId)` — z transakcją
   - `updateStatus(id, status)` — z logiką przejść i transakcją przy cancel
   - `getBreakdown(invoice)` — agregacja materiałów i godzin
   - `exportXlsx(id)` — SheetJS, 3 arkusze
   - `getUnmatched()` — pogrupowane niezafakturowane

3. Zarejestruj router w `index.ts`: `app.use('/api/v1/invoices', invoicesRouter)`

4. **WAŻNE — kolejność routów w invoices.routes.ts:**
   ```
   GET /unmatched   ← PRZED /:id !
   GET /
   GET /:id
   POST /
   PATCH /:id
   PATCH /:id/status
   POST /:id/reports
   DELETE /:id/reports/:reportId
   POST /:id/rentals
   DELETE /:id/rentals/:rentalId
   GET /:id/export  ← PRZED /:id ale po /unmatched
   ```

5. Przetestuj wszystkie endpointy (curl lub Postman)

### Faza 3 — Frontend — Panel faktur

**Cel:** Kompletny UI dla admina

Kroki:
1. Utwórz `frontend/src/api/invoices.api.ts` z pełnym klientem (sekcja 5.1)
2. Utwórz `frontend/src/pages/invoices/InvoicesPage.tsx`:
   - Lista faktur z filtrami statusu
   - Sekcja "Niezafakturowane" per kontrahent
   - Modal `NewInvoiceModal` — tworzenie faktury
3. Utwórz `frontend/src/pages/invoices/InvoiceDetailPage.tsx`:
   - Nagłówek z akcjami statusów
   - Panel raportów (lista + modal dodawania)
   - Panel wypożyczeń (lista + modal dodawania)
   - Panel rozpiski materiałowej
   - Eksport XLSX
4. Dodaj trasę w `router/index.tsx`:
   ```tsx
   <Route path="/admin/faktury" element={<RequireAdmin><InvoicesPage /></RequireAdmin>} />
   <Route path="/admin/faktury/:id" element={<RequireAdmin><InvoiceDetailPage /></RequireAdmin>} />
   ```
5. Dodaj navItem w `AppLayout.tsx`:
   ```typescript
   { path: '/admin/faktury', label: 'Faktury', icon: Receipt, adminOnly: true }
   ```

### Faza 4 — Integracja i ceny materiałów

**Cel:** Badge na raportach, ceny materiałów, ustawienia

Kroki:
1. Zaktualizuj `materials.api.ts` — dodaj `unitPrice` do typów
2. Zaktualizuj `MaterialsPage.tsx`:
   - Dodaj pole `Cena jedn. (zł)` w formularzu dodawania/edycji materiału
   - Dodaj filtr "Brak ceny" w AdminMaterialsList
3. Zaktualizuj `reports.api.ts` — dodaj `isInvoiced: boolean` do typu `Report`
4. Zaktualizuj `ReportForm.tsx` — badge "Zafakturowany" na nagłówku raportu
5. Zaktualizuj `equipment.api.ts` — dodaj `isInvoiced: boolean` do `EquipmentRental`
6. Dodaj modal `InvoiceSettingsModal` dostępny przez ⚙ na `/admin/faktury`
7. Przebuduj i wdróż: `docker compose build kahma-backend kahma-frontend && docker compose up -d`

---

## 7. Reguły biznesowe (lista kontrolna przed implementacją)

- [ ] Faktura może być edytowana (raporty/wypożyczenia/pola) tylko w statusie `draft`
- [ ] Raport może być przypisany do maksymalnie jednej aktywnej faktury (`isInvoiced = true`)
- [ ] Wypożyczenie może być przypisane do maksymalnie jednej aktywnej faktury
- [ ] Wypożyczenie musi być zwrócone (`returnedAt != null`) przed przypisaniem do FV
- [ ] Przejście `draft → issued` wymaga min. 1 przypiętego raportu lub 1 wypożyczenia
- [ ] Dozwolone przejścia statusów: `draft→issued`, `draft→cancelled`, `issued→paid`, `issued→cancelled`
- [ ] Przy anulowaniu: flagi `isInvoiced` cofają się na wszystkich powiązanych dokumentach
- [ ] Numer FV jest unikalny globalnie (Prisma P2002 → HTTP 409)
- [ ] Numer FV generowany atomowo (w `$transaction`) — bezpieczne przy równoległych żądaniach
- [ ] Materiały z `unitPrice = 0` pokazywane w rozpiskiej ale NIE wliczane do `grandTotal`
- [ ] Robocizna = 0 jeśli `invoice.laborRate = 0` (nie blokuj wystawienia)
- [ ] `getUnmatched` zwraca tylko raporty mające co najmniej 1 wpis (pomija puste)

---

## 8. Obsługa błędów

| Sytuacja | HTTP | Komunikat |
|----------|------|-----------|
| Raport już zafakturowany | 409 | "Raport jest już przypisany do innej faktury" |
| Wypożyczenie już zafakturowane | 409 | "Wypożyczenie jest już przypisane do innej faktury" |
| Wypożyczenie niezwrócone | 400 | "Wypożyczenie nie zostało jeszcze zwrócone" |
| Edycja faktury nie-draft | 400 | "Tylko faktury w statusie szkic można edytować" |
| Niedozwolone przejście statusu | 400 | "Niedozwolone przejście statusu z X do Y" |
| Faktura pusta przy wydaniu | 400 | "Faktura musi zawierać co najmniej jeden raport lub wypożyczenie" |
| Duplikat numeru FV | 409 | "Faktura o tym numerze już istnieje" |
| Faktura nie istnieje | 404 | "Faktura nie istnieje" |

---

## 9. Kolejność implementacji (skrót dla Claude Code)

```
KROK 1: Migracja bazy
  → plik: backend/prisma/migrations/20260515000000_add_invoices/migration.sql
  → plik: backend/prisma/schema.prisma (dodaj modele + zmodyfikuj istniejące)

KROK 2: Backend — invoice_settings
  → backend/src/modules/invoiceSettings/{schemas,service,controller,routes}.ts
  → backend/src/index.ts (rejestracja routera)

KROK 3: Backend — invoices (service najpierw, controller potem)
  → backend/src/modules/invoices/{schemas,service,controller,routes}.ts
  → backend/src/index.ts (rejestracja routera)

KROK 4: Frontend — API client
  → frontend/src/api/invoices.api.ts

KROK 5: Frontend — strona listy faktur
  → frontend/src/pages/invoices/InvoicesPage.tsx

KROK 6: Frontend — strona szczegółów faktury
  → frontend/src/pages/invoices/InvoiceDetailPage.tsx

KROK 7: Frontend — routing i nawigacja
  → frontend/src/router/index.tsx
  → frontend/src/layouts/AppLayout.tsx

KROK 8: Integracja z istniejącymi modułami
  → frontend/src/api/materials.api.ts (unitPrice)
  → frontend/src/api/reports.api.ts (isInvoiced)
  → frontend/src/api/equipment.api.ts (isInvoiced)
  → frontend/src/pages/materials/MaterialsPage.tsx (pole ceny)
  → frontend/src/pages/reports/ReportForm.tsx (badge)

KROK 9: Build i deploy
  → docker compose build kahma-backend kahma-frontend
  → docker compose up -d
```

---

## 10. Przyszłość — Faktury zakupowe (Faza 5, poza obecnym zakresem)

Ta sama tabela `invoices` z `type = 'purchase'`. Nowa tabela łącząca:

```sql
invoice_purchase_orders (
  id                UUID PRIMARY KEY,
  invoice_id        UUID REFERENCES invoices(id) ON DELETE CASCADE,
  purchase_order_id UUID REFERENCES purchase_orders(id),
  UNIQUE(invoice_id, purchase_order_id)
)
```

Umożliwi zestawianie:
- Kosztów zakupu materiałów (FV zakupowe od dostawców)
- Przychodów ze sprzedaży (FV sprzedażowe dla kontrahentów)
- → Marża per kontrahent i per projekt
