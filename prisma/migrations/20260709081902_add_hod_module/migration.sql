-- AlterTable
ALTER TABLE `users` ADD COLUMN `isHod` BOOLEAN NOT NULL DEFAULT false,
    MODIFY `lastVisitedAt` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `department_configurations` (
    `id` VARCHAR(191) NOT NULL,
    `academicYear` VARCHAR(191) NOT NULL,
    `department` VARCHAR(191) NOT NULL,
    `divisionCount` INTEGER NOT NULL DEFAULT 0,
    `studentCount` INTEGER NOT NULL DEFAULT 0,
    `projectGroupCount` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `configuredByUserId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `department_configurations_department_academicYear_idx`(`department`, `academicYear`),
    UNIQUE INDEX `department_configurations_academicYear_department_key`(`academicYear`, `department`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `faculty_guide_invitations` (
    `id` VARCHAR(191) NOT NULL,
    `department` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `invitedByUserId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `faculty_guide_invitations_email_idx`(`email`),
    INDEX `faculty_guide_invitations_department_status_idx`(`department`, `status`),
    INDEX `faculty_guide_invitations_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `department_configurations` ADD CONSTRAINT `department_configurations_configuredByUserId_fkey` FOREIGN KEY (`configuredByUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `faculty_guide_invitations` ADD CONSTRAINT `faculty_guide_invitations_invitedByUserId_fkey` FOREIGN KEY (`invitedByUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `projects` RENAME INDEX `idx_project_dept_status` TO `projects_department_status_idx`;

-- RenameIndex
ALTER TABLE `projects` RENAME INDEX `idx_project_teacher_status` TO `projects_teacherId_status_idx`;

-- RenameIndex
ALTER TABLE `projects` RENAME INDEX `idx_project_title` TO `projects_title_idx`;

-- RenameIndex
ALTER TABLE `users` RENAME INDEX `idx_user_role_active` TO `users_role_isActive_idx`;
