import { buildApp } from "./app.js";

const publicOrigin = process.env.PUBLIC_ORIGIN;
if (!publicOrigin) {
  console.error("PUBLIC_ORIGIN is required, e.g. https://pret.example.org");
  process.exit(1);
}

const app = buildApp({ publicOrigin, logger: true });
const host = process.env.HOST ?? "0.0.0.0";
const port = Number(process.env.PORT ?? 3000);

app.listen({ host, port }).catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
