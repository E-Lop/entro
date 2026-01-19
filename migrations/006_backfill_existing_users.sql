-- Migration: Backfill Existing Users with Default Lists
-- Description: One-time migration to create lists for all existing users and migrate their foods
-- Date: 2026-01-19
-- IMPORTANT: This should be run ONCE after all other migrations are complete

-- =============================================================================
-- BACKFILL: Create lists for existing users
-- =============================================================================

DO $$
DECLARE
  user_record RECORD;
  new_list_id UUID;
  foods_migrated INTEGER;
BEGIN
  RAISE NOTICE 'Starting backfill for existing users...';

  -- Loop through all existing users
  FOR user_record IN SELECT id, email FROM auth.users
  LOOP
    -- Check if user already has a list (skip if they do)
    IF NOT EXISTS (SELECT 1 FROM list_members WHERE user_id = user_record.id) THEN

      RAISE NOTICE 'Processing user: % (%)', user_record.email, user_record.id;

      -- Create default list for this user
      INSERT INTO lists (created_by, name)
      VALUES (user_record.id, 'La mia lista')
      RETURNING id INTO new_list_id;

      -- Add user as member of their own list
      INSERT INTO list_members (list_id, user_id)
      VALUES (new_list_id, user_record.id);

      -- Migrate all existing foods from this user to their new list
      UPDATE foods
      SET list_id = new_list_id
      WHERE user_id = user_record.id
        AND list_id IS NULL;

      GET DIAGNOSTICS foods_migrated = ROW_COUNT;

      RAISE NOTICE '✓ Created list % for user % and migrated % foods',
        new_list_id, user_record.email, foods_migrated;

    ELSE
      RAISE NOTICE '⊘ User % already has a list, skipping', user_record.email;
    END IF;

  END LOOP;

  RAISE NOTICE 'Backfill complete!';

END $$;

-- =============================================================================
-- VERIFICATION QUERIES (Run separately to check results)
-- =============================================================================

-- Check how many users have lists
-- SELECT COUNT(DISTINCT user_id) as users_with_lists FROM list_members;

-- Check how many foods are now assigned to lists
-- SELECT COUNT(*) as shared_foods FROM foods WHERE list_id IS NOT NULL;

-- Check how many foods are still personal (should be 0 after backfill)
-- SELECT COUNT(*) as personal_foods FROM foods WHERE list_id IS NULL;

-- View all lists created
-- SELECT l.id, l.name, l.created_by, u.email, COUNT(lm.user_id) as member_count
-- FROM lists l
-- JOIN auth.users u ON l.created_by = u.id
-- LEFT JOIN list_members lm ON l.id = lm.list_id
-- GROUP BY l.id, l.name, l.created_by, u.email
-- ORDER BY l.created_at;
