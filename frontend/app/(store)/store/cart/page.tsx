"use client"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Trash2, ArrowLeft } from "lucide-react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import axios from "axios"
import PaymentPage from "../../payment/PaymentPage"
import { getBackendUrl } from "@/lib/api";

interface CartItem {
  id: number | string
  name: string
  brand: string
  price: number
  image: string
  category: string
  quantity: number

  order: number // 순서 고정을 위한 필드
  isNaverProduct?: boolean // 네이버 상품 여부
  naverProduct?: {
    id: number
    title: string
    price: number
    imageUrl: string
    mallName: string
    brand: string
    maker: string
    category1: string
  }

  naverProductInfo?: {
    title: string
    price: number
    imageUrl: string
    mallName: string
    brand: string
    maker: string
    category1: string
  }

  product?: {
    id: number
    name: string
    description: string
    price: number
    stock: number
    imageUrl: string
    category: string
    registrationDate: string
    registeredBy: string
  }
}

export default function CartPage() {
  const router = useRouter()
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showPayment, setShowPayment] = useState(false)
  const [paymentItems, setPaymentItems] = useState<CartItem[]>([])

  // 장바구니 데이터 가져오기
  const fetchCartItems = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem("accessToken")
      
      let cartData: any[] = []
      
      if (token) {
        try {
          const response = await axios.get(`${getBackendUrl()}/api/carts`, {
            headers: { "Access_Token": token },
            timeout: 5000,
          })

          if (response.status === 200) {
            // 백엔드에서 List<CartDto>를 직접 반환하므로 response.data가 바로 배열
            cartData = Array.isArray(response.data) ? response.data : []
          }
        } catch (error) {
          console.log("백엔드 장바구니 조회 실패, 로컬 스토리지만 사용")
        }
      }

      // 로컬 스토리지의 네이버 상품 가져오기
      const naverCartData = JSON.parse(localStorage.getItem('naverCart') || '[]')
      const naverItems = naverCartData.map((item: any, index: number) => ({
        id: `naver-${index}`,
        productId: item.id,
        quantity: item.quantity,
        isNaverProduct: true,
        order: index, // 로컬 네이버 상품은 인덱스를 order로 사용
        naverProductInfo: {
          title: item.name,
          price: item.price,
          imageUrl: item.imageUrl,
          mallName: item.mallName,
          brand: item.brand,
          maker: item.maker,
          category1: item.category
        }
      }))



      // 백엔드에서 가져온 네이버 상품 처리
      const backendNaverItems = cartData
        .filter((item: any) => item.naverProduct)
        .map((item: any, index: number) => {
          const cartId = `backend-naver-${item.id}`;
          return {
            id: cartId,
            productId: item.naverProduct.id,
            quantity: item.quantity,
            isNaverProduct: true,
            naverProduct: item.naverProduct, // 원본 naverProduct 객체 보존
            naverProductInfo: {
              title: item.naverProduct.title || '네이버 상품',
              price: item.naverProduct.price || 0,
              imageUrl: item.naverProduct.imageUrl || "/placeholder.svg",
              mallName: item.naverProduct.mallName || '',
              brand: item.naverProduct.brand || "브랜드 없음",
              maker: item.naverProduct.maker || '',
              category1: item.naverProduct.category1 || "네이버 쇼핑"
            },
            order: typeof item.id === 'number' ? item.id : parseInt(item.id.toString()) || 0, // Cart ID를 order로 사용하여 위치 고정
            cartId: item.id // 원본 Cart ID 보존
          };
        });

      // 백엔드에서 가져온 일반 상품 처리
      const backendRegularItems = cartData.filter((item: any) => item.product && !item.naverProduct);

      // 백엔드 일반 상품을 CartItem 형태로 변환
      const backendRegularCartItems = backendRegularItems.map((item: any, index: number) => {
        return {
          id: item.id,
          name: item.product.name,
          brand: "브랜드 없음",
          price: item.product.price,
          image: item.product.imageUrl || "/placeholder.svg",
          category: item.product.category || "카테고리 없음",
          quantity: item.quantity,
          order: typeof item.id === 'number' ? item.id : parseInt(item.id.toString()) || 0, // Cart ID를 order로 사용하여 위치 고정
          isNaverProduct: false,
          product: {
            id: item.product.id,
            name: item.product.name,
            description: item.product.description || '',
            price: item.product.price,
            stock: item.product.stock || 0,
            imageUrl: item.product.imageUrl || '/placeholder.svg',
            category: item.product.category || '카테고리 없음',
            registrationDate: item.product.registrationDate || '',
            registeredBy: item.product.registeredBy || '',
          }
        };
      });



      // 백엔드 장바구니와 네이버 장바구니 합치기
      const allCartData = [...backendRegularCartItems, ...backendNaverItems, ...naverItems]
      
      // 유효하지 않은 데이터 필터링
      const validCartData = allCartData.filter((item: any) => {
        if (item.isNaverProduct || (item.naverProductInfo && Object.keys(item.naverProductInfo).length > 0)) {
          return true // 네이버 상품은 항상 유효
        }
        return item.product && item.product.name // 일반 상품은 product와 name이 있어야 유효
      })
      
      const items: CartItem[] = validCartData
        .sort((a: any, b: any) => {
          // order 필드를 기준으로 정렬하여 일관된 순서 유지
          const orderA = typeof a.order === 'number' ? a.order : parseInt(a.order?.toString()) || 0;
          const orderB = typeof b.order === 'number' ? b.order : parseInt(b.order?.toString()) || 0;
          return orderA - orderB;
        })
        .map((item: any, index: number) => {
          // 네이버 상품인지 확인
          const isNaverProduct = item.isNaverProduct || (item.naverProductInfo && Object.keys(item.naverProductInfo).length > 0)
          
          if (isNaverProduct && item.naverProductInfo) {
            // 네이버 상품 처리
            return {
              id: item.id,
              name: item.naverProductInfo.title || item.naverProductInfo.name || '네이버 상품',
              brand: item.naverProductInfo.brand || "브랜드 없음",
              price: item.naverProductInfo.price,
              image: item.naverProductInfo.imageUrl || "/placeholder.svg",
              category: item.naverProductInfo.category1 || "네이버 쇼핑",
              quantity: item.quantity,
              order: index,
              isNaverProduct: true,
              product: {
                id: item.productId || item.id,
                name: item.naverProductInfo.title || item.naverProductInfo.name || '네이버 상품',
                description: item.naverProductInfo.title || '',
                price: item.naverProductInfo.price,
                stock: 999,
                imageUrl: item.naverProductInfo.imageUrl || "/placeholder.svg",
                category: item.naverProductInfo.category1 || "네이버 쇼핑",
                registrationDate: '',
                registeredBy: '',
              },
            }
          } else {
            // 일반 상품 처리 - product가 null인 경우 더 안전하게 처리
            const product = item.product || {}
            const safeProduct = {
              id: product.id || item.id || 0,
              name: product.name || '상품명 없음',
              description: product.description || '',
              price: product.price || 0,
              stock: product.stock || 0,
              imageUrl: product.imageUrl || '/placeholder.svg',
              category: product.category || '카테고리 없음',
              registrationDate: product.registrationDate || '',
              registeredBy: product.registeredBy || '',
            }
            
            return {
              id: item.id,
              name: safeProduct.name,
              brand: "브랜드 없음",
              price: safeProduct.price,
              image: safeProduct.imageUrl,
              category: safeProduct.category,
              quantity: item.quantity || 1,
              order: index,
              product: safeProduct,
            }
          }
        })

      setCartItems(items)
    } catch (error: any) {
      console.error("장바구니 조회 오류:", error)
      setCartItems([])
    } finally {
      setLoading(false)
    }
  }

  // 장바구니에서 상품 제거
  const onRemoveFromCart = async (cartId: number | string) => {
    try {
      // 백엔드 네이버 상품인지 확인
      if (typeof cartId === 'string' && cartId.startsWith('backend-naver-')) {
        // 백엔드 네이버 상품은 백엔드에서 삭제
        const actualCartId = cartId.replace('backend-naver-', '')
        const accessToken = localStorage.getItem("accessToken")
        if (!accessToken) {
          alert("로그인이 필요합니다")
          return
        }

        const response = await axios.delete(`${getBackendUrl()}/api/carts/${actualCartId}`, {
          headers: { "Access_Token": accessToken }
        })
        
        if (response.status === 200) {
          await fetchCartItems()
          alert("장바구니에서 상품을 삭제했습니다")
        } else {
          throw new Error("장바구니에서 삭제에 실패했습니다.")
        }
        return
      }

      // 로컬 네이버 상품인지 확인 (ID가 문자열로 시작하는 경우)
      if (typeof cartId === 'string' && cartId.startsWith('naver-')) {
        // 네이버 상품은 로컬 스토리지에서 삭제
        const naverCartData = JSON.parse(localStorage.getItem('naverCart') || '[]')
        const index = parseInt(cartId.replace('naver-', ''))
        naverCartData.splice(index, 1)
        localStorage.setItem('naverCart', JSON.stringify(naverCartData))
        await fetchCartItems()
        alert("장바구니에서 상품을 삭제했습니다")
        return
      }

      // 일반 상품은 백엔드에서 삭제
      const accessToken = localStorage.getItem("accessToken")
      if (!accessToken) {
        alert("로그인이 필요합니다")
        return
      }

      const response = await axios.delete(`${getBackendUrl()}/api/carts/${cartId}`, 
      {
        headers: { "Access_Token": accessToken }
      })
      
      if (response.status === 200) {
        await fetchCartItems()
        alert("장바구니에서 상품을 삭제했습니다")
      } else {
        throw new Error("장바구니에서 삭제에 실패했습니다.")
      }
    } catch (error: any) {
      console.error("장바구니 삭제 오류:", error)
      alert("장바구니에서 삭제에 실패했습니다")
    }
  }

  // 수량 업데이트
  const onUpdateQuantity = async (cartId: number | string, quantity: number) => {
    try {
      // 백엔드 네이버 상품인지 확인
      if (typeof cartId === 'string' && cartId.startsWith('backend-naver-')) {
        const actualCartId = cartId.replace('backend-naver-', '')
        
        const accessToken = localStorage.getItem("accessToken")
        if (!accessToken) {
          alert("로그인이 필요합니다")
          return
        }

        const response = await axios.put(`${getBackendUrl()}/api/carts/${actualCartId}?quantity=${quantity}`, null, {
          headers: { "Access_Token": accessToken }
        })
        
        if (response.status === 200) {
          await fetchCartItems()
        } else {
          throw new Error("수량 업데이트에 실패했습니다.")
        }
        return
      }

      // 로컬 네이버 상품인지 확인 (ID가 문자열로 시작하는 경우)
      if (typeof cartId === 'string' && cartId.startsWith('naver-')) {
        const naverCartData = JSON.parse(localStorage.getItem('naverCart') || '[]')
        const index = parseInt(cartId.replace('naver-', ''))
        
                  if (naverCartData[index]) {
            naverCartData[index].quantity = quantity
            localStorage.setItem('naverCart', JSON.stringify(naverCartData))
            await fetchCartItems()
          } else {
            alert("상품을 찾을 수 없습니다")
          }
        return
      }

      // 일반 상품은 백엔드에서 수량 업데이트
      const accessToken = localStorage.getItem("accessToken")
      if (!accessToken) {
        alert("로그인이 필요합니다")
        return
      }

      const response = await axios.put(`${getBackendUrl()}/api/carts/${cartId}?quantity=${quantity}`, null, {
        headers: { "Access_Token": accessToken }
      })
      
      if (response.status === 200) {
        await fetchCartItems()
      } else {
        throw new Error("수량 업데이트에 실패했습니다.")
      }
    } catch (error: any) {
      console.error("수량 업데이트 오류:", error)
      if (error.response?.data?.message) {
        alert(`수량 업데이트에 실패했습니다: ${error.response.data.message}`)
      } else {
        alert("수량 업데이트에 실패했습니다")
      }
    }
  }

  // 전체 구매
  const onPurchaseAll = async (items: CartItem[]) => {
    try {
      
      const accessToken = localStorage.getItem("accessToken")
      if (!accessToken) {
        alert("로그인이 필요합니다")
        return
      }

      // 현재 사용자 정보 가져오기
      let currentUserId: number
      try {
        const userResponse = await axios.get(`${getBackendUrl()}/api/accounts/me`, {
          headers: { "Access_Token": accessToken }
        })
        currentUserId = userResponse.data.data.id
      } catch (error) {
        console.error("사용자 정보 가져오기 실패:", error)
        alert("사용자 정보를 가져올 수 없습니다")
        return
      }

      // 모든 상품을 배열로 준비
      const orderItems = items.map(item => {
        if (item.isNaverProduct || 
            item.id.toString().startsWith('naver-') || 
            item.id.toString().startsWith('backend-naver-')) {
          // 네이버 상품
          let naverProductId: number;
          if (item.naverProduct && item.naverProduct.id) {
            naverProductId = Number(item.naverProduct.id);
          } else if (item.product && item.product.id) {
            naverProductId = Number(item.product.id);
          } else {
            naverProductId = Number(item.id);
          }
          
          return {
            type: 'naver',
            naverProductId: naverProductId,
            quantity: item.quantity,
            name: item.name
          };
        } else {
          // 일반 상품
          return {
            type: 'regular',
            productId: item.product?.id || item.id,
            quantity: item.quantity,
            name: item.name
          };
        }
      });

      // 모든 상품을 한 번에 전송
      const orderData = {
        accountId: currentUserId,
        items: orderItems
      };

      const response = await axios.post(`${getBackendUrl()}/api/orders/bulk-all`, orderData, {
        headers: { "Access_Token": accessToken }
      });

      if (response.data && response.data.success) {
        // 장바구니 비우기
        for (const item of items) {
          await onRemoveFromCart(item.id)
        }

        alert(`전체 구매가 완료되었습니다. (${orderItems.length}개 상품)`)
        router.push("/my")
      } else {
        throw new Error("주문 처리에 실패했습니다")
      }
    } catch (error: any) {
      console.error("전체 구매 오류:", error)
      alert("전체 구매에 실패했습니다")
    }
  }

  // 개별 구매
  const onPurchaseSingle = async (item: CartItem) => {
    try {
      const accessToken = localStorage.getItem("accessToken")
      if (!accessToken) {
        alert("로그인이 필요합니다")
        return
      }

      const orderData = {
        accountId: 1, // TODO: 실제 사용자 ID 가져오기
        productId: item.product?.id || item.id,
        quantity: item.quantity,
      }

      const response = await axios.post(`${getBackendUrl()}/api/orders`, orderData, {
        headers: { "Access_Token": accessToken }
      })

      if (response.status === 200) {
        await onRemoveFromCart(item.id)
        alert("개별 구매가 완료되었습니다")
        router.push("/my")
      } else {
        throw new Error("개별 구매에 실패했습니다.")
      }
    } catch (error: any) {
      console.error("개별 구매 오류:", error)
      alert("개별 구매에 실패했습니다")
    }
  }

  // 페이지 로드 시 장바구니 데이터 가져오기
  useEffect(() => {
    fetchCartItems()
    
    // 결제 완료 후 장바구니 새로고침을 위한 이벤트 리스너
    const handleCartUpdate = () => {
      fetchCartItems()
    }
    
    window.addEventListener('cartUpdated', handleCartUpdate)
    
    return () => {
      window.removeEventListener('cartUpdated', handleCartUpdate)
    }
  }, [])



  const handlePurchaseAll = () => {
    setPaymentItems(cartItems)
    setShowPayment(true)
  }

  const handlePurchaseItem = (item: CartItem) => {
    setPaymentItems([item])
    setShowPayment(true)
  }

  const handlePaymentSuccess = async (paymentInfo: any) => {
    
    try {
      // 결제 성공 후 나머지 상품들을 모두 주문
      const remainingItems = cartItems.filter(item => 
        !paymentItems.some(paymentItem => 
          paymentItem.id === item.id || 
          (paymentItem.product?.id && paymentItem.product.id === item.product?.id)
        )
      );
      
      if (remainingItems.length > 0) {
        // onPurchaseAll 함수를 호출하여 나머지 상품들 주문
        await onPurchaseAll(remainingItems);
      }
      
      // 결제된 상품 장바구니에서 제거
      paymentItems.forEach(item => onRemoveFromCart(item.id))
      
      setShowPayment(false)
      setPaymentItems([])
      
      // 성공 페이지로 이동하거나 알림
      alert("전체 구매가 완료되었습니다!")
      router.push("/my")
      
    } catch (error) {
      console.error("나머지 상품 주문 실패:", error)
      alert("일부 상품 주문에 실패했습니다. 장바구니를 확인해주세요.")
    }
  }

  const handlePaymentFail = (error: any) => {
    console.log("결제 실패:", error)
    setShowPayment(false)
    setPaymentItems([])
  }

  const handleBackFromPayment = () => {
    setShowPayment(false)
    setPaymentItems([])
  }

        // PaymentPage가 표시되어야 하는 경우
      if (showPayment) {
        return (
          <PaymentPage
            items={paymentItems.map(item => ({
              id: typeof item.product?.id === 'number' ? item.product.id : 
                   typeof item.id === 'number' ? item.id : 
                   parseInt(item.id.toString()) || 0, // 문자열 ID를 숫자로 변환
              name: item.name.replace(/<[^>]*>/g, ''), // HTML 태그 제거
              price: item.price,
              quantity: item.quantity,
              image: item.image,

              isNaverProduct: item.isNaverProduct || false
            }))}
            onSuccess={handlePaymentSuccess}
            onFail={handlePaymentFail}
            onBack={handleBackFromPayment}
          />
        )
      }

  // 로딩 중
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400 mx-auto mb-4"></div>
          <p className="text-gray-600">장바구니를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">장바구니</h1>
          <p className="text-gray-600">구매할 상품들을 확인해보세요</p>
        </div>

        {!cartItems || cartItems.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
              <div className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">장바구니가 비어있습니다</h3>
            <p className="text-gray-600 mb-6">마음에 드는 상품을 장바구니에 담아보세요!</p>
            <Button onClick={() => router.push("/store")} className="bg-yellow-400 hover:bg-yellow-500 text-black">
              쇼핑하러 가기
            </Button>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center mb-6">
              <div>
                <p className="text-gray-600">총 {cartItems?.length || 0}개의 상품</p>
                <p className="text-lg font-bold text-yellow-600">
                  총 가격: {(cartItems?.reduce((total, item) => total + (item.price * item.quantity), 0) || 0).toLocaleString()}원
                </p>
              </div>
              <div className="flex space-x-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={async () => {
                    if (window.confirm('장바구니의 모든 상품을 삭제하시겠습니까?')) {
                      try {
                        const accessToken = localStorage.getItem("accessToken")
                        if (!accessToken) {
                          alert("로그인이 필요합니다")
                          return
                        }

                        // 백엔드 상품들 삭제
                        const backendItems = cartItems?.filter(item => 
                          typeof item.id === 'number' || 
                          (typeof item.id === 'string' && (item.id as string).startsWith('backend-naver-'))
                        ) || []

                        // 백엔드 상품들 삭제
                        for (const item of backendItems) {
                          let cartId: string | number
                          if (typeof item.id === 'string' && (item.id as string).startsWith('backend-naver-')) {
                            cartId = (item.id as string).replace('backend-naver-', '')
                          } else {
                            cartId = item.id
                          }
                          
                          await axios.delete(`${getBackendUrl()}/api/carts/${cartId}`, {
                            headers: { "Access_Token": accessToken }
                          })
                        }

                        // 로컬 네이버 상품들 삭제
                        const localNaverItems = cartItems?.filter(item => 
                          typeof item.id === 'string' && (item.id as string).startsWith('naver-')
                        ) || []

                        if (localNaverItems.length > 0) {
                          const naverCartData = JSON.parse(localStorage.getItem('naverCart') || '[]')
                          // 로컬 네이버 상품들을 역순으로 삭제 (인덱스 변화 방지)
                          const indicesToRemove = localNaverItems
                            .map(item => {
                              const idStr = item.id.toString()
                              return parseInt(idStr.replace('naver-', ''))
                            })
                            .sort((a, b) => b - a)
                          
                          indicesToRemove.forEach(index => {
                            naverCartData.splice(index, 1)
                          })
                          
                          localStorage.setItem('naverCart', JSON.stringify(naverCartData))
                        }

                        // 장바구니 새로고침
                        await fetchCartItems()
                        
                        // 한 번만 알림 표시
                        alert("장바구니의 모든 상품을 삭제했습니다")
                      } catch (error: any) {
                        console.error("전체 삭제 오류:", error)
                        alert("전체 삭제에 실패했습니다")
                      }
                    }
                  }}
                >
                  전체 삭제
                </Button>
                <Button onClick={handlePurchaseAll} className="bg-yellow-400 hover:bg-yellow-500 text-black" size="sm">
                  전체 구매하기
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {cartItems?.sort((a, b) => a.order - b.order).map((item, index) => (
                <Card key={`${item.id}-${index}`} className="overflow-hidden hover:shadow-lg transition-shadow">
                  <div className="relative">
                    <Image
                      src={item.image || "/placeholder.svg"}
                      alt={item.name}
                      width={200}
                      height={200}
                      className="w-full h-48 object-cover"
                    />
                  </div>
                  <CardContent className="p-4">
                    <p className="text-xs text-gray-500 mb-1">{item.brand}</p>
                    <h3 className="font-medium text-sm mb-2 line-clamp-2 h-10">{item.name.replace(/<[^>]*>/g, '')}</h3>
                    <div className="mb-3">
                      <p className="text-sm text-gray-500">단가: {item.price.toLocaleString()}원</p>
                      <p className="font-bold text-lg text-yellow-600">
                        {(item.price * item.quantity).toLocaleString()}원
                      </p>
                    </div>
                    
                    {/* 수량 조절 */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm text-gray-600">수량:</span>
                      <div className="flex items-center space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            onUpdateQuantity(item.id, Math.max(1, item.quantity - 1))
                          }}
                          className="w-8 h-8 p-0"
                        >
                          -
                        </Button>
                        <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const stock = item.product?.stock || 0
                            if (item.quantity >= stock) {
                              alert(`재고가 부족합니다. (재고: ${stock}개, 현재: ${item.quantity}개)`)
                              return
                            }
                            onUpdateQuantity(item.id, item.quantity + 1)
                          }}
                          disabled={item.quantity >= (item.product?.stock || 0)}
                          className="w-8 h-8 p-0"
                        >
                          +
                        </Button>
                      </div>
                    </div>
                    {/* 재고 정보 표시 */}
                    {item.product?.stock && (
                      <div className="text-xs text-gray-500 mb-2">
                        재고: {item.product.stock}개
                        {item.quantity >= item.product.stock && (
                          <span className="text-red-500 ml-2">최대 재고 수량입니다</span>
                        )}
                      </div>
                    )}
                    
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        className="flex-1 bg-yellow-400 hover:bg-yellow-500 text-black"
                        onClick={() => handlePurchaseItem(item)}
                      >
                        구매하기
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onRemoveFromCart(item.id)}
                        className="px-3"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}