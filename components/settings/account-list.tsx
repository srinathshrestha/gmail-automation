"use client";

// Account list component for managing multiple Gmail accounts
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { showToast } from "@/components/ui/toast";
import { Skeleton } from "@/components/ui/skeleton";

interface Account {
  id: string;
  emailAddress: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export function AccountList() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  useEffect(() => {
    fetchAccounts();
  }, []);

  async function fetchAccounts() {
    try {
      setLoading(true);
      const response = await fetch("/api/accounts");
      if (!response.ok) {
        throw new Error("Failed to fetch accounts");
      }
      const data = await response.json();
      setAccounts(data.accounts || []);
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Failed to load accounts",
        "error"
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleActivate(accountId: string) {
    try {
      setActivating(accountId);
      const response = await fetch(`/api/accounts/${accountId}/activate`, {
        method: "PUT",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to activate account");
      }

      showToast("Account activated successfully", "success");
      await fetchAccounts();
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Failed to activate account",
        "error"
      );
    } finally {
      setActivating(null);
    }
  }

  async function handleDisconnect(accountId: string, emailAddress: string) {
    if (
      !confirm(
        `Are you sure you want to disconnect ${emailAddress}? This will remove all associated data.`
      )
    ) {
      return;
    }

    try {
      setDisconnecting(accountId);
      const response = await fetch(`/api/accounts/${accountId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to disconnect account");
      }

      showToast("Account disconnected successfully", "success");
      await fetchAccounts();
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Failed to disconnect account",
        "error"
      );
    } finally {
      setDisconnecting(null);
    }
  }

  async function handleConnect() {
    try {
      // Redirect to connect Google account
      window.location.href = "/api/auth/connect-google?callback=/settings";
    } catch (error) {
      showToast("Failed to initiate Google OAuth", "error");
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Connected Accounts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Connected Gmail Accounts</CardTitle>
          <Button onClick={handleConnect} size="sm">
            <Icon name="Mail" className="mr-2" size={16} />
            Connect Account
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {accounts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Icon name="Mail" className="h-12 w-12 mx-auto mb-4 opacity-50" size={48} />
            <p className="mb-4">No Gmail accounts connected</p>
            <Button onClick={handleConnect}>
            <Icon name="Mail" className="mr-2" size={16} />
            Connect Your First Account
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {accounts.map((account) => (
              <div
                key={account.id}
                className={`flex items-start sm:items-center justify-between p-3 sm:p-4 rounded-lg border gap-3 ${
                  account.isActive
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card"
                }`}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Icon
                    name="Mail"
                    className={`h-5 w-5 shrink-0 ${
                      account.isActive ? "text-primary" : "text-muted-foreground"
                    }`}
                    size={20}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium break-all text-sm sm:text-base">{account.emailAddress}</p>
                      {account.isActive && (
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-primary text-primary-foreground shrink-0">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Connected {new Date(account.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                  {!account.isActive && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleActivate(account.id)}
                      disabled={activating === account.id}
                      className="whitespace-nowrap"
                    >
                      {activating === account.id ? (
                        "Activating..."
                      ) : (
                        <>
                          <Icon name="Check" className="mr-1" size={14} />
                          <span className="hidden sm:inline">Set Active</span>
                          <span className="sm:hidden">Active</span>
                        </>
                      )}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      handleDisconnect(account.id, account.emailAddress)
                    }
                    disabled={disconnecting === account.id}
                    className="whitespace-nowrap"
                  >
                    {disconnecting === account.id ? (
                      "Disconnecting..."
                    ) : (
                      <>
                        <Icon name="X" className="mr-1" size={14} />
                        Disconnect
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

