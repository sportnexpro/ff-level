# -*- coding: utf-8 -*-
"""
FreeFire Level Up Bot - Selling Panel (landing page, user panel, admin panel)
Embedded Async Web Server (aiohttp)
"""

import asyncio
import gzip
import hashlib
import mimetypes
import os
import re
import time
from typing import Dict, List, Any, Optional
from aiohttp import web

from panel_db import MAX_LEVEL, PanelDB, PanelError, hash_password, verify_password  # MongoDB-backed

# Global bot state shared between Main.py and Web Dashboard
class BotState:
    def __init__(self):
        self.accounts: Dict[str, Dict[str, Any]] = {}
        self.logs: List[Dict[str, Any]] = []
        self.max_logs = 400
        self.total_matches = 0
        self.total_gained_exp = 0
        self.start_time = time.time()
        self.account_workers: Dict[str, asyncio.Task] = {}
        self.refresh_callbacks: Dict[str, Any] = {}
        self.account_credentials: Dict[str, Dict[str, Any]] = {}
        self.worker_bindings: Dict[str, str] = {}  # worker key ("acc:<db id>") -> game account_id
        self.worker_started: Dict[str, float] = {}  # worker key -> when the bot started running it

    def log(self, message: str, level: str = "info", uid: Optional[str] = None):
        entry = {
            "time": time.strftime("%H:%M:%S"),
            "ts": time.time(),
            "level": level,
            "message": message,
            "uid": uid
        }
        self.logs.append(entry)
        if len(self.logs) > self.max_logs:
            self.logs.pop(0)

    def register_account(self, uid: str, nickname: str, region: str, level: int, exp: int, likes: int = 0):
        uid_str = str(uid)
        if uid_str not in self.accounts:
            self.accounts[uid_str] = {
                "uid": uid_str,
                "nickname": nickname or f"Player_{uid_str[:6]}",
                "region": region or "BD",
                "level": level or 1,
                "initial_exp": exp,
                "current_exp": exp,
                "gained_exp": 0,
                "likes": likes or 0,
                "status": "ONLINE",
                "matches_played": 0,
                "active_matches": 0,
                "last_match_time": None,
                "last_updated": time.strftime("%H:%M:%S"),
                "tracking_since": time.time()
            }
        else:
            acc = self.accounts[uid_str]
            if nickname:
                acc["nickname"] = nickname
            if region:
                acc["region"] = region
            if level:
                acc["level"] = level
            acc["current_exp"] = exp
            acc["gained_exp"] = max(0, exp - acc["initial_exp"])
            acc["likes"] = likes
            acc["status"] = "ONLINE"
            acc["last_updated"] = time.strftime("%H:%M:%S")
        self.observe_level(self.accounts[uid_str]["level"], exp)
        self.recalc_totals()

    def update_exp(self, uid: str, current_exp: int, level: Optional[int] = None):
        uid_str = str(uid)
        if uid_str in self.accounts:
            acc = self.accounts[uid_str]
            old_exp = acc["current_exp"]
            acc["current_exp"] = current_exp
            if level is not None and level > 0:
                acc["level"] = level
            acc["gained_exp"] = max(0, current_exp - acc["initial_exp"])
            acc["last_updated"] = time.strftime("%H:%M:%S")
            diff = current_exp - old_exp
            if diff > 0:
                self.log(f"Account {acc['nickname']} ({uid_str}) gained +{diff} EXP! Total Gained: +{acc['gained_exp']}", "success", uid_str)
            self.observe_level(acc["level"], current_exp)
            self.recalc_totals()

    def update_status(self, uid: str, status: str, active_matches: Optional[int] = None):
        uid_str = str(uid)
        if uid_str in self.accounts:
            self.accounts[uid_str]["status"] = status
            if active_matches is not None:
                self.accounts[uid_str]["active_matches"] = active_matches
            self.accounts[uid_str]["last_updated"] = time.strftime("%H:%M:%S")

    def increment_match(self, uid: str):
        uid_str = str(uid)
        self.total_matches += 1
        if uid_str in self.accounts:
            self.accounts[uid_str]["matches_played"] += 1
            self.accounts[uid_str]["last_match_time"] = time.strftime("%H:%M:%S")
            self.accounts[uid_str]["last_updated"] = time.strftime("%H:%M:%S")
            self.log(f"Account {self.accounts[uid_str]['nickname']} finished Match #{self.accounts[uid_str]['matches_played']}", "info", uid_str)

    def recalc_totals(self):
        self.total_gained_exp = sum(acc.get("gained_exp", 0) for acc in self.accounts.values())

    def observe_level(self, level: Optional[int], exp: Optional[int]):
        try:
            if db:
                db.observe_level(int(level or 0), int(exp or 0))
        except Exception:
            pass

    def bind_worker(self, key: Optional[str], account_data: Dict[str, Any]):
        """Link a panel account (worker key) to the in-game account id once login succeeds."""
        if not key:
            return
        try:
            game_id = str(account_data["account_id"])
            self.worker_bindings[key] = game_id
            if db:
                db._spawn(db.set_account_game(int(key.split(":", 1)[1]), game_id, account_data.get("nickname")))
        except Exception:
            pass


bot_state = BotState()
db: Optional[PanelDB] = None  # connected in start_web_dashboard()


# ==================== HELPERS ====================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TEMPLATE_DIR = os.path.join(BASE_DIR, "templates")
STATIC_DIR = os.path.join(BASE_DIR, "static")
SESSION_COOKIE = "lvl_session"
USERNAME_RE = re.compile(r"^[A-Za-z0-9_.]{3,24}$")
SYNC_INTERVAL = 15
USER_PATHS = ("/api/", "/panel", "/admin", "/login", "/register", "/logout")


# ==================== STATIC ASSETS (in memory, gzipped, browser-cached) ====================

class Assets:
    """Serves /static from memory with gzip + long cache headers; HTML gets ?v=<hash> links."""

    def __init__(self):
        self.files: Dict[str, Dict[str, Any]] = {}
        self.pages: Dict[str, str] = {}
        self.version = "0"

    def load(self):
        digest = hashlib.sha1()
        for root, _, names in os.walk(STATIC_DIR):
            for name in sorted(names):
                full = os.path.join(root, name)
                rel = os.path.relpath(full, STATIC_DIR).replace(os.sep, "/")
                with open(full, "rb") as f:
                    raw = f.read()
                digest.update(rel.encode() + raw)
                ctype = mimetypes.guess_type(name)[0] or "application/octet-stream"
                text = ctype.startswith("text/") or ctype in ("application/javascript", "application/json", "image/svg+xml")
                self.files[rel] = {"type": ctype, "raw": raw, "gz": gzip.compress(raw, 6) if text and len(raw) > 1024 else None}
        self.version = digest.hexdigest()[:10]
        for name in os.listdir(TEMPLATE_DIR):
            if name.endswith(".html"):
                with open(os.path.join(TEMPLATE_DIR, name), "r", encoding="utf-8") as f:
                    html = f.read()
                self.pages[name[:-5]] = re.sub(r'(/static/[^"\'?#\s]+)', rf"\1?v={self.version}", html)

    async def handle(self, request: web.Request) -> web.StreamResponse:
        f = self.files.get(request.match_info["path"])
        if not f:
            raise web.HTTPNotFound()
        cache = "public, max-age=31536000, immutable" if request.query.get("v") else "public, max-age=300"
        headers = {"Cache-Control": cache, "Vary": "Accept-Encoding"}
        if f["gz"] and "gzip" in request.headers.get("Accept-Encoding", ""):
            headers["Content-Encoding"] = "gzip"
            return web.Response(body=f["gz"], content_type=f["type"], headers=headers)
        return web.Response(body=f["raw"], content_type=f["type"], headers=headers)


assets = Assets()

_login_failures: Dict[str, List[float]] = {}


def ok(**data) -> web.Response:
    return web.json_response({"ok": True, **data})


def worker_key(account_id: int) -> str:
    return f"acc:{account_id}"


async def read_json(request: web.Request) -> Dict[str, Any]:
    try:
        data = await request.json()
    except Exception:
        raise PanelError("Invalid request body")
    if not isinstance(data, dict):
        raise PanelError("Invalid request body")
    return data


def as_int(value: Any, name: str = "value") -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        raise PanelError(f"Invalid {name}")


def client_ip(request: web.Request) -> str:
    return request.headers.get("X-Forwarded-For", request.remote or "?").split(",")[0].strip()


async def subscription_of(user: Dict[str, Any]) -> Dict[str, Any]:
    now = time.time()
    is_admin = user["role"] == "admin"
    return {
        "active": PanelDB.has_access(user),
        "unlimited": is_admin,
        "banned": bool(user["is_banned"]),
        "plan_name": "Owner" if is_admin else user["plan_name"],
        "expires_at": None if is_admin else user["expires_at"],
        "remaining": 0 if is_admin else max(0, (user["expires_at"] or 0) - now),
        "max_accounts": None if is_admin else user["max_accounts"],
        "used": await db.count_accounts(user["id"]),
    }


async def public_user(user: Dict[str, Any]) -> Dict[str, Any]:
    return {"id": user["id"], "username": user["username"], "role": user["role"],
            "created_at": user["created_at"], "subscription": await subscription_of(user)}


def mask_login(row: Dict[str, Any]) -> str:
    if row["kind"] == "token":
        return row["login"][:6] + "…" + row["login"][-4:]
    return row["login"]


def account_view(row: Dict[str, Any]) -> Dict[str, Any]:
    key = worker_key(row["id"])
    task = bot_state.account_workers.get(key)
    running = bool(task and not task.done())
    game_id = bot_state.worker_bindings.get(key) or row.get("game_id")
    live = bot_state.accounts.get(game_id) if game_id else None
    status = (live["status"] if live else "STARTING") if running else "PAUSED"
    now = time.time()
    started = bot_state.worker_started.get(key)
    lp = level_progress(live) if live else {}
    view = {
        "id": row["id"], "kind": row["kind"], "login": mask_login(row), "game_id": game_id,
        "nickname": (live or {}).get("nickname") or row.get("nickname") or "",
        "region": (live or {}).get("region", ""), "level": (live or {}).get("level"),
        "current_exp": (live or {}).get("current_exp", 0), "gained_exp": (live or {}).get("gained_exp", 0),
        "matches_played": (live or {}).get("matches_played", 0), "active_matches": (live or {}).get("active_matches", 0),
        "likes": (live or {}).get("likes", 0), "status": status, "running": running, "created_at": row["created_at"],
        "running_seconds": int(now - started) if running and started else 0,
        **lp,
    }
    if "username" in row:
        view["owner"] = row["username"]
        view["owner_id"] = row["user_id"]
    return view


def level_progress(live: Dict[str, Any]) -> Dict[str, Any]:
    """Progress to the next level, EXP/hour and ETA for a live account."""
    level, cur = live.get("level") or 0, live.get("current_exp") or 0
    out: Dict[str, Any] = {"next_level": level + 1 if level else None, "level_start_exp": None, "level_next_exp": None,
                           "exp_to_next": None, "level_pct": None, "exp_per_hour": None, "eta_seconds": None,
                           "max_level": bool(level) and level >= MAX_LEVEL and db.level_threshold(level + 1) is None}
    tracked = time.time() - live.get("tracking_since", time.time())
    gained = live.get("gained_exp") or 0
    if tracked >= 120 and gained > 0:
        out["exp_per_hour"] = round(gained / tracked * 3600)
    if not level:
        return out
    start, nxt = db.level_threshold(level), db.level_threshold(level + 1)
    if nxt is not None and nxt > cur:
        out["level_next_exp"] = int(nxt)
        out["exp_to_next"] = int(nxt - cur)
        if start is not None and start <= cur < nxt:
            out["level_start_exp"] = int(start)
            out["level_pct"] = round((cur - start) / (nxt - start) * 100, 1)
        if out["exp_per_hour"]:
            out["eta_seconds"] = int(out["exp_to_next"] / out["exp_per_hour"] * 3600)
    return out


def totals_of(views: List[Dict[str, Any]]) -> Dict[str, Any]:
    return {
        "exp_per_hour": sum(v.get("exp_per_hour") or 0 for v in views if v["running"]),
        "running": sum(1 for v in views if v["running"]),
        "gained_exp": sum(v["gained_exp"] or 0 for v in views),
        "matches": sum(v["matches_played"] or 0 for v in views),
        "in_match": sum(v["active_matches"] or 0 for v in views),
        "top_level": max([v["level"] or 0 for v in views] or [0]),
    }


# ==================== WORKER SYNC (subscription enforcement) ====================

def stop_worker(key: str, reason: str = ""):
    bot_state.worker_started.pop(key, None)
    task = bot_state.account_workers.pop(key, None)
    if task and not task.done():
        task.cancel()
        game_id = bot_state.worker_bindings.get(key)
        if game_id in bot_state.accounts:
            bot_state.accounts[game_id]["status"] = "PAUSED"
        if reason:
            bot_state.log(reason, "warning", game_id)


async def sync_workers():
    """Start workers for every account that should run and stop the rest (expired, banned, over limit, deleted)."""
    start = bot_state.refresh_callbacks.get("start_worker")
    if not start:
        return
    desired = {worker_key(r["id"]): r for r in await db.runnable_accounts()}
    for key, task in list(bot_state.account_workers.items()):
        if key not in desired:
            stop_worker(key, f"Account #{key.split(':')[-1]} paused — access ended or slot limit reached.")
        elif task.done():
            bot_state.account_workers.pop(key, None)
    for key, row in desired.items():
        if key not in bot_state.account_workers:
            bot_state.account_workers[key] = start(key, row)
            bot_state.worker_started[key] = time.time()


async def sync_loop():
    ticks = 0
    while True:
        try:
            await sync_workers()
            ticks += 1
            if ticks % 240 == 0:
                await db.purge_sessions()
        except Exception as e:
            bot_state.log(f"Worker sync error: {e}", "error")
        await asyncio.sleep(SYNC_INTERVAL)


async def remove_account(row: Dict[str, Any]):
    key = worker_key(row["id"])
    stop_worker(key)
    game_id = bot_state.worker_bindings.pop(key, None) or row.get("game_id")
    await db.delete_account(row["id"])
    if game_id:
        bot_state.accounts.pop(game_id, None)
        bot_state.recalc_totals()
    await sync_workers()


# ==================== MIDDLEWARE ====================

@web.middleware
async def panel_middleware(request: web.Request, handler):
    request["user"] = None
    path = request.path
    token = request.cookies.get(SESSION_COOKIE)
    if token and path.startswith(USER_PATHS):
        request["user"] = await db.session_user(token)
    try:
        if path.startswith("/api/"):
            # JSON-only POSTs: blocks cross-site form submissions (CSRF) without a token.
            if request.method == "POST" and request.content_type != "application/json":
                raise PanelError("Unsupported content type", 415)
            if path.startswith(("/api/panel/", "/api/admin/")):
                user = request["user"]
                if not user:
                    raise PanelError("Please sign in again", 401)
                if user["is_banned"]:
                    raise PanelError("Your account has been suspended. Contact support.", 403)
                if path.startswith("/api/admin/") and user["role"] != "admin":
                    raise PanelError("Admins only", 403)
        resp = await handler(request)
        if (isinstance(resp, web.Response) and "Content-Encoding" not in resp.headers
                and resp.body is not None and len(resp.body) > 1024
                and "gzip" in request.headers.get("Accept-Encoding", "")):
            resp.enable_compression(web.ContentCoding.gzip)
        return resp
    except PanelError as e:
        return web.json_response({"ok": False, "error": str(e)}, status=e.status)
    except web.HTTPException:
        raise
    except Exception as e:
        if path.startswith("/api/"):
            bot_state.log(f"API error on {path}: {e}", "error")
            return web.json_response({"ok": False, "error": "Something went wrong. Please try again."}, status=500)
        raise


# ==================== PAGES ====================

def page(name: str):
    async def handler(request: web.Request) -> web.Response:
        user = request["user"]
        if name in ("panel", "admin") and not user:
            raise web.HTTPFound("/login")
        if name == "admin" and user["role"] != "admin":
            raise web.HTTPFound("/panel")
        if name == "auth" and user:
            raise web.HTTPFound("/admin" if user["role"] == "admin" else "/panel")
        return web.Response(text=assets.pages[name], content_type="text/html", charset="utf-8",
                            headers={"Cache-Control": "no-store"})
    return handler


async def handle_logout_page(request: web.Request) -> web.Response:
    token = request.cookies.get(SESSION_COOKIE)
    if token:
        await db.delete_session(token)
    resp = web.HTTPFound("/")
    resp.del_cookie(SESSION_COOKIE, path="/")
    raise resp


# ==================== PUBLIC + AUTH API ====================

async def api_public_info(request: web.Request) -> web.Response:
    # Public: branding + plans only. Bot-wide stats are never exposed; users see their own in /api/panel.
    settings, plans = await asyncio.gather(db.settings(), db.list_plans(active_only=True))
    return ok(settings=settings, plans=plans)


async def _set_session(request: web.Request, resp: web.Response, user_id: int):
    token = await db.create_session(user_id)
    https = request.secure or request.headers.get("X-Forwarded-Proto", "").lower() == "https"
    resp.set_cookie(SESSION_COOKIE, token, max_age=7 * 24 * 3600, httponly=True, samesite="Lax", path="/", secure=https)


async def api_login(request: web.Request) -> web.Response:
    ip = client_ip(request)
    recent = [t for t in _login_failures.get(ip, []) if t > time.time() - 600]
    _login_failures[ip] = recent
    if len(recent) >= 10:
        raise PanelError("Too many failed attempts. Try again in a few minutes.", 429)
    data = await read_json(request)
    username = str(data.get("username", "")).strip()
    password = str(data.get("password", ""))
    user = await db.get_user_by_name(username) if username else None
    if not user or not await asyncio.to_thread(verify_password, password, user["pass_hash"]):
        recent.append(time.time())
        raise PanelError("Wrong username or password", 401)
    if user["is_banned"]:
        raise PanelError("Your account has been suspended. Contact support.", 403)
    _login_failures.pop(ip, None)
    resp = ok(redirect="/admin" if user["role"] == "admin" else "/panel")
    await _set_session(request, resp, user["id"])
    return resp


async def api_register(request: web.Request) -> web.Response:
    if not (await db.settings())["allow_register"]:
        raise PanelError("Registration is closed. Contact the seller to get an account.", 403)
    data = await read_json(request)
    username = str(data.get("username", "")).strip()
    password = str(data.get("password", ""))
    if not USERNAME_RE.match(username):
        raise PanelError("Username must be 3–24 characters: letters, numbers, _ or .")
    if len(password) < 6:
        raise PanelError("Password must be at least 6 characters")
    user_id = await db.create_user(username, await asyncio.to_thread(hash_password, password))
    bot_state.log(f"New user registered: {username}", "info")
    resp = ok(redirect="/panel")
    await _set_session(request, resp, user_id)
    return resp


async def api_logout(request: web.Request) -> web.Response:
    token = request.cookies.get(SESSION_COOKIE)
    if token:
        await db.delete_session(token)
    resp = ok()
    resp.del_cookie(SESSION_COOKIE, path="/")
    return resp


async def api_me(request: web.Request) -> web.Response:
    user = request["user"]
    if not user:
        raise PanelError("Not signed in", 401)
    return ok(user=await public_user(user))


# ==================== USER PANEL API ====================

async def api_panel_overview(request: web.Request) -> web.Response:
    user = request["user"]
    rows, pub = await asyncio.gather(db.list_accounts(user["id"]), public_user(user))
    views = [account_view(r) for r in rows]
    game_ids = {v["game_id"] for v in views if v["game_id"]}
    logs = [l for l in bot_state.logs if l.get("uid") in game_ids][-40:]
    return ok(now=time.time(), user=pub, accounts=views, totals=totals_of(views), logs=logs)


async def api_panel_add_account(request: web.Request) -> web.Response:
    user = request["user"]
    sub = await subscription_of(user)
    if not sub["active"]:
        raise PanelError("Your access has expired. Renew a plan to add accounts.", 402)
    if not sub["unlimited"] and sub["used"] >= sub["max_accounts"]:
        raise PanelError(f"Your plan allows {sub['max_accounts']} account(s). Upgrade to add more.", 402)
    data = await read_json(request)
    kind = data.get("kind")
    if kind == "guest":
        uid = str(data.get("uid", "")).strip()
        pwd = str(data.get("password", "")).strip()
        if not uid.isdigit() or not pwd:
            raise PanelError("Enter a valid numeric UID and its password")
        acc_id = await db.add_account(user["id"], "guest", uid, pwd)
    elif kind == "token":
        token = str(data.get("token", "")).strip()
        if len(token) < 20:
            raise PanelError("Enter a valid access token")
        acc_id = await db.add_account(user["id"], "token", token)
    else:
        raise PanelError("Choose an account type")
    bot_state.log(f"{user['username']} added account #{acc_id}", "success")
    await sync_workers()
    return ok(id=acc_id)


async def _own_account(request: web.Request, account_id: Any) -> Dict[str, Any]:
    row = await db.get_account(as_int(account_id, "account"))
    user = request["user"]
    if not row or (row["user_id"] != user["id"] and user["role"] != "admin"):
        raise PanelError("Account not found", 404)
    return row


async def api_panel_delete_account(request: web.Request) -> web.Response:
    data = await read_json(request)
    row = await _own_account(request, data.get("id"))
    await remove_account(row)
    bot_state.log(f"Account #{row['id']} removed by {request['user']['username']}", "warning")
    return ok()


async def api_panel_refresh_account(request: web.Request) -> web.Response:
    data = await read_json(request)
    row = await _own_account(request, data.get("id"))
    game_id = bot_state.worker_bindings.get(worker_key(row["id"])) or row.get("game_id")
    cb = bot_state.refresh_callbacks.get("on_refresh_account")
    if game_id and cb:
        asyncio.create_task(cb(game_id))
    return ok()


async def api_panel_orders(request: web.Request) -> web.Response:
    return ok(orders=await db.list_orders(user_id=request["user"]["id"]))


async def api_panel_create_order(request: web.Request) -> web.Response:
    data = await read_json(request)
    plan = await db.get_plan(as_int(data.get("plan_id"), "plan"))
    if not plan or not plan["is_active"]:
        raise PanelError("This plan is not available")
    method = str(data.get("method", "")).strip()[:40]
    sender = str(data.get("sender", "")).strip()[:30]
    trx_id = str(data.get("trx_id", "")).strip()[:40]
    if not method or len(sender) < 4 or len(trx_id) < 4:
        raise PanelError("Fill in payment method, sender number and Transaction ID")
    order_id = await db.create_order(request["user"]["id"], plan, method, sender, trx_id)
    bot_state.log(f"New order #{order_id} from {request['user']['username']} — {plan['name']} via {method}", "info")
    return ok(id=order_id)


async def api_panel_redeem(request: web.Request) -> web.Response:
    data = await read_json(request)
    code = str(data.get("code", "")).strip()
    if not code:
        raise PanelError("Enter a license key")
    k = await db.redeem_key(request["user"]["id"], code)
    bot_state.log(f"{request['user']['username']} redeemed key {k['code']} ({k['plan_name']})", "success")
    await sync_workers()
    return ok(plan_name=k["plan_name"], duration_hours=k["duration_hours"], max_accounts=k["max_accounts"])


async def api_panel_password(request: web.Request) -> web.Response:
    data = await read_json(request)
    user = request["user"]
    if not await asyncio.to_thread(verify_password, str(data.get("current", "")), user["pass_hash"]):
        raise PanelError("Current password is wrong")
    new = str(data.get("new", ""))
    if len(new) < 6:
        raise PanelError("New password must be at least 6 characters")
    await db.update_user(user["id"], pass_hash=await asyncio.to_thread(hash_password, new))
    await db.delete_user_sessions(user["id"], keep=request.cookies.get(SESSION_COOKIE))
    return ok()


# ==================== ADMIN API ====================

async def api_admin_overview(request: web.Request) -> web.Response:
    rows, stats, pending = await asyncio.gather(
        db.list_accounts(), db.admin_stats(), db.list_orders(status="pending", limit=8))
    views = [account_view(r) for r in rows]
    return ok(now=time.time(), stats=stats, totals=totals_of(views),
              uptime=int(time.time() - bot_state.start_time), pending=pending, logs=bot_state.logs[-80:])


async def api_admin_users(request: web.Request) -> web.Response:
    users = await db.list_users()
    now = time.time()
    for u in users:
        u["active"] = PanelDB.has_access(u)
        u["remaining"] = max(0, (u["expires_at"] or 0) - now)
    return ok(now=now, users=users)


async def _grant_from(data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Resolve a grant from either a plan_id or custom duration_hours + max_accounts."""
    if data.get("plan_id"):
        plan = await db.get_plan(as_int(data["plan_id"], "plan"))
        if not plan:
            raise PanelError("Plan not found")
        return {"hours": plan["duration_hours"], "slots": plan["max_accounts"], "name": plan["name"]}
    if data.get("duration_hours"):
        hours = as_int(data["duration_hours"], "duration")
        slots = as_int(data.get("max_accounts"), "account limit")
        if hours < 1 or slots < 1:
            raise PanelError("Duration and account limit must be at least 1")
        return {"hours": hours, "slots": slots, "name": str(data.get("plan_name") or "Custom").strip()[:40]}
    return None


async def api_admin_user_create(request: web.Request) -> web.Response:
    data = await read_json(request)
    username = str(data.get("username", "")).strip()
    password = str(data.get("password", ""))
    if not USERNAME_RE.match(username):
        raise PanelError("Username must be 3–24 characters: letters, numbers, _ or .")
    if len(password) < 6:
        raise PanelError("Password must be at least 6 characters")
    user_id = await db.create_user(username, await asyncio.to_thread(hash_password, password))
    grant = await _grant_from(data)
    if grant:
        await db.grant(user_id, grant["hours"], grant["slots"], grant["name"])
    if data.get("note"):
        await db.update_user(user_id, note=str(data["note"])[:200])
    bot_state.log(f"Admin created user {username}", "info")
    return ok(id=user_id)


async def api_admin_user_update(request: web.Request) -> web.Response:
    data = await read_json(request)
    user_id = as_int(data.get("id"), "user")
    target = await db.get_user(user_id)
    if not target:
        raise PanelError("User not found", 404)
    fields: Dict[str, Any] = {}
    if "max_accounts" in data:
        n = as_int(data["max_accounts"], "account limit")
        if n < 0:
            raise PanelError("Account limit can't be negative")
        fields["max_accounts"] = n
    if "plan_name" in data:
        fields["plan_name"] = str(data["plan_name"] or "").strip()[:40] or None
    if "expires_at" in data:
        try:
            fields["expires_at"] = float(data["expires_at"]) if data["expires_at"] else None
        except (TypeError, ValueError):
            raise PanelError("Invalid expiry date")
    if "is_banned" in data:
        if target["role"] == "admin" and data["is_banned"]:
            raise PanelError("You can't suspend an admin")
        fields["is_banned"] = 1 if data["is_banned"] else 0
    if "note" in data:
        fields["note"] = str(data["note"] or "")[:200]
    if data.get("password"):
        if len(str(data["password"])) < 6:
            raise PanelError("Password must be at least 6 characters")
        fields["pass_hash"] = await asyncio.to_thread(hash_password, str(data["password"]))
    await db.update_user(user_id, **fields)
    if data.get("extend_hours"):
        u = await db.get_user(user_id)
        await db.grant(user_id, as_int(data["extend_hours"], "duration"), u["max_accounts"], u["plan_name"] or "Custom")
    if fields.get("is_banned") or "pass_hash" in fields:
        await db.delete_user_sessions(user_id)
    await sync_workers()
    return ok()


async def api_admin_user_grant(request: web.Request) -> web.Response:
    data = await read_json(request)
    user_id = as_int(data.get("id"), "user")
    grant = await _grant_from(data)
    if not grant:
        raise PanelError("Choose a plan or enter a custom duration")
    await db.grant(user_id, grant["hours"], grant["slots"], grant["name"])
    await sync_workers()
    return ok()


async def api_admin_user_delete(request: web.Request) -> web.Response:
    data = await read_json(request)
    user_id = as_int(data.get("id"), "user")
    if user_id == request["user"]["id"]:
        raise PanelError("You can't delete your own account")
    for row in await db.list_accounts(user_id):
        await remove_account(row)
    await db.delete_user(user_id)
    await sync_workers()
    return ok()


async def api_admin_accounts(request: web.Request) -> web.Response:
    return ok(accounts=[account_view(r) for r in await db.list_accounts()])


async def api_admin_plans(request: web.Request) -> web.Response:
    return ok(plans=await db.list_plans())


async def api_admin_plan_save(request: web.Request) -> web.Response:
    return ok(id=await db.save_plan(await read_json(request)))


async def api_admin_plan_delete(request: web.Request) -> web.Response:
    data = await read_json(request)
    await db.delete_plan(as_int(data.get("id"), "plan"))
    return ok()


async def api_admin_orders(request: web.Request) -> web.Response:
    status = request.query.get("status") or None
    if status not in (None, "pending", "approved", "rejected"):
        status = None
    return ok(orders=await db.list_orders(status=status))


async def api_admin_order_review(request: web.Request) -> web.Response:
    data = await read_json(request)
    action = data.get("action")
    if action not in ("approve", "reject"):
        raise PanelError("Invalid action")
    o = await db.review_order(as_int(data.get("id"), "order"), action == "approve", str(data.get("note", "")))
    bot_state.log(f"Order #{o['id']} {action}d ({o['plan_name']})", "success" if action == "approve" else "warning")
    await sync_workers()
    return ok()


async def api_admin_keys(request: web.Request) -> web.Response:
    return ok(keys=await db.list_keys())


async def api_admin_keys_generate(request: web.Request) -> web.Response:
    data = await read_json(request)
    count = as_int(data.get("count", 1), "count")
    if not 1 <= count <= 200:
        raise PanelError("You can generate 1–200 keys at a time")
    grant = await _grant_from(data)
    if not grant:
        raise PanelError("Choose a plan or enter a custom duration")
    codes = await db.generate_keys(count, grant["name"], grant["hours"], grant["slots"], str(data.get("note", "")))
    return ok(codes=codes)


async def api_admin_key_delete(request: web.Request) -> web.Response:
    data = await read_json(request)
    await db.delete_key(str(data.get("code", "")))
    return ok()


async def api_admin_levels(request: web.Request) -> web.Response:
    return ok(levels=db.level_table())


async def api_admin_levels_save(request: web.Request) -> web.Response:
    data = await read_json(request)
    mapping: Dict[int, float] = {}
    for n, line in enumerate(str(data.get("table", "")).splitlines(), 1):
        parts = re.split(r"[\s,:=]+", line.strip())
        if not parts or not parts[0]:
            continue
        try:
            level, exp = int(parts[0]), float(parts[1].replace("_", ""))
        except (ValueError, IndexError):
            raise PanelError(f"Line {n}: use the format  level  total_exp  (e.g. 28 47000)")
        if level < 1 or exp < 0:
            raise PanelError(f"Line {n}: level and EXP must be positive")
        mapping[level] = exp
    await db.set_level_overrides(mapping)
    return ok(levels=db.level_table())


async def api_admin_settings(request: web.Request) -> web.Response:
    return ok(settings=await db.settings())


async def api_admin_settings_save(request: web.Request) -> web.Response:
    await db.save_settings(await read_json(request))
    return ok(settings=await db.settings())


# ==================== SERVER ====================

async def start_web_dashboard(host: str = "0.0.0.0", port: int = 5000,
                              mongo_uri: str = "mongodb://127.0.0.1:27017", mongo_db: str = "fflevel"):
    global db
    db = PanelDB(mongo_uri, mongo_db)
    try:
        await db.init()
    except Exception as e:
        raise RuntimeError(f"Could not connect to MongoDB ({e}). Check MONGO_URI in Main.py.") from e
    print(f"\033[92m[+] Connected to MongoDB database '{mongo_db}'\033[0m")
    created = await db.ensure_admin()
    if created:
        username, password = created
        with open(os.path.join(BASE_DIR, "ADMIN_LOGIN.txt"), "w", encoding="utf-8") as f:
            f.write(f"Admin panel: http://localhost:{port}/login\nUsername: {username}\nPassword: {password}\n"
                    "Change this password from Admin > Settings after signing in, then delete this file.\n")
        print(f"\033[93m[!] Admin account created -> username: {username}  password: {password}"
              f"  (saved to ADMIN_LOGIN.txt)\033[0m")
    imported = await db.import_legacy_accounts(await db.first_admin_id())
    if imported:
        print(f"\033[92m[+] Imported {imported} account(s) from accounts.json into the admin panel\033[0m")

    app = web.Application(middlewares=[panel_middleware], client_max_size=64 * 1024)
    r = app.router
    r.add_get("/", page("landing"))
    r.add_get("/login", page("auth"))
    r.add_get("/register", page("auth"))
    r.add_get("/panel", page("panel"))
    r.add_get("/panel/{tail:.+}", page("panel"))
    r.add_get("/admin", page("admin"))
    r.add_get("/admin/{tail:.+}", page("admin"))
    r.add_get("/logout", handle_logout_page)
    assets.load()
    r.add_get("/static/{path:.+}", assets.handle)

    r.add_get("/api/public/info", api_public_info)
    r.add_post("/api/auth/login", api_login)
    r.add_post("/api/auth/register", api_register)
    r.add_post("/api/auth/logout", api_logout)
    r.add_get("/api/me", api_me)

    r.add_get("/api/panel/overview", api_panel_overview)
    r.add_post("/api/panel/accounts/add", api_panel_add_account)
    r.add_post("/api/panel/accounts/delete", api_panel_delete_account)
    r.add_post("/api/panel/accounts/refresh", api_panel_refresh_account)
    r.add_get("/api/panel/orders", api_panel_orders)
    r.add_post("/api/panel/orders/create", api_panel_create_order)
    r.add_post("/api/panel/redeem", api_panel_redeem)
    r.add_post("/api/panel/password", api_panel_password)

    r.add_get("/api/admin/overview", api_admin_overview)
    r.add_get("/api/admin/users", api_admin_users)
    r.add_post("/api/admin/users/create", api_admin_user_create)
    r.add_post("/api/admin/users/update", api_admin_user_update)
    r.add_post("/api/admin/users/grant", api_admin_user_grant)
    r.add_post("/api/admin/users/delete", api_admin_user_delete)
    r.add_get("/api/admin/accounts", api_admin_accounts)
    r.add_get("/api/admin/plans", api_admin_plans)
    r.add_post("/api/admin/plans/save", api_admin_plan_save)
    r.add_post("/api/admin/plans/delete", api_admin_plan_delete)
    r.add_get("/api/admin/orders", api_admin_orders)
    r.add_post("/api/admin/orders/review", api_admin_order_review)
    r.add_get("/api/admin/keys", api_admin_keys)
    r.add_post("/api/admin/keys/generate", api_admin_keys_generate)
    r.add_post("/api/admin/keys/delete", api_admin_key_delete)
    r.add_get("/api/admin/levels", api_admin_levels)
    r.add_post("/api/admin/levels", api_admin_levels_save)
    r.add_get("/api/admin/settings", api_admin_settings)
    r.add_post("/api/admin/settings", api_admin_settings_save)

    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, host, port)
    await site.start()
    bot_state.refresh_callbacks["_sync_task"] = asyncio.create_task(sync_loop())
    print(f"\033[92m[+] Web Panel running on http://localhost:{port}  (admin: /admin, users: /panel)\033[0m")
