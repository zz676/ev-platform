"use client";

import { FileText, Clock, CheckCircle, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: "gray" | "yellow" | "green" | "blue";
  onClick?: () => void;
  isActive?: boolean;
}

function StatCard({ label, value, icon, color, onClick, isActive }: StatCardProps) {
  const colorClasses = {
    gray: "bg-gray-100 text-gray-600",
    yellow: "bg-yellow-100 text-yellow-600",
    green: "bg-green-100 text-green-600",
    blue: "bg-blue-100 text-blue-600",
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-white rounded-lg border border-gray-200 p-4 transition-all",
        onClick && "cursor-pointer hover:border-gray-300 hover:shadow-sm",
        isActive && "ring-2 ring-ev-green-500 border-ev-green-500"
      )}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <div
          className={cn(
            "flex items-center justify-center w-10 h-10 rounded-lg",
            colorClasses[color]
          )}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

export type PostStatus = "PENDING" | "APPROVED" | "PUBLISHED";

interface AdminStatsProps {
  stats: {
    total: number;
    pending: number;
    approved: number;
    published: number;
  };
  activeStatus?: PostStatus;
  onStatusChange?: (status: PostStatus | undefined) => void;
}

export function AdminStats({ stats, activeStatus, onStatusChange }: AdminStatsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        label="Total Posts"
        value={stats.total}
        icon={<FileText className="h-5 w-5" />}
        color="gray"
        onClick={() => onStatusChange?.(undefined)}
        isActive={activeStatus === undefined}
      />
      <StatCard
        label="Pending Review"
        value={stats.pending}
        icon={<Clock className="h-5 w-5" />}
        color="yellow"
        onClick={() => onStatusChange?.("PENDING")}
        isActive={activeStatus === "PENDING"}
      />
      <StatCard
        label="Approved"
        value={stats.approved}
        icon={<CheckCircle className="h-5 w-5" />}
        color="green"
        onClick={() => onStatusChange?.("APPROVED")}
        isActive={activeStatus === "APPROVED"}
      />
      <StatCard
        label="Published"
        value={stats.published}
        icon={<Globe className="h-5 w-5" />}
        color="blue"
        onClick={() => onStatusChange?.("PUBLISHED")}
        isActive={activeStatus === "PUBLISHED"}
      />
    </div>
  );
}
