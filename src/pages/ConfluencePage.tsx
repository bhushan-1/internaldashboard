import { useState, useEffect, useRef, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  BotMessageSquare, Upload, Trash2, Loader2, Send, FileText,
  BookOpen, Search, Sparkles, FolderOpen, Plus, X, Clock,
  User, Bot, AlertTriangle, ChevronDown, ChevronUp,
} from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/hooks/useAuth";
import { fetchDocuments, uploadDocument, deleteDocument, askQuestion, type KBDocument, type SourceDoc } from "@/lib/confluenceApi";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  sources?: number;
  sourceDocs?: SourceDoc[];
}

const CATEGORIES = ["General", "Engineering", "Product", "HR", "Finance", "Operations", "Legal", "Support"];

const ConfluencePage = () => {
  const { isAdmin } = useAuth();

  // Document state
  const [documents, setDocuments] = useState<KBDocument[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadContent, setUploadContent] = useState("");
  const [uploadCategory, setUploadCategory] = useState("General");
  const [isUploading, setIsUploading] = useState(false);
  const [docSearch, setDocSearch] = useState("");
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);
  const [viewingDoc, setViewingDoc] = useState<KBDocument | null>(null);

  // Open document viewer by ID
  const openDocById = useCallback((docId: string) => {
    const doc = documents.find(d => d.id === docId);
    if (doc) setViewingDoc(doc);
  }, [documents]);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Load documents ──
  const loadDocs = useCallback(async () => {
    setIsLoadingDocs(true);
    try {
      const data = await fetchDocuments();
      setDocuments(data);
    } catch (err) {
      toast.error("Failed to load documents: " + (err instanceof Error ? err.message : "Unknown"));
    } finally { setIsLoadingDocs(false); }
  }, []);

  useEffect(() => { loadDocs(); }, [loadDocs]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // ── Upload document ──
  const handleUpload = async () => {
    if (!uploadTitle.trim() || !uploadContent.trim()) { toast.error("Title and content are required"); return; }
    setIsUploading(true);
    try {
      await uploadDocument(uploadTitle.trim(), uploadContent.trim(), uploadCategory);
      toast.success(`Document "${uploadTitle}" uploaded`);
      setUploadOpen(false);
      setUploadTitle(""); setUploadContent(""); setUploadCategory("General");
      loadDocs();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Upload failed"); }
    finally { setIsUploading(false); }
  };

  // ── Delete document ──
  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    try {
      await deleteDocument(id);
      toast.success(`Deleted "${title}"`);
      loadDocs();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Delete failed"); }
  };

  // ── File upload handler ──
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("File too large (max 5MB)"); return; }
    try {
      const text = await file.text();
      setUploadTitle(file.name.replace(/\.[^.]+$/, ""));
      setUploadContent(text);
      toast.info(`Loaded "${file.name}" — review and click Upload`);
    } catch { toast.error("Failed to read file"); }
  };

  // ── Ask AI ──
  const handleAsk = async () => {
    const question = chatInput.trim();
    if (!question) return;

    const userMsg: ChatMessage = { id: Date.now().toString(), role: "user", content: question, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setChatInput("");
    setIsThinking(true);

    try {
      // Server searches documents + calls Anthropic API, returns the answer
      const { answer, matchCount, sourceDocs } = await askQuestion(question);

      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(), role: "assistant", content: answer, timestamp: new Date(), sources: matchCount, sourceDocs,
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (err) {
      const errMsg: ChatMessage = {
        id: (Date.now() + 1).toString(), role: "assistant",
        content: `Sorry, I encountered an error: ${err instanceof Error ? err.message : "Unknown error"}. Please try again.`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errMsg]);
    } finally { setIsThinking(false); inputRef.current?.focus(); }
  };

  // ── Filtered docs ──
  const filteredDocs = documents.filter(d =>
    !docSearch || d.title.toLowerCase().includes(docSearch.toLowerCase()) ||
    d.category.toLowerCase().includes(docSearch.toLowerCase()) ||
    d.content.toLowerCase().includes(docSearch.toLowerCase())
  );

  const categories = [...new Set(documents.map(d => d.category))];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center rounded-xl shadow-lg shadow-violet-500/20">
              <BotMessageSquare className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Confluence</h1>
              <p className="text-muted-foreground mt-0.5">Ask AI about internal knowledge — powered by your uploaded documents</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-xs gap-1">
              <FileText className="w-3 h-3" />{documents.length} doc{documents.length !== 1 ? "s" : ""}
            </Badge>
          </div>
        </div>

        {/* Main Layout: Chat + Documents */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" style={{ minHeight: "calc(100vh - 220px)" }}>

          {/* ═══ CHAT PANEL (2/3) ═══ */}
          <div className="lg:col-span-2">
            <Card className="h-full flex flex-col overflow-hidden border-violet-500/10">
              <CardHeader className="py-3 px-4 border-b bg-gradient-to-r from-violet-500/5 to-indigo-500/5">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-violet-500" />
                  <CardTitle className="text-sm font-semibold">Ask AI</CardTitle>
                  <span className="text-xs text-muted-foreground ml-auto">Searches {documents.length} documents</span>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col p-0 min-h-0">
                {/* Messages */}
                <ScrollArea className="flex-1 p-4" style={{ maxHeight: "calc(100vh - 380px)" }}>
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full py-16 text-center">
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/10 to-indigo-500/10 flex items-center justify-center mb-4">
                        <BotMessageSquare className="w-8 h-8 text-violet-500/60" />
                      </div>
                      <p className="text-lg font-semibold text-muted-foreground/80">Ask anything about your internal docs</p>
                      <p className="text-sm text-muted-foreground/50 mt-1 max-w-md">
                        I'll search through uploaded documents and give you answers based on your team's knowledge base.
                      </p>
                      {documents.length === 0 && (
                        <div className="mt-6 px-4 py-3 rounded-lg border border-amber-500/20 bg-amber-500/5 flex items-center gap-2 text-xs text-amber-600">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          No documents uploaded yet. {isAdmin ? "Upload some in the Documents panel." : "Ask an admin to upload documents."}
                        </div>
                      )}
                      <div className="mt-6 flex flex-wrap gap-2 justify-center">
                        {["What are our engineering guidelines?", "How does billing work?", "What's our leave policy?"].map(q => (
                          <button key={q} onClick={() => { setChatInput(q); inputRef.current?.focus(); }}
                            className="px-3 py-1.5 rounded-full border text-xs text-muted-foreground hover:bg-muted/50 transition-colors">
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {messages.map(msg => (
                        <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                          {msg.role === "assistant" && (
                            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
                              <Bot className="w-3.5 h-3.5 text-white" />
                            </div>
                          )}
                          <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                            msg.role === "user"
                              ? "bg-primary text-primary-foreground rounded-br-md"
                              : "bg-muted/50 border rounded-bl-md"
                          }`}>
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                            <div className="flex items-center gap-2 mt-1.5">
                              <span className="text-[10px] opacity-50">{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              {msg.sources !== undefined && msg.sources > 0 && <span className="text-[10px] opacity-50">· {msg.sources} source{msg.sources !== 1 ? "s" : ""}</span>}
                            </div>
                            {/* Clickable source documents */}
                            {msg.sourceDocs && msg.sourceDocs.length > 0 && (
                              <div className="mt-2 pt-2 border-t border-border/30 flex flex-wrap gap-1.5">
                                <span className="text-[10px] text-muted-foreground/60 self-center mr-0.5">Sources:</span>
                                {msg.sourceDocs.map(src => (
                                  <button key={src.id} onClick={() => openDocById(src.id)}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20 hover:bg-violet-500/20 hover:border-violet-500/40 transition-colors cursor-pointer">
                                    <FileText className="w-2.5 h-2.5" />
                                    {src.title}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          {msg.role === "user" && (
                            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                              <User className="w-3.5 h-3.5 text-primary" />
                            </div>
                          )}
                        </div>
                      ))}
                      {isThinking && (
                        <div className="flex gap-3">
                          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0">
                            <Bot className="w-3.5 h-3.5 text-white" />
                          </div>
                          <div className="bg-muted/50 border rounded-2xl rounded-bl-md px-4 py-3">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Searching documents and thinking...</span>
                            </div>
                          </div>
                        </div>
                      )}
                      <div ref={chatEndRef} />
                    </div>
                  )}
                </ScrollArea>
                {/* Input */}
                <div className="p-3 border-t bg-background">
                  <div className="flex gap-2">
                    <Input ref={inputRef} value={chatInput} onChange={e => setChatInput(e.target.value)}
                      placeholder="Ask a question about your internal docs..."
                      className="flex-1"
                      onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAsk(); } }}
                      disabled={isThinking} />
                    <Button onClick={handleAsk} disabled={isThinking || !chatInput.trim()} size="sm" className="h-9 px-4 gap-1.5 bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-600 hover:to-indigo-700">
                      {isThinking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      Ask
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ═══ DOCUMENTS PANEL (1/3) ═══ */}
          <div className="lg:col-span-1">
            <Card className="h-full flex flex-col overflow-hidden">
              <CardHeader className="py-3 px-4 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-muted-foreground" />
                    <CardTitle className="text-sm font-semibold">Documents</CardTitle>
                  </div>
                  {isAdmin && (
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setUploadOpen(true)}>
                      <Plus className="w-3 h-3" />Upload
                    </Button>
                  )}
                </div>
                <div className="mt-2 relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input placeholder="Search documents..." value={docSearch} onChange={e => setDocSearch(e.target.value)}
                    className="pl-8 h-8 text-xs" />
                </div>
              </CardHeader>
              <CardContent className="flex-1 p-0 min-h-0">
                <ScrollArea className="h-full" style={{ maxHeight: "calc(100vh - 380px)" }}>
                  {isLoadingDocs ? (
                    <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                  ) : filteredDocs.length === 0 ? (
                    <div className="text-center py-12 px-4">
                      <FolderOpen className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground/60">{documents.length === 0 ? "No documents yet" : "No matches"}</p>
                      {isAdmin && documents.length === 0 && (
                        <Button size="sm" variant="link" className="mt-2 text-xs" onClick={() => setUploadOpen(true)}>Upload your first document</Button>
                      )}
                    </div>
                  ) : (
                    <div className="divide-y">
                      {filteredDocs.map(doc => (
                        <div key={doc.id} className="px-3 py-2.5 hover:bg-muted/30 transition-colors">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => setViewingDoc(doc)}>
                                <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                <p className="text-sm font-medium truncate hover:text-violet-500 transition-colors">{doc.title}</p>
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{doc.category}</Badge>
                                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                  <Clock className="w-2.5 h-2.5" />{new Date(doc.uploadedAt).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-0.5 shrink-0">
                              <button onClick={() => setExpandedDoc(expandedDoc === doc.id ? null : doc.id)}
                                className="p-1 rounded hover:bg-muted transition-colors">
                                {expandedDoc === doc.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              </button>
                              {isAdmin && (
                                <button onClick={() => handleDelete(doc.id, doc.title)}
                                  className="p-1 rounded hover:bg-red-500/10 text-red-400 hover:text-red-300 transition-colors">
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                          {expandedDoc === doc.id && (
                            <div className="mt-2 p-2 rounded bg-muted/30 text-xs text-muted-foreground max-h-32 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                              {doc.content.slice(0, 500)}{doc.content.length > 500 ? "..." : ""}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ═══ UPLOAD DIALOG ═══ */}
        <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Upload className="w-4 h-4" />Upload Document</DialogTitle>
              <DialogDescription>Add a document to the knowledge base. Content will be searchable by all users via the AI assistant.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Title</Label>
                <Input value={uploadTitle} onChange={e => setUploadTitle(e.target.value)} placeholder="e.g. Engineering Style Guide" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Category</Label>
                <Select value={uploadCategory} onValueChange={setUploadCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Content</Label>
                  <label className="text-xs text-violet-500 hover:underline cursor-pointer flex items-center gap-1">
                    <Upload className="w-3 h-3" />Load from file
                    <input type="file" accept=".txt,.md,.csv,.json,.log,.xml,.html" className="hidden" onChange={handleFileUpload} />
                  </label>
                </div>
                <Textarea value={uploadContent} onChange={e => setUploadContent(e.target.value)}
                  placeholder="Paste or type the document content here..." rows={10} className="font-mono text-xs" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setUploadOpen(false)}>Cancel</Button>
              <Button onClick={handleUpload} disabled={isUploading} className="gap-1.5 bg-gradient-to-r from-violet-500 to-indigo-600">
                {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                Upload
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ═══ DOCUMENT VIEWER DIALOG ═══ */}
        <Dialog open={!!viewingDoc} onOpenChange={(open) => { if (!open) setViewingDoc(null); }}>
          <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500/10 to-indigo-500/10 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4 text-violet-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <DialogTitle className="text-lg truncate">{viewingDoc?.title}</DialogTitle>
                  <DialogDescription className="flex items-center gap-2 mt-0.5">
                    <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{viewingDoc?.category}</Badge>
                    <span className="text-xs text-muted-foreground">Uploaded by {viewingDoc?.uploadedBy}</span>
                    <span className="text-xs text-muted-foreground">· {viewingDoc?.uploadedAt ? new Date(viewingDoc.uploadedAt).toLocaleDateString() : ""}</span>
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
            <ScrollArea className="flex-1 -mx-6 px-6 mt-2" style={{ maxHeight: "calc(80vh - 160px)" }}>
              <div className="whitespace-pre-wrap text-sm leading-relaxed font-mono bg-muted/30 rounded-lg p-4 border">
                {viewingDoc?.content}
              </div>
            </ScrollArea>
            <DialogFooter className="mt-3">
              <Button variant="outline" onClick={() => setViewingDoc(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default ConfluencePage;
