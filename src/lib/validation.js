// Form Validation Utilities - Phase 2

/**
 * Common validation rules
 */
export const validators = {
    required: (value) => {
        const trimmed = String(value || '').trim();
        return trimmed ? null : 'This field is required';
    },

    email: (value) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(value) ? null : 'Please enter a valid email address';
    },

    phone: (value) => {
        const phoneRegex = /^[\d\s\-\+\(\)]+$/;
        if (!value) return null; // Optional field
        return phoneRegex.test(value) ? null : 'Please enter a valid phone number';
    },

    password: (value) => {
        if (!value) return 'Password is required';
        if (value.length < 8) return 'Password must be at least 8 characters';
        if (!/[A-Z]/.test(value)) return 'Password must include an uppercase letter';
        if (!/[a-z]/.test(value)) return 'Password must include a lowercase letter';
        if (!/[0-9]/.test(value)) return 'Password must include a number';
        return null;
    },

    minLength: (min) => (value) => {
        return value.length >= min ? null : `Must be at least ${min} characters`;
    },

    maxLength: (max) => (value) => {
        return value.length <= max ? null : `Must be no more than ${max} characters`;
    },

    matchesField: (fieldName, otherInput) => (value) => {
        return value === otherInput.value ? null : `Must match ${fieldName}`;
    },
};

/**
 * Validates an input against multiple rules
 * @param {HTMLInputElement} input - The input element to validate
 * @param {Function[]} rules - Array of validation functions
 * @returns {string|null} Error message or null if valid
 */
export function validateInput(input, rules) {
    const value = input.value;

    for (const rule of rules) {
        const error = rule(value);
        if (error) return error;
    }

    return null;
}

/**
 * Shows validation error for an input
 * @param {HTMLInputElement} input - The input element
 * @param {string|null} error - Error message or null
 */
export function showFieldError(input, error) {
    const existingError = input.parentElement.querySelector('.field-error');

    // Remove existing error if present
    if (existingError) {
        existingError.remove();
    }

    // Update input state
    input.classList.remove('invalid', 'valid');

    if (error) {
        // Add invalid state
        input.classList.add('invalid');
        input.setAttribute('aria-invalid', 'true');

        // Create error message element
        const errorEl = document.createElement('div');
        errorEl.className = 'field-error';
        errorEl.textContent = error;
        errorEl.setAttribute('role', 'alert');

        // Insert after input
        input.parentElement.appendChild(errorEl);
    } else if (input.value) {
        // Add valid state (only if field has value)
        input.classList.add('valid');
        input.setAttribute('aria-invalid', 'false');
    }
}

/**
 * Sets up real-time validation for a form
 * @param {HTMLFormElement} form form element
 * @param {Object} fieldRules - Object mapping input names to rule arrays
 * @example
 * setupFormValidation(myForm, {
 *   email: [validators.required, validators.email],
 *   password: [validators.required, validators.password]
 * })
 */
export function setupFormValidation(form, fieldRules) {
    Object.entries(fieldRules).forEach(([fieldName, rules]) => {
        const input = form.querySelector(`[name="${fieldName}"]`);
        if (!input) return;

        // Validate on blur (when user leaves field)
        input.addEventListener('blur', () => {
            const error = validateInput(input, rules);
            showFieldError(input, error);
        });

        // Re-validate on input if field already has error
        input.addEventListener('input', () => {
            if (input.classList.contains('invalid')) {
                const error = validateInput(input, rules);
                showFieldError(input, error);
            }
        });
    });

    // Validate all fields on submit
    form.addEventListener('submit', (e) => {
        let hasErrors = false;

        Object.entries(fieldRules).forEach(([fieldName, rules]) => {
            const input = form.querySelector(`[name="${fieldName}"]`);
            if (!input) return;

            const error = validateInput(input, rules);
            showFieldError(input, error);

            if (error) hasErrors = true;
        });

        if (hasErrors) {
            e.preventDefault();

            // Focus first invalid field
            const firstInvalid = form.querySelector('.invalid');
            firstInvalid?.focus();
        }
    });
}
