#!/usr/bin/env python3
"""
입양 추천 OpenAI Assistant
- 3개 Function Tools 통합
- Assistant 생성 및 관리
- Function Call 처리
"""

import os
import json
from openai import OpenAI
from dotenv import load_dotenv
import logging
from typing import Dict, Any

# Function Tools Import
from .pet_search_tool import (
    SEARCH_PETS_FUNCTION, 
    execute_pet_search
)
from .insurance_recommendation_tool import (
    RECOMMEND_INSURANCE_FUNCTION,
    execute_insurance_recommendation
)
from .product_recommendation_tool import (
    RECOMMEND_PRODUCTS_FUNCTION, 
    execute_product_recommendation
)

load_dotenv()
logger = logging.getLogger(__name__)

class AdoptionAssistant:
    def __init__(self):
        self.client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        self.assistant_id = None
        
        # Function 매핑
        self.function_handlers = {
            "search_pets": execute_pet_search,
            "recommend_insurance": execute_insurance_recommendation,  
            "recommend_products": execute_product_recommendation
        }
        
    def create_assistant(self) -> str:
        """입양 추천 Assistant 생성"""
        try:
            assistant = self.client.beta.assistants.create(
                name="멍토리 입양 추천 어시스턴트",
                instructions="""
당신은 반려동물 입양을 도와주는 전문 상담사입니다. 다음 3단계로 사용자를 도와주세요:

1. **강아지 추천 단계**
   - 사용자의 선호도를 자세히 파악하세요
   - search_pets 함수를 사용하여 적합한 강아지 3마리를 추천하세요
   - 각 강아지의 특징을 친근하게 설명해주세요
   - 사용자가 한 마리를 선택할 때까지 기다리세요

2. **보험 추천 단계**  
   - 선택된 강아지 정보를 바탕으로 recommend_insurance 함수를 호출하세요
   - 품종별 위험 요소와 추천 이유를 설명해주세요
   - 2-3개의 보험 상품을 추천하세요

3. **상품 추천 단계**
   - 선택된 강아지 정보를 바탕으로 recommend_products 함수를 호출하세요  
   - 입양 준비에 필요한 용품들을 카테고리별로 설명해주세요
   - 5-6개의 상품을 추천하세요

**대화 스타일:**
- 친근하고 따뜻한 말투 사용
- 강아지에 대한 애정을 표현
- 입양의 책임감도 함께 언급
- 각 단계별로 충분한 설명 제공
- 사용자가 결정할 시간을 주세요

**주의사항:**
- 한 번에 모든 단계를 진행하지 마세요
- 사용자의 응답을 기다린 후 다음 단계로 진행하세요
- Function 호출 결과를 사용자가 이해하기 쉽게 설명해주세요
""",
                model="gpt-4o-mini",
                tools=[
                    SEARCH_PETS_FUNCTION,
                    RECOMMEND_INSURANCE_FUNCTION,
                    RECOMMEND_PRODUCTS_FUNCTION
                ]
            )
            
            self.assistant_id = assistant.id
            logger.info(f"Assistant 생성 완료: {self.assistant_id}")
            return self.assistant_id
            
        except Exception as e:
            logger.error(f"Assistant 생성 실패: {str(e)}")
            raise
    
    def create_thread(self) -> str:
        """새로운 대화 Thread 생성"""
        try:
            thread = self.client.beta.threads.create()
            logger.info(f"Thread 생성 완료: {thread.id}")
            return thread.id
        except Exception as e:
            logger.error(f"Thread 생성 실패: {str(e)}")
            raise
    
    def send_message(self, thread_id: str, message: str) -> Dict[str, Any]:
        """메시지 전송 및 응답 처리"""
        try:
            # 사용자 메시지 추가
            self.client.beta.threads.messages.create(
                thread_id=thread_id,
                role="user", 
                content=message
            )
            
            # Run 실행
            run = self.client.beta.threads.runs.create(
                thread_id=thread_id,
                assistant_id=self.assistant_id
            )
            
            # Run 완료 대기 및 Function Call 처리
            result = self._wait_for_completion(thread_id, run.id)
            
            return result
            
        except Exception as e:
            logger.error(f"메시지 처리 실패: {str(e)}")
            return {
                "success": False,
                "error": f"메시지 처리 실패: {str(e)}"
            }
    
    def _wait_for_completion(self, thread_id: str, run_id: str) -> Dict[str, Any]:
        """Run 완료 대기 및 Function Call 처리"""
        import time
        
        max_iterations = 30  # 최대 30번 체크 (30초)
        
        for _ in range(max_iterations):
            run = self.client.beta.threads.runs.retrieve(
                thread_id=thread_id,
                run_id=run_id
            )
            
            logger.info(f"Run 상태: {run.status}")
            
            if run.status == "completed":
                # 완료된 경우 최신 메시지 반환
                messages = self.client.beta.threads.messages.list(thread_id=thread_id)
                latest_message = messages.data[0]
                
                return {
                    "success": True,
                    "response": latest_message.content[0].text.value,
                    "message_id": latest_message.id
                }
                
            elif run.status == "requires_action":
                # Function Call 처리 필요
                self._handle_function_calls(thread_id, run_id, run.required_action)
                
            elif run.status in ["failed", "cancelled", "expired"]:
                return {
                    "success": False,
                    "error": f"Run 실패: {run.status}",
                    "details": run.last_error.message if run.last_error else "상세 정보 없음"
                }
            
            time.sleep(1)
        
        return {
            "success": False,
            "error": "응답 시간 초과"
        }
    
    def _handle_function_calls(self, thread_id: str, run_id: str, required_action):
        """Function Call 처리"""
        try:
            tool_outputs = []
            
            for tool_call in required_action.submit_tool_outputs.tool_calls:
                function_name = tool_call.function.name
                function_args = json.loads(tool_call.function.arguments)
                
                logger.info(f"Function 호출: {function_name}")
                logger.info(f"Arguments: {function_args}")
                
                # Function 실행
                if function_name in self.function_handlers:
                    try:
                        if function_name == "search_pets":
                            result = self.function_handlers[function_name](
                                function_args.get("user_preferences", "")
                            )
                        else:  # insurance, product 추천
                            result = self.function_handlers[function_name](
                                function_args.get("selected_pet", {})
                            )
                        
                        tool_outputs.append({
                            "tool_call_id": tool_call.id,
                            "output": result
                        })
                        
                    except Exception as e:
                        logger.error(f"Function {function_name} 실행 실패: {str(e)}")
                        tool_outputs.append({
                            "tool_call_id": tool_call.id,
                            "output": json.dumps({
                                "success": False,
                                "error": f"Function 실행 실패: {str(e)}"
                            }, ensure_ascii=False)
                        })
                else:
                    logger.warning(f"알 수 없는 Function: {function_name}")
                    tool_outputs.append({
                        "tool_call_id": tool_call.id,
                        "output": json.dumps({
                            "success": False, 
                            "error": "알 수 없는 Function"
                        }, ensure_ascii=False)
                    })
            
            # Tool 결과 제출
            self.client.beta.threads.runs.submit_tool_outputs(
                thread_id=thread_id,
                run_id=run_id,
                tool_outputs=tool_outputs
            )
            
        except Exception as e:
            logger.error(f"Function Call 처리 실패: {str(e)}")
    
    def get_conversation_history(self, thread_id: str) -> list:
        """대화 히스토리 조회"""
        try:
            messages = self.client.beta.threads.messages.list(thread_id=thread_id)
            
            conversation = []
            for message in reversed(messages.data):
                conversation.append({
                    "role": message.role,
                    "content": message.content[0].text.value,
                    "timestamp": message.created_at
                })
                
            return conversation
            
        except Exception as e:
            logger.error(f"대화 히스토리 조회 실패: {str(e)}")
            return []
    
    def cleanup_assistant(self):
        """Assistant 정리 (테스트용)"""
        if self.assistant_id:
            try:
                self.client.beta.assistants.delete(self.assistant_id)
                logger.info(f"Assistant 삭제 완료: {self.assistant_id}")
            except Exception as e:
                logger.warning(f"Assistant 삭제 실패: {str(e)}")

# 전역 인스턴스 (FastAPI에서 사용)
adoption_assistant = AdoptionAssistant()