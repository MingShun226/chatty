# n8n E-commerce Chatbot Workflow Setup Guide

This guide explains how to set up an n8n workflow for e-commerce chatbots in AvatarLab. Each user gets their own workflow instance configured by the admin.

## Overview

The workflow handles:
- Receiving WhatsApp messages via webhook
- Fetching chatbot configuration and API keys
- AI-powered responses with product search, promotions, and knowledge base
- Sending responses back to WhatsApp

## Prerequisites

1. **n8n Instance**: Self-hosted or cloud n8n installation
2. **OpenAI API Key**: For AI responses (assigned via admin panel)
3. **AvatarLab Platform API Key**: Auto-generated when chatbot is created
4. **WhatsApp Integration**: User's phone connected via WhatsApp Web

## Workflow Structure

```
┌─────────────────────────────────────────────────────────────────────┐
│                        n8n E-commerce Workflow                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  [Webhook] ──► [Get Config] ──► [AI Agent] ──► [Format Response]    │
│      │              │               │                 │              │
│      │              ▼               ▼                 ▼              │
│      │         ┌─────────┐    ┌──────────┐    ┌─────────────┐       │
│      │         │ API Keys │    │  Tools:  │    │ Send to     │       │
│      │         │ Settings │    │ - Catalog│    │ WhatsApp    │       │
│      │         └─────────┘    │ - Promos │    └─────────────┘       │
│      │                        │ - Knowledge│                         │
│      │                        └──────────┘                          │
│      │                                                               │
└──────┴───────────────────────────────────────────────────────────────┘
```

## Setup Steps

### Step 1: Create Webhook Node

1. Add a **Webhook** node
2. Set HTTP Method: `POST`
3. Set Path: Unique path for this user (e.g., `/whatsapp-user123`)
4. Copy the webhook URL for the admin panel

**Expected Payload:**
```json
{
  "chatbot_id": "uuid",
  "phone_number": "+60123456789",
  "message": "User's message text",
  "message_type": "text|image|audio|document",
  "media_url": "optional URL for media",
  "contact_name": "John Doe"
}
```

### Step 2: Get Chatbot Configuration

Add an **HTTP Request** node after the webhook:

- **Method**: GET
- **URL**: `https://xatrtqdgghanwdujyhkq.supabase.co/functions/v1/get-chatbot-config`
- **Query Parameters**:
  - `chatbot_id`: `{{ $json.chatbot_id }}`
- **Headers**:
  - `Authorization`: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (Supabase anon key)
  - `x-api-key`: `pk_live_xxxxx` (Platform API key from admin panel)

**Response includes:**
- `chatbot.system_prompt` - AI system prompt
- `chatbot.hidden_rules` - Additional instructions
- `api_keys.openai` - OpenAI API key for this user
- `content.products_count` - Number of products
- `content.promotions_count` - Number of promotions
- `whatsapp_settings` - Message formatting settings

### Step 3: Set Up AI Agent

Add an **AI Agent** node with the following configuration:

**System Message:**
```
{{ $('Get Config').item.json.chatbot.system_prompt }}

{{ $('Get Config').item.json.chatbot.hidden_rules }}
```

**Tools to Add:**

#### Tool 1: Browse Catalog (Recommended)
- **Name**: `browse_catalog`
- **Description**: Get the complete product catalog grouped by category. Use this when customer asks about products, prices, or availability.
- **HTTP Request**:
  - Method: GET
  - URL: `https://xatrtqdgghanwdujyhkq.supabase.co/functions/v1/chatbot-data`
  - Query: `type=catalog&chatbot_id={{ $('Webhook').item.json.chatbot_id }}`
  - Headers: Same as Step 2

#### Tool 2: Get Promotions
- **Name**: `get_promotions`
- **Description**: Get all active promotions and discounts. Use when customer asks about sales, discounts, or promo codes.
- **HTTP Request**:
  - Method: GET
  - URL: `https://xatrtqdgghanwdujyhkq.supabase.co/functions/v1/chatbot-data`
  - Query: `type=promotions&chatbot_id={{ $('Webhook').item.json.chatbot_id }}`

#### Tool 3: Validate Promo Code
- **Name**: `validate_promo`
- **Description**: Check if a promo code is valid. Use when customer provides a promo code.
- **HTTP Request**:
  - Method: GET
  - URL: `https://xatrtqdgghanwdujyhkq.supabase.co/functions/v1/chatbot-data`
  - Query: `type=validate_promo&chatbot_id={{ $('Webhook').item.json.chatbot_id }}&promo_code={{ $parameter.promo_code }}`

#### Tool 4: Search Knowledge Base
- **Name**: `search_knowledge`
- **Description**: Search through uploaded documents (PDFs, policies, FAQs). Use for detailed product info, policies, or procedures.
- **HTTP Request**:
  - Method: GET
  - URL: `https://xatrtqdgghanwdujyhkq.supabase.co/functions/v1/chatbot-data`
  - Query: `type=knowledge&chatbot_id={{ $('Webhook').item.json.chatbot_id }}`

### Step 4: Format Response

Add a **Code** node to format the AI response for WhatsApp:

```javascript
const response = $input.first().json.output;
const settings = $('Get Config').first().json.whatsapp_settings;
const delimiter = settings?.message_delimiter || '---';

// Split long messages if needed
const maxLength = 4000;
let messages = [];

if (response.length > maxLength) {
  // Split by delimiter or sentences
  const parts = response.split(delimiter);
  let currentMessage = '';

  for (const part of parts) {
    if ((currentMessage + part).length > maxLength) {
      if (currentMessage) messages.push(currentMessage.trim());
      currentMessage = part;
    } else {
      currentMessage += (currentMessage ? delimiter : '') + part;
    }
  }
  if (currentMessage) messages.push(currentMessage.trim());
} else {
  messages = [response];
}

return messages.map(msg => ({
  json: {
    phone_number: $('Webhook').first().json.phone_number,
    message: msg,
    chatbot_id: $('Webhook').first().json.chatbot_id
  }
}));
```

### Step 5: Send to WhatsApp

Add an **HTTP Request** node to send the response:

- **Method**: POST
- **URL**: Your WhatsApp sending endpoint
- **Body**: `{{ $json }}`

## Configuration Variables

Create these as n8n credentials or workflow variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `PLATFORM_API_KEY` | User's platform API key | `pk_live_abc123...` |
| `SUPABASE_ANON_KEY` | Supabase anonymous key | `eyJhbGciOi...` |
| `CHATBOT_ID` | User's chatbot UUID | `550e8400-e29b...` |
| `OPENAI_API_KEY` | From get-chatbot-config response | Dynamic |

## Admin Panel Integration

After creating the workflow:

1. Go to **Admin > Users > [User] > Chatbot Setup**
2. Enter the **Webhook URL** from Step 1
3. Select **Workflow Type**: E-commerce
4. Change **Activation Status** to `Active`
5. Save changes

The user's dashboard will now show "Active & Running" status.

## Testing

1. Send a test message to the user's WhatsApp
2. Check n8n execution logs
3. Verify response is received

## Common Issues

### "No OpenAI API key found"
- Ensure admin has assigned an OpenAI API key in User Details > API Keys

### "Invalid API key"
- Check the platform API key is correct and active
- Verify it has the required scopes (chat, products, promotions, knowledge)

### "Chatbot not activated"
- Change activation status to "Active" in admin panel

## Sample Workflow JSON

A complete workflow template can be imported directly into n8n:

1. Download the template from the AvatarLab dashboard (API Keys > Documentation > Download Template)
2. In n8n, go to **Workflows > Import from File**
3. Update credentials and chatbot-specific values

## Support

For issues with workflow setup, contact AvatarLab support or check the documentation at:
- API Reference: `/api-keys` page in dashboard
- Edge Functions: Supabase dashboard
