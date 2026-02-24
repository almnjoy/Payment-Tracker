import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Brain, Send, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
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
        body: JSON.stringify({ query }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Request failed");
      return data;
    },
    onSuccess: (data) => {
      const lines: string[] = [];
      if (data.summary) lines.push(data.summary);
      if (data.analyzedTransactions) lines.push(`Analyzed ${data.analyzedTransactions} transactions (${data.dateRange?.start} to ${data.dateRange?.end}).`);
      if (data.recurringPayments?.length) {
        lines.push("");
        data.recurringPayments.forEach((p: any) => {
          lines.push(`• ${p.merchantName} — ${p.frequency}, ~$${(p.estimatedMonthlyCost / 100).toFixed(2)}/mo (${p.confidence} confidence)`);
        });
      }
      setMessages((prev) => [...prev, { role: "assistant", content: lines.join("\n") }]);
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
                      <div
                        className={`max-w-[80%] rounded-lg px-4 py-3 ${
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-gray-100 text-gray-900"
                        }`}
                      >
                        <pre className="whitespace-pre-wrap font-sans text-sm">{msg.content}</pre>
                      </div>
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
