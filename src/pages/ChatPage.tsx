import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Send, Loader2, Check, CheckCheck, Camera, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase, Message, CareRequest, Profile } from '../lib/supabase';

interface ChatPageProps {
  requestId: string;
  onBack: () => void;
}

interface MessageWithProfile extends Message {
  profiles: Profile;
}

interface InAppNotification {
  id: string;
  name: string;
  preview: string;
  time: string;
}

export default function ChatPage({ requestId, onBack }: ChatPageProps) {
  const { profile } = useAuth();
  const [request, setRequest] = useState<CareRequest | null>(null);
  const [messages, setMessages] = useState<MessageWithProfile[]>([]);
  const [otherUserName, setOtherUserName] = useState('');
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<InAppNotification | null>(null);
  const [expandedPhoto, setExpandedPhoto] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const notifTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isActiveRef = useRef(true);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 80);
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

  // Determine the other user's name for notifications
  useEffect(() => {
    if (!request || !profile) return;
    const otherId = profile.user_type === 'caregiver' ? request.requester_id : request.caregiver_id;
    if (!otherId) return;
    supabase
      .from('profiles')
      .select('full_name')
      .eq('id', otherId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setOtherUserName((data as any).full_name || 'Usuário');
      });
  }, [request, profile]);

  const showNotification = useCallback((msg: MessageWithProfile) => {
    if (!isActiveRef.current) return;
    const senderName = msg.profiles?.full_name || otherUserName || 'Usuário';
    const preview = msg.message_type === 'system_photo'
      ? 'Foto de monitoramento enviada'
      : msg.content?.slice(0, 60) || '';
    const time = new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    if (notifTimerRef.current) clearTimeout(notifTimerRef.current);
    setNotification({ id: msg.id, name: senderName, preview, time });
    notifTimerRef.current = setTimeout(() => setNotification(null), 4000);

    // Browser notification if permission granted
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(senderName, { body: preview, icon: '/icon.svg' });
    }
  }, [otherUserName]);

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    isActiveRef.current = true;
    return () => { isActiveRef.current = false; };
  }, []);

  // Real-time subscription
  useEffect(() => {
    if (!requestId) return;

    const channel = supabase
      .channel(`chat:${requestId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `request_id=eq.${requestId}`,
      }, async (payload) => {
        const newMsg = payload.new as Message;
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', newMsg.sender_id)
          .maybeSingle();

        const full = { ...newMsg, profiles: profileData as Profile } as MessageWithProfile;

        setMessages(prev => {
          if (prev.some(m => m.id === newMsg.id)) return prev;
          return [...prev, full];
        });
        scrollToBottom();

        // Show in-app notification only for messages from the other user
        if (newMsg.sender_id !== profile?.id) {
          showNotification(full);
        }
      })
      .subscribe();

    channelRef.current = channel;
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [requestId, profile, scrollToBottom, showNotification]);

  // Mark messages as read
  useEffect(() => {
    if (!profile || messages.length === 0) return;
    const unread = messages.filter(m => m.sender_id !== profile.id && !m.read_at);
    if (unread.length === 0) return;
    supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .in('id', unread.map(m => m.id));
  }, [profile, messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sending || !profile) return;
    setSending(true);
    const text = input.trim();
    setInput('');
    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({ request_id: requestId, sender_id: profile.id, content: text })
        .select('*, profiles(*)')
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setMessages(prev => {
          if (prev.some(m => m.id === (data as any).id)) return prev;
          return [...prev, data as MessageWithProfile];
        });
        scrollToBottom();
      }
    } catch {
      setInput(text);
    } finally {
      setSending(false);
    }
  };

  const formatTime = (d: string) =>
    new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const isSystemPhoto = (msg: MessageWithProfile) => msg.message_type === 'system_photo';

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
      {/* Expanded photo modal */}
      {expandedPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black flex items-center justify-center"
          onClick={() => setExpandedPhoto(null)}
        >
          <button className="absolute top-4 right-4 p-2 bg-white/20 rounded-full">
            <X size={22} className="text-white" />
          </button>
          <img src={expandedPhoto} alt="Foto" className="max-w-full max-h-full object-contain" />
        </div>
      )}

      {/* In-app notification banner */}
      {notification && (
        <div className="fixed top-4 left-4 right-4 z-40 animate-slide-down">
          <div className="bg-slate-900 rounded-2xl px-4 py-3 flex items-start gap-3 shadow-2xl">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">
                {notification.name[0]?.toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-white font-semibold text-sm truncate">{notification.name}</p>
                <p className="text-slate-400 text-xs flex-shrink-0">{notification.time}</p>
              </div>
              <p className="text-slate-300 text-xs mt-0.5 truncate">{notification.preview}</p>
            </div>
            <button onClick={() => setNotification(null)} className="text-slate-500 flex-shrink-0">
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-4 py-3 flex items-center gap-3 flex-shrink-0 sticky top-0 z-10">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
        >
          <ArrowLeft size={20} className="text-slate-600" />
        </button>
        <div className="flex-1">
          <h1 className="font-bold text-slate-900 text-base">{otherUserName || 'Conversa'}</h1>
          <p className="text-xs text-green-600 font-medium flex items-center gap-1">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse inline-block" />
            Online em tempo real
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Send size={24} className="text-slate-400" />
            </div>
            <p className="text-slate-500 text-sm">Nenhuma mensagem ainda</p>
            <p className="text-slate-400 text-xs mt-1">Envie a primeira mensagem!</p>
          </div>
        )}

        {messages.map(message => {
          const isOwn = message.sender_id === profile?.id;
          const isPhoto = isSystemPhoto(message);

          // System photo message
          if (isPhoto) {
            return (
              <div key={message.id} className="flex justify-center">
                <div className="max-w-[85%] w-full">
                  <div className="bg-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
                    {message.media_url && (
                      <button
                        onClick={() => setExpandedPhoto(message.media_url!)}
                        className="w-full"
                      >
                        <img
                          src={message.media_url}
                          alt="Foto de monitoramento"
                          className="w-full max-h-56 object-cover"
                        />
                      </button>
                    )}
                    <div className="px-3 py-2 flex items-center gap-2">
                      <Camera size={13} className="text-slate-500 flex-shrink-0" />
                      <p className="text-xs text-slate-600 flex-1">{message.content}</p>
                      <span className="text-xs text-slate-400">{formatTime(message.created_at)}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          }

          // Regular message
          return (
            <div key={message.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                isOwn
                  ? 'bg-blue-600 text-white rounded-br-sm'
                  : 'bg-white border border-slate-100 text-slate-900 rounded-bl-sm shadow-sm'
              }`}>
                {!isOwn && message.profiles && (
                  <p className="text-xs font-semibold text-slate-600 mb-1">
                    {(message.profiles as any).full_name || (message.profiles as any).name}
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
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Digite sua mensagem..."
            className="flex-1 bg-slate-100 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={sending}
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center hover:bg-blue-700 transition-colors flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? (
              <Loader2 size={20} className="text-white animate-spin" />
            ) : (
              <Send size={18} className="text-white" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
