"""SQLite 存储层：配置、联系人、消息。"""
import json
import os
import sqlite3
import threading
import time

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
DB_PATH = os.path.join(DATA_DIR, "app.db")

_lock = threading.RLock()
_conn = None

DEFAULT_CONFIG = {
    "ai": {
        "model": "deepseek-chat",
        "base_url": "https://api.deepseek.com/v1",
        "api_key": "",
        "temperature": 0.8,
    },
    "wechat": {
        "mode": "demo",
        "wecom": {
            "corp_id": "", "agent_id": "", "secret": "",
            "contact_secret": "", "token": "", "aes_key": "",
        },
        "gateway": {"base_url": "", "token": ""},
    },
    "persona": {
        "name": "小助手",
        "prompt": (
            "你是一个真诚、自然的微信聊天助手。回复要口语化、简短（1-2 句），"
            "像一个靠谱的朋友，不使用 markdown、不列清单、不重复对方的话。"
            "不确定的事情不要编造，可以坦率说明。"
        ),
        "prefix": "【AI回复】",
        "auto_reply": False,
    },
    "setup_done": False,
    "rev": 1,
}


def _db():
    global _conn
    if _conn is None:
        os.makedirs(DATA_DIR, exist_ok=True)
        _conn = sqlite3.connect(DB_PATH, check_same_thread=False)
        _conn.row_factory = sqlite3.Row
        _conn.execute("PRAGMA journal_mode=WAL")
        _conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS contacts (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                avatar TEXT,
                is_group INTEGER DEFAULT 0,
                auto_reply INTEGER DEFAULT 1,
                persona TEXT DEFAULT '',
                last_message_at INTEGER DEFAULT 0,
                last_preview TEXT DEFAULT '',
                unread INTEGER DEFAULT 0,
                source TEXT DEFAULT 'demo',
                meta TEXT DEFAULT '{}'
            );
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                contact_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                status TEXT DEFAULT 'sent',
                is_ai INTEGER DEFAULT 0,
                meta TEXT DEFAULT '{}'
            );
            CREATE INDEX IF NOT EXISTS idx_msg_contact ON messages(contact_id, id);
            """
        )
        _conn.commit()
    return _conn


def _deep_merge(base, patch):
    out = dict(base)
    for k, v in (patch or {}).items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = _deep_merge(out[k], v)
        else:
            out[k] = v
    return out


def get_setting(key, default=None):
    with _lock:
        row = _db().execute("SELECT value FROM settings WHERE key=?", (key,)).fetchone()
    if not row:
        return default
    try:
        return json.loads(row["value"])
    except Exception:
        return default


def set_setting(key, value):
    with _lock:
        _db().execute(
            "INSERT INTO settings(key,value) VALUES(?,?) "
            "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            (key, json.dumps(value, ensure_ascii=False)),
        )
        _db().commit()


def get_config():
    stored = get_setting("config", {}) or {}
    return _deep_merge(DEFAULT_CONFIG, stored)


def save_config(patch):
    cfg = _deep_merge(get_config(), patch)
    persona = cfg.get("persona") or {}
    prefix = (persona.get("prefix") or "").strip()
    # 用户只填了「AI回复」时，自动补上中文方括号
    if prefix and "【" not in prefix and "[" not in prefix:
        prefix = "【" + prefix + "】"
    persona["prefix"] = prefix
    cfg["persona"] = persona
    cfg["rev"] = int(cfg.get("rev", 1)) + 1
    set_setting("config", cfg)
    return cfg


def bump_rev():
    cfg = get_config()
    cfg["rev"] = int(cfg.get("rev", 1)) + 1
    set_setting("config", cfg)
    return cfg["rev"]


def rev():
    return int(get_config().get("rev", 1))


def mask_key(key):
    if not key:
        return ""
    if len(key) <= 8:
        return "•" * len(key)
    return key[:4] + "•" * 6 + key[-4:]


def public_config():
    cfg = get_config()
    out = json.loads(json.dumps(cfg))
    out["ai"]["api_key"] = mask_key(out["ai"].get("api_key", ""))
    out["ai"]["has_key"] = bool(cfg["ai"].get("api_key"))
    out["wechat"]["wecom"]["secret"] = mask_key(out["wechat"]["wecom"].get("secret", ""))
    out["wechat"]["wecom"]["contact_secret"] = mask_key(out["wechat"]["wecom"].get("contact_secret", ""))
    out["wechat"]["wecom"]["aes_key"] = mask_key(out["wechat"]["wecom"].get("aes_key", ""))
    out["wechat"]["gateway"]["token"] = mask_key(out["wechat"]["gateway"].get("token", ""))
    return out


# ---------------- contacts ----------------

def _contact_row(row):
    return {
        "id": row["id"],
        "name": row["name"],
        "avatar": row["avatar"] or "",
        "is_group": bool(row["is_group"]),
        "auto_reply": bool(row["auto_reply"]),
        "persona": row["persona"] or "",
        "last_message_at": row["last_message_at"],
        "last_preview": row["last_preview"],
        "unread": row["unread"],
        "source": row["source"],
    }


def upsert_contact(cid, name, avatar="", is_group=False, source="demo", meta=None):
    with _lock:
        db = _db()
        row = db.execute("SELECT id FROM contacts WHERE id=?", (cid,)).fetchone()
        if row:
            if name:
                db.execute("UPDATE contacts SET name=? WHERE id=?", (name, cid))
        else:
            db.execute(
                "INSERT INTO contacts(id,name,avatar,is_group,source,meta) VALUES(?,?,?,?,?,?)",
                (cid, name or cid, avatar, 1 if is_group else 0, source,
                 json.dumps(meta or {}, ensure_ascii=False)),
            )
        db.commit()
        return get_contact(cid)


def get_contact(cid):
    with _lock:
        row = _db().execute("SELECT * FROM contacts WHERE id=?", (cid,)).fetchone()
    return _contact_row(row) if row else None


def list_contacts(q=""):
    sql = "SELECT * FROM contacts"
    args = []
    if q:
        sql += " WHERE name LIKE ?"
        args.append("%" + q + "%")
    sql += " ORDER BY last_message_at DESC, name ASC"
    with _lock:
        rows = _db().execute(sql, args).fetchall()
    return [_contact_row(r) for r in rows]


def update_contact(cid, patch):
    allowed = {"auto_reply", "persona", "unread"}
    sets, args = [], []
    for k, v in patch.items():
        if k in allowed:
            sets.append(f"{k}=?")
            args.append(int(v) if k in ("auto_reply", "unread") else v)
    if not sets:
        return get_contact(cid)
    args.append(cid)
    with _lock:
        _db().execute(f"UPDATE contacts SET {', '.join(sets)} WHERE id=?", args)
        _db().commit()
    bump_rev()
    return get_contact(cid)


def mark_read(cid):
    with _lock:
        _db().execute("UPDATE contacts SET unread=0 WHERE id=?", (cid,))
        _db().commit()
    bump_rev()


# ---------------- messages ----------------

def _message_row(row):
    return {
        "id": row["id"],
        "contact_id": row["contact_id"],
        "role": row["role"],
        "content": row["content"],
        "created_at": row["created_at"],
        "status": row["status"],
        "is_ai": bool(row["is_ai"]),
    }


def add_message(cid, role, content, is_ai=False, status="sent", ts=None):
    ts = int(ts or time.time() * 1000)
    with _lock:
        db = _db()
        cur = db.execute(
            "INSERT INTO messages(contact_id,role,content,created_at,status,is_ai) "
            "VALUES(?,?,?,?,?,?)",
            (cid, role, content, ts, status, 1 if is_ai else 0),
        )
        preview = content.replace("\n", " ")[:60]
        db.execute(
            "UPDATE contacts SET last_message_at=?, last_preview=? WHERE id=?",
            (ts, preview, cid),
        )
        db.commit()
        mid = cur.lastrowid
        row = db.execute("SELECT * FROM messages WHERE id=?", (mid,)).fetchone()
    bump_rev()
    return _message_row(row)


def update_message(mid, **patch):
    allowed = {"content", "status"}
    sets, args = [], []
    for k, v in patch.items():
        if k in allowed:
            sets.append(f"{k}=?")
            args.append(v)
    if not sets:
        return
    args.append(mid)
    with _lock:
        _db().execute(f"UPDATE messages SET {', '.join(sets)} WHERE id=?", args)
        _db().commit()


def list_messages(cid, before_id=None, limit=80):
    sql = "SELECT * FROM messages WHERE contact_id=?"
    args = [cid]
    if before_id:
        sql += " AND id<?"
        args.append(int(before_id))
    sql += " ORDER BY id DESC LIMIT ?"
    args.append(limit)
    with _lock:
        rows = _db().execute(sql, args).fetchall()
    return [_message_row(r) for r in reversed(rows)]


def recent_messages(cid, limit=24):
    return list_messages(cid, limit=limit)


def messages_after(after_id=0, limit=200):
    with _lock:
        rows = _db().execute(
            "SELECT * FROM messages WHERE id>? ORDER BY id ASC LIMIT ?",
            (int(after_id), limit),
        ).fetchall()
    return [_message_row(r) for r in rows]


def unread_total():
    with _lock:
        row = _db().execute("SELECT COALESCE(SUM(unread),0) AS n FROM contacts").fetchone()
    return int(row["n"])


# ---------------- demo seed ----------------

def seed_demo():
    if list_contacts():
        return
    now = int(time.time() * 1000)
    seed = [
        ("demo:linwan", "林晚", False, [
            ("contact", "你上次推荐的那家咖啡店我去啦", -86),
            ("me", "怎么样，手冲还行吗？", -85),
            ("contact", "超好喝！就是排队有点久，下次带你去", -80),
            ("contact", "对了，周末有空一起去看展吗？", -12),
        ]),
        ("demo:chenyihang", "陈以航", False, [
            ("me", "方案我改完发你邮箱了", -240),
            ("contact", "收到，我下午过一遍", -236),
            ("contact", "第三页那个数据来源能补一下吗？", -30),
        ]),
        ("demo:suhe", "苏禾", False, [
            ("contact", "在吗，想问你个事", -400),
            ("me", "在的，你说", -399),
            ("contact", "租房合同里押金那条一般怎么写比较稳？", -395),
        ]),
        ("demo:group-product", "产品需求评审群", True, [
            ("contact", "周启明：明天上午十点评审，记得把原型更新一下", -150),
            ("me", "好的，我今晚补完", -148),
            ("contact", "苏禾：我这边把埋点文档也一起带上", -60),
        ]),
        ("demo:azhe", "阿哲", False, [
            ("contact", "球赛看了吗！！最后三分钟太离谱了", -1000),
            ("me", "看麻了，绝杀那球我直接站起来", -998),
        ]),
        ("demo:landlord", "房东王姐", False, [
            ("contact", "小王，这个月水电费 186，方便的时候转我", -2000),
            ("me", "好的王姐，今晚转您", -1990),
        ]),
        ("demo:gunan", "顾南", False, [
            ("contact", "你之前说的那个 AI 工具叫什么来着", -3000),
            ("me", "稍等，我找下链接发你", -2999),
        ]),
        ("demo:zhouqiming", "周启明", False, [
            ("contact", "周报模板发我一份呗", -5000),
            ("me", "OK，马上", -4998),
        ]),
    ]
    for cid, name, is_group, msgs in seed:
        upsert_contact(cid, name, "", is_group, "demo")
        for role, content, offset in msgs:
            ts = now + offset * 60_000
            with _lock:
                db = _db()
                db.execute(
                    "INSERT INTO messages(contact_id,role,content,created_at,is_ai) VALUES(?,?,?,?,0)",
                    (cid, role, content, ts),
                )
                db.commit()
            set_last(cid, content, ts)
        if any(m[0] == "contact" and m[2] > -200 for m in msgs):
            with _lock:
                _db().execute("UPDATE contacts SET unread=unread+1 WHERE id=?", (cid,))
                _db().commit()


def set_last(cid, content, ts):
    with _lock:
        _db().execute(
            "UPDATE contacts SET last_message_at=?, last_preview=? WHERE id=?",
            (ts, content.replace("\n", " ")[:60], cid),
        )
        _db().commit()


def ensure_demo_seed():
    seed_demo()


def reset_demo():
    with _lock:
        db = _db()
        db.execute("DELETE FROM messages")
        db.execute("DELETE FROM contacts")
        db.commit()
    seed_demo()


def clear_messages(cid):
    with _lock:
        _db().execute("DELETE FROM messages WHERE contact_id=?", (cid,))
        _db().execute("UPDATE contacts SET last_preview='', last_message_at=0, unread=0 WHERE id=?", (cid,))
        _db().commit()
