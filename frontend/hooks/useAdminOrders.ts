import { useState, useEffect } from 'react'
import { AdminOrder } from '@/types/admin'
import axios from 'axios'
import { formatToKST } from '@/lib/utils'
import { getBackendUrl } from "@/lib/api";

export function useAdminOrders() {
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 주문 데이터 페칭
  const fetchOrders = async () => {
    try {
      setLoading(true)
      setError(null)
      
      console.log('주문 데이터 가져오기 시작...')
      
      // 인증 토큰 가져오기
      const accessToken = localStorage.getItem("accessToken")
      const refreshToken = localStorage.getItem("refreshToken")
      
      if (!accessToken) {
        console.error('인증 토큰이 없습니다.')
        throw new Error('인증 토큰이 없습니다.')
      }
      
      const headers = {
        "Authorization": `${accessToken}`,
        "Access_Token": accessToken,
        "Refresh_Token": refreshToken || ''
      }
      
      console.log('요청 헤더:', headers)
      const response = await axios.get(`${getBackendUrl()}/api/orders/admin/all`, { headers })
      console.log('주문 API 응답:', response)
      
      const data: any[] = response.data.data || response.data
      console.log('받은 주문 데이터:', data)
      
      // 백엔드에서 받은 데이터를 프론트엔드 형식으로 변환 (결제 완료된 주문만)
      // 주문 ID별로 그룹화하여 중복 제거
      const orderGroups = new Map()
      
      data
        .filter((order: any) => order.status === 'PAID')
        .forEach((order: any) => {
          const orderId = order.id || order.orderId
          console.log('변환 중인 주문 데이터:', order)
          
          if (!orderGroups.has(orderId)) {
            // 새로운 주문 그룹 생성
            orderGroups.set(orderId, {
              id: orderId,
              userId: order.accountId || order.userId,
              orderDate: order.createdAt || order.orderedAt,
              status: 'completed', // 결제 완료된 주문만 표시하므로 항상 completed
              totalAmount: order.amount, // 백엔드에서는 amount 필드 사용
              items: [],
              // AdminOrder 추가 필드
              orderId: orderId,
              paymentStatus: 'COMPLETED', // 결제 완료된 주문만 표시하므로 항상 COMPLETED
              orderedAt: order.createdAt || order.orderedAt,
            })
          }
          
          // 주문 그룹에 상품 추가
          const orderGroup = orderGroups.get(orderId)
          orderGroup.items.push({
            id: order.id,
            productId: order.productId,
            productName: order.productName,
            price: order.amount,
            quantity: order.quantity,
            orderDate: order.createdAt,
            status: 'completed', // 결제 완료된 주문만 표시하므로 항상 completed
            ImageUrl: order.imageUrl || "/placeholder.svg"
          })
        })
      
      const ordersWithItems: AdminOrder[] = Array.from(orderGroups.values())
      
      // 최신순으로 정렬 (orderedAt 기준 내림차순)
      const sortedOrders = ordersWithItems.sort((a: any, b: any) => {
        const dateA = new Date(a.orderedAt).getTime()
        const dateB = new Date(b.orderedAt).getTime()
        return dateB - dateA // 내림차순 (최신순)
      })
      
      console.log('변환된 주문 데이터:', sortedOrders)
      setOrders(sortedOrders)
    } catch (error) {
      console.error("Error fetching orders:", error)
      if (axios.isAxiosError(error)) {
        console.error('Axios 오류:', error.response?.data)
        console.error('상태 코드:', error.response?.status)
        setError(`주문 데이터를 불러오는데 실패했습니다. (상태 코드: ${error.response?.status || '알 수 없음'})`)
      } else {
        setError('주문 데이터를 불러오는데 실패했습니다.')
      }
    } finally {
      setLoading(false)
    }
  }

  // 주문 상태 업데이트
  const updateOrderStatus = async (orderId: number, status: "PENDING" | "COMPLETED" | "CANCELLED") => {
    try {
      console.log(`주문 상태 변경 요청: 주문ID ${orderId}, 상태 ${status}`)
      
      // 백엔드 상태값으로 변환
      const backendStatus = status === 'COMPLETED' ? 'PAID' : 
                           status === 'PENDING' ? 'CREATED' : 
                           status === 'CANCELLED' ? 'CANCELED' : 'CREATED'
      
      const response = await axios.patch(`${getBackendUrl()}/api/orders/${orderId}/status?status=${backendStatus}`)
      console.log('업데이트된 주문:', response.data)
      
      // 현재 주문 목록에서 해당 주문만 업데이트
      setOrders(prev => prev.map(order => 
        order.orderId === orderId 
          ? { ...order, paymentStatus: status }
          : order
      ))
      
      // 마이페이지의 주문 내역도 업데이트하기 위해 전역 이벤트 발생
      window.dispatchEvent(new CustomEvent('orderStatusUpdated', {
        detail: { orderId, status }
      }))
      
      return true
    } catch (error) {
      console.error('주문 상태 업데이트 오류:', error)
      const errorMessage = axios.isAxiosError(error) && error.response?.data?.error 
        ? error.response.data.error 
        : '주문 상태 업데이트에 실패했습니다.'
      throw new Error(errorMessage)
    }
  }

  // 주문 상세보기
  const viewOrderDetails = (order: AdminOrder) => {
    console.log('주문 상세보기:', order)
    return order
  }

  // 컴포넌트 마운트 시 데이터 페칭
  useEffect(() => {
    fetchOrders()
  }, [])

  return {
    orders,
    loading,
    error,
    fetchOrders,
    updateOrderStatus,
    viewOrderDetails,
    formatToKST,
    refetch: fetchOrders
  }
} 