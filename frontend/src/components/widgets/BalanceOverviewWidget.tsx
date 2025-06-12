'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading';
import { TrendingUp, TrendingDown, DollarSign, Eye, EyeOff } from 'lucide-react';
import { bankAccountsApi, BankAccountSummary } from '@/lib/api/bankAccounts';

interface BalanceOverviewWidgetProps {
  title: string;
  config: {
    show_total_balance?: boolean;
    show_account_breakdown?: boolean;
    currency_filter?: string[];
  };
  className?: string;
}

export default function BalanceOverviewWidget({ 
  title, 
  config = {}, 
  className = '' 
}: BalanceOverviewWidgetProps) {
  const [accounts, setAccounts] = useState<BankAccountSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBalances, setShowBalances] = useState(true);

  const {
    show_total_balance = true,
    show_account_breakdown = true,
    currency_filter = ['TRY']
  } = config;

  useEffect(() => {
    loadBankAccounts();
  }, []);

  const loadBankAccounts = async () => {
    try {
      setLoading(true);
      const data = await bankAccountsApi.getSummary();
      setAccounts(data);
    } catch (error) {
      console.error('Banka hesapları yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredAccounts = (accounts || []).filter(account => 
    currency_filter?.includes(account.currency)
  );

  const totalBalance = filteredAccounts.reduce((sum, account) => 
    sum + account.current_balance, 0
  );

  const positiveAccounts = filteredAccounts.filter(acc => acc.current_balance > 0);
  const negativeAccounts = filteredAccounts.filter(acc => acc.current_balance < 0);

  const formatCurrency = (amount: number, currency: string = 'TRY') => {
    if (!showBalances) return '••••••';
    
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <LoadingSpinner />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <DollarSign className="h-5 w-5" />
            <span>{title}</span>
          </CardTitle>
          <button
            onClick={() => setShowBalances(!showBalances)}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            {showBalances ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {show_total_balance && (
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="text-sm text-blue-600 font-medium mb-1">Toplam Bakiye</div>
            <div className="text-2xl font-bold text-blue-900">
              {formatCurrency(totalBalance)}
            </div>
            <div className="flex items-center mt-2 text-sm">
              {totalBalance >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
              )}
              <span className={totalBalance >= 0 ? 'text-green-600' : 'text-red-600'}>
                {filteredAccounts.length} hesap
              </span>
            </div>
          </div>
        )}

        {show_account_breakdown && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-gray-900">Hesap Dağılımı</h4>
              <div className="text-xs text-gray-500">
                {filteredAccounts.length} hesap
              </div>
            </div>

            {/* Positive Balance Accounts */}
            {positiveAccounts.length > 0 && (
              <div>
                <div className="text-xs text-green-600 font-medium mb-2">
                  Aktif Hesaplar ({positiveAccounts.length})
                </div>
                <div className="space-y-2">
                  {positiveAccounts?.slice(0, 3).map((account) => (
                    <div key={account.id} className="flex items-center justify-between p-2 bg-green-50 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {account.bank_name}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {account.account_number}
                        </div>
                      </div>
                      <div className="text-sm font-medium text-green-700">
                        {formatCurrency(account.current_balance, account.currency)}
                      </div>
                    </div>
                  ))}
                  {positiveAccounts.length > 3 && (
                    <div className="text-xs text-gray-500 text-center py-1">
                      +{positiveAccounts.length - 3} hesap daha
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Negative Balance Accounts */}
            {negativeAccounts.length > 0 && (
              <div>
                <div className="text-xs text-red-600 font-medium mb-2">
                  Borçlu Hesaplar ({negativeAccounts.length})
                </div>
                <div className="space-y-2">
                  {negativeAccounts?.slice(0, 2).map((account) => (
                    <div key={account.id} className="flex items-center justify-between p-2 bg-red-50 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {account.bank_name}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {account.account_number}
                        </div>
                      </div>
                      <div className="text-sm font-medium text-red-700">
                        {formatCurrency(account.current_balance, account.currency)}
                      </div>
                    </div>
                  ))}
                  {negativeAccounts.length > 2 && (
                    <div className="text-xs text-gray-500 text-center py-1">
                      +{negativeAccounts.length - 2} hesap daha
                    </div>
                  )}
                </div>
              </div>
            )}

            {filteredAccounts.length === 0 && (
              <div className="text-center text-gray-500 py-4">
                <DollarSign className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">Henüz banka hesabı eklenmemiş</p>
              </div>
            )}
          </div>
        )}

        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-100">
          <div className="text-center">
            <div className="text-xs text-gray-500">Pozitif</div>
            <div className="text-sm font-medium text-green-600">
              {positiveAccounts.length}
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-500">Negatif</div>
            <div className="text-sm font-medium text-red-600">
              {negativeAccounts.length}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}