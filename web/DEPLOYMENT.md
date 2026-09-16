# Career-ops Web Deployment

## Quick Start (Recommended: Railway.app)

Railway is the easiest path — `railway.json` is already in the repo, so no manual config needed.

### 1. Deploy from GitHub
1. Go to [railway.app](https://railway.app) → Sign up/login
2. Click **New Project** → **Deploy from GitHub repo**
3. Select `JB3Ai/jb3ai_careerPulse_Ai`
4. Railway auto-detects `railway.json` — Build/Start commands are pre-configured

### 2. Add Environment Variables
In Railway dashboard → Variables, add:
```
NODE_ENV=production
PORT=3000
PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
```

### 3. Deploy
Click **Deploy** — wait ~3-4 min (first build includes Playwright Chromium). Railway gives you a public URL like `career-ops-abcd123.up.railway.app`.

⚠️ **Data persistence:** The app reads/writes markdown files (`data/`, `config/`, etc.). On Railway these are ephemeral between deploys — your data lives on your local machine, not on Railway. For remote access, see "Self-hosted" below which gives you full control over data storage.

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
