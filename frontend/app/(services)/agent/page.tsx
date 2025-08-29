"use client";

import React, { useState, useReducer, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  MessageSquare, 
  Send, 
  ArrowLeft, 
  Bot, 
  User,
  Heart,
  Shield,
  ShoppingBag,
  CheckCircle,
  Loader2
} from 'lucide-react';
import Image from 'next/image';
import { toast } from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Types
import type { 
  AgentState, 
  AgentAction, 
  AgentStage, 
  AgentResponse,
  Pet,
  InsuranceProduct,
  RecommendedProduct
} from '@/types/agent';

// Agent State Reducer
const agentReducer = (state: AgentState, action: AgentAction): AgentState => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_SESSION_ID':
      return { ...state, sessionId: action.payload };
    case 'SET_STAGE':
      return { ...state, stage: action.payload };
    case 'ADD_MESSAGE':
      return { 
        ...state, 
        messages: [...state.messages, { 
          ...action.payload, 
          timestamp: Date.now() 
        }] 
      };
    case 'SET_RECOMMENDED_PETS':
      return { ...state, recommendedPets: action.payload };
    case 'SET_SELECTED_PET':
      return { ...state, selectedPet: action.payload };
    case 'SET_RECOMMENDED_INSURANCE':
      return { ...state, recommendedInsurance: action.payload };
    case 'SET_RECOMMENDED_PRODUCTS':
      return { ...state, recommendedProducts: action.payload };
    case 'SET_PROGRESS':
      return { ...state, progress: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'RESET_SESSION':
      return {
        sessionId: null,
        stage: 'initial',
        isLoading: false,
        messages: [],
        recommendedPets: [],
        selectedPet: null,
        recommendedInsurance: [],
        recommendedProducts: [],
        progress: { percentage: 0, current_stage: 'initial', completed_stages: [] },
        error: null
      };
    default:
      return state;
  }
};

const initialState: AgentState = {
  sessionId: null,
  stage: 'initial',
  isLoading: false,
  messages: [],
  recommendedPets: [],
  selectedPet: null,
  recommendedInsurance: [],
  recommendedProducts: [],
  progress: { percentage: 0, current_stage: 'initial', completed_stages: [] },
  error: null
};

export default function AdoptionAgentPage() {
  const router = useRouter();
  const [state, dispatch] = useReducer(agentReducer, initialState);
  const [inputMessage, setInputMessage] = useState('');

  // 세션 시작
  const startSession = async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const sessionId = `session-${Date.now()}`;
      const response = await fetch(`${process.env.NEXT_PUBLIC_AI_URL}/api/adoption-agent/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId })
      });
      
      const data = await response.json();
      if (data.success) {
        dispatch({ type: 'SET_SESSION_ID', payload: sessionId });
        dispatch({ type: 'SET_STAGE', payload: data.stage });
        dispatch({ type: 'ADD_MESSAGE', payload: { 
          type: 'assistant', 
          content: data.message 
        }});
        toast.success('입양 상담을 시작합니다!');
      } else {
        throw new Error(data.error || '세션 시작 실패');
      }
    } catch (error: any) {
      toast.error(`연결 실패: ${error.message}`);
      dispatch({ type: 'SET_ERROR', payload: error.message });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  // 메시지 전송
  const sendMessage = async (message: string) => {
    if (!state.sessionId || !message.trim()) return;
    
    dispatch({ type: 'ADD_MESSAGE', payload: { type: 'user', content: message }});
    dispatch({ type: 'SET_LOADING', payload: true });
    
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_AI_URL}/api/adoption-agent/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: state.sessionId, message })
      });
      
      const data: AgentResponse = await response.json();
      if (data.success) {
        dispatch({ type: 'ADD_MESSAGE', payload: { 
          type: 'assistant', 
          content: data.response 
        }});
        dispatch({ type: 'SET_STAGE', payload: data.stage });
        dispatch({ type: 'SET_PROGRESS', payload: data.progress });
        
        // 단계별 데이터 업데이트
        if (data.data?.recommended_pets) {
          dispatch({ type: 'SET_RECOMMENDED_PETS', payload: data.data.recommended_pets });
        }
        if (data.data?.selected_pet) {
          dispatch({ type: 'SET_SELECTED_PET', payload: data.data.selected_pet });
        }
        if (data.data?.recommended_insurance) {
          dispatch({ type: 'SET_RECOMMENDED_INSURANCE', payload: data.data.recommended_insurance });
        }
        if (data.data?.recommended_products) {
          dispatch({ type: 'SET_RECOMMENDED_PRODUCTS', payload: data.data.recommended_products });
        }
      } else {
        if (data.action === 'restart_session') {
          dispatch({ type: 'RESET_SESSION' });
          toast.error('세션이 만료되었습니다. 다시 시작해주세요.');
        } else {
          throw new Error(data.error || '메시지 전송 실패');
        }
      }
    } catch (error: any) {
      toast.error(`오류: ${error.message}`);
      dispatch({ type: 'SET_ERROR', payload: error.message });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
      setInputMessage('');
    }
  };

  // 컴포넌트 마운트 시 세션 시작
  useEffect(() => {
    startSession();
  }, []);

  // 단계별 아이콘
  const getStageIcon = (stage: AgentStage) => {
    switch (stage) {
      case 'pet_search':
      case 'pet_selected':
        return <Heart className="w-5 h-5" />;
      case 'insurance':
        return <Shield className="w-5 h-5" />;
      case 'products':
        return <ShoppingBag className="w-5 h-5" />;
      case 'completed':
        return <CheckCircle className="w-5 h-5" />;
      default:
        return <MessageSquare className="w-5 h-5" />;
    }
  };

  // 단계별 제목
  const getStageTitle = (stage: AgentStage) => {
    switch (stage) {
      case 'initial':
        return '상담 시작';
      case 'pet_search':
        return '강아지 검색';
      case 'pet_selected':
        return '강아지 선택 완료';
      case 'insurance':
        return '보험 추천';
      case 'products':
        return '상품 추천';
      case 'completed':
        return '추천 완료';
      default:
        return '입양 상담';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/')}
                className="p-2"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div className="flex items-center space-x-2">
                {getStageIcon(state.stage)}
                <h1 className="text-xl font-bold text-gray-900">
                  {getStageTitle(state.stage)}
                </h1>
              </div>
            </div>
            {state.sessionId && (
              <Badge variant="outline" className="text-xs">
                진행률: {state.progress.percentage}%
              </Badge>
            )}
          </div>
          
          {/* 진행률 바 */}
          {state.sessionId && (
            <div className="mt-4">
              <Progress value={state.progress.percentage} className="h-2" />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>시작</span>
                <span>강아지 선택</span>
                <span>보험 추천</span>
                <span>상품 추천</span>
                <span>완료</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* 채팅 영역 */}
          <div className="lg:col-span-2">
            <Card className="h-[600px] flex flex-col">
              <CardHeader className="flex-shrink-0 border-b">
                <CardTitle className="flex items-center space-x-2">
                  <Bot className="w-5 h-5 text-blue-600" />
                  <span>멍토리 입양 상담사</span>
                </CardTitle>
              </CardHeader>
              
              {/* 메시지 목록 */}
              <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
                {state.messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`flex max-w-[80%] ${message.type === 'user' ? 'flex-row-reverse' : 'flex-row'} space-x-2`}>
                      <div className="flex-shrink-0">
                        {message.type === 'user' ? (
                          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                            <User className="w-4 h-4 text-white" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                            <Bot className="w-4 h-4 text-gray-600" />
                          </div>
                        )}
                      </div>
                      <div
                        className={`px-4 py-2 rounded-lg ${
                          message.type === 'user'
                            ? 'bg-blue-500 text-white'
                            : 'bg-white border border-gray-200'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      </div>
                    </div>
                  </div>
                ))}
                
                {state.isLoading && (
                  <div className="flex justify-start">
                    <div className="flex space-x-2">
                      <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                        <Bot className="w-4 h-4 text-gray-600" />
                      </div>
                      <div className="px-4 py-2 bg-white border border-gray-200 rounded-lg">
                        <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
              
              {/* 입력 영역 */}
              <div className="flex-shrink-0 border-t p-4">
                <div className="flex space-x-2">
                  <Input
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage(inputMessage)}
                    placeholder="메시지를 입력하세요..."
                    disabled={!state.sessionId || state.isLoading}
                    className="flex-1"
                  />
                  <Button
                    onClick={() => sendMessage(inputMessage)}
                    disabled={!state.sessionId || state.isLoading || !inputMessage.trim()}
                    size="sm"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          </div>

          {/* 사이드바 - 진행 정보 */}
          <div className="space-y-4">
            {/* 현재 단계 정보 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">현재 단계</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    {getStageIcon(state.stage)}
                    <span className="font-medium">{getStageTitle(state.stage)}</span>
                  </div>
                  <div className="text-sm text-gray-600">
                    {state.stage === 'initial' && '원하는 강아지 특성을 알려주세요'}
                    {state.stage === 'pet_search' && '추천 강아지를 확인하세요'}
                    {state.stage === 'pet_selected' && '보험 추천을 준비하고 있습니다'}
                    {state.stage === 'insurance' && '적합한 보험을 추천드립니다'}
                    {state.stage === 'products' && '필요한 용품을 추천드립니다'}
                    {state.stage === 'completed' && '모든 추천이 완료되었습니다'}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 추천 강아지 */}
            {state.recommendedPets.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">추천 강아지</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {state.recommendedPets.slice(0, 3).map((pet, index) => (
                    <div key={pet.petId} className="p-2 border rounded-lg">
                      <div className="flex items-center space-x-2">
                        {pet.imageUrl ? (
                          <div className="w-12 h-12 relative rounded-full overflow-hidden">
                            <Image
                              src={pet.imageUrl}
                              alt={pet.name}
                              fill
                              className="object-cover"
                              sizes="48px"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          </div>
                        ) : (
                          <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                            <span className="text-sm font-medium">{index + 1}</span>
                          </div>
                        )}
                        <div className="flex-1">
                          <p className="font-medium text-sm">{pet.name}</p>
                          <p className="text-xs text-gray-500">{pet.breed} • {pet.age}살</p>
                          {pet.match_score && (
                            <p className="text-xs text-blue-500">매칭도: {pet.match_score}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* 선택된 강아지 */}
            {state.selectedPet && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">선택한 강아지</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                      {state.selectedPet.imageUrl ? (
                        <div className="w-16 h-16 relative rounded-full overflow-hidden">
                          <Image
                            src={state.selectedPet.imageUrl}
                            alt={state.selectedPet.name}
                            fill
                            className="object-cover"
                            sizes="64px"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        </div>
                      ) : (
                        <Heart className="w-8 h-8 text-red-500" />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center space-x-1">
                          <Heart className="w-4 h-4 text-red-500" />
                          <span className="font-medium">{state.selectedPet.name}</span>
                        </div>
                        <p className="text-sm text-gray-600">
                          {state.selectedPet.breed} • {state.selectedPet.age}살
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 추천 상품 */}
            {state.recommendedProducts.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">추천 상품</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {state.recommendedProducts.slice(0, 3).map((product, index) => (
                    <div key={product.productId} className="p-2 border rounded-lg">
                      <div className="flex items-center space-x-2">
                        {product.imageUrl ? (
                          <div className="w-12 h-12 relative rounded overflow-hidden">
                            <Image
                              src={product.imageUrl}
                              alt={product.name}
                              fill
                              className="object-cover"
                              sizes="48px"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          </div>
                        ) : (
                          <div className="w-12 h-12 bg-green-100 rounded flex items-center justify-center">
                            <ShoppingBag className="w-6 h-6 text-green-600" />
                          </div>
                        )}
                        <div className="flex-1">
                          <p className="font-medium text-sm">{product.name}</p>
                          <p className="text-xs text-gray-500">{product.category}</p>
                          {product.price && (
                            <p className="text-xs text-orange-600">
                              {product.price.toLocaleString()}원
                            </p>
                          )}
                          {product.recommendation_score && (
                            <p className="text-xs text-blue-500">
                              추천도: {product.recommendation_score}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* 에러 표시 */}
            {state.error && (
              <Card className="border-red-200">
                <CardContent className="pt-4">
                  <div className="text-red-600 text-sm">
                    <p>⚠️ {state.error}</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-2"
                      onClick={startSession}
                    >
                      다시 시도
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}