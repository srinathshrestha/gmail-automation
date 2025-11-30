// Account info component
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";

interface AccountInfoProps {
  email: string;
  lastSyncedAt: string | null;
  lastClassificationAt: string | null;
}

export function AccountInfo({ email, lastSyncedAt, lastClassificationAt }: AccountInfoProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Account Information</CardTitle>
        <CardDescription>Your connected Gmail account details</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Icon name="Mail" className="h-4 w-4 text-muted-foreground flex-shrink-0" size={16} />
          <span className="font-medium">Email:</span>
          <span className="break-all">{email}</span>
        </div>
        {lastSyncedAt && (
          <div className="flex items-center gap-2 flex-wrap">
            <Icon name="Calendar" className="h-4 w-4 text-muted-foreground flex-shrink-0" size={16} />
            <span className="font-medium">Last Sync:</span>
            <span className="text-sm">{new Date(lastSyncedAt).toLocaleString()}</span>
          </div>
        )}
        {lastClassificationAt && (
          <div className="flex items-center gap-2 flex-wrap">
            <Icon name="Calendar" className="h-4 w-4 text-muted-foreground flex-shrink-0" size={16} />
            <span className="font-medium">Last Classification:</span>
            <span className="text-sm">{new Date(lastClassificationAt).toLocaleString()}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
