# Stage 1: Build Frontend
FROM node:22-alpine AS build-frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Setup Backend & Runner
FROM node:22-alpine
WORKDIR /app

# Install build tools jika better-sqlite3 memerlukan kompilasi native
RUN apk add --no-cache python3 make g++

WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install --production

# Copy kode backend & hasil build frontend
COPY backend/ ./
COPY --from=build-frontend /app/frontend/dist ./public

# Buat folder untuk persistent volume SQLite
VOLUME ["/app/backend/data"]

EXPOSE 5000

ENV PORT=5000

CMD ["node", "server.js"]
