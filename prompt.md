# Prompt wznawiający pracę nad projektem Kahma

---

Zapoznaj się z `masterplan.md` — to autorytatywne źródło wiedzy o projekcie. Zgłoś gotowość do działania.

## Kontekst projektu

System **Kahma** — zarządzanie pracownikami i zasobami firmy.
Stos: PERN (PostgreSQL 16 + Express/Prisma 5 + React 18/Vite) w Dockerze.
Domena: `kahma.leanmatik.net` → Cloudflare Tunnel → VPS :8090.
Język UI: **polski**. Podejście: mobile-first.

## Stan na 2026-04-08 (ostatnia sesja)

### Zmiany architektury modułu Raport Dnia

Zmieniono model raportowania z „1 raport/dzień, N wpisów" na **„N raportów/dzień, każdy z 1 wpisem"**:

- **Backend `dailyReport.service.ts`:**
  - `addEntry()` — sprawdza `count(entries) >= 1` → 400 ("Raport może mieć tylko jeden wpis")
  - `setTeam()` — usunięto blokadę dla pracownika; każdy może zmieniać ekipę dopóki raport nie jest locked z poprzedniego dnia

- **Frontend `ReportForm.tsx` — kluczowe komponenty:**
  - **`NewReportPage`** (nowy, ~420 linii) — pełnoekranowy formularz tworzenia raportu:
    - Faza 1: selektor ekipy (kafelki) + godziny + lokalizacja + wydział + opis + pojazdy → "Zapisz wpis"
    - Faza 2: `AddMaterialPanel` + lista dodanych materiałów → "Gotowe" (navigate do raportu)
    - Draft: `sessionStorage['kahma_entry_draft']` — kasowany po submit i po kliknięciu strzałki "wstecz"
  - **`TeamSelector`** — bez blokady dla pracownika; kliknięcie wybranej ekipy odznacza (setTeam null)
  - **`EntryModal`** — tylko edycja istniejącego wpisu (nie tworzenie); brak `lockedLocationId`
  - **`ReportForm` (default export)** — `if (isNew) return <NewReportPage />`; usunięto "Dodaj kolejny wpis"

### Poprawka z 2026-04-08

- Przycisk "wstecz" (←) w `NewReportPage` faza 1 teraz wywołuje `clearDraft()` przed `navigate('/raporty')`
  - Zapobiega przywróceniu starego wydziału przy kolejnym tworzeniu raportu

### Nierozwiązany bug (zgłoszony, ale nie w pełni zdiagnozowany)

**Opis:** Po stworzeniu raportu z lokalizacją X i wydziałem Y, wydział Y ma nie być dostępny przy tworzeniu kolejnego raportu.

**Diagnoza:**
- Backend potwierdza zwracanie wszystkich wydziałów (5 aktywnych dla lokalizacji 1)
- Frontend filtruje tylko po `isActive` — brak filtrowania po użyciu
- Żadnych unique constraints na `report_entries(department_id)`
- Możliwa przyczyna: draft przywracał stary `departmentId` → użytkownik myślał że wydział jest zajęty
- Poprawka wstecznego przycisku może rozwiązać problem — do weryfikacji przez użytkownika

## Infrastruktura

```
Porty Kahma: nginx 8090 | frontend 3300 | backend 3301 | postgres 5433
Sieć Docker: kahma_net
Kontenery: kahma-nginx, kahma-frontend, kahma-backend, kahma-db
Admin: login=admin / hasło=admin1234
```

## Kluczowe pliki

| Plik | Opis |
|---|---|
| `masterplan.md` | Pełna dokumentacja projektu — czytaj przed każdą sesją |
| `docker-compose.yml` | Definicja stacku |
| `backend/prisma/schema.prisma` | Model danych (autorytatywne źródło) |
| `frontend/src/lib/theme.ts` | Paleta kolorów (light/dark) — **zawsze** używaj tokenów `t.*` |
| `frontend/src/pages/reports/ReportForm.tsx` | Cały moduł raportów: `NewReportPage` + `EntryModal` + `TeamSelector` + `EntryCard` + `AddMaterialPanel` + `ReportForm` (default) |
| `frontend/src/pages/reports/ReportsPage.tsx` | Lista raportów: `AdminView` (filtry) / `EmployeeView` (dziś + historia) |
| `backend/src/modules/dailyReport/dailyReport.service.ts` | Logika raportów: `create`, `addEntry` (max 1 wpis), `setTeam` (bez blokady), `getById`, `list`, `exportXlsx` |
| `backend/prisma/clearAndImport.ts` | Reset bazy + import 4535 materiałów z nowe_towary.xlsx |

## Zasady pracy

1. Przed każdą zmianą kodu — przeczytaj plik który edytujesz
2. Rebuild frontendu: `docker compose build kahma-frontend && docker compose up -d kahma-frontend`
3. Rebuild backendu: `docker compose build kahma-backend && docker compose up -d kahma-backend`
4. **Dark mode** — zawsze używaj tokenów z `useTheme()` (`t.surface`, `t.ink`, `t.inkMuted`, `t.blue.bg` itp.), **nigdy** Tailwind `dark:` klas ani hardkodowanych `#fff`/`#000`
5. Nie ruszaj portów/kontenerów `cmms` i `ur` — to inne stacki na tej samej maszynie
6. Styl odpowiedzi API: `{ success: true, data: ... }` / `{ success: false, error: "..." }`
7. Interaktywne stany hover: używaj React `useState` + `onMouseEnter/Leave` + token `t.blue.bg` — NIE Tailwind `hover:bg-*`

---

## Architektura modułu Raport Dnia — stan aktualny (2026-04-08)

### Relacje

```
daily_reports (user_id, report_date, team_id, unlocked_until)
  └── report_entries (1 per raport: work_start, work_end, location_id, department_id, description)
        ├── vehicle_usage[] (pojazd + km_driven — wiele per wpis)
        └── material_usages[] (materiał + ilość — wiele per wpis)
```

### Kluczowe reguły

- **1 wpis per raport** — backend odrzuca drugi wpis (400)
- **Wiele raportów dziennie** — brak UNIQUE na `(user_id, report_date)`
- **Ekipa:** jedna per raport (`daily_reports.team_id`); każdy może zmieniać w dowolnym momencie
  - Endpoint: `PATCH /api/v1/daily-reports/:id/team` z `{ teamId: number | null }`
- **Blokada:** `isLocked = reportDate < dziś AND (unlocked_until IS NULL OR unlocked_until < now())`
- **Odblokowanie:** admin → `PATCH /api/v1/daily-reports/:id/unlock` → `unlocked_until = now() + 24h`
- **Sygnatariusze:** `report_signatures` — sygnatariusz = pełny dostęp do edycji raportu
- **Draft:** `sessionStorage['kahma_entry_draft']` — kasowany po submit i po kliknięciu ← wstecz

### Przepływ tworzenia raportu (frontend)

1. `/raporty/nowy` → `NewReportPage` montuje się
2. Faza 1: użytkownik wypełnia formularz → "Zapisz wpis"
   - `reportsApi.create()` → `reportsApi.addEntry(reportId, ...)` → opcjonalnie `reportsApi.setTeam(reportId, teamId)`
   - `clearDraft()` → `setSavedReportId/EntryId` → komponent przechodzi do fazy 2
3. Faza 2: `AddMaterialPanel` (opcjonalnie) → "Gotowe" → `navigate('/raporty/${reportId}')`

---

## Architektura modułu Materiały — stan aktualny

### Tabela `material_usages` — kluczowe pola

```sql
material_usages (
  entry_id      UUID REFERENCES report_entries(id) ON DELETE SET NULL,  -- GŁÓWNY kontekst
  report_id     UUID REFERENCES daily_reports(id),   -- denormalizacja (auto z entry)
  location_id   INT REFERENCES locations(id),         -- auto z entry.location_id
  department_id INT REFERENCES departments(id),       -- auto z entry.department_id
  ...
)
```

**Zasada:** materiał **zawsze** tworzony z `entryId`. Backend auto-wypełnia `reportId/locationId/departmentId` z wpisu.

### Ścieżki dodawania materiałów

- **Z formularza raportu:** `NewReportPage` faza 2 → `AddMaterialPanel` z `entryId` z nowego wpisu
- **Z edycji wpisu:** `EntryModal` → sekcja "Materiały zużyte" inline z `AddMaterialPanel`
- **Ze strony materiałów:** `MaterialsPage` → `UsageForm` → wybierz raport → wybierz wpis → `entryId`

---

## Architektura modułu Wypożyczalnia — stan aktualny

| Tabela | Zawartość | Moduł |
|---|---|---|
| `vehicles` | 21 pojazdów z tablicami WGS* (flota) | Raport Dnia — pojazdy używane w wpisach |
| `equipment_items` | 8 podnośników (kat. "Podnośniki") | Wypożyczalnia Sprzętu |

---

## Backend — kluczowe serwisy

| Plik | Co robi |
|---|---|
| `dailyReport.service.ts` | `entrySelect` (lean) vs `entrySelectFull` (z materialUsages); `addEntry` max 1; `setTeam` bez blokady |
| `materialUsages.service.ts` | `create()` — admin pomija sprawdzanie własności; entryId → auto-fill |
| `departments.service.ts` | `list(query)` — zwraca WSZYSTKIE wydziały dla locationId, bez filtrowania po użyciu |
| `users.service.ts` | `getMyStats()` — statystyki dla zalogowanego (raporty własne + podpisane) |

---

## Frontend — kluczowe komponenty `ReportForm.tsx`

| Komponent | Opis |
|---|---|
| `NewReportPage` | Pełnoekranowy formularz nowego raportu (2 fazy: wpis → materiały) |
| `EntryModal` | Modal edycji istniejącego wpisu (dwufazowy: formularz + materiały inline) |
| `TeamSelector` | Kafelki ekip — bez blokady dla pracownika; klik na wybraną = odznacz |
| `EntryCard` | Karta wpisu na stronie raportu: godziny, lokalizacja, opis, materiały, edycja/usuń |
| `AddMaterialPanel` | Panel wyszukiwania i dodawania materiałów do wpisu (`entryId` jako prop) |
| `ReportForm` (default) | Strona szczegółów raportu: `if (isNew) return <NewReportPage />` |

---

## Potencjalne kolejne kroki

- Weryfikacja czy poprawka draftu rozwiązała bug z "wydziałem niedostępnym"
- Zarządzanie zespołami przez admina (strona `/admin/zespoly`)
- Powiadomienia Telegram (Moduł 5 — odłożony)
- Ewentualna rola "kierownik"
