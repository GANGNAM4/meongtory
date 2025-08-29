// 입양 Agent 관련 타입 정의

import { Pet } from './pets'

// Agent 진행 단계
export type AgentStage = 
  | 'initial'       // 초기 상태
  | 'pet_search'    // 강아지 검색 중
  | 'pet_selected'  // 강아지 선택 완료  
  | 'insurance'     // 보험 추천 중
  | 'products'      // 상품 추천 중
  | 'completed'     // 모든 단계 완료

// 단계별 정보
export interface StageInfo {
  title: string
  description: string
  next: string
}

// 진행률 정보
export interface ProgressInfo {
  percentage: number
  current_stage: string
  completed_stages: string[]
}

// 보험 상품 타입
export interface InsuranceProduct {
  insuranceId: number
  name: string
  company: string
  monthlyPremium: number
  coverageAmount: number
  description: string
  coverageItems: string[]
  ageLimit?: number
  breedRestrictions?: string[]
  waitingPeriod?: number
  deductible?: number
}

// 상품 추천 아이템
export interface RecommendedProduct {
  productId: string
  name: string
  description: string
  price: number
  imageUrl: string
  category: string
  source: 'INTERNAL' | 'NAVER'
  externalProductUrl?: string
  externalMallName?: string
  recommendation_score: number
  recommendation_reasons: string[]
}

// Agent 응답 기본 구조
export interface AgentResponse {
  success: boolean
  session_id: string
  stage: AgentStage
  response: string  // AI 응답 텍스트
  stage_info: StageInfo
  progress: ProgressInfo
  data?: {
    recommended_pets?: Pet[]
    selected_pet?: Pet
    recommended_insurance?: InsuranceProduct[]
    recommended_products?: RecommendedProduct[]
  }
  error?: string
  action?: 'restart_session'  // 세션 재시작 필요 시
}

// 세션 시작 응답
export interface StartSessionResponse {
  success: boolean
  session_id: string
  thread_id: string
  stage: AgentStage
  message: string
  next_step: string
  error?: string
}

// 메시지 전송 요청
export interface SendMessageRequest {
  message: string
}

// 세션 정보 조회 응답
export interface SessionInfoResponse {
  success: boolean
  session: {
    session_id: string
    thread_id: string
    stage: AgentStage
    selected_pet?: Pet
    recommended_insurance: InsuranceProduct[]
    recommended_products: RecommendedProduct[]
    created_at: number
    last_activity: number
  }
  stage_info: StageInfo
  progress: ProgressInfo
  error?: string
}

// 세션 종료 응답
export interface EndSessionResponse {
  success: boolean
  message: string
  summary: {
    duration: number
    final_stage: AgentStage
    conversation_count: number
  }
  error?: string
}

// Agent API 클라이언트용 인터페이스
export interface AgentApiClient {
  startSession: (sessionId: string) => Promise<StartSessionResponse>
  sendMessage: (sessionId: string, message: string) => Promise<AgentResponse>
  getSessionInfo: (sessionId: string) => Promise<SessionInfoResponse>
  endSession: (sessionId: string) => Promise<EndSessionResponse>
}

// UI 컴포넌트에서 사용할 Agent 상태
export interface AgentState {
  sessionId: string | null
  stage: AgentStage
  isLoading: boolean
  messages: Array<{
    type: 'user' | 'assistant'
    content: string
    timestamp: number
  }>
  recommendedPets: Pet[]
  selectedPet: Pet | null
  recommendedInsurance: InsuranceProduct[]
  recommendedProducts: RecommendedProduct[]
  progress: ProgressInfo
  error: string | null
}

// Agent 액션 타입 (useReducer용)
export type AgentAction = 
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_SESSION_ID'; payload: string }
  | { type: 'SET_STAGE'; payload: AgentStage }
  | { type: 'ADD_MESSAGE'; payload: { type: 'user' | 'assistant'; content: string } }
  | { type: 'SET_RECOMMENDED_PETS'; payload: Pet[] }
  | { type: 'SET_SELECTED_PET'; payload: Pet }
  | { type: 'SET_RECOMMENDED_INSURANCE'; payload: InsuranceProduct[] }
  | { type: 'SET_RECOMMENDED_PRODUCTS'; payload: RecommendedProduct[] }
  | { type: 'SET_PROGRESS'; payload: ProgressInfo }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'RESET_SESSION' }