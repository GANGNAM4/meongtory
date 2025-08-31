import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './card';
import { Button } from './button';
import { Badge } from './badge';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/navigation';

interface ProductRecommendationCardProps {
  product: {
    id?: number;
    productId?: number;
    name: string;
    price: number;
    imageUrl: string;
    category: string;
    recommendationReason: string;
    source?: string; // 네이버 상품 여부 확인용
    externalProductUrl?: string;
    externalMallName?: string;
    brand?: string;
    description?: string;
    similarity?: number; // 유사도 점수 추가
  };
  onAddToCart?: (productId: number, productInfo?: any) => void;
  isAdmin?: boolean; // 관리자 여부 추가
}

export function ProductRecommendationCard({
  product,
  onAddToCart,
  isAdmin = false
}: ProductRecommendationCardProps) {
  const router = useRouter();
  const { isAdmin: authIsAdmin } = useAuth();
  
  // props로 받은 isAdmin과 AuthContext의 isAdmin을 모두 확인
  const canViewSimilarity = isAdmin || authIsAdmin;

  const handleCardClick = () => {
    const productId = product.id || product.productId;
    if (productId) {
      // 네이버 상품인 경우 네이버 전용 URL로 이동
      if (product.source === 'NAVER') {
        router.push(`/store/naver/${productId}`);
      } else {
        // 일반 상품인 경우 기존 URL로 이동
        router.push(`/store/${productId}`);
      }
    }
  };

  return (
    <Card 
      className="w-full max-w-sm hover:shadow-lg transition-shadow duration-200 cursor-pointer"
      onClick={handleCardClick}
    >
      <CardHeader className="p-4 pb-2">
        <div className="relative">
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-48 object-cover rounded-lg"
          />
          <Badge className="absolute top-2 left-2 bg-orange-500 hover:bg-orange-600">
            AI 추천
          </Badge>
          {product.source === 'NAVER' && (
            <Badge className="absolute top-2 right-2 bg-green-500 hover:bg-green-600">
              네이버
            </Badge>
          )}
          {/* 임베딩 검색 유사도 점수 표시 (관리자만) */}
          {canViewSimilarity && product.similarity !== undefined && (
            <div className="absolute bottom-2 left-2 bg-purple-500 text-white px-2 py-1 rounded text-xs font-bold z-10">
              유사도: {product.similarity.toFixed(2)}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-2">
        <div className="h-[3rem] mb-2 flex flex-col justify-start">
          <CardTitle className="text-lg font-semibold line-clamp-2">
            {product.name.replace(/<[^>]*>/g, '')}
          </CardTitle>
          <div className="flex-1"></div>
        </div>
        
        <div className="mb-3">
          <p className="text-2xl font-bold text-primary">
            {product.price.toLocaleString()}원
          </p>
        </div>

        {product.recommendationReason && (
          <div className="mb-4">
            <p className="text-sm text-muted-foreground mb-2">
              <span className="font-medium">추천 이유:</span>
            </p>
            <p className="text-sm text-gray-700 line-clamp-3">
              {product.recommendationReason}
            </p>
          </div>
        )}

        <Button
          onClick={(e) => {
            e.stopPropagation(); // 카드 클릭 이벤트 전파 방지
            const productId = product.id || product.productId || 0;
            console.log('추천 상품 장바구니 버튼 클릭:', {
              productId: productId,
              product: product,
              onAddToCart: typeof onAddToCart
            });
            onAddToCart?.(productId, product);
          }}
          className="w-full bg-yellow-400 hover:bg-yellow-500 text-black"
          size="sm"
        >
          장바구니
        </Button>
      </CardContent>
    </Card>
  );
}
