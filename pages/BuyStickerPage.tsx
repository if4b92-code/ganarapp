
import React, { useState, useEffect } from 'react';
import { dbService } from '../services/dbService'; // <-- UPDATED IMPORT
import { paymentService } from '../services/paymentService';
import { GlobalSettings, Sticker, OwnerData } from '../types';
import { AlertTriangle, Dices, Delete, ShieldCheck, ArrowLeft, ArrowRight, CreditCard, User, Phone, CheckCircle, Wallet } from 'lucide-react';

interface Props {
  onSuccess: () => void;
  onBack: () => void;
}

export const BuyStickerPage: React.FC<Props> = ({ onSuccess, onBack }) => {
  const [numbers, setNumbers] = useState('');
  const [step, setStep] = useState<'select' | 'user_info' | 'payment_method'>('select');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<GlobalSettings | null>(null);
  
  const [userInfo, setUserInfo] = useState<OwnerData>({ fullName: '', phone: '', countryCode: '57', email: '', documentId: '' });
  const [pendingSticker, setPendingSticker] = useState<Sticker | null>(null);
  
  // Temporarily disable wallet functionality
  // const [userBalance, setUserBalance] = useState(0);

  useEffect(() => {
    const init = async () => {
        setLoading(true);
        try {
            const s = await dbService.getSettings();
            setSettings(s);
        } catch (err) {
            setError("No se pudo cargar la configuración del sistema.");
        }
        setLoading(false);
    };
    init();
  }, []);

  const handleInput = (num: string) => {
    if (numbers.length < 4) {
      setNumbers(prev => prev + num);
      setError(null);
    }
  };

  const handleDelete = () => {
    setNumbers(prev => prev.slice(0, -1));
    setError(null);
  };

  const handleRandom = async () => {
    setLoading(true);
    setError(null);
    let uniqueFound = false;
    let attempt = 0;
    let randomNum = '';
    
    while (!uniqueFound && attempt < 20) { // Increased attempts
        const r = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        try {
            const isTaken = await dbService.isNumberTaken(r);
            if (!isTaken) {
                randomNum = r;
                uniqueFound = true;
            }
        } catch (err) { 
            /*ignore db error during random search*/ 
        }
        attempt++;
    }
    
    setLoading(false);
    if (uniqueFound) {
        setNumbers(randomNum);
    } else {
        setError("Sistema ocupado. Intenta de nuevo.");
    }
  };

  const validateAndProceed = async () => {
    if (numbers.length !== 4) {
      setError("Faltan dígitos");
      return;
    }
    setLoading(true);
    try {
        const isTaken = await dbService.isNumberTaken(numbers);
        if (isTaken) {
          setError("Número Ocupado");
        } else {
          setStep('user_info');
        }
    } catch (err) {
        setError("Error de conexión. Intenta de nuevo.");
    }
    setLoading(false);
  };

  const createTicketAndProceed = async () => {
      if (!userInfo.fullName || !userInfo.phone) {
          setError("Nombre y WhatsApp son obligatorios");
          return;
      }
      
      setLoading(true);
      setError(null);
      const fullPhone = `${userInfo.countryCode}${userInfo.phone}`;
      const ownerDataWithFullPhone: OwnerData = { ...userInfo, phone: fullPhone };

      try {
          const result = await dbService.createPendingTicket(numbers, ownerDataWithFullPhone);
          
          if (result.success && result.sticker) {
              setPendingSticker(result.sticker);
              // const bal = await dbService.getWalletBalance(fullPhone); // Wallet functionality disabled for now
              // setUserBalance(bal);
              setStep('payment_method');
          } else {
              setError(result.message);
          }
      } catch (err: any) {
          setError(err.message || "Error creando el ticket.");
      }
      setLoading(false);
  };

//   const payWithWallet = async () => { // Wallet functionality disabled for now
//       if (!settings || !pendingSticker) return;
//       setLoading(true);
      
//       const result = await dbService.payWithWallet(pendingSticker.userId, pendingSticker.code, settings.ticketPrice);
//       if (result.success) {
//           onSuccess();
//       } else {
//           setError(result.message);
//       }
//       setLoading(false);
//   };

  const payWithMercadoPago = async () => {
      if (!settings || !pendingSticker) return;
      setLoading(true);
      setError(null);

      try {
          const result = await paymentService.createPaymentPreference({
              sticker: pendingSticker,
              ownerData: userInfo,
          });

          if (result.success && result.initPoint) {
              window.location.href = result.initPoint;
          } else {
              throw new Error(result.message || 'No se pudo iniciar el pago.');
          }
      } catch (err: any) {
          setLoading(false);
          setError(`Error al crear preferencia de pago: ${err.message}`);
      }
  };

  const formatMoney = (val: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);

  if (!settings && !loading) return (
    <div className="text-center text-red-400 font-bold p-4 bg-red-500/10 rounded-xl">
        <AlertTriangle className="mx-auto mb-2"/>
        No se pudo cargar la configuración del sistema. Por favor, recarga la página.
    </div>
  );

  if (loading && !settings) return <div className="flex items-center justify-center h-full"><div className="animate-spin w-8 h-8 border-4 border-brand-500 rounded-full border-t-transparent"></div></div>;

  // ... Rest of the component remains the same, only the logic handlers were changed.
  // This is a long component, so we will only show the changed parts for brevity.

  if (step === 'user_info') {
      return (
        <div className="space-y-6 animate-in slide-in-from-bottom-10 duration-300 h-full flex flex-col px-4">
            <button onClick={() => setStep('select')} className="text-slate-400 hover:text-white flex items-center gap-1 text-sm font-bold">
                <ArrowLeft size={16} /> Volver a Números
            </button>
            <div className="text-center mb-4">
                <h2 className="text-2xl font-bold text-white">Tus Datos</h2>
                <p className="text-slate-400 text-xs">Necesarios para vincular tu ticket <span className="text-brand-400 font-bold">#{numbers}</span></p>
            </div>
            <div className="space-y-4 bg-navy-900 p-5 rounded-2xl border border-white/5">
                <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-500 ml-1">Nombre Completo</label>
                    <div className="relative">
                        <User size={16} className="absolute left-3 top-3.5 text-slate-500" />
                        <input type="text" required value={userInfo.fullName} onChange={e => setUserInfo(u => ({...u, fullName: e.target.value}))} className="w-full bg-navy-950 border border-white/10 rounded-xl py-3 pl-10 text-white text-sm focus:border-brand-500 outline-none" placeholder="Tu nombre" />
                    </div>
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-500 ml-1">WhatsApp / Celular</label>
                    <div className="flex gap-2">
                        <div className="relative w-24 shrink-0">
                            <span className="absolute left-2 top-3.5 text-slate-500 text-xs">+</span>
                            <input type="text" value={userInfo.countryCode} onChange={e => setUserInfo(u => ({...u, countryCode: e.target.value.replace(/\D/g,'')}))} className="w-full bg-navy-950 border border-white/10 rounded-xl py-3 pl-6 text-white text-sm text-center focus:border-brand-500 outline-none" />
                        </div>
                        <div className="relative flex-1">
                            <Phone size={16} className="absolute left-3 top-3.5 text-slate-500" />
                            <input type="tel" required value={userInfo.phone} onChange={e => setUserInfo(u => ({...u, phone: e.target.value.replace(/\D/g,'')}))} className="w-full bg-navy-950 border border-white/10 rounded-xl py-3 pl-10 text-white text-sm focus:border-brand-500 outline-none" placeholder="Número" />
                        </div>
                    </div>
                </div>
            </div>
            {error && <p className="text-red-500 text-center text-xs font-bold">{error}</p>}
            <button onClick={createTicketAndProceed} disabled={!userInfo.fullName || !userInfo.phone || loading} className="w-full bg-brand-500 hover:bg-brand-400 text-navy-950 font-black py-4 rounded-xl flex items-center justify-center gap-2 shadow-glow active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed">
                {loading ? 'Generando Ticket...' : <>CONTINUAR <ArrowRight size={20}/></>}
            </button>
        </div>
      );
  }

  if (step === 'payment_method') {
      return (
        <div className="space-y-6 animate-in slide-in-from-bottom-10 duration-300 h-full flex flex-col px-4">
             <button onClick={() => setStep('select')} className="text-slate-400 hover:text-white flex items-center gap-1 text-sm font-bold">
                <ArrowLeft size={16} /> Cancelar Compra
            </button>
            <div className="text-center mb-2">
                <div className="inline-flex items-center gap-2 bg-green-500/10 text-green-400 px-3 py-1 rounded-full text-xs font-bold mb-4 border border-green-500/20">
                    <CheckCircle size={14}/> Ticket Generado
                </div>
                <h2 className="text-2xl font-bold text-white">Realizar Pago</h2>
                <div className="text-6xl font-mono font-black text-brand-400 my-2 drop-shadow-lg tracking-widest">{numbers}</div>
                <p className="text-slate-400 text-sm">Valor a pagar: <span className="text-white font-bold">{settings && formatMoney(settings.ticketPrice)}</span></p>
            </div>
            <div className="space-y-4 flex-1">
                {/* Wallet functionality is temporarily disabled */}
                {/* {userBalance >= settings.ticketPrice && (
                    <button onClick={payWithWallet} disabled={loading} className="...">
                        ...
                    </button>
                )} */}
                <button onClick={payWithMercadoPago} disabled={loading} className="w-full bg-[#009EE3] hover:bg-[#008CC9] rounded-xl h-16 transition-all active:scale-[0.98] shadow-lg flex items-center px-6 relative overflow-hidden group">
                    <div className="flex items-center gap-4 w-full">
                        <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center shrink-0"><CreditCard size={20} className="text-white" /></div>
                        <div className="text-left flex-1">
                            <span className="text-white font-black text-lg block leading-tight">PAGAR CON MERCADO PAGO</span>
                            <span className="text-blue-100 text-xs font-medium">PSE, Tarjetas, Nequi, Efecty</span>
                        </div>
                        <ArrowRight size={24} className="text-white group-hover:translate-x-1 transition-transform shrink-0" />
                    </div>
                    {loading && <div className="absolute inset-0 bg-navy-950/50 z-20 flex items-center justify-center"><div className="animate-spin w-6 h-6 border-2 border-white border-t-transparent rounded-full"></div></div>}
                </button>
            </div>
            {error && (
                <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex flex-col gap-2 animate-pulse text-center mt-auto">
                    <div className="flex items-center justify-center gap-2 text-red-400 text-xs font-bold">
                        <AlertTriangle size={16} className="shrink-0" /> 
                        <span>{error}</span>
                    </div>
                </div>
            )}
        </div>
      );
  }

  return (
    <div className="flex flex-col h-full justify-end pb-4 space-y-4">
        <div className="flex-1 flex flex-col justify-center items-center">
            <div className="w-full flex justify-start mb-4"><button onClick={onBack} className="text-slate-500 hover:text-white"><ArrowLeft /></button></div>
            <div className="text-center space-y-2 mb-6">
                <h2 className="text-xl font-bold text-white">Elige tus 4 Cifras</h2>
                {settings && <p className="text-slate-400 text-xs">Juega por <span className="text-white font-bold">{formatMoney(settings.dailyPrizeAmount)}</span> HOY.</p>}
            </div>
            <div className={`w-full bg-navy-900 p-6 rounded-2xl border-2 ${error ? 'border-red-500/50' : 'border-navy-800'} flex flex-col items-center justify-center relative shadow-inner`}>
                <div className="text-6xl font-mono font-bold tracking-[0.3em] text-white min-h-[4rem] z-10">
                    {loading && step === 'select' ? <div className="animate-pulse text-white/20">....</div> : numbers.padEnd(4, '_')}
                </div>
                {error && (
                    <div className="absolute -bottom-8 left-0 right-0 flex items-center justify-center gap-1 text-red-400 text-xs font-bold animate-pulse">
                        <AlertTriangle size={12} /> {error}
                    </div>
                )}
            </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map(num => (<button key={num} onClick={() => handleInput(num.toString())} disabled={loading} className="bg-navy-card hover:bg-navy-800 border-b-4 border-navy-900 active:border-b-0 active:translate-y-1 text-2xl font-bold py-4 rounded-xl transition-all text-white shadow-lg aspect-square">{num}</button>))}
            <button onClick={handleDelete} className="bg-navy-900 text-red-400/80 font-bold py-4 rounded-xl flex items-center justify-center"><Delete size={24} /></button>
            <button onClick={validateAndProceed} disabled={numbers.length !== 4 || loading} className={`font-bold py-4 rounded-xl flex items-center justify-center col-span-2 transition-all active:scale-95 ${numbers.length === 4 ? 'bg-brand-500 text-navy-950 shadow-glow' : 'bg-navy-800 text-slate-600 cursor-not-allowed'}`}>
                {loading ? <div className="animate-spin w-5 h-5 border-2 border-navy-950 border-t-transparent rounded-full"></div> : <ShieldCheck size={24} />}
            </button>
        </div>
    </div>
  );
}
