"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { X, Send } from "lucide-react"
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

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [userName, setUserName] = useState<string>("")
  const [inputMessage, setInputMessage] = useState("")
  const [petSuggestions, setPetSuggestions] = useState<MyPetSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [cursorPosition, setCursorPosition] = useState(0)
  const [selectedPetId, setSelectedPetId] = useState<number | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // 사용자의 계정 정보를 가져오는 함수
  const fetchUserInfo = async () => {
    try {
      const token = localStorage.getItem('accessToken')
      if (token) {
        // 백엔드 API에서 사용자 정보 가져오기
        const response = await axios.get(`${getBackendUrl()}/api/accounts/me`, { 
          headers: { 
            Authorization: `Bearer ${token}`,
            'Access_Token': token
          } 
        })
        
        if (response.data.success) {
          const userInfo = response.data.data
          const userName = userInfo.name || "사용자"
          setUserName(userName)
          
          // 사용자 이름을 포함한 인사 메시지 (@ 태그 없이)
          setMessages([
            {
              id: 1,
              message: `안녕하세요! 멍토리 도우미입니다 🐕\n${userName}님, 무엇을 도와드릴까요?`,
              isUser: false,
              timestamp: new Date(),
            },
          ])
        } else {
          // API 호출 실패 시 기본 인사 메시지
          setMessages([
            {
              id: 1,
              message: "안녕하세요! 멍토리 도우미입니다 🐕 무엇을 도와드릴까요?",
              isUser: false,
              timestamp: new Date(),
            },
          ])
        }
      } else {
        // 토큰이 없으면 기본 인사 메시지
        setMessages([
          {
            id: 1,
            message: "안녕하세요! 멍토리 도우미입니다 🐕 무엇을 도와드릴까요?",
            isUser: false,
            timestamp: new Date(),
          },
        ])
      }
    } catch (error) {
      console.error('사용자 정보 가져오기 실패:', error)
      // 에러 시 기본 인사 메시지
      setMessages([
        {
          id: 1,
          message: "안녕하세요! 멍토리 도우미입니다 🐕 무엇을 도와드릴까요?",
          isUser: false,
          timestamp: new Date(),
        },
      ])
    }
  }

  // 컴포넌트 마운트 시 사용자 정보 가져오기
  useEffect(() => {
    fetchUserInfo()
  }, [])

  // 메시지 추가 시 스크롤을 맨 아래로 이동
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // @태그 감지 및 MyPet 자동완성
  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    const position = e.target.selectionStart || 0
    
    setInputMessage(value)
    setCursorPosition(position)

    // @ 태그 검출
    const beforeCursor = value.substring(0, position)
    const afterCursor = value.substring(position)
    
    // 커서 앞에서 가장 가까운 @태그 찾기
    const atTagMatch = beforeCursor.match(/@([ㄱ-ㅎ가-힣a-zA-Z0-9_]*)$/)
    
    console.log('handleInputChange 호출됨:', { value, position, beforeCursor, afterCursor, atTagMatch })
    
    if (atTagMatch) {
      const keyword = atTagMatch[1]
      
      if (keyword.length >= 0) { // 빈 문자열도 허용하여 모든 펫 표시
        try {
          const token = localStorage.getItem('accessToken')
          
          if (token) {
            const url = `${getBackendUrl()}/api/mypet/search?keyword=${keyword}`
            
            const response = await axios.get(url, { 
              headers: { 
                Authorization: `Bearer ${token}`,
                'Access_Token': token
              } 
            })
            
            if (response.data.success) {
              setPetSuggestions(response.data.data || [])
              setShowSuggestions(true)
            }
          } else {
            console.log('토큰이 없어서 API 호출 불가')
          }
        } catch (error) {
          console.error('MyPet 검색 실패:', error)
          setPetSuggestions([])
        }
      }
    } else {
      // 커서 앞에 @태그가 없으면 자동완성 숨기기
      setShowSuggestions(false)
      setPetSuggestions([])
    }
  }

  // MyPet 선택 처리
  const selectPet = (pet: MyPetSuggestion) => {
    const beforeCursor = inputMessage.substring(0, cursorPosition)
    const afterCursor = inputMessage.substring(cursorPosition)
    
    // 커서 앞에서 가장 가까운 @태그의 시작 위치 찾기
    const atTagStart = beforeCursor.lastIndexOf('@')
    
    if (atTagStart !== -1) {
      // @태그 시작 위치부터 커서까지를 @펫이름으로 교체
      const beforeAtTag = inputMessage.substring(0, atTagStart)
      const newMessage = beforeAtTag + `@${pet.name} ` + afterCursor
      
      setInputMessage(newMessage)
      setSelectedPetId(pet.myPetId)
      setShowSuggestions(false)
      setPetSuggestions([])
      
      // 입력창에 포커스 및 커서 위치 조정
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          // 커서를 @펫이름 다음 위치로 이동
          const newCursorPosition = atTagStart + pet.name.length + 2 // @ + 이름 + 공백
          inputRef.current.setSelectionRange(newCursorPosition, newCursorPosition);
        }
      }, 100)
    }
  }

  const sendMessage = async () => {
    if (inputMessage.trim()) {
      let processedMessage = inputMessage
      let currentPetId = selectedPetId

      // @태그가 있으면 해당 펫의 ID를 찾기
      const atTagMatch = processedMessage.match(/@([ㄱ-ㅎ가-힣a-zA-Z0-9_]+)/)
      if (atTagMatch && !currentPetId) {
        const petName = atTagMatch[1]
        // 현재 펫 목록에서 해당 이름의 펫 찾기
        const matchingPet = petSuggestions.find(pet => pet.name === petName)
        if (matchingPet) {
          currentPetId = matchingPet.myPetId
        } else {
          // 펫 목록에 없으면 API로 검색
          try {
            const token = localStorage.getItem('accessToken')
            if (token) {
              const response = await axios.get(`${getBackendUrl()}/api/mypet/search?keyword=${petName}`, { 
                headers: { 
                  Authorization: `Bearer ${token}`,
                  'Access_Token': token
                } 
              })
              if (response.data.success && response.data.data.length > 0) {
                const exactMatch = response.data.data.find((pet: any) => pet.name === petName)
                if (exactMatch) {
                  currentPetId = exactMatch.myPetId
                }
              }
            }
          } catch (error) {
            console.error('펫 정보 검색 실패:', error)
          }
        }
      }

      // 디버깅을 위한 로그 추가
      console.log('sendMessage 호출됨:', {
        inputMessage,
        selectedPetId,
        currentPetId,
        hasPetTag: inputMessage.includes('@'),
        atTagMatch
      })

      // 메시지 전송 후 selectedPetId 초기화
      setSelectedPetId(null)

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

      // 비동기적으로 챗봇 응답 처리
      try {
        // 보험 관련 키워드 체크
        const insuranceKeywords = ['보험', '펫보험', '동물보험', '가입', '보장', '보상', '보험료', '보험사', '상품'];
        const isInsuranceQuery = insuranceKeywords.some(keyword => 
          processedMessage.includes(keyword)
        );

        const endpoint = isInsuranceQuery ? '/api/chatbot/insurance' : '/api/chatbot/query';
        
        // @MyPet이 있으면 petId도 함께 전송
        const token = localStorage.getItem('accessToken')
        const requestData: any = { 
          query: processedMessage 
        }
        
        if (currentPetId) {
          requestData.petId = currentPetId
        }
        
        const headers: any = { 
          "Content-Type": "application/json; charset=UTF-8"
        }
        
        if (token) {
          headers.Authorization = `Bearer ${token}`
          headers['Access_Token'] = token
        }
        
        const response = await axios.post(`${getBackendUrl()}${endpoint}`,
          requestData,
          { headers }
        )
        const botResponse: ChatMessage = {
          id: Date.now() + 1,
          message: response.data.answer || "응답이 비어 있습니다. 서버를 확인해주세요.",
          isUser: false,
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, botResponse])
      } catch (error: any) {
        console.error("챗봇 요청 실패:", error.message, error.response?.data)
        const errorMessage: ChatMessage = {
          id: Date.now() + 1,
          message: `죄송합니다. 서버 오류가 발생했습니다: ${error.message}`,
          isUser: false,
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, errorMessage])
      }
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      sendMessage()
    }
  }

  // MyPet 검색 함수
  const fetchMyPetSuggestions = async (keyword: string) => {
    try {
      const token = localStorage.getItem('accessToken')
      if (token) {
        const response = await axios.get(`${getBackendUrl()}/api/mypet/search?keyword=${keyword}`, { 
          headers: { 
            Authorization: `Bearer ${token}`,
            'Access_Token': token
          } 
        })
        
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



  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 w-16 h-16 bg-yellow-400 hover:bg-yellow-500 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-110 z-50"
        >
          <div className="text-2xl">🐕</div>
        </button>
      )}

      {isOpen && (
        <div className="fixed bottom-6 right-6 w-80 h-96 bg-white rounded-lg shadow-2xl border border-gray-200 flex flex-col z-50">
          <div className="bg-yellow-400 text-black p-4 rounded-t-lg flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="text-xl">🐕</div>
              <div>
                <h3 className="font-bold text-sm">멍토리 도우미</h3>
                <p className="text-xs opacity-80">온라인</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="hover:bg-yellow-500 p-1 rounded transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.isUser ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-xs px-3 py-2 rounded-lg text-sm ${
                    message.isUser ? "bg-yellow-400 text-black" : "bg-gray-100 text-gray-800 border border-gray-200"
                  }`}
                >
                  {renderMessageWithPetTags(message.message)}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} /> {/* 스크롤 참조용 빈 div */}
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
                    placeholder="메시지를 입력하세요..."
                    className="flex-1 text-sm"
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
                <Button onClick={sendMessage} size="sm" className="bg-yellow-400 hover:bg-yellow-500 text-black px-3">
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