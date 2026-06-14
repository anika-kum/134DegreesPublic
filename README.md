# 134 Degrees

Mobile app for San Francisco housing advocacy. Tracks affordable housing projects in the pre-approval pipeline, monitors state and federal housing bills, generates AI-personalized advocacy content (emails, tweets, call scripts), and sends SMS alerts when projects open for applications.

## Stack

- **Frontend**: React Native (Expo Router) — iOS & Android
- **Backend**: Node.js + Express + SQLite
- **AI**: Anthropic Claude (`claude-sonnet-4-6` for emails, `claude-haiku-4-5` for tweets/scripts/rep enrichment)
- **SMS**: Twilio
- **Scraping**: SF Planning Legistar API + Congress.gov API + OpenStates API

---

## Setup

### 1. Backend

```bash
cd backend
cp .env.example .env
# Required: ANTHROPIC_API_KEY, JWT_SECRET
# Optional SMS alerts: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER
# Optional bill scraping: CONGRESS_API_KEY (api.congress.gov/sign-up), OPENSTATES_API_KEY (openstates.org/accounts/signup)

npm install
node src/db/seed.js   # Seeds 6 real SF projects + 6 live resources
npm run dev           # Starts on :3001
```

### 2. Frontend

```bash
cd frontend
cp .env.example .env
# Set EXPO_PUBLIC_API_URL=http://YOUR_LOCAL_IP:3001/api
# (use your machine's LAN IP, not localhost, when testing on a physical device)

npm install
npx expo start        # Scan QR code with Expo Go
```

---

## Features

| Feature | Status |
|---|---|
| 4-step onboarding (account → district → background → context) | ✅ |
| JWT auth with persistent login | ✅ |
| SF Planning Legistar scraper | ✅ |
| Seeded SF project dataset (6 real projects) | ✅ |
| AI email drafting (3 tones) | ✅ |
| AI tweet generator | ✅ |
| AI call script generator | ✅ |
| One-tap "open in email app" | ✅ |
| "Who represents me" → Supervisor + state reps | ✅ |
| Coalition count ("47 advocates supporting") | ✅ |
| Project subscribe → SMS alert when opens | ✅ |
| Live shelter bed availability dashboard | ✅ |
| Rent relief + Section 8 resources | ✅ |
| District + type filters | ✅ |
| Housing bills feed (CA state + federal, filtered by housing relevance) | ✅ |
| Bill detail screen with AI advocacy panel + rep picker | ✅ |
| LLM enrichment: Claude assigns relevant reps to each bill | ✅ |
| Cron: scrape projects every 6h, legislation nightly at 2 AM, SMS alerts hourly | ✅ |
| User profile screen | ✅ |

---

## Data Sources

- **SF Planning Commission agendas**: `sfgov.legistar.com` (Granicus/Legistar API — well-structured, used by ~500 CA cities)
- **Congress.gov API**: federal housing bills (free key at api.congress.gov/sign-up)
- **OpenStates API**: California state housing bills (free key at openstates.org/accounts/signup)
- **Seeded data**: 6 real projects currently in SF's pipeline (Shotwell St, Balboa Reservoir, 490 S Van Ness, Treasure Island, Bayview Senior, 6th St SoMa)

---

## Project Structure

```
134-degrees/
├── backend/
│   └── src/
│       ├── db/          # SQLite schema + SF project seed data
│       ├── routes/      # auth, projects, resources, advocacy, bills
│       ├── services/    # scraper, claude, twilio, legislation, enrichment
│       └── index.js     # Express app + cron jobs
└── frontend/
    └── app/
        ├── (auth)/      # Welcome → onboard (4 steps) → login
        ├── (tabs)/      # Dashboard, Projects, Resources, Alerts, Profile
        ├── bill/        # Bill detail + AI advocacy panel
        └── project/     # Project detail + AI advocacy panel
```

---

## Hackathon Demo Path

1. Register → choose **District 9 (Mission)** → set housing status to "renter" → add a personal story
2. Dashboard shows your Supervisor (Trevor Chandler) + upcoming hearings
3. Tap **"490 South Van Ness"** → see hearing date and project details
4. Tap **Email** → tone **"Personal & Urgent"** → **Generate Email** → watch Claude personalize it with your story
5. Tap **"Open in Email App"** → pre-filled to the Supervisor's address
6. Switch to **Tweet** → one tap to post
7. Go to **Resources** → show live shelter beds + open Section 8 lottery
8. Subscribe to **Balboa Reservoir Phase 2** → get SMS alerts on project updates
9. Open the **Bills** feed → tap a California state bill → pick a rep and generate a call script targeted to that legislator
