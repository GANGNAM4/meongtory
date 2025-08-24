import openai
import logging
from typing import Dict, List, Optional
from datetime import datetime
from .config import OPENAI_API_KEY, DEFAULT_TEMPERATURE, MAX_TOKENS

# OpenAI 클라이언트 설정
if OPENAI_API_KEY:
    openai.api_key = OPENAI_API_KEY

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class AnimalRecommender:
    def __init__(self):
        self.seasonal_products = {
            "summer": ["쿨매트", "시원한 간식", "여름용 장난감", "냉각 패드"],
            "winter": ["보온 패드", "따뜻한 옷", "겨울용 간식", "실내 장난감"],
            "spring": ["산책용품", "봄 간식", "실외 장난감"],
            "autumn": ["보온용품", "가을 간식", "실내 장난감"]
        }
        
        self.breed_specific_products = {
            "푸들": ["푸들 전용 샴푸", "컬 관리용품", "푸들 전용 사료"],
            "골든리트리버": ["골든 전용 사료", "활동량 높은 장난감", "털 관리용품"],
            "말티즈": ["말티즈 전용 사료", "소형 장난감", "털 관리용품"],
            "치와와": ["치와와 전용 사료", "초소형 장난감", "보온용품"]
        }
        
        self.age_specific_products = {
            "puppy": ["퍼피 사료", "유아용 장난감", "성장 보조제"],
            "adult": ["성견 사료", "일반 장난감", "건강 관리용품"],
            "senior": ["시니어 사료", "부드러운 장난감", "관절 보조제"]
        }

    def get_season(self) -> str:
        """현재 계절을 반환합니다."""
        month = datetime.now().month
        if month in [12, 1, 2]:
            return "winter"
        elif month in [3, 4, 5]:
            return "spring"
        elif month in [6, 7, 8]:
            return "summer"
        else:
            return "autumn"

    def recommend_products_with_gpt(self, age: int, breed: str, pet_type: str, 
                                  season: str, product_category: str = None, 
                                  product_name: str = None, recommendation_type: str = None) -> str:
        """GPT를 사용하여 상품 추천을 생성합니다."""
        try:
            if not OPENAI_API_KEY:
                return self.get_fallback_recommendation(age, breed, pet_type, season, product_category, product_name, recommendation_type)
            
            # 프롬프트 구성
            prompt = self._build_recommendation_prompt(age, breed, pet_type, season, product_category, product_name, recommendation_type)
            
            response = openai.ChatCompletion.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "당신은 반려동물 상품 추천 전문가입니다. 사용자의 펫 정보와 요청에 맞는 맞춤형 상품을 추천해주세요."},
                    {"role": "user", "content": prompt}
                ],
                temperature=DEFAULT_TEMPERATURE,
                max_tokens=MAX_TOKENS
            )
            
            return response.choices[0].message.content.strip()
            
        except Exception as e:
            logger.error(f"GPT 추천 생성 실패: {e}")
            return self.get_fallback_recommendation(age, breed, pet_type, season, product_category, product_name, recommendation_type)

    def _build_recommendation_prompt(self, age: int, breed: str, pet_type: str, 
                                   season: str, product_category: str = None, 
                                   product_name: str = None, recommendation_type: str = None) -> str:
        """추천 프롬프트를 구성합니다."""
        prompt = f"""
다음 정보를 바탕으로 네이버 쇼핑에서 구할 수 있는 반려동물 상품을 추천해주세요:

펫 정보:
- 나이: {age}살
- 품종: {breed}
- 종류: {pet_type}
- 현재 계절: {season}

추천 요청:
- 추천 타입: {recommendation_type or '일반'}
- 상품 카테고리: {product_category or '전체'}
- 상품명: {product_name or '없음'}

중요: 네이버 쇼핑에서 실제로 판매되는 상품만 추천해주세요. 
다음 형식으로 추천해주세요:
1. [추천 상품명] - [추천 이유]
2. [추천 상품명] - [추천 이유]
3. [추천 상품명] - [추천 이유]

추천 이유는 펫의 나이, 품종, 계절 등을 고려하여 구체적으로 설명해주세요.
네이버 쇼핑에서 검색 가능한 실제 상품명을 사용해주세요.
"""
        return prompt

    def get_fallback_recommendation(self, age: int, breed: str, pet_type: str, 
                                  season: str, product_category: str = None, 
                                  product_name: str = None, recommendation_type: str = None) -> str:
        """GPT 실패 시 사용할 기본 추천 로직입니다."""
        recommendations = []
        
        # 나이별 추천
        if age <= 1:
            recommendations.extend(self.age_specific_products["puppy"])
        elif age >= 7:
            recommendations.extend(self.age_specific_products["senior"])
        else:
            recommendations.extend(self.age_specific_products["adult"])
        
        # 품종별 추천
        for breed_key, products in self.breed_specific_products.items():
            if breed_key in breed:
                recommendations.extend(products)
                break
        
        # 계절별 추천
        recommendations.extend(self.seasonal_products.get(season, []))
        
        # 중복 제거 및 상위 5개 선택
        unique_recommendations = list(dict.fromkeys(recommendations))[:5]
        
        result = []
        for i, product in enumerate(unique_recommendations, 1):
            reason = self._get_fallback_reason(product, age, breed, season)
            result.append(f"{i}. {product} - {reason}")
        
        return "\n".join(result)

    def _get_fallback_reason(self, product: str, age: int, breed: str, season: str) -> str:
        """기본 추천 이유를 생성합니다."""
        reasons = []
        
        if "퍼피" in product and age <= 1:
            reasons.append("어린 강아지에게 적합")
        elif "시니어" in product and age >= 7:
            reasons.append("노령견에게 적합")
        elif "쿨" in product or "시원" in product:
            reasons.append("여름철 쿨링 효과")
        elif "보온" in product or "따뜻" in product:
            reasons.append("겨울철 보온 효과")
        elif breed in product:
            reasons.append(f"{breed}에게 특화")
        
        if not reasons:
            reasons.append("반려동물 건강에 좋은 상품")
        
        return ", ".join(reasons)

    def extract_recommendations_from_text(self, text: str) -> List[Dict[str, str]]:
        """텍스트에서 추천 상품을 추출합니다."""
        recommendations = []
        lines = text.split('\n')
        
        for line in lines:
            line = line.strip()
            if line and (line[0].isdigit() or line.startswith('-')):
                # 번호나 불릿 제거
                clean_line = line.lstrip('0123456789.- ').strip()
                if ' - ' in clean_line:
                    product, reason = clean_line.split(' - ', 1)
                    recommendations.append({
                        'product': product.strip(),
                        'reason': reason.strip()
                    })
        
        return recommendations

    def get_product_categories(self) -> List[str]:
        """상품 카테고리 목록을 반환합니다."""
        return [
            "사료", "간식", "장난감", "케어용품", "건강관리", 
            "의류", "산책용품", "위생용품", "숙소용품"
        ]

    def get_breed_specific_recommendations(self, breed: str, pet_type: str) -> Dict[str, List[str]]:
        """품종별 특별 관리 및 활동 추천을 반환합니다."""
        recommendations = {
            "special_care": [],
            "activities": [],
            "products": []
        }
        
        breed_lower = breed.lower()
        
        if "푸들" in breed_lower:
            recommendations["special_care"] = ["정기적인 털 관리 필요", "컬 유지를 위한 특별 케어"]
            recommendations["activities"] = ["지능놀이", "훈련", "수영"]
            recommendations["products"] = ["푸들 전용 샴푸", "컬 관리용품"]
        elif "골든리트리버" in breed_lower:
            recommendations["special_care"] = ["털 관리", "관절 건강 관리"]
            recommendations["activities"] = ["물놀이", "공놀이", "산책"]
            recommendations["products"] = ["골든 전용 사료", "활동량 높은 장난감"]
        elif "말티즈" in breed_lower:
            recommendations["special_care"] = ["털 관리", "눈물 관리"]
            recommendations["activities"] = ["실내 놀이", "산책"]
            recommendations["products"] = ["말티즈 전용 사료", "소형 장난감"]
        elif "치와와" in breed_lower:
            recommendations["special_care"] = ["체온 관리", "치아 관리"]
            recommendations["activities"] = ["실내 놀이", "짧은 산책"]
            recommendations["products"] = ["치와와 전용 사료", "보온용품"]
        else:
            recommendations["special_care"] = ["정기적인 건강검진", "기본적인 털 관리"]
            recommendations["activities"] = ["산책", "놀이"]
            recommendations["products"] = ["기본 사료", "일반 장난감"]
        
        return recommendations
