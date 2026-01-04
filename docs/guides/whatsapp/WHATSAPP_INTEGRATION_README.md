# 📱 WhatsApp Business Integration

> **Connect your AI chatbot to WhatsApp in 30 seconds**

---

## 🎯 What is This?

This feature allows you to connect your AI chatbot to WhatsApp Business, enabling:

- ✅ **Auto-reply to WhatsApp messages** with AI-powered responses
- ✅ **Product search** via function calling (search catalog from WhatsApp)
- ✅ **Multi-number support** (connect multiple WhatsApp numbers to one chatbot)
- ✅ **Real-time message tracking** with delivery status
- ✅ **Encrypted token storage** (AES-256-GCM encryption)
- ✅ **Simple 3-step OAuth flow** (no complex setup!)

---

## 🚀 Quick Start (5 Minutes)

Want to get started immediately? Follow this:

### 1. Deploy Backend
```bash
npx supabase db push
openssl rand -hex 32  # Copy this output
npx supabase secrets set WHATSAPP_ENCRYPTION_KEY=<paste_output>
npx supabase secrets set APP_URL=http://localhost:8080
npx supabase secrets set META_APP_ID=placeholder
npx supabase secrets set META_APP_SECRET=placeholder
npx supabase functions deploy whatsapp-webhook
npx supabase functions deploy whatsapp-oauth-callback
```

### 2. Create Meta App
1. Go to https://developers.facebook.com/apps
2. Create app → Business type → Add WhatsApp
3. Copy App ID and App Secret
4. Update secrets:
   ```bash
   npx supabase secrets set META_APP_ID=<your_app_id>
   npx supabase secrets set META_APP_SECRET=<your_app_secret>
   ```
5. Configure OAuth redirect: `https://YOUR_PROJECT.supabase.co/functions/v1/whatsapp-oauth-callback`
6. Configure webhook: `https://YOUR_PROJECT.supabase.co/functions/v1/whatsapp-webhook`

### 3. Update Frontend
Edit `.env`:
```env
VITE_META_APP_ID="your_app_id"
VITE_WHATSAPP_OAUTH_REDIRECT_URI="https://YOUR_PROJECT.supabase.co/functions/v1/whatsapp-oauth-callback"
```

Restart dev server:
```bash
npm run dev
```

### 4. Connect & Test
1. Open http://localhost:8080
2. Go to **WhatsApp Chatbot** → **WhatsApp Integration**
3. Click **"Connect WhatsApp Now"**
4. Login with Facebook → Grant permissions
5. Send a WhatsApp message → Get AI reply!

📖 **Full guide:** [QUICK_START_WHATSAPP.md](./QUICK_START_WHATSAPP.md)

---

## 📚 Documentation

### For Users (Setup & Usage)

| Document | Purpose | Time to Read |
|----------|---------|--------------|
| [WHATSAPP_DEPLOYMENT_CHECKLIST.md](./WHATSAPP_DEPLOYMENT_CHECKLIST.md) | **Start here!** Complete step-by-step deployment guide | 15 min |
| [QUICK_START_WHATSAPP.md](./QUICK_START_WHATSAPP.md) | Fast 5-minute setup (experienced users) | 5 min |
| [SIMPLIFIED_WHATSAPP_FLOW.md](./SIMPLIFIED_WHATSAPP_FLOW.md) | User experience walkthrough (what to expect) | 10 min |
| [WHATSAPP_UI_GUIDE.md](./WHATSAPP_UI_GUIDE.md) | Visual UI reference guide | 20 min |
| [WHATSAPP_SETUP_GUIDE.md](./WHATSAPP_SETUP_GUIDE.md) | Detailed setup with troubleshooting | 30 min |

### For Developers (Technical Reference)

| Component | File | Description |
|-----------|------|-------------|
| **Database Schema** | [supabase/migrations/20260102000000_whatsapp_integration.sql](./supabase/migrations/20260102000000_whatsapp_integration.sql) | 5 tables: connections, messages, templates, broadcasts, catalogs |
| **Webhook Handler** | [supabase/functions/whatsapp-webhook/index.ts](./supabase/functions/whatsapp-webhook/index.ts) | Receives messages from Meta, processes with AI, sends replies |
| **OAuth Callback** | [supabase/functions/whatsapp-oauth-callback/index.ts](./supabase/functions/whatsapp-oauth-callback/index.ts) | Handles OAuth flow, exchanges code for token, stores connection |
| **Chatbot Engine** | [supabase/functions/_shared/chatbot-engine.ts](./supabase/functions/_shared/chatbot-engine.ts) | Shared AI logic with function calling (product search) |
| **Encryption** | [src/services/whatsappEncryption.ts](./src/services/whatsappEncryption.ts) | AES-256-GCM token encryption (frontend + edge function) |
| **Frontend Service** | [src/services/whatsappService.ts](./src/services/whatsappService.ts) | 20+ methods for WhatsApp operations |
| **Connection Modal** | [src/components/whatsapp/WhatsAppConnectionModal.tsx](./src/components/whatsapp/WhatsAppConnectionModal.tsx) | Simplified 3-step OAuth flow UI |
| **Main Page** | [src/pages/chatbot/WhatsAppIntegration.tsx](./src/pages/chatbot/WhatsAppIntegration.tsx) | Integration management page |

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         User (WhatsApp)                      │
└────────────────────────┬────────────────────────────────────┘
                         │ Sends message
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Meta WhatsApp Cloud API                   │
│                  (Official WhatsApp Backend)                 │
└────────────────────────┬────────────────────────────────────┘
                         │ Webhook POST
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              Supabase Edge Function: whatsapp-webhook        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 1. Verify webhook signature (SHA256 HMAC)            │  │
│  │ 2. Extract message content & sender                  │  │
│  │ 3. Get WhatsApp connection from database             │  │
│  │ 4. Decrypt access token (AES-256-GCM)                │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────┘
                         │ Call chatbot engine
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   Chatbot Engine (Shared)                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 1. Get chatbot configuration                         │  │
│  │ 2. Get active prompt version                         │  │
│  │ 3. Get RAG knowledge chunks (vector similarity)      │  │
│  │ 4. Get conversation memories                         │  │
│  │ 5. Build system prompt with context                  │  │
│  │ 6. Call OpenAI API with function calling             │  │
│  │    - search_products(query, filters)                 │  │
│  │    - get_product_by_id(id)                          │  │
│  │ 7. Execute tool calls if requested                   │  │
│  │ 8. Return final response                             │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────┘
                         │ AI response
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              Supabase Edge Function: whatsapp-webhook        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 1. Send reply via Meta API (encrypted token)         │  │
│  │ 2. Save message to database                          │  │
│  │ 3. Track delivery status                             │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────┘
                         │ Reply sent
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Meta WhatsApp Cloud API                   │
└────────────────────────┬────────────────────────────────────┘
                         │ Delivers message
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                         User (WhatsApp)                      │
│                    Receives AI reply! 🤖                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔐 Security Features

### 1. Token Encryption (AES-256-GCM)
- WhatsApp access tokens are encrypted before storage
- Uses PBKDF2 key derivation from master key
- 12-byte random IV (initialization vector) per encryption
- 128-bit authentication tag prevents tampering

### 2. Webhook Signature Verification
- Every webhook request from Meta is verified using SHA256 HMAC
- Prevents unauthorized webhook calls
- Meta App Secret used as signing key

### 3. Row Level Security (RLS)
- All database tables have RLS policies
- Users can only access their own connections
- Chatbot owners can only manage their own messages

### 4. OAuth State Parameter
- Prevents CSRF attacks during OAuth flow
- Encodes userId + chatbotId in Base64
- Verified on callback

---

## 📊 Database Schema

### Tables Created

1. **whatsapp_connections**
   - Stores WhatsApp Business Account connections
   - Encrypted access tokens
   - Phone number metadata (quality, tier, verified status)
   - One-to-many: chatbot → connections

2. **whatsapp_messages**
   - All messages (inbound + outbound)
   - Delivery status tracking (sent, delivered, read, failed)
   - Links to connection and conversation
   - Indexed by timestamp for fast queries

3. **whatsapp_message_templates**
   - Pre-approved Meta templates
   - Template name, language, category
   - Variable placeholders
   - Approval status

4. **whatsapp_broadcasts**
   - Campaign tracking
   - Target audience (contact list)
   - Sent/delivered/failed counts
   - Scheduled send time

5. **whatsapp_product_catalogs**
   - Synced product catalogs from Meta
   - Catalog ID, name, item count
   - Last sync timestamp

All tables include RLS policies and proper indexes.

---

## 🎨 User Experience (UX)

### Before (Complex OAuth Flow)
1. Click connect button
2. Read long explanation modal
3. Click "Start OAuth"
4. Popup window opens (often blocked!)
5. Login to Facebook
6. Grant permissions
7. Popup redirects
8. Parent window detects completion
9. Shows success

**Problems:**
- Popup blockers
- Too many steps
- Technical jargon
- Confusing

### After (Simplified Flow)
1. Click "Connect WhatsApp Now"
2. See 3-step preview with icons
3. Click Facebook button
4. **Full-page redirect** to Facebook (no popup!)
5. Grant permissions
6. **Auto-redirect** back to app
7. See success message

**Benefits:**
- ✅ No popup blocking
- ✅ Clear progress bar (33%, 66%, 100%)
- ✅ Visual step indicators
- ✅ Simple language
- ✅ Takes only 30 seconds!

---

## 🔧 Configuration

### Environment Variables (Frontend)

```env
# .env
VITE_META_APP_ID="123456789012345"
VITE_WHATSAPP_OAUTH_REDIRECT_URI="https://YOUR_PROJECT.supabase.co/functions/v1/whatsapp-oauth-callback"
```

### Supabase Secrets (Backend)

```bash
WHATSAPP_ENCRYPTION_KEY  # 32-byte hex key for AES-256-GCM
APP_URL                  # Frontend URL (for redirects)
META_APP_ID              # Meta app ID
META_APP_SECRET          # Meta app secret
```

---

## 🧪 Testing

### Manual Testing Checklist

**Phase 1: Backend Deployment**
- [ ] Database migration runs successfully
- [ ] Edge functions deploy without errors
- [ ] Webhook endpoint responds to GET verification
- [ ] Secrets are set correctly

**Phase 2: Frontend Setup**
- [ ] Environment variables configured
- [ ] Can navigate to WhatsApp Integration page
- [ ] Chatbot selector works
- [ ] Connection modal opens

**Phase 3: OAuth Flow**
- [ ] Click "Connect" opens modal
- [ ] See 3-step preview
- [ ] Facebook button redirects to Meta
- [ ] Can login and grant permissions
- [ ] Redirects back to app with success

**Phase 4: Message Flow**
- [ ] Send WhatsApp message to connected number
- [ ] Receive AI reply within 2 seconds
- [ ] Reply is relevant and contextual
- [ ] Stats update in UI (message count, delivery rate)

**Phase 5: Function Calling**
- [ ] Ask "What products do you have?"
- [ ] Bot searches product database
- [ ] Returns product list with prices
- [ ] Ask "Show me red shoes under $100"
- [ ] Bot applies filters correctly

### Automated Testing

```bash
# Test webhook signature verification
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/whatsapp-webhook \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: sha256=<calculated_signature>" \
  -d '{"object":"whatsapp_business_account","entry":[...]}'

# Test OAuth callback
curl "https://YOUR_PROJECT.supabase.co/functions/v1/whatsapp-oauth-callback?code=TEST_CODE&state=eyJ1c2VySWQiOiJ0ZXN0In0="
```

---

## 🐛 Common Issues & Solutions

### Issue: "No Chatbot Selected"
**Cause:** Page loaded without chatbot context
**Solution:** Use ChatbotPageLayout pattern, select chatbot from dropdown

### Issue: React Hooks Error
**Cause:** Using hooks inside render prop function
**Solution:** Create separate component for content with hooks at top level

### Issue: OAuth Popup Blocked
**Cause:** Browser blocking popup windows
**Solution:** Use full-page redirect instead (already implemented!)

### Issue: "Invalid signature" in webhook
**Cause:** META_APP_SECRET not set or incorrect
**Solution:** Verify secret with `npx supabase secrets list`, redeploy function

### Issue: Messages not auto-replying
**Cause:** Multiple possible issues
**Solution:**
1. Check webhook logs: `npx supabase functions logs whatsapp-webhook`
2. Verify webhook is active in Meta dashboard
3. Check OpenAI API key is configured
4. Verify connection exists in database

---

## 📈 Metrics & Monitoring

### Key Metrics Tracked

1. **Message Volume**
   - Total messages sent/received
   - Messages per day/week/month
   - Peak hours analysis

2. **Delivery Rate**
   - % messages successfully delivered
   - Failed message reasons
   - Average delivery time

3. **Quality Rating**
   - GREEN: High quality (good reputation)
   - YELLOW: Medium quality (some issues)
   - RED: Low quality (risk of restrictions)

4. **Conversation Tier**
   - TIER_50: 50 conversations/day (starting tier)
   - TIER_250: 250/day
   - TIER_1K: 1,000/day
   - TIER_10K: 10,000/day
   - TIER_UNLIMITED: No limit

### How to Monitor

```sql
-- View all connections
SELECT * FROM whatsapp_connections WHERE chatbot_id = '<your_chatbot_id>';

-- Check message stats
SELECT
  COUNT(*) as total_messages,
  COUNT(DISTINCT from_phone) as unique_contacts,
  AVG(CASE WHEN delivery_status = 'delivered' THEN 1.0 ELSE 0.0 END) * 100 as delivery_rate
FROM whatsapp_messages
WHERE connection_id = '<your_connection_id>';

-- Recent messages
SELECT * FROM whatsapp_messages
WHERE connection_id = '<your_connection_id>'
ORDER BY created_at DESC
LIMIT 50;
```

---

## 🚦 Roadmap

### Phase 1: Core Integration ✅ (COMPLETE)
- [x] Database schema
- [x] Webhook handler
- [x] OAuth callback
- [x] Token encryption
- [x] Message auto-reply
- [x] Function calling (product search)

### Phase 2: UI & UX ✅ (COMPLETE)
- [x] WhatsApp Integration page
- [x] Connection modal (simplified)
- [x] Connection cards
- [x] Real-time stats
- [x] Comprehensive documentation

### Phase 3: Advanced Features (NEXT)
- [ ] Message templates management
- [ ] Broadcast campaigns
- [ ] Media support (images, documents, videos)
- [ ] Quick replies & interactive buttons
- [ ] Message scheduling

### Phase 4: Analytics (PLANNED)
- [ ] Conversation analytics dashboard
- [ ] Response time tracking
- [ ] User sentiment analysis
- [ ] Conversion tracking
- [ ] A/B testing for responses

### Phase 5: Business Features (PLANNED)
- [ ] Product catalog sync with Meta
- [ ] Shopping cart in WhatsApp
- [ ] Payment integration
- [ ] Order tracking
- [ ] Customer support ticketing

---

## 🤝 Contributing

### Development Workflow

1. Create feature branch: `git checkout -b feature/whatsapp-templates`
2. Make changes
3. Test locally
4. Deploy to staging: `npx supabase functions deploy --project-ref staging`
5. Test in staging
6. Create pull request
7. Deploy to production after approval

### Code Style

- **TypeScript**: Strict mode, explicit types
- **Functions**: Document with JSDoc comments
- **Database**: Always use parameterized queries
- **Errors**: Throw descriptive errors with context
- **Logging**: Use structured logging (JSON format)

---

## 📞 Support

### Documentation
- [WHATSAPP_DEPLOYMENT_CHECKLIST.md](./WHATSAPP_DEPLOYMENT_CHECKLIST.md) - Complete setup guide
- [WHATSAPP_SETUP_GUIDE.md](./WHATSAPP_SETUP_GUIDE.md) - Detailed troubleshooting

### External Resources
- [Meta WhatsApp Cloud API Docs](https://developers.facebook.com/docs/whatsapp/cloud-api)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [OpenAI Function Calling](https://platform.openai.com/docs/guides/function-calling)

---

## 📜 License

This WhatsApp integration is part of the AvatarLab project.

---

## 🙏 Acknowledgments

- **Meta WhatsApp Cloud API** for providing the official API
- **Supabase** for edge functions and database
- **OpenAI** for GPT models with function calling
- **React** for the frontend framework

---

**🎊 Ready to connect your WhatsApp chatbot?**

Start with [WHATSAPP_DEPLOYMENT_CHECKLIST.md](./WHATSAPP_DEPLOYMENT_CHECKLIST.md) →
