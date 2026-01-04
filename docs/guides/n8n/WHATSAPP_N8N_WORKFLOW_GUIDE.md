# 📱 WhatsApp n8n Workflow Guide

## 🎯 What Changed From Your Original Workflow

### Original Calendly Workflow
- ❌ Chat Trigger (n8n's built-in chat UI)
- ❌ Audio transcription nodes
- ❌ Postgres Chat Memory
- ❌ Complex media handling
- ✅ AI Agent with Calendly tools

### New WhatsApp Workflow
- ✅ **Webhook node** - receives POST from WhatsApp service
- ✅ **Data extraction** - processes chatbot config, products, KB, history
- ✅ **AI Agent** - uses your chatbot's system prompt
- ✅ **Respond to Webhook** - sends reply back to WhatsApp
- ❌ Removed: Audio, Postgres memory (history comes from webhook)

---

## 📦 Two Templates Available

### 1. **WhatsApp Chatbot - Simplified.json**
**Best for:** Basic chatbots without special tools

**Flow:**
```
Webhook → Prepare Context → Call AI → Format Response → Respond
```

**Features:**
- Simple and easy to understand
- Uses chatbot system prompt
- Includes products, knowledge base, conversation history
- Direct OpenAI API call
- Perfect for general Q&A chatbots

### 2. **WhatsApp Chatbot - AI Agent.json** ⭐ RECOMMENDED
**Best for:** Advanced chatbots with tools (like your Calendly setup)

**Flow:**
```
Webhook → Extract Data → Configuration → AI Agent → Format → Respond
```

**Features:**
- Uses n8n AI Agent (like your original workflow)
- Can add custom tools (HTTP Request, Code, APIs, etc.)
- Supports complex workflows
- Better for appointment booking, CRM integration, etc.
- Maintains the AI Agent pattern you're already using

---

## 🚀 Setup Instructions

### Step 1: Choose Your Template

**If you need tools** (Calendly, APIs, custom logic):
- Use: `WhatsApp Chatbot - AI Agent.json`

**If you just need basic chat**:
- Use: `WhatsApp Chatbot - Simplified.json`

### Step 2: Import to n8n

1. **Go to your n8n cloud** (creatiqai.app.n8n.cloud)
2. Click **"Workflows"** in sidebar
3. Click **"Import from File"**
4. Select the JSON file
5. Click **"Import"**

### Step 3: Configure Credentials

#### For Both Templates:

1. **Click on "OpenAI Chat Model" node**
2. **Add OpenAI Credentials**:
   - Click "Credential for OpenAI"
   - Click "Create New Credential"
   - Enter your OpenAI API Key
   - Click "Save"

### Step 4: Get Webhook URL

1. **Click on "Webhook - WhatsApp Message" node**
2. **Copy the Production URL**
   - Example: `https://creatiqai.app.n8n.cloud/webhook/3a11dd83-7723-4b98-a362-c50094cfc0f3`
   - This is your unique webhook URL for this chatbot

### Step 5: Activate Workflow

1. **Click "Active" toggle** in top right
2. Toggle should turn **green/blue**
3. Your workflow is now live!

### Step 6: Configure in AvatarLab

1. **Go to chatbot Settings** in your platform
2. **Scroll to "n8n Integration" section**
3. **Paste your webhook URL**
4. **Click "Save Configuration"**
5. **Click "Test Webhook"** to verify connection

---

## 🔧 How It Works

### When WhatsApp Message Arrives:

```
📱 WhatsApp User sends: "What products do you have?"
    ↓
🔧 WhatsApp Service (index.js) receives message
    ↓
📊 Fetches from database:
    - Chatbot configuration (system prompt, business context)
    - All products
    - All knowledge base articles
    - Last 10 conversation messages
    ↓
🌐 Calls your n8n webhook with full context:
    {
      "message": "What products do you have?",
      "from_number": "60165334085@s.whatsapp.net",
      "chatbot": { /* full config */ },
      "products": [ /* all products */ ],
      "knowledge_base": [ /* all KB */ ],
      "conversation_history": [ /* last 10 messages */ ]
    }
    ↓
⚙️ n8n Workflow processes:
    1. Webhook receives data
    2. Extract & format context
    3. AI Agent generates response using:
       - System prompt
       - Business context
       - Products
       - Knowledge base
       - Conversation history
    4. Format as { "reply": "..." }
    5. Respond to webhook
    ↓
🔧 WhatsApp Service receives reply
    ↓
📱 WhatsApp Service sends to user
    ↓
✅ User receives AI-generated reply on WhatsApp
```

---

## 🎨 Customizing Your Workflow

### Adding Custom Tools to AI Agent

If you're using the **AI Agent template**, you can add tools like in your Calendly workflow:

#### Example: Add Product Search Tool

1. **Add "Code" node**
2. **Connect to AI Agent** (ai_tool connection)
3. **Configure**:

```javascript
// In Code node - Tool Description:
"Search for products by name or keyword. Returns matching products with prices and stock."

// In Code node - JavaScript:
const products = $('Extract WhatsApp Data').first().json.products;
const searchQuery = $fromAI('search_query', 'Product name or keyword to search', 'string');

const matches = products.filter(p =>
  p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
  (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()))
);

return matches.slice(0, 5); // Return top 5 matches
```

#### Example: Add Knowledge Base Search Tool

```javascript
// Tool Description:
"Search knowledge base articles by topic or keyword. Returns relevant articles."

// JavaScript:
const kb = $('Extract WhatsApp Data').first().json.knowledgeBase;
const searchQuery = $fromAI('topic', 'Topic or keyword to search', 'string');

const matches = kb.filter(k =>
  k.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
  k.content.toLowerCase().includes(searchQuery.toLowerCase())
);

return matches;
```

#### Example: Add API Call Tool (Order Status)

1. **Add "HTTP Request" node (Tool type)**
2. **Connect to AI Agent**
3. **Configure**:
   - URL: `https://your-api.com/orders`
   - Method: POST
   - Body:
     ```json
     {
       "phone": "{{ $fromAI('customer_phone', 'Customer phone number', 'string') }}"
     }
     ```

### Modifying System Prompt

The workflow automatically uses your chatbot's system prompt from the database. You can enhance it by editing the AI Agent node:

1. Click **"AI Agent" node**
2. Go to **"Options"** → **"System Message"**
3. The current template includes:
   - Current date/time
   - Your system prompt
   - Business context
   - Products
   - Knowledge base
   - Compliance rules
   - Response guidelines
   - Conversation history

You can add custom instructions here.

---

## 🧪 Testing Your Workflow

### Test 1: n8n Test Button

1. **In n8n, click "Test Workflow"**
2. **Click on Webhook node**
3. **Click "Execute Node"**
4. **Send test data**:
```json
{
  "message": "Hello, what products do you have?",
  "from_number": "test@test.com",
  "chatbot": {
    "id": "test-id",
    "name": "Test Bot",
    "system_prompt": "You are a helpful assistant",
    "business_context": "We sell electronics",
    "company_name": "Test Company"
  },
  "products": [
    {
      "name": "iPhone 15",
      "price": 999,
      "description": "Latest iPhone",
      "stock": 50
    }
  ],
  "knowledge_base": [],
  "conversation_history": []
}
```

5. **Check execution**:
   - All nodes should turn green
   - Last node shows `{ "reply": "..." }`

### Test 2: Platform Test Webhook

1. **Go to chatbot Settings** in AvatarLab
2. **n8n Integration section**
3. **Click "Test Webhook"**
4. **Check n8n Executions** tab
5. **Should see test execution**

### Test 3: Real WhatsApp Message

1. **Send WhatsApp message** to your connected number
2. **Watch WhatsApp service logs**:
```
Calling n8n webhook for chatbot...
n8n response received: <AI reply>
Sent reply to 60165334085@s.whatsapp.net
```
3. **Check n8n Executions** - should see real execution
4. **User receives reply** on WhatsApp

---

## 📊 Data Structure Reference

### Incoming Webhook Data

```javascript
{
  // User message
  "message": "What are your business hours?",
  "from_number": "60165334085@s.whatsapp.net",

  // Chatbot configuration
  "chatbot": {
    "id": "dfaf5a3e-1033-4e0f-bf4c-65217d68bfb3",
    "name": "Wendy",
    "company_name": "ABC Electronics",
    "industry": "ecommerce",
    "system_prompt": "You are Wendy, a helpful sales assistant...",
    "business_context": "We sell consumer electronics in Malaysia...",
    "compliance_rules": ["Never promise delivery dates", "..."],
    "response_guidelines": ["Be friendly and professional", "..."]
  },

  // Products (from database)
  "products": [
    {
      "id": "prod-123",
      "name": "iPhone 15 Pro",
      "price": 4999,
      "description": "Latest iPhone with A17 chip",
      "stock": 25,
      "image_url": "https://...",
      "sku": "APPL-IPH15PRO"
    }
  ],

  // Knowledge base (from database)
  "knowledge_base": [
    {
      "id": "kb-456",
      "title": "Shipping Policy",
      "content": "We ship within 24 hours of confirmed payment..."
    }
  ],

  // Conversation history (last 10 messages)
  "conversation_history": [
    {
      "direction": "inbound",
      "content": "Hi",
      "timestamp": "2026-01-04T06:30:00Z"
    },
    {
      "direction": "outbound",
      "content": "Hello! How can I help you today?",
      "timestamp": "2026-01-04T06:30:02Z"
    }
  ]
}
```

### Expected Response

```javascript
{
  "reply": "Our business hours are 9:00 AM to 6:00 PM, Monday to Friday (Malaysia time). We're closed on weekends and public holidays. Is there anything specific you'd like to know?"
}
```

---

## 🔍 Troubleshooting

### Workflow Not Executing

**Check:**
1. Workflow is Active (green toggle)
2. Webhook URL is correct in platform
3. n8n is reachable (test manually with curl)

**Debug:**
```bash
# Test webhook manually
curl -X POST https://creatiqai.app.n8n.cloud/webhook/YOUR-WEBHOOK-ID \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Test",
    "from_number": "test",
    "chatbot": {"name": "Test"},
    "products": [],
    "knowledge_base": [],
    "conversation_history": []
  }'
```

### No Reply Received

**Check n8n Executions:**
1. Go to n8n → Executions
2. Find latest execution
3. Look for errors in nodes

**Common issues:**
- OpenAI credentials not set
- AI response field extraction failed
- Webhook response not formatted correctly

**Fix:**
1. Check "Format for WhatsApp" node
2. Verify it outputs `{ "reply": "..." }`

### AI Response is Generic

**Cause:** System prompt or context not being used

**Fix:**
1. Check "Extract WhatsApp Data" node executed successfully
2. Verify "AI Agent" node receives system prompt
3. Check AI Agent's System Message includes `={{ $json.systemPrompt }}`

---

## 💡 Pro Tips

### 1. Use Different Workflows for Different Chatbots

Each chatbot can have its own n8n workflow:
- **Chatbot A** (E-commerce) → Webhook URL 1 → Product-focused workflow
- **Chatbot B** (Support) → Webhook URL 2 → Ticket-focused workflow
- **Chatbot C** (Booking) → Webhook URL 3 → Calendly workflow

### 2. Add Error Handling

Add an "Error Trigger" node to catch failures:
1. Add "Error Trigger" node
2. Connect to "Send Email" or "Webhook" to notify you
3. Add fallback response

### 3. Log Important Data

Add "Code" nodes to log to external services:
```javascript
// Log to external analytics
await fetch('https://your-analytics.com/log', {
  method: 'POST',
  body: JSON.stringify({
    chatbot_id: $json.chatbot.id,
    message: $json.message,
    timestamp: new Date().toISOString()
  })
});

return $input.all();
```

### 4. Rate Limiting

Add delays if needed:
```javascript
// In Code node before AI call
await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
return $input.all();
```

---

## 🎉 You're All Set!

Your WhatsApp chatbot now has the power of n8n AI Agent workflows!

**What you can do now:**
- ✅ Each chatbot uses its own system prompt from database
- ✅ AI has access to all products and knowledge base
- ✅ Conversation history is maintained
- ✅ Can add custom tools (APIs, databases, CRMs, etc.)
- ✅ Multi-tenant SaaS architecture
- ✅ No code changes needed - configure via UI

**Next steps:**
1. Import one of the templates
2. Configure OpenAI credentials
3. Get webhook URL
4. Add to chatbot Settings
5. Test with WhatsApp message
6. Customize workflow as needed!

Happy automating! 🚀
