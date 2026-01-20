import { auth } from './lib/auth.js';
import { supabase } from './lib/supabase.js';
import { messaging } from './lib/messaging.js';
import { connections } from './lib/connections.js';
import { booking } from './lib/booking.js';

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

        const isStudent = role === 'student_id'; // If I am filtering by student_id, I am a provider? No.
        // Wait, logic check:
        // const role = (document.title.includes('Tutor') ... ) ? 'provider_id' : 'student_id';
        // If I am a Student, role is 'student_id'. available col is 'provider_id'.

        list.innerHTML = bookings.map(b => {
            const otherUser = b.profiles; // The profile of the OTHER person
            // If I am student, I want to message provider (b.provider_id)
            // If I am tutor, I want to message student (b.student_id)
            const targetId = isStudent ? b.provider_id : b.student_id;

            // Only show Cancel if status is not cancelled
            const showCancel = b.status !== 'cancelled' && b.status !== 'completed';

            return `
            <div class="booking-item">
                <div style="flex: 1;">
                    <div style="display:flex; justify-content:space-between; align-items:start;">
                        <h4 style="font-weight: 600; margin-bottom: 4px;">
                            ${new Date(b.scheduled_start).toLocaleDateString()} @ ${new Date(b.scheduled_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </h4>
                        <div class="status-badge status-${b.status}" id="status-${b.id}">${b.status.replace('_', ' ')}</div>
                    </div>
                    <p style="color: grey; font-size: 0.9rem; margin-bottom: 8px;">With ${otherUser ? otherUser.full_name : 'User'}</p>
                    
                    <div class="action-btn-group">
                        <button class="btn btn-sm btn-outline" onclick="openMsg('${targetId}')">Message</button>
                        ${showCancel ? `<button class="btn btn-sm btn-danger" onclick="confirmCancel('${b.id}')">Cancel Session</button>` : ''}
                    </div>
                </div>
            </div>
        `}).join('');
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
                    <div class="chat-sidebar-header">Messages</div>
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
                    <div class="chat-empty">Loading conversation...</div>
                </div>
            </div>
        `;

        // Click handler for conversations
        container.querySelectorAll('.chat-item').forEach(item => {
            item.addEventListener('click', () => {
                container.querySelectorAll('.chat-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                const matchedConv = conversations.find(c => c.id === item.dataset.id);
                loadChat(item.dataset.id, matchedConv?.otherUser);
            });
        });

        // Auto-select first conversation
        if (conversations.length > 0) {
            const firstItem = container.querySelector('.chat-item');
            if (firstItem) {
                firstItem.classList.add('active');
                const matchedConv = conversations.find(c => c.id === firstItem.dataset.id);
                loadChat(firstItem.dataset.id, matchedConv?.otherUser);
            }
        }
    }

    async function loadChat(convId, otherUser) {
        const chatArea = document.getElementById('chat-messages');
        if (!chatArea) return;

        // Try to find otherUser from DOM if not passed (e.g. click handler)
        if (!otherUser) {
            // We can't easily get it unless we stored it. 
            // But wait, the click handler has access to data attributes if we added them, 
            // or we can just fetch the conversation again or pass it from the click handler.
            // Better approach: Update the click handler closure.
        }

        // Show loading state elegantly
        chatArea.innerHTML = '<div class="chat-empty">Loading messages...</div>';

        const { data: msgs } = await messaging.getMessages(convId);
        const { data: { user } } = await supabase.auth.getUser();

        // Mark as Read
        await messaging.markAsRead(convId, user.id);

        chatArea.innerHTML = `
            <div class="chat-main-header">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <img src="${otherUser?.avatar_url || 'https://placehold.co/48'}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">
                    <div>
                        <div style="font-weight: 600; font-size: 1rem;">${otherUser?.full_name || 'Chat'}</div>
                        <div style="font-size: 0.8rem; color: #65676B;">${otherUser?.role ? otherUser.role.charAt(0).toUpperCase() + otherUser.role.slice(1) : ''}</div>
                    </div>
                </div>
                <!-- Optional: Info Icon or Call Button here -->
            </div>
            <div class="msg-list" id="msg-scroll-area">
                ${msgs.map(m => `
                    <div class="msg-bubble ${m.sender_id === user.id ? 'msg-sent' : 'msg-received'}">
                        ${m.body}
                        <!-- Hover time is handled by CSS now -->
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
            loadChat(convId, otherUser); // Reload with same user info
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

        // Fetch Role Specific Data
        let roleData = {};
        if (profile.role === 'student') {
            const { data } = await supabase.from('student_profiles').select('*').eq('user_id', user.id).single();
            roleData = data || {};
        } else if (profile.role === 'tutor') {
            const { data } = await supabase.from('tutor_profiles').select('*').eq('user_id', user.id).single();
            roleData = data || {};
        } else if (profile.role === 'counselor') {
            const { data } = await supabase.from('counselor_profiles').select('*').eq('user_id', user.id).single();
            roleData = data || {};
        }

        // Generate Role Specific Query Fields
        let extraFieldsHTML = '';
        if (profile.role === 'student') {
            extraFieldsHTML = `
                <div class="profile-section-title" style="margin-top: 24px;">Academic Profile</div>
                <div class="form-grid">
                    <div class="form-group">
                        <label>Grade Level</label>
                        <select id="prof-grade" class="form-select">
                            <option value="">Select Grade</option>
                            <option value="Pre-IB" ${roleData.grade_level === 'Pre-IB' ? 'selected' : ''}>Pre-IB</option>
                            <option value="IB1 (Year 12)" ${roleData.grade_level === 'IB1 (Year 12)' ? 'selected' : ''}>IB1 (Year 12)</option>
                            <option value="IB2 (Year 13)" ${roleData.grade_level === 'IB2 (Year 13)' ? 'selected' : ''}>IB2 (Year 13)</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Academic Interests (comma separated)</label>
                        <input type="text" id="prof-interests" class="form-input" value="${roleData.academic_interests?.join(', ') || ''}" placeholder="e.g. Math, Physics, Art">
                    </div>
                </div>
            `;
        } else if (profile.role === 'tutor' || profile.role === 'counselor') {
            const subjectLabel = profile.role === 'tutor' ? 'Subjects Taught' : 'Specializations';
            const subVal = profile.role === 'tutor' ? roleData.subjects : roleData.specialization;

            extraFieldsHTML = `
                <div class="profile-section-title" style="margin-top: 24px;">Professional Details</div>
                <div class="form-grid-3">
                    <div class="form-group">
                        <label>Hourly Rate ($)</label>
                        <input type="number" id="prof-rate" class="form-input" value="${roleData.hourly_rate || ''}" placeholder="0">
                    </div>
                    <div class="form-group">
                        <label>Years of Experience</label>
                        <input type="number" id="prof-experience" class="form-input" value="${roleData.years_experience || ''}" placeholder="0">
                    </div>
                    <div class="form-group">
                        <label>${subjectLabel}</label>
                        <input type="text" id="prof-subjects" class="form-input" value="${subVal?.join(', ') || ''}" placeholder="e.g. Math AA, Chemistry">
                    </div>
                </div>
            `;
        }

        container.innerHTML = `
            <div class="profile-card-container">
                <form id="profile-form">
                    <h3 style="font-size: 1.5rem; font-weight: 700; margin-bottom: 24px; color: var(--text-primary);">Edit Profile</h3>
                    
                    <div class="profile-section-title">Personal Information</div>
                    
                    <div class="avatar-upload-row" style="margin-bottom: 24px;">
                        <img src="${profile.avatar_url || 'https://placehold.co/100'}" class="avatar-preview" id="avatar-preview-img">
                        <div style="flex: 1;">
                            <label style="display: block; margin-bottom: 8px; font-weight: 500;">Avatar URL</label>
                            <input type="text" id="prof-avatar" class="form-input" value="${profile.avatar_url || ''}" placeholder="https://example.com/image.jpg">
                            <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 4px;">Paste an image address for now.</div>
                        </div>
                    </div>

                    <div class="form-grid">
                        <div class="form-group">
                            <label>Full Name</label>
                            <input type="text" id="prof-name" class="form-input" value="${profile.full_name || ''}" required>
                        </div>
                        <div class="form-group">
                            <label>Role</label>
                            <input type="text" class="form-input" value="${profile.role}" disabled style="background: #f5f5f5; color: #888; cursor: not-allowed;">
                        </div>
                    </div>
                    
                    <div class="form-group" style="margin-top: 16px;">
                        <label>Location</label>
                        <input type="text" id="prof-location" class="form-input" value="${profile.location || ''}" placeholder="City, Country">
                    </div>

                    <div class="form-group" style="margin-top: 16px;">
                        <label>Bio</label>
                        <textarea id="prof-bio" class="form-textarea" rows="3" placeholder="Tell us about yourself...">${profile.bio || ''}</textarea>
                    </div>

                    <div class="profile-section-title" style="margin-top: 24px;">Social Links</div>
                    <div class="form-grid-3">
                        <div class="form-group">
                            <label>Instagram URL</label>
                            <input type="text" id="prof-instagram" class="form-input" value="${profile.instagram || ''}" placeholder="instagram.com/user">
                        </div>
                        <div class="form-group">
                            <label>Facebook URL</label>
                            <input type="text" id="prof-facebook" class="form-input" value="${profile.facebook || ''}" placeholder="facebook.com/user">
                        </div>
                        <div class="form-group">
                            <label>LinkedIn URL</label>
                            <input type="text" id="prof-linkedin" class="form-input" value="${profile.linkedin || ''}" placeholder="linkedin.com/in/user">
                        </div>
                    </div>

                    ${extraFieldsHTML}

                    <div class="form-actions-right">
                        <p id="profile-msg" style="margin-right: 16px; align-self: center; display: none; font-weight: 500;"></p>
                        <button type="submit" class="btn btn-primary" id="btn-save-profile" style="min-width: 140px;">Save Changes</button>
                    </div>
                </form>
            </div>
        `;

        const form = document.getElementById('profile-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btn-save-profile');
            const msg = document.getElementById('profile-msg');

            btn.textContent = 'Saving...';
            btn.disabled = true;
            msg.style.display = 'none';

            // 1. Update Base Profile
            const baseUpdates = {
                full_name: document.getElementById('prof-name').value,
                bio: document.getElementById('prof-bio').value,
                location: document.getElementById('prof-location').value,
                avatar_url: document.getElementById('prof-avatar').value,
                instagram: document.getElementById('prof-instagram').value || null,
                facebook: document.getElementById('prof-facebook').value || null,
                linkedin: document.getElementById('prof-linkedin').value || null,
                updated_at: new Date().toISOString()
            };

            const { error: baseError } = await supabase
                .from('profiles')
                .update(baseUpdates)
                .eq('id', user.id);

            if (baseError) {
                console.error(baseError);
                showMsg('Error saving base profile.', 'red');
                btn.disabled = false;
                btn.textContent = 'Save Changes';
                return;
            }

            // 2. Update Role Specific Profile
            let roleError = null;
            if (profile.role === 'student') {
                const grade = document.getElementById('prof-grade').value;
                const interests = document.getElementById('prof-interests').value.split(',').map(s => s.trim()).filter(Boolean);

                const { error } = await supabase.from('student_profiles').upsert({
                    user_id: user.id,
                    grade_level: grade,
                    academic_interests: interests
                });
                roleError = error;
            } else if (profile.role === 'tutor' || profile.role === 'counselor') {
                const rate = document.getElementById('prof-rate').value;
                const exp = document.getElementById('prof-experience').value;
                const subs = document.getElementById('prof-subjects').value.split(',').map(s => s.trim()).filter(Boolean);

                const table = profile.role === 'tutor' ? 'tutor_profiles' : 'counselor_profiles';
                const payload = {
                    user_id: user.id,
                    hourly_rate: rate ? parseFloat(rate) : null,
                    years_experience: exp ? parseInt(exp) : 0
                };
                if (profile.role === 'tutor') payload.subjects = subs;
                else payload.specialization = subs;

                const { error } = await supabase.from(table).upsert(payload);
                roleError = error;
            }

            btn.disabled = false;
            btn.textContent = 'Save Changes';

            if (roleError) {
                console.error(roleError);
                showMsg('Profile saved, but specific details failed.', 'orange');
            } else {
                showMsg('Profile updated successfully!', 'green');
                // Update header name specific to DOM
                const nameEl = document.getElementById('user-name');
                if (nameEl) nameEl.textContent = `Welcome back, ${baseUpdates.full_name.split(' ')[0]}`;

                // Update avatar preview
                const previewImg = document.getElementById('avatar-preview-img');
                if (previewImg) previewImg.src = baseUpdates.avatar_url || 'https://placehold.co/100';
            }

            function showMsg(text, color) {
                msg.textContent = text;
                msg.style.color = color;
                msg.style.display = 'block';
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
        const activeTabBtn = document.querySelector('.tab-btn.active');
        if (activeTabBtn) {
            // Trigger load function for the default active tab
            if (activeTabBtn.dataset.tab === 'bookings') loadBookings();
            if (activeTabBtn.dataset.tab === 'messages') loadConversations();
            if (activeTabBtn.dataset.tab === 'connections') loadConnections();
            if (activeTabBtn.dataset.tab === 'requests') loadRequests();
            if (activeTabBtn.dataset.tab === 'profile') loadProfile();
        } else {
            // Fallback: Default to bookings if no active class found (though HTML usually has one)
            loadBookings();
        }
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

    // --- Global Actions (Message & Cancel) ---

    // 1. Message Provider/Student
    window.openMsg = async (targetUserId) => {
        // Switch to message tab
        const msgTab = document.querySelector('.tab-btn[data-tab="messages"]');
        if (msgTab) msgTab.click();

        // Start/Find conversation
        const currentUser = (await supabase.auth.getUser()).data.user;
        if (!currentUser) return;

        const { data: conv, error } = await messaging.startConversation(currentUser.id, targetUserId);

        if (conv) {
            // We need to wait for the UI to load (loadConversations is async and triggered by click)
            // Simple hack: poll for the item or reload
            setTimeout(() => {
                // Try to click the item in the list if it exists
                const item = document.querySelector(`.chat-item[data-id="${conv.id}"]`);
                if (item) item.click();
                else {
                    // If list didn't load it yet (new conv), force reload
                    loadConversations().then(() => {
                        const newItem = document.querySelector(`.chat-item[data-id="${conv.id}"]`);
                        if (newItem) newItem.click();
                    });
                }
            }, 500);
        }
    };

    // 2. Cancel Modal Logic
    // Inject Modal HTML if not exists
    if (!document.getElementById('cancel-modal')) {
        const modalHTML = `
            <div id="cancel-modal" class="modal-overlay">
                <div class="modal-card">
                    <div class="modal-icon">!</div>
                    <div class="modal-h3">Cancel Session?</div>
                    <p class="modal-p">Are you sure you want to cancel this booking? This action cannot be undone.</p>
                    <div class="modal-actions">
                        <button class="btn btn-secondary" onclick="closeModal()">No, Keep it</button>
                        <button class="btn btn-danger" id="confirm-cancel-btn">Yes, Cancel</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    let bookingToCancel = null;

    window.confirmCancel = (bookingId) => {
        bookingToCancel = bookingId;
        document.getElementById('cancel-modal').classList.add('active');
    };

    window.closeModal = () => {
        document.getElementById('cancel-modal').classList.remove('active');
        bookingToCancel = null;
    };

    document.getElementById('confirm-cancel-btn').addEventListener('click', async () => {
        if (!bookingToCancel) return;

        const btn = document.getElementById('confirm-cancel-btn');
        const originalText = btn.textContent;
        btn.textContent = 'Cancelling...';
        btn.disabled = true;

        const { error } = await booking.cancelBooking(bookingToCancel);

        btn.textContent = originalText;
        btn.disabled = false;
        closeModal();

        if (error) {
            alert('Failed to cancel booking');
        } else {
            // Update UI
            loadBookings(); // Refresh list
        }
    });

});
