// Top senders list component
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Sender {
  sender: string;
  totalCount: number;
  deletedByAppCount: number;
  manuallyKeptCount: number;
  lastEmailAt: string | null;
}

interface SenderListProps {
  senders: Sender[];
}

export function SenderList({ senders }: SenderListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Senders</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sender</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Deleted</TableHead>
              <TableHead className="text-right">Kept</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {senders.length === 0 ? (
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

