"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, Edit, Trash2, AlertCircle, Download } from "lucide-react"
import { ProductsTabProps, AdminProduct } from "@/types/admin"
import { productApi } from "@/lib/api"
import axios from "axios"
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

export default function ProductsTab({
  onNavigateToStoreRegistration,
  onEditProduct,
}: ProductsTabProps) {
  const [products, setProducts] = useState<AdminProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [naverLoading, setNaverLoading] = useState(false)
  const [naverError, setNaverError] = useState<string | null>(null)

  // 무한스크롤 관련 상태 추가
  const [currentPage, setCurrentPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const loadingRef = useRef<HTMLDivElement>(null)

  // 현재 KST 날짜 가져오기
  const getCurrentKSTDate = () => {
    const now = new Date()
    const kstOffset = 9 * 60 // KST는 UTC+9
    const kstTime = new Date(now.getTime() + kstOffset * 60 * 1000)
    return kstTime.toISOString()
  }

  // 무한스크롤을 위한 IntersectionObserver 설정
  const lastElementRef = useCallback((node: HTMLDivElement) => {
    if (isLoadingMore) return
    
    if (observerRef.current) observerRef.current.disconnect()
    
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
        loadMoreProducts()
      }
    })
    
    if (node) observerRef.current.observe(node)
  }, [hasMore, isLoadingMore])

  // 다음 페이지 상품 로드 함수
  const loadMoreProducts = async () => {
    if (isLoadingMore || !hasMore) return
    
    setIsLoadingMore(true)
    try {
      const nextPage = currentPage + 1
      
      // 네이버 상품 다음 페이지 로드
      const naverResponse = await axios.get(`${getBackendUrl()}/api/naver-shopping/products/all`, {
        params: { page: nextPage, size: 20 }
      })
      
      if (naverResponse.data.success && naverResponse.data.data?.content) {
        const newNaverProducts = naverResponse.data.data.content.map((naverProduct: any) => ({
          id: naverProduct.id || naverProduct.productId || Math.random(),
          name: removeHtmlTags(naverProduct.title || '제목 없음'),
          price: parseInt(naverProduct.price) || 0,
          imageUrl: naverProduct.imageUrl || '/placeholder.svg',
          category: naverProduct.category1 || '용품',
          description: removeHtmlTags(naverProduct.description || ''),
          tags: [],
          stock: 999,
          registrationDate: naverProduct.createdAt || getCurrentKSTDate(),
          registeredBy: '네이버',
          isNaverProduct: true,
          mallName: naverProduct.mallName || '판매자 정보 없음',
          productUrl: naverProduct.productUrl || '#'
        }))
        
        setProducts(prev => [...prev, ...newNaverProducts])
        setCurrentPage(nextPage)
        
        // 더 이상 로드할 상품이 없으면 hasMore를 false로 설정
        if (newNaverProducts.length < 20) {
          setHasMore(false)
        }
      } else {
        setHasMore(false)
      }
    } catch (error) {
      console.error('추가 상품 로드 실패:', error)
      setHasMore(false)
    } finally {
      setIsLoadingMore(false)
    }
  }

  // 상품 목록 페칭 (기존 상품 + 네이버 상품)
  const fetchProducts = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // 기존 상품들 가져오기
      const apiProducts = await productApi.getProducts()
      console.log('API Products response:', apiProducts)

      // apiProducts가 배열인지 확인
      if (!apiProducts || !Array.isArray(apiProducts)) {
        console.error('API 응답이 배열이 아닙니다:', apiProducts)
        setError('상품 데이터 형식이 올바르지 않습니다.')
        return
      }

      const convertedProducts = apiProducts.map((product: any, index: number) => {
        console.log(`Converting product ${index + 1}:`, product)
        return {
          id: product.id || product.productId || 0,
          name: removeHtmlTags(product.name || product.productName || '이름 없음'),
          price: product.price || 0,
          imageUrl: product.image_url || product.imageUrl || product.image || '/placeholder.svg',
          category: product.category || '카테고리 없음',
          description: removeHtmlTags(product.description || ''),
          tags: product.tags
            ? Array.isArray(product.tags)
              ? product.tags
              : product.tags.split(',').map((tag: string) => tag.trim())
            : [],
          stock: product.stock || 0,
          registrationDate: product.registration_date || product.registrationDate || product.createdAt || getCurrentKSTDate(),
          registeredBy: product.registered_by || product.registeredBy || 'admin',
          isNaverProduct: false // 기존 상품 표시
        }
      })

      // 네이버 상품들 첫 페이지 가져오기
      try {
        const naverResponse = await axios.get(`${getBackendUrl()}/api/naver-shopping/products/all`, {
          params: { page: 0, size: 20 } // 첫 페이지 20개
        })
        
        if (naverResponse.data.success && naverResponse.data.data?.content) {
          const naverProducts = naverResponse.data.data.content.map((naverProduct: any) => ({
            id: naverProduct.id || naverProduct.productId || Math.random(),
            name: removeHtmlTags(naverProduct.title || '제목 없음'),
            price: parseInt(naverProduct.price) || 0,
            imageUrl: naverProduct.imageUrl || '/placeholder.svg',
            category: naverProduct.category1 || '용품', // 매핑된 카테고리 사용
            description: removeHtmlTags(naverProduct.description || ''),
            tags: [],
            stock: 999, // 네이버 상품은 재고 무제한으로 표시
            registrationDate: naverProduct.createdAt || getCurrentKSTDate(),
            registeredBy: '네이버',
            isNaverProduct: true, // 네이버 상품 표시
            mallName: naverProduct.mallName || '판매자 정보 없음',
            productUrl: naverProduct.productUrl || '#'
          }))
          
          console.log(`네이버 상품 ${naverProducts.length}개 로드됨`)
          
          // 기존 상품과 네이버 상품 합치기
          const allProducts = [...convertedProducts, ...naverProducts]
          
          const sortedProducts = allProducts.sort((a: AdminProduct, b: AdminProduct) => {
            const dateA = new Date(a.registrationDate).getTime()
            const dateB = new Date(b.registrationDate).getTime()
            return dateB - dateA
          })

          setProducts(sortedProducts)
          setCurrentPage(0)
          setHasMore(naverProducts.length === 20) // 20개면 더 있을 가능성이 있음
          console.log('Products state updated (with Naver products):', sortedProducts)
        } else {
          // 네이버 상품이 없으면 기존 상품만 표시
          const sortedProducts = convertedProducts.sort((a: AdminProduct, b: AdminProduct) => {
            const dateA = new Date(a.registrationDate).getTime()
            const dateB = new Date(b.registrationDate).getTime()
            return dateB - dateA
          })
          setProducts(sortedProducts)
          setHasMore(false)
        }
      } catch (naverError) {
        console.error('네이버 상품 가져오기 실패:', naverError)
        // 네이버 상품 가져오기 실패 시 기존 상품만 표시
        const sortedProducts = convertedProducts.sort((a: AdminProduct, b: AdminProduct) => {
          const dateA = new Date(a.registrationDate).getTime()
          const dateB = new Date(b.registrationDate).getTime()
          return dateB - dateA
        })
        setProducts(sortedProducts)
        setHasMore(false)
      }
      
    } catch (error) {
      console.error('Error fetching products:', error)
      setError('상품 목록을 불러오는 데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 상품 삭제 (기존 상품 + 네이버 상품)
  const deleteProduct = async (productId: number, isNaverProduct: boolean = false) => {
    if (!productId || isNaN(productId)) {
      throw new Error('유효하지 않은 상품 ID입니다.')
    }
    
    try {
      console.log('상품 삭제 요청:', productId, '네이버 상품:', isNaverProduct)
      
      if (isNaverProduct) {
        // 네이버 상품 삭제
        await axios.delete(`${getBackendUrl()}/api/naver-shopping/products/${productId}`)
        console.log('네이버 상품 삭제 완료')
      } else {
        // 기존 상품 삭제
        await productApi.deleteProduct(productId)
        console.log('기존 상품 삭제 완료')
      }
      
      setProducts((prev: AdminProduct[]) => prev.filter((p: AdminProduct) => p.id !== productId))
      return true
    } catch (error) {
      console.error('상품 삭제 오류:', error)
      throw new Error('상품 삭제 중 오류가 발생했습니다.')
    }
  }

  const handleDeleteProduct = async (productId: number, isNaverProduct: boolean = false) => {
    const productType = isNaverProduct ? '네이버 상품' : '상품'
    if (window.confirm(`정말로 이 ${productType}을 삭제하시겠습니까?`)) {
      try {
        await deleteProduct(productId, isNaverProduct)
        alert(`${productType}이 성공적으로 삭제되었습니다.`)
      } catch (error) {
        console.error('상품 삭제 오류:', error)
        alert(`${productType} 삭제 중 오류가 발생했습니다.`)
      }
    }
  }

  // HTML 태그 제거 함수
  const removeHtmlTags = (text: string) => {
    return text.replace(/<[^>]*>/g, '');
  };

  // 네이버 API에서 상품 데이터 가져오기
  const fetchNaverProducts = async () => {
    setNaverLoading(true)
    setNaverError(null)
    
    try {
      console.log('네이버 상품 가져오기 시작...')
      
             // 이전에 가져온 페이지 정보를 localStorage에서 가져오기
       const lastPageInfo = localStorage.getItem('naverLastPageInfo')
       let startPageOffset = 0
       
       if (lastPageInfo) {
         const pageInfo = JSON.parse(lastPageInfo)
         startPageOffset = pageInfo.lastStartPage || 0
         console.log(`이전 시작 페이지: ${startPageOffset}, 다음 시작 페이지: ${startPageOffset + 1}`)
       } else {
         console.log(`첫 실행: 1페이지부터 시작`)
       }
      
      // 카테고리별 검색어 그룹화
      const searchCategories = {
        사료: [
          "강아지 사료",
          "고양이 사료", 
          "강아지 프리미엄 사료",
          "고양이 프리미엄 사료",
          "강아지 어덜트 사료",
          "고양이 어덜트 사료"
        ],
        간식: [
          "강아지 간식",
          "고양이 간식",
          "강아지 덴탈 간식",
          "고양이 덴탈 간식",
          "강아지 트릿",
          "고양이 트릿"
        ],
        장난감: [
          "강아지 장난감",
          "고양이 장난감",
          "강아지 공",
          "고양이 공",
          "강아지 로프 장난감",
          "고양이 쥐돌이"
        ],
        용품: [
          "강아지 용품",
          "고양이 용품",
          "강아지 하네스",
          "고양이 캣타워",
          "강아지 케이지",
          "고양이 화장실"
        ],
        의류: [
          "강아지 옷",
          "고양이 옷",
          "강아지 코트",
          "고양이 코트",
          "강아지 신발",
          "고양이 신발",
          "강아지 후드",
          "고양이 후드",
          "강아지 원피스",
          "고양이 원피스",
          "강아지 티셔츠",
          "고양이 티셔츠",
          "강아지 패딩",
          "고양이 패딩",
          "강아지 비옷",
          "고양이 비옷"
        ],
        건강관리: [
          "강아지 영양제",
          "고양이 영양제",
          "강아지 비타민",
          "고양이 비타민",
          "강아지 오메가3",
          "고양이 오메가3",
          "강아지 프로바이오틱스",
          "고양이 프로바이오틱스",
          "강아지 관절 영양제",
          "고양이 관절 영양제",
          "강아지 피부 영양제",
          "고양이 피부 영양제",
          "강아지 눈 영양제",
          "고양이 눈 영양제",
          "강아지 치아 관리",
          "고양이 치아 관리",
          "강아지 털 관리",
          "고양이 털 관리"
        ],
        브랜드: [
          "펫생각 신상",
          "닥터바이 신상",
          "울애기쌩쌩 신상",
          "펫파워 신상",
          "펫펫펫 신상",
          "디어랩스 신상",
          "닥터뉴토 신상",
          "헬로마이펫 신상",
          "닥터이안 신상",
          "이뮤노벳 신상"
        ],
        특수제품: [
          "강아지 유기농 사료",
          "고양이 유기농 사료",
          "강아지 글루텐프리 사료",
          "고양이 글루텐프리 사료",
          "강아지 저알러지 사료",
          "고양이 저알러지 사료",
          "강아지 다이어트 사료",
          "고양이 다이어트 사료",
          "강아지 시니어 사료",
          "고양이 시니어 사료",
          "강아지 퍼피 사료",
          "고양이 키튼 사료"
        ],
        스마트제품: [
          "강아지 스마트 장난감",
          "고양이 스마트 장난감",
          "강아지 자동급식기",
          "고양이 자동급식기",
          "강아지 자동급수기",
          "고양이 자동급수기",
          "강아지 GPS 목줄",
          "고양이 GPS 목줄",
          "강아지 카메라",
          "고양이 카메라"
        ],
        계절용품: [
          "강아지 선글라스",
          "고양이 선글라스",
          "강아지 모자",
          "고양이 모자",
          "강아지 우산",
          "고양이 우산",
          "강아지 우비",
          "고양이 우비",
          "강아지 스카프",
          "고양이 스카프"
        ]
      }
      
      const categories = Object.keys(searchCategories)
      const totalTargetProducts = 500 // 총 목표 상품 수
      const productsPerCategory = Math.floor(totalTargetProducts / categories.length) // 카테고리당 상품 수
      
      console.log(`총 목표 상품 수: ${totalTargetProducts}개`)
      console.log(`카테고리 수: ${categories.length}개`)
      console.log(`카테고리당 목표 상품 수: ${productsPerCategory}개`)
      
             let totalSaved = 0
       let newProductsCount = 0
       let updatedProductsCount = 0
       let categoryStats: { [key: string]: { new: number, updated: number, total: number } } = {}
       let maxStartPage = 0 // 이번 실행에서 사용한 최대 시작 페이지
      
      // 각 카테고리별로 상품 가져오기
      for (const category of categories) {
        const searchTerms = searchCategories[category as keyof typeof searchCategories]
        categoryStats[category] = { new: 0, updated: 0, total: 0 }
        
        console.log(`\n=== ${category} 카테고리 시작 ===`)
        console.log(`${category} 카테고리 - 검색어 ${searchTerms.length}개`)
        
        let categoryProductCount = 0
        
        // 각 검색어로 상품 가져오기
        for (let i = 0; i < searchTerms.length; i++) {
          const term = searchTerms[i]
          
          // 카테고리당 목표 상품 수에 도달하면 다음 카테고리로
          if (categoryProductCount >= productsPerCategory) {
            console.log(`${category} 카테고리 목표 달성 (${categoryProductCount}/${productsPerCategory})`)
            break
          }
          
          try {
            console.log(`[${i + 1}/${searchTerms.length}] ${term} 검색 중...`)
            
            // 페이징 처리를 통해 상품 가져오기
            const maxPages = 10 // 최대 10페이지까지
            const itemsPerPage = 10
            
                         // 이전 실행에서 끝난 페이지 다음부터 시작 (최대 100페이지 제한)
             const maxAllowedPage = Math.min(100, startPageOffset + 10) // 최대 10페이지씩 진행
             let randomStartPage = startPageOffset + 1 // 이전 실행에서 끝난 페이지 다음부터 시작
             
             // 100페이지를 넘어가면 1페이지부터 다시 시작
             if (randomStartPage > 100) {
               randomStartPage = 1
               console.log(`${term} - 100페이지 초과, 1페이지부터 다시 시작`)
             }
            console.log(`${term} - 랜덤 시작 페이지: ${randomStartPage}`)
            
            for (let page = 0; page < maxPages; page++) {
              // 카테고리당 목표 상품 수에 도달하면 다음 검색어로
              if (categoryProductCount >= productsPerCategory) {
                break
              }
              
                             const currentPage = randomStartPage + page
               const start = (currentPage - 1) * itemsPerPage + 1
               
               // 최대 시작 페이지 업데이트
               if (currentPage > maxStartPage) {
                 maxStartPage = currentPage
               }
              
              // 네이버 쇼핑 API 호출
              const searchResponse = await axios.post(`${getBackendUrl()}/api/naver-shopping/search`, {
                query: term,
                display: itemsPerPage,
                start: start,
                sort: "sim"
              })
              
              if (searchResponse.data.success && searchResponse.data.data?.items) {
                const items = searchResponse.data.data.items
                
                // 결과가 없으면 다음 검색어로 넘어가기
                if (items.length === 0) {
                  console.log(`${term} - 페이지 ${currentPage}: 더 이상 상품이 없습니다.`)
                  break
                }
                
                console.log(`${term} - 페이지 ${currentPage}: ${items.length}개 상품 발견`)
                
                // 각 상품을 DB에 저장
                for (const item of items) {
                  // 카테고리당 목표 상품 수에 도달하면 중단
                  if (categoryProductCount >= productsPerCategory) {
                    break
                  }
                  
                  try {
                    const saveResponse = await axios.post(`${getBackendUrl()}/api/naver-shopping/save`, {
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
                      rating: parseFloat(item.rating) || 0.0,
                      searchCount: 0
                    })
                    
                    if (saveResponse.data.success) {
                      const result = saveResponse.data.data
                      if (result && result.isNewProduct) {
                        newProductsCount++
                        categoryStats[category].new++
                        console.log(`새 상품 저장됨: ${item.title}`)
                      } else {
                        updatedProductsCount++
                        categoryStats[category].updated++
                        console.log(`기존 상품 업데이트됨: ${item.title}`)
                      }
                      totalSaved++
                      categoryStats[category].total++
                      categoryProductCount++
                    }
                  } catch (saveError) {
                    console.error(`상품 저장 실패: ${item.title}`, saveError)
                  }
                }
                
                // 잠시 대기 (API 호출 제한 방지)
                await new Promise(resolve => setTimeout(resolve, 500))
              } else {
                console.log(`${term} - 페이지 ${currentPage}: 검색 결과가 없습니다.`)
                break
              }
            }
          } catch (searchError) {
            console.error(`${term} 검색 실패:`, searchError)
          }
        }
        
        console.log(`${category} 카테고리 완료: 새 상품 ${categoryStats[category].new}개, 업데이트 ${categoryStats[category].updated}개, 총 ${categoryStats[category].total}개`)
      }
      
             // 다음 실행을 위해 페이지 정보 저장 (100페이지 초과 시 1페이지부터 다시 시작)
       let nextStartPage = maxStartPage + 1
       if (nextStartPage > 100) {
         nextStartPage = 1
         console.log(`100페이지 초과, 다음 실행은 1페이지부터 시작`)
       }
       
       const nextPageInfo = {
         lastStartPage: nextStartPage,
         timestamp: new Date().toISOString()
       }
       localStorage.setItem('naverLastPageInfo', JSON.stringify(nextPageInfo))
       console.log(`다음 실행 시작 페이지: ${nextPageInfo.lastStartPage}`)
      
      // 결과 요약 생성
      let resultMessage = `네이버 상품 가져오기 완료!\n\n`
      resultMessage += `총 새로 저장된 상품: ${newProductsCount}개\n`
      resultMessage += `총 기존 상품 업데이트: ${updatedProductsCount}개\n`
      resultMessage += `총 처리된 상품: ${totalSaved}개\n\n`
      resultMessage += `=== 카테고리별 결과 ===\n`
      
      for (const category of categories) {
        const stats = categoryStats[category]
        resultMessage += `${category}: 새 ${stats.new}개, 업데이트 ${stats.updated}개, 총 ${stats.total}개\n`
      }
      
      alert(resultMessage)
      
      // 상품 목록 새로고침
      fetchProducts()
      
    } catch (error) {
      console.error('네이버 상품 가져오기 실패:', error)
      setNaverError('네이버 상품을 가져오는데 실패했습니다.')
    } finally {
      setNaverLoading(false)
    }
  }

  // 컴포넌트 마운트 시 데이터 페칭
  useEffect(() => {
    fetchProducts()
  }, [])

  // 로딩 상태
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">상품 데이터를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  // 에러 상태
  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">상품 관리</h2>
        <div className="flex space-x-2">
          <Button 
            onClick={fetchNaverProducts} 
            disabled={naverLoading}
            className="bg-blue-500 hover:bg-blue-600 text-white"
          >
            <Download className="h-4 w-4 mr-2" />
            {naverLoading ? "가져오는 중..." : "네이버 상품 가져오기"}
          </Button>
          <Button onClick={onNavigateToStoreRegistration} className="bg-yellow-400 hover:bg-yellow-500 text-black">
            <Plus className="h-4 w-4 mr-2" />새 상품 등록
          </Button>
        </div>
      </div>

      {/* 네이버 상품 가져오기 에러 메시지 */}
      {naverError && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <p className="text-sm text-red-800">{naverError}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4">
        {products && products.length > 0 ? (
          products.map((product, index) => (
          <Card 
            key={product.id || `product-${index}`}
            ref={index === products.length - 1 ? lastElementRef : undefined}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <img
                    src={product.imageUrl || "/placeholder.svg"}
                    alt={product.name}
                    className="w-16 h-16 object-cover rounded-lg"
                  />
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="font-semibold">{product.name}</h3>
                      {product.isNaverProduct && (
                        <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                          네이버
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">{product.category}</p>
                    <p className="text-lg font-bold text-yellow-600">{product.price.toLocaleString()}원</p>
                    <p className="text-sm text-gray-500">
                      재고: {product.isNaverProduct ? '무제한' : `${product.stock}개`}
                    </p>
                    {product.isNaverProduct && product.mallName && (
                      <p className="text-xs text-gray-400">판매자: {product.mallName}</p>
                    )}
                  </div>
                </div>
                <div className="flex space-x-2">
                  {product.isNaverProduct ? (
                    <>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleDeleteProduct(product.id, true)}
                        title="네이버 상품 삭제"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => {
                          console.log('Edit button clicked for product:', product);
                          console.log('Product ID:', product.id);
                          onEditProduct(product);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleDeleteProduct(product.id, false)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))
        ) : (
          <div className="text-center py-8">
            <p>등록된 상품이 없습니다.</p>
          </div>
        )}
      </div>

      {/* 무한스크롤 로딩 인디케이터 */}
      {isLoadingMore && (
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto mb-2"></div>
            <p className="text-gray-600 text-sm">로딩중...</p>
          </div>
        </div>
      )}

      {/* 더 이상 로드할 상품이 없을 때 메시지 */}
      {!hasMore && products.length > 0 && !isLoadingMore && (
        <div className="text-center py-8">
          <p className="text-gray-500 text-sm">모든 상품을 불러왔습니다.</p>
        </div>
      )}
    </div>
  )
} 