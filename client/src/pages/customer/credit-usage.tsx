import { ArrowDownLeft, ArrowUpRight, FileText, MinusCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { fetchCustomerCreditUsage, type CreditReceivedItem, type CreditReducedItem, type CreditUsedItem } from "@/api/customer-data";
import { QueryErrorState } from "@/components/shared/query-error-state";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { dateStyle: "medium" });
  } catch {
    return iso;
  }
}

export default function CustomerCreditUsage() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["customer", "credits", "usage"],
    queryFn: fetchCustomerCreditUsage,
    refetchOnWindowFocus: true,
  });

  if (isError) {
    return (
      <div className="p-4">
        <QueryErrorState refetch={refetch} error={error} />
        <Button variant="outline" size="sm" className="mt-2" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  const creditsReceived: CreditReceivedItem[] = data?.creditsReceived ?? [];
  const creditsUsed: CreditUsedItem[] = data?.creditsUsed ?? [];
  const creditsReduced: CreditReducedItem[] = data?.creditsReduced ?? [];
  const proposalLinkPrefix = "/rfp/";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">Credit usage</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Where your credits came from and where you used them. You cannot purchase credits on this page.
        </p>
      </div>

      {/* Credits received */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ArrowDownLeft className="w-4 h-4 text-primary" />
            Credits received
          </CardTitle>
          <CardDescription>Who gave you credits (purchases and allocations)</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : creditsReceived.length === 0 ? (
            <p className="text-muted-foreground text-sm">No credits received yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="hidden sm:table-cell">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {creditsReceived.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{formatDate(row.date)}</TableCell>
                    <TableCell className="font-medium tabular-nums">+{row.amount.toLocaleString()}</TableCell>
                    <TableCell>
                      {row.source === "purchase"
                        ? "Purchase"
                        : row.source === "refund"
                          ? "Refund"
                          : "Allocated"}
                      {row.sourceDetail ? (row.source === "refund" ? ` — ${row.sourceDetail}` : ` by ${row.sourceDetail}`) : ""}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">
                      {row.description ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Credits reduced by admin */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MinusCircle className="w-4 h-4 text-destructive" />
            Credits reduced by admin
          </CardTitle>
          <CardDescription>When an admin or super admin removed or reduced your credits</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : creditsReduced.length === 0 ? (
            <p className="text-muted-foreground text-sm">No credits reduced by admin.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Taken by</TableHead>
                  <TableHead className="hidden sm:table-cell">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {creditsReduced.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{formatDate(row.date)}</TableCell>
                    <TableCell className="font-medium tabular-nums text-destructive">−{row.amount.toLocaleString()}</TableCell>
                    <TableCell>
                      {row.takenBy ?? "Admin"}
                      {row.roleLabel ? ` (${row.roleLabel})` : ""}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">
                      {row.description ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Credits used */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ArrowUpRight className="w-4 h-4 text-primary" />
            Credits used
          </CardTitle>
          <CardDescription>Where you spent credits (e.g. proposals, AI generation)</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : creditsUsed.length === 0 ? (
            <p className="text-muted-foreground text-sm">No credit usage recorded yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Where</TableHead>
                  <TableHead className="hidden sm:table-cell">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {creditsUsed.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{formatDate(row.date)}</TableCell>
                    <TableCell className="font-medium tabular-nums">−{row.amount.toLocaleString()}</TableCell>
                    <TableCell>
                      {row.proposalId != null && row.proposalTitle ? (
                        <Link
                          href={`${proposalLinkPrefix}${row.proposalId}`}
                          className="text-primary hover:underline inline-flex items-center gap-1"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          {row.proposalTitle}
                        </Link>
                      ) : (
                        row.description ?? "—"
                      )}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">
                      {row.description ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
