// 관리자 관련 타입들
// 기존 타입들을 import하여 사용
import type { Product } from './store'
import type { Pet } from './pets'
import type { Order, OrderItem } from './store'

export interface User {
  id: number  // account_id
  name: string
  email: string
  password?: string
  role: string
  provider?: string
  providerId?: string
  createdAt?: string
  updatedAt?: string
}

// 관리자 페이지에서 사용하는 Product 확장 타입
export interface AdminProduct extends Product {
  tags: string[]
  isNaverProduct?: boolean // 네이버 상품 여부
  mallName?: string // 네이버 상품의 경우 판매자 정보
  productUrl?: string // 네이버 상품의 경우 상품 링크
  // Product에서 이미 있는 필드들: id, name, description, price, stock, imageUrl, category, registrationDate, registeredBy 등
}

// 관리자 페이지에서 사용하는 Order 확장 타입
export interface AdminOrder extends Order {
  orderId: number
  paymentStatus: "PENDING" | "COMPLETED" | "CANCELLED"
  orderedAt: string
  // Order에서 이미 있는 필드들: id, userId, orderDate, status, totalAmount, items 등
}

export interface CommunityPost {
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

export interface Comment {
  id: number
  postId: number
  postTitle: string
  author: string
  content: string
  date: string
  isReported: boolean
}

// 입양 신청 관련 타입 (통합)
export interface AdoptionRequest {
  id: number
  petId: number
  petName: string
  petBreed: string
  petAge?: string
  petGender?: 'MALE' | 'FEMALE' | 'UNKNOWN'
  petWeight?: number
  petVaccinated?: boolean
  petNeutered?: boolean
  petMedicalHistory?: string
  petVaccinations?: string
  petNotes?: string
  petSpecialNeeds?: string
  petDescription?: string
  petLocation?: string
  petMicrochipId?: string
  petPersonality?: string
  petRescueStory?: string
  petAiBackgroundStory?: string
  petStatus?: string
  petType?: string
  petAdopted?: boolean
  petImageUrl?: string
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

// 기존 AdoptionInquiry와의 호환성을 위한 타입 별칭
export type AdoptionInquiry = AdoptionRequest

export interface ContractTemplate {
  id: number
  name: string
  category: string
  description?: string
  content?: string
  sections?: ContractSection[]
  isDefault: boolean
  createdAt?: string
  updatedAt?: string
}

export interface ContractSection {
  id: string
  title: string
  order: number
  content: string
  aiSuggestion?: string
  options?: any
}

export interface GeneratedContract {
  id: number
  contractName?: string
  content: string
  templateId: number
  templateSections: ContractSection[]
  customSections: ContractSection[]
  removedSections: string[]
  petInfo: {
    name: string
    breed: string
    age: string
    healthStatus: string
  }
  userInfo: {
    name: string
    phone: string
    email: string
  }
  additionalInfo?: string
  shelterInfo?: {
    name: string
    representative: string
    address: string
    phone: string
  }
  generatedAt?: string
  generatedBy?: string
  template?: ContractTemplate
}

export interface TemplateSection {
  id: string
  title: string
  aiSuggestion: string
}

export interface NewTemplate {
  name: string
  category: string
  content: string
  isDefault: boolean
}

export interface ContractGenerationRequest {
  templateId: number
  petId: number
  userId: number
  customFields: {
    [key: string]: string
  }
}

export interface ContractGenerationResponse {
  contractId: number
  content: string
  downloadUrl: string
}

export interface AISuggestion {
  id: number
  sectionId: number
  suggestion: string
  createdAt: string
}

// 관리자 페이지 Props
export interface AdminPageProps {
  isAdmin: boolean
  onClose: () => void
  onNavigateToStoreRegistration: () => void
  onNavigateToAnimalRegistration: () => void
  onNavigateToCommunity: () => void
  onUpdatePet: (pet: Pet) => void
  onAdminLogout: () => void
}

// 탭별 Props 인터페이스들
export interface DashboardTabProps {
  products: AdminProduct[]
  pets: Pet[]
  adoptionRequests: AdoptionRequest[]
  onNavigateToStoreRegistration: () => void
  onNavigateToAnimalRegistration: () => void
  onNavigateToCommunity: () => void
}

export interface ProductsTabProps {
  onNavigateToStoreRegistration: () => void
  onEditProduct: (product: AdminProduct) => void
}

export interface PetsTabProps {
  onNavigateToAnimalRegistration: () => void
  onUpdatePet: (pet: Pet) => void
  onViewContract: (pet: Pet) => void
}

export interface AdoptionRequestsTabProps {
  onShowContractModal?: (request: AdoptionRequest) => void
}

export interface OrdersTabProps {
  onViewOrderDetails?: (order: AdminOrder) => void
}

export interface ContractsTabProps {
  onCreateTemplate?: () => void
  onEditTemplate?: (template: ContractTemplate) => void
  onViewTemplate?: (template: ContractTemplate) => void
  onViewGeneratedContract?: (contract: GeneratedContract) => void
  onEditContract?: (contract: GeneratedContract) => void
} 