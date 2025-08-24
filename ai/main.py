from fastapi import FastAPI, HTTPException, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI
import io
import tempfile
import sys
import os
import logging

# AI 서비스 모듈들 import
from contract.service import ContractAIService
from contract.models import ContractSuggestionRequest, ClauseSuggestionRequest, ContractGenerationRequest
from story.service import StoryAIService
from story.models import BackgroundStoryRequest
from breeding.breeding import predict_breeding
from breed.breed_api import router as breed_router
from emotion.emotion_api import router as emotion_router
from model import DogBreedClassifier
from chatBot.rag_app import process_rag_query, initialize_vectorstore

# StoreAI 서비스 import
from store.api import app as storeai_app

# transcribe.py 모듈을 import하기 위해 경로 추가
sys.path.append(os.path.join(os.path.dirname(__file__), 'diary'))
from transcribe import transcribe_audio

# 로깅 설정
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = FastAPI()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY", ""))

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
classifier = DogBreedClassifier()

class BackgroundStoryRequest(BaseModel):
    petName: str
    breed: str
    age: str
    gender: str
    personality: str = ""
    userPrompt: str = ""

class QueryRequest(BaseModel):
    query: str

@app.post("/predict")
async def predict_dog_breed(file: UploadFile = File(...)):
    try:
        image_bytes = io.BytesIO(await file.read())
        result = classifier.predict(image_bytes)
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

@app.get("/")
async def root():
    return {"message": "Dog Breed Classifier API"}

# 서버 시작 시 vectorstore 초기화
initialize_vectorstore()