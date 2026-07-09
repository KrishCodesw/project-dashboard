"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/store/ui.store";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  UserCheck,
  Settings,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  GraduationCap,
  Bell,
  Mail,
  Upload,
  LogOut,
  Sparkles,
  Building2,
  FileText,
  SlidersHorizontal,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const adminNav: NavItem[] = [
  { title: "Overview", href: "/admin", icon: LayoutDashboard },
  { title: "Projects", href: "/admin/projects", icon: FolderKanban },
  { title: "Users", href: "/admin/users", icon: Users },
  {
    title: "Teacher Approvals",
    href: "/admin/teacher-approvals",
    icon: UserCheck,
  },
  {
    title: "Project Assignments",
    href: "/admin/project-assignments",
    icon: Upload,
  },
  { title: "Email Logs", href: "/admin/email-logs", icon: Mail },
  { title: "Showcase", href: "/admin/showcase", icon: Sparkles },
  { title: "Settings", href: "/admin/settings", icon: Settings },
];

const teacherNav: NavItem[] = [
  { title: "Dashboard", href: "/teacher", icon: LayoutDashboard },
  { title: "Projects", href: "/teacher/projects", icon: FolderKanban },
  { title: "Analytics", href: "/teacher/analytics", icon: BarChart3 },
  { title: "Showcase", href: "/showcase/my-projects", icon: Sparkles },
];

const studentNav: NavItem[] = [
  { title: "Dashboard", href: "/student", icon: LayoutDashboard },
  { title: "My Projects", href: "/student/projects", icon: FolderKanban },
  { title: "Notifications", href: "/student/notifications", icon: Bell },
  { title: "Showcase", href: "/showcase/my-projects", icon: Sparkles },
];

interface SidebarProps {
  role: "ADMIN" | "TEACHER" | "STUDENT";
  userName: string;
  userIsHod?: boolean;
  userIsPrincipal?: boolean;
}

export function Sidebar({ role, userName, userIsHod = false, userIsPrincipal = false }: SidebarProps) {
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar, setSidebarCollapsed } = useUIStore();
  const isMobile = useMediaQuery("(max-width: 768px)");

  // Auto-collapse when switching to mobile, expand on desktop
  React.useEffect(() => {
    if (isMobile) {
      setSidebarCollapsed(true);
    } else {
      setSidebarCollapsed(false);
    }
  }, [isMobile, setSidebarCollapsed]);

  // Hydration fix
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const navItems =
    role === "ADMIN" ? adminNav : role === "TEACHER" ? teacherNav : studentNav;

  const roleLabel =
    role === "ADMIN"
      ? "Administrator"
      : role === "TEACHER"
        ? "Teacher"
        : "Student";

  const getSidebarWidth = () => {
    if (!mounted) return 240;
    if (isMobile) return 280;
    return sidebarCollapsed ? 64 : 240;
  };

  const getSidebarX = () => {
    if (!mounted) return 0;
    if (isMobile) return sidebarCollapsed ? -280 : 0;
    return 0;
  };

  return (
    <TooltipProvider delayDuration={0}>
      <motion.aside
        initial={false}
        animate={{ width: getSidebarWidth(), x: getSidebarX() }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className={cn(
          "fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-border bg-background",
          isMobile && !sidebarCollapsed && "shadow-2xl shadow-black/50"
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-border">
          <AnimatePresence mode="wait">
            {!sidebarCollapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2"
              >
                {/* <div className="flex h-6 w-6 items-center justify-center border border-foreground/20 rounded-[2px] transition-transform duration-200 hover:scale-105 active:scale-95">
                  <div className="h-2 w-2 bg-foreground rounded-[1px]" />
                </div> */}
                <span className="font-serif text-lg tracking-tight">
                  TCET's Project Dashboard
                </span>
              </motion.div>
            )}
          </AnimatePresence>
          {sidebarCollapsed && (
            <div className="flex h-6 w-6 items-center justify-center border border-foreground/20 rounded-[2px] mx-auto transition-transform duration-200 hover:scale-105 active:scale-95">
              <div className="h-2 w-2 bg-foreground rounded-[1px]" />
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-3 overflow-y-auto">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== `/${role.toLowerCase()}` &&
                pathname.startsWith(item.href));

            const linkContent = (
              <Link
                href={item.href}
                onClick={() => isMobile && toggleSidebar()}
                className={cn(
                  "flex items-center gap-3 rounded-[2px] px-3 py-2.5 text-sm font-sans font-medium transition-all duration-200 ease-[0.23,1,0.32,1] border border-transparent hover:scale-[0.98] active:scale-95",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  sidebarCollapsed && "justify-center px-2",
                )}
              >
                <item.icon
                  className={cn(
                    "h-4 w-4 shrink-0 transition-colors duration-200",
                    isActive
                      ? "text-primary-foreground"
                      : "text-muted-foreground",
                  )}
                />
                <AnimatePresence mode="wait">
                  {!sidebarCollapsed && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: "auto" }}
                      exit={{ opacity: 0, width: 0 }}
                      className="overflow-hidden whitespace-nowrap"
                    >
                      {item.title}
                    </motion.span>
                  )}
                </AnimatePresence>
              </Link>
            );

            return (
              <div key={item.href} className="relative">
                {sidebarCollapsed ? (
                  <Tooltip>
                    <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                    <TooltipContent
                      side="right"
                      sideOffset={10}
                      className="font-mono text-[10px] uppercase tracking-wider rounded-[2px] bg-foreground text-background"
                    >
                      {item.title}
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  linkContent
                )}
              </div>
            );
          })}

          {role === "TEACHER" && userIsHod && (
            <>
              {!sidebarCollapsed && (
                <div className="pt-4 pb-1 px-3">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                    HOD
                  </p>
                </div>
              )}
              {[
                { title: "HOD Dashboard", href: "/hod", icon: Building2 },
                { title: "Faculty Guides", href: "/hod/guides", icon: FileText },
                { title: "Department Config", href: "/hod/configuration", icon: SlidersHorizontal },
              ].map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/hod" && pathname.startsWith(item.href));

                const linkContent = (
                  <Link
                    href={item.href}
                    onClick={() => isMobile && toggleSidebar()}
                    className={cn(
                      "flex items-center gap-3 rounded-[2px] px-3 py-2.5 text-sm font-sans font-medium transition-all duration-200 ease-[0.23,1,0.32,1] border border-transparent hover:scale-[0.98] active:scale-95",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      sidebarCollapsed && "justify-center px-2",
                    )}
                  >
                    <item.icon
                      className={cn(
                        "h-4 w-4 shrink-0 transition-colors duration-200",
                        isActive
                          ? "text-primary-foreground"
                          : "text-muted-foreground",
                      )}
                    />
                    <AnimatePresence mode="wait">
                      {!sidebarCollapsed && (
                        <motion.span
                          initial={{ opacity: 0, width: 0 }}
                          animate={{ opacity: 1, width: "auto" }}
                          exit={{ opacity: 0, width: 0 }}
                          className="overflow-hidden whitespace-nowrap"
                        >
                          {item.title}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </Link>
                );

                return (
                  <div key={item.href} className="relative">
                    {sidebarCollapsed ? (
                      <Tooltip>
                        <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                        <TooltipContent
                          side="right"
                          sideOffset={10}
                          className="font-mono text-[10px] uppercase tracking-wider rounded-[2px] bg-foreground text-background"
                        >
                          {item.title}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      linkContent
                    )}
                  </div>
                );
              })}
            </>
          )}

          {userIsPrincipal && (
            <>
              {!sidebarCollapsed && (
                <div className="pt-4 pb-1 px-3">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                    PRINCIPAL
                  </p>
                </div>
              )}
              {[
                { title: "Dashboard", href: "/principal", icon: BarChart3 },
              ].map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/principal" && pathname.startsWith(item.href));

                const linkContent = (
                  <Link
                    href={item.href}
                    onClick={() => isMobile && toggleSidebar()}
                    className={cn(
                      "flex items-center gap-3 rounded-[2px] px-3 py-2.5 text-sm font-sans font-medium transition-all duration-200 ease-[0.23,1,0.32,1] border border-transparent hover:scale-[0.98] active:scale-95",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      sidebarCollapsed && "justify-center px-2",
                    )}
                  >
                    <item.icon
                      className={cn(
                        "h-4 w-4 shrink-0 transition-colors duration-200",
                        isActive
                          ? "text-primary-foreground"
                          : "text-muted-foreground",
                      )}
                    />
                    <AnimatePresence mode="wait">
                      {!sidebarCollapsed && (
                        <motion.span
                          initial={{ opacity: 0, width: 0 }}
                          animate={{ opacity: 1, width: "auto" }}
                          exit={{ opacity: 0, width: 0 }}
                          className="overflow-hidden whitespace-nowrap"
                        >
                          {item.title}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </Link>
                );

                return (
                  <div key={item.href} className="relative">
                    {sidebarCollapsed ? (
                      <Tooltip>
                        <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                        <TooltipContent
                          side="right"
                          sideOffset={10}
                          className="font-mono text-[10px] uppercase tracking-wider rounded-[2px] bg-foreground text-background"
                        >
                          {item.title}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      linkContent
                    )}
                  </div>
                );
              })}
            </>
          )}
        </nav>

        {/* Footer */}
        <div className="p-3 space-y-1 border-t border-border bg-muted/30">
          {!sidebarCollapsed && (
            <div className="px-3 py-2 mb-2">
              <p className="text-sm font-sans font-medium truncate">
                {userName}
              </p>
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                {roleLabel}
              </p>
            </div>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size={sidebarCollapsed ? "icon" : "default"}
                className={cn(
                  "w-full rounded-[2px] transition-transform duration-200 ease-[0.23,1,0.32,1] hover:scale-[0.98] active:scale-95 hover:bg-destructive/10 hover:text-destructive",
                  !sidebarCollapsed && "justify-start",
                )}
                onClick={() => {
                  const callbackUrl = encodeURIComponent(
                    window.location.origin,
                  );
                  window.location.href = `https://tcetcercd.in/logout?callbackUrl=${callbackUrl}`;
                }}
              >
                <LogOut className="h-4 w-4 shrink-0" />
                {!sidebarCollapsed && (
                  <span className="ml-3 font-mono text-[10px] uppercase tracking-wider">
                    SIGN OUT
                  </span>
                )}
              </Button>
            </TooltipTrigger>
            {sidebarCollapsed && (
              <TooltipContent
                side="right"
                sideOffset={10}
                className="font-mono text-[10px] uppercase tracking-wider rounded-[2px] bg-destructive text-destructive-foreground"
              >
                Sign Out
              </TooltipContent>
            )}
          </Tooltip>
        </div>

        {/* Toggle button */}
        {!isMobile && (
          <Button
            variant="outline"
            size="icon"
            onClick={toggleSidebar}
            className="absolute -right-3 top-20 z-50 h-6 w-6 rounded-[2px] border-border bg-background transition-transform duration-200 ease-[0.23,1,0.32,1] hover:scale-110 active:scale-90"
          >
            {sidebarCollapsed ? (
              <ChevronRight className="h-3 w-3" />
            ) : (
              <ChevronLeft className="h-3 w-3" />
            )}
          </Button>
        )}
      </motion.aside>
    </TooltipProvider>
  );
}
