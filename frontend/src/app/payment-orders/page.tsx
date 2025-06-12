'use client';

import { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import Navigation from '@/components/Navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  paymentOrdersApi, 
  PaymentOrder, 
  PaymentOrderCreate, 
  PaymentStatus,
  categoryLabels,
  statusLabels,
  statusColors
} from '@/lib/api/paymentOrders';
import { bankAccountsApi, BankAccountSummary } from '@/lib/api/bankAccounts';
import { useForm } from 'react-hook-form';

export default function PaymentOrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<PaymentOrder[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccountSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState<string | null>(null);
  const [selectedBankAccount, setSelectedBankAccount] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | 'all'>('all');
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset
  } = useForm<PaymentOrderCreate>();

  useEffect(() => {
    loadOrders();
    if (user?.role === 'admin') {
      loadBankAccounts();
    }
  }, [user, statusFilter]);

  const loadOrders = async () => {
    try {
      setIsLoading(true);
      const params = statusFilter !== 'all' ? { status_filter: statusFilter } : {};
      const data = await paymentOrdersApi.getAll(params);
      setOrders(data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Emirler yüklenirken hata oluştu');
    } finally {
      setIsLoading(false);
    }
  };

  const loadBankAccounts = async () => {
    try {
      const accounts = await bankAccountsApi.getSummary();
      setBankAccounts(accounts);
    } catch (err: any) {
      console.error('Bank accounts loading error:', err);
    }
  };

  const onSubmit = async (data: PaymentOrderCreate) => {
    try {
      setError('');
      
      // Clean data - remove empty strings
      const cleanData = {
        ...data,
        due_date: data.due_date || undefined,
        category: data.category || undefined
      };
      
      await paymentOrdersApi.create(cleanData);
      await loadOrders();
      setShowCreateForm(false);
      reset();
    } catch (err: any) {
      const errorDetail = err.response?.data?.detail;
      if (Array.isArray(errorDetail)) {
        const errorMessages = errorDetail.map((error: any) => error.msg).join(', ');
        setError(errorMessages);
      } else {
        setError(errorDetail || 'Ödeme emri oluşturulurken hata oluştu');
      }
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await paymentOrdersApi.approve(id);
      await loadOrders();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Onaylama işlemi başarısız');
    }
  };

  const handleReject = async () => {
    if (!showRejectModal || !rejectionReason.trim()) return;
    
    try {
      await paymentOrdersApi.reject(showRejectModal, rejectionReason);
      await loadOrders();
      setShowRejectModal(null);
      setRejectionReason('');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Reddetme işlemi başarısız');
    }
  };

  const openRejectModal = (id: string) => {
    setShowRejectModal(id);
    setRejectionReason('');
  };

  const closeRejectModal = () => {
    setShowRejectModal(null);
    setRejectionReason('');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setAnalysisResult(null);
      
      // For admin users, we'll skip auto-analysis and do it during payment processing
      setIsAnalyzing(false);
      setAnalysisResult(null);
    }
  };

  const handleComplete = async () => {
    if (showCompleteModal && selectedBankAccount && selectedFile) {
      try {
        setIsProcessing(true);
        setIsAnalyzing(true);
        
        // İlk aşama: AI doğrulama
        const result = await paymentOrdersApi.verifyPayment(
          showCompleteModal, 
          selectedBankAccount, 
          selectedFile
        );
        
        setVerificationResult(result);
        setAnalysisResult(result);
        setShowConfirmModal(true);
      } catch (err: any) {
        setError(err.response?.data?.detail || 'Doğrulama işlemi başarısız');
      } finally {
        setIsProcessing(false);
        setIsAnalyzing(false);
      }
    }
  };

  const handleConfirmPayment = async () => {
    if (verificationResult && showCompleteModal && selectedBankAccount) {
      try {
        setIsProcessing(true);
        
        // İkinci aşama: Ödemeyi onayla ve işle
        await paymentOrdersApi.confirmPayment(
          showCompleteModal,
          verificationResult.temp_file_path,
          selectedBankAccount
        );
        
        await loadOrders();
        setShowCompleteModal(null);
        setShowConfirmModal(false);
        setSelectedBankAccount('');
        setSelectedFile(null);
        setAnalysisResult(null);
        setVerificationResult(null);
      } catch (err: any) {
        setError(err.response?.data?.detail || 'Ödeme işlemi başarısız');
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handleDelete = async (id: string, recipientName: string) => {
    if (confirm(`"${recipientName}" için ödeme emrini silmek istediğinizden emin misiniz?`)) {
      try {
        await paymentOrdersApi.delete(id);
        await loadOrders();
      } catch (err: any) {
        setError(err.response?.data?.detail || 'Silme işlemi başarısız');
      }
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

  if (isLoading) {
    return (
      <ProtectedRoute>
        <div className="flex min-h-screen bg-gray-50">
          <Navigation />
          <div className="flex-1 ml-64 flex items-center justify-center">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="flex min-h-screen bg-gray-50">
        <Navigation />
        
        <div className="flex-1 ml-64">
          {/* Header */}
          <header className="bg-white shadow-sm border-b">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center py-4">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    {user?.role === 'admin' ? 'Ödemeler' : 'Ödeme Emirleri'}
                  </h1>
                  <p className="text-sm text-gray-500 mt-1">
                    Toplam {orders.length} ödeme emri
                  </p>
                </div>
                <div className="flex items-center space-x-4">
                  {/* Status Filter */}
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as PaymentStatus | 'all')}
                    className="border border-gray-300 rounded-md px-3 py-2 text-sm"
                  >
                    <option value="all">Tüm Durumlar</option>
                    <option value="pending">Bekliyor</option>
                    <option value="approved">Onaylandı</option>
                    <option value="completed">Tamamlandı</option>
                    <option value="rejected">Reddedildi</option>
                  </select>
                  
                  <button
                    onClick={() => setShowCreateForm(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    {user?.role === 'admin' ? '+ Yeni Ödeme' : '+ Yeni Emir'}
                  </button>
                </div>
              </div>
            </div>
          </header>

          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {error && (
              <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
                <div className="flex justify-between">
                  <h3 className="text-sm font-medium text-red-800">{error}</h3>
                  <button 
                    onClick={() => setError('')}
                    className="text-red-500 hover:text-red-700"
                  >
                    ×
                  </button>
                </div>
              </div>
            )}

            {/* Create Form Modal */}
            {showCreateForm && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-screen overflow-y-auto">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    {user?.role === 'admin' ? 'Yeni Ödeme' : 'Yeni Ödeme Emri'}
                  </h3>
                  
                  <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Alıcı Adı</label>
                      <input
                        {...register('recipient_name', { required: 'Alıcı adı gerekli' })}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        placeholder="örn: ABC Tedarikçi Ltd."
                      />
                      {errors.recipient_name && <p className="mt-1 text-sm text-red-600">{errors.recipient_name.message}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Alıcı IBAN</label>
                      <input
                        {...register('recipient_iban', { 
                          required: 'IBAN gerekli',
                          minLength: { value: 26, message: 'IBAN en az 26 karakter olmalı' }
                        })}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        placeholder="TR123456789012345678901234"
                        maxLength={34}
                      />
                      {errors.recipient_iban && <p className="mt-1 text-sm text-red-600">{errors.recipient_iban.message}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Tutar</label>
                      <input
                        {...register('amount', { 
                          required: 'Tutar gerekli',
                          valueAsNumber: true,
                          min: { value: 0.01, message: 'Tutar pozitif olmalı' }
                        })}
                        type="number"
                        step="0.01"
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        placeholder="0.00"
                      />
                      {errors.amount && <p className="mt-1 text-sm text-red-600">{errors.amount.message}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Para Birimi</label>
                      <select
                        {...register('currency')}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="TRY">TRY</option>
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Kategori</label>
                      <select
                        {...register('category')}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      >
                        {Object.entries(categoryLabels).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Açıklama</label>
                      <textarea
                        {...register('description', { required: 'Açıklama gerekli' })}
                        rows={3}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Ödeme açıklaması..."
                      />
                      {errors.description && <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Vade Tarihi (Opsiyonel)</label>
                      <input
                        {...register('due_date')}
                        type="date"
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div className="flex space-x-3 pt-4">
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                      >
                        {isSubmitting ? 'Oluşturuluyor...' : 'Oluştur'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowCreateForm(false);
                          reset();
                          setError('');
                        }}
                        className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400"
                      >
                        İptal
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Complete Modal */}
            {showCompleteModal && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-screen overflow-y-auto">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    {user?.role === 'admin' ? 'Ödeme Yap' : 'Ödeme Emrini Tamamla'}
                  </h3>
                  
                  <div className="space-y-6">
                    {/* Bank Account Selection */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Banka Hesabı Seçin</label>
                      <select
                        value={selectedBankAccount}
                        onChange={(e) => setSelectedBankAccount(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">Hesap seçin...</option>
                        {bankAccounts.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.name} - {formatCurrency(account.current_balance, account.currency)}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Receipt Upload */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Dekont/Transfer Belgesi Yükleyin
                      </label>
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                        <input
                          type="file"
                          onChange={handleFileChange}
                          accept="image/jpeg,image/png,image/jpg"
                          className="hidden"
                          id="receipt-upload"
                        />
                        <label
                          htmlFor="receipt-upload"
                          className="cursor-pointer flex flex-col items-center"
                        >
                          <div className="text-4xl mb-2">📄</div>
                          <div className="text-sm text-gray-600">
                            {selectedFile ? selectedFile.name : 'Dekont dosyası seçmek için tıklayın'}
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            JPG, PNG formatları desteklenir
                          </div>
                        </label>
                      </div>
                    </div>

                    {/* Analysis Loading */}
                    {isAnalyzing && (
                      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                        <div className="flex items-center">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                          <span className="text-sm text-blue-800">Dekont AI ile analiz ediliyor...</span>
                        </div>
                      </div>
                    )}

                    {/* Analysis Results */}
                    {analysisResult && (
                      <div className={`border rounded-md p-4 ${
                        analysisResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                      }`}>
                        <h4 className={`font-medium text-sm mb-2 ${
                          analysisResult.success ? 'text-green-800' : 'text-red-800'
                        }`}>
                          {analysisResult.success ? 'Dekont Analizi Başarılı' : 'Dekont Analizi Başarısız'}
                        </h4>
                        
                        {analysisResult.success ? (
                          <div className="text-sm space-y-1">
                            {analysisResult.extracted_amount && (
                              <div>Tutar: <span className="font-medium">{formatCurrency(analysisResult.extracted_amount)}</span></div>
                            )}
                            {analysisResult.total_extracted_fees && analysisResult.total_extracted_fees > 0 && (
                              <div>Toplam Ücret: <span className="font-medium text-red-600">{formatCurrency(analysisResult.total_extracted_fees)}</span></div>
                            )}
                            {analysisResult.extracted_bank && (
                              <div>Banka: <span className="font-medium">{analysisResult.extracted_bank}</span></div>
                            )}
                            {analysisResult.confidence_score && (
                              <div>Güven Skoru: <span className="font-medium">{Math.round(analysisResult.confidence_score * 100)}%</span></div>
                            )}
                          </div>
                        ) : (
                          <div className="text-sm text-red-700">
                            {analysisResult.error_message || 'Dekont analizi başarısız oldu'}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex space-x-3 pt-4">
                      <button
                        onClick={handleComplete}
                        disabled={!selectedBankAccount || !selectedFile || isProcessing}
                        className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50"
                      >
                        {isProcessing ? 'İşleniyor...' : (user?.role === 'admin' ? 'AI Doğrulama Yap' : 'Ödemeyi Tamamla')}
                      </button>
                      <button
                        onClick={() => {
                          setShowCompleteModal(null);
                          setSelectedBankAccount('');
                          setSelectedFile(null);
                          setAnalysisResult(null);
                        }}
                        className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400"
                      >
                        İptal
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* AI Verification Confirmation Modal */}
            {showConfirmModal && verificationResult && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-lg max-w-3xl w-full p-6 max-h-screen overflow-y-auto">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">AI Doğrulama Sonucu</h3>
                  
                  <div className="space-y-6">
                    {/* Verification Status */}
                    <div className={`border rounded-md p-4 ${
                      verificationResult.recommendation === 'APPROVE' ? 'bg-green-50 border-green-200' : 
                      verificationResult.recommendation === 'REJECT' ? 'bg-red-50 border-red-200' : 
                      'bg-yellow-50 border-yellow-200'
                    }`}>
                      <h4 className={`font-medium text-sm mb-2 ${
                        verificationResult.recommendation === 'APPROVE' ? 'text-green-800' : 
                        verificationResult.recommendation === 'REJECT' ? 'text-red-800' : 
                        'text-yellow-800'
                      }`}>
                        Doğrulama Durumu: {verificationResult.recommendation === 'APPROVE' ? 'ONAYLANDI' : 
                                           verificationResult.recommendation === 'REJECT' ? 'REDDEDİLDİ' : 'GÖZDEN GEÇİRİLMELİ'}
                      </h4>
                      {verificationResult.analysis_notes && (
                        <p className="text-sm text-gray-700">{verificationResult.analysis_notes}</p>
                      )}
                    </div>

                    {/* Amount Summary */}
                    <div className="bg-gray-50 rounded-md p-4">
                      <h4 className="font-medium text-sm text-gray-900 mb-2">Tutar Özeti</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>Ödeme Emri Tutarı: <span className="font-medium">{formatCurrency(verificationResult.amount_summary?.ordered_amount || 0)}</span></div>
                        <div>Gerçek Transfer: <span className="font-medium">{formatCurrency(verificationResult.amount_summary?.actual_transfer || 0)}</span></div>
                        <div>Toplam Ücretler: <span className="font-medium text-red-600">{formatCurrency(verificationResult.amount_summary?.total_fees || 0)}</span></div>
                        <div>Toplam Düşülecek: <span className="font-medium text-red-600">{formatCurrency(verificationResult.amount_summary?.total_deducted || 0)}</span></div>
                      </div>
                      {verificationResult.amount_summary?.amount_difference !== 0 && (
                        <div className="mt-2 text-sm text-orange-600">
                          Tutar Farkı: {formatCurrency(verificationResult.amount_summary?.amount_difference || 0)}
                        </div>
                      )}
                    </div>

                    {/* Fees Breakdown */}
                    {verificationResult.fees_breakdown && verificationResult.fees_breakdown.total_fees > 0 && (
                      <div className="bg-gray-50 rounded-md p-4">
                        <h4 className="font-medium text-sm text-gray-900 mb-2">Ücret Detayları</h4>
                        <div className="space-y-1 text-sm">
                          {verificationResult.fees_breakdown.transfer_fee > 0 && (
                            <div>Transfer Ücreti: {formatCurrency(verificationResult.fees_breakdown.transfer_fee)}</div>
                          )}
                          {verificationResult.fees_breakdown.commission > 0 && (
                            <div>Komisyon: {formatCurrency(verificationResult.fees_breakdown.commission)}</div>
                          )}
                          {verificationResult.fees_breakdown.vat_on_fee > 0 && (
                            <div>KDV: {formatCurrency(verificationResult.fees_breakdown.vat_on_fee)}</div>
                          )}
                          {verificationResult.fees_breakdown.other_fees > 0 && (
                            <div>Diğer Ücretler: {formatCurrency(verificationResult.fees_breakdown.other_fees)}</div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Anomalies */}
                    {verificationResult.anomalies && verificationResult.anomalies.length > 0 && (
                      <div className="bg-red-50 border border-red-200 rounded-md p-4">
                        <h4 className="font-medium text-sm text-red-800 mb-2">Tespit Edilen Sorunlar</h4>
                        <ul className="text-sm text-red-700 space-y-1">
                          {verificationResult.anomalies.map((anomaly: string, index: number) => (
                            <li key={index}>• {anomaly}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Bank Balance Warning */}
                    {verificationResult.insufficient_balance && (
                      <div className="bg-red-50 border border-red-200 rounded-md p-4">
                        <h4 className="font-medium text-sm text-red-800 mb-2">Yetersiz Bakiye</h4>
                        <p className="text-sm text-red-700">
                          Bu ödeme için {formatCurrency(verificationResult.required_amount)} gerekli, 
                          hesapta {formatCurrency(verificationResult.available_balance)} mevcut.
                        </p>
                      </div>
                    )}

                    {/* Extracted Data */}
                    <div className="bg-gray-50 rounded-md p-4">
                      <h4 className="font-medium text-sm text-gray-900 mb-2">Dekonttan Çıkarılan Bilgiler</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>Alıcı: {verificationResult.extracted_data?.recipient_name || 'Okunamadı'}</div>
                        <div>IBAN: {verificationResult.extracted_data?.recipient_iban || 'Okunamadı'}</div>
                        <div>Tarih: {verificationResult.extracted_data?.transaction_date || 'Okunamadı'}</div>
                        <div>Referans: {verificationResult.extracted_data?.reference_number || 'Okunamadı'}</div>
                      </div>
                    </div>

                    <div className="flex space-x-3 pt-4">
                      {verificationResult.recommendation === 'REJECT' || verificationResult.insufficient_balance ? (
                        <div className="flex-1 bg-red-100 border border-red-300 rounded-lg p-3 text-center">
                          <p className="text-red-800 font-medium text-sm">
                            ⚠️ Bu ödeme onaylanamaz
                          </p>
                          <p className="text-red-600 text-xs mt-1">
                            Lütfen sorunları düzeltin veya doğru dekont yükleyin
                          </p>
                        </div>
                      ) : (
                        <button
                          onClick={handleConfirmPayment}
                          disabled={isProcessing}
                          className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50"
                        >
                          {isProcessing ? 'İşleniyor...' : 'Ödemeyi Onayla ve Kaydet'}
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setShowConfirmModal(false);
                          setVerificationResult(null);
                          setAnalysisResult(null);
                        }}
                        className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400"
                      >
                        İptal
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Orders List */}
            {orders.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <div className="text-4xl mb-4">💸</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Henüz ödeme emri yok</h3>
                <p className="text-gray-500">
                  İlk ödeme emrinizi oluşturmak için "Yeni Emir" butonunu kullanın.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {orders.map((order) => (
                  <div key={order._id} className="bg-white rounded-lg shadow p-6">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <h3 className="text-lg font-semibold text-gray-900">{order.recipient_name}</h3>
                          <span className={`px-2 py-1 text-xs rounded-full ${statusColors[order.status]}`}>
                            {statusLabels[order.status]}
                          </span>
                          {order.category && (
                            <span className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded-full">
                              {categoryLabels[order.category]}
                            </span>
                          )}
                        </div>
                        
                        <p className="text-sm text-gray-500 mt-1">IBAN: {order.recipient_iban}</p>
                        <p className="text-lg font-semibold text-green-600 mt-2">
                          {formatCurrency(order.amount, order.currency)}
                        </p>
                        
                        <div className="mt-3">
                          <p className="text-sm text-gray-700">{order.ai_processed_description || order.description}</p>
                          {order.ai_processed_description && order.ai_processed_description !== order.description && (
                            <details className="mt-2">
                              <summary className="text-xs text-gray-500 cursor-pointer">Orijinal açıklama</summary>
                              <p className="text-xs text-gray-400 mt-1">{order.description}</p>
                            </details>
                          )}
                        </div>
                        
                        <div className="flex items-center space-x-4 mt-3 text-sm text-gray-500">
                          <span>Oluşturulma: {formatDate(order.created_at)}</span>
                          {order.due_date && <span>Vade: {formatDate(order.due_date)}</span>}
                          {order.completed_at && <span>Tamamlandı: {formatDate(order.completed_at)}</span>}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col space-y-2 ml-4">
                        {user?.role === 'admin' && ['pending', 'approved'].includes(order.status) && (
                          <button
                            onClick={() => setShowCompleteModal(order._id)}
                            className="text-sm bg-blue-50 text-blue-600 py-2 px-3 rounded-lg hover:bg-blue-100"
                          >
                            Ödeme Yap
                          </button>
                        )}

                        {user?.role === 'admin' && order.status === 'pending' && (
                          <button
                            onClick={() => openRejectModal(order._id)}
                            className="text-sm bg-orange-50 text-orange-600 py-2 px-3 rounded-lg hover:bg-orange-100"
                          >
                            Reddet
                          </button>
                        )}
                        
                        {((user?.role === 'user' && order.created_by === user.id && ['pending', 'rejected'].includes(order.status)) || 
                          user?.role === 'admin') && (
                          <button
                            onClick={() => handleDelete(order._id, order.recipient_name)}
                            className="text-sm bg-red-50 text-red-600 py-2 px-3 rounded-lg hover:bg-red-100"
                          >
                            Sil
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </main>

          {/* Reject Modal */}
          <Dialog open={!!showRejectModal} onOpenChange={() => closeRejectModal()}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Ödeme Emrini Reddet</DialogTitle>
                <DialogDescription>
                  Bu ödeme emrini reddetme sebebinizi belirtin.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="rejection_reason">Reddetme Sebebi *</Label>
                  <Textarea
                    id="rejection_reason"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Reddetme sebebini açıklayın..."
                    rows={4}
                    required
                  />
                </div>
                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={closeRejectModal}>
                    İptal
                  </Button>
                  <Button 
                    variant="destructive" 
                    onClick={handleReject}
                    disabled={!rejectionReason.trim()}
                  >
                    Reddet
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </ProtectedRoute>
  );
}