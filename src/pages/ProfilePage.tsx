import { useState } from 'react';
import { User, Star, Shield, Phone, Mail, Briefcase, Edit3, LogOut, ChevronRight, Award } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import PrivacySecurityPage from './PrivacySecurityPage';
import MyRatingsPage from './MyRatingsPage';
import IdentityVerificationPage from './IdentityVerificationPage';

type SubPage = null | 'privacy' | 'ratings' | 'identity';

function calcExperience(firstServiceAt: string | null | undefined): string {
  if (!firstServiceAt) return '0 meses';
  const start = new Date(firstServiceAt);
  const now = new Date();
  const months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (months < 1) return 'Menos de 1 mês';
  if (months < 12) return `${months} ${months === 1 ? 'mês' : 'meses'}`;
  const years = Math.floor(months / 12);
  return `${years} ${years === 1 ? 'ano' : 'anos'}`;
}

export default function ProfilePage() {
  const { profile, caregiver, patient, signOut, refreshProfile } = useAuth();
  const [subPage, setSubPage] = useState<SubPage>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    full_name: profile?.full_name || '',
    phone: profile?.phone || '',
    bio: caregiver?.bio || '',
    pix_key: caregiver?.pix_key || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);

    await supabase
      .from('profiles')
      .update({ full_name: form.full_name, phone: form.phone })
      .eq('id', profile.id);

    if (caregiver) {
      await supabase
        .from('caregivers')
        .update({ bio: form.bio, pix_key: form.pix_key })
        .eq('id', caregiver.id);
    }

    await refreshProfile();
    setSaving(false);
    setEditing(false);
  };

  if (subPage === 'privacy') return <PrivacySecurityPage onBack={() => setSubPage(null)} />;
  if (subPage === 'ratings') return <MyRatingsPage onBack={() => setSubPage(null)} />;
  if (subPage === 'identity') return <IdentityVerificationPage onBack={() => setSubPage(null)} />;

  const isCaregiver = profile?.user_type === 'caregiver';
  const avgRating = isCaregiver ? caregiver?.avg_rating : patient?.avg_rating;
  const totalRatings = isCaregiver ? caregiver?.total_ratings : patient?.total_ratings;
  const experience = calcExperience((caregiver as any)?.first_service_at);
  const totalServices = caregiver?.total_services || 0;

  const initials = profile?.full_name
    ?.split(' ')
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase() || 'U';

  const menuItems = [
    { icon: Shield, label: 'Privacidade e Segurança', sub: 'privacy' as SubPage },
    { icon: Award, label: 'Minhas Avaliações', sub: 'ratings' as SubPage },
    ...(isCaregiver ? [{ icon: User, label: 'Verificação de Identidade', sub: 'identity' as SubPage }] : []),
  ];

  return (
    <div className="px-4 pt-4 pb-8 space-y-5">
      {/* Avatar + Name */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-start gap-4">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-white text-xl font-bold flex-shrink-0 ${
            isCaregiver ? 'bg-gradient-to-br from-emerald-400 to-emerald-600' : 'bg-gradient-to-br from-blue-400 to-blue-600'
          }`}>
            {initials}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-slate-900">{profile?.full_name || 'Usuário'}</h2>
              {profile?.verified && (
                <div className="flex items-center gap-1 bg-green-50 text-green-700 text-xs px-2 py-0.5 rounded-full">
                  <Shield size={10} />
                  <span>Verificado</span>
                </div>
              )}
            </div>
            <p className="text-sm text-slate-500 mt-0.5">
              {isCaregiver ? 'Cuidador Profissional' : 'Paciente'}
            </p>
            {avgRating !== undefined && (
              <div className="flex items-center gap-1 mt-1.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    size={13}
                    className={i < Math.floor(avgRating || 0) ? 'text-amber-400 fill-amber-400' : 'text-slate-200 fill-slate-200'}
                  />
                ))}
                <span className="text-xs text-slate-500 ml-1">
                  {(avgRating || 0).toFixed(1)} ({totalRatings || 0} avaliações)
                </span>
              </div>
            )}
          </div>
          <button
            onClick={() => setEditing(!editing)}
            className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
          >
            <Edit3 size={18} />
          </button>
        </div>
      </div>

      {/* Edit form */}
      {editing && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-4">
          <h3 className="font-semibold text-slate-700">Editar Perfil</h3>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Nome</label>
            <input
              type="text"
              value={form.full_name}
              onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Telefone</label>
            <input
              type="tel"
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {isCaregiver && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Sobre você</label>
                <textarea
                  value={form.bio}
                  onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Chave Pix</label>
                <input
                  type="text"
                  value={form.pix_key}
                  onChange={e => setForm(f => ({ ...f, pix_key: e.target.value }))}
                  placeholder="CPF, email ou telefone"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </>
          )}
          <div className="flex gap-3">
            <button
              onClick={() => setEditing(false)}
              className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-700 font-semibold"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-semibold disabled:opacity-60 flex items-center justify-center"
            >
              {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Salvar'}
            </button>
          </div>
        </div>
      )}

      {/* Info cards */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="divide-y divide-slate-50">
          <div className="flex items-center gap-3 px-4 py-3.5">
            <Mail size={16} className="text-slate-400" />
            <div className="flex-1">
              <p className="text-xs text-slate-400">Email</p>
              <p className="text-sm text-slate-800 font-medium">{profile?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-3.5">
            <Phone size={16} className="text-slate-400" />
            <div className="flex-1">
              <p className="text-xs text-slate-400">Telefone</p>
              <p className="text-sm text-slate-800 font-medium">{profile?.phone || 'Não informado'}</p>
            </div>
          </div>
          {isCaregiver && (
            <>
              <div className="flex items-center gap-3 px-4 py-3.5">
                <Briefcase size={16} className="text-slate-400" />
                <div className="flex-1">
                  <p className="text-xs text-slate-400">Experiência</p>
                  <p className="text-sm text-slate-800 font-medium">{experience}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 px-4 py-3.5">
                <Award size={16} className="text-slate-400" />
                <div className="flex-1">
                  <p className="text-xs text-slate-400">Atendimentos</p>
                  <p className="text-sm text-slate-800 font-medium">{totalServices} realizados</p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bio */}
      {isCaregiver && caregiver?.bio && !editing && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <p className="text-xs text-slate-400 mb-2">Sobre</p>
          <p className="text-sm text-slate-700 leading-relaxed">{caregiver.bio}</p>
        </div>
      )}

      {/* Menu items */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="divide-y divide-slate-50">
          {menuItems.map(({ icon: Icon, label, sub }) => (
            <button
              key={label}
              onClick={() => setSubPage(sub)}
              className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 transition-colors"
            >
              <Icon size={16} className="text-slate-400" />
              <span className="flex-1 text-sm text-slate-700 text-left">{label}</span>
              <ChevronRight size={16} className="text-slate-300" />
            </button>
          ))}
        </div>
      </div>

      {/* Sign out */}
      <button
        onClick={signOut}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-red-100 text-red-500 font-semibold hover:bg-red-50 transition-colors"
      >
        <LogOut size={18} />
        Sair da conta
      </button>
    </div>
  );
}
