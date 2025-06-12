'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading';
import { FileText, ArrowUpRight, ArrowDownLeft, Calendar } from 'lucide-react';
import { transactionsApi, TransactionSummary } from '@/lib/api/transactions';

interface RecentTransactionsWidgetProps {
  title: string;
  config: {
    limit?: number;
    show_categories?: boolean;
    transaction_types?: string[];
  };
  className?: string;
}

export default function RecentTransactionsWidget({ 
  title, 
  config = {}, 
  className = '' 
}: RecentTransactionsWidgetProps) {
  const [transactions, setTransactions] = useState<TransactionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const {
    limit = 5,
    show_categories = true,
    transaction_types = ['income', 'expense']
  } = config;

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      const data = await transactionsApi.getSummary();
      const filtered = (data || [])
        .filter(tx => (transaction_types || []).includes(tx.type))
        .slice(0, limit);
      setTransactions(filtered);
    } catch (error) {
      console.error('İşlemler yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number, currency: string = 'TRY') => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit'
    });
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'income':
        return <ArrowDownLeft className="h-4 w-4 text-green-600" />;
      case 'expense':
        return <ArrowUpRight className="h-4 w-4 text-red-600" />;
      default:
        return <FileText className="h-4 w-4 text-gray-600" />;
    }
  };

  const getTransactionTypeLabel = (type: string) => {
    const labels = {
      income: 'Gelir',
      expense: 'Gider',
      transfer: 'Transfer'
    };
    return labels[type as keyof typeof labels] || type;
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      salary: 'bg-blue-100 text-blue-800',
      office_supplies: 'bg-yellow-100 text-yellow-800',
      utilities: 'bg-purple-100 text-purple-800',
      rent: 'bg-indigo-100 text-indigo-800',
      supplier: 'bg-green-100 text-green-800',
      service: 'bg-pink-100 text-pink-800',
      other: 'bg-gray-100 text-gray-800'
    };
    return colors[category as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getCategoryLabel = (category: string) => {
    const labels = {
      salary: 'Maaş',
      office_supplies: 'Ofis Malzemesi',
      utilities: 'Faturalar',
      rent: 'Kira',
      supplier: 'Tedarikçi',
      service: 'Hizmet',
      other: 'Diğer'
    };
    return labels[category as keyof typeof labels] || category;
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
        <CardTitle className="flex items-center space-x-2">
          <FileText className="h-5 w-5" />
          <span>{title}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {(transactions || []).length > 0 ? (
          <div className="space-y-3">
            {(transactions || []).map((transaction) => (
              <div key={transaction.id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <div className="flex-shrink-0">
                  {getTransactionIcon(transaction.type)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {transaction.description || 'İşlem açıklaması yok'}
                    </p>
                    <div className="text-sm font-medium">
                      <span className={transaction.type === 'income' ? 'text-green-600' : 'text-red-600'}>
                        {transaction.type === 'income' ? '+' : '-'}
                        {formatCurrency(Math.abs(transaction.amount), transaction.currency)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {show_categories && transaction.category && (
                        <Badge className={`text-xs ${getCategoryColor(transaction.category)}`}>
                          {getCategoryLabel(transaction.category)}
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs">
                        {getTransactionTypeLabel(transaction.type)}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center space-x-1 text-xs text-gray-500">
                      <Calendar className="h-3 w-3" />
                      <span>{formatDate(transaction.transaction_date)}</span>
                    </div>
                  </div>
                  
                  {transaction.recipient_name && (
                    <div className="text-xs text-gray-500 mt-1 truncate">
                      {transaction.type === 'income' ? 'Gönderen: ' : 'Alıcı: '}
                      {transaction.recipient_name}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-500 py-8">
            <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p className="text-sm">Henüz işlem yapılmamış</p>
            <p className="text-xs mt-1">İlk işleminizi yapmak için ödeme emri oluşturun</p>
          </div>
        )}

        {/* Summary Footer */}
        {(transactions || []).length > 0 && (
          <div className="mt-4 pt-3 border-t border-gray-200">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <div className="text-xs text-gray-500">Gelir</div>
                <div className="text-sm font-medium text-green-600">
                  {(transactions || []).filter(tx => tx.type === 'income').length}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Gider</div>
                <div className="text-sm font-medium text-red-600">
                  {(transactions || []).filter(tx => tx.type === 'expense').length}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}