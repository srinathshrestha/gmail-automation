// Message table component
"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  messages: Message[];
  selectedIds: Set<string>;
  onSelect: (id: string, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
}

export function MessageTable({ messages, selectedIds, onSelect, onSelectAll }: MessageTableProps) {
  const allSelected = messages.length > 0 && messages.every((m) => selectedIds.has(m.id));
  const someSelected = messages.some((m) => selectedIds.has(m.id));

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12">
            <Checkbox
              checked={allSelected}
              onCheckedChange={onSelectAll}
              aria-label="Select all"
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
        {messages.length === 0 ? (
          <TableRow>
            <TableCell colSpan={8} className="text-center text-muted-foreground">
              No messages found
            </TableCell>
          </TableRow>
        ) : (
          messages.map((message) => (
            <TableRow key={message.id}>
              <TableCell>
                <Checkbox
                  checked={selectedIds.has(message.id)}
                  onCheckedChange={(checked) => onSelect(message.id, checked === true)}
                />
              </TableCell>
              <TableCell className="font-medium">
                {message.senderName || message.sender}
                {message.hasUserReplied && (
                  <Badge variant="outline" className="ml-2">Replied</Badge>
                )}
              </TableCell>
              <TableCell>{message.subject || "(no subject)"}</TableCell>
              <TableCell className="max-w-md truncate">{message.snippet}</TableCell>
              <TableCell>{formatDistanceToNow(new Date(message.internalDate), { addSuffix: true })}</TableCell>
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

