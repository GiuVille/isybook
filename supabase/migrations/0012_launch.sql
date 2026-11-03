-- Ritocchi per la messa online:
-- 1. fonti "calde" lette ogni mezz'ora di giorno (box, edizioni limitate, promozioni a tempo);
-- 2. contatore delle build del giorno, per restare dentro le 500 build al mese di Cloudflare Pages;
-- 3. freno agli invii a raffica del modulo dei messaggi.

-- 1. frequenza di lettura delle fonti
alter table sources add column frequency text not null default 'daily' check (frequency in ('daily', 'hot'));

-- 2. build del giorno (azzerato dallo script quando cambia la data)
alter table site_state
  add column builds_day date,
  add column builds_count int not null default 0;

-- 3. al massimo 20 messaggi ogni 10 minuti, da chiunque: oltre si rifiuta (protegge database e casella della redazione)
create or replace function feedback_rate_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from feedback where created_at > now() - interval '10 minutes') >= 20 then
    raise exception 'Troppi messaggi in poco tempo, riprova tra qualche minuto' using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger feedback_rate_limit before insert on feedback for each row execute function feedback_rate_limit();
