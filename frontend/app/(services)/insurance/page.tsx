"use client"

import { useEffect, useState, useRef } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Clock, Eye, Heart, PawPrint, Shield, Star, Sparkles, Search, X, Bot } from "lucide-react"
import { insuranceApi, recentApi, getBackendUrl } from "@/lib/api"
import { RecentProductsSidebar } from "@/components/ui/recent-products-sidebar"
import { loadSidebarState, updateSidebarState } from "@/lib/sidebar-state"
import { useToast } from "@/components/ui/use-toast"
import axios from "axios"

interface InsuranceProduct {
  id: number
  company: string | null
  productName: string | null
  description: string | null
  features: string[] | null
  coverageDetails?: string[] | null
  logo: string | null
  redirectUrl?: string | null
  requirements?: string[] | null
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
  const [filteredProducts, setFilteredProducts] = useState<InsuranceProduct[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  // 검색 상태
  const [searchQuery, setSearchQuery] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  
  // @MyPet 자동완성 관련 상태
  const [petSuggestions, setPetSuggestions] = useState<any[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [cursorPosition, setCursorPosition] = useState(0)
  const [selectedPetId, setSelectedPetId] = useState<number | null>(null)
  
  // ContentEditable 검색창용 ref
  const searchInputRef = useRef<HTMLDivElement>(null)

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

  // MyPet 태그를 파란색으로 렌더링하는 함수
  const renderTextWithPetTags = (text: string) => {
    if (!text) return text;
    const parts = text.split(/(@[ㄱ-ㅎ가-힣a-zA-Z0-9_]+)/g)
    return parts.map((part, index) => {
      if (part.startsWith('@')) {
        return <span key={index} className="text-blue-600 font-medium">{part}</span>
      }
      return part
    })
  };

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
        console.log('=== fetchData 시작 ===')
        const data = await insuranceApi.getAll()
        console.log('API에서 받은 원본 데이터:', data)
        console.log('데이터 길이:', data ? data.length : 0)
        
        const mapped: InsuranceProduct[] = (data || []).map((d: any) => ({
          id: d.id,
          company: d.company || null,
          productName: d.productName || null,
          description: d.description || null,
          features: Array.isArray(d.features) ? d.features : (d.features ? d.features.split('|').map((f: string) => f.trim()).filter((f: string) => f.length > 0) : null),
          coverageDetails: Array.isArray(d.coverageDetails) ? d.coverageDetails : (d.coverageDetails ? d.coverageDetails.split('|').map((c: string) => c.trim()).filter((c: string) => c.length > 0) : null),
          logo: d.logoUrl || null,
          redirectUrl: d.redirectUrl || null,
          requirements: Array.isArray(d.requirements) ? d.requirements : (d.requirements ? d.requirements.split('|').map((r: string) => r.trim()).filter((r: string) => r.length > 0) : null),
        }))
        console.log('매핑된 데이터:', mapped)
        console.log('매핑된 데이터 길이:', mapped.length)
        setProducts(mapped)
        setFilteredProducts(mapped)
        console.log('products 상태 설정 완료')
      } catch (e) {
        setError("보험 상품을 불러오지 못했습니다.")
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  // AI 응답 기반 필터링 함수
  const filterInsuranceProductsByAIResponse = (products: InsuranceProduct[], aiResponse: string, originalQuery: string) => {
    // AI 응답에서 보험사명과 상품명 추출
    const mentionedCompanies: string[] = [];
    const mentionedProducts: string[] = [];
    
    // 보험사명 패턴 매칭 (더 정확한 매칭)
    const companyPatterns = [
      '삼성화재', 'NH농협손해보험', 'KB손해보험', '현대해상', '메리츠화재', 'DB손해보험'
    ];
    
    companyPatterns.forEach(company => {
      if (aiResponse.includes(company)) {
        mentionedCompanies.push(company);
      }
    });
    
    // 상품명 패턴 매칭 (더 구체적인 매칭)
    const productPatterns = [
      '펫보험', '동물보험', '다이렉트', '실비보험', '의료보험'
    ];
    
    productPatterns.forEach(product => {
      if (aiResponse.includes(product)) {
        mentionedProducts.push(product);
      }
    });
    
    // AI 응답에서 "적합", "추천", "좋은" 등의 긍정적 표현 확인
    const positiveKeywords = ['적합', '추천', '좋은', '최적', '적절', '선택'];
    const hasPositiveRecommendation = positiveKeywords.some(keyword => aiResponse.includes(keyword));
    
    // AI 응답에서 "모든", "전체" 등의 포괄적 표현 확인
    const broadKeywords = ['모든', '전체', '다', '모든 보험사', '모든 상품'];
    const isBroadRecommendation = broadKeywords.some(keyword => aiResponse.includes(keyword));
    
    // 필터링된 상품들
    const filteredProducts = [];
    
    for (const product of products) {
      let score = 0;
      const productText = `${product.company} ${product.productName} ${product.description}`.toLowerCase();
      
      // 1. AI 응답에서 언급된 보험사 매칭 (높은 점수)
      for (const company of mentionedCompanies) {
        if (product.company && product.company.toLowerCase().includes(company.toLowerCase())) {
          // 포괄적 추천이면 점수 감소
          if (isBroadRecommendation) {
            score += 5; // 기본 점수 감소
          } else {
            score += 15; // 구체적 추천이면 높은 점수
          }
          break;
        }
      }
      
      // 2. AI 응답에서 언급된 상품명 매칭
      for (const productName of mentionedProducts) {
        if (product.productName && product.productName.toLowerCase().includes(productName.toLowerCase())) {
          score += 8;
        }
      }
      
      // 3. 원본 쿼리와의 매칭
      const queryLower = originalQuery.toLowerCase();
      if (productText.includes(queryLower)) {
        score += 5;
      }
      
      // 4. 보장내역 매칭
      if (product.features) {
        for (const feature of product.features) {
          if (aiResponse.includes(feature)) {
            score += 3;
          }
        }
      }
      
      // 5. 긍정적 추천이 있으면 추가 점수
      if (hasPositiveRecommendation && mentionedCompanies.length > 0) {
        // 언급된 보험사에 추가 점수
        for (const company of mentionedCompanies) {
          if (product.company && product.company.toLowerCase().includes(company.toLowerCase())) {
            score += 10;
            break;
          }
        }
      }
      
      // 점수가 있는 상품만 포함
      if (score > 0) {
        filteredProducts.push({ ...product, aiScore: score });
      }
    }
    
    // 점수순으로 정렬
    filteredProducts.sort((a, b) => (b.aiScore || 0) - (a.aiScore || 0));
    
    // 상위 6개만 반환
    return filteredProducts.slice(0, 20);
  };

  // insurance_rag.py의 고급 필터링 시스템을 프론트엔드에서 구현
  const filterInsuranceProducts = (products: InsuranceProduct[], query: string) => {
    if (!query.trim()) return products

    const queryLower = query.toLowerCase()
    const filteredProducts: { score: number; product: InsuranceProduct }[] = []

    // 검색 조건 정의 (insurance_rag.py와 동일한 로직)
    const searchConditions = {
      '보험사': {
        '삼성화재': ['삼성', '삼성화재', 'samsung'],
        'NH농협손해보험': ['nh', '농협', '농협손해보험', 'nh농협'],
        'KB손해보험': ['kb', '국민', 'kb손해보험'],
        '현대해상': ['현대', '현대해상', 'hi'],
        '메리츠화재': ['메리츠', 'meritz'],
        'DB손해보험': ['db', 'db손해보험'],
        '롯데손해보험': ['롯데', 'lotte'],
        '한화손해보험': ['한화', 'hanwha'],
        '흥국화재': ['흥국', 'heungkuk'],
        'AXA손해보험': ['axa', '엑사'],
        '교보손해보험': ['교보', 'kyobo']
      },
      '가입조건': {
        '나이': ['나이', '연령', '만나이', '생후', '개월', '세'],
        '종': ['강아지', '고양이', '반려견', '반려묘', '개', '고양이', '강아지용', '고양이용'],
        '품종': ['품종', '견종', '묘종']
      },
      '보장내역': {
        '의료비': ['의료비', '치료비', '병원비', '진료비'],
        '수술비': ['수술비', '수술', '외과'],
        '입원': ['입원', '입원비', '입원치료'],
        '통원': ['통원', '통원치료', '외래'],
        '검사비': ['검사비', '검사', '진단'],
        '약품비': ['약품비', '약', '처방'],
        '재활치료': ['재활', '재활치료', '물리치료'],
        '안과치료': ['안과', '눈', '시력'],
        '치과치료': ['치과', '치아', '치료'],
        '피부과치료': ['피부과', '피부', '알레르기'],
        '정형외과': ['정형외과', '관절', '뼈'],
        '내과치료': ['내과', '소화기', '호흡기'],
        '외과치료': ['외과', '수술']
      },
      '특별조건': {
        '특약': ['특약', '추가보장', '선택보장'],
        '할인': ['할인', '혜택', '이벤트', '프로모션'],
        '자동갱신': ['갱신', '자동갱신', '연장']
      }
    }

    for (const product of products) {
      let score = 0
      const productText = [
        product.company,
        product.productName,
        product.description,
        ...(product.features || []),
        ...(product.coverageDetails || [])
      ].join(' ').toLowerCase()

             // 1. 보험사 필터링
       for (const [companyName, keywords] of Object.entries(searchConditions['보험사'])) {
         if (keywords.some(keyword => queryLower.includes(keyword))) {
           if (product.company && product.company.toLowerCase().includes(companyName.toLowerCase())) {
             score += 10
             break
           }
         }
       }

      // 2. 가입조건 필터링
      for (const [conditionType, keywords] of Object.entries(searchConditions['가입조건'])) {
        if (keywords.some(keyword => queryLower.includes(keyword))) {
          if (keywords.some(keyword => productText.includes(keyword))) {
            score += 8
          }
        }
      }

      // 3. 보장내역 필터링
      for (const [coverageType, keywords] of Object.entries(searchConditions['보장내역'])) {
        if (keywords.some(keyword => queryLower.includes(keyword))) {
          if (keywords.some(keyword => productText.includes(keyword))) {
            score += 6
          }
        }
      }

      // 4. 특별조건 필터링
      for (const [specialType, keywords] of Object.entries(searchConditions['특별조건'])) {
        if (keywords.some(keyword => queryLower.includes(keyword))) {
          if (keywords.some(keyword => productText.includes(keyword))) {
            score += 4
          }
        }
      }

      // 5. 일반 키워드 매칭
      const generalKeywords = ['보험', '펫보험', '동물보험', '가입', '보장', '보상', '보험료', '상품']
      for (const keyword of generalKeywords) {
        if (queryLower.includes(keyword) && productText.includes(keyword)) {
          score += 2
        }
      }

      // 6. 정확한 문구 매칭 (높은 점수)
      if (productText.includes(queryLower)) {
        score += 15
      }

      // 7. 제품명 매칭
      if (product.productName && product.productName.toLowerCase().includes(queryLower)) {
        score += 12
      }

      // 점수가 있는 상품만 필터링
      if (score > 0) {
        filteredProducts.push({ score, product })
      }
    }

    // 점수순으로 정렬
    filteredProducts.sort((a, b) => b.score - a.score)

    // 상위 6개 상품 반환
    return filteredProducts.slice(0, 6).map(item => item.product)
  }

  // 텍스트 하이라이팅 함수
  const highlightText = (element: HTMLElement) => {
    const text = element.textContent || ''
    const highlightedText = text.replace(/(@[ㄱ-ㅎ가-힣a-zA-Z0-9_]+)/g, '<span class="text-blue-600 font-medium">$1</span>')
    element.innerHTML = highlightedText
  }

  // @태그 감지 및 MyPet 자동완성 (ContentEditable용)
  const handleContentEditableInput = async (e: React.FormEvent<HTMLDivElement>) => {
    const element = e.currentTarget
    const text = element.textContent || ''
    const selection = window.getSelection()
    const position = selection?.anchorOffset || 0
    
    setSearchQuery(text)
    setCursorPosition(position)
    
    // 하이라이팅 적용
    highlightText(element)

    // @ 태그 검출
    const beforeCursor = text.substring(0, position)
    const match = beforeCursor.match(/@([ㄱ-ㅎ가-힣a-zA-Z0-9_]*)$/)
    
    if (match) {
      const keyword = match[1]
      if (keyword.length >= 0) {
        try {
          const token = localStorage.getItem('accessToken')
          if (token) {
            const response = await axios.get(
              `${getBackendUrl()}/api/mypet/search?keyword=${keyword}`,
              { headers: { 
                Authorization: `Bearer ${token}`,
                'Access_Token': token
              } }
            )
            if (response.data.success) {
              setPetSuggestions(response.data.data || [])
              setShowSuggestions(true)
            }
          }
        } catch (error) {
          console.error('MyPet 검색 실패:', error)
          setPetSuggestions([])
        }
      }
    } else {
      setShowSuggestions(false)
      setPetSuggestions([])
    }
  }

  // @태그 감지 및 MyPet 자동완성
  const handleSearchInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    const position = e.target.selectionStart || 0
    
    setSearchQuery(value)
    setCursorPosition(position)

    // @ 태그 검출
    const beforeCursor = value.substring(0, position)
    const match = beforeCursor.match(/@([ㄱ-ㅎ가-힣a-zA-Z0-9_]*)$/)
    
    if (match) {
      const keyword = match[1]
      if (keyword.length >= 0) {
        try {
          const token = localStorage.getItem('accessToken')
          if (token) {
            const response = await axios.get(
              `${getBackendUrl()}/api/mypet/search?keyword=${keyword}`,
              { headers: { 
                Authorization: `Bearer ${token}`,
                'Access_Token': token
              } }
            )
            if (response.data.success) {
              setPetSuggestions(response.data.data || [])
              setShowSuggestions(true)
            }
          }
        } catch (error) {
          console.error('MyPet 검색 실패:', error)
          setPetSuggestions([])
        }
      }
    } else {
      setShowSuggestions(false)
      setPetSuggestions([])
    }
  }

  // MyPet 선택 처리
  const selectPet = (pet: any) => {
    const beforeCursor = searchQuery.substring(0, cursorPosition)
    const afterCursor = searchQuery.substring(cursorPosition)
    
    const beforeAt = beforeCursor.substring(0, beforeCursor.lastIndexOf('@'))
    const newQuery = beforeAt + `@${pet.name} ` + afterCursor
    
    setSearchQuery(newQuery)
    setSelectedPetId(pet.myPetId)
    setShowSuggestions(false)
    setPetSuggestions([])
  }

      // 검색 실행
    const handleSearch = async () => {
        if (!searchQuery.trim()) {
            setFilteredProducts(products)
            return
        }

        setIsSearching(true)
        setShowSuggestions(false) // 자동완성 숨기기

        // @MyPet이 있는 경우 AI 서비스 직접 호출
        const petMatches = searchQuery.match(/@([ㄱ-ㅎ가-힣a-zA-Z0-9_]+)/g)
        if (petMatches && selectedPetId) {
            try {
                // AI 서비스의 보험 챗봇 엔드포인트 직접 호출
                const response = await axios.post(`${getBackendUrl()}/api/chatbot/insurance`, {
                    query: searchQuery,
                    petId: selectedPetId
                });
                
                if (response.data && response.data.answer) {
                    // AI 응답을 기반으로 상품 필터링
                    const aiResponse = response.data.answer;
                    console.log('AI 서비스 응답:', aiResponse);
                    
                    // AI 응답에서 언급된 보험사나 상품명을 추출하여 필터링
                    const filtered = filterInsuranceProductsByAIResponse(products, aiResponse, searchQuery);
                    setFilteredProducts(filtered);
                    setIsSearching(false);
                    return;
                }
            } catch (error) {
                console.error('AI 서비스 보험 검색 실패:', error);
                // 실패 시 일반 검색으로 폴백
            }
        }
        
        // 일반 검색 실행
        setTimeout(() => {
            const filtered = filterInsuranceProducts(products, searchQuery)
            setFilteredProducts(filtered)
            setIsSearching(false)
        }, 500)
    }

  // 검색어 변경 시 자동 검색 (디바운싱) - @태그가 없을 때만
  useEffect(() => {
    const timer = setTimeout(() => {
      // @태그가 있으면 자동 검색하지 않음 (Enter나 버튼 클릭으로만)
      const hasAtTag = searchQuery.includes('@')
      if (searchQuery.trim() && !hasAtTag) {
        handleSearch()
      } else if (!searchQuery.trim()) {
        setFilteredProducts(products)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery, products])

  // 검색어 초기화
  const clearSearch = () => {
    setSearchQuery("")
    setFilteredProducts(products)
    setShowSuggestions(false)
    setPetSuggestions([])
    setSelectedPetId(null)
  }

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
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-orange-50 to-amber-50 pt-20">
      <div className="container mx-auto px-4 py-8 relative z-10">
        {/* 귀여운 헤더 */}
        <div className="text-center mb-8 sm:mb-12">
          <div className="flex justify-center items-center mb-4 sm:mb-6">
            <div className="bg-gradient-to-r from-yellow-400 to-orange-500 p-3 sm:p-4 rounded-full shadow-lg">
              <PawPrint className="w-8 h-8 sm:w-12 sm:h-12 text-white" />
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-yellow-600 to-orange-600 bg-clip-text text-transparent mb-2 sm:mb-4">
            🐾 우리 아이를 위한 펫보험 🐾
          </h1>
          <p className="text-sm sm:text-lg text-gray-600 mb-1 sm:mb-2">사랑하는 반려동물을 위한 특별한 보험</p>
          <p className="text-xs sm:text-sm text-gray-500">자연어로 원하는 보험을 찾아보세요!</p>
        </div>

        {/* AI 검색 섹션 */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 mb-8 sm:mb-12 shadow-xl border border-yellow-100">
          {/* 검색바 */}
          <div className="relative mb-6">
            <div className="relative">
              {/* MyPet 자동완성 드롭다운 */}
              {showSuggestions && petSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto z-10">
                  {petSuggestions.map((pet) => (
                    <div
                      key={pet.myPetId}
                      onClick={() => selectPet(pet)}
                      className="flex items-center p-3 hover:bg-gray-100 cursor-pointer"
                    >
                      {pet.imageUrl && (
                        <img 
                          src={pet.imageUrl} 
                          alt={pet.name}
                          className="w-8 h-8 rounded-full mr-3 object-cover"
                        />
                      )}
                      <div className="flex-1">
                        <div className="text-sm font-medium">@{pet.name}</div>
                        <div className="text-xs text-gray-500">{pet.breed} • {pet.type}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              <Bot className="absolute left-3 top-1/2 transform -translate-y-1/2 text-yellow-500 w-5 h-5" />
              <div className="relative flex-1">
                <Input
                  type="text"
                  placeholder="예: 삼성화재 보험 찾아줘, 강아지용 의료비 보장 좋은 보험..."
                  value={searchQuery}
                  onChange={handleSearchInputChange}
                  className="pl-10 pr-10 py-3 text-base border-2 border-yellow-200 focus:border-yellow-400 rounded-xl bg-white/80 backdrop-blur-sm"
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  style={{
                    color: 'transparent',
                    caretColor: 'black',
                    fontFamily: 'inherit',
                    fontSize: '16px',
                    lineHeight: '24px',
                    letterSpacing: 'normal',
                    fontWeight: 'normal'
                  }}
                />
                {/* 하이라이트 오버레이 */}
                <div 
                  className="absolute top-0 left-0 right-0 bottom-0 pointer-events-none flex items-center"
                  style={{
                    paddingLeft: '40px',
                    paddingRight: '40px',
                    fontSize: '16px',
                    lineHeight: '24px',
                    fontFamily: 'inherit',
                    letterSpacing: 'normal',
                    fontWeight: 'normal',
                    whiteSpace: 'pre'
                  }}
                >
                  {searchQuery.split(/(@[ㄱ-ㅎ가-힣a-zA-Z0-9_]+)/g).map((part, index) => {
                    if (part.startsWith('@') && part.length > 1) {
                      return <span key={index} className="text-blue-600 font-medium">{part}</span>;
                    }
                    return <span key={index} className="text-black">{part}</span>;
                  })}
                </div>
              </div>
              {searchQuery && (
                <button
                  onClick={clearSearch}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>

          {/* 검색 예시 */}
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-2">💡 검색 예시:</p>
            <div className="flex flex-wrap gap-2">
              {[
                "삼성화재 보험",
                "강아지용 의료비",
                "고양이 보험",
                "수술비 보장",
                "입원치료 보험",
                "할인 혜택"
              ].map((example, index) => (
                <button
                  key={index}
                  onClick={() => setSearchQuery(example)}
                  className="text-xs bg-yellow-100 hover:bg-yellow-200 text-yellow-700 px-3 py-1 rounded-full transition-colors"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>

          {/* 검색 결과 요약 */}
          <div className="mt-4 pt-4 border-t border-yellow-200">
            <p className="text-sm text-gray-600">
              {isSearching ? (
                <span className="flex items-center">
                  <div className="w-4 h-4 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full animate-spin mr-2"></div>
                  AI가 최적의 보험을 찾고 있어요...
                </span>
              ) : (
                <>
                  총 <span className="font-semibold text-yellow-600">{filteredProducts.length}</span>개의 상품이 검색되었습니다
                  {searchQuery && (
                    <span className="ml-2">
                      (검색어: <span className="font-semibold text-yellow-600">"{searchQuery}"</span>)
                    </span>
                  )}
                </>
              )}
            </p>
          </div>
        </div>

        {/* 귀여운 소개 섹션 */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 mb-8 sm:mb-12 shadow-xl border border-yellow-100">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 text-center">
            <div className="space-y-3 sm:space-y-4">
              <div className="bg-gradient-to-br from-yellow-100 to-yellow-200 w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center mx-auto">
                <Heart className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-600" />
              </div>
              <h3 className="font-bold text-gray-800 text-sm sm:text-base">사랑하는 마음</h3>
              <p className="text-xs sm:text-sm text-gray-600">우리 아이의 건강을 위한 최선의 선택</p>
            </div>
            <div className="space-y-3 sm:space-y-4">
              <div className="bg-gradient-to-br from-orange-100 to-orange-200 w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center mx-auto">
                <Shield className="w-6 h-6 sm:w-8 sm:h-8 text-orange-600" />
              </div>
              <h3 className="font-bold text-gray-800 text-sm sm:text-base">안전한 보장</h3>
              <p className="text-xs sm:text-sm text-gray-600">다양한 질병과 사고에 대한 포괄적 보장</p>
            </div>
            <div className="space-y-3 sm:space-y-4 sm:col-span-2 lg:col-span-1">
              <div className="bg-gradient-to-br from-amber-100 to-amber-200 w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center mx-auto">
                <Star className="w-6 h-6 sm:w-8 sm:h-8 text-amber-600" />
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
              className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white rounded-full px-4 sm:px-6 lg:px-8 py-2 sm:py-3 shadow-lg transform hover:scale-105 transition-all duration-200 text-sm sm:text-base"
              disabled={loading}
            >
              <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              {loading ? '데이터 업데이트 중...' : '데이터 업데이트'}
            </Button>
          </div>
        )}

        {/* 보험 상품 그리드 */}
        {(() => {
          console.log('렌더링 상태 확인:', { loading, error, productsLength: filteredProducts.length })
          if (loading) {
            return (
              <div className="text-center py-8 sm:py-12">
                <div className="inline-flex items-center space-x-2">
                  <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full animate-spin"></div>
                  <span className="text-gray-600 font-medium text-sm sm:text-base">귀여운 보험 상품들을 불러오는 중...</span>
                </div>
              </div>
            )
          } else if (error) {
            return (
              <div className="text-center py-8 sm:py-12">
                <div className="bg-red-50 border border-red-200 rounded-2xl p-4 sm:p-6 max-w-md mx-auto">
                  <p className="text-red-600 text-sm sm:text-base">😿 {error}</p>
                </div>
              </div>
            )
          } else if (filteredProducts.length === 0 && searchQuery) {
            return (
              <div className="text-center py-8 sm:py-12">
                <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 sm:p-6 max-w-md mx-auto">
                  <p className="text-yellow-600 text-sm sm:text-base">🔍 검색 조건에 맞는 보험 상품이 없습니다.</p>
                  <p className="text-yellow-500 text-xs mt-2">다른 검색어를 시도해보세요!</p>
                  <div className="mt-4 space-y-2">
                    <p className="text-xs text-gray-500">💡 검색 팁:</p>
                    <div className="text-xs text-gray-600 space-y-1">
                      <p>• "삼성화재 보험" → 특정 보험사 검색</p>
                      <p>• "강아지 의료비" → 반려동물 종류 + 보장내역</p>
                      <p>• "수술비 보장" → 특정 보장내역 검색</p>
                    </div>
                  </div>
                </div>
              </div>
            )
          } else {
            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 lg:gap-10">
                {filteredProducts.map((product, index) => (
                  <Card key={product.id} className="group bg-white/80 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 rounded-2xl sm:rounded-3xl overflow-hidden">
                    <CardContent className="p-4 sm:p-6 lg:p-8">
                      {/* 상품 헤더 */}
                      <div className="text-center mb-4 sm:mb-6 h-24 sm:h-28">
                        <div className="bg-gradient-to-br from-yellow-100 to-orange-100 w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4 group-hover:scale-110 transition-transform duration-300">
                          <PawPrint className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-600" />
                        </div>
                        <h3 className="font-bold text-lg sm:text-xl text-gray-900 mb-1 sm:mb-2">{renderTextWithPetTags(product.company || "보험사명 없음")}</h3>
                        <p className="text-xs sm:text-sm text-gray-600">{renderTextWithPetTags(product.productName || "상품명 없음")}</p>
                      </div>

                      {/* 상품 설명 */}
                      <div className="mb-3 sm:mb-4 h-20 sm:h-24">
                        <p className="text-gray-700 text-center leading-relaxed text-sm sm:text-base line-clamp-2">{renderTextWithPetTags(product.description || "상품 설명이 없습니다")}</p>
                      </div>

                      {/* 주요 특징 */}
                      <div className="mb-4 sm:mb-6 h-36 sm:h-40">
                        <h4 className="font-semibold text-gray-900 mb-2 sm:mb-3 flex items-center text-sm sm:text-base">
                          <Star className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-500 mr-1 sm:mr-2" />
                          주요 특징
                        </h4>
                        <div className="space-y-2 h-28 sm:h-32 overflow-y-auto">
                          {product.features && product.features.length > 0 ? (
                            product.features.slice(0, 4).map((feature, index) => (
                              <div key={index} className="flex items-start text-xs sm:text-sm text-gray-600 bg-gradient-to-r from-yellow-50 to-orange-50 p-2 sm:p-3 rounded-xl">
                                <span className="text-yellow-500 mr-1 sm:mr-2">✨</span>
                                <span className="leading-relaxed">{renderTextWithPetTags(feature)}</span>
                              </div>
                            ))
                          ) : (
                            <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                              주요 특징 정보가 없습니다
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 자세히 보기 버튼 */}
                      <div className="h-12 sm:h-14">
                        <Button
                          onClick={() => handleViewDetails(product)}
                          className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white rounded-full py-2 sm:py-3 font-semibold shadow-lg transform hover:scale-105 transition-all duration-200 text-sm sm:text-base"
                        >
                          <Eye className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                          자세히 보기
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )
          }
        })()}

        {/* 귀여운 하단 메시지 */}
        <div className="text-center mt-12 sm:mt-16">
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 shadow-xl border border-yellow-100">
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
            className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white shadow-xl rounded-full w-12 h-12 sm:w-16 sm:h-16 p-0 transform hover:scale-110 transition-all duration-200"
            title="최근 본 보험"
          >
            <Clock className="h-5 w-5 sm:h-6 sm:w-6" />
          </Button>
        </div>
      )}
    </div>
  )
}
