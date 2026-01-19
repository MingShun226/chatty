-- ====================================================
-- Remove "Is there anything else I can help you with?" from response guidelines
-- This phrase can feel robotic and repetitive
-- ====================================================

-- Update all templates to remove this guideline from all languages
UPDATE chatbot_templates
SET
  response_guidelines_en = array_remove(response_guidelines_en, 'End with "Is there anything else I can help you with?"'),
  response_guidelines_ms = array_remove(response_guidelines_ms, 'Akhiri dengan "Ada lagi yang boleh saya bantu?"'),
  response_guidelines_zh = array_remove(response_guidelines_zh, '以"还有什么我可以帮您的吗？"结束');

-- Also update any avatars that may have copied these guidelines
UPDATE avatars
SET
  response_guidelines = array_remove(response_guidelines, 'End with "Is there anything else I can help you with?"')
WHERE response_guidelines @> ARRAY['End with "Is there anything else I can help you with?"'];

UPDATE avatars
SET
  response_guidelines = array_remove(response_guidelines, 'Akhiri dengan "Ada lagi yang boleh saya bantu?"')
WHERE response_guidelines @> ARRAY['Akhiri dengan "Ada lagi yang boleh saya bantu?"'];

UPDATE avatars
SET
  response_guidelines = array_remove(response_guidelines, '以"还有什么我可以帮您的吗？"结束')
WHERE response_guidelines @> ARRAY['以"还有什么我可以帮您的吗？"结束'];
