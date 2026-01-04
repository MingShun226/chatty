# 🚀 WhatsApp SaaS Platform - Deployment Guide

> **For multi-tenant SaaS platforms where each user connects their own WhatsApp**

---

## ✅ What's Already Deployed

### Edge Functions (3 functions) ✅
- ✅ `whatsapp-get-oauth-url` - Generates OAuth URL (keeps Meta App ID secret)
- ✅ `whatsapp-webhook` - Receives and processes messages from Meta
- ✅ `whatsapp-oauth-callback` - Handles OAuth connection flow

**Status:** All functions deployed to production! 🎉

---

## 🔧 Step 1: Set Supabase Secrets (Backend Only)

These secrets are **backend-only** and never exposed to frontend users:

```bash
# 1. Generate encryption key (32-byte random hex)
openssl rand -hex 32

# Copy the output, then set it:
npx supabase secrets set WHATSAPP_ENCRYPTION_KEY=<paste_output_here>

# 2. Set app URL (your frontend URL)
npx supabase secrets set APP_URL=http://localhost:8080

# 3. Set Meta app credentials (YOU create ONE Meta app for your platform)
# Create app at: https://developers.facebook.com/apps
npx supabase secrets set META_APP_ID=<your_platform_meta_app_id>
npx supabase secrets set META_APP_SECRET=<your_platform_meta_app_secret>

# 4. Set OAuth redirect URI (your backend function URL)
npx supabase secrets set WHATSAPP_OAUTH_REDIRECT_URI=https://xatrtqdgghanwdujyhkq.supabase.co/functions/v1/whatsapp-oauth-callback
```

**Verify secrets:**
```bash
npx supabase secrets list
```

You should see:
- WHATSAPP_ENCRYPTION_KEY
- APP_URL
- META_APP_ID
- META_APP_SECRET
- WHATSAPP_OAUTH_REDIRECT_URI

---

## 📦 Step 2: Deploy Database Migration

### Option A: Via Supabase CLI (Recommended)

If you have no other pending migrations:

```bash
npx supabase db push
```

### Option B: Manual SQL Execution (If CLI has issues)

1. Go to [Supabase SQL Editor](https://supabase.com/dashboard/project/xatrtqdgghanwdujyhkq/sql)
2. Copy the contents of `supabase/migrations/20260102000000_whatsapp_integration.sql`
3. Paste and execute

**What this creates:**
- 5 tables: `whatsapp_connections`, `whatsapp_messages`, `whatsapp_message_templates`, `whatsapp_broadcasts`, `whatsapp_product_catalogs`
- Row Level Security (RLS) policies
- Indexes for performance
- Extension to `conversations` table

---

## 🔵 Step 3: Create Your Platform's Meta App

**Important:** You (the platform owner) create **ONE** Meta app. Your users will connect through this app using Meta's Embedded Signup.

### 3.1: Create App

1. Go to [Meta Developers](https://developers.facebook.com/apps)
2. Click **"Create App"**
3. Select **"Business"** type
4. Fill in:
   - App Name: `[Your Platform Name] WhatsApp Integration`
   - Contact Email: Your support email
5. Click **"Create App"**

### 3.2: Add WhatsApp Product

1. In app dashboard, find **"WhatsApp"**
2. Click **"Set Up"**
3. Select **"WhatsApp Business Cloud API"**

### 3.3: Get App Credentials

1. Go to **Settings** → **Basic**
2. Copy:
   - **App ID**
   - **App Secret** (click "Show")

3. **Update Supabase secrets:**
```bash
npx supabase secrets set META_APP_ID=<your_actual_app_id>
npx supabase secrets set META_APP_SECRET=<your_actual_app_secret>
```

### 3.4: Configure OAuth Redirect

1. In Meta app, go to **WhatsApp** → **Configuration**
2. Find **OAuth Redirect URI**
3. Add:
   ```
   https://xatrtqdgghanwdujyhkq.supabase.co/functions/v1/whatsapp-oauth-callback
   ```
4. Click **Save**

### 3.5: Configure Webhook

1. In Meta app, go to **WhatsApp** → **Configuration**
2. Find **Webhook**
3. Add:
   - **Callback URL:** `https://xatrtqdgghanwdujyhkq.supabase.co/functions/v1/whatsapp-webhook`
   - **Verify Token:** Any random string (e.g., `my-platform-webhook-token-123`)
4. Click **Verify and Save**
5. Subscribe to fields:
   - ✅ `messages`
   - ✅ `message_status`
6. Click **Save**

---

## 🎉 Step 4: Test the Flow!

### 4.1: Start Dev Server

```bash
npm run dev
```

### 4.2: Create a Test Chatbot

1. Open http://localhost:8080
2. Log in
3. Create a chatbot (if you don't have one)

### 4.3: Test WhatsApp Connection

1. Go to **WhatsApp Chatbot** → **WhatsApp Integration**
2. Select your chatbot from dropdown
3. Click **"Connect WhatsApp Business Account"**
4. You should see:
   - ✅ 3-step preview
   - ✅ "Connect WhatsApp Now" button
5. Click the button
6. See the loading state
7. You'll be redirected to Facebook/Meta
8. Log in with your Meta account
9. Select your WhatsApp Business Account
10. Grant permissions
11. You'll be redirected back with success!

### 4.4: Test Message Auto-Reply

1. Send a WhatsApp message to your connected number
2. You should get an AI reply within 2 seconds!

**Check logs:**
```bash
npx supabase functions logs whatsapp-webhook --follow
```

---

## 🏗️ Architecture Overview (SaaS Model)

```
┌─────────────────────────────────────────────────────────┐
│                    Your Platform (SaaS)                  │
│  - ONE Meta App (owned by you)                          │
│  - Multiple users/customers                             │
└────────────────────┬────────────────────────────────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
         ▼                       ▼
┌──────────────────┐    ┌──────────────────┐
│   User 1         │    │   User 2         │
│   Connects their │    │   Connects their │
│   WhatsApp WABA  │    │   WhatsApp WABA  │
│   via OAuth      │    │   via OAuth      │
└──────────────────┘    └──────────────────┘

All users click "Connect" → Meta Embedded Signup → OAuth
No need for users to create their own Meta apps!
```

### How It Works:

1. **Platform Owner (You):**
   - Creates ONE Meta app
   - Configures OAuth and webhook
   - Sets secrets in Supabase

2. **Your Users:**
   - Just click "Connect WhatsApp"
   - Log in with Facebook/Meta
   - Authorize access to their WhatsApp Business Account
   - Done! No technical setup needed

3. **Security:**
   - Meta App ID is backend-only (never exposed to users)
   - Each user's access token is encrypted (AES-256-GCM)
   - OAuth state prevents CSRF attacks
   - RLS ensures users only see their own data

---

## 🔐 Security Best Practices

### Backend Secrets (Never Expose)
- ✅ `WHATSAPP_ENCRYPTION_KEY` - Stored in Supabase secrets
- ✅ `META_APP_ID` - Stored in Supabase secrets
- ✅ `META_APP_SECRET` - Stored in Supabase secrets
- ✅ `WHATSAPP_OAUTH_REDIRECT_URI` - Stored in Supabase secrets

### Frontend (Public)
- ❌ NO Meta App ID in `.env`
- ❌ NO secrets in frontend code
- ✅ OAuth URL generated by backend API
- ✅ Only Supabase URL exposed (public anyway)

### Data Isolation
- ✅ Row Level Security (RLS) on all tables
- ✅ Users can only access their own chatbots
- ✅ Users can only see their own connections
- ✅ Messages are isolated per user

---

## 📊 Database Schema (SaaS Multi-Tenant)

```sql
-- Each user can have multiple chatbots
avatars (id, user_id, name, ...)

-- Each chatbot can have multiple WhatsApp connections
whatsapp_connections (
  id,
  user_id,        -- Owner of this connection
  chatbot_id,     -- Which chatbot this connects to
  phone_number,   -- User's WhatsApp Business number
  access_token_encrypted,  -- Encrypted token for this user's WABA
  ...
)

-- Messages belong to connections (and thus to users)
whatsapp_messages (
  id,
  connection_id,  -- Links to whatsapp_connections
  from_phone,
  to_phone,
  content,
  delivery_status,
  ...
)
```

**RLS Policies:**
- Users can only insert/update/delete their own connections
- Users can only view messages for their own connections
- Chatbot owner can view all connections for their chatbot

---

## 🧪 Testing Checklist

### Backend
- [ ] Secrets are set (`npx supabase secrets list`)
- [ ] Database migration applied (5 tables exist)
- [ ] Edge functions deployed (3 functions)
- [ ] Webhook verified in Meta dashboard

### Meta App
- [ ] Meta app created
- [ ] WhatsApp product added
- [ ] OAuth redirect URI configured
- [ ] Webhook URL configured and active

### Frontend
- [ ] `.env` has NO Meta App ID (correct!)
- [ ] Can navigate to WhatsApp Integration page
- [ ] Click "Connect" triggers backend API
- [ ] OAuth URL redirects to Meta correctly

### Full Flow
- [ ] User clicks "Connect WhatsApp"
- [ ] Redirects to Meta OAuth
- [ ] User authorizes
- [ ] Redirects back with success
- [ ] Connection shows in UI
- [ ] Send WhatsApp message → Get AI reply

---

## 🐛 Troubleshooting

### Issue: "WhatsApp integration is not configured"

**Cause:** Secrets not set correctly

**Solution:**
```bash
npx supabase secrets list
# Verify all 5 secrets exist
# If missing, set them again
```

### Issue: "Chatbot not found or access denied"

**Cause:** User doesn't own the chatbot

**Solution:**
- Verify user is logged in
- Verify chatbot belongs to user
- Check RLS policies:
```sql
SELECT * FROM avatars WHERE user_id = '<user_id>';
```

### Issue: "Failed to get OAuth URL"

**Cause:** Backend API error

**Solution:**
```bash
npx supabase functions logs whatsapp-get-oauth-url --follow
# Check for errors in logs
```

### Issue: Messages not auto-replying

**Cause:** Webhook not active or errors

**Solution:**
```bash
# Check webhook logs
npx supabase functions logs whatsapp-webhook --follow

# Verify webhook in Meta dashboard
# Go to WhatsApp → Configuration → Webhook
# Should show "Active" with green indicator
```

---

## 📈 Scaling for Production

### When You Go Live:

1. **Update APP_URL secret:**
```bash
npx supabase secrets set APP_URL=https://yourdomain.com
```

2. **Update OAuth redirect URI in Meta app:**
```
https://xatrtqdgghanwdujyhkq.supabase.co/functions/v1/whatsapp-oauth-callback
```
(Already correct!)

3. **Monitor usage:**
- Check Supabase dashboard for API usage
- Monitor Meta app dashboard for WhatsApp API calls
- Set up error alerts

4. **Meta API limits:**
- Free tier: 1,000 conversations/month per WABA
- Each user's WABA has their own limits
- Quality rating affects tier upgrades

---

## 🎯 Summary

### What You (Platform Owner) Do:
1. Create ONE Meta app
2. Set Supabase secrets
3. Deploy backend (functions + database)
4. Configure OAuth and webhook in Meta

### What Your Users Do:
1. Click "Connect WhatsApp" in your platform
2. Log in with Facebook/Meta
3. Authorize access
4. Done! (30 seconds)

### Benefits of This Architecture:
- ✅ **Simple for users** - No technical setup needed
- ✅ **Secure** - Meta App ID never exposed
- ✅ **Scalable** - Supports unlimited users
- ✅ **Compliant** - Official Meta Embedded Signup
- ✅ **Multi-tenant** - Each user's data isolated

---

## 🚀 You're Ready!

Your WhatsApp SaaS integration is deployed and ready for users!

**Next Steps:**
1. Set the Supabase secrets (Step 1)
2. Apply database migration (Step 2)
3. Configure Meta app (Step 3)
4. Test with your own account (Step 4)
5. Invite your users to connect their WhatsApp!

---

**Questions?** Check the edge function logs or Meta app dashboard for debugging.

**🎊 Congratulations!** Your SaaS platform now supports WhatsApp integration!
