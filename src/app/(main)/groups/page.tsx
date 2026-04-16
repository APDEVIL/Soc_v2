"use client";

import { useState } from "react";
import { Users, Search, TrendingUp, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { GroupCard } from "@/components/groups/group-card";
import { api } from "@/trpc/react";

export default function GroupsPage() {
  const [query, setQuery] = useState("");
  
  // ✅ THE FIX: Changed getGroup to getMyGroups (fetching a list, not a single ID)
  const { data: myGroups, isLoading } = api.group.getMyGroups.useQuery();
  
  // Use getFeed as a proxy for discovery — adapt to your actual discover endpoint
  const { data: feed } = api.post.getFeed.useQuery({ limit: 5 });

  return (
    <div className="max-w-[800px] mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-[hsl(43,96%,56%)]" />
          <h1
            className="text-xl font-black tracking-tight"
            style={{ fontFamily: "var(--font-syne)" }}
          >
            Groups
          </h1>
        </div>
        <Button
          size="sm"
          className="gap-1.5 bg-[hsl(43,96%,56%)] hover:bg-[hsl(43,96%,46%)] text-black font-semibold rounded-xl h-9"
        >
          <Plus className="w-4 h-4" />
          Create
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3.5 top-3 w-4 h-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search groups..."
          className="pl-10 h-11 rounded-2xl bg-muted/60 border-border/40 text-sm"
        />
      </div>

      {/* Discover section */}
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-4 h-4 text-[hsl(43,96%,56%)]" />
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Your Groups & Discover
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-52 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* ✅ If you have groups, map over them here. Otherwise show the empty state. */}
          {myGroups && myGroups.length > 0 ? (
            myGroups.map((group) => (
              <GroupCard
                key={group.id}
                id={group.id}
                name={group.name}
                avatarUrl={group.avatarUrl}
                memberCount={group.memberCount}
                isPrivate={group.isPrivate}
                isMember={true}
                className="h-full"
              />
            ))
          ) : (
            <p className="col-span-2 text-sm text-muted-foreground text-center py-12">
              No groups to show yet. Create one!
            </p>
          )}
        </div>
      )}
    </div>
  );
}