# 🚂 Railway Deployment Guide

Complete guide to deploy WhatsApp Web Service to Railway.

## ✅ Prerequisites

- [x] Railway CLI installed
- [ ] Railway account (free signup)
- [ ] Supabase credentials ready

---

## 📋 Step-by-Step Deployment

### Step 1: Login to Railway

Open your terminal and run:

```bash
cd "c:\Users\USER\OneDrive\Desktop\AvatarLab\whatsapp-web-service"
railway login
```

**What happens:**
1. Browser opens automatically
2. Sign up / Login with GitHub or email
3. Authorize Railway CLI
4. Terminal shows "Logged in successfully"

### Step 2: Initialize Railway Project

```bash
railway init
```

**What to enter:**
- Project name: `whatsapp-web-service` (or your choice)
- Choose: "Empty project"

### Step 3: Add Environment Variables

```bash
railway variables set SUPABASE_URL="your_supabase_url"
railway variables set SUPABASE_SERVICE_ROLE_KEY="your_service_role_key"
railway variables set PORT=3001
```

**Get your Supabase credentials:**
1. Go to Supabase Dashboard
2. Project Settings → API
3. Copy:
   - Project URL → `SUPABASE_URL`
   - service_role key → `SUPABASE_SERVICE_ROLE_KEY`

### Step 4: Deploy to Railway

```bash
railway up
```

**What happens:**
1. Uploads your code to Railway
2. Installs dependencies (`npm install`)
3. Starts service (`npm start`)
4. Shows deployment URL

### Step 5: Get Your Service URL

```bash
railway domain
```

**Output example:**
```
whatsapp-web-service-production-xxxx.up.railway.app
```

**Or create custom domain:**
```bash
railway domain add
```

---

## 🌐 Update Your Frontend

After deployment, you'll get a URL like:
```
https://whatsapp-web-service-production-xxxx.up.railway.app
```

### Update Your Frontend Code

You need to update your frontend to use this URL instead of localhost.

**File to update:** Search for `localhost:3001` in your frontend code and replace with Railway URL.

---

## 🔍 Monitoring & Logs

### View Live Logs

```bash
railway logs
```

### Check Service Status

```bash
railway status
```

### Open Railway Dashboard

```bash
railway open
```

---

## 💰 Cost Monitoring

### Check Usage

1. Open Railway dashboard: `railway open`
2. Go to "Usage" tab
3. Monitor:
   - Memory usage
   - CPU usage
   - Network traffic

**Expected costs:**
- Base: $5/month
- Usage: ~$2-3/month
- **Total: ~$7-8/month**

---

## ⚙️ Important Configuration

### Environment Variables (Already Set)

| Variable | Description | Example |
|----------|-------------|---------|
| `SUPABASE_URL` | Your Supabase project URL | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key | `eyJhbGc...` |
| `PORT` | Server port | `3001` |

### Auto-Restart Configuration

The service is configured to auto-restart on failure (in `railway.json`):
```json
{
  "deploy": {
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

---

## 🐛 Troubleshooting

### Issue: Deployment Failed

**Check logs:**
```bash
railway logs
```

**Common issues:**
- Missing environment variables → Add with `railway variables set`
- Build error → Check `package.json` dependencies
- Port conflict → Railway auto-assigns port, no action needed

### Issue: Service Not Starting

**Check status:**
```bash
railway status
```

**Restart service:**
```bash
railway restart
```

### Issue: WhatsApp Connection Lost

**Reconnect:**
1. Railway service stays running
2. WhatsApp sessions are stored in `.baileys_auth/` (gitignored)
3. On deployment, sessions are lost
4. Solution: Reconnect WhatsApp after each deploy (scan QR code again)

---

## 🔄 Updating Your Service

### Deploy New Changes

After making code changes:

```bash
# From whatsapp-web-service folder
railway up
```

Railway will:
1. Upload new code
2. Rebuild
3. Restart service automatically

### Redeploy Without Changes

```bash
railway redeploy
```

---

## 🗑️ Cleanup

### Remove Project

```bash
railway down
```

### Logout

```bash
railway logout
```

---

## 📊 Next Steps After Deployment

### 1. Get Your Railway URL

After `railway up` completes, run:
```bash
railway domain
```

Copy the URL (e.g., `https://whatsapp-web-service-production-xxxx.up.railway.app`)

### 2. Test the Service

```bash
# Test health endpoint
curl https://your-railway-url.up.railway.app/health
```

Expected response:
```json
{"status": "ok", "timestamp": "2026-01-04..."}
```

### 3. Update Frontend Environment Variables

**For Vercel deployment:**
1. Go to Vercel Dashboard
2. Your Project → Settings → Environment Variables
3. Add new variable:
   ```
   Key: VITE_WHATSAPP_SERVICE_URL
   Value: https://your-railway-url.up.railway.app
   ```
4. Redeploy Vercel project

**For local development:**
Update `.env`:
```env
VITE_WHATSAPP_SERVICE_URL=https://your-railway-url.up.railway.app
```

### 4. Test WhatsApp Connection

1. Open your deployed frontend
2. Go to Chatbot Settings → WhatsApp Integration
3. Click "Connect WhatsApp"
4. Scan QR code
5. Test sending a message

---

## 🎉 Success Checklist

- [ ] Railway CLI installed
- [ ] Logged into Railway
- [ ] Project initialized
- [ ] Environment variables set
- [ ] Service deployed (`railway up`)
- [ ] Railway URL obtained
- [ ] Frontend updated with Railway URL
- [ ] WhatsApp connection tested
- [ ] Service running 24/7

---

## 📞 Support

**Railway Documentation:** https://docs.railway.app
**Railway Community:** https://discord.gg/railway
**Railway Status:** https://status.railway.app

---

**Estimated time:** 10-15 minutes
**Cost:** ~$7-8/month
**Uptime:** 99.9% (always on)

Ready to deploy! 🚀
