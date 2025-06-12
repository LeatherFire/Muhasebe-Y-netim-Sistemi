'use client';

import { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import Navigation from '@/components/Navigation';
import { useAuth } from '@/contexts/AuthContext';
import { bankAccountsApi, BankAccount, BankAccountCreate } from '@/lib/api/bankAccounts';
import { useForm } from 'react-hook-form';
import DeleteConfirmationModal from '@/components/ui/delete-confirmation-modal';

const accountTypeLabels = {
  checking: 'Vadesiz',
  savings: 'Vadeli',
  business: 'Ticari',
  foreign: 'Döviz'
};

export default function BankAccountsPage() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<BankAccount | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset
  } = useForm<BankAccountCreate>();

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      setIsLoading(true);
      const data = await bankAccountsApi.getAll();
      setAccounts(data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Hesaplar yüklenirken hata oluştu');
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = async (data: BankAccountCreate) => {
    try {
      setError('');
      await bankAccountsApi.create(data);
      await loadAccounts();
      setShowCreateForm(false);
      reset();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Hesap oluşturulurken hata oluştu');
    }
  };

  const handleDelete = async () => {
    if (!accountToDelete) return;

    try {
      setDeleteLoading(true);
      await bankAccountsApi.delete(accountToDelete._id);
      setIsDeleteDialogOpen(false);
      setAccountToDelete(null);
      await loadAccounts();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Hesap silinirken hata oluştu');
    } finally {
      setDeleteLoading(false);
    }
  };

  const openDeleteDialog = (account: BankAccount) => {
    setAccountToDelete(account);
    setIsDeleteDialogOpen(true);
  };

  const closeDeleteDialog = () => {
    setIsDeleteDialogOpen(false);
    setAccountToDelete(null);
  };

  const formatCurrency = (amount: number, currency: string = 'TRY') => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const totalBalance = accounts.reduce((sum, account) => {
    if (account.currency === 'TRY') {
      return sum + account.current_balance;
    }
    return sum;
  }, 0);

  if (isLoading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
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
                  <h1 className="text-2xl font-bold text-gray-900">Banka Hesapları</h1>
                  <p className="text-sm text-gray-500 mt-1">
                    Toplam Bakiye (TRY): <span className="font-semibold">{formatCurrency(totalBalance)}</span>
                  </p>
                </div>
                {user?.role === 'admin' && (
                  <button
                    onClick={() => setShowCreateForm(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    + Yeni Hesap
                  </button>
                )}
              </div>
            </div>
          </header>

          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">{error}</h3>
                </div>
                <button 
                  onClick={() => setError('')}
                  className="ml-auto text-red-500 hover:text-red-700"
                >
                  ×
                </button>
              </div>
            </div>
          )}

          {/* Create Form Modal */}
          {showCreateForm && user?.role === 'admin' && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-lg max-w-md w-full p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Yeni Banka Hesabı</h3>
                
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Hesap Adı</label>
                    <input
                      {...register('name', { required: 'Hesap adı gerekli' })}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="örn: İş Bankası Vadesiz"
                    />
                    {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">IBAN</label>
                    <input
                      {...register('iban', { 
                        required: 'IBAN gerekli',
                        minLength: { value: 26, message: 'IBAN en az 26 karakter olmalı' }
                      })}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="TR123456789012345678901234"
                      maxLength={34}
                    />
                    {errors.iban && <p className="mt-1 text-sm text-red-600">{errors.iban.message}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Banka Adı</label>
                    <input
                      {...register('bank_name', { required: 'Banka adı gerekli' })}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="örn: Türkiye İş Bankası"
                    />
                    {errors.bank_name && <p className="mt-1 text-sm text-red-600">{errors.bank_name.message}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Hesap Türü</label>
                    <select
                      {...register('account_type')}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="checking">Vadesiz</option>
                      <option value="savings">Vadeli</option>
                      <option value="business">Ticari</option>
                      <option value="foreign">Döviz</option>
                    </select>
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
                    <label className="block text-sm font-medium text-gray-700">Başlangıç Bakiyesi</label>
                    <input
                      {...register('initial_balance', { 
                        required: 'Başlangıç bakiyesi gerekli',
                        valueAsNumber: true,
                        min: { value: 0, message: 'Bakiye 0 veya pozitif olmalı' }
                      })}
                      type="number"
                      step="0.01"
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="0.00"
                    />
                    {errors.initial_balance && <p className="mt-1 text-sm text-red-600">{errors.initial_balance.message}</p>}
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

          {/* Accounts List */}
          {accounts.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <div className="text-4xl mb-4">🏦</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Henüz banka hesabı yok</h3>
              <p className="text-gray-500">
                {user?.role === 'admin' 
                  ? 'İlk banka hesabınızı oluşturmak için "Yeni Hesap" butonunu kullanın.'
                  : 'Admin tarafından banka hesapları eklenmesini bekleyin.'
                }
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {accounts.map((account) => (
                <div key={account._id} className="bg-white rounded-lg shadow p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{account.name}</h3>
                      <p className="text-sm text-gray-500">{account.bank_name}</p>
                    </div>
                    <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                      {accountTypeLabels[account.account_type]}
                    </span>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">IBAN:</span>
                      <span className="text-sm font-mono">{account.iban.slice(0, 8)}...{account.iban.slice(-4)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Güncel Bakiye:</span>
                      <span className={`text-sm font-semibold ${account.current_balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(account.current_balance, account.currency)}
                      </span>
                    </div>
                  </div>

                  {user?.role === 'admin' && (
                    <div className="flex space-x-2">
                      <button
                        onClick={() => openDeleteDialog(account)}
                        className="flex-1 text-sm bg-red-50 text-red-600 py-2 px-3 rounded-lg hover:bg-red-100"
                      >
                        Sil
                      </button>
                      <button className="flex-1 text-sm bg-blue-50 text-blue-600 py-2 px-3 rounded-lg hover:bg-blue-100">
                        Düzenle
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
            title="Banka Hesabını Sil"
            description="Bu banka hesabını silmek istediğinizden emin misiniz? Bu işlem geri alınamaz ve hesapla ilgili tüm işlemler etkilenebilir."
            itemName={accountToDelete ? `${accountToDelete.name} - ${accountToDelete.bank_name}` : undefined}
            loading={deleteLoading}
          />
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}