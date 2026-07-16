import express, { Express, NextFunction, Request, Response } from "express";
import type { KVNamespace, D1Database } from "@cloudflare/workers-types";
import { readEnv } from "./config/env";
import type { Env as ConfigEnv } from "./config/env";
import { buildContainer } from "./di/container";
import { buildRouter } from "./routes/router";
import { AppError } from "./utils/errors";
import { createLogger } from "./utils/logger";

const logger = createLogger("app");

export function createApp(env: ConfigEnv & { DB?: D1Database; KV?: KVNamespace }): Express {
  const app = express();

  app.use(express.text({ type: "text/plain", limit: "5mb" }));
  app.use(express.json({ limit: "10mb" }));
  app.use(express.static("public"));

  const container = buildContainer(env);
  app.use(buildRouter(container));

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ success: false, error: "Not Found", message: "Endpoint not found" });
  });

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof AppError) {
      res.status(error.status).json({ success: false, error: error.name, message: error.message, code: error.code });
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    logger.error("Unhandled error", { error: message });
    res.status(500).json({ success: false, error: "Internal Server Error", message });
  });

  return app;
}
