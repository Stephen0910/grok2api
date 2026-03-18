/**
 * 转发代理 - 部署到 Deno Deploy
 * 将 grok2api (CF Worker) 的请求转发到 grok.com
 *
 * 协议：请求方在 Header 里携带 x-proxy-target: https://grok.com/...
 * 本服务读取该 Header，向目标发起真实请求并原样返回响应。
 *
 * 安全：通过 PROXY_SECRET 环境变量设置共享密钥，防止被滥用。
 */

const SECRET = Deno.env.get("PROXY_SECRET") ?? "";

Deno.serve(async (req: Request): Promise<Response> => {
  // 健康检查
  if (req.method === "GET" && new URL(req.url).pathname === "/ping") {
    return new Response("pong", { status: 200 });
  }

  // 验证密钥（如果设置了的话）
  if (SECRET) {
    const auth = req.headers.get("x-proxy-secret") ?? "";
    if (auth !== SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  // 读取目标 URL
  const target = req.headers.get("x-proxy-target") ?? "";
  if (!target) {
    return new Response("Missing x-proxy-target header", { status: 400 });
  }

  // 验证目标只能是 grok.com 相关域名
  let targetUrl: URL;
  try {
    targetUrl = new URL(target);
  } catch {
    return new Response("Invalid x-proxy-target URL", { status: 400 });
  }
  if (!targetUrl.hostname.endsWith("grok.com") && targetUrl.hostname !== "grok.com") {
    return new Response("Target host not allowed", { status: 403 });
  }

  // 构建转发请求头（去掉代理专用头）
  const headers = new Headers(req.headers);
  headers.delete("x-proxy-target");
  headers.delete("x-proxy-secret");
  headers.delete("host");
  // CF 会加这些头，转发时去掉避免被识别
  headers.delete("cf-connecting-ip");
  headers.delete("cf-ipcountry");
  headers.delete("cf-ray");
  headers.delete("cf-visitor");
  headers.delete("x-forwarded-for");
  headers.delete("x-forwarded-proto");

  try {
    const resp = await fetch(target, {
      method: req.method,
      headers,
      body: req.method !== "GET" && req.method !== "HEAD" ? req.body : undefined,
      redirect: "follow",
    });
    return new Response(resp.body, {
      status: resp.status,
      statusText: resp.statusText,
      headers: resp.headers,
    });
  } catch (err) {
    console.error("Proxy fetch error:", err);
    return new Response(`Proxy error: ${err instanceof Error ? err.message : String(err)}`, {
      status: 502,
    });
  }
});
