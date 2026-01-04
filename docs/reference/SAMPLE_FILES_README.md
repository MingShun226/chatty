# Sample Files for Testing Chatbot Creation Wizard

This folder contains sample files to help you test the **Chatbot Creation Wizard**.

---

## 📄 Files Included

### 1. **sample_knowledge_base.md**
**Purpose:** Test the Knowledge Base upload in Step 3 of the wizard

**Content:**
- Complete business information for "ABC Electronics"
- Comprehensive FAQ covering:
  - Shipping & Delivery
  - Payment Methods
  - Warranty & Returns
  - Product Information
  - Store Operating Hours
  - Contact Information
  - Loyalty Program
  - Installation Services

**How to Use:**
1. Go to Step 3 of the Chatbot Creation Wizard
2. In the "Knowledge Base Documents" section, click "Select Files"
3. Choose `sample_knowledge_base.md`
4. The file will be listed as uploaded
5. The chatbot will use this information to answer customer questions

**File Format:** Markdown (.md)
**File Size:** ~8 KB
**Supported by Wizard:** ✅ Yes (PDF, TXT, DOCX, MD all supported)

---

### 2. **sample_products.csv**
**Purpose:** Test the Product Catalog Excel upload in Step 3 of the wizard

**Content:**
- 50 realistic Malaysian electronics products
- Categories:
  - Mobile Phones (4 products)
  - Laptops (4 products)
  - Tablets (2 products)
  - Home Appliances (10 products)
  - Audio & Entertainment (13 products)
  - Computer Accessories (12 products)
  - Wearables (2 products)
  - Mobile Accessories (3 products)

**Columns:**
- `SKU` - Unique product code (e.g., PHONE001, LAPTOP002)
- `Product Name` - Product title
- `Description` - Detailed product description
- `Price` - Price in Malaysian Ringgit (MYR)
- `Category` - Product category
- `Stock` - Available quantity
- `Image URL` - Product image link

**How to Use:**
1. Open `sample_products.csv` in Microsoft Excel or Google Sheets
2. **Save As** → Choose `.xlsx` format (Excel format)
3. Go to Step 3 of the Chatbot Creation Wizard
4. In the "Product Catalog (Excel)" section, click "Select Excel File"
5. Choose the `.xlsx` file you just saved
6. The wizard will upload and process the products

**File Format:** CSV (comma-separated values)
**Can be opened in:** Excel, Google Sheets, Numbers
**Total Products:** 50
**Price Range:** RM89 - RM8,999

---

### 3. **product_upload_template.csv**
**Purpose:** Template for creating your own product catalog

**Content:**
- Column headers with correct format
- 2 example rows with placeholder data
- Instructions in the description field

**How to Use:**
1. Open `product_upload_template.csv` in Excel
2. Delete the example rows
3. Add your own products following the column format:
   - **SKU:** Must be unique (e.g., PROD001, ITEM-ABC-123)
   - **Product Name:** Clear, descriptive name
   - **Description:** Detailed information about the product
   - **Price:** Numbers only, no currency symbol (e.g., 299.00)
   - **Category:** Product category (Mobile Phones, Laptops, etc.)
   - **Stock:** Number of units available (optional)
   - **Image URL:** Link to product image (optional)
4. Save as `.xlsx` format
5. Upload to the wizard

**Recommended:** Use this template when adding your real products!

---

## 🧪 Testing Scenarios

### Test 1: Complete Wizard Flow
**Steps:**
1. Start wizard: `/create-chatbot`
2. **Step 1:** Select "E-commerce" template
3. **Step 2:** Fill in:
   - Chatbot Name: "ABC Support Bot"
   - Company Name: "ABC Electronics"
   - Business Description: "Electronics retailer in Malaysia"
   - Languages: English, Bahasa Malaysia
   - Default Language: English
4. **Step 3:**
   - Upload `sample_knowledge_base.md`
   - Upload `sample_products.csv` (after converting to .xlsx)
5. Click "Create Chatbot"
6. Verify chatbot created successfully

**Expected Result:**
- Chatbot appears in database with all fields populated
- Redirects to Chatbot Studio

---

### Test 2: Knowledge Base Only (No Products)
**Steps:**
1. **Step 1:** Select "Customer Service" template
2. **Step 2:** Fill in basic information
3. **Step 3:** Upload only `sample_knowledge_base.md`, skip products
4. Create chatbot

**Expected Result:**
- Chatbot created successfully
- Can add products later in Chatbot Studio

---

### Test 3: Minimal Setup (No Uploads)
**Steps:**
1. **Step 1:** Select any template
2. **Step 2:** Fill in required fields only
3. **Step 3:** Skip all uploads
4. Create chatbot

**Expected Result:**
- Chatbot created with template defaults
- User can add knowledge base and products later

---

## 📊 Product Catalog Details

### Categories Breakdown:
```
Mobile Phones:        4 products  (RM799 - RM6,499)
Laptops:              4 products  (RM2,199 - RM8,999)
Tablets:              2 products  (RM2,899 - RM3,299)
Home Appliances:     10 products  (RM299 - RM5,299)
Audio & Entertainment:13 products (RM499 - RM6,499)
Computer Accessories: 12 products (RM89 - RM2,199)
Wearables:            2 products  (RM1,299 - RM2,199)
Mobile Accessories:   3 products  (RM89 - RM149)
```

### Price Distribution:
- Budget (< RM500): 8 products
- Mid-range (RM500-RM2,000): 22 products
- Premium (RM2,000-RM5,000): 14 products
- High-end (> RM5,000): 6 products

---

## 🔄 Converting CSV to Excel (.xlsx)

### Method 1: Microsoft Excel
1. Right-click `sample_products.csv`
2. Open with Microsoft Excel
3. File → Save As
4. Choose format: "Excel Workbook (.xlsx)"
5. Save

### Method 2: Google Sheets
1. Go to Google Sheets (sheets.google.com)
2. File → Import → Upload
3. Select `sample_products.csv`
4. File → Download → Microsoft Excel (.xlsx)

### Method 3: LibreOffice Calc (Free)
1. Open in LibreOffice Calc
2. File → Save As
3. Format: "Microsoft Excel 2007-365 (.xlsx)"
4. Save

---

## ✅ Validation Checklist

Before uploading products to the wizard:
- [ ] SKU column has unique values (no duplicates)
- [ ] Product Name is not empty
- [ ] Price is a valid number (no currency symbols)
- [ ] File is in `.xlsx` or `.xls` format
- [ ] File size is reasonable (< 10MB for 1000+ products)

---

## 💡 Tips for Real Products

1. **SKU Naming:**
   - Use consistent format (e.g., CAT-NUMBER)
   - Keep it short but descriptive
   - Example: PHONE-001, LAPTOP-ABC-123

2. **Product Descriptions:**
   - Include key specifications
   - Mention color, size, variants
   - Highlight unique selling points
   - Keep it concise (2-3 sentences)

3. **Pricing:**
   - Use decimal format (e.g., 299.00, not RM299)
   - Be consistent with decimal places
   - Ensure prices are current

4. **Images:**
   - Use direct image URLs (not webpage links)
   - Recommended: Use your own image hosting or Supabase Storage
   - Format: .jpg, .png, .webp
   - Fallback to placeholder if URL not available

5. **Categories:**
   - Use consistent category names
   - Group similar products together
   - Don't create too many categories (5-10 is ideal)

---

## 🐛 Troubleshooting

### "File upload failed"
- Check file format (must be .xlsx or .xls)
- Ensure file size < 10MB
- Verify file is not corrupted

### "Invalid product data"
- Check that all required columns exist
- Ensure no empty Product Names
- Verify prices are numbers (not text)

### "Duplicate SKU error"
- Each SKU must be unique
- Check for copy-paste errors
- Use Excel conditional formatting to find duplicates

---

## 📧 Support

If you encounter issues with the sample files:
1. Check file formats match requirements
2. Verify Excel/CSV structure
3. Try with fewer products first (10-20)
4. Review error messages for specific issues

---

**Created:** December 2025
**Last Updated:** December 26, 2025

Happy Testing! 🚀
