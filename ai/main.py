from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI
import io
import base64
import logging
import sys
import os
import tempfile
import asyncio
import threading

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
from diary.diary_image_classifier import DiaryImageClassifier

# embedding_update.py 모듈 import
from embedding_update import EmbeddingUpdater

# Adoption Agent 모듈 import
from adoption_agent.agent_service import agent_service

# 로깅 설정
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = FastAPI()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY", ""))
classifier = DiaryImageClassifier(use_finetuned=False)  # Zero-shot CLIP

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://meongtory.shop"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
        logger.info(f"Received query: {request.query}")
        response = await process_rag_query(request.query)
        logger.info(f"Query response: {response['answer']}")
        return response
    except Exception as e:
        logger.error(f"Error processing chatbot query: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Chatbot endpoint failed: {str(e)}")

@app.post("/chatbot/insurance")
async def insurance_chatbot_endpoint(request: InsuranceQueryRequest):
    """보험 전용 챗봇 쿼리 처리"""
    try:
        logger.info(f"Received insurance query: {request.query}")
        response = await process_insurance_rag_query(request.query)
        logger.info(f"Insurance query response: {response['answer']}")
        return response
    except Exception as e:
        logger.error(f"Error processing insurance chatbot query: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Insurance chatbot endpoint failed: {str(e)}")

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

@app.post("/classify-image")
async def classify_image(file: UploadFile = File(...)):
    """
    이미지 업로드 후 CLIP으로 분류, LLM으로 보완
    """
    try:
        image_bytes = await file.read()
        # CLIP 분류
        result = classifier.classify_image(image_bytes)
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
        return {
            "clip_result": result,
            "llm_result": llm_result
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
        
        # 검색어를 임베딩으로 변환
        query_embedding = updater.generate_embedding(request.query)
        if not query_embedding:
            logger.error("검색어 임베딩 생성 실패")
            return {"success": False, "results": [], "message": "검색어 임베딩 생성에 실패했습니다."}
        
        # PostgreSQL에서 cosine similarity로 유사한 상품 검색
        similar_products = updater.search_similar_products(query_embedding, request.limit)
        
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