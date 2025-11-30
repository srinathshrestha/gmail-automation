// Sender selection component for auto-including senders in suggestions
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Icon } from "@/components/ui/icon";
import { showToast } from "@/components/ui/toast";
import { Input } from "@/components/ui/input";

interface SenderSelectionProps {
  userId: string;
}

export function SenderSelection({ userId }: SenderSelectionProps) {
  const [senders, setSenders] = useState<string[]>([]);
  const [selectedSenders, setSelectedSenders] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchSenders();
    fetchSelectedSenders();
  }, [userId]);

  async function fetchSenders() {
    try {
      const response = await fetch("/api/messages/filters");
      if (response.ok) {
        const data = await response.json();
        setSenders(data.senders || []);
      }
    } catch (err) {
      console.error("Failed to fetch senders:", err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchSelectedSenders() {
    try {
      const response = await fetch("/api/settings/auto-include-senders");
      if (response.ok) {
        const data = await response.json();
        setSelectedSenders(new Set(data.senders || []));
      }
    } catch (err) {
      console.error("Failed to fetch selected senders:", err);
    }
  }

  async function handleSave() {
    try {
      setSaving(true);
      const response = await fetch("/api/settings/auto-include-senders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senders: Array.from(selectedSenders) }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save");
      }

      showToast("Auto-include senders updated successfully", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to save", "error");
    } finally {
      setSaving(false);
    }
  }

  function handleToggleSender(sender: string) {
    const newSelected = new Set(selectedSenders);
    if (newSelected.has(sender)) {
      newSelected.delete(sender);
    } else {
      newSelected.add(sender);
    }
    setSelectedSenders(newSelected);
  }

  function handleSelectAll() {
    const filtered = filteredSenders;
    if (filtered.every((s) => selectedSenders.has(s))) {
      // Deselect all filtered
      const newSelected = new Set(selectedSenders);
      filtered.forEach((s) => newSelected.delete(s));
      setSelectedSenders(newSelected);
    } else {
      // Select all filtered
      const newSelected = new Set(selectedSenders);
      filtered.forEach((s) => newSelected.add(s));
      setSelectedSenders(newSelected);
    }
  }

  const filteredSenders = senders.filter((sender) =>
    sender.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon name="Users" className="h-5 w-5" size={20} />
          Auto-Include Senders
        </CardTitle>
        <CardDescription>
          Select senders whose emails will automatically be included as deletion candidates in agent suggestions.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Search senders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1"
          />
          <Button variant="outline" onClick={handleSelectAll} size="sm">
            {filteredSenders.every((s) => selectedSenders.has(s))
              ? "Deselect All"
              : "Select All"}
          </Button>
        </div>

        {loading ? (
          <p className="text-muted-foreground text-sm">Loading senders...</p>
        ) : filteredSenders.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {searchQuery ? "No senders found matching your search." : "No senders available."}
          </p>
        ) : (
          <div className="max-h-64 overflow-y-auto border rounded-md p-4 space-y-2">
            {filteredSenders.map((sender) => (
              <div key={sender} className="flex items-center space-x-2">
                <Checkbox
                  id={`sender-${sender}`}
                  checked={selectedSenders.has(sender)}
                  onCheckedChange={() => handleToggleSender(sender)}
                />
                <Label
                  htmlFor={`sender-${sender}`}
                  className="cursor-pointer flex-1 text-sm"
                >
                  {sender}
                </Label>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t">
          <p className="text-sm text-muted-foreground">
            {selectedSenders.size} sender{selectedSenders.size !== 1 ? "s" : ""} selected
          </p>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Icon name="Loader" className="h-4 w-4 mr-2 animate-spin" size={16} />
                Saving...
              </>
            ) : (
              <>
                <Icon name="Check" className="h-4 w-4 mr-2" size={16} />
                Save
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

