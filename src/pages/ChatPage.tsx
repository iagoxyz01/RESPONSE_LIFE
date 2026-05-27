import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Send, Loader2, Image, Check, CheckCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase, Message, CareRequest, Profile } from '../lib/supabase';

interface ChatPageProps {
  requestId: string;
  onBack: () => void;
}

interface MessageWithProfile extends Message {
  profiles: Profile;
}

export default function ChatPage({ requestId, onBack }: ChatPageProps) {
  const { profile } = useAuth();
  const [request, setRequest] = useState<CareRequest | null>(null);
  const [messages, setMessages] = useState<MessageWithProfile[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Scroll to bottom smoothly
  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, []);

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      if (!requestId) return;

      setLoading(true);

      const { data: req } = await supabase
        .from('care_requests')
        .select('*')
        .eq('id', requestId)
        .maybeSingle();
      setRequest(req);

      const { data: msgs } = await supabase
        .from('messages')
        .select('*, profiles(*)')
        .eq('request_id', requestId)
        .order('created_at', { ascending: true });

      setMessages((msgs || []) as MessageWithProfile[]);
      setLoading(false);
      scrollToBottom();
    };

    fetchData();
  }, [requestId, scrollToBottom]);

  // Real-time subscription for new messages
  useEffect(() => {
    if (!requestId) return;

    console.log('Setting up realtime subscription for chat:', requestId);

    const channel = supabase
      .channel(`chat:${requestId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `request_id=eq.${requestId}`,
        },
        async (payload) => {
          console.log('Realtime event received:', payload);
          const newMsg = payload.new as Message;

          // Fetch the profile for this message
          const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', newMsg.sender_id)
            .maybeSingle();

          setMessages(prev => {
            // Avoid duplicates
            if (prev.some(m => m.id === newMsg.id)) {
              console.log('Skipping duplicate message');
              return prev;
            }
            console.log('Adding new message to list');
            return [...prev, { ...newMsg, profiles: profileData as Profile } as MessageWithProfile];
          });

          scrollToBottom();
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status);
      });

    channelRef.current = channel;

    return () => {
      console.log('Cleaning up subscription');
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [requestId, scrollToBottom]);

  // Mark messages as read
  useEffect(() => {
    if (!profile || messages.length === 0) return;

    const markAsRead = async () => {
      const unreadMessages = messages.filter(
        m => m.sender_id !== profile.id && !m.read_at
      );

      if (unreadMessages.length > 0) {
        const ids = unreadMessages.map(m => m.id);
        await supabase
          .from('messages')
          .update({ read_at: new Date().toISOString() })
          .in('id', ids);
      }
    };

    markAsRead();
  }, [profile, messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sending || !profile) return;

    setSending(true);
    const messageText = input.trim();
    setInput('');

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          request_id: requestId,
          sender_id: profile.id,
          content: messageText,
        })
        .select('*, profiles(*)')
        .maybeSingle();

      if (error) throw error;

      if (data) {
        console.log('Message sent successfully:', data);
        // Não precisamos adicionar manualmente - o realtime vai fazer isso
        // Mas se o realtime falhar, adicionamos manualmente como fallback
        setMessages(prev => {
          if (prev.some(m => m.id === data.id)) return prev;
          return [...prev, data as MessageWithProfile];
        });
        scrollToBottom();
      }
    } catch (err) {
      console.error('Error sending message:', err);
      setInput(messageText); // Restore text on error
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-slate-500 text-sm">Carregando conversa...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-4 py-3 flex items-center gap-3 flex-shrink-0 sticky top-0 z-10">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
        >
          <ArrowLeft size={20} className="text-slate-600" />
        </button>
        <div className="flex-1">
          <h1 className="font-bold text-slate-900 text-lg">
            {request?.patient_name || 'Conversa'}
          </h1>
          <p className="text-xs text-green-600 font-medium flex items-center gap-1">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            Online em tempo real
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && !loading && (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Send size={24} className="text-slate-400" />
            </div>
            <p className="text-slate-500 text-sm">Nenhuma mensagem ainda</p>
            <p className="text-slate-400 text-xs mt-1">Envie a primeira mensagem!</p>
          </div>
        )}

        {messages.map((message) => {
          const isOwn = message.sender_id === profile?.id;
          return (
            <div
              key={message.id}
              className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  isOwn
                    ? 'bg-blue-600 text-white rounded-br-sm'
                    : 'bg-white border border-slate-100 text-slate-900 rounded-bl-sm'
                }`}
              >
                {!isOwn && message.profiles && (
                  <p className="text-xs font-semibold text-slate-600 mb-1">
                    {message.profiles.name}
                  </p>
                )}
                <p className="text-sm leading-relaxed">{message.content}</p>
                <div className={`flex items-center gap-1 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                  <span className={`text-xs ${isOwn ? 'text-blue-100' : 'text-slate-400'}`}>
                    {formatTime(message.created_at)}
                  </span>
                  {isOwn && (
                    message.read_at
                      ? <CheckCheck size={14} className="text-blue-100" />
                      : <Check size={14} className="text-blue-200" />
                  )}
                </div>
              </div>
            </div>
          );
        })}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="bg-white border-t border-slate-100 px-4 py-3 flex-shrink-0 sticky bottom-0">
        <form onSubmit={sendMessage} className="flex items-center gap-2">
          <button
            type="button"
            className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors flex-shrink-0"
          >
            <Image size={20} className="text-slate-500" />
          </button>

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Digite sua mensagem..."
            className="flex-1 bg-slate-100 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={sending}
          />

          <button
            type="submit"
            disabled={!input.trim() || sending}
            className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center hover:bg-blue-700 transition-colors flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? (
              <Loader2 size={20} className="text-white animate-spin" />
            ) : (
              <Send size={20} className="text-white" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
