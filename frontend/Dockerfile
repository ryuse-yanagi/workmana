# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

COPY frontend/package*.json ./

RUN npm ci

COPY frontend/ ./
COPY shared/ /shared/

RUN npm run build


# Production stage
FROM node:22-alpine

WORKDIR /app

COPY --from=builder /app/.output ./.output

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]