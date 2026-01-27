-- Enable Realtime for the foods table
-- This allows Supabase Realtime to listen to INSERT/UPDATE/DELETE events

-- Enable realtime publication for foods table
ALTER PUBLICATION supabase_realtime ADD TABLE foods;

-- Verify that realtime is enabled
COMMENT ON TABLE foods IS 'Foods table with realtime enabled for shared list synchronization';
