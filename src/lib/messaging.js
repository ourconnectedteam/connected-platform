import { supabase } from './supabase.js';

export const messaging = {
    // Get Conversations for current user
    async getConversations(userId) {
        // Complex query simplified: fetch members where user_id is me
        const { data: memberRows, error } = await supabase
            .from('conversation_members')
            .select('conversation_id, last_read_at, conversations(*)')
            .eq('user_id', userId);

        if (error) return { error };

        // For each conversation, fetch the OTHER member to display name/avatar
        const conversations = await Promise.all(memberRows.map(async (row) => {
            const convId = row.conversation_id;

            // Get other member
            const { data: others } = await supabase
                .from('conversation_members')
                .select('profiles(full_name, avatar_url)')
                .eq('conversation_id', convId)
                .neq('user_id', userId)
                .single();

            // Get last message
            const { data: lastMsg } = await supabase
                .from('messages')
                .select('body, created_at')
                .eq('conversation_id', convId)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            return {
                id: convId,
                otherUser: others?.profiles,
                lastMessage: lastMsg,
                unread: lastMsg ? new Date(lastMsg.created_at) > new Date(row.last_read_at) : false
            };
        }));

        return { data: conversations };
    },

    // Get Messages for a conversation
    async getMessages(conversationId) {
        const { data, error } = await supabase
            .from('messages')
            .select('*, profiles(full_name, avatar_url)')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: true });
        return { data, error };
    },

    // Send Message
    async sendMessage(conversationId, senderId, body) {
        const { data, error } = await supabase.from('messages').insert({
            conversation_id: conversationId,
            sender_id: senderId,
            body: body
        }).select().single();

        if (!error) {
            // Update conversation timestamp
            await supabase.from('conversations')
                .update({ last_message_at: new Date() })
                .eq('id', conversationId);
        }

        return { data, error };
    },

    // Create Conversation (if not exists)
    // Create Conversation (if not exists)
    async startConversation(currentUserId, otherUserId) {
        // 1. Check if a conversation already exists between these two users
        // This is tricky in Supabase without a stored procedure, but we can try a client-side filter
        // Fetch valid conversation IDs for current user
        const { data: myConvs } = await supabase
            .from('conversation_members')
            .select('conversation_id')
            .eq('user_id', currentUserId);

        if (myConvs && myConvs.length > 0) {
            const myConvIds = myConvs.map(c => c.conversation_id);
            // Check if otherUser is in any of these conversations
            const { data: existing } = await supabase
                .from('conversation_members')
                .select('conversation_id')
                .in('conversation_id', myConvIds)
                .eq('user_id', otherUserId)
                .single();

            if (existing) {
                return { data: { id: existing.conversation_id } };
            }
        }

        // 2. Create new conversation
        const { data: conv, error } = await supabase.from('conversations').insert({}).select().single();
        if (error) return { error };

        // 3. Add members
        const { error: memberError } = await supabase.from('conversation_members').insert([
            { conversation_id: conv.id, user_id: currentUserId },
            { conversation_id: conv.id, user_id: otherUserId }
        ]);

        if (memberError) {
            console.error("Error adding members:", memberError);
            return { error: memberError };
        }

        return { data: conv };
    },

    // Realtime Subscription
    subscribeToMessages(conversationId, callback) {
        return supabase
            .channel(`public:messages:conversation_id=eq.${conversationId}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` }, payload => {
                callback(payload.new);
            })
            .subscribe();
    },

    // Mark as Read
    async markAsRead(conversationId, userId) {
        // Mark all messages in this conversation NOT sent by me as read
        const { error } = await supabase
            .from('messages')
            .update({ is_read: true })
            .eq('conversation_id', conversationId)
            .neq('sender_id', userId)
            .eq('is_read', false);

        return { error };
    },

    // Get Total Unread Count
    async getUnreadCount(userId) {
        // Step 1: Get my conversations
        const { data: myConvs } = await supabase
            .from('conversation_members')
            .select('conversation_id')
            .eq('user_id', userId);

        if (!myConvs || myConvs.length === 0) return { count: 0 };

        const convIds = myConvs.map(c => c.conversation_id);

        // Step 2: Count unread messages in these conversations sent by OTHERS
        const { count, error } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .in('conversation_id', convIds)
            .neq('sender_id', userId)
            .eq('is_read', false);

        return { count: count || 0, error };
    }
};
