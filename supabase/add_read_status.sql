-- Add is_read column to messages table
alter table public.messages 
add column if not exists is_read boolean default false;

-- Add index for performance
create index if not exists idx_messages_is_read on public.messages(is_read);
create index if not exists idx_messages_conversation_id on public.messages(conversation_id);
