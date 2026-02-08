import { env } from "./config/env.js";
import { makeLogger } from "./lib/logger.js";
import { healthCheck } from "./modules/health/health.service.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const log = makeLogger(env.logLevel as any);

log.info("Starting app...", { nodeEnv: env.nodeEnv });

const result = healthCheck();
log.info("Health:", result);
