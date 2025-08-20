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
} from "lucide-react"
import AnimalEditModal from "@/components/modals/animal-edit-modal"
import type { Pet } from "@/types/pets"
import ProductsTab from "@/components/admin/ProductsTab"
import PetsTab from "@/components/admin/PetsTab"
import { petApi, handleApiError, s3Api, adoptionRequestApi, productApi } from "@/lib/api"
import axios from "axios"
import { formatToKST, formatToKSTWithTime, getCurrentKSTDate } from "@/lib/utils"
import { getBackendUrl } from "@/lib/api"

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
  const [showContractModal, setShowContractModal] = useState(false)
  const [selectedContractRequest, setSelectedContractRequest] = useState<AdoptionRequest | null>(null)
  const [contractView, setContractView] = useState<"templates" | "contracts">("templates")
  const [contractTemplates, setContractTemplates] = useState<any[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null)
  const [showContractViewModal, setShowContractViewModal] = useState(false)
  const [showGeneratedContractViewModal, setShowGeneratedContractViewModal] = useState(false)
  const [selectedPetForContract, setSelectedPetForContract] = useState<Pet | null>(null)
  const [isGeneratingContract, setIsGeneratingContract] = useState(false)
  const [generatedContract, setGeneratedContract] = useState<string | null>(null)
  const [generatedContracts, setGeneratedContracts] = useState<any[]>([])
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false)
  const [isLoadingContracts, setIsLoadingContracts] = useState(false)
  const [showCreateTemplateModal, setShowCreateTemplateModal] = useState(false)
  const [showEditTemplateModal, setShowEditTemplateModal] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<any>(null)
  const [showTemplateViewModal, setShowTemplateViewModal] = useState(false)
  const [selectedTemplateForView, setSelectedTemplateForView] = useState<any>(null)
  const [selectedContractForView, setSelectedContractForView] = useState<any>(null)
  const [showContractEditModal, setShowContractEditModal] = useState(false)
  const [editingContract, setEditingContract] = useState<any>(null)
  const [editedContractContent, setEditedContractContent] = useState("")
  const [newTemplate, setNewTemplate] = useState({
    name: "",
    category: "",
    content: "",
    isDefault: false
  })
  const [templateSections, setTemplateSections] = useState<Array<{
    id: string;
    title: string;
    aiSuggestion: string;
  }>>([])
  const [showAISuggestion, setShowAISuggestion] = useState<string | null>(null)
  const [inquiriesLoading, setInquiriesLoading] = useState(false)
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [adoptionRequests, setAdoptionRequests] = useState<AdoptionRequest[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<AdoptionRequest[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");



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

  const handleViewContractFromTab = (pet: Pet) => {
    // 기존 계약서 보기 핸들러 재사용
    handleViewContract(pet as any)
  }

  // 상품 목록을 백엔드에서 가져오기
 useEffect(() => {
  const fetchProducts = async () => {
    try {
      console.log('Fetching products from:', getBackendUrl() + '/api/products');
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
      console.log('Products state updated:', sortedProducts);
    } catch (error) {
      console.error('Error fetching products:', error);
      let errorMessage = '상품 목록을 불러오는 데 실패했습니다.';
      if (axios.isAxiosError(error)) {
        console.error('Axios error details:', error.response?.data);
        console.error('Status code:', error.response?.status);
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

  // 주문 목록을 백엔드에서 가져오기
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        console.log('주문 데이터 가져오기 시작...');
        
        // 인증 토큰 가져오기
        const accessToken = localStorage.getItem("accessToken");
        const refreshToken = localStorage.getItem("refreshToken");
        
        if (!accessToken) {
          console.error('인증 토큰이 없습니다.');
          return;
        }
        
        const headers = {
          "Authorization": `${accessToken}`,
          "Access_Token": accessToken,
          "Refresh_Token": refreshToken || ''
        };
        
        console.log('요청 헤더:', headers);
        const response = await axios.get('http://localhost:8080/api/orders/admin/all', { headers });
        console.log('주문 API 응답:', response);
        
        const data: any[] = response.data;
        console.log('받은 주문 데이터:', data);
        
        // 백엔드에서 받은 데이터를 프론트엔드 형식으로 변환 (결제 완료된 주문만)
        const ordersWithItems: Order[] = data
          .filter((order: any) => order.status === 'PAID') // 결제 완료된 주문만 필터링
          .map((order: any) => {
            console.log('변환 중인 주문 데이터:', order);
            
            return {
              orderId: order.id || order.orderId, // 백엔드에서는 id 필드 사용
              userId: order.accountId || order.userId,
              amount: order.amount, // 백엔드에서는 amount 필드 사용
              paymentStatus: 'COMPLETED', // 결제 완료된 주문만 표시하므로 항상 COMPLETED
              orderedAt: order.createdAt || order.orderedAt,
              orderItems: [{
                id: order.id,
                productId: order.productId,
                productName: order.productName,
                price: order.amount,
                quantity: order.quantity,
                orderDate: order.createdAt,
                status: 'completed', // 결제 완료된 주문만 표시하므로 항상 completed
                ImageUrl: order.imageUrl || "/placeholder.svg"
              }]
            };
          });
        
        // 최신순으로 정렬 (orderedAt 기준 내림차순)
        const sortedOrders = ordersWithItems.sort((a, b) => {
          const dateA = new Date(a.orderedAt).getTime();
          const dateB = new Date(b.orderedAt).getTime();
          return dateB - dateA; // 내림차순 (최신순)
        });
        
        console.log('변환된 주문 데이터:', sortedOrders);
        setOrders(sortedOrders);
      } catch (error) {
        console.error("Error fetching orders:", error);
        if (axios.isAxiosError(error)) {
          console.error('Axios 오류:', error.response?.data);
          console.error('상태 코드:', error.response?.status);
        }
      }
    };

    fetchOrders();
  }, []);

  // 입양 신청 목록을 백엔드에서 가져오기
  useEffect(() => {
    const fetchAdoptionRequests = async () => {
      try {
        const response = await adoptionRequestApi.getAdoptionRequests();
        console.log('입양신청 데이터:', response);
        setAdoptionRequests(response);
      } catch (error) {
        console.error("Error fetching adoption requests:", error);
      }
    };

    fetchAdoptionRequests();
  }, []);

  if (isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="p-8 text-center">
          <CardContent>
            <h2 className="text-2xl font-bold text-red-600 mb-4">접근 권한이 없습니다</h2>
            <p className="text-gray-600 mb-4">관리자만 접근할 수 있는 페이지입니다.</p>
            <Button onClick={onClose}>홈으로 돌아가기</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

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

  // 긴급 신청 여부 확인 (24시간 이상 대기)
  const isUrgent = (createdAt: string) => {
    const created = new Date(createdAt)
    const now = new Date()
    const diffHours = (now.getTime() - created.getTime()) / (1000 * 60 * 60)
    return diffHours > 24
  }

  // 처리율 계산
  const getProcessingRate = () => {
    if (!adoptionRequests || adoptionRequests.length === 0) return 0
    const processed = (adoptionRequests ?? []).filter(request => 
      request.status === "APPROVED" || request.status === "REJECTED" || request.status === "CONTACTED"
    ).length
    return Math.round((processed / (adoptionRequests ?? []).length) * 100)
  }

  // 필터링 및 검색 함수
  const filterRequests = () => {
    let filtered = adoptionRequests

    // 상태별 필터링
    if (statusFilter !== "ALL") {
      filtered = filtered.filter(request => request.status === statusFilter)
    }

    // 검색어 필터링
    if (searchTerm) {
      filtered = filtered.filter(request => 
        request.applicantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.petName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.petBreed.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.contactNumber.includes(searchTerm) ||
        request.email.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // 정렬
    filtered.sort((a, b) => {
      if (a.status === "PENDING" && b.status !== "PENDING") return -1
      if (a.status !== "PENDING" && b.status === "PENDING") return 1
      if (a.status === "PENDING" && b.status === "PENDING") {
        const aUrgent = isUrgent(a.createdAt)
        const bUrgent = isUrgent(b.createdAt)
        if (aUrgent && !bUrgent) return -1
        if (!aUrgent && bUrgent) return 1
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

    setFilteredRequests(filtered)
  }

  // 필터링 실행
  useEffect(() => {
    filterRequests()
  }, [adoptionRequests, searchTerm, statusFilter])

  // CSV 내보내기 함수
  const exportToCSV = () => {
    const headers = [
      "신청ID", "펫명", "품종", "신청자명", "연락처", "이메일", 
      "상태", "신청일", "메시지", "회원ID"
    ]
    
    const csvData = filteredRequests.map(request => [
      request.id,
      request.petName,
      request.petBreed,
      request.applicantName,
      request.contactNumber,
      request.email,
      request.status === "PENDING" ? "대기중" : 
      request.status === "CONTACTED" ? "연락완료" : 
      request.status === "APPROVED" ? "승인" : "거절",
              request.createdAt ? formatToKST(request.createdAt) : "날짜 없음",
      request.message,
      request.userId
    ])
    
    const csvContent = [
      headers.join(","),
      ...csvData.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n")
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
          link.setAttribute("download", `입양신청_${getCurrentKSTDate()}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
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
      
      // 프론트엔드 상태 업데이트
      setPets(prev => prev.map(pet => 
        pet.petId === petId 
          ? { ...pet, adopted: newStatus === "adopted" }
          : pet
      ))
      
      alert(`입양 상태가 ${newStatus === 'adopted' ? '입양완료' : '입양가능'}로 변경되었습니다.`)
    } catch (error) {
      console.error('입양 상태 업데이트 오류:', error)
      alert('입양 상태 업데이트에 실패했습니다.')
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
                console.log(`S3에서 이미지 삭제 완료: ${fileName}`)
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
    console.log('handleEditProductFromTab called with:', adminProduct);
    
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
    
    console.log('Adapted product:', adaptedProduct);
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
      console.log('상품 삭제 요청:', productId);
      await productApi.deleteProduct(productId);
      console.log('삭제 완료');
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

  const handleUpdateOrderStatus = async (orderId: number, status: "PENDING" | "COMPLETED" | "CANCELLED") => {
    try {
      console.log(`주문 상태 변경 요청: 주문ID ${orderId}, 상태 ${status}`);
      
      // 백엔드 상태값으로 변환
      const backendStatus = status === 'COMPLETED' ? 'PAID' : 
                           status === 'PENDING' ? 'CREATED' : 
                           status === 'CANCELLED' ? 'CANCELED' : 'CREATED';
      
      const response = await axios.patch(`http://localhost:8080/api/orders/${orderId}/status?status=${backendStatus}`);
      console.log('업데이트된 주문:', response.data);
      
      // 현재 주문 목록에서 해당 주문만 업데이트
      setOrders(prev => prev.map(order => 
        order.orderId === orderId 
          ? { ...order, paymentStatus: status }
          : order
      ));
      
      // 마이페이지의 주문 내역도 업데이트하기 위해 전역 이벤트 발생
      window.dispatchEvent(new CustomEvent('orderStatusUpdated', {
        detail: { orderId, status }
      }));
      
      alert(`주문 상태가 ${status === 'COMPLETED' ? '완료' : status === 'PENDING' ? '대기중' : '취소'}로 변경되었습니다.`);
    } catch (error) {
      console.error('주문 상태 업데이트 오류:', error);
      const errorMessage = axios.isAxiosError(error) && error.response?.data?.error 
        ? error.response.data.error 
        : '주문 상태 업데이트에 실패했습니다.';
      alert('주문 상태 업데이트에 실패했습니다: ' + errorMessage);
    }
  };

  const handleUpdateAdoptionRequestStatus = async (requestId: number, status: "PENDING" | "CONTACTED" | "APPROVED" | "REJECTED") => {
    try {
      console.log(`입양 신청 상태 변경 요청: 신청ID ${requestId}, 상태 ${status}`);
      
      const response = await adoptionRequestApi.updateAdoptionRequestStatus(requestId, status);
      console.log('업데이트된 입양 신청:', response);
      
      // 현재 입양 신청 목록에서 해당 신청만 업데이트
      setAdoptionRequests(prev => prev.map(request => 
        request.id === requestId 
          ? { ...request, status: status }
          : request
      ));
      
      // 입양신청 승인 시 해당 펫의 상태도 업데이트
      if (status === "APPROVED") {
        const approvedRequest = adoptionRequests.find(request => request.id === requestId);
        if (approvedRequest) {
          try {
            // 펫의 adopted 상태를 true로 업데이트
            await petApi.updateAdoptionStatus(approvedRequest.petId, true);
            console.log(`펫 ${approvedRequest.petId}의 입양 상태를 완료로 업데이트했습니다.`);
          } catch (error) {
            console.error('펫 상태 업데이트 실패:', error);
          }
        }
      }
      
      // 입양신청 상태 변경 후 펫 목록도 업데이트
      setTimeout(() => {
        fetchPets()
      }, 100)
      
      const statusMessage = status === 'APPROVED' ? '승인 (MyPet에 자동 등록되었습니다)' : 
                           status === 'REJECTED' ? '거절' : 
                           status === 'CONTACTED' ? '연락완료' : '대기중'
      alert(`입양 신청 상태가 ${statusMessage}로 변경되었습니다.`);
    } catch (error) {
      console.error('입양 신청 상태 업데이트 오류:', error);
      alert('입양 신청 상태 업데이트에 실패했습니다.');
    }
  };

  const fetchContractTemplates = async () => {
    try {
      setIsLoadingTemplates(true)
      const response = await axios.get(`${getBackendUrl()}/api/contract-templates`)
      if (response.data.success) {
        setContractTemplates(response.data.data || [])
      } else {
        console.error("템플릿 로드 실패:", response.data.message)
      }
    } catch (error) {
      console.error("템플릿 로드 실패:", error)
    } finally {
      setIsLoadingTemplates(false)
    }
  }

  const fetchGeneratedContracts = async () => {
    try {
      setIsLoadingContracts(true)
      const response = await axios.get(`${getBackendUrl()}/api/contract-generation/user`)
      if (response.data.success) {
        setGeneratedContracts(response.data.data || [])
      } else {
        console.error("생성된 계약서 로드 실패:", response.data.message)
      }
    } catch (error) {
      console.error("생성된 계약서 로드 실패:", error)
    } finally {
      setIsLoadingContracts(false)
    }
  }

  const handleGenerateContract = async (request: AdoptionRequest | null) => {
    if (!request) {
      alert("신청 정보를 찾을 수 없습니다.")
      return
    }
    
    if (!selectedTemplate) {
      alert("템플릿을 선택해주세요.")
      return
    }

    try {
      setIsGeneratingContract(true)
      
      // 선택된 템플릿 정보 가져오기
      const selectedTemplateData = contractTemplates.find(t => t.id === selectedTemplate)
      if (!selectedTemplateData) {
        alert("템플릿 정보를 찾을 수 없습니다.")
        return
      }

      // 해당 동물의 실제 정보 가져오기 (petId로 조인)
      const actualPet = pets.find(p => p.petId === request.petId)
      if (!actualPet) {
        alert("동물 정보를 찾을 수 없습니다.")
        return
      }

      const backendUrl = getBackendUrl()

      const response = await axios.post(`${getBackendUrl()}/api/contract-templates/ai-suggestions/generate-contract`, {

        templateId: selectedTemplate,
        templateSections: selectedTemplateData.sections?.map((section: any) => ({ 
          title: section.title, 
          content: section.content || "" 
        })) || [],
        customSections: [],
        removedSections: [],
        petInfo: {
          name: actualPet.name,
          breed: actualPet.breed,
          age: actualPet.age,
          healthStatus: actualPet.healthStatus
        },
        userInfo: {
          name: request.applicantName,
          phone: request.contactNumber,
          email: request.email
        },
        additionalInfo: request.message
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Access_Token': localStorage.getItem('accessToken') || '',
        },
      })

      console.log("AI 서비스 응답:", response.data) // 디버깅용
      console.log("AI 서비스 응답 구조:", JSON.stringify(response.data, null, 2)) // 디버깅용

      // 생성된 계약서를 백엔드에 저장
      const contractData = {
        templateId: selectedTemplate,
        templateSections: selectedTemplateData.sections?.map((section: any) => ({ 
          title: section.title, 
          content: section.content || "" 
        })) || [],
        customSections: [],
        removedSections: [],
        petInfo: {
          name: actualPet.name,
          breed: actualPet.breed,
          age: actualPet.age,
          healthStatus: actualPet.healthStatus
        },
        userInfo: {
          name: request.applicantName,
          phone: request.contactNumber,
          email: request.email
        },
        additionalInfo: request.message,
        shelterInfo: {
          name: "멍멍이 보호소",
          representative: "김보호",
          address: "서울시 강남구 테헤란로 123",
          phone: "02-1234-5678"
        },
        content: response.data.data?.content || response.data.content // AI가 생성한 계약서 내용 추가
      }

      // 백엔드에 계약서 저장
      await axios.post(`${getBackendUrl()}/api/contract-generation`, contractData)
      
      setGeneratedContract(response.data.data?.content || response.data.content)
      setShowContractModal(true)
      
      // 생성된 계약서 목록 새로고침
      await fetchGeneratedContracts()
      
      // 해당 동물의 상태를 입양완료로 변경
      const pet = pets.find(p => p.petId === request.petId)
      if (pet) {
        await handleUpdatePetStatus(pet.petId, "adopted")
      }
      
      alert("계약서가 생성되었습니다. 입양관리 탭에서 계약서를 확인할 수 있습니다.")
      
      // 입양관리 탭으로 이동
      setActiveTab("pets")
    } catch (error) {
      console.error("계약서 생성 실패:", error)
      alert("계약서 생성에 실패했습니다.")
    } finally {
      setIsGeneratingContract(false)
    }
  }

  const handleShowContractModal = (request: AdoptionRequest) => {
    setSelectedContractRequest(request)
    setSelectedTemplate(null)
    setGeneratedContract(null)
    fetchContractTemplates()
    setShowContractModal(true)
  }

  const handleViewContract = async (pet: Pet) => {
    try {
      console.log("찾는 동물:", pet.name) // 디버깅용
      console.log("생성된 계약서 목록:", generatedContracts) // 디버깅용
      
      // 해당 동물의 생성된 계약서 찾기
      const petContract = generatedContracts.find(contract => {
        // 계약서의 petInfo에서 동물 이름 확인
        try {
          const petInfo = JSON.parse(contract.petInfo || '{}')
          console.log("계약서 petInfo:", petInfo) // 디버깅용
          return petInfo.name === pet.name
        } catch {
          // JSON 파싱 실패 시 다른 방법으로 확인
          console.log("JSON 파싱 실패, content에서 검색") // 디버깅용
          return contract.content && contract.content.includes(pet.name)
        }
      })

      if (petContract) {
        console.log("찾은 계약서:", petContract) // 디버깅용
        setSelectedPetForContract(pet)
        setGeneratedContract(petContract.content)
        setShowContractViewModal(true)
      } else {
        // 계약서가 없으면 새로 생성하도록 안내
        alert("이 동물에 대한 생성된 계약서가 없습니다. 입양신청 탭에서 계약서를 생성해주세요.")
      }
    } catch (error) {
      console.error("계약서 보기 실패:", error)
      alert("계약서를 불러오는데 실패했습니다.")
    }
  }

  const handleViewTemplate = async (templateId: number) => {
    try {
      const response = await axios.get(`${getBackendUrl()}/api/contract-templates/${templateId}`)
      if (response.data.success) {
        const template = response.data.data
        setSelectedTemplateForView(template)
        setShowTemplateViewModal(true)
      } else {
        alert("템플릿을 불러오는데 실패했습니다.")
      }
    } catch (error) {
      console.error("템플릿 보기 실패:", error)
      alert("템플릿을 불러오는데 실패했습니다.")
    }
  }

  const handleEditTemplate = async (templateId: number) => {
    try {
      const response = await axios.get(`${getBackendUrl()}/api/contract-templates/${templateId}`)
      if (response.data.success) {
        const template = response.data.data
        
        // 템플릿 정보 설정
        setNewTemplate({
          name: template.name,
          category: template.category,
          content: "",
          isDefault: false
        })
        
        // sections 파싱
        if (template.sections && template.sections.length > 0) {
          const sections = template.sections.map((section: any, index: number) => ({
            id: `section-${Date.now()}-${index}`,
            title: section.title,
    
            aiSuggestion: ""
          }))
          setTemplateSections(sections)
        } else if (template.content) {
          // content가 있으면 파싱해서 sections로 변환
          const contentLines = template.content.split('\n').filter((line: string) => line.trim())
          const sections = contentLines.map((line: string, index: number) => {
            const match = line.match(/^(\d+)\.\s*(.+?)(?:\s*\(필수\))?$/)
            if (match) {
              return {
                id: `section-${Date.now()}-${index}`,
                title: match[2].trim(),
                required: line.includes('(필수)'),
                aiSuggestion: ""
              }
            } else {
              return {
                id: `section-${Date.now()}-${index}`,
                title: line.trim(),
                required: false,
                aiSuggestion: ""
              }
            }
          })
          setTemplateSections(sections)
        } else {
          // sections가 없으면 빈 배열로 시작 (사용자가 직접 추가해야 함)
          setTemplateSections([])
        }
        
        setEditingTemplate(template)
        setShowEditTemplateModal(true)
      } else {
        alert("템플릿을 불러오는데 실패했습니다.")
      }
    } catch (error) {
      console.error("템플릿 수정 실패:", error)
      alert("템플릿을 불러오는데 실패했습니다.")
    }
  }

  const handleUpdateTemplate = async () => {
    if (!editingTemplate) return
    
    try {
      // sections를 백엔드 형식으로 변환
      const sections = templateSections.map((section, index) => ({
        title: section.title,
        order: index + 1,
        content: "",
        options: null
      }))
      
      const templateData = {
        name: newTemplate.name,
        category: newTemplate.category,
        sections: sections
      }
      
      const response = await axios.put(`${getBackendUrl()}/api/contract-templates/${editingTemplate.id}`, templateData)
      if (response.data.success) {
        alert("템플릿이 수정되었습니다.")
        setShowEditTemplateModal(false)
        setEditingTemplate(null)
        setNewTemplate({ name: "", category: "", content: "", isDefault: false })
        setTemplateSections([])
        fetchContractTemplates() // 목록 새로고침
      } else {
        alert("템플릿 수정에 실패했습니다.")
      }
    } catch (error) {
      console.error("템플릿 수정 실패:", error)
      alert("템플릿 수정에 실패했습니다.")
    }
  }

  const handleDeleteTemplate = async (templateId: number) => {
    if (confirm('정말로 이 템플릿을 삭제하시겠습니까?')) {
      try {
        await axios.delete(`${getBackendUrl()}/api/contract-templates/${templateId}`)
        alert("템플릿이 삭제되었습니다.")
        fetchContractTemplates() // 목록 새로고침
      } catch (error) {
        console.error("템플릿 삭제 실패:", error)
        alert("템플릿 삭제에 실패했습니다.")
      }
    }
  }

  const handleViewGeneratedContract = async (contractId: number) => {
    try {
      const response = await axios.get(`${getBackendUrl()}/api/contract-generation/${contractId}`)
      if (response.data.success) {
        const contract = response.data.data
        setSelectedContractForView(contract)
        setShowGeneratedContractViewModal(true)
      } else {
        alert("계약서를 불러오는데 실패했습니다.")
      }
    } catch (error) {
      console.error("계약서 보기 실패:", error)
      alert("계약서를 불러오는데 실패했습니다.")
    }
  }

  const handleDownloadContract = async (contractId: number) => {
    try {
      const response = await axios.get(`${getBackendUrl()}/api/contract-generation/${contractId}/download`, {
        responseType: 'blob'
      })
      
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `contract-${contractId}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      
      alert("PDF 파일이 다운로드되었습니다.")
    } catch (error) {
      console.error("계약서 다운로드 실패:", error)
      alert("파일 다운로드에 실패했습니다.")
    }
  }

  const handleDeleteContract = async (contractId: number) => {
    if (confirm('정말로 이 계약서를 삭제하시겠습니까?')) {
      try {
        await axios.delete(`${getBackendUrl()}/api/contract-generation/${contractId}`)
        alert("계약서가 삭제되었습니다.")
        fetchGeneratedContracts() // 목록 새로고침
      } catch (error) {
        console.error("계약서 삭제 실패:", error)
        alert("계약서 삭제에 실패했습니다.")
      }
    }
  }

  const handleEditContract = async (contract: any) => {
    setEditingContract(contract)
    setEditedContractContent(contract.content)
    setShowContractEditModal(true)
  }

  const handleUpdateContract = async () => {
    if (!editingContract) return

    try {
      const response = await axios.put(`${getBackendUrl()}/api/contract-generation/${editingContract.id}`, {
        content: editedContractContent
      })
      
      if (response.data.success) {
        alert("계약서가 수정되었습니다.")
        setShowContractEditModal(false)
        setEditingContract(null)
        setEditedContractContent("")
        fetchGeneratedContracts()
      } else {
        alert("계약서 수정에 실패했습니다.")
      }
    } catch (error) {
      console.error("계약서 수정 실패:", error)
      alert("계약서 수정에 실패했습니다.")
    }
  }

  const handleCreateTemplate = async () => {
    try {
      // sections를 백엔드 형식으로 변환
      const sections = templateSections.map((section, index) => ({
        title: section.title,
        order: index + 1,
        content: "",
        options: null
      }))
      
      const templateData = {
        name: newTemplate.name,
        category: newTemplate.category,
        sections: sections
      }
      
      const response = await axios.post(`${getBackendUrl()}/api/contract-templates`, templateData)
      if (response.data.success) {
        alert("템플릿이 생성되었습니다.")
        setShowCreateTemplateModal(false)
        setNewTemplate({
          name: "",
          category: "",
          content: "",
          isDefault: false
        })
        setTemplateSections([])
        fetchContractTemplates() // 목록 새로고침
      } else {
        alert("템플릿 생성에 실패했습니다.")
      }
    } catch (error) {
      console.error("템플릿 생성 실패:", error)
      alert("템플릿 생성에 실패했습니다.")
    }
  }

  const addSection = () => {
    const newSection = {
      id: (Date.now() + Math.random()).toString(),
      title: "새 항목",
      aiSuggestion: ""
    }
    setTemplateSections([...templateSections, newSection])
  }

  const addSectionAtIndex = (index: number) => {
    const newSection = {
      id: (Date.now() + Math.random()).toString(),
      title: "새 항목",
      aiSuggestion: ""
    }
    const newSections = [...templateSections]
    newSections.splice(index, 0, newSection)
    setTemplateSections(newSections)
  }

  const addDefaultSections = () => {
    const baseTime = Date.now()
    const defaultSections = [
      {
        id: (baseTime + 1).toString(),
        title: "반려동물 이름",
        aiSuggestion: "반려동물의 이름을 입력해주세요"
      },
      {
        id: (baseTime + 2).toString(),
        title: "반려동물 품종",
        aiSuggestion: "반려동물의 품종을 입력해주세요"
      },
      {
        id: (baseTime + 3).toString(),
        title: "반려동물 나이",
        aiSuggestion: "반려동물의 나이를 입력해주세요"
      },
      {
        id: (baseTime + 4).toString(),
        title: "신청자 이름",
        aiSuggestion: "신청자의 이름을 입력해주세요"
      },
      {
        id: (baseTime + 5).toString(),
        title: "신청자 연락처",
        aiSuggestion: "신청자의 연락처를 입력해주세요"
      },
      {
        id: (baseTime + 6).toString(),
        title: "신청자 이메일",
        aiSuggestion: "신청자의 이메일을 입력해주세요"
      }
    ]
    setTemplateSections([...templateSections, ...defaultSections])
  }

  const generateClauseNumber = (title: string, sections: any[] = templateSections) => {
    // 빈 제목이면 기본값 사용
    const finalTitle = title && title.trim() !== '' ? title : '새 항목'
    
    // 이미 사용된 번호들을 확인해서 겹치지 않는 번호 생성
    const usedNumbers = new Set<number>()
    
    sections.forEach((section, idx) => {
      if (section.aiSuggestion) {
        const match = section.aiSuggestion.match(/제(\d+)조/)
        if (match) {
          usedNumbers.add(parseInt(match[1]))
        }
      }
    })
    
    // 겹치지 않는 번호 찾기
    let clauseNumber = 1
    while (usedNumbers.has(clauseNumber)) {
      clauseNumber++
    }
    
    return `제${clauseNumber}조 (${finalTitle})`
  }



  const getAISuggestion = async (title: string) => {
    try {
      // 사용자가 입력을 안 했거나 기본값인 경우 AI가 추천
      const isDefaultTitle = !title || title === '' || title === '새 항목'
      
      if (isDefaultTitle) {
        // AI 서버에서 새로운 조항 제목 추천 받기
        const response = await axios.post(`${getBackendUrl()}/api/contract-templates/ai-suggestions/contract-suggestions`, {
          templateId: 1,
          currentContent: "",
          petInfo: {},
          userInfo: {}
        })
        
        if (response.data.data && response.data.data.suggestions && response.data.data.suggestions.length > 0) {
          // AI 추천 제목을 가져와서 번호와 함께 생성
          const aiTitle = response.data.data.suggestions[0].suggestion.replace(/^제\d+조\s*\((.+)\)$/, '$1')
          return generateClauseNumber(aiTitle)
        }
      } else {
        // 사용자가 입력한 제목을 AI가 개선해서 추천
        const response = await axios.post(`${getBackendUrl()}/api/contract-templates/ai-suggestions/clauses`, {
          templateId: null,
          currentClauses: templateSections.map(s => s.title),
          petInfo: {},
          userInfo: {}
        })
        
        if (response.data.data && response.data.data.suggestions && response.data.data.suggestions.length > 0) {
          // AI 추천 제목을 가져와서 번호와 함께 생성
          const aiTitle = response.data.data.suggestions[0].suggestion.replace(/^제\d+조\s*\((.+)\)$/, '$1')
          return generateClauseNumber(aiTitle)
        }
      }
      
      // AI 서버가 없으면 기본 추천
      const defaultTitle = title || '새 항목'
      return generateClauseNumber(defaultTitle)
    } catch (error) {
      console.error("AI 추천 생성 실패:", error)
      // AI 서버가 없으면 기본 추천
      const defaultTitle = title || '새 항목'
      return generateClauseNumber(defaultTitle)
    }
  }

  const handleGetClauseNumber = async (sectionId: string, title: string) => {
    const suggestion = await getAISuggestion(title)
    updateSection(sectionId, 'aiSuggestion', suggestion)
    setShowAISuggestion(sectionId)
  }

  const handleRejectAISuggestion = async (sectionId: string) => {
    // 사용자가 AI 추천을 거부하고 다른 AI 추천 받기
    const section = templateSections.find(s => s.id === sectionId)
    if (section) {
      try {
        // 다른 AI 추천 받기 (현재 추천과 다른 것을 받기 위해 랜덤 인덱스 사용)
        const response = await axios.post(`${getBackendUrl()}/api/contract-templates/ai-suggestions/clauses`, {
          templateId: null,
          currentClauses: templateSections.map(s => s.title),
          petInfo: {},
          userInfo: {}
        })
        
        if (response.data.data && response.data.data.length > 1) {
          // 첫 번째 추천이 아닌 다른 추천 선택 (랜덤하게)
          const randomIndex = Math.floor(Math.random() * (response.data.data.length - 1)) + 1
          const aiTitle = response.data.data[randomIndex].suggestion.replace(/^제\d+조\s*\((.+)\)$/, '$1')
          const newSuggestion = generateClauseNumber(aiTitle)
          updateSection(sectionId, 'aiSuggestion', newSuggestion)
        } else {
          // 다른 추천이 없으면 기본 번호 생성
          const basicNumber = generateClauseNumber(section.title)
          updateSection(sectionId, 'aiSuggestion', basicNumber)
        }
      } catch (error) {
        console.error("다른 AI 추천 생성 실패:", error)
        // AI 서버가 없으면 기본 번호 생성
        const basicNumber = generateClauseNumber(section.title)
        updateSection(sectionId, 'aiSuggestion', basicNumber)
      }
    }
  }

  const handleApplyAISuggestion = (sectionId: string) => {
    // AI 추천 내용을 항목 제목에 적용하고 말풍선 닫기
    const section = templateSections.find(s => s.id === sectionId)
    if (section && section.aiSuggestion) {
      const titleOnly = section.aiSuggestion.replace(/^제\d+조\s*\((.+)\)$/, '$1')
      updateSection(sectionId, 'title', titleOnly)
      setShowAISuggestion(null)
    }
  }

  const handleCloseAISuggestion = (sectionId: string) => {
    setShowAISuggestion(null)
  }

  const removeSection = (id: string) => {
    setTemplateSections(templateSections.filter(section => section.id !== id))
  }

  const updateSection = (id: string, field: 'title' | 'aiSuggestion', value: string) => {
    setTemplateSections(templateSections.map(section => 
      section.id === id ? { ...section, [field]: value } : section
    ))
  }

  const moveSection = (fromIndex: number, toIndex: number) => {
    const newSections = [...templateSections]
    const [movedSection] = newSections.splice(fromIndex, 1)
    newSections.splice(toIndex, 0, movedSection)
    setTemplateSections(newSections)
  }


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
                  <div className="text-2xl font-bold">{products?.length ?? 0}</div>
                  <p className="text-xs text-muted-foreground">전체 상품 수</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">입양 대기 동물</CardTitle>
                  <Heart className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {(pets ?? []).filter((pet) => pet.adoptionStatus === "available").length}
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
                  <div className="text-2xl font-bold">{getProcessingRate()}%</div>
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
          <TabsContent value="adoption-requests" className="space-y-6">
            <h2 className="text-2xl font-bold">입양신청 관리</h2>

            <div className="grid gap-4">
              {(adoptionRequests ?? []).length > 0 ? (
                adoptionRequests.map((request, index) => (
                  <Card key={request.id || `adoption-request-${index}`}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-3">
                            <h3 className="font-semibold">{request.petName} ({request.petBreed}) 입양신청</h3>
                            <Badge className={getStatusColor(request.status)}>
                              {request.status === "PENDING" ? "대기중" : 
                               request.status === "CONTACTED" ? "연락완료" :
                               request.status === "APPROVED" ? "승인" : "거절"}
                            </Badge>
                          </div>
                          
                          <div className="space-y-2 mb-4">
                            <div className="flex items-center space-x-2">
                              <Users className="h-4 w-4 text-gray-500" />
                              <span className="text-sm">신청자: {request.applicantName}</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Phone className="h-4 w-4 text-gray-500" />
                              <span className="text-sm">연락처: {request.contactNumber}</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Mail className="h-4 w-4 text-gray-500" />
                              <span className="text-sm">이메일: {request.email}</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="text-sm text-gray-500">사용자 ID: {request.userId}</span>
                            </div>
                          </div>
                          
                          <div className="mb-4">
                            <h4 className="font-medium text-sm mb-2">입양 동기 및 메시지:</h4>
                            <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                              {request.message}
                            </p>
                          </div>
                          
                          <div className="flex items-center space-x-4 text-xs text-gray-500">
                            <span>신청일: {request.createdAt ? formatToKST(request.createdAt) : "날짜 없음"}</span>
                            <span>수정일: {request.updatedAt ? formatToKST(request.updatedAt) : "날짜 없음"}</span>
                          </div>
                        </div>
                        
                        <div className="flex flex-col space-y-2 ml-4">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleUpdateAdoptionRequestStatus(request.id, "CONTACTED")}
                            disabled={request.status === "CONTACTED" || request.status === "APPROVED" || request.status === "REJECTED"}
                          >
                            <Phone className="h-4 w-4 mr-1" />
                            연락완료
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleUpdateAdoptionRequestStatus(request.id, "APPROVED")}
                            disabled={request.status === "APPROVED" || request.status === "REJECTED"}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            승인
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleUpdateAdoptionRequestStatus(request.id, "REJECTED")}
                            disabled={request.status === "APPROVED" || request.status === "REJECTED"}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            거절
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card>
                  <CardContent className="p-6">
                    <div className="text-center text-gray-500">
                      <Heart className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p>아직 입양신청이 없습니다.</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Adoption Requests Tab */}
          <TabsContent value="inquiries" className="space-y-6">
            <h2 className="text-2xl font-bold">입양신청 관리</h2>

            {/* 검색 및 필터 */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="신청자명, 펫명, 품종, 연락처로 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-400"
              >
                <option value="ALL">전체 상태</option>
                <option value="PENDING">대기중</option>
                <option value="CONTACTED">연락완료</option>
                <option value="APPROVED">승인</option>
                <option value="REJECTED">거절</option>
              </select>
              <Button 
                onClick={exportToCSV}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                CSV 내보내기
              </Button>
            </div>

            {/* 통계 요약 */}
            <div className="flex items-center justify-between mb-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1">
              <Card key="pending">
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-yellow-600">
                    {filteredRequests.filter(r => r.status === "PENDING").length}
                  </div>
                  <p className="text-xs text-gray-600">대기중</p>
                </CardContent>
              </Card>
              <Card key="contacted">
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-blue-600">
                    {filteredRequests.filter(r => r.status === "CONTACTED").length}
                  </div>
                  <p className="text-xs text-gray-600">연락완료</p>
                </CardContent>
              </Card>
              <Card key="approved">
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-green-600">
                    {filteredRequests.filter(r => r.status === "APPROVED").length}
                  </div>
                  <p className="text-xs text-gray-600">승인</p>
                </CardContent>
              </Card>
              <Card key="rejected">
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-red-600">
                    {filteredRequests.filter(r => r.status === "REJECTED").length}
                  </div>
                  <p className="text-xs text-gray-600">거절</p>
                </CardContent>
              </Card>
            </div>
              <div className="text-sm text-gray-600 ml-4">
                총 {(filteredRequests ?? []).length}건 (전체 {(adoptionRequests ?? []).length}건)
              </div>
            </div>

            <div className="grid gap-4">
              {(filteredRequests ?? []).length > 0 ? (
                filteredRequests.map((request, index) => (
                  <Card key={request.id || `request-${index}`}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-3">
                            <h3 className="font-semibold">{request.petName} ({request.petBreed}) 입양신청</h3>
                            <div className="flex items-center space-x-2">
                              <Badge className={getStatusColor(request.status)}>
                                {request.status === "PENDING" ? "대기중" : 
                                 request.status === "CONTACTED" ? "연락완료" : 
                                 request.status === "APPROVED" ? "승인" : "거절"}
                              </Badge>
                              {request.status === "PENDING" && isUrgent(request.createdAt) && (
                                <Badge className="bg-red-100 text-red-800 animate-pulse">
                                  긴급
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="space-y-2 mb-4">
                            <div className="flex items-center space-x-2">
                              <Users className="h-4 w-4 text-gray-500" />
                              <span className="text-sm">신청자: {request.applicantName}</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Phone className="h-4 w-4 text-gray-500" />
                              <span className="text-sm">연락처: {request.contactNumber}</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Mail className="h-4 w-4 text-gray-500" />
                              <span className="text-sm">이메일: {request.email}</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Users className="h-4 w-4 text-gray-500" />
                              <span className="text-sm">회원 ID: {request.userId}</span>
                            </div>
                          </div>
                          <p className="text-sm text-gray-600 mb-4">{request.message}</p>
                          <p className="text-xs text-gray-500">
                            신청일: {request.createdAt ? formatToKST(request.createdAt) : "날짜 없음"}
                            {request.status === "PENDING" && request.createdAt && (
                              <span className="ml-2 text-red-600">
                                ({Math.floor((new Date().getTime() - new Date(request.createdAt).getTime()) / (1000 * 60 * 60))}시간 경과)
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="flex flex-col space-y-2 ml-4">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleUpdateAdoptionRequestStatus(request.id, "CONTACTED")}
                            disabled={request.status === "CONTACTED"}
                          >
                            <Phone className="h-4 w-4 mr-1" />
                            연락완료
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleUpdateAdoptionRequestStatus(request.id, "APPROVED")}
                            disabled={request.status === "APPROVED"}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            승인
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleUpdateAdoptionRequestStatus(request.id, "REJECTED")}
                            disabled={request.status === "REJECTED"}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            거절
                          </Button>
                          {request.status === "APPROVED" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleShowContractModal(request)}
                              className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
                            >
                              <FileText className="h-4 w-4 mr-1" />
                              AI 계약서 생성
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card className="p-6 text-center text-gray-500">
                  <div className="space-y-4">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
                      <Heart className="w-8 h-8 text-gray-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        {(adoptionRequests ?? []).length === 0 ? "입양신청이 없습니다" : "검색 결과가 없습니다"}
                      </h3>
                      <p className="text-gray-500">
                        {(adoptionRequests ?? []).length === 0 
                          ? "아직 입양신청이 접수되지 않았습니다." 
                          : "검색 조건을 변경해보세요."}
                      </p>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Orders Tab */}
          <TabsContent value="orders" className="space-y-6">
            <h2 className="text-2xl font-bold">주문 내역 관리</h2>

            <div className="grid gap-4">
              {(orders ?? []).length > 0 ? (
                orders.map((order, index) => (
                  <Card key={order.orderId || `order-${index}`}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-3">
                            <h3 className="font-semibold">주문 #{order.orderId || order.id || 'N/A'}</h3>
                            <Badge 
                              className={
                                order.paymentStatus === "COMPLETED"
                                  ? "bg-green-100 text-green-800"
                                  : order.paymentStatus === "PENDING"
                                    ? "bg-yellow-100 text-yellow-800"
                                    : "bg-red-100 text-red-800"
                              }
                            >
                              {order.paymentStatus === "COMPLETED" ? "완료" : 
                               order.paymentStatus === "PENDING" ? "대기중" : "취소됨"}
                            </Badge>
                          </div>
                          
                          <div className="space-y-2 mb-4">
                            <p className="text-sm text-gray-600">사용자 ID: {order.userId}</p>
                            <p className="text-sm text-gray-600">총 금액: {(order.amount || 0).toLocaleString()}원</p>
                            <p className="text-sm text-gray-600">
                              주문일: {order.orderedAt ? 
                                (() => {
                                  try {
                                    // ISO 문자열이나 다른 형식의 날짜를 안전하게 파싱
                                    const date = new Date(order.orderedAt);
                                    if (isNaN(date.getTime())) {
                                      return "날짜 형식 오류";
                                    }
                                    return formatToKST(order.orderedAt)
                                  } catch (error) {
                                    console.error('날짜 파싱 오류:', error, '원본 데이터:', order.orderedAt);
                                    return "날짜 없음"
                                  }
                                })() 
                                : "날짜 없음"
                              }
                            </p>
                          </div>

                          {/* 주문 상품 목록 */}
                          {order.orderItems && order.orderItems.length > 0 ? (
                            <div className="space-y-2">
                              <h4 className="font-medium text-sm">주문 상품:</h4>
                              {order.orderItems.map((item, index) => {
                                console.log('주문 아이템:', item);
                                console.log('주문 아이템의 ImageUrl:', item.ImageUrl);
                                console.log('이미지 표시 여부:', !!item.ImageUrl);
                                
                                return (
                                  <div key={item.id || `order-item-${index}`} className="flex items-center space-x-3 p-2 bg-gray-50 rounded overflow-visible">
                                    <img
                                      src={item.ImageUrl ? item.ImageUrl : "/placeholder.svg"}
                                      alt={item.productName || "상품"}
                                      className="w-16 h-16 object-cover rounded border border-gray-200"
                                      onError={(e) => {
                                        console.log('이미지 로딩 실패:', item.ImageUrl);
                                        const target = e.target as HTMLImageElement;
                                        target.src = "/placeholder.svg";
                                      }}
                                      onLoad={(e) => {
                                        console.log('이미지 로딩 성공:', item.ImageUrl);
                                        const target = e.target as HTMLImageElement;
                                        console.log('이미지 실제 크기:', target.naturalWidth, 'x', target.naturalHeight);
                                        console.log('이미지 표시 크기:', target.width, 'x', target.height);
                                      }}
                                    />
                                    <div className="flex-1">
                                      <p className="text-sm font-medium">{item.productName || "상품명 없음"}</p>
                                      <p className="text-xs text-gray-500">
                                        상품 ID: {item.productId || "N/A"} | {(item.price || 0).toLocaleString()}원 × {item.quantity || 1}개
                                      </p>
                                      <p className="text-xs text-blue-500">이미지 URL: {item.ImageUrl ? '있음' : '없음'}</p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="text-sm text-gray-500">
                              상품 정보가 없습니다.
                            </div>
                          )}
                        </div>
                        
                        <div className="flex flex-col space-y-2 ml-4">
                          
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleUpdateOrderStatus(order.orderId, "CANCELLED")}
                            disabled={order.paymentStatus === "CANCELLED"}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            주문취소
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card className="p-6 text-center text-gray-500">
                  <div className="space-y-4">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">주문 내역이 없습니다</h3>
                      <p className="text-gray-500">아직 주문이 없습니다.</p>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* AI 계약서 Tab */}
          <TabsContent value="contracts" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">AI 계약서 관리</h2>
              <div className="flex gap-2">
                <Button 
                  onClick={() => setContractView("templates")} 
                  className={`${contractView === "templates" ? "bg-blue-600" : "bg-blue-500 hover:bg-blue-600"} text-white`}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  템플릿 관리
                </Button>
                <Button 
                  onClick={() => setContractView("contracts")} 
                  className={`${contractView === "contracts" ? "bg-green-600" : "bg-green-500 hover:bg-green-600"} text-white`}
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  계약서 관리
                </Button>
              </div>
            </div>

            {/* 템플릿 관리 뷰 */}
            {contractView === "templates" && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>계약서 템플릿 목록</CardTitle>
                    <Button 
                      onClick={() => setShowCreateTemplateModal(true)}
                      className="bg-blue-500 hover:bg-blue-600 text-white"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      새 템플릿 생성
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoadingTemplates ? (
                    <div className="text-center py-8">
                      <p>템플릿을 불러오는 중...</p>
                    </div>
                  ) : contractTemplates.length === 0 ? (
                    <div className="text-center py-8">
                      <p>등록된 템플릿이 없습니다.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {contractTemplates.map((template) => (
                        <Card key={template.id} className="hover:shadow-lg transition-shadow cursor-pointer">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-lg">{template.name}</CardTitle>
                            <Badge variant="outline">
                              {template.isDefault ? "기본 템플릿" : "사용자 템플릿"}
                            </Badge>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm text-gray-600 mb-3">{template.description}</p>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => handleViewTemplate(template.id)}>
                                <Eye className="h-4 w-4 mr-1" />
                                보기
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => handleEditTemplate(template.id)}>
                                <Edit className="h-4 w-4 mr-1" />
                                수정
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => handleDeleteTemplate(template.id)}>
                                <Trash2 className="h-4 w-4 mr-1" />
                                삭제
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* 계약서 관리 뷰 */}
            {contractView === "contracts" && (
              <Card>
                <CardHeader>
                  <CardTitle>생성된 계약서 목록</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoadingContracts ? (
                    <div className="text-center py-8">
                      <p>계약서를 불러오는 중...</p>
                    </div>
                  ) : generatedContracts.length === 0 ? (
                    <div className="text-center py-8">
                      <p>생성된 계약서가 없습니다.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {generatedContracts.map((contract) => (
                        <div key={contract.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div>
                            <h4 className="font-medium">{contract.contractName || "계약서"}</h4>
                            <p className="text-sm text-gray-600">
                              {contract.generatedAt ? formatToKST(contract.generatedAt) : "날짜 없음"} 생성
                            </p>
                            <p className="text-xs text-gray-500">
                              생성자: {contract.generatedBy || "관리자"}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => handleViewGeneratedContract(contract.id)}>
                              <Eye className="h-4 w-4 mr-1" />
                              보기
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleEditContract(contract)}>
                              <Edit className="h-4 w-4 mr-1" />
                              수정
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleDownloadContract(contract.id)}>
                              <FileText className="h-4 w-4 mr-1" />
                              PDF
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleDeleteContract(contract.id)}>
                              <Trash2 className="h-4 w-4 mr-1" />
                              삭제
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}


          </TabsContent>
        </Tabs>
      </div>
      
      {/* 수정 모달 */}
      <AnimalEditModal
        isOpen={showEditModal}
        onClose={handleCloseEditModal}
        selectedPet={selectedPetForEdit as unknown as PetsTypePet | null}
        petId={selectedPetForEdit?.petId || (selectedPetForEdit as any)?.id || (selectedPetForEdit as any)?.petId}
        onUpdatePet={() => {
          // 모달 내부에서 직접 처리하므로 여기서는 아무것도 하지 않음
          handleCloseEditModal()
          window.location.reload()
        }}
      />



      {/* 템플릿 생성 모달 */}
      <Dialog open={showCreateTemplateModal} onOpenChange={setShowCreateTemplateModal}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>새 템플릿 생성</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            {/* 기본 정보 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">템플릿 이름</label>
                <input
                  type="text"
                  className="w-full mt-1 p-2 border rounded-md"
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate({...newTemplate, name: e.target.value})}
                  placeholder="템플릿 이름을 입력하세요"
                />
              </div>
              <div>
                <label className="text-sm font-medium">카테고리</label>
                <select
                  className="w-full mt-1 p-2 border rounded-md"
                  value={newTemplate.category}
                  onChange={(e) => setNewTemplate({...newTemplate, category: e.target.value})}
                >
                  <option value="">카테고리 선택</option>
                  <option value="입양계약서">입양계약서</option>
                  <option value="분양계약서">분양계약서</option>
                  <option value="임시보호계약서">임시보호계약서</option>
                  <option value="의료계약서">의료계약서</option>
                  <option value="훈련계약서">훈련계약서</option>
                  <option value="기타">기타</option>
                </select>
              </div>
            </div>


            {/* 섹션 관리 */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium">계약서 항목</h3>
                <div className="flex gap-2">
                  <Button 
                    onClick={addDefaultSections}
                    className="bg-blue-500 hover:bg-blue-600 text-white"
                  >
                    기본 항목 추가
                  </Button>
                  <Button 
                    onClick={addSection}
                    className="bg-green-500 hover:bg-green-600 text-white"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    항목 추가
                  </Button>
                </div>
              </div>
              
              {templateSections.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                  <p className="text-gray-500 mb-2">계약서에 필요한 항목들을 추가하세요</p>
                  <p className="text-sm text-gray-400">"기본 항목 추가" 버튼으로 자주 사용하는 항목들을 한 번에 추가할 수 있습니다</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {templateSections.map((section, index) => (
                    <div key={section.id}>
                      <Card className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2 relative">
                            <div className="cursor-move text-gray-400 hover:text-gray-600">
                              ⋮⋮
                            </div>
                            <h4 className="font-medium">항목 {index + 1}</h4>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleGetClauseNumber(section.id, section.title)}
                              className="text-xs whitespace-nowrap"
                            >
                              AI 추천
                            </Button>
                            
                            {/* AI 추천 말풍선 */}
                            {showAISuggestion === section.id && section.aiSuggestion && (
                              <div className="absolute top-30 left-0 z-10 w-80 bg-blue-50 border border-blue-200 rounded-lg shadow-lg p-3 mt-1">
                                <div className="flex justify-between items-start mb-2">
                                  <span className="text-xs font-medium text-blue-800">AI 추천</span>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleCloseAISuggestion(section.id)}
                                    className="text-xs p-1 h-6 w-6"
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                                <p className="text-sm text-blue-900 mb-2">{section.aiSuggestion.replace(/^제\d+조\s*\((.+)\)$/, '$1')}</p>
                                <div className="flex gap-1 justify-end">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleRejectAISuggestion(section.id)}
                                    className="text-xs px-2"
                                  >
                                    다른 추천
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="default"
                                    onClick={() => handleApplyAISuggestion(section.id)}
                                    className="text-xs bg-blue-500 hover:bg-blue-600 text-white px-2"
                                  >
                                    적용하기
                                  </Button>
                                </div>
                                <div className="absolute top-4 -left-2 w-0 h-0 border-t-2 border-b-2 border-r-2 border-transparent border-r-blue-50"></div>
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2">
                            {index > 0 && (
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => moveSection(index, index - 1)}
                              >
                                ↑
                              </Button>
                            )}
                            {index < templateSections.length - 1 && (
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => moveSection(index, index + 1)}
                              >
                                ↓
                              </Button>
                            )}
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => removeSection(section.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        
                        <div className="space-y-3">
                          <div>
                            <label className="text-sm font-medium">항목 제목</label>
                            <input
                              type="text"
                              className="w-full mt-1 p-2 border rounded-md"
                              value={section.title}
                              onChange={(e) => updateSection(section.id, 'title', e.target.value)}
                              placeholder="예: 반려동물 이름, 신청자 연락처"
                            />
                          </div>
                        </div>
                      </Card>
                    </div>
                  ))}
                  
                  {/* 마지막 항목 아래에 추가 버튼 */}
                  {templateSections.length > 0 && (
                    <div className="flex justify-center my-2">
                      <Button 
                        onClick={addSection}
                        className="bg-green-500 hover:bg-green-600 text-white text-sm"
                        size="sm"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        항목 추가
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 기본 템플릿 설정 */}
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isDefault"
                checked={newTemplate.isDefault}
                onChange={(e) => setNewTemplate({...newTemplate, isDefault: e.target.checked})}
              />
              <label htmlFor="isDefault" className="text-sm">기본 템플릿으로 설정</label>
            </div>

            {/* 버튼 */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreateTemplateModal(false)}>
                취소
              </Button>
              <Button 
                onClick={handleCreateTemplate}
                className="bg-blue-500 hover:bg-blue-600 text-white"
                disabled={!newTemplate.name || !newTemplate.category || templateSections.length === 0}
              >
                템플릿 생성
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 계약서 보기 모달 */}
      <Dialog open={showContractViewModal} onOpenChange={setShowContractViewModal}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              계약서 상세 보기
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            {selectedPetForContract && (
              <div className="space-y-6">
                {/* 동물 정보 */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-3 text-gray-800">동물 정보</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center">
                      <span className="font-medium text-gray-700 w-16">이름:</span>
                      <span className="text-gray-900">{selectedPetForContract.name}</span>
                    </div>
                    <div className="flex items-center">
                      <span className="font-medium text-gray-700 w-16">품종:</span>
                      <span className="text-gray-900">{selectedPetForContract.breed}</span>
                    </div>
                    <div className="flex items-center">
                      <span className="font-medium text-gray-700 w-16">나이:</span>
                      <span className="text-gray-900">{selectedPetForContract.age}</span>
                    </div>
                    <div className="flex items-center">
                      <span className="font-medium text-gray-700 w-16">성별:</span>
                      <span className="text-gray-900">{selectedPetForContract.gender}</span>
                    </div>
                  </div>
                </div>

                {/* 계약서 내용 */}
                <div className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium">계약서 내용</h4>
                    <div className="flex gap-2">
                      <Button 
                        size="sm"
                        variant="outline"
                        className="bg-white text-black border border-gray-300 hover:bg-gray-50"
                        onClick={() => handleDownloadContract(0)}
                      >
                        <FileText className="h-4 w-4 mr-1" />
                        PDF 다운로드
                      </Button>
                    </div>
                  </div>
                  <div className="bg-white p-4 rounded border max-h-96 overflow-y-auto">
                    {generatedContract ? (
                      <div className="whitespace-pre-wrap text-sm leading-relaxed">{generatedContract}</div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <p>계약서 내용을 불러올 수 없습니다.</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button variant="outline" onClick={() => {
                    setShowContractViewModal(false)
                    setSelectedPetForContract(null)
                    setGeneratedContract(null)
                  }}>
                    닫기
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 계약서 생성 모달 */}
      <Dialog open={showContractModal} onOpenChange={setShowContractModal}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>AI 계약서 생성</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            {selectedContractRequest && (
              <div className="space-y-6">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">입양 신청 정보</h4>
                  <div className="text-sm space-y-1">
                    <p><strong>입양견:</strong> {selectedContractRequest.petName} ({selectedContractRequest.petBreed})</p>
                    <p><strong>신청자:</strong> {selectedContractRequest.applicantName}</p>
                    <p><strong>연락처:</strong> {selectedContractRequest.contactNumber}</p>
                    <p><strong>이메일:</strong> {selectedContractRequest.email}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* 템플릿 선택 */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="w-5 h-5" />
                        템플릿 선택
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {isLoadingTemplates ? (
                        <div className="text-center py-4">
                          <p>템플릿을 불러오는 중...</p>
                        </div>
                      ) : contractTemplates.length === 0 ? (
                        <div className="text-center py-4">
                          <p>사용 가능한 템플릿이 없습니다.</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {contractTemplates.map((template) => (
                            <div 
                              key={template.id}
                              className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                                selectedTemplate === template.id ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'
                              }`}
                              onClick={() => setSelectedTemplate(template.id)}
                            >
                              <h4 className="font-medium">{template.name}</h4>
                              <p className="text-sm text-gray-600">{template.description}</p>
                              <Badge variant="outline" className="mt-1">
                                {template.isDefault ? "기본 템플릿" : "사용자 템플릿"}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* 입양견 및 신청자 정보 */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <MessageSquare className="w-5 h-5" />
                        입양견 및 신청자 정보
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div>
                          <label className="text-sm font-medium">입양견 이름</label>
                          <input 
                            type="text" 
                            className="w-full mt-1 p-2 border rounded-md" 
                            placeholder="입양견 이름"
                            defaultValue={selectedContractRequest.petName}
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium">입양견 품종</label>
                          <input 
                            type="text" 
                            className="w-full mt-1 p-2 border rounded-md" 
                            placeholder="입양견 품종"
                            defaultValue={selectedContractRequest.petBreed}
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium">신청자 이름</label>
                          <input 
                            type="text" 
                            className="w-full mt-1 p-2 border rounded-md" 
                            placeholder="신청자 이름"
                            defaultValue={selectedContractRequest.applicantName}
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium">신청자 연락처</label>
                          <input 
                            type="text" 
                            className="w-full mt-1 p-2 border rounded-md" 
                            placeholder="신청자 연락처"
                            defaultValue={selectedContractRequest.contactNumber}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowContractModal(false)}>
                    취소
                  </Button>
                  <Button 
                    className="bg-green-500 hover:bg-green-600 text-white"
                    onClick={() => handleGenerateContract(selectedContractRequest)}
                    disabled={!selectedTemplate || isGeneratingContract}
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    {isGeneratingContract ? "생성 중..." : "AI 계약서 생성"}
                  </Button>
                </div>

                {/* 생성된 계약서 미리보기 */}
                {generatedContract && (
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle>생성된 계약서 미리보기</CardTitle>
                        <div className="flex gap-2">
                          <Button 
                            size="sm"
                            variant="outline"
                            className="bg-white text-black border border-gray-300 hover:bg-gray-50"
                            onClick={() => handleDownloadContract(0)}
                          >
                            <FileText className="h-4 w-4 mr-1" />
                            PDF
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="bg-white p-4 rounded border max-h-96 overflow-y-auto">
                        <div className="whitespace-pre-wrap text-sm">{generatedContract}</div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 템플릿 수정 모달 */}
      <Dialog open={showEditTemplateModal} onOpenChange={setShowEditTemplateModal}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>템플릿 수정</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            {/* 기본 정보 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">템플릿 이름</label>
                <input
                  type="text"
                  className="w-full mt-1 p-2 border rounded-md"
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate({...newTemplate, name: e.target.value})}
                />
              </div>
              <div>
                <label className="text-sm font-medium">카테고리</label>
                <select
                  className="w-full mt-1 p-2 border rounded-md"
                  value={newTemplate.category}
                  onChange={(e) => setNewTemplate({...newTemplate, category: e.target.value})}
                >
                  <option value="">카테고리 선택</option>
                  <option value="입양계약서">입양계약서</option>
                  <option value="분양계약서">분양계약서</option>
                  <option value="임시보호계약서">임시보호계약서</option>
                  <option value="의료계약서">의료계약서</option>
                  <option value="훈련계약서">훈련계약서</option>
                  <option value="기타">기타</option>
                </select>
              </div>
            </div>

            {/* 섹션 관리 */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium">계약서 항목</h3>
                <div className="flex gap-2">
                  <Button 
                    onClick={addDefaultSections}
                    className="bg-blue-500 hover:bg-blue-600 text-white"
                  >
                    기본 항목 추가
                  </Button>
                  <Button 
                    onClick={addSection}
                    className="bg-green-500 hover:bg-green-600 text-white"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    항목 추가
                  </Button>
                </div>
              </div>
              
              {templateSections.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                  <p className="text-gray-500 mb-2">계약서에 필요한 항목들을 추가하세요</p>
                  <p className="text-sm text-gray-400">"기본 항목 추가" 버튼으로 자주 사용하는 항목들을 한 번에 추가할 수 있습니다</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {templateSections.map((section, index) => (
                    <div key={section.id}>
                      <Card className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2 relative">
                            <div className="cursor-move text-gray-400 hover:text-gray-600">
                              ⋮⋮
                            </div>
                            <h4 className="font-medium">항목 {index + 1}</h4>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleGetClauseNumber(section.id, section.title)}
                              className="text-xs whitespace-nowrap"
                            >
                              AI 추천
                            </Button>
                            
                            {/* 조항 번호 말풍선 */}
                            {showAISuggestion === section.id && section.aiSuggestion && (
                              <div className="absolute bottom-10px left-full z-10 w-80 bg-blue-50 border border-blue-200 rounded-lg shadow-lg p-3 ml-2 mb-2">
                                <div className="flex justify-between items-start mb-2">
                                  <span className="text-xs font-medium text-blue-800">AI 추천</span>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleCloseAISuggestion(section.id)}
                                    className="text-xs p-1 h-6 w-6"
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                                <p className="text-sm text-blue-900 mb-2">{section.aiSuggestion.replace(/^제\d+조\s*\((.+)\)$/, '$1')}</p>
                                <div className="flex gap-1 justify-end">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleRejectAISuggestion(section.id)}
                                    className="text-xs px-2"
                                  >
                                    다른 추천
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="default"
                                    onClick={() => handleApplyAISuggestion(section.id)}
                                    className="text-xs bg-blue-500 hover:bg-blue-600 text-white px-2"
                                  >
                                    적용하기
                                  </Button>
                                </div>
                                <div className="absolute top-4 -left-2 w-0 h-0 border-t-2 border-b-2 border-r-2 border-transparent border-r-blue-50"></div>
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2">
                            {index > 0 && (
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => moveSection(index, index - 1)}
                              >
                                ↑
                              </Button>
                            )}
                            {index < templateSections.length - 1 && (
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => moveSection(index, index + 1)}
                              >
                                ↓
                              </Button>
                            )}
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => removeSection(section.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        
                        <div className="space-y-3">
                          <div>
                            <label className="text-sm font-medium">항목 제목</label>
                            <input
                              type="text"
                              className="w-full mt-1 p-2 border rounded-md"
                              value={section.title}
                              onChange={(e) => updateSection(section.id, 'title', e.target.value)}
                            />
                          </div>
                        </div>
                      </Card>
                    </div>
                  ))}
                  
                  {/* 마지막 항목 아래에 추가 버튼 */}
                  {templateSections.length > 0 && (
                    <div className="flex justify-center my-2">
                      <Button 
                        onClick={addSection}
                        className="bg-green-500 hover:bg-green-600 text-white text-sm"
                        size="sm"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        항목 추가
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 버튼 */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowEditTemplateModal(false)}>
                취소
              </Button>
              <Button 
                onClick={handleUpdateTemplate}
                className="bg-blue-500 hover:bg-blue-600 text-white"
                disabled={!newTemplate.name || !newTemplate.category || templateSections.length === 0}
              >
                템플릿 수정
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 템플릿 보기 모달 */}
      <Dialog open={showTemplateViewModal} onOpenChange={setShowTemplateViewModal}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              템플릿 상세 보기
            </DialogTitle>
          </DialogHeader>
          
          {selectedTemplateForView && (
            <div className="space-y-6">
              {/* 템플릿 기본 정보 */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">템플릿 정보</h4>
                <div className="text-sm space-y-1">
                  <p><strong>이름:</strong> {selectedTemplateForView.name}</p>
                  <p><strong>카테고리:</strong> {selectedTemplateForView.category}</p>
                  <p><strong>설명:</strong> {selectedTemplateForView.description}</p>
                  <p><strong>타입:</strong> {selectedTemplateForView.isDefault ? "기본 템플릿" : "사용자 템플릿"}</p>
                </div>
              </div>

              {/* 템플릿 섹션 */}
              {selectedTemplateForView.sections && selectedTemplateForView.sections.length > 0 ? (
                <div>
                  <h4 className="font-medium mb-3">템플릿 섹션</h4>
                  <div className="space-y-3">
                    {selectedTemplateForView.sections.map((section: any, index: number) => (
                      <Card key={index}>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <span>{index + 1}. {section.title}</span>

                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          {section.aiSuggestion && (
                            <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                              <p className="text-sm font-medium text-blue-800 mb-1">AI 추천 내용</p>
                              <p className="text-sm text-blue-900">{section.aiSuggestion.replace(/^제\d+조\s*\((.+)\)$/, '$1')}</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <h4 className="font-medium mb-3">템플릿 내용</h4>
                  <div className="bg-white border rounded-lg p-4">
                    <pre className="whitespace-pre-wrap text-sm">{selectedTemplateForView.content || "내용이 없습니다."}</pre>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end">
            <Button variant="outline" onClick={() => {
              setShowTemplateViewModal(false)
              setSelectedTemplateForView(null)
            }}>
              닫기
            </Button>
          </div>
        </DialogContent>
      </Dialog>



      {/* 계약서 수정 모달 */}
      <Dialog open={showContractEditModal} onOpenChange={setShowContractEditModal}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5" />
              계약서 수정
            </DialogTitle>
          </DialogHeader>
          
          {editingContract && (
            <div className="space-y-6">
              {/* 계약서 기본 정보 */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">계약서 정보</h4>
                <div className="text-sm space-y-1">
                  <p><strong>계약서명:</strong> {editingContract.contractName || "계약서"}</p>
                  <p><strong>생성일:</strong> {editingContract.generatedAt ? formatToKST(editingContract.generatedAt) : "날짜 없음"}</p>
                  <p><strong>생성자:</strong> {editingContract.generatedBy || "관리자"}</p>
                  {editingContract.template && (
                    <p><strong>사용 템플릿:</strong> {editingContract.template.name}</p>
                  )}
                </div>
              </div>

              {/* 계약서 내용 수정 */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium">계약서 내용 수정</h4>
                </div>
                <div className="bg-white border rounded-lg p-4">
                  <textarea
                    className="w-full h-96 p-3 border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={editedContractContent}
                    onChange={(e) => setEditedContractContent(e.target.value)}
                    placeholder="계약서 내용을 수정하세요..."
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => {
              setShowContractEditModal(false)
              setEditingContract(null)
              setEditedContractContent("")
            }}>
              취소
            </Button>
            <Button 
              onClick={handleUpdateContract}
              className="bg-blue-500 hover:bg-blue-600 text-white"
              disabled={!editedContractContent.trim()}
            >
              <Edit className="h-4 w-4 mr-2" />
              계약서 수정
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 생성된 계약서 보기 모달 */}
      <Dialog open={showGeneratedContractViewModal} onOpenChange={setShowGeneratedContractViewModal}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              생성된 계약서 상세 보기
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            {selectedContractForView && (
              <div className="space-y-6">
                {/* 계약서 정보 */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-3 text-gray-800">계약서 정보</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center">
                      <span className="font-medium text-gray-700 w-20">계약서명:</span>
                      <span className="text-gray-900">{selectedContractForView.contractName || "계약서"}</span>
                    </div>
                    <div className="flex items-center">
                      <span className="font-medium text-gray-700 w-20">생성일:</span>
                      <span className="text-gray-900">{selectedContractForView.generatedAt ? formatToKST(selectedContractForView.generatedAt) : "날짜 없음"}</span>
                    </div>
                    <div className="flex items-center">
                      <span className="font-medium text-gray-700 w-20">생성자:</span>
                      <span className="text-gray-900">{selectedContractForView.generatedBy || "관리자"}</span>
                    </div>
                    {selectedContractForView.template && (
                      <div className="flex items-center">
                        <span className="font-medium text-gray-700 w-20">사용 템플릿:</span>
                        <span className="text-gray-900">{selectedContractForView.template.name}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 계약서 내용 */}
                <div className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium">계약서 내용</h4>
                    <div className="flex gap-2">
                      <Button 
                        size="sm"
                        variant="outline"
                        className="bg-white text-black border border-gray-300 hover:bg-gray-50"
                        onClick={() => handleDownloadContract(selectedContractForView.id)}
                      >
                        <FileText className="h-4 w-4 mr-1" />
                        PDF 다운로드
                      </Button>
                    </div>
                  </div>
                  <div className="bg-white p-4 rounded border max-h-96 overflow-y-auto">
                    {selectedContractForView.content ? (
                      <div className="whitespace-pre-wrap text-sm leading-relaxed">{selectedContractForView.content}</div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <p>계약서 내용을 불러올 수 없습니다.</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button variant="outline" onClick={() => {
                    setShowGeneratedContractViewModal(false)
                    setSelectedContractForView(null)
                  }}>
                    닫기
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
