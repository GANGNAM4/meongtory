"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { X, Send, Shield, MessageCircle } from "lucide-react"
import axios from "axios"
import { getBackendUrl } from "@/lib/api";

interface ChatMessage {
  id: number
  message: string
  isUser: boolean
  timestamp: Date
}

interface MyPetSuggestion {
  myPetId: number
  name: string
  breed: string
  type: string
  imageUrl?: string
}

interface InsuranceChatbotProps {
  initialQuery?: string
  onClose?: () => void
}

export default function InsuranceChatbot({ initialQuery, onClose }: InsuranceChatbotProps) {
  const [isOpen, setIsOpen] = useState(!!initialQuery)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 1,
      message: "안녕하세요! 🛡️ 멍토리 펫보험 전문가입니다. 보험 관련 궁금한 점이 있으시면 언제든 물어보세요!",
      isUser: false,
      timestamp: new Date(),
    },
  ])
  const [inputMessage, setInputMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [petSuggestions, setPetSuggestions] = useState<MyPetSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [cursorPosition, setCursorPosition] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // 메시지 추가 시 스크롤을 맨 아래로 이동
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // 초기 쿼리가 있으면 자동으로 전송
  useEffect(() => {
    if (initialQuery && isOpen) {
      sendMessage(initialQuery)
    }
  }, [initialQuery, isOpen])

  // @태그 감지 및 MyPet 자동완성
  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    const position = e.target.selectionStart || 0
    
    setInputMessage(value)
    setCursorPosition(position)

    // @ 태그 검출
    const beforeCursor = value.substring(0, position)
    const match = beforeCursor.match(/@([ㄱ-ㅎ가-힣a-zA-Z0-9_]*)$/)
    
    if (match) {
      const keyword = match[1]
      if (keyword.length >= 0) {
        try {
          const token = localStorage.getItem('accessToken')
          if (token) {
            const response = await axios.get(
              `${getBackendUrl()}/api/mypet/search?keyword=${keyword}`,
              { headers: { 
                Authorization: `Bearer ${token}`,
                'Access_Token': token
              } }
            )
            if (response.data.success) {
              setPetSuggestions(response.data.data || [])
              setShowSuggestions(true)
            }
          }
        } catch (error) {
          console.error('MyPet 검색 실패:', error)
          setPetSuggestions([])
        }
      }
    } else {
      setShowSuggestions(false)
      setPetSuggestions([])
    }
  }

  // MyPet 선택 처리
  const selectPet = (pet: MyPetSuggestion) => {
    const beforeCursor = inputMessage.substring(0, cursorPosition)
    const afterCursor = inputMessage.substring(cursorPosition)
    
    const beforeAt = beforeCursor.substring(0, beforeCursor.lastIndexOf('@'))
    const newMessage = beforeAt + `@${pet.name} ` + afterCursor
    
    setInputMessage(newMessage)
    setShowSuggestions(false)
    setPetSuggestions([])
    
    setTimeout(() => {
      inputRef.current?.focus()
    }, 100)
  }

  // 보험 관련 추천 질문들
  const suggestedQuestions = [
    "펫보험 가입 조건이 궁금해요",
    "어떤 보험사가 좋을까요?",
    "보장 내역을 알려주세요",
    "보험료는 얼마나 나올까요?",
    "가입 방법을 알려주세요"
  ]

  const sendMessage = async (message?: string) => {
    const textToSend = message || inputMessage.trim()
    if (!textToSend) return

    // @MyPet 태그 추출
    const petMatches = textToSend.match(/@([ㄱ-ㅎ가-힣a-zA-Z0-9_]+)/g)
    let processedMessage = textToSend
    let selectedPetId = null

    // @태그가 있으면 petId를 찾아서 처리
    if (petMatches && petMatches.length > 0) {
      const petName = petMatches[0].substring(1) // @ 제거
      const matchedPet = petSuggestions.find(pet => pet.name === petName)
      if (matchedPet) {
        selectedPetId = matchedPet.myPetId
        processedMessage = textToSend.replace(/@[ㄱ-ㅎ가-힣a-zA-Z0-9_]+/g, `@${petName}`)
      }
    }

    // 사용자 메시지 즉시 추가
    const userMessage: ChatMessage = {
      id: Date.now(),
      message: processedMessage,
      isUser: true,
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, userMessage])
    setInputMessage("") // 입력창 즉시 비우기
    setShowSuggestions(false) // 자동완성 숨기기
    setIsLoading(true)

    // 비동기적으로 챗봇 응답 처리
    try {
      // @MyPet이 있으면 petId도 함께 전송
      const requestData = selectedPetId 
        ? { query: processedMessage, petId: selectedPetId }
        : { query: processedMessage }
        
      const response = await axios.post(`${getBackendUrl()}/api/chatbot/insurance`,
        requestData,
        { headers: { "Content-Type": "application/json" } }
      )
      const botResponse: ChatMessage = {
        id: Date.now() + 1,
        message: response.data.answer || "응답이 비어 있습니다. 서버를 확인해주세요.",
        isUser: false,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, botResponse])
    } catch (error: any) {
      console.error("보험 챗봇 요청 실패:", error.message, error.response?.data)
      const errorMessage: ChatMessage = {
        id: Date.now() + 1,
        message: `죄송합니다. 서버 오류가 발생했습니다: ${error.message}`,
        isUser: false,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  // 링크와 MyPet 태그를 처리하는 함수
  const formatMessageWithLinks = (message: string) => {
    // 긴 텍스트를 적절히 줄바꿈
    const formatLongText = (text: string) => {
      // 문장 단위로 줄바꿈 (마침표, 느낌표, 물음표 기준)
      const sentences = text.split(/(?<=[.!?])\s+/);
      return sentences.map((sentence, index) => (
        <span key={index}>
          {renderMessageWithPetTags(sentence)}
          {index < sentences.length - 1 && <br />}
        </span>
      ));
    };

    // URL 패턴을 찾아서 클릭 가능한 링크로 변환
    const urlPattern = /(https?:\/\/[^\s]+)/g;
    const parts = message.split(urlPattern);
    
    if (parts.length === 1) {
      // URL이 없으면 일반 텍스트 반환 (줄바꿈 적용)
      return <div className="whitespace-pre-wrap break-words">{formatLongText(message)}</div>;
    }
    
    return (
      <div className="space-y-2">
        {parts.map((part, index) => {
          if (urlPattern.test(part)) {
            // URL 부분 - 하이퍼링크와 바로가기 버튼 모두 제공
            return (
              <div key={index} className="space-y-1">
                <a 
                  href={part} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 underline break-all"
                >
                  {part}
                </a>
                <button
                  onClick={() => window.open(part, '_blank')}
                  className="inline-flex items-center space-x-1 bg-blue-500 hover:bg-blue-600 text-white text-xs px-3 py-1 rounded-lg transition-colors"
                >
                  <span>🔗</span>
                  <span>바로가기</span>
                </button>
              </div>
            );
          } else {
            // 일반 텍스트 부분 (줄바꿈 적용)
            return <div key={index} className="whitespace-pre-wrap break-words">{formatLongText(part)}</div>;
          }
        })}
      </div>
    );
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isLoading) {
      sendMessage()
    }
  }

  // MyPet 태그를 파란색으로 렌더링하는 함수
  const renderMessageWithPetTags = (message: string) => {
    const parts = message.split(/(@[ㄱ-ㅎ가-힣a-zA-Z0-9_]+)/g)
    return parts.map((part, index) => {
      if (part.startsWith('@')) {
        return <span key={index} className="text-blue-600 font-medium">{part}</span>
      }
      return part
    })
  }

  const handleSuggestedQuestion = (question: string) => {
    sendMessage(question)
  }

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-110 z-50"
          title="펫보험 전문가와 상담하기"
        >
          <Shield className="w-6 h-6 text-white" />
        </button>
      )}

      {isOpen && (
        <div className="fixed bottom-6 right-6 w-80 h-96 bg-white rounded-lg shadow-2xl border border-gray-200 flex flex-col z-50">
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-4 rounded-t-lg flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Shield className="w-5 h-5" />
              <div>
                <h3 className="font-bold text-sm">펫보험 전문가</h3>
                <p className="text-xs opacity-90">온라인 상담</p>
              </div>
            </div>
            <button onClick={() => {
              setIsOpen(false)
              onClose?.()
            }} className="hover:bg-white/20 p-1 rounded transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.isUser ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-xs px-3 py-2 rounded-lg text-sm ${
                    message.isUser 
                      ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white" 
                      : "bg-gray-100 text-gray-800 border border-gray-200"
                  }`}
                  style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}
                >
                  {formatMessageWithLinks(message.message)}
                </div>
              </div>
            ))}
            
            {/* 로딩 인디케이터 */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 text-gray-800 border border-gray-200 px-3 py-2 rounded-lg text-sm">
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                    <span>답변을 준비하고 있습니다...</span>
                  </div>
                </div>
              </div>
            )}

            {/* 추천 질문들 (첫 메시지 이후에만 표시하고 초기 쿼리가 없을 때만) */}
            {messages.length === 1 && !isLoading && !initialQuery && (
              <div className="space-y-2">
                <p className="text-xs text-gray-500 text-center">💡 이런 질문들을 해보세요:</p>
                <div className="grid grid-cols-1 gap-2">
                  {suggestedQuestions.map((question, index) => (
                    <button
                      key={index}
                      onClick={() => handleSuggestedQuestion(question)}
                      className="text-left text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-2 rounded-lg transition-colors border border-blue-200"
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 border-t border-gray-200">
            <div className="relative">
              {/* MyPet 자동완성 드롭다운 */}
              {showSuggestions && petSuggestions.length > 0 && (
                <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-32 overflow-y-auto z-10">
                  {petSuggestions.map((pet) => (
                    <div
                      key={pet.myPetId}
                      onClick={() => selectPet(pet)}
                      className="flex items-center p-2 hover:bg-gray-100 cursor-pointer"
                    >
                      {pet.imageUrl && (
                        <img 
                          src={pet.imageUrl} 
                          alt={pet.name}
                          className="w-6 h-6 rounded-full mr-2 object-cover"
                        />
                      )}
                      <div className="flex-1">
                        <div className="text-sm font-medium">@{pet.name}</div>
                        <div className="text-xs text-gray-500">{pet.breed} • {pet.type}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              <div className="flex space-x-2">
                <div className="flex-1 relative">
                  <Input
                    ref={inputRef}
                    value={inputMessage}
                    onChange={handleInputChange}
                    onKeyPress={handleKeyPress}
                    placeholder="질문을 입력하세요..."
                    className="flex-1 text-sm"
                    disabled={isLoading}
                    style={{
                      color: 'transparent',
                      caretColor: 'black'
                    }}
                  />
                  {/* 하이라이트 오버레이 */}
                  <div 
                    className="absolute top-0 left-0 right-0 bottom-0 pointer-events-none flex items-center px-3 py-2 text-sm"
                    style={{
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word'
                    }}
                  >
                    {inputMessage.split(/(@[ㄱ-ㅎ가-힣a-zA-Z0-9_]+)/g).map((part, index) => {
                      if (part.startsWith('@') && part.length > 1) {
                        return <span key={index} className="text-blue-600 font-medium">{part}</span>;
                      }
                      return <span key={index} className="text-black">{part}</span>;
                    })}
                  </div>
                </div>
                <Button 
                  onClick={() => sendMessage()} 
                  size="sm" 
                  className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-3"
                  disabled={isLoading || !inputMessage.trim()}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
} 