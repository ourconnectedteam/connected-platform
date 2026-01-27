/**
 * Notifications rendering utilities
 * For now, this renders placeholder UI
 * Next task will connect to real notification system
 */

/**
 * Render latest notifications section
 * @param {object} options - Configuration
 * @param {Array} options.notifications - Array of notification objects
 * @param {boolean} options.loading - Loading state
 * @param {string} options.error - Error message if any
 * @returns {string} HTML string
 */
export function renderNotificationsSection({ notifications = [], loading = false, error = null }) {
    const containerId = 'latest-notifications';

    // Loading state
    if (loading) {
        return `
            <div id="${containerId}" class="notifications-section">
                <h3 style="font-size: 1.1rem; font-weight: 600; margin-bottom: 16px; color: #111827;">
                    Latest Notifications
                </h3>
                <div class="notifications-list">
                    ${Array(3)
                .fill(0)
                .map(
                    () => `
                        <div class="notification-item skeleton-loading">
                            <div class="skeleton-line" style="width: 70%; height: 16px; margin-bottom: 8px;"></div>
                            <div class="skeleton-line" style="width: 40%; height: 12px;"></div>
                        </div>
                    `
                )
                .join('')}
                </div>
            </div>
        `;
    }

    // Error state
    if (error) {
        return `
            <div id="${containerId}" class="notifications-section">
                <h3 style="font-size: 1.1rem; font-weight: 600; margin-bottom: 16px; color: #111827;">
                    Latest Notifications
                </h3>
                <div style="padding: 20px; text-align: center; color: #EF4444; background: #FEF2F2; border-radius: 12px; border: 1px solid #FECACA;">
                    ${error}
                </div>
            </div>
        `;
    }

    // Empty state
    if (!notifications || notifications.length === 0) {
        return `
            <div id="${containerId}" class="notifications-section">
                <h3 style="font-size: 1.1rem; font-weight: 600; margin-bottom: 16px; color: #111827;">
                    Latest Notifications
                </h3>
                <div class="empty-state">
                    <div style="text-align: center; padding: 40px 20px; color: #9CA3AF; background: #F9FAFB; border-radius: 12px; border: 1px solid #E5E7EB;">
                        <div style="font-size: 2.5rem; margin-bottom: 12px; opacity: 0.5;">🔔</div>
                        <p style="font-size: 0.95rem; font-weight: 500; margin-bottom: 4px; color: #6B7280;">No notifications yet</p>
                        <p style="font-size: 0.85rem; color: #9CA3AF;">You're all caught up!</p>
                    </div>
                </div>
            </div>
        `;
    }

    // Notifications list
    const notificationItems = notifications
        .slice(0, 5)
        .map((n) => {
            const icon = getNotificationIcon(n.type);
            const timeAgo = formatTimeAgo(n.created_at);
            const unreadIndicator = !n.read ? '<span class="unread-dot"></span>' : '';

            return `
            <div class="notification-item ${!n.read ? 'unread' : ''}">
                <div style="display: flex; align-items: start; gap: 12px;">
                    <div class="notification-icon">${icon}</div>
                    <div style="flex: 1;">
                        <div style="display: flex; align-items: start; justify-content: space-between; gap: 8px;">
                            <h4 style="font-size: 0.9rem; font-weight: ${!n.read ? '600' : '500'}; margin: 0; color: #111827; line-height: 1.4;">
                                ${n.title}
                            </h4>
                            ${unreadIndicator}
                        </div>
                        <p style="font-size: 0.8rem; color: #6B7280; margin: 4px 0 0 0;">${timeAgo}</p>
                    </div>
                </div>
            </div>
        `;
        })
        .join('');

    return `
        <div id="${containerId}" class="notifications-section">
            <h3 style="font-size: 1.1rem; font-weight: 600; margin-bottom: 16px; color: #111827;">
                Latest Notifications
            </h3>
            <div class="notifications-list">
                ${notificationItems}
            </div>
        </div>
    `;
}

/**
 * Get icon emoji for notification type
 */
function getNotificationIcon(type) {
    const icons = {
        booking: '📅',
        connection: '🤝',
        message: '💬',
        system: '🔔',
    };
    return icons[type] || '📌';
}

/**
 * Format timestamp as "2h ago", "Yesterday", etc.
 */
function formatTimeAgo(datetime) {
    if (!datetime) return '';

    try {
        const date = new Date(datetime);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays}d ago`;

        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch (error) {
        return '';
    }
}
