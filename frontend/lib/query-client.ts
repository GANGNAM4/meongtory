import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5분 - 데이터가 5분간 fresh 상태 유지
      gcTime: 10 * 60 * 1000, // 10분 - 캐시에서 10분 후 제거
      retry: 1,
      refetchOnWindowFocus: false, // 윈도우 포커스시 자동 재요청 비활성화
      refetchOnMount: false, // 컴포넌트 마운트시 자동 재요청 비활성화
    },
  },
})
