#!/usr/bin/env python3
"""
Pet 검색 Function Tool
- 사용자 프롬프트 분석
- 백엔드 API를 통한 Pet 검색
- OpenAI Function으로 사용할 수 있도록 구현
"""

import requests
import os
from typing import List, Dict, Any
import logging

logger = logging.getLogger(__name__)

class PetSearchTool:
    def __init__(self):
        self.backend_url = os.getenv("BACKEND_SERVICE_URL", "http://backend:8080")
        
    def search_pets(self, user_preferences: str) -> Dict[str, Any]:
        """
        사용자 선호도 기반으로 입양 가능한 강아지 검색
        
        Args:
            user_preferences (str): 사용자가 입력한 선호도 텍스트
            
        Returns:
            Dict: 검색 결과 (강아지 리스트)
        """
        try:
            logger.info(f"Pet 검색 시작 - 사용자 선호도: {user_preferences}")
            
            # 백엔드 Pet API 호출
            response = requests.get(
                f"{self.backend_url}/api/pets?adopted=false",
                timeout=10
            )
            
            if response.status_code != 200:
                return {
                    "success": False,
                    "error": f"백엔드 API 오류: {response.status_code}",
                    "pets": []
                }
            
            all_pets_list = response.json()
            logger.info(f"전체 펫 개수: {len(all_pets_list)}")
            
            # 입양 가능한 강아지만 필터링 (adopted = false)
            # API 호출 시 이미 필터링되지만, 안전을 위해 이중 체크
            available_pets = []
            for pet in all_pets_list:
                if not pet.get('adopted', True):
                    available_pets.append({
                        'petId': pet.get('petId'),
                        'name': pet.get('name'),
                        'breed': pet.get('breed'),
                        'age': pet.get('age'),
                        'gender': pet.get('gender'),
                        'description': pet.get('description'),
                        'imageUrl': pet.get('imageUrl'),
                        'location': pet.get('location'),
                        'personality': pet.get('personality'),
                        'specialNeeds': pet.get('specialNeeds'),
                        'weight': pet.get('weight'),
                        'vaccinated': pet.get('vaccinated'),
                        'neutered': pet.get('neutered')
                    })
            
            logger.info(f"입양 가능한 펫 개수: {len(available_pets)}")
            
            # 사용자 선호도 기반 필터링 및 점수 계산
            scored_pets = self._score_pets_by_preferences(available_pets, user_preferences)
            
            # 상위 3개 선택
            top_pets = sorted(scored_pets, key=lambda x: x['match_score'], reverse=True)[:3]
            
            return {
                "success": True,
                "pets": top_pets,
                "total_available": len(available_pets),
                "message": f"사용자 선호도에 맞는 강아지 {len(top_pets)}마리를 찾았습니다."
            }
            
        except requests.exceptions.RequestException as e:
            logger.error(f"백엔드 API 호출 실패: {str(e)}")
            return {
                "success": False,
                "error": f"API 호출 실패: {str(e)}",
                "pets": []
            }
        except Exception as e:
            logger.error(f"Pet 검색 중 오류: {str(e)}")
            return {
                "success": False,
                "error": f"검색 오류: {str(e)}",
                "pets": []
            }
    
    def _score_pets_by_preferences(self, pets: List[Dict], preferences: str) -> List[Dict]:
        """
        사용자 선호도를 기반으로 Pet에 점수 부여
        
        Args:
            pets (List[Dict]): 입양 가능한 펫 리스트
            preferences (str): 사용자 선호도 텍스트
            
        Returns:
            List[Dict]: 점수가 추가된 펫 리스트
        """
        preferences_lower = preferences.lower()
        scored_pets = []
        
        for pet in pets:
            score = 0.0
            reasons = []
            
            # 품종 매칭
            if pet.get('breed') and pet['breed'].lower() in preferences_lower:
                score += 3.0
                reasons.append(f"원하는 품종 ({pet['breed']})")
            
            # 크기 관련 키워드 매칭
            breed = pet.get('breed', '').lower()
            if any(keyword in preferences_lower for keyword in ['소형', '작은', '작']) and \
               any(small_breed in breed for small_breed in ['치와와', '푸들', '포메라니안', '요크셔테리어']):
                score += 2.0
                reasons.append("소형견")
            elif any(keyword in preferences_lower for keyword in ['중형', '중간']) and \
                 any(medium_breed in breed for medium_breed in ['코기', '비글', '보더콜리']):
                score += 2.0
                reasons.append("중형견")
            elif any(keyword in preferences_lower for keyword in ['대형', '큰', '크']) and \
                 any(large_breed in breed for large_breed in ['골든리트리버', '래브라도', '저먼셰퍼드']):
                score += 2.0
                reasons.append("대형견")
            
            # 나이 매칭
            age = pet.get('age', 0)
            if any(keyword in preferences_lower for keyword in ['강아지', '어린', '새끼']) and age <= 1:
                score += 2.0
                reasons.append("어린 강아지")
            elif any(keyword in preferences_lower for keyword in ['성견', '어른']) and 1 < age < 7:
                score += 2.0
                reasons.append("성견")
            elif any(keyword in preferences_lower for keyword in ['시니어', '늙은', '노령']) and age >= 7:
                score += 2.0
                reasons.append("시니어견")
            
            # 성격 매칭
            personality = pet.get('personality', '').lower()
            if any(keyword in preferences_lower for keyword in ['활발', '장난']) and \
               any(trait in personality for trait in ['활발', '장난기']):
                score += 1.5
                reasons.append("활발한 성격")
            elif any(keyword in preferences_lower for keyword in ['온순', '차분', '조용']) and \
                 any(trait in personality for trait in ['온순', '차분']):
                score += 1.5
                reasons.append("온순한 성격")
            
            # 성별 매칭
            if 'male' in preferences_lower or '수컷' in preferences_lower:
                if pet.get('gender') == 'MALE':
                    score += 1.0
                    reasons.append("수컷")
            elif 'female' in preferences_lower or '암컷' in preferences_lower:
                if pet.get('gender') == 'FEMALE':
                    score += 1.0
                    reasons.append("암컷")
            
            # 지역 매칭
            location = pet.get('location', '').lower()
            if location and location in preferences_lower:
                score += 1.5
                reasons.append(f"지역 매칭 ({pet.get('location')})")
            
            # 특수 요구사항 고려
            special_needs = pet.get('specialNeeds')
            if special_needs and any(keyword in preferences_lower for keyword in ['특수', '의료', '치료']):
                score += 1.0
                reasons.append("특수 요구사항 있음")
            elif not special_needs and any(keyword in preferences_lower for keyword in ['건강', '정상']):
                score += 1.0
                reasons.append("특수 요구사항 없음")
            
            # 예방접종 상태
            if pet.get('vaccinated') and any(keyword in preferences_lower for keyword in ['예방접종', '백신']):
                score += 0.5
                reasons.append("예방접종 완료")
            
            # 중성화 상태
            if pet.get('neutered') and any(keyword in preferences_lower for keyword in ['중성화', '수술']):
                score += 0.5
                reasons.append("중성화 완료")
            
            # 기본 점수 (모든 펫에게 부여)
            score += 1.0
            
            # 결과에 추가
            pet_with_score = pet.copy()
            pet_with_score['match_score'] = round(score, 2)
            pet_with_score['match_reasons'] = reasons if reasons else ["기본 매칭"]
            
            scored_pets.append(pet_with_score)
        
        return scored_pets

# OpenAI Function Tool 정의
SEARCH_PETS_FUNCTION = {
    "type": "function",
    "function": {
        "name": "search_pets",
        "description": "사용자의 선호도를 바탕으로 입양 가능한 강아지를 검색합니다. 품종, 크기, 나이, 성격, 지역 등을 고려하여 최적의 강아지 3마리를 추천합니다.",
        "parameters": {
            "type": "object",
            "properties": {
                "user_preferences": {
                    "type": "string",
                    "description": "사용자가 원하는 강아지의 특성 (예: '서울에 있는 소형 온순한 강아지를 찾고 있습니다')"
                }
            },
            "required": ["user_preferences"]
        }
    }
}

# Tool 인스턴스 생성
pet_search_tool = PetSearchTool()

def execute_pet_search(user_preferences: str) -> str:
    """
    OpenAI Assistant에서 호출할 함수
    
    Args:
        user_preferences (str): 사용자 선호도
        
    Returns:
        str: JSON 형태의 검색 결과
    """
    import json
    result = pet_search_tool.search_pets(user_preferences)
    return json.dumps(result, ensure_ascii=False)
