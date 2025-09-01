"use client";

import React, { useState, useReducer, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { 
  MessageSquare, 
  Send, 
  ArrowLeft, 
  Bot, 
  User,
  Loader2
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Types
import type { 
  AgentState, 
  AgentAction, 
  AgentResponse
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
        
        // 단계 업데이트
        if (data.stage) {
          console.log('Initial stage from API:', data.stage);
          dispatch({ type: 'SET_STAGE', payload: data.stage });
        }
        
        // 진행률 업데이트
        if (data.progress) {
          console.log('Initial progress from API:', data.progress);
          dispatch({ type: 'SET_PROGRESS', payload: data.progress });
        }
        
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
      console.log('Full API Response:', data); // 전체 응답 로그
      
      if (data.success) {
        dispatch({ type: 'ADD_MESSAGE', payload: { 
          type: 'assistant', 
          content: data.response 
        }});
        
        // 단계 업데이트
        if (data.stage) {
          console.log('Updating stage from API:', data.stage);
          dispatch({ type: 'SET_STAGE', payload: data.stage });
        }
        
        // 진행률 업데이트
        if (data.progress) {
          console.log('Updating progress from API:', data.progress);
          dispatch({ type: 'SET_PROGRESS', payload: data.progress });
        }
        
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
                <Bot className="w-6 h-6 text-blue-600" />
                <h1 className="text-xl font-bold text-gray-900">
                  멍토리 입양 상담
                </h1>
              </div>
            </div>
          </div>
          
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="flex justify-center">
          <div className="w-full max-w-4xl">
            <Card className="h-[700px] flex flex-col">
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
        </div>
      </div>
    </div>
  );
}