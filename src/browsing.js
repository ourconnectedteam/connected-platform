import { supabase } from './lib/supabase.js';

export async function renderBrowsingPage(type) {
    const grid = document.querySelector('.profiles-grid');
    if (!grid) return;

    // Show loading state
    grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">Loading profiles...</p>';

    // 1. Collect Filters
    const subjects = Array.from(document.querySelectorAll('input[name="subject"]:checked')).map(cb => cb.value);
    const prices = Array.from(document.querySelectorAll('input[name="price"]:checked')).map(cb => cb.value); // low, mid, high

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
            if (prices.includes('mid')) orConditions.push('and(hourly_rate.gte.40,hourly_rate.lte.60)');
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
    console.log('Browsing Query Result:', { type, profiles, error, subjects, prices });

    if (error) {
        console.error('Error fetching profiles:', error);
        grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: red;">Failed to load profiles. Please try again later.</p>';
        return;
    }

    if (!profiles || profiles.length === 0) {
        grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-secondary);">No profiles found matching your criteria.</p>';
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
        grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-secondary);">No valid profiles found.</p>';
    }

    // Attach Listeners ONLY ONCE (Check if attached)
    if (!window.listenersAttached) {
        document.querySelectorAll('input[type="checkbox"]').forEach(input => {
            input.addEventListener('change', () => renderBrowsingPage(type));
        });

        const clearBtn = document.querySelector('.filter-header .btn-text');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                document.querySelectorAll('input[type="checkbox"]').forEach(i => i.checked = false);
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
        if (type === 'tutor') img = '/assets/tutor.png'; // Fallback
        else if (type === 'counselor') img = '/assets/counselor.png';
        else img = '/assets/student.png';
    }

    // Role Specific Badge/Tags
    let tagsHtml = '';
    let subtext = '';
    let actionBtn = '';
    let priceInfo = '';

    if (type === 'tutor') {
        details.subjects?.forEach(sub => tagsHtml += `<span class="tag">${sub}</span>`);
        subtext = 'Tutor';
        priceInfo = `<div class="price">$${details.hourly_rate}<span>/hr</span></div>`;
        actionBtn = `
            <div style="display: flex; gap: 8px;">
                <a href="/booking.html?providerId=${user.id}&name=${encodeURIComponent(user.full_name)}&role=Tutor&price=${details.hourly_rate}&img=${encodeURIComponent(img)}" class="btn btn-primary btn-sm">Book</a>
                <button class="btn btn-secondary btn-sm" onclick="startChat('${user.id}')">Message</button>
            </div>`;
    } else if (type === 'counselor') {
        details.specialties?.forEach(spec => tagsHtml += `<span class="tag">${spec}</span>`);
        subtext = 'Counselor';
        priceInfo = `<div class="price">$${details.hourly_rate}<span>/hr</span></div>`;
        actionBtn = `
            <div style="display: flex; gap: 8px;">
                <a href="/booking.html?providerId=${user.id}&name=${encodeURIComponent(user.full_name)}&role=Counselor&price=${details.hourly_rate}&img=${encodeURIComponent(img)}" class="btn btn-primary btn-sm">Book</a>
                <button class="btn btn-secondary btn-sm" onclick="startChat('${user.id}')">Message</button>
            </div>`;
    } else { // Student
        details.ib_subjects?.forEach(sub => tagsHtml += `<span class="tag">${sub}</span>`);
        subtext = details.ib_status || 'Student';
        priceInfo = ''; // No price for students
        actionBtn = `
            <div style="display: flex; gap: 8px;">
                <button class="btn btn-primary btn-sm" onclick="sendConnectionRequest('${user.id}')">Connect</button>
                <button class="btn btn-secondary btn-sm" onclick="startChat('${user.id}')">Message</button>
            </div>`;
    }

    const verifiedBadge = user.verified ? `
        <div class="verified-badge">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M10 4L4.5 9.5L2 7" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Verified
        </div>` : '';

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
            </div>
            
            <div class="tags-row">
                ${tagsHtml}
            </div>

            <div class="card-actions">
                ${actionBtn}
                <button class="btn btn-secondary btn-sm" onclick="alert('Profile Details view coming soon!')">View Profile</button>
            </div>
        </div>
    `;

    return card;
}

// Expose connect function globally for now
// START CONVERSATION / CONNECTION REQUEST
import { messaging } from './lib/messaging.js';

window.sendConnectionRequest = async (receiverId) => {
    // Check auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        alert('Please log in to connect.');
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
        receiver_id: receiverId
    });

    if (error) {
        if (error.code === '23505') alert('Request already sent!');
        else alert('Error sending request: ' + error.message);
    } else {
        alert('Request sent!');
    }
};

window.startChat = async (receiverId) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        alert('Please log in to message.');
        return;
    }

    const { data, error } = await messaging.startConversation(user.id, receiverId);
    if (error) {
        console.error(error);
        alert('Could not start chat.');
    } else {
        // Redirect to dashboard messages tab
        // Determine dashboard type based on MY role
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        let dashPath = '/dashboard-student.html'; // default
        if (profile.role === 'tutor') dashPath = '/dashboard-tutor.html';
        if (profile.role === 'counselor') dashPath = '/counselor-dashboard.html';

        window.location.href = `${dashPath}?tab=messages&convId=${data.id}`;
    }
};
