"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  Package,
  Heart,
  MessageSquare,
  Users,
  Plus,
  Edit,
  Trash2,
  Phone,
  Mail,
  CheckCircle,
  XCircle,
  Eye,
  User,
  FileText,
  X,
  Download,
  Shield,
} from "lucide-react"
import AnimalEditModal from "@/components/modals/animal-edit-modal"
import type { Pet } from "@/types/pets"
import ProductsTab from "@/components/admin/ProductsTab"
import PetsTab from "@/components/admin/PetsTab"
import AdoptionRequestsTab from "@/components/admin/AdoptionRequestsTab"
import OrdersTab from "@/components/admin/OrdersTab"
import ContractsTab from "@/components/admin/ContractsTab"


import { getBackendUrl, petApi, handleApiError, s3Api, adoptionRequestApi, productApi, naverProductApi } from "@/lib/api"
import axios from "axios"
import { formatToKST, formatToKSTWithTime, getCurrentKSTDate } from "@/lib/utils"
import { toast } from "sonner"


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

interface Order {
  orderId: number
  userId: number
  amount: number
  paymentStatus: "PENDING" | "COMPLETED" | "CANCELLED"
  orderedAt: string
  id?: number
  orderItems?: OrderItem[]
}

interface OrderItem {
  id: number
  productId: number
  productName: string
  price: number
  quantity: number
  ImageUrl: string
}

interface AdminPageProps {
  onClose: () => void // This prop is now used for navigating back to home, but not for logout
  products: Product[]
  pets: Pet[]
  communityPosts: CommunityPost[]
  adoptionInquiries: AdoptionInquiry[]
  comments: Comment[]
  onNavigateToStoreRegistration: () => void
  onNavigateToAnimalRegistration: () => void
  onNavigateToCommunity: () => void
  onUpdateInquiryStatus: (id: number, status: "대기중" | "연락완료" | "승인" | "거절") => void
  onDeleteComment: (id: number) => void
  onDeletePost: (id: number) => void
  onUpdatePet: (pet: Pet) => void
  onEditProduct: (product: Product) => void
  onDeleteProduct: (productId: number) => void
  onUpdateOrderStatus: (orderId: number, status: "PENDING" | "COMPLETED" | "CANCELLED") => void
  isAdmin: boolean
  onAdminLogout: () => void // New prop for admin logout
}

interface AdoptionRequest {
  id: number
  petId: number
  petName: string
  petBreed: string
  userId: number
  userName: string
  applicantName: string
  contactNumber: string
  email: string
  message: string
  status: "PENDING" | "CONTACTED" | "APPROVED" | "REJECTED"
  createdAt: string
  updatedAt: string
}

// 관리자 페이지에서 Pet 정보를 표시할 때 사용할 확장 정보 타입
interface PetDisplayInfo extends Pet {
  managementInfo: {
    hasPendingRequests: boolean
    hasApprovedRequests: boolean
    totalRequests: number
    latestRequest: AdoptionRequest | null
    adoptionStatusText: string
  }
}



export default function AdminPage({
  onClose,

  pets: initialPets,
  products: initialProducts,

  communityPosts,
  adoptionInquiries: initialAdoptionInquiries,
  comments,
  onNavigateToStoreRegistration,
  onNavigateToAnimalRegistration,
  onNavigateToCommunity,
  onUpdateInquiryStatus,
  onDeleteComment,
  onDeletePost,
  onUpdatePet,
  onEditProduct,
  onDeleteProduct,
  onUpdateOrderStatus,
  isAdmin,
  onAdminLogout, // Destructure new prop
}: AdminPageProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState("dashboard")
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedPetForEdit, setSelectedPetForEdit] = useState<Pet | null>(null)
  const [pets, setPets] = useState<Pet[]>(initialPets || [])
  const [loading, setLoading] = useState(false)
  const [adoptionInquiries, setAdoptionInquiries] = useState<AdoptionInquiry[]>(initialAdoptionInquiries || [])
  const [inquiriesLoading, setInquiriesLoading] = useState(false)
  const [products, setProducts] = useState<Product[]>([]);
  const [adoptionRequests, setAdoptionRequests] = useState<AdoptionRequest[]>([]);
  const [naverProductCount, setNaverProductCount] = useState<number>(0);

  // 계약서 관련 state 변수들 (입양관리에서 계약서 보기용)
  const [selectedContract, setSelectedContract] = useState<any>(null)
  const [selectedAdoptionRequest, setSelectedAdoptionRequest] = useState<any>(null)
  





  // 관리자 페이지에서 필요한 추가 정보를 계산하는 유틸리티 함수
  const getPetManagementInfo = (pet: Pet) => {
    const petAdoptionRequests = (adoptionRequests ?? []).filter((request: AdoptionRequest) => request.petId === pet.petId)
    const pendingRequests = petAdoptionRequests.filter((request: AdoptionRequest) => request.status === "PENDING")
    const approvedRequests = petAdoptionRequests.filter((request: AdoptionRequest) => request.status === "APPROVED")
    
    return {
      hasPendingRequests: pendingRequests.length > 0,
      hasApprovedRequests: approvedRequests.length > 0,
      totalRequests: petAdoptionRequests.length,
      latestRequest: petAdoptionRequests.length > 0 ? petAdoptionRequests[0] : null,
      // 입양 상태 표시용 텍스트
      adoptionStatusText: pet.adopted ? "입양완료" : 
                         approvedRequests.length > 0 ? "입양승인" :
                         pendingRequests.length > 0 ? "입양대기" : "입양가능"
    }
  }

  // Pet 정보를 관리자 표시용으로 변환하는 함수
  const getPetDisplayInfo = (pet: Pet): PetDisplayInfo => {
    const managementInfo = getPetManagementInfo(pet)
    return {
      ...pet,
      managementInfo
    }
  }

  const handleEditPetFromTab = (pet: Pet) => {
    setSelectedPetForEdit(pet)
    setShowEditModal(true)
  }

  const handleViewContractFromTab = async (pet: Pet) => {
    console.log("계약서 보기 시작:", pet)
    try {
      // 모든 계약서를 가져온 후 해당 동물의 계약서를 필터링
      const response = await axios.get(`${getBackendUrl()}/api/contract-generation/user`, {
        headers: {
          'Access_Token': localStorage.getItem('accessToken') || '',
        },
      })
      
      
      if (response.data && response.data.success) {
        const contracts = response.data.data
        
        // 해당 동물의 계약서 찾기
        const petContract = contracts.find((contract: any) => {
          try {
            if (contract.petInfo) {
              const petInfo = typeof contract.petInfo === 'string' 
                ? JSON.parse(contract.petInfo) 
                : contract.petInfo
              return petInfo.name === pet.name
            }
            return false
          } catch (error) {
            console.error("petInfo 파싱 오류:", error)
            return false
          }
        })
        
        if (petContract) {
          console.log("찾은 계약서:", petContract)
          setSelectedContract(petContract)
          setSelectedPetForEdit(pet) // pet 정보 저장
          // AI 계약서 탭으로 이동
          setActiveTab("contracts")
          toast.success("계약서를 찾았습니다. AI 계약서 탭에서 확인하세요.")
        } else {
          toast.error("해당 동물의 계약서를 찾을 수 없습니다.")
        }
      } else {
        toast.error("계약서 목록을 가져올 수 없습니다.")
      }
    } catch (error) {
      toast.error("계약서 데이터를 불러오는데 실패했습니다.")
    }
  }

  const handleShowContractModal = (request: AdoptionRequest) => {
    // AI 계약서 탭으로 이동하고 계약서 생성 모달 열기
    setActiveTab("contracts")
    // ContractsTab에 전달할 데이터 설정
    setSelectedAdoptionRequest(request)
    toast.success("AI 계약서 탭으로 이동했습니다. 계약서 생성을 진행하세요.")
  }

  const handleContractViewClosed = () => {
    setSelectedContract(null)
    setSelectedPetForEdit(null)
    setSelectedAdoptionRequest(null)
  }

  const handleDownloadContract = async (contractId: number) => {
    try {
      const response = await axios.get(`${getBackendUrl()}/api/contract-generation/${contractId}/download`, {
        headers: {
          'Access_Token': localStorage.getItem('accessToken') || '',
        },
      })
      
      if (response.status === 200) {
        const blob = new Blob([response.data], { type: 'application/pdf' })
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.setAttribute('download', `contract-${contractId}.pdf`)
        document.body.appendChild(link)
        link.click()
        link.remove()
        window.URL.revokeObjectURL(url)
        toast.success("PDF 파일이 다운로드되었습니다.")
      } else {
        toast.error("파일 다운로드에 실패했습니다.")
      }
    } catch (error) {
      console.error("계약서 다운로드 실패:", error)
      toast.error("파일 다운로드에 실패했습니다.")
    }
  }

  // 상품 목록을 백엔드에서 가져오기
 useEffect(() => {
  const fetchProducts = async () => {
    try {
      const accessToken = localStorage.getItem("accessToken");
      console.log('Access Token:', accessToken ? 'Found' : 'Not found');

      if (!accessToken) {
        throw new Error('인증 토큰이 없습니다.');
      }

      // axios 직접 호출로 대체
      const response = await axios.get(`${getBackendUrl()}/api/products`, {
        headers: {
          Authorization: accessToken, // Bearer 접두사 제거
          'Access_Token': accessToken,
          'Refresh_Token': localStorage.getItem("refreshToken") || '',
        },
      });
      console.log('Raw product data from API:', JSON.stringify(response.data, null, 2));

      // ResponseDto 구조 확인
      if (!response.data || !response.data.success) {
        throw new Error(response.data?.error?.message || 'API 응답이 올바르지 않습니다.');
      }

      const productsData = response.data.data;
      if (!Array.isArray(productsData)) {
        throw new Error('상품 데이터가 배열 형식이 아닙니다.');
      }

      const convertedProducts = productsData.map((product: any, index: number) => {
        console.log(`Converting product ${index + 1}:`, product);
        return {
          id: product.id || product.productId || 0,
          name: product.name || product.productName || '이름 없음',
          price: product.price || 0,
          image: product.image_url || product.imageUrl || product.image || '/placeholder.svg',
          category: product.category || '카테고리 없음',
          description: product.description || '',
          tags: product.tags
            ? Array.isArray(product.tags)
              ? product.tags
              : product.tags.split(',').map((tag: string) => tag.trim())
            : [],
          stock: product.stock || 0,
          registrationDate: product.registration_date || product.registrationDate || product.createdAt || getCurrentKSTDate(),
          registeredBy: product.registered_by || product.registeredBy || 'admin',
        };
      });

      console.log('Converted products:', convertedProducts);

      const sortedProducts = convertedProducts.sort((a: Product, b: Product) => {
        const dateA = new Date(a.registrationDate).getTime();
        const dateB = new Date(b.registrationDate).getTime();
        return dateB - dateA;
      });

      setProducts(sortedProducts);
    } catch (error) {
      let errorMessage = '상품 목록을 불러오는 데 실패했습니다.';
      if (axios.isAxiosError(error)) {

        errorMessage += ` (상태 코드: ${error.response?.status || '알 수 없음'})`;
        if (error.response?.data?.error) {
          errorMessage += `: ${error.response.data.error}`;
        }
      }
      alert(errorMessage);
    }
  };

  fetchProducts();
}, []);

  // 입양 신청 목록을 백엔드에서 가져오기
  useEffect(() => {
    const fetchAdoptionRequests = async () => {
      try {
        const response = await adoptionRequestApi.getAdoptionRequests();
        setAdoptionRequests(response);
      } catch (error) {
        console.error("Error fetching adoption requests:", error);
      }
    };

    fetchAdoptionRequests();
  }, []);

  // 네이버 상품 개수를 백엔드에서 가져오기
  useEffect(() => {
    const fetchNaverProductCount = async () => {
      try {
        const count = await naverProductApi.getNaverProductCount();
        setNaverProductCount(count);
      } catch (error) {
        console.error("Error fetching naver product count:", error);
        setNaverProductCount(0);
      }
    };

    fetchNaverProductCount();
  }, []);

  // if (!isAdmin) {
  //   return (
  //     <div className="min-h-screen bg-gray-50 flex items-center justify-center">
  //       <Card className="p-8 text-center">
  //         <CardContent>
  //           <h2 className="text-2xl font-bold text-red-600 mb-4">접근 권한이 없습니다</h2>
  //           <p className="text-gray-600 mb-4">관리자만 접근할 수 있는 페이지입니다.</p>
  //           <Button onClick={onClose}>홈으로 돌아가기</Button>
  //         </CardContent>
  //       </Card>
  //     </div>
  //   )
  // }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDING":
        return "bg-yellow-100 text-yellow-800"
      case "CONTACTED":
        return "bg-blue-100 text-blue-800"
      case "APPROVED":
        return "bg-green-100 text-green-800"
      case "REJECTED":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }



  const handleEditPet = (pet: Pet) => {
    setSelectedPetForEdit(pet)
    setShowEditModal(true)
  }

  const handleCloseEditModal = () => {
    setShowEditModal(false)
    setSelectedPetForEdit(null)
  }

  const handleUpdatePet = (updatedPet: Pet) => {
    // 로컬 상태 업데이트
          setPets(prev => prev.map(pet => 
        pet.petId === updatedPet.petId ? updatedPet : pet
      ))
    handleCloseEditModal()
    // 페이지 새로고침으로 변경사항 반영
    window.location.reload()
  }

  // 펫 입양 상태 수동 변경 함수
  const handleUpdatePetStatus = async (petId: number, newStatus: "available" | "adopted") => {
    try {
      // 백엔드 API 호출
      const adopted = newStatus === "adopted"
      await petApi.updateAdoptionStatus(petId, adopted)
      
      // 프론트엔드 상태 즉시 업데이트 (화면에 바로 반영)
      setPets(prev => prev.map(pet => 
        pet.petId === petId 
          ? { ...pet, adopted: newStatus === "adopted" }
          : pet
      ))
      
      toast.success(`입양 상태가 ${newStatus === 'adopted' ? '입양완료' : '입양가능'}으로 변경되었습니다.`)
    } catch (error) {
      console.error('입양 상태 업데이트 오류:', error)
      toast.error('입양 상태 업데이트에 실패했습니다.')
    }
  }

  const handleDeletePet = async (petId: number, petName: string) => {
    if (confirm(`${petName}을(를) 삭제하시겠습니까?\n\n⚠️ 주의: 관련된 모든 입양신청도 함께 삭제됩니다.`)) {
      try {
        // 삭제할 동물의 정보를 찾아서 S3 이미지들도 함께 삭제
        const petToDelete = pets.find(pet => pet.petId === petId)
        if (petToDelete && petToDelete.imageUrl) {
          // S3 이미지 삭제
          const imageUrl = petToDelete.imageUrl
          if (imageUrl && imageUrl.startsWith('https://')) {
            try {
              // URL에서 파일명 추출
              const fileName = imageUrl.split('/').pop()
              if (fileName) {
                await s3Api.deleteFile(fileName)
              }
            } catch (error) {
              console.error("S3 이미지 삭제 실패:", error)
              // 삭제 실패해도 계속 진행
            }
          }
        }

        // 동물 정보 삭제 (백엔드에서 관련 입양신청도 함께 삭제)
        await petApi.deletePet(petId)
        setPets(prev => prev.filter(pet => pet.petId !== petId))
        alert(`${petName}이(가) 성공적으로 삭제되었습니다.\n관련된 입양신청도 함께 삭제되었습니다.`)
      } catch (error) {
        console.error("동물 삭제에 실패했습니다:", error)
        alert("동물 삭제에 실패했습니다.")
      }
    }
  }

  // API 데이터를 Pet 형식으로 변환
  const convertApiPetToPet = (apiPet: any): Pet => {
    // 해당 펫의 입양신청 상태 확인
    const petAdoptionRequests = (adoptionRequests ?? []).filter((request: AdoptionRequest) => request.petId === apiPet.petId)
    const hasPendingRequests = petAdoptionRequests.some((request: AdoptionRequest) => request.status === "PENDING")
    const hasApprovedRequests = petAdoptionRequests.some((request: AdoptionRequest) => request.status === "APPROVED")
    
    // 입양 상태 결정 (백엔드 adopted 필드 우선, 그 다음 입양신청 상태)
    let finalAdoptedStatus = apiPet.adopted || false
    
    // 백엔드에서 adopted가 false이지만 승인된 입양신청이 있으면 adopted로 설정
    if (!apiPet.adopted && hasApprovedRequests) {
      finalAdoptedStatus = true
    }
    
    return {
      petId: apiPet.petId,
      name: apiPet.name,
      breed: apiPet.breed,
      age: apiPet.age,
      gender: apiPet.gender,
      vaccinated: apiPet.vaccinated || false,
      description: apiPet.description || '',
      imageUrl: apiPet.imageUrl || '',
      adopted: finalAdoptedStatus,
      weight: apiPet.weight,
      location: apiPet.location || '',
      microchipId: apiPet.microchipId || '',
      medicalHistory: apiPet.medicalHistory || '',
      vaccinations: apiPet.vaccinations || '',
      notes: apiPet.notes || '',
      specialNeeds: apiPet.specialNeeds || '',
      personality: apiPet.personality || '',
      rescueStory: apiPet.rescueStory || '',
      aiBackgroundStory: apiPet.aiBackgroundStory || '',
      status: apiPet.status || '보호중',
      type: apiPet.type || '',
      neutered: apiPet.neutered || false
    }
  }



  // 펫 데이터 가져오기
  const fetchPets = async () => {
    setLoading(true)
    try {
      const apiPets = await petApi.getPets()
      const convertedPets = apiPets.map(convertApiPetToPet)
      setPets(convertedPets)
    } catch (error) {
      console.error("펫 데이터를 가져오는데 실패했습니다:", error)
    } finally {
      setLoading(false)
    }
  }

  // 컴포넌트 마운트 시 데이터 가져오기
  useEffect(() => {
    fetchPets()
  }, [])

  // 입양신청 데이터가 변경될 때마다 펫 목록 업데이트
  useEffect(() => {
    if ((adoptionRequests ?? []).length > 0) {
      fetchPets()
    }
  }, [adoptionRequests])

  const handleEditProduct = (product: Product) => {
    const returnUrl = encodeURIComponent("/admin?tab=products")
    const productId = product.id
    router.push(`/store/edit?productId=${productId}&returnUrl=${returnUrl}`)
  };

  // ProductsTab(AdminProduct) -> AdminPage(Product) 어댑터
  const handleEditProductFromTab = (adminProduct: any) => {
    
    // productId를 안전하게 추출
    const productId = adminProduct.id || adminProduct.productId || 0;
    
    if (!productId || productId === 0) {
      console.error('Invalid product ID:', adminProduct);
      alert('상품 ID를 찾을 수 없습니다.');
      return;
    }
    
    const adaptedProduct: Product = {
      id: productId,
      name: adminProduct.name || '',
      price: adminProduct.price || 0,
      image: adminProduct.image || adminProduct.imageUrl || "/placeholder.svg",
      category: adminProduct.category || '',
      description: adminProduct.description || "",
      tags: adminProduct.tags || [],
      stock: adminProduct.stock || 0,
      registrationDate: adminProduct.registrationDate || getCurrentKSTDate(),
      registeredBy: adminProduct.registeredBy || "admin",
    }
    
    handleEditProduct(adaptedProduct)
  }

  const handleNavigateToStoreRegistration = () => {
    const returnUrl = encodeURIComponent("/admin?tab=products")
    router.push(`/store/register?returnUrl=${returnUrl}`)
  }

 const handleDeleteProduct = async (productId: number) => {
  if (!productId || isNaN(productId)) {
    alert('유효하지 않은 상품 ID입니다.');
    console.error('Invalid productId:', productId);
    return;
  }
  if (window.confirm('정말로 이 상품을 삭제하시겠습니까?')) {
    try {
      await productApi.deleteProduct(productId);
      setProducts(prev => prev.filter(p => p.id !== productId));
      alert('상품이 성공적으로 삭제되었습니다.');
    } catch (error) {
      console.error('상품 삭제 오류:', error);
      const errorMessage = axios.isAxiosError(error) && error.response?.data?.error 
        ? error.response.data.error 
        : '상품 삭제 중 오류가 발생했습니다.';
      alert('상품 삭제 중 오류가 발생했습니다: ' + errorMessage);
    }
  }
};


  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">관리자 페이지</h1>
            <p className="text-gray-600 mt-2">멍토리 서비스 관리 대시보드</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="dashboard">대시보드</TabsTrigger>
            <TabsTrigger value="products">상품관리</TabsTrigger>
            <TabsTrigger value="pets">입양관리</TabsTrigger>
            <TabsTrigger value="inquiries">입양신청</TabsTrigger>
            <TabsTrigger value="orders">주문내역</TabsTrigger>
            <TabsTrigger value="contracts">AI 계약서</TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">등록된 상품</CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{(products?.length ?? 0) + naverProductCount}</div>
                  <p className="text-xs text-muted-foreground">
                    우리사이트: {products?.length ?? 0}개 / 네이버: {naverProductCount}개
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">입양 대기 동물</CardTitle>
                  <Heart className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {(pets ?? []).filter((pet) => !pet.adopted).length}
                  </div>
                  <p className="text-xs text-muted-foreground">입양 가능한 동물</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">커뮤니티 게시글</CardTitle>
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{communityPosts?.length ?? 0}</div>
                  <p className="text-xs text-muted-foreground">전체 게시글 수</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">대기중인 입양신청</CardTitle>
                  <Heart className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {(adoptionRequests ?? []).filter(request => request.status === "PENDING").length}
                  </div>
                  <p className="text-xs text-muted-foreground">처리 대기 건수</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">처리율</CardTitle>
                  <CheckCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {(() => {
                      if (!adoptionRequests || adoptionRequests.length === 0) return 0
                      const processed = (adoptionRequests ?? []).filter(request => 
                        request.status === "APPROVED" || request.status === "REJECTED" || request.status === "CONTACTED"
                      ).length
                      return Math.round((processed / (adoptionRequests ?? []).length) * 100)
                    })()}%
                  </div>
                  <p className="text-xs text-muted-foreground">전체 처리 완료율</p>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>빠른 작업</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Button
                    onClick={() => router.push('/store/register')
                    }

                    className="h-20 flex flex-col items-center justify-center bg-yellow-400 hover:bg-yellow-500 text-black"
                  >
                    <Plus className="h-6 w-6 mb-2" />
                    상품 등록
                  </Button>
                  <Button
                    onClick={() => router.push("/adoption/register")}
                    className="h-20 flex flex-col items-center justify-center bg-yellow-400 hover:bg-yellow-500 text-black"
                  >
                    <Heart className="h-6 w-6 mb-2" />
                    동물 등록
                  </Button>
                  <Button onClick={() => router.push("/community")} className="h-20 flex flex-col items-center justify-center bg-yellow-400 hover:bg-yellow-500 text-black">
                    <MessageSquare className="h-6 w-6 mb-2" />
                    커뮤니티 관리
                  </Button>
                  <Button
                    onClick={() => router.push("/feedback")}
                    className="h-20 flex flex-col items-center justify-center bg-blue-400 hover:bg-blue-500 text-white"
                  >
                    <Shield className="h-6 w-6 mb-2" />
                    AI 피드백 관리
                  </Button>
                </div>
              </CardContent>
            </Card>


          </TabsContent>

          {/* Products Tab */}
          <TabsContent value="products" className="space-y-6">
            <ProductsTab
              onNavigateToStoreRegistration={handleNavigateToStoreRegistration}
              onEditProduct={handleEditProductFromTab}
            />
          </TabsContent>

          {/* Pets Tab */}
          <TabsContent value="pets" className="space-y-6">
            <PetsTab
              onNavigateToAnimalRegistration={() => router.push("/adoption/register")}
              onUpdatePet={handleEditPetFromTab}
              onViewContract={handleViewContractFromTab}
            />
          </TabsContent>



          {/* Adoption Requests Tab */}
          <TabsContent value="inquiries" className="space-y-6">
            <AdoptionRequestsTab
              onShowContractModal={handleShowContractModal}
              onRefreshPets={fetchPets}
            />
          </TabsContent>

          {/* Orders Tab */}
          <TabsContent value="orders" className="space-y-6">
            <OrdersTab />
          </TabsContent>

          {/* AI 계약서 Tab */}
          <TabsContent value="contracts" className="space-y-6">
            <ContractsTab 
              selectedAdoptionRequest={selectedAdoptionRequest}
              selectedContract={selectedContract}
              selectedPet={selectedPetForEdit}
              onShowContractModal={handleShowContractModal}
              onContractViewClosed={handleContractViewClosed}
            />
          </TabsContent>
        </Tabs>
      </div>
      
      {/* 수정 모달 */}
      <AnimalEditModal
        isOpen={showEditModal}
        onClose={handleCloseEditModal}
        selectedPet={selectedPetForEdit}
        petId={selectedPetForEdit?.petId || (selectedPetForEdit as any)?.id || (selectedPetForEdit as any)?.petId}
        onUpdatePet={() => {
          // 모달 내부에서 직접 처리하므로 여기서는 아무것도 하지 않음
          handleCloseEditModal()
          window.location.reload()
        }}
      />

    </div>
  )
}
