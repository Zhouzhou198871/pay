export async function onRequest(context) {
  try {
    return await context.next();
  } catch (error) {
    const rayId = context.request.headers.get("cf-ray") || "unknown";
    const name = String(error?.name || "Error").slice(0, 80);
    const message = String(error?.message || error || "Unknown Worker exception").slice(0, 500);
    const stack = String(error?.stack || "").slice(0, 8000);

    console.error("[pages/unhandled-exception]", JSON.stringify({
      rayId,
      url: context.request.url,
      method: context.request.method,
      name,
      message,
      stack
    }));

    return new Response(
      `服务端函数异常：${name}: ${message}\nRay ID: ${rayId}\n`,
      {
        status: 500,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store"
        }
      }
    );
  }
}
