# 📱 WhatsApp Integration - User Interface Guide

> **What to expect when using the WhatsApp integration**

---

## 🎯 Navigation

### How to Access WhatsApp Integration:

1. **Login** to your dashboard
2. Look at the **left sidebar**
3. Find **"WhatsApp Chatbot"** section (has MessageCircle icon)
4. Click **"WhatsApp Integration"**

```
Dashboard
  └─ WhatsApp Chatbot
      ├─ Chatbot Settings
      ├─ Products
      ├─ Knowledge Base
      ├─ Prompt Engineer
      ├─ Model Training
      ├─ WhatsApp Integration  ← YOU ARE HERE
      └─ Test Chat
```

---

## 📋 What You'll See

### 1. First Time (No Connections)

When you first visit the page, you'll see:

```
┌─────────────────────────────────────────────────────┐
│  WhatsApp Integration                               │
│  My Chatbot • Company Name              [Dropdown]  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  🟢 WhatsApp Business Integration                   │
│  Connect your WhatsApp Business Account to         │
│  enable chatbot messaging                          │
│                                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│               📱 No WhatsApp Connections            │
│                                                     │
│    Connect your WhatsApp Business Account to       │
│    start receiving and sending messages through    │
│    your chatbot                                    │
│                                                     │
│        [Connect WhatsApp Business Account]         │
│                 (Green Button)                      │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Action:** Click the green button to start OAuth flow

---

### 2. Connection Modal (Popup)

When you click "Connect", you'll see a detailed modal:

```
┌─────────────────────────────────────────────────────┐
│  🟢 Connect WhatsApp Business Account               │
│  Connect your WhatsApp Business Account to         │
│  enable chatbot messaging                          │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ✅ What you'll get:                                │
│    • Receive and reply to WhatsApp messages        │
│    • Send broadcast messages to multiple contacts  │
│    • Share images, videos, and documents          │
│    • Display your product catalog in WhatsApp     │
│    • Track message delivery and read status       │
│                                                     │
│  ⚠️  Requirements:                                  │
│    • A Meta Business Account (free to create)      │
│    • A verified WhatsApp Business Account         │
│    • A phone number registered with WhatsApp      │
│                                                     │
│  📝 How it works:                                   │
│    1. Click "Connect WhatsApp" below              │
│    2. Log in to your Meta Business account        │
│    3. Select your WhatsApp Business Account       │
│    4. Grant permissions to manage messages        │
│    5. Your chatbot will start receiving messages! │
│                                                     │
│  🔒 Privacy & Security:                            │
│  Your access tokens are encrypted with AES-256-GCM │
│                                                     │
│        [Connect WhatsApp Business Account]         │
│              (Large Green Button)                   │
│                                                     │
│     [Don't have a WhatsApp Business Account?]     │
│              (Opens Meta guide)                     │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

### 3. After Successful Connection

Once connected, your page transforms to show:

```
┌─────────────────────────────────────────────────────┐
│  WhatsApp Integration                               │
│  My Chatbot • Company Name              [Dropdown]  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  🟢 WhatsApp Business Integration                   │
│  Connect your WhatsApp Business Account...         │
│                                                     │
│                              [+ Add Another Number] │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────────────────────┐  ┌──────────────────────┐│
│  │ 📱 My Business        │  │ 📱 Support Line      ││
│  │ +60123456789         │  │ +60198765432         ││
│  │ ✅ Verified          │  │ ✅ Verified          ││
│  │                      │  │                      ││
│  │ Quality: 🟢 GREEN    │  │ Quality: 🟡 YELLOW   ││
│  │ Tier: 50/day        │  │ Tier: 250/day       ││
│  │                      │  │                      ││
│  │ 📊 Stats:            │  │ 📊 Stats:            ││
│  │   125 messages       │  │   1,043 messages     ││
│  │   23 contacts        │  │   156 contacts       ││
│  │   95% delivery       │  │   98% delivery       ││
│  │                      │  │                      ││
│  │ 🕒 Last synced 2h ago│  │ 🕒 Last synced 5m ago││
│  │                      │  │                      ││
│  │ [Messages] [Settings]│  │ [Messages] [Settings]││
│  │                 [🔌] │  │                 [🔌] ││
│  └──────────────────────┘  └──────────────────────┘│
│                                                     │
├─────────────────────────────────────────────────────┤
│  📊 Summary                                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │ Active   │ │ Free Tier│ │ Response │           │
│  │    2     │ │  1,000   │ │   <1s    │           │
│  │ numbers  │ │ conv/mo  │ │  time    │           │
│  └──────────┘ └──────────┘ └──────────┘           │
│                                                     │
├─────────────────────────────────────────────────────┤
│  📝 Next Steps                                      │
│  1️⃣  Test your chatbot - Send a message           │
│  2️⃣  Create message templates - Set up broadcasts │
│  3️⃣  Sync your product catalog - Show products    │
└─────────────────────────────────────────────────────┘
```

---

## 🎨 Connection Card Details

Each connected WhatsApp number shows:

### Phone Number & Status
- **Display Name**: Your business name
- **Phone Number**: +60123456789 (with country code)
- **Verified Badge**: ✅ if verified by Meta
- **Status Badge**: 🟢 active / 🔴 inactive

### Quality Rating (Color-Coded)
- **🟢 GREEN**: High quality (good reputation)
- **🟡 YELLOW**: Medium quality (some issues)
- **🔴 RED**: Low quality (risk of limits)

What affects quality:
- User reports of spam
- Message delivery failure rate
- User engagement (replies vs blocks)

### Messaging Tier
Shows your daily conversation limit:
- **TIER_50**: 50 conversations per 24 hours
- **TIER_250**: 250 conversations per 24 hours
- **TIER_1K**: 1,000 conversations per 24 hours
- **TIER_10K**: 10,000 conversations per 24 hours
- **TIER_UNLIMITED**: No daily limit

How to upgrade tier:
- Maintain green quality rating
- Send quality messages consistently
- Meta upgrades automatically

### Live Statistics
- **Total Messages**: All messages sent + received
- **Contacts**: Unique phone numbers you've chatted with
- **Delivery Rate**: % of messages successfully delivered

### Quick Actions
- **Messages**: View conversation history
- **Settings**: Edit business profile
- **Disconnect** (🔌): Remove the connection

---

## 🔄 Real-Time Updates

### When You Send/Receive Messages

The stats update automatically:

```
Before message:
┌────────────────┐
│ Total: 125     │
│ Contacts: 23   │
│ Delivery: 95%  │
└────────────────┘

After new conversation:
┌────────────────┐
│ Total: 127  ⬆️ │  (increased by 2)
│ Contacts: 24⬆️ │  (new contact)
│ Delivery: 95%  │
└────────────────┘
```

### Message Status Tracking

Each message goes through stages:

1. **Pending** ⏳ - Message created, waiting to send
2. **Sent** ✅ - Delivered to Meta servers
3. **Delivered** ✅✅ - Delivered to user's phone
4. **Read** 👁️ - User opened and read the message
5. **Failed** ❌ - Message could not be delivered

---

## 💬 Testing Your Connection

### What to Test:

1. **Send a text message:**
   ```
   You: "Hello, are you open?"
   Bot: "Yes! We're open Monday-Friday 9 AM - 6 PM..."
   ```

2. **Ask about products:**
   ```
   You: "What products do you have?"
   Bot: [Uses function calling to search products]
        "We have 15 products. Here are some popular items:
        1. Product A - $99
        2. Product B - $149..."
   ```

3. **Complex queries:**
   ```
   You: "Do you have any red shoes under $100?"
   Bot: [Searches products with filters]
        "I found 3 red shoes under $100:..."
   ```

### Expected Response Time:
- ⚡ **< 1 second**: For simple text queries
- ⚡ **1-2 seconds**: For product searches
- ⚡ **2-3 seconds**: For complex function calls

---

## 🎯 Chatbot Selection

### Important: Always Select Your Chatbot!

At the top right of the page, you'll see:

```
┌─────────────────────────────────────┐
│  🤖 My Business Chatbot      [▼]   │  ← Dropdown selector
└─────────────────────────────────────┘
```

**This dropdown selects which chatbot to connect to WhatsApp.**

- Each chatbot can have multiple WhatsApp numbers
- Switch between chatbots to manage different connections
- The page remembers your last selection

If you see "No Chatbot Selected":
1. Click the dropdown
2. Select your chatbot
3. The page will reload with connections for that chatbot

---

## 🎨 Visual States

### Loading State
```
┌─────────────────────────────────────┐
│                                     │
│           ⏳ Loading...             │
│      (Spinning circle animation)    │
│                                     │
└─────────────────────────────────────┘
```

### Success Toast (After Connection)
```
┌─────────────────────────────────────┐
│ ✅ WhatsApp connected!              │
│ Successfully connected 1 WhatsApp   │
│ number(s)!                          │
└─────────────────────────────────────┘
```

### Error Toast (If Connection Fails)
```
┌─────────────────────────────────────┐
│ ❌ Connection failed                │
│ No WhatsApp Business Account found. │
│ Please ensure you have a WhatsApp   │
│ Business Account set up...          │
└─────────────────────────────────────┘
```

---

## 🎓 Tips for Best Experience

### 1. Use the Chatbot Selector
Always select your chatbot first before trying to connect WhatsApp.

### 2. Check Quality Rating Regularly
- Green = good, keep doing what you're doing
- Yellow = improve message quality, reduce spam
- Red = urgent, you may lose messaging ability

### 3. Monitor Your Tier
- Start at TIER_50 (50 conversations/day)
- Maintain quality to auto-upgrade
- Plan campaigns within your tier limit

### 4. Test Before Going Live
Send yourself test messages to ensure:
- Auto-reply works
- Response quality is good
- Function calling (product search) works

### 5. Disconnect When Not Needed
If you switch phone numbers or stop using a number:
- Click the disconnect button (🔌)
- This prevents confusion and keeps data clean

---

## 🆘 Common UI Issues

### "No Chatbot Selected" Error

**What you see:**
```
┌─────────────────────────────────────┐
│ ⚠️  No Chatbot Selected             │
│                                     │
│ Please select a chatbot from the   │
│ dashboard to manage WhatsApp        │
│ integration.                        │
│                                     │
│        [Go to Dashboard]            │
└─────────────────────────────────────┘
```

**Solution:**
1. Click the chatbot dropdown at top right
2. Select your chatbot
3. OR go to Dashboard and select chatbot there

### Empty Connections List

**What you see:**
```
┌─────────────────────────────────────┐
│ 📱 No WhatsApp Connections          │
│                                     │
│ [Connect WhatsApp Business Account] │
└─────────────────────────────────────┘
```

**This is normal** if:
- You haven't connected yet (click the button!)
- You disconnected all numbers
- Your chatbot is newly created

### Popup Blocked

**What you see:**
Browser shows: "Popup blocked" notification

**Solution:**
1. Click the browser notification
2. Select "Always allow popups from localhost:8080"
3. Click "Connect" button again

---

**Now you're ready to use WhatsApp Integration!** 🎉

For setup instructions, see [WHATSAPP_SETUP_GUIDE.md](./WHATSAPP_SETUP_GUIDE.md)
