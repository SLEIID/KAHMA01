# KAHMA — Masterplan Projektu

> **Status:** Wypożyczalnia — powiązana z lokalizacją i raportem dnia; admin tworzy zaległy raport dla pracownika (2026-05-05)
> **Domena:** kahma.leanmatik.net
> **Data aktualizacji:** 2026-05-05

---

## 1. Wizja projektu

System zarządzania pracownikami i zasobami firmy. Budowany modularnie wokół solidnego rdzenia (core). Każdy pracownik ma indywidualne konto. Przez dashboard nawiguje do dostępnych modułów. Priorytet: mobile-first, język: polski.

**Podejście:** MVP → korekty funkcji i wyglądu → kolejne moduły.

---

## 2. Infrastruktura — potwierdzony stan maszyny

### Istniejące stacki (nie ruszamy)

| Kontener | Port hosta | Opis |
|---|---|---|
| cmms-nginx | 3200 | CMMS — proxy |
| cmms-backend | 3201 | CMMS — API |
| cmms-frontend | 3202 | CMMS — UI |
| cmms-db | 3203 | CMMS — PostgreSQL |
| ur-nginx | 3020 | UR — proxy |

### Kahma — przydzielone porty (potwierdzone wolne)

| Usługa | Port hosta | Port kontenera |
|---|---|---|
| Nginx (proxy) | **8090** | 80 |
| Frontend (React) | **3300** | 80 (nginx wewnątrz kontenera) |
| Backend (Express) | **3301** | 3001 |
| PostgreSQL | **5433** | 5432 |

### Diagram ruchu

```
Internet
   │
   ▼
Cloudflare Tunnel → kahma.leanmatik.net
   │
   ▼
VPS :8090 → kahma-nginx
   │
   ├── /api/*  →  kahma-backend  :3301
   └── /*      →  kahma-frontend :3300
                        │
                   kahma-db :5433
```

Kontenery w izolowanej sieci Docker: `kahma_net`

---

## 3. Stos technologiczny (PERN)

| Warstwa | Technologia | Uwagi |
|---|---|---|
| Baza danych | PostgreSQL 16 (Alpine) | Prisma migrations |
| Backend | Node.js 20 + Express + TypeScript | tsup bundle |
| ORM | Prisma 5 | binaryTargets: native + linux-musl-openssl-3.0.x |
| Walidacja | Zod | backend + frontend |
| Frontend | React 18 + Vite + TypeScript | |
| Stylowanie | Tailwind CSS v3 | własna paleta "Sapphire Navy" |
| Komponenty UI | Własne (Button, Input, Select, Badge, Modal, Spinner) | inspirowane shadcn/ui |
| Formularze | React Hook Form + Zod resolver | |
| Zapytania API | TanStack Query (React Query) | |
| Stan globalny | Zustand + persist middleware | |
| Autentykacja | JWT — access 15min (JSON body) + refresh 7d (HttpOnly cookie) | rotacja tokenów |
| Eksport | SheetJS (xlsx) | |
| Konteneryzacja | Docker + Docker Compose v2 | multi-stage builds |
| Proxy | Nginx Alpine | gzip, reverse proxy |

---

## 4. Role użytkowników

| Rola | Opis |
|---|---|
| `admin` | Pełny dostęp — zarządza użytkownikami, flotą, widzi raporty zbiorcze, może edytować każdy wpis (w tym zablokowane) |
| `pracownik` | Dostęp do swoich danych — wypełnia raporty, wypożycza sprzęt, zgłasza problemy |
| `can_order` (flaga) | Pracownik z tą flagą widzi wszystkie zamówienia i może zmieniać statusy `pending→ordered` i `prepared→delivered`; analogia do `can_rent_equipment` |
| `can_prepare` (flaga) | Magazynier — widzi wszystkie zamówienia, zmienia status `ordered→prepared` (kompletuje zamówienie); nie może zamawiać ani oznaczać jako dostarczone |

> **Uwaga:** Ekipy (`teams`) zostały usunięte z systemu (2026-05-05). Grupowanie pracowników odbywa się przez mechanizm podpisów (`report_signatures`) — sygnatariusz ma pełny dostęp do edycji raportu kolegi.

---

## 5. Moduły — zakres MVP

### ~~Ekipy (Teams)~~ ❌ USUNIĘTE (2026-05-05)
Grupowanie pracowników przez named labels (`Ekipa A/B/C…`) okazało się redundantne — mechanizm podpisów już implikuje współpracę. Usunięto tabelę `teams`, kolumnę `team_id` z `daily_reports`, moduł `/api/v1/teams`, `TeamSelector` z frontendu oraz kolumnę "Ekipa" z eksportu XLSX.

### Moduł 0: CORE ✅ UKOŃCZONY
- Logowanie / wylogowanie (JWT + refresh token)
- Zarządzanie użytkownikami (admin: dodaj / edytuj / dezaktywuj)
- Dashboard z kafelkami modułów
- Sidebar nawigacyjny z responsywnym hamburgerem (mobile)

### Moduł 1: Raport Dnia ✅ UKOŃCZONY
- Pracownik tworzy **raport dnia** (kontener), a w nim wiele **wpisów** (różne godziny, opcjonalnie różne lokalizacje)
- Każdy wpis: godziny od/do, lokalizacja, opcjonalny wydział, opis pracy, opcjonalne pojazdy (wiele)
- Opcjonalne pojazdy — wiele per wpis (tablica vehicleUsages z pojazdem i km)
- Blokada edycji po północy — pracownik nie może edytować wpisów z poprzednich dni
- Admin może odblokować raport na 24h (pole `unlocked_until`) — pracownik odzyskuje dostęp do edycji
- Admin widzi raporty wszystkich pracowników z filtrami (zakres dat, pracownik, lokalizacja)
- Admin zarządza flotą pojazdów (dodaj, edytuj, koryguj przebieg, aktywuj/dezaktywuj)
- Eksport do XLSX (admin) — jeden wiersz per wpis, kolumna Podpisany
- Licznik pojazdu: system przechowuje `km_base` i wylicza `lastKm = max(km_base, ostatnie kmEnd)`

### Moduł 2: Wypożyczalnia Sprzętu ✅ UKOŃCZONY
- Kategorie sprzętu (admin: dodaj; wszyscy: lista)
- Sprzęt z numerem seryjnym, uwagami, statusem (`available | rented | service | retired`)
- Pracownik: wypożycza (dostępny sprzęt) **na lokalizację** (FK do `locations`), zwraca (swoje), zgłasza problem
- Wypożyczenie można powiązać z raportem dnia (`report_id` nullable FK do `daily_reports`)
- Admin: dodaje/edytuje/usuwa sprzęt, zarządza kategoriami, zwraca każde wypożyczenie, zamyka zgłoszenia
- Blokada usunięcia sprzętu jeśli istnieje historia — zamiast usunięcia status `retired`
- Transakcje przy rent/return (atomowa zmiana statusu sprzętu)
- Zgłoszenia problemów z historią (status: `open | resolved`, admin zamyka)
- W widoku raportu dnia (`getById`) wyświetlana jest lista powiązanego sprzętu (`equipmentRentals`)

### Moduł 3: Materiały ✅ UKOŃCZONY
- Baza ~4000 materiałów zaimportowana z towary_kategorie.xlsx (bez "Pozostałe" i sprzętu wypożyczalni)
- Wyszukiwanie: min 3 znaki, kolejność słów dowolna (ILIKE AND na każde słowo)
- Pracownik: pusta wyszukiwarka → 30 ostatnio używanych; wyszukiwanie → lista wyników
- Pracownik: rejestruje pobranie (materiał + ilość + jednostka + uwagi)
- Pracownik: podczas pobrania może zgłosić niski stan + zdjęcie (foto lub plik)
- Zdjęcie z alertu staje się zdjęciem katalogu jeśli materiał go nie miał
- Pracownik: usuwa własne pobranie z bieżącego dnia
- Admin: przegląd zużycia (filtry: od/do), lista alertów niskiego stanu (zamyka je)
- Admin: lista wszystkich materiałów + dodawanie nowych

### Moduł 4: HR ✅ UKOŃCZONY
- Wnioski urlopowe: pracownik składa wniosek (typ, od/do, uwagi), admin zatwierdza/odrzuca z komentarzem
- Typy urlopów: Urlop wypoczynkowy, Urlop na żądanie, Urlop okolicznościowy, L4, Urlop bezpłatny
- Saldo urlopowe: 26 dni/rok; L4 nie odlicza z puli; admin może ręcznie ustawić limit i dni przeniesione
- Obecność pracownika: kalendarz miesięczny (zielony = przepracowany, niebieski = urlop)
- Admin: 4 taby — Wnioski / Salda / Obecność (tabela users × dni) / Kalendarz zespołu
- Eksport obecności: tabela z godzinami per pracownik per dzień (admin)

### Moduł 5: Zamówienia ✅ UKOŃCZONY
- Flaga `can_order` na użytkowniku — zamawiający: widzi wszystkie zamówienia, zmienia statusy `pending→ordered` i `prepared→delivered`
- Flaga `can_prepare` na użytkowniku — magazynier: widzi wszystkie zamówienia, zmienia status `ordered→prepared`
- Pracownik zgłasza zapotrzebowanie — koszyk z pozycjami (z katalogu lub ręcznie)
- Statusy: `pending → ordered → prepared → delivered` (lub `cancelled` na każdym etapie)
  - `pending→ordered`: can_order lub admin
  - `ordered→prepared`: can_prepare lub admin (magazynier kompletuje)
  - `prepared→delivered`: can_order lub admin (zamawiający wydaje)
  - `→cancelled`: can_order, can_prepare lub admin; twórca może anulować tylko `pending`
- "Dodaj do katalogu" — pozycja ręczna trafia do tabeli `materials`, item dostaje `material_id`
- Po dostawie twórca lub zamawiający może przypisać zamówienie do raportu dnia (`report_id`)
- Filtrowanie: status (w tym `prepared`), lokalizacja, pracownik (dla zamawiającego/magazyniera/admina)

### Moduł 6: Powiadomienia Telegram ⏸ ODŁOŻONY
- Zaplanowany, implementacja w późniejszej fazie

---

## 6. Model danych — aktualny stan bazy

> Ostatnia aktualizacja: 2026-04-24. Autorytatywne źródło: `backend/prisma/schema.prisma`.

### CORE

```sql
roles (
  id   SERIAL PRIMARY KEY,
  name VARCHAR UNIQUE NOT NULL   -- 'admin', 'pracownik'
)

users (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  login              VARCHAR UNIQUE NOT NULL,
  password_hash      VARCHAR NOT NULL,
  full_name          VARCHAR NOT NULL,
  role_id            INT REFERENCES roles(id),
  is_active          BOOLEAN DEFAULT true,
  can_rent_equipment BOOLEAN DEFAULT true,
  can_order          BOOLEAN DEFAULT false,
  can_prepare        BOOLEAN DEFAULT false,
  last_login_at      TIMESTAMPTZ,
  created_at         TIMESTAMPTZ DEFAULT now(),
  updated_at         TIMESTAMPTZ DEFAULT now()
)

refresh_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
)

notes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  title      VARCHAR(200) NOT NULL,
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
)
```

### Moduł 1: Raport Dnia

```sql
contractors (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type             VARCHAR(20) NOT NULL DEFAULT 'client',  -- 'client' | 'supplier' | 'both'
  name             VARCHAR(300) NOT NULL,
  nip              VARCHAR(10),                            -- nullable; UNIQUE WHERE nip IS NOT NULL
  street           VARCHAR(200),
  building_number  VARCHAR(20),
  apartment_number VARCHAR(20),
  postal_code      VARCHAR(10),
  city             VARCHAR(100),
  country          VARCHAR(3) NOT NULL DEFAULT 'PL',
  email            VARCHAR(200),
  phone            VARCHAR(50),
  is_vat_payer     BOOLEAN NOT NULL DEFAULT true,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
)

locations (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(200) UNIQUE NOT NULL,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now(),
  contractor_id UUID REFERENCES contractors(id) ON DELETE SET NULL  -- nullable FK
)

departments (
  id          SERIAL PRIMARY KEY,
  location_id INT REFERENCES locations(id),
  name        VARCHAR(100) NOT NULL,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(location_id, name)
)

vehicles (
  id           SERIAL PRIMARY KEY,
  plate_number VARCHAR(20) UNIQUE NOT NULL,
  name         VARCHAR(100) NOT NULL,
  is_active    BOOLEAN DEFAULT true,
  km_base      INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT now()
)

daily_reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id),
  report_date     DATE NOT NULL,
  approved_at     TIMESTAMPTZ,
  approved_by_id  UUID REFERENCES users(id),
  is_offer        VARCHAR(20),               -- 'offer'=ofertowy, 'no_offer'=bez oferty, 'to_quote'=do zaofertowania, NULL=niezatwierdzone
  unlocked_until  TIMESTAMPTZ,               -- admin może odblokować na 24h (NULL = brak wyjątku)
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
)

report_entries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id     UUID REFERENCES daily_reports(id) ON DELETE CASCADE,
  work_start    VARCHAR(5) NOT NULL,   -- "HH:MM"
  work_end      VARCHAR(5) NOT NULL,   -- "HH:MM"
  location_id   INT REFERENCES locations(id),
  department_id INT REFERENCES departments(id),  -- opcjonalny
  description   TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
)

vehicle_usage (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id   UUID REFERENCES report_entries(id) ON DELETE CASCADE,  -- brak UNIQUE → wiele aut per wpis
  vehicle_id INT REFERENCES vehicles(id),
  km_driven  INT NOT NULL    -- km przejechane tym pojazdem w danym wpisie
)

report_signatures (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id  UUID REFERENCES daily_reports(id) ON DELETE CASCADE,
  signer_id  UUID REFERENCES users(id),
  signed_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(report_id, signer_id)
)
```

**Logika blokady:** `is_locked` wyliczane dynamicznie: `reportDate < dziś`. Pracownik nie edytuje, admin może zawsze.

**Logika sygnatury:** pracownik może się podpisać pod czyjś raport z bieżącego dnia. Podpisany widzi raport w swojej liście (badge "Podpisany"), autor pozostaje właścicielem. Eksport XLSX generuje osobny wiersz per sygnatariusz z kolumną "Podpisany: Tak".

### Moduł 2: Wypożyczalnia Sprzętu

```sql
equipment_categories (
  id   SERIAL PRIMARY KEY,
  name VARCHAR UNIQUE NOT NULL
)

equipment_items (
  id            SERIAL PRIMARY KEY,
  category_id   INT REFERENCES equipment_categories(id),
  name          VARCHAR NOT NULL,
  serial_number VARCHAR,
  status        VARCHAR NOT NULL DEFAULT 'available',
  -- 'available' | 'rented' | 'service' | 'retired'
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
)

equipment_rentals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id         INT REFERENCES equipment_items(id),
  user_id         UUID REFERENCES users(id),
  location_id     INT NOT NULL REFERENCES locations(id),   -- lokalizacja (kto wypożycza — do czego)
  report_id       UUID REFERENCES daily_reports(id) ON DELETE SET NULL,  -- opcjonalne powiązanie z raportem
  rented_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  expected_return TIMESTAMPTZ,          -- opcjonalna data planowanego zwrotu
  returned_at     TIMESTAMPTZ,          -- NULL = aktywne wypożyczenie
  return_notes    TEXT
)

equipment_issues (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id     INT REFERENCES equipment_items(id),
  reported_by UUID REFERENCES users(id),
  description TEXT NOT NULL,
  status      VARCHAR DEFAULT 'open',   -- 'open' | 'resolved'
  created_at  TIMESTAMPTZ DEFAULT now()
)
```

**Migracje:** `20260320000000_add_equipment`, `20260505000001_equipment_location_report`

### Moduł 3: Materiały

```sql
materials (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(300) NOT NULL,
  photo_url  VARCHAR(500),                  -- opcjonalne zdjęcie katalogowe
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
)
-- INDEX: materials_name_idx ON name varchar_pattern_ops (ILIKE prefix)

material_usages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id     UUID REFERENCES daily_reports(id),          -- denormalizacja (nullable)
  entry_id      UUID REFERENCES report_entries(id) ON DELETE SET NULL,  -- główny kontekst
  material_id   INT REFERENCES materials(id),
  user_id       UUID REFERENCES users(id),
  location_id   INT REFERENCES locations(id),               -- auto z entry.location_id
  department_id INT REFERENCES departments(id),             -- auto z entry.department_id
  quantity      DECIMAL(10,2) NOT NULL,
  unit          VARCHAR(20) NOT NULL DEFAULT 'szt',
  notes         TEXT,
  used_at       TIMESTAMPTZ NOT NULL DEFAULT now()
)
-- INDEXES: user_id, material_id, used_at DESC, entry_id

material_alerts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id INT REFERENCES materials(id),
  reported_by UUID REFERENCES users(id),
  photo_url   VARCHAR(500),                -- zdjęcie niskiego stanu
  notes       TEXT,
  status      VARCHAR NOT NULL DEFAULT 'open',  -- 'open' | 'resolved'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
)
-- INDEXES: status, created_at DESC
```

**Logika foto-promocji:** jeśli materiał nie ma `photo_url` i alert ma zdjęcie → w jednej transakcji Prisma ustaw `material.photoUrl = alert.photoUrl`.

### Moduł 5: Zamówienia

```sql
purchase_orders (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id),
  location_id   INT REFERENCES locations(id),
  department_id INT REFERENCES departments(id),
  status        VARCHAR NOT NULL DEFAULT 'pending', -- pending | ordered | delivered | cancelled
  needed_by     DATE,
  notes         TEXT,
  report_id     UUID REFERENCES daily_reports(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
)

purchase_order_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID REFERENCES purchase_orders(id) ON DELETE CASCADE,
  material_id INT REFERENCES materials(id),   -- NULL gdy pozycja z palca
  custom_name VARCHAR(300),                   -- wypełnione gdy spoza katalogu
  quantity    DECIMAL(10,2) NOT NULL,
  unit        VARCHAR(20) NOT NULL DEFAULT 'szt',
  notes       TEXT,
  CONSTRAINT item_material_or_name CHECK (
    (material_id IS NOT NULL AND custom_name IS NULL) OR
    (material_id IS NULL AND custom_name IS NOT NULL)
  )
)
```

**Migracja:** `20260422000000_add_purchases`

**Logika przejść statusu:** `pending→ordered→prepared→delivered`, każdy etap może przejść w `cancelled`.
- `pending→ordered`: can_order lub admin
- `ordered→prepared`: can_prepare lub admin (magazynier)
- `prepared→delivered`: can_order lub admin
- `→cancelled`: can_order, can_prepare lub admin; twórca może anulować tylko gdy `pending`.

**Promote item:** `POST /:orderId/items/:itemId/promote` — tworzy materiał w katalogu i aktualizuje pozycję (ustawia `material_id`, zeruje `custom_name`).

**Recent 30:** pobierz 300 ostatnich `material_usages` użytkownika (DESC usedAt), deduplikuj `materialId` w JS zachowując kolejność → pierwsze 30 unikalnych.

**Migracja:** `20260321000000_add_materials`

**Import danych:** `backend/prisma/importMaterials.ts` — wczytuje `towary_kategorie.xlsx`, pomija kategorie "Pozostałe materiały" i pozycje z `sprzet_wypozyczalnia.xlsx`, wstawia przez Prisma Client. Uruchamiane raz wewnątrz kontenera: `docker exec kahma-backend node -e "..."`.

---

## 7. API — zaimplementowane endpointy

### Auth `/api/v1/auth`
| Metoda | Endpoint | Opis |
|---|---|---|
| POST | `/login` | Logowanie — zwraca access token (JSON) + refresh token (cookie) |
| POST | `/refresh` | Odświeżenie access tokenu (rotacja refresh tokenu) |
| POST | `/logout` | Wylogowanie — usuwa refresh token z DB |
| GET | `/me` | Dane zalogowanego użytkownika |

### Users `/api/v1/users` (admin only)
| Metoda | Endpoint | Opis |
|---|---|---|
| GET | `/` | Lista wszystkich użytkowników |
| GET | `/:id` | Szczegóły użytkownika |
| POST | `/` | Utwórz użytkownika |
| PATCH | `/:id` | Edytuj (fullName, role, password, isActive) |

### Vehicles `/api/v1/vehicles`
| Metoda | Endpoint | Opis | Dostęp |
|---|---|---|---|
| GET | `/` | Lista pojazdów | wszyscy (pracownik: tylko aktywne) |
| POST | `/` | Dodaj pojazd | admin |
| PATCH | `/:id` | Edytuj / koryguj przebieg / dezaktywuj | admin |

### Daily Reports `/api/v1/daily-reports`
| Metoda | Endpoint | Opis | Dostęp |
|---|---|---|---|
| GET | `/` | Lista raportów z entries[] + signatures[] (filtry: from/to/userId/locationId/departmentId). Pracownik dostaje własne + podpisane (isSigned flag). | pracownik: własne+podpisane; admin: wszystkie |
| GET | `/export` | Eksport XLSX (1 wiersz per wpis per pracownik; sygnatariusze = osobne wiersze, kolumna "Podpisany") | admin |
| GET | `/available-to-sign` | Dzisiejsze raporty innych pracowników, pod które można się jeszcze podpisać | pracownik |
| GET | `/:id` | Szczegóły raportu z entries[], signatures[], materials[] (isSigned relative do requestera) | pracownik: własny lub podpisany; admin: każdy |
| POST | `/` | Utwórz kontener dnia lub zwróć istniejący (body: `{}` lub `{date}` lub `{date, userId}` — userId tylko admin) | wszyscy; `userId` tylko admin |
| POST | `/:reportId/entries` | Dodaj wpis do raportu | pracownik: własny lub podpisany (niezablokowany); admin: każdy |
| POST | `/:id/sign` | Podpisz się pod czyjś raport (tylko dziś, nie swój, nie dwa razy) | pracownik |
| POST | `/:id/unlock` | Odblokuj raport na 24h (unlocked_until = teraz+24h) | admin |
| PATCH | `/entries/:entryId` | Edytuj wpis | pracownik: własny lub podpisany (niezablokowany); admin: każdy |
| PATCH | `/:id/approve` | Zatwierdź raport (isOffer: `'offer'`/`'no_offer'`/`'to_quote'`/`null`) | admin |
| DELETE | `/entries/:entryId` | Usuń wpis | pracownik: własny lub podpisany (niezablokowany); admin: każdy |
| DELETE | `/:id/sign` | Cofnij podpis (body: `{ signerId }` — tylko admin; brak body = własny podpis, tylko dziś) | pracownik: własny; admin: dowolny |
| DELETE | `/:id` | Usuń pusty raport (blokada jeśli ma wpisy lub jest zatwierdzony) | admin |

### Equipment `/api/v1/equipment`
| Metoda | Endpoint | Opis | Dostęp |
|---|---|---|---|
| GET | `/categories` | Lista kategorii | wszyscy |
| GET | `/items` | Lista sprzętu (pracownik: bez retired) | wszyscy |
| POST | `/categories` | Dodaj kategorię | admin |
| POST | `/items` | Dodaj sprzęt | admin |
| PATCH | `/items/:id` | Edytuj sprzęt / zmień status | admin |
| DELETE | `/items/:id` | Usuń sprzęt (blokada jeśli jest historia) | admin |

### Equipment Rentals `/api/v1/equipment-rentals`
| Metoda | Endpoint | Opis | Dostęp |
|---|---|---|---|
| GET | `/` | Lista wypożyczeń | pracownik: własne; admin: wszystkie |
| POST | `/` | Wypożycz sprzęt (tylko `available`); body: `{ itemId, locationId, durationHours?, expectedReturn? }` | wszyscy |
| PATCH | `/:id/return` | Zwróć sprzęt | właściciel lub admin |
| PATCH | `/:id/report` | Przypisz / odpisz raport dnia (body: `{ reportId: uuid \| null }`) | właściciel lub admin |

### Equipment Issues `/api/v1/equipment-issues`
| Metoda | Endpoint | Opis | Dostęp |
|---|---|---|---|
| GET | `/` | Lista zgłoszeń | pracownik: własne; admin: wszystkie |
| POST | `/` | Zgłoś problem ze sprzętem | wszyscy |
| PATCH | `/:id` | Zmień status zgłoszenia | admin |

### Materials `/api/v1/materials`
| Metoda | Endpoint | Opis | Dostęp |
|---|---|---|---|
| GET | `/photo/:filename` | Serwuje plik zdjęcia (statyczny) | publiczny (unikalny filename) |
| GET | `/` | Szukaj materiałów (q≥3 znaki) / brak q → ostatnie 30 usera | wszyscy |
| GET | `/all` | Pełna lista materiałów | admin |
| POST | `/` | Dodaj materiał | admin |
| PATCH | `/:id` | Edytuj materiał | admin |

### Material Usages `/api/v1/material-usages`
| Metoda | Endpoint | Opis | Dostęp |
|---|---|---|---|
| GET | `/` | Lista pobrań (filtr: from/to) | pracownik: własne; admin: wszystkie |
| POST | `/` | Zarejestruj pobranie (materialId, quantity, unit, notes) | wszyscy |
| DELETE | `/:id` | Usuń pobranie z bieżącego dnia | właściciel |

### Material Alerts `/api/v1/material-alerts`
| Metoda | Endpoint | Opis | Dostęp |
|---|---|---|---|
| GET | `/` | Lista alertów | pracownik: własne; admin: wszystkie |
| POST | `/` | Zgłoś niski stan (multipart/form-data z opcjonalnym photo) | wszyscy |
| PATCH | `/:id/resolve` | Zamknij alert | admin |

### Purchase Orders `/api/v1/purchase-orders`
| Metoda | Endpoint | Opis | Dostęp |
|---|---|---|---|
| GET | `/` | Lista zamówień (filtry: status, locationId, userId, from/to) | pracownik: własne; can_order/can_prepare/admin: wszystkie |
| POST | `/` | Utwórz zamówienie z pozycjami | wszyscy |
| GET | `/:id` | Szczegóły z pozycjami | twórca lub can_order/can_prepare/admin |
| PATCH | `/:id/status` | Zmień status wg reguł przejść | can_order (pending→ordered, prepared→delivered), can_prepare (ordered→prepared), admin (wszystkie) |
| PATCH | `/:id/report` | Przypisz raport (tylko gdy delivered) | twórca lub can_order/can_prepare/admin |
| PATCH | `/:id/cancel` | Anuluj zamówienie | twórca (pending) lub can_order/can_prepare/admin |
| POST | `/:orderId/items` | Dodaj pozycję (tylko pending) | twórca lub can_order/admin |
| PATCH | `/:orderId/items/:itemId` | Edytuj pozycję (tylko pending) | twórca lub can_order/admin |
| DELETE | `/:orderId/items/:itemId` | Usuń pozycję (tylko pending, min. 1 pozycja) | twórca lub can_order/admin |
| POST | `/:orderId/items/:itemId/promote` | Dodaj pozycję ręczną do katalogu materiałów | can_order lub admin |

### Konwencje odpowiedzi
```json
{ "success": true,  "data": { ... } }
{ "success": false, "error": "Komunikat błędu" }
```

---

## 8. Uprawnienia per endpoint

| Zasób | pracownik | can_order | can_prepare | admin |
|---|---|---|---|---|
| Własny raport — odczyt/zapis | ✅ | ✅ | ✅ | ✅ |
| Edycja raportu z bieżącego dnia | ✅ | ✅ | ✅ | ✅ |
| Edycja raportu z poprzednich dni | ❌ (zablokowany) | ❌ | ❌ | ✅ |
| Raporty wszystkich pracowników | ❌ | ❌ | ❌ | ✅ |
| Eksport XLSX | ❌ | ❌ | ❌ | ✅ |
| Flota — lista do wyboru w raporcie | ✅ (tylko aktywne) | ✅ | ✅ | ✅ (wszystkie) |
| Flota — dodaj / edytuj / koryguj | ❌ | ❌ | ❌ | ✅ |
| Zarządzanie użytkownikami | ❌ | ❌ | ❌ | ✅ |
| Sprzęt — lista (bez retired) | ✅ | ✅ | ✅ | ✅ (z retired) |
| Sprzęt — dodaj / edytuj / usuń | ❌ | ❌ | ❌ | ✅ |
| Kategorie sprzętu — lista | ✅ | ✅ | ✅ | ✅ |
| Kategorie sprzętu — dodaj | ❌ | ❌ | ❌ | ✅ |
| Wypożyczenia — własne | ✅ | ✅ | ✅ | ✅ (wszystkie) |
| Wypożycz sprzęt | ✅ | ✅ | ✅ | ✅ |
| Zwróć sprzęt | ✅ (własne) | ✅ (własne) | ✅ (własne) | ✅ (każde) |
| Zgłoszenia problemów — własne | ✅ | ✅ | ✅ | ✅ (wszystkie) |
| Zgłoś problem | ✅ | ✅ | ✅ | ✅ |
| Zmień status zgłoszenia | ❌ | ❌ | ❌ | ✅ |
| Materiały — wyszukaj / ostatnie 30 | ✅ | ✅ | ✅ | ✅ |
| Materiały — pełna lista / dodaj / edytuj | ❌ | ❌ | ❌ | ✅ |
| Zarejestruj pobranie materiału | ✅ | ✅ | ✅ | ✅ |
| Usuń własne pobranie (bieżący dzień) | ✅ (własne) | ✅ (własne) | ✅ (własne) | ✅ |
| Lista pobrań | ✅ (własne) | ✅ (własne) | ✅ (własne) | ✅ (wszystkie + filtr dat) |
| Zgłoś niski stan materiału | ✅ | ✅ | ✅ | ✅ |
| Zamknij alert niskiego stanu | ❌ | ❌ | ❌ | ✅ |
| Zamówienia — lista | ✅ (własne) | ✅ (wszystkie) | ✅ (wszystkie) | ✅ (wszystkie) |
| Utwórz zamówienie | ✅ | ✅ | ✅ | ✅ |
| Zmień status: pending→ordered | ❌ | ✅ | ❌ | ✅ |
| Zmień status: ordered→prepared | ❌ | ❌ | ✅ | ✅ |
| Zmień status: prepared→delivered | ❌ | ✅ | ❌ | ✅ |
| Anuluj zamówienie | ✅ (tylko własne pending) | ✅ | ✅ | ✅ |
| Dodaj pozycję do katalogu (promote) | ❌ | ✅ | ❌ | ✅ |

---

## 9. Bezpieczeństwo

- Hasła: bcrypt (12 rund)
- JWT: access token 15min (JSON body), refresh token 7d (HttpOnly, Secure, SameSite=Strict, path=/api/v1/auth)
- Refresh token przechowywany jako SHA-256 hash w DB, rotacja przy każdym użyciu
- CORS: tylko `https://kahma.leanmatik.net`
- `app.set('trust proxy', 1)` — poprawna obsługa IP za Nginx (rate-limiter)
- Helmet.js na Express
- Rate limiting: 20 prób / 15min na `/api/v1/auth/login`
- Walidacja: Zod (backend) + React Hook Form + Zod (frontend)

---

## 10. Struktura katalogów — aktualny stan

```
kahma/
├── docker-compose.yml
├── .env                              # NIE commitować
├── masterplan.md
├── nginx/
│   └── nginx.conf
│
├── backend/
│   ├── Dockerfile                    # multi-stage: builder → production Alpine
│   ├── package.json
│   ├── tsconfig.json
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── seed.ts                   # tworzy role + admin (admin/admin1234)
│   │   └── migrations/
│   │       ├── 20260319000000_init/
│   │       ├── 20260319000001_add_daily_reports/
│   │       └── 20260319000002_add_vehicle_km_base/
│   └── src/
│       ├── index.ts                  # Express app entry (trust proxy, routes)
│       ├── config/env.ts
│       ├── lib/prisma.ts
│       ├── middleware/
│       │   ├── auth.ts               # JWT verify → req.user
│       │   ├── authorize.ts          # sprawdzanie roli
│       │   └── errorHandler.ts
│       ├── shared/
│       │   ├── ApiError.ts           # fabryki błędów (400/401/403/404/409/500)
│       │   └── response.ts           # ok() / created()
│       └── modules/
│           ├── auth/
│           │   ├── auth.schemas.ts
│           │   ├── auth.service.ts   # login / refresh / logout
│           │   ├── auth.controller.ts
│           │   └── auth.routes.ts
│           ├── users/
│           │   ├── users.schemas.ts
│           │   ├── users.service.ts
│           │   ├── users.controller.ts
│           │   └── users.routes.ts
│           ├── vehicles/
│           │   ├── vehicles.schemas.ts
│           │   ├── vehicles.service.ts  # getAll z lastKm = max(kmBase, ostatnie kmEnd)
│           │   ├── vehicles.controller.ts
│           │   └── vehicles.routes.ts
│           ├── dailyReport/
│           │   ├── dailyReport.schemas.ts
│           │   ├── dailyReport.service.ts  # isLocked dynamiczne, exportXlsx
│           │   ├── dailyReport.controller.ts
│           │   └── dailyReport.routes.ts   # /export PRZED /:id
│           ├── equipment/
│           │   ├── equipment.schemas.ts
│           │   ├── equipment.service.ts    # getItems (bez retired dla pracownika), blokada usunięcia
│           │   ├── equipment.controller.ts
│           │   └── equipment.routes.ts
│           ├── equipmentRentals/
│           │   ├── equipmentRentals.schemas.ts
│           │   ├── equipmentRentals.service.ts  # rent/return z $transaction, filtr roli
│           │   ├── equipmentRentals.controller.ts
│           │   └── equipmentRentals.routes.ts
│           ├── equipmentIssues/
│               ├── equipmentIssues.schemas.ts
│               ├── equipmentIssues.service.ts   # filtr roli, zmiana statusu
│               ├── equipmentIssues.controller.ts
│               └── equipmentIssues.routes.ts
│           ├── materials/
│           │   ├── materials.service.ts    # search (ILIKE AND), recent30, CRUD admin
│           │   ├── materials.controller.ts # photoHandler (static, path-traversal safe)
│           │   └── materials.routes.ts    # /photo/:filename (publiczny) + reszta (auth)
│           ├── materialUsages/
│           │   ├── materialUsages.service.ts
│           │   ├── materialUsages.controller.ts
│           │   └── materialUsages.routes.ts
│           └── materialAlerts/
│               ├── materialAlerts.service.ts  # create z foto-promocją ($transaction)
│               ├── materialAlerts.controller.ts  # multer wewnątrz controllera
│               └── materialAlerts.routes.ts
│       └── middleware/
│           └── upload.ts               # multer diskStorage, 8MB, images only
│
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── vite.config.ts
    ├── tailwind.config.ts            # paleta "Sapphire Navy"
    └── src/
        ├── main.tsx
        ├── index.css                 # globalne style, iOS input fix
        ├── types/index.ts            # User, AuthUser, ApiResponse
        ├── router/index.tsx          # React Router v6
        ├── store/
        │   └── authStore.ts          # Zustand + persist
        ├── api/
        │   ├── client.ts             # Axios + Bearer interceptor + auto-refresh
        │   ├── auth.api.ts
        │   ├── users.api.ts
        │   ├── vehicles.api.ts       # Vehicle z lastKm
        │   ├── reports.api.ts        # list / getById / create / update / exportXlsx
        │   ├── equipment.api.ts      # equipmentApi + rentalsApi + issuesApi
│   └── materials.api.ts     # materialsApi + materialUsagesApi + materialAlertsApi
        ├── lib/cn.ts
        ├── layouts/
        │   ├── AuthLayout.tsx        # granatowy gradient z siatką kropek
        │   └── AppLayout.tsx         # sidebar desktop + bottom-sheet mobile
        ├── components/ui/
        │   ├── Button.tsx
        │   ├── Input.tsx
        │   ├── Select.tsx
        │   ├── Badge.tsx
        │   ├── Modal.tsx             # jeden Dialog.Content (fix: dwa powodowały zamknięcie)
        │   └── Spinner.tsx
        └── pages/
            ├── Login.tsx
            ├── Dashboard.tsx         # kafelki modułów (Raporty aktywne, reszta wkrótce)
            ├── admin/
            │   ├── Users.tsx         # tabela desktop / karty mobile, modal dodaj/edytuj
            │   └── Vehicles.tsx      # lista z lastKm, dodaj (z km_base), edytuj/koryguj
            ├── reports/
            │   ├── ReportsPage.tsx   # AdminView (filtry + eksport) / EmployeeView (tylko własne)
            │   └── ReportForm.tsx    # data = dziś (bez inputu), auto-lastKm z pojazdu
            ├── equipment/
            │   └── EquipmentPage.tsx # pracownik: wypożycz/zwróć/problem; admin: 3 taby (sprzęt/wypożyczenia/zgłoszenia)
            └── materials/
                └── MaterialsPage.tsx # EmployeeView: search+recent30+UsageForm+alert; AdminView: 3 taby (zużycie/niski stan/lista)
```

---

## 11. Zmienne środowiskowe (`.env`)

```env
# PostgreSQL
POSTGRES_DB=kahma
POSTGRES_USER=kahma_user
POSTGRES_PASSWORD=Kahma2026Secure     # bez znaków specjalnych (# łamie URL)
DB_PORT=5433

# Backend
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://kahma_user:Kahma2026Secure@kahma-db:5432/kahma
JWT_ACCESS_SECRET=<64-bajty hex>
JWT_REFRESH_SECRET=<64-bajty hex>
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d
CORS_ORIGIN=https://kahma.leanmatik.net

# Frontend (Vite)
VITE_API_URL=/api/v1
```

---

## 12. Kolejność implementacji MVP

```
FAZA 1 — CORE ✅ UKOŃCZONA
  ├── docker-compose.yml + sieci + wolumeny
  ├── Nginx config (reverse proxy + gzip)
  ├── Backend: Express + Prisma + middleware
  ├── DB: schema core (roles, users, refresh_tokens)
  ├── Backend: auth endpoints (login/refresh/logout/me)
  ├── Backend: users CRUD (admin only)
  ├── Frontend: ekran logowania (navy gradient)
  ├── Frontend: AppLayout — sidebar desktop + hamburger mobile
  └── Frontend: Dashboard z kafelkami modułów

FAZA 2 — Moduł: Raport Dnia ✅ UKOŃCZONA
  ├── DB: schema (vehicles + km_base, daily_reports, vehicle_usage)
  ├── DB: migracje 000001 (tabele) + 000002 (km_base)
  ├── Backend: vehicles CRUD (GET wszyscy / POST+PATCH admin)
  ├── Backend: lastKm = max(km_base, ostatnie kmEnd) w serwisie
  ├── Backend: daily-reports CRUD + blokada dynamiczna
  ├── Backend: GET /daily-reports/export (XLSX, tylko admin)
  ├── Frontend: ReportsPage — AdminView (filtry zawsze widoczne, eksport)
  ├── Frontend: ReportsPage — EmployeeView (własne raporty, bez filtrów)
  ├── Frontend: ReportForm — data zafixowana na dziś, auto-lastKm z pojazdu
  ├── Frontend: Vehicles admin — dodaj (z km_base) / edytuj / koryguj / toggle
  └── Bugfixy: Modal (dwa Dialog.Content), trust proxy, rate-limiter

FAZA 3 — Moduł: Wypożyczalnia ✅ UKOŃCZONA
  ├── DB: schema (equipment_categories, equipment_items, rentals, issues)
  ├── DB: migracja 20260320000000_add_equipment
  ├── Backend: equipment CRUD — 6 endpointów (kategorie + sprzęt, admin)
  ├── Backend: equipment-rentals — rent / return z $transaction
  ├── Backend: equipment-issues — zgłoś problem / zmień status
  ├── Frontend: EquipmentPage — EmployeeView (wyszukiwanie, grupowanie, karty)
  ├── Frontend: EquipmentPage — AdminView (3 taby: sprzęt / wypożyczenia / zgłoszenia)
  ├── Frontend: InlineForms — ReturnForm, IssueForm
  └── Frontend: equipment.api.ts — 3 klienty API (equipment, rentals, issues)

FAZA 4 — Moduł: Materiały ✅ UKOŃCZONA
  ├── DB: schema (materials, material_usages, material_alerts)
  ├── DB: migracja 20260321000000_add_materials
  ├── Backend: materials — wyszukiwanie (ILIKE AND, min 3 znaki), CRUD admin
  ├── Backend: material-usages — log pobrania, lista (filtr roli + zakres dat)
  ├── Backend: material-alerts — zgłoś niski stan z multer photo upload
  ├── Backend: upload middleware (multer, diskStorage, /app/uploads)
  ├── Backend: photo → staje się zdjęciem materiału jeśli brak (transakcja)
  ├── Import script: prisma/importMaterials.ts (z towary_kategorie.xlsx)
  ├── Docker: wolumen kahma_uploads dla trwałości zdjęć
  ├── Frontend: MaterialsPage — EmployeeView (search + recent30 + usage form + alert)
  ├── Frontend: MaterialsPage — AdminView (3 taby: zużycie/niski stan/lista)
  └── Frontend: materials.api.ts — 3 klienty (materials, usages, alerts)

POPRAWKI UI — sesja 2026-03-21 ✅
  ├── [Materiały] Jednostka: datalist→select, lista: szt/mb/kg/kpl/rolka/opak/l
  ├── [Materiały] Admin zużycie: domyślnie "dziś", przyciski Dziś/7 dni/30 dni
  ├── [Wypożyczalnia] Własny sprzęt: zielone tło karty + zielona ikona
  ├── [Wypożyczalnia] Przycisk "Problem" tylko dla własnych wypożyczeń
  ├── [Wypożyczalnia] "Twoje wypożyczenia" — karty z przyciskami Zwróć i Problem
  ├── [Button.tsx] Bug: props.style nadpisywał gradient tła — fix: merge ...props.style
  ├── [Login] Usunięto napis "System zarządzania pracownikami"
  └── [Raporty] 1 raport dziennie: jeśli istnieje → "Edytuj dzisiejszy" zamiast "Nowy raport"

REFACTOR RAPORTÓW — sesja 2026-03-24 ✅
  ├── DB: nowa tabela teams (id, name, is_active)
  ├── DB: nowa tabela report_entries — wiele wpisów per dzień
  │       pola: work_start, work_end, location_id, team_id (opt.), description
  ├── DB: daily_reports stał się kontenerem dnia (user_id + report_date)
  ├── DB: vehicle_usage.report_id → entry_id (pojazd per wpis, nie per dzień)
  ├── DB: migracja 20260324000000_add_entries_and_teams (z migracją danych)
  ├── Backend: nowy moduł /api/v1/teams (GET wszyscy, POST/PATCH admin)
  ├── Backend: POST /daily-reports → tworzy kontener dnia lub zwraca istniejący
  ├── Backend: POST /daily-reports/:id/entries → dodaje wpis
  ├── Backend: PATCH /daily-reports/entries/:id → edytuje wpis
  ├── Backend: DELETE /daily-reports/entries/:id → usuwa wpis
  ├── Backend: filtr teamId w liście i eksporcie; XLSX: 1 wiersz per wpis + kolumna Zespół
  ├── Frontend: ReportsPage — karty pokazują liczbę wpisów, łączny czas, lokalizacje, zespoły
  ├── Frontend: ReportForm → strona dnia (EntryCard lista + EntryModal dodaj/edytuj)
  └── Frontend: teams.api.ts + zaktualizowane reports.api.ts i types/index.ts

SESJA 2026-04-01 — Sygnatury raportów ✅
  ├── DB: nowa tabela report_signatures (id, report_id→CASCADE, signer_id, signed_at)
  ├── DB: migracja 20260401000000_add_report_signatures
  ├── Backend: 3 nowe endpointy: POST /:id/sign, DELETE /:id/sign, GET /available-to-sign
  ├── Backend: list() pracownika zwraca własne raporty + podpisane (OR condition)
  ├── Backend: isSigned flag w każdym raporcie (względem requestera)
  ├── Backend: exportXlsx — sygnatariusze jako osobne wiersze z kolumną "Podpisany: Tak"
  ├── Frontend: badge "Podpisany" na karcie raportu
  ├── Frontend: przycisk "Podpisz się" w nagłówku EmployeeView
  ├── Frontend: SignModal — lista dzisiejszych raportów kolegów do podpisania
  └── Frontend: przycisk "Cofnij" na karcie podpisanego raportu (tylko dziś)

SESJA 2026-04-01 (2) — Poprawki i rozszerzenia raportów ✅
  ├── [Bug] Sygnatariusz dostawał 403 przy wejściu w raport — getById/addEntry/updateEntry/deleteEntry
  │       teraz przepuszczają użytkownika jeśli jest na liście signatures raportu
  ├── Sygnatariusz może dodawać/edytować/usuwać wpisy w podpisanym raporcie
  ├── UI: lista raportów pracownika podzielona na sekcje "Dziś" i "Historia"
  ├── UI: formularz wpisu zapisuje szkic do sessionStorage — przeżywa odświeżenie strony
  ├── DB: vehicle_usage — usunięto UNIQUE(entry_id) → wiele pojazdów per wpis
  │       migracja: 20260401000001_multi_vehicle
  ├── Backend: vehicleUsage (singular) → vehicleUsages (array) we wszystkich endpointach
  ├── Backend: addEntry/updateEntry — createMany/deleteMany dla pojazdów
  ├── XLSX: kolumna "Pojazdy" (lista rejestracji) + "Km łącznie" zamiast jednej kolumny
  ├── Frontend: sekcja pojazdów w EntryModal — dynamiczna lista wierszy (Dodaj/Usuń pojazd)
  ├── Frontend: EntryCard wyświetla wszystkie pojazdy jako badge'e
  ├── DB: daily_reports.unlocked_until TIMESTAMPTZ — admin odblokuje raport na 24h
  │       migracja: 20260401000002_add_unlocked_until
  ├── Backend: isLocked() sprawdza unlocked_until; POST /:id/unlock (admin)
  ├── Frontend: przycisk "Odblokuj na 24h" w liście (AdminView) i na stronie raportu
  ├── Frontend: badge "Odblokowany do HH:MM" na karcie raportu
  ├── [Bug] updateEntry: include { vehicleUsage } → include { report } (stare pole po refaktorze)
  ├── [Bug] available-to-sign nie odświeżało się po podpisaniu — dodano invalidację queryKey
  ├── Lokalizacja w formularzu wpisu: select filtrowany do jednej opcji gdy raport ma wpisy
  ├── UI: kafelki zespołów — grid 2 kolumny zamiast listy pionowej; imiona skrócone do pierwszego
  └── UI: przycisk "Podpis" — większy, pełny niebieski, zawsze widoczny napis

FAZA 5 — Rozszerzenia (po MVP)
  ├── Powiadomienia Telegram
  ├── Zarządzanie zespołami (strona admin /admin/zespoly)
  └── Ewentualna rola "kierownik"

SESJA 2026-04-02 — Poprawki UI + import nowej bazy materiałów
  ├── [Dane] Nowa baza materiałów: 4535 pozycji z "nowe towary.xlsx" (11 arkuszy, Symbol→catalog_number)
  │       skrypt: backend/prisma/clearAndImport.ts
  ├── [Dane] Wyczyszczono całą historię: raporty, wpisy, sygnatury, pojazdy, wypożyczenia, pobrania, alerty
  ├── [Dane] Usunięto lokalizację "Aparatownia"
  ├── [Dane] Dodano 6 sprzętów: Zwyżka 12m, Zwyżka 8m (kat. Sprzęt wysokościowy);
  │         Wiertarka Hilti, Szlifierka 125mm, Miernik Fluke 376 FC, Poziomnica laserowa (kat. Sprzęt montażowy)
  ├── [Dane] Dodano zespoły: Ekipa D, Ekipa E, Ekipa F (były A/B/C)
  ├── [UI] Dashboard: siatka kafelków modułów grid-cols-2 zawsze (wcześniej sm:grid-cols-2)
  ├── [UI] Dashboard: statystyki użytkownika — 4 kafelki (raporty/godziny/wypożyczenia/pobrania w miesiącu)
  │       endpoint: GET /api/v1/users/me/stats (dostępny bez authorize('admin'))
  ├── [UI] Dashboard: przypomnienie o raporcie — baner amber po 12:00 gdy brak raportu na dziś
  ├── [UI] Raport — kafelki zespołów: amber gdy ktoś już wpisany, zielony gdy zaznaczony, szary gdy pusty
  ├── [UI] Raport — kafelki zespołów: items-stretch + minHeight 52px (wyrównana wysokość)
  ├── [UI] Raport — przycisk usuwania wpisu przeniesiony do prawego dolnego rogu karty (position: absolute)
  ├── [UI] Raport — AddMaterialPanel: dodano checkbox "Zgłoś niski stan" z foto i notatką (jak w MaterialsPage)
  ├── [Fix] MaterialsPage admin — dark mode: background '#fff' → t.surfaceAlt w 3 miejscach
  │         (AdminMaterialsList search, lista materiałów; AdminMonthlyPanel lista ogólna)
  └── [Fix] MaterialsPage admin — dark mode: hardkodowane kolory tekstu → t.inkMuted / t.blue.text / t.amber.text

SESJA 2026-04-03 — Moduł HR + UI logo
  ├── [Fix] Dashboard statystyki — godziny i raporty uwzględniają teraz podpisane raporty pracownika
  │         (users.service.ts: getMyStats → ownReports + signedReports przez report_signatures.signerId)
  ├── [Moduł HR] DB: leave_types (seed 5 typów), leave_balances (upsert), leave_requests
  │         migracja: 20260403000000_add_hr
  ├── [Moduł HR] Backend: /api/v1/hr — 10 endpointów (typy, salda, wnioski, obecność, kalendarz)
  │         L4 nie odlicza z puli; walidacja nakładających się wniosków; getAttendance uwzględnia sygnatariuszy
  ├── [Moduł HR] Frontend: zakładka HR + kafelek na dashboardzie (amber, icon: UserCheck)
  │         Pracownik: saldo (26 dni) + złóż wniosek + lista + kalendarz miesięczny obecności
  │         Admin: 4 taby — Wnioski / Salda / Obecność (tabela users×dni) / Kalendarz zespołu
  ├── [Fix HR] Obecność admina: getAttendance kredytuje godziny autorowi ORAZ sygnatariuszom raportu
  │         (include signatures w zapytaniu; creditTo = [author, ...signers])
  ├── [UI] Logowanie: logo kahma.png (width:360px) na ciemnoszarym tle (#18181b→#27272a)
  │         zamiast granatowego gradientu + litery "K"
  └── [UI] Sidebar + mobile header: logo-male.png (885×180px) zamiast kafelka z literą "K" i napisu "Kahma"
          desktop sidebar: 120px | mobile sidebar: 120px | mobile header: 100px

SESJA 2026-04-03 (2) — Materiały: filtrowanie po lokalizacji i wydziale
  ├── [DB] Migracja: 20260403000001_material_usages_location
  │         ADD COLUMN location_id INT REFERENCES locations(id)
  │         ADD COLUMN department_id INT REFERENCES departments(id)
  │         + indeksy na obu kolumnach
  ├── [Backend] materialUsages: buildWhere() helper — używany przez list i exportFiltered
  │         usageInclude rozszerzony o location i department (select id+name)
  │         create() zapisuje locationId i departmentId z DTO
  │         Nowy endpoint: GET /material-usages/export → XLSX z filtrami (from/to/userId/locationId/departmentId)
  ├── [Frontend] materials.api.ts: MaterialUsage rozszerzony o location/department/locationId/departmentId
  │         materialUsagesApi.list() — nowe parametry: locationId, departmentId
  │         materialUsagesApi.create() — nowe parametry: locationId, departmentId
  │         Nowa metoda: materialUsagesApi.exportFiltered()
  ├── [Frontend] ReportForm.tsx: AddMaterialPanel przyjmuje locationId/departmentId
  │         Przekazuje je z report.entries[0]?.location?.id i report.entries[0]?.department?.id
  └── [Frontend] MaterialsPage.tsx: nowy tab "Zestawienie" w AdminView (5 tabów zamiast 4)
          Filtry: od/do, lokalizacja, wydział (zależny od lokalizacji), pracownik
          Wyniki: tabela Data/Pracownik/Lokalizacja/Materiał/Ilość/Jedn.
          Przycisk "Eksportuj XLSX" → materialUsagesApi.exportFiltered()

SESJA 2026-04-03 (3) — Kliknięcie logo → Dashboard
  └── [UI] AppLayout.tsx: logo-male.png w 3 miejscach (desktop sidebar, mobile sidebar, mobile header)
          opakowane w <button> z onClick={() => navigate('/dashboard')}
          mobile sidebar zamyka się po kliknięciu (setOpen(false))

SESJA 2026-04-07 — Materiały per wpis + jedna ekipa per dzień
  ├── [DB] Migracja: 20260407000000_material_entry_team_report
  │         ADD COLUMN entry_id UUID REFERENCES report_entries(id) ON DELETE SET NULL → material_usages
  │         ADD COLUMN team_id INT REFERENCES teams(id) → daily_reports
  │         DROP COLUMN team_id FROM report_entries (migracja danych: first entry's team → report.team_id)
  │         CREATE INDEX material_usages_entry_id_idx
  ├── [Backend] schema.prisma: ReportEntry traci team; DailyReport zyskuje team; MaterialUsage zyskuje entry
  ├── [Backend] materialUsages.service: create() — gdy entryId podany → auto-wypełnia locationId/departmentId/reportId z wpisu
  ├── [Backend] dailyReport.schemas: usunięto teamId z createEntrySchema/updateEntrySchema; dodano setTeamSchema
  ├── [Backend] dailyReport.service:
  │         entrySelect (lean, bez materialUsages) + entrySelectFull (z materialUsages, tylko getById)
  │         reportSelect (lean) + reportSelectFull (dla getById i exportXlsx)
  │         addEntry/updateEntry: bez teamId
  │         setTeam(): PATCH /:id/team — pracownik może ustawić ekipę raz (nie można zmienić); admin zawsze może
  │         getById: zwraca entries[].materialUsages (zamiast osobnej tablicy report.materials)
  │         exportXlsx: team z r.team (poziom raportu), materiały per wpis w arkuszu "Materiały"
  ├── [Backend] teams.service: listWithMembers() → pyta dailyReports.teamId zamiast reportEntries.teamId
  ├── [Backend] dailyReport.routes: PATCH /:id/team (setTeamHandler)
  ├── [Frontend] reports.api.ts: ReportEntry traci team; Report zyskuje team; dodano setTeam(); EntryMaterial type
  ├── [Frontend] materials.api.ts: MaterialUsage zyskuje entryId; create() przyjmuje entryId
  ├── [Frontend] ReportForm.tsx:
  │         EntryModal: usunięto selektor ekipy
  │         EntryCard: pokazuje materialUsages per wpis + przycisk "Dodaj materiał" (inline panel)
  │         AddMaterialPanel: teraz przyjmuje entryId zamiast locationId/departmentId
  │         TeamSelector (nowy komponent): kafelki ekip na poziomie raportu
  │           — pracownik bez ekipy: może wybrać; po wyborze — zablokowane ("Nie możesz zmienić ekipy")
  │           — admin: zawsze może zmieniać
  └── [Frontend] ReportsPage.tsx + DayOverview.tsx: team z report.team (nie entry.team)

SESJA 2026-04-07 (2) — Materiały w EntryModal + fix admin
  ├── [Backend] materialUsages.service: create() — admin pomija sprawdzanie owner/sygnatariusz
  ├── [Backend] materialUsages.controller: przekazuje req.user!.role do svc.create()
  ├── [Frontend] ReportForm.tsx — EntryModal przeprojektowany:
  │         Nowy wpis: Krok 1 = formularz ("Zapisz wpis") → Krok 2 = materiały ("Gotowe")
  │         Edycja wpisu: sekcja "Materiały zużyte" inline pod formularzem (add/delete)
  │         AddMaterialPanel.onAdded: zwraca EntryMaterial — lokalny stan materiałów
  │         removeMaterial(): DELETE /material-usages/:id + aktualizacja lokalnego stanu
  │         handleSave(): zwraca { entryId } zamiast void
  ├── [Fix dark mode] AddMaterialPanel lista wyników: hover:bg-blue-50 powodował biały tekst
  │         → MaterialListItem komponent z React state (onMouseEnter/Leave) + t.blue.bg token
  ├── [Fix kolejność] W edycji wpisu sekcja "Materiały zużyte" wyświetlana PRZED przyciskiem "Zapisz zmiany"

SESJA 2026-04-07 (3) — Resetowanie sprzętu + fix MaterialsPage entryId
  ├── [Dane] Sprzęt wypożyczalni całkowicie zresetowany:
  │         21 pojazdów z tablicami WGS* → tabela `vehicles` (flota, przez fixEquipmentVehicles.ts)
  │         8 podnośników → tabela `equipment_items` w kat. "Podnośniki"
  │         Stary pojazd (Ford Focus WML68YE) dezaktywowany
  │         Skrypt: backend/prisma/fixEquipmentVehicles.ts
  │         UWAGA: vehicles nie ma pola kmBase w create (tylko update); jest domyślnie 0 w schemacie
  ├── [Fix] MaterialsPage.tsx — UsageForm: materiał bez entryId nie pojawiał się w raporcie
  │         Dodano stan entryId (resetowany przy zmianie reportId)
  │         Po wyborze raportu pojawia się drugi dropdown "Wpis (lokalizacja)" z entries tego raportu
  │         materialUsagesApi.create() teraz przekazuje entryId (nie reportId)
  │         Backend auto-wypełnia reportId/locationId/departmentId z wpisu (istniejąca logika)
  │         Walidacja wymaga zarówno reportId (wybór listy) jak i entryId (wybór wpisu)
  │         Jeśli raport nie ma wpisów → komunikat z prośbą o dodanie wpisu w raporcie

SESJA 2026-04-22 — Moduł Zamówień (Zakupy)
  ├── [DB] Migracja: 20260422000000_add_purchases
  │         ADD COLUMN can_order BOOLEAN DEFAULT false → users
  │         CREATE TABLE purchase_orders (id, user_id, location_id, department_id, status, needed_by, notes, report_id)
  │         CREATE TABLE purchase_order_items (id, order_id, material_id, custom_name, quantity, unit, notes)
  │         CHECK CONSTRAINT: item ma albo material_id albo custom_name (nigdy oba)
  ├── [Backend] schema.prisma: PurchaseOrder + PurchaseOrderItem modele + relacje do User/Location/Department/DailyReport/Material
  ├── [Backend] canOrder w JWT (auth.service.ts) + req.user.canOrder (middleware/auth.ts + express.d.ts)
  ├── [Backend] users: canOrder w userSelect, create(), update(), schemas
  ├── [Backend] nowy moduł purchaseOrders/ (schemas, service, controller, routes)
  │         Logika przejść: pending→ordered→delivered, cancel z każdego stanu (can_order/admin)
  │         promote endpoint: tworzy materiał w katalogu + aktualizuje item (atomowo)
  ├── [Frontend] types/index.ts: canOrder w User i AuthUser
  ├── [Frontend] authStore.ts: canOrder() helper (true gdy user.canOrder || admin)
  ├── [Frontend] users.api.ts: canOrder w payload typach
  ├── [Frontend] purchases.api.ts: pełny klient API (PurchaseOrder, OrderItem, wszystkie metody)
  ├── [Frontend] PurchasesPage.tsx: EmployeeView (własne) + OrdererView (wszystkie + filtry)
  │         NewOrderModal: koszyk z dynamiczną listą pozycji (z katalogu lub ręcznie)
  │         OrderDetailModal: status, pozycje, zmiana statusu, "Dodaj do katalogu", przypisz raport
  ├── [Frontend] router/index.tsx: trasa /zakupy
  ├── [Frontend] Dashboard.tsx: kafelek "Zamówienia" (indigo, ShoppingCart)
  ├── [Frontend] admin/Users.tsx: checkbox canOrder w formularzach create + edit
  ├── [Fix] Button.tsx nie ma wariantu 'success' — zmieniono na 'primary' w OrderDetailModal
  ├── [Fix] errorHandler.ts: Prisma P2003/P2025/P2002 zwracają teraz 400/404/409 zamiast 500
  └── [Fix] AppLayout.tsx: zakładka "Zamówienia" (ShoppingCart) dodana do navItems w hamburgerze i sidebarze

SESJA 2026-04-22 — Poprawki UX
  ├── [Raporty] Potwierdzenie przed usunięciem wpisu
  │       ReportForm.tsx: stan confirmDeleteId (string|null) — kliknięcie "usuń" ustawia ID
  │       Modal z tytułem "Usuń wpis" i przyciskami Anuluj / Usuń wpis (variant=danger)
  │       deleteMutation.mutate() wywoływany dopiero po potwierdzeniu; modal zamykany w onSuccess
  ├── [Raporty] Ochrona materiałów — usunięcie tylko własnych
          EntryMaterial (reports.api.ts): dodano pole user: { id, fullName } (backend już zwracał)
          EntryModal: dodano useAuthStore(); przycisk Trash2 widoczny tylko gdy m.user.id === user.id lub admin
          Backend (materialUsages.service.ts remove()): sprawdzenie usage.userId !== userId już istniało — brak zmian
  └── [Raporty] Blokada km bez wybranego pojazdu
          EntryModal i NewReportPage: noVehicle = vehicleId === 0
          select onChange → setValue(kmDriven, 0) gdy brak pojazdu
          km input: disabled + opacity 0.4 gdy noVehicle

SESJA 2026-04-24 — Magazynier (can_prepare)
  ├── [DB] Migracja: 20260424000000_add_prepared_status
  │         ADD COLUMN can_prepare BOOLEAN NOT NULL DEFAULT false → users
  │         (status VARCHAR nie wymaga zmiany — 'prepared' to nowa wartość)
  ├── [Backend] schema.prisma: canPrepare Boolean @default(false) @map("can_prepare") w modelu User
  ├── [Backend] schema.prisma: komentarz statusów PurchaseOrder zaktualizowany (pending|ordered|prepared|delivered|cancelled)
  ├── [Backend] middleware/auth.ts: canPrepare w AccessTokenPayload i req.user
  ├── [Backend] types/express.d.ts: canPrepare w Request.user
  ├── [Backend] auth.service.ts: canPrepare w generateAccessToken() + odpowiedź login/refresh
  ├── [Backend] users.service.ts: canPrepare w userSelect, create(), update()
  ├── [Backend] users.schemas.ts: canPrepare w createUserSchema i updateUserSchema
  ├── [Backend] purchaseOrders.schemas.ts: 'prepared' dodane do listOrdersSchema i updateStatusSchema
  ├── [Backend] purchaseOrders.service.ts:
  │         Requester rozszerzony o canPrepare
  │         canPrepareOrder() helper (admin || canPrepare)
  │         ALLOWED_TRANSITIONS: ordered→['prepared','cancelled'], prepared→['delivered','cancelled']
  │         canTransition() — granularna kontrola: kto może wykonać które przejście
  │         list(): can_prepare widzi wszystkie zamówienia (jak can_order)
  │         assertAccess(): can_prepare ma dostęp do szczegółów i anulowania
  ├── [Backend] purchaseOrders.controller.ts: requester() przekazuje canPrepare
  ├── [Frontend] types/index.ts: canPrepare w User i AuthUser
  ├── [Frontend] store/authStore.ts: canPrepare() helper (true gdy user.canPrepare || admin)
  ├── [Frontend] api/users.api.ts: canPrepare w CreateUserPayload i UpdateUserPayload
  ├── [Frontend] api/purchases.api.ts: 'prepared' w OrderStatus i updateStatus()
  ├── [Frontend] pages/admin/Users.tsx:
  │         canPrepare w createSchema i editSchema
  │         Checkbox "Magazynier — kompletowanie zamówień (can_prepare)" w obu formularzach
  └── [Frontend] pages/purchases/PurchasesPage.tsx:
          STATUS_LABEL: prepared → 'Skompletowane'
          STATUS_VARIANT: prepared → 'success'
          isMagazynier = canPrepare(); canSeeAll = isManager || isMagazynier
          OrderDetailModal: osobna sekcja "Akcja magazyniera" (ordered→prepared + anuluj)
          OrderDetailModal: zamawiający traci przycisk ordered→delivered (teraz prepared→delivered)
          Filtry: 'prepared' w dropdownie statusów; widoczne dla canSeeAll
          Nagłówek: "Wszystkie zamówienia" dla canSeeAll (nie tylko isManager)

SESJA 2026-05-05 — Usunięcie ekip (Teams)
  ├── [Decyzja] Ekipy były redundantne — mechanizm podpisów już implikuje współpracę pracowników
  ├── [DB] Migracja: 20260505000000_remove_teams
  │         DROP COLUMN team_id FROM daily_reports
  │         DROP TABLE teams
  ├── [Backend] schema.prisma: usunięto model Team i pole teamId z DailyReport
  ├── [Backend] dailyReport.schemas: usunięto setTeamSchema, SetTeamDto, teamId z listQuerySchema
  ├── [Backend] dailyReport.service: usunięto team z reportSelect, filtr teamId, funkcję setTeam(),
  │         kolumnę "Ekipa" z obu arkuszy XLSX (Raporty i Materiały)
  ├── [Backend] dailyReport.controller: usunięto setTeamHandler, teamId z exportHandler
  ├── [Backend] dailyReport.routes: usunięto PATCH /:id/team
  ├── [Backend] index.ts: usunięto import i rejestrację /api/v1/teams
  ├── [Backend] Usunięto cały katalog src/modules/teams/
  ├── [Frontend] Usunięto plik api/teams.api.ts
  ├── [Frontend] reports.api.ts: usunięto pole team z interfejsu Report, metodę setTeam()
  ├── [Frontend] types/index.ts: usunięto interfejsy Team i TeamWithMembers
  ├── [Frontend] ReportForm.tsx: usunięto komponent TeamSelector, stan selectedTeamId,
  │         query teamsData, wywołanie setTeam w onSubmit, oba bloki UI selektora
  ├── [Frontend] ReportsPage.tsx: usunięto import teamsApi, stan teamId, query teamsData,
  │         filtr "Zespół", badge Ekipy na karcie raportu
  ├── [Frontend] DayOverview.tsx: usunięto wyświetlanie r.team.name
  └── [Frontend] HelpPage.tsx: usunięto 2 wzmianki o ekipach

SESJA 2026-05-05 (2) — Wypożyczalnia: lokalizacja + raport dnia; zaległy raport admina; przycisk "Dodaj wpis"
  ├── [Decyzja] borrowerName (free-text) → location_id (FK do locations); stare dane wyczyszczone
  ├── [DB] Migracja: 20260505000001_equipment_location_report
  │         DELETE FROM equipment_rentals (reset danych)
  │         UPDATE equipment_items SET status='available' (reset statusów)
  │         DROP COLUMN borrower_name, picked_up_at
  │         ADD COLUMN location_id INT NOT NULL REFERENCES locations(id)
  │         ADD COLUMN report_id UUID REFERENCES daily_reports(id) ON DELETE SET NULL
  │         CREATE INDEX equipment_rentals_report_id_idx
  ├── [Backend] schema.prisma: EquipmentRental bez borrowerName/pickedUpAt; zyskuje locationId/location, reportId/report
  │         Location i DailyReport zyskują relację equipmentRentals[]
  ├── [Backend] equipmentRentals.schemas: locationId wymagany w rentItemSchema; nowy assignReportSchema
  ├── [Backend] equipmentRentals.service: usunięto confirmPickup(); dodano assignReport(); rentalInclude rozszerzony o location i report
  ├── [Backend] equipmentRentals.routes: usunięto PATCH /:id/pickup; dodano PATCH /:id/report
  ├── [Backend] equipment.service: activeRentalInclude zawiera location (select id+name)
  ├── [Backend] dailyReport.service: reportSelectFull (getById) zwraca equipmentRentals z item/category/location
  ├── [Backend] dailyReport.controller: createHandler akceptuje opcjonalny userId w body (admin-only → tworzy raport dla wskazanego pracownika)
  ├── [Frontend] equipment.api.ts: typy zaktualizowane; rent() wymaga locationId; usunięto confirmPickup(); dodano assignReport()
  ├── [Frontend] reports.api.ts: nowy interfejs ReportRental; equipmentRentals? w Report; create() przyjmuje opts {date?, userId?}
  ├── [Frontend] EquipmentPage.tsx: RentForm używa selecta lokalizacji (locationsApi); AssignReportForm do powiązania z raportem
  ├── [Frontend] ReportForm.tsx: sekcja "Sprzęt" pod wpisami (gdy report.equipmentRentals.length > 0)
  ├── [Frontend] ReportsPage.tsx (AdminView): przycisk + formularz inline "Utwórz zaległy raport" (worker select + datepicker)
  │         Po sukcesie: navigate do nowego raportu
  ├── [Frontend] ReportForm.tsx: przycisk "Dodaj wpis" w pustym stanie raportu + jako przycisk pod listą wpisów
  │         Otwiera EntryModal z editingEntry=null (tworzenie nowego wpisu)
  │         Warunek modalu zmieniony z `{showModal && editingEntry &&` na `{showModal &&`
  └── [Fix] Sprzęt utknięty w statusie "rented" po migracji — obraz backendu nie zawierał nowego pliku migracji;
          rozwiązanie: docker compose build kahma-backend && docker compose up -d kahma-backend

SESJA 2026-05-05 (3) — Kartoteka kontrahentów + powiązanie z lokalizacjami
  ├── [Decyzja] Lokalizacje = miejsca pracy u klientów; kontrahenci = byty fakturowe (N:1)
  │         Jedna firma może mieć wiele lokalizacji (np. Polmlek Mława + Polmlek Radomsko)
  ├── [DB] Migracja: 20260505000002_add_contractors
  │         CREATE TABLE contractors (id UUID, type, name, nip VARCHAR(10) UNIQUE WHERE NOT NULL,
  │           street, building_number, apartment_number, postal_code, city, country='PL',
  │           email, phone, is_vat_payer, is_active, created_at, updated_at)
  │         ALTER TABLE locations ADD COLUMN contractor_id UUID REFERENCES contractors(id) ON DELETE SET NULL
  ├── [Backend] schema.prisma: nowy model Contractor + Location.contractorId (nullable FK)
  ├── [Backend] nowy moduł src/modules/contractors/ (schemas, service, controller, routes)
  │         NIP nullable (klienci zagraniczni, osoby fiz.); walidacja modulo-11 gdy podany
  │         Unikalne NIP — partial unique index (WHERE nip IS NOT NULL)
  │         Endpoints: GET / (filtry: q, type, isActive), GET /:id, POST /, PATCH /:id
  │         Dostęp: tylko admin
  │         GET /:id zwraca locations[] przypisane do kontrahenta
  ├── [Backend] locations.service: locationSelect rozszerzony o contractor { id, name, nip, city, type }
  ├── [Backend] locations.schemas: contractorId (UUID nullable) dodane do updateLocationSchema
  ├── [Backend] locations.service: update() waliduje istnienie contractora przed zapisem
  ├── [Backend] index.ts: zarejestrowano /api/v1/contractors
  ├── [Frontend] api/contractors.api.ts: typy Contractor, ContractorDetail + contractorsApi (CRUD)
  ├── [Frontend] api/locations.api.ts: typ Location rozszerzony o contractor (LocationContractor | null)
  │             locationsApi.update() przyjmuje contractorId?: string | null
  ├── [Frontend] pages/admin/Contractors.tsx: nowa strona admina
  │         Lista kontrahentów z wyszukiwarką (nazwa / NIP / miasto)
  │         Karta: nazwa, typ (Klient/Dostawca/Oboje), NIP, adres, kontakt, badge VAT
  │         Modal dodaj/edytuj: walidacja NIP on-submit (Zod refine, modulo-11)
  │         Toggle aktywny/nieaktywny
  ├── [Frontend] pages/admin/Locations.tsx: rozszerzono LocationCard
  │         Wyświetla przypisanego kontrahenta (nazwa + NIP + miasto) pod nazwą lokalizacji
  │         Przycisk Link/Unlink → inline panel AssignContractorPanel
  │         AssignContractorPanel: select z aktywnymi kontrahentami + opcja "brak (odpisz)"
  ├── [Frontend] router/index.tsx: trasa /admin/kontrahenci (RequireAdmin)
  └── [Frontend] layouts/AppLayout.tsx: NavItem "Kontrahenci" (ikona Building2, adminOnly)

SESJA 2026-05-04 — Edycja materiałów w wpisie raportu
  └── [Frontend] pages/reports/ReportForm.tsx — EntryModal:
          Nowy stan: editingUsageId, editQty, editUnit, editNotes, editSaving
          startEdit(m): wypełnia pola i przełącza wiersz w tryb edycji
          saveEdit(): wywołuje materialUsagesApi.update() (PATCH /material-usages/:id), aktualizuje localMaterials
          cancelEdit(): powrót do widoku bez zmian
          UI: każdy wiersz materiału ma teraz przycisk ołówka (edycja) obok kosza
          Formularz inline: ilość (number input) + jednostka (select z UNITS) + uwagi (text input)
          Uprawnienia: przycisk edycji widoczny tylko dla isAdmin() || m.user.id === user.id
          Backend: PATCH /material-usages/:id już istniał (updateUsageSchema: quantity, unit, notes)
          Brak zmian na backendzie — zmiana materialId nie jest wspierana (usuń i dodaj nowy)

SESJA 2026-05-07 — Usuwanie pustych raportów + is_offer trzecia opcja + admin cofa podpis
  ├── [Backend] DELETE /api/v1/daily-reports/:id (admin only)
  │         Blokada: 409 jeśli raport ma wpisy lub jest zatwierdzony
  │         Przed usunięciem: null-uje reportId w materialUsages, equipmentRentals, purchaseOrders
  │         Kaskadowo usuwa: report_signatures (CASCADE)
  ├── [Frontend] ReportsPage.tsx (AdminView): przycisk "Usuń" na kartach pustych raportów (entries.length === 0)
  │         Modal potwierdzenia; po sukcesie: invalidacja listy raportów
  ├── [Frontend] ReportForm.tsx: przycisk "Usuń pusty raport" w widoku pustego raportu (admin)
  │         Modal potwierdzenia; po sukcesie: navigate('/raporty')
  ├── [DB] Migracja: 20260507000000_is_offer_to_varchar
  │         ALTER TABLE daily_reports ALTER COLUMN is_offer TYPE VARCHAR(20)
  │         Konwersja: true→'offer', false→'no_offer', NULL→NULL
  │         Nowy stan: 'to_quote' = "Do zaofertowania"
  ├── [Backend] approveReportSchema: z.enum(['offer','no_offer','to_quote']).nullable()
  ├── [Backend] approveReport(): sygnatura boolean|null → 'offer'|'no_offer'|'to_quote'|null
  ├── [Frontend] reports.api.ts: isOffer: boolean|null → 'offer'|'no_offer'|'to_quote'|null
  ├── [Frontend] ReportForm.tsx: trzy przyciski zatwierdzenia (Bez oferty / Do zaofertowania / Ofertowy)
  │         Badge z kolorami: zielony/pomarańczowy/fioletowy
  ├── [Frontend] ReportsPage.tsx: badge "Do zaofertowania" (pomarańczowy #ea580c)
  ├── [Backend] signOff(): przyjmuje callerRole + opcjonalny targetSignerId
  │         Admin może cofnąć dowolny podpis podając { signerId } w body DELETE
  │         Pracownik nadal cofa tylko własny, tylko gdy raport niezablokowany
  └── [Frontend] ReportForm.tsx: w sekcji "Podpisy" przycisk "Cofnij" przy każdym sygnatariuszu (admin)
          removeSignatureMut: signOff(reportId, signer.id); nie sprawdza blokady
```

---

## 13. Decyzje projektowe (finalne)

| Kwestia | Decyzja |
|---|---|
| Eksport | XLSX (SheetJS) |
| Historia raportów pracownika | Pełna historia, tylko do odczytu poza bieżącym dniem |
| Blokada raportu | Dynamiczna (bez cron/trigger): `reportDate < dziś` |
| Data raportu | Zawsze dzień bieżący (bez inputu), zafixowana przy tworzeniu |
| Licznik pojazdu | `lastKm = max(km_base, ostatnie kmEnd)` — admin może korygować przez `km_base` |
| Login pracownika | Dowolna nazwa (min. 4 znaki) + hasło (min. 4 znaki) |
| Domena | kahma.leanmatik.net → Cloudflare Tunnel → VPS :8090 |
| Hasło w `.env` | Bez znaków specjalnych (znak `#` łamie parsowanie URL w PostgreSQL) |
| Język UI | Polski |
| Kolory | "Sapphire Navy" — `#0c1e3c` sidebar, `#2761eb` primary, `#edf2fb` tło |
| Mobile | font-size 16px na inputach (brak autozoomu iOS), hamburger po lewej |

---

## 14. Znane bugi naprawione

| Bug | Przyczyna | Rozwiązanie |
|---|---|---|
| `npm ci` fails — brak package-lock.json | Nowy projekt bez lockfile | `npm install --package-lock-only` |
| Backend crash: libssl missing (Alpine) | Prisma na Alpine wymaga OpenSSL | `binaryTargets` + `apk add openssl` |
| DB URL parse error — `#` w haśle | `#` interpretowany jako fragment URL | Hasło bez znaków specjalnych |
| Modal zamyka się przy kliknięciu w środku | Dwa `Dialog.Content` jednocześnie — Radix traktuje kliknięcie w jeden jako "poza" drugim | Jeden `Dialog.Content` z responsywnym CSS |
| Rate-limiter error za Nginx | Brak `trust proxy` w Express | `app.set('trust proxy', 1)` |
| Pracownik widzi filtry / formularz admina | Brak rozdziału widoków | `AdminView` i `EmployeeView` jako osobne komponenty |
| Import materiałów: `Cannot find module '@prisma/client'` | Host nie ma node_modules backendu | Uruchom import wewnątrz kontenera przez `docker exec` |
| `docker cp` fails — katalog nie istnieje | `/app/data` nie istnieje w Alpine image | `docker exec kahma-backend mkdir -p /app/data` przed copy |
| Pole jednostki pokazuje tylko "szt" | `<input list="datalist">` nie działa jako lista rozwijana | Zmieniono na `<select>` z opcjami |
| Przycisk "Pobierz" niewidoczny w formularzu materiałów | `style={{ flex:1 }}` przekazany do Button nadpisywał `style` z gradientem | `Button.tsx`: dodano `...props.style` na końcu obiektu style |
| Pracownik mógł zgłosić problem z cudzym sprzętem | Brak warunku na `isMyRental` | Przycisk "Problem" pojawia się tylko gdy `isMyRental === true` |
| Frontend pozwalał tworzyć drugi raport na ten sam dzień | Brak sprawdzenia czy raport na dziś już istnieje | `EmployeeView`: wykrywa `todayReport` i zamienia przycisk na "Edytuj dzisiejszy" |
| Sygnatariusz dostawał 403 przy otwieraniu raportu | `getById` sprawdzał tylko `userId`, nie sygnatury | Dodano sprawdzenie `signatures.some(signerId)` w getById/addEntry/updateEntry/deleteEntry |
| 500 przy edycji wpisu z pojazdem po refaktorze | `include: { vehicleUsage: true }` — pole usunięte ze schematu | Zmieniono na `include: { report: true }` (vehicleUsage niepotrzebny po deleteMany+createMany) |
| available-to-sign nie odświeżało się po podpisaniu | `onSuccess` invalidował tylko `['reports']`, nie `['available-to-sign']` | Dodano `qc.invalidateQueries({ queryKey: ['available-to-sign'] })` |

---

## 15. Aktualny stan implementacji

> Ostatnia aktualizacja: 2026-05-07

| Faza | Status |
|---|---|
| CORE (auth, users, dashboard, layout) | ✅ Ukończona i wdrożona |
| Dashboard — statystyki użytkownika | ✅ Wdrożone (2026-04-02) |
| Dashboard — przypomnienie o raporcie (≥12:00) | ✅ Wdrożone (2026-04-02) |
| Moduł 1: Raport Dnia | ✅ Ukończony i wdrożony |
| Moduł 1 — Sygnatury + dostęp sygnatariusza | ✅ Ukończone i wdrożone (2026-04-01) |
| Moduł 1 — Wiele pojazdów per wpis | ✅ Wdrożone (2026-04-01 sesja 2) |
| Moduł 1 — Odblokowanie raportu przez admina | ✅ Wdrożone (2026-04-01 sesja 2) |
| Moduł 1 — Materiały per wpis (entryId) | ✅ Wdrożone (2026-04-07) |
| Moduł 1 — Edycja materiałów w wpisie (inline) | ✅ Wdrożone (2026-05-04) |
| Moduł 1 — Usunięcie ekip (Teams) | ✅ Wdrożone (2026-05-05) |
| Moduł 1 — Usuwanie pustych raportów (admin) | ✅ Wdrożone (2026-05-07) |
| Moduł 1 — is_offer: trzeci stan "Do zaofertowania" | ✅ Wdrożone (2026-05-07) |
| Moduł 1 — Admin cofa dowolny podpis | ✅ Wdrożone (2026-05-07) |
| Moduł 2: Wypożyczalnia Sprzętu | ✅ Ukończony i wdrożony |
| Moduł 2 — Dane: 21 pojazdów floty + 8 podnośników | ✅ Zresetowane i uzupełnione (2026-04-07) |
| Moduł 2 — Lokalizacja + powiązanie z raportem dnia | ✅ Wdrożone (2026-05-05) |
| Moduł 3: Materiały | ✅ Ukończony i wdrożony (4535 pozycji — nowa baza 2026-04-02; filtrowanie po lok./wydz. 2026-04-03) |
| Moduł 3 — MaterialsPage: entryId selection | ✅ Wdrożone (2026-04-07) |
| Moduł 4: HR | ✅ Ukończony i wdrożony (2026-04-03) |
| Moduł 5: Zamówienia | ✅ Ukończony i wdrożony (2026-04-22) |
| Moduł 5 — Magazynier (can_prepare, status prepared) | ✅ Wdrożone (2026-04-24) |
| Kartoteka kontrahentów + powiązanie z lokalizacjami | ✅ Zaimplementowane (2026-05-05) |
| Powiadomienia Telegram | ⏸ Odłożony |

**Domyślne konto admina po `seed`:** login `admin` / hasło `admin1234`

### Kluczowe decyzje implementacyjne (do zapamiętania na następną sesję)

- Sygnatariusz ma pełny dostęp do edycji podpisanego raportu (add/update/delete entries) — nie tylko read-only
- `isSigned` w odpowiedzi API jest relatywny do requestera (nie globalna flaga raportu)
- `GET /available-to-sign` zwraca tylko raporty z **dzisiaj** — nie ma możliwości podpisania historycznych
- XLSX: sygnatariusz dostaje osobny wiersz dla każdego wpisu autora (kolumna "Podpisany: Tak")
- Cofnięcie podpisu możliwe tylko gdy raport nie jest zablokowany (dziś)
- `vehicle_usage` — brak UNIQUE na entry_id → jeden wpis może mieć N pojazdów; API przyjmuje `vehicleUsages[]`
- `unlocked_until` — logika: `isLocked = reportDate < dziś AND (unlocked_until IS NULL OR unlocked_until < teraz)`
- Lokalizacja w formularzu: gdy raport ma wpisy → dropdown filtrowany do jednej opcji (tej samej co istniejące wpisy)
- Draft formularza wpisu: `sessionStorage` klucz `kahma_entry_draft` — kasowany po zapisaniu, przeżywa F5
- `GET /api/v1/users/me/stats` — endpoint bez authorize('admin'), dostępny dla wszystkich zalogowanych
- Baza materiałów: 4535 pozycji z pliku "nowe towary.xlsx" (11 arkuszy; kolumny: Symbol→catalogNumber, Nazwa→name)
- Skrypt resetu+importu materiałów: `backend/prisma/clearAndImport.ts` — uruchamiać przez `docker exec kahma-backend`
- HR — godziny w `getMyStats` i `getAttendance` kredytowane są **autorowi i każdemu sygnatariuszowi** raportu (nie tylko autorowi)
- HR — `getOrCreateBalance` używa `upsert` (nie check+create) aby uniknąć race condition przy równoległych zapytaniach
- MaterialUsage: `entryId` to główny klucz powiązania — backend `create()` auto-wypełnia `locationId/departmentId/reportId` z `entry` gdy podano `entryId`
- MaterialUsage z `ReportForm.tsx` (`AddMaterialPanel`): przekazuje `entryId` wpisu — każdy wpis ma własną listę materiałów
- MaterialUsage z `MaterialsPage.tsx` (`UsageForm`): użytkownik wybiera raport → pojawia się dropdown wpisów → przekazywane `entryId`; materiał bez entryId nie pojawia się w widoku raportu
- `exportFiltered` — endpoint admin-only, zwraca XLSX bez paginacji (cały wynik); frontend wywołuje go przez `responseType: 'blob'` + `URL.createObjectURL`
- HR — L4 nie odlicza dni z puli urlopowej (26 dni/rok); inne typy odliczają
- Logo: `frontend/public/logo.png` (logowanie, 360px) i `frontend/public/logo-male.png` (sidebar/header, 120/100px)
- `can_order` — flaga na User (nie rola); zawarta w JWT tokenie; `authStore.canOrder()` = `user.canOrder || isAdmin()`
- `can_prepare` — flaga na User (nie rola); zawarta w JWT tokenie; `authStore.canPrepare()` = `user.canPrepare || isAdmin()`; `canSeeAll = isManager || isMagazynier` decyduje o widoczności filtrów i etykiety "Wszystkie zamówienia"
- Zamówienia: pozycja ma albo `material_id` albo `custom_name` — CHECK CONSTRAINT w DB + walidacja Zod
- Promote item: `POST /purchase-orders/:orderId/items/:itemId/promote` — atomowe: tworzy Material + zeruje customName + ustawia materialId
- Status transitions: `pending→ordered` (can_order/admin), `ordered→prepared` (can_prepare/admin), `prepared→delivered` (can_order/admin), dowolny→`cancelled` (can_order/can_prepare/admin); twórca może anulować tylko `pending`
- `canTransition(r, from, to)` w `purchaseOrders.service.ts` — granularna kontrola per przejście, niezależna od `ALLOWED_TRANSITIONS` (która sprawdza tylko sekwencję)
- Magazynier w UI: osobna sekcja "Akcja magazyniera" pojawia się gdy `!isManager && isMagazynier && status === 'ordered'`
- Wdrożenie modułu zamówień: migracja aplikuje się automatycznie przy starcie kontenera (entrypoint backendu uruchamia `prisma migrate deploy`)
- `errorHandler.ts` obsługuje Prisma P2003 (FK violation→400), P2025 (not found→404), P2002 (duplicate→409)
- `navItems` w `AppLayout.tsx` — jedyne miejsce dodawania zakładek do sidebara i hamburgera
- Edycja materiału w wpisie: tylko `quantity`, `unit`, `notes` — zmiana materiału (materialId) wymaga usunięcia i dodania nowego; uprawnienie = właściciel lub admin
- Ekipy (Teams) usunięte (2026-05-05) — współpraca pracowników modelowana wyłącznie przez sygnatury (`report_signatures`); brak tabeli `teams` i kolumny `team_id` w `daily_reports`
- Wypożyczenie sprzętu: `location_id` wymagany (FK do `locations`), `report_id` opcjonalny (FK do `daily_reports`); `borrower_name` usunięty
- `equipmentRentals` w `getById` raportu: zwracane tylko przez `reportSelectFull` (nie przez `reportSelect` używany przez listę)
- Admin może tworzyć raport dla dowolnego pracownika: `POST /daily-reports` z body `{ date, userId }` — `userId` ignorowany dla zwykłego pracownika
- "Dodaj wpis" w `ReportForm.tsx`: widoczny gdy `!locked` — w empty state (karta "Brak wpisu") i pod listą wpisów; modal otwiera się z `editingEntry=null` → `handleSave` wywołuje `reportsApi.addEntry`
- Zmiana modalu wpisu: warunek `showModal && editingEntry` → `showModal` (null editingEntry = nowy wpis)
