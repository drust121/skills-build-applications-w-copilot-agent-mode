# OctoFit Tracker architecture

OctoFit Tracker is a three-tier application for a school fitness program. The starter code includes API contracts and intentionally incomplete implementation points so you can use GitHub Copilot agent mode in a test-driven loop.

![Three-tier OctoFit architecture](../.github/images/octofit-architecture.svg)

## Tier boundaries

- **Presentation tier**: React 19, Vite, React Router, Bootstrap, and a shared API client in `octofit-tracker/frontend/src`.
- **Logic tier**: Express and TypeScript routes/services in `octofit-tracker/backend/src` expose `/api/*` behavior on port `8000`.
- **Data tier**: Mongoose models and seed data in `octofit-tracker/backend/src/models` and `src/scripts/seed.ts` persist to MongoDB on port `27017`.

## Ports and environment rules

- MongoDB: `27017`
- Express API: `8000`
- Vite frontend: `5173`
- The browser calls relative `/api` paths. Vite proxies them to `http://localhost:8000`, so the unauthenticated API port stays private in Codespaces. `VITE_API_BASE_URL` can override the base URL.

## API contract

| Capability | Method and path | Expected behavior |
| --- | --- | --- |
| Activity tracking | `GET /api/activities`, `POST /api/activities` | List and create valid activity records. POST accepts `userId`, `teamId`, `type`, and `minutes`; `userId` and `teamId` must be well-formed IDs for an existing user and team; otherwise respond with a deliberate 4xx (never a 500 from a cast error). A created activity stores the submitted `user`, `team`, `type`, and `minutes` plus computed `points` and `occurredAt`. |
| Teams | `GET /api/teams`, `POST /api/teams` | List and create teams with members. Created and listed teams keep the submitted `name` and `mascot`. Reject a team without a name with `400`. |
| Leaderboard | `GET /api/leaderboard` | Return teams ordered by the sum of their activity points, highest first. Each entry has `teamName`, `totalPoints`, and a 1-based `rank`. |
| Workout suggestions | `GET /api/workouts/suggestions/:userEmail` | Recommend workouts from recent activity patterns for the matching seeded user's email address. The first suggestion's `focus` matches that user's goal or recent activity, with a `reason` explaining why. An email with no matching user returns a deliberate 4xx (for example, `404`). |

## Tier boundaries and responsibilities

- Presentation tier: React 19 pages and shared API-client logic in `octofit-tracker/frontend/src` render activities, teams, leaderboard, and workout suggestions. The UI should fetch from `/api/*`, display loading/empty/error states, and remain tolerant of backend validation errors.
- Logic tier: Express + TypeScript handlers in `octofit-tracker/backend/src` own validation, business rules, and response shaping for `/api/activities`, `/api/teams`, `/api/leaderboard`, and `/api/workouts/suggestions/:userEmail`.
- Data tier: Mongoose models and seeded fixtures in `octofit-tracker/backend/src/models` and `src/scripts/seed.ts` define the canonical schema, defaults, and persisted sample data used by the API and the frontend.
- Boundary rule: fix the data contract first, then the API contract, and only after that move to the UI. The backend must not leak raw cast errors or 500s; the frontend must not decide the business rules.

## Current failing tests

- Data contract: `npm run test:data --prefix octofit-tracker/backend` currently fails 4 of 5 tests. The root issue is missing Mongoose validation/defaults for `User`, `Team`, `Activity`, and `Workout`.
- API contract: `npm run test:api --prefix octofit-tracker/backend` currently fails 4 of 4 tests. Invalid requests still return `501` instead of a deliberate 4xx, the leaderboard is empty, and workout suggestions do not match the user's activity pattern.
- Presentation contract: `npm test --prefix octofit-tracker/frontend` currently fails all 15 tests. The app is not rendering the expected activity/team/leaderboard/workout content and is missing the required loading and alert/error states.

## Smallest safe implementation order

1. Data tier first: add the required Mongoose validation and defaults on `User`, `Team`, `Activity`, and `Workout`; ensure seed data is idempotent and preserves existing users/teams.
2. Logic tier next: implement the backend handlers for activities and teams with proper 4xx validation, then compute leaderboard totals and workout recommendations from recent activity patterns.
3. API verification: run `npm run test:data --prefix octofit-tracker/backend` and `npm run test:api --prefix octofit-tracker/backend` until both pass before touching the UI.
4. Presentation tier last: wire the React pages to the stable API responses and add loading, empty, and accessible error states.
5. Final verification: run the frontend suite and build commands only after the backend contract is green.

## Implementation decisions

- Data tier decision: keep the schema authoritative.
  Define the required Mongoose validation, default values, and seed fixtures first so that every API and UI contract has stable data to work with.
- Logic tier decision: keep the API contract deliberate.
  Validate bad input as `400`-level errors, reject malformed IDs cleanly, compute team points for the leaderboard, and match workout suggestions to the user's recent activity or fitness goal.
- Presentation tier decision: render only after the backend is stable.
  Fetch `/api/*` data, show the expected content states, and announce loading and API failures with accessible UI patterns.
- Activity tracking approach: reject invalid `userId`/`teamId` combinations with a 4xx, compute `points` and `occurredAt` on creation, and list the created activity from the API.
- Team management approach: require a team `name` and `mascot`, default `members` to an empty array, and persist member IDs as expected by the tests.
- Leaderboard approach: aggregate each team's total activity points, sort descending, and assign 1-based ranks.
- Workout suggestions approach: return the first workout matching the user's recent activity or goal, include a reason string, and return a deliberate 4xx for unknown emails.

## Test plan and current status

- Data-tier command: `npm run test:data --prefix octofit-tracker/backend`
  Current status: failing — 4 of 5 tests are red because validation/default behavior is missing from the data layer.
- API command: `npm run test:api --prefix octofit-tracker/backend`
  Current status: failing — all 4 tests are red because the handlers return `501` and empty/incorrect payloads instead of the documented API contract.
- Frontend command: `npm test --prefix octofit-tracker/frontend`
  Current status: failing — 15 of 15 tests are red because the presentation layer is not fetching or rendering the backend contract correctly.
- Backend build command: `npm run build --prefix octofit-tracker/backend`
- Frontend build command: `npm run build --prefix octofit-tracker/frontend`
  These build commands should be used only after the data and API contracts are green; they are not the first debugging step for the current failures.
