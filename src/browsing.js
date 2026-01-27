import { supabase } from './lib/supabase.js';
import { logger } from './lib/logger.js';
import { connections } from './lib/connections.js';
import { getProfileCounts } from './lib/profileCounts.js';

export async function renderBrowsingPage(type) {
    const grid = document.querySelector('.profiles-grid');
    if (!grid) return;

    // Fetch and display profile count
    updateProfileCount(type);

    // Show loading state
    grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">Loading profiles...</p>';

    // 1. Collect Filters
    const subjects = Array.from(document.querySelectorAll('input[name="subject"]:checked')).map(
        cb => cb.value
    );
    const prices = Array.from(document.querySelectorAll('input[name="price"]:checked')).map(
        cb => cb.value
    ); // low, mid, high

    let query;
    if (type === 'tutor') {
        query = supabase.from('tutor_profiles').select('*, profiles(*)');

        // Subject Filter (Filter by ANY match - OR logic? No, usually AND or Contains)
        // PostgreSQL array contains: .contains('subjects', ['Math'])
        // Supabase .contains works. If multiple selected, we probably want ANY match (OR).
        // .overlaps is better for "Any of these subjects".
        if (subjects.length > 0) {
            query = query.overlaps('subjects', subjects);
        }

        // Price Filter
        if (prices.length > 0) {
            // Complex OR logic for ranges is hard in simple Chaining.
            // We can check range.
            // If multiple ranges selected, we need (range1 OR range2).
            const orConditions = [];
            if (prices.includes('low')) orConditions.push('hourly_rate.lt.40');
            if (prices.includes('mid'))
                orConditions.push('and(hourly_rate.gte.40,hourly_rate.lte.60)');
            if (prices.includes('high')) orConditions.push('hourly_rate.gt.60');

            if (orConditions.length > 0) {
                query = query.or(orConditions.join(','));
            }
        }
    } else if (type === 'counselor') {
        query = supabase.from('counselor_profiles').select('*, profiles(*)');
        // Add counselor filters here if needed
    } else if (type === 'buddy') {
        query = supabase.from('student_profiles').select('*, profiles(*)');
    }

    const { data: profiles, error } = await query;
    logger.debug('Browsing Query Result:', { type, profiles, error, subjects, prices });

    if (error) {
        console.error('Error fetching profiles:', error);
        grid.innerHTML =
            '<p style="grid-column: 1/-1; text-align: center; color: red;">Failed to load profiles. Please try again later.</p>';
        return;
    }

    if (!profiles || profiles.length === 0) {
        grid.innerHTML =
            '<p style="grid-column: 1/-1; text-align: center; color: var(--text-secondary);">No profiles found matching your criteria.</p>';
        return;
    }

    grid.innerHTML = ''; // Clear loading

    let validCards = 0;
    profiles.forEach(item => {
        try {
            const user = item.profiles; // joined profile data
            if (!user) {
                console.warn('Skipping item with missing profile data:', item);
                return;
            }
            const card = createCard(type, item, user);
            grid.appendChild(card);
            validCards++;
        } catch (err) {
            console.error('Error creating card for item:', item, err);
        }
    });

    if (validCards === 0) {
        grid.innerHTML =
            '<p style="grid-column: 1/-1; text-align: center; color: var(--text-secondary);">No valid profiles found.</p>';
    }

    // Attach Listeners ONLY ONCE (Check if attached)
    if (!window.listenersAttached) {
        document.querySelectorAll('input[type="checkbox"]').forEach(input => {
            input.addEventListener('change', () => renderBrowsingPage(type));
        });

        const clearBtn = document.querySelector('.filter-header .btn-text');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                document
                    .querySelectorAll('input[type="checkbox"]')
                    .forEach(i => (i.checked = false));
                renderBrowsingPage(type);
            });
        }
        window.listenersAttached = true;
    }
}

function createCard(type, details, user) {
    const card = document.createElement('div');
    card.className = 'profile-card fade-in-up visible'; // Force visible immediately

    // Default Images based on role if avatar is missing
    let img = user.avatar_url;
    if (!img) {
        if (type === 'tutor')
            img = '/assets/tutor.png'; // Fallback
        else if (type === 'counselor') img = '/assets/counselor.png';
        else img = '/assets/student.png';
    }

    // Role Specific Badge/Tags
    let tagsHtml = '';
    let subtext = '';
    let actionBtn = '';
    let priceInfo = '';

    if (type === 'tutor') {
        details.subjects?.forEach(sub => (tagsHtml += `<span class="tag">${sub}</span>`));
        subtext = 'Tutor';
        priceInfo = `<div class="price">$${details.hourly_rate || '?'}<span>/hr</span></div>`;
        actionBtn = `
            <a href="/booking.html?providerId=${user.id}&name=${encodeURIComponent(user.full_name)}&role=Tutor&price=${details.hourly_rate}&img=${encodeURIComponent(img)}" class="btn btn-primary btn-sm btn-wide">Book</a>
            <button class="btn btn-secondary btn-sm btn-wide" onclick="startChat('${user.id}')">Message</button>
            <a href="/profile.html?id=${user.id}" class="btn btn-outline btn-sm btn-full">View Profile</a>`;
    } else if (type === 'counselor') {
        details.specialties?.forEach(spec => (tagsHtml += `<span class="tag">${spec}</span>`));
        subtext = 'Counselor';
        priceInfo = `<div class="price">$${details.hourly_rate || '?'}<span>/hr</span></div>`;
        actionBtn = `
            <a href="/booking.html?providerId=${user.id}&name=${encodeURIComponent(user.full_name)}&role=Counselor&price=${details.hourly_rate}&img=${encodeURIComponent(img)}" class="btn btn-primary btn-sm btn-wide">Book</a>
            <button class="btn btn-secondary btn-sm btn-wide" onclick="startChat('${user.id}')">Message</button>
            <a href="/profile.html?id=${user.id}" class="btn btn-outline btn-sm btn-full">View Profile</a>`;
    } else {
        // Student
        details.ib_subjects?.forEach(sub => (tagsHtml += `<span class="tag">${sub}</span>`));
        subtext = details.ib_status || 'Student';
        priceInfo = ''; // No price for students
        actionBtn = `
            <button class="btn btn-primary btn-sm btn-wide" id="conn-btn-${user.id}" onclick="handleConnectionAction('${user.id}')" disabled>Loading...</button>
            <button class="btn btn-secondary btn-sm btn-wide" onclick="startChat('${user.id}')">Message</button>
            <a href="/profile.html?id=${user.id}" class="btn btn-outline btn-sm btn-full">View Profile</a>`;
    }

    const verifiedBadge = user.verified
        ? `
        <div class="verified-badge">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M10 4L4.5 9.5L2 7" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Verified
        </div>`
        : '';

    card.innerHTML = `
        <div class="card-image-wrapper">
            <img src="${img}" alt="${user.full_name}">
            ${verifiedBadge}
        </div>
        <div class="card-content">
            <div class="card-main-info">
                <div class="card-header-row">
                    <h3>${user.full_name}</h3>
                    ${priceInfo}
                </div>
                <p class="role-text">${subtext}</p>
                <div class="rating">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="#FFB02E"><path d="M8 0L9.79611 5.52786H15.6085L10.9062 8.94427L12.7023 14.4721L8 11.0557L3.29772 14.4721L5.09383 8.94427L0.391548 5.52786H6.20389L8 0Z"/></svg>
                    <span>${details.rating_avg || '5.0'}</span>
                    <span class="rating-count">(${details.rating_count || 0} reviews)</span>
                </div>
                <div class="connections-badge" id="conn-${user.id}">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                    <span>... Connections</span>
                </div>
            </div>
            
            <div class="tags-row">
                ${tagsHtml}
            </div>

            <div class="card-actions">
                ${actionBtn}
            </div>
        </div>
    `;

    // Fetch Connection Count Async
    fetchConnectionCount(user.id).then(count => {
        const el = card.querySelector(`#conn-${user.id} span`);
        if (el) el.textContent = `${count > 500 ? '500+' : count} Connections`;
    });

    // For student cards, fetch connection status
    if (user.role === 'student') {
        updateConnectionButton(user.id);
    }

    return card;
}

// Helper to fetch connection count
async function fetchConnectionCount(userId) {
    try {
        const { count, error } = await supabase
            .from('connection_requests')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'accepted')
            .or(`requester_id.eq.${userId},receiver_id.eq.${userId}`);

        if (error) {
            console.error('Error fetching connections for', userId, error);
            return 0;
        }
        return count || 0;
    } catch (e) {
        return 0;
    }
}

// Toast Notification Helper
function showToast(title, message, type = 'success') {
    // 1. Create Container if not exists
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    // 2. Create Toast Element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    // Icon based on type
    let icon = '✓';
    if (type === 'error') icon = '✕';
    if (type === 'info') icon = 'ℹ';

    toast.innerHTML = `
        <div class="toast-icon">${icon}</div>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
    `;

    // 3. Add to DOM
    container.appendChild(toast);

    // 4. Animate In
    // Double requestAnimationFrame to ensure transition works after append
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });
    });

    // 5. Auto Dismiss
    setTimeout(() => {
        toast.classList.add('toast-hiding');
        toast.addEventListener('transitionend', () => {
            toast.remove();
            if (container.children.length === 0) {
                container.remove();
            }
        });
    }, 3000);
}

// Expose connect function globally for now
// START CONVERSATION / CONNECTION REQUEST
import { messaging } from './lib/messaging.js';

window.sendConnectionRequest = async receiverId => {
    // Check auth
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
        showToast('Authentication Required', 'Please log in to connect.', 'error');
        return;
    }

    // For Buddies, "Connect" -> Send Request (Existing logic) OR Start Chat (New Logic)?
    // User requested "messaging between students".
    // Let's make "Connect" send a request, and once accepted, they can chat (dashboard).
    // BUT for simplicity and "instant chat" requests often seen in MVPs:
    // Let's also allow a direct "Message" button if the user prefers.

    // For now, let's keep Connect as Request, but verify it works.
    const { error } = await supabase.from('connection_requests').insert({
        requester_id: user.id,
        receiver_id: receiverId,
    });

    if (error) {
        if (error.code === '23505') {
            showToast('Request Pending', 'You already sent a connection request.', 'info');
        } else {
            showToast('Error', error.message, 'error');
        }
    } else {
        showToast('Invite Sent', 'They will get a notification shortly.', 'success');
    }
};

window.startChat = async receiverId => {
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
        window.location.href = '/src/auth.html#login';
        return;
    }

    const { data, error } = await messaging.startConversation(user.id, receiverId);
    if (error) {
        console.error(error);
        showToast('Error', 'Could not start chat conversation.', 'error');
    } else {
        // Redirect to dashboard messages tab
        // Determine dashboard type based on MY role
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();
        let dashPath = '/dashboard-student.html'; // default
        if (profile.role === 'tutor') dashPath = '/dashboard-tutor.html';
        if (profile.role === 'counselor') dashPath = '/counselor-dashboard.html';

        window.location.href = `${dashPath}?tab=messages&convId=${data.id}`;
    }
};

// Update connection button based on current status
async function updateConnectionButton(targetUserId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const btn = document.getElementById(`conn-btn-${targetUserId}`);
    if (!btn) return;

    const status = await connections.getConnectionStatus(user.id, targetUserId);

    if (status === 'connected') {
        btn.textContent = 'Connected';
        btn.disabled = true;
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-outline');
    } else if (status === 'outgoing_pending') {
        btn.textContent = 'Requested';
        btn.disabled = true;
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-outline');
    } else if (status?.status === 'incoming_pending') {
        btn.textContent = 'Accept';
        btn.disabled = false;
        btn.dataset.requestId = status.requestId;
    } else {
        btn.textContent = 'Connect';
        btn.disabled = false;
    }
}

// Handle connection button click
window.handleConnectionAction = async (targetUserId) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        showToast('Authentication Required', 'Please log in to connect.', 'error');
        return;
    }

    const btn = document.getElementById(`conn-btn-${targetUserId}`);
    if (!btn) return;

    const status = await connections.getConnectionStatus(user.id, targetUserId);

    if (status?.status === 'incoming_pending') {
        // Accept request
        await connections.acceptRequest(status.requestId);
        showToast('Connection Accepted', 'You are now connected!', 'success');
        updateConnectionButton(targetUserId);
    } else if (status === 'none') {
        // Send new request
        const { error } = await supabase.from('connection_requests').insert({
            requester_id: user.id,
            receiver_id: targetUserId,
        });

        if (error) {
            if (error.code === '23505') {
                showToast('Request Pending', 'You already sent a connection request.', 'info');
            } else {
                showToast('Error', error.message, 'error');
            }
        } else {
            showToast('Invite Sent', 'They will get a notification shortly.', 'success');
            updateConnectionButton(targetUserId);
        }
    }
};

/**
 * Fetch and display profile count for the current browse page
 */
async function updateProfileCount(type) {
    try {
        const counts = await getProfileCounts();

        let countEl, count, label;

        if (type === 'tutor') {
            countEl = document.getElementById('tutor-count');
            count = counts.tutors;
            label = 'verified tutors available';
        } else if (type === 'counselor') {
            countEl = document.getElementById('counselor-count');
            count = counts.counselors;
            label = 'verified counselors available';
        } else if (type === 'buddy') {
            countEl = document.getElementById('student-count');
            count = counts.students;
            label = 'active students online';
        }

        if (countEl) {
            countEl.textContent = `${count} ${label}`;
        }
    } catch (error) {
        console.error('Error updating profile count:', error);
        // Keep "Loading..." on error
    }
}
