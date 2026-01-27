-- ==============================================================================
-- 1. Create Notifications Table
-- ==============================================================================
create table if not exists public.notifications (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) not null,
  type text not null, -- 'booking', 'connection', 'message', 'system'
  title text not null,
  message text,
  link text,
  read boolean default false,
  created_at timestamp with time zone default now(),
  metadata jsonb
);

-- RLS Policies
alter table public.notifications enable row level security;

create policy "Users can view their own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

create policy "Users can update their own notifications (read status)"
  on public.notifications for update
  using (auth.uid() = user_id);

-- ==============================================================================
-- 2. Trigger Function: New Booking Request
-- ==============================================================================
create or replace function handle_new_booking_notification()
returns trigger as $$
declare
  student_name text;
begin
  -- Get student name
  select full_name into student_name from public.profiles where id = new.student_id;

  -- Notify Provider (Tutor/Counselor)
  insert into public.notifications (user_id, type, title, message, link, metadata)
  values (
    new.provider_id,
    'booking',
    'New Booking Request',
    coalesce(student_name, 'A student') || ' requested a session.',
    '/dashboard-tutor.html?tab=requests', -- Adjust based on role dynamically if needed, but this is safe default
    jsonb_build_object('booking_id', new.id)
  );

  return new;
end;
$$ language plpgsql security definer;

-- Trigger
drop trigger if exists on_booking_created on public.bookings;
create trigger on_booking_created
  after insert on public.bookings
  for each row
  execute function handle_new_booking_notification();

-- ==============================================================================
-- 3. Trigger Function: Booking Status Change
-- ==============================================================================
create or replace function handle_booking_status_notification()
returns trigger as $$
declare
  provider_name text;
  student_name text;
begin
  -- Only run if status changed
  if old.status = new.status then
    return new;
  end if;

  select full_name into provider_name from public.profiles where id = new.provider_id;
  select full_name into student_name from public.profiles where id = new.student_id;

  -- Case A: Booking Confirmed -> Notify Student
  if new.status = 'confirmed' and old.status != 'confirmed' then
    insert into public.notifications (user_id, type, title, message, link)
    values (
      new.student_id,
      'booking',
      'Booking Confirmed',
      'Your session with ' || coalesce(provider_name, 'your tutor') || ' is confirmed!',
      '/dashboard-student.html?tab=bookings'
    );
  end if;

  -- Case B: Booking Rejected -> Notify Student
  if new.status = 'rejected' then
    insert into public.notifications (user_id, type, title, message, link)
    values (
      new.student_id,
      'booking',
      'Booking Declined',
      coalesce(provider_name, 'The tutor') || ' declined your booking request.',
      '/dashboard-student.html?tab=bookings'
    );
  end if;

  return new;
end;
$$ language plpgsql security definer;

-- Trigger
drop trigger if exists on_booking_status_change on public.bookings;
create trigger on_booking_status_change
  after update on public.bookings
  for each row
  execute function handle_booking_status_notification();

-- ==============================================================================
-- 4. Trigger Function: New Connection (Study Buddy)
-- ==============================================================================
create or replace function handle_new_connection_notification()
returns trigger as $$
declare
  initiator_name text;
begin
  select full_name into initiator_name from public.profiles where id = new.user_id;

  -- Notify the TARGET user
  insert into public.notifications (user_id, type, title, message, link)
  values (
    new.connected_user_id,
    'connection',
    'New Connection',
    coalesce(initiator_name, 'Someone') || ' connected with you!',
    '/dashboard-student.html?tab=connections'
  );

  return new;
end;
$$ language plpgsql security definer;

-- Trigger
drop trigger if exists on_connection_created on public.connections;
create trigger on_connection_created
  after insert on public.connections
  for each row
  execute function handle_new_connection_notification();
