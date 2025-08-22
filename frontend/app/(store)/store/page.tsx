"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, Plus } from "lucide-react"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import axios from "axios" // axios 직접 import
import { getBackendUrl } from '@/lib/api'

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
  isAdmin,
  isLoggedIn,
  onNavigateToStoreRegistration,
  products: initialProducts,
  onViewProduct,
  setCurrentPage,
}: StorePageProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState<"popular" | "latest" | "lowPrice" | "highPrice">("popular")
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [naverProducts, setNaverProducts] = useState<NaverProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showNaverProducts, setShowNaverProducts] = useState(true) // 초기에 네이버 상품 표시 모드 활성화
  const [naverSearchQuery, setNaverSearchQuery] = useState("")
  const [naverSearchLoading, setNaverSearchLoading] = useState(false)
  const [naverInitialLoading, setNaverInitialLoading] = useState(false) // 초기 네이버 상품 로딩 상태
  const [savingProducts, setSavingProducts] = useState<Set<string>>(new Set()) // 저장 중인 상품들

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
          console.log(`네이버 상품 저장 결과: ${result.isNewProduct ? '새 상품' : '기존 상품 업데이트'} - ${naverProduct.title}`);
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
      
      console.log(`네이버 상품 "${naverProduct.title}" 저장 완료`);
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
    console.log(`${products.length}개의 네이버 상품을 DB에 저장합니다...`);
    
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
      const response = await naverShoppingApi.searchSavedProducts(naverSearchQuery, 0, 100); // 더 많은 상품 가져오기
      if (response.success && response.data?.content) {
        const savedProducts = response.data.content.map((item: any) => ({
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
        setNaverProducts(savedProducts);
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

  // 통합 검색 함수
  const handleUnifiedSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setNaverSearchLoading(true);
    try {
      // 저장된 네이버 상품 검색 (더 많은 상품 가져오기)
      const naverResponse = await naverShoppingApi.searchSavedProducts(searchQuery, 0, 100);
      let naverResults: NaverProduct[] = [];
      
      if (naverResponse.success && naverResponse.data?.content) {
        naverResults = naverResponse.data.content.map((item: any) => ({
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
      }

      // 우리 스토어 검색 (기존 필터링 로직 사용)
      const filteredLocalProducts = products.filter((product) => {
        const lowerCaseQuery = searchQuery.toLowerCase();
        return (
          product.name.toLowerCase().includes(lowerCaseQuery) ||
          product.description.toLowerCase().includes(lowerCaseQuery) ||
          product.category.toLowerCase().includes(lowerCaseQuery)
        );
      });

      // 결과 합치기
      setNaverProducts(naverResults);
      setProducts(filteredLocalProducts);
      setShowNaverProducts(naverResults.length > 0); // 네이버 상품이 있을 때만 표시
      
    } catch (error) {
      // 오류 발생 시 조용히 처리
      setNaverProducts([]);
      setShowNaverProducts(false);
    } finally {
      setNaverSearchLoading(false);
    }
  };

  // 상품 API 함수들 - 백엔드와 직접 연결
  const productApi = {
    // 모든 상품 조회
    getProducts: async (): Promise<any[]> => {
      try {

        const response = await axios.get(`${getBackendUrl()}/api/products`);
        // ResponseDto 구조에 맞춰 데이터 추출
        return response.data?.data || response.data;
      } catch (error) {
        console.error('상품 목록 조회 실패:', error);
        throw error;
      }
    },

    // 특정 상품 조회
    getProduct: async (productId: number): Promise<any> => {
      try {
        const response = await axios.get(`${getBackendUrl()}/api/products/${productId}`);
        return response.data;
      } catch (error) {
        console.error('상품 조회 실패:', error);
        throw error;
      }
    },

    // 상품 생성
    createProduct: async (productData: any): Promise<any> => {
      try {
        const response = await axios.post(`${getBackendUrl()}/api/products`, productData, {
          headers: {
            'Content-Type': 'application/json',
          },
        });
        return response.data;
      } catch (error) {
        console.error('상품 생성 실패:', error);
        throw error;
      }
    },

    // 상품 수정
    updateProduct: async (productId: number, productData: any): Promise<any> => {
      try {
        const response = await axios.put(`${getBackendUrl()}/api/products/${productId}`, productData, {
          headers: {
            'Content-Type': 'application/json',
          },
        });
        return response.data;
      } catch (error) {
        console.error('상품 수정 실패:', error);
        throw error;
      }
    },

    // 상품 삭제
    deleteProduct: async (productId: number): Promise<void> => {
      try {
        await axios.delete(`${getBackendUrl()}/api/products/${productId}`);
      } catch (error) {
        console.error('상품 삭제 실패:', error);
        throw error;
      }
    },
  };

  const fetchProducts = async () => {
    try {
      setLoading(true)
      setError(null)
      console.log('상품 목록 가져오기 시작...');
      
      const response = await productApi.getProducts();
      console.log('가져온 상품 데이터:', response);
      
      // 백엔드 응답을 프론트엔드 형식으로 변환
      const data: Product[] = response.map((item: any) => ({
        ...item,
        id: item.id || item.productId || 0,  // id를 우선 사용
        productId: item.id || item.productId || 0,  // 호환성을 위해 productId도 설정
        imageUrl: item.imageUrl || item.image || '/placeholder.svg',
        petType: 'all',
        price: typeof item.price === 'number' ? item.price : 0,
        stock: typeof item.stock === 'number' ? item.stock : 0,
        category: item.category || '카테고리 없음',
        description: item.description || '상품 설명이 없습니다.',
        tags: item.tags || [],
        registrationDate: item.registrationDate || new Date().toISOString(),
        registeredBy: item.registeredBy || '등록자 없음'
      }));
      
      // 최신순으로 정렬 (registrationDate 기준 내림차순)
      const sortedData = data.sort((a, b) => {
        const dateA = new Date(a.registrationDate).getTime();
        const dateB = new Date(b.registrationDate).getTime();
        return dateB - dateA;
      });
      
      setProducts(sortedData);
      console.log('상품 목록 로드 완료:', sortedData.length, '개');
    } catch (error) {
      console.error("Error fetching products:", error);
      setError('상품 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false)
    }
  };

  useEffect(() => {
    const initializeStore = async () => {
      try {
        // 먼저 우리 스토어 상품들을 로드
        await fetchProducts();
        
        // 그 다음 네이버 상품들을 로드
        await loadInitialNaverProducts();
      } catch (error) {
        console.error('스토어 초기화 실패:', error);
        // 에러가 발생해도 기본 상품들은 표시되도록 함
      }
    };
    
    initializeStore();
  }, []);

  // 초기 네이버 상품 로드 - 저장된 상품들만 불러오기
  const loadInitialNaverProducts = async () => {
    try {
      setNaverInitialLoading(true);
      
      // 저장된 네이버 상품들을 불러오기 (모든 상품을 가져오기 위해 큰 size 설정)
      const savedResponse = await naverShoppingApi.getSavedProducts(0, 1000);
      if (savedResponse.success && savedResponse.data?.content && savedResponse.data.content.length > 0) {
        console.log('저장된 네이버 상품 발견:', savedResponse.data.content.length, '개');
        const savedProducts = savedResponse.data.content.map((item: any) => ({
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
          isSaved: true // 저장된 상품
        }));
        setNaverProducts(savedProducts);
        setShowNaverProducts(true); // 네이버 상품 표시 모드 활성화
      } else {
        // 저장된 상품이 없으면 조용히 처리 (오류 메시지 없음)
        setNaverProducts([]);
        setShowNaverProducts(false); // 네이버 상품이 없으면 표시하지 않음
      }
      
    } catch (error) {
      // 네트워크 오류 등이 발생해도 조용히 처리 (오류 메시지 없음)
      setNaverProducts([]);
      setShowNaverProducts(false);
    } finally {
      setNaverInitialLoading(false);
    }
  };

  // 상품 목록 새로고침 함수를 외부로 노출
  useEffect(() => {
    (window as any).refreshStoreProducts = fetchProducts;
    
    return () => {
      delete (window as any).refreshStoreProducts;
    };
  }, []);

  const handleSelectCategory = async (category: string) => {
    setSelectedCategory(category);
    setNaverSearchLoading(true);
    
    try {
      const response = await naverShoppingApi.searchByCategory(category, 0, 100); // 더 많은 상품 가져오기
      if (response.success && response.data?.content) {
        const categoryProducts = response.data.content.map((item: any) => ({
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
        setNaverProducts(categoryProducts);
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

  const handleAddToCart = async (product: Product) => {
    const isLoggedIn = !!localStorage.getItem("accessToken");
    if (!isLoggedIn) {
      alert("로그인이 필요합니다.");
      return;
    }
    
    try {
      const accessToken = localStorage.getItem("accessToken");
      
      // 일반 상품인 경우
      console.log('일반 상품 장바구니 추가:', product.id);
      
      const response = await axios.post(`${getBackendUrl()}/api/carts?productId=${product.id}&quantity=1`, null, {
        headers: {
          "Access_Token": accessToken,
          "Content-Type": "application/x-www-form-urlencoded"
        }
      });
      
      if (response.status === 200) {
        alert("장바구니에 추가되었습니다!");
        // 장바구니 페이지로 이동
        window.location.href = "/store/cart";
      } else {
        alert("장바구니 추가에 실패했습니다.");
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
      console.log('네이버 상품 장바구니 추가:', naverProduct.productId);
      
      // 네이버 상품 전용 API 사용
      const response = await axios.post(`${getBackendUrl()}/api/naver-shopping/cart/add`, {
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
      }, {
        params: { quantity: 1 },
        headers: {
          "Authorization": accessToken,
          "Content-Type": "application/json"
        }
      });
      
      if (response.status === 200) {
        alert("네이버 상품이 장바구니에 추가되었습니다!");
        // 장바구니 페이지로 이동
        window.location.href = "/store/cart";
      } else {
        alert("네이버 상품 장바구니 추가에 실패했습니다.");
      }
    } catch (error: any) {
      console.error("네이버 상품 장바구니 추가 오류:", error);
      alert("네이버 상품 장바구니 추가에 실패했습니다.");
    }
  };

  // 우리 스토어 상품과 네이버 상품을 통합하여 처리
  const allProducts = [...products]
  const allNaverProducts = [...naverProducts]

  const categoryItems = [
    { icon: "🥣", name: "사료", key: "사료" },
    { icon: "🐕", name: "간식", key: "간식" },
    { icon: "🎾", name: "장난감", key: "장난감" },
    { icon: "🛏️", name: "용품", key: "용품" },
    { icon: "👕", name: "의류", key: "의류" },
    { icon: "💊", name: "건강관리", key: "건강관리" },
  ]

  // 우리 스토어 상품 필터링
  const filteredLocalProducts = allProducts.filter((product) => {
    // Category filter
    if (selectedCategory) {
      const matchesCategory = product.category === selectedCategory;
      if (!matchesCategory) {
        return false;
      }
    }

    // Search query filter
    if (searchQuery.trim() !== "") {
      const lowerCaseQuery = searchQuery.toLowerCase();
      if (
        !product.name.toLowerCase().includes(lowerCaseQuery) &&
        !product.description.toLowerCase().includes(lowerCaseQuery)
      ) {
        return false;
      }
    }
    return true;
  });

  // 네이버 상품 필터링
  const filteredNaverProducts = allNaverProducts.filter((product) => {
    // Category filter
    if (selectedCategory) {
      const matchesCategory = 
        (product.category1 && product.category1.includes(selectedCategory)) ||
        (product.category2 && product.category2.includes(selectedCategory)) ||
        (product.category3 && product.category3.includes(selectedCategory)) ||
        (product.category4 && product.category4.includes(selectedCategory)) ||
        (product.title && product.title.includes(selectedCategory)) ||
        (product.description && product.description.includes(selectedCategory));
      
      if (!matchesCategory) {
        return false;
      }
    }

    // Search query filter
    if (searchQuery.trim() !== "") {
      const lowerCaseQuery = searchQuery.toLowerCase();
      if (
        !product.title.toLowerCase().includes(lowerCaseQuery) &&
        !product.description.toLowerCase().includes(lowerCaseQuery)
      ) {
        return false;
      }
    }
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
        case "popular":
          // 인기순은 기본적으로 최신순으로 처리
          const popDateA = a.registrationDate ? new Date(a.registrationDate).getTime() : new Date(a.createdAt).getTime();
          const popDateB = b.registrationDate ? new Date(b.registrationDate).getTime() : new Date(b.createdAt).getTime();
          return popDateB - popDateA;
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
            <Input
              type="text"
              placeholder="상품 검색 (멍토리 + 네이버 쇼핑)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-4 pr-12 py-3 border-2 border-yellow-300 rounded-full focus:border-yellow-400 focus:ring-yellow-400"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleUnifiedSearch();
                }
              }}
            />
            <Button
              size="sm"
              onClick={handleUnifiedSearch}
              className="absolute right-1 top-1/2 transform -translate-y-1/2 bg-yellow-400 hover:bg-yellow-500 text-black rounded-full p-2"
            >
              <Search className="w-4 h-4" />
            </Button>
          </div>
        </div>





        {/* Category Icons */}
        <div className="mb-8">
          <div className="grid grid-cols-4 md:grid-cols-7 gap-6 max-w-4xl mx-auto">
            {/* 전체 카테고리 */}
            <button 
              className={`flex flex-col items-center space-y-2 group ${selectedCategory === null ? 'text-blue-600' : ''}`} 
              onClick={() => {
                setSelectedCategory(null);
                loadInitialNaverProducts();
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
                onClick={() => handleSelectCategory(category.key)}
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
              onClick={() => setSortBy("popular")}
              className={`font-medium ${sortBy === "popular" ? "text-blue-600" : "text-gray-500 hover:text-gray-700"}`}
            >
              ● 인기순
            </button>
            <button
              onClick={() => setSortBy("latest")}
              className={`font-medium ${sortBy === "latest" ? "text-blue-600" : "text-gray-500 hover:text-gray-700"}`}
            >
              최신순
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
        {(naverSearchLoading || naverInitialLoading) ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto mb-4"></div>
              <p className="text-gray-600">
                {naverInitialLoading ? "네이버 상품을 불러오는 중..." : "검색 중..."}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {/* 우리 스토어 상품들 */}
            {sortedLocalProducts.map((product, index) => (
              <Card key={`local-${product.id}-${index}`} className="group cursor-pointer hover:shadow-lg transition-shadow relative">
                {/* Best 라벨 제거됨 */}
                <div className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded text-xs font-bold z-10">
                  멍토리
                </div>
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
                   <h3 className="font-medium text-sm text-gray-900 mb-2 line-clamp-2 leading-tight">{product.name}</h3>
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
              <Card key={`naver-${naverProduct.id}-${index}`} className="group cursor-pointer hover:shadow-lg transition-shadow relative">
                <div className="relative" onClick={() => {
                  try {
                    console.log("네이버 상품 클릭됨:", naverProduct);
                    if (typeof onViewProduct === 'function') {
                      onViewProduct(naverProduct);
                    } else {
                      // onViewProduct가 없으면 직접 라우팅
                      console.log("onViewProduct 함수가 없어 직접 라우팅합니다.");
                      const encodedId = encodeURIComponent(naverProduct.productId);
                      window.location.href = `/store/${encodedId}`;
                    }
                  } catch (error) {
                    console.error("onViewProduct 호출 중 오류:", error);
                    // 에러 발생 시에도 직접 라우팅
                    const encodedId = encodeURIComponent(naverProduct.productId);
                    window.location.href = `/store/${encodedId}`;
                  }
                }}>
                  <div className="aspect-square bg-gray-100 rounded-t-lg overflow-hidden">
                    <img
                      src={naverProduct.imageUrl}
                      alt={naverProduct.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = '/placeholder.svg?height=300&width=300';
                      }}
                    />

                  </div>
                  <div className="absolute top-2 right-2 bg-blue-500 text-white px-2 py-1 rounded text-xs font-bold z-10">
                    네이버
                  </div>
                  {/* 저장 상태 표시 제거됨 */}
                  {savingProducts.has(naverProduct.productId) && (
                    <div className="absolute top-2 left-2 bg-yellow-500 text-white px-2 py-1 rounded text-xs font-bold z-10">
                      저장중...
                    </div>
                  )}
                </div>
                <CardContent className="p-4">
                  <div className="mb-2" onClick={() => {
                    try {
                      console.log("네이버 상품 제목 클릭됨:", naverProduct);
                      if (typeof onViewProduct === 'function') {
                        onViewProduct(naverProduct);
                      } else {
                        // onViewProduct가 없으면 직접 라우팅
                        console.log("onViewProduct 함수가 없어 직접 라우팅합니다.");
                        const encodedId = encodeURIComponent(naverProduct.productId);
                        window.location.href = `/store/${encodedId}`;
                      }
                    } catch (error) {
                      console.error("onViewProduct 호출 중 오류:", error);
                      // 에러 발생 시에도 직접 라우팅
                      const encodedId = encodeURIComponent(naverProduct.productId);
                      window.location.href = `/store/${encodedId}`;
                    }
                  }}>
                    <h3 className="font-semibold text-sm text-gray-900 line-clamp-2 mb-1">
                      {removeHtmlTags(naverProduct.title)}
                    </h3>
                    <p className="text-xs text-gray-500 mb-1">{naverProduct.mallName}</p>
                    <p className="text-xs text-blue-600 mb-2">{naverProduct.category1 || '용품'}</p>
                    <div className="mb-2">
                      <span className="text-lg font-bold text-yellow-600">
                        {naverProduct.price ? naverProduct.price.toLocaleString() : '가격 정보 없음'}원
                      </span>
                    </div>
                  </div>
                </CardContent>

              </Card>
            ))}
          </div>
        )}

        {/* 빈 상태 메시지 */}
        {sortedLocalProducts.length === 0 && sortedNaverProducts.length === 0 && !naverSearchLoading && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">검색 결과가 없습니다.</p>
            <p className="text-gray-400 text-sm mt-2">다른 검색어를 입력해보세요.</p>
          </div>
        )}
      </div>
    </div>
  )
}