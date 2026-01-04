# 🤖 n8n Integration Guide for WhatsApp Chatbot

This guide shows you how to integrate n8n with your WhatsApp chatbot to use powerful AI agents and tools.

## 📦 What You Get

When a WhatsApp message arrives, n8n receives:
- **Message**: The user's text
- **From Number**: WhatsApp sender
- **Chatbot Config**: System prompts, business context, compliance rules
- **Products**: All product data for your chatbot
- **Knowledge Base**: All knowledge base articles
- **Conversation History**: Last 10 messages with this user

## 🚀 Quick Setup (3 Steps)

### Step 1: Install n8n

**Option A - Cloud (Recommended for SaaS)**
1. Go to https://n8n.io
2. Click "Get Started Free"
3. Create account
4. You'll get a URL like: `https://yourname.app.n8n.cloud`

**Option B - Self-Hosted**
```bash
npx n8n
```
Opens at: http://localhost:5678

### Step 2: Import or Create Workflow in n8n

**Option A - Import Ready-Made Template (Easiest!)**

1. **Import Workflow**
   - In n8n, click "Workflows" → "Import from File"
   - Select `n8n-workflow-template.json` from this project
   - Click "Import"

2. **Configure OpenAI Credentials**
   - Click on "OpenAI Chat" node
   - Add your OpenAI API credentials
   - Alternative: Replace with Anthropic Claude, Google Gemini, etc.

3. **Copy Webhook URL**
   - Click on "Webhook - WhatsApp Message" node
   - Copy the Production URL (e.g., `https://yourname.app.n8n.cloud/webhook/whatsapp-chatbot`)
   - You'll need this in Step 3!

4. **Activate Workflow**
   - Click "Active" toggle (top right)
   - Workflow is now live!

**Option B - Build From Scratch**

1. **Create New Workflow**
   - Click "+ Add workflow" in n8n

2. **Add Webhook Node**
   - Click "+" → Search "Webhook"
   - HTTP Method: `POST`
   - Path: `whatsapp-chatbot`
   - Copy the webhook URL
   - Example: `https://yourname.app.n8n.cloud/webhook/whatsapp-chatbot`

3. **Add AI Agent Node**
   - Click "+" after Webhook → Search "OpenAI Chat Model"
   - Configure:
     - Model: `gpt-4o-mini` or `gpt-4`
     - Add OpenAI credentials

4. **Add Context Processing** (See template for full code)
   - Add "Code" node to process products, knowledge base, conversation history
   - This formats all data for the AI

5. **Add Response Node**
   - Click "+" → Search "Respond to Webhook"
   - Body: `{{ { "reply": $json.reply } }}`

6. **Activate Workflow**
   - Click "Active" toggle (top right)

### Step 3: Configure in Platform UI

**No .env file needed! Everything is configured per-chatbot in the UI.**

1. **Run Database Migration** (First time only)
   - Open Supabase SQL Editor
   - Run `supabase/migrations/20260104000000_n8n_integration.sql`
   - This adds n8n support to database

2. **Configure n8n for Your Chatbot**
   - Go to your chatbot's Settings page
   - Scroll to "n8n Integration" section
   - Paste your n8n webhook URL
   - Click "Save Configuration"

3. **Test It!**
   - Click "Test Webhook" to verify connection
   - If successful, your chatbot is now using n8n for AI responses!

**Note**: Each chatbot can have its own n8n workflow URL. This is a multi-tenant SaaS architecture.

## ✅ Test It!

1. Send a WhatsApp message to your connected number
2. Watch n8n executions (n8n dashboard shows real-time logs)
3. You should receive an AI-generated reply!

## 🎨 Example n8n Workflows

### Basic AI Chatbot
```
Webhook → AI Agent (OpenAI) → Respond to Webhook
```

### Smart Product Chatbot
```
Webhook → AI Agent → Code Tool (Search Products) → Respond
```

### Advanced RAG Chatbot
```
Webhook → Vector Store Tool (Knowledge Base) → AI Agent → Respond
```

## 📊 Available Data in n8n

Access these in your workflow using `{{ $json.property }}`:

```javascript
{
  // Incoming message
  "message": "What products do you have?",
  "from_number": "60165334085@s.whatsapp.net",

  // Chatbot configuration
  "chatbot": {
    "id": "dfaf5a3e-1033-4e0f-bf4c-65217d68bfb3",
    "name": "Wendy",
    "company_name": "ABC Electronics",
    "industry": "Electronics Retail",
    "system_prompt": "You are Wendy, a helpful sales assistant...",
    "business_context": "We sell consumer electronics...",
    "compliance_rules": ["Never promise refunds...", "..."],
    "response_guidelines": ["Be friendly", "..."]
  },

  // Products
  "products": [
    {
      "id": "123",
      "name": "iPhone 15 Pro",
      "price": 999,
      "description": "Latest iPhone...",
      "stock": 50
    }
  ],

  // Knowledge base
  "knowledge_base": [
    {
      "id": "456",
      "title": "Shipping Policy",
      "content": "We ship within 24 hours..."
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
      "content": "Hello! How can I help?",
      "timestamp": "2026-01-04T06:30:02Z"
    }
  ]
}
```

## 🔧 Advanced: Multi-Agent Workflow

```
┌─────────────┐
│   Webhook   │
└──────┬──────┘
       │
   ┌───▼───┐
   │ Switch│ (Based on message intent)
   └───┬───┘
       │
   ┌───┴─────────────────┐
   │                     │
┌──▼───┐           ┌────▼────┐
│Product│           │Customer │
│ Agent │           │ Service │
│       │           │ Agent   │
└──┬───┘           └────┬────┘
   │                    │
   └────────┬───────────┘
            │
     ┌──────▼──────┐
     │   Respond   │
     └─────────────┘
```

## 🛠️ Tools You Can Use in n8n

1. **AI Agents**
   - OpenAI (GPT-4, GPT-3.5)
   - Anthropic Claude
   - Google Gemini
   - Mistral
   - Ollama (local)

2. **Vector Stores** (for RAG)
   - Pinecone
   - Qdrant
   - Weaviate
   - Supabase Vector

3. **Tools**
   - Code execution
   - HTTP requests
   - Database queries
   - Web scraping
   - Image generation
   - Text-to-speech

4. **Logic**
   - If/Switch nodes
   - Loops
   - Merge data
   - Set variables

## 🎯 Example Use Cases

### 1. Product Recommendation
```javascript
// In Code node
const products = $json.products;
const budget = extractBudget($json.message); // Your logic

return products.filter(p => p.price <= budget)
  .sort((a, b) => b.rating - a.rating)
  .slice(0, 3);
```

### 2. Order Status Check
```javascript
// In HTTP Request node
const response = await fetch('your-api/orders', {
  method: 'POST',
  body: JSON.stringify({
    phone: $json.from_number
  })
});

return response.json();
```

### 3. Smart FAQ with RAG
```
Webhook → Vector Store (Search KB) → AI Agent → Respond
```

## 📱 Response Format

**Your n8n workflow MUST return JSON with a `reply` field:**

```json
{
  "reply": "Your message here"
}
```

Alternative field names (automatically detected):
- `reply`
- `response`
- `message`

## 🔍 Debugging

1. **Check n8n executions**
   - n8n Dashboard → Executions tab
   - See all webhook calls and data

2. **Check WhatsApp service logs**
   ```bash
   # Service console shows:
   Calling n8n webhook for chatbot...
   n8n response received: <reply>
   ```

3. **Test webhook manually**
   ```bash
   curl -X POST https://your-n8n-url/webhook/whatsapp-chatbot \
     -H "Content-Type: application/json" \
     -d '{
       "message": "Hello",
       "from_number": "test",
       "chatbot": {"name": "Test"},
       "products": [],
       "knowledge_base": [],
       "conversation_history": []
     }'
   ```

## 💡 Tips

1. **Start Simple**: Begin with just AI Agent, add tools later
2. **Use Memory**: n8n AI Agent has built-in conversation memory
3. **Error Handling**: Add error nodes to handle failures
4. **Rate Limiting**: WhatsApp has rate limits, add delays if needed
5. **Logging**: Use n8n's sticky notes to document your workflow

## 🚨 Troubleshooting

**Problem**: No response from n8n
**Solution**:
- Check n8n workflow is Active (toggle in top right)
- Verify webhook URL is correct in chatbot settings
- Check n8n Executions tab for errors

**Problem**: "n8n not configured for this chatbot"
**Solution**:
- Go to chatbot Settings
- Configure n8n webhook URL in the "n8n Integration" section
- Click "Save Configuration"

**Problem**: Error in n8n execution
**Solution**:
- Check n8n Dashboard → Executions tab
- Look for error details in failed executions
- Verify OpenAI/AI credentials are configured

**Problem**: "Test webhook failed"
**Solution**:
- Ensure n8n workflow is Active
- Check webhook URL format (should be full URL with https://)
- Verify n8n is reachable from WhatsApp service

**Problem**: Messages not triggering n8n
**Solution**:
- Check WhatsApp service logs: `cd whatsapp-web-service && npm start`
- Verify chatbot has `n8n_enabled = true` in database
- Test webhook manually with curl (see Debugging section)

## 📚 Learn More

- n8n Docs: https://docs.n8n.io
- AI Agent: https://docs.n8n.io/integrations/builtin/cluster-nodes/root-nodes/n8n-nodes-langchain.agent/
- Webhook: https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/

---

## 🎉 You're All Set!

**Quick Start Checklist:**
1. ✅ Set up n8n (cloud or self-hosted)
2. ✅ Import `n8n-workflow-template.json` workflow
3. ✅ Configure AI credentials in n8n
4. ✅ Run database migration in Supabase
5. ✅ Add webhook URL in chatbot Settings UI
6. ✅ Send a WhatsApp message to test!

Each chatbot can have its own n8n workflow for complete customization. Happy automating! 🚀
