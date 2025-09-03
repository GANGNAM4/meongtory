"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, Plus, Clock } from "lucide-react"
import { useRouter } from "next/navigation"
import axios from "axios" // axios 직접 import
import { getBackendUrl } from '@/lib/api'
import { RecentProductsSidebar } from "@/components/ui/recent-products-sidebar"
import { loadSidebarState, updateSidebarState } from "@/lib/sidebar-state"
import { useProducts, useNaverProducts, useNaverProductSearch, useEmbeddingSearch, useMyPetSearch } from "@/hooks/use-store"
import { useAuth } from "@/components/navigation"
import { useQueryClient } from "@tanstack/react-query"

// axios 인터셉터 설정 - 요청 시 인증 토큰 자동 추가
axios.interceptors.request.use(
  (config) => {
    // 공개 엔드포인트 목록
    const PUBLIC_ENDPOINTS = [
      '/accounts/register',
      '/accounts/login',
      '/accounts/refresh',
      '/naver-shopping',
      '/products'
    ];
    
    // PUBLIC_ENDPOINTS에 포함된 경로에는 토큰을 추가하지 않음
    const isPublicEndpoint = PUBLIC_ENDPOINTS.some((endpoint) =>
      config.url?.includes(endpoint)
    );
    
    if (!isPublicEndpoint) {
      const token = localStorage.getItem('accessToken');
      if (token) {
        config.headers.Authorization = `${token}`;
        config.headers['Access_Token'] = token;
      }
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

interface Product {
  id: number
  name: string
  price: number
  imageUrl: string
  category: string
  description: string
  tags: string[]
  stock: number
  petType?: "dog" | "cat" | "all"
  registrationDate: string
  registeredBy: string
}

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
  createdAt: string
  updatedAt: string
  relatedProductId?: number
  isSaved?: boolean // DB 저장 상태 추가
  similarity?: number // 임베딩 검색 유사도 점수
}

interface StorePageProps {
  onClose: () => void
  onAddToWishlist: (product: Product) => void
  isInWishlist: (productId: number) => boolean
  isAdmin: boolean
  isLoggedIn: boolean
  onNavigateToStoreRegistration: () => void
  products: Product[]
  onViewProduct: (product: Product | NaverProduct) => void
  setCurrentPage?: (page: string) => void
}

export default function StorePage({
  onClose,
  onAddToWishlist,
  isInWishlist,
  isAdmin: propIsAdmin,
  isLoggedIn: propIsLoggedIn,
  onNavigateToStoreRegistration,
  products: initialProducts,
  onViewProduct,
  setCurrentPage,
}: StorePageProps) {
  // useAuth 훅을 사용하여 실제 인증 상태 가져오기
  const { isAdmin: authIsAdmin, isLoggedIn: authIsLoggedIn } = useAuth()
  
  // props로 받은 isAdmin과 AuthContext의 isAdmin을 모두 확인
  const canViewSimilarity = propIsAdmin || authIsAdmin;
  
  // props와 auth 상태를 병합 (auth 상태가 우선)
  const isAdmin = authIsAdmin || propIsAdmin
  const isLoggedIn = authIsLoggedIn || propIsLoggedIn
  
  // QueryClient 추가
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState<"latest" | "lowPrice" | "highPrice" | "similarity">("latest")
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  
  // @MyPet 자동완성 관련 상태
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [cursorPosition, setCursorPosition] = useState(0)
  const [selectedPetId, setSelectedPetId] = useState<number | null>(null)
  
  // ContentEditable 검색창용 ref
  const searchInputRef = useRef<HTMLDivElement>(null)
  
  // React Query hooks
  const { data: products = [], isLoading: productsLoading, error: productsError } = useProducts()
  const { 
    data: naverProductsData, 
    isLoading: naverProductsLoading, 
    error: naverProductsError,
    fetchNextPage: fetchNextNaverPage,
    hasNextPage: hasNextNaverPage,
    isFetchingNextPage: isFetchingNextNaverPage
  } = useNaverProducts()
  
  // 검색 관련 상태
  const [isSearchMode, setIsSearchMode] = useState(false)
  const [searchKeyword, setSearchKeyword] = useState("")
  const [aiSearchResults, setAiSearchResults] = useState<any[]>([])
  const [isAiSearchLoading, setIsAiSearchLoading] = useState(false)
  const { data: searchResults, isLoading: searchLoading } = useNaverProductSearch(searchKeyword, isSearchMode)
  const { data: embeddingResults, isLoading: embeddingLoading } = useEmbeddingSearch(searchKeyword, isSearchMode && searchKeyword.trim().length > 0)
  

  
  // MyPet 자동완성
  const [petSearchKeyword, setPetSearchKeyword] = useState("")
  const { data: petSuggestions = [], isLoading: petSearchLoading } = useMyPetSearch(petSearchKeyword, petSearchKeyword.length >= 0)
  
  // 기존 상태들 (React Query로 대체되지 않는 것들)
  const [showNaverProducts, setShowNaverProducts] = useState(true)
  const [savingProducts, setSavingProducts] = useState<Set<string>>(new Set())
  
  // 아직 사용 중인 상태들 (단계적으로 제거 예정)
  const [naverSearchQuery, setNaverSearchQuery] = useState("")
  const [naverSearchLoading, setNaverSearchLoading] = useState(false)
  const [naverInitialLoading, setNaverInitialLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [currentPage, setCurrentPageState] = useState(0)
  const [localNaverProducts, setNaverProducts] = useState<NaverProduct[]>([])
  
  // 전체 데이터 합치기
  const naverProducts = naverProductsData?.pages.flatMap(page => page.content) || []
  const loading = productsLoading || naverProductsLoading
  const error = productsError || naverProductsError ? '데이터를 불러오는데 실패했습니다.' : null

  // 최근 본 상품 사이드바
  const [showRecentSidebar, setShowRecentSidebar] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

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
  // 무한스크롤 관련 상태
  const observerRef = useRef<IntersectionObserver | null>(null)
  const loadingRef = useRef<HTMLDivElement>(null)

  // 네이버 쇼핑 API 함수들
  const naverShoppingApi = {
    // 저장된 네이버 상품 검색
    searchSavedProducts: async (keyword: string, page: number = 0, size: number = 20) => {
      try {
        const response = await axios.get(`${getBackendUrl()}/api/naver-shopping/products/search`, {
          params: { keyword, page, size }
        });
        return response.data;
      } catch (error) {
        console.error('저장된 네이버 상품 검색 실패:', error);
        throw error;
      }
    },

    // 카테고리별 검색
    searchByCategory: async (category: string, page: number = 0, size: number = 20) => {
      try {
        const response = await axios.get(`${getBackendUrl()}/api/naver-shopping/products/category/${encodeURIComponent(category)}`, {
          params: { page, size }
        });
        return response.data;
      } catch (error) {
        console.error('카테고리별 네이버 상품 검색 실패:', error);
        throw error;
      }
    },

    // 인기 상품 조회 (저장된 네이버 상품들)
    getPopularProducts: async (page: number = 0, size: number = 20) => {
      try {
        const response = await axios.get(`${getBackendUrl()}/api/naver-shopping/products/popular`, {
          params: { page, size }
        });
        return response.data;
      } catch (error) {
        console.error('인기 네이버 상품 조회 실패:', error);
        throw error;
      }
    },

    // 저장된 네이버 상품들 조회
    getSavedProducts: async (page: number = 0, size: number = 20) => {
      try {
        const response = await axios.get(`${getBackendUrl()}/api/naver-shopping/products/search`, {
          params: { keyword: '', page, size }
        });
        return response.data;
      } catch (error) {
        console.error('저장된 네이버 상품 조회 실패:', error);
        throw error;
      }
    },

    // 높은 평점 상품 조회
    getTopRatedProducts: async (page: number = 0, size: number = 20) => {
      try {
        const response = await axios.get(`${getBackendUrl()}/api/naver-shopping/products/top-rated`, {
          params: { page, size }
        });
        return response.data;
      } catch (error) {
        console.error('높은 평점 네이버 상품 조회 실패:', error);
        throw error;
      }
    },

    // 네이버 상품을 카트에 추가
    addToCart: async (naverProduct: NaverProduct, quantity: number = 1) => {
      try {
        // 로그인 상태 확인
        const token = localStorage.getItem('accessToken');
        if (!token) {
          throw new Error('로그인이 필요합니다.');
        }

        // NaverProductDto 형태로 변환
        const naverProductDto = {
          productId: naverProduct.productId,
          title: naverProduct.title,
          description: naverProduct.description,
          price: naverProduct.price,
          imageUrl: naverProduct.imageUrl,
          mallName: naverProduct.mallName,
          productUrl: naverProduct.productUrl,
          brand: naverProduct.brand,
          maker: naverProduct.maker,
          category1: naverProduct.category1,
          category2: naverProduct.category2,
          category3: naverProduct.category3,
          category4: naverProduct.category4,
          reviewCount: naverProduct.reviewCount,
          rating: naverProduct.rating,
          searchCount: naverProduct.searchCount
        };

        const response = await axios.post(`${getBackendUrl()}/api/naver-shopping/cart/add`, naverProductDto, {
          params: { quantity },
          headers: {
            'Authorization': token,
            'Content-Type': 'application/json'
          }
        });
        return response.data;
      } catch (error) {
        console.error('네이버 상품 장바구니 추가 실패:', error);
        throw error;
      }
    },

    // 네이버 상품을 DB에 저장
    saveNaverProduct: async (naverProduct: NaverProduct) => {
      try {
        const response = await axios.post(`${getBackendUrl()}/api/naver-shopping/save`, {
          productId: naverProduct.productId,
          title: naverProduct.title,
          description: naverProduct.description,
          price: naverProduct.price,
          imageUrl: naverProduct.imageUrl,
          mallName: naverProduct.mallName,
          productUrl: naverProduct.productUrl,
          brand: naverProduct.brand,
          maker: naverProduct.maker,
          category1: naverProduct.category1,
          category2: naverProduct.category2,
          category3: naverProduct.category3,
          category4: naverProduct.category4,
          reviewCount: naverProduct.reviewCount,
          rating: naverProduct.rating,
          searchCount: naverProduct.searchCount
        });
        
        // 새로운 응답 형식 처리
        if (response.data.success && response.data.data) {
          const result = response.data.data;
        }
        
        return response.data;
      } catch (error) {
        console.error('네이버 상품 저장 실패:', error);
        throw error;
      }
    }
  };

  // 네이버 상품을 DB에 저장하는 함수
  const saveNaverProductToDb = async (naverProduct: NaverProduct) => {
    if (savingProducts.has(naverProduct.productId)) {
      return; // 이미 저장 중인 상품은 중복 저장 방지
    }

    setSavingProducts(prev => new Set(prev).add(naverProduct.productId));
    
    try {
      await naverShoppingApi.saveNaverProduct(naverProduct);
      
      // 저장 성공 시 상품 상태 업데이트
      setNaverProducts(prev => prev.map(product => 
        product.productId === naverProduct.productId 
          ? { ...product, isSaved: true }
          : product
      ));
      
    } catch (error) {
      console.error(`네이버 상품 "${naverProduct.title}" 저장 실패:`, error);
    } finally {
      setSavingProducts(prev => {
        const newSet = new Set(prev);
        newSet.delete(naverProduct.productId);
        return newSet;
      });
    }
  };

  // 네이버 상품들을 일괄 저장하는 함수 (관리자 전용)
  const saveNaverProductsToDb = async (products: NaverProduct[]) => {
    // 관리자가 아닌 경우 저장하지 않음
    if (!isAdmin) {
      console.log('관리자가 아니므로 네이버 상품을 저장하지 않습니다.');
      return;
    }
    
    // isSaved 필드 확인 없이 모든 상품을 저장 시도
    
    // 병렬로 저장 (최대 5개씩)
    const batchSize = 5;
    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);
      await Promise.all(batch.map(product => saveNaverProductToDb(product)));
      
      // 배치 간 지연 (API 제한 방지)
      if (i + batchSize < products.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  };

  // 네이버 상품 검색 함수들
  const handleNaverSearch = async () => {
    if (!naverSearchQuery.trim()) return;
    
    setNaverSearchLoading(true);
    try {
      // 네이버 쇼핑 API를 통해 검색
      const response = await naverShoppingApi.searchSavedProducts(naverSearchQuery, 0, 100); // 더 많은 상품 가져오기
      if (response.success && response.data?.content) {
        const searchProducts = response.data.content.map((item: any) => ({
          id: item.id || item.productId || Math.random(),
          productId: item.productId || '',
          title: item.title || '제목 없음',
          description: item.description || '',
          price: parseInt(item.price) || 0,
          imageUrl: item.imageUrl || '/placeholder.svg',
          mallName: item.mallName || '판매자 정보 없음',
          productUrl: item.productUrl || '#',
          brand: item.brand || '',
          maker: item.maker || '',
          category1: item.category1 || '',
          category2: item.category2 || '',
          category3: item.category3 || '',
          category4: item.category4 || '',
          reviewCount: parseInt(item.reviewCount) || 0,
          rating: parseFloat(item.rating) || 0,
          searchCount: parseInt(item.searchCount) || 0,
          createdAt: item.createdAt || new Date().toISOString(),
          updatedAt: item.updatedAt || new Date().toISOString(),
          isSaved: true
        }));
        setNaverProducts(searchProducts);
        setShowNaverProducts(true);
      } else {
        // 검색 결과가 없으면 빈 배열로 설정
        setNaverProducts([]);
        setShowNaverProducts(false);
      }
    } catch (error) {
      // 오류 발생 시 조용히 처리
      setNaverProducts([]);
      setShowNaverProducts(false);
    } finally {
      setNaverSearchLoading(false);
    }
  };

  const handleNaverPopularProducts = async () => {
    setNaverSearchLoading(true);
    try {
      const response = await naverShoppingApi.getPopularProducts(0, 100); // 더 많은 상품 가져오기
      if (response.success && response.data?.content) {
        const popularProducts = response.data.content;
        setNaverProducts(popularProducts);
        setShowNaverProducts(true);
      } else {
        setNaverProducts([]);
        setShowNaverProducts(false);
      }
    } catch (error) {
      // 오류 발생 시 조용히 처리
      setNaverProducts([]);
      setShowNaverProducts(false);
    } finally {
      setNaverSearchLoading(false);
    }
  };

  const handleNaverTopRatedProducts = async () => {
    setNaverSearchLoading(true);
    try {
      const response = await naverShoppingApi.getTopRatedProducts(0, 100); // 더 많은 상품 가져오기
      if (response.success && response.data?.content) {
        const topRatedProducts = response.data.content;
        setNaverProducts(topRatedProducts);
        setShowNaverProducts(true);
      } else {
        setNaverProducts([]);
        setShowNaverProducts(false);
      }
    } catch (error) {
      // 오류 발생 시 조용히 처리
      setNaverProducts([]);
      setShowNaverProducts(false);
    } finally {
      setNaverSearchLoading(false);
    }
  };

  const router = useRouter();



  // 우리 스토어 상품을 장바구니에 추가하는 함수
  const handleAddLocalProductToCart = async (product: Product) => {
    try {
      // 백엔드 API 호출하여 장바구니에 추가
      const response = await axios.post(`${getBackendUrl()}/api/cart/add`, {
        productId: product.id,
        quantity: 1
      });
      
      if (response.status === 200) {
        alert('상품이 장바구니에 추가되었습니다!');
        
        // 카트 페이지로 이동
        if (setCurrentPage) {
          setCurrentPage("cart");
        } else {
          window.location.href = '/';
        }
      }
    } catch (error) {
      console.error('장바구니 추가 실패:', error);
      alert('장바구니 추가에 실패했습니다.');
    }
  };



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
              setShowSuggestions(true)
            }
          }
        } catch (error) {
          console.error('MyPet 검색 실패:', error)
        }
      }
    } else {
      setShowSuggestions(false)
    }
  }

  // @태그 감지 및 MyPet 자동완성
  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    const position = e.target.selectionStart || 0
    
    setSearchQuery(value)
    setCursorPosition(position)

    // @ 태그 검출
    const beforeCursor = value.substring(0, position)
    const match = beforeCursor.match(/@([ㄱ-ㅎ가-힣a-zA-Z0-9_]*)$/)
    
    if (match) {
      const keyword = match[1]
      setPetSearchKeyword(keyword)
      setShowSuggestions(true)      
    } else {
      setShowSuggestions(false)
      setPetSearchKeyword("")
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
  }

  // 통합 검색 함수 (React Query 기반)
  const handleUnifiedSearch = () => {
    setShowSuggestions(false) // 자동완성 숨기기
    
    if (!searchQuery.trim()) {
      // 검색어가 없으면 검색 모드 해제
      setIsSearchMode(false)
      setSearchKeyword("")
      setAiSearchResults([])
      // React Query 캐시도 초기화
      queryClient.removeQueries({ queryKey: ['naverProductSearch'] })
      queryClient.removeQueries({ queryKey: ['embeddingSearch'] })
      return;
    }

    // 새로운 검색 시작 시 이전 결과 초기화
    setAiSearchResults([])
    setSearchKeyword("")
    
    // React Query 캐시 초기화
    queryClient.removeQueries({ queryKey: ['naverProductSearch'] })
    queryClient.removeQueries({ queryKey: ['embeddingSearch'] })

    // @MyPet이 있는 경우 백엔드 통합 검색 API 호출 (기존 로직 유지)
    const petMatches = searchQuery.match(/@([ㄱ-ㅎ가-힣a-zA-Z0-9_]+)/g)
    if (petMatches && selectedPetId) {
      handlePetBasedSearch()
      return
    }
    
    // 일반 검색 모드 활성화 (임베딩 검색 우선)
    setIsSearchMode(true)
    setSearchKeyword(searchQuery.trim())
  }

  // MyPet 기반 검색 (기존 로직 유지)
  const handlePetBasedSearch = async () => {
    try {
      setIsAiSearchLoading(true)
      setAiSearchResults([])
      
      const response = await axios.get(`${getBackendUrl()}/api/global-search`, {
        params: {
          query: searchQuery,
          petId: selectedPetId,
          searchType: "store"
        }
      });
      
      if (response.data.success) {
        const searchResults = response.data.data;
        const results = searchResults.results || [];
        
        // AI 검색 결과를 상태에 저장
        setAiSearchResults(results)
        setIsSearchMode(true) // 검색 모드 활성화
      }
    } catch (error) {
      console.error('MyPet 기반 검색 실패:', error);
      // 실패 시 일반 검색으로 폴백
      setIsSearchMode(true)
      setSearchKeyword(searchQuery.trim())
    } finally {
      setIsAiSearchLoading(false)
    }
  }

  // React Query가 자동으로 데이터를 가져오므로 기존 초기화 로직 제거
  
  // 임시 호환성 함수들 (기존 코드와의 호환성을 위해)
  const loadSavedNaverProducts = async () => {
    // React Query로 대체됨
  };

  const fetchProducts = async () => {
    // React Query로 대체됨  
  };

  // React Query로 데이터 자동 관리되므로 기존 함수들 제거

  const handleAddToCart = async (product: Product) => {
    const isLoggedIn = !!localStorage.getItem("accessToken");
    if (!isLoggedIn) {
      alert("로그인이 필요합니다.");
      return;
    }
    
    try {
      const accessToken = localStorage.getItem("accessToken");
      
      // 일반 상품인 경우
      
      const response = await axios.post(`${getBackendUrl()}/api/carts?productId=${product.id}&quantity=1`, null, {
        headers: {
          "Access_Token": accessToken,
          "Content-Type": "application/x-www-form-urlencoded"
        }
      });
      
      if (response.status === 200 && response.data.success) {
        alert("장바구니에 추가되었습니다!");
        // 장바구니 페이지로 이동
        window.location.href = "/store/cart";
      } else {
        throw new Error(response.data?.error?.message || "장바구니 추가에 실패했습니다.");
      }
    } catch (error: any) {
      console.error("장바구니 추가 오류:", error);
      if (error.response?.data?.message?.includes('재고가 부족합니다')) {
        alert(error.response.data.message);
      } else {
        alert("장바구니 추가에 실패했습니다.");
      }
    }
  };

  // 네이버 상품을 장바구니에 추가하는 함수
  const handleAddNaverProductToCart = async (naverProduct: NaverProduct) => {
    const isLoggedIn = !!localStorage.getItem("accessToken");
    if (!isLoggedIn) {
      alert("로그인이 필요합니다.");
      return;
    }
    
    try {
      const accessToken = localStorage.getItem("accessToken");
      
      // 요청 데이터 준비 및 검증
      const requestData = {
        productId: naverProduct.productId || '',
        title: naverProduct.title || '',
        description: naverProduct.description || naverProduct.title || '',
        price: naverProduct.price || 0,
        imageUrl: naverProduct.imageUrl || '',
        mallName: naverProduct.mallName || '',
        productUrl: naverProduct.productUrl || '',
        brand: naverProduct.brand || '',
        maker: naverProduct.maker || '',
        category1: naverProduct.category1 || '',
        category2: naverProduct.category2 || '',
        category3: naverProduct.category3 || '',
        category4: naverProduct.category4 || '',
        reviewCount: naverProduct.reviewCount || 0,
        rating: naverProduct.rating || 0.0,
        searchCount: naverProduct.searchCount || 0
      };
      
      // 네이버 상품 전용 API 사용
      const response = await axios.post(`${getBackendUrl()}/api/naver-shopping/cart/add`, requestData, {
        params: { quantity: 1 },
        headers: {
          "Access_Token": accessToken,
          "Content-Type": "application/json"
        }
      });
      
      if (response.status === 200 && response.data.success) {
        alert("네이버 상품이 장바구니에 추가되었습니다!");
        // 장바구니 페이지로 이동
        window.location.href = "/store/cart";
      } else {
        throw new Error(response.data?.error?.message || "네이버 상품 장바구니 추가에 실패했습니다.");
      }
    } catch (error: any) {
      console.error("네이버 상품 장바구니 추가 오류:", error);
      console.error("오류 상세 정보:", error.response?.data);
      console.error("오류 상태 코드:", error.response?.status);
      console.error("오류 메시지:", error.response?.data?.error?.message);
      alert("네이버 상품 장바구니 추가에 실패했습니다.");
    }
  };

  // 검색 모드에 따른 상품 데이터 결정
  const displayProducts = isSearchMode ? [] : products
  const displayNaverProducts = isSearchMode 
    ? (aiSearchResults.length > 0 
        ? aiSearchResults 
        : (embeddingResults && embeddingResults.length > 0 
            ? embeddingResults 
            : (searchResults?.pages.flatMap(page => page.content) || [])))
    : naverProducts

  const categoryItems = [
    { icon: "🥣", name: "사료", key: "사료" },
    { icon: "🐕", name: "간식", key: "간식" },
    { icon: "🎾", name: "장난감", key: "장난감" },
    { icon: "🛏️", name: "용품", key: "용품" },
    { icon: "👕", name: "의류", key: "의류" },
    { icon: "💊", name: "건강관리", key: "건강관리" },
  ]

  // 우리 스토어 상품 필터링
  const filteredLocalProducts = displayProducts.filter((product) => {
    // Category filter
    if (selectedCategory) {
      const matchesCategory = product.category === selectedCategory;
      if (!matchesCategory) {
        return false;
      }
    }

    // Search query filter (검색 모드가 아닐 때만 적용)
    if (!isSearchMode && searchQuery.trim() !== "") {
      const lowerCaseQuery = searchQuery.toLowerCase();
      if (
        !(product.name && typeof product.name === 'string' && product.name.toLowerCase().includes(lowerCaseQuery)) &&
        !(product.description && typeof product.description === 'string' && product.description.toLowerCase().includes(lowerCaseQuery))
      ) {
        return false;
      }
    }
    return true;
  });

  // 네이버 상품 필터링
  const filteredNaverProducts = displayNaverProducts.filter((product) => {
    // Category filter
    if (selectedCategory) {
      const matchesCategory = 
        (product.category1 && typeof product.category1 === 'string' && product.category1.includes(selectedCategory)) ||
        (product.category2 && typeof product.category2 === 'string' && product.category2.includes(selectedCategory)) ||
        (product.category3 && typeof product.category3 === 'string' && product.category3.includes(selectedCategory)) ||
        (product.category4 && typeof product.category4 === 'string' && product.category4.includes(selectedCategory)) ||
        (product.title && typeof product.title === 'string' && product.title.includes(selectedCategory)) ||
        (product.description && typeof product.description === 'string' && product.description.includes(selectedCategory));
      
      if (!matchesCategory) {
        return false;
      }
    }

    // 검색 모드에서는 추가 필터링 하지 않음 (이미 검색된 결과)
    return true;
  });

  // 통합 정렬 함수
  const sortProducts = (productList: any[]) => {
    return [...productList].sort((a, b) => {
      switch (sortBy) {
        case "latest":
          // 네이버 상품은 createdAt, 우리 상품은 registrationDate 사용
          const dateA = a.registrationDate ? new Date(a.registrationDate).getTime() : new Date(a.createdAt).getTime();
          const dateB = b.registrationDate ? new Date(b.registrationDate).getTime() : new Date(b.createdAt).getTime();
          return dateB - dateA;
        case "lowPrice":
          return a.price - b.price;
        case "highPrice":
          return b.price - a.price;
        case "similarity":
          // 유사도 점수 기준 정렬 (높은 순)
          const similarityA = a.similarity || 0;
          const similarityB = b.similarity || 0;
          return similarityB - similarityA;
        default:
          return 0;
      }
    });
  };

  // 정렬된 상품들
  const sortedLocalProducts = sortProducts(filteredLocalProducts);
  const sortedNaverProducts = sortProducts(filteredNaverProducts);

  // HTML 태그 제거 함수
  const removeHtmlTags = (text: string) => {
    return text.replace(/<[^>]*>/g, '');
  };

  // 무한스크롤을 위한 IntersectionObserver 설정 (React Query Infinite Query 사용)
  const lastElementRef = useCallback((node: HTMLDivElement) => {
    if (isFetchingNextNaverPage) return
    
    if (observerRef.current) observerRef.current.disconnect()
    
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasNextNaverPage && !isFetchingNextNaverPage) {
        fetchNextNaverPage()
      }
    })
    
    if (node) observerRef.current.observe(node)
  }, [hasNextNaverPage, isFetchingNextNaverPage, fetchNextNaverPage])

  // 로딩 상태 표시
  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400 mx-auto mb-4"></div>
          <p className="text-gray-600">상품 목록을 불러오는 중...</p>
        </div>
      </div>
    )
  }

  // 에러 상태 표시
  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={fetchProducts} className="bg-yellow-400 hover:bg-yellow-500 text-black">
            다시 시도
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">스토어</h1>
            <p className="text-gray-600">반려동물을 위한 다양한 상품을 만나보세요</p>
          </div>
        
        </div>



        {/* 통합 검색 바 */}
        <div className="flex justify-center mb-8">
          <div className="relative w-full max-w-md">
            {/* MyPet 자동완성 드롭다운 */}
            {showSuggestions && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto z-10">
                {petSearchLoading ? (
                  <div className="p-3 text-center text-gray-500">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400 mx-auto mb-2"></div>
                    검색 중...
                  </div>
                ) : petSuggestions.length > 0 ? (
                  petSuggestions.map((pet: any) => (
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
                  ))
                ) : (
                  <div className="p-3 text-center text-gray-500">
                    {petSearchKeyword === "" ? "펫 이름을 입력해주세요" : "검색 결과가 없습니다."}
                  </div>
                )}
              </div>
            )}
            
            <Input
              type="text"
              placeholder="상품 검색"
              value={searchQuery}
              onChange={handleSearchInputChange}
              className="pl-4 pr-10 py-3 border-2 border-yellow-300 rounded-full focus:border-yellow-400 focus:ring-yellow-400 hover:border-yellow-300 search-input"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleUnifiedSearch();
                }
              }}
              style={{
                color: 'transparent',
                caretColor: 'black',
                fontFamily: 'inherit',
                fontSize: '16px',
                lineHeight: '24px',
                letterSpacing: 'normal',
                fontWeight: 'normal',
                borderColor: '#fbbf24',
                outline: 'none'
              }}
            />
            {/* @태그 하이라이트 오버레이 */}
            <div 
              className="absolute top-0 left-0 right-0 bottom-0 pointer-events-none flex items-center"
              style={{
                paddingLeft: '16px',
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
            <Button
              size="sm"
              onClick={handleUnifiedSearch}
              className="absolute right-0 top-1/2 transform -translate-y-1/2 bg-yellow-400 text-black rounded-full w-10 h-10 p-0 flex items-center justify-center"
              style={{ 
                backgroundColor: '#fbbf24',
                outline: 'none'
              }}
            >
              <Search className="w-5 h-5" />
            </Button>
          </div>
        </div>
        
        <style jsx global>{`
          .relative input:hover {
            border-color: #fbbf24 !important;
            outline: none !important;
          }
          .relative input:focus {
            border-color: #fbbf24 !important;
            outline: none !important;
            box-shadow: none !important;
            ring: none !important;
            ring-color: transparent !important;
            ring-offset: none !important;
          }
          .relative input:focus-visible {
            border-color: #fbbf24 !important;
            outline: none !important;
            box-shadow: none !important;
            ring: none !important;
            ring-color: transparent !important;
            ring-offset: none !important;
          }
          .relative button:hover {
            background-color: #fbbf24 !important;
            outline: none !important;
          }
          .relative button:focus {
            background-color: #fbbf24 !important;
            outline: none !important;
            box-shadow: none !important;
            ring: none !important;
            ring-color: transparent !important;
            ring-offset: none !important;
          }
          .relative button:focus-visible {
            background-color: #fbbf24 !important;
            outline: none !important;
            box-shadow: none !important;
            ring: none !important;
            ring-color: transparent !important;
            ring-offset: none !important;
          }
          /* 모든 포커스 관련 스타일 제거 */
          *:focus {
            outline: none !important;
            box-shadow: none !important;
          }
          *:focus-visible {
            outline: none !important;
            box-shadow: none !important;
          }
          
          /* @태그 하이라이팅 */
          .search-input::placeholder {
            color: #9ca3af;
          }
        `}</style>





        {/* Category Icons */}
        <div className="mb-8">
          <div className="grid grid-cols-4 md:grid-cols-7 gap-6 max-w-4xl mx-auto">
            {/* 전체 카테고리 */}
            <button 
              className={`flex flex-col items-center space-y-2 group ${selectedCategory === null ? 'text-blue-600' : ''}`} 
              onClick={() => {
                setSelectedCategory(null);
                setIsSearchMode(false);
                setSearchKeyword("");
                setSearchQuery(""); 
                setAiSearchResults([]); 
                // React Query 캐시도 초기화
                queryClient.removeQueries({ queryKey: ['naverProductSearch'] })
                queryClient.removeQueries({ queryKey: ['embeddingSearch'] })
              }}
            >
              <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl transition-colors ${
                selectedCategory === null ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 group-hover:bg-gray-200'
              }`}>
                🏠
              </div>
              <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">전체</span>
            </button>
            
            {categoryItems.map((category) => (
              <button 
                key={category.key} 
                className={`flex flex-col items-center space-y-2 group ${selectedCategory === category.key ? 'text-blue-600' : ''}`} 
                onClick={() => {
                  setSelectedCategory(category.key);
                  setIsSearchMode(false);
                  setSearchKeyword("");
                  setSearchQuery(""); 
                  setAiSearchResults([]); 
                  // React Query 캐시도 초기화
                  queryClient.removeQueries({ queryKey: ['naverProductSearch'] })
                  queryClient.removeQueries({ queryKey: ['embeddingSearch'] })
                }}
              >
                <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl transition-colors ${
                  selectedCategory === category.key ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 group-hover:bg-gray-200'
                }`}>
                  {category.icon}
                </div>
                <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">{category.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Sort Options */}
        <div className="flex justify-end mb-6">
          <div className="flex items-center space-x-4 text-sm">
            <button
              onClick={() => setSortBy("latest")}
              className={`font-medium ${sortBy === "latest" ? "text-blue-600" : "text-gray-500 hover:text-gray-700"}`}
            >
              ● 최신순
            </button>
            <button
              onClick={() => setSortBy("lowPrice")}
              className={`font-medium ${sortBy === "lowPrice" ? "text-blue-600" : "text-gray-500 hover:text-gray-700"}`}
            >
              낮은 가격순
            </button>
            <button
              onClick={() => setSortBy("highPrice")}
              className={`font-medium ${
                sortBy === "highPrice" ? "text-blue-600" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              높은 가격순
            </button>
        
          </div>
        </div>

        {/* 통합 상품 그리드 */}
        {(loading || searchLoading || embeddingLoading || isAiSearchLoading) ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto mb-4"></div>
              <p className="text-gray-600">
                {isSearchMode ? (isAiSearchLoading ? "AI 검색 중..." : "검색 중...") : "상품을 불러오는 중..."}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {/* 우리 스토어 상품들 */}
            {sortedLocalProducts.map((product, index) => (
              <Card key={`local-${product.id}-${index}`} className="group cursor-pointer hover:shadow-lg transition-shadow relative">
                <div className="relative">
                  <div className="aspect-square bg-gray-100 rounded-t-lg overflow-hidden cursor-pointer" onClick={() => window.location.href = `/store/${product.id}`}>
                    <img
                      src={product.imageUrl || "/placeholder.svg"}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  </div>
                </div>
                <CardContent className="p-4 cursor-pointer" onClick={() => window.location.href = `/store/${product.id}`}>
                  <div className="h-[3rem] mb-1 flex flex-col justify-start">
                    <h3 className="font-semibold text-sm text-gray-900 line-clamp-2 leading-tight">{product.name}</h3>
                    <div className="flex-1"></div>
                  </div>
                  <p className="text-xs text-gray-500 mb-1">멍토리</p>
                  <p className="text-xs text-blue-600 mb-2">{product.category || '용품'}</p>
                  <p className="text-lg font-bold text-yellow-600">{product.price.toLocaleString()}원</p>
                  {product.stock === 0 && (
                    <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg">
                      <span className="text-white font-bold">품절</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}

            {/* 네이버 상품들 */}
            {sortedNaverProducts.map((naverProduct, index) => (
              <Card 
                key={`naver-${naverProduct.id}-${index}`} 
                className="group cursor-pointer relative border border-gray-100 hover:border-yellow-300 hover:shadow-lg hover:shadow-yellow-100/60 transition-all duration-200 will-change-transform"
                ref={index === sortedNaverProducts.length - 1 ? lastElementRef : undefined}
              >
                <div className="relative" onClick={() => {
                  try {
                    if (typeof onViewProduct === 'function') {
                      onViewProduct(naverProduct);
                    } else {
                      // onViewProduct가 없으면 직접 라우팅
                      const encodedId = encodeURIComponent(naverProduct.productId);
                      window.location.href = `/store/naver/${encodedId}`;
                    }
                  } catch (error) {
                    console.error("onViewProduct 호출 중 오류:", error);
                    // 에러 발생 시에도 직접 라우팅
                    const encodedId = encodeURIComponent(naverProduct.productId);
                    window.location.href = `/store/naver/${encodedId}`;
                  }
                }}>
                  <div className="aspect-square bg-white rounded-t-lg overflow-hidden ring-1 ring-gray-100">
                    <img
                      src={naverProduct.imageUrl}
                      alt={naverProduct.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = '/placeholder.svg?height=300&width=300';
                      }}
                    />
                  </div>

                  {/* 네이버 배지 제거 */}
                  {savingProducts.has(naverProduct.productId) && (
                    <div className="absolute top-2 left-2 bg-yellow-500 text-white px-2 py-1 rounded text-xs font-bold z-10">
                      저장중...
                    </div>
                  )}
                                    {/* 임베딩 검색 유사도 점수 표시 (관리자만) */}
                  {canViewSimilarity && isSearchMode && naverProduct.similarity !== undefined && naverProduct.similarity !== null && (
                    <div className="absolute bottom-2 left-2 bg-purple-500 text-white px-2 py-1 rounded text-xs font-bold z-10">
                      유사도: {(naverProduct.similarity * 100).toFixed(1)}%
                    </div>
                  )}
                </div>
                <CardContent className="p-4">
                  <div className="mb-2" onClick={() => {
                    try {
                      if (typeof onViewProduct === 'function') {
                        onViewProduct(naverProduct);
                      } else {
                        // onViewProduct가 없으면 직접 라우팅
                        // 모든 경우에 productId를 사용 (백엔드 API가 productId로 조회)
                        let productId = naverProduct.productId;
                        if (!productId) {
                          console.error('productId가 없음:', naverProduct);
                          return;
                        }
                        
                        const encodedId = encodeURIComponent(productId);
                        const targetUrl = `/store/naver/${encodedId}`;
                        window.location.href = targetUrl;
                      }
                    } catch (error) {
                      console.error("onViewProduct 호출 중 오류:", error);
                      // 에러 발생 시에도 직접 라우팅 (productId 사용)
                      let productId = naverProduct.productId;
                      
                      if (!productId) {
                        console.error('에러 처리 중에도 productId가 없음:', naverProduct);
                        return;
                      }
                      
                      const encodedId = encodeURIComponent(productId);
                      const targetUrl = `/store/naver/${encodedId}`;
                      window.location.href = targetUrl;
                    }
                  }}>
                    <div className="h-[3rem] mb-1 flex flex-col justify-start">
                      <h3 className="font-semibold text-sm text-gray-900/90 leading-tight line-clamp-2">
                        {removeHtmlTags(naverProduct.title)}
                      </h3>
                      <div className="flex-1"></div>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="inline-flex items-center rounded-full bg-gray-100 text-gray-600 px-2 py-0.5 text-[11px]">
                        {naverProduct.mallName}
                      </span>
                      <span className="inline-flex items-center rounded-full bg-blue-50 text-blue-600 px-2 py-0.5 text-[11px]">
                        {selectedCategory || naverProduct.category1 || '용품'}
                      </span>
                    </div>
                    <div className="mb-1">
                      <span className="text-lg font-extrabold text-yellow-600 tracking-tight">
                        {naverProduct.price ? naverProduct.price.toLocaleString() : '가격 정보 없음'}원
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* 무한스크롤 로딩 인디케이터 */}
        {isFetchingNextNaverPage && (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto mb-2"></div>
              <p className="text-gray-600 text-sm">로딩중...</p>
            </div>
          </div>
        )}

        {/* 더 이상 로드할 상품이 없을 때 메시지 */}
        {!hasNextNaverPage && sortedNaverProducts.length > 0 && !isFetchingNextNaverPage && (
          <div className="text-center py-8">
            <p className="text-gray-500 text-sm">모든 상품을 불러왔습니다.</p>
          </div>
        )}

        {/* 빈 상태 메시지 */}
        {sortedLocalProducts.length === 0 && sortedNaverProducts.length === 0 && !loading && !searchLoading && !embeddingLoading && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">검색 결과가 없습니다.</p>
            <p className="text-gray-400 text-sm mt-2">다른 검색어를 입력해보세요.</p>
          </div>
        )}
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
  )
}