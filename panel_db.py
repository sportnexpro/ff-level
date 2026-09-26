# -*- coding: utf-8 -*-
"""
Selling panel storage (MongoDB): users, plans, subscriptions, game accounts,
orders, license keys, level EXP table and site settings.

Uses PyMongo's native async client so database round-trips never block the
bot's event loop. Existing data from the old SQLite panel.db is migrated on
first start.
"""

import asyncio
import datetime as dt
import hashlib
import hmac
import json
import os
import secrets
import sqlite3
import time
from typing import Any, Dict, List, Optional, Tuple

from pymongo import ASCENDING, DESCENDING, AsyncMongoClient, ReturnDocument
from pymongo.errors import DuplicateKeyError

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LEGACY_ACCOUNTS_FILE = os.path.join(BASE_DIR, "accounts.json")
LEGACY_SQLITE_FILE = os.path.join(BASE_DIR, "panel.db")
LEGACY_DEVICES_FILE = os.path.join(BASE_DIR, "devices.json")
LEGACY_TOKEN_CACHE_FILE = os.path.join(BASE_DIR, "token_cache.json")

PBKDF2_ROUNDS = 150_000
SESSION_TTL = 7 * 24 * 3600
KEY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no 0/O/1/I

DEFAULT_SETTINGS: Dict[str, str] = {
    "site_name": "FF Level",
    "tagline": "Free Fire auto level-up that runs 24/7 while you sleep.",
    "currency": "৳",
    "payment_methods": json.dumps([
        {"name": "bKash", "number": "01XXXXXXXXX", "type": "Personal"},
        {"name": "Nagad", "number": "01XXXXXXXXX", "type": "Personal"},
    ]),
    "payment_note": "Send Money to one of the numbers above, then submit your sender number and Transaction ID. "
                    "Your plan activates as soon as the payment is verified.",
    "contact_telegram": "",
    "contact_whatsapp": "",
    "allow_register": "1",
    "announcement": "",
}

PUBLIC_SETTINGS = ("site_name", "tagline", "currency", "payment_methods", "payment_note",
                   "contact_telegram", "contact_whatsapp", "allow_register", "announcement")

DEFAULT_PLANS = [
    # name, price, duration_hours, max_accounts, features, popular, sort
    ("Starter", 150, 24 * 7, 1, "1 Free Fire account\n7 days access\nLive EXP tracking\n24/7 auto matches", 0, 1),
    ("Pro", 450, 24 * 30, 3, "3 Free Fire accounts\n30 days access\nLive EXP tracking\nPriority support", 1, 2),
    ("Elite", 1200, 24 * 30, 10, "10 Free Fire accounts\n30 days access\nLive EXP tracking\nVIP support", 0, 3),
]

# Total EXP needed to reach each Free Fire level.
FF_LEVEL_EXP: Dict[int, int] = {
    1: 0, 2: 48, 3: 202, 4: 544, 5: 1012, 6: 1844, 7: 2792, 8: 3800,
    9: 4870, 10: 6004, 11: 7192, 12: 8448, 13: 9776, 14: 11140, 15: 12566,
    16: 14060, 17: 15610, 18: 17224, 19: 18902, 20: 20632, 21: 22424,
    22: 24728, 23: 26192, 24: 28166, 25: 30200, 26: 32294, 27: 34448,
    28: 37804, 29: 41174, 30: 44870, 31: 48852, 32: 53334, 33: 58566,
    34: 64096, 35: 69994, 36: 76460, 37: 83108, 38: 91128, 39: 99322,
    40: 108092, 41: 120144, 42: 133266, 43: 147472, 44: 162760, 45: 179126,
    46: 196572, 47: 215368, 48: 235516, 49: 257010, 50: 279860, 51: 304056,
    52: 348318, 53: 394982, 54: 444044, 55: 495508, 56: 549364, 57: 633756,
    58: 721744, 59: 813336, 60: 908522, 61: 1041438, 62: 1180352, 63: 1325256,
    64: 1476184, 65: 1634300, 66: 1840946, 67: 2056594, 68: 2281242, 69: 2514880,
    70: 2757530, 71: 3059506, 72: 3372284, 73: 3699456, 74: 4041030, 75: 4397020,
    76: 4829104, 77: 5282204, 78: 5756304, 79: 6251404, 80: 6767504, 81: 7381324,
    82: 8043154, 83: 8752952, 84: 9510808, 85: 10316638, 86: 11277190, 87: 12360748,
    88: 13360304, 89: 14482858, 90: 15659418, 91: 17026708, 92: 18453688, 93: 19941280,
    94: 21488570, 95: 23095858, 96: 24763138, 97: 26490138, 98: 28277708, 99: 30124996,
    100: 32032284,
}
MAX_LEVEL = max(FF_LEVEL_EXP)


class PanelError(Exception):
    """Raised for invalid user input; message is safe to show to the client."""

    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.status = status


# ==================== PASSWORDS (run via asyncio.to_thread) ====================

def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ROUNDS)
    return f"pbkdf2${PBKDF2_ROUNDS}${salt.hex()}${dk.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        _, rounds, salt, digest = stored.split("$")
        dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes.fromhex(salt), int(rounds))
        return hmac.compare_digest(dk.hex(), digest)
    except Exception:
        return False


def _bsonable(obj: Any) -> Any:
    """Make bot data storable in MongoDB (bytearray -> bytes, tuples -> lists, keys -> str)."""
    if isinstance(obj, bytearray):
        return bytes(obj)
    if isinstance(obj, dict):
        return {str(k): _bsonable(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_bsonable(v) for v in obj]
    return obj


def _from_hex_json(obj: Any) -> Any:
    """Decode token_cache.json's {"__bytes_hex__": "..."} wrappers back into bytes."""
    if isinstance(obj, dict):
        if "__bytes_hex__" in obj and len(obj) == 1:
            try:
                return bytes.fromhex(obj["__bytes_hex__"])
            except Exception:
                return b""
        return {k: _from_hex_json(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_from_hex_json(v) for v in obj]
    return obj


def _out(doc: Optional[Dict[str, Any]], key: str = "id") -> Optional[Dict[str, Any]]:
    """Mongo document -> plain dict with `_id` renamed (id / code / key)."""
    if doc is None:
        return None
    doc = dict(doc)
    doc[key] = doc.pop("_id")
    return doc


class PanelDB:
    def __init__(self, uri: str, db_name: str = "fflevel"):
        self.client = AsyncMongoClient(uri, serverSelectionTimeoutMS=10000, appname="ff-level-panel")
        self.db = self.client[db_name]
        self.levels: Dict[int, Dict[str, Any]] = {}
        self._bg: set = set()
        # Bot data kept in memory (loaded from MongoDB on start, written back in the background).
        self.bot_devices: Dict[str, Dict[str, Any]] = {}
        self.bot_tokens: Dict[str, Dict[str, Any]] = {}
        self.bot_store_ready = False

    # ---------- setup ----------
    async def init(self):
        await self.client.admin.command("ping")
        d = self.db
        await d.users.create_index("username_lc", unique=True)
        await d.accounts.create_index([("kind", ASCENDING), ("login", ASCENDING)], unique=True)
        await d.accounts.create_index("user_id")
        await d.orders.create_index("user_id")
        await d.orders.create_index("status")
        await d.orders.create_index("trx_id_lc")
        await d.sessions.create_index("user_id")
        await d.sessions.create_index("expires", expireAfterSeconds=0)  # Mongo deletes expired sessions itself
        await self._migrate_from_sqlite()
        await self._seed()
        self.levels = {doc["_id"]: _out(doc, "level") async for doc in d.level_exp.find()}
        await self._import_bot_files()
        self.bot_devices = {doc.pop("_id"): doc async for doc in d.bot_devices.find()}
        self.bot_tokens = {doc.pop("_id"): doc async for doc in d.bot_token_cache.find()}
        self.bot_store_ready = True

    async def _next_id(self, name: str) -> int:
        doc = await self.db.counters.find_one_and_update(
            {"_id": name}, {"$inc": {"seq": 1}}, upsert=True, return_document=ReturnDocument.AFTER)
        return doc["seq"]

    async def _seed(self):
        for k, v in DEFAULT_SETTINGS.items():
            await self.db.settings.update_one({"_id": k}, {"$setOnInsert": {"value": v}}, upsert=True)
        if await self.get_setting("site_name") == "LevelUp Pro":  # old default name
            await self.set_setting("site_name", DEFAULT_SETTINGS["site_name"])
        if not await self.get_setting("plans_seeded") and not await self.db.plans.count_documents({}, limit=1):
            now = time.time()
            for name, price, hours, slots, feats, popular, sort in DEFAULT_PLANS:
                await self.db.plans.insert_one({
                    "_id": await self._next_id("plans"), "name": name, "price": price, "duration_hours": hours,
                    "max_accounts": slots, "features": feats, "is_popular": popular, "is_active": 1,
                    "sort_order": sort, "created_at": now})
            await self.set_setting("plans_seeded", "1")

    def _spawn(self, coro):
        """Fire-and-forget a DB write from sync code (keeps a reference so it isn't GC'd)."""
        try:
            task = asyncio.get_running_loop().create_task(coro)
        except RuntimeError:
            coro.close()
            return
        self._bg.add(task)
        task.add_done_callback(self._bg.discard)

    # ---------- one-time import of the old SQLite database ----------
    async def _migrate_from_sqlite(self):
        if not os.path.exists(LEGACY_SQLITE_FILE) or await self.get_setting("sqlite_migrated"):
            return
        if await self.db.users.count_documents({}, limit=1):
            await self.set_setting("sqlite_migrated", "skipped: mongo already had users")
            return
        con = sqlite3.connect(LEGACY_SQLITE_FILE)
        con.row_factory = sqlite3.Row

        def rows(table: str) -> List[Dict[str, Any]]:
            try:
                return [dict(r) for r in con.execute(f"SELECT * FROM {table}")]
            except sqlite3.Error:
                return []

        d = self.db
        for r in rows("settings"):
            await d.settings.replace_one({"_id": r["key"]}, {"value": r["value"]}, upsert=True)
        maxima: Dict[str, int] = {}
        for table, coll in (("plans", d.plans), ("users", d.users), ("accounts", d.accounts), ("orders", d.orders)):
            for r in rows(table):
                r["_id"] = r.pop("id")
                if table == "users":
                    r["username_lc"] = r["username"].lower()
                if table == "orders":
                    r["trx_id_lc"] = r["trx_id"].lower()
                await coll.replace_one({"_id": r["_id"]}, r, upsert=True)
                maxima[table] = max(maxima.get(table, 0), r["_id"])
        for r in rows("license_keys"):
            r["_id"] = r.pop("code")
            await d.license_keys.replace_one({"_id": r["_id"]}, r, upsert=True)
        for r in rows("level_exp"):
            r["_id"] = r.pop("level")
            await d.level_exp.replace_one({"_id": r["_id"]}, r, upsert=True)
        for r in rows("sessions"):  # keep people signed in
            if (r.get("expires_at") or 0) > time.time():
                r["_id"] = r.pop("token")
                r["expires"] = dt.datetime.fromtimestamp(r["expires_at"], dt.timezone.utc)
                await d.sessions.replace_one({"_id": r["_id"]}, r, upsert=True)
        for name, seq in maxima.items():
            await d.counters.update_one({"_id": name}, {"$max": {"seq": seq}}, upsert=True)
        con.close()
        await self.set_setting("sqlite_migrated", "1")
        print(f"\033[92m[+] Migrated panel.db (SQLite) into MongoDB: "
              f"{', '.join(f'{v} max id in {k}' for k, v in maxima.items()) or 'settings only'}\033[0m")

    # ---------- bot data: device profiles + login token cache ----------
    async def _import_bot_files(self):
        """One-time import of devices.json and token_cache.json (files are left in place as a backup)."""
        if await self.get_setting("bot_files_imported"):
            return
        counts = {}
        for path, coll, decode in ((LEGACY_DEVICES_FILE, self.db.bot_devices, lambda x: x),
                                   (LEGACY_TOKEN_CACHE_FILE, self.db.bot_token_cache, _from_hex_json)):
            n = 0
            try:
                with open(path, "r", encoding="utf-8") as f:
                    data = decode(json.load(f))
                for key, doc in (data.items() if isinstance(data, dict) else []):
                    if isinstance(doc, dict):
                        await coll.replace_one({"_id": str(key)}, _bsonable(doc), upsert=True)
                        n += 1
            except FileNotFoundError:
                pass
            except Exception as e:
                print(f"\033[93m[!] Could not import {os.path.basename(path)}: {e}\033[0m")
            counts[os.path.basename(path)] = n
        await self.set_setting("bot_files_imported", "1")
        if any(counts.values()):
            print(f"\033[92m[+] Imported into MongoDB: {', '.join(f'{v} from {k}' for k, v in counts.items())}\033[0m")

    def save_bot_device(self, key: str, device: Dict[str, Any]):
        self.bot_devices[key] = device
        self._spawn(self.db.bot_devices.replace_one({"_id": key}, _bsonable(device), upsert=True))

    def save_bot_token(self, key: str, entry: Dict[str, Any]):
        self.bot_tokens[key] = entry
        self._spawn(self.db.bot_token_cache.replace_one({"_id": key}, _bsonable(entry), upsert=True))

    def delete_bot_token(self, key: str):
        self.bot_tokens.pop(key, None)
        self._spawn(self.db.bot_token_cache.delete_one({"_id": key}))

    # ---------- settings ----------
    async def get_setting(self, key: str, default: str = "") -> str:
        doc = await self.db.settings.find_one({"_id": key})
        return doc["value"] if doc else default

    async def set_setting(self, key: str, value: str):
        await self.db.settings.update_one({"_id": key}, {"$set": {"value": value}}, upsert=True)

    async def settings(self) -> Dict[str, Any]:
        data = {doc["_id"]: doc["value"] async for doc in self.db.settings.find({"_id": {"$in": list(PUBLIC_SETTINGS)}})}
        out: Dict[str, Any] = {k: data.get(k, DEFAULT_SETTINGS.get(k, "")) for k in PUBLIC_SETTINGS}
        try:
            out["payment_methods"] = json.loads(out["payment_methods"] or "[]")
        except Exception:
            out["payment_methods"] = []
        out["allow_register"] = out["allow_register"] == "1"
        return out

    async def save_settings(self, data: Dict[str, Any]):
        for key in PUBLIC_SETTINGS:
            if key not in data:
                continue
            val = data[key]
            if key == "payment_methods":
                methods = []
                for m in val or []:
                    name = str(m.get("name", "")).strip()[:40]
                    if name:
                        methods.append({"name": name,
                                        "number": str(m.get("number", "")).strip()[:40],
                                        "type": str(m.get("type", "")).strip()[:30]})
                val = json.dumps(methods)
            elif key == "allow_register":
                val = "1" if val else "0"
            else:
                val = str(val).strip()[:600]
            await self.set_setting(key, val)

    # ---------- plans ----------
    async def list_plans(self, active_only: bool = False) -> List[Dict[str, Any]]:
        q = {"is_active": 1} if active_only else {}
        cur = self.db.plans.find(q).sort([("sort_order", ASCENDING), ("price", ASCENDING)])
        return [_out(d) async for d in cur]

    async def get_plan(self, plan_id: int) -> Optional[Dict[str, Any]]:
        return _out(await self.db.plans.find_one({"_id": plan_id}))

    async def save_plan(self, data: Dict[str, Any]) -> int:
        name = str(data.get("name", "")).strip()[:40]
        if not name:
            raise PanelError("Plan name is required")
        try:
            price = round(float(data.get("price", 0)), 2)
            hours = int(data.get("duration_hours", 0))
            slots = int(data.get("max_accounts", 0))
            sort = int(data.get("sort_order", 0) or 0)
        except (TypeError, ValueError):
            raise PanelError("Price, duration and accounts must be numbers")
        if price < 0 or hours < 1 or slots < 1:
            raise PanelError("Duration and accounts must be at least 1, price can't be negative")
        feats = "\n".join(l.strip() for l in str(data.get("features", "")).splitlines() if l.strip())[:1000]
        fields = {"name": name, "price": price, "duration_hours": hours, "max_accounts": slots, "features": feats,
                  "is_popular": 1 if data.get("is_popular") else 0, "is_active": 1 if data.get("is_active", True) else 0,
                  "sort_order": sort}
        if data.get("id"):
            plan_id = int(data["id"])
            await self.db.plans.update_one({"_id": plan_id}, {"$set": fields})
            return plan_id
        plan_id = await self._next_id("plans")
        await self.db.plans.insert_one({"_id": plan_id, **fields, "created_at": time.time()})
        return plan_id

    async def delete_plan(self, plan_id: int):
        await self.db.plans.delete_one({"_id": plan_id})

    # ---------- users ----------
    async def get_user(self, user_id: int) -> Optional[Dict[str, Any]]:
        return _out(await self.db.users.find_one({"_id": user_id}))

    async def get_user_by_name(self, username: str) -> Optional[Dict[str, Any]]:
        return _out(await self.db.users.find_one({"username_lc": username.lower()}))

    async def create_user(self, username: str, pass_hash: str, role: str = "user") -> int:
        if await self.get_user_by_name(username):
            raise PanelError("That username is already taken")
        user_id = await self._next_id("users")
        try:
            await self.db.users.insert_one({
                "_id": user_id, "username": username, "username_lc": username.lower(), "pass_hash": pass_hash,
                "role": role, "plan_name": None, "max_accounts": 0, "expires_at": None, "is_banned": 0,
                "note": "", "created_at": time.time(), "last_login": None})
        except DuplicateKeyError:
            raise PanelError("That username is already taken")
        return user_id

    async def list_users(self) -> List[Dict[str, Any]]:
        used = {d["_id"]: d["n"] async for d in await self.db.accounts.aggregate(
            [{"$group": {"_id": "$user_id", "n": {"$sum": 1}}}])}
        users = [_out(d) async for d in self.db.users.find({}, {"pass_hash": 0, "username_lc": 0})]
        for u in users:
            u["used"] = used.get(u["id"], 0)
        users.sort(key=lambda u: (u["role"] != "admin", -(u["created_at"] or 0)))
        return users

    async def update_user(self, user_id: int, **fields):
        allowed = {"plan_name", "max_accounts", "expires_at", "is_banned", "note", "pass_hash", "last_login"}
        sets = {k: v for k, v in fields.items() if k in allowed}
        if sets:
            await self.db.users.update_one({"_id": user_id}, {"$set": sets})

    async def delete_user(self, user_id: int):
        await self.db.accounts.delete_many({"user_id": user_id})
        await self.db.orders.delete_many({"user_id": user_id})
        await self.db.sessions.delete_many({"user_id": user_id})
        await self.db.license_keys.update_many({"redeemed_by": user_id}, {"$set": {"redeemed_by": None}})
        await self.db.users.delete_one({"_id": user_id})

    async def grant(self, user_id: int, hours: int, max_accounts: int, plan_name: str):
        """Extend access (stacks on remaining time) and set the account-slot limit."""
        u = await self.get_user(user_id)
        if not u:
            raise PanelError("User not found", 404)
        base = max(time.time(), u["expires_at"] or 0)
        await self.update_user(user_id, expires_at=base + hours * 3600, max_accounts=max_accounts, plan_name=plan_name)

    @staticmethod
    def has_access(u: Dict[str, Any]) -> bool:
        if u.get("is_banned"):
            return False
        return u.get("role") == "admin" or (u.get("expires_at") or 0) > time.time()

    async def ensure_admin(self) -> Optional[Tuple[str, str]]:
        """Create the first admin on a fresh database. Returns (username, password) if one was created."""
        if await self.db.users.find_one({"role": "admin"}, {"_id": 1}):
            return None
        password = secrets.token_urlsafe(9)
        username = "admin"
        if await self.get_user_by_name(username):
            username = f"admin{secrets.randbelow(9000) + 1000}"
        await self.create_user(username, hash_password(password), role="admin")
        return username, password

    async def first_admin_id(self) -> Optional[int]:
        doc = await self.db.users.find_one({"role": "admin"}, {"_id": 1}, sort=[("_id", ASCENDING)])
        return doc["_id"] if doc else None

    # ---------- sessions ----------
    async def create_session(self, user_id: int) -> str:
        token = secrets.token_urlsafe(32)
        now = time.time()
        await self.db.sessions.insert_one({
            "_id": token, "user_id": user_id, "created_at": now, "expires_at": now + SESSION_TTL,
            "expires": dt.datetime.fromtimestamp(now + SESSION_TTL, dt.timezone.utc)})
        await self.update_user(user_id, last_login=now)
        return token

    async def session_user(self, token: str) -> Optional[Dict[str, Any]]:
        s = await self.db.sessions.find_one({"_id": token, "expires_at": {"$gt": time.time()}})
        return await self.get_user(s["user_id"]) if s else None

    async def delete_session(self, token: str):
        await self.db.sessions.delete_one({"_id": token})

    async def delete_user_sessions(self, user_id: int, keep: Optional[str] = None):
        q: Dict[str, Any] = {"user_id": user_id}
        if keep:
            q["_id"] = {"$ne": keep}
        await self.db.sessions.delete_many(q)

    async def purge_sessions(self):
        await self.db.sessions.delete_many({"expires_at": {"$lt": time.time()}})

    # ---------- game accounts ----------
    async def list_accounts(self, user_id: Optional[int] = None) -> List[Dict[str, Any]]:
        if user_id is not None:
            return [_out(d) async for d in self.db.accounts.find({"user_id": user_id}).sort("_id", ASCENDING)]
        names = {d["_id"]: d["username"] async for d in self.db.users.find({}, {"username": 1})}
        rows = [_out(d) async for d in self.db.accounts.find().sort("_id", ASCENDING)]
        for r in rows:
            r["username"] = names.get(r["user_id"], "deleted")
        return rows

    async def get_account(self, account_id: int) -> Optional[Dict[str, Any]]:
        return _out(await self.db.accounts.find_one({"_id": account_id}))

    async def count_accounts(self, user_id: int) -> int:
        return await self.db.accounts.count_documents({"user_id": user_id})

    async def add_account(self, user_id: int, kind: str, login: str, password: str = "") -> int:
        if await self.db.accounts.find_one({"kind": kind, "login": login}, {"_id": 1}):
            raise PanelError("This account is already added to the bot")
        account_id = await self._next_id("accounts")
        try:
            await self.db.accounts.insert_one({
                "_id": account_id, "user_id": user_id, "kind": kind, "login": login, "password": password,
                "game_id": None, "nickname": None, "created_at": time.time()})
        except DuplicateKeyError:
            raise PanelError("This account is already added to the bot")
        return account_id

    async def delete_account(self, account_id: int):
        await self.db.accounts.delete_one({"_id": account_id})

    async def set_account_game(self, account_id: int, game_id: str, nickname: Optional[str]):
        sets: Dict[str, Any] = {"game_id": game_id}
        if nickname:
            sets["nickname"] = nickname
        await self.db.accounts.update_one({"_id": account_id}, {"$set": sets})

    async def runnable_accounts(self) -> List[Dict[str, Any]]:
        """Accounts whose owner has access, capped at the owner's slot limit (oldest first)."""
        now = time.time()
        owners = {u["_id"]: u async for u in self.db.users.find(
            {"is_banned": {"$in": [0, False, None]}, "$or": [{"role": "admin"}, {"expires_at": {"$gt": now}}]},
            {"role": 1, "max_accounts": 1})}
        if not owners:
            return []
        rows = [_out(d) async for d in self.db.accounts.find({"user_id": {"$in": list(owners)}})
                .sort([("user_id", ASCENDING), ("_id", ASCENDING)])]
        used: Dict[int, int] = {}
        out = []
        for r in rows:
            owner = owners[r["user_id"]]
            n = used.get(r["user_id"], 0)
            if owner["role"] != "admin" and n >= (owner.get("max_accounts") or 0):
                continue
            used[r["user_id"]] = n + 1
            out.append(r)
        return out

    async def import_legacy_accounts(self, admin_id: int) -> int:
        """One-time import of the old accounts.json into the admin's account list."""
        if await self.get_setting("legacy_imported") or not os.path.exists(LEGACY_ACCOUNTS_FILE):
            return 0
        added = 0
        try:
            with open(LEGACY_ACCOUNTS_FILE, "r", encoding="utf-8") as f:
                items = json.load(f)
            for acc in items if isinstance(items, list) else []:
                try:
                    if acc.get("token"):
                        await self.add_account(admin_id, "token", str(acc["token"]).strip())
                    elif acc.get("uid") and acc.get("password"):
                        await self.add_account(admin_id, "guest", str(acc["uid"]).strip(), str(acc["password"]).strip())
                    else:
                        continue
                    added += 1
                except PanelError:
                    pass
        except Exception:
            pass
        await self.set_setting("legacy_imported", "1")
        return added

    # ---------- orders ----------
    async def create_order(self, user_id: int, plan: Dict[str, Any], method: str, sender: str, trx_id: str) -> int:
        if await self.db.orders.count_documents({"user_id": user_id, "status": "pending"}) >= 3:
            raise PanelError("You already have 3 pending orders. Please wait for them to be reviewed.")
        if await self.db.orders.find_one({"trx_id_lc": trx_id.lower(), "status": {"$ne": "rejected"}}, {"_id": 1}):
            raise PanelError("This Transaction ID has already been submitted")
        order_id = await self._next_id("orders")
        await self.db.orders.insert_one({
            "_id": order_id, "user_id": user_id, "plan_id": plan["id"], "plan_name": plan["name"],
            "amount": plan["price"], "duration_hours": plan["duration_hours"], "max_accounts": plan["max_accounts"],
            "method": method, "sender": sender, "trx_id": trx_id, "trx_id_lc": trx_id.lower(), "status": "pending",
            "admin_note": "", "created_at": time.time(), "reviewed_at": None})
        return order_id

    async def list_orders(self, user_id: Optional[int] = None, status: Optional[str] = None,
                          limit: int = 500) -> List[Dict[str, Any]]:
        q: Dict[str, Any] = {}
        if user_id is not None:
            q["user_id"] = user_id
        if status:
            q["status"] = status
        rows = [_out(d) async for d in self.db.orders.find(q, {"trx_id_lc": 0}).sort("created_at", DESCENDING).limit(limit)]
        ids = list({r["user_id"] for r in rows})
        names = {d["_id"]: d["username"] async for d in self.db.users.find({"_id": {"$in": ids}}, {"username": 1})}
        for r in rows:
            r["username"] = names.get(r["user_id"])
        return rows

    async def review_order(self, order_id: int, approve: bool, note: str = "") -> Dict[str, Any]:
        # Atomically claim the pending order so a double click can't grant twice.
        o = await self.db.orders.find_one_and_update(
            {"_id": order_id, "status": "pending"},
            {"$set": {"status": "approved" if approve else "rejected", "admin_note": note[:200], "reviewed_at": time.time()}})
        if not o:
            if await self.db.orders.find_one({"_id": order_id}, {"_id": 1}):
                raise PanelError("This order was already reviewed")
            raise PanelError("Order not found", 404)
        o = _out(o)
        if approve:
            await self.grant(o["user_id"], o["duration_hours"], o["max_accounts"], o["plan_name"])
        return o

    # ---------- license keys ----------
    @staticmethod
    def _new_code() -> str:
        return "LVL-" + "-".join("".join(secrets.choice(KEY_ALPHABET) for _ in range(4)) for _ in range(3))

    async def generate_keys(self, count: int, plan_name: str, hours: int, max_accounts: int, note: str = "") -> List[str]:
        now = time.time()
        codes = [self._new_code() for _ in range(count)]
        await self.db.license_keys.insert_many([
            {"_id": c, "plan_name": plan_name, "duration_hours": hours, "max_accounts": max_accounts,
             "note": note[:100], "created_at": now, "redeemed_by": None, "redeemed_at": None} for c in codes])
        return codes

    async def list_keys(self) -> List[Dict[str, Any]]:
        rows = [_out(d, "code") async for d in self.db.license_keys.find().sort([("created_at", DESCENDING), ("_id", ASCENDING)]).limit(1000)]
        ids = list({r["redeemed_by"] for r in rows if r.get("redeemed_by")})
        names = {d["_id"]: d["username"] async for d in self.db.users.find({"_id": {"$in": ids}}, {"username": 1})}
        for r in rows:
            r["redeemed_username"] = names.get(r.get("redeemed_by"))
        return rows

    async def delete_key(self, code: str):
        await self.db.license_keys.delete_one({"_id": code})

    async def redeem_key(self, user_id: int, code: str) -> Dict[str, Any]:
        code = code.strip().upper()
        k = await self.db.license_keys.find_one_and_update(
            {"_id": code, "redeemed_at": None}, {"$set": {"redeemed_by": user_id, "redeemed_at": time.time()}})
        if not k:
            if await self.db.license_keys.find_one({"_id": code}, {"_id": 1}):
                raise PanelError("This license key has already been used")
            raise PanelError("Invalid license key")
        k = _out(k, "code")
        await self.grant(user_id, k["duration_hours"], k["max_accounts"], k["plan_name"])
        return k

    # ---------- level EXP table (built-in table + admin overrides + learned) ----------
    def _level_row(self, level: int) -> Dict[str, Any]:
        return self.levels.setdefault(level, {"level": level, "hi": None, "lo": None, "override": None})

    def _save_level(self, r: Dict[str, Any]):
        self._spawn(self.db.level_exp.update_one(
            {"_id": r["level"]}, {"$set": {"hi": r["hi"], "lo": r["lo"], "override": r["override"]}}, upsert=True))

    def observe_level(self, level: int, exp: int):
        """Record that an account was seen at `level` with `exp` total EXP (in memory, persisted in background)."""
        if not level or level < 1 or not exp or exp <= 0:
            return
        cur = self._level_row(level)
        if cur["hi"] is None or exp < cur["hi"]:
            cur["hi"] = exp
            self._save_level(cur)
        nxt = self._level_row(level + 1)
        if nxt["lo"] is None or exp > nxt["lo"]:
            nxt["lo"] = exp
            self._save_level(nxt)

    def level_threshold(self, level: int) -> Optional[float]:
        """Total EXP needed to reach `level`: admin override > built-in table > learned (None if unknown)."""
        r = self.levels.get(level)
        if r and r["override"] is not None:
            return r["override"]
        if level in FF_LEVEL_EXP:
            return FF_LEVEL_EXP[level]
        return r["hi"] if r else None

    def level_table(self) -> List[Dict[str, Any]]:
        """Admin overrides only; levels 1-100 come from the built-in table."""
        return [dict(r) for _, r in sorted(self.levels.items()) if r["override"] is not None]

    async def set_level_overrides(self, mapping: Dict[int, float]):
        for r in list(self.levels.values()):
            if r["override"] is not None and r["level"] not in mapping:
                r["override"] = None
                await self.db.level_exp.update_one({"_id": r["level"]}, {"$set": {"override": None}}, upsert=True)
        for level, exp in mapping.items():
            r = self._level_row(level)
            r["override"] = exp
            await self.db.level_exp.update_one({"_id": level}, {"$set": {"hi": r["hi"], "lo": r["lo"], "override": exp}}, upsert=True)

    # ---------- stats ----------
    async def admin_stats(self) -> Dict[str, Any]:
        now = time.time()
        month_start = time.mktime(time.localtime(now)[:2] + (1, 0, 0, 0, 0, 0, -1))
        d = self.db

        async def revenue(since: float = 0) -> float:
            q: Dict[str, Any] = {"status": "approved"}
            if since:
                q["reviewed_at"] = {"$gte": since}
            async for doc in await d.orders.aggregate([{"$match": q}, {"$group": {"_id": None, "n": {"$sum": "$amount"}}}]):
                return doc["n"] or 0
            return 0

        return {
            "users": await d.users.count_documents({"role": {"$ne": "admin"}}),
            "active_users": await d.users.count_documents(
                {"role": {"$ne": "admin"}, "is_banned": {"$in": [0, False, None]}, "expires_at": {"$gt": now}}),
            "pending_orders": await d.orders.count_documents({"status": "pending"}),
            "revenue_total": await revenue(),
            "revenue_month": await revenue(month_start),
            "accounts": await d.accounts.count_documents({}),
            "unused_keys": await d.license_keys.count_documents({"redeemed_at": None}),
        }
