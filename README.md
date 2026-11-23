# Tool Lending

A web application for neighbourhood associations that lend tools:
volunteers register members and keep a catalogue of tools, and anyone
can browse it. French by default, English on request.

The specification is in [docs/](docs/README.md); planned work is in
[docs_future/BACKLOG.md](docs_future/BACKLOG.md).

## Run

```sh
npm install
npm run dev          # http://localhost:3000
```

With Docker:

```sh
docker build -t tool-lending .
docker run -p 3000:3000 -v tool-lending-data:/data \
  -e PUBLIC_ORIGIN=https://pret.example.org tool-lending
```

`PUBLIC_ORIGIN` is the origin visitors reach the app at; form posts
from any other origin are refused. `HOST` and `PORT` default to `0.0.0.0`
and `3000`.

## Test

```sh
npx playwright install chromium   # once, for the browser tests
npm run check        # types, lint, format, tests, dependency audit
npm run measure      # mutation score, line/branch and traceability coverage
```
