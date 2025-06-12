'use client';

import { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import Navigation from '@/components/Navigation';
import { formatApiError } from '@/lib/auth';
import { useAuth } from '@/contexts/AuthContext';
import DeleteConfirmationModal from '@/components/ui/delete-confirmation-modal';
import { 
  creditCardsApi, 
  CreditCardSummary,
  CreditCardCreate,
  CreditCardTransactionCreate,
  CreditCardPaymentCreate,
  paymentTypeLabels,
  categoryLabels
} from '@/lib/api/creditCards';
import { bankAccountsApi, BankAccountSummary } from '@/lib/api/bankAccounts';
import { useForm } from 'react-hook-form';

export default function CreditCardsPage() {
  const { user } = useAuth();
  const [cards, setCards] = useState<CreditCardSummary[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccountSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showTransactionForm, setShowTransactionForm] = useState<string | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [cardToDelete, setCardToDelete] = useState<CreditCardSummary | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const {
    register: registerCard,
    handleSubmit: handleSubmitCard,
    formState: { errors: cardErrors, isSubmitting: isSubmittingCard },
    reset: resetCard
  } = useForm<CreditCardCreate>();

  const {
    register: registerTransaction,
    handleSubmit: handleSubmitTransaction,
    formState: { errors: transactionErrors, isSubmitting: isSubmittingTransaction },
    reset: resetTransaction
  } = useForm<CreditCardTransactionCreate>();

  const {
    register: registerPayment,
    handleSubmit: handleSubmitPayment,
    formState: { errors: paymentErrors, isSubmitting: isSubmittingPayment },
    reset: resetPayment
  } = useForm<CreditCardPaymentCreate>();

  useEffect(() => {
    loadCards();
    if (user?.role === 'admin') {
      loadBankAccounts();
    }
  }, [user]);

  const loadCards = async () => {
    try {
      setIsLoading(true);
      const data = await creditCardsApi.getSummary();
      setCards(data);
    } catch (err: unknown) {
      setError(formatApiError(err) || 'Kredi kartları yüklenirken hata oluştu');
    } finally {
      setIsLoading(false);
    }
  };

  const loadBankAccounts = async () => {
    try {
      const accounts = await bankAccountsApi.getSummary();
      setBankAccounts(accounts);
    } catch (err: unknown) {
      console.error('Bank accounts loading error:', err);
    }
  };

  const onSubmitCard = async (data: CreditCardCreate) => {
    try {
      setError('');
      
      // Clean up data - handle NaN values
      const cleanData = {
        ...data,
        used_amount: isNaN(data.used_amount as any) || !data.used_amount ? 0 : data.used_amount,
        flexible_account: data.flexible_account || false
      };
      
      console.log('Submitting credit card data:', cleanData);
      await creditCardsApi.create(cleanData);
      await loadCards();
      setShowCreateForm(false);
      resetCard();
    } catch (err: unknown) {
      console.error('Credit card creation error:', err);
      console.error('Error response:', (err as any)?.response);
      setError(formatApiError(err) || 'Kredi kartı oluşturulurken hata oluştu');
    }
  };

  const onSubmitTransaction = async (data: CreditCardTransactionCreate) => {
    if (!showTransactionForm) return;
    
    try {
      setError('');
      await creditCardsApi.createTransaction(showTransactionForm, {
        ...data,
        credit_card_id: showTransactionForm
      });
      await loadCards();
      setShowTransactionForm(null);
      resetTransaction();
    } catch (err: unknown) {
      setError(formatApiError(err) || 'İşlem eklenirken hata oluştu');
    }
  };

  const onSubmitPayment = async (data: CreditCardPaymentCreate) => {
    if (!showPaymentForm) return;
    
    try {
      setError('');
      await creditCardsApi.createPayment(showPaymentForm, {
        ...data,
        credit_card_id: showPaymentForm
      });
      await loadCards();
      setShowPaymentForm(null);
      resetPayment();
    } catch (err: unknown) {
      setError(formatApiError(err) || 'Ödeme eklenirken hata oluştu');
    }
  };

  const handleDelete = async () => {
    if (!cardToDelete) return;

    try {
      setDeleteLoading(true);
      await creditCardsApi.delete(cardToDelete.id);
      setIsDeleteDialogOpen(false);
      setCardToDelete(null);
      await loadCards();
    } catch (err: unknown) {
      setError(formatApiError(err) || 'Silme işlemi başarısız');
    } finally {
      setDeleteLoading(false);
    }
  };

  const openDeleteDialog = (card: CreditCardSummary) => {
    setCardToDelete(card);
    setIsDeleteDialogOpen(true);
  };

  const closeDeleteDialog = () => {
    setIsDeleteDialogOpen(false);
    setCardToDelete(null);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
    }).format(amount);
  };

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'text-red-600 bg-red-100';
    if (percentage >= 70) return 'text-orange-600 bg-orange-100';
    if (percentage >= 50) return 'text-yellow-600 bg-yellow-100';
    return 'text-green-600 bg-green-100';
  };

  const getDaysColor = (days: number) => {
    if (days <= 3) return 'text-red-600';
    if (days <= 7) return 'text-orange-600';
    return 'text-gray-600';
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
                  <h1 className="text-2xl font-bold text-gray-900">Kredi Kartları</h1>
                  <p className="text-sm text-gray-500 mt-1">
                    Toplam {cards.length} kredi kartı
                  </p>
                </div>
                {user?.role === 'admin' && (
                  <button
                    onClick={() => setShowCreateForm(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    + Yeni Kart
                  </button>
                )}
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
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Yeni Kredi Kartı</h3>
                  
                  <form onSubmit={handleSubmitCard(onSubmitCard)} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Kart Adı</label>
                      <input
                        {...registerCard('name', { required: 'Kart adı gerekli' })}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        placeholder="örn: İş Bankası Maximum"
                      />
                      {cardErrors.name && <p className="mt-1 text-sm text-red-600">{cardErrors.name.message}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Banka Adı</label>
                      <input
                        {...registerCard('bank_name', { required: 'Banka adı gerekli' })}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        placeholder="örn: Türkiye İş Bankası"
                      />
                      {cardErrors.bank_name && <p className="mt-1 text-sm text-red-600">{cardErrors.bank_name.message}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Kart Limiti</label>
                      <input
                        {...registerCard('limit', { 
                          required: 'Limit gerekli',
                          valueAsNumber: true,
                          min: { value: 0.01, message: 'Limit pozitif olmalı' }
                        })}
                        type="number"
                        step="0.01"
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        placeholder="0.00"
                      />
                      {cardErrors.limit && <p className="mt-1 text-sm text-red-600">{cardErrors.limit.message}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Kullanılan Tutar (Opsiyonel)</label>
                      <input
                        {...registerCard('used_amount', { 
                          valueAsNumber: true,
                          min: { value: 0, message: 'Negatif olamaz' }
                        })}
                        type="number"
                        step="0.01"
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        placeholder="0.00"
                      />
                      {cardErrors.used_amount && <p className="mt-1 text-sm text-red-600">{cardErrors.used_amount.message}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Hesap Kesim Günü</label>
                        <input
                          {...registerCard('statement_date', { 
                            required: 'Kesim günü gerekli',
                            valueAsNumber: true,
                            min: { value: 1, message: 'En az 1' },
                            max: { value: 31, message: 'En fazla 31' }
                          })}
                          type="number"
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          placeholder="15"
                        />
                        {cardErrors.statement_date && <p className="mt-1 text-sm text-red-600">{cardErrors.statement_date.message}</p>}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">Son Ödeme Günü</label>
                        <input
                          {...registerCard('due_date', { 
                            required: 'Son ödeme günü gerekli',
                            valueAsNumber: true,
                            min: { value: 1, message: 'En az 1' },
                            max: { value: 31, message: 'En fazla 31' }
                          })}
                          type="number"
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          placeholder="5"
                        />
                        {cardErrors.due_date && <p className="mt-1 text-sm text-red-600">{cardErrors.due_date.message}</p>}
                      </div>
                    </div>

                    <div className="flex items-center">
                      <input
                        {...registerCard('flexible_account')}
                        type="checkbox"
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label className="ml-2 block text-sm text-gray-900">
                        Esnek hesap özelliği var
                      </label>
                    </div>

                    <div className="flex space-x-3 pt-4">
                      <button
                        type="submit"
                        disabled={isSubmittingCard}
                        className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                      >
                        {isSubmittingCard ? 'Oluşturuluyor...' : 'Oluştur'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowCreateForm(false);
                          resetCard();
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

            {/* Transaction Form Modal */}
            {showTransactionForm && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-screen overflow-y-auto">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Yeni İşlem Ekle</h3>
                  
                  <form onSubmit={handleSubmitTransaction(onSubmitTransaction)} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Tutar</label>
                      <input
                        {...registerTransaction('amount', { 
                          required: 'Tutar gerekli',
                          valueAsNumber: true,
                          min: { value: 0.01, message: 'Tutar pozitif olmalı' }
                        })}
                        type="number"
                        step="0.01"
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                      {transactionErrors.amount && <p className="mt-1 text-sm text-red-600">{transactionErrors.amount.message}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Açıklama</label>
                      <input
                        {...registerTransaction('description', { required: 'Açıklama gerekli' })}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        placeholder="İşlem açıklaması"
                      />
                      {transactionErrors.description && <p className="mt-1 text-sm text-red-600">{transactionErrors.description.message}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Kategori</label>
                      <select
                        {...registerTransaction('category')}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">Kategori seçin</option>
                        {Object.entries(categoryLabels).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Satıcı</label>
                      <input
                        {...registerTransaction('merchant')}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Satıcı adı"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">İşlem Tarihi</label>
                      <input
                        {...registerTransaction('transaction_date', { required: 'İşlem tarihi gerekli' })}
                        type="datetime-local"
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                      {transactionErrors.transaction_date && <p className="mt-1 text-sm text-red-600">{transactionErrors.transaction_date.message}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Taksit Sayısı</label>
                      <input
                        {...registerTransaction('installments', { 
                          valueAsNumber: true,
                          min: { value: 1, message: 'En az 1 taksit' }
                        })}
                        type="number"
                        defaultValue={1}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div className="flex space-x-3 pt-4">
                      <button
                        type="submit"
                        disabled={isSubmittingTransaction}
                        className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50"
                      >
                        {isSubmittingTransaction ? 'Ekleniyor...' : 'Ekle'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowTransactionForm(null);
                          resetTransaction();
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

            {/* Payment Form Modal */}
            {showPaymentForm && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-screen overflow-y-auto">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Kredi Kartı Ödemesi</h3>
                  
                  <form onSubmit={handleSubmitPayment(onSubmitPayment)} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Ödeme Tutarı</label>
                      <input
                        {...registerPayment('amount', { 
                          required: 'Tutar gerekli',
                          valueAsNumber: true,
                          min: { value: 0.01, message: 'Tutar pozitif olmalı' }
                        })}
                        type="number"
                        step="0.01"
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                      {paymentErrors.amount && <p className="mt-1 text-sm text-red-600">{paymentErrors.amount.message}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Ödeme Türü</label>
                      <select
                        {...registerPayment('payment_type', { required: 'Ödeme türü gerekli' })}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">Ödeme türü seçin</option>
                        {Object.entries(paymentTypeLabels).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                      {paymentErrors.payment_type && <p className="mt-1 text-sm text-red-600">{paymentErrors.payment_type.message}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Banka Hesabı (Opsiyonel)</label>
                      <select
                        {...registerPayment('bank_account_id')}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">Hesap seçin</option>
                        {bankAccounts.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.name} - {formatCurrency(account.current_balance)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Ödeme Tarihi</label>
                      <input
                        {...registerPayment('payment_date', { required: 'Ödeme tarihi gerekli' })}
                        type="datetime-local"
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                      {paymentErrors.payment_date && <p className="mt-1 text-sm text-red-600">{paymentErrors.payment_date.message}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Açıklama</label>
                      <input
                        {...registerPayment('description')}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Ödeme açıklaması"
                      />
                    </div>

                    <div className="flex space-x-3 pt-4">
                      <button
                        type="submit"
                        disabled={isSubmittingPayment}
                        className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50"
                      >
                        {isSubmittingPayment ? 'Ödeniyor...' : 'Öde'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowPaymentForm(null);
                          resetPayment();
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

            {/* Cards List */}
            {cards.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <div className="text-4xl mb-4">💳</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Henüz kredi kartı yok</h3>
                <p className="text-gray-500">
                  İlk kredi kartınızı eklemek için "Yeni Kart" butonunu kullanın.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {cards.map((card) => (
                  <div key={card.id} className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-blue-500">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{card.name}</h3>
                        <p className="text-sm text-gray-500">{card.bank_name}</p>
                      </div>
                      {card.flexible_account && (
                        <span className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded-full">
                          Esnek
                        </span>
                      )}
                    </div>

                    {/* Limit ve Kullanım */}
                    <div className="mb-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-gray-600">Kullanılan / Limit</span>
                        <span className={`text-xs px-2 py-1 rounded-full ${getUsageColor(card.usage_percentage)}`}>
                          %{card.usage_percentage}
                        </span>
                      </div>
                      <div className="text-lg font-semibold">
                        {formatCurrency(card.used_amount)} / {formatCurrency(card.limit)}
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                        <div 
                          className={`h-2 rounded-full ${
                            card.usage_percentage >= 90 ? 'bg-red-500' :
                            card.usage_percentage >= 70 ? 'bg-orange-500' :
                            card.usage_percentage >= 50 ? 'bg-yellow-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${Math.min(card.usage_percentage, 100)}%` }}
                        ></div>
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        Kullanılabilir: {formatCurrency(card.available_limit)}
                      </div>
                    </div>

                    {/* Tarih Bilgileri */}
                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Hesap Kesim:</span>
                        <span className={getDaysColor(card.days_to_statement)}>
                          {card.days_to_statement} gün ({card.statement_date}. gün)
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Son Ödeme:</span>
                        <span className={getDaysColor(card.days_to_due)}>
                          {card.days_to_due} gün ({card.due_date}. gün)
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    {user?.role === 'admin' && (
                      <div className="flex flex-col space-y-2">
                        <button
                          onClick={() => setShowTransactionForm(card.id)}
                          className="w-full bg-green-50 text-green-600 py-2 px-3 rounded-lg hover:bg-green-100 text-sm"
                        >
                          + İşlem Ekle
                        </button>
                        <button
                          onClick={() => setShowPaymentForm(card.id)}
                          className="w-full bg-blue-50 text-blue-600 py-2 px-3 rounded-lg hover:bg-blue-100 text-sm"
                        >
                          💳 Ödeme Yap
                        </button>
                        <button
                          onClick={() => openDeleteDialog(card)}
                          className="w-full bg-red-50 text-red-600 py-2 px-3 rounded-lg hover:bg-red-100 text-sm"
                        >
                          Sil
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Delete Confirmation Modal */}
            <DeleteConfirmationModal
              isOpen={isDeleteDialogOpen}
              onClose={closeDeleteDialog}
              onConfirm={handleDelete}
              title="Kredi Kartını Sil"
              description="Bu kredi kartını silmek istediğinizden emin misiniz? Bu işlem geri alınamaz ve kartla ilgili tüm işlemler silinecektir."
              itemName={cardToDelete ? `${cardToDelete.name} - ${cardToDelete.bank_name}` : undefined}
              loading={deleteLoading}
            />
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}