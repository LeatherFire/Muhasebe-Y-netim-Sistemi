'use client';

import { useState, useEffect } from 'react';
import { BarChart, FileText, TrendingUp, TrendingDown, Calendar, Download, Plus, Eye, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  reportsApi, 
  ReportSummary, 
  ReportRequest, 
  Report, 
  DashboardStats,
  IncomeExpenseReportData,
  CashFlowReportData,
  BankAccountSummaryData,
  PersonSummaryData,
  PaymentMethodAnalysisData
} from '@/lib/api/reports';
import ProtectedRoute from '@/components/ProtectedRoute';
import Navigation from '@/components/Navigation';
import DeleteConfirmationModal from '@/components/ui/delete-confirmation-modal';

export default function ReportsPage() {
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [reportToDelete, setReportToDelete] = useState<ReportSummary | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [formData, setFormData] = useState<ReportRequest>({
    report_type: 'income_expense',
    period: 'monthly',
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    include_pending: false,
    group_by_currency: true
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [reportsData, statsData] = await Promise.all([
        reportsApi.getReports(),
        reportsApi.getDashboardStats()
      ]);
      setReports(reportsData);
      setDashboardStats(statsData);
    } catch (error) {
      console.error('Veri yüklenirken hata:', error);
      setAlert({ type: 'error', message: 'Veriler yüklenirken bir hata oluştu' });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsGenerating(true);
      const report = await reportsApi.generateReport(formData);
      setAlert({ type: 'success', message: 'Rapor başarıyla oluşturuldu' });
      setIsCreateDialogOpen(false);
      loadData();
    } catch (error) {
      console.error('Rapor oluşturulurken hata:', error);
      setAlert({ type: 'error', message: 'Rapor oluşturulurken bir hata oluştu' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleQuickReport = async (type: 'monthly' | 'yearly' | 'current_month') => {
    try {
      setIsGenerating(true);
      const report = await reportsApi.generateQuickReport(type);
      setAlert({ type: 'success', message: 'Hızlı rapor başarıyla oluşturuldu' });
      loadData();
    } catch (error) {
      console.error('Hızlı rapor oluşturulurken hata:', error);
      setAlert({ type: 'error', message: 'Hızlı rapor oluşturulurken bir hata oluştu' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleViewReport = async (reportId: string) => {
    try {
      const report = await reportsApi.getReport(reportId);
      setSelectedReport(report);
      setIsReportDialogOpen(true);
    } catch (error) {
      console.error('Rapor görüntülenirken hata:', error);
      setAlert({ type: 'error', message: 'Rapor görüntülenirken bir hata oluştu' });
    }
  };

  const handleDeleteReport = async () => {
    if (!reportToDelete) return;

    try {
      setDeleteLoading(true);
      await reportsApi.deleteReport(reportToDelete.id);
      setAlert({ type: 'success', message: 'Rapor başarıyla silindi' });
      setIsDeleteDialogOpen(false);
      setReportToDelete(null);
      loadData();
    } catch (error) {
      console.error('Rapor silinirken hata:', error);
      setAlert({ type: 'error', message: 'Rapor silinirken bir hata oluştu' });
    } finally {
      setDeleteLoading(false);
    }
  };

  const openDeleteDialog = (report: ReportSummary) => {
    setReportToDelete(report);
    setIsDeleteDialogOpen(true);
  };

  const closeDeleteDialog = () => {
    setIsDeleteDialogOpen(false);
    setReportToDelete(null);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('tr-TR');
  };

  const getReportTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'income_expense': 'Gelir-Gider',
      'cash_flow': 'Nakit Akış',
      'bank_account_summary': 'Banka Hesap Özeti',
      'person_summary': 'Kişi/Kurum Özeti',
      'payment_method_analysis': 'Ödeme Yöntemi Analizi'
    };
    return labels[type] || type;
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
                <h1 className="text-3xl font-bold text-gray-900">Raporlar ve Analiz</h1>
                <p className="text-gray-600">İşletmenizin finansal durumunu analiz edin</p>
              </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => handleQuickReport('monthly')} 
            variant="outline"
            disabled={isGenerating}
          >
            <BarChart className="h-4 w-4 mr-2" />
            Aylık Rapor
          </Button>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Yeni Rapor
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Yeni Rapor Oluştur</DialogTitle>
                <DialogDescription>
                  Özel rapor parametreleri belirleyin
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleGenerateReport} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="report_type">Rapor Türü</Label>
                    <Select
                      value={formData.report_type}
                      onValueChange={(value: any) => setFormData({ ...formData, report_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="income_expense">Gelir-Gider Raporu</SelectItem>
                        <SelectItem value="cash_flow">Nakit Akış Raporu</SelectItem>
                        <SelectItem value="bank_account_summary">Banka Hesap Özeti</SelectItem>
                        <SelectItem value="person_summary">Kişi/Kurum Özeti</SelectItem>
                        <SelectItem value="payment_method_analysis">Ödeme Yöntemi Analizi</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="period">Periyod</Label>
                    <Select
                      value={formData.period}
                      onValueChange={(value: any) => setFormData({ ...formData, period: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Günlük</SelectItem>
                        <SelectItem value="weekly">Haftalık</SelectItem>
                        <SelectItem value="monthly">Aylık</SelectItem>
                        <SelectItem value="quarterly">Çeyreklik</SelectItem>
                        <SelectItem value="yearly">Yıllık</SelectItem>
                        <SelectItem value="custom">Özel Dönem</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="start_date">Başlangıç Tarihi</Label>
                    <Input
                      id="start_date"
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="end_date">Bitiş Tarihi</Label>
                    <Input
                      id="end_date"
                      type="date"
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    İptal
                  </Button>
                  <Button type="submit" disabled={isGenerating}>
                    {isGenerating ? 'Oluşturuluyor...' : 'Rapor Oluştur'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Dashboard İstatistikleri */}
      {dashboardStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Bu Ay Gelir</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(dashboardStats.current_month_income)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Bu Ay Gider</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {formatCurrency(dashboardStats.current_month_expense)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Net Kar</CardTitle>
              <BarChart className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${dashboardStats.current_month_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(dashboardStats.current_month_profit)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Toplam Bakiye</CardTitle>
              <FileText className="h-4 w-4 text-gray-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(dashboardStats.total_bank_balance)}
              </div>
              <p className="text-xs text-muted-foreground">
                {dashboardStats.pending_payments} bekleyen ödeme
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Hızlı Eylemler */}
      <Card>
        <CardHeader>
          <CardTitle>Hızlı Raporlar</CardTitle>
          <CardDescription>Sık kullanılan raporları tek tıkla oluşturun</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button 
              variant="outline" 
              className="h-20 flex-col"
              onClick={() => handleQuickReport('monthly')}
              disabled={isGenerating}
            >
              <Calendar className="h-6 w-6 mb-2" />
              Bu Ay Raporu
            </Button>
            <Button 
              variant="outline" 
              className="h-20 flex-col"
              onClick={() => handleQuickReport('yearly')}
              disabled={isGenerating}
            >
              <TrendingUp className="h-6 w-6 mb-2" />
              Yıllık Rapor
            </Button>
            <Button 
              variant="outline" 
              className="h-20 flex-col"
              onClick={() => handleQuickReport('current_month')}
              disabled={isGenerating}
            >
              <BarChart className="h-6 w-6 mb-2" />
              Nakit Akış
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Raporlar Listesi */}
      <Card>
        <CardHeader>
          <CardTitle>Oluşturulmuş Raporlar</CardTitle>
          <CardDescription>Geçmişte oluşturulan raporları görüntüleyin</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rapor Adı</TableHead>
                <TableHead>Tür</TableHead>
                <TableHead>Periyod</TableHead>
                <TableHead>Tarih Aralığı</TableHead>
                <TableHead>Oluşturulma</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>İşlemler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports.map((report) => (
                <TableRow key={report.id}>
                  <TableCell className="font-medium">{report.title}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {getReportTypeLabel(report.report_type)}
                    </Badge>
                  </TableCell>
                  <TableCell className="capitalize">{report.period}</TableCell>
                  <TableCell>
                    {formatDate(report.start_date)} - {formatDate(report.end_date)}
                  </TableCell>
                  <TableCell>{formatDate(report.generated_at)}</TableCell>
                  <TableCell>
                    <Badge variant={report.status === 'completed' ? 'default' : 'secondary'}>
                      {report.status === 'completed' ? 'Tamamlandı' : 'İşleniyor'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleViewReport(report.id)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openDeleteDialog(report)}
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

      {/* Rapor Görüntüleme Dialog */}
      <Dialog open={isReportDialogOpen} onOpenChange={setIsReportDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedReport?.title}</DialogTitle>
            <DialogDescription>
              {selectedReport && `${formatDate(selectedReport.start_date)} - ${formatDate(selectedReport.end_date)}`}
            </DialogDescription>
          </DialogHeader>
          {selectedReport && (
            <div className="space-y-6">
              {selectedReport.data.income_expense && (
                <div>
                  <h3 className="text-lg font-semibold mb-4">Gelir-Gider Analizi</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-2xl font-bold text-green-600">
                          {formatCurrency(selectedReport.data.income_expense.total_income)}
                        </div>
                        <p className="text-sm text-muted-foreground">Toplam Gelir</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-2xl font-bold text-red-600">
                          {formatCurrency(selectedReport.data.income_expense.total_expense)}
                        </div>
                        <p className="text-sm text-muted-foreground">Toplam Gider</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className={`text-2xl font-bold ${selectedReport.data.income_expense.net_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(selectedReport.data.income_expense.net_profit)}
                        </div>
                        <p className="text-sm text-muted-foreground">Net Kar</p>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}

              {selectedReport.data.cash_flow && (
                <div>
                  <h3 className="text-lg font-semibold mb-4">Nakit Akış Analizi</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-2xl font-bold text-blue-600">
                          {formatCurrency(selectedReport.data.cash_flow.total_inflow)}
                        </div>
                        <p className="text-sm text-muted-foreground">Toplam Giriş</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-2xl font-bold text-orange-600">
                          {formatCurrency(selectedReport.data.cash_flow.total_outflow)}
                        </div>
                        <p className="text-sm text-muted-foreground">Toplam Çıkış</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className={`text-2xl font-bold ${selectedReport.data.cash_flow.net_cash_flow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(selectedReport.data.cash_flow.net_cash_flow)}
                        </div>
                        <p className="text-sm text-muted-foreground">Net Nakit Akış</p>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}

              {selectedReport.data.bank_accounts && (
                <div>
                  <h3 className="text-lg font-semibold mb-4">Banka Hesap Özeti</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Hesap Adı</TableHead>
                        <TableHead>Para Birimi</TableHead>
                        <TableHead>Mevcut Bakiye</TableHead>
                        <TableHead>Toplam Gelir</TableHead>
                        <TableHead>Toplam Gider</TableHead>
                        <TableHead>İşlem Sayısı</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedReport.data.bank_accounts.map((account) => (
                        <TableRow key={account.account_id}>
                          <TableCell className="font-medium">{account.account_name}</TableCell>
                          <TableCell>{account.currency}</TableCell>
                          <TableCell>{formatCurrency(account.closing_balance)}</TableCell>
                          <TableCell className="text-green-600">{formatCurrency(account.total_income)}</TableCell>
                          <TableCell className="text-red-600">{formatCurrency(account.total_expense)}</TableCell>
                          <TableCell>{account.transaction_count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {selectedReport.data.people && (
                <div>
                  <h3 className="text-lg font-semibold mb-4">Kişi/Kurum Özeti</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Kişi/Kurum</TableHead>
                        <TableHead>Tür</TableHead>
                        <TableHead>Gönderilen</TableHead>
                        <TableHead>Alınan</TableHead>
                        <TableHead>Net Bakiye</TableHead>
                        <TableHead>İşlem Sayısı</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedReport.data.people.map((person) => (
                        <TableRow key={person.person_id}>
                          <TableCell className="font-medium">{person.person_name}</TableCell>
                          <TableCell>
                            <Badge variant={person.person_type === 'individual' ? 'default' : 'secondary'}>
                              {person.person_type === 'individual' ? 'Bireysel' : 'Kurumsal'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-red-600">{formatCurrency(person.total_sent)}</TableCell>
                          <TableCell className="text-green-600">{formatCurrency(person.total_received)}</TableCell>
                          <TableCell className={person.net_balance >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {formatCurrency(person.net_balance)}
                          </TableCell>
                          <TableCell>{person.transaction_count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {selectedReport.data.payment_methods && (
                <div>
                  <h3 className="text-lg font-semibold mb-4">Ödeme Yöntemi Analizi</h3>
                  <div className="space-y-4">
                    {selectedReport.data.payment_methods.map((method) => (
                      <Card key={method.method}>
                        <CardContent className="pt-6">
                          <div className="flex justify-between items-center mb-2">
                            <h4 className="font-medium">{method.method}</h4>
                            <Badge variant="outline">{method.percentage.toFixed(1)}%</Badge>
                          </div>
                          <Progress value={method.percentage} className="mb-2" />
                          <div className="flex justify-between text-sm text-muted-foreground">
                            <span>{method.transaction_count} işlem</span>
                            <span>{formatCurrency(method.total_amount)}</span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {isGenerating && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="p-6">
            <div className="flex items-center space-x-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <div>Rapor oluşturuluyor...</div>
            </div>
          </Card>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={isDeleteDialogOpen}
        onClose={closeDeleteDialog}
        onConfirm={handleDeleteReport}
        title="Raporu Sil"
        description="Bu raporu silmek istediğinizden emin misiniz? Bu işlem geri alınamaz."
        itemName={reportToDelete ? reportToDelete.title : undefined}
        loading={deleteLoading}
      />
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}