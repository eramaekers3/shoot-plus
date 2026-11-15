-- shoot+ notifications. Safe to run more than once.
-- Run it in Supabase: Dashboard → SQL Editor → New query → paste → Run.
-- First replace {{SHOOT_URL}} with shoot+'s address (https://shoot-plus-vercel.vercel.app) and
-- {{SHOOT_CRON_SECRET}} with the CRON_SECRET set on the shoot-plus-vercel project in Vercel.
--
-- The push_subscriptions and push_log tables (with the `app` column) come from lifestyle+'s and
-- fit+'s supabase/push.sql; run those first.

create extension if not exists pg_net;
create extension if not exists pg_cron;

-- Every minute: shoot, gallery and tax reminders.
select cron.schedule(
  'shoot-push-tick',
  '* * * * *',
  $cron$
    select net.http_post(
      url := '{{SHOOT_URL}}/api/push-tick',
      headers := jsonb_build_object('Authorization', 'Bearer {{SHOOT_CRON_SECRET}}', 'Content-Type', 'application/json'),
      body := '{}'::jsonb,
      timeout_milliseconds := 20000
    );
  $cron$
);
