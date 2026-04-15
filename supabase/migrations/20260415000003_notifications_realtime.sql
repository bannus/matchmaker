-- Enable Supabase Realtime for the notifications table.
-- Without this, the postgres_changes subscription in the frontend
-- never fires in production, causing notification delays.

alter publication supabase_realtime add table notifications;
