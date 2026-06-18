import * as dotenv from "dotenv";
dotenv.config({ path: "../../.env" });

import app, { bootstrapAdminUser } from "./app";
import { runStartupMigrations } from "./lib/startup-migrate";
import logger from "./lib/logger";

const PORT = parseInt(process.env["PORT"] ?? "3001", 10);

// Run migrations first, then bootstrap, then start listening.
runStartupMigrations()
  .then(() => bootstrapAdminUser())
  .then(() => {
    app.listen(PORT, () => {
      logger.info({ port: PORT }, "BizCore API server started");
    });
  })
  .catch((err) => {
    console.error("Fatal startup error:", err);
    process.exit(1);
  });
