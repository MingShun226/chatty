# 🔧 Quick Fix: PDF Sending Not Working

## ❌ Current Problem

The AI is returning fake URLs instead of file paths:
```json
{
  "url": "https://storage.supabase.co/knowledge-base/ABC_Electronics_Sample_Knowledge_Base.pdf"
}
```

**Error:** `getaddrinfo ENOTFOUND storage.supabase.co`

---

## ✅ Solution: 2 Steps

### **Step 1: Import Updated Workflow to n8n** ⚠️ REQUIRED

**What's wrong:** Your current n8n workflow doesn't send file paths to the AI.

**Fix:**

1. **Download the updated workflow:**
   - Go to: https://github.com/MingShun226/chatty/blob/main/workflows/newest%20workflow.json
   - Click "Raw" button
   - Save the file (Ctrl+S)

2. **Import to n8n:**
   - Open your n8n instance
   - Click **"Import from File"** (or menu → Import)
   - Select the downloaded workflow file
   - Click **"Import"**

3. **Activate the workflow:**
   - Make sure the workflow is **activated** (toggle switch)

4. **Verify it worked:**
   - Open the **"Extract WhatsApp Data"** node
   - Scroll down to find this code:
   ```javascript
   // Format knowledge base - Include file paths for signed URL generation
   const kbArticles = knowledgeBase.map(k => {
     const fileName = k.file_name || 'Document';
     const content = k.extracted_content || k.content || '';

     // Include file_path for signed URL generation (not full URL)
     const filePath = k.file_path || null;

     return `### ${fileName}\n${content}${filePath ? `\n[File Path: ${filePath}]` : ''}`;
   }).join('\n\n');
   ```

   ✅ If you see `[File Path: ${filePath}]` - it's correct!
   ❌ If you don't see this - reimport the workflow

---

### **Step 2: Update AI Instructions** ⚠️ REQUIRED

**What's wrong:** The chatbot doesn't know to use `filePath` instead of `url`.

**Fix:**

1. **Go to your AvatarLab dashboard**
   - Open: https://chatty-five-blush.vercel.app/chatbot

2. **Select your chatbot:** (dfaf5a3e-1033-4e0f-bf4c-65217d68bfb3)

3. **Go to "Prompt Engineer" or "Settings" page**

4. **Find the "System Prompt" or "AI Instructions" section**

5. **Copy and paste this critical section at the end of your prompt:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📄 HOW TO SEND DOCUMENTS (PDF, DOCX, etc.)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

When you see knowledge base files in the KNOWLEDGE BASE section, you can send them as WhatsApp documents.

Knowledge base format example:
"### Product Catalog.pdf
[Extracted content here...]
[File Path: 9248b32f-2015-4afb-a0a3-25aa8755dc35/dfaf5a3e-1033-4e0f-bf4c-65217d68bfb3/1766683557455-Product_Catalog.pdf]"

To send a document, use this EXACT format:
{
  "reply": "Sure! || I'm sending you our complete product catalog. || Please check the PDF file.",
  "images": [],
  "documents": [
    {
      "filePath": "9248b32f-2015-4afb-a0a3-25aa8755dc35/dfaf5a3e-1033-4e0f-bf4c-65217d68bfb3/1766683557455-Product_Catalog.pdf",
      "fileName": "Product Catalog.pdf",
      "caption": "Complete Product Catalog 2024"
    }
  ]
}

CRITICAL RULES FOR DOCUMENTS:
1. Use "filePath" NOT "url"
2. Extract the EXACT path from [File Path: ...] in the knowledge base
3. Don't make up URLs - only use real file paths
4. The filePath format: userId/avatarId/timestamp-filename.pdf

When to send documents:
✅ Customer asks for "catalog", "brochure", "manual", "price list"
✅ Customer says "send me the PDF" or "can I have the document"
✅ Customer wants detailed information from knowledge base files

Don't send documents when:
❌ Customer just wants quick text information
❌ You can answer with a simple text reply
```

6. **Save the changes**

---

## 🧪 Test After Making Changes

**Send this WhatsApp message:**
```
"I want the PDF of ABC Electronics sample knowledge base document"
```

**Expected result:**
- ✅ Text reply from AI
- ✅ **PDF file attachment** sent to WhatsApp
- ✅ You can download and view the PDF

**Check Railway logs:**
```bash
cd whatsapp-web-service
railway logs --service whatsapp-web-service
```

**Look for:**
```
✅ Generating signed URL for file: 9248b32f-2015-4afb-a0a3-25aa8755dc35/...
✅ Signed URL generated successfully
✅ Document sent successfully: ABC Electronics Sample Knowledge Base.pdf
```

**NOT this error:**
```
❌ Error: getaddrinfo ENOTFOUND storage.supabase.co
```

---

## 📋 Quick Checklist

Before testing, verify:

- [ ] **n8n workflow imported** (Check "Extract WhatsApp Data" node has `[File Path: ...]`)
- [ ] **Workflow is activated** (Toggle switch is ON)
- [ ] **Chatbot prompt updated** (Has document sending instructions with `filePath`)
- [ ] **Saved changes** in chatbot settings

---

## 🔍 How to Verify n8n Workflow is Correct

**Method 1: Check the node code**
1. Open "Extract WhatsApp Data" node in n8n
2. Look for: `[File Path: ${filePath}]`
3. ✅ If found = correct
4. ❌ If not found = reimport workflow

**Method 2: Test with a manual execution**
1. In n8n, manually trigger the workflow
2. Check the output of "Extract WhatsApp Data" node
3. Look for `kbArticles` field
4. Should show:
   ```
   ### ABC Electronics sample knowledge base.pdf
   [Content here...]
   [File Path: 9248b32f-2015-4afb-a0a3-25aa8755dc35/.../1766683557455-ABC Electronics sample knowledge base.pdf]
   ```

---

## ❓ Still Not Working?

If you still see the error after both steps:

**Check 1: Is the workflow really updated?**
```bash
# In n8n, export your current workflow and check if it has:
"[File Path: ${filePath}]"
```

**Check 2: Is the chatbot using the updated prompt?**
- Test by asking AI to describe the document sending format
- It should mention "filePath" not "url"

**Check 3: Check Railway logs for the exact error**
```bash
railway logs --service whatsapp-web-service | grep -A 5 "Error"
```

---

## 💡 Why This Happens

**Old workflow sent:**
```
### ABC Electronics sample knowledge base.pdf
[Content...]
(NO FILE PATH!)
```

**AI had no file path, so it made up a fake URL:**
```json
"url": "https://storage.supabase.co/..."  ❌ Fake URL
```

**New workflow sends:**
```
### ABC Electronics sample knowledge base.pdf
[Content...]
[File Path: 9248b32f-2015-4afb-a0a3-25aa8755dc35/.../1766683557455-ABC Electronics sample knowledge base.pdf]
```

**AI extracts the real file path:**
```json
"filePath": "9248b32f-2015-4afb-a0a3-25aa8755dc35/..."  ✅ Real path
```

**WhatsApp service generates signed URL:**
```
https://xatrtqdgghanwdujyhkq.supabase.co/storage/v1/object/sign/knowledge-base/...?token=...  ✅ Works!
```

---

## 🎉 Success Indicators

You'll know it's working when:

1. ✅ Railway logs show: "Generating signed URL for file..."
2. ✅ Railway logs show: "Signed URL generated successfully"
3. ✅ NO error about "ENOTFOUND storage.supabase.co"
4. ✅ Customer receives PDF in WhatsApp
5. ✅ PDF is downloadable and viewable

---

**Both steps are REQUIRED! The workflow provides the file path, and the prompt teaches the AI how to use it correctly.**
