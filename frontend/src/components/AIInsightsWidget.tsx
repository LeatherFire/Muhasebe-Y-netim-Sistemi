'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading';
import { 
  Brain, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Lightbulb, 
  DollarSign,
  Calendar,
  Target,
  Users,
  Zap
} from 'lucide-react';
import { 
  aiApi, 
  ExpenseInsights, 
  AnomalyDetection, 
  ExpensePrediction,
  SupplierAnalysis 
} from '@/lib/api/ai';

interface AIInsightsWidgetProps {
  title?: string;
  config?: Record<string, any>;
  className?: string;
}

export default function AIInsightsWidget({ title = "AI Öngörüleri", config = {}, className = '' }: AIInsightsWidgetProps) {
  const [insights, setInsights] = useState<ExpenseInsights | null>(null);
  const [anomalies, setAnomalies] = useState<AnomalyDetection | null>(null);
  const [predictions, setPredictions] = useState<ExpensePrediction | null>(null);
  const [suppliers, setSuppliers] = useState<SupplierAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'insights' | 'anomalies' | 'predictions' | 'suppliers'>('insights');
  const [timePeriod, setTimePeriod] = useState<'weekly' | 'monthly' | 'quarterly'>('monthly');

  useEffect(() => {
    loadAIData();
  }, [timePeriod]);

  const loadAIData = async () => {
    try {
      setLoading(true);
      
      // AI çağrılarını tek tek yap ve hataları handle et
      const results = await Promise.allSettled([
        aiApi.getExpenseInsights(timePeriod),
        aiApi.detectAnomalies(),
        aiApi.getExpensePredictions(),
        aiApi.getSupplierAnalysis()
      ]);

      // Her sonucu ayrı ayrı kontrol et
      if (results[0].status === 'fulfilled') {
        setInsights(results[0].value);
      } else {
        console.error('Insights yüklenirken hata:', results[0].reason);
        setInsights(null);
      }

      if (results[1].status === 'fulfilled') {
        setAnomalies(results[1].value);
      } else {
        console.error('Anomaliler yüklenirken hata:', results[1].reason);
        setAnomalies(null);
      }

      if (results[2].status === 'fulfilled') {
        setPredictions(results[2].value);
      } else {
        console.error('Tahminler yüklenirken hata:', results[2].reason);
        setPredictions(null);
      }

      if (results[3].status === 'fulfilled') {
        setSuppliers(results[3].value);
      } else {
        console.error('Tedarikçi analizi yüklenirken hata:', results[3].reason);
        setSuppliers(null);
      }
    } catch (error) {
      console.error('AI verileri yüklenirken genel hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'increasing':
        return <TrendingUp className="h-4 w-4 text-red-500" />;
      case 'decreasing':
        return <TrendingDown className="h-4 w-4 text-green-500" />;
      default:
        return <div className="h-4 w-4 bg-gray-400 rounded-full" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY'
    }).format(amount);
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Brain className="h-5 w-5" />
            <span>{title}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <LoadingSpinner />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <Brain className="h-5 w-5" />
            <span>{title}</span>
          </CardTitle>
          <div className="flex items-center space-x-2">
            <select
              value={timePeriod}
              onChange={(e) => setTimePeriod(e.target.value as any)}
              className="text-sm border border-gray-200 rounded-md px-2 py-1"
            >
              <option value="weekly">Haftalık</option>
              <option value="monthly">Aylık</option>
              <option value="quarterly">Çeyreklik</option>
            </select>
            <Button
              variant="ghost"
              size="sm"
              onClick={loadAIData}
              className="text-blue-600 hover:text-blue-700"
            >
              <Zap className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('insights')}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'insights' 
                ? 'bg-white text-gray-900 shadow-sm' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Lightbulb className="h-4 w-4 inline mr-1" />
            Öngörüler
          </button>
          <button
            onClick={() => setActiveTab('anomalies')}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'anomalies' 
                ? 'bg-white text-gray-900 shadow-sm' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <AlertTriangle className="h-4 w-4 inline mr-1" />
            Anomaliler
            {anomalies && anomalies.anomalies.length > 0 && (
              <Badge className="ml-1 bg-red-500 text-white text-xs">
                {anomalies.anomalies.length}
              </Badge>
            )}
          </button>
          <button
            onClick={() => setActiveTab('predictions')}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'predictions' 
                ? 'bg-white text-gray-900 shadow-sm' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Target className="h-4 w-4 inline mr-1" />
            Tahminler
          </button>
          <button
            onClick={() => setActiveTab('suppliers')}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'suppliers' 
                ? 'bg-white text-gray-900 shadow-sm' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Users className="h-4 w-4 inline mr-1" />
            Tedarikçi
          </button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Insights Tab */}
        {activeTab === 'insights' && (
          insights ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="text-sm text-blue-600 font-medium">Toplam Harcama</div>
                <div className="text-lg font-bold text-blue-900">
                  {formatCurrency(insights.total_spent)}
                </div>
              </div>
              <div className="bg-green-50 p-3 rounded-lg">
                <div className="text-sm text-green-600 font-medium">Tasarruf Fırsatı</div>
                <div className="text-lg font-bold text-green-900">
                  {formatCurrency(insights.savings_opportunities?.reduce((sum, opp) => sum + opp.potential_saving, 0) || 0)}
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-2">Harcama Trendleri</h4>
              <div className="space-y-2">
                {insights.insights?.slice(0, 3).map((insight, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-2">
                      {getTrendIcon(insight.trend)}
                      <div>
                        <div className="text-sm font-medium">{insight.category}</div>
                        <div className="text-xs text-gray-500">{insight.insight}</div>
                      </div>
                    </div>
                    <div className="text-sm font-medium text-gray-900">
                      {insight.percentage > 0 ? '+' : ''}{insight.percentage.toFixed(1)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {insights.savings_opportunities && insights.savings_opportunities.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">Tasarruf Önerileri</h4>
                <div className="space-y-2">
                  {insights.savings_opportunities.slice(0, 2).map((opportunity, index) => (
                    <div key={index} className="p-2 bg-green-50 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <div className="text-sm font-medium text-green-800">{opportunity.category}</div>
                        <div className="text-sm font-bold text-green-700">
                          {formatCurrency(opportunity.potential_saving)}
                        </div>
                      </div>
                      <div className="text-xs text-green-600">{opportunity.suggestion}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          ) : (
            <div className="text-center py-8">
              <Brain className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">AI Öngörüler Yükleniyor</h3>
              <p className="text-gray-500">
                Harcama verileriniz analiz ediliyor. Daha fazla veri biriktiğinde daha detaylı öngörüler görebileceksiniz.
              </p>
            </div>
          )
        )}

        {/* Anomalies Tab */}
        {activeTab === 'anomalies' && (
          anomalies ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">Risk Skoru</div>
                <div className="text-2xl font-bold text-gray-900">
                  {(anomalies.risk_score * 100).toFixed(0)}%
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-600">Tespit Edilen</div>
                <div className="text-2xl font-bold text-red-600">
                  {anomalies.anomalies.length}
                </div>
              </div>
            </div>

            <div className="text-sm text-gray-600 p-2 bg-gray-50 rounded-lg">
              {anomalies.summary}
            </div>

            {anomalies.anomalies && anomalies.anomalies.length > 0 && (
              <div className="space-y-2">
                {anomalies.anomalies.slice(0, 3).map((anomaly, index) => (
                  <div key={index} className="p-3 border border-gray-200 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <Badge className={getSeverityColor(anomaly.severity)}>
                        {anomaly.severity === 'high' ? 'Yüksek' : 
                         anomaly.severity === 'medium' ? 'Orta' : 'Düşük'}
                      </Badge>
                      <div className="text-xs text-gray-500">
                        {anomaly.type === 'high_amount' ? 'Yüksek Tutar' :
                         anomaly.type === 'unusual_category' ? 'Alışılmadık Kategori' :
                         anomaly.type === 'frequency' ? 'Sıklık' : 'Zamanlama'}
                      </div>
                    </div>
                    <div className="text-sm text-gray-900 mb-1">{anomaly.description}</div>
                    <div className="text-xs text-blue-600">{anomaly.recommendation}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          ) : (
            <div className="text-center py-8">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Anomali Tespiti</h3>
              <p className="text-gray-500">
                Anormal harcama patternleri aranıyor. Yeterli veri biriktiğinde anomaliler tespit edilecek.
              </p>
            </div>
          )
        )}

        {/* Predictions Tab */}}
        {activeTab === 'predictions' && (
          predictions ? (
          <div className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-blue-600 font-medium">Gelecek Ay Tahmini</div>
                <Badge className="bg-blue-100 text-blue-800">
                  %{(predictions.confidence * 100).toFixed(0)} güvenilir
                </Badge>
              </div>
              <div className="text-2xl font-bold text-blue-900 mb-1">
                {formatCurrency(predictions.total_prediction)}
              </div>
              <div className="flex items-center space-x-2 text-sm">
                {getTrendIcon(predictions.trend)}
                <span className="text-blue-700">
                  {predictions.trend === 'increasing' ? 'Artış' : 
                   predictions.trend === 'decreasing' ? 'Azalış' : 'Sabit'} 
                  ({(predictions.trend_percentage || 0) > 0 ? '+' : ''}{(predictions.trend_percentage || 0).toFixed(1)}%)
                </span>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-2">Kategori Tahminleri</h4>
              <div className="space-y-2">
                {Object.entries(predictions.category_predictions || {}).slice(0, 4).map(([category, amount]) => (
                  <div key={category} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                    <div className="text-sm font-medium">{category}</div>
                    <div className="text-sm text-gray-900">{formatCurrency(amount)}</div>
                  </div>
                ))}
              </div>
            </div>

            {predictions.seasonality_factors && predictions.seasonality_factors.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">Mevsimsel Faktörler</h4>
                <div className="space-y-1">
                  {predictions.seasonality_factors.map((factor, index) => (
                    <div key={index} className="text-xs text-gray-600 p-2 bg-yellow-50 rounded">
                      <Calendar className="h-3 w-3 inline mr-1" />
                      {factor}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          ) : (
            <div className="text-center py-8">
              <Target className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Harcama Tahminleri</h3>
              <p className="text-gray-500">
                Geçmiş harcama verileriniz analiz edilerek gelecek tahminleri hazırlanıyor.
              </p>
            </div>
          )
        )}

        {/* Suppliers Tab */}
        {activeTab === 'suppliers' && (
          suppliers ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-gray-50 p-2 rounded-lg">
                <div className="text-xs text-gray-500">En Sık Kullanılan</div>
                <div className="text-sm font-medium">{suppliers.payment_patterns.most_common_day}</div>
              </div>
              <div className="bg-gray-50 p-2 rounded-lg">
                <div className="text-xs text-gray-500">Ödeme Döngüsü</div>
                <div className="text-sm font-medium">{suppliers.payment_patterns.average_payment_cycle} gün</div>
              </div>
              <div className="bg-gray-50 p-2 rounded-lg">
                <div className="text-xs text-gray-500">Gecikme Riski</div>
                <div className={`text-sm font-medium ${
                  suppliers.payment_patterns.late_payment_risk === 'high' ? 'text-red-600' :
                  suppliers.payment_patterns.late_payment_risk === 'medium' ? 'text-yellow-600' : 'text-green-600'
                }`}>
                  {suppliers.payment_patterns.late_payment_risk === 'high' ? 'Yüksek' :
                   suppliers.payment_patterns.late_payment_risk === 'medium' ? 'Orta' : 'Düşük'}
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-2">Top Tedarikçiler</h4>
              <div className="space-y-2">
                {suppliers.top_suppliers?.slice(0, 3).map((supplier, index) => (
                  <div key={index} className="p-2 border border-gray-200 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-sm font-medium">{supplier.name}</div>
                      <Badge className="bg-green-100 text-green-800">
                        %{(supplier.reliability_score * 100).toFixed(0)}
                      </Badge>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>{supplier.transaction_count} işlem</span>
                      <span>{formatCurrency(supplier.total_amount)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {suppliers.recommendations && suppliers.recommendations.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">Öneriler</h4>
                <div className="space-y-2">
                  {suppliers.recommendations.slice(0, 2).map((rec, index) => (
                    <div key={index} className="p-2 bg-blue-50 rounded-lg">
                      <div className="text-sm text-blue-900 mb-1">{rec.suggestion}</div>
                      <div className="text-xs text-blue-600">
                        Potansiyel tasarruf: {formatCurrency(rec.potential_saving)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          ) : (
            <div className="text-center py-8">
              <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Tedarikçi Analizi</h3>
              <p className="text-gray-500">
                Tedarikçi işlemleriniz analiz ediliyor. Düzenli ödemeler yapıldığında analizler hazır olacak.
              </p>
            </div>
          )
        )}
      </CardContent>
    </Card>
  );
}