'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import Navigation from '@/components/Navigation';
import SmartCategorization from '@/components/SmartCategorization';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { LoadingSpinner } from '@/components/ui/loading';
import { ArrowLeft, Save, Brain } from 'lucide-react';
import { paymentOrdersApi, PaymentOrderCreate } from '@/lib/api/paymentOrders';
import { bankAccountsApi, BankAccountSummary } from '@/lib/api/bankAccounts';
import { peopleApi, PersonSummary } from '@/lib/api/people';

export default function NewPaymentOrder() {
  const router = useRouter();
  const [formData, setFormData] = useState<PaymentOrderCreate>({
    recipient_name: '',
    recipient_iban: '',
    recipient_bank: '',
    amount: 0,
    currency: 'TRY',
    description: '',
    category: 'other',
    due_date: '',
    source_account_id: ''
  });

  const [bankAccounts, setBankAccounts] = useState<BankAccountSummary[]>([]);
  const [people, setPeople] = useState<PersonSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSmartCategorization, setShowSmartCategorization] = useState(false);
  const [aiSuggestionAccepted, setAiSuggestionAccepted] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    // AI önerisi için yeterli veri var mı kontrol et
    if (
      formData.description.trim().length > 3 &&
      formData.recipient_name.trim().length > 2 &&
      formData.amount > 0 &&
      !aiSuggestionAccepted
    ) {
      setShowSmartCategorization(true);
    } else {
      setShowSmartCategorization(false);
    }
  }, [formData.description, formData.recipient_name, formData.amount, aiSuggestionAccepted]);

  const loadInitialData = async () => {
    try {
      const [accountsData, peopleData] = await Promise.all([
        bankAccountsApi.getSummary(),
        peopleApi.getSummary()
      ]);
      setBankAccounts(accountsData);
      setPeople(peopleData);
    } catch (error) {
      console.error('Başlangıç verileri yüklenirken hata:', error);
    }
  };

  const handleInputChange = (field: keyof PaymentOrderCreate, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Eğer temel alanlar değişirse AI önerisini sıfırla
    if (['description', 'recipient_name', 'amount'].includes(field)) {
      setAiSuggestionAccepted(false);
    }
  };

  const handlePersonSelect = (person: PersonSummary) => {
    setFormData(prev => ({
      ...prev,
      recipient_name: person.name,
      recipient_iban: person.iban || '',
      recipient_bank: person.bank_name || ''
    }));
  };

  const handleSmartCategorySelect = (category: string) => {
    setFormData(prev => ({
      ...prev,
      category: category as any
    }));
    setAiSuggestionAccepted(true);
    setShowSmartCategorization(false);
  };

  const handleSkipAI = () => {
    setShowSmartCategorization(false);
    setAiSuggestionAccepted(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await paymentOrdersApi.create(formData);
      router.push('/payment-orders');
    } catch (error) {
      console.error('Ödeme emri oluşturulurken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const categoryOptions = [
    { value: 'office_supplies', label: 'Ofis Malzemeleri' },
    { value: 'utilities', label: 'Faturalar' },
    { value: 'salary', label: 'Maaş' },
    { value: 'rent', label: 'Kira' },
    { value: 'insurance', label: 'Sigorta' },
    { value: 'tax', label: 'Vergi' },
    { value: 'loan', label: 'Kredi' },
    { value: 'supplier', label: 'Tedarikçi' },
    { value: 'service', label: 'Hizmet' },
    { value: 'other', label: 'Diğer' }
  ];

  return (
    <ProtectedRoute>
      <div className="flex min-h-screen bg-gray-50">
        <Navigation />
        
        <main className="flex-1 ml-64 p-8">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div>
                <Button
                  variant="ghost"
                  onClick={() => router.back()}
                  className="mb-4"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Geri Dön
                </Button>
                <h1 className="text-3xl font-bold text-gray-900">Yeni Ödeme Emri</h1>
                <p className="text-gray-600 mt-2">Yeni bir ödeme emri oluşturun</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* AI Smart Categorization */}
              {showSmartCategorization && (
                <SmartCategorization
                  transaction={{
                    description: formData.description,
                    recipient_name: formData.recipient_name,
                    amount: formData.amount
                  }}
                  onCategorySelect={handleSmartCategorySelect}
                  onSkip={handleSkipAI}
                  className="mb-6"
                />
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Sol Kolon - Temel Bilgiler */}
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Alıcı Bilgileri</CardTitle>
                      <CardDescription>Ödeme yapılacak kişi veya kurum bilgileri</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label htmlFor="recipient_name">Alıcı Adı *</Label>
                        <Input
                          id="recipient_name"
                          value={formData.recipient_name}
                          onChange={(e) => handleInputChange('recipient_name', e.target.value)}
                          placeholder="Alıcının adını girin"
                          required
                        />
                      </div>

                      <div>
                        <Label htmlFor="recipient_iban">IBAN *</Label>
                        <Input
                          id="recipient_iban"
                          value={formData.recipient_iban}
                          onChange={(e) => handleInputChange('recipient_iban', e.target.value)}
                          placeholder="TR00 0000 0000 0000 0000 0000 00"
                          required
                        />
                      </div>

                      <div>
                        <Label htmlFor="recipient_bank">Banka Adı</Label>
                        <Input
                          id="recipient_bank"
                          value={formData.recipient_bank}
                          onChange={(e) => handleInputChange('recipient_bank', e.target.value)}
                          placeholder="Banka adı"
                        />
                      </div>

                      {/* Kayıtlı Kişiler */}
                      {people.length > 0 && (
                        <div>
                          <Label>Kayıtlı Kişiler/Kurumlar</Label>
                          <div className="mt-2 max-h-32 overflow-y-auto border border-gray-200 rounded-md">
                            {people.slice(0, 5).map((person) => (
                              <button
                                key={person.id}
                                type="button"
                                onClick={() => handlePersonSelect(person)}
                                className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                              >
                                <div className="font-medium text-sm">{person.name}</div>
                                {person.iban && (
                                  <div className="text-xs text-gray-500">{person.iban}</div>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Sağ Kolon - Ödeme Detayları */}
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Ödeme Detayları</CardTitle>
                      <CardDescription>Tutar ve ödeme bilgileri</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
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
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="TRY">TRY</option>
                            <option value="USD">USD</option>
                            <option value="EUR">EUR</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="source_account_id">Kaynak Hesap *</Label>
                        <select
                          id="source_account_id"
                          value={formData.source_account_id}
                          onChange={(e) => handleInputChange('source_account_id', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        >
                          <option value="">Hesap seçin</option>
                          {bankAccounts.map((account) => (
                            <option key={account.id} value={account.id}>
                              {account.bank_name} - {account.account_number}
                              ({new Intl.NumberFormat('tr-TR', {
                                style: 'currency',
                                currency: account.currency
                              }).format(account.current_balance)})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <Label htmlFor="category">
                          Kategori 
                          {aiSuggestionAccepted && (
                            <span className="ml-2 text-xs text-blue-600 flex items-center inline">
                              <Brain className="h-3 w-3 mr-1" />
                              AI Önerisi
                            </span>
                          )}
                        </Label>
                        <select
                          id="category"
                          value={formData.category}
                          onChange={(e) => handleInputChange('category', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {categoryOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <Label htmlFor="due_date">Vade Tarihi</Label>
                        <Input
                          id="due_date"
                          type="date"
                          value={formData.due_date}
                          onChange={(e) => handleInputChange('due_date', e.target.value)}
                        />
                      </div>

                      <div>
                        <Label htmlFor="description">Açıklama *</Label>
                        <Textarea
                          id="description"
                          value={formData.description}
                          onChange={(e) => handleInputChange('description', e.target.value)}
                          placeholder="Ödeme açıklaması"
                          rows={4}
                          required
                        />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end space-x-4 pt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                >
                  İptal
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {loading ? (
                    <>
                      <LoadingSpinner size="sm" className="mr-2" />
                      Oluşturuluyor...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Ödeme Emri Oluştur
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}