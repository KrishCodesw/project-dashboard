"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EASE_OUT, DURATION } from "./animations";
import type { LucideIcon } from "lucide-react";

interface EmptySectionStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; href: string };
}

export function EmptySectionState({
  icon: Icon,
  title,
  description,
  action,
}: EmptySectionStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.SLOW, ease: EASE_OUT }}
      className="flex flex-col items-center justify-center py-12 text-center"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="mt-4 text-sm font-medium text-foreground">{title}</h3>
      {description && (
        <p className="mt-1 text-xs text-muted-foreground max-w-sm">
          {description}
        </p>
      )}
      {action && (
        <Link href={action.href}>
          <Button variant="outline" size="sm" className="mt-4">
            {action.label}
          </Button>
        </Link>
      )}
    </motion.div>
  );
}
