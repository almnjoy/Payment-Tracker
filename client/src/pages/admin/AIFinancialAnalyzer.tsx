import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Brain, Send, Loader2, DollarSign, Calendar, TrendingUp, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";

interface RecurringPayment {
  merchantName: string;
  frequency: string;
  averageAmount: number;
  estimatedMonthlyCost: number;
  transactionCount: number;
  lastDate: string;
  confidence: string;
}

interface AnalysisResult {
  summary: string;
  recurringPayments: RecurringPayment[];
  totalMonthlyEstimate: number;
  analyzedTransactions: number;
  dateRange: { start: string; end: string };
}

export default function AIFinancialAnalyzer() {
  const [query, setQuery] = useState("");
  const { toast } = useToast();

  const analyzeMutation = useMutation({
    mutationFn: async (input: { query: string; days?: number }) => {
      const response = await fetch("/api/admin/ai-finance/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(input),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Analysis failed");
      }
      return data as AnalysisResult;
    },
    onError: (error: Error) => {
      toast({ title: "Analysis Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (!query.trim()) {
      toast({ title: "Error", description: "Please enter a question", variant: "destructive" });
      return;
    }
    analyzeMutation.mutate({ query: query.trim() });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleReset = () => {
    setQuery("");
    analyzeMutation.reset();
  };

  const formatCents = (cents: number) => {
    return "$" + (cents / 100).toFixed(2);
  };

  const result = analyzeMutation.data;

  const confidenceBadgeColor = (confidence: string) => {
    switch (confidence) {
      case "high": return "bg-green-100 text-green-800";
      case "medium": return "bg-yellow-100 text-yellow-800";
      case "low": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const frequencyBadgeColor = (frequency: string) => {
    switch (frequency) {
      case "weekly": return "bg-purple-100 text-purple-800";
      case "biweekly": return "bg-blue-100 text-blue-800";
      case "monthly": return "bg-indigo-100 text-indigo-800";
      case "yearly": return "bg-teal-100 text-teal-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <Layout role="admin">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-2" data-testid="text-page-title">
              <Brain className="h-8 w-8 text-primary" />
              AI Financial Analyzer
            </h2>
            <p className="text-gray-500">Analyze your transactions to detect recurring payments and spending patterns.</p>
          </div>
          {result && (
            <Button variant="outline" onClick={handleReset} data-testid="button-reset">
              <RotateCcw className="h-4 w-4 mr-2" />
              New Analysis
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Send className="h-5 w-5" />
                  Ask a Question
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Input
                    placeholder="e.g. What are my recurring payments?"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={analyzeMutation.isPending}
                    data-testid="input-query"
                  />
                  <p className="text-xs text-gray-400">Press Enter or click Analyze to run</p>
                </div>
                <Button
                  className="w-full"
                  onClick={handleSubmit}
                  disabled={analyzeMutation.isPending || !query.trim()}
                  data-testid="button-analyze"
                >
                  {analyzeMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Brain className="h-4 w-4 mr-2" />
                      Analyze
                    </>
                  )}
                </Button>

                {result && (
                  <div className="pt-4 space-y-3 border-t">
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Calendar className="h-4 w-4" />
                      <span data-testid="text-date-range">
                        {result.dateRange.start} → {result.dateRange.end}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <TrendingUp className="h-4 w-4" />
                      <span data-testid="text-transactions-analyzed">
                        {result.analyzedTransactions} transactions analyzed
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-3 space-y-4">
            {analyzeMutation.isPending && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                  <p className="text-gray-500 text-lg" data-testid="text-loading">Analyzing your transactions...</p>
                  <p className="text-gray-400 text-sm mt-1">Detecting recurring payment patterns</p>
                </CardContent>
              </Card>
            )}

            {!analyzeMutation.isPending && !result && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                  <Brain className="h-16 w-16 text-gray-300 mb-4" />
                  <h3 className="text-lg font-medium text-gray-600" data-testid="text-empty-state">Ready to Analyze</h3>
                  <p className="text-gray-400 mt-1 max-w-sm">
                    Enter a question in the prompt box and click Analyze to detect recurring payments from your linked bank transactions.
                  </p>
                </CardContent>
              </Card>
            )}

            {result && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-green-600" />
                      Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-700 mb-4" data-testid="text-summary">{result.summary}</p>
                    <div className="flex items-center gap-4">
                      <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                        <p className="text-xs text-green-600 font-medium uppercase">Est. Monthly Total</p>
                        <p className="text-2xl font-bold text-green-700" data-testid="text-monthly-total">
                          {formatCents(result.totalMonthlyEstimate)}
                        </p>
                      </div>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
                        <p className="text-xs text-blue-600 font-medium uppercase">Recurring Payments</p>
                        <p className="text-2xl font-bold text-blue-700" data-testid="text-recurring-count">
                          {result.recurringPayments.length}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Detected Recurring Payments</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {result.recurringPayments.length === 0 ? (
                      <p className="text-gray-500 text-center py-8" data-testid="text-no-recurring">
                        No recurring payments detected in the analyzed period.
                      </p>
                    ) : (
                      <ScrollArea className="max-h-[500px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Merchant</TableHead>
                              <TableHead>Frequency</TableHead>
                              <TableHead className="text-right">Avg Amount</TableHead>
                              <TableHead className="text-right">Monthly Est.</TableHead>
                              <TableHead className="text-center">Count</TableHead>
                              <TableHead>Last Date</TableHead>
                              <TableHead>Confidence</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {result.recurringPayments.map((payment, index) => (
                              <TableRow key={index} data-testid={`row-recurring-${index}`}>
                                <TableCell className="font-medium" data-testid={`text-merchant-${index}`}>
                                  {payment.merchantName}
                                </TableCell>
                                <TableCell>
                                  <Badge className={frequencyBadgeColor(payment.frequency)} data-testid={`badge-frequency-${index}`}>
                                    {payment.frequency}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right" data-testid={`text-avg-amount-${index}`}>
                                  {formatCents(payment.averageAmount)}
                                </TableCell>
                                <TableCell className="text-right font-semibold" data-testid={`text-monthly-cost-${index}`}>
                                  {formatCents(payment.estimatedMonthlyCost)}
                                </TableCell>
                                <TableCell className="text-center" data-testid={`text-count-${index}`}>
                                  {payment.transactionCount}
                                </TableCell>
                                <TableCell data-testid={`text-last-date-${index}`}>
                                  {payment.lastDate}
                                </TableCell>
                                <TableCell>
                                  <Badge className={confidenceBadgeColor(payment.confidence)} data-testid={`badge-confidence-${index}`}>
                                    {payment.confidence}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
