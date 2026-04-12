"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { HomeIcon, MatchIcon, ChatIcon, ProfileIcon } from "./NavIcons";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function BottomNav() {
  const pathname = usePathname();

  const navItems = [
    { name: "홈", path: "/", icon: HomeIcon },
    { name: "진행중", path: "/match", icon: MatchIcon },
    { name: "채팅", path: "/chat", icon: ChatIcon, showBadge: true },
    { name: "프로필", path: "/profile", icon: ProfileIcon },
  ];

  const [badgeCount, setBadgeCount] = useState(0);
  const supabase = createClient();

  useEffect(() => {
    async function fetchBadge() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Unread messages logic
      const { data: msgs } = await supabase
        .from('messages')
        .select('id')
        .eq('is_read', false)
        .neq('sender_id', user.id);

      // 2. Pending Requests targeted to me
      const { data: reqs } = await supabase
        .from('chat_requests')
        .select('id')
        .eq('target_id', user.id)
        .eq('status', 'pending');

      const count = (msgs?.length || 0) + (reqs?.length || 0);
      setBadgeCount(count);
    }
    
    fetchBadge();
    const interval = setInterval(fetchBadge, 10000); // Polling for simplicity
    return () => clearInterval(interval);
  }, [pathname, supabase]);

  return (
    <nav className="absolute bottom-0 w-full max-w-[430px] bg-white border-t border-border-default h-[68px] pb-safe z-50">
      <div className="flex h-full px-2">
        {navItems.map((item) => {
          const isActive = item.path === "/" ? pathname === "/" : pathname.startsWith(item.path);
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.path}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-1",
                isActive ? "text-primary" : "text-text-muted hover:text-text-secondary"
              )}
            >
              <div className="relative">
                <Icon className={cn("w-6 h-6", isActive ? "stroke-[2.5]" : "stroke-2")} />
                {item.showBadge && badgeCount > 0 && (
                   <span className="absolute -top-1 -right-1.5 flex h-[15px] w-[15px] items-center justify-center rounded-full bg-danger text-[9px] font-bold text-white shadow-sm ring-2 ring-white">
                     {badgeCount > 9 ? '9+' : badgeCount}
                   </span>
                )}
              </div>
              <span className={cn("text-[10px] font-semibold", isActive ? "font-bold" : "")}>
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
