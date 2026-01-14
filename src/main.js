import { auth } from './lib/auth.js';
import { booking as bookingLib } from './lib/booking.js';
import { renderBrowsingPage } from './browsing.js';
import { messaging } from './lib/messaging.js';
import { email } from './lib/email.js'; // Import Email Helper

// Global Auth Check
(async function initApp() {
    const user = await auth.getUser();
    const path = window.location.pathname;

    // Route Protection & Rendering
    if (path.includes('tutors.html')) renderBrowsingPage('tutor');
    if (path.includes('counselors.html')) renderBrowsingPage('counselor');
    if (path.includes('buddies.html')) renderBrowsingPage('buddy');

    const protectedRoutes = ['/booking.html', '/dashboard-student.html', '/dashboard-tutor.html', '/counselor-dashboard.html'];
    if (!user && protectedRoutes.some(r => path.includes(r))) {
        window.location.href = '/src/auth.html'; // Redirect to login
        return;
    }

    // Navbar Update
    const navAuth = document.querySelector('.nav-auth');
    if (navAuth) {
        if (user) {
            // Logged In State
            const { data: profile } = await auth.getProfile(user.id);
            // Check onboarding
            if (profile && !profile.onboarding_complete && !path.includes('onboarding.html')) {
                window.location.href = '/onboarding.html';
            }

            let dashboardLink = '/onboarding.html'; // Default fallback
            if (profile) {
                console.log('User Profile:', profile);
                if (profile.role === 'student') dashboardLink = '/dashboard-student.html';
                else if (profile.role === 'tutor') dashboardLink = '/dashboard-tutor.html';
                else if (profile.role === 'counselor') dashboardLink = '/counselor-dashboard.html';

                // Update Landing Page Hero Content (If on index.html)
                if (path === '/' || path.includes('index.html')) {
                    const subheadline = document.querySelector('.subheadline');
                    const ctaGroup = document.querySelector('.cta-group');

                    if (subheadline) subheadline.textContent = `Welcome back, ${profile.full_name.split(' ')[0]}! Ready to continue your journey?`;
                    if (ctaGroup) {
                        ctaGroup.innerHTML = `
                            <a href="tutors.html" class="btn btn-primary">Find a Tutor</a>
                            <a href="counselors.html" class="btn btn-secondary">Find a Counselor</a>
                        `;
                    }
                }

            } else {
                console.warn('No profile found for user:', user.id);
            }

            console.log('Generated Dashboard Link:', dashboardLink);

            // Notifications Check
            const { count: unreadCount } = await messaging.getUnreadCount(user.id);

            navAuth.innerHTML = `
                <a href="${dashboardLink}" class="btn btn-sm btn-secondary btn-white" style="position: relative;">
                    Dashboard
                    ${unreadCount && unreadCount > 0 ? `<span style="position: absolute; top: -5px; right: -5px; width: 10px; height: 10px; background: #007AFF; border-radius: 50%; border: 2px solid white; box-shadow: 0 1px 2px rgba(0,0,0,0.1);"></span>` : ''}
                </a>
                <button id="btn-logout" class="btn btn-sm btn-primary">Log Out</button>
            `;

            document.getElementById('btn-logout').addEventListener('click', async () => {
                await auth.signOut();
                window.location.href = '/';
            });
        } else {
            // Logged Out State - Update links to point to auth.html
            navAuth.innerHTML = `
                <a href="/src/auth.html" class="btn btn-sm btn-secondary btn-white">Log In</a>
                <a href="/src/auth.html" class="btn btn-sm btn-primary">Sign Up</a>
            `;
        }
    }
})();

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
                        <div style="padding: 20px; text-align: center;">
                            <p style="color: #666; margin-bottom: 15px;">Stripe Demo Mode</p>
                            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; border: 1px solid #ddd; max-width: 300px; margin: 0 auto;">
                                <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 10px;">
                                    <div style="width: 20px; height: 14px; background: #ddd; border-radius: 2px;"></div>
                                    <span style="font-family: monospace;">**** **** **** 4242</span>
                                </div>
                                <div style="display: flex; justify-content: space-between;">
                                    <span style="font-family: monospace;">12/24</span>
                                    <span style="font-family: monospace;">123</span>
                                </div>
                            </div>
                            <p style="font-size: 0.8rem; color: #888; margin-top: 10px;">Click "Pay & Confirm" to simulate successful payment.</p>
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
                                <div style="font-weight: 500;">Coming Soon (Step 2)</div> 
                            </div>
                             <div>
                                <span style="color: #666;">Price</span>
                                <div style="font-weight: 600; color: #007AFF;">$60.00</div>
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
                buttonsHtml += `<button type="button" class="btn-slot" onclick="selectSlot(this, '${dayName}, ${monthName} ${dayNum}', '${timeStr}', '${slot.id}', '${slot.start_time}')">${timeStr}</button>`;
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
        `;
        document.head.appendChild(style);

        calendarContainer.innerHTML = html;
        calendarContainer.dataset.rendered = "true";
    }

    // Slot Selection Handler
    window.selectSlot = function (btn, dateStr, timeStr, slotId, isoDate) {
        document.querySelectorAll('.btn-slot').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');

        window.selectedTime = `${dateStr} @ ${timeStr}`;
        window.selectedSlotId = slotId;
        window.selectedIsoDate = isoDate;
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
                        scheduled_end: new Date((new Date(window.selectedIsoDate).getTime() + 3600000)).toISOString(),
                        price: 60.00,
                        notes: formData.get('notes')
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
