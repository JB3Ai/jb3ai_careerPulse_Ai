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
PLAYWRIGHT_BROWSERS_PATH=/usr/local/bin/chromium-browser
OPENROUTER_API_KEY=<your-key-from-openrouter.ai>
GEMINI_API_KEY=<your-key-from-aistudio.google.com>
```

### 3. Deploy
Click **Deploy** — wait ~3-4 min (first build includes Playwright Chromium). Railway gives you a public URL like `career-ops-abcd123.up.railway.app`.

⚠️ **Data persistence:** The app reads/writes markdown files (`data/`, `config/`, etc.). On Railway these are ephemeral between deploys — your data lives on your local machine, not on Railway. See **"Persistent volume"** below for zero-loss deployment. For remote access, see "Self-hosted" below which gives you full control over data storage.

### Persistent volume (recommended)

Railway paid plans support block storage. Add a volume so `data/` survives redeployments:

1. In Railway dashboard → **Settings** tab → **Volumes** → **Create Volume**
2. Name: `data-volume`
3. Mount path: `/data`
4. Select your service, click **Create**
5. **Minimum $5/mo** (voluntary minimum plan) — costs scale with usage

The `.railway/railway.json` includes `meta.volumeMountPath` which auto-registers the volume when deploying from GitHub. No manual dashboard clicks needed — just push this commit and deploy.

**Cost:** $0 during free trial (first 90 days or until usage caps), then $5/mo volunteer minimum + storage based on dataset size (~$1 per GB/month).

> Your job search data is small (typically < 5 MB across pipeline, scan history, config files). Expect <$1/month of storage overhead above the $5 base.

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
