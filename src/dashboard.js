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
                if (tab.dataset.tab === 'upcoming' || tab.dataset.tab === 'bookings')
                    loadBookings();
                if (tab.dataset.tab === 'messages') loadConversations();
                if (tab.dataset.tab === 'connections') loadConnections();
                if (tab.dataset.tab === 'requests') loadRequests();
                if (tab.dataset.tab === 'requests') loadRequests();
                if (tab.dataset.tab === 'saved') loadSavedUsers();
                if (tab.dataset.tab === 'profile') loadProfile();
            }
        });
    });

    async function loadBookings() {
        const list =
            document.getElementById('bookings-list') || document.getElementById('upcoming-list');
        if (!list) return;
        list.innerHTML = 'Loading...';

        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        // Fetch bookings (simplified query)
        // Fetch bookings & reviews
        const role =
            document.title.includes('Tutor') || document.title.includes('Counselor')
                ? 'provider_id'
                : 'student_id';
        const isProvider = role === 'provider_id';

        let query = supabase
            .from('bookings')
            .select(
                `*, reviews(id, reviewer_id), profiles:${isProvider ? 'student_id' : 'provider_id'}(full_name)`
            )
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

        list.innerHTML = bookings
            .map(b => {
                const otherUser = b.profiles;
                const targetId = isProvider ? b.student_id : b.provider_id;
                const isPast = new Date() > new Date(b.scheduled_end);

                // Check if WE have reviewed them
                const hasReviewed = b.reviews && b.reviews.some(r => r.reviewer_id === user.id);

                // Status Logic
                let statusBadge = '';
                let actionBtn = '';

                if (b.status === 'pending_approval') {
                    statusBadge =
                        '<div class="status-badge" style="background:#fff7ed; color:#c2410c; border: 1px solid #fed7aa; padding: 4px 10px; border-radius: 20px; font-size: 0.8rem; font-weight: 500;">Pending Approval</div>';
                } else if (b.status === 'approved_pending_payment') {
                    statusBadge =
                        '<div class="status-badge" style="background:#eff6ff; color:#1d4ed8; border: 1px solid #bfdbfe; padding: 4px 10px; border-radius: 20px; font-size: 0.8rem; font-weight: 500;">Awaiting Payment</div>';
                    if (!isProvider) {
                        actionBtn = `<button class="btn btn-sm btn-primary" onclick="payNow('${b.id}')">Pay Now</button>`;
                    }
                } else if (b.status === 'confirmed') {
                    statusBadge =
                        '<div class="status-badge" style="background:#ecfdf5; color:#047857; border: 1px solid #a7f3d0; padding: 4px 10px; border-radius: 20px; font-size: 0.8rem; font-weight: 500;">Confirmed</div>';

                    // Review Logic
                    if (isPast) {
                        if (!hasReviewed) {
                            actionBtn = `<button class="btn btn-sm btn-outline" onclick="openReviewModal('${b.id}', '${targetId}')">Rate User</button>`;
                        } else {
                            actionBtn = `<span style="font-size: 0.85rem; color: #059669; font-weight: 500;">Reviewed ✓</span>`;
                        }
                    }
                } else if (b.status === 'completed') {
                    statusBadge =
                        '<div class="status-badge" style="background:#f3f4f6; color:#374151; border: 1px solid #e5e7eb; padding: 4px 10px; border-radius: 20px; font-size: 0.8rem; font-weight: 500;">Completed</div>';
                } else if (b.status === 'cancelled') {
                    statusBadge =
                        '<div class="status-badge" style="background:#fef2f2; color:#b91c1c; border: 1px solid #fecaca; padding: 4px 10px; border-radius: 20px; font-size: 0.8rem; font-weight: 500;">Cancelled</div>';
                } else if (b.status === 'rejected') {
                    statusBadge =
                        '<div class="status-badge" style="background:#fef2f2; color:#b91c1c; border: 1px solid #fecaca; padding: 4px 10px; border-radius: 20px; font-size: 0.8rem; font-weight: 500;">Request Rejected</div>';
                }

                // Buttons
                const showMessage = b.status !== 'cancelled' && b.status !== 'rejected';
                const showCancel =
                    b.status !== 'cancelled' &&
                    b.status !== 'completed' &&
                    b.status !== 'rejected' &&
                    !isPast;
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
        `;
            })
            .join('');

        // Helper for Review Modal
        window.openReviewModal = (bookingId, revieweeId) => {
            const modal = document.createElement('div');
            Object.assign(modal.style, {
                position: 'fixed',
                top: '0',
                left: '0',
                width: '100%',
                height: '100%',
                background: 'rgba(0,0,0,0.5)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: '9999',
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
                    comment,
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
        window.deleteBookingWrapper = id => {
            const modal = document.createElement('div');
            Object.assign(modal.style, {
                position: 'fixed',
                top: '0',
                left: '0',
                width: '100%',
                height: '100%',
                background: 'rgba(0,0,0,0.5)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: '9999',
                backdropFilter: 'blur(4px)',
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

        window.payNow = async id => {
            // Show Mock Stripe Modal
            const modal = document.createElement('div');
            Object.assign(modal.style, {
                position: 'fixed',
                top: '0',
                left: '0',
                width: '100%',
                height: '100%',
                background: 'rgba(0,0,0,0.5)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: '9999',
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
                    position: 'fixed',
                    bottom: '24px',
                    right: '24px',
                    padding: '16px 24px',
                    background: '#2e7d32',
                    color: 'white',
                    borderRadius: '8px',
                    zIndex: '10000',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
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

        const {
            data: { user },
        } = await supabase.auth.getUser();
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
                        ${conversations
                .map(
                    c => `
                            <div class="chat-item" data-id="${c.id}">
                                <img src="${c.otherUser?.avatar_url || 'https://placehold.co/48'}" class="chat-item-avatar" alt="Avatar">
                                <div class="chat-item-info">
                                    <div class="chat-item-name">${c.otherUser?.full_name || 'Unknown'}</div>
                                    <div class="chat-item-preview">${c.lastMessage?.body || 'No messages yet'}</div>
                                </div>
                                <button class="chat-delete-btn" onclick="deleteChat(event, '${c.id}')" title="Delete chat">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <polyline points="3 6 5 6 21 6"></polyline>
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                        <line x1="10" y1="11" x2="10" y2="17"></line>
                                        <line x1="14" y1="11" x2="14" y2="17"></line>
                                    </svg>
                                </button>
                                <!-- Badge Notification Placeholder -->
                                <div id="badge-${c.id}" class="badge-dot" style="display: none;"></div>
                            </div>
                        `
                )
                .join('')}
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

        // Auto-select conversation (Deep link or First)
        if (conversations.length > 0) {
            let targetId = conversations[0].id;
            // Use convIdParam from closure if available and valid
            if (
                typeof convIdParam !== 'undefined' &&
                convIdParam &&
                conversations.some(c => c.id === convIdParam)
            ) {
                targetId = convIdParam;
            }

            const item = container.querySelector(`.chat-item[data-id="${targetId}"]`);
            if (item) {
                item.classList.add('active');
                const matchedConv = conversations.find(c => c.id === targetId);
                loadChat(targetId, matchedConv?.otherUser);
            }
        }
    }

    async function loadChat(convId, otherUser) {
        const chatArea = document.getElementById('chat-messages');
        if (!chatArea) return;

        // Try to find otherUser from DOM if not passed (e.g. click handler)
        // Fetch conversation details if otherUser is missing (e.g. deep link)
        if (!otherUser) {
            const {
                data: { user },
            } = await supabase.auth.getUser();
            const { data: convMembers } = await supabase
                .from('conversation_members')
                .select('profiles(full_name, avatar_url, role)')
                .eq('conversation_id', convId)
                .neq('user_id', user.id)
                .single();

            if (convMembers && convMembers.profiles) {
                otherUser = convMembers.profiles;
            }
        }

        // Show loading state elegantly
        chatArea.innerHTML = '<div class="chat-empty">Loading messages...</div>';

        const { data: msgs } = await messaging.getMessages(convId);
        const {
            data: { user },
        } = await supabase.auth.getUser();

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
                ${msgs
                .map(
                    m => `
                    <div class="msg-bubble ${m.sender_id === user.id ? 'msg-sent' : 'msg-received'}">
                        ${m.body}
                        <!-- Hover time is handled by CSS now -->
                        <div class="msg-time">${new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                `
                )
                .join('')}
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
        document.getElementById('msg-input').addEventListener('keypress', e => {
            if (e.key === 'Enter') handleSend();
        });
    }

    // Delete Chat Modal
    window.deleteChat = (event, conversationId) => {
        event.stopPropagation(); // Prevent chat from opening

        const modal = document.createElement('div');
        Object.assign(modal.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: '9999',
            backdropFilter: 'blur(4px)',
        });

        modal.innerHTML = `
            <div style="background: white; padding: 32px; border-radius: 16px; width: 400px; max-width: 90%; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1); text-align: center;">
                <div style="background: #fee2e2; width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px auto;">
                    <i class="fas fa-trash-alt" style="color: #ef4444; font-size: 1.2rem;"></i>
                </div>
                <h3 style="margin-top: 0; margin-bottom: 8px; color: #111827; font-size: 1.25rem; font-weight: 600;">Delete Conversation?</h3>
                <p style="color: #6b7280; font-size: 0.95rem; margin-bottom: 24px; line-height: 1.5;">
                    This will remove the chat from your messages. The conversation will still exist for the other person.
                </p>
                <div style="display: flex; gap: 12px; justify-content: center;">
                    <button id="cancel-delete-chat" class="btn" style="background: white; border: 1px solid #d1d5db; color: #374151; padding: 10px 20px; border-radius: 8px; font-weight: 500; cursor: pointer;">Cancel</button>
                    <button id="confirm-delete-chat" class="btn" style="background: #ef4444; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 500; cursor: pointer; box-shadow: 0 4px 6px -1px rgba(239, 68, 68, 0.4);">Delete</button>
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

        document.getElementById('cancel-delete-chat').onclick = () => {
            card.style.transform = 'scale(0.95)';
            card.style.opacity = '0';
            setTimeout(() => modal.remove(), 200);
        };

        document.getElementById('confirm-delete-chat').onclick = async () => {
            const btn = document.getElementById('confirm-delete-chat');
            btn.textContent = 'Deleting...';
            btn.disabled = true;

            const {
                data: { user },
            } = await supabase.auth.getUser();
            await messaging.deleteConversation(conversationId, user.id);

            card.style.transform = 'scale(0.95)';
            card.style.opacity = '0';
            setTimeout(() => {
                modal.remove();
                loadConversations(); // Refresh the conversation list
            }, 200);
        };
    };

    async function loadConnections() {
        const list = document.getElementById('connections-list');
        if (!list) return;
        list.innerHTML = '<p style="text-align:center; color:#666;">Loading connections...</p>';

        const {
            data: { user },
        } = await supabase.auth.getUser();

        // 1. Get Pending Incoming Requests
        const { data: requests } = await connections.getRequests(user.id);

        // 2. Get Confirmed Connections
        const { data: conns } = await connections.getConnections(user.id);

        let html = '';

        // Show Pending Requests Section
        if (requests && requests.length > 0) {
            html += `
                <div style="margin-bottom: 32px;">
                    <h3 style="font-size: 1.2rem; font-weight: 600; margin-bottom: 16px; color: #111;">Pending Requests</h3>
                    ${requests.map(req => {
                const requester = req.profiles;
                return `
                            <div style="display: flex; align-items: center; justify-content: space-between; padding: 16px; background: white; border: 1px solid #E5E7EB; border-radius: 12px; margin-bottom: 12px;">
                                <div style="display: flex; align-items: center; gap: 12px;">
                                    <img src="${requester.avatar_url || 'https://placehold.co/60'}" style="width: 60px; height: 60px; border-radius: 50%; object-fit: cover;">
                                    <div>
                                        <div style="font-weight: 600; font-size: 1rem; color: #111;">${requester.full_name}</div>
                                        <div style="font-size: 0.9rem; color: #6B7280;">Student</div>
                                    </div>
                                </div>
                                <div style="display: flex; gap: 8px;">
                                    <button class="btn btn-outline btn-sm" onclick="declineConnection('${req.id}')">Decline</button>
                                    <button class="btn btn-primary btn-sm" onclick="acceptConnection('${req.id}')">Accept</button>
                                </div>
                            </div>
                        `;
            }).join('')}
                </div>
            `;
        }

        // Show Confirmed Connections
        if (!conns || conns.length === 0) {
            if (!requests || requests.length === 0) {
                html = `
                    <div style="text-align: center; padding: 60px 20px; color: #888;">
                        <div style="font-size: 3rem; margin-bottom: 16px; opacity: 0.5;">🤝</div>
                        <p style="font-size: 1.1rem; margin-bottom: 12px; font-weight: 500;">No connections yet.</p>
                        <p style="font-size: 0.9rem;">Connect with other students to build your study network!</p>
                        <div style="margin-top: 24px;">
                            <a href="/buddies.html" class="btn btn-primary">Find Study Buddies</a>
                        </div>
                    </div>
                `;
            } else {
                html += '<p style="text-align: center; color: #666; padding: 20px;">No confirmed connections yet.</p>';
            }
        } else {
            // Fetch full profile details for connections
            const ids = conns.map(c => c.id);
            const { data: profiles } = await supabase
                .from('profiles')
                .select('*, student_profiles(*)')
                .in('id', ids);

            if (!profiles) {
                html += '<p>Error loading profiles.</p>';
                list.innerHTML = html;
                return;
            }

            // Reuse the same card layout as Saved Users
            html += profiles.map(p => {
                const details = p.student_profiles?.[0] || {};
                const subTextStr = details.ib_status || 'Student';
                const bioSnippet = p.bio || 'Connected student';

                return `
            <div class="saved-user-card" style="display: flex; gap: 24px; padding: 24px; border: 1px solid #E5E7EB; border-radius: 16px; background: white; margin-bottom: 20px; box-shadow: 0 2px 4px -1px rgba(0, 0, 0, 0.05); transition: transform 0.2s, box-shadow 0.2s;">
                <div style="flex-shrink: 0; position: relative;">
                    <img src="${p.avatar_url || 'https://placehold.co/150'}" style="width: 120px; height: 120px; border-radius: 12px; object-fit: cover; border: 1px solid #F3F4F6;">
                </div>

                <div style="flex: 1; display: flex; flex-direction: column; justify-content: flex-start; padding-top: 2px;">
                    <h3 style="margin: 0 0 6px 0; font-size: 1.25rem; font-weight: 700; color: #111; letter-spacing: -0.01em;">
                        ${p.full_name}
                        ${p.verified ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="#3B82F6" style="vertical-align: middle; margin-left: 6px;"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>' : ''}
                    </h3>
                    
                    <div style="color: #6B7280; font-size: 0.9rem; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        <span>${subTextStr}</span>
                        <span style="color: #E5E7EB;">|</span>
                        <span>🇺🇸 United States</span>
                    </div>

                    <div style="flex: 1;">
                        <p style="color: #4B5563; font-size: 0.95rem; line-height: 1.5; margin: 0; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                            ${bioSnippet}
                        </p>
                        <a href="/profile.html?id=${p.id}" style="color: #007AFF; font-weight: 600; text-decoration: none; font-size: 0.9rem; margin-top: 6px; display: inline-block;">View Profile</a>
                    </div>
                </div>

                <div style="width: 180px; padding-left: 24px; border-left: 1px solid #F3F4F6; display: flex; flex-direction: column; justify-content: center; align-items: center;">
                    <div style="display: flex; flex-direction: column; gap: 8px; width: 100%;">
                        <button class="btn btn-primary btn-sm" style="display: flex; align-items: center; justify-content: center; width: 100%; box-sizing: border-box;" onclick="window.location.href='/dashboard-student.html?tab=messages&create_conv=${p.id}'">
                            Message
                        </button>
                        
                        <a href="/profile.html?id=${p.id}" class="btn btn-outline btn-sm" style="display: flex; align-items: center; justify-content: center; width: 100%; box-sizing: border-box;">View Profile</a>
                    </div>
                </div>
            </div>`;
            }).join('');
        }

        list.innerHTML = html;

        // Add handlers for accept/decline
        window.acceptConnection = async (requestId) => {
            await connections.acceptRequest(requestId);
            loadConnections(); // Refresh
        };

        window.declineConnection = async (requestId) => {
            await connections.declineRequest(requestId);
            loadConnections(); // Refresh
        };
    }

    async function loadRequests() {
        const list = document.getElementById('requests-list');
        if (!list) return;

        const {
            data: { user },
        } = await supabase.auth.getUser();

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
            list.innerHTML = reqs
                .map(r => {
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
            `;
                })
                .join('');
        }

        window.approveBooking = async id => {
            const btn = document.querySelector(`button[onclick="approveBooking('${id}')"]`);
            if (btn) {
                btn.textContent = 'Approving...';
                btn.disabled = true;
            }
            await booking.approveBooking(id);
            loadRequests(); // Refresh list
        };

        window.rejectBooking = async id => {
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

    async function loadSavedUsers() {
        const list = document.getElementById('saved-list');
        if (!list) return;
        list.innerHTML = '<p style="text-align:center; color:#666;">Loading saved profiles...</p>';

        const {
            data: { user },
        } = await supabase.auth.getUser();

        // 1. Get saved IDs
        const { data: savedItems, error } = await supabase
            .from('saved_users')
            .select('saved_profile_id')
            .eq('user_id', user.id);

        if (!savedItems || savedItems.length === 0) {
            list.innerHTML = `
                <div style="text-align: center; padding: 60px 20px; color: #888;">
                    <div style="font-size: 3rem; margin-bottom: 16px; opacity: 0.5;">🔖</div>
                    <p style="font-size: 1.1rem; margin-bottom: 12px; font-weight: 500;">No saved profiles yet.</p>
                    <p style="font-size: 0.9rem;">Browse tutors or counselors and save them to find them here.</p>
                    <div style="margin-top: 24px; display: flex; gap: 12px; justify-content: center;">
                        <a href="/tutors.html" class="btn btn-primary">Find Tutors</a>
                        <a href="/counselors.html" class="btn btn-secondary">Find Counselors</a>
                    </div>
                </div>
            `;
            return;
        }

        // 2. Fetch Profiles with more details
        const ids = savedItems.map(i => i.saved_profile_id);
        const { data: profiles } = await supabase
            .from('profiles')
            .select(
                '*, tutor_profiles(subjects, hourly_rate, rating_avg, rating_count), counselor_profiles(specialties, hourly_rate, rating_avg, rating_count)'
            )
            .in('id', ids);

        if (!profiles) {
            list.innerHTML = '<p>Error loading profiles.</p>';
            return;
        }

        list.innerHTML = profiles
            .map(p => {
                // Determine Role Details
                let details = {};
                let isProvider = false;
                let subTextStr = '';

                if (p.role === 'tutor' && p.tutor_profiles && p.tutor_profiles.length > 0) {
                    details = p.tutor_profiles[0];
                    isProvider = true;
                    subTextStr = details.subjects ? details.subjects.join(', ') : 'Tutor';
                } else if (
                    p.role === 'counselor' &&
                    p.counselor_profiles &&
                    p.counselor_profiles.length > 0
                ) {
                    details = p.counselor_profiles[0];
                    isProvider = true;
                    subTextStr = details.specialties ? details.specialties.join(', ') : 'Counselor';
                } else {
                    subTextStr = p.role.charAt(0).toUpperCase() + p.role.slice(1);
                }

                const rating = details.rating_avg || 5.0;
                const reviewCount = details.rating_count || 0;
                const price = details.hourly_rate ? `$${details.hourly_rate}` : 'Contact';
                const bioSnippet = p.bio || `Experienced ${p.role} ready to help you succeed.`;

                return `
            <div class="saved-user-card" style="display: flex; gap: 24px; padding: 24px; border: 1px solid #E5E7EB; border-radius: 16px; background: white; margin-bottom: 20px; box-shadow: 0 2px 4px -1px rgba(0, 0, 0, 0.05); transition: transform 0.2s, box-shadow 0.2s;">
                <!-- Left: Avatar -->
                <div style="flex-shrink: 0; position: relative;">
                    <img src="${p.avatar_url || 'https://placehold.co/150'}" style="width: 120px; height: 120px; border-radius: 12px; object-fit: cover; border: 1px solid #F3F4F6;">
                </div>

                <!-- Middle: Info -->
                <div style="flex: 1; display: flex; flex-direction: column; justify-content: flex-start; padding-top: 2px;">
                    <h3 style="margin: 0 0 6px 0; font-size: 1.25rem; font-weight: 700; color: #111; letter-spacing: -0.01em;">
                        ${p.full_name}
                        ${p.verified ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="#3B82F6" style="vertical-align: middle; margin-left: 6px;"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>' : ''}
                    </h3>
                    
                    <div style="color: #6B7280; font-size: 0.9rem; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        <span>${subTextStr}</span>
                        <span style="color: #E5E7EB;">|</span>
                        <span>🇺🇸 United States</span>
                        <span style="color: #E5E7EB;">|</span>
                        <span style="display: flex; align-items: center; gap: 4px;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="#F59E0B" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                            <span style="color: #6B7280;">${rating} (${reviewCount} reviews)</span>
                        </span>
                        <span style="color: #E5E7EB;">|</span>
                        <span style="display: flex; align-items: center; gap: 4px;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                            15 students
                        </span>
                    </div>

                    <div style="flex: 1;">
                        <p style="color: #4B5563; font-size: 0.95rem; line-height: 1.5; margin: 0; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                            ${bioSnippet}
                        </p>
                        <a href="/profile.html?id=${p.id}" style="color: #007AFF; font-weight: 600; text-decoration: none; font-size: 0.9rem; margin-top: 6px; display: inline-block;">Read full bio</a>
                    </div>
                </div>

                <!-- Right: Actions & Price -->
                <div style="width: 180px; padding-left: 24px; border-left: 1px solid #F3F4F6; display: flex; flex-direction: column; justify-content: center; align-items: center;">
                    <div style="text-align: center; margin-bottom: 16px;">
                        <div style="font-size: 1.4rem; font-weight: 700; color: #111;">${price}</div>
                    </div>

                    <div style="display: flex; flex-direction: column; gap: 8px; width: 100%;">
                        <button class="btn btn-primary btn-sm" style="display: flex; align-items: center; justify-content: center; width: 100%; box-sizing: border-box;" onclick="window.location.href='/dashboard-student.html?tab=messages&create_conv=${p.id}'">
                            Message
                        </button>
                        
                        <a href="/profile.html?id=${p.id}" class="btn btn-outline btn-sm" style="display: flex; align-items: center; justify-content: center; width: 100%; box-sizing: border-box;">View Profile</a>
                    </div>
                </div>
            </div>`;
            })
            .join('');
    }

    async function loadProfile() {
        const container = document.getElementById('tab-profile');
        if (!container) return;
        container.innerHTML = 'Loading profile...';

        const {
            data: { user },
        } = await supabase.auth.getUser();
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
            const { data } = await supabase
                .from('student_profiles')
                .select('*')
                .eq('user_id', user.id)
                .single();
            roleData = data || {};
        } else if (profile.role === 'tutor') {
            const { data } = await supabase
                .from('tutor_profiles')
                .select('*')
                .eq('user_id', user.id)
                .single();
            roleData = data || {};
        } else if (profile.role === 'counselor') {
            const { data } = await supabase
                .from('counselor_profiles')
                .select('*')
                .eq('user_id', user.id)
                .single();
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
                    
                    <div class="avatar-upload-row" style="margin-bottom: 24px; align-items: start;">
                        <img src="${profile.avatar_url || 'https://placehold.co/100'}" class="avatar-preview" id="avatar-preview-img" style="width: 100px; height: 100px; object-fit: cover; border-radius: 50%;">
                        
                        <div style="flex: 1;">
                            <label style="display: block; margin-bottom: 8px; font-weight: 500;">Profile Picture</label>
                            
                            <!-- Hidden input to store URL for the form submission -->
                            <input type="hidden" id="prof-avatar" value="${profile.avatar_url || ''}">
                            
                            <!-- Drop Zone -->
                            <div id="avatar-drop-zone" style="border: 2px dashed #ccc; border-radius: 8px; padding: 24px; text-align: center; cursor: pointer; transition: all 0.2s; background: #fafafa;">
                                <div style="font-size: 2rem; color: #ccc; margin-bottom: 8px;">📷</div>
                                <p style="margin: 0; font-size: 0.9rem; color: #666;">Drag & Drop your image here</p>
                                <p style="margin: 4px 0 0; font-size: 0.8rem; color: #999;">or click to browse</p>
                                <input type="file" id="avatar-file-input" accept="image/*" hidden>
                            </div>
                            <div id="upload-status" style="font-size: 0.8rem; color: #666; margin-top: 8px; display: none;">Uploading...</div>
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

                    <div class="profile-section-title" style="margin-top: 24px;">Introduction Video</div>
                    <div class="avatar-upload-row" style="margin-bottom: 24px; align-items: start;">
                        <div style="flex: 1;">
                            <input type="hidden" id="prof-video" value="${profile.introduction_video_url || ''}">
                             <div id="video-drop-zone" style="border: 2px dashed #ccc; border-radius: 8px; padding: 24px; text-align: center; cursor: pointer; transition: all 0.2s; background: #fafafa;">
                                <div style="font-size: 2rem; color: #ccc; margin-bottom: 8px;">🎬</div>
                                <p style="margin: 0; font-size: 0.9rem; color: #666;">Drag & Drop video (MP4/WebM)</p>
                                <p style="margin: 4px 0 0; font-size: 0.8rem; color: #999;" id="video-filename">${profile.introduction_video_url ? 'Video Uploaded ✓' : 'or click to browse'}</p>
                                <input type="file" id="video-file-input" accept="video/*" hidden>
                            </div>
                            <div id="video-upload-status" style="font-size: 0.8rem; color: #666; margin-top: 8px; display: none;">Uploading...</div>
                        </div>
                    </div>

                     <div class="profile-section-title" style="margin-top: 24px;">Highlights</div>
                    <div class="form-group">
                         <label>About your Highlights</label>
                         <textarea id="prof-highlights" class="form-textarea" rows="4" placeholder="Share a brief phrase about your strengths or what makes you unique...">${profile.highlights &&
                Array.isArray(profile.highlights) &&
                profile.highlights.length > 0
                ? profile.highlights[0].desc ||
                profile.highlights[0].description ||
                ''
                : ''
            }</textarea>
                         <p style="font-size: 0.8rem; color: #666; margin-top: 4px;">This will be displayed on your profile.</p>
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

        // --- Avatar Upload Logic ---
        const dropZone = document.getElementById('avatar-drop-zone');
        const fileInput = document.getElementById('avatar-file-input');
        const statusDiv = document.getElementById('upload-status');
        const previewImg = document.getElementById('avatar-preview-img');
        const hiddenInput = document.getElementById('prof-avatar');

        // Styles
        const highlight = () => {
            dropZone.style.borderColor = '#007AFF';
            dropZone.style.background = '#eff6ff';
        };
        const unhighlight = () => {
            dropZone.style.borderColor = '#ccc';
            dropZone.style.background = '#fafafa';
        };

        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(
                eventName,
                e => {
                    e.preventDefault();
                    e.stopPropagation();
                    highlight();
                },
                false
            );
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(
                eventName,
                e => {
                    e.preventDefault();
                    e.stopPropagation();
                    unhighlight();
                },
                false
            );
        });

        // Handle Drop
        dropZone.addEventListener('drop', e => {
            const dt = e.dataTransfer;
            const files = dt.files;
            handleFiles(files);
        });

        // Handle Click
        dropZone.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', () => handleFiles(fileInput.files));

        const handleFiles = async files => {
            if (files.length === 0) return;
            let file = files[0];

            if (!file.type.startsWith('image/') && !file.name.toLowerCase().endsWith('.heic')) {
                alert('Please upload an image file.');
                return;
            }

            // HEIC Handling
            if (
                (file.type === 'image/heic' || file.name.toLowerCase().endsWith('.heic')) &&
                window.heic2any
            ) {
                const statusDiv = document.getElementById('upload-status');
                statusDiv.style.display = 'block';
                statusDiv.textContent = 'Converting HEIC image...';
                statusDiv.style.color = '#666';

                try {
                    const result = await heic2any({
                        blob: file,
                        toType: 'image/jpeg',
                        quality: 0.8,
                    });
                    const blob = Array.isArray(result) ? result[0] : result;
                    file = new File([blob], file.name.replace(/\.heic$/i, '.jpg'), {
                        type: 'image/jpeg',
                    });
                    statusDiv.style.display = 'none';
                } catch (e) {
                    console.error('HEIC conversion failed', e);
                    alert('Could not convert HEIC. Please convert to JPG/PNG manually.');
                    return;
                }
            }

            // --- Show Cropper Modal ---
            // 1. Create Modal if not exists
            if (!document.getElementById('cropper-modal')) {
                const modal = document.createElement('div');
                modal.id = 'cropper-modal';
                Object.assign(modal.style, {
                    position: 'fixed',
                    top: '0',
                    left: '0',
                    width: '100%',
                    height: '100%',
                    background: 'rgba(0,0,0,0.85)',
                    display: 'none',
                    justifyContent: 'center',
                    alignItems: 'center',
                    zIndex: '10000',
                });
                modal.innerHTML = `
                    <div style="background: white; padding: 24px; border-radius: 12px; width: 500px; max-width: 90%; max-height: 90vh; display: flex; flex-direction: column;">
                        <h3 style="margin-top: 0; margin-bottom: 16px;">Adjust Profile Picture</h3>
                        <div style="flex: 1; min-height: 300px; max-height: 500px; background: #f0f0f0; overflow: hidden; position: relative;">
                            <img id="cropper-img" style="max-width: 100%; display: block;">
                        </div>
                        <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 16px;">
                            <button id="cancel-crop" class="btn btn-outline">Cancel</button>
                            <button id="save-crop" class="btn btn-primary">Save Picture</button>
                        </div>
                    </div>
                `;
                document.body.appendChild(modal);

                // Cancel Handler
                document.getElementById('cancel-crop').onclick = () => {
                    document.getElementById('cropper-modal').style.display = 'none';
                    if (window.cropper) window.cropper.destroy();
                    fileInput.value = ''; // Reset input
                };
            }

            // 2. Open Modal with Image
            const modal = document.getElementById('cropper-modal');
            const img = document.getElementById('cropper-img');
            modal.style.display = 'flex';

            const reader = new FileReader();
            reader.onload = evt => {
                // Ensure image is loaded before creating cropper
                img.onload = () => {
                    if (window.cropper) window.cropper.destroy();
                    window.cropper = new Cropper(img, {
                        aspectRatio: 1,
                        viewMode: 1,
                        dragMode: 'move',
                        autoCropArea: 1,
                        restore: false,
                        guides: true,
                        center: true,
                        highlight: false,
                        cropBoxMovable: false,
                        cropBoxResizable: false,
                        toggleDragModeOnDblclick: false,
                        ready() {
                            // Extra check to ensure layout is updated
                            this.cropper.crop();
                        },
                    });
                };
                img.src = evt.target.result;
            };
            reader.readAsDataURL(file);

            // 3. Handle Save
            document.getElementById('save-crop').onclick = async () => {
                if (!window.cropper) return;

                const btn = document.getElementById('save-crop');
                const origText = btn.textContent;
                btn.textContent = 'Saving...';
                btn.disabled = true;

                window.cropper
                    .getCroppedCanvas({
                        width: 400,
                        height: 400,
                        imageSmoothingQuality: 'high',
                    })
                    .toBlob(async blob => {
                        try {
                            const fileExt = file.name.split('.').pop() || 'jpg';
                            const fileName = `${user.id}-${Date.now()}.${fileExt}`;

                            // Upload
                            const { error: uploadError } = await supabase.storage
                                .from('avatars')
                                .upload(fileName, blob, { contentType: file.type, upsert: true });

                            if (uploadError) throw uploadError;

                            const {
                                data: { publicUrl },
                            } = supabase.storage.from('avatars').getPublicUrl(fileName);

                            // Update UI & Database
                            previewImg.src = publicUrl;
                            hiddenInput.value = publicUrl;

                            // Update Profile in DB immediately
                            await supabase
                                .from('profiles')
                                .update({ avatar_url: publicUrl })
                                .eq('id', user.id);

                            statusDiv.style.display = 'block';
                            statusDiv.textContent = 'Upload complete!';
                            statusDiv.style.color = '#10B981';

                            modal.style.display = 'none';
                            if (window.cropper) window.cropper.destroy();

                            // Show Success Toast
                            const toast = document.createElement('div');
                            toast.textContent = 'Profile picture updated successfully!';
                            Object.assign(toast.style, {
                                position: 'fixed',
                                bottom: '24px',
                                right: '24px',
                                padding: '12px 24px',
                                background: '#10B981',
                                color: 'white',
                                borderRadius: '8px',
                                zIndex: '10001',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                            });
                            document.body.appendChild(toast);
                            setTimeout(() => toast.remove(), 3000);
                        } catch (err) {
                            console.error(err);
                            alert('Error uploading image: ' + err.message);
                            statusDiv.textContent = 'Upload failed.';
                            statusDiv.style.color = 'red';
                        } finally {
                            btn.textContent = origText;
                            btn.disabled = false;
                        }
                    }, file.type);
            };
        };

        // --- Video Upload Logic ---
        const vDropZone = document.getElementById('video-drop-zone');
        const vFileInput = document.getElementById('video-file-input');
        const vStatusDiv = document.getElementById('video-upload-status');
        const vFileName = document.getElementById('video-filename');
        const vHiddenInput = document.getElementById('prof-video');

        vDropZone.addEventListener('click', () => vFileInput.click());
        vFileInput.addEventListener('change', async () => {
            if (vFileInput.files.length === 0) return;
            const file = vFileInput.files[0];

            vStatusDiv.style.display = 'block';
            vStatusDiv.textContent = 'Uploading Video...';
            vStatusDiv.style.color = '#666';

            try {
                const fileExt = file.name.split('.').pop();
                const fileName = `video-${user.id}-${Date.now()}.${fileExt}`;

                // Using 'videos' bucket
                const { error: uploadError } = await supabase.storage
                    .from('videos')
                    .upload(fileName, file);

                if (uploadError) throw uploadError;

                const {
                    data: { publicUrl },
                } = supabase.storage.from('videos').getPublicUrl(fileName);

                vStatusDiv.textContent = 'Video Upload complete!';
                vStatusDiv.style.color = 'green';
                vFileName.textContent = file.name;
                vHiddenInput.value = publicUrl;
            } catch (error) {
                console.error('Video Upload Error:', error);
                vStatusDiv.textContent = 'Upload failed: ' + error.message;
                vStatusDiv.style.color = 'red';
            }
        });

        const form = document.getElementById('profile-form');
        form.addEventListener('submit', async e => {
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
                updated_at: new Date().toISOString(),
                introduction_video_url: document.getElementById('prof-video').value || null,
                highlights: [
                    {
                        title: 'Highlights',
                        desc: document.getElementById('prof-highlights').value || '',
                    },
                ],
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
                const interests = document
                    .getElementById('prof-interests')
                    .value.split(',')
                    .map(s => s.trim())
                    .filter(Boolean);

                const { error } = await supabase.from('student_profiles').upsert({
                    user_id: user.id,
                    grade_level: grade,
                    academic_interests: interests,
                });
                roleError = error;
            } else if (profile.role === 'tutor' || profile.role === 'counselor') {
                const rate = document.getElementById('prof-rate').value;
                const exp = document.getElementById('prof-experience').value;
                const subs = document
                    .getElementById('prof-subjects')
                    .value.split(',')
                    .map(s => s.trim())
                    .filter(Boolean);

                const table = profile.role === 'tutor' ? 'tutor_profiles' : 'counselor_profiles';
                const payload = {
                    user_id: user.id,
                    hourly_rate: rate ? parseFloat(rate) : null,
                    years_experience: exp ? parseInt(exp) : 0,
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
                if (nameEl)
                    nameEl.textContent = `Welcome back, ${baseUpdates.full_name.split(' ')[0]} `;

                // Update avatar preview
                const previewImg = document.getElementById('avatar-preview-img');
                if (previewImg)
                    previewImg.src = baseUpdates.avatar_url || 'https://placehold.co/100';
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
            < div > ${d.toLocaleDateString('en-US', { weekday: 'short' })}</div >
                <div style="font-size: 1.1rem; color: var(--text-primary);">${d.getDate()}</div>
        `;
                headerRow.appendChild(cell);
            }

            // Update Range Label
            const startStr = weekDates[0].toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
            });
            const endStr = weekDates[6].toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
            });
            rangeLabel.textContent = `${startStr} - ${endStr}, ${weekDates[6].getFullYear()} `;

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
                    timeCell.textContent = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} `;
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
            const {
                data: { user },
            } = await supabase.auth.getUser();
            const start = new Date(currentDate);
            const end = new Date(currentDate);
            end.setDate(end.getDate() + 7);

            const { data, error } = await booking.getSlotsForRange(
                user.id,
                start.toISOString(),
                end.toISOString()
            );

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

            const {
                data: { user },
            } = await supabase.auth.getUser();

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
                // alert(`Saved! Added ${ added }, Removed ${ removed } slots.`); // Optional feedback
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
            // If messages tab and convId present, loadConversations (called by click) will handle opening it via convIdParam
        }
    } else {
        // Default to first tab (often Bookings/Upcoming) if no param
        const activeTabBtn = document.querySelector('.tab-btn.active');
        if (activeTabBtn) {
            // Trigger load function for the default active tab
            if (activeTabBtn.dataset.tab === 'upcoming' || activeTabBtn.dataset.tab === 'bookings')
                loadBookings();
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
            if (nameEl) nameEl.textContent = `Welcome back, ${profile.full_name.split(' ')[0]} `;

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
    window.openMsg = async targetUserId => {
        // Switch to message tab
        const msgTab = document.querySelector('.tab-btn[data-tab="messages"]');
        if (msgTab) msgTab.click();

        // Start/Find conversation
        const currentUser = (await supabase.auth.getUser()).data.user;
        if (!currentUser) return;

        const { data: conv, error } = await messaging.startConversation(
            currentUser.id,
            targetUserId
        );

        if (conv) {
            // We need to wait for the UI to load (loadConversations is async and triggered by click)
            // Simple hack: poll for the item or reload
            setTimeout(() => {
                // Try to click the item in the list if it exists
                const item = document.querySelector(`.chat - item[data - id="${conv.id}"]`);
                if (item) item.click();
                else {
                    // If list didn't load it yet (new conv), force reload
                    loadConversations().then(() => {
                        const newItem = document.querySelector(
                            `.chat - item[data - id="${conv.id}"]`
                        );
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

    window.confirmCancel = bookingId => {
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
