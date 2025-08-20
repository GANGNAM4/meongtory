import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './card';
import { Button } from './button';
import { Badge } from './badge';
import { useRouter } from 'next/navigation';

interface ProductRecommendationCardProps {
  product: {
    id?: number;
    productId?: number;
    name: string;
    price: number;
    imageUrl: string;
    category: string;
    recommendationReason: string;
  };
  onAddToCart?: (productId: number) => void;
}

export function ProductRecommendationCard({
  product,
  onAddToCart
}: ProductRecommendationCardProps) {
  const router = useRouter();
  
  const handleCardClick = () => {
    const productId = product.id || product.productId;
    if (productId) {
      // 모든 상품을 동일한 라우트로 이동 (네이버 상품도 일반 상품과 동일하게 처리)
      router.push(`/store/${productId}`);
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
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-2">
        <CardTitle className="text-lg font-semibold mb-2 line-clamp-2">
          {product.name}
        </CardTitle>
        
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
            onAddToCart?.(productId);
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
