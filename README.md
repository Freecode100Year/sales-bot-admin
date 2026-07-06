# 销售 Bot 管理后台 — 代码骨架

Cloudflare Pages + Functions + D1，用于管理 Telegram/WhatsApp 销售机器人的商品库、话术库、API Key 池和会话上下文。

## 目录结构

```
sales-bot-admin/
├── schema.sql                    D1 数据库表结构
├── wrangler.toml                 Pages 配置
├── public/
│   ├── index.html                登录页
│   └── admin.html                管理后台 SPA (单文件，商品/短语/Key/会话/Telegram 五个面板)
└── functions/
    ├── _lib/
    │   ├── crypto.js              AES-GCM 加解密封装
    │   └── jwt.js                 JWT 签发/校验
    ├── api/
    │   ├── _middleware.js         登录鉴权中间件，保护所有 /api/* 路由
    │   ├── auth.js                 登录/登出
    │   ├── products.js             商品库 CRUD
    │   ├── phrases.js               短语库 CRUD
    │   ├── keys.js                  API Key 加密管理
    │   ├── conversations.js         会话上下文查看/清除
    │   └── telegram.js              Telegram Bot 配置 + setWebhook
    └── webhook/
        └── telegram.js             Telegram 实际消息接收端 (公开，无需登录)
```

## 部署步骤

### 1. 创建 D1 数据库
```bash
wrangler d1 create sales-bot-db
```
把返回的 `database_id` 填入 `wrangler.toml`。

### 2. 初始化表结构
```bash
wrangler d1 execute sales-bot-db --file=schema.sql --remote
```

### 3. 设置 Secrets（三个都必须设置）
```bash
wrangler pages secret put ADMIN_PASSWORD    # 后台登录密码
wrangler pages secret put JWT_SECRET        # 随便一串足够长的随机字符串
wrangler pages secret put MASTER_SECRET     # 用于加密 API Key/Token 的主密钥，务必妥善保管且不要复用
```

生成随机密钥示例：
```bash
openssl rand -base64 32
```

### 4. 部署
```bash
wrangler pages deploy public --project-name=sales-bot-admin
```

### 5. 首次使用流程
1. 访问 `https://你的域名/index.html`，用 ADMIN_PASSWORD 登录
2. 在「Telegram 接入」面板填入 Bot Token（从 @BotFather 获取）和 Webhook 地址
   （即 `https://你的域名/webhook/telegram`），保存后会自动调用 Telegram `setWebhook`
3. 在「API Key」面板添加至少一个 Anthropic key（当前 webhook 骨架默认调用 anthropic provider）
4. 在「商品库」「短语库」面板录入数据
5. 给 Telegram Bot 发消息测试

## 安全设计要点

- **API Key / Bot Token 全程不落地明文**：提交后立即用 `MASTER_SECRET` 做 AES-GCM 加密，D1 中只存密文+IV，管理页面任何时候都不回显明文
- **登录用 HttpOnly Cookie + JWT**，无第三方依赖，7天过期
- **中间件保护**：`functions/api/_middleware.js` 保护所有 `/api/*` 路由；`functions/webhook/*` 目录不受影响，因为它是独立目录，Telegram 才能免鉴权调用

## 已知骨架限制（生产环境前需要补齐）

1. **Key 轮替目前是简单查询，不是原子操作**——`functions/webhook/telegram.js` 里用 `ORDER BY used_count ASC LIMIT 1` 选 key，高并发下会有竞态（两个请求同时选中同一个快到限额的 key）。生产环境请替换为 **Durable Object** 做单实例原子计数，具体做法：
   - 新建一个 DO class，内部维护 key 列表和计数
   - Worker 通过 `env.KEY_POOL.get(id).fetch()` 调用 DO 的方法完成"取key+计数"的原子操作
2. **商品语义检索尚未接入**——`products.js` 里有 TODO 注释标注 Vectorize 接入点，当前商品库只能被动等待你在 prompt 里手动拼接，还没有做"用户提问 → 向量召回相关商品"这一步
3. **WhatsApp 接入未实现**——当前只有 Telegram 骨架，WhatsApp 官方 Cloud API 的 webhook 处理器结构类似 `functions/webhook/telegram.js`，可以照着写一份 `functions/webhook/whatsapp.js`
4. **会话上下文没有做长度/token 上限管理**——目前只是简单存最近 20 条消息，长对话可能超出 AI 调用的 context 限制，需要加摘要压缩逻辑
5. **没有做限流/防刷**——恶意用户狂发消息会消耗 API 配额，建议在 webhook 层加一个基于 user_id 的简单速率限制（比如用 KV 存最后消息时间戳）

## 建议接下来做的三件事（按优先级）
1. 把 Key 轮替换成 Durable Object（避免真实并发时计数出错）
2. 接入 Vectorize 做商品语义检索（避免 AI 编造不存在的商品）
3. 补 WhatsApp webhook（复用 telegram.js 的结构）
