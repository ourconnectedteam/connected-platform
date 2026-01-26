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
    async startConversation(currentUserId, otherUserId) {
        // 1. Check if a conversation already exists between these two users
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
        // Pass creator_id explicitly (trigger will also set it, but this satisfies the policy check)
        console.log('[DEBUG] Creating conversation with creator_id:', currentUserId);
        console.log('[DEBUG] Target user ID:', otherUserId);

        const { data: conv, error } = await supabase.from('conversations').insert({
            creator_id: currentUserId
        }).select().single();

        if (error) {
            console.error("❌ Error creating conversation:", error);
            console.error("❌ Error code:", error.code);
            console.error("❌ Error message:", error.message);
            console.error("❌ Error details:", JSON.stringify(error, null, 2));
            return { error };
        }

        console.log('✅ Conversation created successfully:', conv);

        // 3. Add creator as member (allowed by RLS: creator can self-join)
        const { error: creatorError } = await supabase.from('conversation_members').insert({
            conversation_id: conv.id,
            user_id: currentUserId
        });

        if (creatorError) {
            console.error("Error adding creator:", creatorError);
            return { error: creatorError };
        }

        // 4. Create invitation for other user
        const { error: inviteError } = await supabase.from('conversation_invitations').insert({
            conversation_id: conv.id,
            inviter_id: currentUserId,
            invitee_id: otherUserId,
            status: 'pending'
        });

        if (inviteError) {
            console.error("Error creating invitation:", inviteError);
            return { error: inviteError };
        }

        // 5. Add other user as member (allowed by RLS: pending invitation exists)
        const { error: memberError } = await supabase.from('conversation_members').insert({
            conversation_id: conv.id,
            user_id: otherUserId
        });

        if (memberError) {
            console.error("Error adding other member:", memberError);
            return { error: memberError };
        }

        // 6. Mark invitation as accepted
        await supabase.from('conversation_invitations')
            .update({ status: 'accepted' })
            .eq('conversation_id', conv.id)
            .eq('invitee_id', otherUserId);

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

    // Delete Conversation for current user (remove their membership)
    async deleteConversation(conversationId, userId) {
        const { error } = await supabase
            .from('conversation_members')
            .delete()
            .eq('conversation_id', conversationId)
            .eq('user_id', userId);

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
