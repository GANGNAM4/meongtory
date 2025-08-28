"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { 
  ArrowLeft, 
  Brain, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle, 
  XCircle, 
  RefreshCw,
  Activity,
  Database,
  Target,
  Zap
} from "lucide-react"
import axios from "axios"
import { getBackendUrl } from "@/lib/api"
import { toast } from "sonner"

interface EmotionFeedbackStats {
  unusedPositiveFeedback: number
  unusedNegativeFeedback: number
  shouldRetrain: boolean
  totalFeedback: number
  correctPredictions: number
  incorrectPredictions: number
  overallAccuracy: number
}

export default function FeedbackDashboard() {
  const router = useRouter()
  const [stats, setStats] = useState<EmotionFeedbackStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRetraining, setIsRetraining] = useState(false)
  const [lastRetrained, setLastRetrained] = useState<string | null>(null)
  const [retrainStatus, setRetrainStatus] = useState<string | null>(null)
  const [isCheckingStatus, setIsCheckingStatus] = useState(false)

  // 피드백 통계 조회
  const fetchStats = async () => {
    try {
      setIsLoading(true)
      const response = await axios.get(`${getBackendUrl()}/api/emotion/feedback/stats`)
      
      if (response.data.success) {
        setStats(response.data.data)
      } else {
        throw new Error(response.data.error?.message || '통계 조회 실패')
      }
    } catch (error) {
      console.error('피드백 통계 조회 오류:', error)
      toast.error('피드백 통계를 불러오는데 실패했습니다')
    } finally {
      setIsLoading(false)
    }
  }

  // 재학습 시작
  const handleRetrain = async () => {
    if (!stats || !stats.shouldRetrain) {
      toast.error('재학습할 데이터가 부족합니다 (최소 10개 필요)')
      return
    }

    try {
      setIsRetraining(true)
      
      // 백엔드를 통해 AI 서비스에 재학습 요청
      toast.info('AI 서비스에 재학습 요청을 보내는 중...')
      
      const retrainResponse = await axios.post(`${getBackendUrl()}/api/emotion/retrain`)
      
      if (retrainResponse.data.success) {
        toast.success('AI 모델 재학습이 완료되었습니다!')
        setLastRetrained(new Date().toLocaleString('ko-KR'))
        fetchStats() // 통계 새로고침
      } else {
        throw new Error(retrainResponse.data.error?.message || '재학습 요청 실패')
      }
      
    } catch (error) {
      console.error('재학습 오류:', error)
      if (axios.isAxiosError(error) && error.response?.data?.error) {
        toast.error(`재학습 실패: ${error.response.data.error.message}`)
      } else {
        toast.error('재학습 중 오류가 발생했습니다')
      }
    } finally {
      setIsRetraining(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">통계를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => router.push('/admin')}
              className="h-10 w-10"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">AI 감정 분석 피드백 관리</h1>
              <p className="text-gray-600 mt-1">사용자 피드백을 통한 AI 모델 성능 모니터링 및 재학습</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              onClick={fetchStats}
              variant="outline"
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              새로고침
            </Button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* 전체 피드백 수 */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">전체 피드백</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalFeedback || 0}</div>
              <p className="text-xs text-muted-foreground">누적 사용자 피드백</p>
            </CardContent>
          </Card>

          {/* 정확도 */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">전체 정확도</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.overallAccuracy || 0}%</div>
              <Progress 
                value={stats?.overallAccuracy || 0} 
                className="mt-2" 
              />
              <p className="text-xs text-muted-foreground mt-1">
                정확: {stats?.correctPredictions || 0} / 부정확: {stats?.incorrectPredictions || 0}
              </p>
            </CardContent>
          </Card>

          {/* 재학습 대기 데이터 */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">재학습 대기</CardTitle>
              <Brain className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(stats?.unusedPositiveFeedback || 0) + (stats?.unusedNegativeFeedback || 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                긍정: {stats?.unusedPositiveFeedback || 0} / 부정: {stats?.unusedNegativeFeedback || 0}
              </p>
            </CardContent>
          </Card>

          {/* 재학습 상태 */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">재학습 필요</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                {stats?.shouldRetrain ? (
                  <Badge variant="destructive" className="flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    필요
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    불필요
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats?.shouldRetrain ? '데이터 10개 이상 축적' : '데이터 부족 (10개 미만)'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* 재학습 섹션 */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              AI 모델 재학습
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <h3 className="font-semibold">재학습 상태</h3>
                  <p className="text-sm text-gray-600">
                    {stats?.shouldRetrain 
                      ? `재학습 가능한 데이터가 ${(stats.unusedPositiveFeedback + stats.unusedNegativeFeedback)}개 준비되었습니다.`
                      : '재학습하기에는 데이터가 부족합니다. (최소 10개 필요)'
                    }
                  </p>
                  {lastRetrained && (
                    <p className="text-sm text-green-600">
                      마지막 재학습: {lastRetrained}
                    </p>
                  )}
                  {retrainStatus && (
                    <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm font-medium text-blue-800">AI 모델 상태</p>
                      <p className="text-sm text-blue-700 mt-1">{retrainStatus}</p>
                    </div>
                  )}
                </div>
                <Button
                  onClick={handleRetrain}
                  disabled={!stats?.shouldRetrain || isRetraining}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
                >
                  {isRetraining ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <Brain className="h-4 w-4" />
                  )}
                  {isRetraining ? '재학습 중...' : '모델 재학습 시작'}
                </Button>
              </div>

              {stats?.shouldRetrain && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-yellow-800">재학습 안내</p>
                      <p className="text-sm text-yellow-700">
                        재학습을 시작하면 현재 축적된 피드백 데이터를 사용하여 AI 모델을 개선합니다. 
                        재학습이 완료되면 해당 데이터는 '사용됨'으로 표시되어 다음 재학습에서 제외됩니다.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 상세 통계 */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* 정확도 차트 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                예측 정확도 분석
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">정확한 예측</span>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="font-semibold">{stats?.correctPredictions || 0}개</span>
                  </div>
                </div>
                <Progress 
                  value={stats?.totalFeedback ? (stats.correctPredictions / stats.totalFeedback) * 100 : 0}
                  className="h-2"
                />
                
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">부정확한 예측</span>
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-500" />
                    <span className="font-semibold">{stats?.incorrectPredictions || 0}개</span>
                  </div>
                </div>
                <Progress 
                  value={stats?.totalFeedback ? (stats.incorrectPredictions / stats.totalFeedback) * 100 : 0}
                  className="h-2"
                />
              </div>
            </CardContent>
          </Card>

          {/* 학습 데이터 현황 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                학습 데이터 현황
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">미사용 긍정 피드백</span>
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    {stats?.unusedPositiveFeedback || 0}개
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">미사용 부정 피드백</span>
                  <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                    {stats?.unusedNegativeFeedback || 0}개
                  </Badge>
                </div>
                
                <div className="pt-2 border-t">
                  <div className="flex items-center justify-between font-semibold">
                    <span className="text-sm">재학습 가능 데이터</span>
                    <Badge variant={stats?.shouldRetrain ? "destructive" : "secondary"}>
                      {(stats?.unusedPositiveFeedback || 0) + (stats?.unusedNegativeFeedback || 0)}개
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    재학습에는 최소 10개의 피드백이 필요합니다
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}