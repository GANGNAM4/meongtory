"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, Plus, ShoppingCart } from "lucide-react"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import axios from "axios" // axios 직접 import
import { getBackendUrl } from '@/lib/api'


const API_BASE_URL = `${getBackendUrl()}/api`

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
          const response = await axios.post(`${API_BASE_URL}/accounts/refresh`, {
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
  targetAnimal?: "ALL" | "DOG" | "CAT"
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
  isAdmin: boolean
  isLoggedIn: boolean
  onNavigateToStoreRegistration: () => void
  products: Product[]
  onViewProduct: (product: Product | NaverProduct) => void
  setCurrentPage?: (page: string) => void
}

export default function StorePage({
  onClose,
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
  const [showNaverProducts, setShowNaverProducts] = useState(false)
  const [naverSearchQuery, setNaverSearchQuery] = useState("")
  const [naverSearchLoading, setNaverSearchLoading] = useState(false)
  const [savingProducts, setSavingProducts] = useState<Set<string>>(new Set()) // 저장 중인 상품들

  // 네이버 쇼핑 API 함수들
  const naverShoppingApi = {
    // 실시간 검색
    searchProducts: async (query: string, display: number = 10, start: number = 1, sort: string = "sim") => {
      try {
        const response = await axios.post(`${API_BASE_URL}/naver-shopping/search`, {
          query,
          display,
          start,
          sort
        });
        return response.data;
      } catch (error) {
        console.error('네이버 쇼핑 검색 실패:', error);
        throw error;
      }
    },

    // 저장된 네이버 상품 검색
    searchSavedProducts: async (keyword: string, page: number = 0, size: number = 20) => {
      try {
        const response = await axios.get(`${API_BASE_URL}/naver-shopping/products/search`, {
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
        const response = await axios.get(`${API_BASE_URL}/naver-shopping/products/category/${encodeURIComponent(category)}`, {
          params: { page, size }
        });
        return response.data;
      } catch (error) {
        console.error('카테고리별 네이버 상품 검색 실패:', error);
        throw error;
      }
    },

    // 인기 상품 조회
    getPopularProducts: async (page: number = 0, size: number = 20) => {
      try {
        const response = await axios.get(`${API_BASE_URL}/naver-shopping/products/popular`, {
          params: { page, size }
        });
        return response.data;
      } catch (error) {
        console.error('인기 네이버 상품 조회 실패:', error);
        throw error;
      }
    },

    // 높은 평점 상품 조회
    getTopRatedProducts: async (page: number = 0, size: number = 20) => {
      try {
        const response = await axios.get(`${API_BASE_URL}/naver-shopping/products/top-rated`, {
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
        const response = await axios.post(`${API_BASE_URL}/naver-shopping/cart/add`, naverProduct, {
          params: { quantity }
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
        const response = await axios.post(`${API_BASE_URL}/naver-shopping/save`, {
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

  // 네이버 상품들을 일괄 저장하는 함수
  const saveNaverProductsToDb = async (products: NaverProduct[]) => {
    // isSaved 필드 확인 없이 모든 상품을 저장 시도
    console.log(`${products.length}개의 네이버 상품을 DB에 저장합니다...`);
    
    // 병렬로 저장 (최대 5개씩)
    const batchSize = 5;
    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);
      await Promise.all(batch.map(product => saveNaverProductToDb(product)));
      
      // 배치 간 약간의 지연
      if (i + batchSize < products.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  };

  // 네이버 상품 검색 함수들
  const handleNaverSearch = async () => {
    if (!naverSearchQuery.trim()) return;
    
    setNaverSearchLoading(true);
    try {
      const response = await naverShoppingApi.searchProducts(naverSearchQuery, 20);
      if (response.success && response.data?.items) {
        // 네이버 API 응답 데이터를 안전하게 변환
        const safeProducts = response.data.items.map((item: any) => ({
          id: item.productId || Math.random(),
          productId: item.productId || '',
          title: item.title || '제목 없음',
          description: item.description || '',
          price: parseInt(item.lprice) || 0,
          imageUrl: item.image || '/placeholder.svg',
          mallName: item.mallName || '판매자 정보 없음',
          productUrl: item.link || '#',
          brand: item.brand || '',
          maker: item.maker || '',
          category1: item.category1 || '',
          category2: item.category2 || '',
          category3: item.category3 || '',
          category4: item.category4 || '',
          reviewCount: parseInt(item.reviewCount) || 0,
          rating: parseFloat(item.rating) || 0,
          searchCount: parseInt(item.searchCount) || 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isSaved: false
        }));
        setNaverProducts(safeProducts);
        setShowNaverProducts(true);
        
        // 검색된 네이버 상품들을 DB에 자동 저장
        setTimeout(() => {
          saveNaverProductsToDb(safeProducts);
        }, 500);
      }
    } catch (error) {
      console.error('네이버 검색 실패:', error);
      setError('네이버 검색에 실패했습니다.');
    } finally {
      setNaverSearchLoading(false);
    }
  };

  const handleNaverPopularProducts = async () => {
    setNaverSearchLoading(true);
    try {
      const response = await naverShoppingApi.getPopularProducts(0, 20);
      if (response.success && response.data?.content) {
        const popularProducts = response.data.content;
        setNaverProducts(popularProducts);
        setShowNaverProducts(true);
        
        // 인기 네이버 상품들을 DB에 자동 저장
        setTimeout(() => {
          saveNaverProductsToDb(popularProducts);
        }, 500);
      }
    } catch (error) {
      console.error('인기 네이버 상품 조회 실패:', error);
      setError('인기 상품 조회에 실패했습니다.');
    } finally {
      setNaverSearchLoading(false);
    }
  };

  const handleNaverTopRatedProducts = async () => {
    setNaverSearchLoading(true);
    try {
      const response = await naverShoppingApi.getTopRatedProducts(0, 20);
      if (response.success && response.data?.content) {
        const topRatedProducts = response.data.content;
        setNaverProducts(topRatedProducts);
        setShowNaverProducts(true);
        
        // 높은 평점 네이버 상품들을 DB에 자동 저장
        setTimeout(() => {
          saveNaverProductsToDb(topRatedProducts);
        }, 500);
      }
    } catch (error) {
      console.error('높은 평점 네이버 상품 조회 실패:', error);
      setError('높은 평점 상품 조회에 실패했습니다.');
    } finally {
      setNaverSearchLoading(false);
    }
  };

  const router = useRouter();

  const handleAddNaverProductToCart = async (naverProduct: NaverProduct) => {
    try {
      await naverShoppingApi.addToCart(naverProduct, 1);
      alert('네이버 상품이 카트에 추가되었습니다!');
      
      console.log('네이버 상품 장바구니 추가 성공, setCurrentPage 함수 확인:', !!setCurrentPage);
      
      // 카트 페이지로 이동
      if (setCurrentPage) {
        console.log('setCurrentPage("cart") 호출');
        setCurrentPage("cart");
      } else {
        console.log('setCurrentPage가 없어서 홈으로 이동');
        // setCurrentPage가 없으면 메인 페이지로 이동
        window.location.href = '/';
      }
    } catch (error) {
      console.error('장바구니 추가 실패:', error);
      alert('장바구니 추가에 실패했습니다.');
    }
  };

  // 우리 스토어 상품을 장바구니에 추가하는 함수
  const handleAddLocalProductToCart = async (product: Product) => {
    try {
      // 백엔드 API 호출하여 장바구니에 추가
      const response = await axios.post(`${API_BASE_URL}/cart/add`, {
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
      // 네이버 쇼핑 검색
      const naverResponse = await naverShoppingApi.searchProducts(searchQuery, 10);
      let naverResults: NaverProduct[] = [];
      
      if (naverResponse.success && naverResponse.data?.items) {
        naverResults = naverResponse.data.items.map((item: any) => ({
          id: item.productId || Math.random(),
          productId: item.productId || '',
          title: item.title || '제목 없음',
          description: item.description || '',
          price: parseInt(item.lprice) || 0,
          imageUrl: item.image || '/placeholder.svg',
          mallName: item.mallName || '판매자 정보 없음',
          productUrl: item.link || '#',
          brand: item.brand || '',
          maker: item.maker || '',
          category1: item.category1 || '',
          category2: item.category2 || '',
          category3: item.category3 || '',
          category4: item.category4 || '',
          reviewCount: parseInt(item.reviewCount) || 0,
          rating: parseFloat(item.rating) || 0,
          searchCount: parseInt(item.searchCount) || 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isSaved: false
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
      setShowNaverProducts(true); // 네이버 상품 표시 모드로 설정
      
      // 검색된 네이버 상품들을 DB에 자동 저장
      if (naverResults.length > 0) {
        setTimeout(() => {
          saveNaverProductsToDb(naverResults);
        }, 500);
      }
      
    } catch (error) {
      console.error('통합 검색 실패:', error);
      setError('검색에 실패했습니다.');
    } finally {
      setNaverSearchLoading(false);
    }
  };

  // 상품 API 함수들 - 백엔드와 직접 연결
  const productApi = {
    // 모든 상품 조회
    getProducts: async (): Promise<any[]> => {
      try {

        const response = await axios.get(`${API_BASE_URL}/products`);
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
        const response = await axios.get(`${API_BASE_URL}/api/products/${productId}`);
        return response.data;
      } catch (error) {
        console.error('상품 조회 실패:', error);
        throw error;
      }
    },

    // 상품 생성
    createProduct: async (productData: any): Promise<any> => {
      try {
        const response = await axios.post(`${API_BASE_URL}/api/products`, productData, {
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
        const response = await axios.put(`${API_BASE_URL}/api/products/${productId}`, productData, {
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
        await axios.delete(`${API_BASE_URL}/products/${productId}`);
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
      console.log('응답 타입:', typeof response);
      console.log('응답이 배열인가?', Array.isArray(response));
      
      // 응답이 배열이 아닌 경우 빈 배열로 처리
      if (!Array.isArray(response)) {
        console.error('응답이 배열이 아닙니다:', response);
        setProducts([]);
        return;
      }
      
      // 백엔드 응답을 프론트엔드 형식으로 변환
      const data: Product[] = response.map((item: any) => ({
        ...item,
        id: item.id || item.productId || 0,  // id를 우선 사용
        productId: item.id || item.productId || 0,  // 호환성을 위해 productId도 설정
        imageUrl: item.imageUrl || item.image || '/placeholder.svg',
        petType: item.targetAnimal?.toLowerCase() || 'all',
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
    } catch (error) {
      console.error("Error fetching products:", error);
      setError('상품 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false)
    }
  };

  useEffect(() => {
    fetchProducts();
    // 페이지 로드 시 네이버 쇼핑에서 인기 펫 용품 가져오기 (한 번만 실행)
    const hasLoadedNaverProducts = sessionStorage.getItem('naverProductsLoaded');
    if (!hasLoadedNaverProducts) {
      loadInitialNaverProducts();
      sessionStorage.setItem('naverProductsLoaded', 'true');
    }
  }, []);

  // 초기 네이버 상품 로드
  const loadInitialNaverProducts = async () => {
    try {
      // 다양한 펫 용품 검색어들
      const searchTerms = [
        "강아지 사료",
        "고양이 사료", 
        "강아지 간식",
        "고양이 간식",
        "강아지 장난감",
        "고양이 장난감"
      ];
      
      let allProducts: NaverProduct[] = [];
      
      // 각 검색어로 상품 가져오기
      for (const term of searchTerms) {
        try {
          const response = await naverShoppingApi.searchProducts(term, 5);
          if (response.success && response.data?.items) {
            const safeProducts = response.data.items.map((item: any) => ({
              id: item.productId || Math.random(),
              productId: item.productId || '',
              title: item.title || '제목 없음',
              description: item.description || '',
              price: parseInt(item.lprice) || 0,
              imageUrl: item.image || '/placeholder.svg',
              mallName: item.mallName || '판매자 정보 없음',
              productUrl: item.link || '#',
              brand: item.brand || '',
              maker: item.maker || '',
              category1: item.category1 || '',
              category2: item.category2 || '',
              category3: item.category3 || '',
              category4: item.category4 || '',
              reviewCount: parseInt(item.reviewCount) || 0,
              rating: parseFloat(item.rating) || 0,
              searchCount: parseInt(item.searchCount) || 0,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              isSaved: false // 초기에는 저장되지 않은 상태
            }));
            allProducts = [...allProducts, ...safeProducts];
          }
        } catch (error) {
          console.error(`${term} 검색 실패:`, error);
        }
      }
      
      // 중복 제거 (productId 기준)
      const uniqueProducts = allProducts.filter((product, index, self) => 
        index === self.findIndex(p => p.productId === product.productId)
      );
      
      // 최대 20개까지만 표시
      const finalProducts = uniqueProducts.slice(0, 20);
      setNaverProducts(finalProducts);
      
      // 네이버 상품들을 DB에 자동 저장
      setTimeout(() => {
        saveNaverProductsToDb(finalProducts);
      }, 1000); // 1초 후 저장 시작
      
    } catch (error) {
      console.error('초기 네이버 상품 로드 실패:', error);
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
      // 카테고리별 검색어 매핑
      const categorySearchTerms: { [key: string]: string[] } = {
        "사료": ["강아지 사료", "고양이 사료", "펫 사료"],
        "간식": ["강아지 간식", "고양이 간식", "펫 간식"],
        "장난감": ["강아지 장난감", "고양이 장난감", "펫 장난감"],
        "용품": ["강아지 용품", "고양이 용품", "펫 용품"],
        "의류": ["강아지 의류", "고양이 의류", "펫 의류"],
        "건강관리": ["강아지 건강", "고양이 건강", "펫 건강"]
      };
      
      const searchTerms = categorySearchTerms[category] || [category];
      let allProducts: NaverProduct[] = [];
      
      // 각 검색어로 상품 가져오기
      for (const term of searchTerms) {
        try {
          const response = await naverShoppingApi.searchProducts(term, 8);
          if (response.success && response.data?.items) {
            const safeProducts = response.data.items.map((item: any) => ({
              id: item.productId || Math.random(),
              productId: item.productId || '',
              title: item.title || '제목 없음',
              description: item.description || '',
              price: parseInt(item.lprice) || 0,
              imageUrl: item.image || '/placeholder.svg',
              mallName: item.mallName || '판매자 정보 없음',
              productUrl: item.link || '#',
              brand: item.brand || '',
              maker: item.maker || '',
              category1: item.category1 || '',
              category2: item.category2 || '',
              category3: item.category3 || '',
              category4: item.category4 || '',
              reviewCount: parseInt(item.reviewCount) || 0,
              rating: parseFloat(item.rating) || 0,
              searchCount: parseInt(item.searchCount) || 0,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              isSaved: false
            }));
            allProducts = [...allProducts, ...safeProducts];
          }
        } catch (error) {
          console.error(`${term} 검색 실패:`, error);
        }
      }
      
      // 중복 제거 (productId 기준)
      const uniqueProducts = allProducts.filter((product, index, self) => 
        index === self.findIndex(p => p.productId === product.productId)
      );
      
      // 최대 15개까지만 표시
      const finalProducts = uniqueProducts.slice(0, 15);
      setNaverProducts(finalProducts);
      
      // 카테고리별 검색된 네이버 상품들을 DB에 자동 저장
      setTimeout(() => {
        saveNaverProductsToDb(finalProducts);
      }, 500);
      
    } catch (error) {
      console.error('카테고리 검색 실패:', error);
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
      const response = await axios.post(`${API_BASE_URL}/api/carts?productId=${product.id}&quantity=1`, null, {
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
              placeholder="상품 검색 (우리 스토어 + 네이버 쇼핑)"
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

        {/* 네이버 쇼핑 퀵 버튼 */}
        {showNaverProducts && (
          <div className="flex justify-center mb-6 space-x-4">
            <Button
              onClick={handleNaverPopularProducts}
              disabled={naverSearchLoading}
              className="bg-blue-500 hover:bg-blue-600 text-white"
            >
              {naverSearchLoading ? "로딩중..." : "🔥 인기 상품"}
            </Button>
            <Button
              onClick={handleNaverTopRatedProducts}
              disabled={naverSearchLoading}
              className="bg-green-500 hover:bg-green-600 text-white"
            >
              {naverSearchLoading ? "로딩중..." : "⭐ 높은 평점"}
            </Button>
          </div>
        )}



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
        {naverSearchLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto mb-4"></div>
              <p className="text-gray-600">검색 중...</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {/* 우리 스토어 상품들 */}
            {sortedLocalProducts.map((product, index) => (
              <Card key={`local-${product.id}-${index}`} className="group cursor-pointer hover:shadow-lg transition-shadow relative">
                {index === 0 && (
                  <div className="absolute top-2 left-2 bg-red-500 text-white px-2 py-1 rounded text-xs font-bold z-10">
                    Best
                  </div>
                )}
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
                {/* 장바구니 버튼 */}
                <Button
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAddToCart(product);
                  }}
                  className="absolute bottom-2 right-2 bg-yellow-400 hover:bg-yellow-500 text-black rounded-full p-2 h-8 w-8"
                  disabled={product.stock === 0}
                >
                  <ShoppingCart className="w-4 h-4" />
                </Button>
              </div>
              <CardContent className="p-4 cursor-pointer" onClick={() => window.location.href = `/store/${product.id}`}>
                <h3 className="font-medium text-sm text-gray-900 mb-2 line-clamp-2 leading-tight">{product.name}</h3>
                <p className="text-lg font-bold text-gray-900">{product.price.toLocaleString()}원</p>
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
                <div className="relative" onClick={() => onViewProduct(naverProduct)}>
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
                  {/* 저장 상태 표시 */}
                  {naverProduct.isSaved && (
                    <div className="absolute top-2 left-2 bg-green-500 text-white px-2 py-1 rounded text-xs font-bold z-10">
                      저장됨
                    </div>
                  )}
                  {savingProducts.has(naverProduct.productId) && (
                    <div className="absolute top-2 left-2 bg-yellow-500 text-white px-2 py-1 rounded text-xs font-bold z-10">
                      저장중...
                    </div>
                  )}
                </div>
                <CardContent className="p-4">
                  <div className="mb-2" onClick={() => onViewProduct(naverProduct)}>
                    <h3 className="font-semibold text-sm text-gray-900 line-clamp-2 mb-1">
                      {removeHtmlTags(naverProduct.title)}
                    </h3>
                    <p className="text-xs text-gray-500 mb-2">{naverProduct.mallName}</p>
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