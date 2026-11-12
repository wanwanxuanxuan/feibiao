"""微信 AI 助手 · 后端服务（Python 标准库 + requests + cryptography）。"""
import json
import os
import re
import threading
import time
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs, unquote

import adapters
import ai_client
import store

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
WEB_DIR = os.path.join(BASE_DIR, "web")
PORT = int(os.environ.get("PORT", "8090"))

TYPING = set()
_typing_lock = threading.Lock()

MIME = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".ico": "image/x-icon",
    ".woff2": "font/woff2",
}


def set_typing(cid, on):
    with _typing_lock:
        if on:
            TYPING.add(cid)
        else:
            TYPING.discard(cid)


def typing_list():
    with _typing_lock:
        return sorted(TYPING)


# ---------------------------------------------------------------- AI reply

def generate_and_send(contact_id, reason="manual"):
    """生成 AI 回复并发送。返回消息 dict。"""
    cfg = store.get_config()
    contact = store.get_contact(contact_id)
    if not contact:
        raise ValueError("联系人不存在")
    set_typing(contact_id, True)
    try:
        history = store.recent_messages(contact_id, 28)
        text = ai_client.build_reply(
            cfg, contact["name"], history,
            is_group=contact["is_group"], extra_persona=contact.get("persona") or "",
        )
        prefix = cfg["persona"].get("prefix") or ""
        content = prefix + text
        msg = store.add_message(contact_id, "ai", content, is_ai=True, status="pending")
        try:
            adapters.send(cfg, contact, content)
            store.update_message(msg["id"], status="sent")
        except Exception as e:
            store.update_message(msg["id"], status="failed")
            raise RuntimeError("发送失败：" + str(e))
        msg["status"] = "sent"
        return msg
    finally:
        set_typing(contact_id, False)


def handle_incoming(contact_id, content, name="", is_group=False, created_at=None):
    cfg = store.get_config()
    store.upsert_contact(contact_id, name or contact_id, "", is_group,
                         cfg["wechat"].get("mode", "demo"))
    ts = int(created_at) if created_at and str(created_at).isdigit() else int(time.time() * 1000)
    if ts < 10_000_000_000:
        ts *= 1000
    msg = store.add_message(contact_id, "contact", content, ts=ts)
    contact = store.get_contact(contact_id)
    store.update_contact(contact_id, {"unread": contact["unread"] + 1})

    if cfg["persona"].get("auto_reply") and contact["auto_reply"]:
        threading.Thread(
            target=_safe_auto_reply, args=(contact_id,), daemon=True
        ).start()
    return msg


def _safe_auto_reply(contact_id):
    try:
        generate_and_send(contact_id, "auto")
    except Exception as e:
        print("[auto-reply]", e)


# ---------------------------------------------------------------- HTTP

class Handler(BaseHTTPRequestHandler):
    server_version = "WeChatAI/1.0"

    def log_message(self, fmt, *args):
        if os.environ.get("QUIET") != "1":
            print("%s - %s" % (self.address_string(), fmt % args))

    # ---- helpers
    def _json(self, data, code=200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _err(self, msg, code=400):
        self._json({"error": str(msg)}, code)

    def _body(self):
        try:
            n = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            n = 0
        if not n:
            return {}
        raw = self.rfile.read(n)
        try:
            return json.loads(raw.decode("utf-8"))
        except Exception:
            return {}

    def _file(self, path):
        full = os.path.normpath(os.path.join(WEB_DIR, path.lstrip("/")))
        if not full.startswith(WEB_DIR + os.sep) or not os.path.isfile(full):
            self._err("Not Found", 404)
            return
        ext = os.path.splitext(full)[1].lower()
        ctype = MIME.get(ext, "application/octet-stream")
        with open(full, "rb") as f:
            data = f.read()
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(data)

    # ---- GET
    def do_GET(self):
        u = urlparse(self.path)
        p, q = unquote(u.path), {k: v[0] for k, v in parse_qs(u.query).items()}
        try:
            if p == "/api/state":
                return self._json({
                    "config": store.public_config(),
                    "connection": adapters.state(),
                    "unread": store.unread_total(),
                })
            if p == "/api/contacts":
                return self._json({
                    "contacts": store.list_contacts(q.get("q", "")),
                    "connection": adapters.state(),
                })
            m = re.match(r"^/api/contacts/([^/]+)/messages$", p)
            if m:
                cid = m.group(1)
                before = q.get("before")
                msgs = store.list_messages(cid, int(before) if before else None, 100)
                return self._json({"messages": msgs, "contact": store.get_contact(cid)})
            m = re.match(r"^/api/contacts/([^/]+)$", p)
            if m:
                c = store.get_contact(m.group(1))
                if not c:
                    return self._err("联系人不存在", 404)
                return self._json({"contact": c})
            if p == "/api/poll":
                cursor = int(q.get("cursor") or 0)
                since_rev = int(q.get("rev") or 0)
                fresh = store.messages_after(cursor)
                return self._json({
                    "cursor": fresh[-1]["id"] if fresh else cursor,
                    "rev": store.rev(),
                    "messages": fresh,
                    "contacts": store.list_contacts() if store.rev() != since_rev else None,
                    "typing": typing_list(),
                    "connection": adapters.state(),
                    "unread": store.unread_total(),
                })
            if p == "/api/wecom/callback":
                cfg = store.get_config()
                try:
                    echo = adapters.verify_url(cfg, q)
                    return self._text(echo)
                except Exception as e:
                    return self._err(str(e))
            if p.startswith("/api/"):
                return self._err("Not Found", 404)
            if p in ("/", "/index.html"):
                return self._file("index.html")
            return self._file(p)
        except Exception as e:
            traceback.print_exc()
            return self._err(e, 500)

    def _text(self, text):
        body = text.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    # ---- POST
    def do_POST(self):
        u = urlparse(self.path)
        p, q = unquote(u.path), {k: v[0] for k, v in parse_qs(u.query).items()}
        # 企业微信回调是加密 XML，必须在读取 JSON body 之前处理
        if p == "/api/wecom/callback":
            try:
                return self._wecom_callback(q)
            except Exception as e:
                traceback.print_exc()
                return self._err(e, 400)
        body = self._body()
        try:
            if p == "/api/config":
                cfg = store.save_config(body)
                return self._json({"config": store.public_config(), "ok": True})
            if p == "/api/config/test-ai":
                cfg = store.get_config()
                merged = store._deep_merge(cfg, body or {})
                if body.get("ai", {}).get("api_key") in ("", None) and cfg["ai"].get("api_key"):
                    merged["ai"]["api_key"] = cfg["ai"]["api_key"]
                txt = ai_client.test(merged)
                return self._json({"ok": True, "reply": txt})
            if p == "/api/wechat/connect":
                if body:
                    store.save_config(body)
                cfg = store.get_config()
                res = adapters.connect(cfg)
                return self._json({"ok": True, "result": res, "connection": adapters.state()})
            if p == "/api/wechat/disconnect":
                with adapters._lock:
                    adapters.STATE.update({"status": "disconnected", "message": "已断开", "account": ""})
                return self._json({"ok": True, "connection": adapters.state()})
            if p == "/api/setup/complete":
                store.save_config({"setup_done": True})
                return self._json({"ok": True, "config": store.public_config()})

            m = re.match(r"^/api/contacts/([^/]+)/send$", p)
            if m:
                cid = m.group(1)
                contact = store.get_contact(cid)
                if not contact:
                    return self._err("联系人不存在", 404)
                text = (body.get("text") or "").strip()
                if not text:
                    return self._err("消息不能为空")
                cfg = store.get_config()
                msg = store.add_message(cid, "me", text, status="pending")
                try:
                    adapters.send(cfg, contact, text)
                    store.update_message(msg["id"], status="sent")
                    msg["status"] = "sent"
                except Exception as e:
                    store.update_message(msg["id"], status="failed")
                    return self._err("发送失败：" + str(e), 502)
                return self._json({"ok": True, "message": msg})

            m = re.match(r"^/api/contacts/([^/]+)/ai-reply$", p)
            if m:
                return self._json({"ok": True, "message": generate_and_send(m.group(1))})

            m = re.match(r"^/api/contacts/([^/]+)/simulate$", p)
            if m:
                cid = m.group(1)
                contact = store.get_contact(cid)
                if not contact:
                    return self._err("联系人不存在", 404)
                text = (body.get("text") or "").strip() or "在吗？想问你个事"
                msg = handle_incoming(cid, text, contact["name"], contact["is_group"])
                return self._json({"ok": True, "message": msg})

            m = re.match(r"^/api/contacts/([^/]+)/mark-read$", p)
            if m:
                store.mark_read(m.group(1))
                return self._json({"ok": True})

            m = re.match(r"^/api/contacts/([^/]+)/clear$", p)
            if m:
                store.clear_messages(m.group(1))
                return self._json({"ok": True})

            if p == "/api/demo/reset":
                store.reset_demo()
                return self._json({"ok": True})

            if p == "/api/ingest":
                return self._ingest(body, q)

            return self._err("Not Found", 404)
        except Exception as e:
            traceback.print_exc()
            return self._err(e, 400)

    def do_PATCH(self):
        p = unquote(urlparse(self.path).path)
        body = self._body()
        m = re.match(r"^/api/contacts/([^/]+)$", p)
        if m:
            c = store.update_contact(m.group(1), body)
            return self._json({"ok": True, "contact": c})
        return self._err("Not Found", 404)

    # ---- gateway webhook / wecom callback
    def _ingest(self, body, q):
        cfg = store.get_config()
        token = cfg["wechat"]["gateway"].get("token") or ""
        given = self.headers.get("X-Gateway-Token") or q.get("token") or ""
        if token and given != token:
            return self._err("token 校验失败", 401)
        cid = body.get("contact_id") or body.get("from")
        content = body.get("content") or body.get("text")
        if not cid or not content:
            return self._err("缺少 contact_id / content")
        cid = cid if cid.startswith("gw:") else "gw:" + str(cid)
        msg = handle_incoming(cid, content, body.get("name", ""),
                              bool(body.get("is_group")), body.get("created_at"))
        return self._json({"ok": True, "message": msg})

    def _wecom_callback(self, q):
        cfg = store.get_config()
        n = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(n) if n else b""
        msg = adapters.parse_callback(cfg, q, raw)
        if msg["type"] == "text" and msg["content"]:
            handle_incoming("wecom:" + msg["from"], msg["content"], "", False,
                            msg.get("create_time"))
        return self._text("success")


def gateway_poller():
    while True:
        time.sleep(6)
        try:
            cfg = store.get_config()
            if cfg["wechat"].get("mode") != "gateway" or adapters.state()["status"] != "connected":
                continue
            for item in adapters.gateway_poll(cfg):
                handle_incoming(item["contact_id"], item["content"], item.get("name", ""),
                                item.get("is_group", False), item.get("created_at"))
        except Exception as e:
            print("[gateway poll]", e)


def main():
    store.seed_demo()
    cfg = store.get_config()
    if cfg["wechat"].get("mode") == "demo":
        adapters.connect_demo(cfg)
    threading.Thread(target=gateway_poller, daemon=True).start()
    srv = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"微信 AI 助手已启动: http://127.0.0.1:{PORT}")
    srv.serve_forever()


if __name__ == "__main__":
    main()
