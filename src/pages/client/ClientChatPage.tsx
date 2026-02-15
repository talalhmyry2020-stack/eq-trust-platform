import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

interface Admin {
  user_id: string;
  full_name: string;
}

const ClientChatPage = () => {
  const { user } = useAuth();
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [selectedAdmin, setSelectedAdmin] = useState<Admin | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    // Find admins to chat with
    Promise.all([
      supabase.from("user_roles").select("user_id").eq("role", "admin"),
      supabase.from("profiles").select("user_id, full_name"),
    ]).then(([rolesRes, profilesRes]) => {
      const adminIds = (rolesRes.data || []).map(r => r.user_id);
      const adminProfiles = (profilesRes.data || []).filter(p => adminIds.includes(p.user_id));
      setAdmins(adminProfiles);
      if (adminProfiles.length === 1) setSelectedAdmin(adminProfiles[0]);
    });
  }, [user]);

  useEffect(() => {
    if (!user || !selectedAdmin) return;
    const fetchMessages = async () => {
      const { data } = await supabase
        .from("direct_messages")
        .select("*")
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${selectedAdmin.user_id}),and(sender_id.eq.${selectedAdmin.user_id},receiver_id.eq.${user.id})`)
        .order("created_at", { ascending: true });
      setMessages((data as Message[]) || []);

      await supabase
        .from("direct_messages")
        .update({ is_read: true })
        .eq("sender_id", selectedAdmin.user_id)
        .eq("receiver_id", user.id)
        .eq("is_read", false);
    };
    fetchMessages();

    const channel = supabase
      .channel(`client-dm-${selectedAdmin.user_id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "direct_messages" }, (payload) => {
        const msg = payload.new as Message;
        if (
          (msg.sender_id === user.id && msg.receiver_id === selectedAdmin.user_id) ||
          (msg.sender_id === selectedAdmin.user_id && msg.receiver_id === user.id)
        ) {
          setMessages(prev => [...prev, msg]);
          if (msg.sender_id === selectedAdmin.user_id) {
            supabase.from("direct_messages").update({ is_read: true }).eq("id", msg.id);
          }
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, selectedAdmin]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!newMsg.trim() || !selectedAdmin || !user) return;
    await supabase.from("direct_messages").insert({
      sender_id: user.id,
      receiver_id: selectedAdmin.user_id,
      message: newMsg.trim(),
    });
    setNewMsg("");
  };

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold mb-6">الدردشة مع الإدارة</h1>
      <Card className="h-[calc(100vh-200px)] flex flex-col">
        {selectedAdmin ? (
          <>
            <div className="p-4 border-b border-border flex items-center gap-3">
              <User className="w-8 h-8 p-1.5 rounded-full bg-muted" />
              <p className="font-medium">{selectedAdmin.full_name || "الإدارة"}</p>
            </div>
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-3">
                {messages.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">لا توجد رسائل بعد. ابدأ المحادثة!</p>
                )}
                {messages.map(m => (
                  <div key={m.id} className={cn("flex", m.sender_id === user?.id ? "justify-start" : "justify-end")}>
                    <div className={cn(
                      "max-w-[70%] rounded-xl px-4 py-2 text-sm",
                      m.sender_id === user?.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    )}>
                      <p>{m.message}</p>
                      <p className={cn("text-[10px] mt-1", m.sender_id === user?.id ? "text-primary-foreground/70" : "text-muted-foreground")}>
                        {new Date(m.created_at).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
            </ScrollArea>
            <div className="p-4 border-t border-border flex gap-2">
              <Input
                placeholder="اكتب رسالة..."
                value={newMsg}
                onChange={e => setNewMsg(e.target.value)}
                onKeyDown={e => e.key === "Enter" && sendMessage()}
                className="flex-1"
              />
              <Button onClick={sendMessage} size="icon"><Send className="w-4 h-4" /></Button>
            </div>
          </>
        ) : (
          <CardContent className="flex-1 flex items-center justify-center text-muted-foreground">
            {admins.length === 0 ? "لا يوجد مدير متاح حالياً" : (
              <div className="space-y-2">
                <p>اختر مدير للتواصل:</p>
                {admins.map(a => (
                  <Button key={a.user_id} variant="outline" onClick={() => setSelectedAdmin(a)}>
                    {a.full_name}
                  </Button>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
};

export default ClientChatPage;
