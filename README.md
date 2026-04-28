# Insighta Labs — Backend API

The single source of truth for the Insighta Labs+ platform. All interfaces (CLI and Web Portal) communicate exclusively through this API.

---

## System Architecture
┌─────────────────┐     ┌─────────────────┐
│   insighta-cli  │     │  insighta-web   │
│  (CLI Tool)     │     │  (Web Portal)   │
└────────┬────────┘     └────────┬────────┘
│                       │
└──────────┬────────────┘
│
┌──────────▼────────────┐
│    insighta-api       │
│    (Express + Prisma) │
└──────────┬────────────┘
│
┌──────────▼────────────┐
│     PostgreSQL        │
│     (Neon)            │
└───────────────────────┘

---

## Tech Stack

- Node.js + TypeScript
- Express.js
- Prisma ORM
- PostgreSQL (Neon)
- JWT (access + refresh tokens)
- GitHub OAuth 2.0 with PKCE
- Deployed on Vercel

---

## Authentication Flow

### Web Flow
1. User visits `/auth/github`
2. Backend redirects to GitHub OAuth
3. GitHub redirects to `/auth/github/callback`
4. Backend exchanges code for GitHub access token
5. Backend fetches user info from GitHub
6. Backend creates/updates user in database
7. Backend issues access token (60min) + refresh token (5min)
8. Tokens set as HTTP-only cookies
9. User redirected to frontend dashboard

### CLI Flow
1. CLI generates `state` + PKCE `code_verifier` and `code_challenge`
2. CLI starts local server on port 9876
3. CLI opens GitHub OAuth URL in browser with `?cli=true`
4. GitHub redirects to `http://localhost:9876/callback`
5. CLI captures code, sends to `/auth/github/callback?cli=true`
6. Backend skips state validation for CLI flow
7. Backend returns tokens as JSON
8. CLI stores tokens at `~/.insighta/credentials.json`

---

## Token Handling

| Token | Expiry | Storage |
|---|---|---|
| Access Token | 60 minutes | HTTP-only cookie (web) / credentials.json (CLI) |
| Refresh Token | 5 minutes | HTTP-only cookie (web) / credentials.json (CLI) |

- Refresh tokens are stored in the database and invalidated on use (rotation)
- Each refresh issues a completely new token pair
- Old refresh token is immediately deleted after rotation

---

## Role Enforcement

| Role | Permissions |
|---|---|
| `analyst` | Read-only: GET /api/profiles, GET /api/profiles/search, GET /api/profiles/export |
| `admin` | Full access: all analyst permissions + POST /api/profiles |

- Default role on signup: `analyst`
- Role is embedded in the JWT access token
- Every protected route runs `requireAuth` middleware first
- Admin routes additionally run `requireRole("admin")`
- Disabled users (`is_active: false`) receive 403 on all requests

---

## API Versioning

All `/api/*` requests must include:
X-API-Version: 1
Missing or wrong version returns `400 Bad Request`.

---

## Natural Language Parsing

The `/api/profiles/search?q=` endpoint uses a rule-based parser with no AI or LLMs:

1. **Gender** — matches keywords: male, males, man, men, female, females, woman, women
2. **Age groups** — matches: child, teenager, teen, adult, senior, elderly
3. **"young"** — special keyword mapping to `min_age=16, max_age=24`
4. **Numeric patterns** — detects: above X, over X, below X, under X, between X and Y
5. **Countries** — longest-match scan against ~80 country name → ISO code mappings
6. **Fallback** — unrecognized queries return `Unable to interpret query`

---

## Endpoints

### Auth
| Method | Endpoint | Description |
|---|---|---|
| GET | /auth/github | Redirect to GitHub OAuth |
| GET | /auth/github/callback | Handle OAuth callback |
| POST | /auth/refresh | Rotate refresh token |
| POST | /auth/logout | Invalidate refresh token |
| GET | /auth/me | Get current user |

### Profiles
| Method | Endpoint | Auth | Role |
|---|---|---|---|
| GET | /api/profiles | ✅ | analyst+ |
| GET | /api/profiles/search | ✅ | analyst+ |
| GET | /api/profiles/export | ✅ | analyst+ |
| GET | /api/profiles/:id | ✅ | analyst+ |
| POST | /api/profiles | ✅ | admin only |

---

## Rate Limiting

| Scope | Limit |
|---|---|
| `/auth/*` | 10 requests/minute |
| All other endpoints | 60 requests/minute per user |

---

## Setup

```bash
npm install
cp .env.example .env
# fill in .env
npx prisma db push
npx prisma generate
npm run db:seed
npm run dev
```

---

## Environment Variables

```env
DATABASE_URL=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_CALLBACK_URL=
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
FRONTEND_URL=
NODE_ENV=
PORT=
```

---

## Live URL

https://insighta-api.vercel.app