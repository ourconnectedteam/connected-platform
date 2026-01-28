import { supabase } from './supabase.js';

export const connections = {
    // Get Connections
    async getConnections(userId) {
        // A connection is where user is user_a OR user_b
        // This query matches user_a, need OR user_b... Supabase syntax for OR is tricky
        // Simple approach: two queries

        const { data: asA } = await supabase
            .from('connections')
            .select('user_b, profiles:user_b(*)')
            .eq('user_a', userId);
        const { data: asB } = await supabase
            .from('connections')
            .select('user_a, profiles:user_a(*)')
            .eq('user_b', userId);

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
        const { data: req } = await supabase
            .from('connection_requests')
            .select('*')
            .eq('id', requestId)
            .single();
        if (!req) return { error: 'Request not found' };

        // Update status
        await supabase
            .from('connection_requests')
            .update({ status: 'accepted' })
            .eq('id', requestId);

        // Create Connection
        // Force A < B for uniqueness if we enforced it, otherwise just insert
        await supabase.from('connections').insert({
            user_a: req.requester_id,
            user_b: req.receiver_id,
        });

        return { success: true };
    },

    // Decline Request
    async declineRequest(requestId) {
        await supabase
            .from('connection_requests')
            .update({ status: 'declined' })
            .eq('id', requestId);
        return { success: true };
    },

    // Get Connection Status between current user and target user
    async getConnectionStatus(currentUserId, targetUserId) {
        if (!currentUserId || !targetUserId) return 'none';
        if (currentUserId === targetUserId) return 'self';

        // Check if already connected
        const { data: conn } = await supabase
            .from('connections')
            .select('id')
            .or(`and(user_a.eq.${currentUserId},user_b.eq.${targetUserId}),and(user_a.eq.${targetUserId},user_b.eq.${currentUserId})`)
            .single();

        if (conn) return 'connected';

        // Check pending requests
        const { data: outgoing } = await supabase
            .from('connection_requests')
            .select('id')
            .eq('requester_id', currentUserId)
            .eq('receiver_id', targetUserId)
            .eq('status', 'pending')
            .maybeSingle();

        if (outgoing) return 'outgoing_pending';

        const { data: incoming } = await supabase
            .from('connection_requests')
            .select('id, requester_id, receiver_id')
            .eq('requester_id', targetUserId)
            .eq('receiver_id', currentUserId)
            .eq('status', 'pending')
            .maybeSingle();

        if (incoming) return { status: 'incoming_pending', requestId: incoming.id };

        return 'none';
    },

    // Send Connection Request
    async sendRequest(requesterId, receiverId) {
        // Validate inputs
        if (!requesterId || !receiverId) {
            return { error: { message: 'Invalid user IDs provided.', code: 'INVALID_INPUT' } };
        }

        if (requesterId === receiverId) {
            return { error: { message: 'Cannot send connection request to yourself.', code: 'SELF_REQUEST' } };
        }

        // Check if users are already connected (check both directions)
        const { data: conn1 } = await supabase
            .from('connections')
            .select('id')
            .eq('user_a', requesterId)
            .eq('user_b', receiverId)
            .maybeSingle();

        const { data: conn2 } = await supabase
            .from('connections')
            .select('id')
            .eq('user_a', receiverId)
            .eq('user_b', requesterId)
            .maybeSingle();

        if (conn1 || conn2) {
            return { error: { message: 'You are already connected with this user.', code: 'ALREADY_CONNECTED' } };
        }

        // Check if a request already exists (in either direction)
        const { data: request1 } = await supabase
            .from('connection_requests')
            .select('id, status')
            .eq('requester_id', requesterId)
            .eq('receiver_id', receiverId)
            .maybeSingle();

        const { data: request2 } = await supabase
            .from('connection_requests')
            .select('id, status')
            .eq('requester_id', receiverId)
            .eq('receiver_id', requesterId)
            .maybeSingle();

        const existingRequest = request1 || request2;
        if (existingRequest) {
            if (existingRequest.status === 'pending') {
                return { error: { message: 'A connection request is already pending.', code: 'DUPLICATE_REQUEST' } };
            } else if (existingRequest.status === 'accepted') {
                return { error: { message: 'You are already connected with this user.', code: 'ALREADY_CONNECTED' } };
            }
        }

        // Create new connection request
        const { data, error } = await supabase
            .from('connection_requests')
            .insert({
                requester_id: requesterId,
                receiver_id: receiverId,
                status: 'pending'
            })
            .select()
            .single();

        if (error) {
            // Handle unique constraint violation (duplicate request)
            if (error.code === '23505') {
                return { error: { message: 'A connection request already exists.', code: 'DUPLICATE_REQUEST' } };
            }
            return { error };
        }

        return { data, success: true };
    },
};
