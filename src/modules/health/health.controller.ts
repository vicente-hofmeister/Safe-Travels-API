import { healthCheck } from "./health.service.js";

export function healthController() {
  return healthCheck();
}
