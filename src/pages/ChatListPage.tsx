import { useState, useEffect } from 'react';
import { MessageSquare, Clock, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase, CareRequest, Profile } from '../lib/supabase';

interface ChatItem {
  requestId: string;
  careType: string;
  status: string;
  partnerName: string;
  partnerInitial: string;
  scheduledAt: string;
  lastMessage: string;
  lastMessageTime: string;
  unread: number;
}

interface ChatListPageProps {
  onOpenChat: (requestId: string) => void;
}

export default function ChatListPage({ onOpenChat }: ChatListPageProps) {
  const { profile, caregiver, patient } = useAuth();
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    const fetchChats = async () => {
      let query = supabase
        .from('care_requests')
        .select('id, care_type, status, scheduled_at, caregiver_id, patient_id, patients(*, profiles(*)), caregivers(*, profiles(*))')
        .in('status', ['scheduled', 'in_progress', 'awaiting_payment'])
        .order('scheduled_at', { ascending: false });

      if (caregiver) {
        query = query.eq('caregiver_id', caregiver.id);
      } else if (patient) {
        query = query.eq('patient_id', patient.id);
      }

      const { data: requests } = await query;

      const chatItems: ChatItem[] = [];

      for (const req of (requests || [])) {
        const isCaregiver = profile.user_type === 'caregiver';
        const partnerProfile = isCaregiver
          ? (req.patients as unknown as { profiles: Profile })?.profiles
          : (req.caregivers as unknown as { profiles: Profile })?.profiles;

        // Get last message
        const { data: msgs } = await supabase
          .from('messages')
          .select('content, created_at, sender_id, read')
          .eq('request_id', req.id)
          .order('created_at', { ascending: false })
          .limit(1);

        const lastMsg = msgs?.[0];
        const unreadCount = lastMsg && lastMsg.sender_id !== profile.id && !lastMsg.read ? 1 : 0;

        chatItems.push({
          requestId: req.id,
          careType: req.care_type,
          status: req.status,
          partnerName: partnerProfile?.full_name || 'Usuário',
          partnerInitial: partnerProfile?.full_name?.[0]?.toUpperCase() || '?',
          scheduledAt: req.scheduled_at,
          lastMessage: lastMsg?.content || 'Nenhuma mensagem ainda',
          lastMessageTime: lastMsg?.created_at || req.scheduled_at,
          unread: unreadCount,
        });
      }

      setChats(chatItems);
      setLoading(false);
    };

    fetchChats();

    const sub = supabase
      .channel('chat_list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, fetchChats)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'care_requests' }, fetchChats)
      .subscribe();

    return () => { sub.unsubscribe(); };
  }, [profile, caregiver, patient]);

  const formatTime = (d: string) => {
    const diff = Date.now() - new Date(d).getTime();
    if (diff < 86400000) {
      return new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }
    return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  };

  const statusLabel: Record<string, string> = {
    scheduled: 'Agendado',
    in_progress: 'Em andamento',
    awaiting_payment: 'Aguardando pagamento',
  };

  return (
    <div className="px-4 pt-4 pb-6 space-y-4">
      <h2 className="text-xl font-bold text-slate-900">Conversas</h2>

      {loading && (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && chats.length === 0 && (
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <MessageSquare size={28} className="text-slate-400" />
          </div>
          <h3 className="text-slate-600 font-semibold">Nenhuma conversa ativa</h3>
          <p className="text-slate-400 text-sm mt-1">Conversas aparecem quando o atendimento e confirmado</p>
        </div>
      )}

      <div className="space-y-2">
        {chats.map(chat => (
          <button
            key={chat.requestId}
            onClick={() => onOpenChat(chat.requestId)}
            className="w-full bg-white rounded-2xl p-4 border border-slate-100 shadow-sm hover:shadow-md transition-all text-left flex items-center gap-3"
          >
            <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
              {chat.partnerInitial}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-slate-900 text-sm truncate">{chat.partnerName}</p>
                <span className="text-[11px] text-slate-400 flex-shrink-0">{formatTime(chat.lastMessageTime)}</span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{chat.careType}</p>
              <p className="text-sm text-slate-600 truncate mt-1">{chat.lastMessage}</p>
            </div>
            <div className="flex flex-col items-end gap-2 flex-shrink-0">
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                chat.status === 'in_progress' ? 'bg-green-50 text-green-700' :
                chat.status === 'awaiting_payment' ? 'bg-orange-50 text-orange-700' :
                'bg-blue-50 text-blue-700'
              }`}>
                {statusLabel[chat.status] || chat.status}
              </span>
              <ChevronRight size={16} className="text-slate-300" />
            </div>
          </button>
        ))}
      </div>

      {/* Completed chats info */}
      <div className="bg-slate-50 rounded-xl p-3 text-center">
        <p className="text-xs text-slate-400">Conversas de atendimentos finalizados nao sao exibidas</p>
      </div>
    </div>
  );
}
