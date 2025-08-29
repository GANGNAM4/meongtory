import { useQuery, useInfiniteQuery } from '@tanstack/react-query'
import { storeApi, Product, NaverProduct } from '@/lib/store-api'

// Query Keys
export const storeKeys = {
  all: ['store'] as const,
  products: () => [...storeKeys.all, 'products'] as const,
  naverProducts: () => [...storeKeys.all, 'naver-products'] as const,
  naverProduct: (id: string) => [...storeKeys.all, 'naver-product', id] as const,
  search: (query: string) => [...storeKeys.all, 'search', query] as const,
  embedding: (query: string) => [...storeKeys.all, 'embedding', query] as const,
  myPets: (keyword: string) => [...storeKeys.all, 'mypets', keyword] as const,
}

// 우리 스토어 상품 조회
export function useProducts() {
  return useQuery({
    queryKey: storeKeys.products(),
    queryFn: storeApi.getProducts,
    staleTime: 10 * 60 * 1000, // 10분
    gcTime: 30 * 60 * 1000, // 30분
  })
}

// 네이버 상품 무한 스크롤 조회
export function useNaverProducts() {
  return useInfiniteQuery({
    queryKey: storeKeys.naverProducts(),
    queryFn: ({ pageParam = 0 }) => storeApi.getSavedNaverProducts(pageParam, 20),
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.hasMore ? allPages.length : undefined
    },
    initialPageParam: 0,
    staleTime: 5 * 60 * 1000, // 5분
    gcTime: 15 * 60 * 1000, // 15분
  })
}

// 네이버 상품 검색
export function useNaverProductSearch(keyword: string, enabled: boolean = true) {
  return useInfiniteQuery({
    queryKey: storeKeys.search(keyword),
    queryFn: ({ pageParam = 0 }) => storeApi.searchNaverProducts(keyword, pageParam, 20),
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.hasMore ? allPages.length : undefined
    },
    initialPageParam: 0,
    enabled: enabled && keyword.trim().length > 0,
    staleTime: 3 * 60 * 1000, // 3분
    gcTime: 10 * 60 * 1000, // 10분
  })
}

// 임베딩 검색 (백엔드를 통해)
export function useEmbeddingSearch(query: string, enabled: boolean = true) {
  return useQuery({
    queryKey: storeKeys.embedding(query),
    queryFn: () => storeApi.searchWithEmbedding(query, 20),
    enabled: enabled && query.trim().length > 0,
    staleTime: 1 * 60 * 1000, // 1분 (캐싱 시간 단축)
    gcTime: 5 * 60 * 1000, // 5분
  })
}

// 네이버 상품 상세 조회
export function useNaverProduct(productId: string) {
  return useQuery({
    queryKey: storeKeys.naverProduct(productId),
    queryFn: () => storeApi.getNaverProduct(productId),
    enabled: !!productId,
    staleTime: 10 * 60 * 1000, // 10분 - 상세 페이지는 더 오래 캐시
    gcTime: 30 * 60 * 1000, // 30분
  })
}

// MyPet 검색
export function useMyPetSearch(keyword: string, enabled: boolean = true) {
  return useQuery({
    queryKey: storeKeys.myPets(keyword),
    queryFn: () => storeApi.searchMyPets(keyword),
    enabled: enabled && keyword.length >= 0,
    staleTime: 2 * 60 * 1000, // 2분
    gcTime: 5 * 60 * 1000, // 5분
  })
}
