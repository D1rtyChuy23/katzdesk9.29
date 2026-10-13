-- Planner day board: the time of day a ticket, TLC, PM or install is scheduled for ("HH:MM", 24-hour).
-- Null means the day is set but no time yet.
alter table service_jobs add column if not exists sched_time text;
alter table pm_jobs add column if not exists sched_time text;
alter table installs add column if not exists sched_time text;
