# Status wdrożenia KAHMA — 2026-04-15

## WDROŻENIE ZAKOŃCZONE ✓

Wszystkie kroki wykonane 2026-04-15.

---

## Co zostało zrobione

- [x] Zainstalowano `docker.io` (v26.1.5)
- [x] Zainstalowano `docker compose` v2 (v5.1.2)
- [x] Zainstalowano `docker buildx` v0.33.0
- [x] Kod aplikacji — struktura projektu w `/home/SLEID5/projects/kahma/`
- [x] Zmieniono domenę w `.env`: `CORS_ORIGIN=https://app.kahma.net`
- [x] Dodano użytkownika `SLEID5` do grupy `docker`
- [x] Zbudowano i uruchomiono kontenery: `docker compose up -d --build`
- [x] Zaimportowano dump bazy (`kahma_dump_20260415.sql`) — 9 users, 16 daily_reports, 4535 materials
- [x] Wgrane pliki uploadów do `kahma-backend:/app/uploads/`
- [x] Weryfikacja końcowa — wszystkie 4 kontenery Up, API odpowiada, frontend HTTP 200

---

## Status kontenerów

| Kontener        | Status          | Port                  |
|-----------------|-----------------|-----------------------|
| kahma-db        | Up (healthy)    | wewnętrzny 5432       |
| kahma-backend   | Up              | 0.0.0.0:3301→3001     |
| kahma-frontend  | Up              | 0.0.0.0:3300→80       |
| kahma-nginx     | Up              | 0.0.0.0:8090→80       |

---

## Stack technologiczny

- **PERN**: PostgreSQL 16 + Express/Node.js/TypeScript + React/Vite + Nginx
- **Porty**: nginx `:8090` (proxy), frontend `:3300`, backend `:3301`, postgres `:5433`
- **Docelowa domena**: `https://app.kahma.net` → Cloudflare Tunnel → `localhost:8090`
- **Docker volume bazy**: `kahma_kahma_db_data`

---

## Uwagi techniczne

- Dump był zabezpieczony tokenem `\restrict` (PostgreSQL 16 feature) — import wymagał `sed '5d'` do pominięcia tej linii
- Schemat bazy zbudowany z dumpu (DROP SCHEMA + import), a nie przez Prisma migrations
- `_prisma_migrations` tabela z dumpu — Prisma widzi wszystkie 18 migracji jako zastosowane
- Cloudflare Tunnel dla `app.kahma.net` musi wskazywać na `localhost:8090`
- Prisma migrations uruchamiają się automatycznie przy starcie backendu (entrypoint w Dockerfile)
- Nie zmieniaj haseł w `.env` — system kopiowany 1:1
