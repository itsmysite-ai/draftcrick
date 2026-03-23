# DraftPlay — Production Launch Checklist

Everything that requires manual account setup, credentials, or external service configuration.

---

## 1. Apple Developer Account

- [ ] Enroll in Apple Developer Program ($99/yr) at developer.apple.com
- [ ] Create App ID: `com.draftplay.app`
- [ ] Create app in App Store Connect
- [ ] Copy **App Store Connect App ID** → replace `REPLACE_WITH_APP_STORE_CONNECT_APP_ID` in `apps/mobile/eas.json`
- [ ] Copy **Apple Team ID** → replace `REPLACE_WITH_APPLE_TEAM_ID` in `apps/mobile/eas.json`
- [ ] Set up App Store listing (screenshots, description, keywords, category: Sports)
- [ ] Age rating: 17+ (fantasy sports content)
- [ ] Configure Apple IAP products in App Store Connect:
  - `draftplay_basic_yearly` — ₹299/yr
  - `draftplay_pro_yearly` — ₹899/yr
  - `draftplay_elite_yearly` — ₹1,899/yr
  - `draftplay_daypass_24hr` — ₹79 (consumable)

## 2. Google Play Console

- [ ] Create developer account ($25 one-time)
- [ ] Create app: `com.draftplay.app`
- [ ] Generate upload keystore for Android signing
- [ ] Create `google-play-service-account.json` for EAS Submit
- [ ] Set up Play Store listing

## 3. RevenueCat Setup

- [ ] Create account at revenuecat.com (free tier: <$2.5K/mo revenue)
- [ ] Create project "DraftPlay"
- [ ] Connect Apple App Store (via App Store Connect shared secret)
- [ ] Add product IDs matching App Store Connect IAPs
- [ ] Create entitlements: `basic_access`, `pro_access`, `elite_access`
- [ ] Copy **Public API Key** → set `EXPO_PUBLIC_REVENUECAT_API_KEY`
- [ ] Set **Webhook Auth Key** → set `REVENUECAT_WEBHOOK_AUTH_KEY` on Cloud Run
- [ ] Configure webhook URL: `https://api.draftplay.ai/webhooks/revenuecat`

## 4. Sentry Setup

- [ ] Create account at sentry.io (free: 5K errors/month)
- [ ] Create project: "draftplay-api" (Node.js platform)
- [ ] Create project: "draftplay-mobile" (React Native platform)
- [ ] Copy API DSN → set `SENTRY_DSN` on Cloud Run
- [ ] Copy Mobile DSN → set `EXPO_PUBLIC_SENTRY_DSN` in EAS build env
- [ ] (Optional) Set up Sentry auth token for source map uploads

## 5. GCP — Cloud Run Deployment

### API Service

```bash
# Build and push Docker image
gcloud builds submit --tag gcr.io/YOUR_PROJECT/draftplay-api -f Dockerfile.api .

# Deploy to Cloud Run
gcloud run deploy draftplay-api \
  --image gcr.io/YOUR_PROJECT/draftplay-api \
  --region asia-south1 \
  --allow-unauthenticated \
  --min-instances 1 \
  --max-instances 10 \
  --memory 512Mi \
  --cpu 1 \
  --vpc-connector YOUR_VPC_CONNECTOR \
  --set-env-vars "NODE_ENV=production" \
  --set-env-vars "DATABASE_URL=YOUR_CLOUD_SQL_URL" \
  --set-env-vars "GEMINI_API_KEY=YOUR_KEY" \
  --set-env-vars "RAZORPAY_KEY_ID=YOUR_KEY" \
  --set-env-vars "RAZORPAY_KEY_SECRET=YOUR_SECRET" \
  --set-env-vars "REVENUECAT_WEBHOOK_AUTH_KEY=YOUR_KEY" \
  --set-env-vars "SENTRY_DSN=YOUR_DSN" \
  --set-env-vars "CORS_ORIGINS=https://admin.draftplay.ai,https://draftplay.ai" \
  --set-env-vars "FIREBASE_PROJECT_ID=YOUR_PROJECT" \
  --set-env-vars "FIREBASE_CLIENT_EMAIL=YOUR_SA_EMAIL" \
  --set-secrets "FIREBASE_PRIVATE_KEY=firebase-private-key:latest"
```

### Cloud SQL (Postgres)

- [ ] Create Cloud SQL instance in `asia-south1` (Mumbai)
- [ ] Enable private IP via VPC connector
- [ ] Run all migrations (0001 through 0014)
- [ ] Note connection string → `DATABASE_URL`

### VPC Connector

- [ ] Create Serverless VPC Connector in `asia-south1`
- [ ] Attach to Cloud Run service via `--vpc-connector`

## 6. Cloudflare DNS

- [ ] `api.draftplay.ai` → CNAME to Cloud Run URL (`draftplay-api-xxxxx.a.run.app`)
- [ ] `admin.draftplay.ai` → CNAME to web admin Cloud Run URL
- [ ] `draftplay.ai` → marketing site or redirect
- [ ] SSL mode: "Full (strict)"
- [ ] Enable "Always Use HTTPS"
- [ ] Disable Cloudflare proxy (orange cloud) for `api.` subdomain if using Cloud Run custom domains

## 7. Firebase

- [ ] Create production Firebase project (separate from `demo-draftplay`)
- [ ] Enable Email/Password + Phone auth providers
- [ ] Generate service account JSON for backend
- [ ] Set env vars: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`
- [ ] Download `google-services.json` (Android) for EAS build
- [ ] Download `GoogleService-Info.plist` (iOS) for EAS build

## 8. Legal Pages (Required by App Stores)

- [ ] Privacy Policy at `https://draftplay.ai/privacy`
- [ ] Terms of Service at `https://draftplay.ai/terms`
- [ ] Add URLs to App Store Connect + Google Play Console
- [ ] Ensure content covers: data collection, third-party services (Firebase, Sentry, RevenueCat), user rights, deletion process

## 9. EAS Build & Submit

```bash
cd apps/mobile

# Login to EAS
npx eas-cli login

# Configure (first time only)
npx eas-cli build:configure

# Install dependencies first
pnpm install

# Build for iOS (production)
npx eas-cli build --platform ios --profile production

# Build for Android (production)
npx eas-cli build --platform android --profile production

# Submit to App Store
npx eas-cli submit --platform ios

# Submit to Google Play
npx eas-cli submit --platform android
```

## 10. Environment Variables Summary

### Cloud Run (API Server)

| Variable | Source | Required |
|----------|--------|----------|
| `DATABASE_URL` | Cloud SQL connection string | Yes |
| `GEMINI_API_KEY` | GCP Vertex AI / AI Studio | Yes |
| `FIREBASE_PROJECT_ID` | Firebase Console | Yes |
| `FIREBASE_CLIENT_EMAIL` | Service account | Yes |
| `FIREBASE_PRIVATE_KEY` | Service account (Secret Manager) | Yes |
| `RAZORPAY_KEY_ID` | Razorpay Dashboard | Yes |
| `RAZORPAY_KEY_SECRET` | Razorpay Dashboard | Yes |
| `REVENUECAT_WEBHOOK_AUTH_KEY` | RevenueCat Dashboard | Yes (for iOS) |
| `SENTRY_DSN` | Sentry project settings | Recommended |
| `CORS_ORIGINS` | Your domains (comma-separated) | Yes |
| `NODE_ENV` | `production` | Yes |
| `PORT` | `8080` (Cloud Run default) | Auto |

### EAS Build (Mobile App)

| Variable | Source | Required |
|----------|--------|----------|
| `EXPO_PUBLIC_API_URL` | `https://api.draftplay.ai` | Yes |
| `EXPO_PUBLIC_SENTRY_DSN` | Sentry project settings | Recommended |
| `EXPO_PUBLIC_REVENUECAT_API_KEY` | RevenueCat Dashboard | Yes (for iOS) |
| `EXPO_PUBLIC_FIREBASE_API_KEY` | Firebase Console | Yes |
| `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase Console | Yes |
| `EXPO_PUBLIC_FIREBASE_PROJECT_ID` | Firebase Console | Yes |

---

## Pre-Launch Smoke Test

After deploying, verify each item:

1. [ ] `curl https://api.draftplay.ai/health` → `{"status":"ok"}`
2. [ ] Mobile app launches without crash (TestFlight / internal track)
3. [ ] Firebase auth (register + login) works
4. [ ] Subscription screen loads with correct INR pricing
5. [ ] Razorpay checkout opens on Android/web
6. [ ] Apple IAP sheet appears on iOS (TestFlight)
7. [ ] Push notification received on test device
8. [ ] Admin panel accessible at `https://admin.draftplay.ai`
9. [ ] Support user sees only Users tab
10. [ ] Sentry receives test error (throw one manually in dev tools)
11. [ ] RevenueCat webhook processes test event
