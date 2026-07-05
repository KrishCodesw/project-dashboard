"use client";

import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { EASE_OUT, DURATION } from "./animations";

export function AllClearedState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.NORMAL, ease: EASE_OUT }}
      className="flex flex-col items-center justify-center py-8 text-center"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
        <CheckCircle2 className="h-6 w-6 text-emerald-500" />
      </div>
      <h3 className="mt-3 text-sm font-medium text-foreground">
        Everything looks good
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">
        No items need your attention right now.
      </p>
    </motion.div>
  );
}
