-- 알림 시각 분 단위 + 하루 1회 발송 추적 열 추가
-- (schema.sql 전체를 다시 실행해도 같은 결과)
alter table public.push_subscriptions add column if not exists notify_minute integer not null default 0;
alter table public.push_subscriptions add column if not exists last_sent_on date;
