"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Bell, CheckCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useUIStore } from "@/store/ui.store";
import { useNotifications } from "@/hooks/useNotifications";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

const typeIcons: Record<string, { color: string; bg: string }> = {
  TASK_ASSIGNED: { color: "text-indigo-400", bg: "bg-indigo-500/10" },
  DEADLINE_APPROACHING: { color: "text-amber-400", bg: "bg-amber-500/10" },
  REVIEW_SCHEDULED: { color: "text-violet-400", bg: "bg-violet-500/10" },
  FEEDBACK_GIVEN: { color: "text-emerald-400", bg: "bg-emerald-500/10" },
  PROJECT_UPDATED: { color: "text-blue-400", bg: "bg-blue-500/10" },
  MILESTONE_DUE: { color: "text-rose-400", bg: "bg-rose-500/10" },
  TICKET_CREATED: { color: "text-orange-400", bg: "bg-orange-500/10" },
  TICKET_REPLIED: { color: "text-cyan-400", bg: "bg-cyan-500/10" },
};

interface NotificationPanelProps {
  userId: string;
}

export function NotificationPanel({ userId }: NotificationPanelProps) {
  const { notificationPanelOpen, setNotificationPanelOpen } = useUIStore();
  const { data: notifications = [], markRead, markAllRead } = useNotifications(userId);
  const unreadCount = notifications.filter((notification: any) => !notification.isRead).length;
  const unreadLabel = unreadCount > 99 ? "99+" : String(unreadCount);
  const unreadNotifications = notifications.filter((notification: any) => !notification.isRead);
  const readNotifications = notifications.filter((notification: any) => notification.isRead);

  function resolveNotificationLink(notification: any) {
    const link = notification.link as string | undefined;
    if (!link) return undefined;

    const isPublicationNotice = String(notification.title || "")
      .toLowerCase()
      .includes("publication");

    if (!isPublicationNotice) return link;

    if (link.startsWith("/teacher/projects/") && !link.includes("tab=")) {
      return `${link}?tab=publications`;
    }

    if (link.startsWith("/student/projects/") && !link.includes("tab=")) {
      return `${link}?tab=publications`;
    }

    return link;
  }

  async function handleNotificationClick(notification: any) {
    await markRead(notification.id);
    const link = resolveNotificationLink(notification);
    if (link) {
      setNotificationPanelOpen(false);
      window.location.href = link;
    }
  }

  return (
    <AnimatePresence>
      {notificationPanelOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50"
            onClick={() => setNotificationPanelOpen(false)}
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed right-0 top-0 z-50 h-screen w-96 border-l bg-card shadow-xl"
          >
            <div className="flex items-center justify-between border-b p-4">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                <h2 className="text-lg font-semibold">Notifications</h2>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={markAllRead} className="relative">
                  <CheckCheck className="mr-1 h-4 w-4" />
                  Mark all read
                  {unreadCount > 0 ? (
                    <span className="absolute -top-1 -right-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-semibold text-black">
                      {unreadLabel}
                    </span>
                  ) : null}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setNotificationPanelOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <ScrollArea className="h-[calc(100vh-73px)]">
              <div className="space-y-4 p-2">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Bell className="h-12 w-12 mb-4 opacity-30" />
                    <p className="text-sm">No notifications yet</p>
                  </div>
                ) : (
                  <>
                    {unreadNotifications.length > 0 ? (
                      <div className="space-y-2">
                        <p className="px-2 text-xs font-semibold text-muted-foreground">
                          New
                        </p>
                        {unreadNotifications.map((notification: any) => {
                          const style = typeIcons[notification.type] ?? typeIcons.PROJECT_UPDATED;
                          return (
                            <motion.div
                              key={notification.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="flex gap-3 rounded-lg p-3 transition-colors cursor-pointer bg-accent/50 hover:bg-accent"
                              onClick={() => {
                                void handleNotificationClick(notification);
                              }}
                            >
                              <div
                                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${style.bg}`}
                              >
                                <Bell className={`h-4 w-4 ${style.color}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">
                                  {notification.title}
                                </p>
                                <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                                  {notification.message}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {formatDistanceToNow(new Date(notification.createdAt), {
                                    addSuffix: true,
                                  })}
                                </p>
                              </div>
                              <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                            </motion.div>
                          );
                        })}
                      </div>
                    ) : null}

                    {readNotifications.length > 0 ? (
                      <div className="space-y-2">
                        <p className="px-2 text-xs font-semibold text-muted-foreground">
                          Earlier
                        </p>
                        {readNotifications.map((notification: any) => {
                          const style = typeIcons[notification.type] ?? typeIcons.PROJECT_UPDATED;
                          return (
                            <motion.div
                              key={notification.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="flex gap-3 rounded-lg p-3 transition-colors cursor-pointer opacity-25"
                              onClick={() => {
                                void handleNotificationClick(notification);
                              }}
                            >
                              <div
                                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${style.bg}`}
                              >
                                <Bell className={`h-4 w-4 ${style.color}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">
                                  {notification.title}
                                </p>
                                <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                                  {notification.message}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {formatDistanceToNow(new Date(notification.createdAt), {
                                    addSuffix: true,
                                  })}
                                </p>
                              </div>
                              <CheckCheck className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                            </motion.div>
                          );
                        })}
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            </ScrollArea>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
