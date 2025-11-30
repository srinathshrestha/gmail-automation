// Candidate list component
"use client";

import { CandidateItem } from "./candidate-item";

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
  candidates: Candidate[];
  selectedIds: Set<string>;
  onSelect: (id: string, selected: boolean) => void;
}

export function CandidateList({ candidates, selectedIds, onSelect }: CandidateListProps) {
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

