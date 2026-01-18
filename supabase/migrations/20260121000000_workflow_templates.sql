-- Create workflow_templates table for admin-managed n8n workflow templates
-- These templates are used for setting up chatbots for different use cases

CREATE TABLE IF NOT EXISTS public.workflow_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  workflow_type VARCHAR(50) NOT NULL DEFAULT 'ecommerce',
  template_json TEXT NOT NULL,
  version VARCHAR(20) DEFAULT '1.0.0',
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraint for valid workflow types
  CONSTRAINT valid_workflow_type CHECK (
    workflow_type IN ('ecommerce', 'appointment', 'property', 'support', 'custom')
  )
);

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_workflow_templates_type ON public.workflow_templates(workflow_type);
CREATE INDEX IF NOT EXISTS idx_workflow_templates_active ON public.workflow_templates(is_active);

-- Enable RLS
ALTER TABLE public.workflow_templates ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can view all templates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'workflow_templates'
    AND policyname = 'Admins can view all workflow templates'
  ) THEN
    CREATE POLICY "Admins can view all workflow templates"
    ON public.workflow_templates
    FOR SELECT
    TO authenticated
    USING (public.is_admin());
  END IF;
END $$;

-- Policy: Admins can insert templates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'workflow_templates'
    AND policyname = 'Admins can create workflow templates'
  ) THEN
    CREATE POLICY "Admins can create workflow templates"
    ON public.workflow_templates
    FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin());
  END IF;
END $$;

-- Policy: Admins can update templates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'workflow_templates'
    AND policyname = 'Admins can update workflow templates'
  ) THEN
    CREATE POLICY "Admins can update workflow templates"
    ON public.workflow_templates
    FOR UPDATE
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());
  END IF;
END $$;

-- Policy: Admins can delete templates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'workflow_templates'
    AND policyname = 'Admins can delete workflow templates'
  ) THEN
    CREATE POLICY "Admins can delete workflow templates"
    ON public.workflow_templates
    FOR DELETE
    TO authenticated
    USING (public.is_admin());
  END IF;
END $$;

-- Add comment explaining the table
COMMENT ON TABLE public.workflow_templates IS 'Stores n8n workflow templates for different chatbot use cases (e-commerce, appointment, property, support)';
COMMENT ON COLUMN public.workflow_templates.workflow_type IS 'Type of workflow: ecommerce, appointment, property, support, or custom';
COMMENT ON COLUMN public.workflow_templates.template_json IS 'The n8n workflow JSON that can be exported and imported';

-- Seed the default e-commerce workflow template
-- This template is based on the existing n8n-workflow-template.json
INSERT INTO public.workflow_templates (
  name,
  description,
  workflow_type,
  version,
  is_active,
  template_json
) VALUES (
  'E-commerce WhatsApp Chatbot',
  'Complete WhatsApp chatbot workflow for e-commerce businesses. Includes product catalog browsing, promotions, knowledge base, media handling (image/audio/video/document analysis), and AI-powered responses with memory.',
  'ecommerce',
  '1.0.0',
  true,
  $JSON$
{
  "name": "AvatarLab WhatsApp Chatbot Template",
  "nodes": [
    {
      "parameters": {
        "httpMethod": "POST",
        "path": "YOUR_WEBHOOK_PATH",
        "responseMode": "responseNode",
        "options": {}
      },
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 2.1,
      "position": [400, 300],
      "id": "webhook-node",
      "name": "Webhook",
      "webhookId": "YOUR_WEBHOOK_ID"
    },
    {
      "parameters": {
        "rules": {
          "values": [
            {
              "conditions": {
                "options": {
                  "caseSensitive": true,
                  "leftValue": "",
                  "typeValidation": "strict",
                  "version": 3
                },
                "conditions": [
                  {
                    "leftValue": "={{ $json.body.media.type }}",
                    "rightValue": "image",
                    "operator": {
                      "type": "string",
                      "operation": "equals"
                    }
                  }
                ],
                "combinator": "and"
              },
              "renameOutput": true,
              "outputKey": "Image"
            },
            {
              "conditions": {
                "options": {
                  "caseSensitive": true,
                  "leftValue": "",
                  "typeValidation": "strict",
                  "version": 3
                },
                "conditions": [
                  {
                    "leftValue": "={{ $json.body.media.type }}",
                    "rightValue": "audio",
                    "operator": {
                      "type": "string",
                      "operation": "equals"
                    }
                  }
                ],
                "combinator": "and"
              },
              "renameOutput": true,
              "outputKey": "Audio"
            },
            {
              "conditions": {
                "options": {
                  "caseSensitive": true,
                  "leftValue": "",
                  "typeValidation": "strict",
                  "version": 3
                },
                "conditions": [
                  {
                    "leftValue": "={{ $json.body.message_type }}",
                    "rightValue": "text",
                    "operator": {
                      "type": "string",
                      "operation": "equals"
                    }
                  }
                ],
                "combinator": "and"
              },
              "renameOutput": true,
              "outputKey": "Text"
            },
            {
              "conditions": {
                "options": {
                  "caseSensitive": true,
                  "leftValue": "",
                  "typeValidation": "strict",
                  "version": 3
                },
                "conditions": [
                  {
                    "leftValue": "={{ $json.body.media.type }}",
                    "rightValue": "document",
                    "operator": {
                      "type": "string",
                      "operation": "equals"
                    }
                  }
                ],
                "combinator": "and"
              },
              "renameOutput": true,
              "outputKey": "Document"
            },
            {
              "conditions": {
                "options": {
                  "caseSensitive": true,
                  "leftValue": "",
                  "typeValidation": "strict",
                  "version": 3
                },
                "conditions": [
                  {
                    "leftValue": "={{ $json.body.media.type }}",
                    "rightValue": "video",
                    "operator": {
                      "type": "string",
                      "operation": "equals"
                    }
                  }
                ],
                "combinator": "and"
              },
              "renameOutput": true,
              "outputKey": "Video"
            }
          ]
        },
        "options": {}
      },
      "type": "n8n-nodes-base.switch",
      "typeVersion": 3.4,
      "position": [600, 300],
      "id": "switch-node",
      "name": "Switch"
    },
    {
      "parameters": {
        "resource": "image",
        "operation": "analyze",
        "modelId": {
          "__rl": true,
          "value": "gpt-4o-mini",
          "mode": "list",
          "cachedResultName": "GPT-4O-MINI"
        },
        "imageUrls": "={{ $json.body.media.url }}",
        "options": {}
      },
      "type": "@n8n/n8n-nodes-langchain.openAi",
      "typeVersion": 2.1,
      "position": [800, 100],
      "id": "analyze-image-node",
      "name": "Analyze image",
      "credentials": {
        "openAiApi": {
          "id": "YOUR_OPENAI_CREDENTIAL_ID",
          "name": "OpenAi account"
        }
      }
    },
    {
      "parameters": {
        "url": "={{ $json.body.media.url }}",
        "options": {}
      },
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [800, 200],
      "id": "get-audio-node",
      "name": "Get Audio"
    },
    {
      "parameters": {
        "resource": "audio",
        "operation": "transcribe",
        "options": {}
      },
      "type": "@n8n/n8n-nodes-langchain.openAi",
      "typeVersion": 2.1,
      "position": [1000, 200],
      "id": "transcribe-node",
      "name": "Transcribe a recording",
      "credentials": {
        "openAiApi": {
          "id": "YOUR_OPENAI_CREDENTIAL_ID",
          "name": "OpenAi account"
        }
      }
    },
    {
      "parameters": {
        "resource": "document",
        "modelId": {
          "__rl": true,
          "value": "models/gemini-2.5-flash",
          "mode": "list",
          "cachedResultName": "models/gemini-2.5-flash"
        },
        "documentUrls": "={{ $json.body.media.url }}",
        "options": {}
      },
      "type": "@n8n/n8n-nodes-langchain.googleGemini",
      "typeVersion": 1.1,
      "position": [800, 400],
      "id": "analyze-document-node",
      "name": "Analyze document",
      "credentials": {
        "googlePalmApi": {
          "id": "YOUR_GOOGLE_GEMINI_CREDENTIAL_ID",
          "name": "Google Gemini(PaLM) Api account"
        }
      }
    },
    {
      "parameters": {
        "resource": "video",
        "operation": "analyze",
        "modelId": {
          "__rl": true,
          "value": "models/gemini-2.5-flash",
          "mode": "list",
          "cachedResultName": "models/gemini-2.5-flash"
        },
        "videoUrls": "={{ $('Webhook').item.json.body.media.url }}",
        "options": {}
      },
      "type": "@n8n/n8n-nodes-langchain.googleGemini",
      "typeVersion": 1.1,
      "position": [800, 500],
      "id": "analyze-video-node",
      "name": "Analyze video",
      "credentials": {
        "googlePalmApi": {
          "id": "YOUR_GOOGLE_GEMINI_CREDENTIAL_ID",
          "name": "Google Gemini(PaLM) Api account"
        }
      }
    },
    {
      "parameters": {
        "jsCode": "// Combined: Merge Analysis + Prepare for AI Agent\nconsole.log('=== Processing WhatsApp Message ===');\nconst allInputs = $input.all();\nconsole.log('Total inputs received:', allInputs.length);\nfunction extractAnalysisText(data) {\n  if (Array.isArray(data)) data = data[0];\n  if (!data) return null;\n  if (data.content && Array.isArray(data.content)) {\n    const textParts = data.content.filter(item => item.text && item.text.length > 10);\n    if (textParts.length > 0) return textParts.map(item => item.text).join('\\n\\n');\n  }\n  if (data.annotations && Array.isArray(data.annotations)) {\n    const textAnnotations = data.annotations.filter(a => a.text && a.text.length > 10);\n    if (textAnnotations.length > 0) return textAnnotations.map(a => a.text).join('\\n\\n');\n  }\n  if (data.content?.parts?.[0]?.text) return data.content.parts[0].text;\n  if (data.candidates?.[0]?.content?.parts?.[0]?.text) return data.candidates[0].content.parts[0].text;\n  if (data.text && typeof data.text === 'string' && data.text.length > 10) return data.text;\n  if (data.message && typeof data.message === 'string' && data.message.length > 10) return data.message;\n  if (typeof data === 'string' && data.length > 10) return data;\n  return null;\n}\nlet analysisText = null;\nfor (const item of allInputs) {\n  const extracted = extractAnalysisText(item.json);\n  if (extracted) {\n    analysisText = extracted;\n    console.log('Analysis found, length:', analysisText.length);\n    break;\n  }\n}\nlet webhookData = null;\ntry {\n  webhookData = $('Webhook').first().json;\n} catch (e) {\n  for (const item of allInputs) {\n    const json = Array.isArray(item.json) ? item.json[0] : item.json;\n    if (json?.body?.from_number) {\n      webhookData = json;\n      break;\n    }\n  }\n}\nif (!webhookData?.body) throw new Error('No webhook data found');\nconst body = webhookData.body;\nconst mediaType = body.media?.type || 'text';\nconst chatbot = body.chatbot || {};\nconst api = body.api || {};\nlet message = body.message || '';\nlet wasAnalyzed = false;\nif (analysisText) {\n  message = analysisText;\n  wasAnalyzed = true;\n} else if (mediaType !== 'text') {\n  message = body.message || '[Media received]';\n}\nlet chatInput = message;\nif (wasAnalyzed && mediaType !== 'text') {\n  const labels = { image: 'Image', audio: 'Audio', video: 'Video', document: 'Document' };\n  chatInput = `[${labels[mediaType] || 'Media'} Analysis]\\n${message}`;\n  if (body.message && body.message !== '[Media file]') chatInput += `\\n\\n[User's caption: ${body.message}]`;\n}\nconst fromNumber = body.from_number || 'unknown';\nconst contact = { id: fromNumber.replace(/[^0-9]/g, ''), phone: fromNumber, name: fromNumber };\nconsole.log('Message:', chatInput.substring(0, 100));\nconsole.log('From:', fromNumber);\nconsole.log('Chatbot:', chatbot.name, '| ID:', chatbot.id);\nconsole.log('Media:', mediaType, '| Analyzed:', wasAnalyzed);\nreturn {\n  json: {\n    chatInput: chatInput,\n    contact: contact,\n    phone: fromNumber,\n    chatbotConfig: {\n      id: chatbot.id,\n      name: chatbot.name || 'Assistant',\n      company: chatbot.company_name || '',\n      industry: chatbot.industry || '',\n      systemPrompt: chatbot.system_prompt || 'You are a helpful AI assistant.',\n      businessContext: chatbot.business_context || '',\n      complianceRules: chatbot.compliance_rules || [],\n      responseGuidelines: chatbot.response_guidelines || [],\n      promptVersion: chatbot.prompt_version || null,\n      priceVisible: chatbot.price_visible !== false\n    },\n    apiConfig: {\n      baseUrl: api.base_url || 'https://xatrtqdgghanwdujyhkq.supabase.co/functions/v1',\n      chatbotId: chatbot.id\n    },\n    timestamp: new Date().toISOString(),\n    messageType: mediaType,\n    wasMediaAnalyzed: wasAnalyzed,\n    sessionId: `whatsapp_${contact.id}_${Date.now()}`\n  }\n};"
      },
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [1200, 300],
      "id": "extract-data-node",
      "name": "Extract WhatsApp Data"
    },
    {
      "parameters": {
        "assignments": {
          "assignments": [
            {"id": "chatInput", "name": "chatInput", "value": "={{ $json.chatInput }}", "type": "string"},
            {"id": "systemPrompt", "name": "systemPrompt", "value": "={{ $json.chatbotConfig.systemPrompt }}", "type": "string"},
            {"id": "businessContext", "name": "businessContext", "value": "={{ $json.chatbotConfig.businessContext }}", "type": "string"},
            {"id": "chatbotId", "name": "chatbotId", "value": "={{ $json.chatbotConfig.id }}", "type": "string"},
            {"id": "platformApiKey", "name": "platformApiKey", "value": "YOUR_PLATFORM_API_KEY", "type": "string"},
            {"id": "priceVisible", "name": "priceVisible", "value": "={{ $json.chatbotConfig.priceVisible }}", "type": "boolean"}
          ]
        },
        "includeOtherFields": true,
        "options": {}
      },
      "id": "workflow-config-node",
      "name": "Workflow Configuration",
      "type": "n8n-nodes-base.set",
      "typeVersion": 3.4,
      "position": [1400, 300]
    },
    {
      "parameters": {
        "promptType": "define",
        "text": "={{ $json.chatInput }}",
        "options": {
          "systemMessage": "=Current date and time: {{ $now.toISO() }}\n\n{{ $json.systemPrompt }}\n\nBUSINESS CONTEXT:\n{{ $json.businessContext }}\n\n{{ $json.chatbotConfig?.complianceRules?.length > 0 ? 'COMPLIANCE RULES (MUST FOLLOW):\\n' + $json.chatbotConfig.complianceRules.map(r => '- ' + r).join('\\n') + '\\n\\n' : '' }}{{ $json.chatbotConfig?.responseGuidelines?.length > 0 ? 'RESPONSE GUIDELINES (MUST FOLLOW):\\n' + $json.chatbotConfig.responseGuidelines.map(g => '- ' + g).join('\\n') + '\\n\\n' : '' }}CONVERSATION CONTEXT:\nPrevious messages are tracked automatically via memory.\n\nAPI TOOLS - USE THEM when relevant:\n\nbrowse_catalog - Get FULL product catalog\nget_promotions - Get active promotions\nget_knowledge - Get knowledge base files\nread_webpage - Read content from a URL\n\nRESPONSE FORMAT (STRICT JSON ONLY):\n{\n  \"reply\": \"Your text response\",\n  \"images\": [],\n  \"documents\": []\n}"
        }
      },
      "id": "ai-agent-node",
      "name": "AI Agent",
      "type": "@n8n/n8n-nodes-langchain.agent",
      "typeVersion": 1.8,
      "position": [1600, 300]
    },
    {
      "parameters": {
        "model": {"__rl": true, "value": "gpt-4o-mini", "mode": "list", "cachedResultName": "gpt-4o-mini"},
        "builtInTools": {},
        "options": {}
      },
      "id": "openai-chat-model-node",
      "name": "OpenAI Chat Model",
      "type": "@n8n/n8n-nodes-langchain.lmChatOpenAi",
      "typeVersion": 1.3,
      "position": [1500, 500],
      "credentials": {
        "openAiApi": {"id": "YOUR_OPENAI_CREDENTIAL_ID", "name": "OpenAi account"}
      }
    },
    {
      "parameters": {
        "sessionIdType": "customKey",
        "sessionKey": "={{ $('Workflow Configuration').item.json.chatbotConfig.id }}_{{ $('Workflow Configuration').item.json.contact.id }}",
        "tableName": "n8n_chat_history",
        "contextWindowLength": 50
      },
      "type": "@n8n/n8n-nodes-langchain.memoryPostgresChat",
      "typeVersion": 1.3,
      "position": [1650, 500],
      "id": "postgres-memory-node",
      "name": "Postgres Chat Memory",
      "credentials": {
        "postgres": {"id": "YOUR_POSTGRES_CREDENTIAL_ID", "name": "Database"}
      }
    },
    {
      "parameters": {
        "toolDescription": "Get the COMPLETE product catalog with ALL items grouped by category.",
        "url": "https://xatrtqdgghanwdujyhkq.supabase.co/functions/v1/chatbot-data",
        "sendQuery": true,
        "queryParameters": {"parameters": [{"name": "type", "value": "catalog"}, {"name": "chatbot_id", "value": "={{ $('Workflow Configuration').item.json.chatbotId }}"}]},
        "sendHeaders": true,
        "headerParameters": {"parameters": [{"name": "Authorization", "value": "Bearer YOUR_SUPABASE_ANON_KEY"}, {"name": "x-api-key", "value": "={{ $('Workflow Configuration').item.json.platformApiKey }}"}]},
        "options": {}
      },
      "type": "n8n-nodes-base.httpRequestTool",
      "typeVersion": 4.3,
      "position": [1750, 500],
      "id": "browse-catalog-node",
      "name": "browse_catalog"
    },
    {
      "parameters": {
        "toolDescription": "Get all active promotions and discounts.",
        "url": "https://xatrtqdgghanwdujyhkq.supabase.co/functions/v1/chatbot-data",
        "sendQuery": true,
        "queryParameters": {"parameters": [{"name": "type", "value": "promotions"}, {"name": "chatbot_id", "value": "={{ $('Workflow Configuration').item.json.chatbotId }}"}]},
        "sendHeaders": true,
        "headerParameters": {"parameters": [{"name": "Authorization", "value": "Bearer YOUR_SUPABASE_ANON_KEY"}, {"name": "x-api-key", "value": "={{ $('Workflow Configuration').item.json.platformApiKey }}"}]},
        "options": {}
      },
      "type": "n8n-nodes-base.httpRequestTool",
      "typeVersion": 4.3,
      "position": [1850, 500],
      "id": "get-promotions-node",
      "name": "get_promotions"
    },
    {
      "parameters": {
        "toolDescription": "Validate a promo code.",
        "url": "https://xatrtqdgghanwdujyhkq.supabase.co/functions/v1/chatbot-data",
        "sendQuery": true,
        "queryParameters": {"parameters": [{"name": "type", "value": "validate_promo"}, {"name": "chatbot_id", "value": "={{ $('Workflow Configuration').item.json.chatbotId }}"}, {"name": "promo_code", "value": "={{ $fromAI('promo_code', 'The promo code to validate', 'string') }}"}]},
        "sendHeaders": true,
        "headerParameters": {"parameters": [{"name": "Authorization", "value": "Bearer YOUR_SUPABASE_ANON_KEY"}, {"name": "x-api-key", "value": "={{ $('Workflow Configuration').item.json.platformApiKey }}"}]},
        "options": {}
      },
      "type": "n8n-nodes-base.httpRequestTool",
      "typeVersion": 4.3,
      "position": [1950, 500],
      "id": "validate-promo-node",
      "name": "validate_promo"
    },
    {
      "parameters": {
        "toolDescription": "Get knowledge base files and content.",
        "url": "https://xatrtqdgghanwdujyhkq.supabase.co/functions/v1/chatbot-data",
        "sendQuery": true,
        "queryParameters": {"parameters": [{"name": "type", "value": "knowledge"}, {"name": "chatbot_id", "value": "={{ $('Workflow Configuration').item.json.chatbotId }}"}]},
        "sendHeaders": true,
        "headerParameters": {"parameters": [{"name": "Authorization", "value": "Bearer YOUR_SUPABASE_ANON_KEY"}, {"name": "x-api-key", "value": "={{ $('Workflow Configuration').item.json.platformApiKey }}"}]},
        "options": {}
      },
      "type": "n8n-nodes-base.httpRequestTool",
      "typeVersion": 4.3,
      "position": [2050, 500],
      "id": "get-knowledge-node",
      "name": "get_knowledge"
    },
    {
      "parameters": {
        "toolDescription": "Read content from a URL when customer sends a link.",
        "url": "=https://r.jina.ai/{{ $fromAI('url', 'The URL to read', 'string') }}",
        "sendHeaders": true,
        "headerParameters": {"parameters": [{"name": "Accept", "value": "text/plain"}]},
        "options": {}
      },
      "type": "n8n-nodes-base.httpRequestTool",
      "typeVersion": 4.3,
      "position": [2150, 500],
      "id": "read-webpage-node",
      "name": "read_webpage"
    },
    {
      "parameters": {
        "jsCode": "const inputData = $input.first().json;\nconsole.log('=== Formatting AI Response ===');\nlet aiResponse = '';\nif (inputData.output) aiResponse = inputData.output;\nelse if (inputData.text) aiResponse = inputData.text;\nelse if (inputData.response) aiResponse = inputData.response;\nelse if (inputData.content) aiResponse = inputData.content;\nelse if (typeof inputData === 'string') aiResponse = inputData;\nelse aiResponse = 'I\\'m sorry, I\\'m having trouble generating a response right now. Please try again.';\naiResponse = String(aiResponse).trim();\nlet reply = aiResponse;\nlet images = [];\nlet documents = [];\nif (aiResponse.startsWith('{') || aiResponse.startsWith('[')) {\n  try {\n    const parsed = JSON.parse(aiResponse);\n    reply = parsed.reply || parsed.response || parsed.message || parsed.text || aiResponse;\n    images = parsed.images || [];\n    documents = parsed.documents || [];\n  } catch (e) {}\n}\nreturn { json: { reply: reply, images: images, documents: documents } };"
      },
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [1800, 300],
      "id": "format-response-node",
      "name": "Format for WhatsApp"
    },
    {
      "parameters": {
        "respondWith": "json",
        "responseBody": "={{ $('Format for WhatsApp').first().json }}",
        "options": {}
      },
      "id": "respond-webhook-node",
      "name": "Respond to Webhook",
      "type": "n8n-nodes-base.respondToWebhook",
      "typeVersion": 1,
      "position": [2000, 300]
    }
  ],
  "connections": {
    "Webhook": {"main": [[{"node": "Switch", "type": "main", "index": 0}]]},
    "Switch": {"main": [[{"node": "Analyze image", "type": "main", "index": 0}], [{"node": "Get Audio", "type": "main", "index": 0}], [{"node": "Extract WhatsApp Data", "type": "main", "index": 0}], [{"node": "Analyze document", "type": "main", "index": 0}], [{"node": "Analyze video", "type": "main", "index": 0}]]},
    "Analyze image": {"main": [[{"node": "Extract WhatsApp Data", "type": "main", "index": 0}]]},
    "Get Audio": {"main": [[{"node": "Transcribe a recording", "type": "main", "index": 0}]]},
    "Transcribe a recording": {"main": [[{"node": "Extract WhatsApp Data", "type": "main", "index": 0}]]},
    "Analyze document": {"main": [[{"node": "Extract WhatsApp Data", "type": "main", "index": 0}]]},
    "Analyze video": {"main": [[{"node": "Extract WhatsApp Data", "type": "main", "index": 0}]]},
    "Extract WhatsApp Data": {"main": [[{"node": "Workflow Configuration", "type": "main", "index": 0}]]},
    "Workflow Configuration": {"main": [[{"node": "AI Agent", "type": "main", "index": 0}]]},
    "AI Agent": {"main": [[{"node": "Format for WhatsApp", "type": "main", "index": 0}]]},
    "OpenAI Chat Model": {"ai_languageModel": [[{"node": "AI Agent", "type": "ai_languageModel", "index": 0}]]},
    "Postgres Chat Memory": {"ai_memory": [[{"node": "AI Agent", "type": "ai_memory", "index": 0}]]},
    "browse_catalog": {"ai_tool": [[{"node": "AI Agent", "type": "ai_tool", "index": 0}]]},
    "get_promotions": {"ai_tool": [[{"node": "AI Agent", "type": "ai_tool", "index": 0}]]},
    "validate_promo": {"ai_tool": [[{"node": "AI Agent", "type": "ai_tool", "index": 0}]]},
    "get_knowledge": {"ai_tool": [[{"node": "AI Agent", "type": "ai_tool", "index": 0}]]},
    "read_webpage": {"ai_tool": [[{"node": "AI Agent", "type": "ai_tool", "index": 0}]]},
    "Format for WhatsApp": {"main": [[{"node": "Respond to Webhook", "type": "main", "index": 0}]]}
  },
  "active": false,
  "settings": {"executionOrder": "v1"},
  "meta": {"templateCredsSetupCompleted": false, "instanceId": ""},
  "tags": []
}
$JSON$
) ON CONFLICT DO NOTHING;

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Migration complete: workflow_templates table created with e-commerce template seeded';
END $$;
