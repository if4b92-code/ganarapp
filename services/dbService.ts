
import { Sticker, GlobalSettings, LotterySchedule, OwnerData } from '../types';
import { supabase, isCloudEnabled, uuidv4 } from './client';

// This file is the new source of truth. It will use Supabase if enabled.

export const COLOMBIAN_LOTTERIES: LotterySchedule[] = [
    { day: 1, dayName: 'Lunes', lotteries: ['Lotería de Cundinamarca', 'Lotería del Tolima'] },
    { day: 2, dayName: 'Martes', lotteries: ['Lotería de la Cruz Roja', 'Lotería del Huila'] },
    { day: 3, dayName: 'Miércoles', lotteries: ['Lotería de Manizales', 'Lotería del Valle', 'Lotería del Meta'] },
    { day: 4, dayName: 'Jueves', lotteries: ['Lotería de Bogotá', 'Lotería del Quindío'] },
    { day: 5, dayName: 'Viernes', lotteries: ['Lotería de Medellín', 'Lotería de Risaralda', 'Lotería de Santander'] },
    { day: 6, dayName: 'Sábado', lotteries: ['Lotería de Boyacá', 'Lotería del Cauca'] },
    { day: 0, dayName: 'Domingo', lotteries: ['Sorteo Extraordinario'] },
];

const DEFAULT_SETTINGS: GlobalSettings = {
    jackpotAmount: 50000000,
    accumulatedPool: 1250000,
    dailyPrizeAmount: 200000,
    topBuyerPrize: 50000,
    ticketPrice: 5000,
    officialLotteryNameWeekly: "Lotería de Boyacá",
    nextDrawDateWeekly: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    mpAccessToken: '', 
    mpPublicKey: '',
    adminWhatsApp: '573001234567'
};

const dbService = {
    getLotteryForToday: (): string => {
        const day = new Date().getDay();
        const schedule = COLOMBIAN_LOTTERIES.find(s => s.day === day);
        return schedule ? schedule.lotteries[0] : 'Sorteo Local';
    },

    getSettings: async (): Promise<GlobalSettings> => {
        if (!supabase || !isCloudEnabled) return DEFAULT_SETTINGS;
        const { data, error } = await supabase.from('settings').select('settings_data').eq('id', 1).single();
        if (error || !data) {
            await dbService.updateSettings(DEFAULT_SETTINGS);
            return DEFAULT_SETTINGS;
        }
        return { ...DEFAULT_SETTINGS, ...data.settings_data };
    },

    updateSettings: async (newSettings: Partial<GlobalSettings>): Promise<GlobalSettings> => {
        if (!supabase || !isCloudEnabled) return DEFAULT_SETTINGS;
        const currentSettings = await dbService.getSettings();
        const updatedData = { ...currentSettings, ...newSettings };
        const { error } = await supabase.from('settings').upsert({ id: 1, settings_data: updatedData }, { onConflict: 'id' });
        if (error) throw new Error(error.message);
        return updatedData;
    },

    getStickersByPhone: async (phoneNumber: string): Promise<Sticker[]> => {
        if (!supabase || !isCloudEnabled) return [];
        const cleanPhone = phoneNumber.replace(/\D/g, '');
        const { data, error } = await supabase.from('stickers').select('*').eq('user_id', cleanPhone).order('purchased_at', { ascending: false });
        if (error) return [];
        return data as Sticker[];
    },

    getStickerByCode: async (code: string): Promise<Sticker | null> => {
        if (!supabase || !isCloudEnabled) return null;
        const { data, error } = await supabase.from('stickers').select('*').eq('code', code).single();
        if (error) return null;
        return data as Sticker;
    },

    getAllStickersGlobal: async (): Promise<Sticker[]> => {
        if (!supabase || !isCloudEnabled) return [];
        const { data, error } = await supabase.from('stickers').select('*').order('created_at', { ascending: false });
        if (error) return [];
        return data as Sticker[];
    },

    isNumberTaken: async (numbers: string): Promise<boolean> => {
        if (!supabase || !isCloudEnabled) return false;
        const { data, error } = await supabase.from('stickers').select('id').eq('numbers', numbers).in('status', ['active', 'pending']);
        return !!data && data.length > 0;
    },

    createPendingTicket: async (numbers: string, ownerData: OwnerData): Promise<{ success: boolean, message: string, sticker?: Sticker }> => {
        if (!supabase || !isCloudEnabled) return { success: false, message: "Cloud DB not enabled." };
        if (await dbService.isNumberTaken(numbers)) return { success: false, message: `El número ${numbers} ya fue tomado.` };

        const timestamp = new Date();
        const code = `GA-${timestamp.toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        const cleanPhone = ownerData.phone.replace(/\D/g, '');

        const newStickerData = {
            code, numbers, user_id: cleanPhone, status: 'pending',
            owner_data: { ...ownerData, phone: cleanPhone },
        };
        
        const { data, error } = await supabase.from('stickers').insert(newStickerData).select().single();
        if (error) return { success: false, message: error.message };
        return { success: true, message: "Ticket generado", sticker: data as Sticker };
    },

    confirmTicketPayment: async (codeOrId: string): Promise<{ success: boolean, message: string }> => {
        if (!supabase || !isCloudEnabled) return { success: false, message: "Cloud DB not enabled." };

        const { data: sticker, error: fetchError } = await supabase.from('stickers').select('id, status').or(`code.eq.${codeOrId},id.eq.${codeOrId}`).single();
        if (fetchError || !sticker) return { success: false, message: "Ticket no encontrado" };
        if (sticker.status === 'active') return { success: true, message: "Ya estaba pagado" };

        const { error: updateError } = await supabase.from('stickers').update({ status: 'active' }).eq('id', sticker.id);
        if (updateError) return { success: false, message: updateError.message };
        return { success: true, message: "Ticket Activado" };
    },

    updateStickerOwner: async (stickerId: string, newOwnerData: Partial<OwnerData>): Promise<{ data: Sticker, error: null } | { data: null, error: any }> => {
        if (!supabase || !isCloudEnabled) return { data: null, error: { message: "DB not enabled" } };

        // Get current data first to merge
        const { data: currentSticker, error: fetchError } = await supabase.from('stickers').select('owner_data').eq('id', stickerId).single();
        if (fetchError) return { data: null, error: fetchError };

        const mergedData = { ...currentSticker.owner_data, ...newOwnerData };

        const { data, error } = await supabase
            .from('stickers')
            .update({ owner_data: mergedData })
            .eq('id', stickerId)
            .select()
            .single();
            
        return { data: data as Sticker, error };
    },

    onStickersChange: (callback: () => void): (() => Promise<"ok" | "timed out" | "error">) | null => {
        if (!supabase || !isCloudEnabled) return null;

        const channel = supabase.channel('stickers_changes');

        channel
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'stickers' },
                (payload) => {
                    console.log('Change received!', payload);
                    callback();
                }
            )
            .subscribe((status, err) => {
                if (status === 'SUBSCRIBED') {
                    console.log('Realtime sticker subscription active!');
                }
                if (err) {
                    console.error('Realtime subscription error:', err);
                }
            });

        // Return a cleanup function to be called on component unmount
        return () => supabase.removeChannel(channel);
    }
};

export { dbService };
