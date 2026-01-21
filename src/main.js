import { auth } from './lib/auth.js';
import { booking as bookingLib } from './lib/booking.js';
import { renderBrowsingPage } from './browsing.js';
import { messaging } from './lib/messaging.js';
import { email } from './lib/email.js';
import { initLayout } from './components/layout.js';
import { initParallax } from './components/parallax.js';

// Initialize App
(async function initApp() {
    // 1. Layout & Visuals
    await initLayout();
    initParallax();

    const user = await auth.getUser();
    const path = window.location.pathname;

    // 2. Route Protection & Rendering
    if (path.includes('tutors.html')) renderBrowsingPage('tutor');
    if (path.includes('counselors.html')) renderBrowsingPage('counselor');
    if (path.includes('buddies.html')) renderBrowsingPage('buddy');

    const protectedRoutes = ['/booking.html', '/dashboard-student.html', '/dashboard-tutor.html', '/counselor-dashboard.html'];
    if (!user && protectedRoutes.some(r => path.includes(r))) {
        window.location.href = '/src/auth.html'; // Redirect to login
        return;
    }

    // 3. Navbar Auth Logic (Merged from old code, now targeting the injected nav)
    const navAuth = document.querySelector('.nav-auth');
    if (user && navAuth) {
        // Logged In State
        const { data: profile } = await auth.getProfile(user.id);

        // Onboarding Check
        if (profile && !profile.onboarding_complete && !path.includes('onboarding.html')) {
            window.location.href = '/onboarding.html';
        }

        let dashboardLink = '/onboarding.html';
        if (profile) {
            console.log('User Profile:', profile);
            if (profile.role === 'student') dashboardLink = '/dashboard-student.html';
            else if (profile.role === 'tutor') dashboardLink = '/dashboard-tutor.html';
            else if (profile.role === 'counselor') dashboardLink = '/counselor-dashboard.html';

            // Index Personalization
            if (path === '/' || path.includes('index.html')) {
                const subheadline = document.querySelector('.subheadline');
                const ctaGroup = document.querySelector('.cta-group');
                const h1 = document.querySelector('.hero h1');

                // Robustness: Ensure H1 is visible (prevents layout shifts if hidden by other logic)
                if (h1) {
                    h1.style.display = '';
                    h1.style.opacity = '1';
                    h1.style.visibility = 'visible';
                }

                // 1. Update Hero Greeting
                if (subheadline) {
                    subheadline.textContent = `Welcome back, ${profile.full_name.split(' ')[0]}! Ready to continue your journey?`;
                    subheadline.style.display = ''; // Ensure visible
                    subheadline.style.opacity = '1';
                }

                if (ctaGroup) {
                    ctaGroup.innerHTML = `
                        <a href="tutors.html" class="btn btn-primary">Find a Tutor</a>
                        <a href="counselors.html" class="btn btn-secondary">Find a Counselor</a>
                    `;
                }

                // 2. Dynamic Testimonials Injection
                const ctaSection = document.getElementById('join');
                if (ctaSection) {
                    // 10 Unique Testimonials
                    const testimonials = [
                        { text: "James helped me boost my Math AA grade from a 4 to a 7 in just two months!", author: "Sarah Jenkins", role: "IB Student • 43/45", initial: "S" },
                        { text: "My university counselor was a lifesaver. Got into my dream UK uni!", author: "Michael Chen", role: "Accepted to UCL", initial: "M" },
                        { text: "Finding a study buddy for HL Physics made revision much less lonely.", author: "Elena Rodriguez", role: "IB Student • Madrid", initial: "E" },
                        { text: "The dashboard makes managing lessons easy. I can focus on teaching.", author: "David Kim", role: "Chemistry Tutor", initial: "D" },
                        { text: "Finally understood Electric Fields thanks to my tutor. Huge relief.", author: "Jessica Wu", role: "Physics HL Student", initial: "J" },
                        { text: "The essay structure tips for English A were gold. Recommended!", author: "Thomas Müller", role: "IB Student • Berlin", initial: "T" },
                        { text: "Bio HL notes I shared got me connected with great study partners.", author: "Aisha Khan", role: "Biology HL", initial: "A" },
                        { text: "Real-world Econ examples helped me ace my IA. Thanks!", author: "Lucas Silva", role: "Economics SL", initial: "L" },
                        { text: "Super simple booking process. No back-and-forth emails.", author: "Ryan O'Connell", role: "Business Mgmt Tutor", initial: "R" },
                        { text: "This platform is exactly what I wish I had in DP1. Amazing.", author: "Sophie Dubois", role: "IB Alumni • 44 Points", initial: "S" }
                    ];

                    // Generate Cards HTML (Duplicate array for seamless infinite scroll)
                    const cardsHtml = [...testimonials, ...testimonials].map(t => `
                        <div class="testimonial-card">
                            <div class="t-rating">★★★★★</div>
                            <p class="t-text">"${t.text}"</p>
                            <div class="t-author">
                                <div class="t-avatar">${t.initial}</div>
                                <div class="t-info">
                                    <h4>${t.author}</h4>
                                    <p>${t.role}</p>
                                </div>
                            </div>
                        </div>
                    `).join('');

                    ctaSection.innerHTML = `
                        <div class="container fade-in-up visible">
                            <div class="testimonials-header">
                                <h2>Success Stories</h2>
                                <p class="text-secondary">Join 1,000+ IB students crushing their exams.</p>
                            </div>
                            <div class="testimonials-slider">
                                <div class="testimonial-track">
                                    ${cardsHtml}
                                </div>
                            </div>
                        </div>
                    `;
                    ctaSection.classList.remove('cta-section');
                    ctaSection.classList.add('testimonials-section');
                }
            }
        }

        // Notifications
        const { count: unreadCount } = await messaging.getUnreadCount(user.id);

        navAuth.innerHTML = `
            <a href="${dashboardLink}" class="btn btn-sm btn-secondary btn-white" style="position: relative;">
                Dashboard
                ${unreadCount && unreadCount > 0 ? `<span style="position: absolute; top: -5px; right: -5px; width: 10px; height: 10px; background: #007AFF; border-radius: 50%; border: 2px solid white; box-shadow: 0 1px 2px rgba(0,0,0,0.1);"></span>` : ''}
            </a>
            <button id="btn-logout" class="btn btn-sm btn-primary">Log Out</button>
        `;

        const logoutBtn = document.getElementById('btn-logout');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                await auth.signOut();
                window.location.href = '/';
            });
        }
    } else if (navAuth && !path.includes('auth.html')) {
        // Logged Out State
        navAuth.innerHTML = `
            <a href="/src/auth.html#login" class="btn btn-sm btn-secondary btn-white">Log In</a>
            <a href="/src/auth.html#signup" class="btn btn-sm btn-primary">Sign Up</a>
        `;
    }
})();

// View Transition & Link Interception
// View Transition & Link Interception block removed to fix auth page issues.
// Standard navigation is now used, with the delay-based transition effect below.

document.addEventListener('DOMContentLoaded', () => {
    // Smooth scrolling for navigation links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;

            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });

    // Intersection Observer for scroll animations
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target); // Only animate once
            }
        });
    }, observerOptions);

    const animatedElements = document.querySelectorAll('.fade-in-up');
    animatedElements.forEach(el => observer.observe(el));

    // Handle form submission
    const form = document.getElementById('waitlistForm');
    const successMsg = document.querySelector('.form-success');

    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = form.querySelector('input[type="email"]').value;

            if (email) {
                // Simulate API call
                const btn = form.querySelector('button');
                const originalText = btn.textContent;

                btn.textContent = 'Joining...';
                btn.disabled = true;

                setTimeout(() => {
                    form.style.display = 'none';
                    successMsg.classList.remove('hidden');
                    // Reset for demo purposes if needed
                    // btn.textContent = originalText;
                    // btn.disabled = false;
                }, 1000);
            }
        });
    }

    // Show More Subjects Toggle
    const showMoreBtn = document.getElementById('show-more-subjects');
    const extraSubjects = document.getElementById('extra-subjects');

    if (showMoreBtn && extraSubjects) {
        showMoreBtn.addEventListener('click', () => {
            const isHidden = extraSubjects.style.display === 'none';

            if (isHidden) {
                extraSubjects.style.display = 'flex';
                showMoreBtn.innerHTML = `Show less <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="transform: rotate(180deg);"><path d="M1 1L5 5L9 1"/></svg>`;
            } else {
                extraSubjects.style.display = 'none';
                showMoreBtn.innerHTML = `Show more <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 1L5 5L9 1"/></svg>`;
            }
        });
    }

    // Show More Majors Toggle (Counselors Page)
    const showMoreMajorsBtn = document.getElementById('show-more-majors');
    const extraMajors = document.getElementById('extra-majors');

    if (showMoreMajorsBtn && extraMajors) {
        showMoreMajorsBtn.addEventListener('click', () => {
            const isHidden = extraMajors.style.display === 'none';

            if (isHidden) {
                extraMajors.style.display = 'flex';
                showMoreMajorsBtn.innerHTML = `Show less <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="transform: rotate(180deg);"><path d="M1 1L5 5L9 1"/></svg>`;
            } else {
                extraMajors.style.display = 'none';
                showMoreMajorsBtn.innerHTML = `Show more <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 1L5 5L9 1"/></svg>`;
            }
        });
    }

    // Natural Delay Navigation (No Visuals)
    document.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', e => {
            const href = link.getAttribute('href');

            // Only intercept internal links
            if (href &&
                !href.startsWith('#') &&
                !href.startsWith('mailto:') &&
                !href.startsWith('tel:') &&
                link.target !== '_blank') {

                e.preventDefault();
                // Just a subtle delay before switching
                setTimeout(() => {
                    window.location.href = href;
                }, 150);
            }
        });
    });

    // =========================================
    // Booking Flow Logic
    // =========================================

    // 1. URL Parameter Parsing (Populate Sticky Summary)
    const urlParams = new URLSearchParams(window.location.search);
    const providerName = urlParams.get('name');
    const providerRole = urlParams.get('role');
    const providerPrice = urlParams.get('price');
    const providerImg = urlParams.get('img');

    if (providerName && document.getElementById('summary-name')) {
        document.getElementById('summary-name').textContent = providerName;
        document.getElementById('summary-role').textContent = providerRole || 'Tutor';
        document.getElementById('summary-price').textContent = providerPrice || '$60/session';
        if (providerImg) {
            document.getElementById('summary-avatar').src = providerImg;
        }
    }

    // 2. Multi-step Navigation
    const steps = document.querySelectorAll('.booking-step');
    const indicators = document.querySelectorAll('.booking-step-indicator-item');

    // Next Step Helper
    let stripeElements = null;

    window.goToStep = async function (stepNumber) {
        // Hide all steps
        steps.forEach(s => s.style.display = 'none');
        // Show target step
        document.getElementById(`step-${stepNumber}`).style.display = 'block';

        // Update indicators
        indicators.forEach(ind => {
            const indStep = parseInt(ind.dataset.step);
            if (indStep <= stepNumber) {
                ind.classList.add('active');
            } else {
                ind.classList.remove('active');
            }
        });

        // Step 3 Specific Logic (Stripe)
        if (stepNumber === 3) {
            const stripe = await bookingLib.initStripe();
            if (stripe && !stripeElements) {
                // Create Mock Payment Intent
                const clientSecret = await bookingLib.createPaymentIntent(6000); // $60.00

                if (clientSecret === 'mock_secret_client_demo') {
                    document.getElementById('payment-element').innerHTML = `
                        <div class="mock-payment-container">
                            <p style="color: var(--text-secondary); margin-bottom: 8px; font-weight: 500;">Stripe Demo Mode</p>
                            <div class="mock-card-visual">
                                <div style="display: flex; align-items: center; gap: 12px;">
                                    <div class="mock-chip"></div>
                                    <div style="font-weight: 600; color: #111;">TEST CARD</div>
                                </div>
                                <div class="mock-number">4242 4242 4242 4242</div>
                                <div class="mock-details">
                                    <span>Exp: 12/28</span>
                                    <span>CVC: 123</span>
                                </div>
                            </div>
                            <p style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 16px;">
                                <span style="display:inline-block; width:8px; height:8px; background:#34C759; border-radius:50%; margin-right:6px;"></span>
                                Secure Payment Simulator Active
                            </p>
                        </div>
                     `;
                } else {
                    // Real Stripe Logic
                    const options = { clientSecret, appearance: { theme: 'stripe' } };
                    stripeElements = stripe.elements(options);
                    const paymentElement = stripeElements.create('payment');
                    paymentElement.mount('#payment-element');
                }
            }

            // Populate Confirmation Details
            const summary = document.getElementById('booking-confirmation-details');
            if (summary) {
                const formData = new FormData(document.getElementById('booking-form-details'));
                summary.innerHTML = `
                    <div style="background: #f9f9f9; padding: 20px; border-radius: 12px; margin-bottom: 24px;">
                        <h4 style="margin-bottom: 12px; font-weight: 600;">Booking Summary</h4>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 0.95rem;">
                            <div>
                                <span style="color: #666;">Student</span>
                                <div style="font-weight: 500;">${formData.get('fullname')}</div>
                            </div>
                            <div>
                                <span style="color: #666;">Subject</span>
                                <div style="font-weight: 500;">${formData.get('subject') || 'Math'}</div>
                            </div>
                            <div>
                                <span style="color: #666;">Time</span>
                                <div style="font-weight: 500;">${window.selectedTime || 'Not selected'}</div> 
                            </div>
                             <div>
                                <span style="color: #666;">Price</span>
                                <div style="font-weight: 600; color: #007AFF;">$${window.selectedPrice || '0.00'}</div>
                            </div>
                        </div>
                    </div>
                `;
            }
        }

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Step 1 -> 2 (Details -> Time)
    const btnToStep2 = document.getElementById('btn-to-step-2');
    if (btnToStep2) {
        const formDetails = document.getElementById('booking-form-details');
        formDetails.addEventListener('submit', (e) => {
            e.preventDefault();
            // Simple validation is handled by 'required' attributes
            goToStep(2);
            renderCalendar(); // Render calendar when entering step 2
        });
    }

    // Navigation Buttons (Generic Next/Back)
    document.querySelectorAll('.next-step').forEach(btn => {
        btn.addEventListener('click', () => {
            const next = parseInt(btn.dataset.to);
            goToStep(next);
        });
    });

    document.querySelectorAll('.back-step').forEach(btn => {
        btn.addEventListener('click', () => {
            const prev = parseInt(btn.dataset.to);
            goToStep(prev);
        });
    });

    // 3. Simple Calendar Logic (Real Data)
    async function renderCalendar() {
        const providerId = new URLSearchParams(window.location.search).get('providerId');

        const calendarContainer = document.querySelector('.calendar-placeholder');
        if (!calendarContainer || calendarContainer.dataset.rendered) return;

        // Fetch Slots
        let slots = [];
        if (typeof bookingLib !== 'undefined') {
            try {
                const { data, error } = await bookingLib.getSlots(providerId);
                if (error) throw error;
                slots = data || [];
                window.allSlots = slots; // Store for validaton
            } catch (err) {
                console.error('Error fetching slots:', err);
                calendarContainer.innerHTML = '<p class="text-center text-danger">Unable to load time slots. Please try again later.</p>';
                return;
            }
        }

        // If no API or no slots, show empty state or fallback
        if (slots.length === 0) {
            calendarContainer.innerHTML = '<p class="text-center">No available slots found for this provider.</p>';
            return;
        }

        // Group Logic
        const grouped = {};
        slots.forEach(slot => {
            const d = new Date(slot.start_time);
            const dateKey = d.toDateString();
            if (!grouped[dateKey]) grouped[dateKey] = [];
            grouped[dateKey].push(slot);
        });

        let html = '<div class="calendar-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 12px;">';

        Object.keys(grouped).forEach(dateKey => {
            const daySlots = grouped[dateKey];
            const dateObj = new Date(daySlots[0].start_time);
            const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

            const dayName = days[dateObj.getDay()];
            const monthName = months[dateObj.getMonth()];
            const dayNum = dateObj.getDate();

            let buttonsHtml = '';
            daySlots.forEach(slot => {
                const start = new Date(slot.start_time);
                const timeStr = start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                // We pass the raw slot ID and the ISO time
                buttonsHtml += `<button type="button" class="btn-slot" data-id="${slot.id}" data-time="${slot.start_time}" onclick="selectSlot(this, '${dayName}, ${monthName} ${dayNum}', '${timeStr}', '${slot.id}', '${slot.start_time}')">${timeStr}</button>`;
            });

            html += `
                <div class="day-column">
                    <div class="day-header" style="text-align: center; margin-bottom: 12px; font-weight: 500;">
                        <div style="color: var(--text-secondary); font-size: 0.85rem;">${dayName}</div>
                        <div style="font-weight: 700;">${dayNum} ${monthName}</div>
                    </div>
                    <div class="slots" style="display: flex; flex-direction: column; gap: 8px;">
                        ${buttonsHtml}
                    </div>
                </div>
            `;
        });

        html += '</div>';

        // Styles
        const style = document.createElement('style');
        style.textContent = `
            .btn-slot { width: 100%; padding: 8px; border: 1px solid var(--border-color); border-radius: 8px; background: white; color: var(--text-primary); font-size: 0.9rem; cursor: pointer; transition: all 0.2s; }
            .btn-slot:hover { border-color: var(--primary); background: var(--bg-secondary); }
            .btn-slot.selected { background: var(--primary); color: white; border-color: var(--primary); }
            .btn-slot.disabled { opacity: 0.5; cursor: not-allowed; background: #f5f5f5; border-color: #eee; }
        `;
        document.head.appendChild(style);

        calendarContainer.innerHTML = html;
        calendarContainer.dataset.rendered = "true";
    }

    // Slot Selection Handler
    window.selectSlot = function (btn, dateStr, timeStr, slotId, isoDate) {
        // 1. Clear previous
        document.querySelectorAll('.btn-slot').forEach(b => b.classList.remove('selected'));

        // 2. Get Duration
        const durationSelect = document.querySelector('select[name="duration"]');
        const duration = parseInt(durationSelect ? durationSelect.value : 60); // min

        // 3. Find Required Slots
        // Slots are now 30 minutes. 
        // 30 mins -> 1 slot
        // 60 mins -> 2 slots
        // 90 mins -> 3 slots
        const requiredSlots = Math.ceil(duration / 30);
        const allSlots = window.allSlots || [];
        const startIndex = allSlots.findIndex(s => s.id === slotId);

        if (startIndex === -1) return;

        // Check if we have enough consecutive slots
        const slotsToBook = [];
        let valid = true;

        for (let i = 0; i < requiredSlots; i++) {
            const current = allSlots[startIndex + i];

            if (!current) {
                valid = false;
                break;
            }

            // Check continuity
            // For i > 0, current start must equal previous end
            if (i > 0) {
                const prev = allSlots[startIndex + i - 1];
                const prevEnd = new Date(prev.end_time).getTime();
                const currStart = new Date(current.start_time).getTime();

                // Allow tiny tolerance of 1s just in case of weird DB storage, though unlikely
                if (Math.abs(currStart - prevEnd) > 1000) {
                    valid = false;
                    break;
                }
            }

            slotsToBook.push(current);
        }

        if (!valid) {
            alert(`Unable to book ${duration} minutes starting at ${timeStr}. Not enough consecutive slots available.`);
            return;
        }

        // 4. Highlight Logic
        slotsToBook.forEach(s => {
            const el = document.querySelector(`.btn-slot[data-id="${s.id}"]`);
            if (el) el.classList.add('selected');
        });

        // 5. Calculate Price
        const priceStr = new URLSearchParams(window.location.search).get('price'); // "60" or "40"
        const hourlyRate = priceStr ? parseFloat(priceStr) : 60;
        // Price = HourlyRate * (Duration / 60)
        const finalPrice = (hourlyRate * (duration / 60)).toFixed(2);

        // 6. Set Global State
        window.selectedTime = `${dateStr} @ ${timeStr} (${duration} min)`;
        window.selectedSlotId = slotId;
        window.selectedSlotIds = slotsToBook.map(s => s.id);
        window.selectedIsoDate = isoDate;
        window.selectedDuration = duration;
        window.selectedPrice = finalPrice;
    };

    // 4. Confirm Step Population
    const step3Btn = document.querySelector('.next-step[data-to="3"]');
    if (step3Btn) {
        step3Btn.addEventListener('click', () => {
            // Populate Step 3 summary
            const step3Container = document.querySelector('#step-3 .section-title');

            // Create summary HTML
            const summaryHTML = `
                <div class="confirmation-review" style="margin-bottom: 24px;">
                    <div class="review-item" style="margin-bottom: 16px;">
                        <h4 style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 4px;">Session</h4>
                        <div style="font-weight: 600;">${document.querySelector('select[name="duration"]').options[document.querySelector('select[name="duration"]').selectedIndex].text} • ${document.querySelector('select[name="session_type"]').value}</div>
                    </div>
                    <div class="review-item" style="margin-bottom: 16px;">
                        <h4 style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 4px;">Date & Time</h4>
                        <div style="font-weight: 600;">${window.selectedTime || 'Not selected'}</div>
                    </div>
                    <div class="review-item">
                        <h4 style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 4px;">Student</h4>
                        <div style="font-weight: 600;">${document.querySelector('input[name="fullname"]').value}</div>
                        <div style="font-size: 0.9rem;">${document.querySelector('input[name="email"]').value}</div>
                    </div>
                </div>
             `;

            // Check if we already appended summary
            const existingSummary = document.querySelector('.confirmation-review');
            if (existingSummary) existingSummary.remove();

            step3Container.insertAdjacentHTML('afterend', summaryHTML);
        })
    }

    // 5. Submit Booking
    // 5. Submit Booking (Paid)
    const btnConfirm = document.getElementById('btn-confirm-booking');
    if (btnConfirm) {
        btnConfirm.addEventListener('click', async () => {
            const originalText = btnConfirm.textContent;
            btnConfirm.textContent = 'Processing Payment...';
            btnConfirm.disabled = true;

            try {
                // 1. Confirm Payment (using Stripe or Mock)
                const { error: paymentError, paymentIntent } = await bookingLib.confirmPayment(stripeElements);

                if (paymentError) {
                    throw new Error(paymentError.message);
                }

                if (paymentIntent && paymentIntent.status === 'succeeded') {
                    // 2. Create Booking in DB
                    // Gather details
                    const formData = new FormData(document.getElementById('booking-form-details'));
                    const providerId = new URLSearchParams(window.location.search).get('providerId');
                    const user = await auth.getUser();

                    // Mock booking creation if backend fails or for demo
                    const bookingDetails = {
                        student_id: user?.id,
                        provider_id: providerId,
                        scheduled_start: window.selectedIsoDate || new Date().toISOString(),
                        scheduled_end: calculateEndTime(window.selectedIsoDate, window.selectedDuration || 60),
                        price: window.selectedPrice ? parseFloat(window.selectedPrice) : 60.00,
                        notes: formData.get('notes'),
                        slot_ids: window.selectedSlotIds // Pass all selected slots
                    };

                    const { error: bookingError } = await bookingLib.createBooking(bookingDetails);
                    if (bookingError) console.error('Booking DB error (non-fatal for demo):', bookingError);

                    // Success!

                    // Send Confirmation Email (Async)
                    const providerName = new URLSearchParams(window.location.search).get('name') || 'Tutor';
                    email.sendBookingConfirmation({
                        studentName: formData.get('fullname') || 'Student',
                        providerName: providerName,
                        date: window.selectedIsoDate ? new Date(window.selectedIsoDate).toDateString() : 'N/A',
                        time: window.selectedIsoDate ? new Date(window.selectedIsoDate).toLocaleTimeString() : 'N/A',
                        link: 'https://zoom.us/j/demo-link'
                    }).catch(err => console.error('Failed to send email:', err));

                    goToStep(4);
                } else {
                    throw new Error('Payment failed. Please try again.');
                }

            } catch (err) {
                console.error(err);
                alert(`Error: ${err.message}`);
                btnConfirm.textContent = originalText;
                btnConfirm.disabled = false;
            }
        });
    }

    function calculateEndTime(startDateStr, durationMinutes) {
        if (!startDateStr) return null;
        const date = new Date(startDateStr);
        date.setMinutes(date.getMinutes() + parseInt(durationMinutes || 60));
        return date.toISOString();
    }

});
