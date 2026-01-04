# 🚀 Quick Start - AvatarLab API Integration

**Get your avatar connected to n8n in under 10 minutes!**

---

## What You'll Get

After following this guide, you'll have:

✅ **Platform API Keys** - Secure authentication for external services
✅ **API Endpoints** - Chat with your avatar via REST API
✅ **n8n Integration** - Ready-to-use workflow template
✅ **WhatsApp Bot** - (Optional) Connect to WhatsApp
✅ **Full Documentation** - Complete API reference

---

## 📋 Prerequisites

Before starting, make sure you have:

- ✅ AvatarLab account with at least one avatar created
- ✅ Supabase project set up (already done if you're running AvatarLab)
- ✅ n8n account (free tier is fine)
- ✅ 10 minutes of your time

---

## Step 1: Database Setup (2 minutes)

### 1.1 Run SQL Migration

1. **Open Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your project

2. **Open SQL Editor**
   - Click "SQL Editor" in left sidebar
   - Click "New query"

3. **Paste SQL**
   - Open file: `PASTE_THIS_IN_SUPABASE.sql`
   - Copy the entire contents
   - Paste into SQL Editor

4. **Run Query**
   - Click "Run" button
   - Wait for success message
   - Verify output shows tables and functions created

✅ **Done!** Your database is ready.

---

## Step 2: Deploy API Endpoints (3 minutes)

### 2.1 Install Supabase CLI

```bash
npm install -g supabase
```

### 2.2 Login & Link

```bash
# Login to Supabase
supabase login

# Link your project (get project ID from Supabase dashboard URL)
supabase link --project-ref YOUR_PROJECT_ID
```

### 2.3 Deploy Functions

```bash
# Deploy chat endpoint
supabase functions deploy avatar-chat

# Deploy config endpoint
supabase functions deploy avatar-config
```

### 2.4 Verify Deployment

```bash
# Test chat endpoint (should return error about missing API key)
curl https://YOUR-PROJECT-ID.supabase.co/functions/v1/avatar-chat
```

✅ **Done!** Your API endpoints are live.

---

## Step 3: Create API Key (2 minutes)

### 3.1 Access API Keys Page

1. **Login to AvatarLab**
   - Go to your AvatarLab URL

2. **Navigate to API Keys**
   - Click on `/api-keys` in your browser
   - Or add a menu link to navigate there

### 3.2 Create Your First Key

1. **Click "Create API Key"**

2. **Fill in details**:
   - **Name**: `n8n Integration`
   - **Avatar Scope**: Select your avatar
   - **Permissions**: Check all (chat, config, knowledge, memories)
   - **Description**: `Test API key for n8n WhatsApp bot`

3. **Click "Create API Key"**

4. **COPY YOUR KEY NOW!**
   - ⚠️ **This is the only time you'll see it!**
   - Save it somewhere safe
   - Format: `pk_live_xxxxxxxxxxxxxxxx`

✅ **Done!** You have your API key.

---

## Step 4: Test the API (1 minute)

Replace placeholders with your actual values:
- `YOUR-PROJECT-ID` = Your Supabase project ID
- `YOUR_API_KEY` = The API key you just created
- `YOUR_AVATAR_ID` = Your avatar's UUID (get it from the database or URL)

### 4.1 Test Chat Endpoint

```bash
curl -X POST https://YOUR-PROJECT-ID.supabase.co/functions/v1/avatar-chat \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "avatar_id": "YOUR_AVATAR_ID",
    "message": "Hello! Tell me about yourself"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Hi! I'm [Avatar Name], ..."
}
```

### 4.2 Get Avatar ID

If you don't know your avatar ID, run this in Supabase SQL Editor:

```sql
SELECT id, name FROM avatars WHERE user_id = auth.uid();
```

✅ **Done!** Your API is working.

---

## Step 5: Set Up n8n (2 minutes)

### 5.1 Import Workflow Template

1. **Download Template**
   - File: `docs/n8n-workflow-template.json`

2. **Open n8n**
   - Go to https://n8n.io (or your self-hosted instance)
   - Login to your account

3. **Import Workflow**
   - Click "Workflows" → "Import from File"
   - Select `n8n-workflow-template.json`
   - Click "Import"

### 5.2 Configure Workflow

Edit the "Call AvatarLab API" node:

1. **URL**: Replace `YOUR-PROJECT-ID` with your Supabase project ID
   ```
   https://YOUR-PROJECT-ID.supabase.co/functions/v1/avatar-chat
   ```

2. **Headers**:
   - `x-api-key`: Replace with your actual API key
   - `Content-Type`: Leave as `application/json`

3. **Body Parameters**:
   - `avatar_id`: Replace with your avatar's UUID
   - `message`: Leave as `={{ $json.body.message }}`
   - `model`: Change to `gpt-4o-mini` if you want (optional)

### 5.3 Test Workflow

1. **Click "Test workflow"** button

2. **Manually trigger** with test data:
   ```json
   {
     "body": {
       "message": "Hello!"
     }
   }
   ```

3. **Check output** - Should see avatar's response

✅ **Done!** Your n8n workflow is ready.

---

## 🎉 You're All Set!

### What You Just Built

✅ **Secure API** - Your avatars are accessible via REST API
✅ **n8n Integration** - Ready to connect to any service
✅ **Scalable** - Can handle multiple integrations
✅ **Monitored** - All requests are logged

### Next Steps

#### Connect to WhatsApp

1. Get WhatsApp Business API access (or use Twilio)
2. Configure webhook to point to your n8n workflow
3. Start chatting with your avatar via WhatsApp!

#### Connect to Other Services

- **Telegram**: Use n8n's Telegram nodes
- **Discord**: Use n8n's Discord nodes
- **Slack**: Use n8n's Slack nodes
- **Custom App**: Use the API directly from your code

#### Advanced Features

- **Conversation Memory**: Store chat history in Redis/PostgreSQL
- **Multi-Avatar**: Create different workflows for different avatars
- **Custom Actions**: Add function calling for avatar actions

---

## 📚 Documentation

- **Full API Reference**: Open `public/api-docs.html` in browser
- **Integration Guide**: Read `docs/API_INTEGRATION_GUIDE.md`
- **Deployment Checklist**: Follow `DEPLOYMENT_CHECKLIST.md`

---

## 🐛 Troubleshooting

### "Missing API key" Error

**Fix**: Make sure header is `x-api-key` (lowercase) and value has no extra spaces

### "Avatar not found" Error

**Fix**:
1. Check avatar ID is correct (UUID format)
2. Verify avatar belongs to same user as API key
3. Run this SQL to find your avatar ID:
   ```sql
   SELECT id, name FROM avatars WHERE user_id = auth.uid();
   ```

### "Invalid API key" Error

**Fix**:
1. Check you copied the entire key (including `pk_live_` prefix)
2. Verify key is "active" in API Keys page
3. Create a new key if needed

### n8n Workflow Fails

**Fix**:
1. Check execution logs in n8n
2. Verify all placeholders are replaced
3. Test API directly with curl first

---

## 💬 Need Help?

- Check the full documentation in `docs/API_INTEGRATION_GUIDE.md`
- Review the API reference at `public/api-docs.html`
- Create an issue on GitHub

---

## 🔐 Security Reminder

⚠️ **NEVER commit your API keys to Git!**

- Use environment variables in production
- Rotate keys every 3 months
- Use scoped keys (restrict to specific avatar)
- Monitor usage regularly

---

**Congratulations! You've successfully integrated AvatarLab with external services! 🎊**

Now go build something amazing! 🚀
