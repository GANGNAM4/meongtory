from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from pydantic import BaseModel
from openai import OpenAI
import io
import base64
import logging
import sys
import os
import logging
import json
import httpx
import tempfile
import asyncio
import threading
from typing import Optional

# AI 서비스 모듈들 import
from contract.service import ContractAIService
from contract.models import ContractSuggestionRequest, ClauseSuggestionRequest, ContractGenerationRequest
from story.service import StoryAIService
from story.models import BackgroundStoryRequest
from breeding.breeding import predict_breeding
from breed.breed_api import router as breed_router
from emotion.emotion_api import router as emotion_router
from emotion.retrain_service import get_retrain_service
from model import DogBreedClassifier
from chatBot.rag_app import process_rag_query, initialize_vectorstore
from chatBot.insurance_rag import process_insurance_rag_query, InsuranceQueryRequest

# StoreAI 서비스 import
from store.api import app as storeai_app

# transcribe.py 모듈을 import하기 위해 경로 추가
sys.path.append(os.path.join(os.path.dirname(__file__), 'diary'))
from transcribe import transcribe_audio
from category_classifier import CategoryClassifier
# from diary.diary_image_classifier import DiaryImageClassifier  # Lazy loading으로 변경

# embedding_update.py 모듈 import
from store.embedding_update import EmbeddingUpdater

async def get_mypet_info(pet_id: int):
    """백엔드에서 MyPet 정보를 가져오는 함수 (내부 통신)"""
    try:
        backend_url = "http://backend:8080"
        
        # 내부 통신 키 가져오기
        internal_key = os.getenv("INTERNAL_API_KEY", "default-internal-key")
        headers = {"X-Internal-Key": internal_key}
        
        # 디버깅 로그
        logger.info(f"Internal key: {internal_key}")
        logger.info(f"Headers: {headers}")
        
        # 내부 통신용 엔드포인트 호출
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{backend_url}/api/mypet/internal/{pet_id}", headers=headers)
            if response.status_code == 200:
                pet_data = response.json()
                if pet_data.get('success'):
                    pet = pet_data.get('data', {})
                    # 의료기록 정보도 포함
                    medical_info = ""
                    if pet.get('medicalHistory'):
                        medical_info += f"의료기록: {pet.get('medicalHistory')}, "
                    if pet.get('vaccinations'):
                        medical_info += f"예방접종: {pet.get('vaccinations')}, "
                    if pet.get('specialNeeds'):
                        medical_info += f"특별관리: {pet.get('specialNeeds')}, "
                    if pet.get('notes'):
                        medical_info += f"메모: {pet.get('notes')}, "
                    
                    return f"이름: {pet.get('name', 'N/A')}, 품종: {pet.get('breed', 'N/A')}, 나이: {pet.get('age', 'N/A')}세, 성별: {pet.get('gender', 'N/A')}, 체중: {pet.get('weight', 'N/A')}kg, 마이크로칩: {pet.get('microchipId', 'N/A')}, {medical_info}"
                else:
                    logger.warning(f"Failed to get pet info for petId {pet_id}: {pet_data.get('error')}")
                    return None
            else:
                logger.warning(f"Failed to get pet info for petId {pet_id}: HTTP {response.status_code}")
                return None
    except Exception as e:
        logger.error(f"Error getting pet info for petId {pet_id}: {str(e)}")
        return None

# Adoption Agent 모듈 import
from adoption_agent.agent_service import agent_service

# 로깅 설정
logging.basicConfig(level=logging.INFO)  # DEBUG에서 INFO로 변경
logger = logging.getLogger(__name__)

app = FastAPI()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY", ""))
classifier = None  # Lazy loading for CLIP model

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://meongtory.shop"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 한글 인코딩을 위한 미들웨어 추가
@app.middleware("http")
async def add_charset_header(request, call_next):
    response = await call_next(request)
    if "application/json" in response.headers.get("content-type", ""):
        response.headers["content-type"] = "application/json; charset=utf-8"
    return response

app.include_router(breed_router, prefix="/api/ai")
app.include_router(emotion_router, prefix="/api/ai")

# StoreAI 서비스 라우터 포함
app.mount("/storeai", storeai_app)

# OpenAI 설정
if not client.api_key:
    logger.warning("OPENAI_API_KEY not set")

# 서비스 인스턴스 생성
story_service = StoryAIService()
contract_service = ContractAIService()
dog_breed_classifier = DogBreedClassifier()  # Renamed to avoid conflict
category_classifier = CategoryClassifier()

class BackgroundStoryRequest(BaseModel):
    petName: str
    breed: str
    age: str
    gender: str
    personality: str = ""
    userPrompt: str = ""

class QueryRequest(BaseModel):
    query: str
    petId: Optional[int] = None

    class Config:
        # null 값을 허용하도록 설정
        json_encoders = {
            int: lambda v: v if v is not None else None
        }

class RetrainRequest(BaseModel):
    min_feedback_count: int = 10

class CategoryClassificationRequest(BaseModel):
    content: str

class EmbeddingUpdateRequest(BaseModel):
    auto_mode: bool = True

# Adoption Agent 관련 모델
class AgentStartRequest(BaseModel):
    session_id: str

class AgentMessageRequest(BaseModel):
    session_id: str
    message: str

class AgentSessionRequest(BaseModel):
    session_id: str

# ===== ADOPTION AGENT API ENDPOINTS =====

@app.on_event("startup")
async def startup_event():
    """서버 시작 시 Agent 서비스 초기화"""
    try:
        agent_service.initialize()
        logger.info("Adoption Agent 서비스 초기화 완료")
    except Exception as e:
        logger.error(f"Adoption Agent 초기화 실패: {str(e)}")

@app.post("/api/adoption-agent/start")
async def start_adoption_session(request: AgentStartRequest):
    """새로운 입양 상담 세션 시작"""
    try:
        result = agent_service.start_session(request.session_id)
        return result
    except Exception as e:
        logger.error(f"입양 세션 시작 실패: {str(e)}")
        raise HTTPException(status_code=500, detail=f"세션 시작 실패: {str(e)}")

@app.post("/api/adoption-agent/message")
async def send_adoption_message(request: AgentMessageRequest):
    """입양 상담 메시지 전송"""
    try:
        result = agent_service.send_message(request.session_id, request.message)
        return result
    except Exception as e:
        logger.error(f"메시지 전송 실패: {str(e)}")
        raise HTTPException(status_code=500, detail=f"메시지 처리 실패: {str(e)}")

@app.get("/api/adoption-agent/session/{session_id}")
async def get_adoption_session(session_id: str):
    """세션 정보 조회"""
    try:
        result = agent_service.get_session_info(session_id)
        return result
    except Exception as e:
        logger.error(f"세션 조회 실패: {str(e)}")
        raise HTTPException(status_code=500, detail=f"세션 조회 실패: {str(e)}")

@app.delete("/api/adoption-agent/session/{session_id}")
async def end_adoption_session(session_id: str):
    """입양 상담 세션 종료"""
    try:
        result = agent_service.end_session(session_id)
        return result
    except Exception as e:
        logger.error(f"세션 종료 실패: {str(e)}")
        raise HTTPException(status_code=500, detail=f"세션 종료 실패: {str(e)}")

# ===== EXISTING API ENDPOINTS =====

@app.post("/predict")
async def predict_dog_breed(file: UploadFile = File(...)):
    try:
        image_bytes = io.BytesIO(await file.read())
        result = dog_breed_classifier.predict(image_bytes)
        return result
    except Exception as e:
        logger.error(f"Dog breed prediction failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"견종 예측 중 오류 발생: {str(e)}")

@app.post("/generate-story")
async def generate_background_story(request: BackgroundStoryRequest):
    """배경 스토리 생성"""
    try:
        if story_service:
            result = await story_service.generate_background_story(request)
            return result
        else:
            prompt = build_story_prompt(request)
            model_name = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
            response = client.chat.completions.create(
                model=model_name,
                messages=[
                    {"role": "system", "content": "당신은 따뜻하고 감동적인 입양 동물의 배경 스토리를 작성하는 전문가입니다."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=500,
                temperature=0.7
            )
            story = response.choices[0].message.content.strip()
            return {
                "story": story,
                "status": "success",
                "message": "배경 스토리가 성공적으로 생성되었습니다."
            }
    except Exception as e:
        logger.error(f"Story generation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"스토리 생성 실패: {str(e)}")

@app.post("/contract-suggestions")
async def get_contract_suggestions(request: ContractSuggestionRequest):
    """계약서 조항 추천"""
    try:
        return await contract_service.get_contract_suggestions(request)
    except Exception as e:
        logger.error(f"Contract suggestions failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"계약서 조항 추천 중 오류 발생: {str(e)}")

@app.post("/clause-suggestions")
async def get_clause_suggestions(request: ClauseSuggestionRequest):
    """조항 추천"""
    try:
        return await contract_service.get_clause_suggestions(request)
    except Exception as e:
        logger.error(f"Clause suggestions failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"조항 추천 중 오류 발생: {str(e)}")

@app.post("/generate-contract")
async def generate_contract(request: ContractGenerationRequest):
    """계약서 생성"""
    try:
        return await contract_service.generate_contract(request)
    except Exception as e:
        logger.error(f"Contract generation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"계약서 생성 중 오류 발생: {str(e)}")

@app.post("/predict-breeding")
async def predict_breeding_endpoint(parent1: UploadFile = File(...), parent2: UploadFile = File(...)):
    """교배 예측"""
    try:
        logger.info(f"교배 예측 시작 - parent1: {parent1.filename}, parent2: {parent2.filename}")
        image1_bytes = await parent1.read()
        image2_bytes = await parent2.read()
        logger.info(f"이미지 읽기 완료 - parent1: {len(image1_bytes)} bytes, parent2: {len(image2_bytes)} bytes")
        result = predict_breeding(image1_bytes, image2_bytes)
        logger.info(f"교배 예측 완료: {result}")
        return result
    except Exception as e:
        logger.error(f"Breeding prediction failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"교배 예측 중 오류 발생: {str(e)}")

@app.post("/transcribe")
async def transcribe_audio_endpoint(file: UploadFile = File(...)):
    """음성 파일을 텍스트로 변환"""
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_file_path = temp_file.name
        
        try:
            transcribed_text = transcribe_audio(temp_file_path)
            os.unlink(temp_file_path)
            return {"transcript": transcribed_text}
        except Exception as e:
            if os.path.exists(temp_file_path):
                os.unlink(temp_file_path)
            raise e
    except Exception as e:
        logger.error(f"Audio transcription failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"음성 변환 중 오류 발생: {str(e)}")

@app.post("/chatbot")
async def chatbot_endpoint(request: QueryRequest):
    """챗봇 쿼리 처리"""
    try:
        # 한글 인코딩 확인 및 로깅
        logger.info(f"Received query (raw): {repr(request.query)}")
        logger.info(f"Received query (decoded): {request.query}")
        logger.info(f"Received petId: {request.petId}")
        
        # petId가 있으면 MyPet 정보를 포함한 쿼리로 처리
        if request.petId:
            # MyPet 정보를 가져와서 쿼리에 포함
            pet_info = await get_mypet_info(request.petId)
            if pet_info:
                enhanced_query = f"펫 정보: {pet_info}\n\n사용자 질문: {request.query}"
                response = await process_rag_query(enhanced_query)
            else:
                response = await process_rag_query(request.query)
        else:
            response = await process_rag_query(request.query)
            
        logger.info(f"Query response: {response['answer']}")
        
        # 응답에 한글 인코딩 확인
        from fastapi.responses import JSONResponse
        return JSONResponse(
            content=response,
            headers={"Content-Type": "application/json; charset=utf-8"}
        )
    except Exception as e:
        logger.error(f"Error processing chatbot query: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Chatbot endpoint failed: {str(e)}")

@app.post("/chatbot/insurance")
async def insurance_chatbot_endpoint(request: InsuranceQueryRequest):
    """보험 전용 챗봇 쿼리 처리"""
    try:
        # 한글 인코딩 확인 및 로깅
        logger.info(f"Received insurance query (raw): {repr(request.query)}")
        logger.info(f"Received insurance query (decoded): {request.query}")
        logger.info(f"Received petId: {request.petId}")
        
        response = await process_insurance_rag_query(request.query, request.petId)
        logger.info(f"Insurance query response: {response['answer']}")
        
        # 응답에 한글 인코딩 확인
        from fastapi.responses import JSONResponse
        return JSONResponse(
            content=response,
            headers={"Content-Type": "application/json; charset=utf-8"}
        )
    except Exception as e:
        logger.error(f"Error processing insurance chatbot query: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Insurance chatbot endpoint failed: {str(e)}")

@app.post("/search/mypet")
async def search_with_mypet(request: dict):
    """MyPet 태깅 기반 상품 검색"""
    try:
        query = request.get("query", "")
        pet_id = request.get("petId")
        limit = request.get("limit", 10)
        
        logger.info(f"MyPet 검색 요청: query='{query}', petId={pet_id}, limit={limit}")
        
        # embedding_update.py의 MyPet 태깅 검색 사용
        from store.embedding_update import EmbeddingUpdater
        
        updater = EmbeddingUpdater()
        results = await updater.search_similar_products_with_pet(query, pet_id, limit)
        
        logger.info(f"MyPet 검색 결과: {len(results)}개 상품")
        
        # 프론트엔드 형식에 맞게 데이터 변환
        formatted_results = []
        for item in results:
            formatted_item = {
                # 기본 정보
                'id': item.get('id'),
                'productId': item.get('product_id', ''),
                'title': item.get('title', item.get('name', '제목 없음')),
                'description': item.get('description', ''),
                'price': item.get('price', 0),
                'imageUrl': item.get('image_url', '/placeholder.svg'),
                'mallName': item.get('mall_name', item.get('seller', '판매자 정보 없음')),
                'productUrl': item.get('product_url', '#'),
                
                # 브랜드/제조사 정보
                'brand': item.get('brand', ''),
                'maker': item.get('maker', ''),
                
                # 카테고리 정보
                'category1': item.get('category1', ''),
                'category2': item.get('category2', ''),
                'category3': item.get('category3', ''),
                'category4': item.get('category4', ''),
                
                # 리뷰/평점 정보
                'reviewCount': item.get('review_count', 0),
                'rating': item.get('rating', 0),
                'searchCount': item.get('search_count', 0),
                
                # 날짜 정보
                'createdAt': item.get('created_at', ''),
                'updatedAt': item.get('updated_at', ''),
                
                # AI 관련 점수
                'similarity': item.get('similarity', 0),
                'petMatchScore': item.get('pet_match_score', 0),
                'pet_score_boost': item.get('pet_score_boost', 0),
                
                # 상품 타입
                'type': item.get('type', 'naver'),
                
                # 추가 메타데이터 (원본 데이터 보존)
                'originalData': item
            }
            formatted_results.append(formatted_item)
        
        return {
            "success": True,
            "data": formatted_results,
            "message": "MyPet 태깅 검색 완료"
        }
        
    except Exception as e:
        logger.error(f"MyPet 검색 오류: {e}")
        return {
            "success": False,
            "data": [],
            "message": f"검색 중 오류 발생: {str(e)}"
        }



@app.post("/api/ai/retrain-emotion-model")
async def retrain_emotion_model(request: RetrainRequest):
    """감정 분석 모델 재학습"""
    try:
        logger.info(f"감정 모델 재학습 요청 - 최소 피드백 수: {request.min_feedback_count}")
        
        # 재학습 서비스 실행 (환경변수에서 자동 설정)
        retrain_service = get_retrain_service()
        result = retrain_service.run_retrain_cycle(min_feedback_count=request.min_feedback_count)
        
        logger.info(f"재학습 결과: {result}")
        return result
        
    except Exception as e:
        logger.error(f"감정 모델 재학습 실패: {str(e)}")
        raise HTTPException(status_code=500, detail=f"모델 재학습 중 오류 발생: {str(e)}")

@app.post("/classify-category")
async def classify_category_endpoint(request: CategoryClassificationRequest):
    """일기 내용 카테고리 분류"""
    try:
        logger.info(f"카테고리 분류 요청 - 내용 길이: {len(request.content)}")
        categories = category_classifier.classify_diary_content(request.content)
        logger.info(f"분류된 카테고리: {categories}")
        return {"categories": categories}
    except Exception as e:
        logger.error(f"카테고리 분류 중 오류 발생: {str(e)}")
        raise HTTPException(status_code=500, detail=f"카테고리 분류 중 오류 발생: {str(e)}")


def build_story_prompt(request: BackgroundStoryRequest) -> str:
    prompt = f"""다음 정보를 바탕으로 입양 동물의 감동적인 배경 스토리를 작성해주세요:

    동물 이름: {request.petName}
    품종: {request.breed}
    나이: {request.age}
    성별: {request.gender}"""

    if request.personality:
        prompt += f"\n성격: {request.personality}"
    
    if request.userPrompt:
        prompt += f"\n추가 요청사항: {request.userPrompt}"
    
    prompt += """

    다음 조건을 만족하는 스토리를 작성해주세요:
    1. 따뜻하고 감동적인 톤으로 작성
    2. 200-300자 정도의 적절한 길이
    3. 입양을 고려하는 사람들이 공감할 수 있는 내용
    4. 동물의 개성과 특성을 잘 드러내는 내용
    5. 새로운 가족을 기다리는 마음을 표현
    6. 자연스럽고 읽기 쉬운 한국어로 작성"""
    
    return prompt

def get_classifier():
    """CLIP 모델을 lazy loading으로 초기화"""
    global classifier
    if classifier is None:
        try:
            logger.info("CLIP 모델 초기화 시작...")
            from diary.diary_image_classifier import DiaryImageClassifier
            classifier = DiaryImageClassifier(use_finetuned=False)
            logger.info("CLIP 모델 초기화 완료")
        except Exception as e:
            logger.error(f"CLIP 모델 초기화 실패: {str(e)}")
            raise HTTPException(status_code=500, detail=f"CLIP 모델 초기화 실패: {str(e)}")
    return classifier

@app.post("/classify-image")
async def classify_image(file: UploadFile = File(...)):
    """
    이미지 업로드 후 CLIP으로 분류, LLM으로 보완
    """
    try:
        logger.info(f"이미지 분류 요청 수신 - 파일명: {file.filename}, 타입: {file.content_type}")
        
        if not file or not file.filename:
            raise HTTPException(status_code=422, detail="파일이 제공되지 않았습니다.")
        
        image_bytes = await file.read()
        logger.info(f"이미지 바이트 읽기 완료 - 크기: {len(image_bytes)} bytes")
        
        if len(image_bytes) == 0:
            raise HTTPException(status_code=422, detail="빈 파일입니다.")
        
        # CLIP 분류 (lazy loading)
        logger.info("CLIP 모델로 이미지 분류 시작")
        clip_classifier = get_classifier()
        result = clip_classifier.classify_image(image_bytes)
        logger.info(f"CLIP 분류 결과: {result}")
        category = result["category"]
        confidence = result["confidence"]
        
        # LLM으로 결과 보완
        image_b64 = base64.b64encode(image_bytes).decode("utf-8")
        prompt = f"""
        다음 이미지는 펫 용품입니다. CLIP 모델이 '{category}'로 분류했습니다 (확률: {confidence:.4f}).
        이미지를 보고 해당 용품이 다음 카테고리 중 어디에 속하는지 확인하고, 간단한 설명을 제공해주세요:
        - 강아지 약
        - 사료
        - 장난감
        - 옷
        - 용품
        - 간식
        """
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "user", "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_b64}"}},
                ]}
            ],
            max_tokens=200
        )
        llm_result = response.choices[0].message.content.strip()
        
        logger.info(f"Image classified: CLIP={result}, LLM={llm_result}")
        
        # 백엔드에서 기대하는 형식으로 응답
        return {
            "clip_result": {
                "category": category,
                "confidence": confidence
            },
            "llm_result": llm_result,
            "category": category  # 직접 접근 가능하도록 추가
        }
    except Exception as e:
        logger.error(f"Image classification endpoint failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"이미지 분류 중 오류 발생: {str(e)}")

@app.post("/update-embeddings")
async def update_embeddings(request: EmbeddingUpdateRequest = None):
    """임베딩 업데이트 실행"""
    try:
        logger.info("임베딩 업데이트 요청 받음")
        
        # EmbeddingUpdater 인스턴스 생성
        updater = EmbeddingUpdater()
        
        # 임베딩이 없는 상품 수 확인
        naver_count = updater.count_naver_products_without_embedding()
        regular_count = updater.count_regular_products_without_embedding()
        total_count = naver_count + regular_count
        logger.info(f"임베딩이 없는 상품 수: 네이버 {naver_count}개, 일반 {regular_count}개, 총 {total_count}개")
        
        if total_count == 0:
            logger.info("모든 상품에 임베딩이 이미 설정되어 있습니다.")
            return {
                "success": True,
                "message": "모든 상품에 임베딩이 이미 설정되어 있습니다.",
                "updated_count": 0
            }
        
        # 백그라운드에서 임베딩 업데이트 실행
        def run_embedding_update():
            try:
                logger.info("백그라운드에서 임베딩 업데이트 시작")
                updater.update_all_embeddings()
                logger.info("백그라운드 임베딩 업데이트 완료")
            except Exception as e:
                logger.error(f"백그라운드 임베딩 업데이트 실패: {str(e)}")
        
        # 별도 스레드에서 실행
        thread = threading.Thread(target=run_embedding_update)
        thread.daemon = True
        thread.start()
        
        logger.info("임베딩 업데이트가 백그라운드에서 시작되었습니다.")
        return {
            "success": True,
            "message": f"임베딩 업데이트가 백그라운드에서 시작되었습니다. 총 {total_count}개 상품을 처리합니다.",
            "updated_count": total_count,
            "status": "processing"
        }
        
    except Exception as e:
        logger.error(f"임베딩 업데이트 실패: {str(e)}")
        raise HTTPException(status_code=500, detail=f"임베딩 업데이트 중 오류 발생: {str(e)}")

@app.get("/embedding-status")
async def get_embedding_status():
    """임베딩 처리 상태 확인"""
    try:
        updater = EmbeddingUpdater()
        naver_count = updater.count_naver_products_without_embedding()
        regular_count = updater.count_regular_products_without_embedding()
        total_products = naver_count + regular_count
        
        return {
            "success": True,
            "remaining_products": total_products,
            "naver_remaining": naver_count,
            "regular_remaining": regular_count,
            "status": "completed" if total_products == 0 else "processing",
            "message": "모든 임베딩이 완료되었습니다." if total_products == 0 else f"임베딩 처리 중입니다. 남은 상품: {total_products}개"
        }
    except Exception as e:
        logger.error(f"임베딩 상태 확인 실패: {str(e)}")
        raise HTTPException(status_code=500, detail=f"임베딩 상태 확인 중 오류 발생: {str(e)}")

class EmbeddingSearchRequest(BaseModel):
    query: str
    limit: int = 10

@app.post("/search-embeddings")
async def search_embeddings(request: EmbeddingSearchRequest):
    """임베딩 기반 상품 검색"""
    try:
        logger.info(f"임베딩 검색 요청: '{request.query}', limit: {request.limit}")
        
        updater = EmbeddingUpdater()
        
        # @태그가 있는지 확인
        import re
        pet_tags = re.findall(r'@([ㄱ-ㅎ가-힣a-zA-Z0-9_]+)', request.query)
        
        if pet_tags:
            # @태그가 있으면 MyPet 검색 사용 (petId는 별도로 전달받아야 함)
            logger.info(f"@태그 발견: {pet_tags}, 일반 검색으로 처리")
            # TODO: petId를 어떻게 받을지 결정 필요
        
        # 일반 임베딩 검색 수행 (최소 유사도 0.3 적용)
        similar_products = await updater.search_similar_products(request.query, request.limit, min_similarity=0.3)
        
        logger.info(f"임베딩 검색 완료: {len(similar_products)}개 결과")
        
        return {
            "success": True,
            "results": similar_products,
            "message": f"임베딩 검색 완료: {len(similar_products)}개 결과"
        }
        
    except Exception as e:
        logger.error(f"임베딩 검색 실패: {str(e)}")
        raise HTTPException(status_code=500, detail=f"임베딩 검색 중 오류 발생: {str(e)}")

@app.get("/")
async def root():
    return {"message": "Dog Breed Classifier API"}

# 서버 시작 시 vectorstore 초기화 제거 (보험 챗봇은 별도 처리)
initialize_vectorstore()