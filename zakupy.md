# Moduł Zamówień (Zakupy) — Specyfikacja

> **Status:** Zaplanowany, gotowy do implementacji
> **Data planowania:** 2026-04-22

---

## 1. Cel modułu

Pracownik może zgłosić zapotrzebowanie na materiały, których brakuje na budowie. Zgłoszenie trafia do osoby zamawiającej (`can_order`), która realizuje zakup i zmienia status zamówienia. Po dostawie zamówienie może zostać powiązane z raportem dnia.

---

## 2. Role i uprawnienia

Nowa flaga na użytkowniku: `can_order: boolean` — analogicznie do istniejącej flagi `can_rent_equipment`.

| Użytkownik | Widzi | Może |
|---|---|---|
| `pracownik` (bez flagi) | tylko własne zamówienia | tworzyć, edytować szkic, anulować |
| `pracownik` z `can_order` | **wszystkie zamówienia** | jak wyżej + zmieniać statusy, dodawać nowe materiały do katalogu |
| `admin` | wszystkie zamówienia | pełen dostęp |

---

## 3. Model danych

### Tabela `purchase_orders`

```sql
purchase_orders (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id),
  location_id   INT REFERENCES locations(id),       -- opcjonalna
  department_id INT REFERENCES departments(id),     -- opcjonalna
  status        VARCHAR NOT NULL DEFAULT 'pending', -- pending | ordered | delivered | cancelled
  needed_by     DATE,                               -- termin potrzeby (opcjonalny)
  notes         TEXT,                               -- uwagi do całego zamówienia
  report_id     UUID REFERENCES daily_reports(id),  -- przypisanie do raportu po realizacji
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
)
```

### Tabela `purchase_order_items`

```sql
purchase_order_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID REFERENCES purchase_orders(id) ON DELETE CASCADE,
  material_id INT REFERENCES materials(id),    -- NULL gdy pozycja z palca
  custom_name VARCHAR(300),                    -- wypełnione gdy spoza katalogu
  quantity    DECIMAL(10,2) NOT NULL,
  unit        VARCHAR(20) NOT NULL DEFAULT 'szt',
  notes       TEXT                             -- uwagi do konkretnej pozycji
)
```

**Zasada:** każda pozycja ma albo `material_id` (materiał z katalogu) albo `custom_name` (wpis ręczny). Nigdy oba naraz.

---

## 4. Statusy zamówienia

```
pending  →  ordered  →  delivered
                  ↘               ↘
               cancelled       cancelled
```

| Status | Opis | Kto zmienia |
|---|---|---|
| `pending` | Nowe, czeka na realizację | tworzony automatycznie przy wysłaniu |
| `ordered` | Zamawiający złożył zamówienie u dostawcy | `can_order` lub `admin` |
| `delivered` | Dostawa dotarła | `can_order` lub `admin` |
| `cancelled` | Anulowane | twórca (gdy pending) lub `can_order`/`admin` |

---

## 5. Koszyk (formularz zamówienia)

Jedno zamówienie = wiele pozycji. Pracownik buduje listę pozycji, uzupełnia kontekst i wysyła jako całość.

**Pola nagłówka zamówienia:**
- Lokalizacja (select z listy, jak w raportach)
- Wydział (select zależny od lokalizacji, opcjonalny)
- Termin potrzeby (date picker, opcjonalny)
- Uwagi ogólne (pole tekstowe, opcjonalne)

**Pozycja koszyka:**
- Materiał: wyszukiwarka z katalogu (min. 3 znaki) LUB wpisz ręcznie
- Ilość + jednostka
- Uwagi do pozycji (opcjonalne)

**Dodawanie materiału do katalogu przez zamawiającego:**
Gdy pozycja jest wpisana ręcznie (`custom_name`), użytkownik z `can_order` widzi przy niej przycisk „Dodaj do katalogu". Po kliknięciu materiał trafia do tabeli `materials`, a pozycja zamówienia dostaje `material_id`.

---

## 6. Powiązanie z raportem (po realizacji)

Gdy zamówienie ma status `delivered`, twórca lub `can_order`/`admin` może przypisać je do konkretnego raportu dnia (`report_id`). Tworzy to ślad audytowy: „te materiały zostały zamówione i wykorzystane przy raporcie X".

Realizacja w UI: dropdown z raportami pracownika, aktywny tylko gdy `status = delivered`.

---

## 7. Widoki

### Pracownik (bez `can_order`)
- Lista własnych zamówień z badge statusu i terminem
- Przycisk „Nowe zamówienie" → formularz koszyka
- Widok szczegółowy zamówienia (tylko do odczytu po wysłaniu)
- Anulowanie zamówienia (tylko gdy `pending`)
- Po dostawie: przypisz do raportu

### Zamawiający (`can_order`) i Admin
- Lista wszystkich zamówień z filtrami (status, lokalizacja, pracownik, termin)
- Zmiana statusu: `pending → ordered → delivered`
- Możliwość anulowania dowolnego zamówienia
- Dodawanie pozycji ręcznych do katalogu materiałów

---

## 8. API — planowane endpointy

### `/api/v1/purchase-orders`

| Metoda | Endpoint | Opis | Dostęp |
|---|---|---|---|
| GET | `/` | Lista zamówień (filtry: status, locationId, userId, from/to) | pracownik: własne; can_order+admin: wszystkie |
| POST | `/` | Utwórz zamówienie z pozycjami | wszyscy |
| GET | `/:id` | Szczegóły zamówienia z pozycjami | twórca lub can_order/admin |
| PATCH | `/:id/status` | Zmień status | can_order lub admin |
| PATCH | `/:id/report` | Przypisz do raportu | twórca lub can_order/admin (tylko gdy delivered) |
| DELETE | `/:id` | Anuluj (usuń gdy pending) | twórca (pending) lub can_order/admin |

### `/api/v1/purchase-order-items`

| Metoda | Endpoint | Opis | Dostęp |
|---|---|---|---|
| POST | `/:orderId/items` | Dodaj pozycję do zamówienia (gdy pending) | twórca lub can_order/admin |
| PATCH | `/:orderId/items/:itemId` | Edytuj pozycję | twórca lub can_order/admin |
| DELETE | `/:orderId/items/:itemId` | Usuń pozycję | twórca lub can_order/admin |

---

## 9. Czego świadomie NIE ma w module

- Brak powiadomień (Telegram zaplanowany jako osobny moduł)
- Brak zatwierdzania przez admina przed wysłaniem — pracownik wysyła bezpośrednio
- Brak śledzenia dostawcy, faktury, ceny
- Brak powiązania pozycji zamówienia z `material_usages` — zamówienie to zapotrzebowanie, nie pobranie
- Brak priorytetu — zastąpiony terminem (`needed_by`)

---

## 10. Przykładowy strumień wartości

```
PRACOWNIK — Marek (elektryk, budowa Warszawa-Wola)

  Wtorek rano. Skończyły się kable YKY i brakuje kleju,
  którego nie ma jeszcze w katalogu materiałów.

  1. Marek otwiera zakładkę „Zamówienia"
  2. Klika „Nowe zamówienie"
  3. Wypełnia koszyk:
       a) wyszukuje „kabel YKY 3x2,5"
          → wybiera z katalogu, wpisuje: 50 mb
       b) wpisuje z palca: „Klej Soudal Fix All Flexi"
          → wpisuje: 10 szt, uwaga: „szary, nie biały"
  4. Ustawia kontekst:
       Lokalizacja:  Warszawa-Wola
       Wydział:      Elektryczny
       Termin:       25.04.2026 (piątek)
       Uwagi:        „Klej potrzebny najpóźniej w piątek rano"
  5. Klika „Wyślij zamówienie"
     → status: PENDING
     → zamówienie widoczne na liście Marka

        ▼

ZAMAWIAJĄCY — Kasia

  6. W zakładce „Zamówienia" pojawia się nowe zgłoszenie
     od Marka z oznaczeniem terminu: 25.04
  7. Otwiera zamówienie, przegląda pozycje
  8. Przy pozycji „Klej Soudal Fix All Flexi" klika
     „Dodaj do katalogu" — materiał trafia do bazy
  9. Dzwoni do hurtowni, składa zamówienie telefonicznie
 10. Zmienia status → ORDERED
     → Marek widzi na swojej liście: „W realizacji"

        ▼

  Piątek rano — dostawa dotarła na magazyn

 11. Kasia zmienia status → DELIVERED
     → Marek widzi: „Dostarczone"

        ▼

PRACOWNIK — Marek

 12. Otwiera zamówienie
 13. Klika „Przypisz do raportu"
     → wybiera raport z piątku (Warszawa-Wola)
     → zamówienie powiązane z raportem — ślad audytowy
```

---

## 11. Zależności z innymi modułami

| Moduł | Powiązanie |
|---|---|
| Użytkownicy | nowa flaga `can_order` na tabeli `users` |
| Lokalizacje / Wydziały | reużycie istniejących tabel |
| Materiały | referencja `material_id`; zamawiający może dodawać nowe |
| Raporty | opcjonalne powiązanie `report_id` po dostawie |
