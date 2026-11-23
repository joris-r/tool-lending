# Technical

## Stack

- One Node.js server, behind the host's reverse proxy, which
  terminates HTTPS.
- Node.js 26 LTS, TypeScript in strict mode, Fastify.
- Pages rendered on the server, as HTML; HTMX for partial updates.
  HTMX is served by the app, not from a CDN.
- Templates escape every value by default.
- SQLite, in the file named by `DATABASE_PATH`; schema changes are
  numbered SQL migrations, applied at start.
- Configuration by environment variables only: `HOST`, `PORT`,
  `DATABASE_PATH`, and `PUBLIC_ORIGIN`, the origin visitors reach the
  app at, e.g. `https://pret.example.org`.
- Shipped as a Docker image, built by a `Dockerfile` at the root.

## Conventions

- Layout: `src/` for the server, `src/views/` for the templates,
  `src/locales/` for the texts, `tests/http/` and `tests/browser/`
  for the tests.
- Code, identifiers and documentation in English; every displayed
  text exists in French and English.
- The specification states the exact texts only in
  [contents.md](contents.md) and as quoted in `ui.md`; other
  messages are free, in the display language.
- npm, with `package-lock.json` committed.

## Test and quality policy

- Test levels, with Vitest:
  - HTTP: the operations, their results and the state, through
    Fastify's request injection.
  - Browser: the display and the triggers, with Playwright on
    Chromium.
- `npm run check` runs, and must pass before every commit:
  `tsc --noEmit`, ESLint, Prettier in check mode, the tests, and
  `npm audit --audit-level=high` as the dependency audit.

## Measures

- `npm run measure` measures the test suite over `src/`, with every
  test level:
  - mutation score, with StrykerJS and its Vitest runner;
  - line and branch coverage, with Vitest's V8 coverage;
  - traceability coverage: the share of tagged statements of `docs/`,
    other than `(not testable)` ones, that at least one test cites.
- At the final review of every increment that changes tests or code,
  after the checks of its last phase, the measures are recorded in
  `measures/<increment>.md`: the date, the commit measured, and the
  four values. The file is committed with the increment's exit
  commit.
- The measures and their reports never lead to a change of tests or
  code, nor to a backlog entry; no agent reads them while writing
  tests or code.
