import { auth } from './lib/auth.js';
import { supabase } from './lib/supabase.js';
import { messaging } from './lib/messaging.js';
import { connections } from './lib/connections.js';

document.addEventListener('DOMContentLoaded', async () => {
    // Tab Logic
    const tabs = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));

            // Add active
            tab.classList.add('active');
            const targetId = `tab-${tab.dataset.tab}`;
            const targetEl = document.getElementById(targetId);
            if (targetEl) {
                targetEl.classList.add('active');
                // Load data based on tab
                if (tab.dataset.tab === 'bookings') loadBookings();
                if (tab.dataset.tab === 'messages') loadConversations();
                if (tab.dataset.tab === 'connections') loadConnections();
                if (tab.dataset.tab === 'requests') loadRequests();
                if (tab.dataset.tab === 'profile') loadProfile();
            }
        });
    });

    async function loadBookings() {
        const list = document.getElementById('bookings-list') || document.getElementById('upcoming-list');
        if (!list) return;
        list.innerHTML = 'Loading...';

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Fetch bookings (simplified query)
        const role = (document.title.includes('Tutor') || document.title.includes('Counselor')) ? 'provider_id' : 'student_id';

        const { data: bookings } = await supabase
            .from('bookings')
            .select(`*, profiles:${role === 'student_id' ? 'provider_id' : 'student_id'}(full_name)`)
            .eq(role, user.id)
            .order('scheduled_start', { ascending: true });

        if (!bookings || bookings.length === 0) {
            list.innerHTML = '<p>No bookings found.</p>';
            return;
        }

        list.innerHTML = bookings.map(b => `
            <div class="booking-item">
                <div>
                    <h4 style="font-weight: 600; margin-bottom: 4px;">${new Date(b.scheduled_start).toLocaleDateString()} @ ${new Date(b.scheduled_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</h4>
                    <p style="color: grey; font-size: 0.9rem;">With ${b.profiles.full_name}</p>
                </div>
                <div class="status-badge status-${b.status}">${b.status.replace('_', ' ')}</div>
            </div>
        `).join('');
    }

    async function loadConversations() {
        const container = document.getElementById('tab-messages');
        if (!container) return;

        const { data: { user } } = await supabase.auth.getUser();
        const { data: conversations } = await messaging.getConversations(user.id);

        if (!conversations || conversations.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #888;">
                    <p style="font-size: 1.1rem; margin-bottom: 12px;">No messages yet.</p>
                    <p style="font-size: 0.9rem;">Connect with tutors or students to start chatting!</p>
                </div>`;
            return;
        }

        container.innerHTML = `
            <div class="chat-layout">
                <div class="chat-sidebar">
                    <div style="padding: 16px; border-bottom: 1px solid #E5E5E5; font-weight: 600;">Messages</div>
                    <div class="chat-list">
                        ${conversations.map(c => `
                            <div class="chat-item" data-id="${c.id}">
                                <img src="${c.otherUser?.avatar_url || 'https://placehold.co/48'}" class="chat-item-avatar" alt="Avatar">
                                <div class="chat-item-info">
                                    <div class="chat-item-name">${c.otherUser?.full_name || 'Unknown'}</div>
                                    <div class="chat-item-preview">${c.lastMessage?.body || 'No messages yet'}</div>
                                </div>
                                <!-- Badge Notification Placeholder -->
                                <div id="badge-${c.id}" class="badge-dot" style="display: none;"></div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div id="chat-messages" class="chat-main">
                    <div class="chat-empty">Select a conversation to start chatting</div>
                </div>
            </div>
        `;

        // Click handler for conversations
        container.querySelectorAll('.chat-item').forEach(item => {
            item.addEventListener('click', () => {
                container.querySelectorAll('.chat-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                loadChat(item.dataset.id);
            });
        });
    }

    async function loadChat(convId) {
        const chatArea = document.getElementById('chat-messages');
        if (!chatArea) return;

        // Show loading state elegantly
        chatArea.innerHTML = '<div class="chat-empty">Loading messages...</div>';

        const { data: msgs } = await messaging.getMessages(convId);
        const { data: { user } } = await supabase.auth.getUser();

        // Mark as Read
        await messaging.markAsRead(convId, user.id);

        // Get other user details for header (Optimized: passed from list or fetch again? Fetching safe)
        // For speed, we could assume list data, but let's fetch quick or just show messages.
        // Actually, we need the header name. Let's fetch the conversation members again or store it.
        // Simplification: We'll render messages directly.

        chatArea.innerHTML = `
            <div class="chat-header">
                <span>Chat</span>  <!-- Ideally show name here -->
            </div>
            <div class="msg-list" id="msg-scroll-area">
                ${msgs.map(m => `
                    <div class="msg-bubble ${m.sender_id === user.id ? 'msg-sent' : 'msg-received'}">
                        ${m.body}
                        <div class="msg-time">${new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                `).join('')}
            </div>
            <div class="chat-input-area">
                <input type="text" id="msg-input" class="chat-input" placeholder="Type a message...">
                <button id="send-btn" class="btn btn-primary btn-sm" style="border-radius: 20px; padding: 10px 20px;">Send</button>
            </div>
        `;

        // Auto-scroll to bottom
        const scrollArea = document.getElementById('msg-scroll-area');
        scrollArea.scrollTop = scrollArea.scrollHeight;

        // Send Logic
        const handleSend = async () => {
            const input = document.getElementById('msg-input');
            const text = input.value;
            if (!text) return;

            // Optimistic UI update could go here
            await messaging.sendMessage(convId, user.id, text);
            input.value = '';
            loadChat(convId); // Reload
        };

        document.getElementById('send-btn').addEventListener('click', handleSend);
        document.getElementById('msg-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleSend();
        });
    }

    async function loadConnections() {
        const list = document.getElementById('connections-list');
        if (!list) return;

        const { data: { user } } = await supabase.auth.getUser();
        const { data: conns } = await connections.getConnections(user.id);

        if (!conns || conns.length === 0) {
            list.innerHTML = '<p>No confirmed connections.</p>';
        } else {
            list.innerHTML = conns.map(p => `<div class="profile-card-mini">${p.full_name}</div>`).join('');
        }
    }

    async function loadRequests() {
        const list = document.getElementById('requests-list');
        if (!list) return;

        const { data: { user } } = await supabase.auth.getUser();
        const { data: reqs } = await connections.getRequests(user.id);

        if (!reqs || reqs.length === 0) {
            list.innerHTML = '<p>No pending requests.</p>';
        } else {
            list.innerHTML = reqs.map(r => `
                <div style="display: flex; justify-content: space-between; padding: 12px; border: 1px solid #eee; margin-bottom: 8px; border-radius: 8px;">
                    <span>${r.profiles.full_name} wants to connect</span>
                    <div>
                        <button onclick="acceptReq('${r.id}')" class="btn btn-primary btn-sm">Accept</button>
                    </div>
                </div>
            `).join('');
        }

        window.acceptReq = async (id) => {
            await connections.acceptRequest(id);
            loadRequests();
        };
    }

    async function loadProfile() {
        const container = document.getElementById('tab-profile');
        if (!container) return;
        container.innerHTML = 'Loading profile...';

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (!profile) {
            container.innerHTML = '<p>Error loading profile.</p>';
            return;
        }

        container.innerHTML = `
            <form id="profile-form" style="max-width: 500px; display: flex; flex-direction: column; gap: 16px;">
                <div class="form-group">
                    <label style="display: block; margin-bottom: 8px; font-weight: 500;">Full Name</label>
                    <input type="text" id="prof-name" class="form-input" value="${profile.full_name || ''}" required>
                </div>
                <div class="form-group">
                    <label style="display: block; margin-bottom: 8px; font-weight: 500;">Role</label>
                    <input type="text" class="form-input" value="${profile.role}" disabled style="background: #f5f5f5; color: #888;">
                </div>
                <div class="form-group">
                    <label style="display: block; margin-bottom: 8px; font-weight: 500;">Bio</label>
                    <textarea id="prof-bio" class="form-textarea" rows="4">${profile.bio || ''}</textarea>
                </div>
                <div class="form-group">
                    <label style="display: block; margin-bottom: 8px; font-weight: 500;">Location</label>
                    <input type="text" id="prof-location" class="form-input" value="${profile.location || ''}">
                </div>
                 <div class="form-group">
                    <label style="display: block; margin-bottom: 8px; font-weight: 500;">Avatar URL</label>
                    <input type="text" id="prof-avatar" class="form-input" value="${profile.avatar_url || ''}">
                    <!-- Ideally file upload, but URL for now is easier -->
                </div>
                <button type="submit" class="btn btn-primary" id="btn-save-profile">Save Changes</button>
                <p id="profile-msg" style="margin-top: 8px; display: none;"></p>
            </form>
        `;

        const form = document.getElementById('profile-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btn-save-profile');
            const msg = document.getElementById('profile-msg');

            btn.textContent = 'Saving...';
            btn.disabled = true;
            msg.style.display = 'none';

            const updates = {
                full_name: document.getElementById('prof-name').value,
                bio: document.getElementById('prof-bio').value,
                location: document.getElementById('prof-location').value,
                avatar_url: document.getElementById('prof-avatar').value,
                updated_at: new Date().toISOString()
            };

            const { error } = await supabase
                .from('profiles')
                .update(updates)
                .eq('id', user.id);

            btn.disabled = false;
            btn.textContent = 'Save Changes';

            if (error) {
                console.error(error);
                msg.textContent = 'Error saving profile.';
                msg.style.color = 'red';
                msg.style.display = 'block';
            } else {
                msg.textContent = 'Profile updated successfully!';
                msg.style.color = 'green';
                msg.style.display = 'block';

                // Update header name specific to DOM
                const nameEl = document.getElementById('user-name');
                if (nameEl) nameEl.textContent = `Welcome back, ${updates.full_name.split(' ')[0]}`;
            }
        });
    }


    // URL Param Logic (Deep Linking)
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');
    const convIdParam = urlParams.get('convId');

    if (tabParam) {
        const tabBtn = document.querySelector(`.tab-btn[data-tab="${tabParam}"]`);
        if (tabBtn) {
            tabBtn.click();
            // If messages tab and convId present, load chat
            if (tabParam === 'messages' && convIdParam) {
                // Wait for loadConversations to likely finish or poll? 
                // Simple approach: call loadChat directly after a small delay or modifying loadConversations to handle default
                setTimeout(() => loadChat(convIdParam), 500);
            }
        }
    } else {
        // Default to first tab (often Bookings/Upcoming) if no param
        // Existing logic in HTML usually sets 'active' class, so do nothing or force click
    }

    // Populate User Info
    const user = await auth.getUser();
    if (user) {
        const { data: profile } = await auth.getProfile(user.id);
        if (profile) {
            const nameEl = document.getElementById('user-name');
            if (nameEl) nameEl.textContent = `Welcome back, ${profile.full_name.split(' ')[0]}`;
        }
    }
});
