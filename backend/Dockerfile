FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY prisma ./prisma/
COPY src ./src/

RUN npx prisma generate
RUN npm run build
RUN npx tsup prisma/seed.ts --format cjs --out-dir dist/prisma

# ---

FROM node:20-alpine AS production

RUN apk add --no-cache openssl

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY prisma ./prisma/

# Skopiuj seed do dist
COPY --from=builder /app/dist/prisma ./dist/prisma

EXPOSE 3001

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/prisma/seed.js || true && node dist/index.js"]
