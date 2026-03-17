# ── Stage 1: build the React client ──────────────────────────────────────────
FROM oven/bun:1-alpine AS client-builder
WORKDIR /build

# Install client deps
COPY client/package.json client/bun.lock* ./client/
RUN cd client && bun install --frozen-lockfile

# Build
COPY client ./client
RUN cd client && bun run build

# ── Stage 2: production server ────────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

# Install server deps (production only)
COPY server/package.json server/package-lock.json* ./server/
RUN cd server && npm install --omit=dev --ignore-scripts

# Copy server source
COPY server ./server

# Copy built client
COPY --from=client-builder /build/client/dist ./client/dist

# Copy entrypoint
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3001

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server/index.js"]
