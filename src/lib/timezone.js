/**
 * Timezone utilities for session scheduling
 * All session times in database are assumed to be in UTC
 */

/**
 * Detect user's timezone
 * Priority: 1) User profile timezone 2) Browser timezone 3) UTC fallback
 * @param {string|null} profileTimezone - Timezone from user's profile
 * @returns {string} IANA timezone identifier (e.g., 'America/New_York')
 */
export function getUserTimezone(profileTimezone = null) {
    if (profileTimezone) return profileTimezone;

    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch (e) {
        console.warn('Failed to detect timezone, using UTC');
        return 'UTC';
    }
}

/**
 * Format session date/time in user's timezone
 * @param {string|Date} datetime - UTC datetime from database
 * @param {string} userTimezone - IANA timezone (e.g., 'America/New_York')
 * @param {object} options - Formatting options
 * @returns {string} Formatted date/time string
 */
export function formatSessionTime(datetime, userTimezone, options = {}) {
    if (!datetime) return '—';

    try {
        const date = new Date(datetime);
        if (isNaN(date.getTime())) return '—';

        const defaults = {
            showDate: true,
            showTime: true,
            showTimezone: false,
        };

        const opts = { ...defaults, ...options };
        const formatOptions = { timeZone: userTimezone };

        if (opts.showDate && opts.showTime) {
            // Both date and time
            const dateStr = date.toLocaleDateString('en-US', {
                ...formatOptions,
                month: 'short',
                day: 'numeric',
                year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
            });
            const timeStr = date.toLocaleTimeString('en-US', {
                ...formatOptions,
                hour: '2-digit',
                minute: '2-digit',
            });

            if (opts.showTimezone) {
                // Get timezone abbreviation (e.g., "EST", "PST")
                const tzParts = date
                    .toLocaleTimeString('en-US', {
                        ...formatOptions,
                        timeZoneName: 'short',
                    })
                    .split(' ');
                const tzName = tzParts[tzParts.length - 1];
                return `${dateStr} at ${timeStr} ${tzName}`;
            }

            return `${dateStr} at ${timeStr}`;
        } else if (opts.showDate) {
            // Date only
            return date.toLocaleDateString('en-US', {
                ...formatOptions,
                month: 'short',
                day: 'numeric',
                year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
            });
        } else if (opts.showTime) {
            // Time only
            return date.toLocaleTimeString('en-US', {
                ...formatOptions,
                hour: '2-digit',
                minute: '2-digit',
            });
        }

        return '—';
    } catch (error) {
        console.error('Error formatting session time:', error);
        return '—';
    }
}

/**
 * Format session date/time for long display (e.g., next session preview)
 * @param {string|Date} datetime - UTC datetime from database
 * @param {string} userTimezone - IANA timezone
 * @returns {string} Long format date/time string
 */
export function formatSessionLong(datetime, userTimezone) {
    if (!datetime) return '—';

    try {
        const date = new Date(datetime);
        if (isNaN(date.getTime())) return '—';

        const dateStr = date.toLocaleDateString('en-US', {
            timeZone: userTimezone,
            weekday: 'long',
            month: 'long',
            day: 'numeric',
        });

        const timeStr = date.toLocaleTimeString('en-US', {
            timeZone: userTimezone,
            hour: '2-digit',
            minute: '2-digit',
        });

        return `${dateStr} at ${timeStr}`;
    } catch (error) {
        console.error('Error formatting session time:', error);
        return '—';
    }
}

/**
 * Get timezone abbreviation for display
 * @param {string} userTimezone - IANA timezone
 * @returns {string} Timezone abbreviation (e.g., 'EST', 'PST')
 */
export function getTimezoneAbbr(userTimezone) {
    try {
        const date = new Date();
        const parts = date
            .toLocaleTimeString('en-US', {
                timeZone: userTimezone,
                timeZoneName: 'short',
            })
            .split(' ');
        return parts[parts.length - 1]; // Last part is timezone name
    } catch (error) {
        return userTimezone;
    }
}
