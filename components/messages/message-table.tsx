// Message table component
// Always shows static headers, only skeletons the data rows
"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";

interface Message {
  id: string;
  sender: string;
  senderName: string | null;
  subject: string;
  snippet: string;
  internalDate: string;
  labels: string[];
  aiCategory: string;
  aiDeleteScore: number | null;
  hasUserReplied: boolean;
  isDeleteCandidate: boolean;
  isDeletedByApp: boolean;
  isManuallyKept: boolean;
}

interface MessageTableProps {
  messages: Message[] | null;
  selectedIds: Set<string>;
  onSelect: (id: string, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  loading?: boolean;
}

export function MessageTable({
  messages,
  selectedIds,
  onSelect,
  onSelectAll,
  loading,
}: MessageTableProps) {
  const allSelected =
    messages &&
    messages.length > 0 &&
    messages.every((m) => selectedIds.has(m.id));

  return (
    <Table>
      {/* Always show static table headers */}
      <TableHeader>
        <TableRow>
          <TableHead className="w-12">
            <Checkbox
              checked={allSelected || false}
              onCheckedChange={onSelectAll}
              aria-label="Select all"
              disabled={loading || !messages}
            />
          </TableHead>
          <TableHead>Sender</TableHead>
          <TableHead>Subject</TableHead>
          <TableHead>Snippet</TableHead>
          <TableHead>Age</TableHead>
          <TableHead>Category</TableHead>
          <TableHead className="text-right">Delete Score</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading || messages === null ? (
          // Show skeleton rows for data only
          [...Array(5)].map((_, i) => (
            <TableRow key={i}>
              <TableCell>
                <Skeleton className="h-4 w-4" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-32" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-48" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-64" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-20" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-16" />
              </TableCell>
              <TableCell className="text-right">
                <Skeleton className="h-4 w-12 ml-auto" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-20" />
              </TableCell>
            </TableRow>
          ))
        ) : messages.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={8}
              className="text-center text-muted-foreground"
            >
              No messages found
            </TableCell>
          </TableRow>
        ) : (
          messages.map((message) => (
            <TableRow key={message.id}>
              <TableCell>
                <Checkbox
                  checked={selectedIds.has(message.id)}
                  onCheckedChange={(checked) =>
                    onSelect(message.id, checked === true)
                  }
                />
              </TableCell>
              <TableCell className="font-medium">
                {message.senderName || message.sender}
                {message.hasUserReplied && (
                  <Badge variant="outline" className="ml-2">
                    Replied
                  </Badge>
                )}
              </TableCell>
              <TableCell>{message.subject || "(no subject)"}</TableCell>
              <TableCell className="max-w-md truncate">
                {message.snippet}
              </TableCell>
              <TableCell>
                {formatDistanceToNow(new Date(message.internalDate), {
                  addSuffix: true,
                })}
              </TableCell>
              <TableCell>
                <Badge variant="outline">{message.aiCategory}</Badge>
              </TableCell>
              <TableCell className="text-right">
                {message.aiDeleteScore !== null
                  ? (message.aiDeleteScore * 100).toFixed(0) + "%"
                  : "-"}
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  {message.isDeleteCandidate && (
                    <Badge variant="destructive">Candidate</Badge>
                  )}
                  {message.isDeletedByApp && (
                    <Badge variant="secondary">Deleted</Badge>
                  )}
                  {message.isManuallyKept && (
                    <Badge variant="outline">Kept</Badge>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

