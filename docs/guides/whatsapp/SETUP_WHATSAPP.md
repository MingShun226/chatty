# WhatsApp Web Integration Setup

## ⚠️ IMPORTANT WARNING

**This is an unofficial WhatsApp integration that violates WhatsApp's Terms of Service.**
- Your WhatsApp account may be permanently banned
- Use a test phone number, NOT your main WhatsApp account
- Use at your own risk

## Quick Setup (3 Steps)

### Step 1: Run Database Migration

1. Go to Supabase SQL Editor: https://supabase.com/dashboard/project/xatrtqdgghanwdujyhkq/sql/new
2. Copy ALL the SQL from: `supabase\migrations\20260103000000_whatsapp_web_sessions.sql`
3. Paste into SQL editor
4. Click "Run"

This creates two tables:
- `whatsapp_web_sessions` - Connection sessions
- `whatsapp_web_messages` - Message history

### Step 2: Start WhatsApp Service

**Option A - Double-click the batch file:**
- Double-click `start-whatsapp-service.bat`
- Keep the window open

**Option B - Manual start:**
```bash
cd whatsapp-web-service
npm start
```

You should see:
```
WhatsApp Web Service running on port 3001
Health check: http://localhost:3001/api/health
```

**KEEP THIS WINDOW OPEN!** The service must run continuously.

### Step 3: Start Your App

In a NEW terminal:
```bash
npm run dev
```

## Using WhatsApp Integration

1. Open your app: http://localhost:8080
2. Go to Dashboard → Select a Chatbot → Settings tab
3. Scroll down to "WhatsApp Integration" section
4. Click "Connect WhatsApp" button
5. A QR code will appear
6. Open WhatsApp on your phone → Settings → Linked Devices → Link a Device
7. Scan the QR code
8. Wait for "Connected!" message

## Testing

1. Send a WhatsApp message to the connected number
2. Your chatbot should automatically reply
3. Check message history in database: `whatsapp_web_messages` table

## Troubleshooting

### QR Code doesn't appear
- Check if service is running: http://localhost:3001/api/health
- Check service console for errors
- Restart the service

### "Connection failed" error
- Make sure both services are running (WhatsApp service + frontend)
- Check console for errors
- Try restarting WhatsApp service

### Messages not being received
- Check service logs
- Verify session status in database
- Try disconnecting and reconnecting
- Check if phone still has internet

### Service crashes
- Check if Chrome/Edge is installed (required by Puppeteer)
- Try deleting `.wwebjs_auth` folder and reconnecting
- Check Node.js version (requires 18+)

## Checking Service Status

Visit: http://localhost:3001/api/health

Should return:
```json
{
  "status": "ok",
  "activeSessions": 0,
  "timestamp": "2024-01-03T10:30:00.000Z"
}
```

## File Structure

```
AvatarLab/
├── whatsapp-web-service/          # Node.js service
│   ├── index.js                    # Main service code
│   ├── package.json                # Dependencies
│   ├── .env                        # Configuration (already set up)
│   └── .wwebjs_auth/               # WhatsApp session data (auto-created)
│
├── src/components/whatsapp/        # UI components
│   └── WhatsAppWebConnectionModal.tsx
│
├── supabase/migrations/
│   └── 20260103000000_whatsapp_web_sessions.sql
│
└── start-whatsapp-service.bat     # Quick start script
```

## Production Deployment

For production, deploy the WhatsApp service to:
- Railway (easiest, free tier)
- Render (free tier available)
- VPS with PM2

See `whatsapp-web-service/README.md` for deployment instructions.

## Need Help?

1. Check service logs in console
2. Check browser console for frontend errors
3. Check Supabase logs
4. Review `WHATSAPP_WEB_QUICK_START.md` for detailed guide
5. Review `whatsapp-web-service/README.md` for API docs
