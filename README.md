# Говори!

A 1-minute impromptu speech game. You get a random topic and speak for 60 seconds. AI then gives you a mark, what went well, what to improve and tips.

- `mobile/`: Expo (SDK 57) app with expo-router and expo-audio
- `backend/`: ASP.NET Core (.NET 10) with PostgreSQL. A background worker transcribes each recording (OpenAI) and evaluates it (Claude).

## Run locally

```bash
# 1. Database (Docker Desktop must be running)
docker compose up -d

# 2. API on http://0.0.0.0:5080
cd backend/Govori.Api
dotnet run

# 3. App (in another terminal)
cd mobile
npx expo start -c      # scan the QR code with Expo Go
```

`mobile/.env` sets `EXPO_PUBLIC_API_URL` to this PC's LAN IP. Update it if your IP changes.
If the phone can't reach the API, allow port 5080 in Windows Firewall (run in an admin PowerShell):

```powershell
New-NetFirewallRule -DisplayName "Govori API" -Direction Inbound -Protocol TCP -LocalPort 5080 -Action Allow
```

## Real AI

Without keys, the backend uses mock transcription and mock feedback, so the whole flow still works.
To turn on the real AI, store the keys as user-secrets. They stay out of the repo:

```bash
cd backend/Govori.Api
dotnet user-secrets init
dotnet user-secrets set "OpenAI:ApiKey" "sk-..."
dotnet user-secrets set "Anthropic:ApiKey" "sk-ant-..."
```

Restart the API afterwards.

## Texts and content (in the database)

Everything the user reads can be changed in Postgres without releasing the app:

| Table | What it holds | When changes apply |
|---|---|---|
| `UiTexts` | Every app string (`Locale`, `Key`, `Value`), e.g. `home.hello` | Next app launch |
| `Categories` | Name, description, badge, `SortOrder`, `IsActive` | Within 10 min / next launch |
| `Topics` | Topic text, category, `IsActive` | Immediately |
| `AppSettings` | `evaluation.systemPrompt`, `transcription.prompt`, `fillers.single` / `fillers.phrases` (one per line), `errors.evaluationFailed` | Within 1 min |

Placeholders like `{n}` in texts are filled in by the app.
Seeding only **adds missing** rows. It never overwrites edits.
When you add a new string to `mobile/src/i18n/ru.ts`, run `npm run export-texts` in `mobile/`, then restart the API.

Connect with any Postgres client (DBeaver, pgAdmin, DataGrip): `localhost:5432`, database / user / password `govori`.

## Tests

```bash
cd backend && dotnet test
cd mobile && npx tsc --noEmit
```

## Before App Store release

- Apple Developer account. Set `Apple:BundleId` and `ios.bundleIdentifier` are `com.maksimsracins.govori`.
- Deploy the API over HTTPS (Azure App Service / Fly.io), use managed Postgres, and replace `LocalAudioStorage` with S3/R2/Blob.
- Production config: a strong `Jwt:Key`, `Auth:AllowDevLogin=false`, and EF migrations instead of `EnsureCreated`.
- Host a privacy policy page that names OpenAI and Anthropic as processors.
- `eas build -p ios --profile production`, then `eas submit -p ios`, then TestFlight, then review.
