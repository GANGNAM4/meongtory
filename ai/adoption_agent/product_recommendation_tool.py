#!/usr/bin/env python3
"""
상품 추천 Function Tool
- 선택된 강아지 정보 기반 상품 추천
- 기존 StoreAI 서비스 활용
- 임시 Pet 객체 생성하여 추천 시스템 호출
"""

import requests
import os
from typing import List, Dict, Any, Optional
import logging
import json

logger = logging.getLogger(__name__)

class ProductRecommendationTool:
    def __init__(self):
        self.backend_url = os.getenv("BACKEND_SERVICE_URL", "http://backend:8080")
        
        # 품종별 추천 카테고리 (하드코딩, 추후 개선 예정)
        self.breed_categories = {
            "골든리트리버": ["사료", "관절 영양제", "대형견 용품", "운동 용품"],
            "래브라도": ["사료", "체중 관리", "운동 용품", "장난감"],
            "치와와": ["소형견 사료", "치아 관리", "보온 용품", "캐리어"],
            "푸들": ["털 관리", "사료", "미용 용품", "장난감"],
            "포메라니안": ["소형견 사료", "털 관리", "보온 용품", "치아 관리"],
            "비글": ["사료", "운동 용품", "귀 관리", "장난감"],
            "코기": ["관절 관리", "체중 관리", "사료", "운동 용품"],
            "진돗개": ["사료", "털 관리", "운동 용품", "장난감"],
            "믹스견": ["사료", "기본 용품", "장난감", "건강 관리"]
        }
        
    def recommend_products(self, selected_pet: Dict[str, Any]) -> Dict[str, Any]:
        """
        선택된 강아지 정보를 바탕으로 상품 추천
        
        Args:
            selected_pet (Dict): 선택된 강아지 정보
                
        Returns:
            Dict: 추천 상품 리스트
        """
        try:
            logger.info(f"상품 추천 시작 - Pet: {selected_pet.get('name')} ({selected_pet.get('breed')})")
            
            # DB에 저장된 상품들을 가져와서 추천
            db_products = self._get_db_products(selected_pet)
            
            # NaverProduct가 충분하지 않으면 일반 상품으로 보완
            if len(db_products) < 6:
                fallback_products = self._get_fallback_products(selected_pet)
                db_products.extend(fallback_products)
                logger.info(f"일반 상품 {len(fallback_products)}개를 추가로 가져왔습니다")
            
            # 점수 계산
            scored_products = self._score_products_for_pet(db_products, selected_pet)
            
            # 상위 6개 선택 (카테고리별로 다양하게)
            top_products = self._select_diverse_products(scored_products, limit=6)
            
            return {
                "success": True,
                "recommendations": top_products,
                "pet_info": {
                    "name": selected_pet.get('name'),
                    "breed": selected_pet.get('breed'),
                    "age": selected_pet.get('age'),
                    "recommended_categories": self._get_breed_categories(selected_pet.get('breed'))
                },
                "message": f"{selected_pet.get('name')}({selected_pet.get('breed')})에게 필요한 상품 {len(top_products)}개를 추천합니다."
            }
            
        except Exception as e:
            logger.error(f"상품 추천 중 오류: {str(e)}")
            return {
                "success": False,
                "error": f"추천 오류: {str(e)}",
                "recommendations": []
            }
    
    def _get_db_products(self, pet: Dict[str, Any]) -> List[Dict]:
        """DB에 저장된 NaverProduct를 활용한 상품 추천"""
        try:
            breed = pet.get('breed', '강아지')
            age = pet.get('age', 3)
            
            # 품종별 검색 키워드 생성
            search_keywords = self._generate_search_keywords_for_db(pet)
            
            db_products = []
            
            # 키워드를 너무 많이 사용하지 않도록 제한 (성능 고려)
            import random
            max_keywords = 15  # 최대 15개 키워드만 사용
            if len(search_keywords) > max_keywords:
                # 중요한 키워드 우선 선택 + 랜덤 선택
                important_keywords = [kw for kw in search_keywords if any(word in kw for word in ['사료', breed, '강아지'])][:8]
                remaining_keywords = [kw for kw in search_keywords if kw not in important_keywords]
                random.shuffle(remaining_keywords)
                search_keywords = important_keywords + remaining_keywords[:max_keywords - len(important_keywords)]
            
            logger.info(f"실제 검색에 사용할 키워드: {search_keywords}")
            
            # 키워드별로 DB 상품 검색
            for keyword in search_keywords:
                try:
                    # 백엔드 NaverProduct API 호출 (검색 기능)
                    response = requests.get(
                        f"{self.backend_url}/api/naver-shopping/products/search",
                        params={"keyword": keyword, "size": 10},
                        timeout=10
                    )
                    
                    if response.status_code == 200:
                        data = response.json()
                        # ResponseDto 구조에서 data 추출
                        if data.get('success') and data.get('data'):
                            # Page 객체에서 content 추출
                            page_data = data['data']
                            products = page_data.get('content', []) if isinstance(page_data, dict) else []
                            
                            for product in products:
                                db_products.append({
                                    'productId': product.get('id', ''),
                                    'name': product.get('title', ''),
                                    'description': product.get('description', product.get('title', '')),
                                    'price': product.get('price', 0),
                                    'imageUrl': product.get('imageUrl', ''),
                                    'category': self._categorize_product(product.get('title', '')),
                                    'source': 'DB_NAVER',
                                    'mallName': product.get('mallName', ''),
                                    'productUrl': product.get('productUrl', ''),
                                    'search_keyword': keyword
                                })
                        
                except Exception as e:
                    logger.warning(f"DB 상품 검색 실패 ({keyword}): {str(e)}")
                    continue
            
            # 중복 제거 (productId 기준)
            unique_products = []
            seen_ids = set()
            for product in db_products:
                product_id = product.get('productId')
                if product_id and product_id not in seen_ids:
                    unique_products.append(product)
                    seen_ids.add(product_id)
            
            logger.info(f"DB에서 찾은 상품 수: {len(unique_products)}")
            return unique_products[:20]  # 최대 20개
            
        except Exception as e:
            logger.error(f"DB 상품 추천 실패: {str(e)}")
            return []
    
    def _generate_search_keywords_for_db(self, pet: Dict[str, Any]) -> List[str]:
        """DB 검색용 키워드 생성 - 다양한 키워드로 검색"""
        breed = pet.get('breed', '강아지')
        age = pet.get('age', 3)
        keywords = []
        
        # 1. 기본 키워드 (더 다양하게)
        basic_keywords = [
            "강아지", "사료", "장난감", "용품", "간식", "목줄", "하네스", 
            "리드줄", "배변패드", "캐리어", "쿠션", "침대", "그릇", "급수기"
        ]
        keywords.extend(basic_keywords)
        
        # 2. 품종 관련 키워드
        if breed and breed != '강아지':
            keywords.extend([breed, f"{breed} 전용", f"{breed} 맞춤"])
        
        # 3. 크기별 키워드
        size_keywords = []
        if any(small_breed in breed.lower() for small_breed in ['치와와', '푸들', '포메라니안', '요크셔']) if breed else False:
            size_keywords = ["소형견", "미니", "스몰"]
        elif any(large_breed in breed.lower() for large_breed in ['골든리트리버', '래브라도', '저먼셰퍼드']) if breed else False:
            size_keywords = ["대형견", "라지", "빅"]
        else:
            size_keywords = ["중형견", "중간"]
        keywords.extend(size_keywords)
        
        # 4. 나이별 키워드
        if age <= 1:
            keywords.extend(["퍼피", "어린", "유아", "새끼"])
        elif age >= 7:
            keywords.extend(["시니어", "노령", "늙은", "관절", "영양제"])
        else:
            keywords.extend(["성견", "어른", "활동", "운동"])
        
        # 5. 카테고리별 키워드 (품종별 특화)
        breed_categories = self._get_breed_categories(breed)
        category_mapping = {
            "사료": ["사료", "건식", "습식", "자연식"],
            "장난감": ["장난감", "놀이", "볼", "로프", "인형"],
            "용품": ["용품", "액세서리", "목줄", "하네스"],
            "건강관리": ["영양제", "건강", "비타민", "관절"],
            "미용": ["샴푸", "브러시", "미용", "털관리"],
            "훈련": ["훈련", "교육", "매트", "패드"]
        }
        
        for category in breed_categories:
            if category in category_mapping:
                keywords.extend(category_mapping[category])
        
        # 6. 랜덤성을 위한 일반 키워드 추가
        general_keywords = [
            "반려동물", "애완", "펫", "도그", "개", "멍멍이",
            "건강", "영양", "맛있는", "프리미엄", "천연", "유기농"
        ]
        keywords.extend(general_keywords)
        
        # 중복 제거 후 반환
        unique_keywords = list(set(keywords))
        logger.info(f"생성된 검색 키워드: {unique_keywords[:10]}... (총 {len(unique_keywords)}개)")
        return unique_keywords
    
    def _get_fallback_products(self, pet: Dict[str, Any]) -> List[Dict]:
        """DB 검색 실패 시 대체 상품 (일반 상품 API)"""
        try:
            # 백엔드 일반 상품 API 호출
            response = requests.get(
                f"{self.backend_url}/api/products",
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                fallback_products = []
                
                # ResponseDto에서 data 추출
                products = data.get('data', []) if data.get('success') else []
                
                for product in products[:10]:  # 최대 10개
                    fallback_products.append({
                        'productId': product.get('id', ''),
                        'name': product.get('name', ''),
                        'description': product.get('description', ''),
                        'price': product.get('price', 0),
                        'imageUrl': product.get('imageUrl', ''),
                        'category': product.get('category', '용품'),
                        'source': 'DB_REGULAR',
                        'mallName': 'MeongTory Store',
                        'productUrl': f"/store/{product.get('id', '')}",
                        'search_keyword': '일반상품'
                    })
                
                return fallback_products
            
        except Exception as e:
            logger.warning(f"대체 상품 조회 실패: {str(e)}")
        
        return []
    
    
    def _score_products_for_pet(self, products: List[Dict], pet: Dict[str, Any]) -> List[Dict]:
        """강아지 정보를 기반으로 상품에 점수 부여"""
        pet_breed = pet.get('breed', '').lower() if pet.get('breed') else ""
        pet_age = pet.get('age', 0)
        
        scored_products = []
        
        for product in products:
            score = 0.0
            reasons = []
            
            product_name = product.get('name', '').lower()
            description = product.get('description', '').lower()
            full_text = f"{product_name} {description}"
            
            # 1. 품종 매칭
            if pet_breed and pet_breed in full_text:
                score += 3.0
                reasons.append(f"{pet.get('breed')} 품종 전용")
            
            # 2. 나이별 적합성
            if pet_age <= 1 and any(keyword in full_text for keyword in ['퍼피', '유아', '어린']):
                score += 2.5
                reasons.append("어린 강아지용")
            elif pet_age >= 7 and any(keyword in full_text for keyword in ['시니어', '노령', '관절']):
                score += 2.5
                reasons.append("시니어견용")
            elif 1 < pet_age < 7 and any(keyword in full_text for keyword in ['성견', '어른']):
                score += 2.0
                reasons.append("성견용")
            
            # 3. 필수 카테고리 점수
            essential_categories = self._get_breed_categories(pet.get('breed'))
            for category in essential_categories:
                if category.lower() in full_text:
                    score += 1.5
                    reasons.append(f"필수 카테고리 ({category})")
                    break
            
            # 4. 상품 카테고리별 점수
            category = product.get('category', '')
            if category == '사료':
                score += 2.0
                reasons.append("필수 사료")
            elif category in ['용품', '장난감']:
                score += 1.0
                reasons.append("기본 용품")
            
            # 5. 가격대별 점수 (합리적인 가격대 우선)
            price = product.get('price', 0)
            if 10000 <= price <= 100000:  # 1만원~10만원 합리적 가격대
                score += 0.5
                reasons.append("적정 가격대")
            
            # 6. 기본 점수
            score += 1.0
            
            # 결과에 추가
            product_with_score = product.copy()
            product_with_score['recommendation_score'] = round(score, 2)
            product_with_score['recommendation_reasons'] = reasons if reasons else ["일반 추천"]
            
            scored_products.append(product_with_score)
        
        return scored_products
    
    def _select_diverse_products(self, scored_products: List[Dict], limit: int = 6) -> List[Dict]:
        """카테고리 다양성을 고려하여 상품 선택 (랜덤성 추가)"""
        import random
        
        if not scored_products:
            return []
        
        # 점수 구간별로 그룹화 (상위권, 중위권, 하위권)
        sorted_products = sorted(scored_products, key=lambda x: x['recommendation_score'], reverse=True)
        total_count = len(sorted_products)
        
        # 상위 30%, 중위 40%, 하위 30%로 분할
        top_30_percent = int(total_count * 0.3) or 1
        mid_40_percent = int(total_count * 0.4) or 1
        
        top_tier = sorted_products[:top_30_percent]
        mid_tier = sorted_products[top_30_percent:top_30_percent + mid_40_percent]
        bottom_tier = sorted_products[top_30_percent + mid_40_percent:]
        
        selected_products = []
        used_categories = set()
        
        # 1차: 상위권에서 카테고리 다양성 우선 (60% 확률로 랜덤 선택)
        tier_products = top_tier.copy()
        random.shuffle(tier_products)  # 상위권 내에서 랜덤화
        
        for product in tier_products:
            if len(selected_products) >= limit:
                break
            category = product.get('category', '기타')
            if category not in used_categories:
                selected_products.append(product)
                used_categories.add(category)
        
        # 2차: 중위권에서 남은 자리 채우기 (다양성 고려)
        if len(selected_products) < limit and mid_tier:
            remaining_mid = [p for p in mid_tier if p.get('category', '기타') not in used_categories]
            if remaining_mid:
                random.shuffle(remaining_mid)
                for product in remaining_mid[:limit - len(selected_products)]:
                    selected_products.append(product)
                    used_categories.add(product.get('category', '기타'))
        
        # 3차: 아직 부족하면 남은 상품들에서 선택 (점수 무관하게 다양성 우선)
        if len(selected_products) < limit:
            remaining_products = [p for p in sorted_products if p not in selected_products]
            random.shuffle(remaining_products)
            
            for product in remaining_products:
                if len(selected_products) >= limit:
                    break
                selected_products.append(product)
        
        # 최종 결과도 약간 섞어서 반환 (첫 번째는 최고 점수 보장)
        if len(selected_products) > 1:
            first_product = selected_products[0]  # 최고 점수 상품 보존
            rest_products = selected_products[1:]
            random.shuffle(rest_products)
            selected_products = [first_product] + rest_products
        
        logger.info(f"선택된 상품 카테고리: {[p.get('category') for p in selected_products[:limit]]}")
        return selected_products[:limit]
    
    def _get_breed_categories(self, breed: str) -> List[str]:
        """품종별 추천 카테고리 조회"""
        if not breed:
            return self.breed_categories.get("믹스견", ["사료", "기본 용품"])
        
        breed_lower = breed.lower()
        
        # 정확한 매칭
        for key, categories in self.breed_categories.items():
            if key.lower() == breed_lower:
                return categories
        
        # 부분 매칭
        for key, categories in self.breed_categories.items():
            if key.lower() in breed_lower or breed_lower in key.lower():
                return categories
        
        return self.breed_categories.get("믹스견", ["사료", "기본 용품"])
    
    def _categorize_product(self, product_name: str) -> str:
        """상품명을 기반으로 카테고리 분류"""
        name_lower = product_name.lower()
        
        if any(keyword in name_lower for keyword in ['사료', '식품', '간식']):
            return '사료'
        elif any(keyword in name_lower for keyword in ['장난감', '놀이']):
            return '장난감'
        elif any(keyword in name_lower for keyword in ['옷', '의류', '패드', '캐리어']):
            return '용품'
        elif any(keyword in name_lower for keyword in ['영양제', '건강', '관리']):
            return '건강관리'
        else:
            return '용품'
    
    def _parse_price(self, price_str: str) -> int:
        """가격 문자열을 정수로 변환"""
        try:
            return int(''.join(filter(str.isdigit, str(price_str))))
        except:
            return 0

# OpenAI Function Tool 정의
RECOMMEND_PRODUCTS_FUNCTION = {
    "type": "function",
    "function": {
        "name": "recommend_products", 
        "description": "선택된 강아지의 품종, 나이, 특성을 고려하여 필요한 반려동물 용품을 추천합니다. 사료, 장난감, 용품, 건강관리 상품을 종합적으로 제안합니다.",
        "parameters": {
            "type": "object",
            "properties": {
                "selected_pet": {
                    "type": "object",
                    "description": "사용자가 선택한 강아지 정보", 
                    "properties": {
                        "petId": {"type": "integer", "description": "강아지 ID"},
                        "name": {"type": "string", "description": "강아지 이름"},
                        "breed": {"type": "string", "description": "품종"},
                        "age": {"type": "integer", "description": "나이"},
                        "weight": {"type": "number", "description": "체중"}
                    },
                    "required": ["petId", "name", "breed", "age"]
                }
            },
            "required": ["selected_pet"]
        }
    }
}

# Tool 인스턴스 생성
product_recommendation_tool = ProductRecommendationTool()

def execute_product_recommendation(selected_pet: Dict[str, Any]) -> str:
    """
    OpenAI Assistant에서 호출할 함수
    
    Args:
        selected_pet (Dict): 선택된 강아지 정보
        
    Returns:
        str: JSON 형태의 상품 추천 결과
    """
    import json
    result = product_recommendation_tool.recommend_products(selected_pet)
    return json.dumps(result, ensure_ascii=False)