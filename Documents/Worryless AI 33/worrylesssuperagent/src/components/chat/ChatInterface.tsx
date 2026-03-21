import { useState, useRef, useEffect } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Send, Loader2, Calculator, Megaphone, UserCheck, Bot, Sparkles, UserCircle, Paperclip, X, FileText, Image as ImageIcon } from "lucide-react";
import ReactMarkdown from "react-markdown";

const API_URL = import.meta.env.VITE_API_URL as string;

type Attachment = {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  agent?: string;
  toolUsed?: string;
  imageUrl?: string;
  attachments?: Attachment[];
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "application/pdf",
  "text/plain", "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
];

export function ChatInterface() {
  const { token, userId } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const getAgentIcon = (agent?: string) => {
    switch (agent) {
      case "accountant":
        return <Calculator className="h-4 w-4" />;
      case "marketer":
        return <Megaphone className="h-4 w-4" />;
      case "sales_rep":
        return <UserCheck className="h-4 w-4" />;
      case "personal_assistant":
        return <UserCircle className="h-4 w-4" />;
      case "orchestrator":
        return <Sparkles className="h-4 w-4" />;
      default:
        return <Bot className="h-4 w-4" />;
    }
  };

  const getAgentName = (agent?: string) => {
    switch (agent) {
      case "accountant":
        return "AI Accountant";
      case "marketer":
        return "AI Marketer";
      case "sales_rep":
        return "AI Sales Rep";
      case "personal_assistant":
        return "AI Personal Assistant";
      case "orchestrator":
        return "Orchestrator";
      default:
        return "AI Assistant";
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    if (!token) {
      toast({ title: "Error", description: "Please sign in to upload files", variant: "destructive" });
      return;
    }

    setUploading(true);

    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_SIZE) {
        toast({ title: "File too large", description: `${file.name} exceeds 10MB limit`, variant: "destructive" });
        continue;
      }

      if (!ALLOWED_TYPES.includes(file.type)) {
        toast({ title: "Invalid file type", description: `${file.name} is not a supported file type`, variant: "destructive" });
        continue;
      }

      try {
        // Upload file via multipart form to the API server
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch(`${API_URL}/api/upload`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });

        if (!res.ok) {
          toast({ title: "Upload failed", description: `Failed to upload ${file.name}`, variant: "destructive" });
          continue;
        }

        const uploadResult = await res.json() as { url: string; path: string };
        const publicUrl = uploadResult.url;

        // Save to business_artifacts for AI context
        const sizeKB = Math.round(file.size / 1024);
        const fileExtension = file.name.split('.').pop()?.toLowerCase() || '';
        let fileDescription = `Uploaded document: ${file.name} (${sizeKB}KB)`;

        if (['xls', 'xlsx'].includes(fileExtension)) {
          fileDescription = `Excel Spreadsheet: ${file.name} (${sizeKB}KB)`;
        } else if (fileExtension === 'csv') {
          fileDescription = `CSV Data File: ${file.name} (${sizeKB}KB)`;
        } else if (fileExtension === 'pdf') {
          fileDescription = `PDF Document: ${file.name} (${sizeKB}KB)`;
        } else if (['doc', 'docx'].includes(fileExtension)) {
          fileDescription = `Word Document: ${file.name} (${sizeKB}KB)`;
        } else if (file.type.startsWith('image/')) {
          fileDescription = `Image: ${file.name} (${sizeKB}KB)`;
        }

        await api.post("/api/artifacts", {
          artifact_type: "uploaded_document",
          title: file.name,
          content: fileDescription,
          source_url: publicUrl,
          metadata: {
            file_type: file.type,
            file_size: file.size,
            file_extension: fileExtension,
            uploaded_via: "chat",
            upload_date: new Date().toISOString()
          }
        }, { token });

        setAttachments(prev => [...prev, {
          id: uploadResult.path,
          name: file.name,
          url: publicUrl,
          type: file.type,
          size: file.size
        }]);
      } catch (err) {
        toast({ title: "Upload failed", description: `Failed to upload ${file.name}`, variant: "destructive" });
      }
    }

    setUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const isImageFile = (type: string) => type.startsWith('image/');

  const handleSend = async () => {
    if (!input.trim() && attachments.length === 0) return;

    const currentAttachments = [...attachments];
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      attachments: currentAttachments.length > 0 ? currentAttachments : undefined
    };

    const currentInput = input;
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setAttachments([]);
    setLoading(true);

    try {
      // Get business context
      let businessContext = "";
      if (token) {
        try {
          const artifacts = await api.get<{ content: string; artifact_type: string }[]>(
            "/api/artifacts",
            { token }
          );
          if (artifacts) {
            businessContext = artifacts
              .filter(a => ["description", "brand_tone"].includes(a.artifact_type))
              .slice(0, 3)
              .map(a => a.content)
              .join(". ");
          }
        } catch {
          // ignore context fetch failure
        }
      }

      const conversationHistory = messages.map(m => ({
        role: m.role,
        content: m.content,
        attachments: m.attachments
      }));

      // Create placeholder message for streaming
      const assistantMessageId = (Date.now() + 1).toString();
      let assistantContent = "";
      let agentUsed = "";
      let toolUsed = "";

      // Use fetch for SSE streaming against Railway API
      const response = await fetch(`${API_URL}/api/orchestrator`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          message: currentInput,
          conversationHistory,
          userId,
          businessContext: businessContext.substring(0, 500),
          attachments: currentAttachments,
          stream: true
        })
      });

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

      const contentType = response.headers.get("content-type");
      if (contentType?.includes("text/event-stream") && response.body) {
        // Handle streaming response
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        // Add placeholder message
        setMessages(prev => [...prev, {
          id: assistantMessageId,
          role: "assistant",
          content: "",
          agent: undefined,
          toolUsed: undefined
        }]);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const jsonStr = line.slice(6).trim();
              if (!jsonStr) continue;
              try {
                const data = JSON.parse(jsonStr);
                if (data.type === "meta") {
                  agentUsed = data.agent;
                  toolUsed = data.toolUsed;
                  setMessages(prev => prev.map(m => m.id === assistantMessageId ? {
                    ...m,
                    agent: agentUsed,
                    toolUsed
                  } : m));
                } else if (data.type === "delta") {
                  assistantContent += data.content;
                  setMessages(prev => prev.map(m => m.id === assistantMessageId ? {
                    ...m,
                    content: assistantContent
                  } : m));
                }
              } catch {
                // Ignore parse errors for incomplete JSON
              }
            }
          }
        }

        // Save to database after streaming completes
        if (token && assistantContent) {
          const agentType = agentUsed === "orchestrator" || agentUsed === "general" || !agentUsed
            ? "accountant"
            : agentUsed as "accountant" | "marketer" | "sales_rep" | "personal_assistant";
          await api.post("/api/tasks", {
            agent_type: agentType,
            message: currentInput,
            response: assistantContent,
            status: "completed",
            completed_at: new Date().toISOString(),
            task_config: {
              toolUsed,
              attachments: currentAttachments
            }
          }, { token });
        }
      } else {
        // Handle non-streaming JSON response
        const data = await response.json();
        const assistantMessage: Message = {
          id: assistantMessageId,
          role: "assistant",
          content: data.response,
          agent: data.agent,
          toolUsed: data.toolUsed,
          imageUrl: data.actionTaken?.imageUrl
        };
        setMessages(prev => [...prev, assistantMessage]);
        if (token) {
          const agentType = data.agent === "orchestrator" || data.agent === "general"
            ? "accountant"
            : data.agent as "accountant" | "marketer" | "sales_rep" | "personal_assistant";
          await api.post("/api/tasks", {
            agent_type: agentType,
            message: currentInput,
            response: data.response,
            status: "completed",
            completed_at: new Date().toISOString(),
            task_config: {
              toolUsed: data.toolUsed,
              actionTaken: data.actionTaken,
              attachments: currentAttachments
            }
          }, { token });
        }
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast({
        title: "Error",
        description: message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Delegate Tasks to Your AI Team</h1>
        <p className="text-muted-foreground">
          Delegate tasks and let your AI Chief of Staff coordinate the right specialist to get things done
        </p>
      </div>

      <Card className="flex flex-col flex-1 min-h-0 border-2 border-primary/20 shadow-[0_0_15px_rgba(139,92,246,0.15)]">
        <CardHeader className="border-b shrink-0">
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Your AI Chief of Staff
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col p-0 min-h-0">
          <div className="flex-1 overflow-y-auto p-4" ref={scrollRef}>
            {messages.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">Start a conversation</p>
                <p className="text-sm mt-2 max-w-md mx-auto">
                  I'll analyze your request and route it to the right specialist:
                </p>
                <div className="flex flex-wrap justify-center gap-2 mt-4 text-xs">
                  <span className="px-2 py-1 bg-muted rounded-full flex items-center gap-1">
                    <Calculator className="h-3 w-3" /> Accountant
                  </span>
                  <span className="px-2 py-1 bg-muted rounded-full flex items-center gap-1">
                    <Megaphone className="h-3 w-3" /> Marketer
                  </span>
                  <span className="px-2 py-1 bg-muted rounded-full flex items-center gap-1">
                    <UserCheck className="h-3 w-3" /> Sales Rep
                  </span>
                  <span className="px-2 py-1 bg-muted rounded-full flex items-center gap-1">
                    <UserCircle className="h-3 w-3" /> Personal Assistant
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-lg p-3 ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                      {msg.role === "assistant" && (
                        <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                          {getAgentIcon(msg.agent)}
                          <span>{getAgentName(msg.agent)}</span>
                          {msg.toolUsed && (
                            <span className="text-xs px-1.5 py-0.5 bg-background/50 rounded">
                              {msg.toolUsed.replace(/_/g, " ")}
                            </span>
                          )}
                        </div>
                      )}
                      {/* Display attachments for user messages */}
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-2">
                          {msg.attachments.map(att => (
                            <div key={att.id} className="flex items-center gap-1.5 text-xs">
                              {isImageFile(att.type) ? (
                                <a href={att.url} target="_blank" rel="noopener noreferrer">
                                  <img
                                    src={att.url}
                                    alt={att.name}
                                    className="max-w-[150px] max-h-[100px] rounded border object-cover"
                                  />
                                </a>
                              ) : (
                                <a
                                  href={att.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1.5 px-2 py-1 bg-background/30 rounded hover:bg-background/50 transition-colors"
                                >
                                  <FileText className="h-3 w-3" />
                                  <span className="max-w-[100px] truncate">{att.name}</span>
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      <div className={`text-sm prose prose-sm max-w-none ${msg.role === "user" ? "prose-invert text-primary-foreground [&>*]:text-primary-foreground" : "dark:prose-invert"}`}>
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                      {msg.imageUrl && (
                        <div className="mt-3">
                          <img src={msg.imageUrl} alt="Generated content" className="max-w-full rounded-lg border shadow-sm" />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {loading && messages[messages.length - 1]?.role === "user" && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-lg p-3 flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-xs text-muted-foreground">Analyzing & routing...</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="p-4 border-t shrink-0 space-y-2">
            {/* Attachment previews */}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {attachments.map(att => (
                  <div
                    key={att.id}
                    className="flex items-center gap-2 px-2 py-1.5 bg-muted rounded-lg text-sm group"
                  >
                    {isImageFile(att.type) ? (
                      <ImageIcon className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="max-w-[120px] truncate">{att.name}</span>
                    <span className="text-xs text-muted-foreground">{formatFileSize(att.size)}</span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(att.id)}
                      className="ml-1 p-0.5 rounded-full hover:bg-background/50 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <form
              onSubmit={e => {
                e.preventDefault();
                handleSend();
              }}
              className="flex gap-2"
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                multiple
                accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.txt,.csv,.doc,.docx,.xls,.xlsx"
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading || uploading}
                title="Attach files"
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Paperclip className="h-4 w-4" />
                )}
              </Button>
              <Input
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Ask your AI team anything..."
                disabled={loading}
                className="flex-1"
              />
              <Button type="submit" disabled={loading || (!input.trim() && attachments.length === 0)}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
