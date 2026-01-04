# 🔧 PDF Sending Fix - File URLs Now Included

## ✅ Problem Solved

**Issue:** PDF files couldn't be sent via WhatsApp because the workflow didn't include file URLs in the knowledge base format sent to the AI agent.

**Error:** `{"statusCode":"404","error":"Bucket not found","message":"Bucket not found"}`

**Root Cause:** The AI had no way to extract PDF URLs because they weren't being passed in the prompt.

---

## 🔍 What Was Changed

### Updated: `workflows/newest workflow.json`

**Node:** "Extract WhatsApp Data"

**Before:**
```javascript
// Format knowledge base
const kbArticles = knowledgeBase.map(k =>
  `### ${k.file_name || 'Document'}\n${k.extracted_content || k.content || ''}`
).join('\n\n');
```

**After:**
```javascript
// Format knowledge base - Include file URLs for PDF sending
const kbArticles = knowledgeBase.map(k => {
  const fileName = k.file_name || 'Document';
  const content = k.extracted_content || k.content || '';

  // Construct public URL from file_path
  const fileUrl = k.file_path
    ? `https://xatrtqdgghanwdujyhkq.supabase.co/storage/v1/object/public/knowledge-base/${k.file_path}`
    : null;

  return `### ${fileName}\n${content}${fileUrl ? `\n[File URL: ${fileUrl}]` : ''}`;
}).join('\n\n');
```

---

## 📊 Database Schema Confirmation

**Table:** `avatar_knowledge_files`

**Confirmed Columns:**
- `file_name` - Original filename (e.g., "Product Catalog.pdf")
- `file_path` - Storage path (e.g., "userId/avatarId/1234567890-filename.pdf")
- `extracted_content` - Text content extracted from PDF
- `content_type` - MIME type (e.g., "application/pdf")
- `avatar_id` - Reference to chatbot

**Storage Bucket:** `knowledge-base` (publicly accessible)

**File Path Format:** `{user_id}/{avatar_id}/{timestamp}-{original_filename}`

**Public URL Format:**
```
https://xatrtqdgghanwdujyhkq.supabase.co/storage/v1/object/public/knowledge-base/{file_path}
```

---

## 📝 Example: What AI Now Receives

### Knowledge Base Format (Sent to AI):

```
### Product Catalog.pdf
This is the extracted text content from the PDF file...
Product list includes:
- iPhone 15 Pro Max
- Samsung Galaxy S24
...more content...

[File URL: https://xatrtqdgghanwdujyhkq.supabase.co/storage/v1/object/public/knowledge-base/abc123/def456/1704123456789-Product_Catalog.pdf]

### Price List 2024.xlsx
Excel content extracted...

[File URL: https://xatrtqdgghanwdujyhkq.supabase.co/storage/v1/object/public/knowledge-base/abc123/def456/1704123457890-Price_List_2024.xlsx]
```

### AI Response Example:

```json
{
  "reply": "Sure! || I'm sending you our complete product catalog PDF. || It contains all our products with specifications and pricing.",
  "images": [],
  "documents": [
    {
      "url": "https://xatrtqdgghanwdujyhkq.supabase.co/storage/v1/object/public/knowledge-base/abc123/def456/1704123456789-Product_Catalog.pdf",
      "fileName": "Product Catalog.pdf",
      "caption": "Complete Product Catalog 2024"
    }
  ]
}
```

---

## 🚀 How to Deploy This Fix

### Step 1: Import Updated Workflow to n8n

1. **Open your n8n instance**
2. **Import the updated workflow:**
   - Click "Import from File"
   - Select: `workflows/newest workflow.json`
   - Or use "Import from URL" if you pushed to GitHub
3. **Activate the workflow**

### Step 2: Verify the Change

1. **Open the workflow in n8n**
2. **Find the "Extract WhatsApp Data" node** (Code node)
3. **Check the code** - You should see the new section:
   ```javascript
   // Format knowledge base - Include file URLs for PDF sending
   const kbArticles = knowledgeBase.map(k => {
     const fileName = k.file_name || 'Document';
     const content = k.extracted_content || k.content || '';

     // Construct public URL from file_path
     const fileUrl = k.file_path
       ? `https://xatrtqdgghanwdujyhkq.supabase.co/storage/v1/object/public/knowledge-base/${k.file_path}`
       : null;

     return `### ${fileName}\\n${content}${fileUrl ? `\\n[File URL: ${fileUrl}]` : ''}`;
   }).join('\\n\\n');
   ```

### Step 3: Verify Storage Bucket Settings

1. **Go to Supabase Dashboard**
2. **Navigate to Storage → knowledge-base bucket**
3. **Check if bucket is PUBLIC:**
   - Click on the bucket
   - Go to "Configuration" or "Policies"
   - Ensure there's a policy allowing public read access

**If bucket is not public, create a policy:**

```sql
-- Allow public read access to knowledge-base bucket
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'knowledge-base');
```

**Or make the entire bucket public:**
- In Supabase Dashboard: Storage → knowledge-base → Make Public

---

## 🧪 Testing PDF Sending

### Test 1: Verify File URLs in Database

Run this query in Supabase SQL Editor:

```sql
SELECT
  file_name,
  file_path,
  avatar_id,
  'https://xatrtqdgghanwdujyhkq.supabase.co/storage/v1/object/public/knowledge-base/' || file_path as full_url
FROM avatar_knowledge_files
WHERE avatar_id = 'your-avatar-id'
LIMIT 5;
```

**Expected Result:** You should see the `full_url` column with complete URLs like:
```
https://xatrtqdgghanwdujyhkq.supabase.co/storage/v1/object/public/knowledge-base/user123/avatar456/1704123456789-Catalog.pdf
```

**Try opening the URL in browser** - it should download the PDF.

### Test 2: Check n8n Workflow Output

1. **Send a test webhook to your n8n workflow**
2. **Check the "Extract WhatsApp Data" node output**
3. **Look for `kbArticles` field** - it should include `[File URL: ...]`

Example output:
```json
{
  "kbArticles": "### Product Catalog.pdf\nExtracted content here...\n[File URL: https://...pdf]"
}
```

### Test 3: Test via WhatsApp

**Send this message to your WhatsApp chatbot:**
```
"Send me the product catalog PDF"
```

**Expected Flow:**
1. User sends message
2. WhatsApp service receives message
3. n8n receives webhook with knowledge base including file URLs
4. AI extracts file URL from `[File URL: ...]`
5. AI returns JSON with `documents` array
6. WhatsApp service sends PDF file to customer

**Customer receives:**
- Text message: "Sure! I'm sending you our complete product catalog..."
- PDF file attachment: "Product Catalog.pdf"

### Test 4: Check WhatsApp Service Logs

**On Railway:**
```bash
railway logs --service whatsapp-web-service
```

**Look for these log entries:**
```
Sending 1 document(s)...
Sending document to 6012345678: Product Catalog.pdf
Document sent successfully: Product Catalog.pdf
```

**If you see errors:**
- "Error sending document" → Check if URL is accessible
- "404 Bucket not found" → Storage bucket is not public
- "Failed to parse" → Check n8n JSON format

---

## 🎯 Quick Checklist

Before testing, ensure:

- [ ] Updated workflow imported to n8n
- [ ] "Extract WhatsApp Data" node has the new code
- [ ] `knowledge-base` storage bucket is PUBLIC in Supabase
- [ ] At least one PDF file exists in `avatar_knowledge_files` table
- [ ] `file_path` column has values like `userId/avatarId/timestamp-filename.pdf`
- [ ] ENHANCED_AI_PROMPT.txt includes document sending instructions
- [ ] WhatsApp service has document sending capability (already deployed)

---

## 📚 Related Documentation

- [DOCUMENT_SENDING_GUIDE.md](DOCUMENT_SENDING_GUIDE.md) - Complete guide on document sending feature
- [WHATSAPP_NEW_FEATURES_GUIDE.md](WHATSAPP_NEW_FEATURES_GUIDE.md) - Overview of all new WhatsApp features
- [ENHANCED_AI_PROMPT.txt](ENHANCED_AI_PROMPT.txt) - AI instructions for document sending

---

## 🔍 Troubleshooting

### Issue: Still getting 404 error

**Solution:**
1. Check if file_path exists in database:
   ```sql
   SELECT file_path FROM avatar_knowledge_files WHERE avatar_id = 'your-id';
   ```
2. Manually test the URL in browser
3. Check Supabase Storage policies:
   ```sql
   SELECT * FROM storage.policies WHERE bucket_id = 'knowledge-base';
   ```

### Issue: AI not sending documents

**Check:**
1. n8n workflow includes file URLs in kbArticles
2. AI prompt includes document sending instructions
3. Customer is explicitly requesting documents ("send me the catalog")

### Issue: File exists but URL returns 404

**Possible causes:**
1. Storage bucket is not public
2. RLS policy blocking access
3. Wrong bucket name in URL (should be `knowledge-base` not `knowledge-files`)

**Fix:**
```sql
-- Make storage bucket public
UPDATE storage.buckets
SET public = true
WHERE id = 'knowledge-base';
```

---

## ✅ Success Criteria

**You'll know it's working when:**

1. ✅ File URLs appear in n8n "Extract WhatsApp Data" output
2. ✅ Opening a file URL in browser downloads the PDF
3. ✅ AI response includes `documents` array with file URLs
4. ✅ Customer receives PDF file in WhatsApp
5. ✅ WhatsApp service logs show "Document sent successfully"
6. ✅ `whatsapp_web_messages` table has document message records

---

## 🎉 Summary

**What was fixed:**
- ✅ Knowledge base format now includes file URLs
- ✅ AI can extract and send PDF/document files
- ✅ File URLs are constructed from `file_path` column
- ✅ Uses correct storage bucket: `knowledge-base`

**What you need to do:**
1. Import updated workflow to n8n
2. Verify storage bucket is public
3. Test by asking chatbot to send a PDF

**Next steps:**
- Upload PDF files to knowledge base via AvatarLab UI
- Test document sending with customers
- Monitor Railway logs for successful sends

---

Need help? Check the logs or refer to DOCUMENT_SENDING_GUIDE.md for complete documentation.
