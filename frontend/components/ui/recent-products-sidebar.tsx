"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Clock, X, Eye, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { recentApi } from "@/lib/api"

interface RecentProduct {
  id: number
  productId: number
  naverProductId?: string // 네이버 상품용
  productType: string
  company?: string
  productName: string
  name?: string
  title?: string
  description: string
  logoUrl?: string
  imageUrl?: string
  price?: number
  viewedAt: string
}

interface RecentProductsSidebarProps {
  productType: "insurance" | "store"
  isOpen: boolean
  onToggle: () => void
  refreshTrigger?: number // 실시간 업데이트를 위한 트리거
}

export function RecentProductsSidebar({ 
  productType, 
  isOpen, 
  onToggle,
  refreshTrigger = 0
}: RecentProductsSidebarProps) {
  const router = useRouter()
  const [recentProducts, setRecentProducts] = useState<RecentProduct[]>([])
  const [loading, setLoading] = useState(false)
  const [displayCount, setDisplayCount] = useState(5) // 표시할 상품 개수

  // 로그인 상태 확인 (간단한 방식)
  const isLoggedIn = typeof window !== 'undefined' && localStorage.getItem('accessToken')

  // 최근 본 상품 로드
  const loadRecentProducts = async () => {
    if (!isLoggedIn) {
      // 비로그인 시: localStorage에서 로드
      const localProducts = getLocalRecentProducts(productType)
      setRecentProducts(localProducts)
      return
    }

    try {
      setLoading(true)
      const data = await recentApi.getRecentProducts(productType)
      setRecentProducts(data)
    } catch (error) {
      console.error("최근 본 상품 로드 실패:", error)
      // API 실패 시 localStorage에서 로드
      const localProducts = getLocalRecentProducts(productType)
      setRecentProducts(localProducts)
    } finally {
      setLoading(false)
    }
  }

  // 최근 본 상품 삭제
  const handleRemoveProduct = async (productId: number) => {
    const updatedProducts = recentProducts.filter(p => (p.productId || p.id) !== productId)
    setRecentProducts(updatedProducts)

    if (isLoggedIn) {
      // 로그인 시: DB에서 삭제 (개별 삭제는 API가 없으므로 전체 삭제 후 다시 추가)
      try {
        await recentApi.clearRecent(productType)
        // 남은 상품들을 다시 추가
        for (const product of updatedProducts) {
          const productId = product.productId || product.id
          await recentApi.addToRecent(productId, productType)
        }
      } catch (error) {
        console.error("최근 본 상품 삭제 실패:", error)
        // API 실패 시 localStorage에서도 삭제
        removeFromLocalRecentProducts(productId, productType)
      }
    } else {
      // 비로그인 시: localStorage에서 삭제
      removeFromLocalRecentProducts(productId, productType)
    }
  }

  // 최근 본 상품 전체 삭제
  const handleClearAll = async () => {
    setRecentProducts([])

    if (isLoggedIn) {
      try {
        await recentApi.clearRecent(productType)
      } catch (error) {
        console.error("최근 본 상품 전체 삭제 실패:", error)
      }
    } else {
      clearLocalRecentProducts(productType)
    }
  }

  // 더보기 버튼 클릭 시
  const handleLoadMore = () => {
    setDisplayCount(prev => prev + 5)
  }

  // 표시할 상품들 (최대 displayCount개)
  const displayedProducts = recentProducts.slice(0, displayCount)
  const hasMore = recentProducts.length > displayCount
  
  // 디버깅용 로그
  console.log('RecentProductsSidebar Debug:', {
    totalProducts: recentProducts.length,
    displayCount,
    displayedProducts: displayedProducts.length,
    hasMore
  })

  // 상품 클릭 시 상세 페이지로 이동
  const handleProductClick = (product: RecentProduct) => {
    if (productType === "insurance") {
      const productId = product.productId || product.id
      router.push(`/insurance/${productId}`)
    } else {
      // store 타입의 경우 네이버 상품인지 확인
      if (product.naverProductId) {
        // 네이버 상품인 경우 naverProductId 사용
        router.push(`/store/${product.naverProductId}`)
      } else {
        // 일반 상품인 경우 productId 사용
        const productId = product.productId || product.id
        router.push(`/store/${productId}`)
      }
    }
  }

  // localStorage 관련 함수들
  const getLocalRecentProducts = (type: string): RecentProduct[] => {
    try {
      const key = type === "insurance" ? "recentInsuranceProducts" : "recentStoreProducts"
      const stored = localStorage.getItem(key)
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  }

  const removeFromLocalRecentProducts = (productId: number, type: string) => {
    try {
      const key = type === "insurance" ? "recentInsuranceProducts" : "recentStoreProducts"
      const products = getLocalRecentProducts(type)
      const filtered = products.filter(p => (p.productId || p.id) !== productId)
      localStorage.setItem(key, JSON.stringify(filtered))
    } catch (error) {
      console.error("localStorage 삭제 실패:", error)
    }
  }

  const clearLocalRecentProducts = (type: string) => {
    try {
      const key = type === "insurance" ? "recentInsuranceProducts" : "recentStoreProducts"
      localStorage.removeItem(key)
    } catch (error) {
      console.error("localStorage 전체 삭제 실패:", error)
    }
  }

  // 실시간 업데이트를 위한 이벤트 리스너
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === (productType === "insurance" ? "recentInsuranceProducts" : "recentStoreProducts")) {
        loadRecentProducts()
      }
    }

    // localStorage 변경 감지
    window.addEventListener('storage', handleStorageChange)

    // 주기적 업데이트 (5초마다)
    const interval = setInterval(() => {
      if (isOpen) {
        loadRecentProducts()
      }
    }, 5000)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      clearInterval(interval)
    }
  }, [productType, isOpen])

  // 초기 로드 및 refreshTrigger 변경 시 업데이트
  useEffect(() => {
    loadRecentProducts()
  }, [productType, refreshTrigger])

  if (!isOpen) return null

  return (
    <div className="fixed right-0 top-16 h-[calc(100vh-4rem)] w-72 bg-white border-l border-gray-200 shadow-lg z-50 overflow-y-auto">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-lg">
              최근 본 {productType === "insurance" ? "보험" : "상품"}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {recentProducts.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearAll}
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggle}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : recentProducts.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Clock className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>최근 본 {productType === "insurance" ? "보험" : "상품"}이 없습니다</p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayedProducts.map((product) => (
              <Card 
                key={product.id} 
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleProductClick(product)}
              >
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    {productType === "store" && (
                      <div className="relative w-12 h-12 flex-shrink-0">
                        <Image
                          src={product.logoUrl || product.imageUrl || "/placeholder.svg"}
                          alt={product.productName}
                          fill
                          className="object-cover rounded"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement
                            target.src = "/placeholder.svg"
                          }}
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm truncate">
                            {product.productName || product.name || product.title}
                          </h4>
                          {product.company && (
                            <p className="text-xs text-gray-500 truncate">
                              {product.company}
                            </p>
                          )}
                          {product.price && (
                            <p className="text-sm font-semibold text-blue-600">
                              {product.price.toLocaleString()}원
                            </p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            const productId = product.productId || product.id
                            handleRemoveProduct(productId)
                          }}
                          className="text-gray-400 hover:text-red-500 p-1"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            
            {/* 더보기 버튼 */}
            {hasMore && (
              <Button
                onClick={handleLoadMore}
                variant="outline"
                size="sm"
                className="w-full mt-3 text-blue-600 hover:text-blue-700 border-blue-200 hover:border-blue-300"
              >
                더보기 ({recentProducts.length - displayCount}개 더)
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
} 