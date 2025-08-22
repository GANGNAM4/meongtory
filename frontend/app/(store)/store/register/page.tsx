"use client"

import { useState, useEffect, Suspense } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Upload, X } from "lucide-react"
import { productApi } from "@/lib/api"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"

interface Product {
  id: number
  name: string
  price: number
  image: string
  category: string
  description: string
  tags: string[]
  stock: number
  registrationDate: string
  registeredBy: string
}

interface StoreProductRegistrationPageProps {
  isAdmin?: boolean
  currentUserId?: string
  onBack: () => void
  products: Product[]
  onAddProduct: (product: Product) => void
}

const categories = ["의류", "장난감", "건강관리", "용품", "간식", "사료"]

function StoreProductRegistrationPageContent({
  isAdmin = false,
  currentUserId,
  onBack,
  products,
  onAddProduct,
}: StoreProductRegistrationPageProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnUrlParam = searchParams.get("returnUrl")
  const [formData, setFormData] = useState({
    name: "",
    price: "",
    category: "",
    description: "",
    stock: "",
  })
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setImageFile(null);
      setImagePreview(null);
    }
  };

  const handleSaveProduct = async () => {
    console.log("=== 상품 등록 시작 ===")
    console.log("Form data:", formData)

    // 유효성 검사
    if (!formData.name.trim()) {
      alert("상품명을 입력해주세요.")
      return
    }

    if (!formData.category) {
      alert("카테고리를 선택해주세요.")
      return
    }

    const price = Number.parseInt(formData.price)
    if (!formData.price || isNaN(price) || price <= 0) {
      alert("올바른 가격을 입력해주세요.")
      return
    }

    const stock = Number.parseInt(formData.stock)
    if (!formData.stock || isNaN(stock) || stock < 0) {
      alert("올바른 재고 수량을 입력해주세요.")
      return
    }

    setIsSubmitting(true)

    try {
      let imageUrl = "/placeholder.svg?height=300&width=300"
      
      // 이미지가 있으면 Base64로 변환하여 백엔드로 전송
      if (imageFile) {
        const reader = new FileReader();
        reader.onloadend = () => {
          imageUrl = reader.result as string;
        };
        reader.readAsDataURL(imageFile);
        // Base64 변환을 기다리기 위해 잠시 대기
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const newProduct = {
        name: formData.name.trim(),
        price: price,
        imageUrl: imageUrl, // 백엔드에서 기대하는 필드명
        category: formData.category,
        description: formData.description.trim(),
        stock: stock,

      }

      console.log("새 상품 데이터:", newProduct)

      // 백엔드 API 호출
      const registeredProduct = await productApi.createProduct(newProduct);
      console.log("상품 등록 완료!", registeredProduct);

      alert("상품이 성공적으로 등록되었습니다!")

      // 폼 초기화
      setFormData({
        name: "",
        price: "",
        category: "",
        description: "",
        stock: "",
      })
      setImageFile(null); // Reset image file
      setImagePreview(null); // Reset image preview

      // 스토어 목록 새로고침
      if ((window as any).refreshStoreProducts) {
        (window as any).refreshStoreProducts();
      }

      // 돌아갈 위치가 있으면 해당 위치로 이동, 없으면 onBack
      if (returnUrlParam) {
        router.push(decodeURIComponent(returnUrlParam))
      } else {
        onBack()
      }
    } catch (error) {
      console.error("상품 등록 중 오류:", error)
      console.error('상품 등록 오류:', error);
      alert("상품 등록 중 오류가 발생했습니다.")
    } finally {
      setIsSubmitting(false)
    }
  }

  // if (!isAdmin) {
  //   return (
  //     <div className="min-h-screen bg-gray-50 flex items-center justify-center">
  //       <Card className="w-full max-w-md">
  //         <CardContent className="pt-6 text-center">
  //           <h2 className="text-xl font-semibold mb-2">접근 권한이 없습니다</h2>
  //           <p className="text-gray-600 mb-4">관리자만 상품을 등록할 수 있습니다.</p>
  //           <Button onClick={onBack}>돌아가기</Button>
  //         </CardContent>
  //       </Card>
  //     </div>
  //   )
  // }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={() => router.push('/admin?tab=products')} className="hover:bg-gray-100">
            <ArrowLeft className="w-4 h-4 mr-2" />
            관리자 페이지로 돌아가기
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">상품 등록</h1>
            <p className="text-gray-600">새로운 펫용품을 등록해보세요</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Registration Form */}
          <Card>
            <CardHeader>
              <CardTitle>상품 정보</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Product Name */}
              <div className="space-y-2">
                <Label htmlFor="name">상품명 *</Label>
                <Input
                  id="name"
                  placeholder="상품명을 입력하세요"
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                />
              </div>

              {/* Category */}
              <div className="space-y-2">
                <Label htmlFor="category">카테고리 *</Label>
                <Select value={formData.category} onValueChange={(value) => handleInputChange("category", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="카테고리를 선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>



              {/* Price and Stock */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">가격 (원) *</Label>
                  <Input
                    id="price"
                    type="number"
                    placeholder="0"
                    value={formData.price}
                    onChange={(e) => handleInputChange("price", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stock">재고 수량 *</Label>
                  <Input
                    id="stock"
                    type="number"
                    placeholder="0"
                    value={formData.stock}
                    onChange={(e) => handleInputChange("stock", e.target.value)}
                  />
                </div>
              </div>

              {/* Image Upload */}
              <div className="space-y-2">
                <Label htmlFor="image-upload">사진 첨부 (선택 사항)</Label>
                <Input id="image-upload" type="file" accept="image/*" onChange={handleImageFileChange} />
                {imagePreview ? (
                  <div className="mt-4 w-48 h-48 relative overflow-hidden rounded-md border border-gray-300">
                    <Image 
                      src={imagePreview} 
                      alt="Image Preview" 
                      width={192}
                      height={192}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="mt-4 w-48 h-48 border-2 border-dashed border-gray-300 rounded-md flex items-center justify-center text-gray-400">
                    <Upload className="w-12 h-12" />
                    <p className="text-sm">상품 이미지</p>
                  </div>
                )}
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">상품 설명</Label>
                <Textarea
                  id="description"
                  placeholder="상품에 대한 자세한 설명을 입력하세요"
                  rows={4}
                  value={formData.description}
                  onChange={(e) => handleInputChange("description", e.target.value)}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={onBack} className="flex-1 bg-transparent">
                  취소
                </Button>
                <Button
                  onClick={handleSaveProduct}
                  className="flex-1 bg-yellow-400 hover:bg-yellow-500 text-black"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "등록 중..." : "상품 등록"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Preview */}
          <Card>
            <CardHeader>
              <CardTitle>미리보기</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg p-4 bg-white">
                <div className="aspect-square bg-gray-100 rounded-lg mb-4 flex items-center justify-center overflow-hidden">
                  {imagePreview ? (
                    <Image
                      src={imagePreview}
                      alt="상품 미리보기"
                      width={300}
                      height={300}
                      className="w-full h-full object-cover rounded-lg"
                    />
                  ) : (
                    <div className="text-center text-gray-400">
                      <Upload className="w-12 h-12 mx-auto mb-2" />
                      <p className="text-sm">상품 이미지</p>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold text-lg">{formData.name || "상품명"}</h3>
               
                  <div className="flex items-center justify-between">
                    <span className="text-xl font-bold text-yellow-600">
                      {formData.price ? `${Number.parseInt(formData.price).toLocaleString()}원` : "0원"}
                    </span>
                    {formData.category && (
                      <Badge variant="outline" className="text-xs">
                        {formData.category}
                      </Badge>
                    )}
                  </div>

                  {formData.description && <p className="text-sm text-gray-600 line-clamp-3">{formData.description}</p>}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default function StoreProductRegistrationPage(props: StoreProductRegistrationPageProps) {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <StoreProductRegistrationPageContent {...props} />
    </Suspense>
  )
}
