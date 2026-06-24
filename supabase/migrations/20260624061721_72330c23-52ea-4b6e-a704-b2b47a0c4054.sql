-- Drop trigger + function syncing leads to whatsapp contacts
DROP TRIGGER IF EXISTS sync_lead_to_whatsapp_contact_trg ON public.leads;
DROP TRIGGER IF EXISTS trg_sync_lead_to_whatsapp_contact ON public.leads;
DROP FUNCTION IF EXISTS public.sync_lead_to_whatsapp_contact() CASCADE;

-- Drop all whatsapp tables (CASCADE clears FKs / policies)
DROP TABLE IF EXISTS public.whatsapp_messages CASCADE;
DROP TABLE IF EXISTS public.whatsapp_conversations CASCADE;
DROP TABLE IF EXISTS public.whatsapp_sends CASCADE;
DROP TABLE IF EXISTS public.whatsapp_campaigns CASCADE;
DROP TABLE IF EXISTS public.whatsapp_automation_runs CASCADE;
DROP TABLE IF EXISTS public.whatsapp_automation_steps CASCADE;
DROP TABLE IF EXISTS public.whatsapp_automations CASCADE;
DROP TABLE IF EXISTS public.whatsapp_list_members CASCADE;
DROP TABLE IF EXISTS public.whatsapp_lists CASCADE;
DROP TABLE IF EXISTS public.whatsapp_contacts CASCADE;
DROP TABLE IF EXISTS public.whatsapp_snippets CASCADE;
DROP TABLE IF EXISTS public.whatsapp_templates CASCADE;
DROP TABLE IF EXISTS public.whatsapp_sender_config CASCADE;
DROP TABLE IF EXISTS public.whatsapp_notification_settings CASCADE;

-- Drop whatsapp column on profiles
ALTER TABLE public.profiles DROP COLUMN IF EXISTS whatsapp;