'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading';
import { Brain, Check, X, Lightbulb, Zap } from 'lucide-react';
import { aiApi, SmartCategorizationResult } from '@/lib/api/ai';

interface SmartCategorizationProps {
  transaction: {
    description: string;
    recipient_name: string;
    amount: number;
  };
  onCategorySelect: (category: string) => void;
  onSkip: () => void;
  className?: string;
}

export default function SmartCategorization({ 
  transaction, 
  onCategorySelect, 
  onSkip, 
  className = '' 
}: SmartCategorizationProps) {
  const [result, setResult] = useState<SmartCategorizationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (transaction.description && transaction.recipient_name && transaction.amount) {
      loadSmartCategorization();
    }
  }, [transaction]);

  const loadSmartCategorization = async () => {
    try {
      setLoading(true);
      const data = await aiApi.smartCategorization(transaction);
      setResult(data);
    } catch (error) {
      console.error('Akıllı kategorizasyon hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = () => {
    if (result) {
      onCategorySelect(result.category);
      setIsVisible(false);
    }
  };

  const handleReject = () => {
    onSkip();
    setIsVisible(false);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'bg-green-100 text-green-800';
    if (confidence >= 0.6) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.8) return 'Yüksek Güven';
    if (confidence >= 0.6) return 'Orta Güven';
    return 'Düşük Güven';
  };

  if (!isVisible) return null;

  return (
    <Card className={`border-l-4 border-l-blue-500 ${className}`}>
      <CardContent className="p-4">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <Brain className="h-4 w-4 text-blue-600" />
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-900 flex items-center space-x-2">
                <Zap className="h-4 w-4 text-blue-500" />
                <span>AI Kategori Önerisi</span>
              </h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReject}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {loading ? (
              <div className="flex items-center space-x-2">
                <LoadingSpinner size="sm" />
                <span className="text-sm text-gray-500">AI analiz ediyor...</span>
              </div>
            ) : result ? (
              <div className="space-y-3">
                {/* Önerilen Kategori */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      Önerilen Kategori: <span className="text-blue-600">{result.category}</span>
                    </div>
                    <Badge className={getConfidenceColor(result.confidence)}>
                      {getConfidenceLabel(result.confidence)} (%{(result.confidence * 100).toFixed(0)})
                    </Badge>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleReject}
                      className="text-gray-600 hover:text-gray-800"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Reddet
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleAccept}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Kabul Et
                    </Button>
                  </div>
                </div>

                {/* AI Açıklaması */}
                {result.reasoning && (
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <div className="flex items-start space-x-2">
                      <Lightbulb className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="text-sm font-medium text-blue-900 mb-1">AI Analizi</div>
                        <div className="text-sm text-blue-800">{result.reasoning}</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Benzer İşlemler */}
                {result.similar_transactions && result.similar_transactions.length > 0 && (
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="text-sm font-medium text-gray-900 mb-2">
                      Benzer İşlemler
                    </div>
                    <div className="space-y-1">
                      {result.similar_transactions.slice(0, 3).map((similar, index) => (
                        <div key={index} className="text-xs text-gray-600 bg-white p-2 rounded border">
                          "{similar}"
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Güven Skoru Açıklaması */}
                <div className="text-xs text-gray-500">
                  {result.confidence >= 0.8 && (
                    <div className="flex items-center space-x-1 text-green-600">
                      <Check className="h-3 w-3" />
                      <span>Geçmiş verilerinize dayanarak yüksek güvenle öneriliyor</span>
                    </div>
                  )}
                  {result.confidence >= 0.6 && result.confidence < 0.8 && (
                    <div className="flex items-center space-x-1 text-yellow-600">
                      <Lightbulb className="h-3 w-3" />
                      <span>Benzer işlemler bulundu, kontrol etmenizi öneririz</span>
                    </div>
                  )}
                  {result.confidence < 0.6 && (
                    <div className="flex items-center space-x-1 text-red-600">
                      <X className="h-3 w-3" />
                      <span>Belirsiz durum, manuel kontrol önerilir</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-500">
                AI önerisi alınamadı. Manuel olarak kategori seçebilirsiniz.
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}