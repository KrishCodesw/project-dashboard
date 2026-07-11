-- AlterTable
ALTER TABLE `department_configurations` ADD COLUMN `totalIntake` INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `faculty_work_logs` (
    `id` VARCHAR(191) NOT NULL,
    `facultyId` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `summary` TEXT NOT NULL,
    `department` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `faculty_work_logs_date_idx`(`date`),
    INDEX `faculty_work_logs_department_date_idx`(`department`, `date`),
    UNIQUE INDEX `faculty_work_logs_facultyId_date_key`(`facultyId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `faculty_work_logs` ADD CONSTRAINT `faculty_work_logs_facultyId_fkey` FOREIGN KEY (`facultyId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
