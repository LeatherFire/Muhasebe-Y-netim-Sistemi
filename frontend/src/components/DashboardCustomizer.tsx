'use client';

import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading';
import { 
  Settings, 
  Plus, 
  Trash2, 
  Eye, 
  EyeOff, 
  Move, 
  Save, 
  RotateCcw,
  Layout,
  Grid3X3,
  Palette
} from 'lucide-react';
import { 
  dashboardApi, 
  DashboardLayout, 
  DashboardWidget, 
  AvailableWidget,
  WidgetSize,
  widgetSizeConfig 
} from '@/lib/api/dashboard';

interface DashboardCustomizerProps {
  layout: DashboardLayout;
  onLayoutChange: (layout: DashboardLayout) => void;
  onClose: () => void;
}

export default function DashboardCustomizer({ layout, onLayoutChange, onClose }: DashboardCustomizerProps) {
  const [currentLayout, setCurrentLayout] = useState<DashboardLayout>(layout);
  const [availableWidgets, setAvailableWidgets] = useState<AvailableWidget[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showWidgetLibrary, setShowWidgetLibrary] = useState(false);
  const [selectedWidget, setSelectedWidget] = useState<DashboardWidget | null>(null);

  useEffect(() => {
    loadAvailableWidgets();
  }, []);

  const loadAvailableWidgets = async () => {
    try {
      setLoading(true);
      const widgets = await dashboardApi.getAvailableWidgets();
      setAvailableWidgets(widgets);
    } catch (error) {
      console.error('Widget türleri yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const updatedLayout = await dashboardApi.updateLayout(currentLayout.id, {
        widgets: currentLayout.widgets
      });
      onLayoutChange(updatedLayout);
      onClose();
    } catch (error) {
      console.error('Layout kaydedilirken hata:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleAddWidget = async (widgetType: AvailableWidget) => {
    try {
      const position = dashboardApi.findEmptyPosition(
        currentLayout.widgets,
        widgetType.default_size as WidgetSize,
        currentLayout.grid_columns
      );

      const newWidget = await dashboardApi.addWidget(currentLayout.id, {
        type: widgetType.type,
        title: widgetType.name,
        size: widgetType.default_size as WidgetSize,
        position,
        config: {}
      });

      setCurrentLayout(prev => ({
        ...prev,
        widgets: [...prev.widgets, newWidget]
      }));

      setShowWidgetLibrary(false);
    } catch (error) {
      console.error('Widget eklenirken hata:', error);
    }
  };

  const handleRemoveWidget = async (widgetId: string) => {
    try {
      await dashboardApi.removeWidget(currentLayout.id, widgetId);
      setCurrentLayout(prev => ({
        ...prev,
        widgets: prev.widgets.filter(w => w.id !== widgetId)
      }));
    } catch (error) {
      console.error('Widget kaldırılırken hata:', error);
    }
  };

  const handleToggleWidgetVisibility = async (widgetId: string) => {
    try {
      const widget = currentLayout.widgets.find(w => w.id === widgetId);
      if (!widget) return;

      const updatedWidget = await dashboardApi.updateWidget(currentLayout.id, widgetId, {
        is_visible: !widget.is_visible
      });

      setCurrentLayout(prev => ({
        ...prev,
        widgets: prev.widgets.map(w => w.id === widgetId ? updatedWidget : w)
      }));
    } catch (error) {
      console.error('Widget görünürlüğü değiştirilirken hata:', error);
    }
  };

  const handleWidgetSizeChange = async (widgetId: string, newSize: WidgetSize) => {
    try {
      const updatedWidget = await dashboardApi.updateWidget(currentLayout.id, widgetId, {
        size: newSize
      });

      setCurrentLayout(prev => ({
        ...prev,
        widgets: prev.widgets.map(w => w.id === widgetId ? updatedWidget : w)
      }));
    } catch (error) {
      console.error('Widget boyutu değiştirilirken hata:', error);
    }
  };

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const { source, destination } = result;
    
    // Simulate grid position calculation based on drop position
    const newY = Math.floor(destination.index / currentLayout.grid_columns);
    const newX = destination.index % currentLayout.grid_columns;

    const widget = currentLayout.widgets.find(w => w.id === result.draggableId);
    if (!widget) return;

    try {
      const updatedWidget = await dashboardApi.updateWidget(currentLayout.id, widget.id, {
        position: { x: newX, y: newY }
      });

      setCurrentLayout(prev => ({
        ...prev,
        widgets: prev.widgets.map(w => w.id === widget.id ? updatedWidget : w)
      }));
    } catch (error) {
      console.error('Widget pozisyonu güncellenirken hata:', error);
    }
  };

  const getWidgetsByCategory = () => {
    const categories: Record<string, AvailableWidget[]> = {};
    availableWidgets.forEach(widget => {
      if (!categories[widget.category]) {
        categories[widget.category] = [];
      }
      categories[widget.category].push(widget);
    });
    return categories;
  };

  const getSizeDisplayName = (size: WidgetSize): string => {
    const names = {
      small: 'Küçük (1x1)',
      medium: 'Orta (2x1)',
      large: 'Büyük (2x2)',
      wide: 'Geniş (3x1)',
      extra_large: 'Çok Büyük (3x2)'
    };
    return names[size] || size;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl h-full max-h-[90vh] overflow-hidden">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <Layout className="h-6 w-6 text-blue-600" />
              <div>
                <h2 className="text-xl font-bold text-gray-900">Dashboard Özelleştir</h2>
                <p className="text-sm text-gray-500">{currentLayout.name}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Button
                variant="outline"
                onClick={() => setShowWidgetLibrary(!showWidgetLibrary)}
                className="flex items-center space-x-2"
              >
                <Plus className="h-4 w-4" />
                <span>Widget Ekle</span>
              </Button>
              <Button
                variant="outline"
                onClick={onClose}
              >
                İptal
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {saving ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-2" />
                    Kaydediliyor...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Kaydet
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="flex-1 flex overflow-hidden">
            {/* Widget Library Sidebar */}
            {showWidgetLibrary && (
              <div className="w-80 border-r border-gray-200 overflow-y-auto p-4">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Widget Kütüphanesi</h3>
                  <p className="text-sm text-gray-500">Eklemek istediğiniz widget'ı seçin</p>
                </div>

                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <LoadingSpinner />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(getWidgetsByCategory()).map(([category, widgets]) => (
                      <div key={category}>
                        <h4 className="text-sm font-medium text-gray-700 mb-2">{category}</h4>
                        <div className="space-y-2">
                          {widgets.map((widget) => (
                            <Card
                              key={widget.type}
                              className="cursor-pointer hover:bg-blue-50 border-blue-200 transition-colors"
                              onClick={() => handleAddWidget(widget)}
                            >
                              <CardContent className="p-3">
                                <div className="flex items-center space-x-3">
                                  <div className="text-2xl">
                                    {dashboardApi.getWidgetIcon(widget.type)}
                                  </div>
                                  <div className="flex-1">
                                    <div className="text-sm font-medium text-gray-900">
                                      {widget.name}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      {widget.description}
                                    </div>
                                    <Badge className="mt-1 text-xs">
                                      {getSizeDisplayName(widget.default_size as WidgetSize)}
                                    </Badge>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Main Content Area */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Mevcut Widget'lar</h3>
                <p className="text-sm text-gray-500">Widget'ları sürükleyerek yeniden düzenleyebilirsiniz</p>
              </div>

              {/* Widgets Grid */}
              <DragDropContext onDragEnd={onDragEnd}>
                <Droppable droppableId="dashboard-grid">
                  {(provided) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className="grid grid-cols-12 gap-4 min-h-96"
                    >
                      {currentLayout.widgets.map((widget, index) => (
                        <Draggable
                          key={widget.id}
                          draggableId={widget.id}
                          index={index}
                        >
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={`
                                ${getWidgetColSpan(widget.size)} 
                                ${getWidgetRowSpan(widget.size)}
                                ${snapshot.isDragging ? 'z-50' : ''}
                                ${!widget.is_visible ? 'opacity-50' : ''}
                              `}
                              style={{
                                gridColumn: `span ${widgetSizeConfig[widget.size].width}`,
                                gridRow: `span ${widgetSizeConfig[widget.size].height}`,
                                ...provided.draggableProps.style,
                              }}
                            >
                              <Card className={`h-full ${snapshot.isDragging ? 'shadow-lg' : ''} relative group`}>
                                <CardHeader className="pb-2 relative">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-2">
                                      <div
                                        {...provided.dragHandleProps}
                                        className="cursor-move opacity-0 group-hover:opacity-100 transition-opacity"
                                      >
                                        <Move className="h-4 w-4 text-gray-400" />
                                      </div>
                                      <span className="text-lg">
                                        {dashboardApi.getWidgetIcon(widget.type)}
                                      </span>
                                      <CardTitle className="text-sm">{widget.title}</CardTitle>
                                    </div>
                                    
                                    <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleToggleWidgetVisibility(widget.id)}
                                        className="p-1"
                                      >
                                        {widget.is_visible ? (
                                          <Eye className="h-3 w-3" />
                                        ) : (
                                          <EyeOff className="h-3 w-3" />
                                        )}
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setSelectedWidget(widget)}
                                        className="p-1"
                                      >
                                        <Settings className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleRemoveWidget(widget.id)}
                                        className="p-1 text-red-600 hover:text-red-700"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>
                                </CardHeader>
                                <CardContent className="pt-0">
                                  <div className="text-center text-gray-500 py-8">
                                    <Grid3X3 className="h-8 w-8 mx-auto mb-2" />
                                    <div className="text-sm">Widget Önizlemesi</div>
                                    <Badge className="mt-2 text-xs">
                                      {getSizeDisplayName(widget.size)}
                                    </Badge>
                                  </div>
                                </CardContent>
                              </Card>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>

              {currentLayout.widgets.length === 0 && (
                <div className="text-center py-12">
                  <Layout className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Henüz widget yok</h3>
                  <p className="text-gray-500 mb-4">Dashboard'ınızı özelleştirmek için widget ekleyin</p>
                  <Button onClick={() => setShowWidgetLibrary(true)} className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="h-4 w-4 mr-2" />
                    Widget Ekle
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Widget Settings Modal */}
      {selectedWidget && (
        <WidgetSettingsModal
          widget={selectedWidget}
          availableWidgets={availableWidgets}
          layoutId={currentLayout.id}
          onUpdate={(updatedWidget) => {
            setCurrentLayout(prev => ({
              ...prev,
              widgets: prev.widgets.map(w => w.id === updatedWidget.id ? updatedWidget : w)
            }));
            setSelectedWidget(null);
          }}
          onClose={() => setSelectedWidget(null)}
        />
      )}
    </div>
  );
}

// Widget Settings Modal Component
interface WidgetSettingsModalProps {
  widget: DashboardWidget;
  availableWidgets: AvailableWidget[];
  layoutId: string;
  onUpdate: (widget: DashboardWidget) => void;
  onClose: () => void;
}

function WidgetSettingsModal({ widget, availableWidgets, layoutId, onUpdate, onClose }: WidgetSettingsModalProps) {
  const [title, setTitle] = useState(widget.title);
  const [size, setSize] = useState(widget.size);
  const [loading, setLoading] = useState(false);

  const availableWidget = availableWidgets.find(w => w.type === widget.type);

  const handleSave = async () => {
    try {
      setLoading(true);
      const updatedWidget = await dashboardApi.updateWidget(layoutId, widget.id, {
        title,
        size
      });
      onUpdate(updatedWidget);
    } catch (error) {
      console.error('Widget ayarları güncellenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSizeDisplayName = (size: WidgetSize): string => {
    const names = {
      small: 'Küçük (1x1)',
      medium: 'Orta (2x1)',
      large: 'Büyük (2x2)',
      wide: 'Geniş (3x1)',
      extra_large: 'Çok Büyük (3x2)'
    };
    return names[size] || size;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Widget Ayarları</h3>
            <Button variant="ghost" size="sm" onClick={onClose}>
              ✕
            </Button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Widget Adı
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Boyut
              </label>
              <select
                value={size}
                onChange={(e) => setSize(e.target.value as WidgetSize)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {availableWidget?.available_sizes.map((sizeOption) => (
                  <option key={sizeOption} value={sizeOption}>
                    {getSizeDisplayName(sizeOption as WidgetSize)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <Button variant="outline" onClick={onClose}>
              İptal
            </Button>
            <Button onClick={handleSave} disabled={loading} className="bg-blue-600 hover:bg-blue-700">
              {loading ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  Kaydediliyor...
                </>
              ) : (
                'Kaydet'
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper functions for grid layout
function getWidgetColSpan(size: WidgetSize): string {
  const spans = {
    small: 'col-span-3',
    medium: 'col-span-6',
    large: 'col-span-6',
    wide: 'col-span-9',
    extra_large: 'col-span-9'
  };
  return spans[size] || 'col-span-6';
}

function getWidgetRowSpan(size: WidgetSize): string {
  const spans = {
    small: 'row-span-1',
    medium: 'row-span-1',
    large: 'row-span-2',
    wide: 'row-span-1',
    extra_large: 'row-span-2'
  };
  return spans[size] || 'row-span-1';
}