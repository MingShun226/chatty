# WhatsApp Web Integration - Quick Start Guide

This guide will help you set up the unofficial WhatsApp Web integration using QR codes.

## ⚠️ Warning

**This is an unofficial WhatsApp integration that violates WhatsApp's Terms of Service. Your account may be banned. Use at your own risk.**

## What You'll Get

- QR code-based WhatsApp connection (no Meta app needed)
- Automatic message forwarding to your chatbot
- Simple setup and testing

## Setup Steps

### 1. Run Database Migration

First, apply the database migration to create required tables:

```bash
npx supabase db push
```

This creates two new tables:
- `whatsapp_web_sessions` - Stores WhatsApp connection sessions
- `whatsapp_web_messages` - Stores all messages

### 2. Setup WhatsApp Service Environment

Navigate to the service directory and create `.env` file:

```bash
cd whatsapp-web-service
copy .env.example .env
```

Edit `whatsapp-web-service\.env` with your Supabase credentials:

```env
PORT=3001
SUPABASE_URL=https://xatrtqdgghanwdujyhkq.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

**Where to get Service Role Key:**
1. Go to Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Go to Settings → API
4. Copy the "service_role" key (not the "anon" key!)

### 3. Install Service Dependencies

```bash
npm install
```

This will install:
- `whatsapp-web.js` - WhatsApp Web client library
- `qrcode` - QR code generation
- `express` - REST API server
- `@supabase/supabase-js` - Supabase client
- Other dependencies

### 4. Start the WhatsApp Service

```bash
npm start
```

You should see:

```
WhatsApp Web Service running on port 3001
Health check: http://localhost:3001/api/health
No existing sessions to restore
```

**Keep this terminal window open!** The service needs to run continuously.

### 5. Test Service Health

Open a new terminal and test:

```bash
curl http://localhost:3001/api/health
```

Expected response:

```json
{
  "status": "ok",
  "activeSessions": 0,
  "timestamp": "2024-01-03T10:30:00.000Z"
}
```

### 6. Start Your Frontend

In another terminal, start your React app:

```bash
npm run dev
```

### 7. Connect WhatsApp

1. Go to your dashboard
2. Navigate to a chatbot
3. Look for the WhatsApp integration section
4. Click "Connect WhatsApp" (you'll need to integrate the UI component)
5. A QR code will appear
6. Open WhatsApp on your phone → Settings → Linked Devices → Link a Device
7. Scan the QR code
8. Wait for "Connected!" message

## Integration with Your UI

You have two options to integrate the WhatsApp Web connection:

### Option A: Add to Existing WhatsApp Section

Find where you currently have WhatsApp settings (likely in `ChatbotSectionBusiness.tsx` or similar) and add a button:

```tsx
import { WhatsAppWebConnectionModal } from '../whatsapp/WhatsAppWebConnectionModal'
import { useState } from 'react'

// Inside your component:
const [showWhatsAppModal, setShowWhatsAppModal] = useState(false)

// Add button:
<button
  onClick={() => setShowWhatsAppModal(true)}
  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
>
  Connect WhatsApp (QR Code)
</button>

// Add modal:
<WhatsAppWebConnectionModal
  isOpen={showWhatsAppModal}
  onClose={() => setShowWhatsAppModal(false)}
  chatbotId={yourChatbotId}
  chatbotName={yourChatbotName}
/>
```

### Option B: Create New WhatsApp Page

Create a new page in [src/pages/chatbot/WhatsAppWebSetup.tsx](src/pages/chatbot/WhatsAppWebSetup.tsx):

```tsx
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { WhatsAppWebConnectionModal } from '../../components/whatsapp/WhatsAppWebConnectionModal'

export function WhatsAppWebSetup() {
  const { chatbotId } = useParams()
  const [showModal, setShowModal] = useState(false)

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">WhatsApp Web Integration</h1>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Connect Your WhatsApp</h2>
        <p className="text-gray-600 mb-6">
          Connect your WhatsApp account to start receiving and sending messages
          through your chatbot.
        </p>

        <button
          onClick={() => setShowModal(true)}
          className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          Connect WhatsApp
        </button>
      </div>

      <WhatsAppWebConnectionModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        chatbotId={chatbotId!}
        chatbotName="Your Chatbot"
      />
    </div>
  )
}
```

## Testing the Integration

### Test 1: Create a Session

```bash
curl -X POST http://localhost:3001/api/sessions/create \
  -H "Content-Type: application/json" \
  -d "{\"userId\":\"9248b32f-2015-4afb-a0a3-25aa8755dc35\",\"chatbotId\":\"dfaf5a3e-1033-4e0f-bf4c-65217d68bfb3\"}"
```

### Test 2: Check Database

Open Supabase dashboard and check `whatsapp_web_sessions` table. You should see a new row with status "qr_ready" and a QR code.

### Test 3: Send a Message

After connecting, send a WhatsApp message to the connected number. You should see:

1. Message appears in `whatsapp_web_messages` table
2. Your chatbot processes it (check edge function logs)
3. Reply is sent back via WhatsApp
4. Reply appears in `whatsapp_web_messages` table

## Troubleshooting

### "Connection failed" error

**Issue**: Service can't connect to WhatsApp
**Fix**:
1. Check service is running: `curl http://localhost:3001/api/health`
2. Check service logs for errors
3. Try restarting the service

### QR code doesn't appear

**Issue**: QR code not being generated
**Fix**:
1. Check service logs for errors
2. Ensure Chromium can launch (required by puppeteer)
3. On Windows, you may need to install Chrome/Edge
4. Check `.wwebjs_auth` folder permissions

### Session disconnects immediately

**Issue**: WhatsApp disconnects after scanning
**Fix**:
1. Don't close the service while connected
2. Ensure stable internet connection
3. Try using a different WhatsApp account
4. WhatsApp may have flagged the account

### Messages not being received

**Issue**: WhatsApp messages not triggering chatbot
**Fix**:
1. Check `whatsapp_web_messages` table - are messages being stored?
2. Check edge function logs - is `avatar-chat` being called?
3. Verify chatbot is properly configured
4. Check service logs for errors

### "Cannot find module" errors

**Issue**: Missing dependencies
**Fix**:
```bash
cd whatsapp-web-service
rm -rf node_modules package-lock.json
npm install
```

## Production Deployment

For production, you'll need to deploy the WhatsApp service to a platform that supports long-running Node.js processes.

### Recommended Platforms:

1. **Railway** (Easiest)
   - Free tier available
   - Automatic deployments
   - Built-in environment variables

2. **Render** (Free tier)
   - Good free tier
   - Auto-deploy from Git

3. **VPS** (Most control)
   - DigitalOcean, Linode, AWS EC2
   - Full control over resources
   - Use PM2 for process management

See [whatsapp-web-service/README.md](whatsapp-web-service/README.md) for detailed deployment instructions.

## Next Steps

After successful setup:

1. ✅ Connect your WhatsApp account
2. ✅ Send a test message
3. ✅ Verify chatbot responds
4. Configure message templates
5. Set up conversation flows
6. Monitor message logs
7. Consider deploying to production

## Getting Help

If you encounter issues:

1. Check service logs in the terminal
2. Check browser console for frontend errors
3. Check Supabase logs (Functions tab)
4. Check database tables for unexpected data
5. Review the full README: [whatsapp-web-service/README.md](whatsapp-web-service/README.md)

## Important Reminders

- ⚠️ This violates WhatsApp Terms of Service
- ⚠️ Your account may be banned
- ⚠️ Not recommended for production
- ⚠️ Use a test WhatsApp account first
- ⚠️ Keep the service running continuously
- ⚠️ Service consumes significant resources (Chrome instances)
