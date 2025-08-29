"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Sparkles, PawPrint, ExternalLink, Clock, ChevronDown } from "lucide-react"
import Image from "next/image"
import axios from "axios"
import { useRouter } from "next/navigation"
import { ProductRecommendationSlider } from "@/components/ui/product-recommendation-slider"
import { getBackendUrl } from '@/lib/api'
import { recentApi } from '@/lib/api'
import { RecentProductsSidebar } from "@/components/ui/recent-products-sidebar"
import { loadSidebarState, updateSidebarState } from "@/lib/sidebar-state"
import { useNaverProduct } from "@/hooks/use-store"

// axios 인터셉터 설정 - 요청 시 인증 토큰 자동 추가
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 응답 인터셉터 - 401 에러 시 토큰 갱신 시도
axios.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    if (error.response?.status === 401) {
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const response = await axios.post(`${getBackendUrl()}/api/accounts/refresh`, {
            refreshToken: refreshToken
          });
          const newAccessToken = response.data.accessToken;
          localStorage.setItem('accessToken', newAccessToken);
          
          // 원래 요청 재시도
          error.config.headers.Authorization = `${newAccessToken}`;
          return axios.request(error.config);
        } catch (refreshError) {
          // 토큰 갱신 실패 시 로그인 페이지로 리다이렉트
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
        }
      }
    }
    return Promise.reject(error);
  }
);

interface NaverProduct {
  id: number
  productId: string
  title: string
  description: string
  price: number
  imageUrl: string
  mallName: string
  productUrl: string
  brand: string
  maker: string
  category1: string
  category2: string
  category3: string
  category4: string
  reviewCount: number
  rating: number
  searchCount: number
}

interface PageProps {
  params?: {
    id: string
  }
}

export default function NaverProductDetailPage({ params }: PageProps) {
  const router = useRouter()
  
  // URL 파라미터에서 productId를 추출
  let productId: string | null = null
  
  if (params && params.id) {
    try {
      productId = decodeURIComponent(params.id);
    } catch (error) {
      console.error('URL 파라미터 디코딩 실패:', error);
      productId = params.id;
    }
  }
  
  // React Query로 상품 데이터 가져오기
  const { data: product, isLoading: loading, error: queryError } = useNaverProduct(productId || '')
  
  const [quantity, setQuantity] = useState(1)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  
  // 에러 상태를 문자열로 변환
  const error = queryError ? '상품을 불러오는데 실패했습니다.' : null

  // StoreAI 추천 관련 상태
  const [myPets, setMyPets] = useState<any[]>([]) // 모든 펫 목록
  const [selectedPet, setSelectedPet] = useState<any>(null) // 선택된 펫
  const [recommendations, setRecommendations] = useState<any[]>([])
  const [recommendationsLoading, setRecommendationsLoading] = useState(false)
  const [recommendationsError, setRecommendationsError] = useState<string | null>(null)

  // 최근 본 상품 사이드바
  const [showRecentSidebar, setShowRecentSidebar] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  // React Query가 상품 데이터를 자동으로 가져오므로 이 함수는 제거

  // 반려동물 정보 가져오기
  const fetchMyPets = async () => {
    try {
      const token = localStorage.getItem('accessToken')
      if (!token) return

      const response = await axios.get(`${getBackendUrl()}/api/mypet`, {
        headers: {
          "Access_Token": token,
          "Refresh_Token": localStorage.getItem('refreshToken') || ''
        }
      })
      
      // 백엔드 응답 구조: ResponseDto<MyPetListResponseDto>
      if (response.data && response.data.data && response.data.data.myPets && response.data.data.myPets.length > 0) {
        const pets = response.data.data.myPets
        setMyPets(pets)
        // 첫 번째 펫을 기본 선택
        setSelectedPet(pets[0])
      }
    } catch (error) {
      console.error('반려동물 정보 가져오기 실패:', error)
    }
  }

  // StoreAI 추천 API 호출
  const fetchRecommendations = async (petToUse = selectedPet) => {
    if (!petToUse) return

    setRecommendationsLoading(true)
    setRecommendationsError(null)
    
    try {
      // 네이버 상품인 경우 펫 기반 추천
      const response = await axios.get(`${getBackendUrl()}/api/storeai/recommend/my-pets`)

      if (response.data.success) {
        // 펫 기반 추천: Map<String, List<ProductRecommendationResponseDto>>
        const petRecommendations = response.data.data || {}
        // 선택된 펫의 추천을 사용
        const selectedPetName = petToUse.name
        const recommendations = selectedPetName && petRecommendations[selectedPetName] ? petRecommendations[selectedPetName] : []
        
        setRecommendations(recommendations)
      } else {
        setRecommendationsError('추천을 생성할 수 없습니다.')
      }
    } catch (error) {
      console.error('추천 API 호출 실패:', error)
      setRecommendationsError('추천을 불러오는데 실패했습니다.')
    } finally {
      setRecommendationsLoading(false)
    }
  }

  // 펫 선택 변경 핸들러
  const handlePetChange = (petId: string) => {
    const selected = myPets.find(pet => pet.myPetId.toString() === petId)
    if (selected) {
      setSelectedPet(selected)
    }
  }

  // 현재 사용자 정보 가져오기
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const token = localStorage.getItem('accessToken')
        if (token) {
          const response = await axios.get(`${getBackendUrl()}/api/accounts/me`, {
            headers: {
              "Access_Token": token,
              "Refresh_Token": localStorage.getItem('refreshToken') || ''
            }
          })
          setCurrentUser(response.data.data)
        }
      } catch (error) {
        console.error('사용자 정보 가져오기 실패:', error)
      }
    }
    fetchCurrentUser()
  }, [])

  // 반려동물 정보 가져오기
  useEffect(() => {
    fetchMyPets()
  }, [])

  // 반려동물 정보가 있으면 추천 가져오기
  useEffect(() => {
    if (selectedPet && product) {
      fetchRecommendations()
    }
  }, [selectedPet, product])

  // 사이드바 상태 로드 및 페이지 포커스 시 동기화
  useEffect(() => {
    const handleFocus = () => {
      const savedState = loadSidebarState()
      if (savedState.productType === 'store') {
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
    updateSidebarState({ isOpen: newIsOpen, productType: 'store' })
  }

  // localStorage 관련 함수들
  const getLocalRecentProducts = (): any[] => {
    try {
      const stored = localStorage.getItem('recentStoreProducts')
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  }

  const addToLocalRecentProducts = (product: NaverProduct) => {
    try {
      const products = getLocalRecentProducts()
      
      // 중복 체크 - naverProductId로 체크
      const existingIndex = products.findIndex(p => 
        p.naverProductId === product.productId || p.id === product.id
      )
      
      if (existingIndex > -1) {
        // 기존 항목 제거
        products.splice(existingIndex, 1)
      }
      
      // 필요한 정보만 추출하여 저장
      const simplifiedProduct = {
        id: product.id,
        naverProductId: product.productId,
        productName: product.title?.replace(/<[^>]*>/g, ''),
        name: product.title?.replace(/<[^>]*>/g, ''),
        title: product.title?.replace(/<[^>]*>/g, ''),
        description: product.description?.replace(/<[^>]*>/g, ''),
        logoUrl: product.imageUrl,
        imageUrl: product.imageUrl,
        price: product.price,
        type: 'store'
      }
      
      // 새 항목을 맨 앞에 추가
      products.unshift(simplifiedProduct)
      
      // 최대 15개만 유지
      if (products.length > 15) {
        products.splice(15)
      }
      
      localStorage.setItem('recentStoreProducts', JSON.stringify(products))
    } catch (error) {
      console.error("localStorage 저장 실패:", error)
    }
  }

  // React Query로 상품 데이터를 가져올 때 최근 본 상품에 추가
  useEffect(() => {
    if (product && productId) {
      // 최근 본 상품에 추가
      addToLocalRecentProducts(product)
      
      // 로그인 시 백엔드에도 추가
      const token = localStorage.getItem('accessToken')
      if (token) {
        try {
          recentApi.addToRecent(product.id, 'store')
        } catch (error) {
          console.error('백엔드 최근본 추가 실패:', error)
        }
      }
    }
  }, [product, productId])

  // 네이버 상품을 장바구니에 추가
  const handleAddToCart = async () => {
    if (!product) return;

    const isLoggedIn = !!localStorage.getItem("accessToken");
    if (!isLoggedIn) {
      alert("로그인이 필요합니다.");
      return;
    }
    
    try {
      setIsLoading(true);
      const accessToken = localStorage.getItem("accessToken");
      
      // 네이버 상품 전용 API 사용
      const response = await axios.post(`${getBackendUrl()}/api/naver-shopping/cart/add`, {
        productId: product.productId,
        title: product.title,
        description: product.description,
        price: product.price,
        imageUrl: product.imageUrl,
        mallName: product.mallName,
        productUrl: product.productUrl,
        brand: product.brand,
        maker: product.maker,
        category1: product.category1,
        category2: product.category2,
        category3: product.category3,
        category4: product.category4,
        reviewCount: product.reviewCount,
        rating: product.rating,
        searchCount: product.searchCount
      }, {
        params: { quantity },
        headers: {
          "Access_Token": accessToken,
          "Content-Type": "application/json"
        }
      });
      
      if (response.status === 200 && response.data.success) {
        alert("네이버 상품이 장바구니에 추가되었습니다!");
        // 장바구니 페이지로 이동 (전체 새로고침으로 데이터 확실하게 로드)
        window.location.href = "/store/cart";
      } else {
        throw new Error(response.data?.error?.message || "네이버 상품 장바구니 추가에 실패했습니다.");
      }
    } catch (error: any) {
      console.error("네이버 상품 장바구니 추가 오류:", error);
      alert("네이버 상품 장바구니 추가에 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  // 바로 구매
  const handleBuyNow = async () => {
    if (!product) return;

    const isLoggedIn = !!localStorage.getItem("accessToken");
    if (!isLoggedIn) {
      alert("로그인이 필요합니다.");
      return;
    }

    try {
      // 이미 데이터베이스에 저장된 상품이므로 product.id를 직접 사용
      const cleanTitle = product.title.replace(/<[^>]*>/g, ''); // HTML 태그 제거
      const params = new URLSearchParams({
        productId: product.id.toString(),
        productName: encodeURIComponent(cleanTitle),
        price: product.price.toString(),
        quantity: quantity.toString(),
        imageUrl: encodeURIComponent(product.imageUrl),
        isNaverProduct: 'true'
      });

      window.location.href = `/payment?${params.toString()}`;
    } catch (error) {
      console.error("바로 구매 오류:", error);
      alert("구매 처리에 실패했습니다.");
    }
  };



  // HTML 태그 제거 함수
  const removeHtmlTags = (text: string) => {
    return text.replace(/<[^>]*>/g, '');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">상품 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || '상품을 찾을 수 없습니다.'}</p>
          <Button onClick={() => router.push('/store')} className="bg-blue-600 hover:bg-blue-700">
            스토어로 돌아가기
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* 헤더 */}
        <div className="flex items-center mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/store')}
            className="mr-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            스토어로 돌아가기
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">네이버 상품 상세</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 상품 이미지 */}
          <div className="space-y-4">
            <div className="relative aspect-square bg-white rounded-lg overflow-hidden shadow-lg">
              <Image
                src={product.imageUrl}
                alt={product.title}
                fill
                className="object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = '/placeholder.svg?height=600&width=600';
                }}
              />
              <div className="absolute top-4 right-4">
                <Badge className="bg-blue-500 text-white">
                  네이버
                </Badge>
              </div>
            </div>
          </div>

          {/* 상품 정보 */}
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {removeHtmlTags(product.title)}
              </h1>
              <div className="flex items-center space-x-2 mb-4">
                <Badge variant="outline" className="text-sm">
                  {product.category1 || '카테고리 없음'}
                </Badge>
                <Badge variant="outline" className="text-sm">
                  강아지/고양이
                </Badge>
              </div>
            </div>

                         {/* 가격 정보 */}
             <div className="space-y-2">
               <p className="text-3xl font-bold text-yellow-600">
                 {product.price.toLocaleString()}원
               </p>
               <div className="flex items-center space-x-4 text-sm text-gray-600">
                 <span>판매자: {product.mallName}</span>
               </div>
             </div>

            {/* 수량 선택 */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">수량:</label>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1}
                >
                  -
                </Button>
                <span className="w-16 text-center font-medium">{quantity}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setQuantity(quantity + 1)}
                >
                  +
                </Button>
              </div>
            </div>

                         {/* 액션 버튼 */}
             <div className="space-y-3">
               <Button
                 onClick={handleAddToCart}
                 disabled={isLoading}
                 className="w-full bg-yellow-400 hover:bg-yellow-500 text-black py-3"
               >
                 {isLoading ? "처리 중..." : "장바구니에 추가"}
               </Button>
                               <Button
                  onClick={handleBuyNow}
                  variant="outline"
                  className="w-full py-3"
                >
                  바로 구매
                </Button>
               
             </div>

            {/* 상품 정보 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">상품 정보</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">상품 설명</h3>
                  <p className="text-gray-600 text-sm">
                    {removeHtmlTags(product.description)}
                  </p>
                </div>
                
                {product.brand && (
                  <div>
                    <h3 className="font-medium text-gray-900 mb-2">브랜드</h3>
                    <p className="text-gray-600 text-sm">{product.brand}</p>
                  </div>
                )}
                
                {product.maker && (
                  <div>
                    <h3 className="font-medium text-gray-900 mb-2">제조사</h3>
                    <p className="text-gray-600 text-sm">{product.maker}</p>
                  </div>
                )}

                <div>
                  <h3 className="font-medium text-gray-900 mb-2">카테고리</h3>
                  <div className="flex flex-wrap gap-2">
                    {[product.category1, product.category2, product.category3, product.category4]
                      .filter(Boolean)
                      .map((category, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {category}
                        </Badge>
                      ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* AI 추천 섹션 */}
        <div className="mt-12">
          <Card>
                         <CardHeader>
               <div className="flex items-center justify-between">
                 <div className="flex items-center gap-2">
                   <Sparkles className="w-6 h-6 text-orange-500" />
                   <CardTitle className="text-2xl">맞춤 추천</CardTitle>
                 </div>
                 {myPets.length > 1 && (
                   <Select value={selectedPet?.myPetId?.toString() || ""} onValueChange={handlePetChange}>
                     <SelectTrigger className="w-40">
                       <SelectValue placeholder="펫 선택" />
                     </SelectTrigger>
                     <SelectContent>
                       {myPets.map((pet) => (
                         <SelectItem key={pet.myPetId} value={pet.myPetId.toString()}>
                           {pet.name} ({pet.breed})
                         </SelectItem>
                       ))}
                     </SelectContent>
                   </Select>
                 )}
               </div>
               {selectedPet && (
                 <p className="text-base text-gray-600">
                   {selectedPet.name} ({selectedPet.breed}, {selectedPet.age}살)을 위한 맞춤 상품을 추천해드려요
                 </p>
               )}
             </CardHeader>
            <CardContent>
              {!selectedPet ? (
                <div className="text-center py-8">
                  <PawPrint className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">반려동물을 등록해주세요</h3>
                  <p className="text-gray-600 mb-4">
                    반려동물을 등록하면 맞춤 추천을 받을 수 있어요!
                  </p>
                  <Button 
                    onClick={() => router.push('/my')}
                    className="bg-orange-500 hover:bg-orange-600"
                  >
                    마이페이지에서 반려동물 등록하기
                  </Button>
                </div>
              ) : recommendationsLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-4"></div>
                  <p className="text-gray-600">맞춤 상품을 찾고 있어요...</p>
                </div>
              ) : recommendationsError ? (
                <div className="text-center py-8">
                  <p className="text-red-500 mb-4">{recommendationsError}</p>
                  <Button 
                    onClick={fetchRecommendations}
                    variant="outline"
                  >
                    다시 시도
                  </Button>
                </div>
              ) : recommendations && recommendations.length > 0 ? (
                <ProductRecommendationSlider 
                  products={recommendations} 
                  title=""
                  subtitle=""
                />
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-600">추천할 상품이 없습니다.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 최근 본 상품 사이드바 */}
      <RecentProductsSidebar
        productType="store"
        isOpen={showRecentSidebar}
        onToggle={handleSidebarToggle}
        refreshTrigger={refreshTrigger}
      />

      {/* 고정된 사이드바 토글 버튼 */}
      <div className="fixed top-20 right-6 z-40">
        <Button
          onClick={handleSidebarToggle}
          className="bg-yellow-400 hover:bg-yellow-500 text-black shadow-lg rounded-full w-14 h-14 p-0"
          title="최근 본 상품"
        >
          <Clock className="h-6 w-6 text-white" />
        </Button>
      </div>
    </div>
  );
}
