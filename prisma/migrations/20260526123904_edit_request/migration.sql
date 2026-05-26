-- AlterTable
ALTER TABLE `projects` ADD COLUMN `hasPendingEdit` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `pendingEditData` JSON NULL;
