"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  Search,
  Film,
  MessageCircle,
  Bell,
  PlusSquare,
  Users,
  LogOut,
  Moon,
  Sun,
  UserCircle,
} from "lucide-react";
import { useTheme } from "next-themes";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/shared-primitives/user-avatar";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";
import { authClient } from "@/server/better-auth/client";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { PostCreate } from "@/components/posts/post-create";

// ─── Nav items ────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { href: "/feed",          icon: Home,          label: "Home" },
  { href: "/explore",       icon: Search,        label: "Explore" },
  { href: "/reels",         icon: Film,          label: "Reels" },
  { href: "/messages",      icon: MessageCircle, label: "Messages" },
  { href: "/notifications", icon: Bell,          label: "Notifications" },
  { href: "/groups",        icon: Users,         label: "Groups" },
];

interface NavItemProps {
  href: string;
  icon: React.ElementType;
  label: string;
  badge?: number;
  isActive: boolean;
}

function NavItem({ href, icon: Icon, label, badge, isActive }: NavItemProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={href}
          className={cn(
            "relative flex h-11 w-11 items-center justify-center rounded-xl transition-all",
            isActive
              ? "bg-brand text-brand-foreground shadow-md shadow-brand/30"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <Icon className="h-5 w-5" />
          {badge && badge > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">
              {badge > 9 ? "9+" : badge}
            </span>
          ) : null}
        </Link>
      </TooltipTrigger>
      <TooltipContent side="left" className="font-medium">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export function RightNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [showCreate, setShowCreate] = useState(false);
  
  // Hydration fix for theme toggle
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { data: me } = api.user.me.useQuery();
  const { data: notifCount } = api.notification.getUnreadCount.useQuery(
    undefined,
    { refetchInterval: 30_000 },
  );

  async function handleSignOut() {
    try {
      await authClient.signOut();
      toast.success("Signed out");
      router.push("/login");
      router.refresh();
    } catch {
      toast.error("Sign out failed");
    }
  }

  return (
    <>
      <TooltipProvider delayDuration={200}>
        <aside className="hidden md:flex flex-col items-center justify-between w-16 py-4 border-l border-border bg-background fixed right-0 top-0 bottom-0 z-20">
          {/* Top: Logo mark */}
          <div className="flex flex-col items-center gap-1">
            <Link href="/feed">
              <div
                className="h-9 w-9 rounded-xl flex items-center justify-center font-black text-xs shadow-sm mb-2"
                style={{ backgroundColor: "hsl(var(--brand))", color: "hsl(var(--brand-foreground))" }}
              >
                GB
              </div>
            </Link>
          </div>

          {/* Middle: Nav items */}
          <nav className="flex flex-col items-center gap-2">
            {NAV_ITEMS.map((item) => (
              <NavItem
                key={item.href}
                {...item}
                isActive={pathname === item.href || pathname.startsWith(item.href + "/")}
                badge={item.href === "/notifications" ? notifCount?.count : undefined}
              />
            ))}

            {/* Create post */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setShowCreate(true)}
                  className="flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
                >
                  <PlusSquare className="h-5 w-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left">Create post</TooltipContent>
            </Tooltip>
          </nav>

          {/* Bottom: theme + profile */}
          <div className="flex flex-col items-center gap-2">
            {/* Theme toggle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  className="flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
                >
                  {/* Provide a blank icon until the component is mounted on the client */}
                  {!mounted ? (
                    <div className="h-5 w-5" />
                  ) : theme === "dark" ? (
                    <Sun className="h-5 w-5" />
                  ) : (
                    <Moon className="h-5 w-5" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="left">Toggle theme</TooltipContent>
            </Tooltip>

            {/* Profile dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-muted transition-all">
                  {me ? (
                    <UserAvatar
                      src={me.avatarUrl}
                      username={me.name ?? "me"}
                      size="sm"
                    />
                  ) : (
                    <UserCircle className="h-5 w-5 text-muted-foreground" />
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="left" align="end" className="w-52">
                {me && (
                  <>
                    <div className="px-2 py-1.5">
                      <p className="text-sm font-semibold">{me.name}</p>
                      <p className="text-xs text-muted-foreground">{me.email}</p>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href={`/${me.username}`} className="gap-2">
                        <UserCircle className="h-4 w-4" /> Profile
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="gap-2 text-destructive focus:text-destructive"
                  onClick={handleSignOut}
                >
                  <LogOut className="h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </aside>
      </TooltipProvider>

      {showCreate && <PostCreate onClose={() => setShowCreate(false)} />}
    </>
  );
}