import { api } from '@/lib/auth';

export type WidgetType = 
  | 'balance_overview'
  | 'recent_transactions'
  | 'payment_orders'
  | 'expense_chart'
  | 'income_chart'
  | 'ai_insights'
  | 'notifications'
  | 'quick_actions'
  | 'performance_metrics'
  | 'upcoming_payments'
  | 'category_breakdown'
  | 'bank_accounts';

export type WidgetSize = 'small' | 'medium' | 'large' | 'wide' | 'extra_large';

export interface DashboardWidget {
  id: string;
  type: WidgetType;
  title: string;
  size: WidgetSize;
  position: { x: number; y: number };
  config: Record<string, any>;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
}

export interface DashboardLayout {
  id: string;
  user_id: string;
  name: string;
  widgets: DashboardWidget[];
  grid_columns: number;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface DashboardLayoutSummary {
  id: string;
  name: string;
  is_default: boolean;
  widget_count: number;
  created_at: string;
  updated_at: string;
}

export interface DashboardWidgetCreate {
  type: WidgetType;
  title: string;
  size: WidgetSize;
  position: { x: number; y: number };
  config?: Record<string, any>;
}

export interface DashboardWidgetUpdate {
  title?: string;
  size?: WidgetSize;
  position?: { x: number; y: number };
  config?: Record<string, any>;
  is_visible?: boolean;
}

export interface DashboardLayoutCreate {
  name: string;
  widgets?: DashboardWidgetCreate[];
  grid_columns?: number;
}

export interface DashboardLayoutUpdate {
  name?: string;
  widgets?: DashboardWidget[];
  grid_columns?: number;
  is_default?: boolean;
}

export interface AvailableWidget {
  type: WidgetType;
  name: string;
  description: string;
  default_size: WidgetSize;
  available_sizes: WidgetSize[];
  category: string;
}

export const widgetSizeConfig = {
  small: { width: 1, height: 1 },
  medium: { width: 2, height: 1 },
  large: { width: 2, height: 2 },
  wide: { width: 3, height: 1 },
  extra_large: { width: 3, height: 2 }
};

export const dashboardApi = {
  // Get user's dashboard layouts
  async getLayouts(): Promise<DashboardLayoutSummary[]> {
    const response = await api.get('/dashboard/layouts');
    return response.data;
  },

  // Get specific dashboard layout
  async getLayout(layoutId: string): Promise<DashboardLayout> {
    const response = await api.get(`/dashboard/layouts/${layoutId}`);
    return response.data;
  },

  // Get default dashboard layout
  async getDefaultLayout(): Promise<DashboardLayout> {
    const response = await api.get('/dashboard/layouts/default');
    return response.data;
  },

  // Create new dashboard layout
  async createLayout(data: DashboardLayoutCreate): Promise<DashboardLayout> {
    const response = await api.post('/dashboard/layouts', data);
    return response.data;
  },

  // Update dashboard layout
  async updateLayout(layoutId: string, data: DashboardLayoutUpdate): Promise<DashboardLayout> {
    const response = await api.put(`/dashboard/layouts/${layoutId}`, data);
    return response.data;
  },

  // Delete dashboard layout
  async deleteLayout(layoutId: string): Promise<void> {
    await api.delete(`/dashboard/layouts/${layoutId}`);
  },

  // Add widget to layout
  async addWidget(layoutId: string, widget: DashboardWidgetCreate): Promise<DashboardWidget> {
    const response = await api.post(`/dashboard/layouts/${layoutId}/widgets`, widget);
    return response.data;
  },

  // Update widget in layout
  async updateWidget(layoutId: string, widgetId: string, data: DashboardWidgetUpdate): Promise<DashboardWidget> {
    const response = await api.put(`/dashboard/layouts/${layoutId}/widgets/${widgetId}`, data);
    return response.data;
  },

  // Remove widget from layout
  async removeWidget(layoutId: string, widgetId: string): Promise<void> {
    await api.delete(`/dashboard/layouts/${layoutId}/widgets/${widgetId}`);
  },

  // Update multiple widget positions (for drag & drop)
  async updateWidgetPositions(layoutId: string, positions: Record<string, { x: number; y: number }>): Promise<void> {
    await api.put(`/dashboard/layouts/${layoutId}/widgets/positions`, positions);
  },

  // Get available widget types
  async getAvailableWidgets(): Promise<AvailableWidget[]> {
    const response = await api.get('/dashboard/available-widgets');
    return response.data;
  },

  // Utility functions
  getWidgetDisplayName(type: WidgetType): string {
    const names: Record<WidgetType, string> = {
      balance_overview: 'Bakiye Özeti',
      recent_transactions: 'Son İşlemler',
      payment_orders: 'Ödeme Emirleri',
      expense_chart: 'Harcama Grafiği',
      income_chart: 'Gelir Grafiği',
      ai_insights: 'AI Öngörüleri',
      notifications: 'Bildirimler',
      quick_actions: 'Hızlı İşlemler',
      performance_metrics: 'Performans Metrikleri',
      upcoming_payments: 'Yaklaşan Ödemeler',
      category_breakdown: 'Kategori Dağılımı',
      bank_accounts: 'Banka Hesapları'
    };
    return names[type] || type;
  },

  getWidgetIcon(type: WidgetType): string {
    const icons: Record<WidgetType, string> = {
      balance_overview: '💰',
      recent_transactions: '📋',
      payment_orders: '💸',
      expense_chart: '📊',
      income_chart: '📈',
      ai_insights: '🧠',
      notifications: '🔔',
      quick_actions: '⚡',
      performance_metrics: '📈',
      upcoming_payments: '⏰',
      category_breakdown: '🥧',
      bank_accounts: '🏦'
    };
    return icons[type] || '📊';
  },

  getWidgetColor(type: WidgetType): string {
    const colors: Record<WidgetType, string> = {
      balance_overview: 'bg-blue-500',
      recent_transactions: 'bg-green-500',
      payment_orders: 'bg-yellow-500',
      expense_chart: 'bg-red-500',
      income_chart: 'bg-emerald-500',
      ai_insights: 'bg-purple-500',
      notifications: 'bg-orange-500',
      quick_actions: 'bg-indigo-500',
      performance_metrics: 'bg-pink-500',
      upcoming_payments: 'bg-amber-500',
      category_breakdown: 'bg-teal-500',
      bank_accounts: 'bg-cyan-500'
    };
    return colors[type] || 'bg-gray-500';
  },

  calculateGridHeight(widgets: DashboardWidget[]): number {
    if (widgets.length === 0) return 6;
    
    let maxY = 0;
    widgets.forEach(widget => {
      const sizeConfig = widgetSizeConfig[widget.size];
      const widgetBottom = widget.position.y + sizeConfig.height;
      maxY = Math.max(maxY, widgetBottom);
    });
    
    return Math.max(maxY + 1, 6); // Minimum 6 rows
  },

  findEmptyPosition(existingWidgets: DashboardWidget[], size: WidgetSize, gridColumns: number = 12): { x: number; y: number } {
    const sizeConfig = widgetSizeConfig[size];
    const gridHeight = this.calculateGridHeight(existingWidgets);
    
    // Create a grid map to track occupied spaces
    const grid: boolean[][] = [];
    for (let y = 0; y < gridHeight + sizeConfig.height; y++) {
      grid[y] = new Array(gridColumns).fill(false);
    }
    
    // Mark occupied positions
    existingWidgets.forEach(widget => {
      const widgetSizeConfig = widgetSizeConfig[widget.size];
      for (let y = widget.position.y; y < widget.position.y + widgetSizeConfig.height; y++) {
        for (let x = widget.position.x; x < widget.position.x + widgetSizeConfig.width; x++) {
          if (grid[y] && grid[y][x] !== undefined) {
            grid[y][x] = true;
          }
        }
      }
    });
    
    // Find first available position
    for (let y = 0; y <= gridHeight; y++) {
      for (let x = 0; x <= gridColumns - sizeConfig.width; x++) {
        let canPlace = true;
        
        // Check if the widget can fit at this position
        for (let dy = 0; dy < sizeConfig.height && canPlace; dy++) {
          for (let dx = 0; dx < sizeConfig.width && canPlace; dx++) {
            if (!grid[y + dy] || grid[y + dy][x + dx]) {
              canPlace = false;
            }
          }
        }
        
        if (canPlace) {
          return { x, y };
        }
      }
    }
    
    // If no position found, place at the bottom
    return { x: 0, y: gridHeight };
  }
};