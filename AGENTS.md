# Repository Guidelines

## Project Structure & Module Organization
`client/` contains the React + Vite app. Main routes live in `client/src/pages/`, shared UI in `client/src/components/`, and API helpers in `client/src/api.js`. `server/` contains the Express API, SQLite access, and background services; routes live in `server/routes/`, reusable business logic in `server/services/`, and schema/query code under `server/db/`. Runtime assets and local state live in `uploads/`, `backups/`, and `badshuffle.lock`. Product planning and handoff notes go in `AI/`.

## Build, Test, and Development Commands
Use the repo root for full-stack workflows:

- `npm run dev`: starts the API and waits for it before launching the Vite client.
- `npm run dev:host`: same as above, but exposes the client on the local network.
- `npm run build:client`: production client build.
- `npm run create-admin`: create the first admin user.
- `npm run reset-password` or `npm run reset-auth`: recover local auth state.
- `node -c server/index.js`: quick syntax check for server changes.
- `npm --prefix client run build`: required smoke test for UI changes.

## Coding Style & Naming Conventions
Match the existing codebase: ES modules in `client/`, CommonJS in `server/`, 2-space indentation, semicolons, and concise comments only where logic is not obvious. Use `PascalCase.jsx` for React components and pages, `camelCase.js` for helpers and services, and keep route/service names domain-based (`quoteService`, `notificationService`, `itemSetAsideService`). Prefer small, focused modules over large utility files.

## Testing Guidelines
There is no formal test suite wired into `package.json` yet. Verify changes with targeted syntax checks (`node -c ...`), the client production build, and manual app flows relevant to the change. When adding new behavior, document the manual verification path in the PR description.

## Commit & Pull Request Guidelines
Recent history uses short conventional subjects such as `release: v0.0.11`, `docs: update README AI references`, and `hotfix: stabilize v0.0.8 UI and performance`. Follow that style: `<type>: <brief description>`. PRs should include scope, risk, manual test notes, linked issues, and screenshots or recordings for UI work.

## Security & Configuration Tips
Never commit `.env` secrets or exported customer data. In production, `JWT_SECRET` must be set to a strong value. Treat `uploads/` and backup imports as sensitive data paths, and prefer the built-in admin/CLI flows over direct database edits.
