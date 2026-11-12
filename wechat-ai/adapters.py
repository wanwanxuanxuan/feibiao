"""微信接入适配层：演示 / 本地网关 / 企业微信官方接口。"""
import base64
import hashlib
import json
import struct
import threading
import time
import xml.etree.ElementTree as ET

import requests
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

import store

STATE = {
    "mode": "demo",
    "status": "disconnected",   # disconnected | connecting | connected | error
    "message": "",
    "account": "",
    "since": 0,
}
_lock = threading.RLock()
_wecom_token = {"value": "", "expires_at": 0, "secret": ""}


def state():
    with _lock:
        return dict(STATE)


def _set(status=None, message=None, account=None, mode=None):
    with _lock:
        if status is not None:
            STATE["status"] = status
        if message is not None:
            STATE["message"] = message
        if account is not None:
            STATE["account"] = account
        if mode is not None:
            STATE["mode"] = mode


# ------------------------------------------------------------------ demo

def connect_demo(cfg):
    store.ensure_demo_seed()
    _set(mode="demo", status="connected", account="演示账号", message="演示模式已就绪")
    return {"ok": True, "message": "演示模式已就绪", "account": "演示账号"}


# ------------------------------------------------------------------ gateway

def _gw_headers(token):
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = "Bearer " + token
        h["X-Gateway-Token"] = token
    return h


def _gw_base(cfg):
    base = (cfg["wechat"]["gateway"].get("base_url") or "").strip().rstrip("/")
    if not base:
        raise ValueError("请填写本地网关地址，例如 http://127.0.0.1:8788")
    return base


def connect_gateway(cfg):
    cfg_gw = cfg["wechat"]["gateway"]
    base = _gw_base(cfg)
    headers = _gw_headers(cfg_gw.get("token", ""))
    _set(mode="gateway", status="connecting", message="正在连接网关…")
    try:
        resp = requests.get(base + "/contacts", headers=headers, timeout=15)
        if resp.status_code >= 400:
            raise RuntimeError(f"网关返回 {resp.status_code}：{resp.text[:160]}")
        data = resp.json()
        contacts = _normalize_contacts(data)
        for c in contacts:
            store.upsert_contact(c["id"], c["name"], c.get("avatar", ""),
                                 c.get("is_group", False), "gateway")
        state_since = int(time.time() * 1000)
        with _lock:
            STATE["since"] = state_since
        _set(status="connected", account=f"网关 · {len(contacts)} 位联系人",
             message="网关已连接")
        return {"ok": True, "message": "网关已连接", "account": f"{len(contacts)} 位联系人"}
    except Exception as e:
        _set(status="error", message=str(e))
        raise


def _normalize_contacts(data):
    items = data
    if isinstance(data, dict):
        items = data.get("contacts") or data.get("data") or data.get("list") or []
    out = []
    for it in items if isinstance(items, list) else []:
        if not isinstance(it, dict):
            continue
        cid = str(it.get("id") or it.get("contact_id") or it.get("wxid") or it.get("userid") or "")
        name = it.get("name") or it.get("nickname") or it.get("remark") or cid
        if not cid:
            continue
        out.append({
            "id": cid if cid.startswith("gw:") else "gw:" + cid,
            "name": name,
            "avatar": it.get("avatar") or "",
            "is_group": bool(it.get("is_group") or it.get("isRoom") or it.get("room")),
            "_raw_id": cid,
        })
    return out


def gateway_send(cfg, contact, text):
    cfg_gw = cfg["wechat"]["gateway"]
    base = _gw_base(cfg)
    raw_id = contact["id"][3:] if contact["id"].startswith("gw:") else contact["id"]
    resp = requests.post(
        base + "/messages/send",
        headers=_gw_headers(cfg_gw.get("token", "")),
        json={"contact_id": raw_id, "content": text},
        timeout=20,
    )
    if resp.status_code >= 400:
        raise RuntimeError(f"网关发送失败 {resp.status_code}：{resp.text[:160]}")
    return True


def gateway_poll(cfg):
    """拉取网关的新消息。"""
    cfg_gw = cfg["wechat"]["gateway"]
    base = _gw_base(cfg)
    with _lock:
        since = STATE["since"]
    resp = requests.get(
        base + "/messages",
        headers=_gw_headers(cfg_gw.get("token", "")),
        params={"since": since},
        timeout=15,
    )
    if resp.status_code >= 400:
        raise RuntimeError(f"网关返回 {resp.status_code}")
    data = resp.json()
    items = data.get("messages") if isinstance(data, dict) else data
    out = []
    for it in items or []:
        if not isinstance(it, dict):
            continue
        cid = str(it.get("contact_id") or it.get("from") or it.get("id") or "")
        content = it.get("content") or it.get("text") or ""
        if not cid or not content:
            continue
        name = it.get("name") or ""
        out.append({
            "contact_id": cid if cid.startswith("gw:") else "gw:" + cid,
            "name": name,
            "content": content,
            "created_at": it.get("created_at") or it.get("timestamp"),
            "is_group": bool(it.get("is_group")),
        })
    with _lock:
        STATE["since"] = int(time.time() * 1000)
    return out


# ------------------------------------------------------------------ wecom

WECOM_API = "https://qyapi.weixin.qq.com/cgi-bin"


def _wecom_token_get(cfg, secret, force=False):
    if not secret:
        raise ValueError("请填写企业微信应用 Secret")
    if not force and _wecom_token["value"] and _wecom_token["secret"] == secret \
            and _wecom_token["expires_at"] > time.time() + 60:
        return _wecom_token["value"]
    corp_id = cfg["wechat"]["wecom"].get("corp_id", "").strip()
    if not corp_id:
        raise ValueError("请填写企业 ID（corp_id）")
    resp = requests.get(WECOM_API + "/gettoken",
                        params={"corpid": corp_id, "corpsecret": secret}, timeout=15)
    data = resp.json()
    if data.get("errcode") not in (0, None):
        raise RuntimeError(f"获取 access_token 失败：{data.get('errmsg')}")
    _wecom_token.update({
        "value": data["access_token"],
        "expires_at": time.time() + int(data.get("expires_in", 7200)),
        "secret": secret,
    })
    return data["access_token"]


def _wecom_post(path, token, payload):
    resp = requests.post(f"{WECOM_API}{path}?access_token={token}",
                         json=payload, timeout=20)
    data = resp.json()
    if data.get("errcode") not in (0, None):
        raise RuntimeError(f"企业微信接口错误 {data.get('errcode')}：{data.get('errmsg')}")
    return data


def connect_wecom(cfg):
    wc = cfg["wechat"]["wecom"]
    _set(mode="wecom", status="connecting", message="正在连接企业微信…")
    try:
        token = _wecom_token_get(cfg, wc.get("secret", ""))
        contacts = []
        seen = set()
        try:
            dept_resp = requests.get(
                f"{WECOM_API}/department/list",
                params={"access_token": token}, timeout=20,
            ).json()
            depts = [int(d["id"]) for d in dept_resp.get("department", [])] \
                if dept_resp.get("errcode") in (0, None) else []
        except Exception:
            depts = []
        for dept in depts or [1]:
            try:
                data = requests.get(
                    f"{WECOM_API}/user/simplelist",
                    params={"access_token": token, "department_id": dept, "fetch_child": 1},
                    timeout=20,
                ).json()
                for u in data.get("userlist", []) if data.get("errcode") in (0, None) else []:
                    if u["userid"] in seen:
                        continue
                    seen.add(u["userid"])
                    contacts.append({
                        "id": "wecom:" + u["userid"],
                        "name": u.get("name") or u["userid"],
                        "avatar": "",
                        "is_group": False,
                    })
            except Exception:
                continue

        # 外部联系人（客户）需要「客户联系」Secret
        contact_secret = wc.get("contact_secret") or wc.get("secret")
        try:
            ct = _wecom_token_get(cfg, contact_secret)
            staff = [c["id"][6:] for c in contacts][:1]
            if staff:
                lst = _wecom_post("/externalcontact/list", ct, {"userid": staff[0]})
                ext_ids = [e.get("external_userid") for e in lst.get("external_userid", [])][:100]
                if ext_ids:
                    detail = _wecom_post(
                        "/externalcontact/batch/get", ct,
                        {"userid": staff[0], "external_userid": ext_ids},
                    )
                    for item in detail.get("external_contact_list", []):
                        ec = item.get("external_contact", {})
                        contacts.append({
                            "id": "wecom:" + ec.get("external_userid", ""),
                            "name": ec.get("name") or "微信客户",
                            "avatar": ec.get("avatar") or "",
                            "is_group": False,
                        })
        except Exception:
            pass

        for c in contacts:
            store.upsert_contact(c["id"], c["name"], c.get("avatar", ""),
                                 c.get("is_group", False), "wecom")
        _set(status="connected", account=f"企业微信 · {len(contacts)} 位联系人",
             message="企业微信已连接")
        return {"ok": True, "message": "企业微信已连接", "account": f"{len(contacts)} 位联系人"}
    except Exception as e:
        _set(status="error", message=str(e))
        raise


def wecom_send(cfg, contact, text):
    wc = cfg["wechat"]["wecom"]
    token = _wecom_token_get(cfg, wc.get("secret", ""))
    userid = contact["id"][6:] if contact["id"].startswith("wecom:") else contact["id"]
    payload = {
        "touser": userid,
        "msgtype": "text",
        "agentid": int(wc.get("agent_id") or 0),
        "text": {"content": text},
        "safe": 0,
    }
    _wecom_post("/message/send", token, payload)
    return True


# ---- 企业微信回调（加密 XML） ----

def _aes_key(aes_key_b64):
    key = base64.b64decode(aes_key_b64 + "=")
    if len(key) != 32:
        raise ValueError("AESKey 应为 43 位，解码后 32 字节")
    return key


def _decrypt(aes_key_b64, cipher_b64):
    key = _aes_key(aes_key_b64)
    raw = base64.b64decode(cipher_b64)
    cipher = Cipher(algorithms.AES(key), modes.CBC(key[:16]))
    dec = cipher.decryptor()
    plain = dec.update(raw) + dec.finalize()
    pad = plain[-1]
    if pad < 1 or pad > 32:
        raise ValueError("回调内容解密失败")
    plain = plain[:-pad]
    msg_len = struct.unpack("!I", plain[16:20])[0]
    msg = plain[20:20 + msg_len].decode("utf-8")
    receive_id = plain[20 + msg_len:].decode("utf-8")
    return msg, receive_id


def _signature(token, timestamp, nonce, encrypt):
    items = sorted([token, str(timestamp), str(nonce), encrypt])
    return hashlib.sha1("".join(items).encode()).hexdigest()


def verify_url(cfg, params):
    wc = cfg["wechat"]["wecom"]
    sig = _signature(wc.get("token", ""), params.get("timestamp", ""),
                     params.get("nonce", ""), params.get("echostr", ""))
    if sig != params.get("msg_signature", ""):
        raise ValueError("回调签名校验失败")
    msg, _ = _decrypt(wc.get("aes_key", ""), params["echostr"])
    return msg


def parse_callback(cfg, params, body):
    wc = cfg["wechat"]["wecom"]
    root = ET.fromstring(body)
    encrypt = root.findtext("Encrypt") or ""
    sig = _signature(wc.get("token", ""), params.get("timestamp", ""),
                     params.get("nonce", ""), encrypt)
    if sig != params.get("msg_signature", ""):
        raise ValueError("回调签名校验失败")
    msg, _ = _decrypt(wc.get("aes_key", ""), encrypt)
    inner = ET.fromstring(msg)
    return {
        "from": inner.findtext("FromUserName") or "",
        "type": inner.findtext("MsgType") or "",
        "content": inner.findtext("Content") or "",
        "msg_id": inner.findtext("MsgId") or "",
        "create_time": inner.findtext("CreateTime") or "",
    }


# ------------------------------------------------------------------ dispatch

def connect(cfg):
    mode = cfg["wechat"].get("mode") or "demo"
    if mode == "wecom":
        return connect_wecom(cfg)
    if mode == "gateway":
        return connect_gateway(cfg)
    return connect_demo(cfg)


def send(cfg, contact, text):
    mode = cfg["wechat"].get("mode") or "demo"
    if mode == "wecom":
        return wecom_send(cfg, contact, text)
    if mode == "gateway":
        return gateway_send(cfg, contact, text)
    return True  # demo：仅写入本地
