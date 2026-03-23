# DraftPlay User App (Web) — Expo static export served by nginx
# Builds the Expo app for web, then serves with nginx

FROM node:22-slim AS base
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY patches/ ./patches/
COPY apps/mobile/package.json ./apps/mobile/package.json
COPY packages/ui/package.json ./packages/ui/package.json
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/config/ ./packages/config/
RUN pnpm install --frozen-lockfile --filter @draftplay/mobile...

# Build
FROM deps AS build
COPY apps/mobile/ ./apps/mobile/
COPY packages/ui/ ./packages/ui/
COPY packages/shared/ ./packages/shared/

# EXPO_PUBLIC_ vars must be set at build time
ARG EXPO_PUBLIC_FIREBASE_API_KEY
ARG EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG EXPO_PUBLIC_FIREBASE_PROJECT_ID
ARG EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET
ARG EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ARG EXPO_PUBLIC_FIREBASE_APP_ID
ARG EXPO_PUBLIC_API_URL
ARG EXPO_PUBLIC_SENTRY_DSN

RUN pnpm --filter @draftplay/mobile exec expo export --platform web

# Serve with nginx
FROM nginx:alpine AS runner
COPY --from=build /app/apps/mobile/dist /usr/share/nginx/html

# SPA fallback — route all paths to index.html
RUN printf 'server {\n\
  listen 8080;\n\
  root /usr/share/nginx/html;\n\
  location / {\n\
    try_files $uri $uri/ /index.html;\n\
  }\n\
  location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {\n\
    expires 1y;\n\
    add_header Cache-Control "public, immutable";\n\
  }\n\
}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
