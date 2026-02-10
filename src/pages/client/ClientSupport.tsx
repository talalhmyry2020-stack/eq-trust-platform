import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Send, ArrowRight } from "lucide-react";

const statusMap: Record<string, string> = {
  open: "مفتوحة",
  in_progress: "قيد المعالجة",
  resolved: "تم الحل",
  closed: "مغلقة",
};

const statusVariant = (s: string) => {
  if (s === "open") return "default" as const;
  if (s === "in_progress") return "secondary" as const;
  if (s === "resolved") return "default" as const;
  return "secondary" as const;
};

const ClientSupport = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tickets, setTickets] = useState<any[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newSubject, setNewSubject] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [replyText, setReplyText] = useState("");
  const [creating, setCreating] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const fetchTickets = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("support_tickets")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    setTickets(data || []);
  };

  useEffect(() => { fetchTickets(); }, [user]);

  const openTicket = async (ticket: any) => {
    setSelectedTicket(ticket);
    const { data } = await supabase
      .from("support_messages")
      .select("*")
      .eq("ticket_id", ticket.id)
      .order("created_at", { ascending: true });
    setMessages(data || []);
  };

  const createTicket = async () => {
    if (!user || !newSubject.trim() || !newMessage.trim()) return;
    setCreating(true);
    const { data: ticket, error } = await supabase
      .from("support_tickets")
      .insert({ user_id: user.id, subject: newSubject.trim() })
      .select()
      .single();
    if (error || !ticket) {
      toast({ title: "خطأ", description: "فشل إنشاء التذكرة", variant: "destructive" });
      setCreating(false);
      return;
    }
    await supabase.from("support_messages").insert({
      ticket_id: ticket.id,
      sender_id: user.id,
      message: newMessage.trim(),
    });
    setNewSubject("");
    setNewMessage("");
    setShowNew(false);
    setCreating(false);
    await fetchTickets();
    openTicket(ticket);
    toast({ title: "تم الإرسال", description: "تم إنشاء تذكرة الدعم بنجاح" });
  };

  const sendReply = async () => {
    if (!user || !selectedTicket || !replyText.trim()) return;
    await supabase.from("support_messages").insert({
      ticket_id: selectedTicket.id,
      sender_id: user.id,
      message: replyText.trim(),
    });
    setReplyText("");
    openTicket(selectedTicket);
  };

  // Detail view
  if (selectedTicket) {
    return (
      <div>
        <button onClick={() => setSelectedTicket(null)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowRight className="w-4 h-4" /> العودة للتذاكر
        </button>
        <div className="flex items-center gap-3 mb-6">
          <h1 className="font-heading text-2xl font-bold">{selectedTicket.subject}</h1>
          <Badge variant={statusVariant(selectedTicket.status)}>{statusMap[selectedTicket.status]}</Badge>
        </div>
        <Card className="mb-4">
          <CardContent className="p-4 space-y-4 max-h-96 overflow-auto">
            {messages.map((m) => (
              <div key={m.id} className={`p-3 rounded-lg ${m.sender_id === user?.id ? "bg-primary/10 mr-8" : "bg-muted ml-8"}`}>
                <p className="text-sm mb-1">{m.message}</p>
                <p className="text-xs text-muted-foreground font-mono">{new Date(m.created_at).toLocaleString("ar-SA")}</p>
              </div>
            ))}
          </CardContent>
        </Card>
        {!["resolved", "closed"].includes(selectedTicket.status) && (
          <div className="flex gap-3">
            <Input value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="اكتب ردّك..." className="flex-1" />
            <Button onClick={sendReply} disabled={!replyText.trim()}>
              <Send className="w-4 h-4 ml-2" /> إرسال
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-2xl font-bold">الدعم الفني</h1>
        <Button onClick={() => setShowNew(!showNew)}>
          <Plus className="w-4 h-4 ml-2" /> تذكرة جديدة
        </Button>
      </div>

      {showNew && (
        <Card className="mb-6">
          <CardHeader><CardTitle className="font-heading text-lg">تذكرة دعم جديدة</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input value={newSubject} onChange={(e) => setNewSubject(e.target.value)} placeholder="موضوع التذكرة" />
            <Textarea value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="اشرح مشكلتك بالتفصيل..." rows={4} />
            <Button onClick={createTicket} disabled={creating || !newSubject.trim() || !newMessage.trim()} className="w-full">
              {creating ? "جاري الإرسال..." : "إرسال التذكرة"}
            </Button>
          </CardContent>
        </Card>
      )}

      {tickets.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">لا توجد تذاكر دعم</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => (
            <Card key={t.id} className="cursor-pointer hover:border-primary/30 transition-colors" onClick={() => openTicket(t)}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{t.subject}</p>
                  <p className="text-xs text-muted-foreground font-mono">{new Date(t.created_at).toLocaleDateString("ar-SA")}</p>
                </div>
                <Badge variant={statusVariant(t.status)}>{statusMap[t.status]}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ClientSupport;
