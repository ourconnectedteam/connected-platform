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
                if (tab.dataset.tab === 'upcoming' || tab.dataset.tab === 'bookings') loadBookings();
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
        // Fetch bookings & reviews
        const role = (document.title.includes('Tutor') || document.title.includes('Counselor')) ? 'provider_id' : 'student_id';
        const isProvider = role === 'provider_id';

        let query = supabase
            .from('bookings')
            .select(`*, reviews(id, reviewer_id), profiles:${isProvider ? 'student_id' : 'provider_id'}(full_name)`)
            .eq(role, user.id)
            .order('scheduled_start', { ascending: true });

        // If Provider (Tutor/Counselor), ONLY show confirmed bookings in 'Upcoming' tab
        if (isProvider) {
            query = query.in('status', ['confirmed', 'completed']);
        }

        const { data: bookings } = await query;

        if (!bookings || bookings.length === 0) {
            list.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #888;">
                    <p style="font-size: 1.1rem; margin-bottom: 12px;">No sessions found.</p>
                </div>
            `;
            return;
        }

        list.innerHTML = bookings.map(b => {
            const otherUser = b.profiles;
            const targetId = isProvider ? b.student_id : b.provider_id;
            const isPast = new Date() > new Date(b.scheduled_end);

            // Check if WE have reviewed them
            const hasReviewed = b.reviews && b.reviews.some(r => r.reviewer_id === user.id);

            // Status Logic
            let statusBadge = '';
            let actionBtn = '';

            if (b.status === 'pending_approval') {
                statusBadge = '<div class="status-badge" style="background:#fff7ed; color:#c2410c; border: 1px solid #fed7aa; padding: 4px 10px; border-radius: 20px; font-size: 0.8rem; font-weight: 500;">Pending Approval</div>';
            } else if (b.status === 'approved_pending_payment') {
                statusBadge = '<div class="status-badge" style="background:#eff6ff; color:#1d4ed8; border: 1px solid #bfdbfe; padding: 4px 10px; border-radius: 20px; font-size: 0.8rem; font-weight: 500;">Awaiting Payment</div>';
                if (!isProvider) {
                    actionBtn = `<button class="btn btn-sm btn-primary" onclick="payNow('${b.id}')">Pay Now</button>`;
                }
            } else if (b.status === 'confirmed') {
                statusBadge = '<div class="status-badge" style="background:#ecfdf5; color:#047857; border: 1px solid #a7f3d0; padding: 4px 10px; border-radius: 20px; font-size: 0.8rem; font-weight: 500;">Confirmed</div>';

                // Review Logic
                if (isPast) {
                    if (!hasReviewed) {
                        actionBtn = `<button class="btn btn-sm btn-outline" onclick="openReviewModal('${b.id}', '${targetId}')">Rate User</button>`;
                    } else {
                        actionBtn = `<span style="font-size: 0.85rem; color: #059669; font-weight: 500;">Reviewed ✓</span>`;
                    }
                }

            } else if (b.status === 'completed') {
                statusBadge = '<div class="status-badge" style="background:#f3f4f6; color:#374151; border: 1px solid #e5e7eb; padding: 4px 10px; border-radius: 20px; font-size: 0.8rem; font-weight: 500;">Completed</div>';
            } else if (b.status === 'cancelled') {
                statusBadge = '<div class="status-badge" style="background:#fef2f2; color:#b91c1c; border: 1px solid #fecaca; padding: 4px 10px; border-radius: 20px; font-size: 0.8rem; font-weight: 500;">Cancelled</div>';
            } else if (b.status === 'rejected') {
                statusBadge = '<div class="status-badge" style="background:#fef2f2; color:#b91c1c; border: 1px solid #fecaca; padding: 4px 10px; border-radius: 20px; font-size: 0.8rem; font-weight: 500;">Request Rejected</div>';
            }

            // Buttons
            const showMessage = b.status !== 'cancelled' && b.status !== 'rejected';
            const showCancel = b.status !== 'cancelled' && b.status !== 'completed' && b.status !== 'rejected' && !isPast;
            const showTrash = b.status === 'cancelled' || b.status === 'rejected'; // User wants trash for cancelled

            return `
            <div class="booking-item">
                <div style="flex: 1;">
                    <div style="display:flex; justify-content:space-between; align-items:start;">
                        <h4 style="font-weight: 600; margin-bottom: 4px;">
                            ${new Date(b.scheduled_start).toLocaleDateString()} @ ${new Date(b.scheduled_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </h4>
                        ${statusBadge}
                    </div>
                    <p style="color: grey; font-size: 0.9rem; margin-bottom: 8px;">With ${otherUser ? otherUser.full_name : 'User'} · $${b.price_total || b.price}</p>
                    
                    <div class="action-btn-group" style="display: flex; gap: 8px; align-items: center;">
                        ${showMessage ? `<button class="btn btn-sm btn-outline" onclick="openMsg('${targetId}')">Message</button>` : ''}
                        ${actionBtn}
                        ${showCancel ? `<button class="btn btn-sm btn-danger" onclick="confirmCancel('${b.id}')">Cancel</button>` : ''}
                        ${showTrash ? `<button class="btn btn-sm" style="color: #666; border: 1px solid #ccc; padding: 6px 10px;" onclick="deleteBookingWrapper('${b.id}')" title="Clear Booking"><i class="fas fa-trash"></i> 🗑️</button>` : ''}
                    </div>
                </div>
            </div>
        `}).join('');

        // Helper for Review Modal
        window.openReviewModal = (bookingId, revieweeId) => {
            const modal = document.createElement('div');
            Object.assign(modal.style, {
                position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
                background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: '9999'
            });
            modal.innerHTML = `
                <div style="background: white; padding: 24px; border-radius: 12px; width: 400px; max-width: 90%;">
                    <h3 style="margin-top:0;">Rate Session</h3>
                    <div style="margin-bottom: 16px;">
                        <label style="display:block; margin-bottom:8px; font-weight:500;">Rating</label>
                        <select id="review-rating" class="form-select" style="width: 100%; padding: 8px;">
                            <option value="5">⭐⭐⭐⭐⭐ (Excellent)</option>
                            <option value="4">⭐⭐⭐⭐ (Good)</option>
                            <option value="3">⭐⭐⭐ (Average)</option>
                            <option value="2">⭐⭐ (Poor)</option>
                            <option value="1">⭐ (Terrible)</option>
                        </select>
                    </div>
                    <div style="margin-bottom: 16px;">
                        <label style="display:block; margin-bottom:8px; font-weight:500;">Comment</label>
                        <textarea id="review-comment" class="form-input" rows="3" style="width: 100%; padding: 8px;" placeholder="How was your session?"></textarea>
                    </div>
                    <div style="display: flex; gap: 12px; justify-content: flex-end;">
                        <button id="cancel-review" class="btn btn-outline">Cancel</button>
                        <button id="submit-review" class="btn btn-primary">Submit Review</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            document.getElementById('cancel-review').onclick = () => modal.remove();
            document.getElementById('submit-review').onclick = async () => {
                const btn = document.getElementById('submit-review');
                btn.textContent = 'Submitting...';
                btn.disabled = true;

                const rating = document.getElementById('review-rating').value;
                const comment = document.getElementById('review-comment').value;

                const { error } = await booking.submitReview({
                    booking_id: bookingId,
                    reviewer_id: user.id,
                    reviewee_id: revieweeId,
                    rating: parseInt(rating),
                    comment
                });

                if (error) {
                    alert('Error submitting review: ' + error.message);
                    btn.textContent = 'Submit Review';
                    btn.disabled = false;
                } else {
                    modal.remove();
                    loadBookings(); // Refresh UI
                }
            };
        };


        // Helper for Delete (Trash) - Custom Modal
        window.deleteBookingWrapper = (id) => {
            const modal = document.createElement('div');
            Object.assign(modal.style, {
                position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
                background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: '9999',
                backdropFilter: 'blur(4px)'
            });

            modal.innerHTML = `
                <div style="background: white; padding: 32px; border-radius: 16px; width: 400px; max-width: 90%; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04); text-align: center;">
                    <div style="background: #fee2e2; width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px auto;">
                        <i class="fas fa-trash-alt" style="color: #ef4444; font-size: 1.2rem;"></i>
                    </div>
                    <h3 style="margin-top: 0; margin-bottom: 8px; color: #111827; font-size: 1.25rem; font-weight: 600;">Delete Booking?</h3>
                    <p style="color: #6b7280; font-size: 0.95rem; margin-bottom: 24px; line-height: 1.5;">
                        Are you sure you want to remove this booking from your history? This action cannot be undone.
                    </p>
                    <div style="display: flex; gap: 12px; justify-content: center;">
                        <button id="cancel-delete" class="btn" style="background: white; border: 1px solid #d1d5db; color: #374151; padding: 10px 20px; border-radius: 8px; font-weight: 500; cursor: pointer;">Cancel</button>
                        <button id="confirm-delete" class="btn" style="background: #ef4444; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 500; cursor: pointer; box-shadow: 0 4px 6px -1px rgba(239, 68, 68, 0.4);">Delete</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            // Animate in
            const card = modal.firstElementChild;
            card.style.transform = 'scale(0.95)';
            card.style.opacity = '0';
            card.style.transition = 'all 0.2s ease-out';
            requestAnimationFrame(() => {
                card.style.transform = 'scale(1)';
                card.style.opacity = '1';
            });

            document.getElementById('cancel-delete').onclick = () => {
                card.style.transform = 'scale(0.95)';
                card.style.opacity = '0';
                setTimeout(() => modal.remove(), 200);
            };

            document.getElementById('confirm-delete').onclick = async () => {
                const btn = document.getElementById('confirm-delete');
                btn.textContent = 'Deleting...';
                btn.disabled = true;

                await booking.deleteBooking(id);

                card.style.transform = 'scale(0.95)';
                card.style.opacity = '0';
                setTimeout(() => {
                    modal.remove();
                    loadBookings();
                }, 200);
            };
        };

        window.payNow = async (id) => {
            // Show Mock Stripe Modal
            const modal = document.createElement('div');
            Object.assign(modal.style, {
                position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
                background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: '9999'
            });

            modal.innerHTML = `
                <div style="background: white; padding: 24px; border-radius: 12px; width: 400px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                    <h3 style="margin-top:0; margin-bottom: 24px; text-align: center; font-family: 'Inter', sans-serif;">Secure Checkout</h3>
                    
                    <!-- Stripe Demo Card Mock -->
                    <div style="background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                        <div style="display: flex; gap: 8px; margin-bottom: 12px; align-items: center;">
                            <div style="width: 32px; height: 20px; background: #e9ecef; border-radius: 4px; border: 1px solid #ced4da;"></div>
                            <span style="font-weight: 600; font-size: 0.9rem; color: #495057;">TEST CARD</span>
                        </div>
                        <div style="font-family: monospace; font-size: 1.1rem; letter-spacing: 2px; margin-bottom: 12px; color: #212529;">4242 4242 4242 4242</div>
                        <div style="display: flex; justify-content: space-between; font-size: 0.85rem; color: #6c757d;">
                            <span>Exp: 12/28</span>
                            <span>CVC: 123</span>
                        </div>
                    </div>
                    
                    <div style="color: #2e7d32; font-size: 0.8rem; display: flex; align-items: center; gap: 6px; margin-bottom: 24px; justify-content: center;">
                        <div style="width: 8px; height: 8px; background: #2e7d32; border-radius: 50%;"></div>
                        Secure Payment Simulator Active
                    </div>

                    <div style="display: flex; gap: 12px;">
                        <button id="cancel-pay" class="btn btn-outline" style="flex: 1;">Cancel</button>
                        <button id="confirm-pay" class="btn btn-primary" style="flex: 1;">Pay Now</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            document.getElementById('cancel-pay').onclick = () => modal.remove();

            document.getElementById('confirm-pay').onclick = async () => {
                const btn = document.getElementById('confirm-pay');
                btn.textContent = 'Processing...';
                btn.disabled = true;

                await new Promise(r => setTimeout(r, 1500)); // Simulate processing

                await booking.completePayment(id);
                modal.remove();

                // Show success toast or alert
                const toast = document.createElement('div');
                toast.textContent = 'Payment Successful! Session Confirmed.';
                Object.assign(toast.style, {
                    position: 'fixed', bottom: '24px', right: '24px', padding: '16px 24px',
                    background: '#2e7d32', color: 'white', borderRadius: '8px', zIndex: '10000',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                });
                document.body.appendChild(toast);
                setTimeout(() => toast.remove(), 3000);

                loadBookings();
            };
        };
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

        // Fetch bookings needing approval
        // Role check: Only providers (tutors/counselors) should see this generally, but code handles it via tab visibility.
        // Assuming user.id is provider_id
        const { data: reqs } = await supabase
            .from('bookings')
            .select('*, profiles:student_id(full_name)')
            .eq('provider_id', user.id)
            .in('status', ['pending_approval', 'approved_pending_payment']);

        if (!reqs || reqs.length === 0) {
            list.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #888;">
                    <p style="font-size: 1.1rem; margin-bottom: 12px;">No pending requests.</p>
                    <p style="font-size: 0.9rem;">New requests from students will appear here.</p>
                </div>
            `;
        } else {
            list.innerHTML = reqs.map(r => {
                const isPending = r.status === 'pending_approval';

                let actionsHTML = '';
                if (isPending) {
                    actionsHTML = `
                        <div style="display: flex; gap: 8px;">
                            <button onclick="rejectBooking('${r.id}')" class="btn btn-sm btn-outline">Reject</button>
                            <button onclick="approveBooking('${r.id}')" class="btn btn-primary btn-sm">Approve</button>
                        </div>
                    `;
                } else {
                    actionsHTML = `
                         <div class="status-badge" style="background:#eff6ff; color:#1d4ed8; border: 1px solid #bfdbfe; font-size: 0.8rem; padding: 6px 12px; border-radius: 20px; font-weight: 500;">Awaiting Payment</div>
                    `;
                }

                return `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px; border: 1px solid #eee; margin-bottom: 12px; border-radius: 8px; background: white;">
                    <div>
                        <div style="font-weight: 600; margin-bottom: 4px;">${r.profiles.full_name}</div>
                        <div style="font-size: 0.9rem; color: #666;">
                            Requested: ${new Date(r.scheduled_start).toLocaleDateString()} @ ${new Date(r.scheduled_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div style="font-size: 0.8rem; color: #888; margin-top: 4px;">Price: $${r.price_total || r.price}</div>
                    </div>
                    ${actionsHTML}
                </div>
            `}).join('');
        }

        window.approveBooking = async (id) => {
            const btn = document.querySelector(`button[onclick="approveBooking('${id}')"]`);
            if (btn) {
                btn.textContent = 'Approving...';
                btn.disabled = true;
            }
            await booking.approveBooking(id);
            loadRequests(); // Refresh list
        };

        window.rejectBooking = async (id) => {
            if (!confirm('Are you sure you want to reject this request?')) return;
            const btn = document.querySelector(`button[onclick="rejectBooking('${id}')"]`);
            if (btn) {
                btn.textContent = 'Rejecting...';
                btn.disabled = true;
            }
            await booking.rejectBooking(id);
            loadRequests(); // Refresh list
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



    // --- Calendar Availability Logic ---
    const calContainer = document.querySelector('.calendar-grid-container');
    if (calContainer) {
        let currentDate = new Date();
        // Snap to Monday of current week
        const day = currentDate.getDay();
        const diff = currentDate.getDate() - day + (day === 0 ? -6 : 1);
        currentDate.setDate(diff);
        currentDate.setHours(0, 0, 0, 0);

        let activeSlots = new Set(); // Stores "YYYY-MM-DDTHH:mm:00.000Z" strings
        let originalSlots = new Set(); // To detect changes
        let bookedSlots = new Set(); // To prevent modification

        const renderCalendar = async () => {
            const headerRow = document.getElementById('cal-header-row');
            const body = document.getElementById('cal-body');
            const rangeLabel = document.getElementById('cal-current-range');

            // Clear
            headerRow.innerHTML = '<div class="calendar-header-cell"></div>'; // Corner
            body.innerHTML = '';

            // 1. Render Header (Days)
            const weekDates = [];
            for (let i = 0; i < 7; i++) {
                const d = new Date(currentDate);
                d.setDate(d.getDate() + i);
                weekDates.push(d);

                const cell = document.createElement('div');
                cell.className = 'calendar-header-cell';
                cell.innerHTML = `
                    <div>${d.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                    <div style="font-size: 1.1rem; color: var(--text-primary);">${d.getDate()}</div>
                `;
                headerRow.appendChild(cell);
            }

            // Update Range Label
            const startStr = weekDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const endStr = weekDates[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            rangeLabel.textContent = `${startStr} - ${endStr}, ${weekDates[6].getFullYear()}`;

            // 2. Render Body (Time Rows)
            // 9:00 to 17:00 (16 slots of 30 mins)
            // Full 24 Hours
            const startHour = 0;
            const endHour = 24;

            for (let h = startHour; h < endHour; h++) {
                for (let m = 0; m < 60; m += 30) {
                    // Time Label
                    const timeCell = document.createElement('div');
                    timeCell.className = 'time-label-col time-label-cell';
                    timeCell.textContent = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                    timeCell.style.gridColumn = '1';
                    // Calculated row? simple grid flow works if we insert in order
                    body.appendChild(timeCell);

                    // Day Cells
                    for (let d = 0; d < 7; d++) {
                        const cellDate = new Date(weekDates[d]);
                        cellDate.setHours(h, m, 0, 0);
                        const iso = cellDate.toISOString();

                        const cell = document.createElement('div');
                        cell.className = 'slot-cell';
                        cell.dataset.iso = iso;

                        // Interaction
                        cell.addEventListener('click', () => toggleSlot(cell, iso));
                        body.appendChild(cell);
                    }
                }
            }

            // 3. Load Data
            await loadSlots();
        };

        const loadSlots = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            const start = new Date(currentDate);
            const end = new Date(currentDate);
            end.setDate(end.getDate() + 7);

            const { data, error } = await booking.getSlotsForRange(user.id, start.toISOString(), end.toISOString());

            if (data) {
                activeSlots.clear();
                originalSlots.clear();
                bookedSlots.clear();

                data.forEach(s => {
                    const normalizedTime = new Date(s.start_time).toISOString();
                    activeSlots.add(normalizedTime);
                    originalSlots.add(normalizedTime);
                    if (s.is_booked) bookedSlots.add(normalizedTime);
                });

                // Update UI
                updateUI();
            }
        };

        const updateUI = () => {
            document.querySelectorAll('.slot-cell').forEach(cell => {
                const iso = cell.dataset.iso;
                cell.className = 'slot-cell'; // Reset

                if (bookedSlots.has(iso)) {
                    cell.classList.add('booked');
                } else if (activeSlots.has(iso)) {
                    cell.classList.add('active');
                }
            });

            // Check dirty
            checkDirty();
        };

        const toggleSlot = (cell, iso) => {
            if (bookedSlots.has(iso)) return; // Locked

            if (activeSlots.has(iso)) {
                activeSlots.delete(iso);
                cell.classList.remove('active');
            } else {
                activeSlots.add(iso);
                cell.classList.add('active');
            }
            checkDirty();
        };

        const checkDirty = () => {
            const saveBar = document.getElementById('calendar-save-bar');

            // Diff
            let isDirty = false;
            if (activeSlots.size !== originalSlots.size) isDirty = true;
            else {
                for (let iso of activeSlots) if (!originalSlots.has(iso)) isDirty = true;
            }

            if (isDirty) saveBar.classList.add('visible');
            else saveBar.classList.remove('visible');
        };

        // Buttons
        document.getElementById('cal-prev-week').addEventListener('click', () => {
            currentDate.setDate(currentDate.getDate() - 7);
            renderCalendar();
        });

        document.getElementById('cal-next-week').addEventListener('click', () => {
            currentDate.setDate(currentDate.getDate() + 7);
            renderCalendar();
        });

        document.getElementById('cal-discard-btn').addEventListener('click', () => {
            activeSlots = new Set(originalSlots);
            updateUI();
        });

        document.getElementById('cal-save-btn').addEventListener('click', async () => {
            const btn = document.getElementById('cal-save-btn');
            btn.textContent = 'Saving...';
            btn.disabled = true;

            const { data: { user } } = await supabase.auth.getUser();

            // Build Payload
            // We need to send array of objects { start_time, end_time }
            const payload = Array.from(activeSlots).map(iso => {
                const start = new Date(iso);
                const end = new Date(start.getTime() + 30 * 60000);
                return { start_time: iso, end_time: end.toISOString() };
            });

            const startRange = new Date(currentDate);
            const endRange = new Date(currentDate);
            endRange.setDate(endRange.getDate() + 7);

            const { added, removed, error } = await booking.updateSlotsForRange(
                user.id,
                startRange.toISOString(),
                endRange.toISOString(),
                payload
            );

            btn.textContent = 'Save Changes';
            btn.disabled = false;

            if (error) {
                console.error(error);
                alert('Failed to save.');
            } else {
                // Success
                originalSlots = new Set(activeSlots);
                checkDirty();
                // alert(`Saved! Added ${added}, Removed ${removed} slots.`); // Optional feedback
            }
        });

        // Initial Render
        // Wait a bit to ensure tab is visible or just render (won't hurt)
        renderCalendar();
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
            if (activeTabBtn.dataset.tab === 'upcoming' || activeTabBtn.dataset.tab === 'bookings') loadBookings();
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

            // Dynamic Dashboard Title
            const roleTitleEl = document.getElementById('dashboard-role-title');
            if (roleTitleEl) {
                if (profile.role === 'counselor') {
                    roleTitleEl.textContent = 'Counselor Dashboard';
                    document.title = 'Counselor Dashboard | Connected';
                } else if (profile.role === 'tutor') {
                    roleTitleEl.textContent = 'Tutor Dashboard';
                    document.title = 'Tutor Dashboard | Connected';
                }
            }
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
