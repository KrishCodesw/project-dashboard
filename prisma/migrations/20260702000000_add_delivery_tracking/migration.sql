-- Migration: add_delivery_tracking
-- Adds delivery tracking fields for Automatic Invitation Delivery Tracking feature.
-- 
-- Changes:
-- 1. New DeliveryStatus enum (BOUNCED)
-- 2. EmailQueue.messageId for DSN correlation
-- 3. PendingProjectAssignment bounce fields (deliveryStatus, bounceDiagnosticRaw, bounceReason, lastBounceAt)

-- Create DeliveryStatus enum
ALTER TABLE `pending_project_assignments`
  ADD COLUMN `deliveryStatus` ENUM('BOUNCED') NULL,
  ADD COLUMN `bounceDiagnosticRaw` TEXT NULL,
  ADD COLUMN `bounceReason` VARCHAR(191) NULL,
  ADD COLUMN `lastBounceAt` DATETIME(3) NULL;

-- Add messageId to EmailQueue
ALTER TABLE `email_queue`
  ADD COLUMN `messageId` VARCHAR(191) NULL;
