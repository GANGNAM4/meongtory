// 사이드바 상태 관리 유틸리티

export const SIDEBAR_STATE_KEY = 'recentProductsSidebarState'

export interface SidebarState {
  isOpen: boolean
  productType: 'insurance' | 'store'
}

// 사이드바 상태 저장
export const saveSidebarState = (state: SidebarState) => {
  try {
    localStorage.setItem(SIDEBAR_STATE_KEY, JSON.stringify(state))
  } catch (error) {
    console.error('사이드바 상태 저장 실패:', error)
  }
}

// 사이드바 상태 불러오기
export const loadSidebarState = (): SidebarState => {
  try {
    const stored = localStorage.getItem(SIDEBAR_STATE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (error) {
    console.error('사이드바 상태 불러오기 실패:', error)
  }
  
  // 기본값
  return {
    isOpen: false,
    productType: 'store'
  }
}

// 사이드바 상태 업데이트
export const updateSidebarState = (updates: Partial<SidebarState>) => {
  const currentState = loadSidebarState()
  const newState = { ...currentState, ...updates }
  saveSidebarState(newState)
  return newState
} 