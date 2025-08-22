"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { ChevronDown, ChevronUp, Heart } from "lucide-react"
import { insuranceApi } from "@/lib/api"

interface InsuranceProduct {
  id: number
  company: string
  productName: string
  description: string
  features: string[]
  logo: string
  redirectUrl?: string
}

interface PetInsurancePageProps {
  favoriteInsurance?: number[]
  onAddToFavorites?: (id: number) => void
  onRemoveFromFavorites?: (id: number) => void
  onViewDetails?: (product: InsuranceProduct) => void
}

const mockInsuranceProducts: InsuranceProduct[] = [
  {
    id: 1,
    company: "삼성화재",
    productName: "펫보험 기본형",
    description: "반려동물 기본적인 치료비를 보장합니다",
    features: [
      "입원비/수술비 최대 1000만 원",
      "진료비 보장률 70%까지 선택가능",
      "특진료비보장(응급실 등) 응급시 더안전하게",
    ],
    logo: "/placeholder.svg?height=40&width=40",
  },
  {
    id: 2,
    company: "삼성화재",
    productName: "펫보험 고급형",
    description: "수술비, 입원비 등 고액 진료비를 보장합니다",
    features: ["입원비/수술비 최대 1500만 원", "진료비 보장률 70%까지 선택가능", "응급실 및 특진료 5% 할인"],
    logo: "/placeholder.svg?height=40&width=40",
  },
  {
    id: 3,
    company: "한화손해보험",
    productName: "LIFEPLUS 댕댕이보험 기본형",
    description: "기본적 치료비 보장 및 특약을 통해 보장범위 확대",
    features: ["치료비 최대 1000만원 보장", "입원비, 70% 보장범위", "한 가지 이상의 응급실 치료 기능 가능"],
    logo: "/placeholder.svg?height=40&width=40",
  },
  {
    id: 4,
    company: "현대해상",
    productName: "하이펫보험 스탠다드",
    description: "치료비 보장과 50%까지 보장범위",
    features: ["치료비 최대 800만원 보장", "응급실에서 높은 치료 (최대 추가 30% 할인)", "입원비, 50% 보장범위"],
    logo: "/placeholder.svg?height=40&width=40",
  },
  {
    id: 5,
    company: "현대해상",
    productName: "하이펫보험 프리미엄",
    description: "프리미엄 치료비 보장 및 응급실보장",
    features: ["치료비 최대 1500만원 보장", "응급실에서 높은 치료 (최대 추가 50% 할인)", "입원비, 80% 보장범위"],
    logo: "/placeholder.svg?height=40&width=40",
  },
  {
    id: 6,
    company: "DB손해보험",
    productName: "프로미라이프",
    description: "보험 가입 후 바로 보장받을 수 있는 보험",
    features: ["입원비/수술비 최대 1000만원 보장", "응급실에서 높은 치료 (최대 추가 30% 할인)", "입원비, 50% 보장범위"],
    logo: "/placeholder.svg?height=40&width=40",
  },
]

const insuranceOptions = [
  "삼성화재 펫보험 기본형",
  "삼성화재 펫보험 고급형",
  "한화손해보험 LIFEPLUS 댕댕이보험 기본형",
  "현대해상 하이펫보험 스탠다드",
  "현대해상 하이펫보험 프리미엄",
  "DB손해보험 프로미라이프",
]

const coverageOptions = [
  { id: "patella", name: "슬개골 수술" },
  { id: "skin", name: "피부 질환" },
  { id: "oral", name: "구강 질환" },
  { id: "respiratory", name: "호흡기 질환" },
]

export default function PetInsurancePage({
  favoriteInsurance = [],
  onAddToFavorites,
  onRemoveFromFavorites,
  onViewDetails,
}: PetInsurancePageProps) {
  const [activeTab, setActiveTab] = useState<"find" | "compare">("find")
  const [selectedInsurance, setSelectedInsurance] = useState("")
  const [selectedCoverages, setSelectedCoverages] = useState<string[]>([])
  const [showInsuranceDropdown, setShowInsuranceDropdown] = useState(false)
  const [showCoverageDropdown, setShowCoverageDropdown] = useState(false)
  const [selectedPetType, setSelectedPetType] = useState<"dog" | "cat">("dog")

  // 백엔드 보험 상품 목록 연동
  const [products, setProducts] = useState<InsuranceProduct[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        const data = await insuranceApi.getProducts()
        const mapped: InsuranceProduct[] = (data || []).map((d: any) => ({
          id: d.id,
          company: d.company,
          productName: d.productName,
          description: d.description,
          features: d.features || [],
          logo: d.logoUrl || "/placeholder.svg?height=40&width=40",
          redirectUrl: d.redirectUrl,
        }))
        setProducts(mapped)
      } catch (e) {
        setError("보험 상품을 불러오지 못했습니다.")
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const handleCoverageChange = (coverageId: string, checked: boolean) => {
    if (checked) {
      setSelectedCoverages((prev) => [...prev, coverageId])
    } else {
      setSelectedCoverages((prev) => prev.filter((id) => id !== coverageId))
    }
  }

  const toggleFavorite = (productId: number) => {
    if (favoriteInsurance.includes(productId)) {
      onRemoveFromFavorites?.(productId)
    } else {
      onAddToFavorites?.(productId)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-yellow-100 to-yellow-50 pt-20">
      <div className="container mx-auto px-4 py-8">
        {/* Top Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">펫보험, 간단한 정보로 바로 확인!</h1>

          {/* Insurance Finder Section - Moved up */}
          <div className="max-w-md mx-auto mb-8">
            <div className="bg-white rounded-lg shadow-lg">
              {/* Tabs */}
              <div className="flex">
                <button
                  onClick={() => setActiveTab("find")}
                  className={`flex-1 py-3 px-4 font-medium ${
                    activeTab === "find" ? "bg-yellow-400 text-black" : "bg-gray-100 text-gray-600"
                  }`}
                >
                  내가 원하는 펫보험 찾기
                </button>
                <button
                  onClick={() => setActiveTab("compare")}
                  className={`flex-1 py-3 px-4 font-medium ${
                    activeTab === "compare" ? "bg-yellow-400 text-black" : "bg-gray-100 text-gray-600"
                  }`}
                >
                  펫보험 1:1 비교
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Pet Type Selection */}
                <div className="flex justify-center space-x-4">
                  <button
                    onClick={() => setSelectedPetType("dog")}
                    className={`flex flex-col items-center space-y-2 p-4 rounded-lg ${
                      selectedPetType === "dog" ? "bg-yellow-200" : "bg-yellow-100"
                    }`}
                  >
                    <span className="text-2xl">🐕</span>
                    <span className="text-sm font-medium">강아지</span>
                  </button>
                  <button
                    onClick={() => setSelectedPetType("cat")}
                    className={`flex flex-col items-center space-y-2 p-4 rounded-lg ${
                      selectedPetType === "cat" ? "bg-yellow-200" : "bg-yellow-100"
                    }`}
                  >
                    <span className="text-2xl">🐈</span>
                    <span className="text-sm font-medium">고양이</span>
                  </button>
                </div>

                {activeTab === "find" ? (
                  /* Coverage Selection */
                  <div className="space-y-4">
                    <div className="relative">
                      <button
                        onClick={() => setShowCoverageDropdown(!showCoverageDropdown)}
                        className="w-full p-3 bg-yellow-100 rounded-lg flex items-center justify-between text-left"
                      >
                        <span>보장 혜택 최대 3개 선택</span>
                        {showCoverageDropdown ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>

                      {showCoverageDropdown && (
                        <div className="absolute top-full left-0 right-0 bg-white border-2 border-yellow-400 rounded-lg mt-1 shadow-lg z-10">
                          <div className="p-4 space-y-4">
                            {coverageOptions.map((option) => (
                              <div
                                key={option.id}
                                className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0"
                              >
                                <span className="text-sm">{option.name}</span>
                                <Checkbox
                                  checked={selectedCoverages.includes(option.id)}
                                  onCheckedChange={(checked) => handleCoverageChange(option.id, checked as boolean)}
                                />
                              </div>
                            ))}
                            <Button
                              onClick={() => setShowCoverageDropdown(false)}
                              className="w-full bg-yellow-400 hover:bg-yellow-500 text-black mt-4"
                            >
                              완료
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  /* Insurance Comparison */
                  <div className="space-y-4">
                    <div className="relative">
                      <button
                        onClick={() => setShowInsuranceDropdown(!showInsuranceDropdown)}
                        className="w-full p-3 bg-yellow-100 rounded-lg flex items-center justify-between text-left"
                      >
                        <span className="text-gray-700">펫보험 상품 선택</span>
                        {showInsuranceDropdown ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>

                      {showInsuranceDropdown && (
                        <div className="absolute top-full left-0 right-0 bg-white border-2 border-yellow-400 rounded-lg mt-1 shadow-lg z-10 max-h-60 overflow-y-auto">
                          <div className="p-2">
                            {insuranceOptions.map((option, index) => (
                              <button
                                key={index}
                                onClick={() => {
                                  setSelectedInsurance(option)
                                  setShowInsuranceDropdown(false)
                                }}
                                className="w-full text-left p-3 hover:bg-gray-50 rounded text-sm border-b border-gray-100 last:border-b-0"
                              >
                                {option}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Main Header */}
        <div className="text-center mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">다양한 보험사의 펫보험을 알아보아요!</h2>

          <p className="text-gray-600 mb-8">원하는 3개 업체를 선택하여 가격을 비교해보세요.</p>
        </div>

        {/* Insurance Products Grid */}
        {loading ? (
          <div className="text-center text-gray-600">불러오는 중...</div>
        ) : error ? (
          <div className="text-center text-red-500">{error}</div>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {(products.length ? products : mockInsuranceProducts).map((product) => (
            <Card key={product.id} className="bg-white shadow-lg hover:shadow-xl transition-shadow h-full">
              <CardContent className="p-6 flex flex-col h-full">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <div className="flex-shrink-0">
                      <Image
                        src={product.logo || "/placeholder.svg"}
                        alt={product.company}
                        width={40}
                        height={40}
                        className="rounded"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-500 truncate">{product.company}</p>
                      <h3 className="font-bold text-base leading-tight">{product.productName}</h3>
                    </div>
                  </div>
                </div>

                <div className="flex-1 flex flex-col">
                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">{product.description}</p>

                  <div className="mb-6 flex-1">
                    <h4 className="font-semibold text-sm mb-2 text-yellow-600">비마이펫 TIP</h4>
                    <ul className="space-y-1">
                      {(product.features || []).map((feature, index) => (
                        <li key={index} className="text-xs text-gray-600 flex items-start">
                          <span className="text-yellow-500 mr-2">•</span>
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-auto">
                    <div className="text-xs text-gray-500 mb-2">
                      해당 상품은 공식 보험사 페이지에서 확인 가능합니다.
                    </div>
                    <Button
                      onClick={() => {
                        if (product.redirectUrl) {
                          window.open(product.redirectUrl, '_blank', 'noopener,noreferrer')
                        } else {
                          onViewDetails?.(product)
                        }
                      }}
                      className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-medium h-10"
                    >
                      자세히 보기
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        )}
      </div>
    </div>
  )
}
