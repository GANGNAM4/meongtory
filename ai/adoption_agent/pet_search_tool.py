#!/usr/bin/env python3
"""
Pet 검색 Function Tool
- 사용자 프롬프트 분석
- 백엔드 API를 통한 Pet 검색
- OpenAI Function으로 사용할 수 있도록 구현
"""

import requests
import os
from typing import List, Dict, Any, Optional
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
        1단계: 필수 조건 필터링 (나이, 지역)
        2단계: 필터링된 결과에 점수 부여
        
        Args:
            pets (List[Dict]): 입양 가능한 펫 리스트
            preferences (str): 사용자 선호도 텍스트
            
        Returns:
            List[Dict]: 점수가 추가된 펫 리스트
        """
        preferences_lower = preferences.lower()
        
        # 1단계: 필수 조건 추출
        required_age_min = self._extract_age_requirement(preferences_lower)
        required_regions = self._extract_region_requirement(preferences_lower)
        
        # 2단계: 필수 조건으로 필터링
        filtered_pets = []
        for pet in pets:
            # 나이 필수 조건 체크
            if required_age_min is not None:
                pet_age = pet.get('age', 0)
                if pet_age < required_age_min:
                    continue  # 나이 조건 불만족 시 제외
            
            # 지역 필수 조건 체크
            if required_regions:
                pet_location = pet.get('location', '').lower()
                region_match = False
                for region in required_regions:
                    if region in pet_location:
                        region_match = True
                        break
                if not region_match:
                    continue  # 지역 조건 불만족 시 제외
            
            filtered_pets.append(pet)
        
        logger.info(f"필수 조건 필터링 결과: {len(pets)}개 → {len(filtered_pets)}개")
        if required_age_min:
            logger.info(f"나이 필수 조건: {required_age_min}살 이상")
        if required_regions:
            logger.info(f"지역 필수 조건: {required_regions}")
        
        # 3단계: 필터링된 결과에 점수 부여
        scored_pets = []
        
        for pet in filtered_pets:
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
            
            # 나이 매칭 (필터링 후라서 기본 점수만)
            age = pet.get('age', 0)
            
            # 일반적인 생애 단계별 선호도 점수
            if any(keyword in preferences_lower for keyword in ['어린', '새끼', '퍼피']) and age <= 1:
                score += 1.0
                reasons.append("어린 강아지")
            elif any(keyword in preferences_lower for keyword in ['성견', '어른']) and 1 < age < 7:
                score += 1.0
                reasons.append("성견")
            elif any(keyword in preferences_lower for keyword in ['시니어', '늙은', '노령']) and age >= 7:
                score += 1.0
                reasons.append("시니어견")
            
            # 활발함 우선 체크 (활발한 나이대 선호)
            if any(keyword in preferences_lower for keyword in ['활발한', '활동적인', '에너지', '운동']):
                if age >= 1 and age <= 6:  # 활발한 나이대
                    score += 1.5
                    reasons.append("활발한 나이대")
            
            # 성격 매칭 (활발함 우선)
            personality = pet.get('personality', '').lower()
            
            # 활발한 성격 우선 매칭
            if any(keyword in preferences_lower for keyword in ['활발한', '활발', '장난기', '에너지', '운동', '활동적']):
                if any(trait in personality for trait in ['활발', '장난기', '에너지', '활동적', '운동']):
                    score += 4.0  # 성격 매칭에 높은 점수
                    reasons.append("요청한 활발한 성격")
                elif any(trait in personality for trait in ['온순', '차분', '조용', '얌전']):
                    score -= 2.0  # 반대 성격이면 감점
                    reasons.append("성격 불일치 (온순함)")
            # 온순한 성격 매칭
            elif any(keyword in preferences_lower for keyword in ['온순', '차분', '조용', '얌전']):
                if any(trait in personality for trait in ['온순', '차분', '조용', '얌전']):
                    score += 3.0
                    reasons.append("요청한 온순한 성격")
                elif any(trait in personality for trait in ['활발', '장난기', '에너지']):
                    score -= 1.5
                    reasons.append("성격 불일치 (활발함)")
            
            # 성별 매칭
            if 'male' in preferences_lower or '수컷' in preferences_lower:
                if pet.get('gender') == 'MALE':
                    score += 1.0
                    reasons.append("수컷")
            elif 'female' in preferences_lower or '암컷' in preferences_lower:
                if pet.get('gender') == 'FEMALE':
                    score += 1.0
                    reasons.append("암컷")
            
            # 지역 매칭 (필터링 후라서 기본 점수만)
            location = pet.get('location', '').lower()
            pet_location = pet.get('location', '')
            
            # 필터링을 통과했다면 지역이 맞는 것이므로 기본 점수 부여
            score += 2.0  # 지역 매칭 기본 점수
            reasons.append(f"지역 매칭 ({pet_location})")
            
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
    
    def _extract_age_requirement(self, preferences_lower: str) -> Optional[int]:
        """사용자 선호도에서 나이 필수 조건 추출"""
        import re
        
        # "4살 이상", "4세 이상", "4년 이상" 패턴 매칭
        age_patterns = [
            r'(\d+)살\s*이상',
            r'(\d+)세\s*이상', 
            r'(\d+)년\s*이상',
            r'(\d+)\s*이상',
        ]
        
        for pattern in age_patterns:
            match = re.search(pattern, preferences_lower)
            if match:
                age = int(match.group(1))
                logger.info(f"나이 필수 조건 추출: {age}살 이상")
                return age
        
        return None
    
    def _extract_region_requirement(self, preferences_lower: str) -> List[str]:
        """사용자 선호도에서 지역 필수 조건 추출"""
        required_regions = []
        
        # 주요 도시/지역 매핑
        region_mapping = {
            '서울': ['서울', '강남', '강북', '송파', '서초', '종로', '중구', '용산', '마포', '영등포'],
            '경기': ['경기', '수원', '성남', '고양', '용인', '부천', '안산', '안양', '평택', '시흥'],
            '부산': ['부산', '해운대', '수영', '동래', '부산진', '사하', '북구', '서구'],
            '대구': ['대구', '수성', '달서', '북구', '중구', '동구', '서구', '달성'],
            '인천': ['인천', '연수', '남동', '부평', '계양', '서구', '중구', '동구'],
            '광주': ['광주', '서구', '남구', '북구', '동구', '광산'],
            '대전': ['대전', '유성', '서구', '중구', '동구', '대덕'],
            '울산': ['울산', '남구', '중구', '동구', '북구', '울주'],
            '충북': ['충북', '청주', '충주', '제천', '보은', '옥천', '영동', '증평', '진천', '괴산', '음성', '단양'],
            '충남': ['충남', '천안', '공주', '보령', '아산', '서산', '논산', '계룡', '당진', '금산', '부여', '서천', '청양', '홍성', '예산', '태안'],
            '전북': ['전북', '전주', '군산', '익산', '정읍', '남원', '김제', '완주', '진안', '무주', '장수', '임실', '순창', '고창', '부안'],
            '전남': ['전남', '목포', '여수', '순천', '나주', '광양', '담양', '곡성', '구례', '고흥', '보성', '화순', '장흥', '강진', '해남', '영암', '무안', '함평', '영광', '장성', '완도', '진도', '신안'],
            '경북': ['경북', '포항', '경주', '김천', '안동', '구미', '영주', '영천', '상주', '문경', '경산', '군위', '의성', '청송', '영양', '영덕', '청도', '고령', '성주', '칠곡', '예천', '봉화', '울진', '울릉'],
            '경남': ['경남', '창원', '진주', '통영', '사천', '김해', '밀양', '거제', '양산', '의령', '함안', '창녕', '고성', '남해', '하동', '산청', '함양', '거창', '합천'],
            '제주': ['제주', '서귀포']
        }
        
        # 지역 키워드 확인
        for region_key, region_list in region_mapping.items():
            if any(keyword in preferences_lower for keyword in [region_key, region_key + '에', region_key + '에서']):
                required_regions.extend(region_list)
                logger.info(f"지역 필수 조건 추출: {region_key} ({region_list})")
                break
        
        return required_regions

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