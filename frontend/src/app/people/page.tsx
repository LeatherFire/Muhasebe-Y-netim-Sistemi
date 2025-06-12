'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, Users, Building2, TrendingUp, TrendingDown, Eye, Edit, Trash2, Upload, FileText, User, Briefcase, UserCheck, UserX, Calendar, DollarSign, Phone, MapPin, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';
import { 
  employeesApi, 
  Employee, 
  EmployeeCreate, 
  EmployeeUpdate, 
  EmployeeSummary, 
  EmployeeStatistics,
  EmployeeStatus,
  EmployeePosition,
  DocumentType,
  EmployeeDraft,
  positionLabels,
  statusLabels,
  statusColors,
  documentTypeLabels
} from '@/lib/api/employees';
import ProtectedRoute from '@/components/ProtectedRoute';
import Navigation from '@/components/Navigation';
import DeleteConfirmationModal from '@/components/ui/delete-confirmation-modal';

export default function EmployeesPage() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<EmployeeSummary[]>([]);
  const [statistics, setStatistics] = useState<EmployeeStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<EmployeeStatus | 'all'>('all');
  const [selectedPosition, setSelectedPosition] = useState<EmployeePosition | 'all'>('all');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isDocumentDialogOpen, setIsDocumentDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [employeeDraft, setEmployeeDraft] = useState<EmployeeDraft | null>(null);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [uploading, setUploading] = useState(false);

  const [formData, setFormData] = useState<EmployeeCreate>({
    first_name: '',
    last_name: '',
    tc_number: '',
    phone: '',
    email: '',
    address: '',
    birth_date: '',
    position: EmployeePosition.OTHER,
    department: 'Mutfak',
    hire_date: new Date().toISOString().split('T')[0],
    salary: 0,
    emergency_contact_name: '',
    emergency_contact_phone: '',
    work_schedule: '',
    contract_type: 'full_time',
    notes: ''
  });

  // Belge yükleme state'leri
  const [documentType, setDocumentType] = useState<DocumentType>(DocumentType.ID_CARD);
  const [documentDescription, setDocumentDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    loadData();
  }, [selectedStatus, selectedPosition, selectedDepartment]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      const filters: any = {};
      if (selectedStatus !== 'all') filters.status_filter = selectedStatus;
      if (selectedPosition !== 'all') filters.position_filter = selectedPosition;
      if (selectedDepartment !== 'all') filters.department_filter = selectedDepartment;

      const [employeesData, statsData] = await Promise.all([
        employeesApi.getEmployees(filters),
        employeesApi.getEmployeeStatistics()
      ]);

      setEmployees(employeesData);
      setStatistics(statsData);
    } catch (error) {
      console.error('Veri yüklenirken hata:', error);
      setAlert({ type: 'error', message: 'Veriler yüklenirken bir hata oluştu' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setUploading(true);
      // Önce AI analizi için taslak oluştur
      const result = await employeesApi.createEmployeeDraft(formData);
      setEmployeeDraft(result.draft);
      setIsCreateDialogOpen(false);
      setIsConfirmDialogOpen(true);
    } catch (error: any) {
      console.error('Çalışan taslağı oluşturulurken hata:', error);
      setAlert({ type: 'error', message: error.message || 'Çalışan taslağı oluşturulurken bir hata oluştu' });
    } finally {
      setUploading(false);
    }
  };

  const handleConfirmEmployee = async () => {
    if (!employeeDraft) return;
    
    try {
      setUploading(true);
      await employeesApi.confirmEmployee(employeeDraft);
      setAlert({ type: 'success', message: 'Çalışan başarıyla eklendi' });
      setIsConfirmDialogOpen(false);
      setEmployeeDraft(null);
      resetForm();
      loadData();
    } catch (error: any) {
      console.error('Çalışan kaydedilirken hata:', error);
      setAlert({ type: 'error', message: error.message || 'Çalışan kaydedilirken bir hata oluştu' });
    } finally {
      setUploading(false);
    }
  };

  const handleUpdateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;

    try {
      await employeesApi.updateEmployee(editingEmployee.id, formData as EmployeeUpdate);
      setAlert({ type: 'success', message: 'Çalışan başarıyla güncellendi' });
      setIsEditDialogOpen(false);
      setEditingEmployee(null);
      resetForm();
      loadData();
    } catch (error: any) {
      console.error('Çalışan güncellenirken hata:', error);
      setAlert({ type: 'error', message: error.message || 'Çalışan güncellenirken bir hata oluştu' });
    }
  };

  const handleDeleteEmployee = async () => {
    if (!employeeToDelete) return;

    try {
      setDeleteLoading(true);
      await employeesApi.deleteEmployee(employeeToDelete.id);
      setAlert({ type: 'success', message: 'Çalışan başarıyla silindi' });
      setIsDeleteDialogOpen(false);
      setEmployeeToDelete(null);
      loadData();
    } catch (error: any) {
      console.error('Çalışan silinirken hata:', error);
      setAlert({ type: 'error', message: error.message || 'Çalışan silinirken bir hata oluştu' });
    } finally {
      setDeleteLoading(false);
    }
  };

  const openDeleteDialog = (employee: Employee) => {
    setEmployeeToDelete(employee);
    setIsDeleteDialogOpen(true);
  };

  const closeDeleteDialog = () => {
    setIsDeleteDialogOpen(false);
    setEmployeeToDelete(null);
  };

  const handleStatusChange = async (employeeId: string, newStatus: EmployeeStatus) => {
    try {
      await employeesApi.updateEmployeeStatus(employeeId, newStatus);
      setAlert({ type: 'success', message: 'Çalışan durumu güncellendi' });
      loadData();
    } catch (error: any) {
      console.error('Durum güncellenirken hata:', error);
      setAlert({ type: 'error', message: error.message || 'Durum güncellenirken bir hata oluştu' });
    }
  };

  const handleDocumentUpload = async () => {
    if (!selectedEmployee || !selectedFile) return;

    try {
      setUploading(true);
      await employeesApi.uploadEmployeeDocument(
        selectedEmployee.id,
        documentType,
        selectedFile,
        documentDescription
      );
      setAlert({ type: 'success', message: 'Belge başarıyla yüklendi' });
      resetDocumentForm();
      // Çalışan detaylarını yenile
      if (selectedEmployee) {
        const updatedEmployee = await employeesApi.getEmployee(selectedEmployee.id);
        setSelectedEmployee(updatedEmployee);
        // Detay dialog açıksa güncel bilgileri göster
        if (isDetailDialogOpen) {
          setSelectedEmployee(updatedEmployee);
        }
      }
      // Dialog'u açık tut, kullanıcı isterse daha fazla belge yükleyebilir
      // İsterseniz kapatabilirsiniz: setIsDocumentDialogOpen(false);
    } catch (error: any) {
      console.error('Belge yüklenirken hata:', error);
      setAlert({ type: 'error', message: error.message || 'Belge yüklenirken bir hata oluştu' });
    } finally {
      setUploading(false);
    }
  };

  const openDetailDialog = async (employee: EmployeeSummary) => {
    try {
      const fullEmployee = await employeesApi.getEmployee(employee.id);
      setSelectedEmployee(fullEmployee);
      setIsDetailDialogOpen(true);
    } catch (error: any) {
      setAlert({ type: 'error', message: 'Çalışan detayları yüklenirken hata oluştu' });
    }
  };

  const openEditDialog = (employee: EmployeeSummary) => {
    setEditingEmployee(employee as Employee);
    setFormData({
      first_name: employee.first_name,
      last_name: employee.last_name,
      tc_number: (employee as any).tc_number || '',
      phone: employee.phone,
      email: (employee as any).email || '',
      address: (employee as any).address || '',
      birth_date: (employee as any).birth_date || '',
      position: employee.position,
      department: employee.department,
      hire_date: employee.hire_date,
      salary: employee.salary,
      emergency_contact_name: (employee as any).emergency_contact_name || '',
      emergency_contact_phone: (employee as any).emergency_contact_phone || '',
      work_schedule: (employee as any).work_schedule || '',
      contract_type: (employee as any).contract_type || 'full_time',
      notes: (employee as any).notes || ''
    });
    setIsEditDialogOpen(true);
  };

  const openDocumentDialog = async (employee: EmployeeSummary) => {
    try {
      const fullEmployee = await employeesApi.getEmployee(employee.id);
      setSelectedEmployee(fullEmployee);
      setIsDocumentDialogOpen(true);
    } catch (error: any) {
      setAlert({ type: 'error', message: 'Çalışan detayları yüklenirken hata oluştu' });
    }
  };

  const resetForm = () => {
    setFormData({
      first_name: '',
      last_name: '',
      tc_number: '',
      phone: '',
      email: '',
      address: '',
      birth_date: '',
      position: EmployeePosition.OTHER,
      department: 'Mutfak',
      hire_date: new Date().toISOString().split('T')[0],
      salary: 0,
      emergency_contact_name: '',
      emergency_contact_phone: '',
      work_schedule: '',
      contract_type: 'full_time',
      notes: ''
    });
  };

  const resetDocumentForm = () => {
    setDocumentType(DocumentType.ID_CARD);
    setDocumentDescription('');
    setSelectedFile(null);
  };

  const filteredEmployees = employees.filter(employee =>
    employee.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.phone.includes(searchTerm) ||
    employee.department.toLowerCase().includes(searchTerm.toLowerCase())
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

  const calculateAge = (birthDate: string) => {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const getDepartments = () => {
    const departments = Array.from(new Set(employees.map(emp => emp.department)));
    return departments;
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

            {/* Header */}
            <div className="flex justify-between items-center mb-8">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Personel Yönetimi</h1>
                <p className="text-gray-600">Yemekhane çalışanlarını yönetin</p>
              </div>
              {user?.role === 'admin' && (
                <Button 
                  onClick={() => setIsCreateDialogOpen(true)}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4" />
                  Yeni Çalışan Ekle
                </Button>
              )}
            </div>

            {/* İstatistikler */}
            {statistics && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Toplam Çalışan</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{statistics.total_employees}</div>
                    <p className="text-xs text-muted-foreground">
                      {statistics.active_employees} aktif, {statistics.inactive_employees} pasif
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Aktif Çalışan</CardTitle>
                    <UserCheck className="h-4 w-4 text-green-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">{statistics.active_employees}</div>
                    <p className="text-xs text-muted-foreground">
                      {statistics.probation_employees} deneme sürecinde
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Toplam Maaş</CardTitle>
                    <DollarSign className="h-4 w-4 text-blue-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600">
                      {formatCurrency(statistics.total_monthly_salary)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Aylık toplam
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Ortalama Maaş</CardTitle>
                    <TrendingUp className="h-4 w-4 text-purple-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-purple-600">
                      {formatCurrency(statistics.average_salary)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Çalışan başına
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Filtreler */}
            <Card className="mb-6">
              <CardHeader>
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                  <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <Input
                        placeholder="Ad, telefon veya departman ile ara..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 w-80"
                      />
                    </div>
                    
                    <Select value={selectedStatus} onValueChange={(value: any) => setSelectedStatus(value)}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Durum" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tüm Durumlar</SelectItem>
                        <SelectItem value={EmployeeStatus.ACTIVE}>Aktif</SelectItem>
                        <SelectItem value={EmployeeStatus.INACTIVE}>Pasif</SelectItem>
                        <SelectItem value={EmployeeStatus.PROBATION}>Deneme</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={selectedPosition} onValueChange={(value: any) => setSelectedPosition(value)}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Pozisyon" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tüm Pozisyonlar</SelectItem>
                        {Object.entries(positionLabels).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Departman" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tüm Departmanlar</SelectItem>
                        {getDepartments().map(dept => (
                          <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
            </Card>

            {/* Çalışanlar Listesi */}
            <Card>
              <CardHeader>
                <CardTitle>Çalışanlar ({filteredEmployees.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {filteredEmployees.length > 0 ? (
                  <div className="space-y-4">
                    {filteredEmployees.map((employee) => (
                      <div key={employee.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            {/* Avatar */}
                            <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                              {employee.has_avatar ? (
                                <img 
                                  src={`https://ui-avatars.com/api/?name=${employee.first_name}+${employee.last_name}&background=random&size=48`}
                                  alt={employee.full_name}
                                  className="w-12 h-12 rounded-full"
                                />
                              ) : (
                                <User className="h-6 w-6 text-gray-400" />
                              )}
                            </div>
                            
                            {/* Bilgiler */}
                            <div>
                              <h3 className="text-lg font-medium text-gray-900">{employee.full_name}</h3>
                              <div className="flex items-center space-x-4 text-sm text-gray-600">
                                <span className="flex items-center">
                                  <Briefcase className="h-4 w-4 mr-1" />
                                  {positionLabels[employee.position]}
                                </span>
                                <span className="flex items-center">
                                  <Building2 className="h-4 w-4 mr-1" />
                                  {employee.department}
                                </span>
                                <span className="flex items-center">
                                  <Phone className="h-4 w-4 mr-1" />
                                  {employee.phone}
                                </span>
                                <span className="flex items-center">
                                  <DollarSign className="h-4 w-4 mr-1" />
                                  {formatCurrency(employee.salary)}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center space-x-3">
                            {/* Durum */}
                            <Badge className={statusColors[employee.status]}>
                              {statusLabels[employee.status]}
                            </Badge>

                            {/* Belgeler */}
                            <Badge variant="outline">
                              <FileText className="h-3 w-3 mr-1" />
                              {employee.document_count} belge
                            </Badge>

                            {/* Aksiyonlar */}
                            <div className="flex space-x-2">
                              <Button 
                                size="sm" 
                                variant="outline" 
                                onClick={() => openDetailDialog(employee)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              
                              {user?.role === 'admin' && (
                                <>
                                  <Button 
                                    size="sm" 
                                    variant="outline" 
                                    onClick={() => openEditDialog(employee)}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  
                                  <Button 
                                    size="sm" 
                                    variant="outline" 
                                    onClick={() => openDocumentDialog(employee)}
                                    title="Belge Yükle"
                                  >
                                    <Upload className="h-4 w-4 mr-1" />
                                    Belge
                                  </Button>

                                  {/* Durum değiştirme butonları */}
                                  {employee.status === EmployeeStatus.ACTIVE ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleStatusChange(employee.id, EmployeeStatus.INACTIVE)}
                                      className="text-red-600 hover:text-red-700"
                                    >
                                      <UserX className="h-4 w-4" />
                                    </Button>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleStatusChange(employee.id, EmployeeStatus.ACTIVE)}
                                      className="text-green-600 hover:text-green-700"
                                    >
                                      <UserCheck className="h-4 w-4" />
                                    </Button>
                                  )}

                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openDeleteDialog(employee)}
                                    className="text-red-600 hover:text-red-700"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Çalışan bulunamadı</h3>
                    <p className="text-gray-500 mb-4">
                      Arama kriterlerinize uygun çalışan bulunamadı.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Çalışan Oluşturma Formu Dialog */}
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Yeni Çalışan Ekle</DialogTitle>
                <DialogDescription>
                  Yeni bir çalışan ekleyin. AI analizi yapılacak ve onayınız istenir.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateEmployee} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="first_name">Ad *</Label>
                    <Input
                      id="first_name"
                      value={formData.first_name}
                      onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="last_name">Soyad *</Label>
                    <Input
                      id="last_name"
                      value={formData.last_name}
                      onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="tc_number">TC Kimlik Numarası *</Label>
                    <Input
                      id="tc_number"
                      value={formData.tc_number}
                      onChange={(e) => setFormData({ ...formData, tc_number: e.target.value })}
                      maxLength={11}
                      pattern="[0-9]{11}"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Telefon *</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="email">E-posta</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="birth_date">Doğum Tarihi *</Label>
                    <Input
                      id="birth_date"
                      type="date"
                      value={formData.birth_date}
                      onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="address">Adres *</Label>
                  <Textarea
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    required
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="position">Pozisyon *</Label>
                    <Select
                      value={formData.position}
                      onValueChange={(value) => setFormData({ ...formData, position: value as EmployeePosition })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(positionLabels).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="department">Departman *</Label>
                    <Input
                      id="department"
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="salary">Maaş (TRY) *</Label>
                    <Input
                      id="salary"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.salary}
                      onChange={(e) => setFormData({ ...formData, salary: parseFloat(e.target.value) || 0 })}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="hire_date">İşe Giriş Tarihi *</Label>
                    <Input
                      id="hire_date"
                      type="date"
                      value={formData.hire_date}
                      onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="work_schedule">Çalışma Programı</Label>
                    <Input
                      id="work_schedule"
                      value={formData.work_schedule}
                      onChange={(e) => setFormData({ ...formData, work_schedule: e.target.value })}
                      placeholder="Örn: Pazartesi-Cuma 09:00-17:00"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="emergency_contact_name">Acil Durum İletişim Kişisi</Label>
                    <Input
                      id="emergency_contact_name"
                      value={formData.emergency_contact_name}
                      onChange={(e) => setFormData({ ...formData, emergency_contact_name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="emergency_contact_phone">Acil Durum Telefonu</Label>
                    <Input
                      id="emergency_contact_phone"
                      value={formData.emergency_contact_phone}
                      onChange={(e) => setFormData({ ...formData, emergency_contact_phone: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="notes">Notlar</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Çalışan hakkında notlar..."
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    İptal
                  </Button>
                  <Button type="submit" disabled={uploading}>
                    {uploading ? 'AI Analizi Yapılıyor...' : 'AI Analizi Yap'}
                  </Button>
                </div>
              </form>
              </DialogContent>
            </Dialog>

            {/* Çalışan Düzenleme Formu Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Çalışan Düzenle</DialogTitle>
                  <DialogDescription>
                    Çalışan bilgilerini güncelleyin.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleUpdateEmployee} className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="edit_first_name">Ad *</Label>
                      <Input
                        id="edit_first_name"
                        value={formData.first_name}
                        onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit_last_name">Soyad *</Label>
                      <Input
                        id="edit_last_name"
                        value={formData.last_name}
                        onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="edit_tc_number">TC Kimlik Numarası *</Label>
                      <Input
                        id="edit_tc_number"
                        value={formData.tc_number}
                        onChange={(e) => setFormData({ ...formData, tc_number: e.target.value })}
                        maxLength={11}
                        pattern="[0-9]{11}"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit_phone">Telefon *</Label>
                      <Input
                        id="edit_phone"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="edit_email">E-posta</Label>
                      <Input
                        id="edit_email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit_birth_date">Doğum Tarihi *</Label>
                      <Input
                        id="edit_birth_date"
                        type="date"
                        value={formData.birth_date}
                        onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="edit_address">Adres *</Label>
                    <Textarea
                      id="edit_address"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="edit_position">Pozisyon *</Label>
                      <Select
                        value={formData.position}
                        onValueChange={(value) => setFormData({ ...formData, position: value as EmployeePosition })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(positionLabels).map(([key, label]) => (
                            <SelectItem key={key} value={key}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="edit_department">Departman *</Label>
                      <Input
                        id="edit_department"
                        value={formData.department}
                        onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit_salary">Maaş (TRY) *</Label>
                      <Input
                        id="edit_salary"
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.salary}
                        onChange={(e) => setFormData({ ...formData, salary: parseFloat(e.target.value) || 0 })}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="edit_hire_date">İşe Giriş Tarihi *</Label>
                      <Input
                        id="edit_hire_date"
                        type="date"
                        value={formData.hire_date}
                        onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit_work_schedule">Çalışma Programı</Label>
                      <Input
                        id="edit_work_schedule"
                        value={formData.work_schedule}
                        onChange={(e) => setFormData({ ...formData, work_schedule: e.target.value })}
                        placeholder="Örn: Pazartesi-Cuma 09:00-17:00"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="edit_emergency_contact_name">Acil Durum İletişim Kişisi</Label>
                      <Input
                        id="edit_emergency_contact_name"
                        value={formData.emergency_contact_name}
                        onChange={(e) => setFormData({ ...formData, emergency_contact_name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit_emergency_contact_phone">Acil Durum Telefonu</Label>
                      <Input
                        id="edit_emergency_contact_phone"
                        value={formData.emergency_contact_phone}
                        onChange={(e) => setFormData({ ...formData, emergency_contact_phone: e.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="edit_notes">Notlar</Label>
                    <Textarea
                      id="edit_notes"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Çalışan hakkında notlar..."
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                      İptal
                    </Button>
                    <Button type="submit">
                      Güncelle
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>

            {/* AI Onay Dialog */}
            <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>AI Analizi - Onay Gerekli</DialogTitle>
                  <DialogDescription>
                    AI analizi tamamlandı. Lütfen bilgileri kontrol edin ve onaylayın.
                  </DialogDescription>
                </DialogHeader>
                
                {employeeDraft && (
                  <div className="space-y-6">
                    {/* AI Avatar */}
                    <div className="flex items-center space-x-4">
                      <img 
                        src={employeeDraft.ai_analysis.avatar_url}
                        alt="AI Generated Avatar"
                        className="w-20 h-20 rounded-full"
                      />
                      <div>
                        <h3 className="text-lg font-medium">
                          {employeeDraft.employee_data.first_name} {employeeDraft.employee_data.last_name}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {positionLabels[employeeDraft.employee_data.position]} - {employeeDraft.employee_data.department}
                        </p>
                      </div>
                    </div>

                    {/* AI Profil Özeti */}
                    <div>
                      <Label>AI Profil Özeti:</Label>
                      <div className="mt-2 p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <p className="text-sm">{employeeDraft.ai_analysis.profile_summary}</p>
                      </div>
                    </div>

                    {/* Çalışan Bilgileri Özeti */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <strong>Pozisyon:</strong> {positionLabels[employeeDraft.employee_data.position]}
                      </div>
                      <div>
                        <strong>Maaş:</strong> {formatCurrency(employeeDraft.employee_data.salary)}
                      </div>
                      <div>
                        <strong>İşe Giriş:</strong> {formatDate(employeeDraft.employee_data.hire_date)}
                      </div>
                      <div>
                        <strong>Telefon:</strong> {employeeDraft.employee_data.phone}
                      </div>
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setIsConfirmDialogOpen(false)}>
                        İptal
                      </Button>
                      <Button onClick={handleConfirmEmployee} disabled={uploading}>
                        {uploading ? 'Kaydediliyor...' : 'Onayla ve Kaydet'}
                      </Button>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>

            {/* Detay Dialog */}
            <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Çalışan Detayları</DialogTitle>
                </DialogHeader>
                
                {selectedEmployee && (
                  <div className="space-y-6">
                    {/* Üst Bilgiler */}
                    <div className="flex items-center space-x-6">
                      <img 
                        src={selectedEmployee.ai_generated_avatar || `https://ui-avatars.com/api/?name=${selectedEmployee.first_name}+${selectedEmployee.last_name}&background=random&size=100`}
                        alt={`${selectedEmployee.first_name} ${selectedEmployee.last_name}`}
                        className="w-24 h-24 rounded-full"
                      />
                      <div className="flex-1">
                        <h2 className="text-2xl font-bold">{selectedEmployee.first_name} {selectedEmployee.last_name}</h2>
                        <p className="text-lg text-gray-600">{positionLabels[selectedEmployee.position]} - {selectedEmployee.department}</p>
                        <div className="flex items-center space-x-4 mt-2">
                          <Badge className={statusColors[selectedEmployee.status]}>
                            {statusLabels[selectedEmployee.status]}
                          </Badge>
                          <span className="text-sm text-gray-600">
                            İşe Giriş: {formatDate(selectedEmployee.hire_date)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* AI Profil Özeti */}
                    {selectedEmployee.ai_profile_summary && (
                      <div>
                        <Label className="text-base font-medium">AI Profil Özeti:</Label>
                        <div className="mt-2 p-4 bg-blue-50 rounded-lg border border-blue-200">
                          <p className="text-sm">{selectedEmployee.ai_profile_summary}</p>
                        </div>
                      </div>
                    )}

                    <Tabs defaultValue="personal" className="w-full">
                      <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="personal">Kişisel Bilgiler</TabsTrigger>
                        <TabsTrigger value="work">İş Bilgileri</TabsTrigger>
                        <TabsTrigger value="documents">Belgeler ({selectedEmployee.documents.length})</TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="personal" className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>TC Kimlik No:</Label>
                            <p className="font-medium">{selectedEmployee.tc_number}</p>
                          </div>
                          <div>
                            <Label>Doğum Tarihi:</Label>
                            <p className="font-medium">
                              {formatDate(selectedEmployee.birth_date)} 
                              ({calculateAge(selectedEmployee.birth_date)} yaş)
                            </p>
                          </div>
                          <div>
                            <Label>Telefon:</Label>
                            <p className="font-medium">{selectedEmployee.phone}</p>
                          </div>
                          <div>
                            <Label>E-posta:</Label>
                            <p className="font-medium">{selectedEmployee.email || 'Belirtilmemiş'}</p>
                          </div>
                        </div>
                        <div>
                          <Label>Adres:</Label>
                          <p className="font-medium">{selectedEmployee.address}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Acil Durum Kişisi:</Label>
                            <p className="font-medium">{selectedEmployee.emergency_contact_name || 'Belirtilmemiş'}</p>
                          </div>
                          <div>
                            <Label>Acil Durum Telefonu:</Label>
                            <p className="font-medium">{selectedEmployee.emergency_contact_phone || 'Belirtilmemiş'}</p>
                          </div>
                        </div>
                      </TabsContent>
                      
                      <TabsContent value="work" className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Pozisyon:</Label>
                            <p className="font-medium">{positionLabels[selectedEmployee.position]}</p>
                          </div>
                          <div>
                            <Label>Departman:</Label>
                            <p className="font-medium">{selectedEmployee.department}</p>
                          </div>
                          <div>
                            <Label>Maaş:</Label>
                            <p className="font-medium text-green-600">{formatCurrency(selectedEmployee.salary)}</p>
                          </div>
                          <div>
                            <Label>İşe Giriş Tarihi:</Label>
                            <p className="font-medium">{formatDate(selectedEmployee.hire_date)}</p>
                          </div>
                          <div>
                            <Label>Çalışma Programı:</Label>
                            <p className="font-medium">{selectedEmployee.work_schedule || 'Belirtilmemiş'}</p>
                          </div>
                          <div>
                            <Label>Sözleşme Türü:</Label>
                            <p className="font-medium">{selectedEmployee.contract_type === 'full_time' ? 'Tam Zamanlı' : 'Yarı Zamanlı'}</p>
                          </div>
                        </div>
                        {selectedEmployee.notes && (
                          <div>
                            <Label>Notlar:</Label>
                            <p className="font-medium">{selectedEmployee.notes}</p>
                          </div>
                        )}
                      </TabsContent>
                      
                      <TabsContent value="documents" className="space-y-4">
                        {selectedEmployee.documents.length > 0 ? (
                          <div className="space-y-3">
                            {selectedEmployee.documents.map((doc, index) => (
                              <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                                <div className="flex items-center space-x-3">
                                  <FileText className="h-5 w-5 text-blue-600" />
                                  <div>
                                    <p className="font-medium">{documentTypeLabels[doc.type]}</p>
                                    <p className="text-sm text-gray-600">{doc.description || 'Açıklama yok'}</p>
                                    <p className="text-xs text-gray-500">
                                      Yükleme: {formatDate(doc.upload_date)}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex space-x-2">
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => {
                                      const url = employeesApi.getDocumentUrl(selectedEmployee.id, doc.filename);
                                      window.open(url, '_blank');
                                    }}
                                  >
                                    <Eye className="h-4 w-4 mr-1" />
                                    Görüntüle
                                  </Button>
                                  {user?.role === 'admin' && (
                                    <Button 
                                      size="sm" 
                                      variant="outline"
                                      className="text-red-600 hover:text-red-700"
                                      onClick={async () => {
                                        if (confirm('Bu belgeyi silmek istediğinizden emin misiniz?')) {
                                          try {
                                            await employeesApi.deleteEmployeeDocument(selectedEmployee.id, doc.filename);
                                            setAlert({ type: 'success', message: 'Belge başarıyla silindi' });
                                            // Çalışan detaylarını yenile
                                            const updatedEmployee = await employeesApi.getEmployee(selectedEmployee.id);
                                            setSelectedEmployee(updatedEmployee);
                                          } catch (error: any) {
                                            setAlert({ type: 'error', message: error.message || 'Belge silinirken hata oluştu' });
                                          }
                                        }
                                      }}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                            <p className="text-gray-500">Henüz belge yüklenmemiş</p>
                          </div>
                        )}
                      </TabsContent>
                    </Tabs>
                  </div>
                )}
              </DialogContent>
            </Dialog>

            {/* Belge Yükleme Dialog */}
            <Dialog open={isDocumentDialogOpen} onOpenChange={setIsDocumentDialogOpen}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Belge Yükle</DialogTitle>
                  <DialogDescription>
                    {selectedEmployee && `${selectedEmployee.first_name} ${selectedEmployee.last_name} için belge yükleyin`}
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                  {/* Mevcut belgeler */}
                  {selectedEmployee && selectedEmployee.documents.length > 0 && (
                    <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm font-medium mb-2">Mevcut Belgeler ({selectedEmployee.documents.length}):</p>
                      <div className="space-y-1">
                        {selectedEmployee.documents.map((doc, idx) => (
                          <div key={idx} className="text-xs text-gray-600">
                            • {documentTypeLabels[doc.type]} {doc.description && `- ${doc.description}`}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div>
                    <Label htmlFor="document_type">Belge Türü *</Label>
                    <Select value={documentType} onValueChange={(value) => setDocumentType(value as DocumentType)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(documentTypeLabels).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="document_description">Açıklama</Label>
                    <Input
                      id="document_description"
                      value={documentDescription}
                      onChange={(e) => setDocumentDescription(e.target.value)}
                      placeholder="Belge hakkında açıklama..."
                    />
                  </div>

                  <div>
                    <Label htmlFor="document_file">Dosya *</Label>
                    <Input
                      id="document_file"
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      JPG, PNG veya PDF formatında dosya yükleyebilirsiniz (max 10MB)
                    </p>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsDocumentDialogOpen(false)}>
                      İptal
                    </Button>
                    <Button onClick={handleDocumentUpload} disabled={!selectedFile || uploading}>
                      {uploading ? 'Yükleniyor...' : 'Belgeyi Yükle'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Delete Confirmation Modal */}
            <DeleteConfirmationModal
              isOpen={isDeleteDialogOpen}
              onClose={closeDeleteDialog}
              onConfirm={handleDeleteEmployee}
              title="Çalışanı Sil"
              description="Bu çalışanı silmek istediğinizden emin misiniz? Bu işlem geri alınamaz ve çalışanın tüm bilgileri silinecektir."
              itemName={employeeToDelete ? `${employeeToDelete.first_name} ${employeeToDelete.last_name}` : undefined}
              loading={deleteLoading}
            />
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}