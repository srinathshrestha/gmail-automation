// Reusable stat card component
// Always shows static labels, only skeletons the data values
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Icon, IconName } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";

interface StatsCardProps {
  title: string;
  value: string | number | null | undefined;
  icon: IconName;
  description?: string;
  loading?: boolean;
}

export function StatsCard({ title, value, icon, description, loading }: StatsCardProps) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 sm:px-6 pt-4 sm:pt-6">
        {/* Always show static title and icon */}
        <CardTitle className="text-xs sm:text-sm font-medium truncate pr-2">{title}</CardTitle>
        <Icon name={icon} className="text-muted-foreground shrink-0" size={16} />
      </CardHeader>
      <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
        {/* Only skeleton the value, not the static content */}
        {loading || value === null || value === undefined ? (
          <Skeleton className="h-7 sm:h-8 w-16 sm:w-20 mb-1 sm:mb-2" />
        ) : (
          <div className="text-xl sm:text-2xl font-bold tabular-nums">{value}</div>
        )}
        {/* Always show description if provided */}
        {description && (
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 truncate">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}
