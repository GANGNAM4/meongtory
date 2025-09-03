#!/usr/bin/env python3
"""
입양 Agent 메인 서비스
- 세션 관리
- 단계별 플로우 제어
- 상태 추적
"""

import logging
from typing import Dict, Any, Optional
from enum import Enum
import time
import json

from .adoption_assistant import adoption_assistant

logger = logging.getLogger(__name__)

class AgentStage(Enum):
    """Agent 진행 단계"""
    INITIAL = "initial"               # 초기 상태
    PET_SEARCH = "pet_search"         # 강아지 검색 중
    PET_SELECTED = "pet_selected"     # 강아지 선택 완료
    RECOMMENDATIONS = "recommendations" # 보험 및 상품 추천 중
    COMPLETED = "completed"           # 모든 단계 완료

class AgentSession:
    """개별 사용자 세션"""
    def __init__(self, session_id: str):
        self.session_id = session_id
        self.thread_id = None
        self.stage = AgentStage.INITIAL
        self.selected_pet = None
        self.recommended_insurance = []
        self.recommended_products = []
        self.created_at = time.time()
        self.last_activity = time.time()
        self.conversation_history = []

    def update_activity(self):
        """마지막 활동 시간 업데이트"""
        self.last_activity = time.time()

    def is_expired(self, timeout_seconds: int = 3600) -> bool:
        """세션 만료 여부 확인 (기본 1시간)"""
        return (time.time() - self.last_activity) > timeout_seconds

    def to_dict(self) -> Dict[str, Any]:
        """세션 정보를 딕셔너리로 변환"""
        return {
            "session_id": self.session_id,
            "thread_id": self.thread_id,
            "stage": self.stage.value,
            "selected_pet": self.selected_pet,
            "recommended_insurance": self.recommended_insurance,
            "recommended_products": self.recommended_products,
            "created_at": self.created_at,
            "last_activity": self.last_activity
        }

class AdoptionAgentService:
    """입양 Agent 메인 서비스"""
    
    def __init__(self):
        self.sessions: Dict[str, AgentSession] = {}
        self.assistant_id = None
        
    def initialize(self):
        """서비스 초기화"""
        try:
            # Assistant 생성 (한번만)
            if not self.assistant_id:
                self.assistant_id = adoption_assistant.create_assistant()
                logger.info("Adoption Agent 서비스 초기화 완료")
        except Exception as e:
            logger.error(f"Agent 서비스 초기화 실패: {str(e)}")
            raise

    def start_session(self, session_id: str) -> Dict[str, Any]:
        """새로운 세션 시작"""
        try:
            # 기존 세션이 있으면 정리
            if session_id in self.sessions:
                old_session = self.sessions[session_id]
                logger.info(f"기존 세션 정리: {session_id}")
            
            # 새 세션 생성
            session = AgentSession(session_id)
            session.thread_id = adoption_assistant.create_thread()
            session.update_activity()
            
            self.sessions[session_id] = session
            
            # 환영 메시지
            welcome_message = """
🐾 안녕하세요! 멍토리 입양 상담사입니다! 

반려견과의 특별한 만남을 도와드릴게요. 
어떤 강아지를 찾고 계신지 자세히 말씀해주세요!

예를 들어:
- "서울에서 온순한 소형견을 찾고 있어요"
- "아이들과 잘 지내는 중형견을 원해요" 
- "처음 키워봐서 키우기 쉬운 강아지가 좋아요"

어떤 강아지를 원하시나요? 🐕
"""
            
            return {
                "success": True,
                "session_id": session_id,
                "thread_id": session.thread_id,
                "stage": session.stage.value,
                "message": welcome_message.strip(),
                "next_step": "사용자 선호도를 입력해주세요"
            }
            
        except Exception as e:
            logger.error(f"세션 시작 실패: {str(e)}")
            return {
                "success": False,
                "error": f"세션 시작 실패: {str(e)}"
            }

    def send_message(self, session_id: str, message: str) -> Dict[str, Any]:
        """메시지 전송 및 처리"""
        try:
            # 세션 확인
            if session_id not in self.sessions:
                return {
                    "success": False,
                    "error": "세션이 없습니다. 새로운 세션을 시작해주세요.",
                    "action": "restart_session"
                }
            
            session = self.sessions[session_id]
            
            # 세션 만료 확인
            if session.is_expired():
                del self.sessions[session_id]
                return {
                    "success": False, 
                    "error": "세션이 만료되었습니다. 새로운 세션을 시작해주세요.",
                    "action": "restart_session"
                }
            
            session.update_activity()
            
            # 메시지 전송 및 응답 처리
            result = adoption_assistant.send_message(session.thread_id, message)
            
            if not result.get("success"):
                return result
            
            # 응답 분석 및 단계 업데이트
            response_text = result.get("response", "")
            self._update_session_stage(session, message, response_text)
            
            # 대화 히스토리 업데이트
            session.conversation_history.append({
                "user": message,
                "assistant": response_text,
                "timestamp": time.time()
            })
            
            # 진행 상황 정보 추가
            stage_info = self._get_stage_info(session)
            
            return {
                "success": True,
                "session_id": session_id,
                "stage": session.stage.value,
                "response": response_text,
                "stage_info": stage_info,
                "progress": self._calculate_progress(session)
            }
            
        except Exception as e:
            logger.error(f"메시지 처리 실패: {str(e)}")
            return {
                "success": False,
                "error": f"메시지 처리 실패: {str(e)}"
            }

    def _update_session_stage(self, session: AgentSession, user_message: str, ai_response: str):
        """세션 단계 업데이트"""
        try:
            # AI 응답에서 단계 변화 감지
            if "강아지" in ai_response and "추천" in ai_response and session.stage == AgentStage.INITIAL:
                session.stage = AgentStage.PET_SEARCH
                logger.info(f"세션 {session.session_id}: PET_SEARCH 단계로 진행")
                
            elif ("선택" in user_message or "번째" in user_message) and session.stage == AgentStage.PET_SEARCH:
                session.stage = AgentStage.PET_SELECTED
                # 선택된 강아지 정보 추출 시도 (AI 응답에서)
                self._extract_selected_pet(session, ai_response)
                logger.info(f"세션 {session.session_id}: PET_SELECTED 단계로 진행")
                
            elif (("보험" in ai_response and "추천" in ai_response) or ("상품" in ai_response and "추천" in ai_response)) and session.stage == AgentStage.PET_SELECTED:
                session.stage = AgentStage.RECOMMENDATIONS
                logger.info(f"세션 {session.session_id}: RECOMMENDATIONS 단계로 진행 (보험 및 상품 통합 추천)")
                
            elif ("완료" in ai_response or ("보험" in ai_response and "상품" in ai_response)) and session.stage == AgentStage.RECOMMENDATIONS:
                session.stage = AgentStage.COMPLETED
                logger.info(f"세션 {session.session_id}: COMPLETED 단계 완료")
                
        except Exception as e:
            logger.warning(f"단계 업데이트 실패: {str(e)}")

    def _extract_selected_pet(self, session: AgentSession, ai_response: str):
        """AI 응답에서 선택된 강아지 정보 추출 (간단한 방식)"""
        try:
            # 실제로는 AI 응답을 파싱하거나 별도 저장 필요
            # 현재는 더미 데이터로 설정
            session.selected_pet = {
                "petId": 1,
                "name": "추출된 강아지",
                "breed": "추출된 품종",
                "age": 3
            }
        except Exception as e:
            logger.warning(f"강아지 정보 추출 실패: {str(e)}")

    def _get_stage_info(self, session: AgentSession) -> Dict[str, Any]:
        """현재 단계 정보 반환"""
        stage_descriptions = {
            AgentStage.INITIAL: {
                "title": "시작",
                "description": "원하는 강아지 특성을 알려주세요",
                "next": "강아지 검색"
            },
            AgentStage.PET_SEARCH: {
                "title": "강아지 검색",
                "description": "추천 강아지를 검색하고 있습니다",
                "next": "강아지 선택"
            },
            AgentStage.PET_SELECTED: {
                "title": "강아지 선택 완료",
                "description": "선택하신 강아지에 맞는 보험과 용품을 함께 추천드릴게요",
                "next": "통합 추천"
            },
            AgentStage.RECOMMENDATIONS: {
                "title": "보험 및 상품 추천",
                "description": "맞춤형 보험과 입양 준비 용품을 추천드리고 있습니다",
                "next": "완료"
            },
            AgentStage.COMPLETED: {
                "title": "추천 완료",
                "description": "모든 추천이 완료되었습니다",
                "next": "새 상담 시작"
            }
        }
        
        return stage_descriptions.get(session.stage, {})

    def _calculate_progress(self, session: AgentSession) -> Dict[str, Any]:
        """진행률 계산"""
        stage_progress = {
            AgentStage.INITIAL: 0,
            AgentStage.PET_SEARCH: 25,
            AgentStage.PET_SELECTED: 50,
            AgentStage.RECOMMENDATIONS: 85,
            AgentStage.COMPLETED: 100
        }
        
        current_progress = stage_progress.get(session.stage, 0)
        
        return {
            "percentage": current_progress,
            "current_stage": session.stage.value,
            "completed_stages": [stage.value for stage in AgentStage if stage_progress[stage] < current_progress]
        }

    def get_session_info(self, session_id: str) -> Dict[str, Any]:
        """세션 정보 조회"""
        if session_id not in self.sessions:
            return {
                "success": False,
                "error": "세션을 찾을 수 없습니다"
            }
        
        session = self.sessions[session_id]
        
        return {
            "success": True,
            "session": session.to_dict(),
            "stage_info": self._get_stage_info(session),
            "progress": self._calculate_progress(session)
        }

    def end_session(self, session_id: str) -> Dict[str, Any]:
        """세션 종료"""
        try:
            if session_id in self.sessions:
                session = self.sessions[session_id]
                del self.sessions[session_id]
                logger.info(f"세션 종료: {session_id}")
                
                return {
                    "success": True,
                    "message": "세션이 종료되었습니다",
                    "summary": {
                        "duration": time.time() - session.created_at,
                        "final_stage": session.stage.value,
                        "conversation_count": len(session.conversation_history)
                    }
                }
            else:
                return {
                    "success": False,
                    "error": "세션을 찾을 수 없습니다"
                }
        except Exception as e:
            logger.error(f"세션 종료 실패: {str(e)}")
            return {
                "success": False,
                "error": f"세션 종료 실패: {str(e)}"
            }

    def cleanup_expired_sessions(self):
        """만료된 세션 정리 (주기적 실행용)"""
        try:
            expired_sessions = [
                sid for sid, session in self.sessions.items()
                if session.is_expired()
            ]
            
            for session_id in expired_sessions:
                del self.sessions[session_id]
                logger.info(f"만료된 세션 정리: {session_id}")
                
            return len(expired_sessions)
            
        except Exception as e:
            logger.error(f"세션 정리 실패: {str(e)}")
            return 0

# 전역 서비스 인스턴스
agent_service = AdoptionAgentService()