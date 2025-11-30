// Account info component
// Always shows static headers and labels, only skeletons the data values
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";

interface AccountInfoProps {
  email: string | null;
  lastSyncedAt: string | null;
  lastClassificationAt: string | null;
  loading?: boolean;
}

export function AccountInfo({
  email,
  lastSyncedAt,
  lastClassificationAt,
  loading,
}: AccountInfoProps) {
  return (
    <Card>
      <CardHeader>
        {/* Always show static title and description */}
        <CardTitle>Account Information</CardTitle>
        <CardDescription>Your connected Gmail account details</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Always show static label, only skeleton the value */}
        <div className="flex items-center gap-2 flex-wrap">
          <Icon
            name="Mail"
            className="h-4 w-4 text-muted-foreground shrink-0"
            size={16}
          />
          <span className="font-medium">Email:</span>
          {loading || email === null ? (
            <Skeleton className="h-4 w-48" />
          ) : (
            <span className="break-all">{email}</span>
          )}
        </div>
        {/* Always show static label, only skeleton the value */}
        <div className="flex items-center gap-2 flex-wrap">
          <Icon
            name="Calendar"
            className="h-4 w-4 text-muted-foreground shrink-0"
            size={16}
          />
          <span className="font-medium">Last Sync:</span>
          {loading || lastSyncedAt === null ? (
            <Skeleton className="h-4 w-40" />
          ) : (
            <span className="text-sm">
              {new Date(lastSyncedAt).toLocaleString()}
            </span>
          )}
        </div>
        {/* Always show static label, only skeleton the value */}
        <div className="flex items-center gap-2 flex-wrap">
          <Icon
            name="Calendar"
            className="h-4 w-4 text-muted-foreground shrink-0"
            size={16}
          />
          <span className="font-medium">Last Classification:</span>
          {loading || lastClassificationAt === null ? (
            <Skeleton className="h-4 w-40" />
          ) : (
            <span className="text-sm">
              {new Date(lastClassificationAt).toLocaleString()}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
