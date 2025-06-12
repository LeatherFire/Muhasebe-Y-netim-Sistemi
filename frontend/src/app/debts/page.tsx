'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, TrendingUp, TrendingDown, AlertTriangle, Calendar, Eye, Edit, Trash2, CreditCard } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { debtsApi, Debt, DebtCreate, DebtUpdate, DebtSummary, DebtStatistics, DebtPayment, DebtPaymentCreate } from '@/lib/api/debts';
import ProtectedRoute from '@/components/ProtectedRoute';
import Navigation from '@/components/Navigation';
import { useAuth } from '@/contexts/AuthContext';
import DeleteConfirmationModal from '@/components/ui/delete-confirmation-modal';

export default function DebtsPage() {
  const { user } = useAuth();
  const [debts, setDebts] = useState<Debt[]>([]);
  const [debtsSummary, setDebtsSummary] = useState<DebtSummary[]>([]);
  const [statistics, setStatistics] = useState<DebtStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<'all' | 'payable' | 'receivable'>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'active' | 'paid' | 'partial' | 'overdue' | 'cancelled'>('all');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'supplier' | 'tax' | 'salary' | 'loan' | 'utility' | 'rent' | 'insurance' | 'service' | 'other'>('all');
  const [showOverdueOnly, setShowOverdueOnly] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const [selectedDebtForPayment, setSelectedDebtForPayment] = useState<Debt | null>(null);
  const [debtToDelete, setDebtToDelete] = useState<Debt | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [formData, setFormData] = useState<DebtCreate>({
    creditor_name: '',
    debtor_name: '',
    amount: 0,
    currency: 'TRY',
    description: '',
    category: 'other',
    debt_type: 'payable',
    due_date: '',
    interest_rate: 0,
    payment_terms: '',
    notes: ''
  });

  const [paymentData, setPaymentData] = useState<DebtPaymentCreate>({
    debt_id: '',
    amount: 0,
    payment_date: '',
    payment_method: '',
    bank_account_id: '',
    description: ''
  });

  useEffect(() => {
    loadData();
  }, [selectedType, selectedStatus, selectedCategory, showOverdueOnly]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      const params = {
        debt_type: selectedType !== 'all' ? selectedType : undefined,
        status: selectedStatus !== 'all' ? selectedStatus : undefined,
        category: selectedCategory !== 'all' ? selectedCategory : undefined,
        overdue_only: showOverdueOnly || undefined
      };

      const [debtsData, summaryData, statsData] = await Promise.all([
        debtsApi.getDebts(params),
        debtsApi.getDebtsSummary(),
        debtsApi.getDebtStatistics()
      ]);

      setDebts(debtsData);
      setDebtsSummary(summaryData);
      setStatistics(statsData);
    } catch (error) {
      console.error('Veri yüklenirken hata:', error);
      setAlert({ type: 'error', message: 'Veriler yüklenirken bir hata oluştu' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await debtsApi.createDebt(formData);
      setAlert({ type: 'success', message: 'Borç başarıyla oluşturuldu' });
      setIsCreateDialogOpen(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Borç oluşturulurken hata:', error);
      setAlert({ type: 'error', message: 'Borç oluşturulurken bir hata oluştu' });
    }
  };

  const handleUpdateDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDebt) return;

    try {
      await debtsApi.updateDebt(editingDebt.id, formData as DebtUpdate);
      setAlert({ type: 'success', message: 'Borç başarıyla güncellendi' });
      setIsEditDialogOpen(false);
      setEditingDebt(null);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Borç güncellenirken hata:', error);
      setAlert({ type: 'error', message: 'Borç güncellenirken bir hata oluştu' });
    }
  };

  const handleDeleteDebt = async () => {
    if (!debtToDelete) return;

    try {
      setDeleteLoading(true);
      await debtsApi.deleteDebt(debtToDelete.id);
      setAlert({ type: 'success', message: 'Borç başarıyla silindi' });
      setIsDeleteDialogOpen(false);
      setDebtToDelete(null);
      loadData();
    } catch (error) {
      console.error('Borç silinirken hata:', error);
      setAlert({ type: 'error', message: 'Borç silinirken bir hata oluştu' });
    } finally {
      setDeleteLoading(false);
    }
  };

  const openDeleteDialog = (debt: Debt) => {
    setDebtToDelete(debt);
    setIsDeleteDialogOpen(true);
  };

  const closeDeleteDialog = () => {
    setIsDeleteDialogOpen(false);
    setDebtToDelete(null);
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await debtsApi.createDebtPayment(paymentData);
      setAlert({ type: 'success', message: 'Ödeme başarıyla kaydedildi' });
      setIsPaymentDialogOpen(false);
      setSelectedDebtForPayment(null);
      resetPaymentForm();
      loadData();
    } catch (error) {
      console.error('Ödeme kaydedilirken hata:', error);
      setAlert({ type: 'error', message: 'Ödeme kaydedilirken bir hata oluştu' });
    }
  };

  const resetForm = () => {
    setFormData({
      creditor_name: '',
      debtor_name: '',
      amount: 0,
      currency: 'TRY',
      description: '',
      category: 'other',
      debt_type: 'payable',
      due_date: '',
      interest_rate: 0,
      payment_terms: '',
      notes: ''
    });
  };

  const resetPaymentForm = () => {
    setPaymentData({
      debt_id: '',
      amount: 0,
      payment_date: '',
      payment_method: '',
      bank_account_id: '',
      description: ''
    });
  };

  const openEditDialog = (debt: Debt) => {
    setEditingDebt(debt);
    setFormData({
      creditor_name: debt.creditor_name,
      debtor_name: debt.debtor_name || '',
      amount: debt.amount,
      currency: debt.currency,
      description: debt.description,
      category: debt.category as any,
      debt_type: debt.debt_type as any,
      due_date: debt.due_date.split('T')[0],
      interest_rate: debt.interest_rate || 0,
      payment_terms: debt.payment_terms || '',
      notes: debt.notes || ''
    });
    setIsEditDialogOpen(true);
  };

  const openPaymentDialog = (debt: Debt) => {
    setSelectedDebtForPayment(debt);
    setPaymentData({
      debt_id: debt.id,
      amount: debt.remaining_amount,
      payment_date: new Date().toISOString().split('T')[0],
      payment_method: '',
      bank_account_id: '',
      description: ''
    });
    setIsPaymentDialogOpen(true);
  };

  const filteredDebts = debts.filter(debt =>
    debt.creditor_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    debt.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (debt.debtor_name && debt.debtor_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('tr-TR');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'default';
      case 'paid': return 'success';
      case 'partial': return 'secondary';
      case 'overdue': return 'destructive';
      case 'cancelled': return 'outline';
      default: return 'default';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return 'Aktif';
      case 'paid': return 'Ödendi';
      case 'partial': return 'Kısmi';
      case 'overdue': return 'Gecikmiş';
      case 'cancelled': return 'İptal';
      default: return status;
    }
  };

  const getCategoryText = (category: string) => {
    const categories = {
      supplier: 'Tedarikçi',
      tax: 'Vergi',
      salary: 'Maaş',
      loan: 'Kredi',
      utility: 'Fatura',
      rent: 'Kira',
      insurance: 'Sigorta',
      service: 'Hizmet',
      other: 'Diğer'
    };
    return categories[category as keyof typeof categories] || category;
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="flex min-h-screen bg-gray-50">
          <Navigation />
          <div className="flex-1 ml-64 flex items-center justify-center">
            <div className="text-lg">Yükleniyor...</div>
          </div>
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
            {alert && (
              <Alert className={`mb-6 ${alert.type === 'error' ? 'border-red-500 bg-red-50' : 'border-green-500 bg-green-50'}`}>
                <AlertDescription>{alert.message}</AlertDescription>
              </Alert>
            )}

            <div className="flex justify-between items-center mb-8">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Borç Yönetimi</h1>
                <p className="text-gray-600">Borç ve alacakları takip edin</p>
              </div>
        {user?.role === 'admin' && (
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Yeni Borç Ekle
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Yeni Borç/Alacak Ekle</DialogTitle>
              <DialogDescription>
                Yeni bir borç veya alacak kaydı oluşturun
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateDebt} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="debt_type">Tür *</Label>
                  <Select
                    value={formData.debt_type}
                    onValueChange={(value: 'payable' | 'receivable') =>
                      setFormData({ ...formData, debt_type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="payable">Ödenecek Borç</SelectItem>
                      <SelectItem value="receivable">Alacak</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="category">Kategori *</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value: any) => setFormData({ ...formData, category: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="supplier">Tedarikçi</SelectItem>
                      <SelectItem value="tax">Vergi</SelectItem>
                      <SelectItem value="salary">Maaş</SelectItem>
                      <SelectItem value="loan">Kredi</SelectItem>
                      <SelectItem value="utility">Fatura</SelectItem>
                      <SelectItem value="rent">Kira</SelectItem>
                      <SelectItem value="insurance">Sigorta</SelectItem>
                      <SelectItem value="service">Hizmet</SelectItem>
                      <SelectItem value="other">Diğer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="creditor_name">Alacaklı Adı *</Label>
                  <Input
                    id="creditor_name"
                    value={formData.creditor_name}
                    onChange={(e) => setFormData({ ...formData, creditor_name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="debtor_name">Borçlu Adı</Label>
                  <Input
                    id="debtor_name"
                    value={formData.debtor_name}
                    onChange={(e) => setFormData({ ...formData, debtor_name: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="amount">Tutar *</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="currency">Para Birimi</Label>
                  <Select
                    value={formData.currency}
                    onValueChange={(value) => setFormData({ ...formData, currency: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TRY">TRY</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="due_date">Vade Tarihi *</Label>
                  <Input
                    id="due_date"
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="description">Açıklama *</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="interest_rate">Faiz Oranı (%)</Label>
                  <Input
                    id="interest_rate"
                    type="number"
                    step="0.01"
                    value={formData.interest_rate}
                    onChange={(e) => setFormData({ ...formData, interest_rate: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label htmlFor="payment_terms">Ödeme Koşulları</Label>
                  <Input
                    id="payment_terms"
                    value={formData.payment_terms}
                    onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Notlar</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  İptal
                </Button>
                <Button type="submit">Kaydet</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        )}
      </div>

      {/* İstatistikler */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Toplam Borç</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {formatCurrency(statistics.total_debt_amount)}
              </div>
              <p className="text-xs text-muted-foreground">
                {statistics.total_debts} kayıt
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Toplam Alacak</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(statistics.total_receivable_amount)}
              </div>
              <p className="text-xs text-muted-foreground">
                {statistics.total_receivables} kayıt
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Vadesi Geçmiş</CardTitle>
              <AlertTriangle className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {formatCurrency(statistics.overdue_amount)}
              </div>
              <p className="text-xs text-muted-foreground">
                {statistics.overdue_debts} kayıt
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Bu Ay Ödenen</CardTitle>
              <Calendar className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {formatCurrency(statistics.paid_this_month)}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filtreler */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Arama..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-80"
                />
              </div>
              <Select value={selectedType} onValueChange={(value: any) => setSelectedType(value)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tümü</SelectItem>
                  <SelectItem value="payable">Borçlar</SelectItem>
                  <SelectItem value="receivable">Alacaklar</SelectItem>
                </SelectContent>
              </Select>
              <Select value={selectedStatus} onValueChange={(value: any) => setSelectedStatus(value)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tüm Durumlar</SelectItem>
                  <SelectItem value="active">Aktif</SelectItem>
                  <SelectItem value="paid">Ödendi</SelectItem>
                  <SelectItem value="partial">Kısmi</SelectItem>
                  <SelectItem value="overdue">Gecikmiş</SelectItem>
                  <SelectItem value="cancelled">İptal</SelectItem>
                </SelectContent>
              </Select>
              <Select value={selectedCategory} onValueChange={(value: any) => setSelectedCategory(value)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tüm Kategoriler</SelectItem>
                  <SelectItem value="supplier">Tedarikçi</SelectItem>
                  <SelectItem value="tax">Vergi</SelectItem>
                  <SelectItem value="salary">Maaş</SelectItem>
                  <SelectItem value="loan">Kredi</SelectItem>
                  <SelectItem value="utility">Fatura</SelectItem>
                  <SelectItem value="rent">Kira</SelectItem>
                  <SelectItem value="insurance">Sigorta</SelectItem>
                  <SelectItem value="service">Hizmet</SelectItem>
                  <SelectItem value="other">Diğer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Borçlar Tablosu */}
      <Card>
        <CardHeader>
          <CardTitle>Borçlar ve Alacaklar ({filteredDebts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Alacaklı/Borçlu</TableHead>
                <TableHead>Açıklama</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead>Tür</TableHead>
                <TableHead>Tutar</TableHead>
                <TableHead>Kalan</TableHead>
                <TableHead>Vade</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>İşlemler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDebts.map((debt) => (
                <TableRow key={debt.id}>
                  <TableCell className="font-medium">{debt.creditor_name}</TableCell>
                  <TableCell>{debt.description}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{getCategoryText(debt.category)}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={debt.debt_type === 'payable' ? 'destructive' : 'default'}>
                      {debt.debt_type === 'payable' ? 'Borç' : 'Alacak'}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatCurrency(debt.amount)}</TableCell>
                  <TableCell className={debt.remaining_amount > 0 ? 'font-medium' : 'text-gray-500'}>
                    {formatCurrency(debt.remaining_amount)}
                  </TableCell>
                  <TableCell>
                    <div className={debt.days_overdue > 0 ? 'text-red-600' : ''}>
                      {formatDate(debt.due_date)}
                      {debt.days_overdue > 0 && (
                        <div className="text-xs text-red-600">
                          {debt.days_overdue} gün gecikmiş
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusColor(debt.status) as any}>
                      {getStatusText(debt.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {debt.remaining_amount > 0 && debt.status !== 'paid' && debt.status !== 'cancelled' && (
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => openPaymentDialog(debt)}
                          className="text-green-600 hover:text-green-700"
                        >
                          <CreditCard className="h-4 w-4" />
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => openEditDialog(debt)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openDeleteDialog(debt)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Düzenleme Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Borç/Alacak Düzenle</DialogTitle>
            <DialogDescription>
              Borç veya alacak bilgilerini güncelleyin
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateDebt} className="space-y-4">
            {/* Form fields (similar to create form) */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-debt_type">Tür *</Label>
                <Select
                  value={formData.debt_type}
                  onValueChange={(value: 'payable' | 'receivable') =>
                    setFormData({ ...formData, debt_type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="payable">Ödenecek Borç</SelectItem>
                    <SelectItem value="receivable">Alacak</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-category">Kategori *</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value: any) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="supplier">Tedarikçi</SelectItem>
                    <SelectItem value="tax">Vergi</SelectItem>
                    <SelectItem value="salary">Maaş</SelectItem>
                    <SelectItem value="loan">Kredi</SelectItem>
                    <SelectItem value="utility">Fatura</SelectItem>
                    <SelectItem value="rent">Kira</SelectItem>
                    <SelectItem value="insurance">Sigorta</SelectItem>
                    <SelectItem value="service">Hizmet</SelectItem>
                    <SelectItem value="other">Diğer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-creditor_name">Alacaklı Adı *</Label>
                <Input
                  id="edit-creditor_name"
                  value={formData.creditor_name}
                  onChange={(e) => setFormData({ ...formData, creditor_name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit-debtor_name">Borçlu Adı</Label>
                <Input
                  id="edit-debtor_name"
                  value={formData.debtor_name}
                  onChange={(e) => setFormData({ ...formData, debtor_name: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="edit-amount">Tutar *</Label>
                <Input
                  id="edit-amount"
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit-currency">Para Birimi</Label>
                <Select
                  value={formData.currency}
                  onValueChange={(value) => setFormData({ ...formData, currency: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TRY">TRY</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-due_date">Vade Tarihi *</Label>
                <Input
                  id="edit-due_date"
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="edit-description">Açıklama *</Label>
              <Input
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                required
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                İptal
              </Button>
              <Button type="submit">Güncelle</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Ödeme Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ödeme Yap</DialogTitle>
            <DialogDescription>
              {selectedDebtForPayment && `${selectedDebtForPayment.creditor_name} - ${selectedDebtForPayment.description}`}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePayment} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="payment-amount">Ödeme Tutarı *</Label>
                <Input
                  id="payment-amount"
                  type="number"
                  step="0.01"
                  value={paymentData.amount}
                  onChange={(e) => setPaymentData({ ...paymentData, amount: parseFloat(e.target.value) || 0 })}
                  required
                />
                {selectedDebtForPayment && (
                  <p className="text-xs text-gray-500 mt-1">
                    Kalan tutar: {formatCurrency(selectedDebtForPayment.remaining_amount)}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="payment-date">Ödeme Tarihi *</Label>
                <Input
                  id="payment-date"
                  type="date"
                  value={paymentData.payment_date}
                  onChange={(e) => setPaymentData({ ...paymentData, payment_date: e.target.value })}
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="payment-method">Ödeme Yöntemi *</Label>
              <Select
                value={paymentData.payment_method}
                onValueChange={(value) => setPaymentData({ ...paymentData, payment_method: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Ödeme yöntemi seçin" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Nakit</SelectItem>
                  <SelectItem value="bank_transfer">Banka Havalesi</SelectItem>
                  <SelectItem value="credit_card">Kredi Kartı</SelectItem>
                  <SelectItem value="check">Çek</SelectItem>
                  <SelectItem value="other">Diğer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="payment-description">Açıklama</Label>
              <Textarea
                id="payment-description"
                value={paymentData.description}
                onChange={(e) => setPaymentData({ ...paymentData, description: e.target.value })}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>
                İptal
              </Button>
              <Button type="submit">Ödeme Yap</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={isDeleteDialogOpen}
        onClose={closeDeleteDialog}
        onConfirm={handleDeleteDebt}
        title="Borcu Sil"
        description="Bu borcu silmek istediğinizden emin misiniz? Bu işlem geri alınamaz."
        itemName={debtToDelete ? `${debtToDelete.creditor_name} - ${debtToDelete.description}` : undefined}
        loading={deleteLoading}
      />
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}