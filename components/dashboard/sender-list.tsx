// Top senders list component
// Always shows static headers, only skeletons the data rows
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

interface Sender {
  sender: string;
  totalCount: number;
  deletedByAppCount: number;
  manuallyKeptCount: number;
  lastEmailAt: string | null;
}

interface SenderListProps {
  senders: Sender[] | null;
  loading?: boolean;
}

export function SenderList({ senders, loading }: SenderListProps) {
  return (
    <Card>
      <CardHeader>
        {/* Always show static title */}
        <CardTitle>Top Senders</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          {/* Always show static table headers */}
          <TableHeader>
            <TableRow>
              <TableHead>Sender</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Deleted</TableHead>
              <TableHead className="text-right">Kept</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading || senders === null ? (
              // Show skeleton rows for data only
              [...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-4 w-48" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="h-4 w-12 ml-auto" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="h-4 w-12 ml-auto" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="h-4 w-12 ml-auto" />
                  </TableCell>
                </TableRow>
              ))
            ) : senders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  No senders found
                </TableCell>
              </TableRow>
            ) : (
              senders.map((sender) => (
                <TableRow key={sender.sender}>
                  <TableCell className="font-medium">{sender.sender}</TableCell>
                  <TableCell className="text-right">{sender.totalCount}</TableCell>
                  <TableCell className="text-right">{sender.deletedByAppCount}</TableCell>
                  <TableCell className="text-right">{sender.manuallyKeptCount}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

