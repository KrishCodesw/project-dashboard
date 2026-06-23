-- Migration: add_user_sync_fields
-- Adds uid from COE Main user schema for cross-system student identification.
-- This is the only additional field the Dashboard requires beyond what it
-- already manages (name, email, role, isActive).

ALTER TABLE users ADD COLUMN `uid` VARCHAR(191) NULL;
