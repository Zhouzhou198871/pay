(async () => {
  const result = { readyState: document.readyState, turnstileType: typeof window.turnstile, tokenAtStart: Boolean(window.__qtCaptchaToken) };
  try {
    const response = await fetch("/api/auth/config", { cache: "no-store", signal: AbortSignal.timeout(8000) });
    result.configStatus = response.status;
    result.config = await response.json();
  } catch (error) { result.configError = String(error); }
  result.challengeScripts = [...document.scripts].filter(s => s.src.includes("challenges.cloudflare.com")).map(s => ({src:s.src,ready:s.readyState||"unknown"}));
  result.widgetId = window.__qtCaptchaWidgetId ?? null;
  await new Promise(resolve => setTimeout(resolve, 12000));
  result.turnstileTypeAfterWait = typeof window.turnstile;
  result.tokenAfterWait = Boolean(window.__qtCaptchaToken);
  result.slotText = document.querySelector("#captcha-slot")?.innerText || null;
  result.challengeFrames = [...document.querySelectorAll("iframe")].map(f => f.src).filter(src => src.includes("challenges.cloudflare.com"));
  const node = document.createElement("pre"); node.id = "qa-probe-result"; node.textContent = JSON.stringify(result); document.body.appendChild(node);
})();