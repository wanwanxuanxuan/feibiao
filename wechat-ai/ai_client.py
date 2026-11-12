"""OpenAI 兼容协议的 AI 调用。"""
import json
import re

import requests


def _build_url(base_url):
    base = (base_url or "").strip().rstrip("/")
    if not base:
        raise ValueError("请先填写 API 地址")
    if base.endswith("/chat/completions"):
        return base
    if base.endswith("/v1"):
        return base + "/chat/completions"
    return base + "/v1/chat/completions"


def _clean(text):
    text = (text or "").strip()
    text = re.sub(r"^```[a-z]*\n?|```$", "", text, flags=re.M).strip()
    return text


def chat(cfg, messages, temperature=None, timeout=90):
    ai = cfg.get("ai", {})
    key = (ai.get("api_key") or "").strip()
    if not key:
        raise ValueError("尚未填写 API Key")
    url = _build_url(ai.get("base_url"))
    payload = {
        "model": (ai.get("model") or "").strip(),
        "messages": messages,
        "temperature": ai.get("temperature", 0.8) if temperature is None else temperature,
        "stream": False,
    }
    headers = {"Content-Type": "application/json", "Authorization": "Bearer " + key}
    try:
        resp = requests.post(url, json=payload, headers=headers, timeout=timeout)
    except requests.RequestException as e:
        raise RuntimeError(f"无法连接 AI 接口：{e}")
    if resp.status_code >= 400:
        detail = resp.text[:300]
        raise RuntimeError(f"AI 接口返回 {resp.status_code}：{detail}")
    try:
        data = resp.json()
        content = data["choices"][0]["message"].get("content") or ""
    except Exception:
        raise RuntimeError("AI 返回格式异常：" + resp.text[:200])
    out = _clean(content)
    if not out:
        raise RuntimeError("AI 返回了空内容")
    return out


def test(cfg):
    return chat(
        cfg,
        [
            {"role": "system", "content": "你是连通性测试助手。"},
            {"role": "user", "content": "只回复两个字：正常"},
        ],
        temperature=0,
        timeout=45,
    )


def strip_prefix(text, prefix):
    if not prefix:
        return text
    p = prefix.strip()
    if p and text.strip().startswith(p):
        return text.strip()[len(p):].strip()
    return text.strip()


def build_reply(cfg, contact_name, history, is_group=False, extra_persona=""):
    persona = cfg.get("persona", {})
    system = (persona.get("prompt") or "").strip()
    if extra_persona:
        system += "\n\n额外设定：" + extra_persona
    system += (
        f"\n\n你正在微信上和「{contact_name}」聊天。"
        "只输出你要发送的聊天内容本身，不要加前缀、不要解释。"
    )
    if is_group:
        system += "这是一个群聊，请自然接话，不要 @ 所有人。"
    prefix = persona.get("prefix") or ""
    msgs = [{"role": "system", "content": system}]
    for m in history:
        role = m.get("role")
        content = strip_prefix(m.get("content", ""), prefix)
        if not content:
            continue
        if role == "contact":
            msgs.append({"role": "user", "content": content})
        elif role in ("me", "ai"):
            msgs.append({"role": "assistant", "content": content})
    if len(msgs) == 1:
        msgs.append({"role": "user", "content": "（打个招呼）"})
    text = chat(cfg, msgs)
    return text[:600]
