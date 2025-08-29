#!/usr/bin/env python3
"""
보험 추천 Function Tool
- 선택된 강아지 정보 기반 보험 추천
- 품종별 질병 위험도 고려
- 나이대별 보장 내용 최적화
"""

import requests
import os
from typing import List, Dict, Any, Optional
import logging
import json

logger = logging.getLogger(__name__)

class InsuranceRecommendationTool:
    def __init__(self):
        self.backend_url = os.getenv("BACKEND_SERVICE_URL", "http://backend:8080")
        
        # 품종별 위험 질병 정보 (실제로는 DB나 외부 API에서 가져올 수 있음)
        self.breed_risk_info = {
            "골든리트리버": ["관절염", "심장병", "암"],
            "래브라도": ["비만", "관절 질환", "눈 질환"],
            "치와와": ["치아 질환", "심장병", "슬개골 탈구"],
            "푸들": ["피부 질환", "간질", "눈 질환"],
            "포메라니안": ["기관지 허탈", "슬개골 탈구", "치아 질환"],
            "비글": ["간질", "체중 관리", "귀 질환"],
            "코기": ["척추 질환", "비만", "관절 질환"],
            "진돗개": ["알레르기", "피부 질환", "관절 질환"],
            "믹스견": ["일반적인 질환"]
        }
        
    def recommend_insurance(self, selected_pet: Dict[str, Any]) -> Dict[str, Any]:
        """
        선택된 강아지 정보를 바탕으로 보험 상품 추천
        
        Args:
            selected_pet (Dict): 선택된 강아지 정보
                - petId: 강아지 ID
                - name: 이름
                - breed: 품종
                - age: 나이
                - weight: 체중 등
                
        Returns:
            Dict: 추천 보험 상품 리스트
        """
        try:
            logger.info(f"보험 추천 시작 - Pet: {selected_pet.get('name')} ({selected_pet.get('breed')})")
            
            # 백엔드에서 전체 보험 상품 조회
            response = requests.get(
                f"{self.backend_url}/api/insurance",
                timeout=10
            )
            
            if response.status_code != 200:
                return {
                    "success": False,
                    "error": f"보험 API 오류: {response.status_code}",
                    "recommendations": []
                }
            
            insurance_data = response.json()
            all_insurances = insurance_data.get('data', [])
            
            logger.info(f"전체 보험 상품 개수: {len(all_insurances)}")
            
            if not all_insurances:
                return {
                    "success": False,
                    "error": "보험 상품이 없습니다",
                    "recommendations": []
                }
            
            # 강아지 정보 기반 보험 점수 계산
            scored_insurances = self._score_insurances_for_pet(all_insurances, selected_pet)
            
            # 상위 3개 선택
            top_insurances = sorted(scored_insurances, key=lambda x: x['recommendation_score'], reverse=True)[:3]
            
            return {
                "success": True,
                "recommendations": top_insurances,
                "pet_info": {
                    "name": selected_pet.get('name'),
                    "breed": selected_pet.get('breed'),
                    "age": selected_pet.get('age'),
                    "risk_factors": self._get_breed_risks(selected_pet.get('breed'))
                },
                "message": f"{selected_pet.get('name')}({selected_pet.get('breed')})에게 적합한 보험 {len(top_insurances)}개를 추천합니다."
            }
            
        except requests.exceptions.RequestException as e:
            logger.error(f"보험 API 호출 실패: {str(e)}")
            return {
                "success": False,
                "error": f"API 호출 실패: {str(e)}",
                "recommendations": []
            }
        except Exception as e:
            logger.error(f"보험 추천 중 오류: {str(e)}")
            return {
                "success": False,
                "error": f"추천 오류: {str(e)}",
                "recommendations": []
            }
    
    def _score_insurances_for_pet(self, insurances: List[Dict], pet: Dict[str, Any]) -> List[Dict]:
        """
        강아지 정보를 기반으로 보험 상품에 점수 부여
        
        Args:
            insurances (List[Dict]): 전체 보험 상품 리스트
            pet (Dict): 강아지 정보
            
        Returns:
            List[Dict]: 점수가 추가된 보험 상품 리스트
        """
        pet_breed = pet.get('breed', '').lower()
        pet_age = pet.get('age', 0)
        pet_weight = pet.get('weight', 0)
        
        scored_insurances = []
        
        for insurance in insurances:
            score = 0.0
            reasons = []
            
            company = insurance.get('company', '')
            product_name = insurance.get('productName', '')
            description = insurance.get('description', '').lower()

            # features와 coverageDetails는 문자열 리스트이므로, 검색을 위해 하나의 문자열로 합칩니다.
            features_list = insurance.get('features', [])
            features = ' '.join(features_list).lower() if features_list else ''
            
            coverage_details_list = insurance.get('coverageDetails', [])
            coverage_details = ' '.join(coverage_details_list).lower() if coverage_details_list else ''
            
            # 전체 텍스트 (검색용)
            full_text = f"{description} {features} {coverage_details}"
            
            # 1. 품종별 위험 질병 매칭
            breed_risks = self._get_breed_risks(pet.get('breed'))
            for risk in breed_risks:
                if risk.lower() in full_text:
                    score += 3.0
                    reasons.append(f"{pet.get('breed')} 품종 위험 질병 ({risk}) 보장")
            
            # 2. 나이별 적합성
            if pet_age <= 2:  # 어린 강아지
                if any(keyword in full_text for keyword in ['예방', '백신', '기본', '건강검진']):
                    score += 2.0
                    reasons.append("어린 강아지 예방 중심 보장")
            elif 2 < pet_age < 7:  # 성견
                if any(keyword in full_text for keyword in ['종합', '질병', '상해', '수술']):
                    score += 2.0
                    reasons.append("성견 종합 보장")
            else:  # 시니어 (7세 이상)
                if any(keyword in full_text for keyword in ['시니어', '노령', '만성', '암', '관절']):
                    score += 3.0
                    reasons.append("시니어견 전용 보장")
                elif any(keyword in full_text for keyword in ['종합', '고액']):
                    score += 2.0
                    reasons.append("시니어견 종합 보장")
            
            # 3. 크기별 적합성 (품종 기반 추정)
            size_category = self._estimate_dog_size(pet_breed)
            if size_category == "소형" and any(keyword in full_text for keyword in ['소형', '작은']):
                score += 1.5
                reasons.append("소형견 전용")
            elif size_category == "대형" and any(keyword in full_text for keyword in ['대형', '큰']):
                score += 1.5
                reasons.append("대형견 전용")
            
            # 4. 일반적인 중요 보장 내역
            if any(keyword in full_text for keyword in ['응급', '응급실', '24시간']):
                score += 1.5
                reasons.append("응급 진료 보장")
            
            if any(keyword in full_text for keyword in ['수술비', '수술']):
                score += 1.0
                reasons.append("수술비 보장")
            
            if any(keyword in full_text for keyword in ['입원', '입원비']):
                score += 1.0
                reasons.append("입원비 보장")
            
            if any(keyword in full_text for keyword in ['통원', '외래']):
                score += 0.5
                reasons.append("통원비 보장")
            
            # 5. 보험사 신뢰도 (주요 보험사 가산점)
            major_companies = ['현대해상', 'DB손해보험', '삼성화재', 'KB손해보험', '한화손해보험']
            if any(comp in company for comp in major_companies):
                score += 0.5
                reasons.append("대형 보험사")
            
            # 6. 기본 점수
            score += 1.0
            
            # 결과에 추가
            insurance_with_score = insurance.copy()
            insurance_with_score['recommendation_score'] = round(score, 2)
            insurance_with_score['recommendation_reasons'] = reasons if reasons else ["기본 반려동물 보험"]
            insurance_with_score['pet_risk_factors'] = breed_risks
            
            scored_insurances.append(insurance_with_score)
        
        return scored_insurances
    
    def _get_breed_risks(self, breed: str) -> List[str]:
        """품종별 위험 질병 조회"""
        if not breed:
            return ["일반적인 질환"]
        
        breed_lower = breed.lower()
        
        # 정확한 매칭 먼저 시도
        for key, risks in self.breed_risk_info.items():
            if key.lower() == breed_lower:
                return risks
        
        # 부분 매칭 시도
        for key, risks in self.breed_risk_info.items():
            if key.lower() in breed_lower or breed_lower in key.lower():
                return risks
        
        return self.breed_risk_info.get("믹스견", ["일반적인 질환"])
    
    def _estimate_dog_size(self, breed: str) -> str:
        """품종을 기반으로 크기 추정"""
        if not breed:
            return "중형"
        
        breed_lower = breed.lower()
        
        small_breeds = ['치와와', '푸들', '포메라니안', '요크셔테리어', '시츄', '말티즈']
        large_breeds = ['골든리트리버', '래브라도', '저먼셰퍼드', '로트와일러', '그레이트데인']
        
        for small in small_breeds:
            if small in breed_lower:
                return "소형"
        
        for large in large_breeds:
            if large in breed_lower:
                return "대형"
        
        return "중형"

# OpenAI Function Tool 정의
RECOMMEND_INSURANCE_FUNCTION = {
    "type": "function", 
    "function": {
        "name": "recommend_insurance",
        "description": "선택된 강아지의 품종, 나이, 크기 등을 고려하여 최적의 반려동물 보험을 추천합니다. 품종별 위험 질병과 나이대별 필요 보장을 분석합니다.",
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
insurance_recommendation_tool = InsuranceRecommendationTool()

def execute_insurance_recommendation(selected_pet: Dict[str, Any]) -> str:
    """
    OpenAI Assistant에서 호출할 함수
    
    Args:
        selected_pet (Dict): 선택된 강아지 정보
        
    Returns:
        str: JSON 형태의 보험 추천 결과
    """
    import json
    result = insurance_recommendation_tool.recommend_insurance(selected_pet)
    return json.dumps(result, ensure_ascii=False)