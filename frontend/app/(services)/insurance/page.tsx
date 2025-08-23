"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { ChevronDown, ChevronUp, Clock, Eye } from "lucide-react"
import { insuranceApi, recentApi } from "@/lib/api"
import { RecentProductsSidebar } from "@/components/ui/recent-products-sidebar"

interface InsuranceProduct {
  id: number
  company: string
  productName: string
  description: string
  features: string[]
  logo: string
  redirectUrl?: string
}

interface PetInsurancePageProps {
  onViewDetails?: (product: InsuranceProduct) => void
}

const insuranceOptions = [
  "삼성화재 펫보험 기본형",
  "삼성화재 펫보험 고급형",
  "한화손해보험 LIFEPLUS 댕댕이보험 기본형",
  "현대해상 하이펫보험 스탠다드",
  "현대해상 하이펫보험 프리미엄",
  "DB손해보험 프로미라이프",
]

const coverageOptions = [
  { id: "patella", name: "슬개골 수술" },
  { id: "skin", name: "피부 질환" },
  { id: "oral", name: "구강 질환" },
  { id: "respiratory", name: "호흡기 질환" },
]

export default function PetInsurancePage({
  onViewDetails,
}: PetInsurancePageProps) {
  const [activeTab, setActiveTab] = useState<"find" | "compare">("find")
  const [selectedInsurance, setSelectedInsurance] = useState("")
  const [selectedCoverages, setSelectedCoverages] = useState<string[]>([])
  const [showInsuranceDropdown, setShowInsuranceDropdown] = useState(false)
  const [showCoverageDropdown, setShowCoverageDropdown] = useState(false)
  const [selectedPetType, setSelectedPetType] = useState<"dog" | "cat">("dog")

  // 백엔드 보험 상품 목록 연동
  const [products, setProducts] = useState<InsuranceProduct[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  // 최근 본 상품 사이드바
  const [showRecentSidebar, setShowRecentSidebar] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  // 로그인 상태 확인 (간단한 방식)
  const isLoggedIn = typeof window !== 'undefined' && localStorage.getItem('accessToken')

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        const data = await insuranceApi.getProducts()
        const mapped: InsuranceProduct[] = (data || []).map((d: any) => ({
          id: d.id,
          company: d.company,
          productName: d.productName,
          description: d.description,
          features: d.features || [],
          logo: d.logoUrl || "/placeholder.svg?height=40&width=40",
          redirectUrl: d.redirectUrl,
        }))
        setProducts(mapped)
      } catch (e) {
        setError("보험 상품을 불러오지 못했습니다.")
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const handleCoverageChange = (coverageId: string, checked: boolean) => {
    if (checked) {
      setSelectedCoverages((prev) => [...prev, coverageId])
    } else {
      setSelectedCoverages((prev) => prev.filter((id) => id !== coverageId))
    }
  }

  const handleViewDetails = async (product: InsuranceProduct) => {
    // 로그인 시: DB에 저장
    if (isLoggedIn) {
      try {
        await recentApi.addToRecent(product.id, "insurance")
      } catch (error) {
        console.error("최근 본 상품 저장 실패:", error)
      }
    } else {
      // 비로그인 시: localStorage에 저장
      addToLocalRecentProducts(product)
    }
    
    // 사이드바가 열려있으면 업데이트
    if (showRecentSidebar) {
      setRefreshTrigger(prev => prev + 1)
    }
    
    // 상세 페이지로 이동
    window.location.href = `/insurance/${product.id}`
  }

  // localStorage 관련 함수들
  const getLocalRecentProducts = (): any[] => {
    try {
      const stored = localStorage.getItem('recentInsuranceProducts')
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  }

  const addToLocalRecentProducts = (product: InsuranceProduct) => {
    try {
      const products = getLocalRecentProducts()
      const existingIndex = products.findIndex(p => p.id === product.id)
      
      if (existingIndex > -1) {
        // 기존 항목 제거
        products.splice(existingIndex, 1)
      }
      
      // 필요한 정보만 추출하여 저장
      const simplifiedProduct = {
        id: product.id,
        name: product.productName,
        company: product.company,
        logoUrl: product.logo,
        type: 'insurance'
      }
      
      // 새 항목을 맨 앞에 추가
      products.unshift(simplifiedProduct)
      
      // 최대 5개만 유지
      if (products.length > 5) {
        products.splice(5)
      }
      
      localStorage.setItem('recentInsuranceProducts', JSON.stringify(products))
    } catch (error) {
      console.error("localStorage 저장 실패:", error)
    }
  }

  const clearLocalRecentProducts = () => {
    try {
      localStorage.removeItem('recentInsuranceProducts')
    } catch (error) {
      console.error("localStorage 삭제 실패:", error)
    }
  }

  // 회사별 이모지 반환 함수
  const getCompanyEmoji = (companyName: string): string => {
    switch (companyName) {
      case "삼성화재":
        return "⭐"
      case "메리츠화재":
        return "🏢"
      case "KB손해보험":
        return "🏦"
      case "현대해상":
        return "🚗"
      case "NH농협손해보험":
        return "🌾"
      default:
        return "🏢"
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-yellow-100 to-yellow-50 pt-20">
      <div className="container mx-auto px-4 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">반려동물 보험</h1>
          <p className="text-gray-600">반려동물을 위한 맞춤형 보험 상품을 찾아보세요</p>
        </div>

        {/* Top Header */}
        <div className="text-center mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">다양한 보험사의 펫보험을 알아보아요!</h2>

          <p className="text-gray-600 mb-8">원하는 3개 업체를 선택하여 가격을 비교해보세요.</p>
        </div>

        {/* Insurance Products Grid */}
        {loading ? (
          <div className="text-center text-gray-600">불러오는 중...</div>
        ) : error ? (
          <div className="text-center text-red-500">{error}</div>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => (
            <Card key={product.id} className="bg-white shadow-lg hover:shadow-xl transition-shadow h-full">
              <CardContent className="p-6 flex flex-col h-full">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <div className="flex-shrink-0">
                      <Image
                        src={product.logo || "/placeholder.svg"}
                        alt={product.company}
                        width={40}
                        height={40}
                        className="rounded object-contain bg-white"
                        onError={(e) => {
                          // 로고 로딩 실패 시 기본 아이콘 표시
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const parent = target.parentElement;
                          if (parent) {
                            const fallback = document.createElement('div');
                            fallback.className = 'w-10 h-10 bg-gray-100 rounded flex items-center justify-center text-lg';
                            fallback.textContent = getCompanyEmoji(product.company);
                            parent.appendChild(fallback);
                          }
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-lg text-gray-900 truncate">{product.company}</h3>
                      <p className="text-sm text-gray-600 truncate">{product.productName}</p>
                    </div>
                  </div>
                </div>

                <p className="text-gray-700 mb-4 flex-1">{product.description}</p>

                {product.features && product.features.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-medium text-sm text-gray-900 mb-2">주요 특징:</h4>
                    <div className="space-y-1">
                      {product.features.slice(0, 3).map((feature, index) => (
                        <div key={index} className="flex items-center text-sm text-gray-600">
                          <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-2"></div>
                          {feature}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-auto">
                  <Button
                    onClick={() => handleViewDetails(product)}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    자세히 보기
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        )}

        {/* 최근 본 상품 사이드바 */}
        <RecentProductsSidebar
          productType="insurance"
          isOpen={showRecentSidebar}
          onToggle={() => setShowRecentSidebar(!showRecentSidebar)}
          refreshTrigger={refreshTrigger}
        />
      </div>

      {/* 고정된 사이드바 토글 버튼 */}
      <div className="fixed top-20 right-6 z-40">
        <Button
          onClick={() => {
            setShowRecentSidebar(!showRecentSidebar)
            if (!showRecentSidebar) {
              setRefreshTrigger(prev => prev + 1)
            }
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg rounded-full w-14 h-14 p-0"
          title="최근 본 보험"
        >
          <Clock className="h-6 w-6" />
        </Button>
      </div>
    </div>
  )
}
