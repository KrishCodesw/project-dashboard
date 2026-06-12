"use client";

import { format } from "date-fns";
import {
  CheckCircleIcon,
  ClockIcon,
  ExternalLinkIcon,
  XCircleIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useApprovePublication, useRejectPublication } from "@/hooks/usePublications";

interface PublicationDetails {
  journalName?: string;
  conferenceName?: string;
  bookTitle?: string;
  publisher?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  proofUrl?: string;
  remarks?: string;
}

const STATUS_CONFIG = {
  PENDING: {
    label: "Pending",
    variant: "secondary" as const,
    icon: ClockIcon,
    color: "text-yellow-600",
  },
  APPROVED: {
    label: "Approved",
    variant: "default" as const,
    icon: CheckCircleIcon,
    color: "text-green-600",
  },
  REJECTED: {
    label: "Rejected",
    variant: "destructive" as const,
    icon: XCircleIcon,
    color: "text-red-600",
  },
};

type AdminPublicationsListProps = {
  publications: any[];
  isLoading: boolean;
};

export function AdminPublicationsList({
  publications,
  isLoading,
}: AdminPublicationsListProps) {
  const approveMutation = useApprovePublication();
  const rejectMutation = useRejectPublication();

  const handleApprove = async (publicationId: string) => {
    await approveMutation.mutateAsync({ publicationId });
  };

  const handleReject = async (publicationId: string) => {
    await rejectMutation.mutateAsync({ publicationId });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/4"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!publications || publications.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No publications found
        </CardContent>
      </Card>
    );
  }

  const orderedPublications = [...publications].sort((a, b) => {
    const aPending = String(a.status) === "PENDING" ? 0 : 1;
    const bPending = String(b.status) === "PENDING" ? 0 : 1;
    return aPending - bPending;
  });

  return (
    <div className="space-y-4">
      {orderedPublications.map((publication) => {
        const statusKey = String(publication.status) as keyof typeof STATUS_CONFIG;
        const statusConfig = STATUS_CONFIG[statusKey] ?? STATUS_CONFIG.PENDING;
        const StatusIcon = statusConfig.icon;
        const details =
          (publication.detailsJson as unknown as PublicationDetails) || {};

        return (
          <Card key={publication.id} className="relative">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg mb-2">
                    {publication.title}
                  </CardTitle>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    <span>Project: {publication.project?.title ?? "Unknown"}</span>
                    <span>By: {publication.authors}</span>
                    <span>
                      Type: {publication.publicationType.replace("_", " ")}
                    </span>
                    {publication.subType && (
                      <span>Sub-type: {publication.subType}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={statusConfig.variant}
                    className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider"
                  >
                    <StatusIcon className="w-3 h-3" />
                    {statusConfig.label}
                  </Badge>
                  {publication.status === "APPROVED" &&
                    publication.score !== null &&
                    publication.score > 0 && (
                      <Badge
                        variant="outline"
                        className="text-editorial-primary border-editorial-primary font-mono text-[9px] uppercase tracking-wider"
                      >
                        {publication.score} points
                      </Badge>
                    )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-3 bg-card">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                {details.journalName && (
                  <div>
                    <span className="font-medium">Journal:</span> {details.journalName}
                  </div>
                )}
                {details.conferenceName && (
                  <div>
                    <span className="font-medium">Conference:</span> {details.conferenceName}
                  </div>
                )}
                {details.bookTitle && (
                  <div>
                    <span className="font-medium">Book:</span> {details.bookTitle}
                  </div>
                )}
                {details.publisher && (
                  <div>
                    <span className="font-medium">Publisher:</span> {details.publisher}
                  </div>
                )}
                {publication.uniqueIdentifier && (
                  <div>
                    <span className="font-medium">DOI:</span>{" "}
                    <a
                      href={`https://doi.org/${publication.uniqueIdentifier}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline font-mono"
                    >
                      {publication.uniqueIdentifier}
                    </a>
                  </div>
                )}
                {publication.indexingType &&
                  publication.indexingType !== "NONE" && (
                    <div>
                      <span className="font-medium">Indexing:</span>{" "}
                      {publication.indexingType.replace("_", " ")}
                    </div>
                  )}
                {(details.volume || details.issue || details.pages) && (
                  <div>
                    <span className="font-medium">Citation:</span>{" "}
                    {details.volume && `Vol. ${details.volume}`}
                    {details.issue && `, Issue ${details.issue}`}
                    {details.pages && `, pp. ${details.pages}`}
                  </div>
                )}
                <div>
                  <span className="font-medium">Published:</span>{" "}
                  {format(new Date(publication.publicationDate), "PPP")}
                </div>
                <div>
                  <span className="font-medium">Submitted by:</span>{" "}
                  {publication.enteredBy?.name ?? "Unknown"}
                </div>
              </div>

              {details.proofUrl && (
                <div>
                  <a
                    href={details.proofUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline text-xs font-mono uppercase tracking-wider"
                  >
                    <ExternalLinkIcon className="w-3 h-3" />
                    View Proof
                  </a>
                </div>
              )}

              {details.remarks && (
                <div className="text-sm text-muted-foreground border-l-2 border-border pl-3 italic">
                   {details.remarks}
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t border-border">
                <div className="text-[10px] font-mono uppercase text-muted-foreground">
                  Added {format(new Date(publication.createdAt), "PPp")}
                </div>
                {publication.status === "PENDING" && (
                  <div className="flex gap-2">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-green-600 border-green-600"
                        >
                          <CheckCircleIcon className="w-4 h-4 mr-1" />
                          Approve
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Approve Publication</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to approve this publication? This will assign points to the project.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleApprove(publication.id)}
                          >
                            Approve
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 border-red-600"
                        >
                          <XCircleIcon className="w-4 h-4 mr-1" />
                          Reject
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Reject Publication</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to reject this publication? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleReject(publication.id)}
                          >
                            Reject
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
