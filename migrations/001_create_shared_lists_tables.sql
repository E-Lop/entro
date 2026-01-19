-- Migration: Create Shared Lists Tables
-- Description: Creates tables for multi-user list sharing feature
-- Tables: lists, list_members, invites
-- Date: 2026-01-19

-- =============================================================================
-- TABLE: lists (Shared Lists)
-- =============================================================================
CREATE TABLE IF NOT EXISTS lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'La mia lista',
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_lists_created_by ON lists(created_by);

-- Comments for documentation
COMMENT ON TABLE lists IS 'Shared lists that can be accessed by multiple users';
COMMENT ON COLUMN lists.name IS 'Display name for the list';
COMMENT ON COLUMN lists.created_by IS 'User who created the list';

-- =============================================================================
-- TABLE: list_members (List Membership)
-- =============================================================================
CREATE TABLE IF NOT EXISTS list_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(list_id, user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_list_members_list_id ON list_members(list_id);
CREATE INDEX IF NOT EXISTS idx_list_members_user_id ON list_members(user_id);

-- Comments for documentation
COMMENT ON TABLE list_members IS 'Junction table tracking which users belong to which lists';
COMMENT ON COLUMN list_members.joined_at IS 'When the user joined this list';

-- =============================================================================
-- TABLE: invites (Invite Management)
-- =============================================================================
CREATE TABLE IF NOT EXISTS invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  accepted_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT valid_expiry CHECK (expires_at > created_at)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_invites_token ON invites(token);
CREATE INDEX IF NOT EXISTS idx_invites_email ON invites(email) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_invites_list_id ON invites(list_id);

-- Comments for documentation
COMMENT ON TABLE invites IS 'Invite tokens for sharing lists with new users';
COMMENT ON COLUMN invites.token IS 'Unique invite token (32 characters, nanoid)';
COMMENT ON COLUMN invites.status IS 'pending = not yet accepted, accepted = user joined, expired = past expiry date';
COMMENT ON COLUMN invites.expires_at IS 'Token expires after 7 days by default';
