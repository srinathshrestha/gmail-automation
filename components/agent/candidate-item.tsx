// Individual candidate card component
"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

interface Candidate {
  id: string;
  gmailMessageId: string;
  sender: string;
  senderName: string | null;
  subject: string;
  snippet: string;
  age: string;
  deleteScore: number | null;
  reason: string | null;
  category: string;
  hasUserReplied: boolean;
  labels: string[];
}

interface CandidateItemProps {
  candidate: Candidate;
  selected: boolean;
  onSelect: (selected: boolean) => void;
}

export function CandidateItem({
  candidate,
  selected,
  onSelect,
}: CandidateItemProps) {
  return (
    <Card className={selected ? "border-primary" : ""}>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <Checkbox
            checked={selected}
            onCheckedChange={onSelect}
            className="mt-1"
          />
          <div className="flex-1 space-y-2">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold">
                  {candidate.senderName || candidate.sender}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {candidate.subject || "(no subject)"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{candidate.category}</Badge>
                {candidate.deleteScore !== null && (
                  <Badge variant="destructive">
                    {(candidate.deleteScore * 100).toFixed(0)}%
                  </Badge>
                )}
              </div>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {candidate.snippet}
            </p>
            {candidate.reason && (
              <p className="text-xs text-muted-foreground italic">
                Reason: {candidate.reason}
              </p>
            )}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{candidate.age}</span>
              {candidate.hasUserReplied && (
                <Badge variant="outline" className="text-xs">
                  Replied
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
