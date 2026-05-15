# KAHMA — Sesja 2026-04-15 (progress01)

## Zakres sesji

Sesja startowa — przygotowanie środowiska do nowej rundy testów/pracy.

## Wykonane działania

### Reset danych produkcyjnych

Wyczyszczono dane pracowników (dane bieżące, nie struktura):

| Tabela | Usuniętych wierszy |
|---|---|
| `material_usages` | 36 |
| `material_alerts` | 1 |
| `vehicle_usage` | 11 |
| `report_signatures` | 6 |
| `report_entries` | 16 |
| `daily_reports` | 16 |
| `leave_requests` | 6 |
| `leave_balances` | 9 |
| `equipment_rentals` | 1 |
| `equipment_items` status → available | 1 (aktualizacja) |

Zachowano bez zmian:
- Użytkownicy, role
- Flota pojazdów (`vehicles`)
- Sprzęt wypożyczalni (`equipment_items`, `equipment_categories`)
- Baza materiałów (`materials`)
- Lokalizacje, wydziały, zespoły
- Migracje Prisma

## Stan bazy po sesji

Czysta baza — gotowa do nowych wpisów pracowników.

### Aktualizacja instrukcji (`HelpPage.tsx`)

Zaktualizowano zakładkę Instrukcja — była mocno nieaktualna. Dodano/zmieniono:
- **Nowa sekcja:** Sygnatury raportów (jak podpisywać, cofać, dostęp do edycji)
- **Nowa sekcja:** HR — urlopy pracownik (wnioski, typy, saldo, kalendarz)
- **Nowa sekcja:** HR — zarządzanie admin (4 taby, zatwierdzanie, obecność)
- **Zaktualizowano:** Raport Dnia (wiele wpisów, ekipa raz, materiały per wpis, odblokowanie)
- **Zaktualizowano:** Materiałówka (wybór raportu + wpisu, dodawanie z karty wpisu)
- **Zaktualizowano:** Pojazdy (wyjaśnienie km przejechanych vs odczyt licznika)
- **Rozszerzone wskazówki** — sygnatury, blokada ekipy
- Nowe ikony: `PenLine`, `CalendarDays`, `ShieldCheck`
- Przebudowany obraz Docker frontendu i wdrożony

## Przemyślenia — kolejny moduł

### Odrzucone propozycje (do późniejszego rozważenia)
- Moduł Magazynu (stany ilościowe materiałów)
- Moduł Zleceń / Projektów
- Moduł Szkoleń i Uprawnień (BHP)
- Kilometrówka / Delegacje
- Protokoły zdawczo-odbiorcze

### Wybrany kierunek: Tablica Ogłoszeń

**Uzasadnienie:** Kahma jest jedynym systemem do którego pracownicy wchodzą codziennie (raport). Idealne miejsce na komunikaty bez dodatkowych aplikacji.

**Planowany zakres modułu:**

| Funkcja | Admin | Pracownik |
|---|---|---|
| Dodaj ogłoszenie (tytuł, treść, priorytet, data wygaśnięcia) | ✅ | — |
| Przypnij ogłoszenie na górze | ✅ | — |
| Wymagaj potwierdzenia przeczytania | ✅ | — |
| Widok kto przeczytał / kto nie | ✅ | — |
| Lista ogłoszeń | ✅ | ✅ |
| Baner "Nieprzeczytane: N" na dashboardzie | — | ✅ |
| Przycisk "Przeczytałem" przy ogłoszeniu | — | ✅ |

**Przypadki użycia:**
- Komunikaty operacyjne (zbiórka, dostępność sprzętu, zamknięcie magazynu)
- Alerty bezpieczeństwa z potwierdzeniem przeczytania (BHP, procedury)
- Zmiany organizacyjne (nowi pracownicy, zmiany kierownictwa)
- Przypomnienia cykliczne (raporty, wnioski urlopowe)
- Pinowane stałe informacje (regulamin, numery alarmowe, stawki km)

**Status:** Zaplanowany — implementacja w kolejnej sesji.

## Następna sesja

Implementacja Modułu Tablica Ogłoszeń.
