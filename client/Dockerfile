# Stage 1: Build
FROM node:26-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm@9

# Cache dependencies
COPY client/package.json client/pnpm-lock.yaml client/.npmrc ./client/
WORKDIR /app/client
RUN pnpm install --frozen-lockfile

# Copy source code and GraphQL schema
WORKDIR /app
COPY client/ ./client/
COPY server/internal/handler/graphql/schema/ ./server/internal/handler/graphql/schema/

# Build production bundle
WORKDIR /app/client
RUN pnpm build

# Stage 2: Runtime Nginx
FROM nginx:alpine

# Remove default nginx static files
RUN rm -rf /usr/share/nginx/html/*

# Copy built assets
COPY --from=builder /app/client/dist /usr/share/nginx/html

# Copy nginx config
COPY client/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
