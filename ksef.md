# Moduł Księgowości + KSeF — Plan Wdrożenia

> **Status:** Plan zatwierdzony, implementacja nierozpoczęta  
> **Data planu:** 2026-05-04  
> **Faza 1:** Generator faktur + XML FA(3) + PDF  
> **Faza 2 (późniejsza):** Wysyłka do API KSeF + Biała Lista VAT

---

## 1. Kontekst i cel

Kahma potrzebuje modułu fakturowania dla roli **księgowy** (`can_account`). System musi:

- Przechowywać kartotekę kontrahentów (klienci + dostawcy) z walidowanym NIP
- Prowadzić katalog produktów i usług fakturowania (z VAT, GTU, PKWiU)
- Wystawiać faktury sprzedaży i rejestrować faktury zakupowe
- Generować poprawny XML **FA(3)** (jedyny akceptowany format KSeF od 1 lutego 2026)
- Generować PDF faktury z danymi do przelewu

### KSeF — kluczowe fakty techniczne

| Kwestia | Stan |
|---|---|
| Obowiązkowe od | 1 lutego 2026 |
| Akceptowany format | Wyłącznie **FA(3)** — FA(2) jest odrzucany na poziomie namespace |
| API | REST, OpenAPI 3.0.4, środowisko: `api.ksef.mf.gov.pl` (prod) / `api-test.ksef.mf.gov.pl` (test) |
| Autentykacja | OAuth 2.0 lub certyfikat XAdES |
| Szyfrowanie payloadu | AES-256 |
| SDK Node.js | Brak oficjalnego; community: `ksef-client-ts` (Node 20+, ESM) |

---

## 2. Zmiany w istniejącym systemie

Zanim wdrożymy nowe tabele, kilka miejsc w obecnym kodzie wymaga dostosowania lub uzupełnienia, by moduł księgowy działał spójnie z resztą systemu.

### 2.1 Flaga `can_account` na użytkowniku

Spójna z istniejącymi `can_order` i `can_prepare`. Księgowy jest pracownikiem z flagą — nie oddzielną rolą.

**Pliki do zmiany:**

| Plik | Co zmienić |
|---|---|
| `backend/prisma/schema.prisma` | `canAccount Boolean @default(false) @map("can_account")` w modelu `User` |
| `backend/src/middleware/auth.ts` | Dodać `canAccount` do `AccessTokenPayload` i `req.user` |
| `backend/src/types/express.d.ts` | `canAccount: boolean` w `Request.user` |
| `backend/src/modules/auth/auth.service.ts` | `canAccount` w `generateAccessToken()` i odpowiedzi login/refresh |
| `backend/src/modules/users/users.service.ts` | `userSelect`, `create()`, `update()` |
| `backend/src/modules/users/users.schemas.ts` | `canAccount` w `createUserSchema` i `updateUserSchema` |
| `frontend/src/types/index.ts` | `canAccount` w `User` i `AuthUser` |
| `frontend/src/store/authStore.ts` | Helper `canAccount()` = `user.canAccount \|\| isAdmin()` |
| `frontend/src/api/users.api.ts` | `canAccount` w payload typach |
| `frontend/src/pages/admin/Users.tsx` | Checkbox "Księgowy — moduł fakturowania (can_account)" w obu formularzach |
| `frontend/src/layouts/AppLayout.tsx` | NavItem "Księgowość" widoczny gdy `canAccount() \|\| isAdmin()` |
| `frontend/src/router/index.tsx` | Trasa `/ksiegowosc` |

### 2.2 Lokalizacje jako miejsca świadczenia usług

Obecna tabela `locations` (Aparatownia, plac budowy itp.) może być punktem wyjścia dla adresu dostawy na fakturze. Jednak na fakturze potrzebny jest pełny adres ustrukturyzowany — lokalizacje w systemie mają tylko pole `name`. 

**Opcja A (zalecana):** Pole `address` (TEXT, nullable) dodane do tabeli `locations` — admin może uzupełnić dla lokalizacji używanych w fakturach.

**Opcja B:** Nie łączyć — adres dostawy wpisywany ręcznie na każdej fakturze.

Decyzja odłożona do momentu implementacji. Nie blokuje Fazy 1.

### 2.3 Moduł Zamówień → powiązanie z fakturami zakupowymi

Obecne `purchase_orders` to wewnętrzne zamówienia materiałów — po dostawie można je przypisać do raportu dnia. W module księgowym dostawca może wystawić fakturę za dostarczone zamówienie.

**Zmiana:** Pole `invoice_id UUID REFERENCES invoices(id)` (nullable) dodane do `purchase_orders`. Pozwoli powiązać zamówienie z fakturą zakupową od dostawcy.

**Pliki do zmiany:**
- `backend/prisma/schema.prisma` — relacja `PurchaseOrder → Invoice`
- `backend/src/modules/purchaseOrders/purchaseOrders.service.ts` — include `invoice` w `orderInclude`
- `frontend/src/api/purchases.api.ts` — pole `invoiceId` w typie `PurchaseOrder`
- `frontend/src/pages/purchases/PurchasesPage.tsx` — przycisk "Powiąż fakturę" w `OrderDetailModal` (dla statusu `delivered`, can_account/admin)

### 2.4 Tabela `materials` — brak pól VAT/GTU

Obecna tabela materiałów (4535 pozycji magazynowych) nie ma pól VAT ani GTU — i nie powinna ich mieć. Materiały magazynowe to odrębny byt od pozycji fakturowych. **Nie rozszerzamy tabeli `materials`.**

Katalog fakturowy to osobna tabela `invoice_products` opisana w sekcji 3.

### 2.5 Brak Vehicle `km_base` w CREATE — uwaga implementacyjna

Nie dotyczy bezpośrednio KSeF, ale warto zanotować: tabela `vehicles` nie ma `kmBase` przy tworzeniu (tylko przy UPDATE). Jest to świadoma decyzja z masterplan.md — nie zmieniamy.

---

## 3. Nowe tabele bazy danych

**Migracja:** `backend/prisma/migrations/20260504000000_add_accounting/migration.sql`

### 3.1 Konfiguracja globalna

```sql
CREATE TABLE accounting_config (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_nip       VARCHAR(10) NOT NULL,
  company_name      VARCHAR(300) NOT NULL,
  company_street    VARCHAR(200),
  company_building  VARCHAR(20),
  company_apartment VARCHAR(20),
  company_postal    VARCHAR(10),
  company_city      VARCHAR(100),
  company_country   VARCHAR(3)  NOT NULL DEFAULT 'PL',
  company_tax_office VARCHAR(200),
  ksef_token        TEXT,                            -- token API KSeF (Faza 2)
  ksef_env          VARCHAR(10) NOT NULL DEFAULT 'test',  -- 'test' | 'prod'
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Jedna per instalacja — enforce przez aplikację (max 1 rekord)
```

### 3.2 Konta bankowe

```sql
CREATE TABLE bank_accounts (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(100) NOT NULL,   -- np. "PKO BP PLN"
  iban       VARCHAR(34)  NOT NULL UNIQUE,
  swift      VARCHAR(11),
  currency   VARCHAR(3)  NOT NULL DEFAULT 'PLN',
  is_default BOOLEAN     NOT NULL DEFAULT false,
  is_active  BOOLEAN     NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Trigger lub aplikacja: tylko jedno is_default=true per waluta
```

### 3.3 Kartoteka kontrahentów

```sql
CREATE TABLE contractors (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  type             VARCHAR(20) NOT NULL,   -- 'client' | 'supplier' | 'both'
  nip              VARCHAR(10) NOT NULL UNIQUE,
  name             VARCHAR(300) NOT NULL,
  street           VARCHAR(200),
  building_number  VARCHAR(20),
  apartment_number VARCHAR(20),
  postal_code      VARCHAR(10),
  city             VARCHAR(100) NOT NULL,
  country          VARCHAR(3)  NOT NULL DEFAULT 'PL',
  email            VARCHAR(200),
  phone            VARCHAR(50),
  is_vat_payer     BOOLEAN     NOT NULL DEFAULT true,
  is_active        BOOLEAN     NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX contractors_name_idx ON contractors USING gin(to_tsvector('simple', name));
CREATE INDEX contractors_nip_idx  ON contractors(nip);
```

**Walidacja NIP (algorytm modulo-11):**
```typescript
// backend/src/modules/contractors/contractors.schemas.ts
function validateNip(nip: string): boolean {
  if (!/^\d{10}$/.test(nip)) return false
  const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7]
  const digits  = nip.split('').map(Number)
  const sum     = weights.reduce((acc, w, i) => acc + w * digits[i], 0)
  const check   = sum % 11
  return check !== 10 && check === digits[9]
}
// Używane jako Zod .refine(validateNip, 'Nieprawidłowy NIP')
```

### 3.4 Katalog produktów i usług fakturowania

```sql
CREATE TABLE invoice_products (
  id          SERIAL       PRIMARY KEY,
  name        VARCHAR(300) NOT NULL,
  unit        VARCHAR(20)  NOT NULL DEFAULT 'szt',
  net_price   DECIMAL(12,2) NOT NULL DEFAULT 0,
  vat_rate    VARCHAR(10)  NOT NULL DEFAULT '23',
  -- Dopuszczalne wartości: '23' | '8' | '5' | '0' | 'zw' | 'np'
  gtu_code    VARCHAR(10),   -- 'GTU_01'..'GTU_13' lub NULL
  pkwiu_code  VARCHAR(20),   -- wymagane gdy vat_rate != '23'
  is_active   BOOLEAN      NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
```

**Kody GTU — referencja:**

| Kod | Dotyczy |
|---|---|
| GTU_01 | Napoje alkoholowe |
| GTU_02 | Paliwa silnikowe i biopaliwa |
| GTU_03 | Oleje i smary |
| GTU_04 | Wyroby tytoniowe |
| GTU_05 | Odpady i surowce wtórne |
| GTU_06 | Elektronika (komputery, telefony, tablety) |
| GTU_07 | Pojazdy i części samochodowe |
| GTU_08 | Metale szlachetne, biżuteria |
| GTU_09 | Leki i wyroby medyczne (rejestr MZ) |
| GTU_10 | Budynki, budowle, grunty |
| GTU_11 | Prawa do emisji gazów (ETS) |
| GTU_12 | Usługi doradcze, prawne, reklamowe, zarządcze |
| GTU_13 | Usługi transportu drogowego + magazynowania |

### 3.5 Faktury

```sql
CREATE TABLE invoices (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  type            VARCHAR(20) NOT NULL,          -- 'sale' | 'purchase'
  invoice_number  VARCHAR(50) NOT NULL UNIQUE,
  status          VARCHAR(20) NOT NULL DEFAULT 'draft',
  -- Statusy: 'draft' | 'issued' | 'paid' | 'cancelled'

  -- Daty
  issue_date      DATE        NOT NULL,          -- data wystawienia
  delivery_date   DATE        NOT NULL,          -- data dokonania/zakończenia dostawy
  due_date        DATE        NOT NULL,          -- termin płatności

  -- Dane stron (snapshot — nie zmienia się gdy kontrahent edytuje dane)
  seller_nip      VARCHAR(10) NOT NULL,
  seller_name     VARCHAR(300) NOT NULL,
  seller_address  TEXT,
  buyer_nip       VARCHAR(10) NOT NULL,
  buyer_name      VARCHAR(300) NOT NULL,
  buyer_address   TEXT,
  contractor_id   UUID        REFERENCES contractors(id),

  -- Płatność
  payment_method  VARCHAR(20) NOT NULL DEFAULT 'przelew',
  -- 'przelew' | 'gotowka' | 'karta' | 'kompensata'
  bank_account_id UUID        REFERENCES bank_accounts(id),

  -- Sumy (wyliczane automatycznie przy save)
  net_total       DECIMAL(12,2) NOT NULL DEFAULT 0,
  vat_total       DECIMAL(12,2) NOT NULL DEFAULT 0,
  gross_total     DECIMAL(12,2) NOT NULL DEFAULT 0,

  -- Procedury VAT
  is_mpp          BOOLEAN     NOT NULL DEFAULT false,
  -- Mechanizm Podzielonej Płatności: obowiązkowy gdy gross_total > 15000 PLN
  -- i co najmniej jedna pozycja z Załącznika 15 ustawy VAT
  is_tp           BOOLEAN     NOT NULL DEFAULT false,
  -- Transakcja powiązana (podmioty powiązane kapitałowo)

  -- KSeF (Faza 2)
  ksef_ref_number VARCHAR(50),                   -- numer KSeF po wysyłce
  ksef_sent_at    TIMESTAMPTZ,

  -- Powiązania
  notes           TEXT,
  created_by      UUID        NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX invoices_type_status_idx ON invoices(type, status);
CREATE INDEX invoices_contractor_idx  ON invoices(contractor_id);
CREATE INDEX invoices_created_at_idx  ON invoices(created_at DESC);
```

### 3.6 Pozycje faktury

```sql
CREATE TABLE invoice_items (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id     UUID          NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_id     INT           REFERENCES invoice_products(id),  -- NULL = pozycja ręczna
  name           VARCHAR(300)  NOT NULL,
  unit           VARCHAR(20)   NOT NULL,
  quantity       DECIMAL(10,3) NOT NULL,
  net_unit_price DECIMAL(12,4) NOT NULL,
  vat_rate       VARCHAR(10)   NOT NULL,
  discount_pct   DECIMAL(5,2)  NOT NULL DEFAULT 0,
  net_total      DECIMAL(12,2) NOT NULL,
  vat_amount     DECIMAL(12,2) NOT NULL,
  gross_total    DECIMAL(12,2) NOT NULL,
  gtu_code       VARCHAR(10),
  pkwiu_code     VARCHAR(20)
);
```

**Logika wyliczania:**
```
net_total      = quantity × net_unit_price × (1 - discount_pct/100)   [zaokr. do 2 miejsc]
vat_amount     = net_total × vat_rate/100                              [0 dla 'zw' i 'np']
gross_total    = net_total + vat_amount
```

### 3.7 Powiązanie zamówień z fakturami (zmiana istniejącej tabeli)

```sql
ALTER TABLE purchase_orders
  ADD COLUMN invoice_id UUID REFERENCES invoices(id);
```

### 3.8 Numeracja faktur

**Faktury sprzedaży:** auto-sekwencja `FV/{YYYY}/{NNN}` (NNN reset co rok, zero-padded do 3 cyfr).

```typescript
// invoices.service.ts
async function nextSaleNumber(year: number): Promise<string> {
  const count = await prisma.invoice.count({
    where: { type: 'sale', issueDate: { gte: new Date(`${year}-01-01`) } }
  })
  return `FV/${year}/${String(count + 1).padStart(3, '0')}`
}
```

**Faktury zakupowe:** numer wpisywany ręcznie przez użytkownika (numer nadany przez dostawcę).

---

## 4. Schema Prisma — nowe modele

```prisma
// Dodać do modelu User:
canAccount Boolean @default(false) @map("can_account")

model AccountingConfig {
  id              String   @id @default(uuid())
  companyNip      String   @map("company_nip") @db.VarChar(10)
  companyName     String   @map("company_name") @db.VarChar(300)
  companyStreet   String?  @map("company_street") @db.VarChar(200)
  companyBuilding String?  @map("company_building") @db.VarChar(20)
  companyApartment String? @map("company_apartment") @db.VarChar(20)
  companyPostal   String?  @map("company_postal") @db.VarChar(10)
  companyCity     String?  @map("company_city") @db.VarChar(100)
  companyCountry  String   @default("PL") @map("company_country") @db.VarChar(3)
  companyTaxOffice String? @map("company_tax_office") @db.VarChar(200)
  ksefToken       String?  @map("ksef_token") @db.Text
  ksefEnv         String   @default("test") @map("ksef_env") @db.VarChar(10)
  updatedAt       DateTime @default(now()) @updatedAt @map("updated_at")
  @@map("accounting_config")
}

model BankAccount {
  id        String    @id @default(uuid())
  name      String    @db.VarChar(100)
  iban      String    @unique @db.VarChar(34)
  swift     String?   @db.VarChar(11)
  currency  String    @default("PLN") @db.VarChar(3)
  isDefault Boolean   @default(false) @map("is_default")
  isActive  Boolean   @default(true) @map("is_active")
  createdAt DateTime  @default(now()) @map("created_at")
  invoices  Invoice[]
  @@map("bank_accounts")
}

model Contractor {
  id              String    @id @default(uuid())
  type            String    @db.VarChar(20)   // 'client' | 'supplier' | 'both'
  nip             String    @unique @db.VarChar(10)
  name            String    @db.VarChar(300)
  street          String?   @db.VarChar(200)
  buildingNumber  String?   @map("building_number") @db.VarChar(20)
  apartmentNumber String?   @map("apartment_number") @db.VarChar(20)
  postalCode      String?   @map("postal_code") @db.VarChar(10)
  city            String    @db.VarChar(100)
  country         String    @default("PL") @db.VarChar(3)
  email           String?   @db.VarChar(200)
  phone           String?   @db.VarChar(50)
  isVatPayer      Boolean   @default(true) @map("is_vat_payer")
  isActive        Boolean   @default(true) @map("is_active")
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")
  invoices        Invoice[]
  @@map("contractors")
}

model InvoiceProduct {
  id         Int      @id @default(autoincrement())
  name       String   @db.VarChar(300)
  unit       String   @default("szt") @db.VarChar(20)
  netPrice   Decimal  @default(0) @map("net_price") @db.Decimal(12, 2)
  vatRate    String   @default("23") @map("vat_rate") @db.VarChar(10)
  gtuCode    String?  @map("gtu_code") @db.VarChar(10)
  pkwiuCode  String?  @map("pkwiu_code") @db.VarChar(20)
  isActive   Boolean  @default(true) @map("is_active")
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")
  items      InvoiceItem[]
  @@map("invoice_products")
}

model Invoice {
  id             String        @id @default(uuid())
  type           String        @db.VarChar(20)
  invoiceNumber  String        @unique @map("invoice_number") @db.VarChar(50)
  status         String        @default("draft") @db.VarChar(20)
  issueDate      DateTime      @map("issue_date") @db.Date
  deliveryDate   DateTime      @map("delivery_date") @db.Date
  dueDate        DateTime      @map("due_date") @db.Date
  sellerNip      String        @map("seller_nip") @db.VarChar(10)
  sellerName     String        @map("seller_name") @db.VarChar(300)
  sellerAddress  String?       @map("seller_address") @db.Text
  buyerNip       String        @map("buyer_nip") @db.VarChar(10)
  buyerName      String        @map("buyer_name") @db.VarChar(300)
  buyerAddress   String?       @map("buyer_address") @db.Text
  contractorId   String?       @map("contractor_id")
  contractor     Contractor?   @relation(fields: [contractorId], references: [id])
  paymentMethod  String        @default("przelew") @map("payment_method") @db.VarChar(20)
  bankAccountId  String?       @map("bank_account_id")
  bankAccount    BankAccount?  @relation(fields: [bankAccountId], references: [id])
  netTotal       Decimal       @default(0) @map("net_total") @db.Decimal(12, 2)
  vatTotal       Decimal       @default(0) @map("vat_total") @db.Decimal(12, 2)
  grossTotal     Decimal       @default(0) @map("gross_total") @db.Decimal(12, 2)
  isMpp          Boolean       @default(false) @map("is_mpp")
  isTp           Boolean       @default(false) @map("is_tp")
  ksefRefNumber  String?       @map("ksef_ref_number") @db.VarChar(50)
  ksefSentAt     DateTime?     @map("ksef_sent_at") @db.Timestamptz
  notes          String?       @db.Text
  createdById    String        @map("created_by")
  createdBy      User          @relation(fields: [createdById], references: [id])
  createdAt      DateTime      @default(now()) @map("created_at") @db.Timestamptz
  updatedAt      DateTime      @updatedAt @map("updated_at") @db.Timestamptz
  items          InvoiceItem[]
  purchaseOrders PurchaseOrder[]
  @@map("invoices")
}

model InvoiceItem {
  id           String          @id @default(uuid())
  invoiceId    String          @map("invoice_id")
  invoice      Invoice         @relation(fields: [invoiceId], references: [id], onDelete: Cascade)
  productId    Int?            @map("product_id")
  product      InvoiceProduct? @relation(fields: [productId], references: [id])
  name         String          @db.VarChar(300)
  unit         String          @db.VarChar(20)
  quantity     Decimal         @db.Decimal(10, 3)
  netUnitPrice Decimal         @map("net_unit_price") @db.Decimal(12, 4)
  vatRate      String          @map("vat_rate") @db.VarChar(10)
  discountPct  Decimal         @default(0) @map("discount_pct") @db.Decimal(5, 2)
  netTotal     Decimal         @map("net_total") @db.Decimal(12, 2)
  vatAmount    Decimal         @map("vat_amount") @db.Decimal(12, 2)
  grossTotal   Decimal         @map("gross_total") @db.Decimal(12, 2)
  gtuCode      String?         @map("gtu_code") @db.VarChar(10)
  pkwiuCode    String?         @map("pkwiu_code") @db.VarChar(20)
  @@map("invoice_items")
}
```

Dodać też do modelu `PurchaseOrder`:
```prisma
invoiceId String?  @map("invoice_id")
invoice   Invoice? @relation(fields: [invoiceId], references: [id])
```

---

## 5. Backend — nowe moduły

### Struktura

```
backend/src/modules/
  accounting/
    accounting.schemas.ts    -- config + bankAccount schemas
    accounting.service.ts    -- getConfig, upsertConfig, listBankAccounts, ...
    accounting.controller.ts
    accounting.routes.ts     -- /api/v1/accounting/*
  contractors/
    contractors.schemas.ts   -- walidacja NIP
    contractors.service.ts
    contractors.controller.ts
    contractors.routes.ts    -- /api/v1/contractors
  invoiceProducts/
    invoiceProducts.schemas.ts
    invoiceProducts.service.ts
    invoiceProducts.controller.ts
    invoiceProducts.routes.ts  -- /api/v1/invoice-products
  invoices/
    invoices.schemas.ts
    invoices.service.ts      -- CRUD + numeracja + sumy VAT
    invoices.controller.ts
    invoices.pdf.ts          -- generator PDF (pdfkit)
    invoices.xml.ts          -- generator XML FA(3) (xmlbuilder2)
    invoices.routes.ts       -- /api/v1/invoices
```

### Endpointy

#### `/api/v1/accounting`

| Metoda | Endpoint | Opis | Dostęp |
|---|---|---|---|
| GET | `/config` | Pobierz dane firmy | can_account + admin |
| PUT | `/config` | Zapisz dane firmy | admin |
| GET | `/bank-accounts` | Lista kont bankowych | can_account + admin |
| POST | `/bank-accounts` | Dodaj konto | admin |
| PATCH | `/bank-accounts/:id` | Edytuj konto | admin |
| PATCH | `/bank-accounts/:id/deactivate` | Dezaktywuj konto | admin |

#### `/api/v1/contractors`

| Metoda | Endpoint | Opis | Dostęp |
|---|---|---|---|
| GET | `/` | Lista (filtry: q, type, isActive, page) | can_account + admin |
| GET | `/:id` | Szczegóły | can_account + admin |
| POST | `/` | Dodaj kontrahenta (walidacja NIP) | can_account + admin |
| PATCH | `/:id` | Edytuj | can_account + admin |
| PATCH | `/:id/deactivate` | Dezaktywuj | admin |

#### `/api/v1/invoice-products`

| Metoda | Endpoint | Opis | Dostęp |
|---|---|---|---|
| GET | `/` | Lista aktywnych | can_account + admin |
| GET | `/all` | Lista wszystkich (z nieaktywnymi) | can_account + admin |
| POST | `/` | Dodaj produkt/usługę | can_account + admin |
| PATCH | `/:id` | Edytuj | can_account + admin |
| PATCH | `/:id/deactivate` | Dezaktywuj | admin |

#### `/api/v1/invoices`

| Metoda | Endpoint | Opis | Dostęp |
|---|---|---|---|
| GET | `/` | Lista (filtry: type, status, contractorId, from, to, page) | can_account + admin |
| GET | `/:id` | Szczegóły z pozycjami | can_account + admin |
| GET | `/:id/pdf` | Pobierz PDF | can_account + admin |
| GET | `/:id/xml` | Pobierz XML FA(3) | can_account + admin |
| POST | `/` | Utwórz fakturę z pozycjami | can_account + admin |
| PATCH | `/:id` | Edytuj (tylko status `draft`) | can_account + admin |
| PATCH | `/:id/issue` | Zmień status: draft → issued | can_account + admin |
| PATCH | `/:id/mark-paid` | Zmień status: issued → paid | can_account + admin |
| PATCH | `/:id/cancel` | Anuluj fakturę | admin |

### Przejścia statusu faktury

```
draft ──→ issued ──→ paid
  │          │
  └──────────┴──→ cancelled  (admin only)
```

- `draft`: edytowalna w pełni
- `issued`: zablokowana do edycji; można pobrać PDF i XML
- `paid`: tylko do odczytu
- `cancelled`: numer faktury nie jest reużywany

### Generowanie PDF (`invoices.pdf.ts`)

**Biblioteka:** `pdfkit` (czyste Node.js, bezpieczne w Alpine Docker, brak zależności systemowych)

```bash
cd backend && npm install pdfkit && npm install --save-dev @types/pdfkit
```

Zawartość PDF:
- Nagłówek: logo + "FAKTURA VAT" + numer + data wystawienia
- Dane sprzedawcy i nabywcy (lewy/prawy układ)
- Tabela pozycji: Lp / Nazwa / J.m. / Ilość / Cena netto / Rabat / VAT / Netto / Brutto
- Zestawienie VAT per stawka (tabela: stawka / netto / VAT / brutto)
- Podsumowanie: razem do zapłaty BRUTTO
- Dane przelewu: IBAN + tytuł przelewu (numer faktury)
- Adnotacje: "Mechanizm podzielonej płatności" (gdy is_mpp = true)
- Stopka: data + podpis wystawcy

### Generowanie XML FA(3) (`invoices.xml.ts`)

**Biblioteka:** `xmlbuilder2`

```bash
cd backend && npm install xmlbuilder2
```

Szkielet FA(3):
```xml
<Faktura xmlns="http://crd.gov.pl/wzor/2023/06/29/12648/">
  <Naglowek>
    <KodFormularza kodSystemowy="FA (3)" wersjaSchemy="1-0E">FA</KodFormularza>
    <WariantFormularza>3</WariantFormularza>
    <DataWytworzeniaFa>2026-05-04T10:00:00</DataWytworzeniaFa>
    <SystemInfo>Kahma ERP 1.0</SystemInfo>
  </Naglowek>
  <Podmiot1>                          <!-- Sprzedawca -->
    <DaneIdentyfikacyjne>
      <NIP>9531204591</NIP>
      <PelnaNazwa>Kahma Sp. z o.o.</PelnaNazwa>
    </DaneIdentyfikacyjne>
    <Adres>
      <KodKraju>PL</KodKraju>
      <Ulica>ul. Przykładowa</Ulica>
      <NrDomu>1</NrDomu>
      <Miejscowosc>Warszawa</Miejscowosc>
      <KodPocztowy>00-001</KodPocztowy>
    </Adres>
  </Podmiot1>
  <Podmiot2>                          <!-- Nabywca -->
    ...
  </Podmiot2>
  <Fa>
    <KodWaluty>PLN</KodWaluty>
    <P_1>2026-05-04</P_1>             <!-- data wystawienia -->
    <P_1M>Warszawa</P_1M>
    <P_2>FV/2026/001</P_2>            <!-- numer faktury -->
    <P_6>2026-05-04</P_6>             <!-- data dostawy -->
    <P_15>12300.00</P_15>             <!-- gross total -->
    <Adnotacje>
      <P_16>2</P_16>                  <!-- MPP: 1=tak, 2=nie -->
      <P_18>2</P_18>                  <!-- TP: 1=tak, 2=nie -->
    </Adnotacje>
    <RodzajFaktury>VAT</RodzajFaktury>
    <FaWiersz>                        <!-- pozycje — po jednej per item -->
      <NrWierszaFa>1</NrWierszaFa>
      <P_7>Usługa instalacji elektrycznej</P_7>  <!-- nazwa -->
      <P_8A>godz</P_8A>               <!-- j.m. -->
      <P_8B>10.000</P_8B>             <!-- ilość -->
      <P_9A>200.00</P_9A>             <!-- cena netto -->
      <P_11>2000.00</P_11>            <!-- wartość netto -->
      <P_12>23</P_12>                 <!-- stawka VAT -->
    </FaWiersz>
    <Rozliczenie>
      <P_13_1>2000.00</P_13_1>        <!-- netto 23% -->
      <P_14_1>460.00</P_14_1>         <!-- VAT 23% -->
    </Rozliczenie>
    <Platnosc>
      <Termin>2026-05-18</Termin>
      <FormaPlatnosci>6</FormaPlatnosci>  <!-- 6 = przelew -->
      <NumerRachunku>PL61109010140000071219812874</NumerRachunku>
    </Platnosc>
  </Fa>
</Faktura>
```

---

## 6. Frontend

### Nowe pliki

```
frontend/src/
  api/
    accounting.api.ts        -- klienty: config, bankAccounts, contractors,
                                          invoiceProducts, invoices
  pages/accounting/
    AccountingPage.tsx       -- 4 taby
```

### `AccountingPage.tsx` — struktura tabów

**Tab 1: Faktury**
- Filtry: typ (sprzedaż/zakup), status, kontrahent, zakres dat
- Lista faktur: karta z numerem, kontrahentem, kwotą brutto, statusem
- Przyciski per wiersz: Szczegóły / Pobierz PDF / Pobierz XML
- Przycisk globalny: "Nowa faktura"

**Tab 2: Kontrahenci**
- Wyszukiwarka (po nazwie lub NIP)
- Lista z typem (klient/dostawca/oboje) i statusem
- Modal dodaj/edytuj:
  - NIP (walidacja on-blur — modulo-11 po stronie frontend i backend)
  - Nazwa, adres (ustrukturyzowany), e-mail, telefon
  - Typ, status VAT

**Tab 3: Cennik**
- Lista produktów/usług fakturowania
- Modal dodaj/edytuj:
  - Nazwa, j.m., cena netto, stawka VAT
  - Kod GTU (dropdown 13 opcji + brak)
  - Kod PKWiU (text input, opcjonalny; wymagany gdy VAT ≠ 23%)

**Tab 4: Ustawienia** (tylko admin)
- Dane firmy (NIP, nazwa, adres, urząd skarbowy)
- Konta bankowe (lista + dodaj/edytuj/dezaktywuj)
- Token KSeF + wybór środowiska test/prod *(Faza 2 — pole jest, ale nieaktywne)*

### `NewInvoiceModal` — przepływ

1. Wybór typu: Sprzedaż / Zakup
2. Daty: wystawienia / dostawy / termin płatności
3. Kontrahent: autocomplete po NIP lub nazwie (min 3 znaki)
4. Płatność: forma + konto bankowe (dropdown z `bank_accounts`)
5. Pozycje (useFieldArray):
   - Autocomplete z `invoice_products` lub ręczna pozycja
   - Ilość, j.m., cena netto, stawka VAT, rabat %
   - Auto-wyliczanie VAT i sumy brutto per wiersz + łączne
6. Adnotacje:
   - Checkbox MPP — pojawia się automatycznie gdy `gross_total > 15 000 PLN`
   - Checkbox TP — zawsze widoczny
7. Uwagi (opcjonalne)
8. Przycisk "Zapisz jako szkic" / "Wystaw od razu"

### Zmiany w istniejących plikach frontend

| Plik | Zmiana |
|---|---|
| `src/types/index.ts` | `canAccount` w `User` i `AuthUser` |
| `src/store/authStore.ts` | Helper `canAccount()` |
| `src/api/users.api.ts` | `canAccount` w payload typach |
| `src/api/purchases.api.ts` | Pole `invoiceId?: string` w `PurchaseOrder` |
| `src/router/index.tsx` | Trasa `/ksiegowosc` (RequireAuth) |
| `src/layouts/AppLayout.tsx` | NavItem "Księgowość" (ikona `Receipt`, widoczny gdy `canAccount \|\| isAdmin`) |
| `src/pages/admin/Users.tsx` | Checkbox `canAccount` w formularzach create + edit |
| `src/pages/purchases/PurchasesPage.tsx` | Przycisk "Powiąż fakturę" w `OrderDetailModal` dla delivered |

---

## 7. Nowe zależności

### Backend

```bash
cd backend
npm install pdfkit xmlbuilder2
npm install --save-dev @types/pdfkit
```

| Pakiet | Cel | Rozmiar |
|---|---|---|
| `pdfkit` | Generowanie PDF po stronie serwera | ~2.5 MB, brak zależności systemowych |
| `xmlbuilder2` | Budowanie XML FA(3) | ~500 KB |

### Frontend

Brak nowych zależności. Istniejące wystarczą:
- Zod + React Hook Form — walidacja NIP i formularze
- Radix UI Dialog — modale
- Lucide React — ikona `Receipt`
- TanStack Query — fetching
- Axios — HTTP

---

## 8. Kolejność implementacji

```
KROK 1 — Fundament (migracja + auth)
  ├── Migracja 20260504000000_add_accounting (wszystkie tabele naraz)
  ├── schema.prisma — can_account + 6 nowych modeli + zmiana PurchaseOrder
  └── Propagacja flagi can_account przez cały stack auth (backend + frontend)

KROK 2 — Konfiguracja globalna
  ├── Backend: moduł accounting/ (config + bank_accounts)
  └── Frontend: Tab "Ustawienia" w AccountingPage

KROK 3 — Kartoteka kontrahentów
  ├── Backend: moduł contractors/ (CRUD + walidacja NIP)
  └── Frontend: Tab "Kontrahenci" z modalem

KROK 4 — Cennik
  ├── Backend: moduł invoiceProducts/ (CRUD)
  └── Frontend: Tab "Cennik" z modalem

KROK 5 — Faktury (CRUD)
  ├── Backend: invoices.service.ts (CRUD + numeracja + sumy VAT)
  ├── Backend: invoices.routes.ts (endpointy bez PDF/XML)
  └── Frontend: Tab "Faktury" + NewInvoiceModal

KROK 6 — Generowanie dokumentów
  ├── Backend: invoices.pdf.ts (pdfkit)
  └── Backend: invoices.xml.ts (xmlbuilder2, FA(3))

KROK 7 — Integracja z modułem Zamówień
  └── Frontend: przycisk "Powiąż fakturę" w PurchasesPage

KROK 8 — Testy końcowe
  └── Scenariusze z sekcji 9
```

---

## 9. Scenariusze weryfikacji

| # | Scenariusz | Oczekiwany wynik |
|---|---|---|
| 1 | Admin nadaje `can_account` pracownikowi → przelogowanie | Zakładka "Księgowość" pojawia się w sidebarze |
| 2 | Dodanie kontrahenta z NIP `0000000000` | Błąd: "Nieprawidłowy NIP" |
| 3 | Dodanie kontrahenta z NIP `9531204591` (prawidłowy) | Zapis; kontrahent widoczny na liście |
| 4 | Nowa faktura sprzedaży z 2 pozycjami (23% VAT) | Auto-numer `FV/2026/001`; sumy wyliczone poprawnie |
| 5 | Gross total > 15 000 PLN | Checkbox MPP pojawia się automatycznie |
| 6 | Wystaw fakturę (draft → issued) | Status zmieniony; PDF i XML do pobrania |
| 7 | Pobranie PDF | Plik PDF z tabelą pozycji i danymi przelewu |
| 8 | Pobranie XML FA(3) | Poprawny XML z namespace `http://crd.gov.pl/wzor/2023/06/29/12648/` |
| 9 | Anulowanie faktury (admin) | Status `cancelled`; numer `FV/2026/001` nie jest reużywany |
| 10 | Faktura zakupowa — ręczny numer | Numer wpisany przez użytkownika; zapisany poprawnie |
| 11 | Powiązanie dostawy z fakturą zakupową | `purchase_orders.invoice_id` zapisany; widoczne w zamówieniu |
| 12 | Pracownik bez `can_account` próbuje GET `/api/v1/invoices` | 403 Forbidden |

---

## 10. Faza 2 — KSeF API (plan na przyszłość)

Po ukończeniu Fazy 1 i weryfikacji poprawności XML FA(3):

1. **Autentykacja KSeF:**
   - Token autoryzacyjny (dla firm nieposiadających kwalifikowanego podpisu)
   - Lub certyfikat XAdES (dla kwalifikowanego podpisu elektronicznego)
   - Token przechowywany w `accounting_config.ksef_token` (zaszyfrowany w bazie)

2. **Sesja KSeF:**
   - `POST /api/v1/invoices/:id/send-ksef` — otwiera sesję, szyfruje payload AES-256, wysyła, pobiera UPO
   - Po sukcesie: `invoices.ksef_ref_number` + `ksef_sent_at` zapisane w bazie
   - Status faktury zmienia się na `sent_ksef` (nowy status między `issued` a `paid`)

3. **Biała Lista VAT:**
   - Integracja z API `https://wl-api.mf.gov.pl/`
   - Weryfikacja NIP kontrahenta przed wystawieniem faktury
   - Pole `is_vat_payer` w `contractors` aktualizowane automatycznie

4. **Biblioteka Node.js:**
   - `ksef-client-ts` (Node 20+, ESM only)
   - Wymaga konfiguracji jako ESM w backendzie lub użycia dynamic import

---

## 11. Decyzje projektowe

| Kwestia | Decyzja | Uzasadnienie |
|---|---|---|
| Rola księgowego | Flaga `can_account` (nie rola) | Spójność z `can_order`, `can_prepare` |
| Format XML | FA(3) | Jedyny akceptowany przez KSeF od 2026-02-01 |
| Generowanie PDF | `pdfkit` (server-side) | Brak zależności systemowych — działa w Alpine Docker |
| Generowanie XML | `xmlbuilder2` | Lekki builder, TypeScript-friendly |
| Katalog produktów | Osobna tabela `invoice_products` | Nie mieszamy z 4535 materiałami magazynowymi |
| Dane kontrahenta na fakturze | Snapshot (kopia w momencie wystawienia) | Zmiana danych w kartotece nie powinna retroaktywnie zmieniać wystawionych faktur |
| Numeracja faktur zakupowych | Ręczna (numer od dostawcy) | Dostawca nadaje swój numer — nie generujemy własnego |
| MPP auto-sugestia | Checkbox pojawia się gdy gross > 15 000 PLN | Obowiązek podlegający przepisom — nie wymuszamy, ale informujemy |
