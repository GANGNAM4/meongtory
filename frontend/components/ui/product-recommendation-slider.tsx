import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './card';
import { Button } from './button';
import { Badge } from './badge';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ProductRecommendationSliderProps {
  products: Array<{
    id?: number;
    productId?: number;
    name: string;
    price: number;
    imageUrl: string;
    category: string;
    recommendationReason: string;
    source?: string;
    externalProductUrl?: string;
    externalMallName?: string;
    brand?: string;
    description?: string;
  }>;
  onAddToCart?: (productId: number, productInfo?: any) => void;
  title: string;
  subtitle?: string;
}

export function ProductRecommendationSlider({
  products,
  onAddToCart,
  title,
  subtitle
}: ProductRecommendationSliderProps) {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = React.useState(0);

  const itemsPerView = 3; // 한 번에 보여줄 아이템 수
  const maxIndex = Math.max(0, products.length - itemsPerView);

  const nextSlide = () => {
    setCurrentIndex(prev => Math.min(prev + 1, maxIndex));
  };

  const prevSlide = () => {
    setCurrentIndex(prev => Math.max(prev - 1, 0));
  };

  const handleCardClick = (product: any) => {
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

  if (products.length === 0) {
    return null;
  }

  // 현재 보여줄 상품들 계산
  const visibleProducts = products.slice(currentIndex, currentIndex + itemsPerView);

  return (
    <div className="w-full">
      {products.length > itemsPerView && (
        <div className="flex items-center justify-end mb-4">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={prevSlide}
              disabled={currentIndex === 0}
              className="w-8 h-8 p-0"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm text-gray-500 min-w-[60px] text-center">
              {currentIndex + 1} / {maxIndex + 1}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={nextSlide}
              disabled={currentIndex >= maxIndex}
              className="w-8 h-8 p-0"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {visibleProducts.map((product, index) => (
          <Card 
            key={product.id || product.productId || index}
            className="w-full hover:shadow-lg transition-shadow duration-200 cursor-pointer"
            onClick={() => handleCardClick(product)}
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
                  e.stopPropagation();
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
        ))}
      </div>

      {/* 슬라이드 인디케이터 */}
      {products.length > itemsPerView && (
        <div className="flex justify-center mt-4 gap-2">
          {Array.from({ length: maxIndex + 1 }, (_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`w-2 h-2 rounded-full transition-colors ${
                index === currentIndex ? 'bg-orange-500' : 'bg-gray-300'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
