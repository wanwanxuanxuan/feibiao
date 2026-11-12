/* ============================================================
   微语 · AI 微信助手 前端
   ============================================================ */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const state = {
  cfg: null,
  conn: null,
  contacts: [],
  activeId: null,
  messages: [],
  msgIds: new Set(),
  cursor: 0,
  rev: -1,
  typing: [],
  filter: "all",
  search: "",
  busy: false,
  step: 1,
  mode: "demo",
  drawerType: null,
  polling: false,
};

const SAMPLE_INCOMING = [
  "在吗，想问你个事",
  "刚看到你发的朋友圈，那个地方在哪呀？",
  "明天下午的安排定了吗？",
  "文件我收到了，晚点看完回你",
  "这周末有空一起吃个饭吗",
];

/* ------------------------------------------------------------ 工具 */
const esc = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function fmtTime(ts) {
  if (!ts) return "";
  const d = new Date(ts), now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  if (sameDay) return hm;
  const y = new Date(now.getTime() - 86400000);
  if (d.toDateString() === y.toDateString()) return "昨天";
  if (d.getFullYear() === now.getFullYear()) return `${d.getMonth() + 1}/${d.getDate()}`;
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

function fmtDay(ts) {
  const d = new Date(ts), now = new Date();
  if (d.toDateString() === now.toDateString()) return "今天";
  const y = new Date(now.getTime() - 86400000);
  if (d.toDateString() === y.toDateString()) return "昨天";
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`;
}

const AV = [
  ["#1f7a5f", "#0c4a38"], ["#8a5a2b", "#5b3a16"], ["#3d5a80", "#22344d"],
  ["#7b4b6b", "#4a2a3f"], ["#4f6b2f", "#2f4019"], ["#2f6f7a", "#1a434b"],
  ["#8c4a3f", "#5a2b24"], ["#5a5a8c", "#34345c"],
];
function avatarHTML(name, isGroup = false, cls = "") {
  const n = name || "?";
  let h = 0;
  for (const ch of n) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const [a, b] = AV[h % AV.length];
  return `<span class="avatar ${isGroup ? "is-group" : ""} ${cls}" style="--av1:${a};--av2:${b}">${esc(n.slice(0, 1))}</span>`;
}

const MODE_LABEL = { demo: "演示模式", wecom: "企业微信", gateway: "本地网关" };

function toast(msg, isErr = false) {
  const el = document.createElement("div");
  el.className = "toast" + (isErr ? " is-err" : "");
  el.textContent = msg;
  $("#toasts").appendChild(el);
  setTimeout(() => {
    el.classList.add("is-out");
    setTimeout(() => el.remove(), 300);
  }, 3000);
}

async function api(path, { method = "GET", body } = {}) {
  const res = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try { data = await res.json(); } catch (_) {}
  if (!res.ok) throw new Error(data.error || `请求失败 (${res.status})`);
  return data;
}

const debounce = (fn, ms = 220) => {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
};

/* ------------------------------------------------------------ 启动 */
async function boot() {
  bindEvents();
  startClockTitle();
  try {
    const st = await api("/api/state");
    state.cfg = st.config;
    state.conn = st.connection;
    applyConfigToUI();
    renderContacts();
    if (!st.config.setup_done) openWizard();
    if (st.contacts) { /* noop */ }
    await loadContacts();
    const first = state.contacts.find((c) => c.unread > 0) || state.contacts[0];
    if (first && st.config.setup_done) selectContact(first.id);
  } catch (e) {
    toast("无法连接后端服务：" + e.message, true);
  }
  setInterval(poll, 2500);
}

function startClockTitle() {
  setInterval(() => {
    const now = new Date();
    document.title = `微语 · ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")} · AI 微信助手`;
  }, 30000);
}

/* ------------------------------------------------------------ 联系人 */
async function loadContacts() {
  const r = await api("/api/contacts");
  state.contacts = r.contacts || [];
  state.conn = r.connection;
  renderContacts();
  updateConn();
}

function filteredContacts() {
  let list = state.contacts;
  if (state.filter === "unread") list = list.filter((c) => c.unread > 0);
  if (state.filter === "ai") list = list.filter((c) => c.auto_reply);
  if (state.search) {
    const q = state.search.toLowerCase();
    list = list.filter((c) => c.name.toLowerCase().includes(q));
  }
  return list;
}

function renderContacts() {
  const list = filteredContacts();
  const box = $("#contactList");
  $("#listCount").textContent = state.contacts.length;
  const unread = state.contacts.reduce((n, c) => n + (c.unread || 0), 0);
  $("#unreadChip").textContent = unread ? unread : "";

  if (!list.length) {
    box.innerHTML = `<div class="list-empty">
      <p>${state.search ? "没有匹配的联系人" : "这里还没有会话"}</p>
      <small>${state.search ? "换个关键词试试" : "连接微信后，联系人会自动同步"}</small>
    </div>`;
    return;
  }

  box.innerHTML = list
    .map((c, i) => {
      const active = c.id === state.activeId;
      return `<div class="contact ${active ? "is-active" : ""}" data-id="${esc(c.id)}" style="animation-delay:${Math.min(i * 28, 240)}ms">
        ${avatarHTML(c.name, c.is_group)}
        <div class="contact-body">
          <div class="contact-line">
            <span class="contact-name">${esc(c.name)}</span>
            ${c.auto_reply ? '<span class="ai-pill">AI</span>' : ""}
            <span class="contact-time">${fmtTime(c.last_message_at)}</span>
          </div>
          <div class="contact-preview">
            <span>${esc(c.last_preview || "还没有消息")}</span>
            ${c.unread ? `<em class="unread">${c.unread > 99 ? "99+" : c.unread}</em>` : ""}
          </div>
        </div>
      </div>`;
    })
    .join("");
}

async function selectContact(id) {
  const c = state.contacts.find((x) => x.id === id);
  if (!c) return;
  state.activeId = id;
  $("#app").classList.add("mobile-chat");
  $("#emptyState").hidden = true;
  $("#chatView").hidden = false;
  $("#chatName").textContent = c.name;
  $("#chatSource").textContent = MODE_LABEL[c.source] || c.source;
  $("#chatStatus").textContent = c.is_group ? "群聊" : "单聊";
  $("#prefixChip").textContent = state.cfg.persona.prefix || "（无）";
  $("#contactAuto").setAttribute("aria-checked", String(c.auto_reply));
  $("#simulateBtn").hidden = (state.cfg.wechat.mode || "demo") !== "demo";
  const av = avatarHTML(c.name, c.is_group, "chat-avatar");
  let slot = $("#chatAvatarSlot");
  if (!slot) {
    slot = document.createElement("span");
    slot.id = "chatAvatarSlot";
    $(".chat-head .mobile-back")?.insertAdjacentElement("afterend", slot);
  }
  slot.innerHTML = av;
  renderContacts();
  try {
    await loadMessages(id);
  } catch (e) {
    toast("聊天记录加载失败：" + e.message, true);
  }
  if (c.unread) {
    c.unread = 0;
    renderContacts();
    api(`/api/contacts/${encodeURIComponent(id)}/mark-read`, { method: "POST" }).catch(() => {});
  }
  setTimeout(() => $("#composerInput").focus(), 120);
}

async function loadMessages(id) {
  const r = await api(`/api/contacts/${encodeURIComponent(id)}/messages`);
  state.messages = r.messages || [];
  state.msgIds = new Set(state.messages.map((m) => m.id));
  if (state.messages.length) {
    state.cursor = Math.max(state.cursor, state.messages[state.messages.length - 1].id);
  }
  renderMessages(true);
}

/* ------------------------------------------------------------ 消息 */
function bubbleContent(m) {
  const prefix = state.cfg?.persona?.prefix || "";
  if (m.is_ai && prefix && m.content.startsWith(prefix)) {
    return `<span class="ai-tag">${esc(prefix)}</span>${esc(m.content.slice(prefix.length))}`;
  }
  return esc(m.content);
}

function renderMessages(scroll = false) {
  const box = $("#messages");
  const c = state.contacts.find((x) => x.id === state.activeId);
  let html = "";
  let lastDay = "";
  for (const m of state.messages) {
    const day = fmtDay(m.created_at);
    if (day !== lastDay) {
      html += `<div class="day-divider">${esc(day)}</div>`;
      lastDay = day;
    }
    const mine = m.role === "me" || m.role === "ai";
    const avName = m.role === "ai" ? "AI" : mine ? "我" : c?.name || "?";
    const sender = m.is_ai
      ? `<span class="msg-sender">${esc(state.cfg.persona.name || "小助手")} · AI 代回</span>`
      : m.role === "contact" && c?.is_group
        ? `<span class="msg-sender">${esc(c.name)}</span>`
        : "";
    html += `<div class="msg ${mine ? "is-me" : ""} ${m.is_ai ? "is-ai" : ""}" data-mid="${m.id}">
      ${avatarHTML(avName, false, m.is_ai ? "is-ai-avatar" : "")}
      <div class="msg-main">
        ${sender}
        <div class="bubble">${bubbleContent(m)}</div>
        <span class="msg-time">${new Date(m.created_at).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}${
          m.status === "failed" ? ' · <span class="msg-status is-failed">发送失败</span>' : ""
        }</span>
      </div>
    </div>`;
  }
  if (!state.messages.length) {
    html = `<div class="chat-empty"><b>还没有聊天记录</b><span>连接真实微信后，历史消息会同步显示在这里。</span></div>`;
  }
  box.innerHTML = html;
  if (scroll) box.scrollTop = box.scrollHeight;
  updateTyping();
}

function appendMessage(m) {
  if (!m || state.msgIds.has(m.id)) return;
  if (m.contact_id !== state.activeId) return;
  state.msgIds.add(m.id);
  state.messages.push(m);
  state.cursor = Math.max(state.cursor, m.id);
  renderMessages(true);
}

async function sendMessage(text) {
  const cid = state.activeId;
  if (!cid || state.busy) return;
  text = (text || "").trim();
  if (!text) return;
  state.busy = true;
  $("#sendBtn").disabled = true;
  try {
    const r = await api(`/api/contacts/${encodeURIComponent(cid)}/send`, {
      method: "POST", body: { text },
    });
    $("#composerInput").value = "";
    autoSize($("#composerInput"));
    appendMessage(r.message);
    state.rev = -1;
    loadContacts().catch(() => {});
  } catch (e) {
    toast(e.message, true);
  } finally {
    state.busy = false;
    $("#sendBtn").disabled = false;
  }
}

async function askAIReply() {
  const cid = state.activeId;
  if (!cid) return;
  const btn = $("#aiReplyBtn");
  btn.disabled = true;
  btn.querySelector("span").textContent = "AI 思考中…";
  try {
    const r = await api(`/api/contacts/${encodeURIComponent(cid)}/ai-reply`, { method: "POST" });
    appendMessage(r.message);
    state.rev = -1;
    toast("AI 已代你回复");
    loadContacts().catch(() => {});
  } catch (e) {
    toast(e.message, true);
  } finally {
    btn.disabled = false;
    btn.querySelector("span").textContent = "让 AI 回复";
  }
}

function updateTyping() {
  const on = state.typing.includes(state.activeId);
  $("#typingRow").hidden = !on;
  if (on) {
    const box = $("#messages");
    box.scrollTop = box.scrollHeight;
  }
}

/* ------------------------------------------------------------ 轮询 */
async function poll() {
  if (state.polling) return;
  state.polling = true;
  try {
    const r = await api(`/api/poll?cursor=${state.cursor}&rev=${state.rev}`);
    if (r.rev !== state.rev) {
      state.rev = r.rev;
      if (r.contacts) {
        state.contacts = r.contacts;
        renderContacts();
      }
    }
    state.typing = r.typing || [];
    for (const m of r.messages || []) {
      state.cursor = Math.max(state.cursor, m.id);
      appendMessage(m);
    }
    state.conn = r.connection;
    updateConn();
    updateTyping();
  } catch (_) {
    /* 静默重试 */
  } finally {
    state.polling = false;
  }
}

/* ------------------------------------------------------------ 连接状态 */
function updateConn() {
  const s = state.conn || { status: "disconnected" };
  $$(".conn-dot").forEach((d) => d.setAttribute("data-status", s.status));
  const label = s.status === "connected"
    ? (s.account || MODE_LABEL[s.mode] || "已连接")
    : s.status === "error" ? "连接异常" : s.status === "connecting" ? "连接中…" : "未连接";
  $("#connText").textContent = label + (s.message && s.status === "error" ? ` · ${s.message.slice(0, 24)}` : "");
  $("#arHint").textContent = state.cfg?.persona?.auto_reply
    ? "新消息将自动交给 AI 代回"
    : "已关闭：仅手动让 AI 回复";
  $("#globalAuto").setAttribute("aria-checked", String(!!state.cfg?.persona?.auto_reply));
}

function applyConfigToUI() {
  const p = state.cfg.persona;
  $("#prefixChip").textContent = p.prefix || "（无）";
  $("#globalAuto").setAttribute("aria-checked", String(!!p.auto_reply));
  $("#simulateBtn").hidden = (state.cfg.wechat.mode || "demo") !== "demo";
  sayPersonaName();
  updateConn();
}

function sayPersonaName() {
  const n = state.cfg?.persona?.name || "小助手";
  $("#railAvatar").title = n;
}

/* ------------------------------------------------------------ 首次向导 */
function openWizard() {
  state.step = 1;
  const c = state.cfg;
  state.mode = c.wechat.mode || "demo";
  $("#wzModel").value = c.ai.model || "";
  $("#wzBase").value = c.ai.base_url || "";
  $("#wzKey").value = "";
  $("#wzKey").placeholder = c.ai.has_key ? "已保存 · 留空不修改" : "sk-...";
  const w = c.wechat.wecom;
  $("#wzCorp").value = w.corp_id || "";
  $("#wzAgent").value = w.agent_id || "";
  $("#wzSecret").value = "";
  $("#wzSecret").placeholder = w.secret ? "已保存 · 留空不修改" : "应用管理页里的 Secret";
  $("#wzContactSecret").value = "";
  $("#wzContactSecret").placeholder = w.contact_secret ? "已保存 · 留空不修改" : "用于同步微信客户";
  $("#wzToken").value = w.token || "";
  $("#wzAes").value = "";
  $("#wzAes").placeholder = w.aes_key ? "已保存 · 留空不修改" : "43 位 EncodingAESKey";
  $("#wzGwBase").value = c.wechat.gateway.base_url || "";
  $("#wzGwToken").value = "";
  $("#wzGwToken").placeholder = c.wechat.gateway.token ? "已保存 · 留空不修改" : "可选，Bearer 校验";
  $("#wzName").value = c.persona.name || "";
  $("#wzPrefix").value = c.persona.prefix || "";
  $("#wzPrompt").value = c.persona.prompt || "";
  $("#wzAuto").setAttribute("aria-checked", String(!!c.persona.auto_reply));
  $("#wzCallback").textContent = location.origin + "/api/wecom/callback";
  setMode(state.mode);
  setStep(1);
  updatePrefixPreview();
  $("#wizard").hidden = false;
}

function setStep(n) {
  state.step = n;
  $$("#wizard .wz-pane").forEach((p) => p.classList.toggle("is-on", +p.dataset.pane === n));
  $$("#wzSteps li").forEach((li) => {
    const s = +li.dataset.step;
    li.classList.toggle("is-active", s === n);
    li.classList.toggle("is-done", s < n);
  });
  $("#wzBack").hidden = n === 1;
  $("#wzSkip").hidden = n !== 1;
  $("#wzNext").textContent = n === 3 ? "完成并连接" : "下一步";
}

function setMode(mode) {
  state.mode = mode;
  $$("#modeTabs .mode-tab").forEach((b) => b.classList.toggle("is-on", b.dataset.mode === mode));
  $$("#wizard .mode-pane").forEach((p) => { p.hidden = p.dataset.mode !== mode; });
}

function collectAIPatch() {
  const ai = {
    model: $("#wzModel").value.trim(),
    base_url: $("#wzBase").value.trim(),
  };
  const key = $("#wzKey").value.trim();
  if (key) ai.api_key = key;
  return ai;
}

function collectWechatPatch() {
  const patch = { mode: state.mode, wecom: {}, gateway: {} };
  if (state.mode === "wecom") {
    patch.wecom = {
      corp_id: $("#wzCorp").value.trim(),
      agent_id: $("#wzAgent").value.trim(),
      token: $("#wzToken").value.trim(),
    };
    const s = $("#wzSecret").value.trim();
    const cs = $("#wzContactSecret").value.trim();
    const aes = $("#wzAes").value.trim();
    if (s) patch.wecom.secret = s;
    if (cs) patch.wecom.contact_secret = cs;
    if (aes) patch.wecom.aes_key = aes;
  } else if (state.mode === "gateway") {
    patch.gateway = {
      base_url: $("#wzGwBase").value.trim(),
    };
    const t = $("#wzGwToken").value.trim();
    if (t) patch.gateway.token = t;
  }
  return patch;
}

function collectPersonaPatch() {
  return {
    name: $("#wzName").value.trim() || "小助手",
    prefix: $("#wzPrefix").value.trim(),
    prompt: $("#wzPrompt").value.trim(),
    auto_reply: $("#wzAuto").getAttribute("aria-checked") === "true",
  };
}

function validateStep1() {
  const model = $("#wzModel").value.trim();
  const base = $("#wzBase").value.trim();
  const key = $("#wzKey").value.trim();
  if (!model) { toast("请填写模型名称", true); return false; }
  if (!base) { toast("请填写 API 地址", true); return false; }
  if (!key && !state.cfg.ai.has_key) {
    toast("未填写 API Key：仍可进入演示，但 AI 回复暂不可用", true);
  }
  return true;
}

function updatePrefixPreview() {
  const p = $("#wzPrefix").value.trim() || "";
  $("#wzPrefixPreview").textContent = p + "好的，我马上到。";
}

async function testAI() {
  const btn = $("#wzTestBtn");
  const out = $("#wzTestResult");
  btn.disabled = true;
  out.className = "test-result";
  out.textContent = "正在连接…";
  try {
    const r = await api("/api/config/test-ai", {
      method: "POST",
      body: { ai: collectAIPatch() },
    });
    out.className = "test-result is-ok";
    out.textContent = "连接成功 · " + String(r.reply || "正常").slice(0, 30);
  } catch (e) {
    out.className = "test-result is-err";
    out.textContent = e.message;
  } finally {
    btn.disabled = false;
  }
}

async function finishWizard() {
  if (!validateStep1()) { setStep(1); return; }
  const btn = $("#wzNext");
  btn.disabled = true;
  btn.textContent = "连接中…";
  try {
    const patch = {
      ai: collectAIPatch(),
      wechat: collectWechatPatch(),
      persona: collectPersonaPatch(),
    };
    const saved = await api("/api/config", { method: "POST", body: patch });
    state.cfg = saved.config;
    const conn = await api("/api/wechat/connect", { method: "POST" });
    state.conn = conn.connection;
    await api("/api/setup/complete", { method: "POST" });
    state.cfg.setup_done = true;
    $("#wizard").hidden = true;
    applyConfigToUI();
    await loadContacts();
    const first = state.contacts.find((c) => c.unread > 0) || state.contacts[0];
    if (first) selectContact(first.id);
    toast("接入完成，开始使用吧");
  } catch (e) {
    toast(e.message, true);
    btn.disabled = false;
    btn.textContent = "完成并连接";
  }
}

/* ------------------------------------------------------------ 设置抽屉 */
function openDrawer(type) {
  state.drawerType = type;
  $("#drawerMask").hidden = false;
  $("#drawer").hidden = false;
  if (type === "settings") renderSettings();
  else renderContactSettings();
  $("#drawerBody").scrollTop = 0;
}

function closeDrawer() {
  $("#drawer").hidden = true;
  $("#drawerMask").hidden = true;
  state.drawerType = null;
}

function keyPlaceholder(cfgKey, fallback) {
  return cfgKey ? "已保存 · 留空不修改" : fallback;
}

function renderSettings() {
  const c = state.cfg;
  const mode = c.wechat.mode || "demo";
  const s = state.conn || {};
  $("#drawerBody").innerHTML = `
    <div class="status-card">
      <span class="conn-dot" data-status="${esc(s.status || "disconnected")}"></span>
      <div>
        <b>${esc(s.account || MODE_LABEL[mode] || "未连接")}</b>
        <small>${esc(s.message || (s.status === "connected" ? "通道正常" : "尚未建立连接"))}</small>
      </div>
      <button class="line-btn" id="rcBtn">重连</button>
    </div>

    ${window.__WEIXINCHAT_STATIC__ ? '<p class="hint" style="margin:-6px 0 20px">静态部署版：配置与聊天数据只保存在本机浏览器；企业微信官方通道请使用本地完整版。</p>' : ""}

    <div class="drawer-section">
      <h3>接入方式</h3>
      <div class="mode-tabs" id="drawerModes">
        <button class="mode-tab ${mode === "wecom" ? "is-on" : ""}" data-mode="wecom"><b>企业微信</b><small>官方 API</small></button>
        <button class="mode-tab ${mode === "gateway" ? "is-on" : ""}" data-mode="gateway"><b>本地网关</b><small>扫码登录</small></button>
        <button class="mode-tab ${mode === "demo" ? "is-on" : ""}" data-mode="demo"><b>演示模式</b><small>无需账号</small></button>
      </div>
      <div class="mode-pane" data-drawer-mode="wecom" ${mode !== "wecom" ? "hidden" : ""} style="margin-top:14px">
        <div class="form">
          <label class="field"><span>企业 ID</span><input id="stCorp" value="${esc(c.wechat.wecom.corp_id || "")}" placeholder="ww..." /></label>
          <label class="field"><span>应用 AgentId</span><input id="stAgent" value="${esc(c.wechat.wecom.agent_id || "")}" placeholder="1000002" /></label>
          <label class="field"><span>应用 Secret</span><input id="stSecret" type="password" placeholder="${keyPlaceholder(c.wechat.wecom.secret, "应用 Secret")}" /></label>
          <label class="field"><span>回调 Token</span><input id="stToken" value="${esc(c.wechat.wecom.token || "")}" placeholder="回调 Token" /></label>
          <label class="field"><span>回调 AESKey</span><input id="stAes" type="password" placeholder="${keyPlaceholder(c.wechat.wecom.aes_key, "43 位 EncodingAESKey")}" /></label>
          <p class="hint">回调地址：<code>${esc(location.origin)}/api/wecom/callback</code></p>
        </div>
      </div>
      <div class="mode-pane" data-drawer-mode="gateway" ${mode !== "gateway" ? "hidden" : ""} style="margin-top:14px">
        <div class="form">
          <label class="field"><span>网关地址</span><input id="stGwBase" value="${esc(c.wechat.gateway.base_url || "")}" placeholder="http://127.0.0.1:8788" /></label>
          <label class="field"><span>网关 Token</span><input id="stGwToken" type="password" placeholder="${keyPlaceholder(c.wechat.gateway.token, "可选")}" /></label>
          <p class="hint">网关需实现 <code>/contacts</code>、<code>/messages</code>、<code>/messages/send</code> 三个接口。</p>
        </div>
      </div>
      <div class="mode-pane" data-drawer-mode="demo" ${mode !== "demo" ? "hidden" : ""} style="margin-top:14px">
        <p class="hint">演示模式使用内置联系人与会话，不会连接真实微信。</p>
      </div>
    </div>

    <div class="drawer-section">
      <h3>AI 引擎</h3>
      <div class="form">
        <label class="field"><span>模型名称</span><input id="stModel" value="${esc(c.ai.model || "")}" placeholder="deepseek-chat" /></label>
        <label class="field"><span>API 地址</span><input id="stBase" value="${esc(c.ai.base_url || "")}" placeholder="https://api.deepseek.com/v1" /></label>
        <label class="field"><span>API Key</span><input id="stKey" type="password" placeholder="${keyPlaceholder(c.ai.has_key, "sk-...")}" /></label>
      </div>
    </div>

    <div class="drawer-section">
      <h3>人设与回复</h3>
      <div class="form">
        <label class="field"><span>助手称呼</span><input id="stName" value="${esc(c.persona.name || "")}" /></label>
        <label class="field"><span>回复前缀</span><input id="stPrefix" value="${esc(c.persona.prefix || "")}" placeholder="【AI回复】" /></label>
        <label class="field"><span>人设与规则</span><textarea id="stPrompt" rows="4">${esc(c.persona.prompt || "")}</textarea></label>
        <label class="toggle-line">
          <span><b>AI 自动回复</b><small>收到新消息时自动代回</small></span>
          <button class="switch" id="stAuto" role="switch" aria-checked="${c.persona.auto_reply ? "true" : "false"}"><i></i></button>
        </label>
      </div>
    </div>

    <div class="drawer-section">
      <h3>数据</h3>
      <div class="drawer-actions">
        <button class="line-btn" id="resetDemo">重置演示数据</button>
        <button class="danger-btn" id="disconnectBtn">断开连接</button>
      </div>
    </div>

    <div class="drawer-actions" style="margin-top:6px">
      <button class="primary-btn" id="saveSettings" style="flex:1">保存设置</button>
    </div>
  `;
  bindSettingsEvents(mode);
}

function bindSettingsEvents(mode) {
  let pickedMode = mode;
  $$("#drawerModes .mode-tab").forEach((b) => {
    b.addEventListener("click", () => {
      pickedMode = b.dataset.mode;
      $$("#drawerModes .mode-tab").forEach((x) => x.classList.toggle("is-on", x === b));
      $$("#drawerBody .mode-pane[data-drawer-mode]").forEach((p) => {
        p.hidden = p.dataset.drawerMode !== pickedMode;
      });
      state._pickedMode = pickedMode;
    });
  });
  state._pickedMode = pickedMode;

  $("#stAuto")?.addEventListener("click", (e) => {
    const el = e.currentTarget;
    el.setAttribute("aria-checked", el.getAttribute("aria-checked") === "true" ? "false" : "true");
  });

  $("#rcBtn")?.addEventListener("click", async () => {
    try {
      await saveSettings(true);
      toast("已重新连接");
    } catch (e) { toast(e.message, true); }
  });

  $("#disconnectBtn")?.addEventListener("click", async () => {
    try {
      const r = await api("/api/wechat/disconnect", { method: "POST" });
      state.conn = r.connection;
      updateConn();
      renderSettings();
      toast("已断开连接");
    } catch (e) { toast(e.message, true); }
  });

  $("#resetDemo")?.addEventListener("click", async () => {
    try {
      await api("/api/demo/reset", { method: "POST" });
      await loadContacts();
      toast("演示数据已重置");
      closeDrawer();
    } catch (e) { toast(e.message, true); }
  });

  $("#saveSettings")?.addEventListener("click", async () => {
    const btn = $("#saveSettings");
    btn.disabled = true;
    try {
      await saveSettings(true);
      toast("设置已保存");
      closeDrawer();
    } catch (e) {
      toast(e.message, true);
    } finally {
      btn.disabled = false;
    }
  });
}

async function saveSettings(reconnect) {
  const c = state.cfg;
  const mode = state._pickedMode || c.wechat.mode || "demo";
  const patch = {
    ai: {
      model: $("#stModel").value.trim(),
      base_url: $("#stBase").value.trim(),
    },
    wechat: { mode, wecom: {}, gateway: {} },
    persona: {
      name: $("#stName").value.trim() || "小助手",
      prefix: $("#stPrefix").value.trim(),
      prompt: $("#stPrompt").value.trim(),
      auto_reply: $("#stAuto").getAttribute("aria-checked") === "true",
    },
  };
  const k = $("#stKey").value.trim();
  if (k) patch.ai.api_key = k;

  if (mode === "wecom") {
    patch.wechat.wecom = {
      corp_id: $("#stCorp").value.trim(),
      agent_id: $("#stAgent").value.trim(),
      token: $("#stToken").value.trim(),
    };
    const s = $("#stSecret").value.trim();
    const aes = $("#stAes").value.trim();
    if (s) patch.wechat.wecom.secret = s;
    if (aes) patch.wechat.wecom.aes_key = aes;
  } else if (mode === "gateway") {
    patch.wechat.gateway = { base_url: $("#stGwBase").value.trim() };
    const t = $("#stGwToken").value.trim();
    if (t) patch.wechat.gateway.token = t;
  }

  const saved = await api("/api/config", { method: "POST", body: patch });
  state.cfg = saved.config;
  applyConfigToUI();
  if (reconnect) {
    const r = await api("/api/wechat/connect", { method: "POST" });
    state.conn = r.connection;
    updateConn();
    await loadContacts();
  }
}

/* ------------------------------------------------------------ 会话抽屉 */
function renderContactSettings() {
  const c = state.contacts.find((x) => x.id === state.activeId);
  if (!c) return;
  const demo = (state.cfg.wechat.mode || "demo") === "demo";
  $("#drawerBody").innerHTML = `
    <div class="contact-card">
      ${avatarHTML(c.name, c.is_group)}
      <div>
        <b>${esc(c.name)}</b>
        <small>${c.is_group ? "群聊" : "单聊"} · ${esc(MODE_LABEL[c.source] || c.source)}</small>
      </div>
    </div>
    <div class="drawer-section">
      <h3>AI 接管</h3>
      <label class="toggle-line">
        <span><b>该联系人由 AI 回复</b><small>关闭后，自动回复不会作用于这个会话</small></span>
        <button class="switch" id="ciAuto" role="switch" aria-checked="${c.auto_reply ? "true" : "false"}"><i></i></button>
      </label>
    </div>
    <div class="drawer-section">
      <h3>专属人设</h3>
      <div class="form">
        <label class="field">
          <span>仅对这个联系人生效的补充设定</span>
          <textarea id="ciPersona" rows="4" placeholder="例如：这是房东，语气要客气简短">${esc(c.persona || "")}</textarea>
        </label>
      </div>
    </div>
    <div class="drawer-section">
      <h3>操作</h3>
      <div class="drawer-actions">
        <button class="line-btn" id="ciSave">保存</button>
        <button class="line-btn" id="ciSimulate" ${demo ? "" : "hidden"}>模拟一条新消息</button>
        <button class="danger-btn" id="ciClear">清空聊天记录</button>
      </div>
    </div>
  `;
  $("#ciAuto").addEventListener("click", (e) => {
    const el = e.currentTarget;
    el.setAttribute("aria-checked", el.getAttribute("aria-checked") === "true" ? "false" : "true");
  });
  $("#ciSave").addEventListener("click", async () => {
    try {
      const r = await api(`/api/contacts/${encodeURIComponent(c.id)}`, {
        method: "PATCH",
        body: {
          auto_reply: $("#ciAuto").getAttribute("aria-checked") === "true",
          persona: $("#ciPersona").value.trim(),
        },
      });
      const idx = state.contacts.findIndex((x) => x.id === c.id);
      if (idx >= 0) state.contacts[idx] = r.contact;
      renderContacts();
      $("#contactAuto").setAttribute("aria-checked", String(r.contact.auto_reply));
      state.rev = -1;
      toast("已保存该会话设置");
      closeDrawer();
    } catch (e) { toast(e.message, true); }
  });
  $("#ciSimulate").addEventListener("click", () => simulateIncoming());
  $("#ciClear").addEventListener("click", async () => {
    try {
      await api(`/api/contacts/${encodeURIComponent(c.id)}/clear`, { method: "POST" });
      state.messages = [];
      state.msgIds = new Set();
      renderMessages(true);
      await loadContacts();
      closeDrawer();
      toast("聊天记录已清空");
    } catch (e) { toast(e.message, true); }
  });
}

async function simulateIncoming() {
  if (!state.activeId) return;
  const text = SAMPLE_INCOMING[Math.floor(Math.random() * SAMPLE_INCOMING.length)];
  try {
    const r = await api(`/api/contacts/${encodeURIComponent(state.activeId)}/simulate`, {
      method: "POST", body: { text },
    });
    appendMessage(r.message);
    state.rev = -1;
    loadContacts().catch(() => {});
    toast("已模拟收到消息：" + text);
  } catch (e) { toast(e.message, true); }
}

/* ------------------------------------------------------------ 事件绑定 */
function autoSize(el) {
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 132) + "px";
}

function bindEvents() {
  // 列表
  $("#contactList").addEventListener("click", (e) => {
    const row = e.target.closest(".contact");
    if (row) selectContact(row.dataset.id);
  });

  $("#searchInput").addEventListener("input", debounce((e) => {
    state.search = e.target.value.trim();
    renderContacts();
  }, 180));

  $("#chips").addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    state.filter = chip.dataset.filter;
    $$("#chips .chip").forEach((c) => c.classList.toggle("is-on", c === chip));
    renderContacts();
  });

  // 全局自动回复
  $("#globalAuto").addEventListener("click", async () => {
    const on = $("#globalAuto").getAttribute("aria-checked") !== "true";
    $("#globalAuto").setAttribute("aria-checked", String(on));
    try {
      const r = await api("/api/config", { method: "POST", body: { persona: { auto_reply: on } } });
      state.cfg = r.config;
      applyConfigToUI();
      toast(on ? "已开启 AI 自动回复" : "已关闭 AI 自动回复");
    } catch (e) {
      $("#globalAuto").setAttribute("aria-checked", String(!on));
      toast(e.message, true);
    }
  });

  // 联系人级接管
  $("#contactAuto").addEventListener("click", async () => {
    const el = $("#contactAuto");
    const on = el.getAttribute("aria-checked") !== "true";
    el.setAttribute("aria-checked", String(on));
    try {
      const r = await api(`/api/contacts/${encodeURIComponent(state.activeId)}`, {
        method: "PATCH", body: { auto_reply: on },
      });
      const idx = state.contacts.findIndex((x) => x.id === state.activeId);
      if (idx >= 0) state.contacts[idx] = r.contact;
      renderContacts();
      state.rev = -1;
      toast(on ? "该会话已交给 AI" : "该会话已关闭 AI 接管");
    } catch (e) {
      el.setAttribute("aria-checked", String(!on));
      toast(e.message, true);
    }
  });

  $("#aiReplyBtn").addEventListener("click", askAIReply);
  $("#aiDraftBtn").addEventListener("click", askAIReply);
  $("#sendBtn").addEventListener("click", () => sendMessage($("#composerInput").value));
  $("#simulateBtn").addEventListener("click", simulateIncoming);
  $("#backBtn").addEventListener("click", () => $("#app").classList.remove("mobile-chat"));

  const input = $("#composerInput");
  input.addEventListener("input", () => autoSize(input));
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      sendMessage(input.value);
    }
  });

  $("#contactInfoBtn").addEventListener("click", () => openDrawer("contact"));
  $("#newSettingsBtn").addEventListener("click", () => openDrawer("settings"));
  $("#connManage").addEventListener("click", () => openDrawer("settings"));
  $("#railAvatar").addEventListener("click", () => openDrawer("settings"));
  $("#drawerClose").addEventListener("click", closeDrawer);
  $("#drawerMask").addEventListener("click", closeDrawer);

  $$(".rail-btn").forEach((b) => b.addEventListener("click", () => {
    if (b.dataset.jump === "settings") { openDrawer("settings"); return; }
    if (b.dataset.jump === "contacts") { state.filter = "all"; renderContacts(); return; }
    if (b.dataset.jump === "chats") { $("#app").classList.remove("mobile-chat"); }
  }));

  // 向导
  $("#wzTestBtn").addEventListener("click", testAI);
  $("#wzNext").addEventListener("click", () => {
    if (state.step === 1) {
      if (!validateStep1()) return;
      setStep(2);
    } else if (state.step === 2) {
      setStep(3);
    } else {
      finishWizard();
    }
  });
  $("#wzBack").addEventListener("click", () => setStep(Math.max(1, state.step - 1)));
  $("#wzSkip").addEventListener("click", () => {
    setMode("demo");
    setStep(3);
  });
  $$("#modeTabs .mode-tab").forEach((b) => b.addEventListener("click", () => setMode(b.dataset.mode)));
  $("#wzAuto").addEventListener("click", (e) => {
    const el = e.currentTarget;
    el.setAttribute("aria-checked", el.getAttribute("aria-checked") === "true" ? "false" : "true");
  });
  $("#wzPrefix").addEventListener("input", updatePrefixPreview);

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!$("#drawer").hidden) closeDrawer();
  });
}

boot();
