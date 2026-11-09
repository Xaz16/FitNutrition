# Fit Nutrition Supply

Web service that builds a meal plan from familiar dishes for 7–31 days, turns it into a shopping list and finds the cheapest basket across five Russian grocery chains (Lenta, Auchan, Perekrestok, Pyaterochka, Magnit).

Course project for «Проектирование и конструирование программного обеспечения», ИжГТУ, group Б23-191-2: Чипига А. А., Фазлыев А. А.

## Repository layout

| Path | Contents |
|---|---|
| `docs/` | Lab 1: pitch deck and AI usage report |
| `docs/lab2/` | Lab 2: architecture document, UML/ER diagrams, API contracts, wireframes, ADRs, agent report, screenshots |
| `app/backend/` | NestJS 12 API, Prisma 7, PostgreSQL |
| `app/frontend/` | React 19 SPA (Vite) |
| `docker-compose.yml` | PostgreSQL for local development |

## Running the prototype

Requirements: Node.js 22.12+, npm 11+ (npm 10 fails on a peer-dependency resolution bug, use `npx npm@11 install` if needed), Docker.

```bash
docker compose up -d db

cd app/backend
cp .env.example .env
npm install
npm run db:migrate
npm run db:seed
npm run build && npm run start:prod

cd ../frontend
npm install
npm run dev
```

Open http://localhost:5173 and sign in as `demo@fitnutrition.local` / `demo12345`, or register a new account.

To reproduce the AI-service outage scenario, start the backend with `AI_ADVISOR_MODE=unavailable`.

## Tests

```bash
cd app/backend
npm test            # domain unit tests, acceptance numbers from Lab 1
npm run test:e2e    # full API flow against the seeded database
```

Prices and recipes in the seed are test data, not market prices.
