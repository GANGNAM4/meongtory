"use client"

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Save, X, Upload } from 'lucide-react';
import Image from 'next/image';
import axios from 'axios';
import { getBackendUrl } from '@/lib/api';


interface Product {
  id: number;
  name: string;
  price: number;
  image: string;
  category: string;
  description: string;
  tags: string[];
  stock: number;
  registrationDate: string;
  registeredBy: string;
}

interface StoreProductEditPageProps {
  productId: number;
  onBack: () => void;
  onSave: (product: Product) => void;
}

const categories = [
  { name: "의류", value: "의류" },
  { name: "장난감", value: "장난감" },
  { name: "건강관리", value: "건강관리" },
  { name: "용품", value: "용품" },
  { name: "간식", value: "간식" },
  { name: "사료", value: "사료" },
];



function StoreProductEditPageContent({ productId: propProductId, onBack, onSave }: StoreProductEditPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlProductId = searchParams.get('productId');
  
  // URL에서 productId를 우선적으로 사용, 없으면 props에서 사용
  const actualProductId = urlProductId ? parseInt(urlProductId) : propProductId;
  

  
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>('');

  // 백엔드 URL (환경 변수 또는 실제 URL로 대체)
  const BACKEND_URL = getBackendUrl();

  // 상품 데이터 로드
  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setLoading(true);
        const accessToken = localStorage.getItem("accessToken");
        if (!accessToken) {
          throw new Error('인증 토큰이 없습니다.');
        }

        const response = await axios.get(`${getBackendUrl()}/api/products/${actualProductId}`, {
          headers: {
            Authorization: accessToken, // Bearer 접두사 제거
            'Access_Token': accessToken,
            'Refresh_Token': localStorage.getItem("refreshToken") || '',
          },
        });

        // ResponseDto 형태로 응답이 오므로 response.data.data를 사용
        if (!response.data || !response.data.success) {
          throw new Error(response.data?.error?.message || "API 응답이 올바르지 않습니다.");
        }
        
        const productData = response.data.data;
        const convertedProduct: Product = {
          id: productData.id || productData.productId || actualProductId,
          name: productData.name || productData.productName || '이름 없음',
          price: productData.price || 0,
          image: productData.image_url || productData.imageUrl || productData.image || '/placeholder.svg',
          category: productData.category || '카테고리 없음',
          description: productData.description || '',
          tags: productData.tags
            ? Array.isArray(productData.tags)
              ? productData.tags
              : productData.tags.split(',').map((tag: string) => tag.trim())
            : [],
          stock: productData.stock || 0,
          registrationDate: Array.isArray(productData.registrationDate) 
            ? new Date(productData.registrationDate[0], productData.registrationDate[1] - 1, productData.registrationDate[2]).toISOString()
            : productData.registration_date || productData.registrationDate || productData.createdAt || new Date().toISOString(),
          registeredBy: productData.registered_by || productData.registeredBy || 'admin',
        };

        setProduct(convertedProduct);

        // 이미지 미리보기 설정
        const imageUrl = convertedProduct.image;
        if (imageUrl && imageUrl !== '/placeholder.svg') {
          setImagePreview(imageUrl);
          
          // 파일명 추출
          const fileName = imageUrl.split('/').pop() || `product-${actualProductId}.jpg`;
          setSelectedFileName(fileName);
        }
      } catch (err) {
        console.error('Error fetching product:', err);
        if (axios.isAxiosError(err)) {
          console.error('Axios error details:', {
            status: err.response?.status,
            statusText: err.response?.statusText,
            data: err.response?.data,
            url: err.config?.url,
            method: err.config?.method,
          });
          const status = err.response?.status;
          setError(
            status === 400 ? `잘못된 요청입니다. (상품 ID: ${actualProductId})` :
            status === 404 ? '상품을 찾을 수 없습니다.' :
            `서버 오류가 발생했습니다. (${status || '알 수 없음'})`
          );
        } else {
          setError('상품을 불러오는데 실패했습니다.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
      }, [actualProductId]);

  const handleInputChange = (field: keyof Product, value: any) => {
    if (product) {
      setProduct({ ...product, [field]: value });
    }
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      
      setImageFile(file);
      setSelectedFileName(file.name);
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.onerror = () => console.error('File read error');
      reader.readAsDataURL(file);
    } else {
      setImageFile(null);
      if (!product?.image || product.image === '/placeholder.svg') {
        setImagePreview(null);
        setSelectedFileName('');
      }
    }
  };

  const handleSave = async () => {
    if (!product) return;

    try {
      setSaving(true);
      
      let imageUrl = product.image;
      if (imageFile) {
        const base64Promise = new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(imageFile);
        });
        imageUrl = await base64Promise;
      }

      const updateData = {
        name: product.name,
        price: product.price,
        category: product.category,
        description: product.description,
        stock: product.stock,

        imageUrl: imageUrl,
      };

      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) {
        throw new Error('인증 토큰이 없습니다.');
      }

      const response = await axios.put(`${getBackendUrl()}/api/products/${actualProductId}`, updateData, {
        headers: {
          Authorization: accessToken,
          'Access_Token': accessToken,
          'Refresh_Token': localStorage.getItem("refreshToken") || '',
          'Content-Type': 'application/json',
        },
      });

      // ResponseDto 형태로 응답이 오므로 response.data.success를 확인
      if (!response.data || !response.data.success) {
        throw new Error(response.data?.error?.message || "상품 수정에 실패했습니다.");
      }

      alert('상품이 성공적으로 수정되었습니다.');
      router.push('/admin?tab=products');
    } catch (err) {
      console.error('Error updating product:', err);
      if (axios.isAxiosError(err)) {
        console.error('Axios error details:', err.response?.data);
        alert(`상품 수정 중 오류가 발생했습니다: ${err.response?.data?.error || '알 수 없는 오류'}`);
      } else {
        alert('상품 수정 중 오류가 발생했습니다.');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-600 mx-auto mb-4"></div>
          <p className="text-gray-600">상품 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <h2 className="text-xl font-semibold text-red-600 mb-4">오류 발생</h2>
            <p className="text-gray-600 mb-4">{error || '상품을 찾을 수 없습니다.'}</p>
            <Button onClick={() => router.push('/admin?tab=products')} className="w-full">
              <ArrowLeft className="h-4 w-4 mr-2" />
              돌아가기
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <Button variant="outline" onClick={() => router.push('/admin?tab=products')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            돌아가기
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">상품 수정</h1>
          <div className="w-20"></div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">상품 정보 수정</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* 상품명 */}
            <div className="space-y-2">
              <Label htmlFor="name">상품명 *</Label>
              <Input
                id="name"
                value={product.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="상품명을 입력하세요"
                required
              />
            </div>

            {/* 가격 */}
            <div className="space-y-2">
              <Label htmlFor="price">가격 *</Label>
              <Input
                id="price"
                type="number"
                value={product.price}
                onChange={(e) => handleInputChange('price', parseInt(e.target.value) || 0)}
                placeholder="가격을 입력하세요"
                required
              />
            </div>

            {/* 카테고리 */}
            <div className="space-y-2">
              <Label htmlFor="category">카테고리 *</Label>
              <Select value={product.category} onValueChange={(value) => handleInputChange('category', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="카테고리를 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.value} value={category.value}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>



            {/* 재고 */}
            <div className="space-y-2">
              <Label htmlFor="stock">재고 *</Label>
              <Input
                id="stock"
                type="number"
                value={product.stock}
                onChange={(e) => handleInputChange('stock', parseInt(e.target.value) || 0)}
                placeholder="재고 수량을 입력하세요"
                required
              />
            </div>

            {/* 상품 설명 */}
            <div className="space-y-2">
              <Label htmlFor="description">상품 설명</Label>
              <textarea
                id="description"
                value={product.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="상품에 대한 설명을 입력하세요"
                className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                rows={4}
              />
            </div>

            {/* 이미지 업로드 */}
            <div className="space-y-2">
              <Label htmlFor="image-upload">상품 이미지</Label>
              <div className="space-y-2">
                <div className="relative">
                  <Input 
                    id="image-upload" 
                    type="file" 
                    accept="image/*" 
                    onChange={handleImageFileChange}
                    className="cursor-pointer opacity-0 absolute inset-0 w-full h-full"
                  />
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-yellow-500 transition-colors">
                    <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <p className="text-sm text-gray-600">
                      {selectedFileName ? '파일 변경하기' : '이미지 파일 선택하기'}
                    </p>
                  </div>
                </div>
                {selectedFileName ? (
                  <div className="text-sm text-green-600 font-medium bg-green-50 p-2 rounded-md border border-green-200">
                    ✅ {imageFile ? '새로 선택된 파일' : '기존 파일'}: {selectedFileName}
                  </div>
                ) : product.image && product.image !== "/placeholder.svg" ? (
                  <div className="text-sm text-blue-600 font-medium bg-blue-50 p-2 rounded-md border border-blue-200">
                    📷 기존 이미지가 설정되어 있습니다
                  </div>
                ) : (
                  <div className="text-sm text-gray-500 bg-gray-50 p-2 rounded-md border border-gray-200">
                    📁 파일을 선택해주세요
                  </div>
                )}
              </div>
              {(imagePreview || (product.image && product.image !== "/placeholder.svg")) && (
                <div className="mt-4 w-48 h-48 relative overflow-hidden rounded-md border border-gray-300">
                  <Image
                    src={imagePreview || product.image}
                    alt="상품 이미지"
                    width={192}
                    height={192}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = "/placeholder.svg";
                    }}
                  />
                </div>
              )}
            </div>

            {/* 버튼 */}
            <div className="flex space-x-4 pt-6">
              <Button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white"
              >
                <Save className="h-4 w-4 mr-2" />
                {saving ? '저장 중...' : '저장'}
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push('/admin?tab=products')}
                disabled={saving}
                className="flex-1"
              >
                <X className="h-4 w-4 mr-2" />
                취소
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function StoreProductEditPage(props: StoreProductEditPageProps) {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <StoreProductEditPageContent {...props} />
    </Suspense>
  )
}