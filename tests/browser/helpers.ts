import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/app.js";

/** A port free on 127.0.0.1 at the time of the call. */
export async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}

export interface Running {
  app: FastifyInstance;
  origin: string;
}

/** Starts the app on 127.0.0.1, its public origin being where it listens. */
export async function startApp(): Promise<Running> {
  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  const app = buildApp({ publicOrigin: origin });
  await app.listen({ host: "127.0.0.1", port });
  return { app, origin };
}

/** Serves one HTML page from another origin than the app's. */
export async function startForeignSite(
  html: string,
): Promise<{ server: Server; origin: string }> {
  const server = createServer((_req, res) => {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(html);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return { server, origin: `http://127.0.0.1:${port}` };
}
