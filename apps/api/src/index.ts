import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { connectDatabase } from "./db/connect.js";

await connectDatabase();

const app = createApp(env.CORS_ORIGIN);

app.listen(env.PORT, process.env.HOST ?? "0.0.0.0", () => {
  console.log(`API listening on http://localhost:${env.PORT}`);
});
