"use client"

import React, { useEffect, useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, CreditCard, ShoppingBag } from "lucide-react";
import axios from 'axios';
import { loadTossPayments } from '@tosspayments/tosspayments-sdk';
import { getBackendUrl } from '@/lib/api';

const CLIENT_KEY = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY ;

interface PaymentItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
  image: string;
  isNaverProduct?: boolean; // 네이버 상품 여부
  naverProduct?: any; // 네이버 상품 원본 데이터
  product?: {
    id: number;
    name: string;
    description: string;
    price: number;
    stock: number;
    imageUrl: string;
    category: string;
    registrationDate: string;
    registeredBy: string;
  };
}

interface PaymentPageProps {
  items: PaymentItem[];
  onBack: () => void;
  onSuccess: (paymentInfo: any) => void;
  onFail: (error: any) => void;
}

declare global {
  interface Window {}
}

export default function PaymentPage({ items, onBack, onSuccess, onFail }: PaymentPageProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [paymentMethod] = useState<string>("CARD");
  const [tossPayments, setTossPayments] = useState<any>(null);
  const [payment, setPayment] = useState<any>(null);
  const [userInfo, setUserInfo] = useState<any>(null);

  const totalAmount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const [orderId, setOrderId] = useState<string>('');
  const [isInitialized, setIsInitialized] = useState(false);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const hasInitialized = useRef(false);

  // 주문 생성
  const createOrder = async (userData: any) => {
    // 이미 주문이 생성되었거나 생성 중이면 중복 생성 방지
    if (orderId || isCreatingOrder) {
      console.log('주문이 이미 생성되어 있거나 생성 중입니다:', { orderId, isCreatingOrder });
      return;
    }
    
    setIsCreatingOrder(true);
    
    try {
      const accessToken = localStorage.getItem('accessToken');
      const refreshToken = localStorage.getItem('refreshToken');

      if (!accessToken) {
        throw new Error('로그인이 필요합니다.');
      }

      console.log('전체 결제 아이템:', items);
      console.log('아이템 개수:', items.length);
      console.log('사용자 정보:', userData);
      
      let response;
      let currentToken = accessToken;
      
      // 모든 상품을 bulk-all로 주문 생성 (결제는 첫 번째 주문 ID만 사용)
      console.log('전체 주문 생성 시작 (결제용)');
      
      const orderItems = items.map(item => {
        if (item.isNaverProduct) {
          // 네이버 상품인 경우 - item.id가 데이터베이스에 저장된 네이버 상품 ID
          return { 
            type: 'naver', 
            naverProductId: item.id, 
            quantity: item.quantity, 
            name: item.name 
          };
        } else {
          // 일반 상품인 경우
          return { 
            type: 'regular', 
            productId: item.product?.id || item.id, 
            quantity: item.quantity, 
            name: item.name 
          };
        }
      });

      const orderData = {
        accountId: userData.id,
        items: orderItems
      };

      console.log('전체 주문 생성 요청:', orderData);

      response = await axios.post(`${getBackendUrl()}/api/orders/bulk-all`, orderData, {
        headers: {
          'Access_Token': currentToken
        }
      });

      console.log('전체 주문 생성 응답:', response.data);

      console.log('주문 생성 응답:', response.data);
      
      // bulk-all API는 여러 주문을 반환하므로 첫 번째 주문의 ID를 사용
      const responseData = response.data;
      let createdOrder;
      
      if (responseData.orders && responseData.orders.length > 0) {
        // bulk-all 응답인 경우
        createdOrder = responseData.orders[0]; // 첫 번째 주문 사용
        console.log('전체 주문 생성 완료, 첫 번째 주문 ID 사용:', createdOrder.merchantOrderId);
        console.log('생성된 전체 주문 수:', responseData.orders.length);
      } else {
        // 단일 주문 응답인 경우 (기존 방식)
        createdOrder = responseData;
      }
      
      setOrderId(createdOrder.merchantOrderId);
      console.log('주문 ID 설정:', createdOrder.merchantOrderId);
    } catch (error) {
      console.error('주문 생성 오류:', error);
      throw error;
    } finally {
      setIsCreatingOrder(false);
    }
  };

  // 사용자 정보 가져오기
  const fetchUserInfo = async () => {
    // useRef와 state 모두 체크해서 중복 실행 방지
    if (hasInitialized.current && isInitialized) {
      console.log('이미 초기화되었습니다.');
      return;
    }
    
    try {
      // 메인 웹사이트와 동일한 토큰 저장 방식 사용
      const accessToken = localStorage.getItem('accessToken');
      const refreshToken = localStorage.getItem('refreshToken');
      
      console.log('토큰 확인:', accessToken ? '토큰 존재' : '토큰 없음');
      console.log('리프레시 토큰 확인:', refreshToken ? '토큰 존재' : '토큰 없음');

      if (!accessToken) {
        console.error('No access token found. Please login first.');
        console.log('Current page URL:', window.location.href);
        console.log('Available localStorage keys:', Object.keys(localStorage));
        console.log('Available sessionStorage keys:', Object.keys(sessionStorage));
        throw new Error('로그인이 필요합니다.');
      }

      // 토큰이 만료되었을 경우 리프레시 토큰으로 갱신 시도
      let currentToken = accessToken;
      try {
        const response = await axios.get(`${getBackendUrl()}/api/accounts/me`, {
          headers: {
            'Access_Token': currentToken
          }
        });

        console.log('API Response:', response.data);

        // 백엔드에서 ResponseDto.success()로 감싸서 반환
        if (response.data.success) {
          const userData = response.data.data;
          setUserInfo(userData);
          console.log('User info set:', userData);
          
          // 사용자 정보를 가져온 후 주문 생성
          await createOrder(userData);
          
          // 초기화 완료 표시
          setIsInitialized(true);
        } else {
          throw new Error('사용자 정보를 가져올 수 없습니다.');
        }
      } catch (tokenError: any) {
        // 토큰이 만료된 경우 리프레시 토큰으로 갱신 시도
        if (tokenError.response?.status === 401 && refreshToken) {
          console.log('액세스 토큰이 만료되었습니다. 리프레시 토큰으로 갱신을 시도합니다.');
          
          try {
            const refreshResponse = await axios.post(`${getBackendUrl()}/api/accounts/refresh`, {
              refreshToken: refreshToken
            });
            
            if (refreshResponse.data.success) {
              const newAccessToken = refreshResponse.data.data.accessToken;
              localStorage.setItem('accessToken', newAccessToken);
              currentToken = newAccessToken;
              
              // 새로운 토큰으로 사용자 정보 다시 요청
              const userResponse = await axios.get(`${getBackendUrl()}/api/accounts/me`, {
                headers: {
                  'Access_Token': currentToken
                }
              });
              
              if (userResponse.data.success) {
                const userData = userResponse.data.data;
                setUserInfo(userData);
                console.log('User info set (after refresh):', userData);
                
                // 사용자 정보를 가져온 후 주문 생성
                await createOrder(userData);
                
                // 초기화 완료 표시
                setIsInitialized(true);
              } else {
                throw new Error('사용자 정보를 가져올 수 없습니다.');
              }
            } else {
              throw new Error('토큰 갱신에 실패했습니다.');
            }
          } catch (refreshError) {
            console.error('토큰 갱신 실패:', refreshError);
            throw new Error('토큰이 만료되었습니다. 다시 로그인해주세요.');
          }
        } else {
          throw tokenError;
        }
      }
    } catch (error) {
      console.error('사용자 정보 조회 실패:', error);
      const err = error as any;
      if (err && err.response) {
        console.error('Error response:', err.response.data);
        console.error('Error status:', err.response.status);
      }
      alert('로그인이 필요합니다. 로그인 페이지로 이동합니다.');
      onFail(err);
    }
  };

  useEffect(() => {
    // useRef를 사용해서 정확히 한 번만 실행
    if (hasInitialized.current) {
      return;
    }
    hasInitialized.current = true;
    
    // 사용자 정보 불러오기
    fetchUserInfo();

    // SDK 로드 및 초기화 (공식 패키지 방식)
    (async () => {
      try {
        if (!CLIENT_KEY || CLIENT_KEY.trim().length === 0) {
          console.error('환경변수 NEXT_PUBLIC_TOSS_CLIENT_KEY 가 설정되지 않았습니다. .env.local 에 테스트 클라이언트 키를 설정하고 dev 서버를 재시작하세요.');
          return;
        }
        const tp = await loadTossPayments(CLIENT_KEY);
        let tpNormalized: any = tp as any;
        // 방어: 혹시 함수 형태로 반환되는 경우 초기화 시도
        if (typeof tpNormalized === 'function') {
          try {
            tpNormalized = tpNormalized(CLIENT_KEY);
          } catch (e) {
            console.warn('tossPayments function-like instance init failed:', e);
          }
        }
        if (!tpNormalized || typeof tpNormalized.payment !== 'function') {
          console.error('Invalid TossPayments instance. Shape:', tpNormalized);
          // Fallback: CDN 스크립트 태그로 로드 시도
          await new Promise<void>((resolve, reject) => {
            const existing = document.querySelector('script[src="https://js.tosspayments.com/v2/standard"]');
            if (existing) existing.remove();
            const script = document.createElement('script');
            script.src = 'https://js.tosspayments.com/v2/standard';
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('TossPayments CDN script load failed'));
            document.head.appendChild(script);
          });
          const globalTP: any = (window as any).TossPayments;
          if (typeof globalTP === 'function') {
            const tpFromCdn = globalTP(CLIENT_KEY);
            if (tpFromCdn && typeof tpFromCdn.payment === 'function') {
              console.log('TossPayments loaded via CDN fallback');
              setTossPayments(tpFromCdn);
              return;
            } else {
              console.error('CDN TossPayments invalid:', tpFromCdn);
            }
          } else {
            console.error('Global TossPayments not available after CDN load:', globalTP);
          }
        } else {
          console.log("TossPayments loaded via SDK:", tpNormalized);
          setTossPayments(tpNormalized);
        }
      } catch (error) {
        console.error("TossPayments v2 SDK 로드 실패:", error);
        onFail(error);
      }
    })();
  }, []); // 빈 의존성 배열로 컴포넌트 마운트 시 한 번만 실행

  // tossPayments와 userInfo가 준비되면 payment 인스턴스를 미리 생성
  useEffect(() => {
    if (!tossPayments || !userInfo) return;
    try {
      const customerKey = `customer_${userInfo.id}`;
      if (typeof tossPayments.payment === 'function') {
        const p = tossPayments.payment({ customerKey });
        if (p && typeof p.requestPayment === 'function') {
          setPayment(p);
          console.log('Payment instance prepared');
        } else {
          console.error('payment instance invalid:', p);
        }
      } else {
        console.error('tossPayments.payment is not a function. keys:', Object.keys(tossPayments || {}));
      }
    } catch (e) {
      console.error('Failed to create payment instance:', e);
    }
  }, [tossPayments, userInfo]);

  const handlePayment = async () => {
    if (!tossPayments) {
      alert("결제 모듈을 불러오는 중입니다. 잠시 후 다시 시도해주세요.");
      return;
    }

    if (!payment) {
      console.error('Payment instance not ready. tp keys:', Object.keys(tossPayments || {}));
      alert("결제 준비 중입니다. 잠시 후 다시 시도해주세요.");
      return;
    }

    if (!userInfo) {
      alert("사용자 정보를 불러오는 중입니다. 잠시 후 다시 시도해주세요.");
      return;
    }

    if (!orderId) {
      alert("주문 정보를 불러오는 중입니다. 잠시 후 다시 시도해주세요.");
      return;
    }

    setIsLoading(true);

    try {
      const accessToken = localStorage.getItem('accessToken');
      
      if (!accessToken) {
        throw new Error('로그인이 필요합니다.');
      }
      
      console.log('결제 요청 정보:', {
        orderId,
        totalAmount,
        items: items.map(item => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          subtotal: item.price * item.quantity
        }))
      });

      // 필수 파라미터 검증
      if (!orderId || !totalAmount || totalAmount <= 0) {
        throw new Error("결제 금액이나 주문번호가 올바르지 않습니다.");
      }

      // 결제 정보 (개별 연동 v2 최소 파라미터)
      const paymentConfig: any = {
        method: "CARD", // 먼저 카드 결제만 테스트
        amount: {
          currency: "KRW",
          value: totalAmount, // 실제 상품 금액 사용
        },
        orderId: orderId,
        orderName: items.length > 0 ? items[0].name : "상품",
        successUrl: `${window.location.origin}/payment/success`,
        failUrl: `${window.location.origin}/payment/fail`,
        customerEmail: userInfo?.email || "customer123@gmail.com",
        customerName: userInfo?.name || userInfo?.nickname || "고객",
        customerMobilePhone: userInfo?.phoneNumber || "01012341234",
      };

      // 카드 결제 설정 (허용 필드만 사용)
      paymentConfig.card = {
        useEscrow: false,
        useCardPoint: false,
        useAppCardOnly: false,
      };
      
      await payment.requestPayment(paymentConfig);
    } catch (error) {
      console.error("결제 요청 실패:", error);
      setIsLoading(false);
      onFail(error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        {/* 헤더 */}
        <div className="flex items-center mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="mr-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            뒤로가기
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">결제하기</h1>
        </div>

        <div className="grid gap-6">
          {/* 주문 상품 정보 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <ShoppingBag className="h-5 w-5 mr-2" />
                주문 상품
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {items.map((item) => (
                  <div key={item.id} className="flex items-center space-x-4">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-16 h-16 object-cover rounded-lg"
                    />
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{item.name}</h3>
                      <p className="text-sm text-gray-500">
                        {item.price.toLocaleString()}원 × {item.quantity}개
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900">
                        {(item.price * item.quantity).toLocaleString()}원
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 결제 수단 선택 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <CreditCard className="h-5 w-5 mr-2" />
                결제 수단
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="CARD"
                    checked={true}
                    disabled
                    className="text-blue-600"
                  />
                  <span className="text-gray-900">신용카드</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 결제 금액 정보 */}
          <Card>
            <CardHeader>
              <CardTitle>결제 금액</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>상품 금액</span>
                  <span>{totalAmount.toLocaleString()}원</span>
                </div>
                <div className="flex justify-between">
                  <span>배송비</span>
                  <span>0원</span>
                </div>
                <hr className="my-2" />
                <div className="flex justify-between text-lg font-bold">
                  <span>총 결제 금액</span>
                  <span>{totalAmount.toLocaleString()}원</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 결제 버튼 */}
          <Button
            onClick={handlePayment}
            disabled={isLoading}
            className="w-full py-3 text-lg font-medium"
          >
            {isLoading ? "결제 처리 중..." : `${totalAmount.toLocaleString()}원 결제하기`}
          </Button>
        </div>
      </div>
    </div>
  );
}
