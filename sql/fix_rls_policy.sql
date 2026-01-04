-- Add policy to allow service role to bypass RLS
CREATE POLICY "Service role can do anything"
  ON whatsapp_web_sessions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can insert messages"
  ON whatsapp_web_messages
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
