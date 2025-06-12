'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading';
import { Settings, Layout, Plus, RefreshCw } from 'lucide-react';
import { 
  dashboardApi, 
  DashboardLayout, 
  DashboardWidget, 
  widgetSizeConfig 
} from '@/lib/api/dashboard';
import DashboardCustomizer from '@/components/DashboardCustomizer';
import AIInsightsWidget from '@/components/AIInsightsWidget';
import NotificationsPanel from '@/components/NotificationsPanel';

// Widget Components
import BalanceOverviewWidget from '@/components/widgets/BalanceOverviewWidget';
import RecentTransactionsWidget from '@/components/widgets/RecentTransactionsWidget';
import QuickActionsWidget from '@/components/widgets/QuickActionsWidget';

interface CustomizableDashboardProps {
  className?: string;
}

export default function CustomizableDashboard({ className = '' }: CustomizableDashboardProps) {
  const [layout, setLayout] = useState<DashboardLayout | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadDashboardLayout();
  }, []);

  const loadDashboardLayout = async () => {
    try {
      setLoading(true);
      const defaultLayout = await dashboardApi.getDefaultLayout();
      setLayout(defaultLayout);
    } catch (error) {
      console.error('Dashboard layout yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboardLayout();
    setRefreshing(false);
  };

  const renderWidget = (widget: DashboardWidget) => {
    if (!widget.is_visible) return null;

    const baseProps = {
      key: widget.id,
      title: widget.title,
      config: widget.config,
      className: getWidgetClassName(widget.size)
    };

    switch (widget.type) {
      case 'balance_overview':
        return <BalanceOverviewWidget {...baseProps} />;
      case 'recent_transactions':
        return <RecentTransactionsWidget {...baseProps} />;
      case 'ai_insights':
        return <AIInsightsWidget {...baseProps} />;
      case 'notifications':
        return <NotificationWidget {...baseProps} />;
      case 'quick_actions':
        return <QuickActionsWidget {...baseProps} />;
      case 'payment_orders':
      case 'expense_chart':
      case 'income_chart':
      case 'performance_metrics':
      case 'upcoming_payments':
      case 'category_breakdown':
      case 'bank_accounts':
      default:
        return <DefaultWidget {...baseProps} type={widget.type} />;
    }
  };

  const getWidgetClassName = (size: string) => {
    const sizeConfig = widgetSizeConfig[size as keyof typeof widgetSizeConfig];
    if (!sizeConfig) return 'col-span-6 row-span-1';
    
    return `col-span-${sizeConfig.width * 3} row-span-${sizeConfig.height}`;
  };

  const getGridHeight = () => {
    if (!layout || layout.widgets.length === 0) return 'auto-rows-fr';
    
    const maxY = layout.widgets.reduce((max, widget) => {
      const sizeConfig = widgetSizeConfig[widget.size];
      return Math.max(max, widget.position.y + sizeConfig.height);
    }, 0);
    
    return `grid-rows-${Math.max(maxY, 6)}`;
  };

  if (loading) {
    return (
      <div className={`${className}`}>
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  if (!layout) {
    return (
      <div className={`${className}`}>
        <Card>
          <CardContent className="text-center py-12">
            <Layout className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Dashboard yüklenemedi</h3>
            <p className="text-gray-500 mb-4">Dashboard layout'u yüklenirken bir hata oluştu</p>
            <Button onClick={loadDashboardLayout} className="bg-blue-600 hover:bg-blue-700">
              <RefreshCw className="h-4 w-4 mr-2" />
              Tekrar Dene
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={`${className}`}>
      {/* Dashboard Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{layout.name}</h1>
          <p className="text-gray-600">Kişiselleştirilmiş dashboard görünümü</p>
        </div>
        <div className="flex items-center space-x-3">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center space-x-2"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Yenile</span>
          </Button>
          <Button
            onClick={() => setShowCustomizer(true)}
            className="bg-blue-600 hover:bg-blue-700 flex items-center space-x-2"
          >
            <Settings className="h-4 w-4" />
            <span>Özelleştir</span>
          </Button>
        </div>
      </div>

      {/* Dashboard Grid */}
      {layout.widgets.length > 0 ? (
        <div 
          className={`grid grid-cols-12 gap-6 ${getGridHeight()}`}
          style={{
            gridAutoRows: 'minmax(200px, auto)'
          }}
        >
          {layout.widgets
            .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x)
            .map(renderWidget)}
        </div>
      ) : (
        <Card>
          <CardContent className="text-center py-12">
            <Layout className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Dashboard boş</h3>
            <p className="text-gray-500 mb-4">Dashboard'ınızı kişiselleştirmek için widget'lar ekleyin</p>
            <Button onClick={() => setShowCustomizer(true)} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              Widget Ekle
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Dashboard Customizer Modal */}
      {showCustomizer && layout && (
        <DashboardCustomizer
          layout={layout}
          onLayoutChange={setLayout}
          onClose={() => setShowCustomizer(false)}
        />
      )}
    </div>
  );
}

// Default Widget Component for unknown types
interface DefaultWidgetProps {
  title: string;
  type: string;
  config: Record<string, any>;
  className: string;
}

function DefaultWidget({ title, type, className }: DefaultWidgetProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <span className="text-lg">{dashboardApi.getWidgetIcon(type as any)}</span>
          <span>{title}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center text-gray-500 py-8">
          <Layout className="h-8 w-8 mx-auto mb-2" />
          <p className="text-sm">Widget türü: {type}</p>
          <p className="text-xs text-gray-400 mt-1">Bu widget türü henüz desteklenmiyor</p>
        </div>
      </CardContent>
    </Card>
  );
}

// Notification Widget Component
interface NotificationWidgetProps {
  title: string;
  config: Record<string, any>;
  className: string;
}

function NotificationWidget({ title, config, className }: NotificationWidgetProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <span className="text-lg">🔔</span>
          <span>{title}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center">
          <NotificationsPanel />
        </div>
      </CardContent>
    </Card>
  );
}