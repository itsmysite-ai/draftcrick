FROM node:22-slim AS base
RUN corepack enable pnpm

FROM base AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages/api/package.json ./packages/api/
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile

COPY packages/api/ ./packages/api/
COPY packages/db/ ./packages/db/
COPY packages/shared/ ./packages/shared/
RUN pnpm --filter @draftcrick/api build

FROM base AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/packages/api/dist ./dist
COPY --from=build /app/packages/api/package.json ./
COPY --from=build /app/node_modules ./node_modules

EXPOSE 3001
CMD ["node", "dist/index.js"]
