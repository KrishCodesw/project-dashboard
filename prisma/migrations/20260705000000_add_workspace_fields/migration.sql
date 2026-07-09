-- Migration: add_workspace_fields
-- Adds fields needed for the Teacher Workspace feature.
--
-- Changes:
-- 1. User.lastVisitedAt - tracks when the teacher last opened the workspace
-- 2. Project.isPinned - teacher pin toggle for projects
-- 3. ProjectMember.isPinned - student pin toggle (future use)

ALTER TABLE users ADD COLUMN lastVisitedAt DATETIME NULL;

ALTER TABLE projects ADD COLUMN isPinned BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE project_members ADD COLUMN isPinned BOOLEAN NOT NULL DEFAULT false;
