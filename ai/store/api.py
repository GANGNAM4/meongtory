from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import logging
from .animal_recommender import AnimalRecommender

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# FastAPI 앱 생성
app = FastAPI(
    title="StoreAI API",
    description="반려동물 상품 추천 AI 서비스",
    version="1.0.0"
)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# AnimalRecommender 인스턴스 생성
recommender = AnimalRecommender()

# Pydantic 모델들
class RecommendationRequest(BaseModel):
    age: int
    breed: str
    petType: Optional[str] = "dog"
    productCategory: Optional[str] = None
    productName: Optional[str] = None
    recommendationType: Optional[str] = None
    # 의료기록 관련 필드들 추가
    medicalHistory: Optional[str] = None
    vaccinations: Optional[str] = None
    specialNeeds: Optional[str] = None
    notes: Optional[str] = None
    microchipId: Optional[str] = None

class RecommendationResponse(BaseModel):
    success: bool
    recommendations: str
    season: str
    error: Optional[str] = None

class BreedRecommendationResponse(BaseModel):
    special_care: List[str]
    activities: List[str]
    products: List[str]

class CategoryResponse(BaseModel):
    categories: List[str]

# API 엔드포인트들
@app.get("/")
async def root():
    """API 루트 엔드포인트"""
    return {
        "message": "StoreAI API 서비스",
        "version": "1.0.0",
        "endpoints": {
            "recommend": "/storeai/recommend",
            "breed_recommendations": "/storeai/breed-recommendations",
            "categories": "/storeai/categories",
            "health": "/storeai/health"
        }
    }

@app.get("/storeai/health")
async def health_check():
    """헬스 체크 엔드포인트"""
    return {"status": "healthy", "service": "StoreAI"}

@app.post("/storeai/recommend", response_model=RecommendationResponse)
async def recommend_products(request: RecommendationRequest):
    """
    상품 추천 엔드포인트
    
    Args:
        request: 추천 요청 데이터
        
    Returns:
        추천 결과
    """
    try:
        logger.info(f"추천 요청 받음: {request}")
        
        # 필수 파라미터 검증
        if request.age is None:
            raise HTTPException(status_code=400, detail="나이 정보가 필요합니다")
        
        if not request.breed:
            raise HTTPException(status_code=400, detail="품종 정보가 필요합니다")
        
        # 현재 계절 가져오기
        season = recommender.get_season()
        
        # GPT 추천 생성
        recommendations = recommender.recommend_products_with_gpt(
            age=request.age,
            breed=request.breed,
            pet_type=request.petType or "dog",
            season=season,
            product_category=request.productCategory,
            product_name=request.productName,
            recommendation_type=request.recommendationType,
            medical_history=request.medicalHistory,
            vaccinations=request.vaccinations,
            special_needs=request.specialNeeds,
            notes=request.notes,
            microchip_id=request.microchipId
        )
        
        logger.info(f"추천 생성 완료: {recommendations[:100]}...")
        
        return RecommendationResponse(
            success=True,
            recommendations=recommendations,
            season=season
        )
        
    except Exception as e:
        logger.error(f"추천 생성 실패: {e}")
        return RecommendationResponse(
            success=False,
            recommendations="추천을 생성할 수 없습니다.",
            season=recommender.get_season(),
            error=str(e)
        )

@app.get("/storeai/breed-recommendations/{breed}", response_model=BreedRecommendationResponse)
async def get_breed_recommendations(breed: str, pet_type: str = "dog"):
    """
    품종별 특별 추천 엔드포인트
    
    Args:
        breed: 품종명
        pet_type: 동물 타입 (dog, cat)
        
    Returns:
        품종별 특별 추천 정보
    """
    try:
        logger.info(f"품종별 추천 요청: {breed}, {pet_type}")
        
        recommendations = recommender.get_breed_specific_recommendations(breed, pet_type)
        
        return BreedRecommendationResponse(**recommendations)
        
    except Exception as e:
        logger.error(f"품종별 추천 생성 실패: {e}")
        raise HTTPException(status_code=500, detail=f"품종별 추천 생성 실패: {str(e)}")

@app.get("/storeai/categories", response_model=CategoryResponse)
async def get_categories():
    """
    상품 카테고리 목록 엔드포인트
    
    Returns:
        상품 카테고리 목록
    """
    try:
        categories = recommender.get_product_categories()
        return CategoryResponse(categories=categories)
        
    except Exception as e:
        logger.error(f"카테고리 조회 실패: {e}")
        raise HTTPException(status_code=500, detail=f"카테고리 조회 실패: {str(e)}")

@app.get("/storeai/season")
async def get_current_season():
    """현재 계절 정보 엔드포인트"""
    try:
        season = recommender.get_season()
        return {"season": season}
        
    except Exception as e:
        logger.error(f"계절 정보 조회 실패: {e}")
        raise HTTPException(status_code=500, detail=f"계절 정보 조회 실패: {str(e)}")

# 에러 핸들러
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error(f"전역 예외 발생: {exc}")
    return {"error": "서버 내부 오류가 발생했습니다.", "detail": str(exc)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=9000)
