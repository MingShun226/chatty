# WhatsApp Message Settings Guide

## ✅ What's Been Added

Two new customizable settings for WhatsApp messages:

### 1. **Message Split Delimiter**
- Custom delimiter to split long messages (e.g., `||`)
- Gives you precise control over message breaks
- If not set, uses automatic sentence splitting

### 2. **Typing Speed (WPM)**
- Controls how long the "typing..." indicator shows
- Measured in Words Per Minute (WPM)
- Default: 200 WPM (average typing speed)
- Range: 50-400 WPM

---

## 📋 Setup Instructions

### Step 1: Add Database Columns

1. **Go to Supabase SQL Editor:**
   - https://supabase.com/dashboard/project/xatrtqdgghanwdujyhkq/sql/new

2. **Run this SQL:**
   - Open the file: `ADD_WHATSAPP_SETTINGS.sql`
   - Copy the SQL and paste into Supabase SQL Editor
   - Click "Run" button
   - You should see: "Success. No rows returned"

### Step 2: Code Already Deployed ✅

The WhatsApp service code has been deployed to Railway with these new features!

### Step 3: Add UI Controls (Optional)

I've created a React component for you at:
```
src/components/chatbot-settings/WhatsAppSettings.tsx
```

**To add this to your chatbot settings page:**

```tsx
import { WhatsAppSettings } from '@/components/chatbot-settings/WhatsAppSettings'

// In your chatbot settings page:
<WhatsAppSettings
  chatbotId={chatbot.id}
  currentDelimiter={chatbot.whatsapp_message_delimiter}
  currentWPM={chatbot.whatsapp_typing_wpm}
  onUpdate={() => refetchChatbot()}
/>
```

---

## 🎯 How to Use

### Example 1: Custom Message Splitting

**In n8n workflow, configure your AI prompt to include the delimiter:**

```
System Prompt:
You are a customer service agent. When providing multi-step instructions,
split each step using "||" so they appear as separate messages.

Example response:
"Welcome to ABC Electronics! || To reset your password: 1. Go to Settings
2. Click Forgot Password || Is there anything else I can help with?"
```

**Result:**
- Message 1: "Welcome to ABC Electronics!"
- Message 2: "To reset your password: 1. Go to Settings 2. Click Forgot Password"
- Message 3: "Is there anything else I can help with?"

### Example 2: Typing Speed

**Different typing speeds:**

- **50 WPM** (very slow): 10-word message = ~12 seconds typing indicator
- **100 WPM** (slow): 10-word message = ~6 seconds typing indicator
- **200 WPM** (average): 10-word message = ~3 seconds typing indicator ⭐ Recommended
- **300 WPM** (fast): 10-word message = ~2 seconds typing indicator
- **400 WPM** (very fast): 10-word message = ~1.5 seconds typing indicator

**Choose based on your brand:**
- Formal/professional → 100-150 WPM (slower, more thoughtful)
- Casual/friendly → 200-250 WPM (average, natural)
- Quick support → 300-400 WPM (fast, efficient)

---

## 🧪 Testing

### Test Message Splitting:

1. **Set delimiter in database:**
   ```sql
   UPDATE avatars
   SET whatsapp_message_delimiter = '||'
   WHERE id = 'your-chatbot-id';
   ```

2. **Send WhatsApp message**

3. **Watch the response split** at each `||`

### Test Typing Speed:

1. **Set WPM in database:**
   ```sql
   UPDATE avatars
   SET whatsapp_typing_wpm = 100  -- Slower typing
   WHERE id = 'your-chatbot-id';
   ```

2. **Send WhatsApp message**

3. **Watch longer typing indicator** (more realistic!)

---

## 💡 Advanced Examples

### E-commerce Product Recommendations:

```
AI Response:
"Here are our top 3 products: ||
1. iPhone 15 - RM3,999 - Latest flagship phone ||
2. AirPods Pro - RM899 - Active noise cancellation ||
3. Apple Watch - RM1,699 - Health & fitness tracking ||
Would you like details on any of these?"
```

**Result:** 5 separate messages, each displayed with typing indicator

### Customer Support Multi-Step Guide:

```
AI Response with slow typing (100 WPM):
"I'll help you troubleshoot. ||
Step 1: Turn off your device completely ||
Step 2: Wait 30 seconds ||
Step 3: Turn it back on ||
Step 4: Check if the issue persists ||
Let me know if this resolves your issue!"
```

**Result:** Each step appears as a separate message with realistic typing delay

---

## 🔧 Technical Details

### Message Splitting Logic:

1. **If delimiter is set:** Split by delimiter first
2. **If part > 1500 chars:** Further split by sentences
3. **If sentence > 1500 chars:** Split by words
4. **Maximum message length:** 1500 characters (WhatsApp safe limit)

### Typing Delay Calculation:

```javascript
// Formula:
typingDelay = (wordCount / WPM) * 60000ms

// With ±10% random variation for natural feel
// Minimum: 800ms
// Maximum: 5000ms
```

### Example Calculations:

| Message | Word Count | WPM | Delay |
|---------|-----------|-----|-------|
| "Hello!" | 1 | 200 | 800ms (minimum) |
| "How can I help you today?" | 6 | 200 | 1.8s |
| "Here's a detailed explanation..." | 20 | 200 | 6s → 5s (max) |
| "How can I help you today?" | 6 | 100 | 3.6s |

---

## 📊 Database Schema

```sql
-- New columns in avatars table:
whatsapp_message_delimiter TEXT DEFAULT NULL
  -- Examples: '||', '---', '###', etc.
  -- NULL = auto-split by sentences

whatsapp_typing_wpm INTEGER DEFAULT 200
  -- Range: 50-400
  -- Average human typing speed: 200 WPM
```

---

## 🎨 Example Frontend UI

The `WhatsAppSettings.tsx` component provides:

- **Delimiter input field** with examples
- **WPM slider** (50-400 range)
- **Visual guides** showing different typing speeds
- **Example messages** demonstrating how splitting works
- **Save button** with loading state

---

## 🚀 Quick Start

**For testing right now without UI:**

1. **Run the SQL:**
   ```sql
   UPDATE avatars
   SET
     whatsapp_message_delimiter = '||',
     whatsapp_typing_wpm = 150
   WHERE name = 'Wendy';  -- Your chatbot name
   ```

2. **Update your n8n AI prompt** to use `||` delimiter

3. **Send a WhatsApp message** and watch the magic! ✨

---

## 📝 Notes

- **Code is already deployed to Railway** ✅
- **Database migration needs to be run** (ADD_WHATSAPP_SETTINGS.sql)
- **UI component is ready to use** (WhatsAppSettings.tsx)
- **Typing indicator adds realism** but increases response time
- **Lower WPM = more realistic, higher WPM = faster responses**
- **Delimiter is optional** - without it, uses smart sentence splitting

---

Happy chatting! 🎉
