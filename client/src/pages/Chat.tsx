import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  getChatThreads,
  getChatMessages,
  sendChatMessage,
  sendChatAttachment,
  sendChatVoice,
  getResidentsForChat,
  generateChatReport,
  getCurrentUser,
} from "@/lib/api";
import type { ChatThread, ChatMessage, ChatAttachment, Resident } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { Loader2, MessageSquare, Mic, Send, Image as ImageIcon, FileText } from "lucide-react";

type ChatMessageWithAttachments = ChatMessage & { attachments?: ChatAttachment[] };

const getSupportedMimeType = () => {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/m4a',
    'audio/aac',
    'audio/mpeg',
    'audio/ogg;codecs=opus',
    'audio/ogg'
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || '';
};

export default function Chat() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const currentUser = getCurrentUser();

  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [isReport, setIsReport] = useState(false);
  const [selectedResidentId, setSelectedResidentId] = useState<string>("");
  const [isRecording, setIsRecording] = useState(false);
  const [showReportGenerator, setShowReportGenerator] = useState(false);
  const [reportResidentId, setReportResidentId] = useState("");
  const [reportStart, setReportStart] = useState("");
  const [reportEnd, setReportEnd] = useState("");
  const [generatedReport, setGeneratedReport] = useState<string>("");

  useEffect(() => {
    if (!showReportGenerator) return;
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    setReportStart(startOfWeek.toISOString().split('T')[0]);
    setReportEnd(endOfWeek.toISOString().split('T')[0]);
    setGeneratedReport("");
  }, [showReportGenerator]);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const { data: threads, isLoading: threadsLoading } = useQuery({
    queryKey: ["/api/chat/threads"],
    queryFn: () => getChatThreads(),
  });

  const { data: residents } = useQuery({
    queryKey: ["/api/residents/for-chat"],
    queryFn: () => getResidentsForChat(),
    enabled: !!currentUser,
  });

  useEffect(() => {
    if (!threads || threads.length === 0) return;
    if (activeThreadId) return;
    const familyThread = threads.find((thread) => thread.type === "family");
    setActiveThreadId(familyThread?.id ?? threads[0].id);
  }, [threads, activeThreadId]);

  useEffect(() => {
    setSelectedResidentId("");
  }, [activeThreadId]);

  useEffect(() => {
    setReportResidentId("");
    setGeneratedReport("");
  }, [activeThreadId]);

  const { data: messagesData, isLoading: messagesLoading } = useQuery({
    queryKey: ["/api/chat/threads", activeThreadId, "messages"],
    queryFn: () => getChatMessages(activeThreadId || ""),
    enabled: !!activeThreadId,
  });

  const activeThread = messagesData?.thread || threads?.find((thread) => thread.id === activeThreadId) || null;
  const messages = (messagesData?.messages || []) as ChatMessageWithAttachments[];

  const filteredResidents = useMemo(() => {
    if (!residents) return [];
    if (!activeThread) return residents;
    if (activeThread.type === "house" && activeThread.houseId) {
      return residents.filter((resident: Resident & { houseName?: string }) => resident.house === activeThread.houseId);
    }
    return residents;
  }, [residents, activeThread]);

  const residentLookup = useMemo(() => {
    if (!residents) return new Map<string, string>();
    return new Map(
      residents.map((resident: Resident & { houseName?: string }) => [
        resident.id,
        `${resident.firstName} ${resident.lastInitial}.`,
      ])
    );
  }, [residents]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length, activeThreadId]);

  const sendMutation = useMutation({
    mutationFn: (payload: { body: string; messageType: "text" | "report"; residentId?: string }) =>
      sendChatMessage(activeThreadId || "", payload.body, payload.messageType, payload.residentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat/threads", activeThreadId, "messages"] });
      setMessageText("");
    },
    onError: (error: any) => {
      toast({
        title: "Message failed",
        description: error?.message || "Failed to send message.",
        variant: "destructive",
      });
    },
  });

  const attachmentMutation = useMutation({
    mutationFn: (payload: { file: File; body?: string; messageType: "text" | "report"; residentId?: string }) =>
      sendChatAttachment(activeThreadId || "", payload.file, payload.body, payload.messageType, payload.residentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat/threads", activeThreadId, "messages"] });
      setMessageText("");
    },
    onError: (error: any) => {
      toast({
        title: "Upload failed",
        description: error?.message || "Failed to upload attachment.",
        variant: "destructive",
      });
    },
  });

  const voiceMutation = useMutation({
    mutationFn: (payload: { audio: Blob; messageType: "text" | "report"; residentId?: string }) =>
      sendChatVoice(activeThreadId || "", payload.audio, payload.messageType, payload.residentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat/threads", activeThreadId, "messages"] });
    },
    onError: (error: any) => {
      toast({
        title: "Voice failed",
        description: error?.message || "Failed to send voice message.",
        variant: "destructive",
      });
    },
  });

  const reportMutation = useMutation({
    mutationFn: () =>
      generateChatReport(activeThreadId || "", reportResidentId, reportStart, reportEnd),
    onSuccess: (data) => {
      setGeneratedReport(data.reportText || "");
      toast({
        title: "Report ready",
        description: "Report generated from chat entries.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Report failed",
        description: error?.message || "Failed to generate report.",
        variant: "destructive",
      });
    },
  });

  const handleSend = () => {
    if (!activeThreadId || !messageText.trim()) return;
    if (isReport && !selectedResidentId) {
      toast({
        title: "Select resident",
        description: "Pick a resident for report entries.",
        variant: "destructive",
      });
      return;
    }
    sendMutation.mutate({
      body: messageText.trim(),
      messageType: isReport ? "report" : "text",
      residentId: selectedResidentId || undefined,
    });
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !activeThreadId) return;
    if (isReport && !selectedResidentId) {
      toast({
        title: "Select resident",
        description: "Pick a resident for report attachments.",
        variant: "destructive",
      });
      return;
    }
    attachmentMutation.mutate({
      file,
      body: messageText.trim() || undefined,
      messageType: isReport ? "report" : "text",
      residentId: selectedResidentId || undefined,
    });
    event.target.value = "";
  };

  const startRecording = async () => {
    if (!activeThreadId) return;
    if (isReport && !selectedResidentId) {
      toast({
        title: "Select resident",
        description: "Pick a resident for report voice notes.",
        variant: "destructive",
      });
      return;
    }
    if (!navigator?.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      toast({
        title: "Voice not supported",
        description: "This device does not support in-app voice recording.",
        variant: "destructive",
      });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = getSupportedMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        stream.getTracks().forEach(track => track.stop());
        if (audioBlob.size > 0) {
          voiceMutation.mutate({
            audio: audioBlob,
            messageType: isReport ? "report" : "text",
            residentId: selectedResidentId || undefined,
          });
        }
      };

      recorder.start();
      setIsRecording(true);
    } catch (error) {
      toast({
        title: "Microphone unavailable",
        description: "Please check microphone permissions.",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const handleGenerateReport = () => {
    if (!reportResidentId || !reportStart || !reportEnd) {
      toast({
        title: "Missing fields",
        description: "Select resident and date range.",
        variant: "destructive",
      });
      return;
    }
    reportMutation.mutate();
  };

  if (threadsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!currentUser) {
    setLocation("/login");
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col bg-surface-50">
      <header className="bg-white border-b sticky top-0 z-40">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">HouseGuide Chat</h1>
          </div>
          <Button variant="outline" size="sm" onClick={() => setLocation("/dashboard")}>
            Back to Dashboard
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {!isMobile && (
          <aside className="w-64 border-r bg-white overflow-y-auto">
            <div className="p-3 space-y-2">
              {threads?.map((thread) => (
                <button
                  key={thread.id}
                  className={`w-full text-left px-3 py-2 rounded-lg ${
                    activeThreadId === thread.id ? "bg-primary/10 text-primary" : "hover:bg-gray-100"
                  }`}
                  onClick={() => setActiveThreadId(thread.id)}
                >
                  <div className="text-sm font-medium">{thread.name}</div>
                  <div className="text-xs text-gray-500">
                    {thread.type === "family" ? "Org Family Chat" : "Private House Thread"}
                  </div>
                </button>
              ))}
            </div>
          </aside>
        )}

        <main className="flex-1 flex flex-col">
          {isMobile && (
            <div className="p-3 border-b bg-white">
              <select
                className="w-full border rounded-md px-3 py-2 text-sm"
                value={activeThreadId ?? ""}
                onChange={(e) => setActiveThreadId(e.target.value)}
              >
                {threads?.map((thread) => (
                  <option key={thread.id} value={thread.id}>
                    {thread.name} ({thread.type === "family" ? "Family" : "House"})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messagesLoading && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading messages...
              </div>
            )}

            {!messagesLoading && messages.length === 0 && (
              <div className="text-sm text-gray-500">
                No messages yet. Start the conversation.
              </div>
            )}

            {messages.map((message) => (
              <Card key={message.id} className="border-none shadow-sm">
                <CardContent className="p-3 space-y-2">
                  <div className="text-xs text-gray-500">
                    {message.senderId === currentUser?.id ? "You" : "Team"} • {message.messageType === "report" ? "Report" : "Message"} • {new Date(message.created).toLocaleString()}
                  </div>
                  {message.messageType === "report" && message.residentId && (
                    <div className="text-xs font-semibold text-gray-700">
                      {residentLookup.get(message.residentId) || "Resident report"}
                    </div>
                  )}
                  <div className="text-sm whitespace-pre-wrap">{message.body}</div>
                  {message.attachments && message.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {message.attachments.map((attachment) => (
                        attachment.mimeType?.startsWith("image/") ? (
                          <a key={attachment.id} href={attachment.url} target="_blank" rel="noreferrer">
                            <img
                              src={attachment.url}
                              alt={attachment.filename}
                              className="h-24 w-24 object-cover rounded-md border"
                            />
                          </a>
                        ) : (
                          <a
                            key={attachment.id}
                            href={attachment.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-blue-600 underline"
                          >
                            {attachment.filename}
                          </a>
                        )
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="border-t bg-white p-4 space-y-3">
            {activeThread?.type === "house" && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setShowReportGenerator(true)}
              >
                <FileText className="h-4 w-4 mr-2" />
                Generate Report from Thread
              </Button>
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <Switch checked={isReport} onCheckedChange={setIsReport} />
                <span>Report entry</span>
              </div>
              <div className="text-xs text-gray-500">
                {activeThread?.type === "family" ? "Family Chat" : "House Thread"}
              </div>
            </div>

            {isReport && (
              <div className="space-y-2">
                <Label className="text-xs">Resident</Label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  value={selectedResidentId}
                  onChange={(e) => setSelectedResidentId(e.target.value)}
                >
                  <option value="">Select resident</option>
                  {filteredResidents.map((resident: Resident & { houseName?: string }) => (
                    <option key={resident.id} value={resident.id}>
                      {resident.firstName} {resident.lastInitial}. {resident.houseName ? `(${resident.houseName})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <Textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Type your message..."
              className="min-h-[80px]"
            />

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={handleSend}
                disabled={sendMutation.isPending || !messageText.trim()}
                className="flex items-center gap-2"
              >
                <Send className="h-4 w-4" />
                Send
              </Button>
              <Button
                variant="outline"
                className="flex items-center gap-2"
                onClick={() => document.getElementById("chat-file-input")?.click()}
                disabled={attachmentMutation.isPending}
              >
                <ImageIcon className="h-4 w-4" />
                Photo
              </Button>
              <input
                id="chat-file-input"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
              {!isRecording ? (
                <Button
                  variant="outline"
                  className="flex items-center gap-2"
                  onClick={startRecording}
                  disabled={voiceMutation.isPending}
                >
                  <Mic className="h-4 w-4" />
                  Voice
                </Button>
              ) : (
                <Button variant="destructive" onClick={stopRecording}>
                  Stop
                </Button>
              )}
            </div>
          </div>
        </main>
      </div>

      <Dialog open={showReportGenerator} onOpenChange={setShowReportGenerator}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Generate Resident Report</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Resident</Label>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm"
                value={reportResidentId}
                onChange={(e) => setReportResidentId(e.target.value)}
              >
                <option value="">Select resident</option>
                {filteredResidents.map((resident: Resident & { houseName?: string }) => (
                  <option key={resident.id} value={resident.id}>
                    {resident.firstName} {resident.lastInitial}. {resident.houseName ? `(${resident.houseName})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Start date</Label>
                <Input type="date" value={reportStart} onChange={(e) => setReportStart(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>End date</Label>
                <Input type="date" value={reportEnd} onChange={(e) => setReportEnd(e.target.value)} />
              </div>
            </div>

            <Button onClick={handleGenerateReport} disabled={reportMutation.isPending} className="w-full">
              {reportMutation.isPending ? "Generating..." : "Generate Report"}
            </Button>

            {generatedReport && (
              <div className="space-y-2">
                <Textarea value={generatedReport} readOnly className="min-h-[200px]" />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigator.clipboard.writeText(generatedReport)}
                  >
                    Copy
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const blob = new Blob([generatedReport], { type: "text/plain" });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement("a");
                      link.href = url;
                      link.download = "Resident_Report.txt";
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      URL.revokeObjectURL(url);
                    }}
                  >
                    Download
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
