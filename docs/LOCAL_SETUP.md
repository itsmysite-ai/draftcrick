# DraftPlay — Local Development Setup

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| **Node.js** | >= 22.0.0 | [nodejs.org](https://nodejs.org) or `nvm install 22` |
| **pnpm** | 9.15.4 | `corepack enable && corepack prepare pnpm@9.15.4 --activate` |
| **PostgreSQL** | >= 15 | `brew install postgresql@15` (macOS) or [postgresql.org](https://postgresql.org) or use GCP Cloud SQL |
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
git clone https://github.com/itsmysite-ai/draftplay.git
cd draftplay
pnpm install
```

---

## 2. Environment Variables

**Create `.env` file in the root directory:**

```bash
cp .env.example .env
```

Open `.env` and fill in the **required** values:

### Required for local dev

```env
# Database — either local PostgreSQL or GCP Cloud SQL
DATABASE_URL=postgresql://postgres:password@localhost:5432/draftplay
# OR for GCP Cloud SQL:
# DATABASE_URL=postgresql://postgres:password@YOUR_GCP_IP:5432/draftplay

# Redis (required for caching - see REDIS_CACHE_ARCHITECTURE.md)
REDIS_URL=redis://localhost:6379

# AI-powered sports data (get a key at https://aistudio.google.com/apikey)
GEMINI_API_KEY=<your-gemini-api-key>

# App
NODE_ENV=development
PORT=3001
WEB_URL=http://localhost:3000
MOBILE_URL=exp://localhost:8081
```

### Optional (feature-specific)

```env
# Firebase Auth (server-side — get from Firebase Console > Project Settings > Service Accounts)
FIREBASE_PROJECT_ID=<your-firebase-project-id>
FIREBASE_PRIVATE_KEY=<your-firebase-private-key>
FIREBASE_CLIENT_EMAIL=<your-firebase-client-email>

# Firebase Auth (client-side — get from Firebase Console > Project Settings > General > Web App)
FIREBASE_API_KEY=<your-firebase-api-key>
FIREBASE_AUTH_DOMAIN=<your-project>.firebaseapp.com
FIREBASE_STORAGE_BUCKET=<your-bucket>
FIREBASE_MESSAGING_SENDER_ID=<your-sender-id>
FIREBASE_APP_ID=<your-app-id>

# Payments
RAZORPAY_KEY_ID=<razorpay-key>
RAZORPAY_KEY_SECRET=<razorpay-secret>
STRIPE_SECRET_KEY=<stripe-key>
STRIPE_WEBHOOK_SECRET=<stripe-webhook-secret>

# Cricket Data APIs
CRICAPI_KEY=<cricapi-key>
SPORTRADAR_KEY=<sportradar-key>

# Email
RESEND_API_KEY=<resend-key>

# Error Tracking
SENTRY_DSN=<sentry-dsn>

# Google Cloud
GCP_PROJECT_ID=draftplay-prod
GCP_REGION=asia-south1
```

---

## 3. Database Setup

### Option A: Local PostgreSQL

```bash
# Start PostgreSQL (if not running)
brew services start postgresql@15   # macOS
# or: sudo systemctl start postgresql  # Linux

# Create the database
createdb draftplay

# Push the Drizzle schema to your local DB
pnpm db:push

# (Optional) Open Drizzle Studio to browse your data
pnpm db:studio
```

### Option B: GCP Cloud SQL (Production Database)

If you're using GCP Cloud SQL PostgreSQL:

```env
# Update .env with your GCP Cloud SQL IP
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@YOUR_GCP_IP:5432/draftplay
```

Then push the schema:
```bash
pnpm db:push
```

### Option C: Docker (Alternative)

```bash
docker run -d \
  --name draftplay-postgres \
  -e POSTGRES_DB=draftplay \
  -e POSTGRES_PASSWORD=password \
  -p 5432:5432 \
  postgres:15

docker run -d \
  --name draftplay-redis \
  -p 6379:6379 \
  redis:7-alpine
```

---

## 4. Start Redis

**Redis is REQUIRED for the app to work properly** (see [Redis Cache Architecture](./REDIS_CACHE_ARCHITECTURE.md) for details)

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
pnpm --filter @draftplay/api dev

# Web app only
pnpm --filter @draftplay/web dev

# Mobile app only
pnpm --filter @draftplay/mobile dev
```

### Mobile app on a device

1. Run `pnpm --filter @draftplay/mobile dev`
2. Scan the QR code with **Expo Go** (Android) or the Camera app (iOS)
3. Or press `a` for Android emulator / `i` for iOS simulator

> **Tip:** If the app can't connect to the API from your phone, make sure the tRPC base URL uses your machine's LAN IP (e.g., `http://192.168.1.100:3001`) instead of `localhost`.

---

## 6. Project Structure

```
draftplay/
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
├── docs/                        # Documentation
│   ├── LOCAL_SETUP.md          # This file
│   └── REDIS_CACHE_ARCHITECTURE.md  # Cache architecture
├── .env                         # Your environment variables (not in git)
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
pnpm --filter @draftplay/api dev      # API only
pnpm --filter @draftplay/web build    # Build web only
pnpm --filter @draftplay/mobile lint  # Lint mobile only
```

---

## 8. Verification & Testing

### Check API Health
```bash
curl http://localhost:3001/health
# Should return: {"status":"ok","timestamp":"..."}
```

### Check Redis Connection
```bash
redis-cli ping
# Should return: PONG
```

### Check Database Connection
```bash
# Test direct connection
psql $DATABASE_URL -c "SELECT 1"
# Or use node
node -e "const pg = require('postgres'); const sql = pg(process.env.DATABASE_URL); sql\`SELECT 1 as test\`.then(r => { console.log('✓ Database connected'); process.exit(0); }).catch(e => { console.error('✗ Database failed:', e.message); process.exit(1); });"
```

### View Cache Status
```bash
# Check what's cached in Redis
redis-cli KEYS "sports:*"
```

---

## 9. Troubleshooting

### Port Already in Use

```bash
# Kill process on port 3001 (API)
lsof -ti:3001 | xargs kill -9

# Kill process on port 3000 (Web)
lsof -ti:3000 | xargs kill -9

# Kill process on port 8081 (Mobile)
lsof -ti:8081 | xargs kill -9
```

### Database Connection Issues

**`ECONNREFUSED` error:**
- PostgreSQL isn't running: `brew services start postgresql@15`
- Check DATABASE_URL in `.env` is correct
- For GCP Cloud SQL, ensure your IP is allowlisted

**`DATABASE_URL not set` error:**
- Make sure `.env` file exists in root directory
- Verify `DATABASE_URL` is properly set
- Restart the dev server

### Redis Connection Issues

**Redis not running:**
```bash
brew services start redis           # macOS
sudo systemctl start redis          # Linux
```

**Check Redis status:**
```bash
brew services list | grep redis     # macOS
sudo systemctl status redis         # Linux
```

### API Returns 503 Errors

This usually means database connection failed:
1. Verify `.env` file exists
2. Check DATABASE_URL is accessible
3. Ensure Redis is running
4. Restart dev server: `pnpm dev`

### Metro Bundler Cache Issues

```bash
pnpm --filter @draftplay/mobile dev -- --clear
```

### pnpm Install Fails

Make sure `.npmrc` has:
```
node-linker=hoisted
public-hoist-pattern[]=*copy-anything*
public-hoist-pattern[]=*superjson*
```

### Tamagui Compilation Errors

Delete `node_modules` and reinstall:
```bash
rm -rf node_modules apps/*/node_modules packages/*/node_modules
pnpm install
```

### Expo Go "Network request failed"

When running on a physical device, `localhost` won't work. Find your LAN IP:
```bash
ipconfig getifaddr en0     # macOS
ipconfig                   # Windows
```

Update your tRPC URL in the mobile app to use your IP address.

---

## 10. Important Notes

### Redis is Required
The app uses Redis for caching Gemini API responses. Without Redis:
- ❌ App will fail to start
- ❌ Every request calls Gemini API (slow + expensive)

See [REDIS_CACHE_ARCHITECTURE.md](./REDIS_CACHE_ARCHITECTURE.md) for details on why Redis is essential for serverless deployment.

### Environment Variable Loading
- The app uses `dotenv` to load `.env` from the root directory
- Both API and DB packages are configured to load environment variables
- `turbo.json` is configured to pass environment variables to all packages

### Database Migrations
- Use `pnpm db:push` for development (direct schema sync)
- Use `pnpm db:migrate` for production (versioned migrations)
- Always backup before running migrations in production

---

## 11. Next Steps

1. ✅ Verify all services start: `pnpm dev`
2. ✅ Test API health: http://localhost:3001/health
3. ✅ Test Web app: http://localhost:3000
4. ✅ Test Mobile app: Scan QR code with Expo Go
5. ✅ Check cache: http://localhost:3001/trpc/sports.cacheStatus

---

## 📚 Additional Resources

- **Redis Cache Architecture**: [REDIS_CACHE_ARCHITECTURE.md](./REDIS_CACHE_ARCHITECTURE.md)
- **Database Management**: Run `pnpm db:studio` for GUI
- **API Documentation**: Check `/packages/api/src/routers/` for available endpoints
- **Tamagui UI**: Browse components in `/packages/ui/src/`

---

**Last Updated:** February 9, 2026  
**Status:** Production-ready for local development and serverless deployment
