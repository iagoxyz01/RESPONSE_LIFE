import { useState, useEffect } from 'react';
import { Bell, BellOff, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase, Notification } from '../lib/supabase';

const NOTIF_ICONS: Record<string, { icon: string; color: string; bg: string }> = {
  request_created: { icon: '📋', color: 'text-blue-700', bg: 'bg-blue-50' },
  caregiver_accepted: { icon: '👋', color: 'text-green-700', bg: 'bg-green-50' },
  request_confirmed: { icon: '✅', color: 'text-green-700', bg: 'bg-green-50' },
  service_started: { icon: '▶️', color: 'text-blue-700', bg: 'bg-blue-50' },
  photo_received: { icon: '📷', color: 'text-purple-700', bg: 'bg-purple-50' },
  service_ended: { icon: '⏹️', color: 'text-orange-700', bg: 'bg-orange-50' },
  payment_confirmed: { icon: '💰', color: 'text-emerald-700', bg: 'bg-emerald-50' },
  withdrawal_processed: { icon: '🏦', color: 'text-emerald-700', bg: 'bg-emerald-50' },
  new_message: { icon: '💬', color: 'text-blue-700', bg: 'bg-blue-50' },
  default: { icon: '🔔', color: 'text-slate-700', bg: 'bg-slate-50' },
};

export default function NotificationsPage() {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    const fetch = async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(50);
      setNotifications(data || []);
      setLoading(false);
    };
    fetch();

    const sub = supabase
      .channel('notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${profile.id}`
      }, () => fetch())
      .subscribe();

    return () => { sub.unsubscribe(); };
  }, [profile]);

  const markAllRead = async () => {
    if (!profile) return;
    await supabase
      .from('notifications')
      .update({ read: true, read_at: new Date().toISOString() })
      .eq('user_id', profile.id)
      .eq('read', false);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const markRead = async (id: string) => {
    await supabase
      .from('notifications')
      .update({ read: true, read_at: new Date().toISOString() })
      .eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const formatTime = (d: string) => {
    const diff = Date.now() - new Date(d).getTime();
    if (diff < 60000) return 'agora';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}min`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  };

  const grouped = notifications.reduce<{ date: string; items: Notification[] }[]>((acc, n) => {
    const date = new Date(n.created_at).toDateString();
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    const label = date === today ? 'Hoje' : date === yesterday ? 'Ontem' : new Date(n.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });

    const last = acc[acc.length - 1];
    if (last && last.date === label) {
      last.items.push(n);
    } else {
      acc.push({ date: label, items: [n] });
    }
    return acc;
  }, []);

  return (
    <div className="px-4 pt-4 pb-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Notificações</h2>
          {unreadCount > 0 && (
            <p className="text-xs text-slate-500 mt-0.5">{unreadCount} não lida{unreadCount !== 1 ? 's' : ''}</p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-1.5 text-blue-600 text-sm font-medium hover:text-blue-700"
          >
            <Check size={15} />
            Marcar tudo
          </button>
        )}
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && notifications.length === 0 && (
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <BellOff size={28} className="text-slate-400" />
          </div>
          <h3 className="text-slate-600 font-semibold">Sem notificações</h3>
          <p className="text-slate-400 text-sm mt-1">Você está em dia!</p>
        </div>
      )}

      <div className="space-y-5">
        {grouped.map(({ date, items }) => (
          <div key={date}>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">{date}</p>
            <div className="space-y-2">
              {items.map(notif => {
                const style = NOTIF_ICONS[notif.type] || NOTIF_ICONS.default;
                return (
                  <button
                    key={notif.id}
                    onClick={() => markRead(notif.id)}
                    className={`w-full flex items-start gap-3 p-3.5 rounded-2xl transition-all text-left ${
                      notif.read ? 'bg-white border border-slate-100' : 'bg-blue-50 border border-blue-100 shadow-sm'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${style.bg}`}>
                      {style.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`font-semibold text-sm ${notif.read ? 'text-slate-700' : 'text-slate-900'}`}>
                          {notif.title}
                        </p>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className="text-[11px] text-slate-400">{formatTime(notif.created_at)}</span>
                          {!notif.read && (
                            <div className="w-2 h-2 bg-blue-600 rounded-full" />
                          )}
                        </div>
                      </div>
                      {notif.body && (
                        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{notif.body}</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
