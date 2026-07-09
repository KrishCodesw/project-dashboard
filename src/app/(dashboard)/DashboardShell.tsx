"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { NotificationPanel } from "@/components/layout/NotificationPanel";
import { useUIStore } from "@/store/ui.store";
import { useMediaQuery } from "@/hooks/useMediaQuery";

interface DashboardShellProps {
  userId: string;
  userName: string;
  userRole: "ADMIN" | "TEACHER" | "STUDENT";
  userImage?: string | null;
  userIsHod?: boolean;
  userIsPrincipal?: boolean;
  children: React.ReactNode;
}

export function DashboardShell({
  userId,
  userName,
  userRole,
  userImage,
  userIsHod = false,
  userIsPrincipal = false,
  children,
}: DashboardShellProps) {
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const isMobile = useMediaQuery("(max-width: 768px)");

  // Hydration fix for useMediaQuery
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="dashboard-surface min-h-screen bg-background">
      <Sidebar role={userRole} userName={userName} userIsHod={userIsHod} userIsPrincipal={userIsPrincipal} />
      <Topbar userId={userId} userName={userName} userRole={userRole} userImage={userImage} />
      <NotificationPanel userId={userId} />

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {mounted && isMobile && !sidebarCollapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={toggleSidebar}
            className="fixed inset-0 z-30 bg-black/40 backdrop-blur-[2px]"
          />
        )}
      </AnimatePresence>

      <motion.main
        animate={{ marginLeft: mounted && isMobile ? 0 : (sidebarCollapsed ? 64 : 240) }}
        transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
        className="pt-16 min-h-screen"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="p-4 md:p-6"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </motion.main>
    </div>
  );
}
