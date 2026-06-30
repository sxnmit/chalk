-- Migration: allow_tabless_sessions
-- A "tab" is a session that exists without a pool table — customers ordering
-- food and drinks at the bar. table_id, rate_id, and actual_rate_charged are
-- made nullable so the same sessions table can carry both pool play and tabs.

alter table public.sessions alter column table_id drop not null;
alter table public.sessions alter column rate_id drop not null;
alter table public.sessions alter column actual_rate_charged drop not null;
