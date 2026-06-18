import * as dotenv from "dotenv";
dotenv.config({ path: "../../.env" });

import app, { bootstrapAdminUser } from "./app";
import logger from "./lib/logger";

const PORT = parseInt(process.env["PORT"] ?? "3001", 10);

app.listen(PORT, () => {
  logger.info({ port: PORT }, "BizCore API server started");
  void bootstrapAdminUser();
});
