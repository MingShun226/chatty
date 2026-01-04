# ✅ WhatsApp Integration - Complete Deployment Checklist

> **Follow these steps in order to deploy your WhatsApp chatbot integration**

---

## 📋 Prerequisites

Before starting, ensure you have:

- [ ] A Meta Business Account ([Create here](https://business.facebook.com))
- [ ] A phone number for WhatsApp Business (not currently registered with WhatsApp)
- [ ] Terminal/command line access
- [ ] Supabase CLI installed (`npm install -g supabase`)
- [ ] Git installed (for version control)

---

## 🚀 Step 1: Deploy Database Migration

This creates the WhatsApp tables in your Supabase database.

```bash
# Navigate to project directory
cd C:\Users\USER\OneDrive\Desktop\AvatarLab

# Push database migration
npx supabase db push
```

**Expected output:**
```
✓ Connecting to remote database...
✓ Running migrations...
✓ Finished supabase db push
```

**What this does:**
- Creates 5 new tables: `whatsapp_connections`, `whatsapp_messages`, `whatsapp_message_templates`, `whatsapp_broadcasts`, `whatsapp_product_catalogs`
- Sets up Row Level Security (RLS) policies
- Creates indexes for performance

✅ **Checkpoint:** Run `npx supabase db diff` - should show no pending changes

---

## 🔐 Step 2: Generate Encryption Key

This key encrypts WhatsApp access tokens before storing them.

```bash
# Generate a 32-byte random hex key
openssl rand -hex 32
```

**Copy the output** (looks like: `a1b2c3d4e5f6789...`)

You'll use this in the next step.

---

## 🔧 Step 3: Set Supabase Secrets

These secrets are used by your edge functions.

```bash
# Set the encryption key (paste the value from Step 2)
npx supabase secrets set WHATSAPP_ENCRYPTION_KEY=<paste_your_key_here>

# Set your app URL
npx supabase secrets set APP_URL=http://localhost:8080

# Placeholder values (will update after creating Meta app)
npx supabase secrets set META_APP_ID=placeholder
npx supabase secrets set META_APP_SECRET=placeholder
```

**Example:**
```bash
npx supabase secrets set WHATSAPP_ENCRYPTION_KEY=a1b2c3d4e5f67890abcdef1234567890
npx supabase secrets set APP_URL=http://localhost:8080
npx supabase secrets set META_APP_ID=placeholder
npx supabase secrets set META_APP_SECRET=placeholder
```

✅ **Checkpoint:** Run `npx supabase secrets list` - should show 4 secrets

---

## 📦 Step 4: Deploy Edge Functions

Deploy the WhatsApp webhook and OAuth callback functions.

```bash
# Deploy webhook function (receives messages from Meta)
npx supabase functions deploy whatsapp-webhook

# Deploy OAuth callback (handles account connection)
npx supabase functions deploy whatsapp-oauth-callback
```

**Expected output:**
```
Deploying whatsapp-webhook (project ref: xatrtqdgghanwdujyhkq)
✓ Deployed whatsapp-webhook

Deploying whatsapp-oauth-callback (project ref: xatrtqdgghanwdujyhkq)
✓ Deployed whatsapp-oauth-callback
```

✅ **Checkpoint:** Visit `https://xatrtqdgghanwdujyhkq.supabase.co/functions/v1/whatsapp-webhook?hub.mode=subscribe&hub.challenge=test&hub.verify_token=test` - should return "test"

---

## 🔵 Step 5: Create Meta App

Now create your WhatsApp Business app on Meta.

### 5.1: Create App

1. Go to [Meta Developers](https://developers.facebook.com/apps)
2. Click **"Create App"**
3. Select **"Business"** as app type
4. Fill in:
   - **App Name:** `My Business Chatbot`
   - **App Contact Email:** Your email
   - **Business Account:** Select your Meta Business Account
5. Click **"Create App"**

### 5.2: Add WhatsApp Product

1. In the app dashboard, find **"WhatsApp"** in the products list
2. Click **"Set Up"**
3. Select **"WhatsApp Business Cloud API"** (NOT Platform)

### 5.3: Get App Credentials

1. Go to **Settings** → **Basic**
2. Copy these values:
   - **App ID** (e.g., `123456789012345`)
   - **App Secret** (click "Show" to reveal)

### 5.4: Update Supabase Secrets with Real Values

```bash
# Replace with your actual App ID and Secret
npx supabase secrets set META_APP_ID=123456789012345
npx supabase secrets set META_APP_SECRET=your_actual_app_secret
```

✅ **Checkpoint:** Run `npx supabase secrets list` - META_APP_ID and META_APP_SECRET should show real values

---

## 🔗 Step 6: Configure Meta OAuth Redirect

This tells Meta where to redirect users after they authorize.

1. In your Meta app dashboard, go to **WhatsApp** → **Configuration**
2. Find **OAuth Redirect URI**
3. Add this URL:
   ```
   https://xatrtqdgghanwdujyhkq.supabase.co/functions/v1/whatsapp-oauth-callback
   ```
4. Click **Save**

✅ **Checkpoint:** The redirect URI should appear in the list with a green checkmark

---

## 📡 Step 7: Configure Webhook

This allows Meta to send incoming messages to your app.

### 7.1: Add Webhook URL

1. In Meta app dashboard, go to **WhatsApp** → **Configuration**
2. Find **Webhook** section
3. Click **Configure Webhooks**
4. Add:
   - **Callback URL:** `https://xatrtqdgghanwdujyhkq.supabase.co/functions/v1/whatsapp-webhook`
   - **Verify Token:** Any random string (e.g., `my-webhook-token-123`)
5. Click **Verify and Save**

### 7.2: Subscribe to Webhook Fields

1. Check these fields:
   - ✅ `messages`
   - ✅ `message_status`
2. Click **Save**

✅ **Checkpoint:** Webhook status should show "Active" with green indicator

---

## 💻 Step 8: Update Frontend Environment

Configure your frontend to use Meta OAuth.

### 8.1: Update .env File

Open `C:\Users\USER\OneDrive\Desktop\AvatarLab\.env` and update:

```env
# Your existing Supabase config (keep as is)
VITE_SUPABASE_PROJECT_ID="xatrtqdgghanwdujyhkq"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGci..."
VITE_SUPABASE_URL="https://xatrtqdgghanwdujyhkq.supabase.co"
VITE_SUPABASE_SERVICE_ROLE_KEY="eyJhbGci..."

# WhatsApp Integration (UPDATE THESE)
VITE_META_APP_ID="123456789012345"  # Your real App ID from Step 5
VITE_WHATSAPP_OAUTH_REDIRECT_URI="https://xatrtqdgghanwdujyhkq.supabase.co/functions/v1/whatsapp-oauth-callback"
```

### 8.2: Restart Development Server

```bash
# Stop the dev server (Ctrl+C if running)
# Start it again
npm run dev
```

✅ **Checkpoint:** Server should start without errors on `http://localhost:8080`

---

## 🎉 Step 9: Test the Connection!

Now test the entire flow end-to-end.

### 9.1: Navigate to WhatsApp Integration

1. Open browser: `http://localhost:8080`
2. Log in to your account
3. In the sidebar, click **WhatsApp Chatbot** → **WhatsApp Integration**
4. Select your chatbot from the dropdown (top right)

### 9.2: Connect WhatsApp

1. Click the green **"Connect WhatsApp Business Account"** button
2. You should see the simplified modal with 3 steps preview
3. Click **"Connect WhatsApp Now"**
4. Click the **Facebook button** (blue)
5. Log in with your Meta account
6. Select your WhatsApp Business Account
7. Grant permissions
8. You'll be redirected back automatically

### 9.3: Verify Connection

After redirect, you should see:
- ✅ Your phone number displayed (e.g., `+1234567890`)
- ✅ Quality rating (GREEN/YELLOW/RED badge)
- ✅ Messaging tier (e.g., `50/day`)
- ✅ Stats cards showing connection info

✅ **Checkpoint:** Connection card appears with your phone number

---

## 📱 Step 10: Test Auto-Reply

Send a test message to verify the chatbot responds.

### 10.1: Send Message from WhatsApp

1. Open WhatsApp on your phone
2. Send a message to your connected WhatsApp Business number
   - Example: "Hello, what are your business hours?"

### 10.2: Check Response

You should receive an AI-generated reply within 1-2 seconds!

### 10.3: Verify in UI

1. Refresh the WhatsApp Integration page
2. Check the stats:
   - **Total messages** should increase by 2 (your message + bot reply)
   - **Contacts** should show 1
   - **Delivery rate** should show 100%

✅ **Checkpoint:** You received an auto-reply from the chatbot

---

## 🎯 Post-Deployment Tasks

After successful deployment:

### Set Up Production URL

When deploying to production, update:

```bash
# Update APP_URL to your production domain
npx supabase secrets set APP_URL=https://yourdomain.com

# Update .env for frontend
VITE_WHATSAPP_OAUTH_REDIRECT_URI="https://xatrtqdgghanwdujyhkq.supabase.co/functions/v1/whatsapp-oauth-callback"
```

### Customize Chatbot

1. Go to **Chatbot Settings** to update business context
2. Go to **Products** to add your product catalog
3. Go to **Knowledge Base** to train on your business info
4. Go to **Prompt Engineer** to refine response style

### Monitor Usage

1. Go to **WhatsApp Integration** to view stats
2. Check message delivery rates
3. Monitor quality rating (keep it GREEN!)
4. Track conversation tier (upgrades automatically)

---

## 🆘 Troubleshooting

### Issue: "Configuration error" when clicking Connect

**Solution:**
- Verify `.env` has `VITE_META_APP_ID` and `VITE_WHATSAPP_OAUTH_REDIRECT_URI`
- Restart dev server: `npm run dev`

### Issue: OAuth popup is blocked

**Solution:**
- The new flow uses full-page redirect (no popup!)
- If still blocked, allow popups for `localhost:8080`

### Issue: "No WhatsApp Business Account found"

**Solution:**
- Create a WhatsApp Business Account in [Meta Business Manager](https://business.facebook.com/wa/manage/home/)
- Add a phone number to your account
- Try reconnecting

### Issue: Messages not auto-replying

**Check webhook:**
```bash
# View webhook logs
npx supabase functions logs whatsapp-webhook --follow
```

**Check database:**
```sql
-- Verify connection exists
SELECT * FROM whatsapp_connections;

-- Check messages
SELECT * FROM whatsapp_messages ORDER BY created_at DESC LIMIT 10;
```

---

## 📊 What's Deployed?

After completing this checklist, you have:

✅ **Database:**
- 5 WhatsApp tables with RLS policies
- Encrypted token storage
- Message history tracking

✅ **Edge Functions:**
- `whatsapp-webhook` - Receives messages from Meta
- `whatsapp-oauth-callback` - Handles OAuth flow
- Both deployed and accessible

✅ **Frontend:**
- WhatsApp Integration page
- Simplified connection modal
- Real-time stats display

✅ **Meta Configuration:**
- App created with WhatsApp product
- OAuth redirect configured
- Webhook active and subscribed

---

## 📚 Additional Resources

- [SIMPLIFIED_WHATSAPP_FLOW.md](./SIMPLIFIED_WHATSAPP_FLOW.md) - User flow walkthrough
- [WHATSAPP_UI_GUIDE.md](./WHATSAPP_UI_GUIDE.md) - UI reference guide
- [QUICK_START_WHATSAPP.md](./QUICK_START_WHATSAPP.md) - 5-minute quick start
- [WHATSAPP_SETUP_GUIDE.md](./WHATSAPP_SETUP_GUIDE.md) - Detailed setup guide

---

## ✅ Final Checklist

Before going live, verify:

**Backend:**
- [x] Database migration deployed
- [x] Encryption key generated and set
- [x] Meta app credentials set as secrets
- [x] Edge functions deployed and accessible
- [x] Webhook verified by Meta

**Meta App:**
- [x] Meta Business Account created
- [x] WhatsApp Business App created
- [x] OAuth redirect URI configured
- [x] Webhook URL configured and active
- [x] Webhook fields subscribed

**Frontend:**
- [x] `.env` updated with Meta App ID
- [x] Dev server restarted
- [x] Can access WhatsApp Integration page
- [x] Connection modal shows correctly

**Testing:**
- [x] Successfully connected WhatsApp number
- [x] Connection card displays stats
- [x] Sent test message from WhatsApp
- [x] Received auto-reply within 2 seconds
- [x] Stats updated in UI

---

**🎊 Congratulations!** Your WhatsApp chatbot is now live and ready for customers!
