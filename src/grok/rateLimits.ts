import type { GrokSettings } from "../settings";
import { getDynamicHeaders, proxiedFetch } from "./headers";
import { toRateLimitModel } from "./models";

const RATE_LIMIT_API = "https://grok.com/rest/rate-limits";

export async function checkRateLimits(
  cookie: string,
  settings: GrokSettings,
  model: string,
): Promise<Record<string, unknown> | null> {
  const rateModel = toRateLimitModel(model);
  const headers = getDynamicHeaders(settings, "/rest/rate-limits");
  headers.Cookie = cookie;
  const body = JSON.stringify({ requestKind: "DEFAULT", modelName: rateModel });

  const resp = await proxiedFetch(RATE_LIMIT_API, { method: "POST", headers, body }, settings);
  if (!resp.ok) return null;
  return (await resp.json()) as Record<string, unknown>;
}

