# Insighta Labs — Intelligence Query Engine

A production-grade queryable API for demographic profile data, built for Insighta Labs.

---

## Tech Stack

- **Runtime**: Node.js
- **Language**: TypeScript
- **Framework**: Express.js
- **ORM**: Prisma
- **Database**: PostgreSQL (online)
- **UUID**: UUIDv7 (`uuidv7` package)

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env` and fill in your PostgreSQL connection string:

```bash
cp .env.example .env
```

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require"
PORT=3000
```

### 3. Push schema to database

```bash
npm run db:push
```

### 4. Seed the database

Place the `profiles.json` file inside `prisma/data/`:

```
prisma/
  data/
    profiles.json   ← your seed file here
```

Then run:

```bash
npm run db:seed
```

Re-running seed is safe — it uses `upsert` on `name` (unique), so no duplicates are created.

### 5. Start the server

```bash
# Development (hot reload)
npm run dev

# Production
npm run build && npm start
```

---

## API Reference

### Base URL

```
http://localhost:3000
```

---

### GET `/api/profiles`

Advanced filtering with sorting and pagination.

#### Query Parameters

| Parameter               | Type    | Description                                      |
|------------------------|---------|--------------------------------------------------|
| `gender`               | string  | `male` or `female`                               |
| `age_group`            | string  | `child`, `teenager`, `adult`, `senior`           |
| `country_id`           | string  | ISO 2-letter code (e.g. `NG`, `KE`)              |
| `min_age`              | integer | Minimum age (inclusive)                          |
| `max_age`              | integer | Maximum age (inclusive)                          |
| `min_gender_probability` | float | Minimum gender confidence (0–1)                 |
| `min_country_probability` | float | Minimum country confidence (0–1)               |
| `sort_by`              | string  | `age`, `created_at`, `gender_probability`        |
| `order`                | string  | `asc` or `desc` (default: `asc`)                 |
| `page`                 | integer | Page number (default: `1`)                       |
| `limit`                | integer | Results per page (default: `10`, max: `50`)      |

#### Example Requests

```
GET /api/profiles?gender=male&country_id=NG&min_age=25
GET /api/profiles?age_group=adult&sort_by=age&order=desc&page=2&limit=20
GET /api/profiles?gender=female&min_gender_probability=0.8
```

#### Response

```json
{
  "status": "success",
  "page": 1,
  "limit": 10,
  "total": 423,
  "data": [
    {
      "id": "01938f3e-...",
      "name": "John Doe",
      "gender": "male",
      "gender_probability": 0.95,
      "age": 28,
      "age_group": "adult",
      "country_id": "NG",
      "country_name": "Nigeria",
      "country_probability": 0.87,
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

---

### GET `/api/profiles/search`

Natural language query endpoint. Rule-based parsing only — no AI or LLMs.

#### Query Parameters

| Parameter | Type    | Description                          |
|-----------|---------|--------------------------------------|
| `q`       | string  | Plain English query (required)       |
| `page`    | integer | Page number (default: `1`)           |
| `limit`   | integer | Results per page (default: `10`)     |

#### Example Requests

```
GET /api/profiles/search?q=young males from nigeria
GET /api/profiles/search?q=females above 30
GET /api/profiles/search?q=adult males from kenya
GET /api/profiles/search?q=male and female teenagers above 17
GET /api/profiles/search?q=people from angola
```

#### Supported Query Patterns

| Query Pattern                        | Parsed As                                  |
|--------------------------------------|--------------------------------------------|
| `young males`                        | gender=male, min_age=16, max_age=24         |
| `females above 30`                   | gender=female, min_age=30                  |
| `people from angola`                 | country_id=AO                              |
| `adult males from kenya`             | gender=male, age_group=adult, country_id=KE|
| `male and female teenagers above 17` | age_group=teenager, min_age=17             |
| `seniors from nigeria`               | age_group=senior, country_id=NG            |
| `children under 10`                  | age_group=child, max_age=10                |
| `women between 25 and 40`            | gender=female, min_age=25, max_age=40      |

#### Unrecognized Query Response

```json
{
  "status": "error",
  "message": "Unable to interpret query"
}
```

---

## Error Responses

All errors follow a consistent structure:

```json
{ "status": "error", "message": "<description>" }
```

| HTTP Status | When                                      |
|-------------|-------------------------------------------|
| `400`       | Missing or empty required parameter       |
| `422`       | Invalid parameter type or value           |
| `404`       | Profile not found                         |
| `500`       | Internal server error                     |

---

## Natural Language Parser Design

The NLP system in `src/services/queryParser.ts` is entirely rule-based:

1. **Tokenization** — lowercases and trims the query string
2. **Gender detection** — matches keywords: `male`, `males`, `man`, `men`, `female`, `females`, `woman`, `women`, etc.
3. **Age group detection** — matches: `child`, `children`, `teenager`, `teen`, `adult`, `senior`, `elderly`, etc.
4. **Special keyword** — `young` maps to `min_age=16, max_age=24` (not a stored age_group)
5. **Numeric age patterns** — detects `above X`, `over X`, `below X`, `under X`, `between X and Y`, `aged X`
6. **Country detection** — longest-match scan against a ~80-entry country name → ISO code map covering African nations and common world countries
7. **Fallback** — if no recognized token is found, returns `null` → `Unable to interpret query`

---

## Database Schema

```prisma
model Profile {
  id                  String   @id           // UUID v7
  name                String   @unique
  gender              String                 // "male" | "female"
  gender_probability  Float
  age                 Int
  age_group           String                 // child | teenager | adult | senior
  country_id          String   @db.VarChar(2)
  country_name        String
  country_probability Float
  created_at          DateTime @default(now())
}
```

Indexes on `gender`, `age`, `age_group`, `country_id`, `created_at`, and a composite index on `(gender, age_group, country_id)` for efficient combined filtering.

---

## CORS

All responses include:

```
Access-Control-Allow-Origin: *
```

---

## Timestamps

All `created_at` fields are returned in **UTC ISO 8601** format:

```
2024-01-01T00:00:00.000Z
```