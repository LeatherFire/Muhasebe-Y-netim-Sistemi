'use client';

import { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import Navigation from '@/components/Navigation';
import { useAuth } from '@/contexts/AuthContext';
import { bankAccountsApi, BankAccountSummary } from '@/lib/api/bankAccounts';
import { paymentOrdersApi, PaymentOrderSummary } from '@/lib/api/paymentOrders';
import { transactionsApi, TransactionSummary } from '@/lib/api/transactions';
import { reportsApi, DashboardStats } from '@/lib/api/reports';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingCard, LoadingOverlay, Skeleton, TableSkeleton } from '@/components/ui/loading';
import { TrendingUp, TrendingDown, BarChart, DollarSign, Users, FileText, AlertCircle, RefreshCw, RotateCcw, Clock } from 'lucide-react';
import { LineChart, Line, AreaChart, Area, BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import Link from 'next/link';
import AIInsightsWidget from '@/components/AIInsightsWidget';

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const [bankAccounts, setBankAccounts] = useState<BankAccountSummary[]>([]);
  const [paymentOrders, setPaymentOrders] = useState<PaymentOrderSummary[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<TransactionSummary[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadDashboardData();
    
    // Auto-refresh her 30 saniyede bir
    if (autoRefresh) {
      const interval = setInterval(() => {
        loadDashboardData(false); // Sessiz refresh
      }, 30000);
      
      setRefreshInterval(interval);
      
      return () => {
        if (interval) clearInterval(interval);
      };
    }
  }, [autoRefresh]);

  const loadDashboardData = async (showLoading = true) => {
    try {
      if (showLoading) setIsLoading(true);
      
      const [accounts, orders, transactions, stats] = await Promise.all([
        bankAccountsApi.getSummary(),
        paymentOrdersApi.getSummary(),
        transactionsApi.getSummary(),
        reportsApi.getDashboardStats()
      ]);
      
      setBankAccounts(accounts);
      setPaymentOrders(orders);
      setRecentTransactions(transactions.slice(0, 5)); // Son 5 işlem
      setDashboardStats(stats);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Dashboard data loading error:', error);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  };

  const handleManualRefresh = () => {
    loadDashboardData(true);
  };

  const toggleAutoRefresh = () => {
    setAutoRefresh(!autoRefresh);
    if (refreshInterval) {
      clearInterval(refreshInterval);
      setRefreshInterval(null);
    }
  };

  const totalBalance = bankAccounts.reduce((sum, account) => {
    if (account.currency === 'TRY') {
      return sum + account.current_balance;
    }
    return sum;
  }, 0);

  const pendingOrders = paymentOrders.filter(order => order.status === 'pending');
  const completedOrders = paymentOrders.filter(order => order.status === 'completed');

  const formatCurrency = (amount: number, currency: string = 'TRY') => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  return (
    <ProtectedRoute>
      <div className="flex min-h-screen bg-gray-50">
        <Navigation />
        
        <div className="flex-1 ml-64">
          {/* Header */}
          <header className="bg-white shadow-sm border-b">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center py-4">
                <h1 className="text-2xl font-bold text-gray-900">
                  Dashboard
                </h1>
                <div className="flex items-center space-x-4">
                  {/* Real-time Controls */}
                  <div className="flex items-center space-x-2 text-sm text-gray-500">
                    <Clock className="h-4 w-4" />
                    <span>Son güncelleme: {lastRefresh.toLocaleTimeString('tr-TR')}</span>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={handleManualRefresh}
                      className="p-2 text-gray-500 hover:text-gray-700 rounded-md hover:bg-gray-100"
                      title="Verileri yenile"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </button>
                    
                    <button
                      onClick={toggleAutoRefresh}
                      className={`p-2 rounded-md ${autoRefresh 
                        ? 'text-green-600 bg-green-50 hover:bg-green-100' 
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                      }`}
                      title={autoRefresh ? 'Otomatik yenilemeyi durdur' : 'Otomatik yenilemeyi başlat'}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </button>
                  </div>
                  
                  <span className="text-sm text-gray-500">
                    Hoş geldiniz, <span className="font-medium">{user?.name}</span>
                    {user?.role === 'admin' && (
                      <span className="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                        Admin
                      </span>
                    )}
                  </span>
                  <button
                    onClick={signOut}
                    className="text-sm text-gray-500 hover:text-gray-700 font-medium"
                  >
                    Çıkış Yap
                  </button>
                </div>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {isLoading ? (
              <div className="space-y-8">
                {/* Loading KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Card key={i}>
                      <CardHeader className="space-y-2">
                        <Skeleton width="w-24" height="h-4" />
                        <Skeleton width="w-16" height="h-8" />
                        <Skeleton width="w-32" height="h-3" />
                      </CardHeader>
                    </Card>
                  ))}
                </div>
                
                {/* Loading Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <LoadingCard message="Grafik verileri yükleniyor..." />
                  <LoadingCard message="Tablo verileri yükleniyor..." />
                </div>
              </div>
            ) : (
              <>
                {/* Key Performance Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Bu Ay Gelir</CardTitle>
                      <TrendingUp className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-green-600">
                        {dashboardStats ? formatCurrency(dashboardStats.current_month_income) : formatCurrency(0)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Toplam banka bakiyesi: {formatCurrency(totalBalance)}
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Bu Ay Gider</CardTitle>
                      <TrendingDown className="h-4 w-4 text-red-600" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-red-600">
                        {dashboardStats ? formatCurrency(dashboardStats.current_month_expense) : formatCurrency(0)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Bekleyen ödemeler: {pendingOrders.length}
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Net Kar</CardTitle>
                      <BarChart className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                      <div className={`text-2xl font-bold ${
                        dashboardStats && dashboardStats.current_month_profit >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {dashboardStats ? formatCurrency(dashboardStats.current_month_profit) : formatCurrency(0)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Bu ayki performans
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Aktif Borçlar</CardTitle>
                      <AlertCircle className="h-4 w-4 text-orange-600" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {dashboardStats ? dashboardStats.active_debts : 0}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Takip edilmesi gereken
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Charts Section */}
                {dashboardStats && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    {/* Aylık Trend Grafiği */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Aylık Gelir-Gider Trendi</CardTitle>
                        <CardDescription>Son 6 ayın gelir ve gider karşılaştırması</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                          <LineChart data={dashboardStats.monthly_trends}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" />
                            <YAxis />
                            <Tooltip 
                              formatter={(value: number) => [formatCurrency(value), '']}
                            />
                            <Line 
                              type="monotone" 
                              dataKey="income" 
                              stroke="#10b981" 
                              strokeWidth={2}
                              name="Gelir"
                            />
                            <Line 
                              type="monotone" 
                              dataKey="expense" 
                              stroke="#ef4444" 
                              strokeWidth={2}
                              name="Gider"
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    {/* En Büyük Giderler */}
                    <Card>
                      <CardHeader>
                        <CardTitle>En Büyük Giderler</CardTitle>
                        <CardDescription>Bu ayki en yüksek harcamalar</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {dashboardStats.top_expenses.length > 0 ? (
                            dashboardStats.top_expenses.map((expense, index) => (
                              <div key={index} className="flex justify-between items-center">
                                <div className="flex-1">
                                  <p className="font-medium text-sm">{expense.description}</p>
                                  <p className="text-xs text-gray-500">
                                    {expense.person_name && `${expense.person_name} - `}
                                    {new Date(expense.transaction_date).toLocaleDateString('tr-TR')}
                                  </p>
                                </div>
                                <div className="text-sm font-bold text-red-600">
                                  {formatCurrency(expense.amount)}
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-center text-gray-500 py-4">Bu ay henüz gider yapılmamış</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Recent Transactions Overview */}
                <Card className="mb-8">
                  <CardHeader>
                    <CardTitle>Son İşlemler Özeti</CardTitle>
                    <CardDescription>En son gerçekleşen finansal hareketler</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {dashboardStats && dashboardStats.recent_transactions.length > 0 ? (
                        dashboardStats.recent_transactions.slice(0, 5).map((transaction) => (
                          <div key={transaction.id} className="flex justify-between items-center p-4 border rounded-lg">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2">
                                <div className={`text-sm font-medium ${
                                  transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                                }`}>
                                  {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                                </div>
                              </div>
                              <p className="text-sm text-gray-900 mt-1">{transaction.description}</p>
                              <div className="text-xs text-gray-500 mt-1 flex items-center space-x-2">
                                <span>{transaction.bank_account_name}</span>
                                <span>•</span>
                                <span>{new Date(transaction.transaction_date).toLocaleDateString('tr-TR')}</span>
                                {transaction.person_name && (
                                  <>
                                    <span>•</span>
                                    <span>{transaction.person_name}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center text-gray-500 py-8">
                          <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                          <p>Henüz hiç işlem yapılmamış.</p>
                          <p className="text-sm mt-2">İlk işleminizi yapmak için aşağıdaki hızlı işlemler menüsünü kullanın.</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Detaylı Analiz Bölümü */}
                {dashboardStats && (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                    {/* Günlük Bakiye Trendi */}
                    <Card className="lg:col-span-2">
                      <CardHeader>
                        <CardTitle>7 Günlük Bakiye Trendi</CardTitle>
                        <CardDescription>Son haftalık bakiye değişimleri</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                          <AreaChart data={dashboardStats.weekly_balance_trend || []}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis />
                            <Tooltip 
                              formatter={(value: number) => [formatCurrency(value), 'Bakiye']}
                              labelFormatter={(label) => `Tarih: ${label}`}
                            />
                            <Area 
                              type="monotone" 
                              dataKey="balance" 
                              stroke="#3b82f6" 
                              fill="#3b82f6" 
                              fillOpacity={0.3}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    {/* Kategori Bazlı Dağılım */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Gider Kategorileri</CardTitle>
                        <CardDescription>Bu ayki harcama dağılımı</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                          <PieChart>
                            <Pie
                              data={dashboardStats.expense_categories || []}
                              cx="50%"
                              cy="50%"
                              outerRadius={80}
                              dataKey="amount"
                              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            >
                              {(dashboardStats.expense_categories || []).map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={`hsl(${index * 45}, 70%, 50%)`} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(value: number) => formatCurrency(value)} />
                          </PieChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Performans Kartları */}
                {dashboardStats && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <Card className="border-l-4 border-l-blue-500">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg">Aylık Ortalama</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-blue-600">
                          {formatCurrency(dashboardStats.monthly_average || 0)}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Son 3 ayın ortalaması</p>
                      </CardContent>
                    </Card>

                    <Card className="border-l-4 border-l-green-500">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg">En İyi Gün</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-green-600">
                          {formatCurrency(dashboardStats.best_day_amount || 0)}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {dashboardStats.best_day_date ? new Date(dashboardStats.best_day_date).toLocaleDateString('tr-TR') : 'Henüz veri yok'}
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="border-l-4 border-l-yellow-500">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg">Bekleyen İşlemler</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-yellow-600">
                          {dashboardStats.pending_transactions_count || 0}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Toplam: {formatCurrency(dashboardStats.pending_transactions_amount || 0)}
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="border-l-4 border-l-purple-500">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg">Aktif Hesaplar</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-purple-600">
                          {bankAccounts.length}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {bankAccounts.filter(acc => acc.current_balance > 0).length} tanesi pozitif bakiyeli
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* AI Insights Widget */}
                <AIInsightsWidget 
                  title="AI Öngörüleri"
                  config={{}}
                  className="mb-8" 
                />
              </>
            )}

                {/* Quick Actions */}
                <Card>
                  <CardHeader>
                    <CardTitle>Hızlı İşlemler</CardTitle>
                    <CardDescription>Sık kullanılan işlemlere hızlı erişim</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {user?.role === 'user' && (
                        <Link href="/payment-orders" className="bg-blue-600 text-white p-4 rounded-lg hover:bg-blue-700 transition-colors block">
                          <div className="text-center">
                            <DollarSign className="h-8 w-8 mx-auto mb-2" />
                            <div className="font-medium">Ödeme Emri</div>
                          </div>
                        </Link>
                      )}

                      {user?.role === 'admin' && (
                        <>
                          <Link href="/payment-orders" className="bg-green-600 text-white p-4 rounded-lg hover:bg-green-700 transition-colors block">
                            <div className="text-center">
                              <FileText className="h-8 w-8 mx-auto mb-2" />
                              <div className="font-medium">Ödeme Emirleri</div>
                            </div>
                          </Link>

                          <Link href="/transactions" className="bg-indigo-600 text-white p-4 rounded-lg hover:bg-indigo-700 transition-colors block">
                            <div className="text-center">
                              <BarChart className="h-8 w-8 mx-auto mb-2" />
                              <div className="font-medium">İşlemler</div>
                            </div>
                          </Link>

                          <Link href="/people" className="bg-purple-600 text-white p-4 rounded-lg hover:bg-purple-700 transition-colors block">
                            <div className="text-center">
                              <Users className="h-8 w-8 mx-auto mb-2" />
                              <div className="font-medium">Kişiler/Kurumlar</div>
                            </div>
                          </Link>
                        </>
                      )}

                      <Link href="/reports" className="bg-gray-600 text-white p-4 rounded-lg hover:bg-gray-700 transition-colors block">
                        <div className="text-center">
                          <TrendingUp className="h-8 w-8 mx-auto mb-2" />
                          <div className="font-medium">Raporlar</div>
                        </div>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}