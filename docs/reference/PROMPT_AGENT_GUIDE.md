# Prompt Engineering Agent - User Guide

## Overview

The **Prompt Engineering Agent** is an AI-powered assistant (powered by GPT-4o) that helps non-technical users refine and optimize their chatbot's system prompt through natural conversation. No technical knowledge required!

---

## Location

**Chatbot Studio** → **Fine-tune Tab** → **Prompt Engineering Agent** (top section)

---

## Features

### 🤖 **Conversational Editing**
- Chat naturally with the AI agent about what you want to change
- No need to understand prompt engineering - just describe what you want
- Agent asks clarifying questions when needed

### 🎯 **Professional Prompt Refinement**
- Makes changes while preserving Malaysian salesman style
- Maintains compliance rules automatically
- Keeps the persuasive, warm tone intact
- Ensures all critical elements stay in place

### 💾 **Easy Save & Version Control**
- Copy refined prompts to clipboard
- Save as new version with one click
- Automatically activates the new version

### 🔧 **Smart Suggestions**
- Proactively identifies issues in your prompt
- Recommends improvements you might not have thought of
- Explains changes in simple, non-technical language

---

## How to Use

### Step 1: Open the Agent

1. Go to **Chatbot Studio**
2. Select your chatbot
3. Click the **Fine-tune** tab
4. You'll see **Prompt Engineering Agent** at the top

### Step 2: Start Chatting

The agent will greet you with a welcome message. You can:

**Try suggested questions:**
- "Make it sound more casual and friendly"
- "Add more urgency when showing products"
- "Make it ask for customer's car model first"
- "Emphasize our warranty policy more"
- "Make upselling more natural"

**Or describe what you want:**
- "I want my chatbot to be more persuasive"
- "Can you make it sound less corporate?"
- "Add a section about asking for payment confirmation"
- "Make it always mention our free shipping"

### Step 3: Review Changes

When the agent makes changes, it will:
1. Show you the updated prompt in a code block
2. Explain what was changed
3. Tell you why those changes help

### Step 4: Save Your Refined Prompt

Once you're happy with the changes:
1. Click **"Save as Version"**
2. The prompt is saved as a new version and activated
3. Your chatbot now uses the refined prompt!

---

## Example Conversations

### Example 1: Making it More Friendly

**You:** "Make my chatbot sound more friendly"

**Agent:** "Great! I can make your chatbot more friendly and approachable. Would you like me to:
1. Use more casual Malaysian greetings (老板, boss, bro)?
2. Add warmer language throughout?
3. Make it sound like chatting with a friend?

Or should I do all three?"

**You:** "Do all three"

**Agent:** "Here's your updated prompt:

```
[Shows updated prompt with more casual language]
```

**What I changed:**
- Added more casual Malaysian greetings throughout
- Changed formal phrases to friendly chat language
- Increased use of particles like 'lah', 'lor', 'ah'
- Made tone warmer and more personal

**Why these changes:**
Your chatbot will now sound like a friendly Malaysian shop owner having a casual WhatsApp conversation, not a formal customer service bot!"

---

### Example 2: Adding Specific Behavior

**You:** "Can you make it always ask what car model the customer has?"

**Agent:** "Absolutely! I'll add a guiding question section specifically for car model inquiries. Here's what I'll add:

```
**WHEN CUSTOMER ASKS ABOUT PRODUCTS:**
- First, ask for their car model: "Boss你的车是什么model的？ || 哪一年的？"
- Wait for their answer before showing products
- This helps you recommend the right compatible products
```

Should I also add questions about their preferred color and budget to help with recommendations?"

**You:** "Yes, add those too"

**Agent:** [Provides updated prompt with all guiding questions added]

---

## What the Agent CAN Do

✅ **Adjust tone** - Make it more casual, professional, friendly, persuasive, etc.
✅ **Add behaviors** - Insert specific actions or responses
✅ **Modify persuasion** - Strengthen or soften sales techniques
✅ **Change greetings** - Customize how chatbot starts conversations
✅ **Add questions** - Include guiding questions for customers
✅ **Emphasize features** - Highlight specific products, policies, or services
✅ **Adjust language style** - More Malaysian, more formal, simpler, etc.
✅ **Include examples** - Add example responses for common scenarios

---

## What the Agent CANNOT Change

❌ **Compliance Rules** - These are legally/business critical and protected
❌ **Core "NOT a chatbot" instruction** - Essential for natural conversation
❌ **Dynamic product references** - These are injected at runtime
❌ **Dynamic knowledge base references** - These are injected at runtime

The agent will explain why these elements cannot be changed if you ask.

---

## Pro Tips

### 💡 **Be Specific**
Instead of: "Make it better"
Try: "Make it more persuasive when a customer asks about prices"

### 💡 **Ask for Examples**
"Can you show me how the chatbot will respond with these changes?"

### 💡 **Iterate**
Make small changes and test them. You can always chat with the agent again to refine further.

### 💡 **Use the Suggested Questions**
The suggested questions are great starting points for common improvements.

### 💡 **Copy Before Making Big Changes**
Use the "Copy Prompt" button to save your current prompt before major edits.

---

## Technical Details

### How It Works

1. **Context Loading**: Agent loads your current prompt, chatbot settings, compliance rules
2. **Conversation**: You chat naturally about what you want to change
3. **AI Processing**: GPT-4o understands your request and generates refined prompt
4. **Professional Output**: Changes are made while preserving style and critical elements
5. **Version Control**: Saved as new version with automatic activation

### What Gets Preserved

- ✅ Malaysian salesman style (老板, boss, lah, lor, ah, ||)
- ✅ Persuasion techniques (scarcity, social proof, upselling)
- ✅ Compliance rules (non-negotiable business/legal rules)
- ✅ Response guidelines
- ✅ Product catalog integration
- ✅ Knowledge base integration
- ✅ Multilingual support (中文, English, BM)

---

## Common Use Cases

### 1. **Adjusting Sales Approach**
"Make it more aggressive with upselling"
"Soften the persuasion - make it more subtle"

### 2. **Industry-Specific Customization**
"Add automotive-specific terminology"
"Include beauty product recommendations style"

### 3. **Customer Flow Optimization**
"Make it collect customer info before showing products"
"Add a greeting that asks how they heard about us"

### 4. **Policy Emphasis**
"Always mention our 14-day return policy"
"Emphasize our warranty terms more"

### 5. **Language Style**
"Make it use more Chinese in responses"
"Keep it mainly in English but add Malay words occasionally"

---

## Troubleshooting

### Agent Doesn't Understand My Request
- Be more specific about what you want
- Give examples of desired behavior
- Break complex requests into smaller parts

### Changes Don't Look Right
- Ask the agent to explain why it made those changes
- Request specific adjustments: "That's too casual, make it slightly more professional"
- You can always reset and start over

### Prompt Too Long
- Ask: "Can you make this more concise while keeping the key points?"
- The agent will shorten while preserving important elements

---

## Integration with WhatsApp/n8n

The refined prompts work seamlessly with your WhatsApp chatbot via n8n:

1. Refine prompt with agent
2. Save as version (auto-activated)
3. Your WhatsApp chatbot immediately uses the new prompt
4. Test in the **Test Chat** tab before going live

---

## Best Practices

1. **Test After Changes**: Use the Test Chat tab to verify improvements
2. **Start Small**: Make incremental changes rather than complete overhauls
3. **Keep Compliance**: Let the agent handle preserving compliance rules
4. **Version Control**: Each save creates a new version - you can always revert
5. **Iterate**: Chat with the agent multiple times to refine further

---

## Files Reference

**Service**: [src/services/promptAgentService.ts](src/services/promptAgentService.ts)
- Core AI logic for prompt refinement
- Professional prompt engineering system
- GPT-4o powered conversations

**Component**: [src/components/business-chatbot/PromptAgentChat.tsx](src/components/business-chatbot/PromptAgentChat.tsx)
- Chat interface UI
- Message history
- Copy and save functionality

**Integration**: Fine-tune tab in Chatbot Studio

---

## Support

If you have questions or need help:
1. Ask the agent directly - it can explain its capabilities
2. Try the suggested questions to see examples
3. Check this guide for common use cases

---

## Summary

The Prompt Engineering Agent makes it easy for anyone to create professional, effective chatbot prompts without technical knowledge. Just chat about what you want, and the agent handles the complex prompt engineering work while preserving your Malaysian salesman style and compliance rules.

**Key Benefits:**
- 🎯 No technical knowledge needed
- 🤖 GPT-4o powered intelligence
- 💬 Natural conversation interface
- ✅ Professional results every time
- 🔒 Compliance rules protected
- 🇲🇾 Malaysian style preserved

Happy prompt refining! 🚀
