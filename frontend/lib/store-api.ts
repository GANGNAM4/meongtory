import axios from 'axios'
import { getBackendUrl } from './api'

// 검색어 전처리 함수
const preprocessSearchQuery = (query: string): string => {
  if (!query) return "";
  
  // 1. 공백 제거 및 정규화
  let processedQuery = query.trim();
  
  // 2. 특수문자 제거 (한글, 영문, 숫자, 공백만 허용)
  processedQuery = processedQuery.replace(/[^\w\s가-힣]/g, '');
  
  // 3. 연속된 공백을 하나로 변환
  processedQuery = processedQuery.replace(/\s+/g, ' ');
  
  // 4. 너무 짧은 단어 필터링 (2글자 미만 제거)
  const words = processedQuery.split(' ');
  const filteredWords = words.filter(word => word.length >= 2);
  
  // 5. 결과가 비어있으면 원본 반환 (최소 2글자)
  if (filteredWords.length === 0 && processedQuery.length >= 2) {
    return processedQuery;
  }
  
  return filteredWords.join(' ');
};

// 타입 정의
export interface Product {
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

export interface NaverProduct {
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
  isSaved?: boolean
  similarity?: number
}

// axios 인터셉터 설정
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

// 스토어 API 함수들
export const storeApi = {
  // 우리 스토어 상품 조회
  getProducts: async (): Promise<Product[]> => {
    try {
      const response = await axios.get(`${getBackendUrl()}/api/products`);
      const data = response.data?.data || response.data;
      
      return data.map((item: any) => ({
        ...item,
        id: item.id || item.productId || 0,
        productId: item.id || item.productId || 0,
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
    } catch (error) {
      console.error('상품 목록 조회 실패:', error);
      throw error;
    }
  },

  // 네이버 상품 조회 (저장된 것만)
  getSavedNaverProducts: async (page: number = 0, size: number = 20): Promise<{content: NaverProduct[], hasMore: boolean}> => {
    try {
      const response = await axios.get(`${getBackendUrl()}/api/naver-shopping/products/search`, {
        params: { keyword: '', page, size }
      });
      
      if (response.data.success && response.data.data?.content) {
        const products = response.data.data.content.map((item: any) => ({
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
        
        return {
          content: products,
          hasMore: products.length === size
        };
      }
      
      return { content: [], hasMore: false };
    } catch (error) {
      console.error('저장된 네이버 상품 조회 실패:', error);
      throw error;
    }
  },

  // 네이버 상품 검색
  searchNaverProducts: async (keyword: string, page: number = 0, size: number = 20): Promise<{content: NaverProduct[], hasMore: boolean}> => {
    try {
      const response = await axios.get(`${getBackendUrl()}/api/naver-shopping/products/search`, {
        params: { keyword, page, size }
      });
      
      if (response.data.success && response.data.data?.content) {
        const products = response.data.data.content.map((item: any) => ({
          id: Number(item.id) || Math.random(),
          productId: item.productId || '',
          title: item.title || '제목 없음',
          description: item.description || '',
          price: Number(item.price) || 0,
          imageUrl: item.imageUrl || '/placeholder.svg',
          mallName: item.mallName || '판매자 정보 없음',
          productUrl: item.productUrl || '#',
          brand: item.brand || '',
          maker: item.maker || '',
          category1: item.category1 || '',
          category2: item.category2 || '',
          category3: item.category3 || '',
          category4: item.category4 || '',
          reviewCount: Number(item.reviewCount) || 0,
          rating: Number(item.rating) || 0,
          searchCount: Number(item.searchCount) || 0,
          createdAt: item.createdAt || new Date().toISOString(),
          updatedAt: item.updatedAt || new Date().toISOString(),
          relatedProductId: item.relatedProductId ? Number(item.relatedProductId) : undefined,
          isSaved: true
        }));
        
        return {
          content: products,
          hasMore: products.length === size
        };
      }
      
      return { content: [], hasMore: false };
    } catch (error) {
      console.error('네이버 상품 검색 실패:', error);
      throw error;
    }
  },

  // 임베딩 검색 (백엔드를 통해)
  searchWithEmbedding: async (query: string, limit: number = 20): Promise<NaverProduct[]> => {
    try {
      // 검색어 전처리
      const preprocessedQuery = preprocessSearchQuery(query);
      if (!preprocessedQuery || preprocessedQuery.length < 2) {
        console.log('검색어가 너무 짧거나 유효하지 않습니다.');
        return [];
      }
      
      const response = await axios.get(`${getBackendUrl()}/api/search`, {
        params: { query: preprocessedQuery, limit }
      });
      
      const responseData = response.data;
      if (responseData && Array.isArray(responseData)) {
        const mappedResults = responseData
          .filter((item: any) => item && (item.id || item.productId))
          .map((item: any) => ({
            id: Number(item.id) || Math.random(),
            productId: item.productId || item.product_id || String(item.id) || '',
            title: item.title || item.name || '제목 없음',
            description: item.description || '',
            price: Number(item.price) || 0,
            imageUrl: item.imageUrl || item.image_url || '/placeholder.svg',
            mallName: item.mallName || item.seller || '판매자 정보 없음',
            productUrl: item.productUrl || item.product_url || '#',
            brand: item.brand || '',
            maker: item.maker || '',
            category1: item.category1 || '',
            category2: item.category2 || '',
            category3: item.category3 || '',
            category4: item.category4 || '',
            reviewCount: Number(item.reviewCount) || Number(item.review_count) || 0,
            rating: Number(item.rating) || 0,
            searchCount: Number(item.searchCount) || Number(item.search_count) || 0,
            createdAt: item.createdAt || item.created_at || new Date().toISOString(),
            updatedAt: item.updatedAt || item.updated_at || new Date().toISOString(),
            relatedProductId: item.relatedProductId ? Number(item.relatedProductId) : undefined,
            isSaved: true,
            similarity: Number(item.similarity) || 0
          }));
        
        return mappedResults;
      }
      
      return [];
    } catch (error) {
      console.error('백엔드를 통한 임베딩 검색 실패:', error);
      throw error;
    }
  },

  // 네이버 상품 상세 조회
  getNaverProduct: async (productId: string): Promise<NaverProduct> => {
    try {
      const response = await axios.get(`${getBackendUrl()}/api/naver-shopping/products/${productId}`);
      
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      
      throw new Error('상품 정보를 찾을 수 없습니다.');
    } catch (error) {
      console.error('네이버 상품 조회 실패:', error);
      throw error;
    }
  },

  // MyPet 검색
  searchMyPets: async (keyword: string): Promise<any[]> => {
    try {
      const token = localStorage.getItem('accessToken')
      if (!token) return [];

      const response = await axios.get(
        `${getBackendUrl()}/api/mypet/search?keyword=${keyword}`,
        { 
          headers: { 
            Authorization: `Bearer ${token}`,
            'Access_Token': token
          } 
        }
      );
      
      if (response.data.success) {
        return response.data.data || [];
      }
      
      return [];
    } catch (error) {
      console.error('MyPet 검색 실패:', error);
      return [];
    }
  }
};
