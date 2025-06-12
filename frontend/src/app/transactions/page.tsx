'use client';

import { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import Navigation from '@/components/Navigation';
import { useAuth } from '@/contexts/AuthContext';
import { 
  transactionsApi, 
  Transaction, 
  TransactionSummary,
  typeLabels,
  statusLabels,
  statusColors,
  typeColors
} from '@/lib/api/transactions';
import { bankAccountsApi, BankAccountSummary } from '@/lib/api/bankAccounts';
import AdvancedSearch from '@/components/AdvancedSearch';

export default function TransactionsPage() {
  const { } = useAuth();
  const [transactions, setTransactions] = useState<TransactionSummary[]>([]);
  const [allTransactions, setAllTransactions] = useState<TransactionSummary[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccountSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    transaction_type: '',
    bank_account_id: '',
    status_filter: '',
    start_date: '',
    end_date: ''
  });
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiChatHistory, setAiChatHistory] = useState<Array<{role: 'user'|'ai', message: string}>>([]);
  const [aiMessage, setAiMessage] = useState('');
  const [isAILoading, setIsAILoading] = useState(false);

  useEffect(() => {
    loadTransactions();
    loadBankAccounts();
  }, [filters]);

  const loadTransactions = async () => {
    try {
      setIsLoading(true);
      const data = await transactionsApi.getSummary();
      setAllTransactions(data);
      setTransactions(data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'İşlemler yüklenirken hata oluştu');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdvancedSearch = (query: string, searchFilters: any[]) => {
    setSearchQuery(query);
    
    let filteredTransactions = [...allTransactions];
    
    // Text search
    if (query.trim()) {
      filteredTransactions = filteredTransactions.filter(transaction =>
        transaction.description?.toLowerCase().includes(query.toLowerCase()) ||
        transaction.bank_account_name?.toLowerCase().includes(query.toLowerCase()) ||
        transaction.person_name?.toLowerCase().includes(query.toLowerCase())
      );
    }
    
    // Apply advanced filters
    searchFilters.forEach(filter => {
      switch (filter.key) {
        case 'amount_min':
          filteredTransactions = filteredTransactions.filter(t => t.amount >= parseFloat(filter.value));
          break;
        case 'amount_max':
          filteredTransactions = filteredTransactions.filter(t => t.amount <= parseFloat(filter.value));
          break;
        case 'start_date':
          filteredTransactions = filteredTransactions.filter(t => 
            new Date(t.transaction_date) >= new Date(filter.value)
          );
          break;
        case 'end_date':
          filteredTransactions = filteredTransactions.filter(t => 
            new Date(t.transaction_date) <= new Date(filter.value)
          );
          break;
        case 'status':
          filteredTransactions = filteredTransactions.filter(t => t.status === filter.value);
          break;
        case 'type':
          filteredTransactions = filteredTransactions.filter(t => t.type === filter.value);
          break;
      }
    });
    
    setTransactions(filteredTransactions);
  };

  const handleSearchClear = () => {
    setSearchQuery('');
    setTransactions(allTransactions);
  };

  const loadBankAccounts = async () => {
    try {
      const accounts = await bankAccountsApi.getSummary();
      setBankAccounts(accounts);
    } catch (err: any) {
      console.error('Bank accounts loading error:', err);
    }
  };

  const handleShowDetails = async (transactionId: string) => {
    try {
      console.log('Fetching transaction details for ID:', transactionId);
      const transaction = await transactionsApi.getById(transactionId);
      console.log('Fetched transaction:', transaction);
      
      // ID fix for backward compatibility
      if (!transaction.id && transaction._id) {
        transaction.id = transaction._id;
      }
      
      setSelectedTransaction(transaction);
      setShowDetailsModal(true);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'İşlem detayları yüklenirken hata oluştu');
    }
  };

  const handleDownloadReceipt = async (transactionId: string, filename?: string) => {
    try {
      const blob = await transactionsApi.downloadReceipt(transactionId);
      
      // Dosya türünü belirle
      const transaction = transactions.find(t => t.id === transactionId);
      let extension = 'pdf';
      let mimeType = 'application/pdf';
      
      // Receipt URL'den dosya uzantısını çıkar
      if (transaction?.receipt_url) {
        const urlExtension = transaction.receipt_url.toLowerCase().split('.').pop();
        if (urlExtension === 'png' || urlExtension === 'jpg' || urlExtension === 'jpeg') {
          extension = urlExtension;
          mimeType = `image/${urlExtension === 'jpg' ? 'jpeg' : urlExtension}`;
        }
      }
      
      const url = window.URL.createObjectURL(new Blob([blob], { type: mimeType }));
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || `dekont_${transactionId}.${extension}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Dekont indirme başarısız');
    }
  };

  const handleAIChat = async () => {
    if (!aiMessage.trim() || !selectedTransaction) return;
    
    const userMessage = aiMessage.trim();
    const transactionId = selectedTransaction.id;
    
    setAiChatHistory(prev => [...prev, { role: 'user', message: userMessage }]);
    setAiMessage('');
    setIsAILoading(true);

    try {
      const response = await transactionsApi.chatWithAI(transactionId, userMessage);
      setAiChatHistory(prev => [...prev, { role: 'ai', message: response.response }]);
    } catch (err: any) {
      setAiChatHistory(prev => [...prev, { role: 'ai', message: 'Üzgünüm, bir hata oluştu.' }]);
      setError(err.response?.data?.detail || 'AI ile iletişimde hata oluştu');
    } finally {
      setIsAILoading(false);
    }
  };

  const handleStartAIAnalysis = async () => {
    if (!selectedTransaction) {
      console.error('No selected transaction');
      return;
    }
    
    console.log('Selected transaction:', selectedTransaction);
    
    // ID'yi al
    const transactionId = selectedTransaction.id;
    console.log('Transaction ID:', transactionId);
    
    if (!transactionId) {
      setError('İşlem ID bulunamadı');
      return;
    }
    
    setShowAIModal(true);
    setIsAILoading(true);
    
    try {
      const response = await transactionsApi.analyzeTransaction(transactionId);
      setAiChatHistory([
        { role: 'ai', message: response.analysis }
      ]);
    } catch (err: any) {
      console.error('AI Analysis error:', err);
      setAiChatHistory([
        { role: 'ai', message: 'İşlem analizi yapılamadı. Daha sonra tekrar deneyin.' }
      ]);
      setError(err.response?.data?.detail || 'AI analizi başarısız');
    } finally {
      setIsAILoading(false);
    }
  };

  const formatCurrency = (amount: number, currency: string = 'TRY') => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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
                  <h1 className="text-2xl font-bold text-gray-900">İşlemler</h1>
                  <p className="text-sm text-gray-500 mt-1">
                    Toplam {transactions.length} işlem
                  </p>
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

            {/* Advanced Search */}
            <AdvancedSearch
              placeholder="İşlemlerde ara... (açıklama, banka hesabı, kişi)"
              onSearch={handleAdvancedSearch}
              onClear={handleSearchClear}
              loading={isLoading}
              filterOptions={{
                statuses: Object.keys(statusLabels),
                categories: ['Ödeme', 'Transfer', 'Nakit', 'Fatura', 'Maaş', 'Diğer']
              }}
              quickFilters={[
                { key: 'type', label: 'Gelir', value: 'income' },
                { key: 'type', label: 'Gider', value: 'expense' },
                { key: 'status', label: 'Tamamlanan', value: 'completed' },
                { key: 'status', label: 'Bekleyen', value: 'pending' }
              ]}
              className="mb-6"
            />

            {/* Transactions List */}
            {transactions.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <div className="text-4xl mb-4">💳</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Henüz işlem yok</h3>
                <p className="text-gray-500">
                  İlk işleminizi yapmak için ödeme emirleri sayfasını kullanın.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {transactions.map((transaction) => (
                  <div key={transaction.id || transaction._id} className="bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
                    <div className="p-4">
                      {/* 1. Satır - İsim */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <span className={`text-sm ${transaction.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                            {transaction.type === 'income' ? '↗️' : '↙️'}
                          </span>
                          <h3 className="font-medium text-gray-900">
                            {transaction.person_name || 
                             (transaction.description?.includes('Ödeme Emri') ? 
                              transaction.description.split(' - ')[1]?.split(' |')[0] || 
                              transaction.description.split(':')[1]?.trim().split(' -')[0] ||
                              'Bilinmeyen Alıcı' : 
                              'Sistem İşlemi')}
                          </h3>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 text-xs rounded-full ${statusColors[transaction.status]}`}>
                            {statusLabels[transaction.status]}
                          </span>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            transaction.type === 'income' 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {typeLabels[transaction.type]}
                          </span>
                        </div>
                      </div>

                      {/* 2. Satır - Tutar */}
                      <div className="mb-2">
                        <div className={`text-lg font-semibold ${
                          transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount, transaction.currency)}
                          {transaction.total_fees > 0 && (
                            <span className="text-sm text-orange-600 ml-2">
                              (+{formatCurrency(transaction.total_fees)} ücret)
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 3. Satır - Banka */}
                      <div className="mb-2">
                        <div className="flex items-center space-x-4 text-sm text-gray-600">
                          <span>🏦 {transaction.bank_account_name}</span>
                          <span>📅 {formatDate(transaction.transaction_date)}</span>
                        </div>
                      </div>

                      {/* 4. Satır - Açıklama */}
                      <div className="mb-3">
                        <p className="text-sm text-gray-700 overflow-hidden" style={{
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical'
                        }}>
                          {transaction.description}
                        </p>
                      </div>

                      {/* 5. Satır - Aksiyon Butonları */}
                      <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleShowDetails(transaction.id || transaction._id)}
                            className="text-xs px-3 py-1 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                          >
                            Detay
                          </button>
                          
                          {transaction.receipt_url && (
                            <button
                              onClick={() => handleDownloadReceipt(transaction.id || transaction._id)}
                              className="text-xs px-3 py-1 text-green-600 hover:bg-green-50 rounded-md transition-colors"
                            >
                              Dekont
                            </button>
                          )}
                        </div>
                        
                        <button
                          onClick={async () => {
                            try {
                              const fullTransaction = await transactionsApi.getById(transaction.id || transaction._id);
                              if (!fullTransaction.id && fullTransaction._id) {
                                fullTransaction.id = fullTransaction._id;
                              }
                              setSelectedTransaction(fullTransaction);
                              handleStartAIAnalysis();
                            } catch (err: any) {
                              setError('AI analizi başlatılamadı');
                            }
                          }}
                          className="text-xs px-3 py-1 text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
                        >
                          🤖 AI
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Transaction Details Modal */}
            {showDetailsModal && selectedTransaction && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-screen overflow-y-auto">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium text-gray-900">İşlem Detayları</h3>
                    <button
                      onClick={() => setShowDetailsModal(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      ×
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">İşlem Türü</label>
                        <div className={`text-sm ${typeColors[selectedTransaction.type]}`}>
                          {typeLabels[selectedTransaction.type]}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Durum</label>
                        <span className={`px-2 py-1 text-xs rounded-full ${statusColors[selectedTransaction.status]}`}>
                          {statusLabels[selectedTransaction.status]}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Ana Tutar</label>
                        <div className="text-lg font-semibold">
                          {formatCurrency(selectedTransaction.amount, selectedTransaction.currency)}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Net Tutar</label>
                        <div className="text-lg font-semibold">
                          {formatCurrency(selectedTransaction.net_amount, selectedTransaction.currency)}
                        </div>
                      </div>
                    </div>

                    {selectedTransaction.total_fees > 0 && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700">İşlem Ücretleri</label>
                        <div className="bg-orange-50 border border-orange-200 rounded-md p-3">
                          <div className="text-sm text-orange-800">
                            Toplam Ücret: <span className="font-medium">{formatCurrency(selectedTransaction.total_fees)}</span>
                          </div>
                          {selectedTransaction.fees && Object.keys(selectedTransaction.fees).length > 0 && (
                            <div className="mt-2 space-y-1">
                              {Object.entries(selectedTransaction.fees).map(([feeType, amount]) => (
                                <div key={feeType} className="text-xs text-orange-700 flex justify-between">
                                  <span>{feeType}:</span>
                                  <span>{formatCurrency(amount as number)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Açıklama</label>
                      <div className="text-sm text-gray-900">{selectedTransaction.description}</div>
                    </div>

                    {selectedTransaction.reference_number && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Referans Numarası</label>
                        <div className="text-sm text-gray-900">{selectedTransaction.reference_number}</div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">İşlem Tarihi</label>
                        <div className="text-sm text-gray-900">{formatDate(selectedTransaction.transaction_date)}</div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Oluşturulma</label>
                        <div className="text-sm text-gray-900">{formatDate(selectedTransaction.created_at)}</div>
                      </div>
                    </div>

                    <div className="flex space-x-3 pt-4 border-t">
                      {selectedTransaction.receipt_url && (
                        <button
                          onClick={() => handleDownloadReceipt(selectedTransaction.id, selectedTransaction.receipt_filename)}
                          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                        >
                          📄 Dekont İndir
                        </button>
                      )}
                      <button
                        onClick={handleStartAIAnalysis}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                      >
                        🤖 AI ile İncele
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* AI Chat Modal */}
            {showAIModal && selectedTransaction && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-lg max-w-2xl w-full h-3/4 flex flex-col">
                  {/* Header */}
                  <div className="flex justify-between items-center p-6 border-b">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">🤖 AI İşlem Analizi</h3>
                      <p className="text-sm text-gray-500">
                        {selectedTransaction.description.substring(0, 50)}...
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setShowAIModal(false);
                        setAiChatHistory([]);
                        setAiMessage('');
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      ×
                    </button>
                  </div>

                  {/* Chat History */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {aiChatHistory.length === 0 && !isAILoading && (
                      <div className="text-center text-gray-500 py-8">
                        <div className="text-4xl mb-4">🤖</div>
                        <p>AI analizi başlıyor...</p>
                      </div>
                    )}
                    
                    {aiChatHistory.map((chat, index) => (
                      <div key={index} className={`flex ${chat.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                          chat.role === 'user' 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-gray-100 text-gray-900'
                        }`}>
                          <div className="text-sm whitespace-pre-wrap">{chat.message}</div>
                        </div>
                      </div>
                    ))}
                    
                    {isAILoading && (
                      <div className="flex justify-start">
                        <div className="bg-gray-100 text-gray-900 max-w-xs lg:max-w-md px-4 py-2 rounded-lg">
                          <div className="flex items-center space-x-2">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                            <span className="text-sm">AI düşünüyor...</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Chat Input */}
                  <div className="border-t p-4">
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        value={aiMessage}
                        onChange={(e) => setAiMessage(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleAIChat()}
                        placeholder="AI'ya soru sorun... (örn: Bu ödeme normal mi?)"
                        className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        disabled={isAILoading}
                      />
                      <button
                        onClick={handleAIChat}
                        disabled={isAILoading || !aiMessage.trim()}
                        className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
                      >
                        Gönder
                      </button>
                    </div>
                    <div className="mt-2 text-xs text-gray-500">
                      Öneriler: "Bu ödeme düzenli mi?", "Ücretler normal mi?", "Bu alıcıya daha önce ödeme yapıldı mı?"
                    </div>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}