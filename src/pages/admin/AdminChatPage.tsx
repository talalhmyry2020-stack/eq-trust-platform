import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Send, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface Profile {
  user_id: string;
  full_name: string;
  email: string | null;
}

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

const AdminChatPage = () => {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<{ user_id: string; role: string }[]>([]);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [search, setSearch] = useState("");
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("profiles").select("user_id, full_name, email"),
      supabase.from("user_roles").select("user_id, role"),
    ]).then(([pRes, rRes]) => {
      const p = (pRes.data || []).filter(pr => pr.user_id !== user.id);
      setProfiles(p);
      setRoles(rRes.data || []);
    });

    // Fetch unread counts
    supabase
      .from("direct_messages")
      .select("sender_id")
      .eq("receiver_id", user.id)
      .eq("is_read", false)
      .then(({ data }) => {
        const counts: Record<string, number> = {};
        (data || []).forEach(m => { counts[m.sender_id] = (counts[m.sender_id] || 0) + 1; });
        setUnreadCounts(counts);
      });
  }, [user]);

  useEffect(() => {
    if (!user || !selectedUser) return;
    const fetchMessages = async () => {
      const { data } = await supabase
        .from("direct_messages")
        .select("*")
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${selectedUser.user_id}),and(sender_id.eq.${selectedUser.user_id},receiver_id.eq.${user.id})`)
        .order("created_at", { ascending: true });
      setMessages((data as Message[]) || []);

      // Mark received as read
      await supabase
        .from("direct_messages")
        .update({ is_read: true })
        .eq("sender_id", selectedUser.user_id)
        .eq("receiver_id", user.id)
        .eq("is_read", false);

      setUnreadCounts(prev => ({ ...prev, [selectedUser.user_id]: 0 }));
    };
    fetchMessages();

    const channel = supabase
      .channel(`dm-${selectedUser.user_id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "direct_messages" }, (payload) => {
        const msg = payload.new as Message;
        if (
          (msg.sender_id === user.id && msg.receiver_id === selectedUser.user_id) ||
          (msg.sender_id === selectedUser.user_id && msg.receiver_id === user.id)
        ) {
          setMessages(prev => [...prev, msg]);
          if (msg.sender_id === selectedUser.user_id) {
            supabase.from("direct_messages").update({ is_read: true }).eq("id", msg.id);
          }
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, selectedUser]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!newMsg.trim() || !selectedUser || !user) return;
    await supabase.from("direct_messages").insert({
      sender_id: user.id,
      receiver_id: selectedUser.user_id,
      message: newMsg.trim(),
    });
    setNewMsg("");
  };

  const getRoleBadge = (userId: string) => {
    const role = roles.find(r => r.user_id === userId)?.role;
    if (role === "admin") return <Badge variant="default" className="text-xs">مدير</Badge>;
    if (role === "employee") return <Badge variant="secondary" className="text-xs">موظف</Badge>;
    return <Badge variant="outline" className="text-xs">عميل</Badge>;
  };

  const filteredProfiles = profiles.filter(p =>
    p.full_name.includes(search) || (p.email || "").includes(search)
  );

  return (
    <div className="flex gap-4 h-[calc(100vh-120px)]">
      {/* Users list */}
      <Card className="w-72 flex flex-col">
        <div className="p-3 border-b border-border">
          <Input placeholder="بحث..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {filteredProfiles.map(p => (
              <button
                key={p.user_id}
                onClick={() => setSelectedUser(p)}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-lg text-sm transition-colors text-right",
                  selectedUser?.user_id === p.user_id ? "bg-primary/10 text-primary" : "hover:bg-muted"
                )}
              >
                <User className="w-8 h-8 p-1.5 rounded-full bg-muted shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-medium truncate">{p.full_name || "بدون اسم"}</span>
                    {(unreadCounts[p.user_id] || 0) > 0 && (
                      <Badge variant="destructive" className="text-xs mr-1">{unreadCounts[p.user_id]}</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    {getRoleBadge(p.user_id)}
                    <span className="text-xs text-muted-foreground truncate" dir="ltr">{p.email}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </Card>

      {/* Chat area */}
      <Card className="flex-1 flex flex-col">
        {selectedUser ? (
          <>
            <div className="p-4 border-b border-border flex items-center gap-3">
              <User className="w-8 h-8 p-1.5 rounded-full bg-muted" />
              <div>
                <p className="font-medium">{selectedUser.full_name}</p>
                <p className="text-xs text-muted-foreground" dir="ltr">{selectedUser.email}</p>
              </div>
              {getRoleBadge(selectedUser.user_id)}
            </div>
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-3">
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
            اختر شخصاً لبدء المحادثة
          </CardContent>
        )}
      </Card>
    </div>
  );
};

export default AdminChatPage;
