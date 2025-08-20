"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Sparkles, PawPrint } from "lucide-react"
import Image from "next/image"
import axios from "axios"
import { useRouter } from "next/navigation"
import { getBackendUrl } from '@/lib/api'
import { ProductRecommendationCard } from "@/components/ui/product-recommendation-card"

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
  registrationDate: string
  registeredBy: string
  petType: "dog" | "cat" | "all"
  brand?: string
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
}

interface PageProps {
  params?: {
    id: string
  }
  productId?: number
  propNaverProduct?: NaverProduct
  onBack?: () => void
  onAddToCart?: (product: Product) => void
  onBuyNow?: (product: Product) => void
  isInCart?: (id: number) => boolean
}

export default function StoreProductDetailPage({ 
  params, 
  productId: propProductId,
  propNaverProduct,
  onBack: propOnBack,
  onAddToCart: propOnAddToCart,
  onBuyNow: propOnBuyNow,
  isInCart: propIsInCart
}: PageProps) {
  const router = useRouter()
  
  // params에서 productId를 추출하거나 props에서 받기
  let productId: string | number | null = propProductId || (params ? parseInt(params.id) : null)
  
  // URL 파라미터가 인코딩된 문자열인 경우 디코딩
  if (params && params.id && isNaN(parseInt(params.id))) {
    try {
      const decodedId = decodeURIComponent(params.id);
      productId = decodedId;
      console.log('디코딩된 productId:', decodedId);
    } catch (error) {
      console.error('URL 파라미터 디코딩 실패:', error);
      productId = params.id;
    }
  }
  
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1);


  const [currentUser, setCurrentUser] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)

  // 주문 내역 상태 추가
  const [orders, setOrders] = useState<any[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)

  // StoreAI 추천 관련 상태
  const [myPet, setMyPet] = useState<any>(null)
  const [recommendations, setRecommendations] = useState<any[]>([])
  const [recommendationsLoading, setRecommendationsLoading] = useState(false)
  const [recommendationsError, setRecommendationsError] = useState<string | null>(null)

  // 상품 API 함수들 - 백엔드와 직접 연결
  const productApi = {
    // 특정 상품 조회
    getProduct: async (productId: number): Promise<any> => {
      try {
        console.log('상품 조회 요청:', `${API_BASE_URL}/products/${productId}`);
        console.log('요청할 productId:', productId, '타입:', typeof productId);
        
        const response = await axios.get(`${API_BASE_URL}/products/${productId}`);
        console.log('상품 조회 성공:', response.data);
        return response.data;
      } catch (error) {
        console.error('상품 조회 실패:', error);
        if (axios.isAxiosError(error)) {
          console.error('Axios 에러 상세:', {
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data,
            url: error.config?.url,
            method: error.config?.method
          });
        }
        throw error;
      }
    },

    // 네이버 상품 조회
    getNaverProduct: async (productId: string): Promise<any> => {
      try {
        console.log('네이버 상품 조회 요청:', `${API_BASE_URL}/naver-shopping/products/${productId}`);
        console.log('요청할 productId:', productId, '타입:', typeof productId);
        
        const response = await axios.get(`${API_BASE_URL}/naver-shopping/products/${productId}`);
        console.log('네이버 상품 조회 성공:', response.data);
        return response.data;
      } catch (error) {
        console.error('네이버 상품 조회 실패:', error);
        if (axios.isAxiosError(error)) {
          console.error('Axios 에러 상세:', {
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data,
            url: error.config?.url,
            method: error.config?.method
          });
        }
        throw error;
      }
    },
  };

  // 반려동물 정보 가져오기
  const fetchMyPet = async () => {
    try {
      const token = localStorage.getItem('accessToken')
      if (!token) return

      const response = await axios.get(`${API_BASE_URL}/mypet`, {
        headers: {
          "Access_Token": token,
          "Refresh_Token": localStorage.getItem('refreshToken') || ''
        }
      })
      
      // 백엔드 응답 구조: ResponseDto<MyPetListResponseDto>
      if (response.data && response.data.data && response.data.data.myPets && response.data.data.myPets.length > 0) {
        setMyPet(response.data.data.myPets[0])
      }
    } catch (error) {
      console.error('반려동물 정보 가져오기 실패:', error)
    }
  }

     // StoreAI 추천 API 호출
   const fetchRecommendations = async () => {
     if (!myPet) return

     setRecommendationsLoading(true)
     setRecommendationsError(null)
     
     try {
       // 현재 상품이 있으면 상품 기반 추천, 없으면 펫 기반 추천
       let response
       if (product) {
         // 상품 상세페이지용 추천
         try {
           response = await axios.post(`${getBackendUrl()}/api/storeai/recommend/products/${product.id}`, {
             myPetId: myPet.myPetId,
             recommendationType: 'BREED_SPECIFIC'
           })
         } catch (productRecommendationError) {
           console.error('상품 기반 추천 실패, 펫 기반 추천으로 대체:', productRecommendationError)
           // 상품 기반 추천이 실패하면 펫 기반 추천으로 대체
           response = await axios.get(`${getBackendUrl()}/api/storeai/recommend/my-pets`)
         }
       } else if (propNaverProduct) {
         // 네이버 상품인 경우 펫 기반 추천 (네이버 상품은 ID가 0이므로 상품 기반 추천 불가)
         response = await axios.get(`${getBackendUrl()}/api/storeai/recommend/my-pets`)
       } else {
         // 펫 기반 전체 추천
         response = await axios.get(`${getBackendUrl()}/api/storeai/recommend/my-pets`)
       }

      if (response.data.success) {
        let recommendations = []
        
        if (product) {
          // 상품 기반 추천: List<ProductRecommendationResponseDto>
          recommendations = response.data.data || []
        } else {
          // 펫 기반 추천: Map<String, List<ProductRecommendationResponseDto>>
          const petRecommendations = response.data.data || {}
          // 첫 번째 펫의 추천을 사용
          const firstPetName = Object.keys(petRecommendations)[0]
          recommendations = firstPetName ? petRecommendations[firstPetName] : []
        }
        
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



  // 주문 내역 가져오기
  const fetchOrders = async () => {
    setOrdersLoading(true)
    try {
      const token = localStorage.getItem('accessToken')
      const response = await axios.get(`${API_BASE_URL}/orders`, {
        headers: {
          "Access_Token": token,
          "Refresh_Token": localStorage.getItem('refreshToken') || ''
        }
      })
      setOrders(response.data)
    } catch (error) {
      console.error('주문 내역을 가져오는데 실패했습니다:', error)
    } finally {
      setOrdersLoading(false)
    }
  }

  // 현재 사용자 정보 가져오기
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const token = localStorage.getItem('accessToken')
        if (token) {
          const response = await axios.get(`${API_BASE_URL}/accounts/me`, {
            headers: {
              "Access_Token": token,
              "Refresh_Token": localStorage.getItem('refreshToken') || ''
            }
          })
          console.log('사용자 정보 응답:', response.data)
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
    fetchMyPet()
  }, [])

     // 반려동물 정보가 있으면 추천 가져오기
   useEffect(() => {
     if (myPet && (product || propNaverProduct)) {
       fetchRecommendations()
     }
   }, [myPet, product, propNaverProduct])

  useEffect(() => {
    // 네이버 상품이 있는 경우
    if (propNaverProduct) {
             // 네이버 상품을 Product 형태로 변환하여 재고 정보 포함
       const naverProductAsProduct: Product = {
         id: propNaverProduct.id,
         name: propNaverProduct.title.replace(/<[^>]*>/g, ''),
         price: propNaverProduct.price,
         imageUrl: propNaverProduct.imageUrl,
         category: propNaverProduct.category1 || '네이버 쇼핑',
         description: (propNaverProduct.description || propNaverProduct.title).replace(/<[^>]*>/g, ''),
         tags: [],
         stock: 999, // 네이버 상품은 재고 제한 없음으로 설정
         registrationDate: '',
         registeredBy: '',
         petType: 'all',
         brand: propNaverProduct.brand || '브랜드 없음'
       }
      setProduct(naverProductAsProduct)
      setLoading(false)
      return
    }

    // 상품 조회 함수
    const fetchProduct = async () => {
      try {
        setLoading(true)
        setError(null)
        console.log('상품 조회 요청 - productId:', productId)
        console.log('productId 타입:', typeof productId)
        console.log('propProductId:', propProductId)
        console.log('params:', params)
        
        if (!productId) {
          throw new Error('유효하지 않은 상품 ID입니다.')
        }

        let rawData: any;
        
        // productId가 문자열인지 숫자인지 확인
        const isNumeric = !isNaN(Number(productId));
        const numericProductId = Number(productId);
        
        if (isNumeric && numericProductId > 1000000) {
          // 네이버 상품인 경우 (100만 이상이면 네이버 상품으로 간주)
          console.log('네이버 상품 조회 시도 (숫자):', productId);
          const naverResponse = await productApi.getNaverProduct(String(productId));
          rawData = naverResponse.data; // ResponseDto 구조에서 data 추출
        } else if (isNumeric && numericProductId <= 1000000) {
          // 일반 상품인 경우
          console.log('일반 상품 조회 시도:', productId);
          rawData = await productApi.getProduct(numericProductId);
        } else {
          // 문자열인 경우 네이버 상품으로 처리
          console.log('네이버 상품 조회 시도 (문자열):', productId);
          const naverResponse = await productApi.getNaverProduct(String(productId));
          rawData = naverResponse.data; // ResponseDto 구조에서 data 추출
        }
        
        console.log('상품 상세 데이터:', rawData);
        
                 // 백엔드 응답을 프론트엔드 형식으로 변환
         const data: Product = {
           ...rawData,
           id: rawData.id || rawData.productId || 0,  // id를 우선 사용
           productId: rawData.id || rawData.productId || 0,  // 호환성을 위해 productId도 설정
           name: (rawData.name || rawData.title || '상품명 없음').replace(/<[^>]*>/g, ''),
           price: typeof rawData.price === 'number' ? rawData.price : 0,
           imageUrl: rawData.image || rawData.imageUrl || '/placeholder.svg',
           category: rawData.category || rawData.category1 || '카테고리 없음',
           description: (rawData.description || rawData.title || '상품 설명이 없습니다.').replace(/<[^>]*>/g, ''),
           petType: 'all',
           brand: rawData.brand || '브랜드 없음',
           tags: rawData.tags || [],
           stock: typeof rawData.stock === 'number' ? rawData.stock : 999, // 네이버 상품은 기본값 999
           registrationDate: rawData.registrationDate || rawData.createdAt || '등록일 없음',
           registeredBy: rawData.registeredBy || '네이버'
         };
        
        setProduct(data)
      } catch (error) {
        console.error('상품 조회 오류:', error)
        setError('상품을 불러오는데 실패했습니다.')
      } finally {
        setLoading(false)
      }
    }

    if (productId) {
      fetchProduct()
    }
  }, [productId])

  const handleBack = () => {
    if (propOnBack) {
      propOnBack()
    } else {
      router.back()
    }
  }

  const handleAddToCart = async (product: Product) => {
    if (propOnAddToCart) {
      // 수량 정보를 포함하여 전달
      const productWithQuantity = {
        ...product,
        selectedQuantity: quantity
      }
      propOnAddToCart(productWithQuantity)
    } else {
      // 장바구니 추가 로직 구현
      console.log('장바구니에 추가:', product, '수량:', quantity)
      
      // 재고 확인
      const stock = typeof product.stock === 'number' ? product.stock : 0
      if (quantity > stock) {
        alert(`재고가 부족합니다. (재고: ${stock}개, 요청: ${quantity}개)`)
        return
      }
      
      try {
        const token = localStorage.getItem('accessToken')
        if (!token) {
          alert('로그인이 필요합니다.')
          return
        }

        console.log('장바구니 추가 요청:', {
          url: `${API_BASE_URL}/carts?productId=${product.id}&quantity=${quantity}`,
          productId: product.id,
          quantity: quantity,
          product: product
        })
        
        // 장바구니 추가 API 호출 (수량 포함)
        const response = await axios.post(`${API_BASE_URL}/carts?productId=${product.id}&quantity=${quantity}`, null, {
          headers: {
            "Access_Token": token,
            "Refresh_Token": localStorage.getItem('refreshToken') || ''
          }
        })

        console.log('장바구니 추가 응답:', response.data)
        
        if (response.status === 200) {
          alert(`장바구니에 ${quantity}개가 추가되었습니다!`)
          // 장바구니 페이지로 이동
          router.push('/store/cart')
        } else {
          alert('장바구니 추가에 실패했습니다.')
        }
      } catch (error: any) {
        console.error('장바구니 추가 오류:', error)
        
        // 백엔드에서 재고 부족 에러 처리
        if (error.response?.data?.message?.includes('재고가 부족합니다')) {
          alert(error.response.data.message)
        } else {
          alert('장바구니 추가에 실패했습니다.')
        }
      }
    }
  }

  const handleBuyNow = async () => {
    console.log('handleBuyNow 함수 호출됨')
    console.log('product:', product)
    console.log('currentUser:', currentUser)
    
    if (!product) {
      console.log('product가 없음')
      return
    }

    // propOnBuyNow가 전달된 경우에도 직접 Payment 페이지로 이동
    // (website/page.tsx에서 사용될 때도 동일하게 처리)

    if (!currentUser) {
      console.log('currentUser가 없음 - 로그인 필요')
      alert('로그인이 필요합니다.')
      return
    }

    if ((typeof product.stock === 'number' ? product.stock : 0) === 0) {
      console.log('품절된 상품')
      alert('품절된 상품입니다.')
      return
    }

    console.log('Payment 페이지로 이동 시도')
    // URL 파라미터를 통해 Payment 페이지로 이동
    const paymentUrl = `/payment?productId=${product.id}&quantity=${quantity}&price=${product.price}&productName=${encodeURIComponent(product.name)}&imageUrl=${encodeURIComponent(product.imageUrl)}`
    console.log('이동할 URL:', paymentUrl)
    router.push(paymentUrl)
  }

  const isInCart = (id: number) => {
    if (propIsInCart) {
      return propIsInCart(id)
    }
    // 장바구니 확인 로직 구현
    return false
  }

  // 네이버 상품의 재고 상태 확인
  const isNaverProductInStock = () => {
    if (propNaverProduct) {
      return true // 네이버 상품은 항상 재고 있음으로 가정
    }
    return (product?.stock || 0) > 0
  }

                       // 추천 상품 장바구니 추가
     const handleRecommendationAddToCart = async (productId: number) => {
       try {
         console.log('추천 상품 장바구니 추가 - productId:', productId, '타입:', typeof productId)
         
         if (!productId || isNaN(productId)) {
           alert('유효하지 않은 상품 ID입니다.')
           return
         }

         const token = localStorage.getItem('accessToken')
         if (!token) {
           alert('로그인이 필요합니다.')
           return
         }

         console.log('추천 상품 장바구니 추가 요청:', {
           url: `${API_BASE_URL}/carts?productId=${productId}&quantity=1`,
           productId: productId,
           quantity: 1
         })

         const response = await axios.post(`${API_BASE_URL}/carts?productId=${productId}&quantity=1`, null, {
           headers: {
             "Access_Token": token,
             "Refresh_Token": localStorage.getItem('refreshToken') || ''
           }
         })

         console.log('추천 상품 장바구니 추가 응답:', response.data)

         if (response.status === 200) {
           alert('장바구니에 추가되었습니다!')
           // 장바구니 페이지로 이동
           router.push('/store/cart')
         } else {
           alert('장바구니 추가에 실패했습니다.')
         }
       } catch (error: any) {
         console.error('추천 상품 장바구니 추가 오류:', error)
         console.error('에러 상세 정보:', {
           message: error.message,
           status: error.response?.status,
           data: error.response?.data,
           url: error.config?.url
         })
         
         // 백엔드에서 재고 부족 에러 처리
         if (error.response?.data?.message?.includes('재고가 부족합니다')) {
           alert(error.response.data.message)
         } else if (error.response?.status === 400) {
           alert('이미 장바구니에 있는 상품입니다.')
         } else {
           alert('장바구니 추가에 실패했습니다.')
         }
       }
     }

  // 추천 상품 위시리스트 추가
  const handleRecommendationAddToWishlist = async (productId: number) => {
    try {
      const token = localStorage.getItem('accessToken')
      if (!token) {
        alert('로그인이 필요합니다.')
        return
      }

      // 위시리스트 추가 API 호출 (실제 구현 필요)
      alert('위시리스트에 추가되었습니다!')
    } catch (error) {
      console.error('위시리스트 추가 오류:', error)
      alert('위시리스트 추가에 실패했습니다.')
    }
  }





  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400 mx-auto mb-4"></div>
          <p className="text-gray-600">상품 정보를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  // 네이버 상품이 있는 경우
  if (propNaverProduct) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            <Button variant="ghost" onClick={handleBack} className="hover:bg-gray-100">
              <ArrowLeft className="w-4 h-4 mr-2" />
              스토어로 돌아가기
            </Button>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Product Image */}
            <Card>
              <CardContent className="p-6">
                <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                  <Image
                    src={propNaverProduct.imageUrl || "/placeholder.svg"}
                    alt={propNaverProduct.title}
                    width={500}
                    height={500}
                    className="w-full h-full object-cover"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Product Info */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                                             <CardTitle className="text-2xl font-bold">{propNaverProduct.title.replace(/<[^>]*>/g, '')}</CardTitle>
                      <p className="text-gray-600 mt-2">{propNaverProduct.mallName}</p>
                      <Badge variant="outline" className="mt-2 bg-blue-100 text-blue-800">
                        네이버 쇼핑
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-3xl font-bold text-yellow-600">
                      {propNaverProduct.price.toLocaleString()}원
                    </span>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm text-gray-600">
                      브랜드: <span className="font-semibold">{propNaverProduct.brand || '정보 없음'}</span>
                    </p>
                    <p className="text-sm text-gray-600">
                      제조사: <span className="font-semibold">{propNaverProduct.maker || '정보 없음'}</span>
                    </p>
                                         <p className="text-sm text-gray-600">
                       재고: <span className="font-semibold text-green-600">재고 있음 (무제한)</span>
                     </p>
                    {propNaverProduct.rating > 0 && (
                      <p className="text-sm text-gray-600">
                        평점: <span className="font-semibold">⭐ {propNaverProduct.rating}</span>
                      </p>
                    )}
                    {propNaverProduct.reviewCount > 0 && (
                      <p className="text-sm text-gray-600">
                        리뷰: <span className="font-semibold">{propNaverProduct.reviewCount}개</span>
                      </p>
                    )}
                  </div>

                                     {/* 수량 선택 */}
                   <div className="flex items-center space-x-4">
                     <span className="text-sm text-gray-600">수량:</span>
                     <div className="flex items-center space-x-2">
                       <Button
                         size="sm"
                         variant="outline"
                         onClick={() => setQuantity(Math.max(1, quantity - 1))}
                         className="w-8 h-8 p-0"
                       >
                         -
                       </Button>
                       <span className="w-12 text-center text-sm font-medium">{quantity}</span>
                                               <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setQuantity(quantity + 1)}
                          disabled={quantity >= 999} // 네이버 상품은 최대 999개로 제한
                          className="w-8 h-8 p-0"
                        >
                          +
                                                </Button>
                      </div>
                      {quantity >= 999 && (
                        <span className="text-xs text-red-500">최대 수량입니다</span>
                      )}
                    </div>

                                       <div className="flex gap-3">
                      <Button
                        disabled={!isNaverProductInStock()}
                        onClick={async (event) => {
                          // 중복 클릭 방지
                          const button = event?.target as HTMLButtonElement;
                          if (button) {
                            button.disabled = true;
                            button.textContent = '추가 중...';
                          }
                          
                          try {
                            // 네이버 상품은 항상 로컬 스토리지에 저장
                            const token = localStorage.getItem('accessToken')
                            if (!token) {
                              alert('로그인이 필요합니다.')
                              return
                            }

                            // 네이버 상품 정보를 로컬 스토리지에 저장
                            const naverProductForCart = {
                              id: propNaverProduct.id, // 원본 네이버 상품 ID 사용
                              name: propNaverProduct.title.replace(/<[^>]*>/g, ''),
                              price: propNaverProduct.price,
                              imageUrl: propNaverProduct.imageUrl,
                              category: propNaverProduct.category1,
                              quantity: quantity,
                              isNaverProduct: true,
                              productUrl: propNaverProduct.productUrl,
                              mallName: propNaverProduct.mallName,
                              brand: propNaverProduct.brand,
                              maker: propNaverProduct.maker
                            }

                            // 기존 네이버 상품 장바구니 데이터 가져오기
                            const existingNaverCart = JSON.parse(localStorage.getItem('naverCart') || '[]')
                            
                            // 같은 상품이 있는지 확인 (상품명과 쇼핑몰명으로 구분)
                            const existingIndex = existingNaverCart.findIndex((item: any) => 
                              item.name === naverProductForCart.name && 
                              item.mallName === naverProductForCart.mallName
                            )

                            if (existingIndex >= 0) {
                              // 기존 상품이 있으면 수량 추가
                              existingNaverCart[existingIndex].quantity += quantity
                            } else {
                              // 새 상품 추가
                              existingNaverCart.push(naverProductForCart)
                            }

                            // 네이버 상품을 백엔드 cart에 추가 (한 번만 API 호출)
                            if (!token) {
                              alert('로그인이 필요합니다.')
                              return
                            }

                            // 네이버 상품을 백엔드 API로 장바구니에 추가
                            try {
                              console.log('네이버 상품 장바구니 추가 요청:', {
                                productId: propNaverProduct.productId,
                                title: propNaverProduct.title,
                                price: propNaverProduct.price
                              });

                              const response = await axios.post(`${getBackendUrl()}/api/naver-shopping/cart/add`, {
                                productId: propNaverProduct.productId,
                                title: propNaverProduct.title,
                                description: propNaverProduct.description || propNaverProduct.title,
                                price: propNaverProduct.price,
                                imageUrl: propNaverProduct.imageUrl,
                                mallName: propNaverProduct.mallName,
                                productUrl: propNaverProduct.productUrl,
                                brand: propNaverProduct.brand || '',
                                maker: propNaverProduct.maker || '',
                                category1: propNaverProduct.category1 || '',
                                category2: propNaverProduct.category2 || '',
                                category3: propNaverProduct.category3 || '',
                                category4: propNaverProduct.category4 || '',
                                reviewCount: propNaverProduct.reviewCount || 0,
                                rating: propNaverProduct.rating || 0.0,
                                searchCount: propNaverProduct.searchCount || 0
                              }, {
                                params: { quantity },
                                headers: {
                                  'Access_Token': token,
                                  'Refresh_Token': localStorage.getItem('refreshToken') || '',
                                  'Content-Type': 'application/json'
                                },
                                withCredentials: true
                              });

                              console.log('네이버 상품 장바구니 추가 응답:', response.data);

                              if (response.status === 200) {
                                alert(`네이버 상품이 장바구니에 추가되었습니다!`);
                                
                                // propOnAddToCart가 있으면 호출 (website/page.tsx에서 사용될 때)
                                if (propOnAddToCart) {
                                  const naverProductAsProduct = {
                                    id: propNaverProduct.id,
                                    name: propNaverProduct.title.replace(/<[^>]*>/g, ''),
                                    price: propNaverProduct.price,
                                    imageUrl: propNaverProduct.imageUrl,
                                    category: propNaverProduct.category1,
                                    description: propNaverProduct.description || '',
                                    tags: [],
                                    stock: 999,
                                    registrationDate: '',
                                    registeredBy: '',
                                    petType: 'all' as const,
                                    selectedQuantity: quantity,
                                    isNaverProduct: true,
                                    productUrl: propNaverProduct.productUrl,
                                    mallName: propNaverProduct.mallName,
                                    brand: propNaverProduct.brand,
                                    maker: propNaverProduct.maker
                                  }
                                  propOnAddToCart(naverProductAsProduct)
                                } else {
                                  // 직접 cart 페이지로 이동
                                  router.push('/store/cart')
                                }
                              } else {
                                alert('장바구니 추가에 실패했습니다.');
                              }
                            } catch (apiError: any) {
                              console.error('네이버 상품 장바구니 API 오류:', apiError);
                              console.error('에러 상세 정보:', {
                                message: apiError.message,
                                status: apiError.response?.status,
                                data: apiError.response?.data,
                                url: apiError.config?.url
                              });
                              alert('장바구니 추가에 실패했습니다.');
                            }
                          } catch (error) {
                            console.error('네이버 상품 장바구니 추가 오류:', error)
                            alert('장바구니 추가에 실패했습니다.')
                          }
                        }}
                        className={`flex-1 ${isNaverProductInStock() ? 'bg-yellow-400 hover:bg-yellow-500 text-black' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
                      >
                        {isNaverProductInStock() ? '장바구니에 추가' : '품절'}
                      </Button>
                      <Button
                        disabled={!isNaverProductInStock()}
                        onClick={async () => {
                          // 네이버 상품 바로구매 로직
                          if (!currentUser) {
                            alert('로그인이 필요합니다.')
                            return
                          }

                          try {
                            // 네이버 상품을 DB에 저장하고 실제 ID를 가져오기
                            const naverProductData = {
                              productId: propNaverProduct.productId,
                              title: propNaverProduct.title,
                              description: propNaverProduct.description || propNaverProduct.title,
                              price: propNaverProduct.price,
                              imageUrl: propNaverProduct.imageUrl,
                              mallName: propNaverProduct.mallName,
                              productUrl: propNaverProduct.productUrl,
                              brand: propNaverProduct.brand || '',
                              maker: propNaverProduct.maker || '',
                              category1: propNaverProduct.category1 || '',
                              category2: propNaverProduct.category2 || '',
                              category3: propNaverProduct.category3 || '',
                              category4: propNaverProduct.category4 || '',
                              reviewCount: propNaverProduct.reviewCount || 0,
                              rating: propNaverProduct.rating || 0.0,
                              searchCount: propNaverProduct.searchCount || 0
                            };

                            console.log('네이버 상품 DB 저장 요청:', naverProductData);

                            // 필수 필드 검증
                            if (!naverProductData.productId || !naverProductData.title || !naverProductData.price) {
                              throw new Error('필수 상품 정보가 누락되었습니다.');
                            }

                            const response = await axios.post(`${getBackendUrl()}/api/naver-shopping/save`, naverProductData, {
                              headers: {
                                'Access_Token': localStorage.getItem('accessToken'),
                                'Refresh_Token': localStorage.getItem('refreshToken')
                              }
                            });

                            console.log('네이버 상품 DB 저장 응답:', response.data);

                            // 응답 검증
                            if (!response.data.success) {
                              throw new Error(response.data.message || '네이버 상품 저장에 실패했습니다.');
                            }

                            // 저장된 네이버 상품의 실제 ID 사용
                            const savedNaverProductId = response.data.data;

                            // 네이버 상품을 Product 형태로 변환하여 Payment 페이지로 이동
                            const naverProductAsProduct = {
                              id: savedNaverProductId, // DB에 저장된 실제 ID 사용 (Long 타입)
                              name: propNaverProduct.title.replace(/<[^>]*>/g, ''),
                              price: propNaverProduct.price,
                              imageUrl: propNaverProduct.imageUrl,
                              category: propNaverProduct.category1,
                              description: propNaverProduct.description || '',
                              tags: [],
                              stock: 999, // 네이버 상품은 재고 제한 없음
                              registrationDate: '',
                              registeredBy: '',
                              petType: 'all' as const,
                              selectedQuantity: quantity,
                              isNaverProduct: true, // 네이버 상품 플래그 추가
                              productUrl: propNaverProduct.productUrl,
                              mallName: propNaverProduct.mallName,
                              brand: propNaverProduct.brand,
                              maker: propNaverProduct.maker
                            }

                            // URL 파라미터를 통해 Payment 페이지로 이동 (네이버 상품 정보 포함)
                            const paymentUrl = `/payment?productId=${naverProductAsProduct.id}&quantity=${quantity}&price=${naverProductAsProduct.price}&productName=${encodeURIComponent(naverProductAsProduct.name)}&imageUrl=${encodeURIComponent(naverProductAsProduct.imageUrl)}&isNaverProduct=true&productUrl=${encodeURIComponent(naverProductAsProduct.productUrl)}&mallName=${encodeURIComponent(naverProductAsProduct.mallName)}`
                            router.push(paymentUrl)
                          } catch (error) {
                            console.error('네이버 상품 DB 저장 실패:', error);
                            alert('상품 정보를 준비하는 중 오류가 발생했습니다. 다시 시도해주세요.');
                          }
                        }}
                        variant="outline"
                        className={`flex-1 ${!isNaverProductInStock() ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : ''}`}
                      >
                        {isNaverProductInStock() ? '바로 구매' : '품절'}
                      </Button>
                    </div>
                </CardContent>
              </Card>
            </div>
                     </div>
         </div>

         {/* AI 추천 섹션 */}
         <div className="mt-12">
           <Card>
             <CardHeader>
               <div className="flex items-center gap-2">
                 <Sparkles className="w-5 h-5 text-orange-500" />
                 <CardTitle className="text-xl">AI 맞춤 추천</CardTitle>
               </div>
               {myPet && (
                 <p className="text-sm text-gray-600">
                   {myPet.name} ({myPet.breed}, {myPet.age}살)을 위한 맞춤 상품을 추천해드려요
                 </p>
               )}
             </CardHeader>
             <CardContent>
               {!myPet ? (
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
                   <p className="text-gray-600 mb-4">추천 시스템에 일시적인 문제가 있습니다. 잠시 후 다시 시도해주세요.</p>
                   <Button 
                     onClick={fetchRecommendations}
                     variant="outline"
                   >
                     다시 시도
                   </Button>
                 </div>
               ) : recommendations.length > 0 ? (
                                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {recommendations.map((recommendation) => {
                      console.log('추천 상품 렌더링:', recommendation)
                      const productId = recommendation.productId || recommendation.id
                      return (
                        <ProductRecommendationCard
                          key={productId}
                          product={{
                            id: productId,
                            productId: productId,
                            name: recommendation.name.replace(/<[^>]*>/g, ''),
                            price: recommendation.price,
                            imageUrl: recommendation.imageUrl,
                            category: recommendation.category,
                            recommendationReason: recommendation.recommendationReason
                          }}
                          onAddToCart={handleRecommendationAddToCart}
                        />
                      )
                    })}
                  </div>
               ) : (
                 <div className="text-center py-8">
                   <p className="text-gray-600">추천할 상품이 없습니다.</p>
                 </div>
               )}
             </CardContent>
           </Card>
         </div>
       </div>
     )
   }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <h2 className="text-xl font-semibold mb-2">상품을 찾을 수 없습니다</h2>
            <p className="text-gray-600 mb-4">{error || '요청하신 상품이 존재하지 않습니다.'}</p>
            <Button onClick={handleBack}>돌아가기</Button>
          </CardContent>
        </Card>
      </div>
    )
  }





  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={handleBack} className="hover:bg-gray-100">
            <ArrowLeft className="w-4 h-4 mr-2" />
            스토어로 돌아가기
          </Button>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Product Image */}
          <Card>
            <CardContent className="p-6">
              <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                <Image
                  src={product.imageUrl || "/placeholder.svg"}
                  alt={product.name}
                  width={500}
                  height={500}
                  className="w-full h-full object-cover"
                />
              </div>
            </CardContent>
          </Card>

          {/* Product Info */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-2xl font-bold">{product.name}</CardTitle>
                    <p className="text-gray-600 mt-2">{product.category}</p>
                  </div>

                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-3xl font-bold text-yellow-600">
                    {(typeof product.price === 'number' ? product.price : 0).toLocaleString()}원
                  </span>
                  <Badge variant="outline" className="text-sm">
                    {product.petType === 'all' ? '강아지/고양이' : product.petType === 'dog' ? '강아지' : '고양이'}
                  </Badge>
                </div>



                <div className="space-y-2">
                  <p className="text-sm text-gray-600">
                    재고: <span className="font-semibold">{typeof product.stock === 'number' ? product.stock : 0}개</span>
                  </p>
                  {(typeof product.stock === 'number' ? product.stock : 0) === 0 && (
                    <Badge variant="destructive" className="text-sm">
                      품절
                    </Badge>
                  )}
                </div>

                {/* 수량 선택 */}
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-gray-600">수량:</span>
                  <div className="flex items-center space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="w-8 h-8 p-0"
                    >
                      -
                    </Button>
                    <span className="w-12 text-center text-sm font-medium">{quantity}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setQuantity(Math.min((typeof product.stock === 'number' ? product.stock : 0), quantity + 1))}
                      disabled={quantity >= (typeof product.stock === 'number' ? product.stock : 0)}
                      className="w-8 h-8 p-0"
                    >
                      +
                    </Button>
                  </div>
                  {quantity >= (typeof product.stock === 'number' ? product.stock : 0) && (
                    <span className="text-xs text-red-500">최대 재고 수량입니다</span>
                  )}
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={() => handleAddToCart(product)}
                    disabled={(typeof product.stock === 'number' ? product.stock : 0) === 0 || isInCart(product.id)}
                    className="flex-1 bg-yellow-400 hover:bg-yellow-500 text-black"
                  >
                    {isInCart(product.id) ? '장바구니에 추가됨' : '장바구니에 추가'}
                  </Button>
                  <Button
                    onClick={handleBuyNow}
                    variant="outline"
                    disabled={(typeof product.stock === 'number' ? product.stock : 0) === 0 || isLoading}
                    className="flex-1"
                  >
                    {isLoading ? '주문 중...' : '바로 구매'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Product Description */}
                         <Card>
               <CardHeader>
                 <CardTitle>상품 설명</CardTitle>
               </CardHeader>
               <CardContent>
                 <p className="text-gray-700 leading-relaxed">
                   {(product.description || '상품 설명이 없습니다.').replace(/<[^>]*>/g, '')}
                 </p>
               </CardContent>
             </Card>

            {/* Product Details */}
            <Card>
              <CardHeader>
                <CardTitle></CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">카테고리</span>
                    <span className="font-medium">{product.category}</span>
                  </div>

 
                  {product.tags && Array.isArray(product.tags) && product.tags.length > 0 && (
                    <div className="flex justify-between items-start">
                      <span className="text-gray-600">태그</span>
                      <div className="flex flex-wrap gap-1">
                        {product.tags.map((tag, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* AI 추천 섹션 */}
        <div className="mt-12">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-orange-500" />
                <CardTitle className="text-xl">AI 맞춤 추천</CardTitle>
              </div>
              {myPet && (
                <p className="text-sm text-gray-600">
                  {myPet.name} ({myPet.breed}, {myPet.age}살)을 위한 맞춤 상품을 추천해드려요
                </p>
              )}
            </CardHeader>
            <CardContent>
              {!myPet ? (
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
              ) : recommendations.length > 0 ? (
                                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                   {recommendations.map((recommendation) => {
                     console.log('추천 상품 데이터:', recommendation)
                     const productId = recommendation.productId || recommendation.id
                     return (
                       <ProductRecommendationCard
                         key={productId}
                         product={{
                           id: productId,
                           productId: productId,
                           name: recommendation.name.replace(/<[^>]*>/g, ''),
                           price: recommendation.price,
                           imageUrl: recommendation.imageUrl,
                           category: recommendation.category,
                           recommendationReason: recommendation.recommendationReason
                         }}
                         onAddToCart={handleRecommendationAddToCart}
                       />
                     )
                   })}
                 </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-600">추천할 상품이 없습니다.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
