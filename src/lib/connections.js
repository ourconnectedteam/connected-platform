import { supabase } from './supabase.js';

export const connections = {
    // Get Connections
    async getConnections(userId) {
        // A connection is where user is user_a OR user_b
        // This query matches user_a, need OR user_b... Supabase syntax for OR is tricky
        // Simple approach: two queries

        const { data: asA } = await supabase.from('connections').select('user_b, profiles:user_b(*)').eq('user_a', userId);
        const { data: asB } = await supabase.from('connections').select('user_a, profiles:user_a(*)').eq('user_b', userId);

        const listA = asA?.map(r => r.profiles) || [];
        const listB = asB?.map(r => r.profiles) || [];

        return { data: [...listA, ...listB] };
    },

    // Get Pending Requests (Received)
    async getRequests(userId) {
        const { data, error } = await supabase
            .from('connection_requests')
            .select('*, profiles:requester_id(*)')
            .eq('receiver_id', userId)
            .eq('status', 'pending');
        return { data, error };
    },

    // Accept Request
    async acceptRequest(requestId) {
        // Get request details first
        const { data: req } = await supabase.from('connection_requests').select('*').eq('id', requestId).single();
        if (!req) return { error: 'Request not found' };

        // Update status
        await supabase.from('connection_requests').update({ status: 'accepted' }).eq('id', requestId);

        // Create Connection
        // Force A < B for uniqueness if we enforced it, otherwise just insert
        await supabase.from('connections').insert({
            user_a: req.requester_id,
            user_b: req.receiver_id
        });

        return { success: true };
    },

    // Decline Request
    async declineRequest(requestId) {
        await supabase.from('connection_requests').update({ status: 'declined' }).eq('id', requestId);
        return { success: true };
    }
};
