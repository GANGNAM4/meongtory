"use client"

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import PaymentPage from './PaymentPage';

interface PaymentItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
  image: string;
  isNaverProduct?: boolean; // 네이버 상품 여부 추가
}

function PaymentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showPayment, setShowPayment] = useState(false);
  const [paymentItems, setPaymentItems] = useState<PaymentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // URL 파라미터에서 상품 정보 읽어오기
    const productId = searchParams.get('productId');
    const productName = searchParams.get('productName');
    const price = searchParams.get('price');
    const quantity = searchParams.get('quantity');
    const imageUrl = searchParams.get('imageUrl');
    const isNaverProduct = searchParams.get('isNaverProduct'); // 네이버 상품 여부 추가

    console.log('URL 파라미터 확인:', {
      productId,
      productName,
      price,
      quantity,
      imageUrl,
      isNaverProduct
    });

    if (productId && productName && price && quantity && imageUrl) {
      // 실제 상품 데이터로 설정
      const items: PaymentItem[] = [
        {
          id: parseInt(productId),
          name: decodeURIComponent(productName),
          price: parseInt(price),
          quantity: parseInt(quantity),
          image: decodeURIComponent(imageUrl),
          isNaverProduct: isNaverProduct === 'true' // 네이버 상품 여부 설정
        }
      ];
      console.log('실제 상품 정보로 설정:', items);
      console.log('isNaverProduct 값:', isNaverProduct);
      console.log('isNaverProduct === "true":', isNaverProduct === 'true');
      setPaymentItems(items);
    } else {
      // 파라미터가 없으면 테스트용 상품 데이터 사용
      const testItems: PaymentItem[] = [
        {
          id: 1,
          name: '테스트 상품',
          price: 1000,
          quantity: 1,
          image: 'https://via.placeholder.com/150x150?text=Test+Product',
          isNaverProduct: false
        }
      ];
      console.log('테스트 상품 정보로 설정:', testItems);
      setPaymentItems(testItems);
    }
    setIsLoading(false);
  }, [searchParams]);

  const handleBack = () => {
    setShowPayment(false);
  };

  const handleSuccess = (paymentInfo: any) => {
    alert('결제가 성공했습니다!');
    router.push('/');
  };

  const handleFail = (error: any) => {
    console.error('결제 실패:', error);
    alert('결제에 실패했습니다.');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">상품 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (showPayment) {
    return (
      <PaymentPage
        items={paymentItems}
        onBack={handleBack}
        onSuccess={handleSuccess}
        onFail={handleFail}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">결제하기</h1>
          
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">주문 상품</h2>
            <div className="space-y-4">
              {paymentItems.map((item: PaymentItem) => (
                <div key={item.id} className="flex items-center space-x-4 p-4 border rounded-lg">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-16 h-16 object-cover rounded-lg"
                  />
                  <div className="flex-1">
                    <h3 className="font-medium">{item.name}</h3>
                    <p className="text-sm text-gray-500">
                      {item.price.toLocaleString()}원 × {item.quantity}개
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">
                      {(item.price * item.quantity).toLocaleString()}원
                    </p>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-6 pt-4 border-t">
              <div className="flex justify-between text-lg font-bold">
                <span>총 결제 금액</span>
                <span>
                  {paymentItems.reduce((sum: number, item: PaymentItem) => sum + (item.price * item.quantity), 0).toLocaleString()}원
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => setShowPayment(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg text-lg transition-colors"
          >
            결제하기
          </button>

        
        </div>
      </div>
    </div>
  );
}

export default function PaymentTestPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">로딩 중...</div>}>
      <PaymentContent />
    </Suspense>
  );
}
