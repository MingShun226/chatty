-- Add targeting columns to chatbot_promotions table
-- Allows promotions to be applied to all products, specific categories, or specific products

-- Add applies_to column (all, category, or products)
ALTER TABLE chatbot_promotions
ADD COLUMN IF NOT EXISTS applies_to TEXT DEFAULT 'all' CHECK (applies_to IN ('all', 'category', 'products'));

-- Add applies_to_categories column (array of category names)
ALTER TABLE chatbot_promotions
ADD COLUMN IF NOT EXISTS applies_to_categories TEXT[];

-- Add applies_to_product_ids column (array of product UUIDs)
ALTER TABLE chatbot_promotions
ADD COLUMN IF NOT EXISTS applies_to_product_ids UUID[];

-- Add comments for clarity
COMMENT ON COLUMN chatbot_promotions.applies_to IS 'Targeting type: all (all products), category (specific categories), products (specific products)';
COMMENT ON COLUMN chatbot_promotions.applies_to_categories IS 'Array of category names this promotion applies to (when applies_to = category)';
COMMENT ON COLUMN chatbot_promotions.applies_to_product_ids IS 'Array of product IDs this promotion applies to (when applies_to = products)';

-- Update existing rows to have applies_to = 'all' (apply to all products by default)
UPDATE chatbot_promotions SET applies_to = 'all' WHERE applies_to IS NULL;
