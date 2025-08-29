#!/usr/bin/env python3
"""
OpenAI Assistant 기본 테스트
- Assistant 생성
- Thread 생성  
- 메시지 전송
- 응답 확인
"""

import os
from openai import OpenAI
from dotenv import load_dotenv
import time

# 환경변수 로드
load_dotenv()

def test_basic_assistant():
    """기본 Assistant 테스트"""
    print("=== OpenAI Assistant 기본 테스트 시작 ===")
    
    # OpenAI 클라이언트 초기화
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    print("✅ OpenAI 클라이언트 초기화 완료")
    
    try:
        # 1. Assistant 생성
        print("\n1. Assistant 생성 중...")
        assistant = client.beta.assistants.create(
            name="테스트 어시스턴트",
            instructions="당신은 도움이 되는 AI 어시스턴트입니다. 간단하고 친절하게 답변해주세요.",
            model="gpt-4o-mini",  # 비용 절약을 위해 mini 모델 사용
            tools=[]  # 아직 Function Tools는 추가하지 않음
        )
        print(f"✅ Assistant 생성 완료 - ID: {assistant.id}")
        
        # 2. Thread 생성
        print("\n2. Thread 생성 중...")
        thread = client.beta.threads.create()
        print(f"✅ Thread 생성 완료 - ID: {thread.id}")
        
        # 3. 메시지 추가
        print("\n3. 사용자 메시지 추가 중...")
        message = client.beta.threads.messages.create(
            thread_id=thread.id,
            role="user",
            content="안녕하세요! 간단한 테스트입니다."
        )
        print(f"✅ 메시지 추가 완료 - ID: {message.id}")
        
        # 4. Run 실행
        print("\n4. Assistant 실행 중...")
        run = client.beta.threads.runs.create(
            thread_id=thread.id,
            assistant_id=assistant.id
        )
        print(f"✅ Run 시작 - ID: {run.id}")
        
        # 5. Run 완료 대기 (상태 확인)
        print("\n5. 처리 완료 대기 중...")
        while True:
            run = client.beta.threads.runs.retrieve(
                thread_id=thread.id,
                run_id=run.id
            )
            print(f"   현재 상태: {run.status}")
            
            if run.status == "completed":
                print("✅ 처리 완료!")
                break
            elif run.status in ["failed", "cancelled", "expired"]:
                print(f"❌ 처리 실패: {run.status}")
                return
            
            time.sleep(1)  # 1초 대기
        
        # 6. 응답 메시지 조회
        print("\n6. 응답 메시지 조회 중...")
        messages = client.beta.threads.messages.list(thread_id=thread.id)
        
        print("\n=== 대화 내역 ===")
        for msg in reversed(messages.data):
            role_emoji = "🤖" if msg.role == "assistant" else "👤"
            print(f"{role_emoji} {msg.role}: {msg.content[0].text.value}")
        
        # 7. 정리 (선택사항)
        print("\n7. Assistant 삭제 중...")
        client.beta.assistants.delete(assistant.id)
        print("✅ Assistant 삭제 완료")
        
        print("\n=== 테스트 성공! ===")
        
    except Exception as e:
        print(f"❌ 에러 발생: {str(e)}")
        return False
    
    return True

if __name__ == "__main__":
    success = test_basic_assistant()
    if success:
        print("\n🎉 OpenAI Assistant가 정상적으로 작동합니다!")
    else:
        print("\n💥 테스트 실패. 설정을 확인해주세요.")