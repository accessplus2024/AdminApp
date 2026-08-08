alter table public.opportunities add column type text;
update public.opportunities set type = 'Programas Acadêmicos' where type is null;
alter table public.opportunities alter column type set not null;
