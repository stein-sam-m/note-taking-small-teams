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

## Architecture Decisions

- **JWT over OAuth:** JWTs were chosen because this API is intended to be used across multiple domains and teams. OAuth would tie us to a single identity provider and complicate cross-domain usage; JWTs are stateless and portable at the cost of no SSO support.

- **Custom ORM approach:** We control the data model entirely since we're the only "team" owning this service. We don't need to bind to each team's existing data structure; all we need is a unique identifier from the org. This lets us keep the schema flexible and tailored to our needs rather than adapting to external data ownership.

- **Further goals:** I would have liked to ensure cross domain notes don't link, so a basic level would be ensuring you can only read notes from users with the same @email.com address as yours.  I would also like to add admin levels ontop of clearance levels.  So there could be users, admins and superusers.  Admins could access certain things like deleting while.  Superusers could add new users, change clearance levels (maybe if that's how the law works but probably isn't) and generate email links for admins to register as admins.

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
| POST | `/auth/register` | `{ email, name, password, clearanceLevelName? }` | `201 { id, email, name, clearanceLevelName, createdAt }` |
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
