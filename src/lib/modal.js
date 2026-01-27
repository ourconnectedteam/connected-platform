// Modal Helper Utilities - Phase 2

/**
 * Shows a modal with smooth animation
 * @param {HTMLElement} modalElement - The modal element to show
 */
export function showModal(modalElement) {
    if (!modalElement) {
        console.error('showModal: modalElement is required');
        return;
    }

    // Ensure modal is in DOM
    if (!document.body.contains(modalElement)) {
        document.body.appendChild(modalElement);
    }

    // Create or find backdrop
    let backdrop = document.querySelector('.modal-backdrop');
    if (!backdrop) {
        backdrop = document.createElement('div');
        backdrop.className = 'modal-backdrop';
        backdrop.addEventListener('click', () => hideModal(modalElement));
        document.body.insertBefore(backdrop, modalElement);
    }

    // Trigger animation (double rAF for CSS transition)
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            backdrop.classList.add('show');
            modalElement.classList.add('show');
        });
    });

    // Focus trap
    setupFocusTrap(modalElement);

    // Prevent body scroll
    document.body.style.overflow = 'hidden';
}

/**
 * Hides a modal with smooth animation
 * @param {HTMLElement} modalElement - The modal element to hide
 */
export function hideModal(modalElement) {
    if (!modalElement) return;

    const backdrop = document.querySelector('.modal-backdrop');

    // Remove show classes
    backdrop?.classList.remove('show');
    modalElement.classList.remove('show');

    // Clean up after animation
    setTimeout(() => {
        modalElement?.remove();
        backdrop?.remove();
        document.body.style.overflow = '';
    }, 250); // Match --timing-base
}

/**
 * Sets up focus trap for modal accessibility
 * @param {HTMLElement} modalElement - The modal element
 */
function setupFocusTrap(modalElement) {
    const focusableElements = modalElement.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    if (focusableElements.length === 0) return;

    // Focus first element
    focusableElements[0].focus();

    // Trap tab key
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    modalElement.addEventListener('keydown', (e) => {
        if (e.key !== 'Tab') return;

        if (e.shiftKey) {
            if (document.activeElement === firstFocusable) {
                lastFocusable.focus();
                e.preventDefault();
            }
        } else {
            if (document.activeElement === lastFocusable) {
                firstFocusable.focus();
                e.preventDefault();
            }
        }
    });

    // Close on Escape
    modalElement.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            hideModal(modalElement);
        }
    });
}
