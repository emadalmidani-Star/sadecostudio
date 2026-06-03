
ALTER TABLE public.whatsapp_sender_config
  ADD COLUMN IF NOT EXISTS access_token text;
