import cors from "cors";
import express from "express";
import { apiRouter } from "./routes/index.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

export function createApp(corsOrigin: string) {
  const app = express();

  app.use(cors({ origin: corsOrigin }));
  app.use(express.json());

  app.use("/api", apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
