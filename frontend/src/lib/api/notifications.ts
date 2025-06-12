import { api } from '@/lib/auth';

export type NotificationType = 
  | 'payment_due'
  | 'payment_overdue'
  | 'payment_reminder'
  | 'invoice_due'
  | 'debt_reminder'
  | 'check_due'
  | 'approval_pending'
  | 'approval_approved'
  | 'approval_rejected'
  | 'low_balance'
  | 'high_expense'
  | 'monthly_report'
  | 'system_update'
  | 'backup_reminder';

export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent';
export type NotificationStatus = 'pending' | 'sent' | 'read' | 'dismissed' | 'failed';
export type NotificationChannel = 'in_app' | 'email' | 'sms' | 'push';

export interface NotificationSummary {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  priority: NotificationPriority;
  status: NotificationStatus;
  created_at: string;
  read_at?: string;
  action_url?: string;
  action_text?: string;
}

export interface NotificationStats {
  total_notifications: number;
  unread_count: number;
  pending_count: number;
  failed_count: number;
  by_type: Array<{ type: string; count: number }>;
  by_priority: Array<{ priority: string; count: number }>;
  recent_notifications: NotificationSummary[];
}

export interface NotificationCreate {
  title: string;
  message: string;
  type: NotificationType;
  priority?: NotificationPriority;
  channels?: NotificationChannel[];
  user_id: string;
  related_entity_type?: string;
  related_entity_id?: string;
  scheduled_at?: string;
  expires_at?: string;
  metadata?: Record<string, any>;
  action_url?: string;
  action_text?: string;
}

export interface NotificationPreferences {
  user_id: string;
  email_enabled: boolean;
  sms_enabled: boolean;
  push_enabled: boolean;
  in_app_enabled: boolean;
  payment_reminders: boolean;
  approval_notifications: boolean;
  system_notifications: boolean;
  marketing_notifications: boolean;
  quiet_hours_start?: string;
  quiet_hours_end?: string;
  weekend_notifications: boolean;
  max_daily_notifications: number;
  digest_mode: boolean;
  updated_at: string;
}

export const notificationTypeLabels: Record<NotificationType, string> = {
  payment_due: 'Ödeme Vadesi',
  payment_overdue: 'Vadesi Geçen Ödeme',
  payment_reminder: 'Ödeme Hatırlatması',
  invoice_due: 'Fatura Vadesi',
  debt_reminder: 'Borç Hatırlatması',
  check_due: 'Çek Vadesi',
  approval_pending: 'Onay Bekliyor',
  approval_approved: 'Onaylandı',
  approval_rejected: 'Reddedildi',
  low_balance: 'Düşük Bakiye',
  high_expense: 'Yüksek Harcama',
  monthly_report: 'Aylık Rapor',
  system_update: 'Sistem Güncellemesi',
  backup_reminder: 'Yedekleme Hatırlatması'
};

export const priorityLabels: Record<NotificationPriority, string> = {
  low: 'Düşük',
  medium: 'Orta',
  high: 'Yüksek',
  urgent: 'Acil'
};

export const priorityColors: Record<NotificationPriority, string> = {
  low: 'bg-gray-100 text-gray-800',
  medium: 'bg-blue-100 text-blue-800',
  high: 'bg-yellow-100 text-yellow-800',
  urgent: 'bg-red-100 text-red-800'
};

export const typeIcons: Record<NotificationType, string> = {
  payment_due: '💳',
  payment_overdue: '⚠️',
  payment_reminder: '🔔',
  invoice_due: '📄',
  debt_reminder: '💰',
  check_due: '📃',
  approval_pending: '⏳',
  approval_approved: '✅',
  approval_rejected: '❌',
  low_balance: '📉',
  high_expense: '📊',
  monthly_report: '📋',
  system_update: '🔄',
  backup_reminder: '💾'
};

export const notificationsApi = {
  // Get notifications
  async getNotifications(params?: {
    status_filter?: NotificationStatus;
    type_filter?: NotificationType;
    unread_only?: boolean;
    limit?: number;
    skip?: number;
  }): Promise<NotificationSummary[]> {
    const searchParams = new URLSearchParams();
    if (params?.status_filter) searchParams.append('status_filter', params.status_filter);
    if (params?.type_filter) searchParams.append('type_filter', params.type_filter);
    if (params?.unread_only) searchParams.append('unread_only', params.unread_only.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.skip) searchParams.append('skip', params.skip.toString());

    const queryString = searchParams.toString();
    const url = `/notifications${queryString ? `?${queryString}` : ''}`;
    
    const response = await api.get(url);
    return response.data;
  },

  // Get notification statistics
  async getStats(): Promise<NotificationStats> {
    const response = await api.get('/notifications/stats');
    return response.data;
  },

  // Create notification
  async createNotification(data: NotificationCreate): Promise<NotificationSummary> {
    const response = await api.post('/notifications', data);
    return response.data;
  },

  // Mark as read
  async markAsRead(notificationId: string): Promise<void> {
    await api.put(`/notifications/${notificationId}/read`);
  },

  // Dismiss notification
  async dismiss(notificationId: string): Promise<void> {
    await api.put(`/notifications/${notificationId}/dismiss`);
  },

  // Mark all as read
  async markAllAsRead(): Promise<void> {
    await api.put('/notifications/mark-all-read');
  },

  // Delete notification
  async deleteNotification(notificationId: string): Promise<void> {
    await api.delete(`/notifications/${notificationId}`);
  },

  // Get preferences
  async getPreferences(): Promise<NotificationPreferences> {
    const response = await api.get('/notifications/preferences');
    return response.data;
  },

  // Update preferences
  async updatePreferences(preferences: NotificationPreferences): Promise<NotificationPreferences> {
    const response = await api.put('/notifications/preferences', preferences);
    return response.data;
  },

  // Utility functions
  getTypeLabel(type: NotificationType): string {
    return notificationTypeLabels[type] || type;
  },

  getPriorityLabel(priority: NotificationPriority): string {
    return priorityLabels[priority] || priority;
  },

  getTypeIcon(type: NotificationType): string {
    return typeIcons[type] || '🔔';
  },

  getPriorityColor(priority: NotificationPriority): string {
    return priorityColors[priority] || 'bg-gray-100 text-gray-800';
  },

  formatTimeAgo(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return 'Az önce';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes} dakika önce`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours} saat önce`;
    } else if (diffInSeconds < 604800) {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days} gün önce`;
    } else {
      return date.toLocaleDateString('tr-TR');
    }
  }
};