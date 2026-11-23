import Fastify, { type FastifyInstance } from "fastify";

export interface AppConfig {
  /** The origin visitors reach the app at, e.g. `https://pret.example.org`. */
  publicOrigin: string;
}

export function buildApp(config: AppConfig): FastifyInstance {
  void config;
  return Fastify();
}
