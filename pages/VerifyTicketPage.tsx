
import React, { useEffect, useState } from 'react';
import { dbService } from '../services/dbService'; // <-- UPDATED IMPORT
import { Sticker, OwnerData } from '../types';
import { ShieldCheck, AlertTriangle, User, Phone, FileText, Save, CheckCircle2, ArrowLeft } from 'lucide-react';

interface Props {
  code: string;
  onHome: () => void;
}

export const VerifyTicketPage: React.FC<Props> = ({ code, onHome }) => {
  const [sticker, setSticker] = useState<Sticker | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Form State
  const [ownerData, setOwnerData] = useState<Partial<OwnerData>>({ fullName: '', phone: '', documentId: '' });
  const [saving, setSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    const load = async () => {
        if (!code) {
            setError("Código no proporcionado");
            setLoading(false);
            return;
        }
        
        try {
            const s = await dbService.getStickerByCode(code);
            if (s) {
                setSticker(s);
                // Set form with existing data
                setOwnerData(s.owner_data || { fullName: '', phone: '', documentId: '' });
                // If user has already filled data, mark as saved
                if (s.owner_data?.fullName && s.owner_data?.documentId) {
                    setIsSaved(true);
                }
            } else {
                setError("Ticket Inválido o No Encontrado");
            }
        } catch (err: any) {
            setError("Error de conexión: " + err.message);
        }
        setLoading(false);
    };
    load();
  }, [code]);

  const handleSaveOwner = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!sticker) return;
      setSaving(true);
      
      try {
          const { data, error } = await dbService.updateStickerOwner(sticker.id, ownerData);
          if (error) throw error;

          setSticker(data); // Update local state with the newly saved data
          setIsSaved(true);
      } catch (err: any) {
          setError("No se pudo guardar la información: " + err.message);
      }

      setSaving(false);
  };

  if (loading) return <div className="flex justify-center pt-20"><div className="animate-spin w-10 h-10 border-4 border-brand-500 rounded-full border-t-transparent"></div></div>;

  if (error) {
      return (
          <div className="flex flex-col items-center justify-center pt-20 px-6 text-center space-y-4">
              <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center text-red-500"><AlertTriangle size={40} /></div>
              <h2 className="text-2xl font-bold text-white">Verificación Fallida</h2>
              <p className="text-slate-400">{error}</p>
              <button onClick={onHome} className="mt-8 text-brand-400 font-bold underline">Ir al Inicio</button>
          </div>
      );
  }

  if (!sticker) return null;

  const handleInputChange = (field: keyof OwnerData, value: string) => {
      setOwnerData(prev => ({...prev, [field]: value}));
  }

  return (
    <div className="min-h-screen bg-navy-950 p-6">
        <div className="flex flex-col items-center justify-center mb-8">
            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(34,197,94,0.4)] mb-4"><ShieldCheck size={32} className="text-white" /></div>
            <h1 className="text-2xl font-bold text-white">Ticket Auténtico</h1>
            <p className="text-green-400 text-sm font-bold">Verificado por GanarApp</p>
        </div>

        <div className="bg-navy-card border border-brand-500/30 rounded-2xl p-6 mb-8">
            <div className="text-center">
                <div className="text-6xl font-black font-mono text-white tracking-[0.2em] mb-2">{sticker.numbers}</div>
                <div className="inline-block bg-navy-950/50 px-3 py-1 rounded text-xs font-mono text-slate-400 border border-white/5">{sticker.code}</div>
            </div>
        </div>

        <div className="space-y-4">
            <h3 className="text-white font-bold text-lg">Datos del Propietario</h3>
            <form onSubmit={handleSaveOwner} className="space-y-4 bg-navy-900 p-5 rounded-2xl border border-white/5">
                <input type="text" required disabled={isSaved} value={ownerData.fullName || ''} onChange={e => handleInputChange('fullName', e.target.value)} placeholder="Nombre Completo" className="w-full bg-navy-950 rounded-xl p-3 text-white"/>
                <input type="text" required disabled={isSaved} value={ownerData.documentId || ''} onChange={e => handleInputChange('documentId', e.target.value)} placeholder="Cédula / Documento" className="w-full bg-navy-950 rounded-xl p-3 text-white"/>
                <input type="tel" required disabled={isSaved} value={ownerData.phone || ''} onChange={e => handleInputChange('phone', e.target.value)} placeholder="Celular / WhatsApp" className="w-full bg-navy-950 rounded-xl p-3 text-white"/>

                {!isSaved ? (
                    <button disabled={saving} className="w-full bg-brand-500 text-navy-950 font-black py-3 rounded-xl">
                        {saving ? 'Guardando...' : 'Registrar Datos'}
                    </button>
                ) : (
                    <div className="w-full bg-green-500/10 text-green-400 font-bold py-3 rounded-xl text-center">
                        Datos Registrados
                    </div>
                )}
            </form>
        </div>

        <div className="mt-8 text-center">
            <button onClick={onHome} className="text-slate-500 text-sm font-bold underline">
                Ir a la App Principal
            </button>
        </div>
    </div>
  );
};
