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

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 1,
      message: "안녕하세요! 멍토리 도우미입니다 🐕 무엇을 도와드릴까요?",
      isUser: false,
      timestamp: new Date(),
    },
  ])
  const [inputMessage, setInputMessage] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // 메시지 추가 시 스크롤을 맨 아래로 이동
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const sendMessage = async () => {
    if (inputMessage.trim()) {
      // 사용자 메시지 즉시 추가
      const userMessage: ChatMessage = {
        id: Date.now(),
        message: inputMessage,
        isUser: true,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, userMessage])
      setInputMessage("") // 입력창 즉시 비우기

      // 비동기적으로 챗봇 응답 처리
      try {

        const response = await axios.post(`${getBackendUrl()}/api/chatbot/query`,
          { query: inputMessage },
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
                  {message.message}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} /> {/* 스크롤 참조용 빈 div */}
          </div>

          <div className="p-4 border-t border-gray-200">
            <div className="flex space-x-2">
              <Input
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="메시지를 입력하세요..."
                className="flex-1 text-sm"
              />
              <Button onClick={sendMessage} size="sm" className="bg-yellow-400 hover:bg-yellow-500 text-black px-3">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}