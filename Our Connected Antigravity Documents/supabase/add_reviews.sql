-- Create Reviews Table
create table public.reviews (
  id uuid default uuid_generate_v4() primary key,
  booking_id uuid references public.bookings(id) not null,
  reviewer_id uuid references public.profiles(id) not null,
  reviewee_id uuid references public.profiles(id) not null,
  rating int check (rating >= 1 and rating <= 5) not null,
  comment text,
  created_at timestamp with time zone default now(),
  unique(booking_id, reviewer_id) -- One review per booking per person
);

-- Metadata for faster lookups
create index reviews_reviewee_id_idx on public.reviews(reviewee_id);
create index reviews_booking_id_idx on public.reviews(booking_id);

-- RLS
alter table public.reviews enable row level security;
create policy "Reviews are public" on public.reviews for select using (true);
create policy "Users can create reviews for their bookings" on public.reviews for insert with check (auth.uid() = reviewer_id);
