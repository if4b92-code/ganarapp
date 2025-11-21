
import React, { useState, ChangeEvent, FormEvent, useEffect } from 'react';
import { dbService } from '../../services/dbService';
import { Sticker, GlobalSettings } from '../../types';
import { Lock, Save, LogOut, MessageCircle } from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [settings, setSettings] = useState<GlobalSettings | null>(null);
  
  const [activeTab, setActiveTab] = useState<'sales' | 'users' | 'config'>('sales');
  const [loading, setLoading] = useState(true);
  const [userCodes, setUserCodes] = useState<Record<string, string>>({});

  useEffect(() => {
    let cleanup: (() => Promise<"ok" | "timed out" | "error">) | null = null;

    if (isAuthenticated) {
      loadData();
      cleanup = dbService.onStickersChange(() => {
        console.log('Stickers changed, reloading...');
        loadData();
      });
    }

    return () => {
      if (cleanup) {
        cleanup();
      }
    };
  }, [isAuthenticated]);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const { success, message } = await dbService.signInAdmin(email, password);
    if (success) {
      setIsAuthenticated(true);
    } else {
      setError(message || 'Error al iniciar sesión.');
    }
  };

  const handleLogout = async () => {
    await dbService.signOutAdmin();
    setIsAuthenticated(false);
    setEmail('');
    setPassword('');
    setStickers([]); // Clear data on logout
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [s, set] = await Promise.all([
        dbService.getAllStickersGlobal(),
        dbService.getSettings(),
      ]);

      setStickers(s);
      setSettings(set);
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
      setError("No se pudieron cargar los datos desde la base de datos.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSettings = async (e: FormEvent) => {
    e.preventDefault();
    if (settings) {
      try {
        await dbService.updateSettings(settings);
        alert("Guardado correctamente");
      } catch (err) {
        alert("Error al guardar la configuración.");
      }
    }
  };
  
  const handleWhatsAppClick = (sticker: Sticker) => {
      const phone = sticker.owner_data?.phone;
      if (!phone) return;
      
      const cleanPhone = phone.replace(/\+/g, '');
      const message = `Hola ${sticker.owner_data.fullName}, confirmamos tu compra en GanarApp. Tu ticket es: ${sticker.numbers} (Código: ${sticker.code}). ¡Mucha suerte!`;
      
      const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
      window.open(url, '_blank');
  };

  const handleManualApproval = async (e: React.MouseEvent, sticker: Sticker) => {
    e.preventDefault();
    e.stopPropagation();

    if (window.confirm(`¿Confirmar pago MANUAL del ticket #${sticker.numbers}?`)) {
      const { success, message } = await dbService.confirmTicketPayment(sticker.id);
      if (success) {
        alert("✅ Ticket marcado como PAGADO.");
      } else {
        alert(`❌ Error: ${message}`);
      }
    }
  };

  const handleGenerateCode = async (phone: string, name: string) => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setUserCodes(prev => ({ ...prev, [phone]: code }));

    const cleanPhone = phone.replace(/\+/g, '');
    const message = `Hola ${name}, tu Código de Acceso Seguro para ver tus tickets en GanarApp es: *${code}*. No lo compartas.`;
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const uniqueUsers = Array.from(new Set(stickers.map(s => s.user_id)))
    .map(userId => {
        const userStickers = stickers.filter(s => s.user_id === userId);
        const lastSticker = userStickers.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
        return {
            phone: userId,
            name: lastSticker?.owner_data.fullName || 'Usuario',
        };
    });

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-6 px-6">
        <div className="w-20 h-20 rounded-2xl bg-navy-card border border-white/10 flex items-center justify-center shadow-glow"><Lock className="text-brand-500" size={32} /></div>
        <h2 className="text-2xl font-bold text-white">Acceso Admin</h2>
        <form onSubmit={handleLogin} className="w-full space-y-4">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full bg-navy-900 border border-white/10 rounded-xl px-4 py-4 text-white focus:ring-2 focus:ring-brand-500 outline-none transition-all placeholder:text-slate-600 text-center" />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Contraseña" className="w-full bg-navy-900 border border-white/10 rounded-xl px-4 py-4 text-white focus:ring-2 focus:ring-brand-500 outline-none transition-all placeholder:text-slate-600 text-center tracking-widest" />
          {error && <p className="text-red-500 text-sm text-center font-bold">{error}</p>}
          <button className="w-full bg-white text-navy-950 font-bold py-4 rounded-xl uppercase tracking-wider hover:bg-slate-200">Entrar</button>
        </form>
      </div>
    );
  }

  if (loading) {
    return <div className="flex justify-center mt-20"><div className="animate-spin w-8 h-8 border-4 border-brand-500 rounded-full border-t-transparent"></div></div>;
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Dashboard</h2>
        <button onClick={handleLogout} className="flex items-center gap-2 text-xs text-red-400 font-bold px-3 py-2 bg-red-500/10 rounded-lg">
          <LogOut size={14} />
          Salir
        </button>
      </div>

      <div className="bg-navy-900 p-1 rounded-xl flex overflow-x-auto scrollbar-hide">
        <button onClick={() => setActiveTab('sales')} className={`flex-1 min-w-[70px] py-2 px-2 rounded-lg text-[10px] font-bold uppercase tracking-wide ${activeTab === 'sales' ? 'bg-brand-500 text-navy-950' : 'text-slate-400'}`}>Ventas ({stickers.length})</button>
        <button onClick={() => setActiveTab('users')} className={`flex-1 min-w-[70px] py-2 px-2 rounded-lg text-[10px] font-bold uppercase tracking-wide ${activeTab === 'users' ? 'bg-brand-500 text-navy-950' : 'text-slate-400'}`}>Usuarios ({uniqueUsers.length})</button>
        <button onClick={() => setActiveTab('config')} className={`flex-1 min-w-[70px] py-2 px-2 rounded-lg text-[10px] font-bold uppercase tracking-wide ${activeTab === 'config' ? 'bg-brand-500 text-navy-950' : 'text-slate-400'}`}>Ajustes</button>
      </div>

      {activeTab === 'sales' && (
        <div className="space-y-3">
          {stickers.map(s => (
            <div key={s.id} className={`flex justify-between items-center p-4 bg-navy-card rounded-xl border ${s.status === 'active' ? 'border-green-500/20' : 'border-yellow-500/20'}`}>
              <div>
                <div className="font-mono font-bold text-white text-lg tracking-widest">{s.numbers}</div>
                <div className="text-[10px] text-slate-500 font-mono">{s.code}</div>
              </div>
              <div className="text-right flex flex-col items-end gap-1">
                <div className="text-xs text-slate-300">{s.owner_data?.fullName || 'Sin registrar'}</div>
                <div className={`text-[9px] font-bold uppercase px-1 rounded ${s.status === 'active' ? 'text-green-400 bg-green-500/10' : 'text-yellow-400 bg-yellow-500/10'}`}>
                  {s.status}
                </div>
                <div className="flex gap-1 mt-1">
                  {s.status === 'pending' && (
                    <button type="button" onClick={(e) => handleManualApproval(e, s)} className="bg-yellow-500 text-navy-950 font-bold px-3 py-1.5 rounded-lg text-[10px] hover:bg-yellow-400">
                      APROBAR
                    </button>
                  )}
                  {s.owner_data?.phone && (
                    <button type="button" onClick={() => handleWhatsAppClick(s)} className="bg-green-600/20 text-green-400 p-2 rounded-full">
                      <MessageCircle size={18} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'users' && (
        <div className="space-y-4">
          {uniqueUsers.map((user) => (
            <div key={user.phone} className="bg-navy-card p-4 rounded-xl border border-white/5">
              <div className="text-white font-bold text-sm">{user.name}</div>
              <div className="text-xs text-slate-400 font-mono">{user.phone}</div>
              <button onClick={() => handleGenerateCode(user.phone, user.name)} className="mt-2 bg-brand-500/10 text-brand-400 px-3 py-1.5 rounded text-[10px] font-bold">
                GENERAR CLAVE DE ACCESO
              </button>
            </div>
          ))}
        </div>
      )}
      
      {activeTab === 'config' && settings && (
        <form onSubmit={handleUpdateSettings} className="space-y-5 bg-navy-card p-5 rounded-2xl border border-white/5">
          <div className="space-y-2">
            <label className="text-[10px] text-slate-400 uppercase font-bold">Precio Ticket</label>
            <input type="number" value={settings.ticketPrice} onChange={(e) => setSettings(prev => prev ? {...prev, ticketPrice: parseInt(e.target.value) || 0} : null)} className="w-full bg-navy-900 border border-navy-700 rounded-lg p-3 text-white" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] text-slate-400 uppercase font-bold">Access Token Mercado Pago</label>
            <input type="text" value={settings.mpAccessToken || ''} onChange={(e) => setSettings(prev => prev ? {...prev, mpAccessToken: e.target.value} : null)} className="w-full bg-navy-900 border border-navy-700 rounded-lg p-3 text-white" />
          </div>
          <button className="w-full bg-brand-500 text-navy-950 font-black py-4 rounded-xl">
            GUARDAR TODO
          </button>
        </form>
      )}
    </div>
  );
};

// Add a default export to satisfy Vite's requirement
export default AdminDashboard;
