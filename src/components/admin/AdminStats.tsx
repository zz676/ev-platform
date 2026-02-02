"use client";

import { FileText, Clock, CheckCircle, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: "gray" | "yellow" | "green" | "blue";
}

function StatCard({ label, value, icon, color }: StatCardProps) {
  const colorClasses = {
    gray: "bg-gray-100 text-gray-600",
    yellow: "bg-yellow-100 text-yellow-600",
    green: "bg-green-100 text-green-600",
    blue: "bg-blue-100 text-blue-600",
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
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

interface AdminStatsProps {
  stats: {
    total: number;
    pending: number;
    approved: number;
    published: number;
  };
}

export function AdminStats({ stats }: AdminStatsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        label="Total Posts"
        value={stats.total}
        icon={<FileText className="h-5 w-5" />}
        color="gray"
      />
      <StatCard
        label="Pending Review"
        value={stats.pending}
        icon={<Clock className="h-5 w-5" />}
        color="yellow"
      />
      <StatCard
        label="Approved"
        value={stats.approved}
        icon={<CheckCircle className="h-5 w-5" />}
        color="green"
      />
      <StatCard
        label="Published"
        value={stats.published}
        icon={<Globe className="h-5 w-5" />}
        color="blue"
      />
    </div>
  );
}
