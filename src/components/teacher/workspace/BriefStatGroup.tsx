"use client";

import { useEffect, useState } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";
import { CheckCircle2, FileUp, MessageSquare, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { STAGGER } from "./animations";

interface BriefStatGroupProps {
  tasksCompleted: number;
  filesUploaded: number;
  commentsAdded: number;
  milestonesCompleted: number;
}

const statConfig = [
  { key: "tasksCompleted" as const, label: "Tasks Completed", icon: CheckCircle2, color: "emerald" },
  { key: "filesUploaded" as const, label: "Files Uploaded", icon: FileUp, color: "blue" },
  { key: "commentsAdded" as const, label: "Comments Added", icon: MessageSquare, color: "amber" },
  { key: "milestonesCompleted" as const, label: "Milestones Completed", icon: Target, color: "violet" },
] as const;

const colorMap: Record<string, string> = {
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
};

function AnimatedCount({ value }: { value: number }) {
  const motionValue = useMotionValue(0);
  const springValue = useSpring(motionValue, { stiffness: 80, damping: 25 });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    motionValue.set(value);
  }, [value, motionValue]);

  useEffect(() => {
    const unsub = springValue.on("change", (latest) => {
      setDisplay(Math.round(latest));
    });
    return unsub;
  }, [springValue]);

  return <>{display}</>;
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: STAGGER.NORMAL },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
};

export function BriefStatGroup({
  tasksCompleted,
  filesUploaded,
  commentsAdded,
  milestonesCompleted,
}: BriefStatGroupProps) {
  const values = { tasksCompleted, filesUploaded, commentsAdded, milestonesCompleted };
  const allZero = tasksCompleted === 0 && filesUploaded === 0 && commentsAdded === 0 && milestonesCompleted === 0;

  if (allZero) {
    return (
      <div className="rounded-[2px] border border-border bg-card p-6">
        <p className="text-sm text-muted-foreground text-center py-8">
          No activity since your last visit.
        </p>
      </div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="grid grid-cols-2 lg:grid-cols-4 gap-3"
    >
      {statConfig.map(({ key, label, icon: Icon, color }) => (
        <motion.div
          key={key}
          variants={itemVariants}
          className="rounded-[2px] border border-border bg-card p-4 flex items-start gap-3"
        >
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-[2px]",
              colorMap[color]
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-2xl font-sans font-medium tracking-tight text-foreground">
              <AnimatedCount value={values[key]} />
            </p>
            <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mt-0.5">
              {label}
            </p>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}
