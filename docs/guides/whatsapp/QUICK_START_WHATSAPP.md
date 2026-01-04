# 🚀 Quick Start: WhatsApp Integration (5 Minutes!)

> **The fastest way to get your WhatsApp chatbot working**

---

## ⏱️ Step 1: Deploy Backend (2 minutes)

```bash
# Navigate to project
cd C:\Users\USER\OneDrive\Desktop\AvatarLab

# Deploy database
npx supabase db push

# Generate encryption key and copy the output
openssl rand -hex 32

# Set secrets (paste your encryption key)
npx supabase secrets set WHATSAPP_ENCRYPTION_KEY=<paste_here>
npx supabase secrets set APP_URL=http://localhost:8080
npx supabase secrets set META_APP_ID=placeholder
npx supabase secrets set META_APP_SECRET=placeholder

# Deploy functions
npx supabase functions deploy whatsapp-webhook
npx supabase functions deploy whatsapp-oauth-callback
```

**✅ Done!** Backend is deployed.

---

## 🔧 Step 2: Create Meta App (2 minutes)

1. Go to: https://developers.facebook.com/apps
2. Click **"Create App"** → Select **"Business"**
3. App Name: `My Chatbot`, Click **Create**
4. Find **"WhatsApp"** → Click **"Set Up"**
5. Go to **Settings** → **Basic**
   - Copy **App ID** and **App Secret**

**Update secrets with real values:**
```bash
npx supabase secrets set META_APP_ID=<your_app_id>
npx supabase secrets set META_APP_SECRET=<your_app_secret>
```

**Configure OAuth & Webhook:**

6. Go to **WhatsApp** → **Configuration**
7. **OAuth Redirect URI** → Add:
   ```
   https://YOUR_PROJECT.supabase.co/functions/v1/whatsapp-oauth-callback
   ```
8. **Webhook Callback URL** → Add:
   ```
   https://YOUR_PROJECT.supabase.co/functions/v1/whatsapp-webhook
   ```
9. **Verify Token:** Enter any random string (e.g., `test123`)
10. **Subscribe to:** `messages` ✅ and `message_status` ✅

**✅ Done!** Meta app configured.

---

## 💻 Step 3: Update Frontend (30 seconds)

Create/update `.env` file:

```env
# Add these lines (replace YOUR_PROJECT and YOUR_APP_ID)
VITE_META_APP_ID=YOUR_APP_ID
VITE_WHATSAPP_OAUTH_REDIRECT_URI=https://YOUR_PROJECT.supabase.co/functions/v1/whatsapp-oauth-callback
```

Restart dev server:
```bash
npm run dev
```

**✅ Done!** Frontend ready.

---

## 🎉 Step 4: Connect & Test (30 seconds)

1. Open: http://localhost:8080
2. Go to: **WhatsApp Chatbot** → **WhatsApp Integration**
3. Click: **"Connect WhatsApp Business Account"**
4. **Login** with Meta account → **Grant permissions**
5. **See your connection!** ✅

**Send a WhatsApp message to test:**
- Message your connected number
- Get AI reply instantly! 🤖

---

## 🎯 That's It!

Your WhatsApp chatbot is LIVE! 🎊

**Troubleshooting?** See [WHATSAPP_SETUP_GUIDE.md](./WHATSAPP_SETUP_GUIDE.md) for detailed help.
