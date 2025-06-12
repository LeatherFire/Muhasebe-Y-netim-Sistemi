'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  DollarSign, 
  FileText, 
  BarChart, 
  Users, 
  TrendingUp, 
  CreditCard,
  PiggyBank,
  Calculator,
  Receipt,
  AlertCircle
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

interface QuickActionsWidgetProps {
  title: string;
  config: {
    actions?: string[];
    layout?: 'grid' | 'list';
  };
  className?: string;
}

export default function QuickActionsWidget({ 
  title, 
  config = {}, 
  className = '' 
}: QuickActionsWidgetProps) {
  const { user } = useAuth();
  
  const {
    actions = ['payment_order', 'transactions', 'reports', 'people', 'bank_accounts', 'income'],
    layout = 'grid'
  } = config;

  const allActions = [
    {
      id: 'payment_order',
      name: 'Ödeme Emri',
      icon: DollarSign,
      href: user?.role === 'user' ? '/payment-orders' : '/payment-orders/new',
      color: 'bg-blue-600 hover:bg-blue-700',
      description: 'Yeni ödeme emri oluştur',
      roles: ['admin', 'user']
    },
    {
      id: 'transactions',
      name: 'İşlemler',
      icon: BarChart,
      href: '/transactions',
      color: 'bg-indigo-600 hover:bg-indigo-700',
      description: 'Tüm işlemleri görüntüle',
      roles: ['admin', 'user']
    },
    {
      id: 'reports',
      name: 'Raporlar',
      icon: TrendingUp,
      href: '/reports',
      color: 'bg-gray-600 hover:bg-gray-700',
      description: 'Mali raporları incele',
      roles: ['admin', 'user']
    },
    {
      id: 'people',
      name: 'Kişiler/Kurumlar',
      icon: Users,
      href: '/people',
      color: 'bg-purple-600 hover:bg-purple-700',
      description: 'Müşteri ve tedarikçiler',
      roles: ['admin']
    },
    {
      id: 'bank_accounts',
      name: 'Banka Hesapları',
      icon: CreditCard,
      href: '/bank-accounts',
      color: 'bg-green-600 hover:bg-green-700',
      description: 'Hesap yönetimi',
      roles: ['admin', 'user']
    },
    {
      id: 'income',
      name: 'Gelir Takibi',
      icon: PiggyBank,
      href: '/income',
      color: 'bg-emerald-600 hover:bg-emerald-700',
      description: 'Gelir kayıtları',
      roles: ['admin', 'user']
    },
    {
      id: 'credit_cards',
      name: 'Kredi Kartları',
      icon: CreditCard,
      href: '/credit-cards',
      color: 'bg-yellow-600 hover:bg-yellow-700',
      description: 'Kredi kartı yönetimi',
      roles: ['admin', 'user']
    },
    {
      id: 'debts',
      name: 'Borçlar',
      icon: AlertCircle,
      href: '/debts',
      color: 'bg-red-600 hover:bg-red-700',
      description: 'Borç takibi',
      roles: ['admin', 'user']
    },
    {
      id: 'checks',
      name: 'Çekler',
      icon: Receipt,
      href: '/checks',
      color: 'bg-pink-600 hover:bg-pink-700',
      description: 'Çek yönetimi',
      roles: ['admin', 'user']
    },
    {
      id: 'ai_analysis',
      name: 'AI Analiz',
      icon: Calculator,
      href: '/dashboard#ai-insights',
      color: 'bg-violet-600 hover:bg-violet-700',
      description: 'AI destekli analizler',
      roles: ['admin', 'user']
    }
  ];

  // Filter actions based on config and user role
  const availableActions = allActions.filter(action => 
    (actions || []).includes(action.id) && 
    action.roles.includes(user?.role || 'user')
  );

  if (layout === 'list') {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>{title}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {(availableActions || []).map((action) => {
              const IconComponent = action.icon;
              return (
                <Link
                  key={action.id}
                  href={action.href}
                  className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors group"
                >
                  <div className={`p-2 rounded-lg ${action.color} text-white group-hover:scale-105 transition-transform`}>
                    <IconComponent className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">
                      {action.name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {action.description}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <FileText className="h-5 w-5" />
          <span>{title}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {(availableActions || []).map((action) => {
            const IconComponent = action.icon;
            return (
              <Link
                key={action.id}
                href={action.href}
                className={`${action.color} text-white p-4 rounded-lg hover:scale-105 transition-all duration-200 shadow-sm hover:shadow-md group`}
              >
                <div className="text-center">
                  <IconComponent className="h-6 w-6 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                  <div className="text-xs font-medium leading-tight">
                    {action.name}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {availableActions.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p className="text-sm">Kullanılabilir hızlı işlem yok</p>
            <p className="text-xs mt-1">Widget ayarlarından işlemler ekleyebilirsiniz</p>
          </div>
        )}

        {/* Help Text */}
        {availableActions.length > 0 && (
          <div className="mt-4 pt-3 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center">
              Sık kullandığınız işlemlere hızlı erişim
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}