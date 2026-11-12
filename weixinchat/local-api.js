/* ============================================================
   微语 · 静态部署版（GitHub Pages）
   用浏览器本地存储模拟后端，拦截 /api/* 请求。
   支持：演示模式、自建网关、OpenAI 兼容接口。
   ============================================================ */
(function () {
  "use strict";
  window.__WEIXINCHAT_STATIC__ = true;

  const DB_KEY = "weixinchat.db.v1";
  const realFetch = window.fetch.bind(window);

  const DEFAULT_CONFIG = {
    ai: {
      model: "deepseek-chat",
      base_url: "https://api.deepseek.com/v1",
      api_key: "",
      temperature: 0.8,
    },
    wechat: {
      mode: "demo",
      wecom: { corp_id: "", agent_id: "", secret: "", contact_secret: "", token: "", aes_key: "" },
      gateway: { base_url: "", token: "" },
    },
    persona: {
      name: "小助手",
      prompt:
        "你是一个真诚、自然的微信聊天助手。回复要口语化、简短（1-2 句），" +
        "像一个靠谱的朋友，不使用 markdown、不列清单、不重复对方的话。" +
        "不确定的事情不要编造，可以坦率说明。",
      prefix: "【AI回复】",
      auto_reply: false,
    },
    setup_done: false,
    rev: 1,
  };

  const SEED = [
    ["demo:linwan", "林晚", false, [
      ["contact", "你上次推荐的那家咖啡店我去啦", -86],
      ["me", "怎么样，手冲还行吗？", -85],
      ["contact", "超好喝！就是排队有点久，下次带你去", -80],
      ["contact", "对了，周末有空一起去看展吗？", -12],
    ]],
    ["demo:chenyihang", "陈以航", false, [
      ["me", "方案我改完发你邮箱了", -240],
      ["contact", "收到，我下午过一遍", -236],
      ["contact", "第三页那个数据来源能补一下吗？", -30],
    ]],
    ["demo:suhe", "苏禾", false, [
      ["contact", "在吗，想问你个事", -400],
      ["me", "在的，你说", -399],
      ["contact", "租房合同里押金那条一般怎么写比较稳？", -395],
    ]],
    ["demo:group-product", "产品需求评审群", true, [
      ["contact", "周启明：明天上午十点评审，记得把原型更新一下", -150],
      ["me", "好的，我今晚补完", -148],
      ["contact", "苏禾：我这边把埋点文档也一起带上", -60],
    ]],
    ["demo:azhe", "阿哲", false, [
      ["contact", "球赛看了吗！！最后三分钟太离谱了", -1000],
      ["me", "看麻了，绝杀那球我直接站起来", -998],
    ]],
    ["demo:landlord", "房东王姐", false, [
      ["contact", "小王，这个月水电费 186，方便的时候转我", -2000],
      ["me", "好的王姐，今晚转您", -1990],
    ]],
    ["demo:gunan", "顾南", false, [
      ["contact", "你之前说的那个 AI 工具叫什么来着", -3000],
      ["me", "稍等，我找下链接发你", -2999],
    ]],
    ["demo:zhouqiming", "周启明", false, [
      ["contact", "周报模板发我一份呗", -5000],
      ["me", "OK，马上", -4998],
    ]],
  ];

  /* ---------------- 基础工具 ---------------- */
  const clone = (o) => JSON.parse(JSON.stringify(o));
  function deepMerge(base, patch) {
    const out = { ...base };
    for (const [k, v] of Object.entries(patch || {})) {
      if (v && typeof v === "object" && !Array.isArray(v) && out[k] && typeof out[k] === "object") {
        out[k] = deepMerge(out[k], v);
      } else {
        out[k] = v;
      }
    }
    return out;
  }
  const mask = (s) => (!s ? "" : s.length <= 8 ? "•".repeat(s.length) : s.slice(0, 4) + "••••••" + s.slice(-4));
  const now = () => Date.now();

  /* ---------------- 存储 ---------------- */
  let db;

  function createDb() {
    const d = { config: clone(DEFAULT_CONFIG), contacts: [], messages: [], seq: 0, rev: 1 };
    seedInto(d);
    return d;
  }

  function seedInto(d) {
    d.contacts = [];
    d.messages = [];
    d.seq = 0;
    const base = now();
    for (const [id, name, isGroup, msgs] of SEED) {
      const c = {
        id, name, avatar: "", is_group: isGroup, auto_reply: true, persona: "",
        last_message_at: 0, last_preview: "", unread: 0, source: "demo",
      };
      for (const [role, content, off] of msgs) {
        const ts = base + off * 60000;
        d.seq += 1;
        d.messages.push({
          id: d.seq, contact_id: id, role, content,
          created_at: ts, status: "sent", is_ai: false,
        });
        c.last_message_at = ts;
        c.last_preview = content.replace(/\n/g, " ").slice(0, 60);
      }
      if (msgs.some((m) => m[0] === "contact" && m[2] > -200)) c.unread = 1;
      d.contacts.push(c);
    }
    d.rev += 1;
  }

  function save() {
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(db));
    } catch (e) {
      console.warn("[storage]", e);
    }
  }

  function load() {
    try {
      const raw = localStorage.getItem(DB_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        d.config = deepMerge(clone(DEFAULT_CONFIG), d.config || {});
        if (!Array.isArray(d.contacts) || !d.contacts.length) seedInto(d);
        return d;
      }
    } catch (e) {
      console.warn("[storage]", e);
    }
    const d = createDb();
    try { localStorage.setItem(DB_KEY, JSON.stringify(d)); } catch (_) {}
    return d;
  }

  db = load();

  function bump() {
    db.rev += 1;
    save();
  }

  /* ---------------- 连接状态 ---------------- */
  let connection = {
    mode: db.config.wechat.mode || "demo",
    status: db.config.wechat.mode === "demo" ? "connected" : "disconnected",
    message: db.config.wechat.mode === "demo" ? "演示模式已就绪" : "尚未连接",
    account: db.config.wechat.mode === "demo" ? "演示账号" : "",
  };
  const conn = () => ({ ...connection });
  let gwSince = now();
  let gwTimer = null;

  /* ---------------- 数据读写 ---------------- */
  const getContact = (id) => db.contacts.find((c) => c.id === id);
  const sortedContacts = () =>
    db.contacts.slice().sort((a, b) => (b.last_message_at || 0) - (a.last_message_at || 0) || a.name.localeCompare(b.name, "zh"));
  const unreadTotal = () => db.contacts.reduce((n, c) => n + (c.unread || 0), 0);

  function upsertContact(id, name, avatar, isGroup, source) {
    let c = getContact(id);
    if (c) {
      if (name) c.name = name;
      if (avatar) c.avatar = avatar;
      return c;
    }
    c = {
      id, name: name || id, avatar: avatar || "", is_group: !!isGroup,
      auto_reply: true, persona: "", last_message_at: 0, last_preview: "",
      unread: 0, source: source || "gateway",
    };
    db.contacts.push(c);
    save();
    return c;
  }

  function addMessage(cid, role, content, opts = {}) {
    db.seq += 1;
    const m = {
      id: db.seq, contact_id: cid, role, content,
      created_at: opts.ts || now(), status: opts.status || "sent", is_ai: !!opts.isAI,
    };
    db.messages.push(m);
    const c = getContact(cid);
    if (c) {
      c.last_message_at = m.created_at;
      c.last_preview = content.replace(/\n/g, " ").slice(0, 60);
    }
    bump();
    return m;
  }

  function listMessages(cid, limit = 100) {
    return db.messages.filter((m) => m.contact_id === cid).slice(-limit);
  }

  function publicConfig() {
    const out = clone(db.config);
    out.ai.api_key = mask(out.ai.api_key);
    out.ai.has_key = !!db.config.ai.api_key;
    out.wechat.wecom.secret = mask(out.wechat.wecom.secret);
    out.wechat.wecom.contact_secret = mask(out.wechat.wecom.contact_secret);
    out.wechat.wecom.aes_key = mask(out.wechat.wecom.aes_key);
    out.wechat.gateway.token = mask(out.wechat.gateway.token);
    return out;
  }

  function saveConfig(patch) {
    db.config = deepMerge(db.config, patch || {});
    const p = db.config.persona;
    let prefix = (p.prefix || "").trim();
    if (prefix && !prefix.includes("【") && !prefix.includes("[")) prefix = "【" + prefix + "】";
    p.prefix = prefix;
    bump();
  }

  /* ---------------- AI ---------------- */
  function aiUrl(base) {
    const b = (base || "").trim().replace(/\/+$/, "");
    if (!b) throw new Error("请先填写 API 地址");
    if (b.endsWith("/chat/completions")) return b;
    if (b.endsWith("/v1")) return b + "/chat/completions";
    return b + "/v1/chat/completions";
  }

  async function callAI(cfg, messages, temperature) {
    const key = (cfg.ai.api_key || "").trim();
    if (!key) throw new Error("尚未填写 API Key");
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 90000);
    let res;
    try {
      res = await realFetch(aiUrl(cfg.ai.base_url), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
        body: JSON.stringify({
          model: cfg.ai.model,
          messages,
          temperature: temperature === undefined ? (cfg.ai.temperature || 0.8) : temperature,
          stream: false,
        }),
        signal: ctrl.signal,
      });
    } catch (e) {
      throw new Error("无法连接 AI 接口：" + (e.message || e) + "（若被浏览器拦截，可能是接口未开放 CORS）");
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) {
      let detail = "";
      try { detail = (await res.text()).slice(0, 300); } catch (_) {}
      throw new Error("AI 接口返回 " + res.status + "：" + detail);
    }
    let data;
    try { data = await res.json(); } catch (e) { throw new Error("AI 返回格式异常"); }
    const content = ((data.choices || [{}])[0].message || {}).content || "";
    if (!content.trim()) throw new Error("AI 返回了空内容");
    return content.trim();
  }

  function stripPrefix(text, prefix) {
    const p = (prefix || "").trim();
    if (p && text.trim().startsWith(p)) return text.trim().slice(p.length).trim();
    return text.trim();
  }

  async function buildReply(cfg, contact, history) {
    const p = cfg.persona;
    let system = (p.prompt || "").trim();
    if (contact.persona) system += "\n\n额外设定：" + contact.persona;
    system += `\n\n你正在微信上和「${contact.name}」聊天。只输出你要发送的聊天内容本身，不要加前缀、不要解释。`;
    if (contact.is_group) system += "这是一个群聊，请自然接话，不要 @ 所有人。";
    const msgs = [{ role: "system", content: system }];
    for (const m of history) {
      const content = stripPrefix(m.content, p.prefix);
      if (!content) continue;
      if (m.role === "contact") msgs.push({ role: "user", content });
      else if (m.role === "me" || m.role === "ai") msgs.push({ role: "assistant", content });
    }
    if (msgs.length === 1) msgs.push({ role: "user", content: "（打个招呼）" });
    return (await callAI(cfg, msgs)).slice(0, 600);
  }

  const typing = new Set();

  async function generateAI(cid) {
    const contact = getContact(cid);
    if (!contact) throw new Error("联系人不存在");
    const cfg = db.config;
    typing.add(cid);
    try {
      const history = listMessages(cid, 28);
      const text = await buildReply(cfg, contact, history);
      const content = (cfg.persona.prefix || "") + text;
      const msg = addMessage(cid, "ai", content, { isAI: true, status: "pending" });
      try {
        await sendViaChannel(contact, content);
        msg.status = "sent";
        save();
      } catch (e) {
        msg.status = "failed";
        save();
        throw new Error("发送失败：" + e.message);
      }
      return msg;
    } finally {
      typing.delete(cid);
    }
  }

  function scheduleAutoReply(cid) {
    const c = getContact(cid);
    if (!db.config.persona.auto_reply || !c || !c.auto_reply) return;
    setTimeout(() => {
      generateAI(cid).catch((e) => console.warn("[auto-reply]", e.message));
    }, 500);
  }

  function addIncoming(cid, content, name, isGroup, createdAt) {
    upsertContact(cid, name, "", isGroup, "gateway");
    const ts = createdAt && /^\d+$/.test(String(createdAt)) ? Number(createdAt) : now();
    const m = addMessage(cid, "contact", content, { ts: ts < 1e10 ? ts * 1000 : ts });
    const c = getContact(cid);
    c.unread = (c.unread || 0) + 1;
    bump();
    scheduleAutoReply(cid);
    return m;
  }

  /* ---------------- 网关 ---------------- */
  const gwBase = () => (db.config.wechat.gateway.base_url || "").trim().replace(/\/+$/, "");
  const gwHeaders = () => {
    const h = { "Content-Type": "application/json" };
    const t = db.config.wechat.gateway.token;
    if (t) { h.Authorization = "Bearer " + t; h["X-Gateway-Token"] = t; }
    return h;
  };

  async function connectGateway() {
    const base = gwBase();
    if (!base) throw new Error("请填写本地网关地址");
    let res;
    try {
      res = await realFetch(base + "/contacts", { headers: gwHeaders() });
    } catch (e) {
      throw new Error("无法访问网关：" + (e.message || e) + "（请在网关开启 CORS）");
    }
    if (!res.ok) throw new Error("网关返回 " + res.status);
    const data = await res.json();
    const items = Array.isArray(data) ? data : (data.contacts || data.data || data.list || []);
    let n = 0;
    for (const it of items) {
      if (!it || typeof it !== "object") continue;
      const raw = String(it.id || it.contact_id || it.wxid || it.userid || "");
      if (!raw) continue;
      upsertContact(raw.startsWith("gw:") ? raw : "gw:" + raw, it.name || it.nickname || raw, it.avatar || "",
        !!(it.is_group || it.isRoom || it.room), "gateway");
      n += 1;
    }
    gwSince = now();
    connection = { mode: "gateway", status: "connected", message: "网关已连接", account: `网关 · ${n} 位联系人` };
    startGatewayPoll();
  }

  async function sendViaChannel(contact, text) {
    if (db.config.wechat.mode !== "gateway") return true;
    const base = gwBase();
    if (!base) throw new Error("网关地址为空");
    const raw = contact.id.startsWith("gw:") ? contact.id.slice(3) : contact.id;
    const res = await realFetch(base + "/messages/send", {
      method: "POST", headers: gwHeaders(),
      body: JSON.stringify({ contact_id: raw, content: text }),
    });
    if (!res.ok) throw new Error("网关发送失败 " + res.status);
    return true;
  }

  function startGatewayPoll() {
    stopGatewayPoll();
    gwTimer = setInterval(gatewayPoll, 6000);
  }
  function stopGatewayPoll() {
    if (gwTimer) clearInterval(gwTimer);
    gwTimer = null;
  }

  async function gatewayPoll() {
    if (db.config.wechat.mode !== "gateway" || connection.status !== "connected") return;
    const base = gwBase();
    if (!base) return;
    try {
      const res = await realFetch(`${base}/messages?since=${gwSince}`, { headers: gwHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      const items = Array.isArray(data) ? data : (data.messages || []);
      for (const it of items) {
        if (!it || typeof it !== "object") continue;
        const cid = String(it.contact_id || it.from || "");
        const content = it.content || it.text || "";
        if (!cid || !content) continue;
        addIncoming(cid.startsWith("gw:") ? cid : "gw:" + cid, content, it.name || "", !!it.is_group, it.created_at);
      }
      gwSince = now();
    } catch (e) {
      console.warn("[gateway poll]", e.message);
    }
  }

  /* ---------------- 路由 ---------------- */
  async function handle(url, init) {
    const u = new URL(url, location.href);
    const p = decodeURIComponent(u.pathname).replace(/^\/api/, "");
    const method = (init.method || "GET").toUpperCase();
    const body = init.body ? JSON.parse(init.body) : {};
    const q = u.searchParams;

    if (method === "GET" && p === "/state") {
      return { config: publicConfig(), connection: conn(), unread: unreadTotal() };
    }
    if (method === "GET" && p === "/contacts") {
      const kw = (q.get("q") || "").toLowerCase();
      return {
        contacts: kw ? sortedContacts().filter((c) => c.name.toLowerCase().includes(kw)) : sortedContacts(),
        connection: conn(),
      };
    }
    let m = p.match(/^\/contacts\/([^/]+)\/messages$/);
    if (method === "GET" && m) {
      const cid = m[1];
      const before = q.get("before");
      let list = db.messages.filter((x) => x.contact_id === cid);
      if (before) list = list.filter((x) => x.id < Number(before));
      return { messages: list.slice(-100), contact: getContact(cid) };
    }
    m = p.match(/^\/contacts\/([^/]+)$/);
    if (method === "GET" && m) {
      const c = getContact(m[1]);
      if (!c) throw new Error("联系人不存在");
      return { contact: c };
    }
    if (method === "GET" && p === "/poll") {
      const cursor = Number(q.get("cursor") || 0);
      const rev = Number(q.get("rev") || 0);
      const fresh = db.messages.filter((x) => x.id > cursor);
      return {
        cursor: fresh.length ? fresh[fresh.length - 1].id : cursor,
        rev: db.rev,
        messages: fresh,
        contacts: db.rev !== rev ? sortedContacts() : null,
        typing: [...typing],
        connection: conn(),
        unread: unreadTotal(),
      };
    }
    if (method === "POST" && p === "/config") {
      saveConfig(body);
      return { config: publicConfig(), ok: true };
    }
    if (method === "POST" && p === "/config/test-ai") {
      const cfg = deepMerge(clone(db.config), body || {});
      if (!(body.ai && body.ai.api_key) && db.config.ai.api_key) cfg.ai.api_key = db.config.ai.api_key;
      const reply = await callAI(cfg, [
        { role: "system", content: "你是连通性测试助手。" },
        { role: "user", content: "只回复两个字：正常" },
      ], 0);
      return { ok: true, reply };
    }
    if (method === "POST" && p === "/wechat/connect") {
      if (body && Object.keys(body).length) saveConfig(body);
      const mode = db.config.wechat.mode;
      if (mode === "demo") {
        if (!db.contacts.length) { seedInto(db); bump(); }
        connection = { mode: "demo", status: "connected", message: "演示模式已就绪", account: "演示账号" };
        return { ok: true, result: { ok: true }, connection: conn() };
      }
      if (mode === "gateway") {
        try {
          await connectGateway();
        } catch (e) {
          connection = { mode: "gateway", status: "error", message: e.message, account: "" };
          throw e;
        }
        return { ok: true, result: { ok: true }, connection: conn() };
      }
      throw new Error("静态部署版无法安全调用企业微信官方接口：Secret 需要保存在服务端，且官方接口要配置 IP 白名单。请在本机运行 Python 完整版，或改用自建网关 / 演示模式。");
    }
    if (method === "POST" && p === "/wechat/disconnect") {
      stopGatewayPoll();
      connection = { mode: db.config.wechat.mode, status: "disconnected", message: "已断开", account: "" };
      return { ok: true, connection: conn() };
    }
    if (method === "POST" && p === "/setup/complete") {
      saveConfig({ setup_done: true });
      return { ok: true, config: publicConfig() };
    }
    m = p.match(/^\/contacts\/([^/]+)\/send$/);
    if (method === "POST" && m) {
      const cid = m[1];
      const c = getContact(cid);
      if (!c) throw new Error("联系人不存在");
      const text = (body.text || "").trim();
      if (!text) throw new Error("消息不能为空");
      const msg = addMessage(cid, "me", text, { status: "pending" });
      try {
        await sendViaChannel(c, text);
        msg.status = "sent";
        save();
      } catch (e) {
        msg.status = "failed";
        save();
        throw new Error("发送失败：" + e.message);
      }
      return { ok: true, message: msg };
    }
    m = p.match(/^\/contacts\/([^/]+)\/ai-reply$/);
    if (method === "POST" && m) {
      return { ok: true, message: await generateAI(m[1]) };
    }
    m = p.match(/^\/contacts\/([^/]+)\/simulate$/);
    if (method === "POST" && m) {
      const c = getContact(m[1]);
      if (!c) throw new Error("联系人不存在");
      const text = (body.text || "").trim() || "在吗？想问你个事";
      return { ok: true, message: addIncoming(c.id, text, c.name, c.is_group) };
    }
    m = p.match(/^\/contacts\/([^/]+)\/mark-read$/);
    if (method === "POST" && m) {
      const c = getContact(m[1]);
      if (c) { c.unread = 0; bump(); }
      return { ok: true };
    }
    m = p.match(/^\/contacts\/([^/]+)\/clear$/);
    if (method === "POST" && m) {
      const c = getContact(m[1]);
      db.messages = db.messages.filter((x) => x.contact_id !== c.id);
      if (c) { c.last_preview = ""; c.last_message_at = 0; c.unread = 0; }
      bump();
      return { ok: true };
    }
    if (method === "PATCH") {
      m = p.match(/^\/contacts\/([^/]+)$/);
      if (m) {
        const c = getContact(m[1]);
        if (!c) throw new Error("联系人不存在");
        if ("auto_reply" in body) c.auto_reply = !!body.auto_reply;
        if ("persona" in body) c.persona = body.persona || "";
        bump();
        return { ok: true, contact: c };
      }
    }
    if (method === "POST" && p === "/demo/reset") {
      seedInto(db);
      bump();
      if (db.config.wechat.mode === "demo") {
        connection = { mode: "demo", status: "connected", message: "演示模式已就绪", account: "演示账号" };
      }
      return { ok: true };
    }
    throw new Error("Not Found");
  }

  const jsonRes = (data, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });

  window.fetch = async function (input, init) {
    const url = typeof input === "string" ? input : input.url;
    if (/^https?:/.test(url) || url.startsWith("//")) return realFetch(input, init);
    if (url.startsWith("/api/")) {
      try {
        const data = await handle(url, init || {});
        return jsonRes(data);
      } catch (e) {
        return jsonRes({ error: e.message || String(e) }, 400);
      }
    }
    return realFetch(input, init);
  };
})();
