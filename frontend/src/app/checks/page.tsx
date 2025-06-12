'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, FileText, Clock, AlertTriangle, CheckCircle, Upload, CreditCard, Eye, Edit, Trash2, Camera } from 'lucide-react';
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
import { Progress } from '@/components/ui/progress';
import { checksApi, Check, CheckCreate, CheckUpdate, CheckSummary, CheckStatistics, CheckOperation, CheckOperationCreate, CheckAnalysisResult } from '@/lib/api/checks';
import ProtectedRoute from '@/components/ProtectedRoute';
import Navigation from '@/components/Navigation';
import { useAuth } from '@/contexts/AuthContext';
import DeleteConfirmationModal from '@/components/ui/delete-confirmation-modal';

export default function ChecksPage() {
  const { user } = useAuth();
  const [checks, setChecks] = useState<Check[]>([]);
  const [checksSummary, setChecksSummary] = useState<CheckSummary[]>([]);
  const [statistics, setStatistics] = useState<CheckStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<'all' | 'received' | 'issued'>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'active' | 'cashed' | 'returned' | 'cancelled' | 'lost' | 'early_cashed'>('all');
  const [selectedBank, setSelectedBank] = useState('');
  const [showOverdueOnly, setShowOverdueOnly] = useState(false);
  const [showDueSoon, setShowDueSoon] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isOperationDialogOpen, setIsOperationDialogOpen] = useState(false);
  const [isAnalysisDialogOpen, setIsAnalysisDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingCheck, setEditingCheck] = useState<Check | null>(null);
  const [selectedCheckForOperation, setSelectedCheckForOperation] = useState<Check | null>(null);
  const [checkToDelete, setCheckToDelete] = useState<Check | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [analysisResult, setAnalysisResult] = useState<CheckAnalysisResult | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);

  const [formData, setFormData] = useState<CheckCreate>({
    amount: 0,
    currency: 'TRY',
    check_number: '',
    bank_name: '',
    branch_name: '',
    account_number: '',
    drawer_name: '',
    drawer_id_number: '',
    payee_name: '',
    issue_date: '',
    due_date: '',
    check_type: 'received',
    description: '',
    location: '',
    notes: ''
  });

  const [operationData, setOperationData] = useState<CheckOperationCreate>({
    check_id: '',
    operation_type: '',
    operation_date: '',
    amount: 0,
    bank_account_id: '',
    discount_rate: 0,
    fees: 0,
    description: ''
  });

  useEffect(() => {
    loadData();
  }, [selectedType, selectedStatus, selectedBank, showOverdueOnly, showDueSoon]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      const params = {
        check_type: selectedType !== 'all' ? selectedType : undefined,
        status: selectedStatus !== 'all' ? selectedStatus : undefined,
        bank_name: selectedBank || undefined,
        overdue_only: showOverdueOnly || undefined,
        due_soon: showDueSoon || undefined
      };

      const [checksData, summaryData, statsData] = await Promise.all([
        checksApi.getChecks(params),
        checksApi.getChecksSummary(),
        checksApi.getCheckStatistics()
      ]);

      setChecks(checksData);
      setChecksSummary(summaryData);
      setStatistics(statsData);
    } catch (error) {
      console.error('Veri yüklenirken hata:', error);
      setAlert({ type: 'error', message: 'Veriler yüklenirken bir hata oluştu' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await checksApi.createCheck(formData);
      setAlert({ type: 'success', message: 'Çek başarıyla oluşturuldu' });
      setIsCreateDialogOpen(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Çek oluşturulurken hata:', error);
      setAlert({ type: 'error', message: 'Çek oluşturulurken bir hata oluştu' });
    }
  };

  const handleUpdateCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCheck) return;

    try {
      await checksApi.updateCheck(editingCheck.id, formData as CheckUpdate);
      setAlert({ type: 'success', message: 'Çek başarıyla güncellendi' });
      setIsEditDialogOpen(false);
      setEditingCheck(null);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Çek güncellenirken hata:', error);
      setAlert({ type: 'error', message: 'Çek güncellenirken bir hata oluştu' });
    }
  };

  const handleDeleteCheck = async () => {
    if (!checkToDelete) return;

    try {
      setDeleteLoading(true);
      await checksApi.deleteCheck(checkToDelete.id);
      setAlert({ type: 'success', message: 'Çek başarıyla silindi' });
      setIsDeleteDialogOpen(false);
      setCheckToDelete(null);
      loadData();
    } catch (error) {
      console.error('Çek silinirken hata:', error);
      setAlert({ type: 'error', message: 'Çek silinirken bir hata oluştu' });
    } finally {
      setDeleteLoading(false);
    }
  };

  const openDeleteDialog = (check: Check) => {
    setCheckToDelete(check);
    setIsDeleteDialogOpen(true);
  };

  const closeDeleteDialog = () => {
    setIsDeleteDialogOpen(false);
    setCheckToDelete(null);
  };

  const handleOperation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await checksApi.createCheckOperation(operationData);
      setAlert({ type: 'success', message: 'İşlem başarıyla kaydedildi' });
      setIsOperationDialogOpen(false);
      setSelectedCheckForOperation(null);
      resetOperationForm();
      loadData();
    } catch (error) {
      console.error('İşlem kaydedilirken hata:', error);
      setAlert({ type: 'error', message: 'İşlem kaydedilirken bir hata oluştu' });
    }
  };

  const handleImageAnalysis = async (file: File) => {
    try {
      setAnalysisLoading(true);
      const result = await checksApi.analyzeCheckImage(file);
      setAnalysisResult(result);
      
      if (result.success) {
        // AI sonuçlarını forma doldur
        setFormData(prev => ({
          ...prev,
          amount: result.extracted_amount || prev.amount,
          check_number: result.extracted_check_number || prev.check_number,
          bank_name: result.extracted_bank || prev.bank_name,
          drawer_name: result.extracted_drawer || prev.drawer_name,
          payee_name: result.extracted_payee || prev.payee_name,
          issue_date: result.extracted_date?.split('T')[0] || prev.issue_date,
          due_date: result.extracted_due_date?.split('T')[0] || prev.due_date
        }));
        setAlert({ type: 'success', message: 'Çek analizi başarılı! Bilgiler forma aktarıldı.' });
      } else {
        setAlert({ type: 'error', message: result.error_message || 'Çek analizi başarısız' });
      }
    } catch (error) {
      console.error('Çek analizi hatası:', error);
      setAlert({ type: 'error', message: 'Çek analizi sırasında bir hata oluştu' });
    } finally {
      setAnalysisLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      amount: 0,
      currency: 'TRY',
      check_number: '',
      bank_name: '',
      branch_name: '',
      account_number: '',
      drawer_name: '',
      drawer_id_number: '',
      payee_name: '',
      issue_date: '',
      due_date: '',
      check_type: 'received',
      description: '',
      location: '',
      notes: ''
    });
  };

  const resetOperationForm = () => {
    setOperationData({
      check_id: '',
      operation_type: '',
      operation_date: '',
      amount: 0,
      bank_account_id: '',
      discount_rate: 0,
      fees: 0,
      description: ''
    });
  };

  const openEditDialog = (check: Check) => {
    setEditingCheck(check);
    setFormData({
      amount: check.amount,
      currency: check.currency,
      check_number: check.check_number,
      bank_name: check.bank_name,
      branch_name: check.branch_name || '',
      account_number: check.account_number || '',
      drawer_name: check.drawer_name,
      drawer_id_number: check.drawer_id_number || '',
      payee_name: check.payee_name || '',
      issue_date: check.issue_date.split('T')[0],
      due_date: check.due_date.split('T')[0],
      check_type: check.check_type,
      description: check.description || '',
      location: check.location || '',
      notes: check.notes || ''
    });
    setIsEditDialogOpen(true);
  };

  const openOperationDialog = (check: Check) => {
    setSelectedCheckForOperation(check);
    setOperationData({
      check_id: check.id,
      operation_type: '',
      operation_date: new Date().toISOString().split('T')[0],
      amount: check.amount,
      bank_account_id: '',
      discount_rate: 0,
      fees: 0,
      description: ''
    });
    setIsOperationDialogOpen(true);
  };

  const filteredChecks = checks.filter(check =>
    check.check_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    check.drawer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    check.bank_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (check.description && check.description.toLowerCase().includes(searchTerm.toLowerCase()))
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
      case 'cashed': return 'success';
      case 'early_cashed': return 'secondary';
      case 'returned': return 'destructive';
      case 'cancelled': return 'outline';
      case 'lost': return 'destructive';
      default: return 'default';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return 'Aktif';
      case 'cashed': return 'Tahsil Edildi';
      case 'early_cashed': return 'Erken Bozduruldu';
      case 'returned': return 'İade Edildi';
      case 'cancelled': return 'İptal Edildi';
      case 'lost': return 'Kayıp';
      default: return status;
    }
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
                <h1 className="text-3xl font-bold text-gray-900">Çek Yönetimi</h1>
                <p className="text-gray-600">Çekleri takip edin ve yönetin</p>
              </div>
        <div className="flex gap-2">
          {user?.role === 'admin' && (
            <Dialog open={isAnalysisDialogOpen} onOpenChange={setIsAnalysisDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2">
                  <Camera className="h-4 w-4" />
                  AI Analiz
                </Button>
              </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Çek Resmi Analizi</DialogTitle>
                <DialogDescription>
                  Çek resmini yükleyin, AI otomatik olarak bilgileri çıkaracak
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="check-image">Çek Resmi</Label>
                  <Input
                    id="check-image"
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleImageAnalysis(file);
                      }
                    }}
                  />
                </div>
                {analysisLoading && (
                  <div className="space-y-2">
                    <div className="text-sm text-gray-600">Analiz ediliyor...</div>
                    <Progress value={undefined} className="w-full" />
                  </div>
                )}
                {analysisResult && (
                  <div className="space-y-2">
                    <div className="text-sm font-medium">
                      Analiz Sonucu: {analysisResult.success ? 'Başarılı' : 'Başarısız'}
                    </div>
                    {analysisResult.success && (
                      <div className="text-sm text-gray-600">
                        Güven Skoru: %{((analysisResult.confidence_score || 0) * 100).toFixed(1)}
                      </div>
                    )}
                    {analysisResult.error_message && (
                      <div className="text-sm text-red-600">{analysisResult.error_message}</div>
                    )}
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
          )}
          
          {user?.role === 'admin' && (
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Yeni Çek Ekle
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Yeni Çek Ekle</DialogTitle>
                <DialogDescription>
                  Yeni bir çek kaydı oluşturun
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateCheck} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="check_type">Çek Türü *</Label>
                    <Select
                      value={formData.check_type}
                      onValueChange={(value: 'received' | 'issued') =>
                        setFormData({ ...formData, check_type: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="received">Aldığımız Çek</SelectItem>
                        <SelectItem value="issued">Verdiğimiz Çek</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="check_number">Çek Numarası *</Label>
                    <Input
                      id="check_number"
                      value={formData.check_number}
                      onChange={(e) => setFormData({ ...formData, check_number: e.target.value })}
                      required
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
                    <Label htmlFor="bank_name">Banka Adı *</Label>
                    <Input
                      id="bank_name"
                      value={formData.bank_name}
                      onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="drawer_name">Çeken Adı *</Label>
                    <Input
                      id="drawer_name"
                      value={formData.drawer_name}
                      onChange={(e) => setFormData({ ...formData, drawer_name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="payee_name">Lehtar Adı</Label>
                    <Input
                      id="payee_name"
                      value={formData.payee_name}
                      onChange={(e) => setFormData({ ...formData, payee_name: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="issue_date">Çek Tarihi *</Label>
                    <Input
                      id="issue_date"
                      type="date"
                      value={formData.issue_date}
                      onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })}
                      required
                    />
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

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="branch_name">Şube Adı</Label>
                    <Input
                      id="branch_name"
                      value={formData.branch_name}
                      onChange={(e) => setFormData({ ...formData, branch_name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="drawer_id_number">Kimlik/Vergi No</Label>
                    <Input
                      id="drawer_id_number"
                      value={formData.drawer_id_number}
                      onChange={(e) => setFormData({ ...formData, drawer_id_number: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="description">Açıklama</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
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
      </div>

      {/* İstatistikler */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Toplam Çek</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statistics.total_checks}</div>
              <p className="text-xs text-muted-foreground">
                {statistics.total_received} alınan, {statistics.total_issued} verilen
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Toplam Değer</CardTitle>
              <CreditCard className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {formatCurrency(statistics.total_value)}
              </div>
              <p className="text-xs text-muted-foreground">
                Aktif: {formatCurrency(statistics.active_value)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Vadesi Geçmiş</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {formatCurrency(statistics.overdue_value)}
              </div>
              <p className="text-xs text-muted-foreground">
                {statistics.overdue_checks} çek
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Bu Ay Tahsil</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(statistics.cashed_this_month)}
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
                  placeholder="Çek numarası, çeken adı veya banka ile ara..."
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
                  <SelectItem value="received">Alınan</SelectItem>
                  <SelectItem value="issued">Verilen</SelectItem>
                </SelectContent>
              </Select>
              <Select value={selectedStatus} onValueChange={(value: any) => setSelectedStatus(value)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tüm Durumlar</SelectItem>
                  <SelectItem value="active">Aktif</SelectItem>
                  <SelectItem value="cashed">Tahsil Edildi</SelectItem>
                  <SelectItem value="early_cashed">Erken Bozduruldu</SelectItem>
                  <SelectItem value="returned">İade Edildi</SelectItem>
                  <SelectItem value="cancelled">İptal Edildi</SelectItem>
                  <SelectItem value="lost">Kayıp</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Çekler Tablosu */}
      <Card>
        <CardHeader>
          <CardTitle>Çekler ({filteredChecks.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Çek No</TableHead>
                <TableHead>Çeken</TableHead>
                <TableHead>Banka</TableHead>
                <TableHead>Tutar</TableHead>
                <TableHead>Vade</TableHead>
                <TableHead>Tür</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>İşlemler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredChecks.map((check) => (
                <TableRow key={check.id}>
                  <TableCell className="font-medium">{check.check_number}</TableCell>
                  <TableCell>{check.drawer_name}</TableCell>
                  <TableCell>{check.bank_name}</TableCell>
                  <TableCell>{formatCurrency(check.amount)}</TableCell>
                  <TableCell>
                    <div className={check.is_overdue ? 'text-red-600' : check.days_to_due <= 7 ? 'text-orange-600' : ''}>
                      {formatDate(check.due_date)}
                      {check.is_overdue && (
                        <div className="text-xs text-red-600">
                          {check.days_to_due} gün gecikmiş
                        </div>
                      )}
                      {!check.is_overdue && check.days_to_due <= 7 && check.days_to_due > 0 && (
                        <div className="text-xs text-orange-600">
                          {check.days_to_due} gün kaldı
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={check.check_type === 'received' ? 'default' : 'secondary'}>
                      {check.check_type === 'received' ? 'Alınan' : 'Verilen'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusColor(check.status) as any}>
                      {getStatusText(check.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {check.status === 'active' && (
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => openOperationDialog(check)}
                          className="text-green-600 hover:text-green-700"
                        >
                          <CreditCard className="h-4 w-4" />
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => openEditDialog(check)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openDeleteDialog(check)}
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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Çek Düzenle</DialogTitle>
            <DialogDescription>
              Çek bilgilerini güncelleyin
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateCheck} className="space-y-4">
            {/* Form fields (similar to create form but abbreviated for space) */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-check_number">Çek Numarası *</Label>
                <Input
                  id="edit-check_number"
                  value={formData.check_number}
                  onChange={(e) => setFormData({ ...formData, check_number: e.target.value })}
                  required
                />
              </div>
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

      {/* İşlem Dialog */}
      <Dialog open={isOperationDialogOpen} onOpenChange={setIsOperationDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Çek İşlemi</DialogTitle>
            <DialogDescription>
              {selectedCheckForOperation && `${selectedCheckForOperation.check_number} - ${selectedCheckForOperation.drawer_name}`}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleOperation} className="space-y-4">
            <div>
              <Label htmlFor="operation_type">İşlem Türü *</Label>
              <Select
                value={operationData.operation_type}
                onValueChange={(value) => setOperationData({ ...operationData, operation_type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="İşlem türü seçin" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Tahsil Et</SelectItem>
                  <SelectItem value="early_cash">Erken Bozdurun</SelectItem>
                  <SelectItem value="return">İade Et</SelectItem>
                  <SelectItem value="cancel">İptal Et</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="operation_date">İşlem Tarihi *</Label>
                <Input
                  id="operation_date"
                  type="date"
                  value={operationData.operation_date}
                  onChange={(e) => setOperationData({ ...operationData, operation_date: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="operation_amount">İşlem Tutarı</Label>
                <Input
                  id="operation_amount"
                  type="number"
                  step="0.01"
                  value={operationData.amount}
                  onChange={(e) => setOperationData({ ...operationData, amount: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>

            {operationData.operation_type === 'early_cash' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="discount_rate">İndirim Oranı (%)</Label>
                  <Input
                    id="discount_rate"
                    type="number"
                    step="0.01"
                    value={operationData.discount_rate}
                    onChange={(e) => setOperationData({ ...operationData, discount_rate: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label htmlFor="fees">Masraflar</Label>
                  <Input
                    id="fees"
                    type="number"
                    step="0.01"
                    value={operationData.fees}
                    onChange={(e) => setOperationData({ ...operationData, fees: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
            )}

            <div>
              <Label htmlFor="operation_description">Açıklama</Label>
              <Textarea
                id="operation_description"
                value={operationData.description}
                onChange={(e) => setOperationData({ ...operationData, description: e.target.value })}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsOperationDialogOpen(false)}>
                İptal
              </Button>
              <Button type="submit">İşlemi Kaydet</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={isDeleteDialogOpen}
        onClose={closeDeleteDialog}
        onConfirm={handleDeleteCheck}
        title="Çeki Sil"
        description="Bu çeki silmek istediğinizden emin misiniz? Bu işlem geri alınamaz."
        itemName={checkToDelete ? `${checkToDelete.check_number} - ${checkToDelete.drawer_name}` : undefined}
        loading={deleteLoading}
      />
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}