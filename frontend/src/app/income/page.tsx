'use client';

import { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import Navigation from '@/components/Navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner, LoadingCard } from '@/components/ui/loading';
import { 
  Upload, 
  FileText, 
  Calendar, 
  DollarSign, 
  Building, 
  Check, 
  X, 
  Eye,
  Download,
  Search,
  Filter,
  TrendingUp
} from 'lucide-react';
import { bankAccountsApi, BankAccountSummary } from '@/lib/api/bankAccounts';
import { 
  incomeRecordsApi, 
  IncomeRecordSummary, 
  IncomeRecordCreate, 
  IncomeStatistics,
  IncomeRecordStatus 
} from '@/lib/api/incomeRecords';

export default function IncomePage() {
  const { user } = useAuth();
  const [incomeRecords, setIncomeRecords] = useState<IncomeRecordSummary[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccountSummary[]>([]);
  const [statistics, setStatistics] = useState<IncomeStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [filter, setFilter] = useState<'all' | IncomeRecordStatus>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState<IncomeRecordCreate>({
    company_name: '',
    amount: 0,
    currency: 'TRY',
    bank_account_id: '',
    description: '',
    income_date: new Date().toISOString().split('T')[0],
    receipt_file: undefined
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadFilteredRecords = async () => {
    try {
      const params: any = {};
      if (filter !== 'all') params.status_filter = filter;
      if (searchTerm) params.company_name = searchTerm;
      
      const recordsData = await incomeRecordsApi.getRecords(params);
      setIncomeRecords(recordsData);
    } catch (error) {
      console.error('Filtrelenmiş veriler yüklenirken hata:', error);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (filter !== 'all' || searchTerm) {
        loadFilteredRecords();
      } else {
        loadData();
      }
    }, 300); // 300ms debounce for search

    return () => clearTimeout(timeoutId);
  }, [filter, searchTerm]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [recordsData, accountsData, statisticsData] = await Promise.all([
        incomeRecordsApi.getRecords(),
        bankAccountsApi.getSummary(),
        incomeRecordsApi.getStatistics()
      ]);
      setIncomeRecords(recordsData);
      setBankAccounts(accountsData);
      setStatistics(statisticsData);
    } catch (error) {
      console.error('Veriler yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };


  const handleInputChange = (field: keyof IncomeRecordCreate, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleInputChange('receipt_file', file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);

    try {
      // Create new income record using API
      const newRecord = await incomeRecordsApi.createRecord(formData);
      
      // Add to local state with bank account name
      const bankAccountName = bankAccounts.find(acc => acc.id === formData.bank_account_id)?.bank_name || '';
      const recordSummary: IncomeRecordSummary = {
        id: newRecord.id!,
        company_name: newRecord.company_name,
        amount: newRecord.amount,
        currency: newRecord.currency,
        bank_account_name: bankAccountName,
        status: newRecord.status,
        income_date: newRecord.income_date,
        created_at: newRecord.created_at,
        has_receipt: !!newRecord.receipt_file
      };

      setIncomeRecords(prev => [recordSummary, ...prev]);
      
      // Refresh statistics
      try {
        const updatedStats = await incomeRecordsApi.getStatistics();
        setStatistics(updatedStats);
      } catch (statsError) {
        console.error('İstatistikler güncellenirken hata:', statsError);
      }
      
      // Reset form
      setFormData({
        company_name: '',
        amount: 0,
        currency: 'TRY',
        bank_account_id: '',
        description: '',
        income_date: new Date().toISOString().split('T')[0],
        receipt_file: undefined
      });
      
      setShowForm(false);
    } catch (error) {
      console.error('Gelir kaydı oluşturulurken hata:', error);
    } finally {
      setUploading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'verified':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'verified':
        return 'Onaylandı';
      case 'pending':
        return 'Beklemede';
      case 'rejected':
        return 'Reddedildi';
      default:
        return status;
    }
  };

  const formatCurrency = (amount: number, currency: string = 'TRY') => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('tr-TR');
  };

  // Records are already filtered server-side, so we can use them directly
  const filteredRecords = incomeRecords;

  const totalIncome = statistics?.total_verified_amount || filteredRecords
    .filter(record => record.status === 'verified')
    .reduce((sum, record) => sum + record.amount, 0);

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="flex min-h-screen bg-gray-50">
          <Navigation />
          <main className="flex-1 ml-64 p-8">
            <LoadingCard />
          </main>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="flex min-h-screen bg-gray-50">
        <Navigation />
        
        <main className="flex-1 ml-64 p-8">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Gelir Yönetimi</h1>
                <p className="text-gray-600 mt-2">Dekont yükleyerek gelir kayıtlarınızı yönetin</p>
              </div>
              {user?.role === 'admin' && (
                <Button 
                  onClick={() => setShowForm(true)}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Yeni Gelir Kaydı
                </Button>
              )}
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <TrendingUp className="h-6 w-6 text-green-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-500">Toplam Gelir</p>
                      <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalIncome)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <FileText className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-500">Toplam Kayıt</p>
                      <p className="text-2xl font-bold text-gray-900">{statistics?.total_records || incomeRecords.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="p-2 bg-yellow-100 rounded-lg">
                      <Calendar className="h-6 w-6 text-yellow-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-500">Bekleyen</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {statistics?.pending_count || incomeRecords.filter(r => r.status === 'pending').length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <Check className="h-6 w-6 text-green-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-500">Onaylanan</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {statistics?.verified_count || incomeRecords.filter(r => r.status === 'verified').length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Filters */}
            <Card className="mb-6">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <Input
                        placeholder="Şirket adı veya açıklama ara..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 w-64"
                      />
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Filter className="h-4 w-4 text-gray-500" />
                      <select
                        value={filter}
                        onChange={(e) => setFilter(e.target.value as any)}
                        className="border border-gray-300 rounded-md px-3 py-2 text-sm"
                      >
                        <option value="all">Tümü</option>
                        <option value="pending">Bekleyen</option>
                        <option value="verified">Onaylanan</option>
                        <option value="rejected">Reddedilen</option>
                      </select>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Income Records List */}
            <Card>
              <CardHeader>
                <CardTitle>Gelir Kayıtları</CardTitle>
                <CardDescription>Yüklenen dekontlar ve gelir bilgileri</CardDescription>
              </CardHeader>
              <CardContent>
                {filteredRecords.length > 0 ? (
                  <div className="space-y-4">
                    {filteredRecords.map((record) => (
                      <div key={record.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-2">
                              <Building className="h-5 w-5 text-gray-400" />
                              <h3 className="text-lg font-semibold text-gray-900">{record.company_name}</h3>
                              <Badge className={getStatusColor(record.status)}>
                                {getStatusLabel(record.status)}
                              </Badge>
                            </div>
                            
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                              <div>
                                <span className="font-medium">Tutar:</span>
                                <div className="text-lg font-bold text-green-600">
                                  {formatCurrency(record.amount, record.currency)}
                                </div>
                              </div>
                              <div>
                                <span className="font-medium">Banka Hesabı:</span>
                                <div>{record.bank_account_name}</div>
                              </div>
                              <div>
                                <span className="font-medium">Tarih:</span>
                                <div>{formatDate(record.income_date)}</div>
                              </div>
                              <div>
                                <span className="font-medium">Oluşturulma:</span>
                                <div>{formatDate(record.created_at)}</div>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-2 ml-4">
                            {record.has_receipt && (
                              <Button variant="outline" size="sm">
                                <Eye className="h-4 w-4 mr-1" />
                                Dekont
                              </Button>
                            )}
                            <Button variant="outline" size="sm">
                              <Download className="h-4 w-4 mr-1" />
                              İndir
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Gelir kaydı bulunamadı</h3>
                    <p className="text-gray-500 mb-4">
                      {filter === 'all' 
                        ? 'Henüz hiç gelir kaydı eklenmemiş.' 
                        : `${getStatusLabel(filter)} durumunda kayıt bulunamadı.`}
                    </p>
                    {filter === 'all' && (
                      <Button onClick={() => setShowForm(true)} className="bg-green-600 hover:bg-green-700">
                        <Upload className="h-4 w-4 mr-2" />
                        İlk Gelir Kaydını Ekle
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>

        {/* New Income Record Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-900">Yeni Gelir Kaydı</h2>
                  <Button variant="ghost" onClick={() => setShowForm(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Company Name */}
                  <div>
                    <Label htmlFor="company_name">Şirket Adı *</Label>
                    <Input
                      id="company_name"
                      value={formData.company_name}
                      onChange={(e) => handleInputChange('company_name', e.target.value)}
                      placeholder="Ödeme yapan şirket adı"
                      required
                    />
                  </div>

                  {/* Amount and Currency */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="amount">Tutar *</Label>
                      <Input
                        id="amount"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.amount || ''}
                        onChange={(e) => handleInputChange('amount', parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="currency">Para Birimi</Label>
                      <select
                        id="currency"
                        value={formData.currency}
                        onChange={(e) => handleInputChange('currency', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                      >
                        <option value="TRY">TRY</option>
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                      </select>
                    </div>
                  </div>

                  {/* Bank Account */}
                  <div>
                    <Label htmlFor="bank_account_id">Banka Hesabı *</Label>
                    <select
                      id="bank_account_id"
                      value={formData.bank_account_id}
                      onChange={(e) => handleInputChange('bank_account_id', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                      required
                    >
                      <option value="">Para yatırılan hesabı seçin</option>
                      {bankAccounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.bank_name} - {account.account_number}
                          ({formatCurrency(account.current_balance, account.currency)})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Income Date */}
                  <div>
                    <Label htmlFor="income_date">Gelir Tarihi *</Label>
                    <Input
                      id="income_date"
                      type="date"
                      value={formData.income_date}
                      onChange={(e) => handleInputChange('income_date', e.target.value)}
                      required
                    />
                  </div>

                  {/* Receipt File */}
                  <div>
                    <Label htmlFor="receipt_file">Dekont/Makbuz</Label>
                    <Input
                      id="receipt_file"
                      type="file"
                      accept="image/*,.pdf"
                      onChange={handleFileChange}
                      className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      PNG, JPG veya PDF formatında dosya yükleyebilirsiniz (max 10MB)
                    </p>
                  </div>

                  {/* Description */}
                  <div>
                    <Label htmlFor="description">Açıklama</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => handleInputChange('description', e.target.value)}
                      placeholder="Gelir ile ilgili açıklama (opsiyonel)"
                      rows={3}
                    />
                  </div>

                  {/* Submit Buttons */}
                  <div className="flex justify-end space-x-3 pt-6">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowForm(false)}
                    >
                      İptal
                    </Button>
                    <Button
                      type="submit"
                      disabled={uploading}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {uploading ? (
                        <>
                          <LoadingSpinner size="sm" className="mr-2" />
                          Kaydediliyor...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Gelir Kaydını Oluştur
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}