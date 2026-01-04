# Function Calling Architecture - Intelligent Database Access

## Overview

The business chatbot system now uses **OpenAI Function Calling** (also called Tool Use) to give the AI Agent intelligent access to your database. Instead of relying on keyword detection, the AI understands user intent and queries the database directly when needed.

---

## How It Works

### Traditional Approach (OLD - Keyword-based)
```
User: "show me iphone image"
↓
System checks for keywords: "price", "buy", "product"
↓
No keywords found → No product data loaded
↓
Chatbot: "Sorry, I can't show images"
```

**Problems:**
- ❌ Relies on specific keywords
- ❌ Misses natural language variations
- ❌ Cannot handle complex queries
- ❌ Loads all products upfront (slow & wasteful)

### New Approach (NEW - Intent-based Function Calling)
```
User: "show me iphone image"
↓
AI understands intent: User wants to see iPhone product image
↓
AI calls: search_products("iphone")
↓
Database returns: iPhone products with image URLs
↓
Chatbot: "Boss看这个图片: [URL] || iPhone 15 Pro Max || RM4,299 || 还有stock咯"
```

**Benefits:**
- ✅ Understands natural language & intent
- ✅ Works with ANY phrasing (e.g., "let me see phones", "got iphone14 ah?", "show me the product")
- ✅ Fetches data on-demand (faster & efficient)
- ✅ Always has latest product data
- ✅ Can show images for any product request

---

## Available Database Tools

The AI Agent has access to these database query functions:

### 1. `search_products(query, limit?)`
**Purpose:** Search for products by name, category, SKU, or description

**When AI Uses This:**
- Customer asks about specific products: "got iphone15 ah?", "show me shoes"
- Customer wants to see images: "let me see the picture", "show me product image"
- Customer browses: "what phones you have?", "any new arrivals?"
- Customer checks prices: "how much for macbook?", "price for this?"

**Parameters:**
- `query` (string): Search term - can be product name, category, SKU, keyword
- `limit` (number, optional): Max results to return (default: 10)

**Returns:**
```json
{
  "success": true,
  "products": [
    {
      "id": "uuid",
      "product_name": "iPhone 15 Pro Max",
      "sku": "IPH15PM-256-TIT",
      "price": 4299.00,
      "category": "Smartphones",
      "description": "Latest flagship...",
      "image_url": "https://storage.supabase.co/...",
      "in_stock": true,
      "stock_quantity": 15
    }
  ],
  "count": 1
}
```

**Example Usage:**
```
User: "Boss got iphone15 pro max or not?"
AI thinks: User wants to find iPhone 15 Pro Max
AI calls: search_products("iphone 15 pro max")
AI receives: Product data with image URL
AI responds: "有的boss || 看这个 iPhone 15 Pro Max || RM4,299 || 图片: [URL] || 还剩15个咯 || 要订吗？"
```

---

### 2. `get_product_by_id(product_id)`
**Purpose:** Get detailed information about a specific product

**When AI Uses This:**
- Follow-up questions about a specific product shown earlier
- Customer references a product ID or SKU directly
- Need to refresh product details (price, stock updates)

**Parameters:**
- `product_id` (string): The unique product ID (UUID)

**Returns:**
```json
{
  "success": true,
  "product": {
    "id": "uuid",
    "product_name": "...",
    "sku": "...",
    "price": 0.00,
    "category": "...",
    "description": "...",
    "image_url": "...",
    "in_stock": true,
    "stock_quantity": 0
  }
}
```

---

### 3. `list_product_categories()`
**Purpose:** Get all available product categories

**When AI Uses This:**
- Customer asks "what categories you have?"
- Customer wants to browse: "what type of products you sell?"
- Helping customer explore options

**Parameters:** None

**Returns:**
```json
{
  "success": true,
  "categories": ["Smartphones", "Laptops", "Accessories", "Cameras"],
  "count": 4
}
```

---

### 4. `get_products_by_category(category, limit?)`
**Purpose:** Get all products in a specific category

**When AI Uses This:**
- Customer asks about category: "show me all phones", "what laptops you got?"
- After showing categories, customer picks one
- Customer browsing specific product type

**Parameters:**
- `category` (string): Category name
- `limit` (number, optional): Max results (default: 20)

**Returns:**
```json
{
  "success": true,
  "products": [...],
  "count": 12
}
```

---

## Technical Implementation

### Edge Function: `avatar-chat/index.ts`

#### 1. Tools Definition
```typescript
const tools = [
  {
    type: 'function',
    function: {
      name: 'search_products',
      description: 'Search for products by name, category, SKU, or description. Returns matching products with all details including images.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query - can be product name, category, SKU, or any keyword'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of products to return (default: 10)',
            default: 10
          }
        },
        required: ['query']
      }
    }
  },
  // ... other tools
]
```

#### 2. Initial AI Call with Tools
```typescript
let openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${openaiApiKey}`
  },
  body: JSON.stringify({
    model: avatar.fine_tuned_model_id || model,
    messages,
    tools,  // ← Tools available to AI
    tool_choice: 'auto',  // ← AI decides when to use tools
    max_tokens: 2000,
    temperature: 0.7
  })
})
```

#### 3. Function Execution Loop
```typescript
// Handle function calls
while (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
  // Add assistant message with tool calls to conversation
  messages.push(assistantMessage)

  // Execute each tool call
  for (const toolCall of assistantMessage.tool_calls) {
    const functionName = toolCall.function.name
    const functionArgs = JSON.parse(toolCall.function.arguments)

    let functionResult: any = {}

    // Execute the appropriate function
    if (functionName === 'search_products') {
      const { query, limit = 10 } = functionArgs
      const { data: products } = await supabase
        .from('chatbot_products')
        .select('*')
        .eq('chatbot_id', avatar_id)
        .or(`product_name.ilike.%${query}%,category.ilike.%${query}%,sku.ilike.%${query}%,description.ilike.%${query}%`)
        .order('created_at', { ascending: false })
        .limit(limit)

      functionResult = {
        success: true,
        products: products || [],
        count: products?.length || 0
      }
    }
    // ... execute other functions

    // Add function result to messages
    messages.push({
      role: 'tool',
      tool_call_id: toolCall.id,
      content: JSON.stringify(functionResult)
    })
  }

  // Call OpenAI again with function results
  openaiResponse = await fetch(...)
  assistantMessage = openaiData.choices[0].message
}

// Final response after all tool calls
const finalResponse = assistantMessage.content
```

---

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ User Message: "Boss show me iPhone 15 image lah"           │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ Avatar-Chat Edge Function                                   │
│                                                             │
│ 1. Load system prompt from active version                  │
│ 2. Add RAG knowledge base chunks (if relevant)             │
│ 3. Add memories (if any)                                   │
│ 4. Define available tools (search_products, etc.)          │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ OpenAI API Call #1                                          │
│                                                             │
│ Request:                                                    │
│ - model: gpt-4o / gpt-4o-mini                              │
│ - messages: [system, ...history, user]                     │
│ - tools: [search_products, get_product_by_id, ...]        │
│ - tool_choice: auto                                        │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ AI Decision: Need to search for iPhone 15                  │
│                                                             │
│ Response:                                                   │
│ {                                                           │
│   "tool_calls": [{                                          │
│     "function": {                                           │
│       "name": "search_products",                            │
│       "arguments": "{\"query\":\"iPhone 15\",\"limit\":5}" │
│     }                                                       │
│   }]                                                        │
│ }                                                           │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ Execute Function: search_products("iPhone 15", 5)          │
│                                                             │
│ Supabase Query:                                             │
│ SELECT * FROM chatbot_products                              │
│ WHERE chatbot_id = '...'                                    │
│ AND (product_name ILIKE '%iPhone 15%' OR ...)              │
│ LIMIT 5                                                     │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ Function Result:                                            │
│ {                                                           │
│   "success": true,                                          │
│   "products": [                                             │
│     {                                                       │
│       "product_name": "iPhone 15 Pro Max",                 │
│       "price": 4299.00,                                    │
│       "image_url": "https://storage.supabase.co/...",     │
│       "in_stock": true,                                    │
│       "stock_quantity": 15                                 │
│     }                                                       │
│   ],                                                        │
│   "count": 1                                                │
│ }                                                           │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ OpenAI API Call #2                                          │
│                                                             │
│ Request:                                                    │
│ - messages: [system, ...history, user,                     │
│              assistant_tool_call, tool_result]             │
│ - tools: [same tools]                                      │
│ - tool_choice: auto                                        │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ AI Final Response (with product data):                     │
│                                                             │
│ "有的boss || 看这个 iPhone 15 Pro Max ||                   │
│  RM4,299 || 图片: https://storage.supabase.co/... ||       │
│  还剩15个咯 || 这个很hot selling || 要订吗？"              │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ Return to User (WhatsApp / Test Chat)                      │
└─────────────────────────────────────────────────────────────┘
```

---

## System Prompt Guidelines

### What to Include

The system prompt should guide the AI on:

1. **When to use tools** - Not explicit keywords, but natural understanding
2. **How to present tool results** - Show image URLs, format prices, use Malaysian style
3. **Natural shop owner behavior** - Say "let me check" instead of "I'm calling search_products()"

### Example System Prompt Section

```
**ACCESSING PRODUCT INFORMATION:**

You have access to the product database. When customers ask about products, want to see images, check prices, or browse items, you can search the database naturally.

**How to use your tools naturally:**
- Customer: "got iPhone or not?" → Search products for "iPhone"
- Customer: "show me the picture" → Search for the product they're asking about
- Customer: "what phones you have?" → List product categories or search "phones"
- Customer: "how much?" → Search for the product to get current price

**When showing products:**
- ALWAYS include the image URL if available
- Show price in RM format: "RM4,299"
- Mention stock status naturally: "还有15个咯" or "stock不多了哦"
- Use persuasive Malaysian style: "这个很hot selling || 很多人买"

**Act like a shop owner:**
- Don't say: "I searched the database and found..."
- Instead say: "有的boss || 我check下给你 || 找到了..."
- Don't reveal you're using tools - act like you're checking your inventory
```

---

## Benefits of Function Calling

### 1. **Intelligence > Keywords**
- Understands "show me the phone" = product inquiry
- Understands "let me see that" = wants to view product
- Understands "how much?" = asking for price (context-aware)

### 2. **Always Up-to-Date**
- No stale data in system prompt
- Fetches latest prices, stock, products in real-time
- New products immediately available

### 3. **Efficient & Fast**
- Only loads data when needed
- Doesn't bloat system prompt with all products
- Reduces token usage and costs

### 4. **Scalable**
- Works with 10 products or 10,000 products
- No prompt size limitations
- Easy to add new tools (e.g., check_order_status, get_shipping_info)

### 5. **Natural Interaction**
- AI decides when to fetch data based on conversation context
- Can handle complex multi-turn conversations
- Remembers previous tool results in conversation

---

## Testing

### Test Chat Interface

The [BusinessChatbotTest.tsx](src/components/business-chatbot/BusinessChatbotTest.tsx) component uses the same avatar-chat API endpoint as WhatsApp/n8n, ensuring identical behavior.

**Test Scenarios:**

1. **Product Search:**
   ```
   User: "Boss show me iphone lah"
   Expected: AI calls search_products("iphone"), shows results with images
   ```

2. **Image Requests:**
   ```
   User: "can i see the picture?"
   Expected: AI calls search_products based on context, shows image URL
   ```

3. **Category Browsing:**
   ```
   User: "what phones you got?"
   Expected: AI calls get_products_by_category("Smartphones") or search_products("phones")
   ```

4. **Price Inquiry:**
   ```
   User: "how much for macbook?"
   Expected: AI calls search_products("macbook"), shows price
   ```

5. **Natural Variations:**
   ```
   User: "got any red shoes?"
   User: "let me see your laptop selection"
   User: "show me what's on sale"
   Expected: AI intelligently calls appropriate tools
   ```

---

## n8n WhatsApp Integration

The function calling works seamlessly with n8n:

1. **n8n sends message** to `/avatar-chat` endpoint
2. **Edge function** processes with function calling
3. **AI makes tool calls** as needed
4. **Returns final response** with product data
5. **n8n sends** response back to WhatsApp

No changes needed in n8n workflow - it's transparent!

---

## Future Enhancements

Potential additional tools to implement:

- `check_order_status(order_id)` - Check customer's order
- `get_shipping_info(tracking_number)` - Get shipping updates
- `search_knowledge_base(query)` - Enhanced RAG search
- `get_promotions()` - Current promotions and deals
- `check_stock_availability(sku)` - Real-time stock check
- `calculate_bundle_price(product_ids)` - Bundle pricing
- `get_customer_history(customer_id)` - Past purchases (for personalization)

---

## Key Files

### Backend
- **[supabase/functions/avatar-chat/index.ts](supabase/functions/avatar-chat/index.ts)** - Main chat API with function calling logic

### Frontend Services
- **[src/services/businessPromptService.ts](src/services/businessPromptService.ts)** - AI prompt generation (updated for function calling)
- **[src/services/promptAgentService.ts](src/services/promptAgentService.ts)** - Prompt editing agent (updated for function calling)

### UI Components
- **[src/components/business-chatbot/BusinessChatbotTest.tsx](src/components/business-chatbot/BusinessChatbotTest.tsx)** - Test chat interface
- **[src/components/business-chatbot/AIPromptGenerator.tsx](src/components/business-chatbot/AIPromptGenerator.tsx)** - AI prompt generator UI

### Documentation
- **[BUSINESS_CHATBOT_SYSTEM_PROMPT.md](BUSINESS_CHATBOT_SYSTEM_PROMPT.md)** - Overall system architecture
- **[PROMPT_AGENT_GUIDE.md](PROMPT_AGENT_GUIDE.md)** - Prompt agent user guide

---

## Summary

The function calling architecture transforms the chatbot from a **keyword-based system** into an **intelligent agent** that:

✅ Understands natural language and user intent
✅ Queries database on-demand for real-time data
✅ Shows product images when customers ask
✅ Handles complex, multi-turn conversations
✅ Works in any language (English, 中文, Bahasa)
✅ Acts like a real Malaysian shop owner
✅ Scales to any catalog size
✅ Reduces token costs and improves speed

**No more keyword matching. Just intelligent, context-aware database access.** 🚀
