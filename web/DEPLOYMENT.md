# Career-ops Web Deployment

## Quick Start (Recommended: Railway.app)

Railway is the easiest path — connects to your GitHub repo, builds automatically.

### 1. Push to GitHub
Your code is already pushed: https://github.com/JB3Ai/jb3ai_careerPulse_Ai.git

### 2. Connect to Railway
1. Go to [railway.app](https://railway.app) → Sign up/login
2. Click **New Project** → **Deploy from GitHub repo**
3. Select `JB3Ai/jb3ai_careerPulse_Ai`
4. Set **Build Command** to: `cd career-ops/web && npm install && npm run build`
5. Set **Start Command** to: `cd career-ops/web && node server.js`
6. Set **Port** to `3000`

### 3. Add Persistent Storage (Required)
The app reads/writes markdown files (`data/`, `config/`, etc.) — these need persistent volume storage.

**Option A — Git-synced data (simplest):**
Add your `data/`, `config/`, `reports/`, `modes/`, `cv.md`, and `portals.yml` directly inside the `career-ops/` directory (not just in `career-ops/data/`). Commit them to the repo so they deploy with the code.

⚠️ **Warning:** Tracking sensitive documents (PDFs, DOCX) in git means anyone who finds your credentials can see them. Only do this if acceptable.

**Option B — Separate persistent volume:**
Keep data on a separate VPS (see "Self-hosted" below). Use an API-based solution instead of file reads.

### 4. Environment Variables
Add these in Railway dashboard:
```
NODE_ENV=production
PORT=3000
PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
CAREER_OPS_ROOT=/app/career-ops  # tells the app where the project root is
```

### 5. Deploy
Click **Deploy** — wait ~2-3 min. Railway gives you a public URL (e.g. `career-ops-abcd123.railway.app`).

---

## Self-hosted (Docker Compose on a Cheap VPS)

Useful if you want full control and data privacy (no third-party platform sees your data).

### Prerequisites
- Ubuntu/Debian VPS ($5-10/mo from Hetzner, DigitalOcean, Linode, Vultr)
- Docker + Docker Compose installed (`curl -fsSL https://get.docker.com | sh`)

### Setup
```bash
# SSH into your VPS
ssh user@your-vps-ip

# Create project directory
mkdir -p ~/career-ops-web
cd ~/career-ops-web

# Clone the repo
git clone https://github.com/JB3Ai/jb3ai_careerPulse_Ai.git
cd career-ops

# Build the container
docker compose -f docker-compose.prod.yml up --build -d

# Check logs
docker compose -f docker-compose.prod.yml logs -f career-ops-web
```

Access at: `http://your-vps-ip:3000`

To expose publicly, set up Nginx reverse proxy or use Cloudflare Tunnel:
```bash
# Cloudflare Tunnel (free, adds HTTPS automatically)
cloudflared tunnel login
cloudflared tunnel create career-ops-tunnel
cloudflared tunnel route dns career-ops-tunnel app.yourdomain.com
cloudflared tunnel run career-ops-tunnel
```

---

## Platform Comparison

| Platform | Cost | Persistent Data | Setup Time | Privacy |
|----------|------|----------------|------------|---------|
| **Vercel** | Free tier | ❌ No (ephemeral) | 5 min | Good (can't use — writes don't persist) |
| **Railway** | $5/mo vol. | ✅ Yes (volumes) | 10 min | Medium |
| **Render** | $5/mo vol. | ✅ Yes | 10 min | Medium |
| **Self-hosted VPS** | $5-10/mo | ✅ Full control | 30 min | Best |
| **Fly.io** | $5/mo | ✅ VM volumes | 20 min | Medium |

**Recommendation:** Start with **self-hosted VPS** for data privacy, or **Railway** for fastest setup. Skip Vercel — it doesn't support persistent filesystem writes.
