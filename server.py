#!/usr/bin/env python3
"""שרת חדר הבריחה "הקפוצ'ינו שלא היה אמור להזיק".

בלי תלויות: python3 server.py   (פורט ברירת מחדל 3000, או PORT=8080)
"""
import json
import mimetypes
import os
import random
import secrets
import socket
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

ROOT = os.path.dirname(os.path.abspath(__file__))
PUBLIC = os.path.join(ROOT, "public")
DATA_FILE = os.path.join(ROOT, "data", "sessions.json")
PORT = int(os.environ.get("PORT", "3000"))
SESSION_TTL = 24 * 3600
MAX_TEAMS = 60
MAX_BODY = 32 * 1024

lock = threading.Lock()
sessions = {}
_dirty = False


def now_ms():
    return int(time.time() * 1000)


def load():
    global sessions
    try:
        with open(DATA_FILE, encoding="utf-8") as f:
            sessions = json.load(f)
    except (OSError, ValueError):
        sessions = {}


def saver():
    """כותב לדיסק ברקע, כדי שהפעלה מחדש של השרת לא תמחק שיעור."""
    global _dirty
    while True:
        time.sleep(2)
        with lock:
            cutoff = now_ms() - SESSION_TTL * 1000
            for code in [c for c, s in sessions.items() if s.get("createdAt", 0) < cutoff]:
                del sessions[code]
                _dirty = True
            if not _dirty:
                continue
            _dirty = False
            blob = json.dumps(sessions, ensure_ascii=False)
        try:
            os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
            tmp = DATA_FILE + ".tmp"
            with open(tmp, "w", encoding="utf-8") as f:
                f.write(blob)
            os.replace(tmp, DATA_FILE)
        except OSError:
            pass


def touch():
    global _dirty
    _dirty = True


def lan_ips():
    ips = []
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("10.255.255.255", 1))
        ips.append(s.getsockname()[0])
        s.close()
    except OSError:
        pass
    return [ip for ip in ips if not ip.startswith("127.")]


def new_session():
    for _ in range(500):
        code = "%04d" % random.randint(1000, 9999)
        if code not in sessions:
            break
    s = {
        "code": code,
        "key": secrets.token_urlsafe(18),
        "createdAt": now_ms(),
        "epoch": 1,
        "started": False,
        "paused": False,
        "pausedAt": 0,
        "extraMin": 0,
        "twist": {"slide": 0, "voteOpen": False, "reveal": False},
        "exitReleased": False,
        "teams": {},
    }
    sessions[code] = s
    return s


def _s(v, n):
    return v[:n] if isinstance(v, str) else ""


def _n(v, lo=0, hi=10 ** 7):
    try:
        return max(lo, min(hi, int(v)))
    except (TypeError, ValueError):
        return lo


def clean_team(t, prev, now):
    """מקבל תמונת מצב מהטלפון ושומר רק שדות מוכרים, בגודל מוגבל."""
    solved = t.get("solved") if isinstance(t.get("solved"), list) else []
    bridges = t.get("bridges") if isinstance(t.get("bridges"), list) else []
    v = t.get("verdict") if isinstance(t.get("verdict"), dict) else {}
    station = _n(t.get("station"), 0, 5)
    out = {
        "id": _s(t.get("id"), 40),
        "name": _s(t.get("name"), 30),
        "icon": _s(t.get("icon"), 12),
        "screen": _s(t.get("screen"), 12),
        "station": station,
        "solved": [bool(x) for x in solved[:4]],
        "hints": _n(t.get("hints"), 0, 99),
        "wrong": _n(t.get("wrong"), 0, 999),
        "elapsed": _n(t.get("elapsed")),
        "running": bool(t.get("running")),
        "bridges": [_s(x, 600) for x in bridges[:4]],
        "verdict": {
            "cafe": _s(v.get("cafe"), 10),
            "cafeWhy": _s(v.get("cafeWhy"), 600),
            "mom": _s(v.get("mom"), 10),
            "momWhy": _s(v.get("momWhy"), 600),
            "menu": _s(v.get("menu"), 300),
            "sent": bool(v.get("sent")),
        },
        "vote": _s(t.get("vote"), 10),
        "exitAnswer": _s(t.get("exitAnswer"), 1000),
        "exitSent": bool(t.get("exitSent")),
        "joinedAt": prev["joinedAt"] if prev else now,
        "lastSeen": now,
        "skip": prev["skip"] if prev else 0,
        "stationSince": prev["stationSince"] if prev and prev.get("station") == station else now,
    }
    return out


def public_state(s, team=None):
    return {
        "ok": True,
        "epoch": s["epoch"],
        "started": s["started"],
        "paused": s["paused"],
        "extraMin": s["extraMin"],
        "voteOpen": s["twist"]["voteOpen"],
        "reveal": s["twist"]["reveal"],
        "exitReleased": s["exitReleased"],
        "skip": team["skip"] if team else 0,
        "now": now_ms(),
    }


def control(s, body):
    action = body.get("action")
    now = now_ms()
    if action == "start":
        s["started"] = True
    elif action == "pause" and not s["paused"]:
        s["paused"] = True
        s["pausedAt"] = now
    elif action == "resume" and s["paused"]:
        s["paused"] = False
        gap = now - s.get("pausedAt", now)
        for t in s["teams"].values():
            t["stationSince"] += gap
    elif action == "addMin":
        s["extraMin"] = max(0, min(60, s["extraMin"] + _n(body.get("value"), 0, 30)))
    elif action == "skip":
        t = s["teams"].get(_s(body.get("teamId"), 40))
        if t:
            t["skip"] += 1
    elif action == "removeTeam":
        s["teams"].pop(_s(body.get("teamId"), 40), None)
    elif action == "twist":
        slide = _n(body.get("slide"), 0, 3)
        s["twist"]["slide"] = slide
        if slide == 3:
            s["twist"]["voteOpen"] = True
        if slide == 0:
            s["twist"]["voteOpen"] = False
    elif action == "reveal":
        s["twist"]["reveal"] = bool(body.get("value", True))
    elif action == "exit":
        s["exitReleased"] = bool(body.get("value", True))
    elif action == "reset":
        s.update({
            "epoch": s["epoch"] + 1, "started": False, "paused": False, "extraMin": 0,
            "twist": {"slide": 0, "voteOpen": False, "reveal": False},
            "exitReleased": False, "teams": {},
        })
    else:
        return False
    return True


class Handler(BaseHTTPRequestHandler):
    server_version = "CowFree/1.0"
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):
        pass

    def send_json(self, obj, status=200):
        data = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def read_body(self):
        length = _n(self.headers.get("Content-Length"), 0)
        if length > MAX_BODY:
            return None
        try:
            body = json.loads(self.rfile.read(length).decode("utf-8") or "{}")
        except ValueError:
            return None
        return body if isinstance(body, dict) else None

    def serve_static(self, path):
        if path == "/":
            path = "/index.html"
        elif path in ("/teacher", "/teacher/"):
            path = "/teacher.html"
        full = os.path.normpath(os.path.join(PUBLIC, path.lstrip("/")))
        if not full.startswith(PUBLIC + os.sep) or not os.path.isfile(full):
            return self.send_json({"ok": False, "error": "not found"}, 404)
        ctype = mimetypes.guess_type(full)[0] or "application/octet-stream"
        if ctype.startswith("text/") or ctype in ("application/javascript", "image/svg+xml"):
            ctype += "; charset=utf-8"
        with open(full, "rb") as f:
            data = f.read()
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        url = urlparse(self.path)
        parts = [p for p in url.path.split("/") if p]
        if parts[:1] != ["api"]:
            return self.serve_static(url.path)
        if parts == ["api", "info"]:
            return self.send_json({"ok": True, "lan": ["http://%s:%d" % (ip, PORT) for ip in lan_ips()]})
        if len(parts) >= 3 and parts[1] == "session":
            with lock:
                s = sessions.get(parts[2])
                if not s:
                    return self.send_json({"ok": False, "error": "no session"}, 404)
                if len(parts) == 3:
                    return self.send_json(public_state(s))
                if parts[3] == "state":
                    key = parse_qs(url.query).get("key", [""])[0]
                    if not secrets.compare_digest(key, s["key"]):
                        return self.send_json({"ok": False, "error": "forbidden"}, 403)
                    out = {k: v for k, v in s.items() if k != "key"}
                    out["teams"] = list(s["teams"].values())
                    out["now"] = now_ms()
                    out["ok"] = True
                    return self.send_json(out)
        self.send_json({"ok": False, "error": "not found"}, 404)

    def do_POST(self):
        url = urlparse(self.path)
        parts = [p for p in url.path.split("/") if p]
        body = self.read_body()
        if body is None:
            return self.send_json({"ok": False, "error": "bad request"}, 400)
        if parts == ["api", "session"]:
            with lock:
                if len(sessions) > 300:
                    return self.send_json({"ok": False, "error": "busy"}, 503)
                s = new_session()
                touch()
                return self.send_json({"ok": True, "code": s["code"], "key": s["key"]})
        if len(parts) == 4 and parts[:2] == ["api", "session"]:
            with lock:
                s = sessions.get(parts[2])
                if not s:
                    return self.send_json({"ok": False, "error": "no session"}, 404)
                if parts[3] == "sync":
                    t = body.get("team")
                    if not isinstance(t, dict) or not _s(t.get("id"), 40):
                        return self.send_json({"ok": False, "error": "bad team"}, 400)
                    tid = _s(t.get("id"), 40)
                    prev = s["teams"].get(tid)
                    # צוות ששומר מצב משיעור שאופס לא נרשם מחדש; הוא יקבל epoch חדש ויתאפס
                    if _n(body.get("epoch")) == s["epoch"]:
                        if prev or len(s["teams"]) < MAX_TEAMS:
                            s["teams"][tid] = clean_team(t, prev, now_ms())
                            touch()
                    return self.send_json(public_state(s, s["teams"].get(tid)))
                if parts[3] == "control":
                    if not secrets.compare_digest(_s(body.get("key"), 80), s["key"]):
                        return self.send_json({"ok": False, "error": "forbidden"}, 403)
                    ok = control(s, body)
                    touch()
                    return self.send_json({"ok": ok}, 200 if ok else 400)
        self.send_json({"ok": False, "error": "not found"}, 404)


def main():
    mimetypes.add_type("application/javascript", ".js")
    mimetypes.add_type("image/svg+xml", ".svg")
    load()
    threading.Thread(target=saver, daemon=True).start()
    httpd = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    httpd.daemon_threads = True
    print("חדר הבריחה רץ.")
    print("  מסך מורה:   http://localhost:%d/teacher" % PORT)
    for ip in lan_ips():
        print("  לתלמידים:   http://%s:%d   (אותה רשת Wi-Fi)" % (ip, PORT))
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
