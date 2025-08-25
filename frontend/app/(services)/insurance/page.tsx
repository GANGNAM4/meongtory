"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { ChevronDown, ChevronUp, Clock, Eye, Heart, PawPrint, Shield, Star, Sparkles } from "lucide-react"
import { insuranceApi, recentApi } from "@/lib/api"
import { RecentProductsSidebar } from "@/components/ui/recent-products-sidebar"
import { loadSidebarState, updateSidebarState } from "@/lib/sidebar-state"
import { useToast } from "@/components/ui/use-toast"

interface InsuranceProduct {
  id: number
  company: string
  productName: string
  description: string
  features: string[]
  coverageDetails?: string[] // 보장내역 상세 정보
  logo: string
  redirectUrl?: string
  requirements?: string[] // 가입 조건 (weight, height 등)
}

interface PetInsurancePageProps {
  onViewDetails?: (product: InsuranceProduct) => void
}

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

  // 사이드바 상태 로드 및 페이지 포커스 시 동기화
  useEffect(() => {
    const handleFocus = () => {
      const savedState = loadSidebarState()
      if (savedState.productType === 'insurance') {
        setShowRecentSidebar(savedState.isOpen)
      }
    }

    // 페이지 포커스 시 상태 로드
    window.addEventListener('focus', handleFocus)
    
    // 초기 상태 로드
    handleFocus()

    return () => {
      window.removeEventListener('focus', handleFocus)
    }
  }, [])

  // 사이드바 토글 함수
  const handleSidebarToggle = () => {
    const newIsOpen = !showRecentSidebar
    setShowRecentSidebar(newIsOpen)
    updateSidebarState({ isOpen: newIsOpen, productType: 'insurance' })
  }

  // 로그인 상태 확인 (간단한 방식)
  const isLoggedIn = typeof window !== 'undefined' && localStorage.getItem('accessToken')
  
  // ADMIN 권한 체크
  const [isAdmin, setIsAdmin] = useState(false)
  
  useEffect(() => {
    const token = localStorage.getItem('accessToken')
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]))
        setIsAdmin(payload.role === 'ADMIN')
      } catch (e) {
        console.error('토큰 파싱 오류:', e)
      }
    }
  }, [])

  // 수동 크롤링 함수
  const handleManualCrawl = async () => {
    try {
      setLoading(true)
      const result = await insuranceApi.manualCrawl()
      toast({
        title: "데이터 업데이트 완료",
        description: result,
      })
      // 페이지 새로고침
      window.location.reload()
    } catch (error) {
      console.error('크롤링 오류:', error)
      toast({
        title: "데이터 업데이트 실패",
        description: "크롤링 중 오류가 발생했습니다.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        const data = await insuranceApi.getAll()
        const mapped: InsuranceProduct[] = (data || []).map((d: any) => ({
          id: d.id,
          company: d.company,
          productName: d.productName,
          description: d.description,
          features: d.features || [],
          coverageDetails: d.coverageDetails || [],
          logo: d.logoUrl || "",
          redirectUrl: d.redirectUrl,
          requirements: d.requirements || [],
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
    
    // 사이드바 업데이트
    setRefreshTrigger(prev => prev + 1)
    
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
      
      // 최대 15개만 유지
      if (products.length > 15) {
        products.splice(15)
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

  const { toast } = useToast()

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 pt-20">
      {/* 귀여운 배경 장식 */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-20 left-10 w-20 h-20 bg-pink-200 rounded-full opacity-20 animate-bounce"></div>
        <div className="absolute top-40 right-20 w-16 h-16 bg-purple-200 rounded-full opacity-20 animate-pulse"></div>
        <div className="absolute bottom-40 left-20 w-24 h-24 bg-blue-200 rounded-full opacity-20 animate-bounce"></div>
        <div className="absolute bottom-20 right-10 w-12 h-12 bg-yellow-200 rounded-full opacity-20 animate-pulse"></div>
      </div>

      <div className="container mx-auto px-4 py-8 relative z-10">
        {/* 귀여운 헤더 */}
        <div className="text-center mb-8 sm:mb-12">
          <div className="flex justify-center items-center mb-4 sm:mb-6">
            <div className="bg-gradient-to-r from-pink-400 to-purple-500 p-3 sm:p-4 rounded-full shadow-lg">
              <PawPrint className="w-8 h-8 sm:w-12 sm:h-12 text-white" />
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent mb-2 sm:mb-4">
            🐾 우리 아이를 위한 펫보험 🐾
          </h1>
          <p className="text-sm sm:text-lg text-gray-600 mb-1 sm:mb-2">사랑하는 반려동물을 위한 특별한 보험</p>
          <p className="text-xs sm:text-sm text-gray-500">다양한 보험사의 펫보험을 비교해보세요!</p>
        </div>

        {/* 귀여운 소개 섹션 */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 mb-8 sm:mb-12 shadow-xl border border-pink-100">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 text-center">
            <div className="space-y-3 sm:space-y-4">
              <div className="bg-gradient-to-br from-pink-100 to-pink-200 w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center mx-auto">
                <Heart className="w-6 h-6 sm:w-8 sm:h-8 text-pink-600" />
              </div>
              <h3 className="font-bold text-gray-800 text-sm sm:text-base">사랑하는 마음</h3>
              <p className="text-xs sm:text-sm text-gray-600">우리 아이의 건강을 위한 최선의 선택</p>
            </div>
            <div className="space-y-3 sm:space-y-4">
              <div className="bg-gradient-to-br from-purple-100 to-purple-200 w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center mx-auto">
                <Shield className="w-6 h-6 sm:w-8 sm:h-8 text-purple-600" />
              </div>
              <h3 className="font-bold text-gray-800 text-sm sm:text-base">안전한 보장</h3>
              <p className="text-xs sm:text-sm text-gray-600">다양한 질병과 사고에 대한 포괄적 보장</p>
            </div>
            <div className="space-y-3 sm:space-y-4 sm:col-span-2 lg:col-span-1">
              <div className="bg-gradient-to-br from-blue-100 to-blue-200 w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center mx-auto">
                <Star className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600" />
              </div>
              <h3 className="font-bold text-gray-800 text-sm sm:text-base">최고의 서비스</h3>
              <p className="text-xs sm:text-sm text-gray-600">신속한 보험금 지급과 친절한 상담</p>
            </div>
          </div>
        </div>

        {/* ADMIN 전용 크롤링 버튼 */}
        {isAdmin && (
          <div className="text-center mb-6 sm:mb-8">
            <Button
              onClick={handleManualCrawl}
              className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-full px-4 sm:px-6 lg:px-8 py-2 sm:py-3 shadow-lg transform hover:scale-105 transition-all duration-200 text-sm sm:text-base"
              disabled={loading}
            >
              <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              {loading ? '데이터 업데이트 중...' : '데이터 업데이트'}
            </Button>
          </div>
        )}

        {/* 보험 상품 그리드 */}
        {loading ? (
          <div className="text-center py-8 sm:py-12">
            <div className="inline-flex items-center space-x-2">
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-r from-pink-400 to-purple-500 rounded-full animate-spin"></div>
              <span className="text-gray-600 font-medium text-sm sm:text-base">귀여운 보험 상품들을 불러오는 중...</span>
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-8 sm:py-12">
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 sm:p-6 max-w-md mx-auto">
              <p className="text-red-600 text-sm sm:text-base">😿 {error}</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
            {products.map((product, index) => (
              <Card key={product.id} className="group bg-white/80 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 rounded-2xl sm:rounded-3xl overflow-hidden">
                <CardContent className="p-4 sm:p-6 lg:p-8">
                  {/* 상품 헤더 */}
                  <div className="text-center mb-4 sm:mb-6">
                    <div className="bg-gradient-to-br from-pink-100 to-purple-100 w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4 group-hover:scale-110 transition-transform duration-300">
                      <PawPrint className="w-6 h-6 sm:w-8 sm:h-8 text-pink-600" />
                    </div>
                    <h3 className="font-bold text-lg sm:text-xl text-gray-900 mb-1 sm:mb-2">{product.company}</h3>
                    <p className="text-xs sm:text-sm text-gray-600">{product.productName}</p>
                  </div>

                  {/* 상품 설명 */}
                  <p className="text-gray-700 mb-4 sm:mb-6 text-center leading-relaxed text-sm sm:text-base">{product.description}</p>

                  {/* 주요 특징 */}
                  {product.features && product.features.length > 0 && (
                    <div className="mb-4 sm:mb-6">
                      <h4 className="font-semibold text-gray-900 mb-2 sm:mb-3 flex items-center text-sm sm:text-base">
                        <Star className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-500 mr-1 sm:mr-2" />
                        주요 특징
                      </h4>
                      <div className="space-y-2">
                        {product.features.slice(0, 4).map((feature, index) => (
                          <div key={index} className="flex items-start text-xs sm:text-sm text-gray-600 bg-gradient-to-r from-pink-50 to-purple-50 p-2 sm:p-3 rounded-xl">
                            <span className="text-pink-500 mr-1 sm:mr-2">✨</span>
                            <span className="leading-relaxed">{feature}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 가입 조건 (weight, height 등) */}
                  {product.requirements && product.requirements.length > 0 && (
                    <div className="mb-4 sm:mb-6">
                      <h4 className="font-semibold text-gray-900 mb-2 sm:mb-3 flex items-center text-sm sm:text-base">
                        <Shield className="w-3 h-3 sm:w-4 sm:h-4 text-blue-500 mr-1 sm:mr-2" />
                        가입 조건
                      </h4>
                      <div className="space-y-2">
                        {product.requirements.slice(0, 3).map((requirement, index) => (
                          <div key={index} className="flex items-start text-xs sm:text-sm text-gray-600 bg-gradient-to-r from-blue-50 to-blue-100 p-2 sm:p-3 rounded-xl">
                            <span className="text-blue-500 mr-1 sm:mr-2">📋</span>
                            <span className="leading-relaxed">{requirement}</span>
                          </div>
                        ))}
                        {product.requirements.length > 3 && (
                          <div className="text-xs text-gray-500 text-center">
                            +{product.requirements.length - 3}개 조건 더...
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 자세히 보기 버튼 */}
                  <Button
                    onClick={() => handleViewDetails(product)}
                    className="w-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white rounded-full py-2 sm:py-3 font-semibold shadow-lg transform hover:scale-105 transition-all duration-200 text-sm sm:text-base"
                  >
                    <Eye className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                    자세히 보기
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* 귀여운 하단 메시지 */}
        <div className="text-center mt-12 sm:mt-16">
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 shadow-xl border border-pink-100">
            <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-800 mb-3 sm:mb-4">🐕‍🦺 우리 아이의 건강한 미래를 위해 🐈</h3>
            <p className="text-gray-600 mb-4 sm:mb-6 text-sm sm:text-base">사랑하는 반려동물과 함께하는 행복한 시간을 더 오래 누릴 수 있도록 도와드립니다.</p>
            <div className="flex justify-center space-x-2 sm:space-x-4 text-2xl sm:text-3xl lg:text-4xl">
              <span>🐾</span>
              <span>💕</span>
              <span>🏥</span>
              <span>🛡️</span>
              <span>🐾</span>
            </div>
          </div>
        </div>

        {/* 최근 본 상품 사이드바 */}
        <RecentProductsSidebar
          productType="insurance"
          isOpen={showRecentSidebar}
          onToggle={handleSidebarToggle}
          refreshTrigger={refreshTrigger}
        />
      </div>

      {/* 고정된 사이드바 토글 버튼 */}
      {!showRecentSidebar && (
        <div className="fixed bottom-4 right-4 sm:top-20 sm:right-6 z-40">
          <Button
            onClick={handleSidebarToggle}
            className="bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white shadow-xl rounded-full w-12 h-12 sm:w-16 sm:h-16 p-0 transform hover:scale-110 transition-all duration-200"
            title="최근 본 보험"
          >
            <Clock className="h-5 w-5 sm:h-6 sm:w-6" />
          </Button>
        </div>
      )}
    </div>
  )
}
