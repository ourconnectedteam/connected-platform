import { auth } from '../lib/auth.js';

const NAV_TEMPLATE = `
    <div class="container">
        <a href="/" class="logo">Connected</a>
        <div class="nav-links">
            <a href="/index.html">Home</a>
            <a href="/tutors.html">Tutors</a>
            <a href="/counselors.html">Counselors</a>
            <a href="/buddies.html">Study Buddies</a>
        </div>
        <div class="nav-auth">
            <!-- Dynamic Content -->
            <div class="skeleton-loader" style="width: 80px; height: 36px; background: rgba(0,0,0,0.05); border-radius: 20px;"></div>
        </div>
        <button class="mobile-menu-btn" aria-label="Menu" style="display: none; background: none; border: none; cursor: pointer;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
        </button>
    </div>
`;

const FOOTER_TEMPLATE = `
    <div class="container">
        <div class="footer-content">
            <div class="footer-logo">Connected</div>
            <div class="footer-links">
                <a href="#">About</a>
                <a href="#">Contact</a>
                <a href="#">Instagram</a>
                <a href="#">LinkedIn</a>
            </div>
            <div class="copyright">© 2026 Connected. All rights reserved.</div>
        </div>
    </div>
`;

export async function initLayout() {
    // 1. Inject Navbar if it doesn't exist content-wise but the tag exists
    const nav = document.querySelector('nav.navbar');
    if (nav && !nav.classList.contains('hydrated')) {
        nav.innerHTML = NAV_TEMPLATE;
        nav.classList.add('hydrated');

        // Highlight active link
        const currentPath = window.location.pathname;
        const links = nav.querySelectorAll('.nav-links a');
        links.forEach(link => {
            if (link.getAttribute('href') === currentPath || (currentPath === '/' && link.getAttribute('href') === '/index.html')) {
                link.classList.add('active');
                link.style.color = 'var(--text-primary)';
                link.style.fontWeight = '600';
            }
        });

        // Mobile Menu Logic
        const menuBtn = nav.querySelector('.mobile-menu-btn');
        const navLinks = nav.querySelector('.nav-links');

        // basic check for mobile
        if (window.innerWidth <= 768) {
            menuBtn.style.display = 'block';
        }

        menuBtn.addEventListener('click', () => {
            const isFlex = navLinks.style.display === 'flex';
            navLinks.style.display = isFlex ? 'none' : 'flex';

            if (!isFlex) {
                // OPENING MENU
                navLinks.style.flexDirection = 'column';
                navLinks.style.position = 'fixed'; // Fixed to cover screen
                navLinks.style.top = '60px';
                navLinks.style.left = '0';
                navLinks.style.width = '100%';
                navLinks.style.height = 'calc(100vh - 60px)';
                navLinks.style.background = 'rgba(255,255,255,0.98)'; // More opacity
                navLinks.style.padding = '24px';
                navLinks.style.backdropFilter = 'blur(10px)';
                navLinks.style.boxShadow = 'none';
                navLinks.style.zIndex = '1000';
                navLinks.style.overflowY = 'auto';

                // Clone Auth Buttons if not already there
                if (!navLinks.querySelector('.mobile-auth-container')) {
                    authDiv.style.display = 'flex';
                    authDiv.style.flexDirection = 'column';
                    authDiv.style.gap = '12px';
                    authDiv.innerHTML = authContent;
                    navLinks.appendChild(authDiv);
                }
            }
        });
    }

    // 2. Inject Footer
    const footer = document.querySelector('footer');
    if (footer && !footer.innerHTML.trim()) {
        footer.innerHTML = FOOTER_TEMPLATE;
    }

    // 3. Update Auth State UI in Navbar
    const navAuth = document.querySelector('.nav-auth');
    if (navAuth) {
        const user = await auth.getUser();
        if (user) {
            // ... Logic duplicated/moved from main.js will go here or be called from main.js
            // For now, let main.js handle the specific auth logic rendering into .nav-auth
            // We just ensure the slot exists.
        } else {
            navAuth.innerHTML = `
                <a href="/src/auth.html#login" class="btn btn-sm btn-secondary btn-white">Log In</a>
                <a href="/src/auth.html#signup" class="btn btn-sm btn-primary">Sign Up</a>
             `;
        }
    }
}
