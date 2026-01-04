# WhatsApp Web Integration Architecture

## 🏗️ System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER'S PHONE                            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              WhatsApp Mobile App                          │  │
│  │  1. Scan QR Code                                          │  │
│  │  2. Send/Receive Messages                                 │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ WhatsApp Web Protocol
                         │
┌────────────────────────▼────────────────────────────────────────┐
│              WhatsApp Web Service (Node.js)                     │
│              Running on: localhost:3001                         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  • Generate QR Codes (whatsapp-web.js)                   │  │
│  │  • Manage Sessions (one per chatbot)                     │  │
│  │  • Receive WhatsApp Messages                             │  │
│  │  • Forward to Chatbot Edge Function                      │  │
│  │  • Send Chatbot Replies back to WhatsApp                 │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ REST API & Database
                         │
┌────────────────────────▼────────────────────────────────────────┐
│                     Supabase Backend                            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Database Tables:                                         │  │
│  │  • whatsapp_web_sessions (connections)                   │  │
│  │  • whatsapp_web_messages (message history)               │  │
│  │                                                           │  │
│  │  Edge Functions:                                          │  │
│  │  • avatar-chat (chatbot logic)                           │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ Supabase Client
                         │
┌────────────────────────▼────────────────────────────────────────┐
│                  React Frontend (Your App)                      │
│              Running on: localhost:8080                         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Dashboard → Settings → WhatsApp Integration              │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │  WhatsAppWebConnectionModal                        │  │  │
│  │  │  • Shows QR Code                                   │  │  │
│  │  │  • Shows Connection Status                         │  │  │
│  │  │  • Manage Connection                               │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## 🔄 Message Flow

### Inbound Messages (User → Chatbot)

```
1. Customer sends WhatsApp message
         ↓
2. WhatsApp Web Service receives it
         ↓
3. Service stores message in database (whatsapp_web_messages)
         ↓
4. Service calls avatar-chat edge function
         ↓
5. Chatbot processes message and generates reply
         ↓
6. Edge function returns reply to service
         ↓
7. Service sends reply via WhatsApp
         ↓
8. Service stores reply in database
         ↓
9. Customer receives reply on WhatsApp
```

### QR Code Connection Flow

```
1. User clicks "Connect WhatsApp" in Settings
         ↓
2. Frontend calls WhatsApp Service API
         ↓
3. Service creates session in database
         ↓
4. Service initializes WhatsApp Web client
         ↓
5. Service generates QR code
         ↓
6. QR code stored in database
         ↓
7. Frontend polls database for QR code
         ↓
8. QR code displayed to user
         ↓
9. User scans with phone
         ↓
10. WhatsApp authenticates
         ↓
11. Service updates session status to "connected"
         ↓
12. Frontend shows "Connected!" message
```

## 📊 Database Schema

### whatsapp_web_sessions

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | User who owns this connection |
| chatbot_id | UUID | Chatbot using this connection |
| session_id | TEXT | Unique session identifier |
| phone_number | TEXT | Connected WhatsApp number |
| status | TEXT | pending, qr_ready, connected, etc. |
| qr_code | TEXT | Base64 QR code image (temporary) |
| connected_at | TIMESTAMP | When connection was established |

### whatsapp_web_messages

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| session_id | UUID | Reference to session |
| chatbot_id | UUID | Which chatbot handled this |
| message_id | TEXT | WhatsApp message ID |
| from_number | TEXT | Sender phone number |
| to_number | TEXT | Recipient phone number |
| direction | TEXT | inbound or outbound |
| content | TEXT | Message text |
| timestamp | TIMESTAMP | When message was sent |

## 🔌 API Endpoints

### WhatsApp Service (localhost:3001)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/sessions/create` | POST | Create new WhatsApp session |
| `/api/sessions/disconnect` | POST | Disconnect session |
| `/api/messages/send` | POST | Send WhatsApp message |
| `/api/health` | GET | Health check |

## 🔐 Security

1. **Service Role Key**: WhatsApp service uses Supabase service role key (secret)
2. **Row Level Security**: Database tables have RLS policies
3. **User Isolation**: Each user can only see their own sessions
4. **QR Code Expiry**: QR codes expire after 60 seconds
5. **Session Encryption**: WhatsApp session data stored securely

## 📦 Components

### Frontend Components

```
src/components/
├── whatsapp/
│   └── WhatsAppWebConnectionModal.tsx
│       • Main QR code modal
│       • Connection status
│       • Session management
│
└── business-chatbot/
    └── ChatbotSettingsModern.tsx
        • Integrated WhatsApp section
        • Shows connection status
        • Opens modal
```

### Backend Service

```
whatsapp-web-service/
├── index.js
│   • Main service logic
│   • WhatsApp client management
│   • REST API endpoints
│   • Message handling
│
├── package.json
│   • Dependencies (whatsapp-web.js, express, etc.)
│
└── .env
    • Configuration (Supabase credentials)
```

## 🎯 Key Features

1. **Multi-Tenant**: Each chatbot can have its own WhatsApp connection
2. **Real-Time**: Messages processed immediately
3. **Persistent**: Sessions survive service restarts
4. **Secure**: RLS policies protect user data
5. **Scalable**: Can handle multiple concurrent sessions

## ⚡ Performance

- **QR Code Generation**: ~2-3 seconds
- **Message Processing**: <1 second
- **Session Startup**: ~10-15 seconds
- **Memory**: ~200MB per session (Chrome process)

## 🔧 Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | React + TypeScript |
| UI Components | Headless UI + Tailwind |
| Backend Service | Node.js + Express |
| WhatsApp Protocol | whatsapp-web.js |
| Database | PostgreSQL (Supabase) |
| Auth | Supabase Auth |
| Edge Functions | Deno (Supabase) |

## 📈 Scaling Considerations

1. **Vertical**: Each session uses ~200MB RAM
2. **Horizontal**: Can distribute across multiple service instances
3. **Database**: Supabase handles scaling automatically
4. **Rate Limits**: WhatsApp may rate limit if too many messages

## 🚨 Limitations

1. **Unofficial API**: Violates WhatsApp ToS
2. **Resource Intensive**: Chrome instance per session
3. **Single Device**: One connection per phone number
4. **Session Stability**: Can disconnect unexpectedly
5. **Text Only**: Current version supports text messages only

## 🔮 Future Enhancements

1. Support for media messages (images, videos)
2. Message templates
3. Webhook support for real-time updates
4. Admin dashboard for monitoring
5. Analytics and reporting
6. Multi-language support
7. Message scheduling
8. Broadcast messages
