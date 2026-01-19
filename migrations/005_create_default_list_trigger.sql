-- Migration: Auto-create Default List for New Users
-- Description: Trigger to automatically create a list for new signups (unless they have a pending invite)
-- Date: 2026-01-19

-- =============================================================================
-- FUNCTION: Create default list for new users
-- =============================================================================

CREATE OR REPLACE FUNCTION create_default_list_for_user()
RETURNS TRIGGER AS $$
DECLARE
  new_list_id UUID;
  pending_invite_count INTEGER;
BEGIN
  -- Check if user has a pending invite
  SELECT COUNT(*) INTO pending_invite_count
  FROM invites
  WHERE email = NEW.email
    AND status = 'pending'
    AND expires_at > NOW();

  -- Only create list if user has NO pending invites
  IF pending_invite_count = 0 THEN
    -- Create new list for the user
    INSERT INTO lists (created_by, name)
    VALUES (NEW.id, 'La mia lista')
    RETURNING id INTO new_list_id;

    -- Add user as member of their own list
    INSERT INTO list_members (list_id, user_id)
    VALUES (new_list_id, NEW.id);

    RAISE NOTICE 'Created default list % for user %', new_list_id, NEW.id;
  ELSE
    RAISE NOTICE 'User % has pending invite, skipping default list creation', NEW.email;
  END IF;

  -- If user has pending invite, acceptInvite() Edge Function will handle list membership

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- TRIGGER: Execute after user signup
-- =============================================================================

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_default_list_for_user();

-- =============================================================================
-- LOGIC EXPLANATION:
-- =============================================================================
-- New user with NO invite → Gets personal list automatically
-- New user WITH invite → Skips personal list, will join shared list via acceptInvite()
-- This ensures invited users only see the shared list (no personal list)
