// Simplified message filters component
"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

interface MessageFiltersProps {
  senderFilter: string;
  categoryFilter: string;
  readFilter: string;
  showOnlyCandidates: boolean;
  onSenderChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onReadChange: (value: string) => void;
  onCandidatesChange: (checked: boolean) => void;
  senders: string[];
  categories: string[];
}

export function MessageFilters({
  senderFilter,
  categoryFilter,
  readFilter,
  showOnlyCandidates,
  onSenderChange,
  onCategoryChange,
  onReadChange,
  onCandidatesChange,
  senders,
  categories,
}: MessageFiltersProps) {
  return (
    <div className="flex flex-wrap gap-4 items-end">
      <div className="flex-1 min-w-[200px] space-y-2">
        <Label htmlFor="sender-filter">Sender</Label>
        <Select value={senderFilter} onValueChange={onSenderChange}>
          <SelectTrigger id="sender-filter">
            <SelectValue placeholder="All senders" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All senders</SelectItem>
            {senders.map((sender) => (
              <SelectItem key={sender} value={sender}>
                {sender}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 min-w-[200px] space-y-2">
        <Label htmlFor="category-filter">Category</Label>
        <Select value={categoryFilter} onValueChange={onCategoryChange}>
          <SelectTrigger id="category-filter">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category} value={category}>
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 min-w-[150px] space-y-2">
        <Label htmlFor="read-filter">Read Status</Label>
        <Select value={readFilter} onValueChange={onReadChange}>
          <SelectTrigger id="read-filter">
            <SelectValue placeholder="All emails" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All emails</SelectItem>
            <SelectItem value="unread">Unread only</SelectItem>
            <SelectItem value="read">Read only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center space-x-2 pb-2">
        <Checkbox
          id="candidates-only"
          checked={showOnlyCandidates}
          onCheckedChange={(checked) => onCandidatesChange(checked === true)}
        />
        <Label htmlFor="candidates-only" className="cursor-pointer">
          Show only delete candidates
        </Label>
      </div>
    </div>
  );
}
