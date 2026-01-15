// Supabase Edge Function for Chatbot Data API
// Endpoints:
// - GET /chatbot-data?type=catalog&chatbot_id={id} (RECOMMENDED - returns FULL catalog grouped by category)
// - GET /chatbot-data?type=products&chatbot_id={id}&query={search}&limit={limit}
// - GET /chatbot-data?type=promotions&chatbot_id={id}
// - GET /chatbot-data?type=knowledge&chatbot_id={id}&query={search}
// - GET /chatbot-data?type=categories&chatbot_id={id}
//
// This API is designed for AI agents (n8n) to fetch data on-demand
// instead of receiving all data in the webhook payload

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get API key from header
    const apiKey = req.headers.get('x-api-key')
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Missing API key. Include x-api-key header.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Verify API key
    const { data: keyData, error: keyError } = await supabase
      .rpc('verify_platform_api_key', { p_api_key: apiKey })
      .single()

    if (keyError || !keyData || !keyData.is_valid) {
      return new Response(
        JSON.stringify({ error: 'Invalid or inactive API key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse query parameters
    const url = new URL(req.url)
    const dataType = url.searchParams.get('type')
    const chatbotId = url.searchParams.get('chatbot_id')
    const query = url.searchParams.get('query') || ''
    const limit = parseInt(url.searchParams.get('limit') || '20')
    const category = url.searchParams.get('category')
    const promoCode = url.searchParams.get('promo_code')

    if (!chatbotId) {
      return new Response(
        JSON.stringify({ error: 'Missing chatbot_id query parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!dataType || !['catalog', 'products', 'promotions', 'knowledge', 'categories', 'validate_promo'].includes(dataType)) {
      return new Response(
        JSON.stringify({
          error: 'Invalid or missing type parameter',
          valid_types: ['catalog', 'products', 'promotions', 'knowledge', 'categories', 'validate_promo'],
          recommended: 'Use type=catalog to get the FULL product catalog grouped by category (best for AI)'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check for required scope based on data type
    const requiredScope = {
      catalog: 'products',
      products: 'products',
      categories: 'products',
      promotions: 'promotions',
      validate_promo: 'promotions',
      knowledge: 'knowledge'
    }[dataType]

    if (requiredScope && !keyData.scopes.includes(requiredScope)) {
      return new Response(
        JSON.stringify({ error: `API key does not have '${requiredScope}' permission` }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if API key is restricted to specific avatar/chatbot
    if (keyData.avatar_id && keyData.avatar_id !== chatbotId) {
      return new Response(
        JSON.stringify({ error: 'API key does not have access to this chatbot' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userId = keyData.user_id

    // Verify chatbot exists and belongs to user
    const { data: chatbot, error: chatbotError } = await supabase
      .from('avatars')
      .select('id, name')
      .eq('id', chatbotId)
      .eq('user_id', userId)
      .single()

    if (chatbotError || !chatbot) {
      return new Response(
        JSON.stringify({ error: 'Chatbot not found or access denied' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let responseData: any = {}

    // Handle different data types
    switch (dataType) {
      case 'catalog': {
        // RECOMMENDED: Returns the FULL product catalog grouped by category
        // This is better for AI to intelligently match products to user requests
        const includeOutOfStock = url.searchParams.get('include_out_of_stock') === 'true'

        let catalogQuery = supabase
          .from('chatbot_products')
          .select('*')
          .eq('chatbot_id', chatbotId)
          .order('category', { ascending: true })
          .order('product_name', { ascending: true })

        if (!includeOutOfStock) {
          catalogQuery = catalogQuery.eq('in_stock', true)
        }

        const { data: products, error: catalogError } = await catalogQuery

        if (catalogError) {
          console.error('Error fetching catalog:', catalogError)
          throw new Error('Failed to fetch catalog')
        }

        // Fetch active promotions to apply discounts
        const { data: activePromotions } = await supabase
          .from('chatbot_promotions')
          .select('*')
          .eq('chatbot_id', chatbotId)
          .eq('is_active', true)

        // Filter promotions by valid date range
        const now = new Date()
        const validPromotions = (activePromotions || []).filter(promo => {
          const startDate = promo.start_date ? new Date(promo.start_date) : null
          const endDate = promo.end_date ? new Date(promo.end_date) : null
          const afterStart = !startDate || now >= startDate
          const beforeEnd = !endDate || now <= endDate
          const notMaxedOut = !promo.max_uses || promo.current_uses < promo.max_uses
          return afterStart && beforeEnd && notMaxedOut
        })

        // Helper function to find applicable promotions for a product
        const findApplicablePromotions = (product: any) => {
          return validPromotions.filter(promo => {
            const appliesTo = promo.applies_to || 'all'
            if (appliesTo === 'all') {
              return true
            } else if (appliesTo === 'category' && promo.applies_to_categories) {
              return promo.applies_to_categories.includes(product.category)
            } else if (appliesTo === 'products' && promo.applies_to_product_ids) {
              return promo.applies_to_product_ids.includes(product.id)
            }
            return false
          })
        }

        // Helper function to calculate discounted price
        const calculateDiscountedPrice = (originalPrice: number, promo: any) => {
          if (!originalPrice || !promo) return originalPrice
          let discount = 0
          if (promo.discount_type === 'percentage') {
            discount = originalPrice * (promo.discount_value / 100)
            if (promo.max_discount && discount > promo.max_discount) {
              discount = promo.max_discount
            }
          } else if (promo.discount_type === 'fixed') {
            discount = promo.discount_value
          }
          const discountedPrice = Math.max(0, originalPrice - discount)
          return Math.round(discountedPrice * 100) / 100
        }

        // Process products with promotions
        const processedProducts = (products || []).map(p => {
          const applicablePromotions = findApplicablePromotions(p)
          let salePrice = null
          let appliedPromotion = null
          let discountDisplay = null

          if (applicablePromotions.length > 0 && p.price) {
            let bestDiscount = 0
            for (const promo of applicablePromotions) {
              const discountedPrice = calculateDiscountedPrice(p.price, promo)
              const currentDiscount = p.price - discountedPrice
              if (currentDiscount > bestDiscount) {
                bestDiscount = currentDiscount
                salePrice = discountedPrice
                appliedPromotion = {
                  title: promo.title,
                  promo_code: promo.promo_code,
                  discount_type: promo.discount_type,
                  discount_value: promo.discount_value
                }
                discountDisplay = promo.discount_type === 'percentage'
                  ? `${promo.discount_value}% OFF`
                  : `RM${promo.discount_value} OFF`
              }
            }
          }

          return {
            id: p.id,
            name: p.product_name,
            sku: p.sku,
            category: p.category || 'Uncategorized',
            description: p.description,
            price: p.price,
            sale_price: salePrice,
            has_discount: salePrice !== null && salePrice < p.price,
            discount_display: discountDisplay,
            applied_promotion: appliedPromotion,
            currency: p.currency || 'MYR',
            in_stock: p.in_stock,
            stock_quantity: p.stock_quantity,
            image_url: p.primary_image_url || p.images?.[0] || null,
            has_image: !!(p.primary_image_url || p.images?.[0])
          }
        })

        // Group by category for easier AI understanding
        const productsByCategory: Record<string, any[]> = {}
        processedProducts.forEach((p: any) => {
          const cat = p.category
          if (!productsByCategory[cat]) productsByCategory[cat] = []
          productsByCategory[cat].push(p)
        })

        responseData = {
          type: 'catalog',
          total_products: processedProducts.length,
          categories: Object.keys(productsByCategory),
          products_by_category: productsByCategory,
          all_products: processedProducts,
          active_promotions_count: validPromotions.length,
          note: 'This is the COMPLETE catalog. AI should use its intelligence to recommend relevant products based on what the customer is asking for. Use product names, categories, and descriptions to match user intent.'
        }
        break
      }

      case 'products': {
        let productsQuery = supabase
          .from('chatbot_products')
          .select('*')
          .eq('chatbot_id', chatbotId)

        // Apply search filter if query provided
        if (query) {
          productsQuery = productsQuery.or(
            `product_name.ilike.%${query}%,category.ilike.%${query}%,sku.ilike.%${query}%,description.ilike.%${query}%`
          )
        }

        // Apply category filter if provided
        if (category) {
          productsQuery = productsQuery.eq('category', category)
        }

        const { data: products, error: productsError } = await productsQuery
          .order('created_at', { ascending: false })
          .limit(limit)

        if (productsError) {
          console.error('Error fetching products:', productsError)
          throw new Error('Failed to fetch products')
        }

        // Fetch active promotions to apply discounts
        const { data: activePromotions } = await supabase
          .from('chatbot_promotions')
          .select('*')
          .eq('chatbot_id', chatbotId)
          .eq('is_active', true)

        // Filter promotions by valid date range
        const now = new Date()
        const validPromotions = (activePromotions || []).filter(promo => {
          const startDate = promo.start_date ? new Date(promo.start_date) : null
          const endDate = promo.end_date ? new Date(promo.end_date) : null
          const afterStart = !startDate || now >= startDate
          const beforeEnd = !endDate || now <= endDate
          const notMaxedOut = !promo.max_uses || promo.current_uses < promo.max_uses
          return afterStart && beforeEnd && notMaxedOut
        })

        // Helper function to find applicable promotions for a product
        const findApplicablePromotions = (product: any) => {
          return validPromotions.filter(promo => {
            const appliesTo = promo.applies_to || 'all'

            if (appliesTo === 'all') {
              return true
            } else if (appliesTo === 'category' && promo.applies_to_categories) {
              return promo.applies_to_categories.includes(product.category)
            } else if (appliesTo === 'products' && promo.applies_to_product_ids) {
              return promo.applies_to_product_ids.includes(product.id)
            }
            return false
          })
        }

        // Helper function to calculate discounted price
        const calculateDiscountedPrice = (originalPrice: number, promo: any) => {
          if (!originalPrice || !promo) return originalPrice

          let discount = 0
          if (promo.discount_type === 'percentage') {
            discount = originalPrice * (promo.discount_value / 100)
            // Apply max_discount cap if set
            if (promo.max_discount && discount > promo.max_discount) {
              discount = promo.max_discount
            }
          } else if (promo.discount_type === 'fixed') {
            discount = promo.discount_value
          }

          const discountedPrice = Math.max(0, originalPrice - discount)
          return Math.round(discountedPrice * 100) / 100 // Round to 2 decimal places
        }

        // Map products with applied promotions
        const productsWithPromotions = (products || []).map(p => {
          const applicablePromotions = findApplicablePromotions(p)
          let salePrice = null
          let appliedPromotion = null
          let discountDisplay = null

          // Find the best promotion (highest discount)
          if (applicablePromotions.length > 0 && p.price) {
            let bestDiscount = 0
            for (const promo of applicablePromotions) {
              const discountedPrice = calculateDiscountedPrice(p.price, promo)
              const currentDiscount = p.price - discountedPrice
              if (currentDiscount > bestDiscount) {
                bestDiscount = currentDiscount
                salePrice = discountedPrice
                appliedPromotion = {
                  id: promo.id,
                  title: promo.title,
                  promo_code: promo.promo_code,
                  discount_type: promo.discount_type,
                  discount_value: promo.discount_value
                }
                discountDisplay = promo.discount_type === 'percentage'
                  ? `${promo.discount_value}% OFF`
                  : `RM${promo.discount_value} OFF`
              }
            }
          }

          return {
            id: p.id,
            name: p.product_name,
            sku: p.sku,
            category: p.category,
            description: p.description,
            price: p.price,
            original_price: p.price,
            sale_price: salePrice,
            has_discount: salePrice !== null && salePrice < p.price,
            discount_display: discountDisplay,
            applied_promotion: appliedPromotion,
            currency: p.currency || 'MYR',
            stock_quantity: p.stock_quantity,
            in_stock: p.in_stock,
            image_url: p.images?.[0] || null,
            images: p.images || [],
            specifications: p.specifications,
            tags: p.tags,
            is_active: p.is_active
          }
        })

        responseData = {
          type: 'products',
          count: productsWithPromotions.length,
          query: query || null,
          category: category || null,
          active_promotions_count: validPromotions.length,
          items: productsWithPromotions
        }
        break
      }

      case 'categories': {
        const { data: products } = await supabase
          .from('chatbot_products')
          .select('category')
          .eq('chatbot_id', chatbotId)
          .not('category', 'is', null)

        const categories = [...new Set(products?.map(p => p.category).filter(Boolean))]

        responseData = {
          type: 'categories',
          count: categories.length,
          items: categories
        }
        break
      }

      case 'promotions': {
        const { data: promotions, error: promotionsError } = await supabase
          .from('chatbot_promotions')
          .select('*')
          .eq('chatbot_id', chatbotId)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(limit)

        if (promotionsError) {
          console.error('Error fetching promotions:', promotionsError)
          throw new Error('Failed to fetch promotions')
        }

        // Filter by valid date range
        const now = new Date()
        const activePromotions = (promotions || []).filter(promo => {
          const startDate = promo.start_date ? new Date(promo.start_date) : null
          const endDate = promo.end_date ? new Date(promo.end_date) : null

          const afterStart = !startDate || now >= startDate
          const beforeEnd = !endDate || now <= endDate
          const notMaxedOut = !promo.max_uses || promo.current_uses < promo.max_uses

          return afterStart && beforeEnd && notMaxedOut
        })

        responseData = {
          type: 'promotions',
          count: activePromotions.length,
          items: activePromotions.map(promo => ({
            id: promo.id,
            title: promo.title,
            description: promo.description,
            promo_code: promo.promo_code,
            discount_type: promo.discount_type,
            discount_value: promo.discount_value,
            discount_display: promo.discount_type === 'percentage'
              ? `${promo.discount_value}% OFF`
              : promo.discount_value ? `RM${promo.discount_value} OFF` : null,
            min_purchase: promo.min_purchase,
            max_discount: promo.max_discount,
            valid_from: promo.start_date,
            valid_until: promo.end_date,
            terms: promo.terms_and_conditions,
            banner_image: promo.banner_image_url,
            applicable_products: promo.applicable_products,
            applicable_categories: promo.applicable_categories
          }))
        }
        break
      }

      case 'validate_promo': {
        if (!promoCode) {
          return new Response(
            JSON.stringify({ error: 'Missing promo_code parameter for validate_promo type' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const { data: promo } = await supabase
          .from('chatbot_promotions')
          .select('*')
          .eq('chatbot_id', chatbotId)
          .ilike('promo_code', promoCode)
          .eq('is_active', true)
          .single()

        if (!promo) {
          responseData = {
            type: 'validate_promo',
            valid: false,
            message: `Promo code "${promoCode}" is not valid or does not exist`
          }
        } else {
          // Check date validity
          const now = new Date()
          const startDate = promo.start_date ? new Date(promo.start_date) : null
          const endDate = promo.end_date ? new Date(promo.end_date) : null

          if (startDate && now < startDate) {
            responseData = {
              type: 'validate_promo',
              valid: false,
              message: `Promo code "${promoCode}" is not active yet. Starts on ${promo.start_date}`,
              start_date: promo.start_date
            }
          } else if (endDate && now > endDate) {
            responseData = {
              type: 'validate_promo',
              valid: false,
              message: `Promo code "${promoCode}" has expired on ${promo.end_date}`,
              end_date: promo.end_date
            }
          } else if (promo.max_uses && promo.current_uses >= promo.max_uses) {
            responseData = {
              type: 'validate_promo',
              valid: false,
              message: `Promo code "${promoCode}" has reached its maximum usage limit`
            }
          } else {
            // Promo is valid
            responseData = {
              type: 'validate_promo',
              valid: true,
              message: `Promo code "${promoCode}" is valid!`,
              promotion: {
                title: promo.title,
                description: promo.description,
                discount_type: promo.discount_type,
                discount_value: promo.discount_value,
                discount_display: promo.discount_type === 'percentage'
                  ? `${promo.discount_value}% OFF`
                  : `RM${promo.discount_value} OFF`,
                min_purchase: promo.min_purchase,
                valid_until: promo.end_date,
                terms: promo.terms_and_conditions
              }
            }
          }
        }
        break
      }

      case 'knowledge': {
        // Fetch ALL knowledge files with download URLs
        const { data: knowledgeFiles, error: filesError } = await supabase
          .from('avatar_knowledge_files')
          .select('id, file_name, original_name, file_path, content_type, processing_status, file_size, uploaded_at')
          .eq('avatar_id', chatbotId)
          .eq('user_id', userId)
          .eq('is_linked', true)

        if (filesError) {
          console.error('Error fetching knowledge files:', filesError)
        }

        // Generate public/signed URLs for each file
        const filesWithUrls = await Promise.all(
          (knowledgeFiles || []).map(async (file) => {
            let fileUrl = null
            if (file.file_path) {
              // Try public URL first
              const { data: publicUrlData } = supabase.storage
                .from('avatar-files')
                .getPublicUrl(file.file_path)

              if (publicUrlData?.publicUrl) {
                fileUrl = publicUrlData.publicUrl
              } else {
                // Fallback to signed URL (1 hour expiry)
                const { data: signedUrlData } = await supabase.storage
                  .from('avatar-files')
                  .createSignedUrl(file.file_path, 3600)
                fileUrl = signedUrlData?.signedUrl || null
              }
            }
            return {
              id: file.id,
              name: file.original_name || file.file_name,
              type: file.content_type,
              status: file.processing_status,
              size: file.file_size,
              uploaded_at: file.uploaded_at,
              download_url: fileUrl
            }
          })
        )

        // Fetch ALL knowledge chunks (no limit by default, but respect limit param if provided)
        const { data: allChunks, error: chunksError } = await supabase
          .from('document_chunks')
          .select('chunk_text, chunk_index, page_number, section_title, knowledge_file_id')
          .eq('avatar_id', chatbotId)
          .eq('user_id', userId)
          .order('knowledge_file_id', { ascending: true })
          .order('chunk_index', { ascending: true })

        if (chunksError) {
          console.error('Error fetching knowledge chunks:', chunksError)
          throw new Error('Failed to fetch knowledge base')
        }

        // Group chunks by file for easier AI processing
        const chunksByFile: Record<string, any[]> = {}
        for (const chunk of (allChunks || [])) {
          const fileId = chunk.knowledge_file_id
          if (!chunksByFile[fileId]) {
            chunksByFile[fileId] = []
          }
          chunksByFile[fileId].push({
            content: chunk.chunk_text,
            chunk_index: chunk.chunk_index,
            page_number: chunk.page_number,
            section_title: chunk.section_title
          })
        }

        // Combine files with their chunks
        const knowledgeData = filesWithUrls.map(file => ({
          ...file,
          chunks: chunksByFile[file.id] || [],
          chunks_count: (chunksByFile[file.id] || []).length
        }))

        responseData = {
          type: 'knowledge',
          files_count: filesWithUrls.length,
          total_chunks: allChunks?.length || 0,
          files: knowledgeData,
          // Also provide flat chunks array if query is provided for backward compatibility
          ...(query ? {
            query: query,
            search_hint: 'Use the chunks content to find relevant information. Return the file download_url to users when they need the document.'
          } : {
            usage_hint: 'Search through file chunks to find relevant information. Share download_url with users when they need the actual document.'
          })
        }
        break
      }
    }

    // Log the request
    await supabase.from('api_request_logs').insert({
      api_key_id: keyData.key_id,
      user_id: userId,
      endpoint: `/chatbot-data?type=${dataType}`,
      method: 'GET',
      status_code: 200
    })

    // Update API key usage
    await supabase.rpc('increment_api_key_usage', {
      p_key_id: keyData.key_id
    })

    return new Response(
      JSON.stringify({
        success: true,
        chatbot_id: chatbotId,
        chatbot_name: chatbot.name,
        ...responseData
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error: any) {
    console.error('Error in chatbot-data function:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
