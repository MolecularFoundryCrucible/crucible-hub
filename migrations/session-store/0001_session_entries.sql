create table hub.session_entries (
  key text primary key,
  value text not null,
  expires_at timestamptz not null
);

create index session_entries_expires_at on hub.session_entries (expires_at);

do $$
begin
  if exists (select from pg_roles where rolname = 'crucible_hub_app') then
    grant usage on schema hub to crucible_hub_app;
    grant select, insert, update, delete on hub.session_entries
      to crucible_hub_app;
  end if;
end
$$;
