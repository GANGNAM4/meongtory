"use client"

import React, { useState, useEffect } from "react"
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

  // 현재 KST 날짜 가져오기
  const getCurrentKSTDate = () => {
    const now = new Date()
    const kstOffset = 9 * 60 // KST는 UTC+9
    const kstTime = new Date(now.getTime() + kstOffset * 60 * 1000)
    return kstTime.toISOString()
  }

  // 상품 목록 페칭 (기존 상품 + 네이버 상품)
  const fetchProducts = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const API_BASE_URL = `${getBackendUrl()}/api`
      
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

      // 네이버 상품들 가져오기
      try {
        const naverResponse = await axios.get(`${API_BASE_URL}/naver-shopping/products/popular`, {
          params: { page: 0, size: 50 }
        })
        
        if (naverResponse.data.success && naverResponse.data.data?.content) {
          const naverProducts = naverResponse.data.data.content.map((naverProduct: any) => ({
            id: naverProduct.id || naverProduct.productId || Math.random(),
            name: removeHtmlTags(naverProduct.title || '제목 없음'),
            price: parseInt(naverProduct.price) || 0,
            imageUrl: naverProduct.imageUrl || '/placeholder.svg',
            category: naverProduct.category1 || '네이버 상품',
            description: removeHtmlTags(naverProduct.description || ''),
            tags: [],
            stock: 999, // 네이버 상품은 재고 무제한으로 표시
            registrationDate: naverProduct.createdAt || getCurrentKSTDate(),
            registeredBy: '네이버',
            isNaverProduct: true, // 네이버 상품 표시
            mallName: naverProduct.mallName || '판매자 정보 없음',
            productUrl: naverProduct.productUrl || '#'
          }))
          
          // 기존 상품과 네이버 상품 합치기
          const allProducts = [...convertedProducts, ...naverProducts]
          
          const sortedProducts = allProducts.sort((a: AdminProduct, b: AdminProduct) => {
            const dateA = new Date(a.registrationDate).getTime()
            const dateB = new Date(b.registrationDate).getTime()
            return dateB - dateA
          })

          setProducts(sortedProducts)
          console.log('Products state updated (with Naver products):', sortedProducts)
        } else {
          // 네이버 상품이 없으면 기존 상품만 표시
          const sortedProducts = convertedProducts.sort((a: AdminProduct, b: AdminProduct) => {
            const dateA = new Date(a.registrationDate).getTime()
            const dateB = new Date(b.registrationDate).getTime()
            return dateB - dateA
          })
          setProducts(sortedProducts)
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
        const API_BASE_URL = `${getBackendUrl()}/api`
        await axios.delete(`${API_BASE_URL}/naver-shopping/products/${productId}`)
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
      const API_BASE_URL = `${getBackendUrl()}/api`
      
      // 다양한 펫 용품 검색어들
      const searchTerms = [
        "강아지 사료",
        "고양이 사료", 
        "강아지 간식",
        "고양이 간식",
        "강아지 장난감",
        "고양이 장난감"
      ]
      
      let totalSaved = 0
      
      // 각 검색어로 상품 가져오기
      for (const term of searchTerms) {
        try {
          console.log(`${term} 검색 중...`)
          
          // 네이버 쇼핑 API 호출
          const searchResponse = await axios.post(`${API_BASE_URL}/naver-shopping/search`, {
            query: term,
            display: 10,
            start: 1,
            sort: "sim"
          })
          
          if (searchResponse.data.success && searchResponse.data.data?.items) {
            const items = searchResponse.data.data.items
            
            // 각 상품을 DB에 저장
            for (const item of items) {
              try {
                const saveResponse = await axios.post(`${API_BASE_URL}/naver-shopping/save`, {
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
                  searchCount: parseInt(item.searchCount) || 0
                })
                
                if (saveResponse.data.success) {
                  totalSaved++
                }
              } catch (saveError) {
                console.error(`${item.title} 저장 실패:`, saveError)
              }
            }
          }
          
          // API 호출 간격 조절
          await new Promise(resolve => setTimeout(resolve, 200))
          
        } catch (searchError) {
          console.error(`${term} 검색 실패:`, searchError)
        }
      }
      
      alert(`네이버 상품 ${totalSaved}개가 성공적으로 저장되었습니다!`)
      
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
          <Card key={product.id || `product-${index}`}>
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
    </div>
  )
} 