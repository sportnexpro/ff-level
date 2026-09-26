# FF Level

Free Fire level-up bot with a selling website: landing page, user panel (plans, account slots, live EXP and level progress) and admin panel (users, plans, orders, license keys). Data is stored in MongoDB.

## Run locally

```bash
pip install -r requirements.txt
```

Create a `.env` file next to `Main.py`:

```
MONGO_URI=mongodb+srv://USER:PASSWORD@your-cluster.mongodb.net/
MONGO_DB=fflevel
```

```bash
python Main.py
```

Open http://localhost:20335 — admin panel at `/admin`, user panel at `/panel`.
On a fresh database an admin account is created and its password is printed in the console (and saved to `ADMIN_LOGIN.txt`).

## Deploy on Render

1. In MongoDB Atlas → **Security → Network Access**, allow `0.0.0.0/0` (Render's outbound IPs change).
2. On Render: **New → Blueprint**, pick this repository. Render reads `render.yaml`.
3. When asked, set **MONGO_URI** to your Atlas connection string.
4. Deploy. The site is served on the Render URL; the bot runs in the same process.

The `starter` plan is used because the free plan sleeps after 15 minutes without web traffic, which would stop the bot.

## Files that are never committed

`.env`, `accounts.json`, `token_cache.json`, `devices.json`, `panel.db`, `ADMIN_LOGIN.txt` — they contain passwords, game logins or tokens. On first start the app imports them into MongoDB if they exist.
