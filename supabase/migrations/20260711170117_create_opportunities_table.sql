create table public.opportunities (
  id bigint generated always as identity primary key,
  title text not null,
  description text,
  link text,
  deadline text,
  areas text[] not null default '{}',
  level text[] not null default '{}',
  location text,
  audience text[] not null default '{}',
  cost text,
  language text,
  keywords text[] not null default '{}',
  eligibility text,
  process text,
  applicants text,
  additionals text,
  resources jsonb not null default '[]',
  status text not null,
  review text,
  created_at timestamptz not null default now()
);
alter table public.opportunities enable row level security;
