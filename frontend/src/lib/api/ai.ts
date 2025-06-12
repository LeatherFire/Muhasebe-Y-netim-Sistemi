import { api } from '@/lib/auth';

export interface SmartCategorizationResult {
  category: string;
  confidence: number;
  reasoning: string;
  similar_transactions: string[];
}

export interface ExpensePrediction {
  total_prediction: number;
  category_predictions: Record<string, number>;
  confidence: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  trend_percentage: number;
  seasonality_factors: string[];
}

export interface AnomalyDetection {
  anomalies: Array<{
    transaction_id: string;
    type: 'high_amount' | 'unusual_category' | 'frequency' | 'timing';
    description: string;
    severity: 'low' | 'medium' | 'high';
    recommendation: string;
  }>;
  risk_score: number;
  summary: string;
}

export interface ExpenseInsight {
  category: string;
  trend: 'increasing' | 'decreasing' | 'stable';
  percentage: number;
  insight: string;
  recommendation: string;
}

export interface ExpenseInsights {
  insights: ExpenseInsight[];
  total_spent: number;
  savings_opportunities: Array<{
    category: string;
    potential_saving: number;
    suggestion: string;
  }>;
  budget_recommendations: {
    next_month_budget: number;
    category_limits: Record<string, number>;
  };
}

export interface SupplierAnalysis {
  top_suppliers: Array<{
    name: string;
    total_amount: number;
    transaction_count: number;
    average_amount: number;
    category: string;
    reliability_score: number;
  }>;
  recommendations: Array<{
    type: 'cost_optimization' | 'diversification' | 'payment_terms';
    suggestion: string;
    potential_saving: number;
  }>;
  payment_patterns: {
    most_common_day: string;
    average_payment_cycle: number;
    late_payment_risk: 'low' | 'medium' | 'high';
  };
}

export const aiApi = {
  // Smart expense categorization
  async smartCategorization(newTransaction: {
    description: string;
    recipient_name: string;
    amount: number;
  }): Promise<SmartCategorizationResult> {
    const response = await api.post('/ai/smart-categorization', newTransaction);
    return response.data;
  },

  // Get expense predictions
  async getExpensePredictions(): Promise<ExpensePrediction> {
    const response = await api.get('/ai/expense-predictions');
    return response.data;
  },

  // Detect anomalies
  async detectAnomalies(): Promise<AnomalyDetection> {
    const response = await api.get('/ai/anomaly-detection');
    return response.data;
  },

  // Get expense insights
  async getExpenseInsights(timePeriod: 'weekly' | 'monthly' | 'quarterly' = 'monthly'): Promise<ExpenseInsights> {
    const response = await api.get(`/ai/expense-insights?time_period=${timePeriod}`);
    return response.data;
  },

  // Get supplier analysis
  async getSupplierAnalysis(): Promise<SupplierAnalysis> {
    const response = await api.get('/ai/supplier-analysis');
    return response.data;
  },

  // Process payment description
  async processPaymentDescription(data: {
    description: string;
    recipient_name: string;
    amount: number;
  }): Promise<{
    processed_description: string;
    suggested_category: string;
    confidence: number;
  }> {
    const formData = new FormData();
    formData.append('description', data.description);
    formData.append('recipient_name', data.recipient_name);
    formData.append('amount', data.amount.toString());

    const response = await api.post('/ai/process-description', formData);
    return response.data;
  },

  // Categorize expense
  async categorizeExpense(data: {
    description: string;
    recipient: string;
    amount: number;
  }): Promise<{ category: string }> {
    const formData = new FormData();
    formData.append('description', data.description);
    formData.append('recipient', data.recipient);
    formData.append('amount', data.amount.toString());

    const response = await api.post('/ai/categorize', formData);
    return response.data;
  }
};