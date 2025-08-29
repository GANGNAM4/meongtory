from .models import ContractSuggestionRequest, ClauseSuggestionRequest, ContractGenerationRequest

def build_contract_suggestion_prompt(request: ContractSuggestionRequest) -> str:
    prompt = """다음 정보를 바탕으로 계약서에 추가할 수 있는 조항 제목들을 추천해주세요.

중요: 조항 제목만 추천해주세요. 내용은 나중에 계약서 생성 단계에서 작성됩니다.

예시 형식:
- " (건강관리)"
- " (의료비용)"
- " (반려동물 행동)"
- " (식사 및 영양)"
- " (임시보호)"

이제 다음 정보를 바탕으로 조항 제목들을 추천해주세요:

"""
    
    if request.petInfo:
        prompt += f"반려동물 정보:\n"
        prompt += f"- 이름: {request.petInfo.get('name', 'N/A')}\n"
        prompt += f"- 품종: {request.petInfo.get('breed', 'N/A')}\n"
        prompt += f"- 나이: {request.petInfo.get('age', 'N/A')}\n"
        prompt += f"- 건강상태: {request.petInfo.get('healthStatus', 'N/A')}\n\n"
    
    if request.userInfo:
        prompt += f"사용자 정보:\n"
        prompt += f"- 이름: {request.userInfo.get('name', 'N/A')}\n"
        prompt += f"- 연락처: {request.userInfo.get('phone', 'N/A')}\n"
        prompt += f"- 이메일: {request.userInfo.get('email', 'N/A')}\n\n"
    
    if request.currentContent:
        prompt += f"현재 계약서 내용:\n{request.currentContent}\n\n"
    
    prompt += """위 정보를 바탕으로 다음 조건을 만족하는 조항 제목들을 추천해주세요:

1. 반려동물의 특성(품종, 나이, 건강상태)을 고려한 맞춤형 조항 제목
2. 입양인의 상황과 책임을 명확히 하는 조항 제목
3. 실제 계약서에서 유용한 조항 제목
4. '제목' 형식으로 작성

각 조항은 제목 형식으로만 작성해주세요."""
    
    return prompt

def build_clause_suggestion_prompt(request: ClauseSuggestionRequest) -> str:
    prompt = """다음 정보를 바탕으로 계약서에 추가할 수 있는 구체적인 조항 제목들을 추천해주세요.

중요: 반려동물의 특성(품종, 나이, 건강상태)과 입양인의 상황을 고려하여 맞춤형 조항 제목을 제시해주세요.

"""
    
    if request.petInfo:
        prompt += f"반려동물 정보:\n"
        prompt += f"- 이름: {request.petInfo.get('name', 'N/A')}\n"
        prompt += f"- 품종: {request.petInfo.get('breed', 'N/A')}\n"
        prompt += f"- 나이: {request.petInfo.get('age', 'N/A')}\n"
        prompt += f"- 건강상태: {request.petInfo.get('healthStatus', 'N/A')}\n\n"
    
    if request.userInfo:
        prompt += f"사용자 정보:\n"
        prompt += f"- 이름: {request.userInfo.get('name', 'N/A')}\n"
        prompt += f"- 연락처: {request.userInfo.get('phone', 'N/A')}\n"
        prompt += f"- 이메일: {request.userInfo.get('email', 'N/A')}\n\n"
    
    if request.currentClauses:
        prompt += f"현재 선택된 조항들:\n"
        for clause in request.currentClauses:
            prompt += f"- {clause}\n"
        prompt += "\n"
    
    prompt += """위 정보를 바탕으로 다음 조건을 만족하는 조항 제목들을 추천해주세요:

1. 반려동물의 특성을 고려한 맞춤형 조항
2. 입양인의 책임과 의무를 명확히 하는 조항
3. 실제 계약서에서 유용한 조항
4. 구체적인 제목 형식으로 작성

예시 조항 제목들:
-  (건강관리 및 의료비용)
-  (반려동물 행동 및 훈련)
-  (식사 및 영양 관리)
-  (임시보호 및 위탁)
-  (책임과 의무)
-  (계약 해지 및 반환)
-  (분쟁 해결)

반려동물의 특성에 따라 추가할 수 있는 조항들:
- 노령견인 경우: "(노령견 특별 관리)"
- 특정 질병이 있는 경우: "(질병 관리 및 치료)"
- 대형견인 경우: "(운동 및 활동 관리)"
- 어린 동물인 경우: "(성장기 특별 관리)"

각 조항 제목은 '(제목)' 형식으로 작성해주세요."""
    
    return prompt

def build_template_based_contract_prompt(request: ContractGenerationRequest) -> str:
    """
    조항 제목 기반으로 계약서 생성 프롬프트를 구성합니다.
    """
    pet_name = request.petInfo.get('name', '') if request.petInfo else ''
    
    prompt = f"""다음 조항들을 바탕으로 '{pet_name} 계약서'를 작성해주세요.

중요: placeholder나 변수명을 사용하지 말고, 실제 정보로 완성된 계약서를 작성해주세요.

계약서 제목: {pet_name} 계약서

선택된 조항들:
"""
    
    # 조항 제목들을 순서대로 추가
    if request.templateSections:
        for i, section in enumerate(sorted(request.templateSections, key=lambda x: x.get('orderNum', 0)), 1):
            prompt += f"{i}. {section.get('title', '')}\n"
        prompt += "\n"
    
    # 반려동물 정보 추가
    if request.petInfo:
        prompt += "반려동물 정보:\n"
        for key, value in request.petInfo.items():
            prompt += f"- {key}: {value}\n"
        prompt += "\n"
    
    # 사용자 정보 추가
    if request.userInfo:
        prompt += "사용자 정보:\n"
        for key, value in request.userInfo.items():
            prompt += f"- {key}: {value}\n"
        prompt += "\n"
    
    # 커스텀 섹션 추가
    if request.customSections:
        prompt += "추가할 조항들:\n"
        for section in request.customSections:
            if isinstance(section, dict) and 'title' in section:
                prompt += f"- {section['title']}\n"
            else:
                prompt += f"- {section}\n"
        prompt += "\n"
    
    # 제거할 섹션들
    if request.removedSections:
        prompt += "제거할 조항들:\n"
        for section in request.removedSections:
            prompt += f"- {section}\n"
        prompt += "\n"
    
    # 추가 정보
    if request.additionalInfo:
        prompt += f"추가 정보:\n{request.additionalInfo}\n\n"
    
    prompt += f"""지시사항:
1. '{pet_name} 계약서'라는 제목으로 계약서를 작성해주세요.
2. 위 조항들을 순서대로 포함하여 완성된 계약서를 작성해주세요.
3. 각 조항의 내용은 반려동물과 사용자 정보를 고려하여 적절히 작성해주세요.
4. [대괄호] 안의 placeholder를 실제 정보로 대체해주세요.
5. 제거할 조항은 포함하지 말아주세요.
6. 추가할 조항은 적절한 위치에 배치해주세요.
7. 완성된 계약서 형태로 작성해주세요.
8. placeholder나 변수명을 사용하지 말고 실제 정보를 직접 입력해주세요.
9. 서명란 위에 날짜 부분의 직접 작성할수 있도록 공간을 남겨주세요.

예시 형식:
{pet_name} 계약서

제1조 (목적)
본 계약은 {pet_name}의 입양과 관련된 당사자들의 권리와 의무를 명시합니다.

제2조 (당사자)
입양인: [실제 신청자 이름]
연락처: [실제 연락처]
이메일: [실제 이메일]

보호소: 멍토리 보호소
대표자: 홍길동
주소: 서울시 강남구...
연락처: 02-1234-5678

제3조 (반려동물 정보)
이름: {pet_name}
품종: [실제 품종]
나이: [실제 나이]
건강상태: [실제 건강상태]

[이하 각 조항별로 적절한 내용 작성]"""
    
    return prompt 