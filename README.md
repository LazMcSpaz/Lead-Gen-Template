# Emerald Lead Co. — Site Template

**Owner:** Emerald Lead Co. LLC  
**Consumer brand:** Eugene Home Connect (adapts to each market)  
**Purpose:** Reusable lead generation site template for local contractor markets  
**Status:** Template under construction — not a live site

---

## What This Repository Is

This is a **parameterized site template**, not a website. It produces websites.

The distinction matters. Every file in `/src` contains placeholders like `{{CITY}}`, `{{TRADE}}`, and `{{PHONE}}` instead of real values. A build script reads a single config file — `config/market.json` — and outputs a complete, fully populated, deployment-ready site into `/dist`.

When it is time to launch in a new city, the process is:

1. Copy `config/market.example.json` to `config/market.json`
2. Fill in the city, trade, phone number, and API keys
3. Run `node scripts/build.js`
4. Push `/dist` to a new GitHub repository
5. Connect that repository to a new Netlify site
6. Point a domain at it

That is the entire deployment. Every page, every schema block, every email template, every meta tag populates automatically from the config. No manual editing of any page file.

---

## Business Context

### The Model

Emerald Lead Co. operates locally-branded contractor matching sites under the consumer name `[City] Home Connect`. Homeowners submit service requests through a scored intake form. Each submission is automatically graded Hot, Warm, or Cool based on intent signals. That scored lead — enriched with property data and an AI-generated contractor briefing — is delivered to paying local contractors.

Contractors pay per lead. No subscription, no annual contract, no shared risk. The business earns the margin between what contractors pay and what it costs to generate the lead.

### Revenue Structure

| Tier | Description | Price Range |
|------|-------------|-------------|
| Standard Shared | Delivered to up to 3 buyers simultaneously | $20–$95/lead |
| Exclusive Per-Lead | Delivered to one buyer only | $40–$190/lead |
| Exclusive Retainer | One buyer locks a niche monthly | $300–$700/month + per-lead |

### The AI Enrichment Advantage

Every lead submission triggers a serverless function that:
1. Pulls public property data on the homeowner's address (home age, estimated value, permit history) via the ATTOM Data API
2. Sends that data plus the form answers to the Claude API
3. Receives a 3-sentence contractor briefing — what the property suggests about scope, what the homeowner's answers suggest about readiness, and one specific thing to say on the call

The contractor receives this briefing alongside the standard lead data. No national platform does this. It is the primary product differentiator and costs approximately $0.11 per lead to run.

### Scaling Philosophy

Each market deployment is an **independent GitHub repository and Netlify site**. Not a subdomain. Not a subfolder. A fully separate site.

This is intentional:

- **SEO:** Topically focused single-trade sites rank faster and better than multi-trade portals
- **Isolation:** A problem on one site does not affect others
- **Transferability:** Individual markets can be sold without disrupting the rest of the portfolio
- **Simplicity:** Each site is self-contained and independently manageable

The template is designed to make spinning up a new independent site take less than an afternoon.

---

## Repository Structure

```
emerald-template/
│
├── config/
│   ├── market.example.json     # Template config — copy this for each deployment
│   └── market.json             # Active config — gitignored, never committed
│
├── src/
│   ├── pages/                  # HTML templates with {{placeholders}}
│   │   ├── index.html          # Homepage
│   │   ├── contact.html        # Lead capture form — primary conversion page
│   │   ├── how-it-works.html   # Explains the matching model to homeowners
│   │   ├── faq.html            # FAQ with FAQ schema markup
│   │   ├── privacy.html        # Required for Netlify Forms and GBP
│   │   ├── terms.html          # Terms of service
│   │   ├── services/           # Service-specific landing pages
│   │   │   ├── service-1.html  # e.g. panel-upgrade.html
│   │   │   ├── service-2.html
│   │   │   └── service-3.html
│   │   ├── locations/          # Geographic expansion pages
│   │   │   └── location.html   # Template for surrounding areas
│   │   └── blog/
│   │       ├── index.html      # Blog post listing
│   │       ├── post-1.html     # Parameterized post template
│   │       ├── post-2.html
│   │       └── post-3.html
│   │
│   ├── css/
│   │   └── style.css           # Complete design system — city-agnostic
│   │
│   ├── js/
│   │   ├── form-scoring.js     # Temperature calculation logic — city-agnostic
│   │   └── form-submit.js      # Submission handler + enrichment trigger
│   │
│   └── schema/
│       └── templates.js        # JSON-LD schema generators — read from config
│
├── netlify/
│   └── functions/
│       └── enrich-lead.js      # Serverless enrichment function
│                               # Calls ATTOM API + Claude API + triggers EmailJS
│
├── scripts/
│   └── build.js                # Core build script — reads config, outputs /dist
│
├── templates/
│   ├── buyer-agreement.md      # Lead buyer contract template
│   ├── media-kit.md            # One-page buyer pitch document
│   ├── emailjs-buyer.html      # EmailJS buyer notification template
│   └── emailjs-confirm.html    # EmailJS homeowner confirmation template
│
├── dist/                       # Build output — gitignored, never committed
│
├── .env.example                # API key placeholders — copy to .env
├── .env                        # Actual API keys — gitignored, never committed
├── netlify.toml                # Netlify build and function configuration
├── sitemap-template.xml        # Sitemap template — populated by build script
├── robots.txt                  # Static — same for every deployment
└── README.md                   # This file
```

---

## The Config File

`config/market.example.json` is the single source of truth for every market-specific value. Every placeholder in every template file resolves to a value from this config.

```json
{
  "market": {
    "city": "Eugene",
    "citySlug": "eugene",
    "state": "Oregon",
    "stateAbbr": "OR",
    "county": "Lane County",
    "areaCode": "541",
    "surroundingAreas": ["Springfield", "Cottage Grove", "Junction City", "Veneta"]
  },

  "trade": {
    "name": "electrician",
    "nameDisplay": "Electrician",
    "namePlural": "electricians",
    "services": [
      "Panel Upgrade",
      "EV Charger Installation",
      "Electrical Repair",
      "Whole-Home Rewiring",
      "Generator Hookup"
    ],
    "primaryKeyword": "electrician Eugene OR",
    "emergencyUrgency": true
  },

  "brand": {
    "consumerName": "Eugene Home Connect",
    "consumerDomain": "eugenehomeconnect.com",
    "entityName": "Emerald Lead Co. LLC",
    "phone": "541-000-0000",
    "email": "contact@eugenehomeconnect.com",
    "address": "Eugene, OR"
  },

  "seo": {
    "titleSuffix": "Eugene, OR",
    "metaDescription": "Free local {{TRADE}} matching service for Eugene homeowners. Tell us what you need — we'll connect you with a vetted local pro within the hour.",
    "gmbCategory": "Marketing Agency"
  },

  "integrations": {
    "ga4MeasurementId": "G-XXXXXXXXXX",
    "gscVerificationTag": "your-verification-content",
    "emailjsServiceId": "service_xxxxxxx",
    "emailjsPublicKey": "your_public_key",
    "emailjsBuyerTemplateId": "template_buyer",
    "emailjsConfirmTemplateId": "template_confirm",
    "netlifyFormName": "eugene-electrician-leads"
  },

  "api": {
    "attomApiKey": "ATTOM_KEY_HERE",
    "melissaApiKey": "MELISSA_KEY_HERE",
    "claudeModel": "claude-sonnet-4-20250514"
  },

  "pricing": {
    "sharedCool": 22,
    "sharedWarm": 35,
    "sharedHot": 52,
    "exclusiveCool": 45,
    "exclusiveWarm": 72,
    "exclusiveHot": 105
  }
}
```

**Rule:** If a value might differ between markets, it lives in the config. If it is the same in every market, it lives in the source file directly.

---

## The Build Script

`scripts/build.js` does one thing: reads `config/market.json`, walks every file in `/src`, replaces every `{{PLACEHOLDER}}` with its config value, and writes the result to `/dist`.

```bash
node scripts/build.js
```

`/dist` is your deployable site. Push its contents to a new GitHub repository and connect to Netlify.

The build script also:
- Generates `sitemap.xml` from the config and page list
- Injects schema markup into each page from the schema templates
- Validates that all required config fields are populated before building
- Logs a deployment checklist at the end with next steps

---

## The AI Enrichment System

### How It Works

When a homeowner submits the intake form:

1. `form-submit.js` intercepts the submission client-side
2. It calls `/.netlify/functions/enrich-lead` with the form data
3. The function calls the ATTOM Data API with the homeowner's address
4. The function calls the Claude API with the property data + form answers
5. Claude returns a 3-sentence contractor briefing
6. The function assembles the enriched lead payload and triggers EmailJS
7. The buyer receives a formatted notification with the standard lead data, property profile, and contractor briefing
8. The homeowner receives the standard confirmation email
9. The form submission is captured by Netlify Forms as the source of record

### The Contractor Briefing Prompt

The Claude API prompt is stored in `netlify/functions/enrich-lead.js`. It is parameterized — trade and service type come from the config, address and form answers come from the submission. The prompt is designed to output exactly 3 sentences in a consistent structure:

1. What the property profile suggests about the likely scope of work
2. What the homeowner's form answers suggest about their readiness and budget
3. One specific thing the contractor should mention or ask on the call

This prompt should be treated as a product decision, not just a technical detail. Improving it over time improves the quality of every lead delivery across every market.

### Cost Per Lead

| Component | Cost |
|-----------|------|
| ATTOM property lookup | ~$0.10 |
| Claude API enrichment call | ~$0.01 |
| EmailJS send | ~$0.00 |
| **Total** | **~$0.11** |

At 50 leads/month across three sites the enrichment cost is approximately $5.50/month.

### Fallback Behavior

If the ATTOM lookup returns no data for an address (rural property, new construction, PO box), the function degrades gracefully — it sends the standard lead notification without the property profile section. The contractor briefing in that case is generated from form answers alone. The homeowner confirmation is unaffected.

---

## Lead Temperature Scoring

The scoring system runs entirely client-side in `js/form-scoring.js`. No server required.

### Source Signal (automatic, set by page metadata)

| Traffic Source | Points |
|----------------|--------|
| Direct phone call | +3 |
| Service-specific page form | +2 |
| Blog post form | +1 |
| Homepage or generic page form | +1 |
| Informational page form | 0 |

### Qualifier Questions

| Question | Hot (+2) | Warm (+1) | Cool (0) |
|----------|----------|-----------|----------|
| What do you need help with? | Emergency / urgent | Scheduled service | Just getting a quote |
| How soon do you need this? | Within 24–48 hours | Within the week | Next month or unsure |
| Is this your property? | Yes, I own it | I manage it | I rent it |
| Have you reached out to others? | No, first call | Comparing a few | Shopping broadly |

### Temperature Assignment

| Total Points | Temperature | Buyer Label |
|-------------|-------------|-------------|
| 7–10 | 🔥 Hot | Priority Lead — High Intent |
| 4–6 | 🌡️ Warm | Standard Lead — Active Shopper |
| 0–3 | 🧊 Cool | Research Lead — Early Stage |

The temperature score is injected as a hidden form field before submission so it appears in the Netlify Forms dashboard and in the EmailJS notification without any server-side processing.

---

## What Is Built vs What Is Deployment-Time

### Built in This Repository (location-independent)

- Complete design system and CSS
- All HTML page templates with `{{placeholders}}`
- JavaScript form scoring logic
- Form submission handler
- AI enrichment serverless function
- EmailJS notification templates
- Schema markup generator
- Build script
- Blog post template structures
- Netlify function infrastructure
- `market.example.json` config template
- `.env.example` API key template
- Buyer agreement template
- Media kit copy template
- Deployment checklist (generated by build script)

### Completed at Deployment Time

- `config/market.json` — fill in city, trade, phone, integration IDs
- `.env` — fill in API keys
- Domain purchase (Namecheap)
- Tracking phone number (OpenPhone or CallRail)
- EmailJS service and template configuration
- Google Analytics property creation
- Google Search Console verification
- Netlify site creation and domain connection
- Google Business Profile registration
- Citation builder engagement
- Local blog post content (generated from templates using Claude with local facts)
- Contractor target list research
- Chamber of Commerce membership

---

## Deployment Checklist

This checklist is also generated at build time by `scripts/build.js` with market-specific values pre-filled. The version here is the master template.

### Pre-Deployment (before touching Netlify)

- [ ] `config/market.json` populated — all fields complete, no placeholders remaining
- [ ] `.env` populated — all API keys present
- [ ] `node scripts/build.js` runs without errors
- [ ] Build output in `/dist` looks correct — open `dist/index.html` in a browser
- [ ] Form scoring tested locally — submit test lead, verify temperature calculates correctly
- [ ] Domain purchased (Namecheap)
- [ ] Tracking phone number acquired (OpenPhone — 541 area code or local to market)

### Netlify Setup

- [ ] New GitHub repository created for this market (e.g. `chattanooga-electrician`)
- [ ] `/dist` contents pushed to the new repository
- [ ] Netlify site created — Import from Git — connect to the new repository
- [ ] Custom domain connected in Netlify — Domain settings → Add custom domain
- [ ] Namecheap nameservers updated to Netlify values
- [ ] SSL certificate active (automatic — wait up to 10 minutes)
- [ ] Netlify Forms enabled — verify form tag has `netlify` attribute
- [ ] Netlify email notification configured — Site settings → Forms → Notifications
- [ ] Netlify environment variables set — copy from `.env`: `ATTOM_API_KEY`, `CLAUDE_API_KEY`, `EMAILJS_SERVICE_ID`, `EMAILJS_PRIVATE_KEY`
- [ ] Netlify Functions deployed — verify `enrich-lead` appears in Functions dashboard

### Verification

- [ ] Submit a test lead through the live form
- [ ] Confirm temperature score is correct
- [ ] Confirm confirmation page appears immediately
- [ ] Confirm Netlify Forms dashboard shows the submission
- [ ] Confirm buyer notification email arrives within 60 seconds
- [ ] Confirm enrichment data appears in the notification (property profile + contractor briefing)
- [ ] Confirm homeowner confirmation email arrives
- [ ] Confirm test call to tracking number is recorded

### Post-Deployment

- [ ] Google Analytics property created — GA4 measurement ID added to config and rebuilt
- [ ] Google Search Console property verified — HTML tag method
- [ ] Sitemap submitted in Google Search Console
- [ ] Bing Webmaster Tools verified and sitemap submitted
- [ ] Google Business Profile verification initiated (Service Area Business — local address)
- [ ] Citation builder hired (Fiverr/Upwork — $50–$100)
- [ ] Three locally adapted blog posts generated and published
- [ ] Contractor target list built (15–20 contacts per trade)
- [ ] Cold outreach begun

---

## New Market Launch — Step by Step

```bash
# 1. Clone the template
git clone https://github.com/your-username/emerald-template.git
cd emerald-template

# 2. Create market config
cp config/market.example.json config/market.json

# 3. Edit config/market.json
# Fill in city, state, county, trade, phone, integration IDs

# 4. Create environment file
cp .env.example .env

# 5. Edit .env
# Fill in API keys

# 6. Build
node scripts/build.js

# 7. Create new repo for this market and push /dist
cd dist
git init
git add .
git commit -m "Initial deployment — [City] [Trade]"
git remote add origin https://github.com/your-username/[city]-[trade].git
git push -u origin main

# 8. Connect to Netlify and follow deployment checklist above
```

Each new market is a new repository. The template repository is never deployed directly — it only produces deployments.

---

## Working With Claude Code

This project is designed to be built and maintained primarily through Claude Code sessions. The README is the primary context document — start every session by referencing it.

### Starting a New Session

Paste this at the start of any Claude Code session working on this project:

> "I am building a parameterized lead generation site template for Emerald Lead Co., a local contractor matching business. The full context is in README.md in the project root. Please read it before we start. Today's session goal is: [describe what you want to build or fix]."

### Session Discipline

Each session should have one clearly defined deliverable. Suggested session sequence for the initial build:

| Session | Deliverable |
|---------|-------------|
| 1 | Project scaffolding, `market.example.json`, `build.js` core logic |
| 2 | `style.css` complete design system |
| 3 | All HTML page templates — index, contact, how-it-works, FAQ, privacy, terms |
| 4 | `form-scoring.js` — complete temperature scoring with all edge cases |
| 5 | `form-submit.js` — submission handler and enrichment trigger |
| 6 | `enrich-lead.js` — serverless function, ATTOM integration, Claude API call |
| 7 | EmailJS templates — buyer notification and homeowner confirmation |
| 8 | Schema markup templates and generator |
| 9 | Service page template and location page template |
| 10 | Blog post templates (3) and blog index |
| 11 | Build script completion — sitemap generation, schema injection, validation |
| 12 | End-to-end test — build, deploy to Netlify test site, submit test lead, verify full flow |

### Improving the Template

When you improve something — a better form layout, a stronger confirmation page, an improved enrichment prompt — improve it in the **template** (`/src`), not in a deployed site. Then rebuild and redeploy affected markets. This ensures every market benefits from every improvement automatically.

### The Enrichment Prompt

The Claude API prompt in `enrich-lead.js` is the highest-leverage piece of copy in the entire system. It directly determines the quality of the contractor briefing on every lead delivery. Treat iterations to this prompt the same way you would treat A/B testing a sales page — make one change at a time, observe the output quality, keep what works.

---

## API Keys Required

| Key | Service | Where to Get | Approx. Cost |
|-----|---------|-------------|-------------|
| `ATTOM_API_KEY` | Property data lookup | developer.attomdata.com | ~$0.10/call |
| `CLAUDE_API_KEY` | Lead enrichment briefing | console.anthropic.com | ~$0.01/call |
| `EMAILJS_SERVICE_ID` | Transactional email sending | emailjs.com | Free (200/mo) |
| `EMAILJS_PRIVATE_KEY` | EmailJS authentication | emailjs.com | Free |

These keys are set as Netlify environment variables per deployment. They are never committed to any repository. `.env` is gitignored globally.

**Alternative for property data:** Melissa Data (melissa.com) offers 1,000 free lookups/month. Sufficient for the first 12+ months of operation. Swap by updating the API call in `enrich-lead.js` — the config and build system are unaffected.

---

## Design System

The CSS in `style.css` uses CSS custom properties for all brand values. Changing the color system for a new market (if ever needed) is a single-line edit in the `:root` block.

```css
:root {
  --color-primary: #00703C;      /* Emerald — CTAs, headings, accents */
  --color-secondary: #1F4E79;    /* Deep Navy — secondary elements */
  --color-background: #F7F5F2;   /* Warm White — page backgrounds */
  --color-surface: #E6F4ED;      /* Light Emerald — cards, form areas */
  --color-text: #1A1A1A;         /* Near Black — body text */
  --color-text-muted: #555555;   /* Medium Gray — supporting text */
  --font-primary: 'Inter', sans-serif;
  --radius-base: 8px;
  --shadow-card: 0 2px 12px rgba(0,0,0,0.08);
}
```

All component styles reference these variables. The design system is the same in every deployment — consistent, professional, zero design decisions required at deployment time.

---

## Revenue Context

These numbers inform pricing decisions embedded in `market.example.json`.

**Benchmarked against national platforms (Angi, Thumbtack, Google LSA):**
- Angi shared leads: $15–$85 per lead, delivered to 3–8 contractors simultaneously, annual contract required
- Our shared leads: $20–$95 per lead, delivered to maximum 3 contractors, no contract, AI-enriched

**Steady-state target per market (3 sites, Month 5+):**
- 35–50 leads/month total
- $1,830–$2,640/month gross
- Operating cost: ~$400–$550/month
- Net: ~$1,300–$2,100/month per market

**Per-market deployment cost:**
- Domains: $30–$900 (fresh vs aged)
- Citation builder: $150–$300 one-time
- Monthly overhead: $400–$550
- 6-month total investment per market: ~$3,000–$5,500

---

## What This Is Not

- **Not a WordPress site.** No plugins, no database, no CMS, no security patch maintenance.
- **Not a React app.** No build pipeline complexity, no dependency rot, no framework lock-in.
- **Not a SaaS platform.** Each market is an independent static site. Simplicity is the point.
- **Not a shared multi-market domain.** Each site is independent for SEO, transferability, and isolation.

The stack is minimal by design. Static HTML on Netlify free tier, a single serverless function for enrichment, and three third-party services (ATTOM, Claude API, EmailJS). Every tool was chosen because Claude Code can write and maintain it natively, and because it costs nothing or nearly nothing to operate.

---

## License

Private — Emerald Lead Co. LLC. Not for distribution.
