# WhatsApp Web Service for AvatarLab

This service provides unofficial WhatsApp integration using QR code authentication (WhatsApp Web protocol).

## ⚠️ Important Warning

**This is an UNOFFICIAL WhatsApp integration that violates WhatsApp's Terms of Service.**

- Your WhatsApp account may be banned if detected
- This is not recommended for production use
- Use at your own risk
- For production, use the official Meta WhatsApp Business API instead

## How It Works

1. User clicks "Connect WhatsApp" in your platform
2. Service generates a QR code
3. User scans QR code with their WhatsApp mobile app
4. Service maintains WhatsApp Web session
5. Messages are automatically forwarded to your chatbot
6. Chatbot responses are sent back via WhatsApp

## Architecture

```
┌─────────────┐         ┌──────────────────┐         ┌──────────────┐
│   Browser   │ ◄─────► │  WhatsApp Web    │ ◄─────► │   Supabase   │
│  (Frontend) │         │     Service      │         │   Database   │
└─────────────┘         │   (Node.js)      │         └──────────────┘
                        └──────────────────┘
                               │
                               ▼
                        ┌──────────────────┐
                        │    WhatsApp      │
                        │   (via Web API)  │
                        └──────────────────┘
```

## Setup Instructions

### Step 1: Install Dependencies

```bash
cd whatsapp-web-service
npm install
```

### Step 2: Configure Environment

Create a `.env` file:

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
PORT=3001
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

Get your Supabase Service Role Key from:
- Supabase Dashboard → Settings → API → Service Role Key (secret)

### Step 3: Run Database Migration

The migration creates required tables. Run from your main project directory:

```bash
npx supabase db push
```

Or if using Supabase CLI:

```bash
npx supabase migration up
```

### Step 4: Start the Service

```bash
npm start
```

For development with auto-restart:

```bash
npm run dev
```

The service will start on `http://localhost:3001`

### Step 5: Configure Frontend

Add to your main project's `.env`:

```env
VITE_WHATSAPP_SERVICE_URL=http://localhost:3001
```

For production, use your deployed service URL.

### Step 6: Use the UI Component

The `WhatsAppWebConnectionModal` component is ready to use. Example integration:

```tsx
import { WhatsAppWebConnectionModal } from './components/whatsapp/WhatsAppWebConnectionModal'

function YourComponent() {
  const [showModal, setShowModal] = useState(false)

  return (
    <>
      <button onClick={() => setShowModal(true)}>
        Connect WhatsApp
      </button>

      <WhatsAppWebConnectionModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        chatbotId="your-chatbot-id"
        chatbotName="Your Chatbot Name"
      />
    </>
  )
}
```

## API Endpoints

### POST `/api/sessions/create`

Create a new WhatsApp session and generate QR code.

**Request:**
```json
{
  "userId": "uuid",
  "chatbotId": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "sessionId": "wa_user_chatbot_timestamp",
  "message": "Session created. QR code will be available shortly."
}
```

### POST `/api/sessions/disconnect`

Disconnect an active WhatsApp session.

**Request:**
```json
{
  "sessionId": "wa_user_chatbot_timestamp"
}
```

**Response:**
```json
{
  "success": true
}
```

### POST `/api/messages/send`

Send a WhatsApp message (for testing).

**Request:**
```json
{
  "sessionId": "wa_user_chatbot_timestamp",
  "to": "60123456789",
  "message": "Hello from chatbot!"
}
```

**Response:**
```json
{
  "success": true
}
```

### GET `/api/health`

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "activeSessions": 2,
  "timestamp": "2024-01-03T10:30:00.000Z"
}
```

## How Messages Are Processed

1. **Incoming Message** → WhatsApp Web Service receives it
2. **Store in Database** → Saved to `whatsapp_web_messages` table
3. **Call Chatbot** → Forwarded to `avatar-chat` edge function
4. **Get Response** → Chatbot processes and returns reply
5. **Send Reply** → Service sends reply via WhatsApp
6. **Store Reply** → Outbound message saved to database

## Database Tables

### `whatsapp_web_sessions`

Stores WhatsApp session information:
- `session_id`: Unique session identifier
- `user_id`: User who owns this connection
- `chatbot_id`: Chatbot using this connection
- `status`: pending, qr_ready, connecting, connected, disconnected, failed
- `qr_code`: Base64 QR code image (temporary)
- `phone_number`: Connected WhatsApp number

### `whatsapp_web_messages`

Stores all WhatsApp messages:
- `session_id`: Reference to session
- `message_id`: WhatsApp message ID
- `from_number`: Sender phone number
- `to_number`: Recipient phone number
- `direction`: inbound or outbound
- `content`: Message text
- `timestamp`: When message was sent

## Deployment

### Option 1: Railway

1. Install Railway CLI:
   ```bash
   npm install -g @railway/cli
   ```

2. Login and deploy:
   ```bash
   railway login
   railway init
   railway up
   ```

3. Add environment variables in Railway dashboard

4. Your service will be available at: `https://your-app.railway.app`

### Option 2: Render

1. Create a new Web Service on Render
2. Connect your Git repository
3. Build Command: `cd whatsapp-web-service && npm install`
4. Start Command: `cd whatsapp-web-service && npm start`
5. Add environment variables in Render dashboard

### Option 3: VPS (Ubuntu)

1. Install Node.js:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

2. Install PM2:
   ```bash
   sudo npm install -g pm2
   ```

3. Clone and setup:
   ```bash
   git clone your-repo
   cd whatsapp-web-service
   npm install
   ```

4. Create `.env` file with your values

5. Start with PM2:
   ```bash
   pm2 start index.js --name whatsapp-service
   pm2 save
   pm2 startup
   ```

6. Setup nginx reverse proxy (optional but recommended)

## Troubleshooting

### QR Code Not Appearing

- Check if service is running: `curl http://localhost:3001/api/health`
- Check service logs for errors
- Ensure database migration ran successfully
- Check Supabase credentials in `.env`

### QR Code Expires Immediately

- This is normal - WhatsApp QR codes expire after 60 seconds
- Close and reopen the connection modal to generate a new QR code

### Session Not Connecting After Scan

- Check service logs for authentication errors
- Ensure your phone has internet connection
- Try disconnecting and reconnecting
- Clear `.wwebjs_auth` folder and try again

### Messages Not Being Received

- Check if session status is "connected" in database
- Check service logs for errors
- Ensure `avatar-chat` edge function is deployed
- Check if chatbot is properly configured

### Service Crashes or Restarts

- Check logs for memory issues
- Puppeteer (used by whatsapp-web.js) can be memory-intensive
- Consider increasing memory limit if deploying to cloud
- Use PM2 or similar process manager for auto-restart

## Testing

Test the service is working:

```bash
# Health check
curl http://localhost:3001/api/health

# Create a session
curl -X POST http://localhost:3001/api/sessions/create \
  -H "Content-Type: application/json" \
  -d '{"userId":"your-user-id","chatbotId":"your-chatbot-id"}'
```

## Limitations

- **Unofficial API**: Violates WhatsApp ToS, risk of ban
- **Resource Intensive**: Each session runs a Chrome instance
- **Session Management**: Sessions can disconnect unexpectedly
- **Scale Limitations**: Not designed for thousands of concurrent sessions
- **No Media Support**: Currently only supports text messages
- **Rate Limits**: WhatsApp may rate limit or flag accounts

## Security Considerations

- Service uses Supabase Service Role Key (keep it secret!)
- QR codes are temporary and stored briefly in database
- Session data is stored in database (consider encryption)
- Use HTTPS in production
- Implement rate limiting for API endpoints
- Add authentication to API endpoints (currently open)

## Future Improvements

- [ ] Support for media messages (images, videos, documents)
- [ ] Better session management and recovery
- [ ] Webhook support for real-time message delivery
- [ ] Admin dashboard for monitoring sessions
- [ ] Multi-device support
- [ ] Message templates
- [ ] Analytics and reporting
- [ ] Encryption for session data
- [ ] Rate limiting and DDoS protection
- [ ] Horizontal scaling support

## License

This is provided as-is for educational purposes. Use at your own risk.
