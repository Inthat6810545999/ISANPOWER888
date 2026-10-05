import express from "express";
import { createCorsMiddleware, type RuntimeMode } from "./config/cors.js";
import { apiRouter } from "./routes/index.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { createVisitTrackRouter } from "./routes/visitTrackRoutes.js";

export function createApp(corsOrigin: string | undefined, mode: RuntimeMode = "test") {
  const app = express();

  app.all("/api/visits/track", createVisitTrackRouter(createCorsMiddleware(corsOrigin, mode, true)));

  app.use(createCorsMiddleware(corsOrigin, mode));
  app.use(express.json());

  app.use("/api", apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
