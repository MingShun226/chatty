# 📄 WhatsApp Document Sending Guide

## ✨ New Capability: Send PDF, DOCX, and Other Files

Your WhatsApp chatbot can now send documents (PDF, Word, Excel, PowerPoint, etc.) directly to customers!

---

## 📊 Conversation History Limit

**Current:** The AI agent remembers the **last 10 messages** (5 back-and-forth exchanges).

**To increase:**
1. Edit `whatsapp-web-service/index.js`
2. Find line 537: `.limit(10)`
3. Change to `.limit(20)` for 10 exchanges, or `.limit(50)` for 25 exchanges
4. Deploy to Railway

---

## 🚀 How Document Sending Works

### Flow:
1. Customer asks: "send me the product catalog" or "do you have a price list PDF?"
2. AI extracts document URL from knowledge base
3. AI returns JSON with `documents` array
4. WhatsApp service sends the file as a document attachment
5. Customer receives the file in WhatsApp (can download and open)

---

## 📋 Supported File Types

| Type | Extensions | Use Cases |
|------|-----------|-----------|
| **PDF** | `.pdf` | Catalogs, brochures, manuals, price lists |
| **Word** | `.doc`, `.docx` | Documents, contracts, forms |
| **Excel** | `.xls`, `.xlsx` | Price lists, inventory, reports |
| **PowerPoint** | `.ppt`, `.pptx` | Presentations, slideshows |
| **Text** | `.txt` | Plain text files |
| **ZIP** | `.zip` | Compressed file packages |

---

## 🎯 How AI Decides to Send Documents

### AI will send documents when customer asks:
- ✅ "send me the catalog"
- ✅ "do you have a PDF I can download?"
- ✅ "can I have the price list?"
- ✅ "send me the user manual"
- ✅ "do you have the brochure?"

### AI won't send documents when:
- ❌ Customer just wants quick text info
- ❌ Question can be answered in text
- ❌ Customer didn't explicitly request documentation

---

## 📝 How to Use in n8n

### n8n Response Format:

```json
{
  "reply": "Sure! || I'm sending you our complete product catalog. || Please check the PDF file for all details.",
  "images": [],
  "documents": [
    {
      "url": "https://xatrtqdgghanwdujyhkq.supabase.co/storage/v1/object/public/knowledge-files/Product_Catalog_2024.pdf",
      "fileName": "Product Catalog 2024.pdf",
      "caption": "Complete Product Catalog - Updated January 2024"
    }
  ]
}
```

### Document Object Format:

```json
{
  "url": "https://storage.com/.../file.pdf",     // Required: Public URL to the file
  "fileName": "Catalog.pdf",                      // Required: File name with extension
  "caption": "Product Catalog 2024"               // Optional: Description/caption
}
```

---

## 💡 Examples

### Example 1: Send Single PDF

**Customer:** "do you have a product catalog?"

**AI Response:**
```json
{
  "reply": "Yes! || I'm sending you our latest product catalog PDF. || It includes all products with specifications and pricing.",
  "images": [],
  "documents": [
    {
      "url": "https://storage.com/catalog.pdf",
      "fileName": "Product Catalog 2024.pdf",
      "caption": "Complete Product Catalog"
    }
  ]
}
```

**Result:** Customer receives text message + PDF file attachment

---

### Example 2: Send Both Image and Document

**Customer:** "show me the iPhone and send me the user manual"

**AI Response:**
```json
{
  "reply": "Here's the iPhone 15 Pro Max! || I'm also sending you the detailed user manual PDF for reference.",
  "images": [
    {
      "url": "https://storage.com/iphone15pro.jpg",
      "caption": "iPhone 15 Pro Max - RM 6499"
    }
  ],
  "documents": [
    {
      "url": "https://storage.com/iphone15_manual.pdf",
      "fileName": "iPhone 15 Pro Max User Manual.pdf",
      "caption": "Complete user guide and specifications"
    }
  ]
}
```

**Result:** Customer receives text + product image + PDF manual

---

### Example 3: Send Multiple Documents

**Customer:** "send me all your product documentation"

**AI Response:**
```json
{
  "reply": "Sure! || I'm sending you our complete documentation package. || You'll receive the product catalog, price list, and warranty information.",
  "images": [],
  "documents": [
    {
      "url": "https://storage.com/catalog.pdf",
      "fileName": "Product Catalog.pdf",
      "caption": "All products with specifications"
    },
    {
      "url": "https://storage.com/prices.xlsx",
      "fileName": "Price List 2024.xlsx",
      "caption": "Current pricing and promotions"
    },
    {
      "url": "https://storage.com/warranty.pdf",
      "fileName": "Warranty Information.pdf",
      "caption": "Warranty terms and conditions"
    }
  ]
}
```

**Result:** Customer receives text + 3 separate document files

---

## 🔧 Where to Get Document URLs

### From Your Knowledge Base:

When you upload PDF files to your knowledge base in AvatarLab, they're stored in Supabase Storage. The AI can access these URLs from the KNOWLEDGE BASE section of the prompt.

**Format in prompt:**
```
📚 KNOWLEDGE BASE:
### Product Catalog.pdf
[Extracted content here...]
[File URL: https://xatrtqdgghanwdujyhkq.supabase.co/storage/v1/object/public/knowledge-files/dfaf5a3e-1033-4e0f-bf4c-65217d68bfb3/Product_Catalog.pdf]
```

The AI will extract the URL from `[File URL: ...]` and use it in the documents array.

---

## 🎨 What Customer Sees in WhatsApp

1. **Text message appears first** (split by `||`)
   ```
   Sure!

   I'm sending you our complete product catalog.

   Please check the PDF file for all details.
   ```

2. **Document appears as file attachment**
   - File icon with name: "Product Catalog 2024.pdf"
   - Caption: "Complete Product Catalog - Updated January 2024"
   - Customer can tap to download/open

---

## ⚙️ Backend Implementation

### WhatsApp Service automatically:
1. Detects `documents` array in n8n response
2. Determines MIME type from file extension
3. Sends each document with Baileys library
4. Shows "uploading..." indicator to customer
5. Stores document message in database

### Supported MIME Types:
```javascript
{
  'pdf': 'application/pdf',
  'doc': 'application/msword',
  'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'xls': 'application/vnd.ms-excel',
  'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'ppt': 'application/vnd.ms-powerpoint',
  'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'txt': 'text/plain',
  'zip': 'application/zip'
}
```

---

## 🧪 Testing

### Test 1: Text Only (No Documents)
**Message:** "what products do you have?"
**Expected:** Text reply only, no documents

### Test 2: Request Document
**Message:** "send me the product catalog PDF"
**Expected:** Text reply + PDF file attachment

### Test 3: Request Multiple
**Message:** "send me the catalog and price list"
**Expected:** Text reply + 2 separate file attachments

### Test 4: Image + Document
**Message:** "show me the iPhone and send me the manual"
**Expected:** Text reply + product image + PDF manual

---

## 📱 Import Updated Workflow

1. **Go to your n8n instance**
2. **Import workflow:** `workflows/newest workflow.json`
3. **Verify AI Agent prompt** includes document instructions
4. **Test with WhatsApp message:** "send me a catalog"

---

## 🎯 Best Practices

### ✅ Do:
- Use descriptive file names (e.g., "Product Catalog 2024.pdf" not "doc123.pdf")
- Add helpful captions to explain what the document contains
- Only send documents when customer explicitly requests them
- Keep file sizes reasonable (< 10MB for faster delivery)

### ❌ Don't:
- Send documents for every query (only when requested)
- Use very large files (> 50MB may fail or be slow)
- Send broken or private URLs (must be publicly accessible)
- Forget to include file extension in fileName

---

## 🔍 Troubleshooting

### Document not sending?
1. Check if URL is publicly accessible (open in browser)
2. Verify file extension in fileName
3. Check Railway logs for errors: `railway logs --service whatsapp-web-service`
4. Ensure n8n response has correct JSON format

### Customer can't open file?
1. Verify MIME type matches file extension
2. Check if file is corrupted (download manually first)
3. Some file types may not be supported by customer's WhatsApp client

### Error in logs?
- "Error sending document" - Check URL accessibility
- "Failed to parse" - Check n8n JSON format
- "Timeout" - File may be too large

---

## 📊 Database Storage

Documents are stored in `whatsapp_web_messages` table with:
- `message_type`: 'document'
- `content`: "FileName.pdf: https://storage.com/file.pdf"
- `direction`: 'outbound'

---

## 🎉 Summary

**You can now:**
- ✅ Send PDF, DOCX, XLSX, PPT, TXT, ZIP files via WhatsApp
- ✅ AI automatically extracts document URLs from knowledge base
- ✅ Send both images AND documents in same response
- ✅ Customers receive files as downloadable attachments
- ✅ All documents tracked in database

**Next Steps:**
1. Import the updated workflow to n8n
2. Test with: "send me the product catalog"
3. Check Railway logs to verify successful sending
4. Add more PDF files to your knowledge base!

---

Need help? Check the Railway logs or test with a simple PDF first!
