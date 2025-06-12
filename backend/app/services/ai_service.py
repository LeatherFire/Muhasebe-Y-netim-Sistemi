import google.generativeai as genai
from typing import Optional, Dict, Any, List
import json
import logging
import re
import os
from datetime import datetime, timedelta
from app.core.config import settings
from app.models.payment_order import PaymentCategory

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class GeminiAIService:
    def __init__(self):
        if settings.gemini_api_key:
            genai.configure(api_key=settings.gemini_api_key)
            try:
                self.model = genai.GenerativeModel('gemini-1.5-flash')
                self.vision_model = genai.GenerativeModel('gemini-1.5-flash')
                logger.info("Gemini AI service initialized successfully")
            except Exception as e:
                logger.error(f"Failed to initialize Gemini models: {e}")
                self.model = None
                self.vision_model = None
        else:
            logger.warning("Gemini API key not found. AI services will be disabled.")
            self.model = None
            self.vision_model = None

    async def process_payment_description(self, description: str, recipient_name: str, amount: float) -> Dict[str, Any]:
        """
        Ödeme açıklamasını AI ile işleyip düzenler ve kategori önerir
        """
        if not self.model:
            return {
                "processed_description": description,
                "suggested_category": PaymentCategory.OTHER,
                "confidence": 0.0
            }

        try:
            prompt = f"""
            Aşağıdaki ödeme bilgilerini analiz et ve Türkçe olarak düzenle:

            Alıcı: {recipient_name}
            Tutar: {amount} TL
            Açıklama: {description}

            Görevlerin:
            1. Açıklamayı daha anlaşılır ve profesyonel hale getir
            2. En uygun kategoriyi belirle: office_supplies, utilities, salary, rent, insurance, tax, loan, supplier, service, other
            3. Güven skorunu 0-1 arasında belirle

            Sadece JSON formatında cevap ver:
            {{
                "processed_description": "düzenlenmiş açıklama",
                "suggested_category": "kategori",
                "confidence": 0.95
            }}
            """

            response = self.model.generate_content(prompt)
            response_text = response.text.strip()
            
            # Clean up response text for JSON parsing
            if '```json' in response_text:
                response_text = response_text.split('```json')[1].split('```')[0].strip()
            elif '```' in response_text:
                response_text = response_text.split('```')[1].strip()
            
            result = json.loads(response_text)
            
            # Kategori doğrulaması
            valid_categories = [cat.value for cat in PaymentCategory]
            if result.get("suggested_category") not in valid_categories:
                result["suggested_category"] = PaymentCategory.OTHER.value

            return result

        except Exception as e:
            logger.error(f"AI processing error: {e}")
            return {
                "processed_description": description,
                "suggested_category": PaymentCategory.OTHER.value,
                "confidence": 0.0
            }

    async def verify_payment_receipt(self, file_path: str, payment_order: dict) -> dict:
        """
        Ödeme emri ile dekont arasında doğrulama yapar
        """
        try:
            # Vision model kullanarak resim analizi
            if not self.vision_model:
                logger.error("Vision model not available for verification")
                return {
                    "success": False,
                    "error": "Vision model not available"
                }
            
            # Dosya varlığını kontrol et
            if not os.path.exists(file_path):
                logger.error(f"File not found: {file_path}")
                return {
                    "success": False,
                    "error": f"Dosya bulunamadı: {file_path}"
                }
            
            # Dosyayı yükle ve Gemini format'ına çevir
            import PIL.Image
            logger.info(f"Loading image from: {file_path}")
            
            # Dosya tipini kontrol et
            file_extension = file_path.lower().split('.')[-1]
            
            if file_extension == 'pdf':
                logger.error("PDF files temporarily not supported")
                return {
                    "success": False,
                    "error": "PDF dosyaları şu anda desteklenmiyor. Lütfen JPG/PNG formatında yükleyin."
                }
            else:
                # Resim dosyaları için PIL kullan
                try:
                    image = PIL.Image.open(file_path)
                    logger.info(f"Image loaded successfully: {image.size}")
                except Exception as img_error:
                    logger.error(f"Image loading error: {img_error}")
                    return {
                        "success": False,
                        "error": f"Resim yükleme hatası: {str(img_error)}"
                    }
            
            prompt = f"""
Bu dekont/transfer belgesini analiz et ve ödeme emri bilgileri ile MUTLAKA karşılaştır.

ÖNEMLİ: Banka transfer ücretleri (5-50 TRY arası) NORMAL ve KABUL EDİLEBİLİR.

ÖDEME EMRİ BİLGİLERİ:
- Alıcı Adı: {payment_order.get('recipient_name', 'Belirtilmemiş')}
- Alıcı IBAN: {payment_order.get('recipient_iban', 'Belirtilmemiş')}
- İstenen Tutar: {payment_order.get('amount', 0)} TRY
- Açıklama: {payment_order.get('description', 'Belirtilmemiş')}

ZORUNLU DOĞRULAMA KRİTERLERİ:
1. Alıcı adı MUTLAKA eşleşmeli (benzer isim kabul edilebilir)
2. IBAN'ın en az son 4 hanesi eşleşmeli
3. Transfer tutarı (ücretler hariç) maksimum %2 fark olabilir
4. Banka ücretleri NORMAL ve KABUL EDİLEBİLİR (0-50 TRY arası)
5. Eğer ana tutar %2+ farklıysa REJECT
6. Eğer alıcı adı hiç eşleşmiyorsa REJECT
7. Eğer IBAN tamamen farklıysa REJECT
8. Ücretler 50 TRY'yi geçmezse NORMAL kabul et

JSON CEVAP:
{{
    "verification_result": {{
        "is_valid": false,
        "recipient_match": false,
        "amount_match": false,
        "transaction_successful": true
    }},
    "extracted_data": {{
        "recipient_name": "Dekonttan okunan gerçek alıcı adı",
        "recipient_iban": "Dekonttan okunan gerçek IBAN",
        "transfer_amount": 4000.0,
        "currency": "TRY",
        "transaction_date": "2024-01-15",
        "reference_number": "REF123"
    }},
    "fees_breakdown": {{
        "transfer_fee": 5.0,
        "commission": 0.0,
        "vat_on_fee": 0.9,
        "other_fees": 0.0,
        "total_fees": 5.9
    }},
    "amount_summary": {{
        "ordered_amount": {payment_order.get('amount', 0)},
        "actual_transfer": 4000.0,
        "total_fees": 5.9,
        "total_deducted": 4005.9,
        "amount_difference": {payment_order.get('amount', 0) - 4000.0}
    }},
    "anomalies": [],
    "recommendation": "APPROVE",
    "confidence_score": 0.95,
    "analysis_notes": "Transfer tutarı doğru, banka ücretleri normal seviyelerde"
}}

KURALLAR:
- Ana transfer tutarı eşleşiyorsa amount_match=true (ücretler önemli değil)
- Banka ücretleri 0-50 TRY arası NORMAL, anomalies'e ekleme
- Alıcı adı eşleşmiyorsa recipient_match=false
- Ana tutar %2+ farklıysa amount_match=false
- Sadece CİDDİ sorunları anomalies'e yaz (banka ücretleri değil)
- Normal banka ücretleri varsa recommendation="APPROVE"
- Gerçek tutarları ve isimleri yaz

SADECE JSON döndür!
            """

            logger.info("Sending request to Gemini AI...")
            response = self.vision_model.generate_content([prompt, image])
            response_text = response.text.strip()
            logger.info(f"AI Response received: {response_text[:200]}...")
            
            # Clean up response text for JSON parsing
            if '```json' in response_text:
                response_text = response_text.split('```json')[1].split('```')[0].strip()
            elif '```' in response_text:
                response_text = response_text.split('```')[1].strip()
            
            logger.info(f"Cleaned response for JSON parsing: {response_text[:200]}...")
            
            try:
                result = json.loads(response_text)
                result["success"] = True
                logger.info("JSON parsing successful")
                return result
            except json.JSONDecodeError as json_error:
                logger.error(f"JSON parsing failed: {json_error}")
                logger.error(f"Response text: {response_text}")
                return {
                    "success": False,
                    "error": f"AI response JSON parsing failed: {str(json_error)}",
                    "raw_response": response_text
                }

        except Exception as e:
            logger.error(f"Payment verification error: {e}")
            return {
                "success": False,
                "error": f"Doğrulama analizi başarısız: {str(e)}",
                "confidence_score": 0.0
            }

    async def analyze_receipt(self, file_path: str, payment_info: Optional[Dict] = None) -> Dict[str, Any]:
        """
        Dekont/fatura görselini detaylı olarak analiz eder
        """
        if not self.model:
            return {
                "success": False,
                "error": "AI service not available"
            }

        try:
            # Vision model kullanarak resim analizi
            if not self.vision_model:
                return {
                    "success": False,
                    "error": "Vision model not available"
                }
            
            # Dosyayı yükle ve Gemini format'ına çevir
            import PIL.Image
            
            image = PIL.Image.open(file_path)

            prompt = """
            Bu dekont/transfer belgesi görselini detaylı analiz et ve JSON formatında şu bilgileri çıkar:

            {
                "success": true,
                "transaction_details": {
                    "amount": 1500.50,
                    "currency": "TRY",
                    "date": "2025-06-06",
                    "time": "14:30:00",
                    "reference_number": "REF123456789"
                },
                "bank_info": {
                    "bank_name": "Türkiye İş Bankası",
                    "branch_name": "Kadıköy Şubesi",
                    "branch_code": "1234"
                },
                "sender_account": {
                    "account_holder": "MEHMET YILMAZ",
                    "account_number": "1234567890",
                    "iban": "TR123456789012345678901234"
                },
                "recipient_info": {
                    "name": "ABC TEDARİKÇİ LTD. ŞTİ.",
                    "account_number": "9876543210",
                    "iban": "TR987654321098765432109876",
                    "bank_name": "Garanti BBVA"
                },
                "fees_and_charges": {
                    "transfer_fee": 5.00,
                    "commission": 2.50,
                    "vat_on_fee": 1.80,
                    "total_fees": 9.30
                },
                "amount_breakdown": {
                    "gross_amount": 1500.50,
                    "total_fees": 9.30,
                    "net_deducted": 1509.80
                },
                "description": "Ofis malzemesi satın alımı",
                "transaction_type": "EFT",
                "status": "BAŞARILI",
                "confidence_score": 0.95
            }

            ÖNEMLİ NOTLAR:
            - Tüm ücretleri (transfer ücreti, komisyon, KDV vb.) ayrı ayrı çıkar
            - Net çıkan tutarı hesapla (ana tutar + ücretler)
            - Tarih formatını YYYY-MM-DD olarak ver
            - Para tutarlarını sayı olarak ver (string değil)
            - Eğer bir bilgiyi okuyamazsan null ver
            - Güven skorunu 0-1 arasında ver

            Eğer dekont okunamazsa:
            {
                "success": false,
                "error": "Dekont okunmadı",
                "confidence_score": 0.0
            }
            """

            response = self.vision_model.generate_content([prompt, image])
            response_text = response.text.strip()
            
            # Clean up response text for JSON parsing
            if '```json' in response_text:
                response_text = response_text.split('```json')[1].split('```')[0].strip()
            elif '```' in response_text:
                response_text = response_text.split('```')[1].strip()
            
            result = json.loads(response_text)
            
            return result

        except Exception as e:
            logger.error(f"Receipt analysis error: {e}")
            return {
                "success": False,
                "error": str(e),
                "confidence_score": 0.0
            }

    async def categorize_expense(self, description: str, recipient: str, amount: float) -> PaymentCategory:
        """
        Masraf kategorizasyonu
        """
        if not self.model:
            return PaymentCategory.OTHER

        try:
            prompt = f"""
            Bu ödeme için en uygun kategoriyi belirle:
            
            Alıcı: {recipient}
            Tutar: {amount} TL
            Açıklama: {description}
            
            Kategoriler:
            - office_supplies: Ofis malzemeleri
            - utilities: Faturalar (elektrik, su, internet vb.)
            - salary: Maaş ödemeleri
            - rent: Kira ödemeleri
            - insurance: Sigorta ödemeleri
            - tax: Vergi ödemeleri
            - loan: Kredi/loan ödemeleri
            - supplier: Tedarikçi ödemeleri
            - service: Hizmet ödemeleri
            - other: Diğer
            
            Sadece kategori adını döndür (örn: office_supplies)
            """

            response = self.model.generate_content(prompt)
            category_str = response.text.strip().lower()
            
            # Clean up response if it contains extra formatting
            if '```' in category_str:
                category_str = category_str.split('```')[1].strip() if '```' in category_str else category_str
            
            # Kategori doğrulaması
            try:
                return PaymentCategory(category_str)
            except ValueError:
                return PaymentCategory.OTHER

        except Exception as e:
            logger.error(f"Categorization error: {e}")
            return PaymentCategory.OTHER

    async def analyze_check(self, file_path: str) -> Dict[str, Any]:
        """
        Çek analizi
        """
        if not self.model:
            return {
                "success": False,
                "error": "AI service not available"
            }

        try:
            if not self.vision_model:
                return {
                    "success": False,
                    "error": "Vision model not available"
                }
            
            import PIL.Image
            image = PIL.Image.open(file_path)

            prompt = """
            Bu çek görselini analiz et ve bilgileri JSON formatında çıkar:

            {
                "amount": "çek tutarı (sadece sayı)",
                "date": "çek tarihi (YYYY-MM-DD)",
                "due_date": "vade tarihi (YYYY-MM-DD)",
                "bank_name": "banka adı",
                "check_number": "çek numarası",
                "drawer_name": "çeken kişi/kurum",
                "account_number": "hesap numarası",
                "success": true
            }

            Tarihleri mutlaka YYYY-MM-DD formatında ver.
            """

            response = self.vision_model.generate_content([prompt, image])
            response_text = response.text.strip()
            
            # Clean up response text for JSON parsing
            if '```json' in response_text:
                response_text = response_text.split('```json')[1].split('```')[0].strip()
            elif '```' in response_text:
                response_text = response_text.split('```')[1].strip()
            
            result = json.loads(response_text)
            
            return result

        except Exception as e:
            logger.error(f"Check analysis error: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    async def smart_expense_categorization(self, transactions_history: List[Dict], new_transaction: Dict) -> Dict[str, Any]:
        """
        Geçmiş işlem verilerini kullanarak akıllı kategorizasyon
        """
        if not self.model:
            return {"category": PaymentCategory.OTHER, "confidence": 0.0}

        try:
            # Geçmiş işlemlerden örnekler hazırla
            history_examples = []
            for tx in transactions_history[-10:]:  # Son 10 işlem
                if tx.get('category'):
                    history_examples.append({
                        "description": tx.get('description', ''),
                        "recipient": tx.get('recipient_name', ''),
                        "amount": tx.get('amount', 0),
                        "category": tx.get('category', '')
                    })

            prompt = f"""
            Geçmiş işlem verilerini kullanarak yeni işlemin kategorisini belirle:

            GEÇMİŞ İŞLEMLER:
            {json.dumps(history_examples, ensure_ascii=False, indent=2)}

            YENİ İŞLEM:
            Açıklama: {new_transaction.get('description', '')}
            Alıcı: {new_transaction.get('recipient_name', '')}
            Tutar: {new_transaction.get('amount', 0)} TL

            Kategoriler: office_supplies, utilities, salary, rent, insurance, tax, loan, supplier, service, other

            Sadece JSON formatında cevap ver:
            {{
                "category": "önerilen_kategori",
                "confidence": 0.95,
                "reasoning": "Bu kategoriyi önerme sebebim...",
                "similar_transactions": ["benzer işlem açıklamaları"]
            }}
            """

            response = self.model.generate_content(prompt)
            response_text = response.text.strip()
            
            # Clean up response text for JSON parsing
            if '```json' in response_text:
                response_text = response_text.split('```json')[1].split('```')[0].strip()
            elif '```' in response_text:
                response_text = response_text.split('```')[1].strip()
            
            result = json.loads(response_text)
            return result

        except Exception as e:
            logger.error(f"Smart categorization error: {e}")
            return {"category": PaymentCategory.OTHER, "confidence": 0.0}

    async def predict_monthly_expenses(self, transactions_history: List[Dict]) -> Dict[str, Any]:
        """
        Geçmiş verilere göre aylık harcama tahmini
        """
        if not self.model:
            return {"prediction": 0.0, "confidence": 0.0}

        try:
            # Son 6 ayın verilerini analiz et
            monthly_data = self._group_transactions_by_month(transactions_history)
            
            prompt = f"""
            Geçmiş aylık harcama verilerini analiz ederek gelecek ay için tahmin yap:

            AYLIK HARCAMA VERİLERİ:
            {json.dumps(monthly_data, ensure_ascii=False, indent=2)}

            Görevlerin:
            1. Gelecek ayın toplam harcama tahmini
            2. Kategori bazlı tahminler
            3. Güven skorunu hesapla
            4. Trend analizi yap

            JSON formatında cevap ver:
            {{
                "total_prediction": 45000.0,
                "category_predictions": {{
                    "utilities": 2500.0,
                    "salary": 15000.0,
                    "supplier": 20000.0
                }},
                "confidence": 0.85,
                "trend": "increasing",
                "trend_percentage": 5.2,
                "seasonality_factors": ["Yaz ayları artan elektrik faturası"]
            }}
            """

            response = self.model.generate_content(prompt)
            response_text = response.text.strip()
            
            # Clean up response text for JSON parsing
            if '```json' in response_text:
                response_text = response_text.split('```json')[1].split('```')[0].strip()
            elif '```' in response_text:
                response_text = response_text.split('```')[1].strip()
            
            result = json.loads(response_text)
            return result

        except Exception as e:
            logger.error(f"Expense prediction error: {e}")
            return {"prediction": 0.0, "confidence": 0.0}

    async def detect_anomalies(self, recent_transactions: List[Dict]) -> Dict[str, Any]:
        """
        Anormal harcama patternleri tespit et
        """
        if not self.model:
            return {"anomalies": []}

        try:
            prompt = f"""
            Son işlemleri analiz ederek anormal harcama patternlerini tespit et:

            SON İŞLEMLER:
            {json.dumps(recent_transactions, ensure_ascii=False, indent=2)}

            Anomali türleri:
            - Olağandışı yüksek tutarlar
            - Beklenmeyen kategorilerde harcamalar
            - Sık tekrarlayan benzer ödemeler
            - Weekend veya gece saatleri işlemler
            - Aynı alıcıya çok yakın zamanlı ödemeler

            JSON formatında cevap ver:
            {{
                "anomalies": [
                    {{
                        "transaction_id": "tx_123",
                        "type": "high_amount",
                        "description": "Normal harcama tutarından 3 kat yüksek",
                        "severity": "medium",
                        "recommendation": "Bu işlemi kontrol edin"
                    }}
                ],
                "risk_score": 0.3,
                "summary": "2 düşük riskli anomali tespit edildi"
            }}
            """

            response = self.model.generate_content(prompt)
            response_text = response.text.strip()
            
            # Clean up response text for JSON parsing
            if '```json' in response_text:
                response_text = response_text.split('```json')[1].split('```')[0].strip()
            elif '```' in response_text:
                response_text = response_text.split('```')[1].strip()
            
            result = json.loads(response_text)
            return result

        except Exception as e:
            logger.error(f"Anomaly detection error: {e}")
            return {"anomalies": []}

    async def generate_expense_insights(self, transactions: List[Dict], time_period: str = "monthly") -> Dict[str, Any]:
        """
        Harcama analizi ve önerileri oluştur
        """
        if not self.model:
            return {"insights": []}

        try:
            prompt = f"""
            {time_period} harcama verilerini analiz ederek önerilerde bulun:

            HARCAMA VERİLERİ:
            {json.dumps(transactions, ensure_ascii=False, indent=2)}

            Analiz et:
            1. En yüksek harcama kategorileri
            2. Trend değişiklikleri
            3. Tasarruf fırsatları
            4. Bütçe önerileri
            5. Risk alanları

            JSON formatında cevap ver:
            {{
                "insights": [
                    {{
                        "category": "office_supplies",
                        "trend": "increasing",
                        "percentage": 15.2,
                        "insight": "Ofis malzeme harcamaları artıyor",
                        "recommendation": "Toplu alım yaparak maliyet düşürülebilir"
                    }}
                ],
                "total_spent": 45000.0,
                "savings_opportunities": [
                    {{
                        "category": "utilities",
                        "potential_saving": 500.0,
                        "suggestion": "Enerji tasarruflu ekipmanlar"
                    }}
                ],
                "budget_recommendations": {{
                    "next_month_budget": 42000.0,
                    "category_limits": {{
                        "utilities": 3000.0,
                        "office_supplies": 2000.0
                    }}
                }}
            }}
            """

            response = self.model.generate_content(prompt)
            response_text = response.text.strip()
            
            # Clean up response text for JSON parsing
            if '```json' in response_text:
                response_text = response_text.split('```json')[1].split('```')[0].strip()
            elif '```' in response_text:
                response_text = response_text.split('```')[1].strip()
            
            result = json.loads(response_text)
            return result

        except Exception as e:
            logger.error(f"Insights generation error: {e}")
            return {"insights": []}

    def _group_transactions_by_month(self, transactions: List[Dict]) -> Dict[str, Any]:
        """
        İşlemleri aylara göre grupla
        """
        monthly_data = {}
        
        for tx in transactions:
            if 'transaction_date' in tx:
                date = datetime.fromisoformat(tx['transaction_date'].replace('Z', '+00:00'))
                month_key = date.strftime('%Y-%m')
                
                if month_key not in monthly_data:
                    monthly_data[month_key] = {
                        'total': 0.0,
                        'count': 0,
                        'categories': {}
                    }
                
                monthly_data[month_key]['total'] += tx.get('amount', 0)
                monthly_data[month_key]['count'] += 1
                
                category = tx.get('category', 'other')
                if category not in monthly_data[month_key]['categories']:
                    monthly_data[month_key]['categories'][category] = 0.0
                monthly_data[month_key]['categories'][category] += tx.get('amount', 0)
        
        return monthly_data

    async def create_employee_profile_summary(self, employee_data: dict) -> str:
        """
        Çalışan için AI profil özeti oluştur
        """
        if not self.model:
            return f"{employee_data.get('first_name', '')} {employee_data.get('last_name', '')} - {employee_data.get('position', '')} pozisyonunda çalışan personel."

        try:
            prompt = f"""
            Yemekhane çalışanı profil analizi yap:
            
            ÇALIŞAN BİLGİLERİ:
            - Ad Soyad: {employee_data.get('first_name', '')} {employee_data.get('last_name', '')}
            - Pozisyon: {employee_data.get('position', '')}
            - Departman: {employee_data.get('department', '')}
            - Maaş: {employee_data.get('salary', 0)} TRY
            - İşe Giriş: {employee_data.get('hire_date', '')}
            - Telefon: {employee_data.get('phone', '')}
            - Adres: {employee_data.get('address', '')}
            
            GÖREV:
            Bu çalışan için 2-3 cümlelik profesyonel profil özeti oluştur.
            Pozisyonuna uygun yetenekler ve sorumluluklarından bahset.
            Türkçe yaz ve sadece özet metni döndür, başka hiçbir şey yazma.
            """
            
            response = self.model.generate_content(prompt)
            return response.text.strip()

        except Exception as e:
            logger.error(f"Employee profile summary error: {e}")
            return f"{employee_data.get('first_name', '')} {employee_data.get('last_name', '')} - {employee_data.get('position', '')} pozisyonunda çalışan personel."

    async def chat_about_transaction(self, user_message: str, transaction_context: str) -> str:
        """
        İşlem hakkında kullanıcı ile sohbet et
        """
        if not self.model:
            return "AI servisi şu anda kullanılamıyor."

        try:
            prompt = f"""
            Sen bir finansal muhasebe asistanısın. Kullanıcı bir işlem hakkında soru soruyor.
            
            İŞLEM KONTEXT'İ:
            {transaction_context}
            
            KULLANICI SORUSU: {user_message}
            
            Kuralllar:
            - Kısa ve net cevap ver (max 2-3 cümle)
            - Türkçe cevapla
            - Sadece sorulan soruya cevap ver
            - İşlem verileriyle ilgili spesifik bilgi ver
            - Emoji kullanma
            
            Sadece cevabı döndür, başka hiçbir şey yazma.
            """

            response = self.model.generate_content(prompt)
            return response.text.strip()

        except Exception as e:
            logger.error(f"Chat AI error: {e}")
            return "Üzgünüm, şu anda size yardımcı olamıyorum."

    async def smart_supplier_detection(self, transactions: List[Dict]) -> Dict[str, Any]:
        """
        Akıllı tedarikçi analizi ve önerileri
        """
        if not self.model:
            return {"suppliers": []}

        try:
            prompt = f"""
            İşlem verilerini analiz ederek tedarikçi önerileri ver:

            İŞLEM VERİLERİ:
            {json.dumps(transactions, ensure_ascii=False, indent=2)}

            Analiz et:
            1. En sık kullanılan tedarikçiler
            2. Ödeme tutarları ve sıklığı
            3. Alternatif tedarikçi önerileri
            4. Maliyet optimizasyon fırsatları

            JSON formatında cevap ver:
            {{
                "top_suppliers": [
                    {{
                        "name": "ABC Tedarikçi Ltd.",
                        "total_amount": 15000.0,
                        "transaction_count": 12,
                        "average_amount": 1250.0,
                        "category": "supplier",
                        "reliability_score": 0.9
                    }}
                ],
                "recommendations": [
                    {{
                        "type": "cost_optimization",
                        "suggestion": "XYZ firması ile toplu anlaşma %10 tasarruf sağlayabilir",
                        "potential_saving": 1500.0
                    }}
                ],
                "payment_patterns": {{
                    "most_common_day": "Pazartesi",
                    "average_payment_cycle": 15,
                    "late_payment_risk": "low"
                }}
            }}
            """

            response = self.model.generate_content(prompt)
            response_text = response.text.strip()
            
            # Clean up response text for JSON parsing
            if '```json' in response_text:
                response_text = response_text.split('```json')[1].split('```')[0].strip()
            elif '```' in response_text:
                response_text = response_text.split('```')[1].strip()
            
            result = json.loads(response_text)
            return result

        except Exception as e:
            logger.error(f"Supplier analysis error: {e}")
            return {"suppliers": []}

# Global AI service instance
ai_service = GeminiAIService()