# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./

RUN if [ -f yarn.lock ]; then yarn install --frozen-lockfile; \
    elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm install --frozen-lockfile; \
    elif [ -f package-lock.json ]; then npm ci; \
    else npm install; fi

COPY . .

# Ensure public exists so stage-2 COPY never fails (Next.js public is optional)
RUN mkdir -p /app/public

RUN npm run build

# Stage 2: Runtime
FROM node:20-alpine

WORKDIR /app

RUN npm install -g next

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.js ./

EXPOSE 3000

ENV NODE_ENV=production
ENV NEXT_PUBLIC_API_BASE_URL=http://localhost:8000

CMD ["npm", "start"]
