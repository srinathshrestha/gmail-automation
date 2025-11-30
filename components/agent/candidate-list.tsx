// Candidate list component
// Always shows structure, only skeletons the data
"use client";

import { CandidateItem } from "./candidate-item";
import { Skeleton } from "@/components/ui/skeleton";

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

interface CandidateListProps {
  candidates: Candidate[] | null;
  selectedIds: Set<string>;
  onSelect: (id: string, selected: boolean) => void;
  loading?: boolean;
}

export function CandidateList({ candidates, selectedIds, onSelect, loading }: CandidateListProps) {
  if (loading || candidates === null) {
    // Show skeleton items
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="border rounded-lg p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-64" />
                <Skeleton className="h-3 w-full" />
              </div>
              <Skeleton className="h-5 w-5 rounded" />
            </div>
            <Skeleton className="h-4 w-32" />
          </div>
        ))}
      </div>
    );
  }

  if (candidates.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No deletion candidates found.</p>
        <p className="text-sm mt-2">Run agent suggestions to find emails that can be deleted.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {candidates.map((candidate) => (
        <CandidateItem
          key={candidate.id}
          candidate={candidate}
          selected={selectedIds.has(candidate.id)}
          onSelect={(selected) => onSelect(candidate.id, selected)}
        />
      ))}
    </div>
  );
}

