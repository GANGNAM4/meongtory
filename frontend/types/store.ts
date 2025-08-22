// 스토어 관련 타입들

export interface NaverProduct {
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
  createdAt: string
  updatedAt: string
  relatedProductId?: number
  link?: string
}

export interface Product {
  id: number  // productId -> id로 변경
  productId?: number  // 호환성을 위해 유지
  name: string
  description: string
  price: number
  stock: number
  imageUrl: string  // image -> imageUrl로 변경
  category: '의류' | '장난감' | '건강관리' | '용품' | '간식' | '사료'  // string -> enum으로 변경
  registrationDate: string  // LocalDate를 string으로 표현
  registeredBy: string
  selectedQuantity?: number  // 선택된 수량 (장바구니 추가 시 사용)
}

export interface WishlistItem {
  id: number
  name: string
  brand: string
  price: number
  image: string
  category: string
}

export interface CartItem {
  id: number
  name: string
  brand: string
  price: number
  image: string
  category: string
  quantity: number
  order: number
  isNaverProduct?: boolean  // 네이버 상품 여부
  naverProduct?: any  // 네이버 상품 원본 데이터
  product?: {
    id: number
    name: string
    description: string
    price: number
    stock: number
    imageUrl: string
    category: string
    registrationDate: string
    registeredBy: string
  }
}

export interface Order {
  id: number
  userId: number
  orderDate: string
  status: "pending" | "completed" | "cancelled"
  totalAmount: number
  items: OrderItem[]
}

export interface OrderItem {
  id: number
  productId: number
  productName: string
  price: number
  quantity: number
  orderDate: string
  status: "completed" | "pending" | "cancelled"
  ImageUrl: string
}

// 스토어 페이지 Props
export interface StorePageProps {
  onClose: () => void
  onAddToWishlist: (product: Product) => void
  isInWishlist: (productId: number) => boolean
  isAdmin?: boolean
  isLoggedIn?: boolean
  onNavigateToStoreRegistration?: () => void
  products?: Product[]
  onViewProduct?: (productId: number) => void
}

export interface StoreProductDetailPageProps {
  productId: number
  onBack: () => void
  onAddToWishlist: (product: Product) => void
  onAddToCart: (product: Product) => void
  onBuyNow: (product: Product) => void
  isInWishlist: (productId: number) => boolean
  isInCart: (productId: number) => boolean
}

export interface StoreProductRegistrationPageProps {
  isAdmin: boolean
  onAddProduct: (product: Product) => void
  onClose: () => void
}

export interface StoreProductEditPageProps {
  productId: number
  onBack: () => void
  onSave: (product: Product) => void
}

export interface CartPageProps {
  cartItems: CartItem[]
  onRemoveFromCart: (itemId: number) => void
  onUpdateQuantity: (itemId: number, quantity: number) => void
  onCheckout: () => void
  onClose: () => void
} 