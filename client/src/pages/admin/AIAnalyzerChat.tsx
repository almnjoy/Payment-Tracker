import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Brain, Send, Loader2, DollarSign, TrendingUp, Calendar, Hash } from "lucide-react";
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

interface AnalysisData {
  summary: string;
  recurringPayments: RecurringPayment[];
  totalMonthlyEstimate: number;
  analyzedTransactions: number;
  dateRange: { start: string; end: string };
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  data?: AnalysisData;
}

const formatCents = (cents: number) => "$" + (cents / 100).toFixed(2);

const frequencyColor = (f: string) => {
  switch (f) {
    case "weekly": return "bg-purple-100 text-purple-800";
    case "biweekly": return "bg-blue-100 text-blue-800";
    case "monthly": return "bg-indigo-100 text-indigo-800";
    case "yearly": return "bg-teal-100 text-teal-800";
    default: return "bg-gray-100 text-gray-800";
  }
};

const confidenceColor = (c: string) => {
  switch (c) {
    case "high": return "bg-green-100 text-green-800";
    case "medium": return "bg-yellow-100 text-yellow-800";
    case "low": return "bg-red-100 text-red-800";
    default: return "bg-gray-100 text-gray-800";
  }
};

function AssistantDashboard({ data }: { data: AnalysisData }) {
  return (
    <div className="space-y-4 w-full" data-testid="assistant-dashboard">
      <p className="text-sm text-gray-700 leading-relaxed" data-testid="text-summary">
        {data.summary}
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="bg-white border rounded-lg p-3 text-center">
          <DollarSign className="h-4 w-4 mx-auto text-green-600 mb-1" />
          <p className="text-lg font-bold text-gray-900" data-testid="text-monthly-total">
            {formatCents(data.totalMonthlyEstimate)}
          </p>
          <p className="text-xs text-gray-500">Est. Monthly</p>
        </div>
        <div className="bg-white border rounded-lg p-3 text-center">
          <TrendingUp className="h-4 w-4 mx-auto text-blue-600 mb-1" />
          <p className="text-lg font-bold text-gray-900" data-testid="text-recurring-count">
            {data.recurringPayments.length}
          </p>
          <p className="text-xs text-gray-500">Recurring</p>
        </div>
        <div className="bg-white border rounded-lg p-3 text-center">
          <Hash className="h-4 w-4 mx-auto text-purple-600 mb-1" />
          <p className="text-lg font-bold text-gray-900" data-testid="text-analyzed-count">
            {data.analyzedTransactions}
          </p>
          <p className="text-xs text-gray-500">Analyzed</p>
        </div>
        <div className="bg-white border rounded-lg p-3 text-center">
          <Calendar className="h-4 w-4 mx-auto text-orange-600 mb-1" />
          <p className="text-sm font-medium text-gray-900" data-testid="text-date-range">
            {data.dateRange.start}
          </p>
          <p className="text-xs text-gray-500">to {data.dateRange.end}</p>
        </div>
      </div>

      {data.recurringPayments.length > 0 && (
        <div className="overflow-x-auto -mx-1">
          <Table>
            <TableHeader>
              <TableRow className="bg-white/50">
                <TableHead className="text-xs">Merchant</TableHead>
                <TableHead className="text-xs">Freq</TableHead>
                <TableHead className="text-xs text-right">Avg</TableHead>
                <TableHead className="text-xs text-right">Monthly</TableHead>
                <TableHead className="text-xs text-center">Count</TableHead>
                <TableHead className="text-xs">Last</TableHead>
                <TableHead className="text-xs">Conf</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.recurringPayments.map((p, idx) => (
                <TableRow key={idx} data-testid={`row-recurring-${idx}`}>
                  <TableCell className="max-w-[140px] md:max-w-[200px]">
                    <span
                      className="text-sm font-medium block truncate"
                      title={p.merchantName}
                    >
                      {p.merchantName}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge className={`text-xs ${frequencyColor(p.frequency)}`}>
                      {p.frequency}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {formatCents(p.averageAmount)}
                  </TableCell>
                  <TableCell className="text-right text-sm font-semibold">
                    {formatCents(p.estimatedMonthlyCost)}
                  </TableCell>
                  <TableCell className="text-center text-sm">
                    {p.transactionCount}
                  </TableCell>
                  <TableCell className="text-sm whitespace-nowrap">
                    {p.lastDate}
                  </TableCell>
                  <TableCell>
                    <Badge className={`text-xs ${confidenceColor(p.confidence)}`}>
                      {p.confidence}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

export default function AIAnalyzerChat() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const { toast } = useToast();

  const chatMutation = useMutation({
    mutationFn: async (query: string) => {
      const response = await fetch("/api/admin/ai-finance/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ query, useLLM: true }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Request failed");
      return data as AnalysisData;
    },
    onSuccess: (data) => {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.summary || "", data },
      ]);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${error.message}` }]);
    },
  });

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setInput("");
    chatMutation.mutate(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Layout role="admin">
      <div className="flex flex-col h-[calc(100vh-120px)]">
        <div className="mb-4">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-2" data-testid="text-page-title">
            <Brain className="h-8 w-8 text-primary" />
            AI Analyzer
          </h2>
          <p className="text-gray-500">Ask questions about your financial data.</p>
        </div>

        <Card className="flex-1 flex flex-col min-h-0">
          <CardContent className="flex-1 flex flex-col p-0 min-h-0">
            <ScrollArea className="flex-1 p-4">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-20 text-center">
                  <Brain className="h-16 w-16 text-gray-200 mb-4" />
                  <h3 className="text-lg font-medium text-gray-500" data-testid="text-empty-state">Ask me anything</h3>
                  <p className="text-gray-400 text-sm mt-1 max-w-sm">
                    Try "What are my recurring payments?" or "Show me my spending patterns."
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((msg, i) => (
                    <div
                      key={i}
                      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                      data-testid={`chat-message-${i}`}
                    >
                      {msg.role === "user" ? (
                        <div className="max-w-[80%] rounded-lg px-4 py-3 bg-primary text-primary-foreground">
                          <p className="text-sm">{msg.content}</p>
                        </div>
                      ) : msg.data ? (
                        <div className="max-w-[95%] md:max-w-[85%] rounded-lg px-4 py-4 bg-gray-50 border border-gray-200">
                          <AssistantDashboard data={msg.data} />
                        </div>
                      ) : (
                        <div className="max-w-[80%] rounded-lg px-4 py-3 bg-gray-100 text-gray-900">
                          <pre className="whitespace-pre-wrap font-sans text-sm">{msg.content}</pre>
                        </div>
                      )}
                    </div>
                  ))}
                  {chatMutation.isPending && (
                    <div className="flex justify-start" data-testid="chat-loading">
                      <div className="bg-gray-100 rounded-lg px-4 py-3 flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
                        <span className="text-sm text-gray-500">Thinking...</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>

            <div className="border-t p-4 flex gap-2">
              <Input
                placeholder="Ask about your finances..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={chatMutation.isPending}
                data-testid="input-chat"
              />
              <Button
                onClick={handleSend}
                disabled={chatMutation.isPending || !input.trim()}
                data-testid="button-send"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
