"use client"

import { useRouter, usePathname } from "next/navigation";
import { useState, useEffect, useCallback } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Heart, Search, Store, BookOpen, User, ShoppingCart, FileText, MessageSquare } from "lucide-react"

import LoginModal from "@/components/modals/login-modal"
import SignupModal from "@/components/modals/signup-modal"
import PasswordRecoveryModal from "@/components/modals/password-recovery-modal"
import Chatbot from "@/components/features/chatbot"

import MyPage from "../../(dashboard)/my/page"
import AdminPage from "../../(dashboard)/admin/page"

import AdoptionPage from "../../(pets)/adoption/page"
import AdoptionDetailPage from "../../(pets)/adoption/[id]/page"
import AnimalRegistrationPage from "../../(pets)/adoption/register/page"

import GrowthDiaryPage from "../../(pets)/diary/page"
import GrowthDiaryWritePage from "../../(pets)/diary/write/page"
import DiaryEntryDetail from "../../(pets)/diary/[id]/page"

import StorePage from "../../(store)/store/page"
import StoreProductDetailPage from "../../(store)/store/[id]/page"
import StoreProductRegistrationPage from "../../(store)/store/register/page"
import StoreProductEditPage from "../../(store)/store/edit/page"
import CartPage from "../../(store)/store/cart/page"

import PetInsurancePage from "../insurance/page"
import InsuranceDetailPage from "../insurance/[id]/page"
import InsuranceFavoritesPage from "../insurance/favorites/page"

import CommunityPage from "../../(community)/community/page"
import CommunityDetailPage from "../../(community)/community/[id]/page"
import CommunityWritePage from "../../(community)/community/write/page"

import DogResearchLabPage from "../research/page"
import PetNamingService from "../naming/page"

import axios from "axios"
import { Toaster, toast } from "react-hot-toast"
import { getCurrentKSTDate } from "@/lib/utils"

// Types
import type { Pet } from "@/types/pets"
import type { Product, WishlistItem, CartItem, NaverProduct } from "@/types/store"
import type { Insurance } from "@/types/insurance"

// Product 타입 확장 (brand, image 속성 추가)
interface ExtendedProduct extends Product {
  brand?: string
  image?: string
}

interface DiaryEntry {
  id: number
  petName: string
  date: string
  title: string
  content: string
  images: string[]
  milestones: string[]
  tags?: string[]
  weight?: number
  height?: number
  mood: string
  activities: string[]
  ownerEmail?: string
  audioUrl?: string
}

interface CommunityPost {
  id: number
  title: string
  content: string
  author: string
  date: string
  category: string
  boardType: "Q&A" | "자유게시판"
  views: number
  likes: number
  comments: number
  tags: string[]
  ownerEmail?: string
}

interface AdoptionInquiry {
  id: number
  petId: number
  petName: string
  inquirerName: string
  phone: string
  email: string
  message: string
  status: "대기중" | "연락완료" | "승인" | "거절"
  date: string
}



interface Comment {
  id: number
  postId: number
  postTitle: string
  author: string
  content: string
  date: string
  isReported: boolean
}

interface OrderItem {
  id: number
  productId: number
  productName: string
  price: number
  quantity: number
  orderDate: string
  status: "completed" | "pending" | "cancelled"
  ImageUrl: string
}

export default function PetServiceWebsite() {
  
// State management
const [currentPage, setCurrentPage] = useState("home")

// UI 상태
const [showLoginModal, setShowLoginModal] = useState(false)
const [showSignupModal, setShowSignupModal] = useState(false)
const [showPasswordRecovery, setShowPasswordRecovery] = useState(false)
const [showContractTemplatePage, setShowContractTemplatePage] = useState(false)
const [showContractGenerationPage, setShowContractGenerationPage] = useState(false)

// 사용자 관련
const [isLoggedIn, setIsLoggedIn] = useState(false)
const [isAdmin, setIsAdmin] = useState(false)
const [currentUser, setCurrentUser] = useState<{ id: number; email: string; name: string } | null>(null)

// 선택된 데이터
const [selectedPet, setSelectedPet] = useState<Pet | null>(null)
const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
const [selectedProductId, setSelectedProductId] = useState<number | null>(null)
const [selectedNaverProduct, setSelectedNaverProduct] = useState<NaverProduct | null>(null)
const [selectedProductForEdit, setSelectedProductForEdit] = useState<Product | null>(null)
const [selectedInsurance, setSelectedInsurance] = useState<Insurance | null>(null)
const [selectedDiaryEntry, setSelectedDiaryEntry] = useState<DiaryEntry | null>(null)
const [selectedPost, setSelectedPost] = useState<CommunityPost | null>(null)

// 컬렉션 데이터
const [wishlist, setWishlist] = useState<WishlistItem[]>([])
const [cart, setCart] = useState<CartItem[]>([])
const [favoriteInsurance, setFavoriteInsurance] = useState<number[]>([])
const [pets, setPets] = useState<Pet[]>([])
const [products, setProducts] = useState<Product[]>([])
const [insurances, setInsurances] = useState<Insurance[]>([])
const [diaryEntries, setDiaryEntries] = useState<DiaryEntry[]>([])
const [communityPosts, setCommunityPosts] = useState<CommunityPost[]>([])
const [adoptionInquiries, setAdoptionInquiries] = useState<AdoptionInquiry[]>([])
const [comments, setComments] = useState<Comment[]>([])
const [orders, setOrders] = useState<OrderItem[]>([])

// 기타
const [isLoading, setIsLoading] = useState(true)

// Next.js router
const router = useRouter()
const pathname = usePathname()

  // 카트 페이지로 이동할 때 카트 데이터를 다시 불러오는 함수
  const setCurrentPageWithCartRefresh = (page: string) => {
    setCurrentPage(page)
    if (page === "cart" && isLoggedIn) {
      console.log("카트 페이지로 이동, 카트 데이터 새로고침")
      fetchCartItems()
    }
  }

  // 현재 페이지 결정
  useEffect(() => {
    const getCurrentPage = () => {

      if (pathname === "/") {
        // URL 파라미터 확인 (예: /?page=cart)
        const urlParams = new URLSearchParams(window.location.search);
        const pageParam = urlParams.get('page');
        if (pageParam) {
          return pageParam;
        }
        return "home";
      }
      
      // /store/cart 경로는 독립적인 페이지로 처리
      if (pathname === "/store/cart") {
        return "external"; // 외부 페이지로 처리
      }
      
      const path = pathname.split("/")[2] || pathname.split("/")[1];
      return path || "home";
    };
    setCurrentPage(getCurrentPage());
  }, [pathname]);

  // 로딩 타임아웃
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (isLoading) {
        console.log("로딩 타임아웃, 강제 해제");
        setIsLoading(false);
        toast.error("서버 응답이 느립니다. 다시 시도해주세요.", { duration: 5000 });
      }
    }, 3000);
    return () => clearTimeout(timeout);
  }, [isLoading]);

  // OAuth 콜백 처리
  useEffect(() => {
    if (typeof window === "undefined") return
    const urlParams = new URLSearchParams(window.location.search)
    const success = urlParams.get("success")
    const error = urlParams.get("error")
    const accessToken = urlParams.get("accessToken")
    const refreshToken = urlParams.get("refreshToken")
    if (success && accessToken && refreshToken) {
      localStorage.setItem("accessToken", accessToken)
      localStorage.setItem("refreshToken", refreshToken)
      const fetchUserInfo = async () => {
        try {
          const response = await axios.get("http://localhost:8080/api/accounts/me")
          const userData = response.data?.data
          if (!userData) throw new Error("사용자 데이터가 없습니다")
          const { id, email, name, role } = userData
          setCurrentUser({ id, email, name })
          setIsLoggedIn(true)
          setIsAdmin(role === "ADMIN")
          toast.success("OAuth 로그인 되었습니다", { duration: 5000 })
          router.push("/")
        } catch (err: any) {
          console.error("사용자 정보 조회 실패:", err)
          let errorMessage = "사용자 정보 조회 실패"
          if (err.response) {
            errorMessage += ": " + (err.response.data?.message || err.response.statusText)
          } else if (err.request) {
            errorMessage += ": 서버에 연결할 수 없습니다"
          } else {
            errorMessage += ": " + err.message
          }
          toast.error(errorMessage, { duration: 5000 })
          localStorage.removeItem("accessToken")
          localStorage.removeItem("refreshToken")
          setIsLoggedIn(false)
          setCurrentUser(null)
          setIsAdmin(false)
        }
      }
      fetchUserInfo()
    } else if (error) {
      toast.error(decodeURIComponent(error), { duration: 5000 })
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }, [])

  // Event handlers
  const handleLogin = async (email: string, password: string) => {
    try {
      console.log("로그인 시도:", { email })
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_BAKCEND_URL}/api/accounts/login`,
        { email, password },
        { headers: { "Content-Type": "application/json" } }
      )

      const { data } = response.data
      const { accessToken, refreshToken, user } = data

      localStorage.setItem("accessToken", accessToken)
      localStorage.setItem("refreshToken", refreshToken)
      
      // 상태 업데이트를 동기적으로 처리
      const userInfo = { id: user.id, email: user.email, name: user.name }
      const isAdminUser = user.role === "ADMIN"
      
      // 모든 상태를 한 번에 업데이트
      setCurrentUser(userInfo)
      setIsLoggedIn(true)
      setIsAdmin(isAdminUser)
      setShowLoginModal(false)
      
      // 즉시 toast 표시
      toast.success("로그인 되었습니다", { duration: 5000 })
      
      // 페이지 변경도 즉시 실행
      setCurrentPage(isAdminUser ? "admin" : "home")
      
      console.log("로그인 완료 - 상태 업데이트됨:", { userInfo, isLoggedIn: true, isAdmin: isAdminUser })
      
    } catch (err: any) {
      console.error("로그인 실패:", err.response?.data?.message || err.message)
      const errorMessage =
        err.response?.data?.code === "LOGIN_FAILED"
          ? "이메일 또는 비밀번호가 올바르지 않습니다."
          : "로그인 중 오류가 발생했습니다."
      toast.error(errorMessage, { duration: 5000 })
    }
  }

  const handleSignup = (userData: any) => {
    console.log("회원가입 데이터:", userData)
    setIsLoggedIn(true)
    const userId = userData.email.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0) % 1000 + 1
    setCurrentUser({ id: userId, email: userData.email, name: userData.name })
    toast.success("회원가입 및 로그인이 완료되었습니다", { duration: 5000 })

    if (userData.petType && userData.petAge && userData.petBreed) {
      const newPet: Pet = {
        id: pets.length + 1,
        name: `${userData.name}'s Pet`,
        breed: userData.petBreed,
        age: userData.petAge,
        gender: "미상",
        size: "대형",
        personality: [],
        healthStatus: "건강함",
        description: "사용자가 등록한 펫",
        images: ["/placeholder.svg?height=400&width=600"],
        location: "사용자 거주지",
        contact: "사용자 연락처",
        adoptionFee: 0,
        isNeutered: false,
        isVaccinated: false,
        dateRegistered: getCurrentKSTDate(),
        adoptionStatus: "available",
        ownerEmail: userData.email,
      }
      setPets((prev) => [...prev, newPet])
    }
    setShowSignupModal(false)
  }

  const handleLogout = async () => {
    try {
      const accessToken = localStorage.getItem("accessToken")
      if (accessToken) {
        await axios.post(
          `${process.env.NEXT_PUBLIC_BAKCEND_URL}/api/accounts/logout`,
          {},
          {
            headers: {
              "Content-Type": "application/json"
            },
          }
        )
      }
      localStorage.removeItem("accessToken")
      localStorage.removeItem("refreshToken")
      setIsLoggedIn(false)
      setIsAdmin(false)
      setCurrentUser(null)
      // 로그아웃 시 장바구니 초기화
      setCart([])
      toast.success("로그아웃 되었습니다", { duration: 5000 })
      setCurrentPage("home")
    } catch (err: any) {
      console.error("로그아웃 실패:", err.response?.data?.message || err.message)
      toast.error("로그아웃 실패", { duration: 5000 })
    }
  }

  const handleAddToWishlist = (item: WishlistItem) => {
    setWishlist((prev) => {
      const exists = prev.find((w) => w.id === item.id)
      if (exists) {
        toast.success("위시리스트에서 제거되었습니다", { duration: 5000 })
        return prev.filter((w) => w.id !== item.id)
      } else {
        toast.success("위시리스트에 추가되었습니다", { duration: 5000 })
        return [...prev, item]
      }
    })
  }

  const isInWishlist = (id: number) => {
    return wishlist.some((item) => item.id === id)
  }


  const handleAddToCart = async (product: Product) => {
    if (!isLoggedIn) {
      toast.error("로그인이 필요합니다", { duration: 5000 })
      return
    }

    // 네이버 상품인지 확인
    if ((product as any).isNaverProduct) {
      console.log("네이버 상품 장바구니 추가 처리")
      
      try {
        const accessToken = localStorage.getItem("accessToken")
        if (!accessToken || accessToken.trim() === '') {
          console.error("Access Token이 없거나 비어있습니다!")
          toast.error("인증 토큰이 없습니다. 다시 로그인해주세요.", { duration: 5000 })
          return
        }

        // 수량 추출
        const quantity = (product as any).selectedQuantity || 1
        console.log("네이버 상품 추가할 수량:", quantity)

        // 네이버 상품을 백엔드 cart에 추가
        const url = `http://localhost:8080/api/carts?productId=${product.id}&quantity=${quantity}`
        const response = await axios.post(url, null, {
          headers: { 
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": `${accessToken}`,
            "Access_Token": accessToken,
            "Refresh_Token": localStorage.getItem('refreshToken') || ''
          },
          timeout: 5000
        })

        if (response.status !== 200) {
          throw new Error(`네이버 상품 장바구니 추가에 실패했습니다. (${response.status})`)
        }

        await fetchCartItems()
        toast.success(`${product.name}을(를) 장바구니에 ${quantity}개 추가했습니다`, { duration: 5000 })
        setCurrentPage("cart")
        return
      } catch (error: any) {
        console.error("네이버 상품 장바구니 추가 오류:", error)
        toast.error("네이버 상품 장바구니 추가에 실패했습니다.", { duration: 5000 })
        return
      }
    }

    // 일반 상품 처리
    try {
      console.log('일반 상품 장바구니 추가 시작...')
      const accessToken = localStorage.getItem("accessToken")
      const refreshToken = localStorage.getItem("refreshToken")
      console.log("Access Token 존재 여부:", !!accessToken)
      console.log("Refresh Token 존재 여부:", !!refreshToken)
      console.log("Access Token 길이:", accessToken?.length)
      console.log("Access Token 내용 (처음 20자):", accessToken?.substring(0, 20))
      
      if (!accessToken || accessToken.trim() === '') {
        console.error("Access Token이 없거나 비어있습니다!")
        toast.error("인증 토큰이 없습니다. 다시 로그인해주세요.", { duration: 5000 })
        return
      }

      // 수량 추출 (상품 상세페이지에서 전달받은 수량 또는 기본값 1)
      const quantity = (product as any).selectedQuantity || 1
      console.log("추가할 수량:", quantity)

      // 재고 확인
      const stock = typeof product.stock === 'number' ? product.stock : 0
      if (quantity > stock) {
        toast.error(`재고가 부족합니다. (재고: ${stock}개, 요청: ${quantity}개)`, { duration: 5000 })
        return
      }

      // 장바구니 추가 API (수량 포함)
      const url = `http://localhost:8080/api/carts?productId=${product.productId}&quantity=${quantity}`

      const response = await axios.post(url, null, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        timeout: 5000,
      })
      if (response.status !== 200) {
        throw new Error(`장바구니 추가에 실패했습니다. (${response.status})`)
      }
      await fetchCartItems()
      toast.success(`${product.name}을(를) 장바구니에 추가했습니다`, { duration: 5000 })
      router.push("/cart")
    } catch (error: any) {
      console.error("장바구니 추가 오류:", error)
      toast.error("백엔드 서버 연결에 실패했습니다. 장바구니 추가가 불가능합니다.", { duration: 5000 })
    }
  }

  const isInCart = (id: number) => {
    return cart.some((item) => item.id === id)
  }

  const fetchCartItems = async () => {
    if (!isLoggedIn) return
    try {
      const accessToken = localStorage.getItem("accessToken")
      if (!accessToken) {
        console.log("Access token이 없습니다.")
        return
      }
      const response = await axios.get(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080'}/api/carts`, {
        headers: { "Access_Token": accessToken },
        timeout: 5000,
      })
      if (response.status !== 200) {
        throw new Error("장바구니 조회에 실패했습니다.")
      }
      const cartData = response.data
      const cartItems: CartItem[] = cartData
        .sort((a: any, b: any) => a.id - b.id)

        .map((item: any, index: number) => {
          // 네이버 상품인지 일반 상품인지 확인
          if (item.naverProduct) {
            // 네이버 상품
            return {
              id: item.id,
              name: item.naverProduct.title,
              brand: item.naverProduct.brand || "네이버 쇼핑",
              price: item.naverProduct.price,
              image: item.naverProduct.imageUrl || "/placeholder.svg",
              category: item.naverProduct.category1 || "기타",
              quantity: item.quantity,
              order: index,
              isNaverProduct: true,
              product: {
                id: item.naverProduct.id,
                name: item.naverProduct.title,
                description: item.naverProduct.description,
                price: item.naverProduct.price,
                stock: 999,
                imageUrl: item.naverProduct.imageUrl,
                category: item.naverProduct.category1 || "기타",

                registrationDate: new Date().toISOString(),
                registeredBy: "네이버 쇼핑"
              }
            }
          } else {
            // 일반 상품
            return {
              id: item.id,
              name: item.product.name,
              brand: "브랜드 없음",
              price: item.product.price,
              image: item.product.imageUrl || "/placeholder.svg",
              category: item.product.category,
              quantity: item.quantity,
              order: index,
              isNaverProduct: false,
              product: {
                id: item.product.id,
                name: item.product.name,
                description: item.product.description,
                price: item.product.price,
                stock: item.product.stock,
                imageUrl: item.product.imageUrl,
                category: item.product.category,

                registrationDate: item.product.registrationDate,
                registeredBy: item.product.registeredBy,
              }
            }
          }
        })
      setCart(cartItems)
      console.log('장바구니 설정 완료:', cartItems.length, '개')
    } catch (error: any) {
      console.error("장바구니 조회 오류:", error)
      setCart([])
      toast.error("백엔드 서버 연결에 실패했습니다. 장바구니를 불러올 수 없습니다.", { duration: 5000 })
    }
  }

  useEffect(() => {
    if (isLoggedIn) fetchCartItems();
  }, [isLoggedIn]);




  // 장바구니에서 상품 제거
  const onRemoveFromCart = async (cartId: number) => {
    try {

      const accessToken = localStorage.getItem("accessToken")
      if (!accessToken) {
        toast.error("로그인이 필요합니다")
        return
      }

      const response = await axios.delete(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080'}/api/carts/${cartId}`, {
        headers: { "Access_Token": accessToken }
      })
      
      if (response.status === 200) {
        await fetchCartItems()
        toast.success("장바구니에서 상품을 삭제했습니다")
      } else {
        throw new Error("장바구니에서 삭제에 실패했습니다.")
      }
    } catch (error: any) {
      console.error("장바구니 삭제 오류:", error)
      toast.error("장바구니에서 삭제에 실패했습니다")
    }
  }

  // 수량 업데이트
  const onUpdateQuantity = async (cartId: number, quantity: number) => {
    try {
      const accessToken = localStorage.getItem("accessToken")
      if (!accessToken) {
        toast.error("로그인이 필요합니다")
        return
      }

      const response = await axios.put(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080'}/api/carts/${cartId}?quantity=${quantity}`, null, {
        headers: { "Access_Token": accessToken }
      })
      
      if (response.status === 200) {
        await fetchCartItems()
        toast.success("장바구니 수량을 업데이트했습니다")
      } else {
        throw new Error("수량 업데이트에 실패했습니다.")
      }
    } catch (error: any) {
      console.error("수량 업데이트 오류:", error)
      toast.error("수량 업데이트에 실패했습니다")
    }
  }

  // 전체 구매
  const onPurchaseAll = async (items: CartItem[]) => {
    try {
      const accessToken = localStorage.getItem("accessToken")
      if (!accessToken) {
        toast.error("로그인이 필요합니다")
        return
      }

      // 각 상품을 개별적으로 주문
      for (const item of items) {
        const orderData = {
          accountId: currentUser?.id || 1,
          productId: item.product?.id || item.id,
          quantity: item.quantity,
        }

        await axios.post(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080'}/api/orders`, orderData, {
          headers: { "Access_Token": accessToken }
        })
      }

      // 장바구니 비우기
      for (const item of items) {
        await onRemoveFromCart(item.id)
      }

      toast.success("전체 구매가 완료되었습니다")
      router.push("/my")
    } catch (error: any) {
      console.error("전체 구매 오류:", error)
      toast.error("전체 구매에 실패했습니다")
    }
  }

  // 개별 구매
  const onPurchaseSingle = async (item: CartItem) => {
    try {
      const accessToken = localStorage.getItem("accessToken")
      if (!accessToken) {
        toast.error("로그인이 필요합니다")
        return
      }

      const orderData = {
        accountId: currentUser?.id || 1,
        productId: item.product?.id || item.id,
        quantity: item.quantity,
      }

      const response = await axios.post(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080'}/api/orders`, orderData, {
        headers: { "Access_Token": accessToken }
      })

      if (response.status === 200) {
        await onRemoveFromCart(item.id)
        toast.success("개별 구매가 완료되었습니다")
        router.push("/my")
      } else {
        throw new Error("개별 구매에 실패했습니다.")
      }
    } catch (error: any) {
      console.error("개별 구매 오류:", error)
      toast.error("개별 구매에 실패했습니다")
    }
  }

  const createOrder = async (orderData: { userId: number; amount: number }) => {
    try {
      const response = await axios.post("http://localhost:8080/api/orders", orderData, {
        headers: { "Content-Type": "application/json" },
      })
      if (response.status !== 200) {
        throw new Error("주문 생성에 실패했습니다.")
      }
      const newOrder = response.data
      setOrders((prev) => [...prev, newOrder])
      toast.success("주문이 생성되었습니다", { duration: 5000 })
      return newOrder
    } catch (error) {
      console.error("주문 생성 오류:", error)
      toast.error("주문 생성에 실패했습니다", { duration: 5000 })
      throw error
    }
  }


  const purchaseAllFromCart = async () => {
    if (!isLoggedIn || !currentUser) {
      toast.error("로그인이 필요합니다", { duration: 5000 })
      return
    }
    try {
      const response = await axios.post(`http://localhost:8080/api/orders/purchase-all/${currentUser.id}`)
      if (response.status !== 200) {
        throw new Error("전체 구매에 실패했습니다.")
      }
      const newOrder = response.data
      setOrders((prev) => [...prev, newOrder])
      setCart([])
      await fetchUserOrders()
      toast.success("전체 구매가 완료되었습니다", { duration: 5000 })
      router.push("/my")
    } catch (error) {
      console.error("전체 구매 오류:", error)
      toast.error("전체 구매에 실패했습니다", { duration: 5000 })
    }
  }

  const purchaseSingleItem = async (cartItem: CartItem) => {
    if (!isLoggedIn || !currentUser) {
      toast.error("로그인이 필요합니다", { duration: 5000 })
      return
    }
    try {
      const accessToken = localStorage.getItem("accessToken")
      const headers: any = {
        "Content-Type": "application/json",
        Accept: "application/json",
      }
      if (accessToken) headers["access_token"] = accessToken
      const orderData = {
        userId: currentUser.id,
        amount: cartItem.price * cartItem.quantity,
        orderItems: [
          {
            productId: cartItem.product?.productId || cartItem.id,
            productName: cartItem.product?.name || cartItem.name || cartItem.brand + " " + cartItem.category,
            imageUrl: cartItem.product?.imageUrl || cartItem.image || "/placeholder.svg",
            quantity: cartItem.quantity,
            price: cartItem.product?.price || cartItem.price,
          },
        ],
      }
      const response = await axios.post("http://localhost:8080/api/orders", orderData, {
        headers,
        timeout: 10000,
      })
      if (response.status !== 200) {
        throw new Error("개별 구매에 실패했습니다.")
      }
              await onRemoveFromCart(cartItem.id)
      await fetchUserOrders()
      toast.success("개별 구매가 완료되었습니다", { duration: 5000 })
      router.push("/my")
    } catch (error: any) {
      console.error("개별 구매 오류:", error)
      toast.error("개별 구매에 실패했습니다", { duration: 5000 })
    }
  }

  const fetchUserOrders = useCallback(async () => {
    if (!isLoggedIn || !currentUser) return
    try {
      const response = await axios.get(`http://localhost:8080/api/orders/user/${currentUser.id}`)
      if (response.status !== 200) {
        throw new Error("주문 조회에 실패했습니다.")
      }
      const userOrders = response.data
      const orderItems: OrderItem[] = userOrders.flatMap((order: any) => {
        if (order.orderItems && order.orderItems.length > 0) {
          return order.orderItems.map((item: any) => ({
            id: item.id || order.orderId,
                            productId: item.id || 0,
            productName: item.productName || `주문 #${order.orderId}`,
                          price: item.price || order.amount,
            quantity: item.quantity || 1,
            orderDate: order.orderedAt || new Date().toISOString(),
            status: order.paymentStatus === "COMPLETED" ? "completed" : order.paymentStatus === "PENDING" ? "pending" : "cancelled",
            ImageUrl: item.ImageUrl || "/placeholder.svg",
          }))
        } else {
          return [
            {
              id: order.orderId,
              productId: 0,
              productName: `주문 #${order.orderId}`,
              price: order.amount,
              quantity: 1,
              orderDate: order.orderedAt || new Date().toISOString(),
              status: order.paymentStatus === "COMPLETED" ? "completed" : order.paymentStatus === "PENDING" ? "pending" : "cancelled",
              ImageUrl: "/placeholder.svg",
            },
          ]
        }
      })
      const sortedOrderItems = orderItems.sort((a, b) => {
        const dateA = new Date(a.orderDate).getTime()
        const dateB = new Date(b.orderDate).getTime()
        return dateB - dateA
      })
      setOrders(sortedOrderItems)
    } catch (error) {
      console.error("주문 조회 오류:", error)
      toast.error("주문 조회에 실패했습니다", { duration: 5000 })
    }
  }, [isLoggedIn, currentUser])

  const deleteOrder = async (orderId: number) => {
    try {
      const response = await axios.delete(`http://localhost:8080/api/orders/${orderId}`)
      if (response.status !== 200) {
        throw new Error("주문 삭제에 실패했습니다.")
      }
      setOrders((prev) => prev.filter((order) => order.id !== orderId))
      toast.success("주문이 삭제되었습니다", { duration: 5000 })
    } catch (error) {
      console.error("주문 삭제 오류:", error)
      toast.error("주문 삭제에 실패했습니다", { duration: 5000 })
    }
  }

  const updatePaymentStatus = async (orderId: number, status: "PENDING" | "COMPLETED" | "CANCELLED") => {
    try {
      const response = await axios.put(`http://localhost:8080/api/orders/${orderId}/status?status=${status}`)
      if (response.status !== 200) {
        throw new Error("결제 상태 업데이트에 실패했습니다.")
      }
      setOrders((prev) =>
        prev.map((order) =>
          order.id === orderId
            ? { ...order, status: status === "COMPLETED" ? "completed" : status === "PENDING" ? "pending" : "cancelled" }
            : order
        )
      )
      toast.success("결제 상태가 업데이트되었습니다", { duration: 5000 })
    } catch (error) {
      console.error("결제 상태 업데이트 오류:", error)
      toast.error("결제 상태 업데이트에 실패했습니다", { duration: 5000 })
    }
  }

  const handleAddPet = (petData: any) => {
    const newPet: Pet = {
      id: pets.length + 1,
      ...petData,
      dateRegistered: getCurrentKSTDate(),
      adoptionStatus: "available",
    }
    setPets((prev) => [...prev, newPet])
    toast.success("새로운 펫이 등록되었습니다", { duration: 5000 })
    router.push("/adoption")
  }

  const fetchProducts = async () => {
    try {
      const accessToken = localStorage.getItem("accessToken")
      const headers: any = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
      
      if (accessToken && accessToken.trim() !== '') {
        if (accessToken.split('.').length === 3) {
          headers['Access_Token'] = accessToken
          headers['Refresh_Token'] = localStorage.getItem('refreshToken') || ''
          console.log('인증 토큰 추가됨')
        } else {
          console.log('토큰 형식이 유효하지 않음 - 익명 접근')
        }
      } else {
        console.log('인증 토큰 없음 - 익명 접근')
      }
      
      const response = await axios.get('http://localhost:8080/api/products', {
        timeout: 10000,
        headers: headers
      })
      
      console.log('응답 상태:', response.status)
      console.log('응답 헤더:', response.headers)
      console.log('응답 데이터 타입:', typeof response.data)
      console.log('응답 데이터:', response.data)
      console.log('응답 데이터가 배열인가?', Array.isArray(response.data))
      console.log('응답 데이터 길이:', response.data?.length)
      
      const backendProducts = response.data?.data || response.data
      console.log('백엔드에서 받은 상품 데이터:', backendProducts)
      
      if (!Array.isArray(backendProducts)) {
        throw new Error("잘못된 데이터 형식")
      }
      const convertedProducts: Product[] = backendProducts.map((product: any) => ({
        id: product.id || product.productId || 0,
        name: product.name || '상품명 없음',
        description: product.description || '',
        price: product.price || 0,
        imageUrl: product.imageUrl || product.image || "/placeholder.svg?height=300&width=300",
        category: (product.category as '의류' | '장난감' | '건강관리' | '용품' | '간식' | '사료') || '용품',

        stock: product.stock || 0,
        registrationDate: product.registrationDate || new Date().toISOString().split("T")[0],
        registeredBy: product.registeredBy || "admin",
      }))
      setProducts(convertedProducts)
      console.log("상품 목록 설정 완료:", convertedProducts.length, "개")
    } catch (error: any) {
      console.error("상품 목록 조회 오류:", error)
      setProducts([])
      toast.error("백엔드 서버 연결에 실패했습니다. 상품 목록을 불러올 수 없습니다.", { duration: 5000 })
    }
  }

  useEffect(() => {
    fetchProducts()
  }, [])

  const handleAddProduct = (productData: any) => {
    const newProduct: Product = {
      id: products.length + 1,
      ...productData,
      registrationDate: getCurrentKSTDate(),
      registeredBy: currentUser?.email || "admin",
      petType: productData.petType || "all",

    }
    setProducts((prev) => [...prev, newProduct])
    toast.success("새로운 상품이 등록되었습니다", { duration: 5000 })
    router.push("/store")
  }

  const handleViewProduct = (product: Product | NaverProduct) => {
    console.log("handleViewProduct called with:", product)
    console.log("Product keys:", Object.keys(product))
    console.log("Product type check:", {
      hasProductUrl: 'productUrl' in product,
      hasMallName: 'mallName' in product,
      hasTitle: 'title' in product,
      hasName: 'name' in product
    })
    
    // 네이버 상품인지 확인 (productUrl, mallName, 또는 title 속성 존재 여부로 판단)
    if ('productUrl' in product || 'mallName' in product || 'title' in product) {
      console.log("네이버 상품으로 인식됨:", product)
      setSelectedNaverProduct(product as NaverProduct)
      setCurrentPage("product-detail")
      return
    }
    
    // 일반 상품인지 확인
    if ('id' in product && product.id) {
      console.log("일반 상품으로 인식됨:", product)
      setSelectedProductId(Number(product.id))
      setCurrentPage("product-detail")
    }
  }

  const handleEditProduct = (product: Product) => {
    setSelectedProductForEdit(product)
    router.push("/store/edit")
  }

  const handleSaveProduct = (updatedProduct: Product) => {
    setProducts((prev) => prev.map((p) => (p.id === updatedProduct.id ? updatedProduct : p)))
    toast.success("상품이 수정되었습니다", { duration: 5000 })
  }

  const addToInsuranceFavorites = (id: number) => {
    setFavoriteInsurance((prev) => {
      if (prev.includes(id)) return prev
      return [...prev, id]
    })
    toast.success("펫보험이 즐겨찾기에 추가되었습니다", { duration: 5000 })
  }

  const removeFromInsuranceFavorites = (id: number) => {
    setFavoriteInsurance((prev) => prev.filter((itemId) => itemId !== id))
    toast.success("펫보험이 즐겨찾기에서 제거되었습니다", { duration: 5000 })
  }

  const handleUpdateDiaryEntry = (updatedEntry: DiaryEntry) => {
    setDiaryEntries((prev) => prev.map((entry) => (entry.id === updatedEntry.id ? updatedEntry : entry)))
    setSelectedDiaryEntry(updatedEntry)
    toast.success("성장일기가 수정되었습니다", { duration: 5000 })
  }

  const handleDeleteDiaryEntry = (entryId: number) => {
    setDiaryEntries((prev) => prev.filter((entry) => entry.id !== entryId))
    setSelectedDiaryEntry(null)
    toast.success("성장일기가 삭제되었습니다", { duration: 5000 })
  }

  const handleDeleteCommunityPost = (postId: number) => {
    setCommunityPosts((prev) => prev.filter((post) => post.id !== postId))
    setSelectedPost(null)
    toast.success("게시물이 삭제되었습니다", { duration: 5000 })
  }

  const handleBuyNow = async (product: Product) => {
    if (!isLoggedIn || !currentUser) {
      toast.error("로그인이 필요합니다", { duration: 5000 })
      return
    }
    try {
      const accessToken = localStorage.getItem("accessToken")
      const headers: any = {
        "Content-Type": "application/json",
        Accept: "application/json",
      }
      if (accessToken) headers["access_token"] = accessToken
      const orderData = {
        userId: currentUser.id,
        totalPrice: product.price,
        orderItems: [
          {
            productId: product.id,
            productName: product.name || product.brand + " " + product.category,
            imageUrl: product.image || "/placeholder.svg",
            quantity: 1,
            price: product.price,
          },
        ],
      }
      const response = await axios.post("http://localhost:8080/api/orders", orderData, {
        headers,
        timeout: 10000,
      })
      if (response.status !== 200) {
        throw new Error("주문 생성에 실패했습니다.")
      }
      await fetchUserOrders()
      toast.success("바로구매가 완료되었습니다", { duration: 5000 })
      router.push("/my")
    } catch (error: any) {
      console.error("바로구매 오류:", error)
      toast.error("바로구매에 실패했습니다", { duration: 5000 })
    }
  }

  const renderCurrentPage = () => {
    if (isLoading) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <p className="text-gray-600">로딩 중...</p>
        </div>
      )
    }

    switch (currentPage) {
      case "adoption":
        return (
          <AdoptionPage
            pets={pets}
            onViewPet={(pet) => {
              // window.location.href를 사용하여 상세페이지로 이동
              window.location.href = `/adoption/${pet.petId}`;
            }}
            onClose={() => router.push("/")}
            isAdmin={isAdmin}
            isLoggedIn={isLoggedIn}
            onNavigateToAnimalRegistration={() => router.push("/adoption/register")}
          />
        )

      case "animalRegistration":
        return (
          <AnimalRegistrationPage
            onClose={() => router.push("/admin")}
            onAddPet={handleAddPet}
            isAdmin={isAdmin}
            currentUserId={isLoggedIn ? currentUser?.id.toString() : undefined}
          />
        )

      case "store":
        return (
          <StorePage
            onClose={() => router.push("/")}
            onAddToWishlist={handleAddToWishlist}
            isInWishlist={isInWishlist}
            isAdmin={isAdmin}
            isLoggedIn={isLoggedIn}
            onNavigateToStoreRegistration={() => router.push("/store/register")}
            products={products}
            onViewProduct={handleViewProduct}
            setCurrentPage={setCurrentPageWithCartRefresh}
          />
        )


      case "product-detail":
        if (selectedNaverProduct) {
          return (
            <StoreProductDetailPage
              productId={0}
              propNaverProduct={selectedNaverProduct}
              onBack={() => {
                setSelectedNaverProduct(null)
                setCurrentPage("store")
              }}
              onAddToWishlist={handleAddToWishlist}
              onAddToCart={handleAddToCart}
              onBuyNow={handleBuyNow}
              isInWishlist={isInWishlist}
              isInCart={isInCart}
            />
          )
        }
        
        return (
          <StoreProductDetailPage
            productId={selectedProductId!}
            onBack={() => {
              setSelectedProductId(null)
              router.push("/store")
            }}
            onAddToWishlist={handleAddToWishlist}
            onAddToCart={handleAddToCart}
            onBuyNow={handleBuyNow}
            isInWishlist={isInWishlist}
            isInCart={isInCart}
          />
        )

      case "product-edit":
        return (
          <StoreProductEditPage
            productId={selectedProductForEdit!.id}
            onBack={() => {
              setSelectedProductForEdit(null)
              router.push("/admin")
            }}
            onSave={handleSaveProduct}
          />
        )

      case "storeRegistration":
        return (
          <StoreProductRegistrationPage
            onClose={() => router.push("/admin")}
            onAddProduct={handleAddProduct}
            isAdmin={isAdmin}
            currentUserId={isLoggedIn ? currentUser?.id.toString() : undefined}
            products={products}
          />
        )

      case "external":
        // 외부 페이지는 렌더링하지 않음
        return null;

      case "insurance":
        if (selectedInsurance) {
          return <InsuranceDetailPage insurance={selectedInsurance} onBack={() => setSelectedInsurance(null)} />
        }
        return (
          <PetInsurancePage
            favoriteInsurance={favoriteInsurance}
            onAddToFavorites={addToInsuranceFavorites}
            onRemoveFromFavorites={removeFromInsuranceFavorites}
            onViewDetails={(insurance) => setSelectedInsurance(insurance)}
          />
        )

      case "insuranceFavorites":
        return (
          <InsuranceFavoritesPage
            favoriteInsurance={favoriteInsurance}
            onRemoveFromFavorites={removeFromInsuranceFavorites}
            onNavigateToInsurance={() => router.push("/insurance")}
            onViewDetails={(insurance) => setSelectedInsurance(insurance)}
          />
        )

      case "diary":
        return (
          <GrowthDiaryPage
            entries={diaryEntries}
            onViewEntry={() => {}}
            onClose={() => router.push("/")}
            onAddEntry={() => {}}
            isLoggedIn={isLoggedIn}
            currentUserId={currentUser?.id?.toString()}
            onNavigateToWrite={() => router.push("/diary/write")}
          />
        )

      case "growthDiaryWrite":
        return (
          <GrowthDiaryWritePage
            onBack={() => router.push("/diary")}
            onSubmit={(entryData) => {
              const newEntry: DiaryEntry = {
                id: diaryEntries.length + 1,
                ...entryData,
                date: new Date().toISOString().split("T")[0],
                ownerEmail: currentUser?.email,
                audioUrl: entryData.audioUrl,
              }
              setDiaryEntries((prev) => [...prev, newEntry])
              toast.success("성장일기가 작성되었습니다", { duration: 5000 })
              router.push("/diary")
            }}
          />
        )

      case "community":
        if (selectedPost) {
          return (
            <CommunityDetailPage
              post={selectedPost}
              onBack={() => setSelectedPost(null)}
              isLoggedIn={isLoggedIn}
              onUpdatePost={(updatedPost) => {
                setCommunityPosts((prev) => prev.map((post) => (post.id === updatedPost.id ? updatedPost : post)))
                setSelectedPost(updatedPost)
                toast.success("게시물이 수정되었습니다", { duration: 5000 })
              }}
              onDeletePost={handleDeleteCommunityPost}
              currentUserEmail={currentUser?.email}
            />
          )
        }
        return (
          <CommunityPage
            posts={communityPosts}
            isLoggedIn={isLoggedIn}
            onUpdatePosts={setCommunityPosts}
          />
        )

      case "communityWrite":
        return (
          <CommunityWritePage
            onBack={() => router.push("/community")}
            onSubmit={(postData) => {
              const newPost: CommunityPost = {
                id: communityPosts.length + 1,
                title: postData.title,
                content: postData.content,
                author: currentUser?.name || "현재사용자",
                date: new Date().toISOString().split("T")[0],
                category: "일반",
                boardType: postData.type,
                views: 0,
                likes: 0,
                comments: 0,
                tags: [],
                ownerEmail: currentUser?.email,
              }
              setCommunityPosts((prev) => [newPost, ...prev])
              toast.success("게시물이 작성되었습니다", { duration: 5000 })
              router.push("/community")
            }}
          />
        )

      case "research":
        return <DogResearchLabPage onClose={() => router.push("/")} />

      case "cart":
        if (!isLoggedIn) {
          return (
            <div className="min-h-screen bg-gray-50 pt-20">
              <div className="container mx-auto px-4 py-8">
                <div className="max-w-md mx-auto text-center">
                  <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                    <ShoppingCart className="w-12 h-12 text-gray-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">로그인이 필요합니다</h3>
                  <p className="text-gray-600 mb-6">장바구니를 이용하려면 로그인해주세요.</p>
                  <div className="space-y-3">
                    <Button
                      onClick={() => router.push("/")}
                      className="w-full bg-yellow-400 hover:bg-yellow-500 text-black"
                    >
                      홈으로 돌아가기
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )
        }
        return (
          <CartPage
            cartItems={cart}
            onRemoveFromCart={onRemoveFromCart}
            onNavigateToStore={() => router.push("/store")}
            onPurchaseAll={purchaseAllFromCart}
            onPurchaseSingle={purchaseSingleItem}
            onUpdateQuantity={handleUpdateCartQuantity}
          />
        )

      case "naming":
        return <PetNamingService onClose={() => router.push("/")} />

      case "admin":
        return (
          <AdminPage
            onClose={() => router.push("/")}
            products={products}
            pets={pets}
            communityPosts={communityPosts}
            adoptionInquiries={adoptionInquiries}
            comments={comments}
            onNavigateToStoreRegistration={() => router.push("/store/register")}
            onNavigateToAnimalRegistration={() => router.push("/adoption/register")}
            onNavigateToCommunity={() => router.push("/community")}
            onUpdateInquiryStatus={(id, status) => {
              setAdoptionInquiries((prev) =>
                prev.map((inquiry) => (inquiry.id === id ? { ...inquiry, status } : inquiry))
              )
              toast.success("입양 문의 상태가 업데이트되었습니다", { duration: 5000 })
            }}
            onDeleteComment={(id) => {
              setComments((prev) => prev.filter((comment) => comment.id !== id))
              toast.success("댓글이 삭제되었습니다", { duration: 5000 })
            }}
            onDeletePost={(id) => {
              setCommunityPosts((prev) => prev.filter((post) => post.id !== id))
              toast.success("게시물이 삭제되었습니다", { duration: 5000 })
            }}
            onUpdatePet={(updatedPet) => {
              setPets((prev) => prev.map((pet) => (pet.id === updatedPet.id ? updatedPet : pet)))
            }}
            onEditProduct={handleEditProduct}
            onDeleteProduct={(productId) => {
              setProducts((prev) => prev.filter((product) => product.id !== productId))
              toast.success("상품이 삭제되었습니다", { duration: 5000 })
            }}
            onUpdateOrderStatus={updatePaymentStatus}
            isAdmin={isAdmin}
          />
        )

      case "my":
        return (
          <MyPage
            currentUser={currentUser}
            userPets={pets.filter((pet) => pet.ownerEmail === currentUser?.email)}
            userAdoptionInquiries={adoptionInquiries.filter((inquiry) => inquiry.email === currentUser?.email)}
            userOrders={orders}
            onClose={() => router.push("/")}
            onRefreshOrders={fetchUserOrders}
          />
        )

      case "contract":
        if (!isAdmin) {
          return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
              <div className="text-center">
                <h1 className="text-2xl font-bold text-gray-900 mb-4">접근 권한이 없습니다</h1>
                <p className="text-gray-600">AI 계약서 서비스는 관리자만 접근할 수 있습니다.</p>
                <Button onClick={() => router.push("/")} className="mt-4">
                  홈으로 돌아가기
                </Button>
              </div>
            </div>
          )
        }
        return (
          <div className="min-h-screen bg-gray-50">
            <div className="container mx-auto p-6">
              <div className="mb-8">
                <h1 className="text-3xl font-bold mb-4">AI 계약서 서비스</h1>
                <p className="text-gray-600">템플릿을 관리하고 AI의 도움을 받아 맞춤형 계약서를 생성하세요.</p>
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                <Card
                  className="hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => setShowContractTemplatePage(true)}
                >
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      템플릿 관리
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600">계약서 템플릿을 생성, 수정, 관리할 수 있습니다.</p>
                  </CardContent>
                </Card>
                <Card
                  className="hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => setShowContractGenerationPage(true)}
                >
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MessageSquare className="w-5 h-5" />
                      계약서 생성
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600">AI의 도움을 받아 맞춤형 계약서를 생성하세요.</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        )

      default:
        return (
          <div className="min-h-screen bg-white">
            <section className="bg-gradient-to-br from-yellow-50 to-orange-50 py-20">
              <div className="container mx-auto px-4">
                <div className="grid lg:grid-cols-2 gap-12 items-center">
                  <div className="space-y-6">
                    <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 leading-tight">
                      펫보험 추천으로
                      <br />더 편한
                      <br />
                      반려 라이프를 즐기세요
                    </h1>
                    <p className="text-xl text-gray-600">우리 아이의 시간을 더 행복하게, 반려동물의 삶을 더 편하게</p>
                  </div>
                  <div className="relative">
                    <div className="relative z-10">
                      <Image
                        src="/jjj_포메라니안.jpg"
                        alt="Pet service interface mockup"
                        width={600}
                        height={400}
                        className="w-full h-auto"
                      />
                    </div>
                    <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-yellow-200 rounded-full opacity-50"></div>
                    <div className="absolute -top-10 -left-10 w-24 h-24 bg-orange-200 rounded-full opacity-30"></div>
                  </div>
                </div>
              </div>
            </section>
            <section className="py-20 bg-gray-50">
              <div className="container mx-auto px-4">
                <div className="grid md:grid-cols-2 gap-8 justify-center">
                  <Card className="relative overflow-hidden bg-white shadow-lg hover:shadow-xl transition-shadow">
                    <div className="absolute top-4 right-4 bg-yellow-400 text-black px-3 py-1 rounded-full text-sm font-medium transform rotate-12">
                      UPDATE
                    </div>
                    <CardHeader className="text-center pb-4">
                      <CardTitle className="text-2xl font-bold text-gray-900 border-b-4 border-yellow-400 inline-block pb-2">
                        입양
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <button onClick={() => router.push("/adoption")} className="text-center space-y-2 w-full">
                          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto">
                            <Heart className="w-8 h-8 text-yellow-600 fill-yellow-600" />
                          </div>
                          <p className="text-sm font-medium">보호소 입양</p>
                        </button>
                        <button onClick={() => router.push("/naming")} className="text-center space-y-2 w-full">
                          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto">
                            <BookOpen className="w-8 h-8 text-yellow-600" />
                          </div>
                          <p className="text-sm font-medium">이름 짓기</p>
                        </button>
                        {isAdmin && isLoggedIn && (
                          <button
                            onClick={() => router.push("/adoption/register")}
                            className="text-center space-y-2 w-full"
                          >
                            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto">
                              <Search className="w-8 h-8 text-yellow-600" />
                            </div>
                            <p className="text-sm font-medium">동물등록</p>
                          </button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-white shadow-lg hover:shadow-xl transition-shadow">
                    <CardHeader className="text-center pb-4">
                      <CardTitle className="text-2xl font-bold text-gray-900 border-b-4 border-green-400 inline-block pb-2">
                        스토어
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <button onClick={() => router.push("/store")} className="text-center space-y-2 w-full">
                          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                            <Store className="w-8 h-8 text-green-600" />
                          </div>
                          <p className="text-sm font-medium">펫용품 쇼핑</p>
                        </button>
                        <button
                          onClick={() => {
                            if (!isLoggedIn) {
                              toast.error("장바구니를 이용하려면 로그인이 필요합니다", { duration: 5000 })
                              router.push("/")
                            } else {
                              router.push("/store/cart");
                             
                            }
                          }}
                          className="text-center space-y-2 w-full"
                        >
                          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto relative">
                            <ShoppingCart className="w-8 h-8 text-green-600" />
                            {isLoggedIn && cart.length > 0 && (
                              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                                {cart.length}
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-medium">장바구니</p>
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </section>
          </div>
        )
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <Toaster />
      {renderCurrentPage()}
    </div>
  )
}