-- CreateIndex
CREATE INDEX `pending_project_assignments_projectId_status_idx` ON `pending_project_assignments`(`projectId`, `status`);

-- CreateIndex
CREATE INDEX `users_role_idx` ON `users`(`role`);

-- CreateIndex
CREATE INDEX `users_uid_idx` ON `users`(`uid`);

-- CreateIndex
CREATE INDEX `users_role_uid_idx` ON `users`(`role`, `uid`);
