-- Migration: add_performance_indexes
-- Adds database indexes for common query patterns discovered during performance audit.
--
-- Indexes added:
-- 1. users (role, isActive) — admin user listing by role + active status
-- 2. projects (teacherId, status) — teacher project listing with status filter
-- 3. projects (title) — admin and teacher project search by title
-- 4. projects (department, status) — department-based filtering with status

CREATE INDEX idx_user_role_active ON users (role, isActive);

CREATE INDEX idx_project_teacher_status ON projects (teacherId, status);
CREATE INDEX idx_project_title ON projects (title);
CREATE INDEX idx_project_dept_status ON projects (department, status);
