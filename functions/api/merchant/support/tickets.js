import { currentUser, json, randomHex } from "../../../_lib/auth.js";

function sameOrigin(request) {
  const origin = request.headers.get("Origin");
  if (!origin) return true;
  try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
}
async function getMerchant(db, userId) {
  return db.prepare("SELECT id,api_access_granted FROM pay_merchants WHERE user_id=? ORDER BY created_at DESC LIMIT 1").bind(userId).first();
}
function safeFileName(value) {
  return String(value || "attachment").replace(/[\\/\\0-\\x1f]/g, "_").slice(0, 160) || "attachment";
}
function sensitiveRequest(value) {
  return /(提现|打款|到账|不到账|出款|退款|权限|审批|审核|冻结|风控|资金|余额|赔付|司法|申诉|人工|投诉)/i.test(value);
}
async function createAiReply(env, content) {
  if (!env.ZHIPU_API_KEY) return "已收到您的咨询。当前智能客服暂不可用，已为您保留消息；如涉及具体业务，请留言等待人工客服处理。";
  const system = `你是“晴天支付”的智能客服，只提供基础产品说明。
可回答范围：
1. API接入流程：商户登录后进入客服工单，提交网站/机器人/APP类型、应用名称、网站地址及真实证明材料；由白名单人工管理员审核，审核通过后才开放API调用。
2. 费率：当前合规法币提现费率为6%；具体订单费率和到账金额以商户后台实时展示及最终审核结果为准。不得承诺额外返利、保证到账时间或保证不冻结。
3. API限制：未获管理员批准的商户不可调用API；不得绕过权限、签名、风控或限额规则；密钥应保密。
边界：不得猜测账户余额、订单状态、提现进度、审批结果、风控决定或任何个案；不得指导规避监管、洗钱、诈骗或隐藏资金来源。用户询问提现打款、资金到账、权限审批/审核、账户冻结、资金状态或投诉时，必须只回复：“正在为您转接人工客服，请稍候。”
只用简洁中文回答；未知问题明确说明暂不确定并建议提交工单。不要编造政策。`;
  try {
    const response = await fetch("https://open.bigmodel.cn/api/paas/v4/chat/completions", {
      method: "POST",
      headers: { "Authorization": "Bearer " + env.ZHIPU_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "glm-4-flash",
        messages: [{ role: "system", content: system }, { role: "user", content }],
        temperature: 0.2,
        max_tokens: 320,
        stream: false
      }),
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) throw new Error("Zhipu HTTP " + response.status);
    const data = await response.json();
    const answer = String(data?.choices?.[0]?.message?.content || "").trim();
    return answer.slice(0, 1200) || "已收到您的咨询，请稍候，客服将继续为您处理。";
  } catch (error) {
    console.error("[support:ai]", String(error?.message || error).slice(0, 120));
    return "已收到您的咨询，智能客服暂时繁忙；消息已保存，请稍候等待人工客服处理。";
  }
}
async function storeAttachments(db, ticketId, messageId, userId, files, now) {
  const results = [];
  for (const file of files.slice(0, 5)) {
    if (!file || typeof file.arrayBuffer !== "function" || !file.size) continue;
    if (file.size > 768 * 1024) throw new Error("单个附件不能超过 768 KB。");
    const ext = String(file.name || "").toLowerCase().split(".").pop();
    const inferred = ({jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png",webp:"image/webp",gif:"image/gif",pdf:"application/pdf",txt:"text/plain",doc:"application/msword",docx:"application/vnd.openxmlformats-officedocument.wordprocessingml.document"})[ext] || "application/octet-stream";
    const mime = String(file.type || inferred).toLowerCase();
    const allowed = ["image/jpeg","image/png","image/webp","image/gif","application/pdf","text/plain","application/vnd.openxmlformats-officedocument.wordprocessingml.document","application/msword"];
    if (!allowed.includes(mime)) throw new Error("附件仅支持 JPG、PNG、WEBP、GIF、PDF、TXT、DOC、DOCX。");
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    const id = randomHex(16), name = safeFileName(file.name);
    const metadata = { attachment_id: id, file_name: name, mime_type: mime, file_size: bytes.length };
    await db.prepare("INSERT INTO support_attachments(id,ticket_id,message_id,uploader_user_id,file_name,mime_type,file_size,data_base64,created_at) VALUES(?,?,?,?,?,?,?,?,?)")
      .bind(id,ticketId,messageId,userId,name,mime,bytes.length,btoa(binary),now).run();
    results.push(metadata);
  }
  return results;
}
export async function onRequestGet({ request, env }) {
  if (!env.AUTH_DB) return json({ error: "客服工单服务暂不可用。" }, 503);
  const user = await currentUser(request, env.AUTH_DB);
  if (!user) return json({ error: "请先登录。" }, 401);
  try {
    const merchant = await getMerchant(env.AUTH_DB, user.id);
    if (!merchant) return json({ error: "商户资料尚未初始化。" }, 400);
    const ticket = await env.AUTH_DB.prepare("SELECT id,subject,status,created_at,updated_at FROM support_tickets WHERE user_id=? AND merchant_id=? ORDER BY updated_at DESC LIMIT 1").bind(user.id, merchant.id).first();
    if (!ticket) return json({ ticket: null, messages: [], api_access_granted: Boolean(merchant.api_access_granted), has_more: false });
    const url = new URL(request.url), limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || 50)));
    const beforeAt = Number(url.searchParams.get("before_at") || 0), beforeId = String(url.searchParams.get("before_id") || "");
    const older = beforeAt > 0 && /^[a-f0-9]{32}$/i.test(beforeId);
    const query = older
      ? env.AUTH_DB.prepare("SELECT id,sender_role,message_type,content,metadata_json,created_at FROM chat_messages WHERE ticket_id=? AND (created_at<? OR (created_at=? AND id<?)) ORDER BY created_at DESC,id DESC LIMIT ?").bind(ticket.id,beforeAt,beforeAt,beforeId,limit+1)
      : env.AUTH_DB.prepare("SELECT id,sender_role,message_type,content,metadata_json,created_at FROM chat_messages WHERE ticket_id=? ORDER BY created_at DESC,id DESC LIMIT ?").bind(ticket.id,limit+1);
    const result = await query.all(), rows = result.results || [], hasMore = rows.length > limit;
    const page = rows.slice(0,limit).reverse();
    return json({ ticket, messages: page, api_access_granted: Boolean(merchant.api_access_granted), has_more: hasMore,
      next_cursor: page.length ? { before_at: page[0].created_at, before_id: page[0].id } : null });
  } catch (error) {
    console.error("[merchant/support:get]", String(error?.message || error).slice(0,160));
    return json({ error: "客服消息读取失败。" }, 503);
  }
}
export async function onRequestPost({ request, env, context }) {
  if (!sameOrigin(request)) return json({ error: "请求来源校验失败。" }, 403);
  if (!env.AUTH_DB) return json({ error: "客服工单服务暂不可用。" }, 503);
  const user = await currentUser(request, env.AUTH_DB);
  if (!user) return json({ error: "请先登录。" }, 401);
  const contentType = request.headers.get("content-type") || "";
  let body = {}, files = [];
  try {
    if (contentType.toLowerCase().includes("multipart/form-data")) {
      const form = await request.formData();
      body = JSON.parse(String(form.get("payload") || "{}"));
      files = form.getAll("files").filter(file => file && file.size);
    } else if (contentType.toLowerCase().includes("application/json")) body = await request.json();
    else return json({ error: "请使用 JSON 或 multipart/form-data。" }, 415);
  } catch { return json({ error: "请求格式错误。" }, 400); }

  const type = String(body?.type || "text");
  let content = String(body?.content || "").trim(), metadata = {};
  if (type === "permission_request") {
    const appType = String(body?.app_type || ""), appName = String(body?.app_name || "").trim(), websiteUrl = String(body?.website_url || "").trim();
    if (!["website","bot","app"].includes(appType)) return json({ error: "请选择网站、机器人或 APP 类型。" }, 400);
    if (appName.length < 2 || appName.length > 100) return json({ error: "应用名称需为 2 至 100 个字符。" }, 400);
    if (body?.compliance_accepted !== true) return json({ error: "请先阅读并勾选《开发者合规承诺》。" }, 400);
    if (appType === "website") {
      try { const u = new URL(websiteUrl); if (!["http:","https:"].includes(u.protocol) || u.username || u.password) return json({ error: "请填写有效的网站 URL。" }, 400); }
      catch { return json({ error: "网站权限申请需要有效的网址。" }, 400); }
    } else if (websiteUrl) {
      try { const u = new URL(websiteUrl); if (!["http:","https:"].includes(u.protocol) || u.username || u.password) return json({ error: "网址格式无效。" }, 400); }
      catch { return json({ error: "网址格式无效。" }, 400); }
    }
    content = "申请调用 API 权限：" + appName + (websiteUrl ? "（" + websiteUrl + "）" : "");
    metadata = { app_type: appType, app_name: appName, website_url: websiteUrl, compliance_accepted: true };
  } else if (type === "text") {
    if (content.length > 2000 || (!content && !files.length)) return json({ error: "请输入消息或选择附件（消息最多 2000 个字符）。" }, 400);
  } else return json({ error: "不支持的消息类型。" }, 400);
  if (files.length > 5) return json({ error: "每次最多上传 5 个附件。" }, 400);
  if (type === "text" && !content && !files.length) return json({ error: "请输入消息或选择附件。" }, 400);
  try {
    const db = env.AUTH_DB, merchant = await getMerchant(db,user.id);
    if (!merchant) return json({ error: "商户资料尚未初始化。" }, 400);
    const now = Math.floor(Date.now()/1000);
    let ticket = await db.prepare("SELECT id FROM support_tickets WHERE user_id=? AND merchant_id=? AND status!='closed' ORDER BY updated_at DESC LIMIT 1").bind(user.id,merchant.id).first();
    const created = !ticket; if (!ticket) ticket = { id: randomHex(16) };
    const messageId = randomHex(16), applicationId = type === "permission_request" ? randomHex(16) : "";
    if (applicationId) metadata.application_id = applicationId;
    const online = await db.prepare("SELECT 1 AS online FROM support_admin_presence WHERE last_seen_at>=? LIMIT 1").bind(now-90).first();
    const aiEligible = type === "text" && Boolean(content) && !online && !sensitiveRequest(content);
    const statements = [];
    if (created) statements.push(db.prepare("INSERT INTO support_tickets(id,user_id,merchant_id,subject,status,created_at,updated_at) VALUES(?,?,?,'商户客服咨询','open',?,?)").bind(ticket.id,user.id,merchant.id,now,now));
    else statements.push(db.prepare("UPDATE support_tickets SET updated_at=?,status='open' WHERE id=?").bind(now,ticket.id));
    if (applicationId) statements.push(db.prepare("INSERT INTO api_access_requests(id,ticket_id,user_id,merchant_id,app_type,app_name,website_url,status,created_at,compliance_accepted_at) VALUES(?,?,?,?,?,?,?,'pending',?,?)").bind(applicationId,ticket.id,user.id,merchant.id,metadata.app_type,metadata.app_name,metadata.website_url||"",now,now));
    statements.push(db.prepare("INSERT INTO chat_messages(id,ticket_id,sender_user_id,sender_role,message_type,content,metadata_json,created_at) VALUES(?,?,?,'merchant',?,?,?,?)").bind(messageId,ticket.id,user.id,type,content,JSON.stringify(metadata),now));
    await db.batch(statements);
    const attachments = await storeAttachments(db,ticket.id,messageId,user.id,files,now);
    if (attachments.length) {
      metadata.attachments = attachments;
      await db.prepare("UPDATE chat_messages SET metadata_json=? WHERE id=?").bind(JSON.stringify(metadata),messageId).run();
    }
    let aiMessage = null;
    if (aiEligible) {
      const task = (async () => {
        const answer = await createAiReply(env,content);
        const aiId = randomHex(16), aiNow = Math.floor(Date.now()/1000);
        await db.batch([
          db.prepare("INSERT INTO chat_messages(id,ticket_id,sender_user_id,sender_role,message_type,content,metadata_json,created_at) VALUES(?,?,NULL,'ai','text',?,'{}',?)").bind(aiId,ticket.id,answer,aiNow),
          db.prepare("UPDATE support_tickets SET updated_at=? WHERE id=?").bind(aiNow,ticket.id)
        ]);
      })().catch(error => console.error("[support:ai:save]",String(error?.message||error).slice(0,120)));
      if (context?.waitUntil) context.waitUntil(task); else await task;
    } else if (type === "text" && sensitiveRequest(content)) {
      const transfer = "正在为您转接人工客服，请稍候。", aiId = randomHex(16), aiNow = Math.floor(Date.now()/1000);
      await db.prepare("INSERT INTO chat_messages(id,ticket_id,sender_user_id,sender_role,message_type,content,metadata_json,created_at) VALUES(?,?,NULL,'ai','text',?,'{}',?)").bind(aiId,ticket.id,transfer,aiNow).run();
      aiMessage = { id: aiId, sender_role: "ai", message_type: "text", content: transfer, metadata_json: "{}", created_at: aiNow };
    }
    return json({ success: true, ticket_id: ticket.id, message: { id: messageId, sender_role: "merchant", message_type: type, content, metadata_json: JSON.stringify(metadata), created_at: now }, ai_message: aiMessage, message_text: "消息已提交至客服工单。" },201);
  } catch (error) {
    console.error("[merchant/support:post]",String(error?.message||error).slice(0,160));
    return json({ error: String(error?.message||"消息提交失败，请稍后重试。").slice(0,160) },503);
  }
}
