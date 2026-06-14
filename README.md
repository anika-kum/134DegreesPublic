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

## Complete Technical Details

What It Does
SF Housing Advocate is a mobile app (React Native / Expo) with a Node.js backend that does four things:

Tracks housing projects in SF's pre-approval pipeline, scraped live from the SF Planning Commission's Legistar API and the DAHLIA affordable housing portal.
Monitors housing legislation — California state bills (via OpenStates) and federal bills (via Congress.gov) — filtered to those relevant to SF renters and low-income residents.
Generates personalized advocacy content — emails, tweets, and phone scripts — using Claude, keyed to your housing situation, personal story, and the specific official who has power over that decision.
Sends alerts when a project you follow opens for applications — currently over WhatsApp, with SMS as the intended channel once regulatory compliance is sorted (more on that below).
A typical flow: onboard in four steps (account → district → background → story), see urgent projects in your district, tap one that's three days from its comment deadline, generate a personal email addressed to your supervisor in the tone you choose, and open it directly in your mail app — pre-filled, ready to send.

How We Built It

Architecture: The backend is a single Express server with a SQLite database (the native node:sqlite module introduced in Node 22). Five cron jobs run in-process:

Every 6 hours: scrape SF Planning Commission (Legistar) + DAHLIA, then run enrichment
Nightly at 2 AM: pull legislation from Congress.gov and OpenStates, run enrichment, stamp last_updated
Hourly: check for newly opened housing applications and send WhatsApp alerts to subscribed users

The AI Layer
We use two Claude models — claude-sonnet-4-6 for emails (rich, long-form, highly personalized) and claude-haiku-4-5 for tweets, call scripts, and the enrichment pipeline (fast, cheap, short output).

The advocacy generation flow assembles a structured prompt from the user's full profile — housing status, tenure, income bracket, whether they have children, occupation, and most importantly their personal story — alongside the project or bill's details. The prompt varies by tone (emotional, data-driven, or formal) and by the specific representative being addressed. A supervisor who votes on local Planning Commission approvals gets a different ask than a federal senator who controls HUD appropriations.

The enrichment pipeline runs after every scrape. For projects, enrichment is rule-based: we know the district, so we deterministically assign the correct supervisor, mayor, state assembly member, state senator, and — for large or federally-funded projects — federal representatives. For bills, the connection to specific SF reps is less obvious from the title alone, so we hand that reasoning to Claude Haiku, asking it to return a JSON list of representative indices keyed to a numbered directory of all SF officials. This keeps costs predictable — at most 10 bills per cycle, only on records where llm_enriched_at IS NULL, and a content_hash column ensures re-enrichment only happens when a bill genuinely updates.

The Data Pipeline
Four external data sources feed the app, each with distinct schemas, authentication models, and reliability characteristics:

SF Planning Legistar — Granicus's public JSON API, used by ~500 CA cities. We fetch the 20 most recent Planning Commission meetings and their agenda items, filter by housing keywords, and infer the supervisorial district from neighborhood names and zip codes embedded in the title.
DAHLIA Housing Portal — SF's official MOHCD listing API. The most important source (it's the actual application pipeline), but field names are inconsistent (id vs. listingID vs. Id vary by endpoint version).
Congress.gov API — well-documented, but returns procedurally-mentioned bills that barely touch housing. We apply a title-level keyword filter after the API response to cut the noise.
OpenStates API — California state bills, cleanest schema. Runs in parallel with Congress.gov via Promise.allSettled so a rate limit on one never blocks the other.

Challenges

Twilio 10DLC Compliance
The core idea behind this app is SMS accessibility. Unhoused individuals — the people most urgently affected by housing decisions — often lack consistent internet access, smartphones with data plans, or installed apps. A plain SMS message when a project opens applications clears all of those barriers. You don't need the app. You don't need Wi-Fi. You just need a phone.

Twilio's solution for sending SMS at scale is called 10DLC (10-digit long code) — a carrier-mandated compliance framework requiring a registered brand, a registered campaign, and individual approval from AT&T, T-Mobile, and Verizon before any application-to-person SMS can be sent in the United States. The process requires a business EIN, a formal use-case description, and carrier review times that range from a few business days to several weeks.

This is entirely infeasible within a hackathon timeframe. Our workaround: WhatsApp. Twilio's WhatsApp API uses exactly the same SDK surface:


client.messages.create({
  from: `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`,
  to:   `whatsapp:${phone}`,
  body: `SF Housing Advocate: "${title}" is now accepting applications!`,
})
No 10DLC registration required, works immediately with a sandbox number. The limitation is real: WhatsApp requires an internet connection and a smartphone — it partially defeats the accessibility argument. The path forward in production is to complete 10DLC registration, swap the whatsapp: prefix for a bare phone number, and the rest of the system stays unchanged. We built it so that transition is a one-line config change.

Several Databases and APIs
Getting four external data sources to coexist in a single database was the most sustained engineering challenge of the build.

Schema heterogeneity. DAHLIA uses camelCase sometimes and PascalCase_With_Underscores elsewhere — the listing ID field alone has three names (id, listingID, Id) that vary by endpoint version. We built defensive coercion (const n = (v) => (v === undefined ? null : v ?? null)) to prevent node:sqlite's strict undefined-rejection from crashing the scraper on unexpected nulls. better-sqlite3 would have coerced these silently; the native module does not.

Choosing node:sqlite over better-sqlite3. Our initial instinct was better-sqlite3 — the standard choice, excellent docs. But Node 24 can't download native build headers in restricted environments, and better-sqlite3 requires native compilation. We pivoted to node:sqlite, the built-in synchronous SQLite module in Node 22+. Less documented, stricter about undefined, but zero compilation and no native dependencies. We lost time to the strictness bug before we understood the contract.

Concurrent scrapers, one database. The Legistar and DAHLIA scrapers run in parallel. Both write to the same projects table. SQLite's WAL mode handles concurrent readers fine, but two simultaneous writers serialize. In practice, INSERT OR IGNORE on the case_number UNIQUE constraint handles collisions gracefully. The bigger issue: both scrapers infer supervisorial district from different signals (neighborhood keywords for Legistar, zip codes for DAHLIA), and the zip-to-district map had a bug where listings without a recognized zip defaulted to District 6 regardless of actual location. We patched it with an update pass that re-districts existing rows when we detect the default was applied.

Congress.gov signal-to-noise. The full-text search returns bills that mention "housing" in a committee report buried in their legislative history — defense appropriations, tax credits, veteran benefits all showed up for "affordable housing." We applied a title-level keyword filter after the API response to keep only bills whose titles reference housing, rent, tenants, vouchers, homelessness, or related terms.

Safe migrations without dropping data. When we added relevant_reps, content_hash, and llm_enriched_at to the projects table mid-build, we couldn't drop and recreate it without losing the seeded SF project data. ALTER TABLE ... ADD COLUMN is the safe path in SQLite, but it throws if the column already exists. We wrapped each migration in a silent try-catch to make it idempotent across server restarts.

What We Learned
The technical depth of a problem is often proportional to how much the people affected by it are ignored by default. Housing advocacy infrastructure exists — public comment systems, Planning Commission agendas, supervisor contact forms — but it assumes a baseline of institutional knowledge and free time that most renters, and certainly most unhoused individuals, don't have.

Building the AI layer taught us how much the framing of a prompt matters for advocacy. An email addressed to a federal senator about a local planning project is useless. Correctly identifying what Scott Wiener can do versus what a district supervisor can do versus what a House member can do — and tailoring the specific ask to those powers — is the difference between mail that gets read and mail that gets filed.

The Twilio limitation was a useful lesson about the gap between "technically works" and "works for the people you're building for." WhatsApp is fine for a demo. It is not a long-term accessibility story.

The multi-API pipeline reinforced something we already suspected: public government data is under-documented, inconsistently structured, and optimized for agency-internal use rather than developer consumption. The Legistar API is the best of the four — well-structured, stable, used by hundreds of jurisdictions. DAHLIA is the most important but least predictable. Congress.gov has the broadest coverage but the noisiest results. Getting all four to behave like a single coherent dataset required more defensive code than we'd like — and more of our time.

The Notification Math
The hourly subscriber alert check uses a simple set-difference query. Let $S$ be the set of (user, project) subscription pairs, and let $A$ be the set of pairs for which an alert has already been sent. The check fires for all pairs in $S \setminus A$ where the project's application_open_date is on or before today:

$$\text{notify} = \bigl{(u, p) \in S ;\big|; \text{open_date}(p) \leq \text{today} ;\wedge; (u, p) \notin A\bigr}$$

Implemented directly in SQL:


SELECT s.user_id, s.project_id, p.title
FROM subscriptions s
JOIN projects p ON p.id = s.project_id
WHERE p.application_open_date IS NOT NULL
  AND date(p.application_open_date) <= date('now')
  AND NOT EXISTS (
    SELECT 1 FROM alerts a
    WHERE a.user_id = s.user_id AND a.project_id = s.project_id
  )
The NOT EXISTS guard is the idempotency key: no matter how many times the cron runs, each (user, project) pair generates exactly one alert.
