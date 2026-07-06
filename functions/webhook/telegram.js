import { decryptSecret } from "../_lib/crypto.js";

const PROVIDERS_CONFIG = {
  openai: {
    url: "https://api.openai.com/v1/chat/completions",
    model: "gpt-4o-mini"
  },
  openrouter: {
    url: "https://openrouter.ai/api/v1/chat/completions",
    model: "meta-llama/llama-3.1-70b-instruct"
  },
  nous_portal: {
    url: "https://api.nousresearch.com/v1/chat/completions",
    model: "nous-hermes-2-mixtral-8x7b-dpo"
  },
  google: {
    url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    model: "gemini-1.5-flash"
  },
  zhipu: {
    url: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    model: "glm-4-flash"
  },
  moonshot: {
    url: "https://api.moonshot.cn/v1/chat/completions",
    model: "moonshot-v1-8k"
  },
  minimax: {
    url: "https://api.minimax.chat/v1/chat/completions",
    model: "abab6.5g-chat"
  },
  xai: {
    url: "https://api.x.ai/v1/chat/completions",
    model: "grok-beta"
  },
  ollama: {
    url: "http://localhost:11434/v1/chat/completions",
    model: "llama3"
  }
};

async function getBotToken(db, masterSecret) {
  const botRow = await db.prepare(
    `SELECT token_ciphertext, token_iv FROM bot_configs WHERE platform = 'telegram'`
  ).first();
  if (!botRow) return null;
  return decryptSecret(botRow.token_ciphertext, botRow.token_iv, masterSecret);
}

async function getConversationHistory(db, userId) {
  const convRow = await db.prepare(
    `SELECT context_json FROM conversations WHERE user_id = ? AND platform = 'telegram'`
  )
    .bind(userId)
    .first();
  return convRow ? JSON.parse(convRow.context_json || "[]") : [];
}

async function getAvailableApiKey(db, masterSecret) {
  const keyRow = await db.prepare(
    `SELECT id, provider, key_ciphertext, key_iv, used_count, quota_limit FROM api_keys
     WHERE status = 'active'
     ORDER BY used_count ASC LIMIT 1`
  ).first();
  if (!keyRow) return null;
  const key = await decryptSecret(keyRow.key_ciphertext, keyRow.key_iv, masterSecret);
  return { id: keyRow.id, provider: keyRow.provider, key };
}

async function callAnthropicAPI(apiKey, history, userText) {
  try {
    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 500,
        messages: [
          ...history,
          { role: "user", content: userText },
        ],
      }),
    });
    const aiData = await aiRes.json();
    return aiData?.content?.[0]?.text || "抱歉，我没理解，能再说一次吗？";
  } catch (e) {
    return "抱歉，暂时无法处理，请稍后再试。";
  }
}

async function callOpenAICompatibleAPI(url, model, apiKey, history, userText) {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          ...history,
          { role: "user", content: userText }
        ],
        max_tokens: 500
      })
    });
    const data = await res.json();
    return data?.choices?.[0]?.message?.content || "抱歉，我没理解，能再说一次吗？";
  } catch (e) {
    return "抱歉，暂时无法处理，请稍后再试。";
  }
}

async function callLLM(provider, apiKey, history, userText) {
  if (provider === "anthropic") {
    return callAnthropicAPI(apiKey, history, userText);
  }
  const conf = PROVIDERS_CONFIG[provider];
  if (!conf) {
    return "未知的 AI 平台服务商，请在后台配置支持的平台。";
  }
  return callOpenAICompatibleAPI(conf.url, conf.model, apiKey, history, userText);
}

async function updateApiKeyUsage(db, keyId) {
  await db.prepare(
    `UPDATE api_keys SET used_count = used_count + 1, last_used_at = unixepoch() WHERE id = ?`
  )
    .bind(keyId)
    .run();
}

async function updateConversationHistory(db, userId, history, userText, replyText) {
  const newHistory = [
    ...history,
    { role: "user", content: userText },
    { role: "assistant", content: replyText },
  ].slice(-20);

  await db.prepare(
    `INSERT INTO conversations (user_id, platform, context_json, updated_at)
     VALUES (?, 'telegram', ?, unixepoch())
     ON CONFLICT(user_id, platform) DO UPDATE SET
       context_json = excluded.context_json, updated_at = unixepoch()`
  )
    .bind(userId, JSON.stringify(newHistory))
    .run();
}

async function sendTelegramMessage(botToken, chatId, text) {
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const update = await request.json().catch(() => null);
  if (!update || !update.message) return new Response("ok");

  const chatId = update.message.chat.id;
  const userText = update.message.text || "";
  const userId = String(update.message.from.id);

  const botToken = await getBotToken(env.DB, env.MASTER_SECRET);
  if (!botToken) return new Response("bot not configured", { status: 500 });

  const history = await getConversationHistory(env.DB, userId);
  const keyInfo = await getAvailableApiKey(env.DB, env.MASTER_SECRET);
  if (!keyInfo) {
    await sendTelegramMessage(botToken, chatId, "抱歉，服务暂时不可用，请稍后再试。");
    return new Response("ok");
  }

  const replyText = await callLLM(keyInfo.provider, keyInfo.key, history, userText);
  await updateApiKeyUsage(env.DB, keyInfo.id);
  await updateConversationHistory(env.DB, userId, history, userText, replyText);
  await sendTelegramMessage(botToken, chatId, replyText);

  return new Response("ok");
}
