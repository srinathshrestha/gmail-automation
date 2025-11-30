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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        {/* Always show static title and icon */}
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon name={icon} className="text-muted-foreground" size={16} />
      </CardHeader>
      <CardContent>
        {/* Only skeleton the value, not the static content */}
        {loading || value === null || value === undefined ? (
          <Skeleton className="h-8 w-20 mb-2" />
        ) : (
          <div className="text-2xl font-bold">{value}</div>
        )}
        {/* Always show description if provided */}
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}
