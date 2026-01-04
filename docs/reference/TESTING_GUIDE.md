# 🧪 Testing Guide - Business Chatbot Platform

**Last Updated:** December 26, 2025
**Status:** ✅ All Features Implemented & Ready to Test

---

## 🎉 What's Been Implemented

### ✅ Completed Features:

1. **📊 Excel Product Import**
   - Upload Excel files (.xlsx, .xls)
   - Parse and validate product data
   - Bulk import up to 1000+ products
   - Track import progress and errors
   - Download product template

2. **🛍️ Product Gallery**
   - Display all products with images
   - Search by name, SKU, or category
   - View product details (price, stock, category)
   - Delete products
   - Real-time filtering

3. **⚙️ Chatbot Settings**
   - Edit business context
   - Manage compliance rules
   - Manage response guidelines
   - View language settings

4. **📝 Services Created:**
   - `ProductService` - Database operations for products
   - `ExcelImportService` - Excel parsing and validation
   - `TemplateService` - Industry templates

---

## 🚀 Quick Start Testing

### Step 1: Access Chatbot Studio

1. Navigate to your chatbot (the one you just created)
2. You should see **6 tabs**: Settings, Products, Knowledge, Fine-tune, Test Chat, Versions
3. Current view: **Settings tab** (default)

---

### Step 2: Test Product Import

#### Option A: Use Sample Products CSV

1. **Convert CSV to Excel:**
   - Open `sample_products.csv` in Microsoft Excel
   - File → Save As → Choose "Excel Workbook (.xlsx)"
   - Save as `sample_products.xlsx`

2. **Go to Products Tab:**
   - Click the "Products" tab
   - You should see an empty state with "No Products Yet"

3. **Upload Excel File:**
   - Click "Upload Excel" button
   - Select `sample_products.xlsx`
   - Watch the progress indicator

4. **Expected Result:**
   - Import progress modal appears
   - Shows "Successful: 50, Failed: 0, Total: 50"
   - Products grid displays with 50 products
   - Each product shows: image, name, price, SKU, category, stock

#### Option B: Download Template & Add Your Own

1. **Download Template:**
   - In Products tab, click "Download Template"
   - Opens `product_template.xlsx` with 2 example rows

2. **Add Your Products:**
   - Fill in your products (columns: SKU, Product Name, Description, Price, Category, Stock, Image URL)
   - Save the file

3. **Upload:**
   - Click "Upload Excel"
   - Select your file
   - Verify import results

---

### Step 3: Test Product Search & Filter

1. **Search by Name:**
   - In the search box, type "Samsung"
   - Should filter to show only Samsung products

2. **Search by SKU:**
   - Type "PHONE001"
   - Should show only that specific product

3. **Search by Category:**
   - Type "Laptops"
   - Should show all laptop products

4. **Clear Search:**
   - Clear the search box
   - All products reappear

---

### Step 4: Test Product Deletion

1. **Delete a Product:**
   - Find any product card
   - Click the "Delete" button
   - Confirm the deletion prompt
   - Product disappears from the grid
   - Product count updates

2. **Verify Deletion:**
   - Refresh the page
   - Product should still be gone (deleted from database)

---

### Step 5: Test Settings Tab

1. **Go to Settings Tab:**
   - Click "Settings" tab at the top
   - View your chatbot configuration

2. **Edit Mode:**
   - Click "Edit Settings" button
   - All fields become editable

3. **Edit Business Context:**
   - Modify the business description
   - Click "Save Changes"
   - Success message appears

4. **Add Compliance Rule:**
   - In edit mode, click "Add Rule" under Compliance Rules
   - Type a new rule (e.g., "Always verify customer identity")
   - Click "Save Changes"
   - New rule appears in the list

5. **Add Response Guideline:**
   - Click "Add Guideline" under Response Guidelines
   - Type a guideline (e.g., "Be empathetic and understanding")
   - Save changes

---

## 📊 Database Verification

### Check Products in Supabase

1. **Open Supabase Dashboard** → SQL Editor
2. **Run this query:**

```sql
-- Check total products imported
SELECT COUNT(*) as total_products
FROM chatbot_products;

-- View first 10 products
SELECT
  sku,
  product_name,
  price,
  category,
  stock_quantity,
  in_stock
FROM chatbot_products
ORDER BY created_at DESC
LIMIT 10;

-- Get products by chatbot
SELECT
  COUNT(*) as product_count,
  chatbot_id
FROM chatbot_products
GROUP BY chatbot_id;
```

### Check Upload History

```sql
-- Check import jobs
SELECT
  filename,
  total_rows,
  successful_imports,
  failed_imports,
  status,
  created_at
FROM chatbot_product_uploads
ORDER BY created_at DESC
LIMIT 5;
```

---

## 🎨 Features to Test

### Product Gallery Features:

- [x] Upload Excel file (.xlsx, .xls)
- [x] Download product template
- [x] Display products in grid (3 columns on desktop)
- [x] Show product images (fallback to placeholder if broken)
- [x] Display price in MYR with 2 decimal places
- [x] Show stock status (In Stock / Out of Stock)
- [x] Show SKU badge
- [x] Show category badge
- [x] Search products (real-time filtering)
- [x] Delete individual products
- [x] Import progress modal
- [x] Success/error notifications
- [x] Empty state with helpful instructions

### Chatbot Settings Features:

- [x] View mode (read-only)
- [x] Edit mode (all fields editable)
- [x] Save changes to database
- [x] Cancel edits (revert to original)
- [x] Edit chatbot name
- [x] Edit company name
- [x] Edit business context (multi-line textarea)
- [x] Add/remove compliance rules
- [x] Add/remove response guidelines
- [x] View supported languages (read-only for now)
- [x] View default language

---

## 🐛 Common Issues & Solutions

### Issue 1: Excel Upload Fails

**Symptoms:** "Invalid File" error or upload doesn't work

**Solutions:**
- ✅ Ensure file is .xlsx or .xls format (not .csv)
- ✅ Check that required columns exist: SKU, Product Name, Price
- ✅ Ensure Price column contains numbers (not text like "RM 100")
- ✅ Remove any empty rows at the end of Excel file

### Issue 2: Products Don't Appear After Upload

**Symptoms:** Upload successful but grid still empty

**Solutions:**
- ✅ Refresh the page (Ctrl+R or Cmd+R)
- ✅ Check Supabase SQL query to verify products exist
- ✅ Check browser console for errors (F12)

### Issue 3: Images Don't Load

**Symptoms:** Broken image icons or placeholder images

**Solutions:**
- ✅ Verify Image URL column has valid HTTP/HTTPS URLs
- ✅ Check if image URLs are accessible (open in new tab)
- ✅ System falls back to placeholder if URL is invalid (expected behavior)

### Issue 4: Search Doesn't Work

**Symptoms:** Typing in search box doesn't filter products

**Solutions:**
- ✅ Make sure you're in the Products tab
- ✅ Try searching for exact product name or SKU
- ✅ Refresh the page and try again

---

## ✅ Expected Behavior

### Excel Import Process:

1. Click "Upload Excel"
2. Select file
3. **Progress modal appears** (blue border)
4. **Shows:** Uploading... (with spinner)
5. **After completion:**
   - Green checkmark icon
   - "Successful: X" count (green)
   - "Failed: Y" count (red)
   - "Total: Z" count (blue)
6. Products grid refreshes automatically
7. Products appear in grid

### Product Grid Display:

- **Mobile:** 1 column
- **Tablet:** 2 columns
- **Desktop:** 3 columns
- **Each card shows:**
  - Product image (or placeholder)
  - Product name (max 2 lines)
  - SKU badge (top-right)
  - Description (max 2 lines, truncated)
  - Price (bold, blue, RM format)
  - Stock badge (green if in stock, red if out)
  - Category badge (if available)
  - Delete button (red, bottom)

### Search Behavior:

- **Real-time filtering** (updates as you type)
- **Case-insensitive**
- **Searches:** Product Name, SKU, Category
- **Shows count:** "X of Y shown"
- **Empty state** if no matches: "No Products Found"

---

## 📈 Performance Testing

### Test Large Import:

1. Use `sample_products.csv` (50 products)
2. Upload should complete in **< 5 seconds**
3. Grid should render all products smoothly

### Test with 1000+ Products:

1. Duplicate rows in Excel to create 1000+ rows
2. Upload (may take 10-20 seconds)
3. Grid should still be responsive
4. Search should still work fast

---

## 🎯 Next Steps (Future Enhancements)

### Not Yet Implemented:

- [ ] **Manual product entry** (form to add 1 product at a time)
- [ ] **Edit existing products** (click product to edit)
- [ ] **Product categories filter** (dropdown to filter by category)
- [ ] **Bulk delete** (select multiple products to delete)
- [ ] **Export products to Excel** (download current products)
- [ ] **Product image upload** (upload images to Supabase Storage)
- [ ] **Product variants** (size, color options)

These can be added later based on user feedback!

---

## 📞 Support

If you encounter any issues:

1. **Check Browser Console** (F12 → Console tab)
2. **Check Network Tab** (F12 → Network) for failed requests
3. **Check Supabase Logs** (Dashboard → Logs)
4. **Verify Database** with SQL queries provided above

---

## 🎉 Success Checklist

After testing, you should have:

- [x] 50 products imported from `sample_products.csv`
- [x] Products visible in grid with images
- [x] Search working for name, SKU, category
- [x] Delete working (removes from database)
- [x] Settings editable and saving correctly
- [x] All tabs accessible (Settings, Products, Knowledge, Fine-tune, Test Chat, Versions)

**Status:** ✅ Platform fully functional for product management!

---

**Happy Testing! 🚀**

If everything works as expected, you're ready to onboard real businesses to your platform!
