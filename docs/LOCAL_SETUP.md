# DraftCrick — Local Development Setup

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| **Node.js** | >= 22.0.0 | [nodejs.org](https://nodejs.org) or `nvm install 22` |
| **pnpm** | 9.15.4 | `corepack enable && corepack prepare pnpm@9.15.4 --activate` |
| **PostgreSQL** | >= 15 | `brew install postgresql@15` (macOS) or [postgresql.org](https://postgresql.org) |
| **Redis** | >= 7 | `brew install redis` (macOS) or [redis.io](https://redis.io) |
| **Expo CLI** | latest | Comes with `npx expo` — no global install needed |
| **Expo Go** | latest | Install on your phone from App Store / Play Store |

Optional (for full feature set):
- **Android Studio** — for Android emulator
- **Xcode** — for iOS simulator (macOS only)
- **Docker** — alternative for PostgreSQL + Redis

---

## 1. Clone & Install

```bash
git clone https://github.com/itsmysite-ai/draftcrick.git
cd draftcrick
pnpm install
```

---

## 2. Environment Variables

```bash
cp .env.example .env
```

Open `.env` and fill in the **required** values:

### Required for local dev

```env
# Database — create this database first (see step 3)
DATABASE_URL=postgresql://postgres:password@localhost:5432/draftcrick

# Redis
REDIS_URL=redis://localhost:6379

# Auth secret — generate one: openssl rand -hex 32
BETTER_AUTH_SECRET=<your-random-secret>
BETTER_AUTH_URL=http://localhost:3001

# AI-powered sports data (get a key at https://aistudio.google.com/apikey)
GEMINI_API_KEY=<your-gemini-api-key>

# App
NODE_ENV=development
PORT=3001
WEB_URL=http://localhost:3000
MOBILE_URL=exp://localhost:8081
```

### Optional (feature-specific)

| Variable | What it enables |
|----------|----------------|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth sign-in |
| `APPLE_CLIENT_ID` / `APPLE_CLIENT_SECRET` | Apple sign-in |
| `FIREBASE_PROJECT_ID` / `FIREBASE_PRIVATE_KEY` / `FIREBASE_CLIENT_EMAIL` | Real-time push notifications |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Razorpay payments (India) |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Stripe payments (Global) |
| `CRICAPI_KEY` / `SPORTRADAR_KEY` | Cricket data APIs |
| `RESEND_API_KEY` | Transactional emails |
| `SENTRY_DSN` | Error tracking |

---

## 3. Database Setup

```bash
# Start PostgreSQL (if not running)
brew services start postgresql@15   # macOS
# or: sudo systemctl start postgresql  # Linux

# Create the database
createdb draftcrick

# Push the Drizzle schema to your local DB
pnpm db:push

# (Optional) Open Drizzle Studio to browse your data
pnpm db:studio
```

### Using Docker instead

```bash
docker run -d \
  --name draftcrick-postgres \
  -e POSTGRES_DB=draftcrick \
  -e POSTGRES_PASSWORD=password \
  -p 5432:5432 \
  postgres:15

docker run -d \
  --name draftcrick-redis \
  -p 6379:6379 \
  redis:7-alpine
```

---

## 4. Start Redis

```bash
brew services start redis           # macOS
# or: sudo systemctl start redis    # Linux
# or: redis-server                  # manual foreground
```

Verify it's running:
```bash
redis-cli ping
# → PONG
```

---

## 5. Run the App

### Everything at once (recommended)

```bash
pnpm dev
```

This starts all workspaces in parallel via Turborepo:
- **API** → `http://localhost:3001` (Hono + tRPC)
- **Web** → `http://localhost:3000` (Next.js)
- **Mobile** → Expo dev server on port 8081

### Individual packages

```bash
# API server only
pnpm --filter @draftcrick/api dev

# Web app only
pnpm --filter @draftcrick/web dev

# Mobile app only
pnpm --filter @draftcrick/mobile dev
```

### Mobile app on a device

1. Run `pnpm --filter @draftcrick/mobile dev`
2. Scan the QR code with **Expo Go** (Android) or the Camera app (iOS)
3. Or press `a` for Android emulator / `i` for iOS simulator

> **Tip:** If the app can't connect to the API from your phone, make sure `BETTER_AUTH_URL` and the tRPC base URL use your machine's LAN IP (e.g., `http://192.168.1.100:3001`) instead of `localhost`.

---

## 6. Project Structure

```
draftcrick/
├── apps/
│   ├── mobile/                  # Expo SDK 52 + Expo Router
│   └── web/                     # Next.js 15 (App Router)
├── packages/
│   ├── api/                     # Hono server + tRPC routers
│   ├── db/                      # Drizzle ORM schemas + migrations
│   ├── shared/                  # Types (Zod), constants, utils
│   ├── ui/                      # Tamagui design system (CrickUI)
│   └── config/
│       ├── typescript/          # Shared tsconfig presets
│       └── eslint/              # Shared ESLint configs
├── .env.example                 # Environment variable template
├── pnpm-workspace.yaml          # Workspace definitions
├── turbo.json                   # Turborepo pipeline config
└── package.json                 # Root scripts
```

---

## 7. Common Commands

| Command | What it does |
|---------|-------------|
| `pnpm dev` | Start all packages in dev mode |
| `pnpm build` | Build all packages |
| `pnpm lint` | Lint all packages |
| `pnpm type-check` | TypeScript check all packages |
| `pnpm clean` | Remove build artifacts |
| `pnpm db:generate` | Generate Drizzle migrations |
| `pnpm db:migrate` | Run pending migrations |
| `pnpm db:push` | Push schema directly (dev only) |
| `pnpm db:studio` | Open Drizzle Studio GUI |

### Filtering to a specific package

```bash
pnpm --filter @draftcrick/api dev      # API only
pnpm --filter @draftcrick/web build    # Build web only
pnpm --filter @draftcrick/mobile lint  # Lint mobile only
```

---

## 8. Troubleshooting

### `ECONNREFUSED` on database

PostgreSQL isn't running. Start it:
```bash
brew services start postgresql@15
```

### Metro bundler cache issues

```bash
pnpm --filter @draftcrick/mobile dev -- --clear
```

### Port already in use

```bash
# Find and kill the process on port 3001
lsof -ti:3001 | xargs kill -9
```

### pnpm install fails with hoisting errors

Make sure `.npmrc` has:
```
node-linker=hoisted
public-hoist-pattern[]=*copy-anything*
public-hoist-pattern[]=*superjson*
```

### Tamagui compilation errors

Tamagui requires the `node-linker=hoisted` setting. If you see resolution errors, delete `node_modules` and reinstall:
```bash
rm -rf node_modules apps/*/node_modules packages/*/node_modules
pnpm install
```

### Expo Go "Network request failed"

When running on a physical device, `localhost` won't work. Update your API base URL to your machine's LAN IP address (find it with `ifconfig` or `ipconfig`).
