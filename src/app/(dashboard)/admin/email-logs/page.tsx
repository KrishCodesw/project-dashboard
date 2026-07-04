"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getEmailQueueLogs, retryFailedEmails, runEmailQueueNow } from "@/server/actions/email-queue";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { toast } from "sonner";

const statusClassMap: Record<string, string> = {
  PENDING: "border-amber-400 text-amber-400",
  PROCESSING: "border-blue-400 text-blue-400",
  SENT: "border-emerald-400 text-emerald-400",
  FAILED: "border-rose-400 text-rose-400",
};

export default function AdminEmailLogsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "email-logs", page],
    queryFn: () => getEmailQueueLogs({ page, pageSize: 50 }),
  });

  async function onRetryFailed() {
    try {
      const result = await retryFailedEmails();
      await queryClient.invalidateQueries({ queryKey: ["admin", "email-logs"] });
      toast.success(`Queued ${result.updated} failed emails for retry.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Retry failed";
      toast.error(message);
    }
  }

  async function onRunNow() {
    try {
      const result = await runEmailQueueNow(50);
      await queryClient.invalidateQueries({ queryKey: ["admin", "email-logs"] });
      toast.success(
        `Processed ${result.picked} queued emails. Sent: ${result.sent}, Requeued: ${result.requeued}, Failed: ${result.failed}`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Queue processing failed";
      toast.error(message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Email Logs</h1>
          <p className="text-sm text-muted-foreground">
            Monitor queued and processed bulk email notifications.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onRetryFailed}>Retry Failed</Button>
          <Button onClick={onRunNow}>Run Queue Now</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Outgoing Queue</CardTitle>
        </CardHeader>
        <CardContent>
            {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading email logs...</p>
          ) : (data?.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No email queue records yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="px-3 py-2">Recipient</th>
                    <th className="px-3 py-2">Subject</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Attempts</th>
                    <th className="px-3 py-2">Error Log</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.data ?? []).map((row) => (
                    <tr key={row.id} className="border-b align-top">
                      <td className="px-3 py-3">{row.to}</td>
                      <td className="px-3 py-3">{row.subject}</td>
                      <td className="px-3 py-3">
                        <Badge variant="outline" className={statusClassMap[row.status] || ""}>
                          {row.status}
                        </Badge>
                      </td>
                      <td className="px-3 py-3">{row.attempts}</td>
                      <td className="px-3 py-3 text-xs text-muted-foreground">
                        {row.errorLog ? row.errorLog : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      {data && (
        <PaginationBar
          page={data.page}
          totalPages={data.totalPages}
          total={data.total}
          pageSize={data.pageSize}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
