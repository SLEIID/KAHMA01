# KAHMA — Technologia systemu od sprzętu do przeglądarki

Dokument opisuje jak zbudowany jest i jak działa system KAHMA — od fizycznego serwera aż po obraz widoczny w przeglądarce na `app.kahma.net`. Czytaj jak instrukcję "zbuduj od zera".

---

## 1. Sprzęt i system operacyjny

### Fizyczny serwer / VPS
System działa na dowolnym serwerze z Linuksem. Wymagania minimalne:
- **CPU**: 1–2 vCPU (aplikacja nie jest obliczeniowo intensywna)
- **RAM**: 2 GB (Docker + 4 kontenery)
- **Dysk**: 10 GB SSD
- **OS**: Debian 12 / Ubuntu 22.04 LTS lub nowszy (testowane na Debianie)
- **Dostęp**: SSH, użytkownik z prawem `sudo`

### Instalacja wymaganych narzędzi
```bash
# Docker engine
sudo apt-get update && sudo apt-get install -y docker.io

# Docker Compose v2 (jako plugin binarny)
sudo mkdir -p /usr/local/lib/docker/cli-plugins
sudo curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

# Docker Buildx (do multi-stage builds)
# analogicznie — binarny plugin w /usr/local/lib/docker/cli-plugins/docker-buildx

# Dodaj użytkownika do grupy docker (żeby nie używać sudo)
sudo usermod -aG docker $USER
# Wymaga ponownego zalogowania / nowej sesji terminala
```

Sprawdzenie:
```bash
docker --version          # Docker version 26.x
docker compose version    # Docker Compose version v5.x
docker buildx version     # buildx vX.XX
```

---

## 2. Architektura systemu — widok z lotu ptaka

```
Internet
    │
    ▼
Cloudflare (DNS + Tunnel)
    │  HTTPS → app.kahma.net
    ▼
localhost:8090  ←── kahma-nginx (Nginx:alpine)
    │
    ├── /api/*  ──────────────► kahma-backend:3001  (Node.js/Express/TypeScript)
    │                                │
    │                                ▼
    │                          kahma-db:5432  (PostgreSQL 16)
    │                          [volume: kahma_db_data]
    │
    └── /*  ────────────────► kahma-frontend:80  (React SPA w Nginx:alpine)
```

Wszystkie 4 serwisy żyją w jednej wewnętrznej sieci Dockera `kahma_net` (bridge). Na zewnątrz serwera wystawiony jest **tylko port 8090** — reszta portów jest mapowana wyłącznie dla diagnostyki.

---

## 3. Docker Compose — definicja kontenerów

Plik: `kahma/docker-compose.yml`

### Sieć i wolumeny
```yaml
networks:
  kahma_net:        # izolowana sieć bridge dla 4 serwisów

volumes:
  kahma_db_data:    # trwałe dane PostgreSQL (nie usuwa się przy docker compose down)
  kahma_uploads:    # pliki uploadów (zdjęcia materiałów) dostępne dla backendu
```

### Kontener: `kahma-db`
```yaml
image: postgres:16-alpine
restart: unless-stopped
healthcheck: pg_isready -U kahma_user -d kahma   # co 10s, 5 prób
volumes:
  - kahma_db_data:/var/lib/postgresql/data
```
- PostgreSQL 16 na Alpine Linux (lekki obraz ~80 MB)
- Dane trwałe w Dockerowym volume — przeżywają restart i `down`
- Backend **czeka na healthcheck** przed startem (warunek `depends_on: condition: service_healthy`)

### Kontener: `kahma-backend`
```yaml
build: ./backend   # wieloetapowy build (patrz sekcja 5)
restart: unless-stopped
ports: "3301:3001"
volumes:
  - kahma_uploads:/app/uploads
depends_on:
  kahma-db:
    condition: service_healthy
```

### Kontener: `kahma-frontend`
```yaml
build: ./frontend  # wieloetapowy build (patrz sekcja 6)
restart: unless-stopped
ports: "3300:80"
```

### Kontener: `kahma-nginx`
```yaml
image: nginx:alpine
restart: unless-stopped
ports: "8090:80"
volumes:
  - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
depends_on:
  - kahma-backend
  - kahma-frontend
```

---

## 4. Baza danych — PostgreSQL + Prisma ORM

### Silnik
- **PostgreSQL 16** — relacyjna baza SQL
- **Prisma ORM** — zarządzanie schematem, migracje, bezpieczne zapytania z TypeScript

### Schemat — 23 tabele

| Moduł | Tabele |
|---|---|
| Użytkownicy i auth | `users`, `roles`, `refresh_tokens` |
| Raporty dzienne | `daily_reports`, `report_entries`, `report_signatures` |
| Pojazdy | `vehicles`, `vehicle_usage` |
| Sprzęt | `equipment_categories`, `equipment_items`, `equipment_rentals`, `equipment_issues` |
| Materiały | `materials`, `material_usages`, `material_alerts` |
| Struktura firmy | `locations`, `departments`, `teams` |
| HR | `leave_types`, `leave_requests`, `leave_balances` |
| Notatki | `notes` |
| Prisma | `_prisma_migrations` |

### Klucze główne
- Tabele z użytkownikami i dokumentami: **UUID** (`@default(uuid())`)
- Słowniki i kategorie: **autoincrement** (`@id @default(autoincrement())`)

### Migracje Prisma
18 migracji od init do ostatniego feature'a, nazwy sugerują historię projektu:
```
20260319000000_init
20260319000001_add_daily_reports
20260320000000_add_equipment
20260321000000_add_materials
20260324000000_add_entries_and_teams
20260325000000_refactor_v2
20260330000000_add_can_rent_equipment
20260401000000_add_report_signatures
20260403000000_add_hr
20260407000000_material_entry_team_report
... (18 łącznie)
```

Migracje uruchamiają się **automatycznie przy każdym starcie backendu**:
```bash
# CMD w Dockerfile backendu
npx prisma migrate deploy && node dist/prisma/seed.js || true && node dist/index.js
```

### Konfiguracja połączenia
```
DATABASE_URL=postgresql://kahma_user:HASŁO@kahma-db:5432/kahma
```
`kahma-db` to nazwa DNS w sieci Docker — kontenery widzą się po nazwie serwisu.

---

## 5. Backend — Node.js / Express / TypeScript

### Stack
| Warstwa | Technologia |
|---|---|
| Runtime | Node.js 20 LTS (Alpine) |
| Framework HTTP | Express 4 |
| Język | TypeScript → kompilowany przez `tsup` → CommonJS |
| ORM | Prisma Client v5 |
| Autentykacja | JWT (Access Token 15min + Refresh Token 7dni) |
| Hashowanie haseł | bcryptjs (12 rund) |
| Walidacja danych | Zod |
| Upload plików | Multer |
| Zabezpieczenia | Helmet, express-rate-limit, CORS |
| Logi HTTP | Morgan |
| Eksport danych | xlsx (arkusze Excel) |

### Wieloetapowy Docker build (multi-stage)

**Stage 1 — builder** (`node:20-alpine`):
```dockerfile
COPY package*.json ./
RUN npm ci                         # instaluje wszystkie zależności (+ devDeps)
COPY tsconfig.json prisma/ src/ ./
RUN npx prisma generate            # generuje Prisma Client (binarki dla linux-musl)
RUN npm run build                  # tsup → dist/index.js (104 KB, CJS)
RUN npx tsup prisma/seed.ts        # kompiluje seed → dist/prisma/seed.js
```

**Stage 2 — production** (`node:20-alpine`):
```dockerfile
RUN apk add --no-cache openssl     # wymagane przez Prisma binaries
RUN npm ci --omit=dev              # tylko produkcyjne zależności
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY prisma ./prisma/              # pliki migracji i schema.prisma
```
Wynik: lekki obraz produkcyjny bez TypeScript, source mapy, narzędzi deweloperskich.

### Struktura modułów
```
src/
├── index.ts                  ← punkt wejścia, Express app, rejestracja routes
├── config/env.ts             ← walidacja zmiennych środowiskowych przez Zod
├── lib/prisma.ts             ← singleton Prisma Client
├── middleware/
│   ├── auth.ts               ← weryfikacja JWT z nagłówka Authorization: Bearer
│   ├── errorHandler.ts       ← globalny handler błędów → JSON error response
│   └── requireRole.ts        ← sprawdzenie roli (admin vs pracownik)
├── shared/ApiError.ts        ← klasa błędów HTTP (400, 401, 403, 404, 409...)
└── modules/                  ← każdy moduł = routes + controller + service + schemas
    ├── auth/                 (login, logout, refresh, me)
    ├── users/                (CRUD użytkowników)
    ├── dailyReport/          (raporty dzienne)
    ├── equipment/            (sprzęt — kategorie, przedmioty)
    ├── equipmentRentals/     (wypożyczenia sprzętu)
    ├── equipmentIssues/      (usterki sprzętu)
    ├── materials/            (katalog materiałów, upload zdjęć)
    ├── materialUsages/       (zużycie materiałów)
    ├── materialAlerts/       (alerty niskiego stanu)
    ├── locations/            (miejsca pracy)
    ├── departments/          (wydziały)
    ├── teams/                (zespoły)
    ├── vehicles/             (pojazdy)
    ├── notes/                (notatki prywatne)
    └── hr/                   (urlopy — wnioski, salda, typy)
```

### Autentykacja — przepływ JWT

```
1. POST /api/v1/auth/login
   body: { login, password }
   → backend weryfikuje hasło przez bcrypt.compare()
   → generuje accessToken (JWT, 15 min, w odpowiedzi JSON)
   → generuje refreshToken (64B random hex, hash SHA-256 w bazie)
   → ustawia httpOnly cookie z refreshToken

2. Każde chronione żądanie:
   Authorization: Bearer <accessToken>
   → middleware auth.ts weryfikuje podpis JWT i czas życia
   → wstrzykuje req.user = { id, login, role, canRentEquipment }

3. POST /api/v1/auth/refresh
   → odczytuje refreshToken z cookie
   → porównuje hash z bazą (ochrona przed kradzieżą tokenu)
   → wydaje nowy accessToken
```

### API Endpointy (wybór)
```
GET  /api/health                         ← health check (publiczny)
POST /api/v1/auth/login
POST /api/v1/auth/logout
POST /api/v1/auth/refresh
GET  /api/v1/auth/me

GET  /api/v1/daily-reports               ← lista raportów
POST /api/v1/daily-reports               ← nowy raport
GET  /api/v1/daily-reports/:id           ← szczegóły raportu
PATCH /api/v1/daily-reports/:id/approve  ← zatwierdzenie (admin)

GET  /api/v1/materials                   ← katalog materiałów (4535 pozycji)
POST /api/v1/materials                   ← dodaj materiał
POST /api/v1/materials/:id/photo         ← upload zdjęcia (multer → /app/uploads)

GET  /api/v1/equipment                   ← sprzęt
POST /api/v1/equipment-rentals           ← wypożycz sprzęt
PATCH /api/v1/equipment-rentals/:id/return ← zwrot

GET  /api/v1/hr/leave-requests           ← wnioski urlopowe
POST /api/v1/hr/leave-requests           ← złóż wniosek
PATCH /api/v1/hr/leave-requests/:id/review ← rozpatrz (admin)
```

### Zmienne środowiskowe backendu
```env
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://kahma_user:HASŁO@kahma-db:5432/kahma
JWT_ACCESS_SECRET=<128-znakowy hex>
JWT_REFRESH_SECRET=<128-znakowy hex>
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d
CORS_ORIGIN=https://app.kahma.net
BCRYPT_ROUNDS=12
```

---

## 6. Frontend — React / Vite / TypeScript

### Stack
| Warstwa | Technologia |
|---|---|
| Framework UI | React 18 |
| Bundler / Dev server | Vite 5 |
| Język | TypeScript |
| Routing | React Router DOM v6 |
| Stan serwera (cache) | TanStack Query (React Query) v5 |
| Stan globalny (UI) | Zustand |
| Formularze | React Hook Form + Zod resolver |
| HTTP client | Axios |
| Komponenty UI | Radix UI (Dialog, Select, Dropdown, Tooltip...) |
| Style | Tailwind CSS 3 |
| Ikony | Lucide React |
| Utils | clsx, tailwind-merge, class-variance-authority |

### Wieloetapowy Docker build (multi-stage)

**Stage 1 — builder** (`node:20-alpine`):
```dockerfile
RUN npm ci
COPY . .
RUN npm run build   # tsc -b && vite build → dist/ (711 KB JS, 25 KB CSS)
```

**Stage 2 — production** (`nginx:alpine`):
```dockerfile
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
```
React app jest statyczną paczką plików HTML/JS/CSS serwowaną przez Nginx — brak Node.js w produkcji.

### Nginx dla frontendu (SPA routing)
```nginx
location / {
    try_files $uri $uri/ /index.html;   # ← kluczowe dla React Router
    add_header Cache-Control "no-cache, no-store, must-revalidate";
}

location ~* \.(js|css|png|jpg|ico|svg|woff2)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";  # ← cache assets na rok
}
```
Każde odświeżenie strony w przeglądarce trafia do `index.html` — React Router obsługuje nawigację po stronie klienta.

---

## 7. Reverse Proxy — Nginx (kahma-nginx)

### Rola
Jeden punkt wejścia dla całej aplikacji. Routuje ruch na podstawie ścieżki URL.

### Konfiguracja routingu
```nginx
# Żądania do API → backend
location /api/ {
    proxy_pass http://kahma-backend:3001;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 10m;     # limity uploadów
    proxy_read_timeout 60s;
}

# Wszystko inne → frontend (React SPA)
location / {
    proxy_pass http://kahma-frontend:80;
}
```

### Zabezpieczenia HTTP
```nginx
server_tokens off;                                    # ukrywa wersję Nginx
add_header X-Frame-Options "SAMEORIGIN" always;       # blokuje osadzanie w iframe
add_header X-Content-Type-Options "nosniff" always;   # blokuje MIME sniffing
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
gzip on;                                              # kompresja odpowiedzi
```

---

## 8. Cloudflare Tunnel — HTTPS bez otwierania portów

### Problem który rozwiązuje
Serwer **nie musi mieć publicznego IP ani otwartych portów 80/443**. Cloudflare Tunnel tworzy szyfrowane połączenie wychodzące (outbound) od serwera do sieci Cloudflare.

### Jak to działa
```
Przeglądarka → app.kahma.net (DNS: CNAME → Cloudflare)
    │
    ▼
Cloudflare Edge (TLS termination, certyfikat SSL)
    │  Zaszyfrowany tunel (cloudflared daemon na serwerze)
    ▼
localhost:8090 na serwerze → kahma-nginx
```

### Konfiguracja po stronie Cloudflare
- Utwórz tunel w Cloudflare Zero Trust
- Przypisz domenę `app.kahma.net` → `http://localhost:8090`
- Na serwerze zainstaluj i uruchom `cloudflared` jako usługę systemową

### Co Cloudflare dodatkowo zapewnia
- Automatyczny certyfikat TLS/HTTPS (nie trzeba Certbot/Let's Encrypt)
- Ochrona DDoS
- Ukrycie prawdziwego IP serwera
- Opcjonalnie: Access policies (logowanie przez Google/GitHub przed dostępem)

---

## 9. Zmienne środowiskowe — plik `.env`

Plik `kahma/.env` jest ładowany przez Docker Compose i przekazywany do kontenerów:

```env
# Baza danych
POSTGRES_DB=kahma
POSTGRES_USER=kahma_user
POSTGRES_PASSWORD=Kahma2026Secure

# JWT
JWT_ACCESS_SECRET=<128-znakowy hex>
JWT_REFRESH_SECRET=<128-znakowy hex>
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d

# CORS
CORS_ORIGIN=https://app.kahma.net   ← musi być dokładną domeną frontendu

# Bezpieczeństwo
BCRYPT_ROUNDS=12
```

**Ważne**: `CORS_ORIGIN` musi odpowiadać domenie z której przeglądarka wysyła żądania. Przy zmianie domeny — zmień tylko tę zmienną.

---

## 10. Dane i pliki statyczne

### Baza danych
- Trwała w Docker volume `kahma_kahma_db_data` → `/var/lib/postgresql/data`
- Backup: `docker exec kahma-db pg_dump -U kahma_user kahma > backup.sql`
- Restore: `cat backup.sql | docker exec -i kahma-db psql -U kahma_user -d kahma`

### Pliki uploadów (zdjęcia materiałów)
- Przechowywane w Docker volume `kahma_kahma_uploads` → `/app/uploads/`
- Struktura: `/app/uploads/materials/<uuid>.jpg`
- Backend serwuje pliki statyczne z tego katalogu (`express.static`)
- W imporcie: `tar xzf kahma_uploads.tar.gz -C /tmp/ && docker cp /tmp/kahma_uploads_backup/. kahma-backend:/app/uploads/`

---

## 11. Seed bazy — dane startowe

Przy każdym starcie backendu wykonywany jest `dist/prisma/seed.js`:
- Tworzy rolę `admin` i `pracownik` (jeśli nie istnieją)
- Tworzy konto `admin` z domyślnym hasłem (jeśli nie istnieje)
- Wgrywa listę sprzętu ze słownika (jeśli nie istnieje)
- Blok `|| true` w CMD — błąd seedu nie blokuje startu serwera

---

## 12. Procedura wdrożenia od zera

```bash
# 1. Przygotuj serwer (Debian/Ubuntu)
sudo apt-get install -y docker.io
# + instalacja compose v2 i buildx (patrz sekcja 1)
sudo usermod -aG docker $USER && newgrp docker

# 2. Skopiuj pliki na serwer
mkdir -p ~/projects/kahma
# Skopiuj: kahma_code.tar.gz, kahma_dump_20260415.sql, kahma_uploads.tar.gz

# 3. Rozpakuj kod
tar xzf kahma_code.tar.gz -C ~/projects/

# 4. Ustaw domenę
nano ~/projects/kahma/.env
# zmień CORS_ORIGIN=https://TWOJA-DOMENA

# 5. Zbuduj i uruchom
cd ~/projects/kahma
docker compose up -d --build

# 6. Poczekaj na bazę i zaimportuj dump
docker compose ps   # kahma-db: healthy
sed '5d' kahma_dump_20260415.sql | docker exec -i kahma-db psql -U kahma_user -d kahma

# 7. Wgraj pliki uploadów
tar xzf kahma_uploads.tar.gz -C /tmp/
docker cp /tmp/kahma_uploads_backup/. kahma-backend:/app/uploads/

# 8. Weryfikacja
docker compose ps                                        # 4x Up
curl http://localhost:8090/api/health                   # {"status":"ok",...}
curl -s -o /dev/null -w "%{http_code}" http://localhost:8090/   # 200

# 9. Cloudflare Tunnel
# W Cloudflare Zero Trust → tunele → nowy tunel
# Service: http://localhost:8090
# Subdomain: app.kahma.net
```

---

## 13. Przydatne komendy operacyjne

```bash
# Status wszystkich kontenerów
docker compose ps

# Logi w czasie rzeczywistym
docker compose logs -f kahma-backend
docker compose logs -f kahma-nginx

# Restart pojedynczego serwisu
docker compose restart kahma-backend

# Rebuild po zmianie kodu
docker compose up -d --build kahma-backend

# Wejście do bazy
docker exec -it kahma-db psql -U kahma_user -d kahma

# Backup bazy
docker exec kahma-db pg_dump -U kahma_user kahma > backup_$(date +%Y%m%d).sql

# Sprawdzenie zajętości portów
ss -tlnp | grep -E '8090|3300|3301|5433'

# Zatrzymanie całego stacku (dane w volume przeżywają)
docker compose down

# Zatrzymanie Z usunięciem danych (UWAGA: usuwa bazę!)
docker compose down -v
```

---

## 14. Diagram przepływu żądania

Przykład: pracownik ładuje listę materiałów w przeglądarce.

```
1. Przeglądarka wpisuje https://app.kahma.net/materials

2. DNS: app.kahma.net → Cloudflare CNAME
   Cloudflare: terminuje TLS, przekazuje przez tunel

3. Tunel cloudflared → localhost:8090 (kahma-nginx)

4. Nginx: URL to "/" → proxy_pass do kahma-frontend:80
   Frontend: serwuje index.html (React SPA)
   Przeglądarka: ładuje JS bundle (711 KB, cached po pierwszym razie)

5. React Router: renderuje komponent /materials
   React Query: wykonuje GET /api/v1/materials
   Axios: wysyła żądanie z nagłówkiem Authorization: Bearer <token>

6. Nginx: URL /api/* → proxy_pass do kahma-backend:3001
   Backend middleware auth.ts: weryfikuje JWT
   materials.controller.ts → materials.service.ts
   Prisma: SELECT * FROM materials ORDER BY name LIMIT 50
   PostgreSQL 16: zwraca wyniki

7. Odpowiedź: JSON z listą materiałów
   React Query: cache'uje wynik
   React: renderuje tabelę z materiałami

Całość: ~50–150ms na świeżym połączeniu, ~5–20ms z cache'em React Query
```
