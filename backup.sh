#!/bin/bash
# Backup Kahma: baza danych + .env + uploads
# Uruchomienie: ./backup.sh
# Wynik: ~/kahma-backups/kahma_YYYY-MM-DD_HHMMSS.tar.gz

set -euo pipefail

BACKUP_DIR="$HOME/kahma-backups"
TIMESTAMP=$(date +%Y-%m-%d_%H%M%S)
WORK_DIR=$(mktemp -d)
ARCHIVE="$BACKUP_DIR/kahma_${TIMESTAMP}.tar.gz"
KEEP_LAST=7   # ile ostatnich backupów zachować

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

cleanup() { rm -rf "$WORK_DIR"; }
trap cleanup EXIT

echo "[kahma-backup] Start: $TIMESTAMP"
mkdir -p "$BACKUP_DIR"

# 1. Dump bazy danych
echo "[1/3] Dump PostgreSQL..."
source "$PROJECT_DIR/.env"
docker exec kahma-db pg_dump \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" \
  --no-password \
  > "$WORK_DIR/db.sql"
echo "      OK ($(du -sh "$WORK_DIR/db.sql" | cut -f1))"

# 2. Kopia .env
echo "[2/3] Kopia .env..."
cp "$PROJECT_DIR/.env" "$WORK_DIR/kahma.env"
echo "      OK"

# 3. Uploads (zdjęcia materiałów)
echo "[3/3] Uploads z Docker volume..."
docker run --rm \
  -v kahma_uploads:/data \
  -v "$WORK_DIR":/out \
  alpine \
  sh -c "cd /data && tar czf /out/uploads.tar.gz . 2>/dev/null || true"
UPLOADS_SIZE=$(du -sh "$WORK_DIR/uploads.tar.gz" 2>/dev/null | cut -f1 || echo "0")
echo "      OK ($UPLOADS_SIZE)"

# 4. Spakuj wszystko
echo "Pakowanie archiwum..."
tar czf "$ARCHIVE" -C "$WORK_DIR" .
echo "Archiwum: $ARCHIVE ($(du -sh "$ARCHIVE" | cut -f1))"

# 5. Rotacja — usuń stare backupy powyżej limitu
BACKUP_COUNT=$(ls "$BACKUP_DIR"/kahma_*.tar.gz 2>/dev/null | wc -l)
if [ "$BACKUP_COUNT" -gt "$KEEP_LAST" ]; then
  DELETE_COUNT=$(( BACKUP_COUNT - KEEP_LAST ))
  ls -t "$BACKUP_DIR"/kahma_*.tar.gz | tail -n "$DELETE_COUNT" | xargs rm -f
  echo "Rotacja: usunięto $DELETE_COUNT stary(ch) backup(ów), zostaje $KEEP_LAST"
fi

echo "[kahma-backup] Gotowe."
