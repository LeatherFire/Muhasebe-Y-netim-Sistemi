'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import NotificationsPanel from '@/components/NotificationsPanel';

const navItems = [
  { name: 'Dashboard', href: '/dashboard', icon: '🏠', roles: ['admin', 'user'] },
  { name: 'Banka Hesapları', href: '/bank-accounts', icon: '🏦', roles: ['admin', 'user'] },
  { name: 'Ödeme Emirleri', href: '/payment-orders', icon: '💸', roles: ['admin', 'user'] },
  { name: 'İşlemler', href: '/transactions', icon: '📋', roles: ['admin', 'user'] },
  { name: 'Gelir Takibi', href: '/income', icon: '💰', roles: ['admin', 'user'] },
  { name: 'Kredi Kartları', href: '/credit-cards', icon: '💳', roles: ['admin', 'user'] },
  { name: 'Personeller', href: '/people', icon: '👥', roles: ['admin', 'user'] },
  { name: 'Borçlar', href: '/debts', icon: '⚠️', roles: ['admin', 'user'] },
  { name: 'Çekler', href: '/checks', icon: '📃', roles: ['admin', 'user'] },
  { name: 'Raporlar', href: '/reports', icon: '📊', roles: ['admin', 'user'] },
];

export default function Navigation() {
  const pathname = usePathname();
  const { user } = useAuth();

  if (!user) return null;

  const userNavItems = navItems.filter(item => item.roles.includes(user.role));

  return (
    <nav className="bg-white shadow-sm border-r min-h-screen w-64 fixed left-0 top-0 z-10">
      <div className="p-4">
        <Link href="/dashboard" className="flex items-center space-x-2 mb-8">
          <div className="text-2xl">💼</div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Muhasebe</h2>
            <p className="text-xs text-gray-500">Yönetim Sistemi</p>
          </div>
        </Link>

        <div className="space-y-1">
          {userNavItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                <span className="font-medium">{item.name}</span>
              </Link>
            );
          })}
        </div>

        <div className="mt-8 pt-8 border-t border-gray-200">
          {/* Notifications */}
          <div className="px-4 py-2 mb-4">
            <NotificationsPanel />
          </div>
          
          <div className="flex items-center space-x-3 px-4 py-2">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-medium">
                {user.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">{user.name}</p>
              <p className="text-xs text-gray-500">{user.role === 'admin' ? 'Admin' : 'Kullanıcı'}</p>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}