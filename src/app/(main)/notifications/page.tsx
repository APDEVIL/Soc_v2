"use client";

import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { NotificationItem } from "@/components/notifications/notification-item";
import { api } from "@/trpc/react";
import { toast } from "sonner";

export default function NotificationsPage() {
  const utils = api.useUtils();
  const { data, isLoading } = api.notification.getAll.useQuery({});

  const markAllMutation = api.notification.markAllRead.useMutation({
    onSuccess: () => {
      void utils.notification.getAll.invalidate();
      void utils.notification.getUnreadCount.invalidate();
      toast.success("All marked as read");
    },
  });

  // FIXED: Changed data?.filter to data?.items.filter and n.read to n.isRead
  const unreadCount = data?.items.filter((n) => !n.isRead).length ?? 0;

  return (
    <div className="max-w-[600px] mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-[hsl(43,96%,56%)]" />
          <h1
            className="text-xl font-black tracking-tight"
            style={{ fontFamily: "var(--font-syne)" }}
          >
            Notifications
          </h1>
          {unreadCount > 0 && (
            <span className="ml-1 px-2 py-0.5 rounded-full bg-rose-500 text-white text-xs font-bold">
              {unreadCount}
            </span>
          )}
        </div>

        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => markAllMutation.mutate()}
            disabled={markAllMutation.isPending}
            className="gap-1.5 text-xs text-muted-foreground hover:text-foreground h-8"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            Mark all read
          </Button>
        )}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl">
              <Skeleton className="w-11 h-11 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="w-10 h-10 rounded-lg shrink-0" />
            </div>
          ))}
        </div>
      ) : !data?.items?.length ? ( // FIXED: Look at data.items.length
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
          <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center">
            <Bell className="w-10 h-10 text-muted-foreground/30" />
          </div>
          <div>
            <p className="font-bold text-lg" style={{ fontFamily: "var(--font-syne)" }}>
              All quiet here
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Notifications will appear when people interact with you
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-1">
          {/* Group: Today */}
          {/* FIXED: Pass data.items to groupByDate */}
          {groupByDate(data.items).map(({ label, items }) => (
            <div key={label} className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-1 mb-2">
                {label}
              </p>
              <div className="space-y-0.5 rounded-2xl overflow-hidden border border-border/40">
                {items.map((notif) => (
                  <NotificationItem key={notif.id} notification={notif} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function groupByDate(notifications: any[]) {
  const now = new Date();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const today: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const thisWeek: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const older: any[] = [];

  for (const n of notifications) {
    const diff = now.getTime() - new Date(n.createdAt).getTime();
    const days = diff / (1000 * 60 * 60 * 24);
    if (days < 1) today.push(n);
    else if (days < 7) thisWeek.push(n);
    else older.push(n);
  }

  return [
    { label: "Today", items: today },
    { label: "This week", items: thisWeek },
    { label: "Earlier", items: older },
  ].filter((g) => g.items.length > 0);
}