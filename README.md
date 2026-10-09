# Note-Taking Backend

A REST API for small teams to submit and retrieve categorized notes.

## Prerequisites

- Node.js ≥ 25
- PostgreSQL 16

## Setup

```bash
# Install dependencies
npm install

# Create databases
createdb note_taking_dev
createdb note_taking_test

# Copy environment files and fill in values
cp .env.example .env
# Set DATABASE_URL and JWT_SECRET in .env

# Run migrations
npx prisma migrate dev

# Seed categories and demo account
npm run seed

# Start the server
npm start
```

## Demo Account

A demo account is seeded automatically with `npm run seed`:

| field | value |
|---|---|
| email | `demo@example.com` |
| password | `demo123` |

Get a token instantly (server must be running):

```bash
./scripts/get-demo-token.sh
```

Use it on every request:

```bash
curl http://localhost:3000/categories \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## ⚠️ Token Expiry

Tokens issued by this service **do not expire**. This is intentional for demo convenience. Before any production use, add `expiresIn` to `jwt.sign()` and implement a token refresh flow.

## Authentication

All endpoints require a valid JWT in the `Authorization: Bearer <token>` header except:

- `POST /auth/register`
- `POST /auth/login`

## Endpoints

### Auth
| method | path | body | response |
|---|---|---|---|
| POST | `/auth/register` | `{ email, name, password }` | `201 { id, email, name, createdAt }` |
| POST | `/auth/login` | `{ email, password }` | `200 { token }` |

### Notes
| method | path | description |
|---|---|---|
| POST | `/notes` | Create a note |
| GET | `/notes/:id` | Get note by ID |
| GET | `/notes/user/:email` | All notes by user |
| GET | `/notes/category/:categoryName` | All notes in category |
| GET | `/notes/user/:email/category/:categoryName` | Notes by user + category |

### Categories
| method | path | description |
|---|---|---|
| GET | `/categories` | List active categories |
| POST | `/admin/categories` | Add a new category |
