"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Package, User, Calendar, DollarSign, Eye, AlertCircle, XCircle, Loader2 } from "lucide-react"
import { Order } from "@/types/store"
import axios from "axios"
import { getBackendUrl } from "@/lib/api";
import { formatToKST } from "@/lib/utils"

interface OrdersTabProps {
  onViewOrderDetails?: (order: Order) => void
}

export default function OrdersTab({
  onViewOrderDetails,
}: OrdersTabProps) {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const loadingRef = useRef<HTMLDivElement>(null)

  // 주문 데이터 페칭 (초기 로딩)
  const fetchOrders = async (isInitial = true) => {
    try {
      if (isInitial) {
        setLoading(true)
        setError(null)
        setPage(0)
        setHasMore(true)
      } else {
        setLoadingMore(true)
      }
      
      console.log('주문 데이터 가져오기 시작...', { page: isInitial ? 0 : page });
      
      // 인증 토큰 가져오기
      const accessToken = localStorage.getItem("accessToken");
      const refreshToken = localStorage.getItem("refreshToken");
      
      if (!accessToken) {
        console.error('인증 토큰이 없습니다.');
        if (isInitial) setOrders([]);
        return;
      }
      
      const headers = {
        "Authorization": `${accessToken}`,
        "Access_Token": accessToken,
        "Refresh_Token": refreshToken || ''
      };
      
      console.log('요청 헤더:', headers);
      const currentPage = isInitial ? 0 : page;
      const response = await axios.get(`${getBackendUrl()}/api/orders/admin/all?page=${currentPage}&size=20`, { headers });
      console.log('주문 API 응답:', response);
      
      // ResponseDto 형태로 응답이 오므로 response.data.data를 사용
      if (!response.data || !response.data.success) {
        throw new Error(response.data?.error?.message || "API 응답이 올바르지 않습니다.");
      }
      
      const data: any[] = response.data.data || [];
      console.log('받은 주문 데이터:', data);
      
      // 백엔드에서 받은 데이터를 프론트엔드 형식으로 변환 (결제 완료 및 취소된 주문 포함)
      const ordersWithItems: Order[] = data
        .filter((order: any) => order.status === 'PAID' || order.status === 'CANCELED') // 결제 완료 및 취소된 주문 포함
        .map((order: any) => {
          console.log('변환 중인 주문 데이터:', order);
          
          // 주문 상태에 따른 paymentStatus 결정
          let paymentStatus: "PENDING" | "COMPLETED" | "CANCELLED";
          if (order.status === 'PAID') {
            paymentStatus = 'COMPLETED';
          } else if (order.status === 'CANCELED') {
            paymentStatus = 'CANCELLED';
          } else {
            paymentStatus = 'PENDING';
          }
          
          return {
            orderId: order.id || order.orderId, // 백엔드에서는 id 필드 사용
            userId: order.accountId || order.userId,
            amount: order.amount, // 백엔드에서는 amount 필드 사용
            paymentStatus: paymentStatus,
            orderedAt: order.createdAt || order.orderedAt,
            orderItems: [{
              id: order.id,
              productId: order.productId,
              productName: order.productName,
              price: order.amount,
              quantity: order.quantity,
              orderDate: order.createdAt,
              status: paymentStatus === 'COMPLETED' ? 'completed' : paymentStatus === 'CANCELLED' ? 'cancelled' : 'pending',
              ImageUrl: order.imageUrl || "/placeholder.svg"
            }]
          };
        });
      
      // 최신순으로 정렬 (orderedAt 기준 내림차순)
      const sortedOrders = ordersWithItems.sort((a, b) => {
        const dateA = new Date(a.orderedAt).getTime();
        const dateB = new Date(b.orderedAt).getTime();
        return dateB - dateA; // 내림차순 (최신순)
      });
      
      console.log('변환된 주문 데이터:', sortedOrders);
      
      if (isInitial) {
        setOrders(sortedOrders);
        setPage(1);
      } else {
        setOrders(prev => [...prev, ...sortedOrders]);
        setPage(prev => prev + 1);
      }
      
      // 더 이상 데이터가 없으면 hasMore를 false로 설정
      if (sortedOrders.length < 20) {
        setHasMore(false);
      }
    } catch (error) {
      console.error("Error fetching orders:", error);
      if (axios.isAxiosError(error)) {
        console.error('Axios 오류:', error.response?.data);
        console.error('상태 코드:', error.response?.status);
      }
      setError('주문 데이터를 불러오는데 실패했습니다.');
      if (isInitial) setOrders([]);
    } finally {
      if (isInitial) {
        setLoading(false);
      } else {
        setLoadingMore(false);
      }
    }
  }

  // 추가 데이터 로딩
  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      fetchOrders(false);
    }
  }, [loadingMore, hasMore, page]);

  // Intersection Observer 설정
  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (loadingRef.current) {
      observerRef.current.observe(loadingRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [loadMore, hasMore, loadingMore]);

  // 주문 상태 업데이트
  const handleUpdateOrderStatus = async (orderId: number, status: "PENDING" | "COMPLETED" | "CANCELLED") => {
    try {
      console.log(`주문 상태 변경 요청: 주문ID ${orderId}, 상태 ${status}`);
      
      // 인증 토큰 가져오기
      const accessToken = localStorage.getItem("accessToken");
      const refreshToken = localStorage.getItem("refreshToken");
      
      if (!accessToken) {
        console.error('인증 토큰이 없습니다.');
        alert('인증 토큰이 없습니다. 다시 로그인해주세요.');
        return;
      }
      
      const headers = {
        "Authorization": `${accessToken}`,
        "Access_Token": accessToken,
        "Refresh_Token": refreshToken || ''
      };
      
      // 백엔드 상태값으로 변환
      const backendStatus = status === 'COMPLETED' ? 'PAID' : 
                           status === 'PENDING' ? 'CREATED' : 
                           status === 'CANCELLED' ? 'CANCELED' : 'CREATED';
      
      const response = await axios.patch(`${getBackendUrl()}/api/orders/${orderId}/status?status=${backendStatus}`, {}, { headers });
      console.log('업데이트된 주문:', response.data);
      
      // 현재 주문 목록에서 해당 주문만 업데이트
      setOrders(prev => prev.map(order => 
        order.orderId === orderId 
          ? { ...order, paymentStatus: status }
          : order
      ));
      
      // 마이페이지의 주문 내역도 업데이트하기 위해 전역 이벤트 발생
      window.dispatchEvent(new CustomEvent('orderStatusUpdated', {
        detail: { orderId, status }
      }));
      
      alert(`주문 상태가 ${status === 'COMPLETED' ? '완료' : status === 'PENDING' ? '대기중' : '취소'}로 변경되었습니다.`);
    } catch (error) {
      console.error('주문 상태 업데이트 오류:', error);
      const errorMessage = axios.isAxiosError(error) && error.response?.data?.error 
        ? error.response.data.error 
        : '주문 상태 업데이트에 실패했습니다.';
      alert('주문 상태 업데이트에 실패했습니다: ' + errorMessage);
    }
  };

  // 컴포넌트 마운트 시 데이터 페칭
  useEffect(() => {
    fetchOrders()
  }, [])

  const getStatusColor = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return "bg-green-100 text-green-800"
      case "PENDING":
        return "bg-yellow-100 text-yellow-800"
      case "CANCELLED":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return "완료"
      case "PENDING":
        return "대기중"
      case "CANCELLED":
        return "취소됨"
      default:
        return status
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-400 mx-auto mb-4"></div>
          <p>주문 데이터를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <p className="text-red-600">데이터를 불러오는 중 오류가 발생했습니다.</p>
        <Button onClick={fetchOrders} className="mt-4">
          다시 시도
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">주문 내역 관리</h2>

      <div className="grid gap-4">
        {(orders ?? []).length > 0 ? (
          orders.map((order, index) => (
            <Card key={order.orderId || `order-${index}`}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-3">
                      <h3 className="font-semibold">주문 #{order.orderId || order.id || 'N/A'}</h3>
                      <Badge 
                        className={
                          order.paymentStatus === "COMPLETED"
                            ? "bg-green-100 text-green-800"
                            : order.paymentStatus === "PENDING"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-red-100 text-red-800"
                        }
                      >
                        {order.paymentStatus === "COMPLETED" ? "완료" : 
                         order.paymentStatus === "PENDING" ? "대기중" : "취소됨"}
                      </Badge>
                    </div>
                    
                    <div className="space-y-2 mb-4">
                      <p className="text-sm text-gray-600">사용자 ID: {order.userId}</p>
                      <p className="text-sm text-gray-600">총 금액: {(order.amount || 0).toLocaleString()}원</p>
                      <p className="text-sm text-gray-600">
                        주문일: {order.orderedAt ? 
                          (() => {
                            try {
                              // ISO 문자열이나 다른 형식의 날짜를 안전하게 파싱
                              const date = new Date(order.orderedAt);
                              if (isNaN(date.getTime())) {
                                return "날짜 형식 오류";
                              }
                              return formatToKST(order.orderedAt)
                            } catch (error) {
                              console.error('날짜 파싱 오류:', error, '원본 데이터:', order.orderedAt);
                              return "날짜 없음"
                            }
                          })() 
                          : "날짜 없음"
                        }
                      </p>
                    </div>

                    {/* 주문 상품 목록 */}
                    {order.orderItems && order.orderItems.length > 0 ? (
                      <div className="space-y-2">
                        <h4 className="font-medium text-sm">주문 상품:</h4>
                        {order.orderItems.map((item, index) => {
                          console.log('주문 아이템:', item);
                          console.log('주문 아이템의 ImageUrl:', item.ImageUrl);
                          console.log('이미지 표시 여부:', !!item.ImageUrl);
                          
                          return (
                            <div key={item.id || `order-item-${index}`} className="flex items-center space-x-3 p-2 bg-gray-50 rounded overflow-visible">
                              <img
                                src={item.ImageUrl ? item.ImageUrl : "/placeholder.svg"}
                                alt={item.productName || "상품"}
                                className="w-16 h-16 object-cover rounded border border-gray-200"
                                onError={(e) => {
                                  console.log('이미지 로딩 실패:', item.ImageUrl);
                                  const target = e.target as HTMLImageElement;
                                  target.src = "/placeholder.svg";
                                }}
                                onLoad={(e) => {
                                  console.log('이미지 로딩 성공:', item.ImageUrl);
                                  const target = e.target as HTMLImageElement;
                                  console.log('이미지 실제 크기:', target.naturalWidth, 'x', target.naturalHeight);
                                  console.log('이미지 표시 크기:', target.width, 'x', target.height);
                                }}
                              />
                              <div className="flex-1">
                                <p className="text-sm font-medium">{item.productName || "상품명 없음"}</p>
                                <p className="text-xs text-gray-500">
                                  상품 ID: {item.productId || "N/A"} | {(item.price || 0).toLocaleString()}원 × {item.quantity || 1}개
                                </p>
                                <p className="text-xs text-blue-500">이미지 URL: {item.ImageUrl ? '있음' : '없음'}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500">
                        상품 정보가 없습니다.
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-col space-y-2 ml-4">
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleUpdateOrderStatus(order.orderId, "CANCELLED")}
                      disabled={order.paymentStatus === "CANCELLED"}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      주문취소
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="p-6 text-center text-gray-500">
            <div className="space-y-4">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">주문 내역이 없습니다</h3>
                <p className="text-gray-500">아직 주문이 없습니다.</p>
              </div>
            </div>
          </Card>
        )}
        
        {/* 무한스크롤 로딩 UI */}
        {hasMore && (
          <div ref={loadingRef} className="flex justify-center items-center py-8">
            {loadingMore ? (
              <div className="flex items-center space-x-2">
                <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                <span className="text-gray-600">로딩중...</span>
              </div>
            ) : (
              <div className="h-4" /> // 관찰용 빈 요소
            )}
          </div>
        )}
        
        {/* 더 이상 데이터가 없을 때 */}
        {!hasMore && orders.length > 0 && (
          <div className="text-center py-8 text-gray-500">
            모든 주문을 불러왔습니다.
          </div>
        )}
      </div>
    </div>
  )
} 