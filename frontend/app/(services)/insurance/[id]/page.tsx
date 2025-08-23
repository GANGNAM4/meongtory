"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, ExternalLink, Heart, Star, Shield, Clock, DollarSign } from "lucide-react"
import { insuranceApi, recentApi } from "@/lib/api"
import { useAuth } from "@/components/navigation"

interface InsuranceProduct {
  id: number
  company: string
  productName: string
  description: string
  features: string[]
  logo: string
  redirectUrl?: string
  coverage?: {
    maxAmount: string
    coverageRate: string
    deductible: string
  }
  benefits?: string[]
  requirements?: string[]
}

// 보험사별 공식 사이트 정보
const insuranceCompanySites = {
  "삼성화재": {
    name: "삼성화재",
    logo: "⭐",
    url: "https://direct.samsungfire.com/m/fp/pet.html",
    description: "국내 최대 보험사의 반려동물 보험",
    features: ["다양한 보장 옵션", "우수한 고객 서비스", "안정적인 보험사"]
  },
  "메리츠 화재": {
    name: "메리츠 화재",
    logo: "🏢",
    url: "https://www.meritzfire.com/fire-and-life/pet/direct-pet.do#!/",
    description: "메리츠 화재의 반려동물 보험 상품",
    features: ["다양한 보장 옵션", "온라인 가입 가능", "24시간 상담 서비스"]
  },
  "KB 손해보험": {
    name: "KB 손해보험",
    logo: "🏦",
    url: "https://www.kbinsure.co.kr/CG313010001.ec",
    description: "KB 손해보험의 반려동물 보험 상품",
    features: ["안정적인 보험사", "다양한 할인 혜택", "빠른 보험금 지급"]
  },
  "현대해상": {
    name: "현대해상",
    logo: "🚗",
    url: "https://www.hi.co.kr/serviceAction.do?view=bin/SP/08/HHSP08000M",
    description: "현대해상의 반려동물 보험 상품",
    features: ["종합 보장", "온라인 서비스", "고객 만족도 높음"]
  },
  "NH 손해보험": {
    name: "NH 손해보험",
    logo: "🌾",
    url: "https://nhfire.co.kr/product/retrieveProduct.nhfire?pdtCd=D314511",
    description: "NH 손해보험의 반려동물 보험 상품",
    features: ["농협 그룹", "안정적인 서비스", "합리적인 보험료"]
  }
}

export default function InsuranceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [product, setProduct] = useState<InsuranceProduct | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setLoading(true)
        const productId = Number(params.id)
        
        // 먼저 기본 상품 정보 가져오기
        const basicData = await insuranceApi.getProduct(productId)
        
        if (basicData) {
          // 기본 정보로 초기 설정
          const initialProduct = {
            id: basicData.id,
            company: basicData.company,
            productName: basicData.productName,
            description: basicData.description,
            features: basicData.features || [],
            logo: basicData.logoUrl || "/placeholder.svg",
            redirectUrl: basicData.redirectUrl,
            coverage: basicData.coverage,
            benefits: basicData.benefits,
            requirements: basicData.requirements
          }
          
          setProduct(initialProduct)
          
          // 최근 본 상품에 추가
          addToRecentProducts(initialProduct)
          
          // 상세 정보 크롤링 시도
          try {
            const detailedData = await insuranceApi.getProductDetails(productId)
            if (detailedData) {
              const detailedProduct = {
                id: detailedData.id,
                company: detailedData.company,
                productName: detailedData.productName,
                description: detailedData.description,
                features: detailedData.features || [],
                logo: detailedData.logoUrl || "/placeholder.svg",
                redirectUrl: detailedData.redirectUrl,
                coverage: detailedData.coverage,
                benefits: detailedData.benefits || [],
                requirements: detailedData.requirements || []
              }
              setProduct(detailedProduct)
              
              // 크롤링된 정보로 최근 본 상품 업데이트
              addToRecentProducts(detailedProduct)
            }
          } catch (crawlError) {
            console.warn("상세 정보 크롤링 실패, 기본 정보만 표시:", crawlError)
            // 크롤링 실패 시 기본 정보로 계속 진행
          }
        } else {
          setError("상품을 찾을 수 없습니다.")
        }
      } catch (err) {
        setError("상품 정보를 불러오는데 실패했습니다.")
      } finally {
        setLoading(false)
      }
    }

    if (params.id) {
      fetchProduct()
    }
  }, [params.id])

  // 최근 본 상품 관리 함수들
  const addToRecentProducts = async (product: InsuranceProduct) => {
    if (typeof window === 'undefined') return
    
    const { isLoggedIn } = useAuth()
    
    if (isLoggedIn) {
      // 로그인 시: DB에 저장
      try {
        await recentApi.addToRecent(product.id, "insurance")
      } catch (error) {
        console.error("최근 본 상품 저장 실패:", error)
      }
    } else {
      // 비로그인 시: localStorage에 저장
      addToLocalRecentProducts(product)
      
      // localStorage 변경 이벤트 발생 (다른 탭/컴포넌트에서 감지)
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'recentInsuranceProducts',
        newValue: localStorage.getItem('recentInsuranceProducts')
      }))
    }
  }

  const addToLocalRecentProducts = (product: InsuranceProduct) => {
    const recent = getRecentProducts()
    // 이미 있는 상품이면 제거
    const filtered = recent.filter(p => p.id !== product.id)
    
    // 필요한 정보만 추출하여 저장
    const simplifiedProduct = {
      id: product.id,
      name: product.productName,
      company: product.company,
      logoUrl: product.logo,
      type: 'insurance'
    }
    
    // 맨 앞에 추가 (최신순)
    const updated = [simplifiedProduct, ...filtered].slice(0, 5) // 최대 5개만 유지
    localStorage.setItem('recentInsuranceProducts', JSON.stringify(updated))
  }

  const getRecentProducts = (): any[] => {
    if (typeof window === 'undefined') return []
    const recent = localStorage.getItem('recentInsuranceProducts')
    return recent ? JSON.parse(recent) : []
  }

  const handleBack = () => {
    router.back()
  }

  const handleGoToCompanySite = (companyName: string) => {
    const companyInfo = insuranceCompanySites[companyName as keyof typeof insuranceCompanySites]
    if (companyInfo?.url) {
      window.open(companyInfo.url, '_blank', 'noopener,noreferrer')
    }
  }

  // 회사별 이모지 반환 함수
  const getCompanyEmoji = (companyName: string): string => {
    switch (companyName) {
      case "삼성화재":
        return "⭐"
      case "메리츠화재":
        return "🏢"
      case "KB손해보험":
        return "🏦"
      case "현대해상":
        return "🚗"
      case "NH농협손해보험":
        return "🌾"
      default:
        return "🏢"
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pt-20">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400 mx-auto"></div>
            <p className="mt-4 text-gray-600">상품 정보를 불러오는 중...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-gray-50 pt-20">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <p className="text-red-500 mb-4">{error || "상품을 찾을 수 없습니다."}</p>
            <Button onClick={handleBack} className="bg-yellow-400 hover:bg-yellow-500 text-black">
              <ArrowLeft className="w-4 h-4 mr-2" />
              뒤로 가기
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const companyInfo = insuranceCompanySites[product.company as keyof typeof insuranceCompanySites]

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <Button
            onClick={handleBack}
            variant="outline"
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            뒤로 가기
          </Button>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Product Header */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-start space-x-4">
                  <div className="relative">
                    <Image
                      src={product.logo}
                      alt={product.company}
                      width={80}
                      height={80}
                      className="rounded-lg object-contain bg-white"
                      onError={(e) => {
                        // 로고 로딩 실패 시 기본 아이콘 표시
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent) {
                          const fallback = document.createElement('div');
                          fallback.className = 'w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center text-2xl';
                          fallback.textContent = getCompanyEmoji(product.company);
                          parent.appendChild(fallback);
                        }
                      }}
                    />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                        {product.company}
                      </Badge>
                      {product.logo && product.logo !== "/placeholder.svg" && (
                        <Badge variant="outline" className="text-xs text-blue-600 border-blue-300">
                          실시간 로고
                        </Badge>
                      )}
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">{product.productName}</h1>
                    <p className="text-gray-600">{product.description}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Features */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Star className="w-5 h-5 mr-2 text-yellow-500" />
                  주요 특징
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  {product.features.map((feature, index) => (
                    <div key={index} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                      <span className="text-yellow-500 mt-1">•</span>
                      <span className="text-gray-700">{feature}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Coverage Details */}
            {product.coverage && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Shield className="w-5 h-5 mr-2 text-blue-500" />
                    보장 내용
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <DollarSign className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">최대 보장금액</p>
                      <p className="font-bold text-blue-600">{product.coverage.maxAmount}</p>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <Shield className="w-8 h-8 text-green-500 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">보장률</p>
                      <p className="font-bold text-green-600">{product.coverage.coverageRate}</p>
                    </div>
                    <div className="text-center p-4 bg-purple-50 rounded-lg">
                      <Clock className="w-8 h-8 text-purple-500 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">면책금</p>
                      <p className="font-bold text-purple-600">{product.coverage.deductible}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Benefits */}
            {product.benefits && product.benefits.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <span className="text-green-500 mr-2">✓</span>
                    보장 혜택
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-4">
                    {product.benefits.map((benefit, index) => (
                      <div key={index} className="flex items-start space-x-3 p-3 bg-green-50 rounded-lg">
                        <span className="text-green-500 mt-1">✓</span>
                        <span className="text-gray-700">{benefit}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Requirements */}
            {product.requirements && product.requirements.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <span className="text-blue-500 mr-2">📋</span>
                    가입 조건
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-4">
                    {product.requirements.map((requirement, index) => (
                      <div key={index} className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg">
                        <span className="text-blue-500 mt-1">•</span>
                        <span className="text-gray-700">{requirement}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Crawled Information Notice */}
            {(product.benefits && product.benefits.length > 0) || (product.requirements && product.requirements.length > 0) ? (
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-blue-500">ℹ️</span>
                    <p className="text-sm text-blue-800">
                      위 정보는 해당 보험사 공식 웹사이트에서 실시간으로 수집된 정보입니다.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Company Information */}
            {companyInfo && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <span className="text-2xl mr-2">{companyInfo.logo}</span>
                    {companyInfo.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 mb-4">{companyInfo.description}</p>
                  
                  <div className="space-y-2 mb-4">
                    <h4 className="font-semibold text-sm">주요 특징</h4>
                    {companyInfo.features.map((feature, index) => (
                      <div key={index} className="flex items-center text-sm">
                        <span className="text-blue-500 mr-2">✓</span>
                        <span className="text-gray-700">{feature}</span>
                      </div>
                    ))}
                  </div>

                  <Button
                    onClick={() => handleGoToCompanySite(product.company)}
                    className="w-full bg-blue-500 hover:bg-blue-600 text-white"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    공식 사이트 방문
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>빠른 액션</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  onClick={() => handleGoToCompanySite(product.company)}
                  className="w-full bg-yellow-400 hover:bg-yellow-500 text-black"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  보험 가입하기
                </Button>
                
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    // 즐겨찾기 기능 (나중에 구현)
                    console.log("즐겨찾기 추가")
                  }}
                >
                  <Heart className="w-4 h-4 mr-2" />
                  관심 상품 추가
                </Button>
              </CardContent>
            </Card>

            {/* Contact Info */}
            <Card>
              <CardHeader>
                <CardTitle>고객 상담</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="font-semibold text-gray-900">전화 상담</p>
                    <p className="text-gray-600">1544-0000</p>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">운영 시간</p>
                    <p className="text-gray-600">평일 09:00 - 18:00</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
