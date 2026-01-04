# 📱 WhatsApp Integration Setup & Testing Guide

> **User-Friendly Guide to Connect Your WhatsApp Chatbot**

This guide will walk you through setting up and testing your WhatsApp chatbot integration step-by-step.

---

## 🎯 What You'll Achieve

After completing this guide, you will:
- ✅ Have a WhatsApp Business Account connected to your chatbot
- ✅ Receive and auto-reply to WhatsApp messages with AI
- ✅ See message history and delivery status
- ✅ Have a working webhook receiving messages from Meta

---

## 📋 Prerequisites

Before you start, make sure you have:

1. **A Meta Business Account** (free to create)
   - Go to: https://business.facebook.com
   - Click "Create Account"
   - Follow the setup wizard

2. **A Phone Number** (for WhatsApp Business)
   - Can be a mobile number or landline
   - Must not be already registered with WhatsApp
   - You'll need to verify it via SMS/call

3. **Basic Terminal/Command Line Knowledge**
   - You'll run a few commands to deploy the backend

---

## 🚀 Part 1: Deploy the Backend (Database & Functions)

### Step 1: Deploy Database Migration

Open your terminal and navigate to your project directory:

```bash
cd C:\Users\USER\OneDrive\Desktop\AvatarLab
```

Run the database migration to create WhatsApp tables:

```bash
npx supabase db push
```

**Expected Output:**
```
✓ Connecting to remote database...
✓ Running migrations...
✓ Finished supabase db push
```

### Step 2: Set Up Environment Secrets

You need to set 4 environment variables for the edge functions. We'll set placeholders now and update them after creating the Meta app:

```bash
# Generate encryption key (run this command)
openssl rand -hex 32

# Copy the output, then set it as a secret
npx supabase secrets set WHATSAPP_ENCRYPTION_KEY=<paste_the_output_here>

# Set app URL (use your actual URL in production)
npx supabase secrets set APP_URL=http://localhost:8080

# Placeholder secrets (we'll update these in Part 2)
npx supabase secrets set META_APP_ID=placeholder
npx supabase secrets set META_APP_SECRET=placeholder
```

**Example:**
```bash
# After running: openssl rand -hex 32
# Output: a1b2c3d4e5f6...

npx supabase secrets set WHATSAPP_ENCRYPTION_KEY=a1b2c3d4e5f6...
npx supabase secrets set APP_URL=http://localhost:8080
npx supabase secrets set META_APP_ID=placeholder
npx supabase secrets set META_APP_SECRET=placeholder
```

### Step 3: Deploy Edge Functions

Deploy the WhatsApp webhook and OAuth callback functions:

```bash
npx supabase functions deploy whatsapp-webhook
npx supabase functions deploy whatsapp-oauth-callback
```

**Expected Output:**
```
Deploying whatsapp-webhook (project ref: xxx)
✓ Deployed whatsapp-webhook
Deploying whatsapp-oauth-callback (project ref: xxx)
✓ Deployed whatsapp-oauth-callback
```

**✅ Backend Deployment Complete!**

---

## 🔧 Part 2: Create Meta WhatsApp Business App

### Step 1: Create a Meta App

1. **Go to Meta Developers**: https://developers.facebook.com/apps
2. **Click "Create App"**
3. **Select "Business"** as the app type
4. **Fill in details:**
   - App Name: `[Your Business Name] Chatbot`
   - App Contact Email: Your email
   - Business Account: Select your Meta Business Account
5. **Click "Create App"**

### Step 2: Add WhatsApp Product

1. **Find "WhatsApp"** in the products list
2. **Click "Set Up"**
3. **Select "WhatsApp Business Cloud API"** (NOT WhatsApp Business Platform)

### Step 3: Get Your App Credentials

1. **In your app dashboard**, click **Settings** → **Basic**
2. **Copy these values:**
   - **App ID** (e.g., `123456789012345`)
   - **App Secret** (click "Show" to reveal it)

3. **Update your Supabase secrets** with the real values:

```bash
npx supabase secrets set META_APP_ID=123456789012345
npx supabase secrets set META_APP_SECRET=your_actual_app_secret
```

### Step 4: Configure OAuth Redirect URI

1. **Get your Supabase project URL:**
   - Go to: https://supabase.com/dashboard/project/YOUR_PROJECT/settings/api
   - Copy the **URL** (e.g., `https://abc123.supabase.co`)

2. **In Meta App Dashboard:**
   - Go to **WhatsApp** → **Configuration**
   - Find **OAuth Redirect URI**
   - Add this URL (replace `abc123` with your project ref):
     ```
     https://abc123.supabase.co/functions/v1/whatsapp-oauth-callback
     ```
   - Click **Save**

### Step 5: Configure Webhook

1. **In Meta App Dashboard:**
   - Go to **WhatsApp** → **Configuration**
   - Find **Webhook** section
   - Click **Configure Webhooks**

2. **Add Callback URL** (replace `abc123` with your project ref):
   ```
   https://abc123.supabase.co/functions/v1/whatsapp-webhook
   ```

3. **Verify Token:**
   - Enter any random string (e.g., `my-webhook-token-123`)
   - Click **Verify and Save**

4. **Subscribe to Fields:**
   - Check: `messages`
   - Check: `message_status`
   - Click **Save**

**✅ Meta App Setup Complete!**

---

## 💻 Part 3: Configure Frontend Environment

### Step 1: Create/Update .env File

In your project root (`C:\Users\USER\OneDrive\Desktop\AvatarLab`), create or update `.env`:

```env
# Your Supabase project URL and anon key (these should already exist)
VITE_SUPABASE_URL=https://abc123.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key

# WhatsApp OAuth Configuration (ADD THESE)
VITE_META_APP_ID=123456789012345
VITE_WHATSAPP_OAUTH_REDIRECT_URI=https://abc123.supabase.co/functions/v1/whatsapp-oauth-callback
```

**Important:** Replace:
- `abc123` with your actual Supabase project reference
- `123456789012345` with your actual Meta App ID

### Step 2: Restart Development Server

Stop your dev server (Ctrl+C) and restart it:

```bash
npm run dev
```

**✅ Frontend Configured!**

---

## 🎉 Part 4: Test the Connection!

### Step 1: Navigate to WhatsApp Integration

1. **Open your browser**: http://localhost:8080
2. **Log in** to your account
3. **Click** on the sidebar: **WhatsApp Chatbot** → **WhatsApp Integration**
4. **Select your chatbot** from the dropdown at the top right

You should see:
- **"No WhatsApp Connections"** card
- **"Connect WhatsApp Business Account"** green button

### Step 2: Connect Your WhatsApp Number

1. **Click** the green **"Connect WhatsApp Business Account"** button
2. **A popup window opens** showing Meta login
3. **Log in** with your Meta Business account
4. **Select** your WhatsApp Business Account
5. **Grant permissions**:
   - ✅ Manage messages
   - ✅ Manage business profile
6. **Click "Continue"**

**What happens:**
- Meta redirects to your OAuth callback
- Your access token is encrypted and stored
- You're redirected back to the integration page
- You see a success message!

### Step 3: Verify Connection

On the WhatsApp Integration page, you should now see:

- ✅ Your phone number displayed (e.g., `+60123456789`)
- ✅ Quality rating badge (GREEN/YELLOW/RED)
- ✅ Messaging tier (e.g., `50/day`)
- ✅ Stats cards showing connection info

**🎊 Connection Successful!**

---

## 🧪 Part 5: Test Message Auto-Reply

### Step 1: Send a Test Message

1. **Open WhatsApp** on your phone
2. **Send a message** to the connected phone number
   - Example: "Hello, what are your business hours?"

### Step 2: Watch the Magic Happen!

**What should happen:**

1. **Your message** is sent to the WhatsApp number
2. **Meta sends a webhook** to your edge function
3. **Your chatbot processes** the message using AI
4. **Auto-reply is sent** back to you within 1-2 seconds!

**Check the Console:**

In your terminal where `npm run dev` is running, you should see logs like:
```
Webhook received: ...
Processing message from +601234567890
Chatbot response: ...
Message sent successfully
```

### Step 3: Verify in the UI

1. **Go back** to your browser
2. **Refresh** the WhatsApp Integration page
3. **Look at the stats:**
   - Total messages should increase
   - Delivery rate should show percentage
   - Contacts should show 1

**🎉 Your WhatsApp Chatbot is Working!**

---

## 🔍 Troubleshooting

### Issue: "Configuration error" when clicking Connect

**Solution:**
- Check your `.env` file has `VITE_META_APP_ID` and `VITE_WHATSAPP_OAUTH_REDIRECT_URI`
- Restart your dev server (`npm run dev`)

### Issue: OAuth popup is blocked

**Solution:**
- Allow popups for `localhost:8080` in your browser
- Try clicking the button again

### Issue: "No WhatsApp Business Account found"

**Solution:**
- Make sure you created a WhatsApp Business Account in Meta Business Manager
- Add a phone number to your WhatsApp Business Account
- Try reconnecting

### Issue: Messages not auto-replying

**Solution:**

1. **Check Webhook is Active:**
   - Go to Meta App → WhatsApp → Configuration
   - Verify webhook URL is correct
   - Check webhook fields are subscribed

2. **Check Edge Function Logs:**
   ```bash
   npx supabase functions logs whatsapp-webhook --follow
   ```

3. **Check OpenAI API Key:**
   - Go to Settings → API Keys
   - Make sure you have an active OpenAI API key

4. **Test the webhook manually:**
   - Send a POST request to your webhook URL
   - Use Postman or curl to verify it's reachable

### Issue: "Invalid signature" error in logs

**Solution:**
- Verify `META_APP_SECRET` is set correctly
- Redeploy the function: `npx supabase functions deploy whatsapp-webhook`

---

## 📊 What's Next?

Now that your WhatsApp chatbot is working, you can:

1. **Customize your chatbot:**
   - Go to **Chatbot Settings** to update your business context
   - Go to **Prompt Engineer** to refine responses
   - Go to **Products** to add your product catalog

2. **Train your chatbot:**
   - Go to **Model Training** to upload conversation examples
   - Use the WhatsApp Parser to import real conversations

3. **Create message templates:**
   - (Coming in Phase 3) Send broadcasts and notifications

4. **Sync your product catalog:**
   - (Coming in Phase 5) Display products in WhatsApp

---

## 🆘 Need Help?

If you're stuck:

1. **Check the logs:**
   ```bash
   # Backend logs
   npx supabase functions logs whatsapp-webhook --follow

   # Database logs
   npx supabase db logs
   ```

2. **Verify your setup:**
   - Meta App ID matches `.env` and Supabase secrets
   - Webhook URL is correct in Meta dashboard
   - OAuth redirect URI is correct

3. **Test components individually:**
   - Test database: Query `whatsapp_connections` table
   - Test webhook: Send test POST request
   - Test OAuth: Check browser console for errors

---

## ✅ Checklist

Use this checklist to verify everything is set up:

**Backend:**
- [ ] Database migration deployed (`npx supabase db push`)
- [ ] Encryption key generated and set
- [ ] Meta app credentials set as secrets
- [ ] Edge functions deployed (webhook + oauth-callback)

**Meta App:**
- [ ] Meta Business Account created
- [ ] WhatsApp Business App created
- [ ] WhatsApp product added (Cloud API)
- [ ] OAuth redirect URI configured
- [ ] Webhook URL configured and verified
- [ ] Webhook fields subscribed (messages, message_status)

**Frontend:**
- [ ] `.env` file updated with Meta App ID
- [ ] Dev server restarted
- [ ] Can navigate to WhatsApp Integration page
- [ ] Can see "Connect" button

**Testing:**
- [ ] Successfully connected WhatsApp number
- [ ] Can see connection card with stats
- [ ] Sent test message from WhatsApp
- [ ] Received auto-reply
- [ ] Stats updated in UI

---

## 🎓 Understanding the Flow

Here's how everything works together:

```
User (WhatsApp) → Meta (receives message) → Your Webhook (whatsapp-webhook)
                                                   ↓
                                          Process with AI Chatbot
                                                   ↓
                                          Send reply via Meta API
                                                   ↓
                                          User receives response
```

**OAuth Flow:**
```
User clicks Connect → Opens Meta OAuth → User authorizes → Meta redirects
                                                              ↓
                                                  whatsapp-oauth-callback
                                                              ↓
                                              Store encrypted token in DB
                                                              ↓
                                              Redirect to success page
```

---

**Congratulations!** 🎉 Your WhatsApp chatbot is now live and ready to handle customer conversations!
