-- ============================================
-- 销售 Bot 管理后台 D1 Schema
-- 部署: wrangler d1 execute <DB_NAME> --file=schema.sql
-- ============================================

-- 商品库
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,           -- uuid
  name TEXT NOT NULL,
  category TEXT,
  price REAL,
  stock INTEGER DEFAULT 0,
  description TEXT,
  embedding_id TEXT,             -- 对应 Vectorize 中的向量 id，暂未接入时留空
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- 短语库 / 销售话术模板
CREATE TABLE IF NOT EXISTS phrases (
  id TEXT PRIMARY KEY,
  intent_tag TEXT NOT NULL,      -- 例如: greeting / price_inquiry / stock_check / closing
  template_text TEXT NOT NULL,
  variables_json TEXT,           -- 例如: ["product_name", "price"]
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- API Key 元数据 (真实 key 以密文形式存储，绝不存明文)
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,        -- 例如: anthropic / openai
  label TEXT,                    -- 便于识别的备注名
  key_ciphertext TEXT NOT NULL,  -- AES-GCM 加密后的 base64
  key_iv TEXT NOT NULL,          -- 加密用的 iv, base64
  status TEXT DEFAULT 'active',  -- active / cooldown / disabled
  quota_limit INTEGER DEFAULT 0, -- 0 表示不限
  used_count INTEGER DEFAULT 0,
  last_used_at INTEGER,
  last_reset_at INTEGER DEFAULT (unixepoch()),
  created_at INTEGER DEFAULT (unixepoch())
);

-- 会话上下文 (每个用户+平台一行，简单起见不做历史分表)
CREATE TABLE IF NOT EXISTS conversations (
  user_id TEXT NOT NULL,
  platform TEXT NOT NULL,        -- telegram / whatsapp
  context_json TEXT,             -- 存最近N轮对话摘要或原始消息数组
  updated_at INTEGER DEFAULT (unixepoch()),
  PRIMARY KEY (user_id, platform)
);

-- Bot 接入配置 (Telegram / WhatsApp token 等，同样加密存储)
CREATE TABLE IF NOT EXISTS bot_configs (
  platform TEXT PRIMARY KEY,     -- telegram / whatsapp
  token_ciphertext TEXT,
  token_iv TEXT,
  webhook_url TEXT,
  status TEXT DEFAULT 'inactive',
  updated_at INTEGER DEFAULT (unixepoch())
);

-- 管理后台登录会话
CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash TEXT PRIMARY KEY,
  created_at INTEGER DEFAULT (unixepoch()),
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_phrases_intent ON phrases(intent_tag);
CREATE INDEX IF NOT EXISTS idx_apikeys_provider ON api_keys(provider, status);
