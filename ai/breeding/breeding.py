import os
from openai import OpenAI
from pydantic import BaseModel
import sys
import io
from dotenv import load_dotenv

# breed 디렉토리의 model.py를 import하기 위해 경로 추가
sys.path.append(os.path.join(os.path.dirname(os.path.dirname(__file__)), 'breed'))
from breed.model import DogBreedClassifier

# 환경 변수 로드
load_dotenv()

# OpenAI 설정
openai_api_key = os.getenv("OPENAI_API_KEY", "")
if not openai_api_key:
    raise ValueError("OPENAI_API_KEY not set")

# OpenAI 클라이언트 초기화
client = OpenAI(api_key=openai_api_key)

classifier = DogBreedClassifier()

class BreedingPrediction(BaseModel):
    resultBreed: str
    probability: int
    traits: list[str]
    description: str
    image: str

def predict_breeding(parent1_image: bytes, parent2_image: bytes) -> BreedingPrediction:
    """
    두 부모 이미지를 받아 품종을 분석하고 LLM으로 교배 시뮬레이션
    Args:
        parent1_image: 첫 번째 부모 이미지 바이트
        parent2_image: 두 번째 부모 이미지 바이트
    Returns:
        BreedingPrediction 객체
    """
    try:
        # 1. 품종 예측
        parent1_breed = classifier.predict(io.BytesIO(parent1_image))["breed"]
        parent2_breed = classifier.predict(io.BytesIO(parent2_image))["breed"]

        # 2. LLM 프롬프트 구성
        prompt = f"""부모 강아지 품종: {parent1_breed} + {parent2_breed}

다음 JSON 형식으로만 응답해주세요. 다른 텍스트는 포함하지 마세요:

{{
  "resultBreed": "혼합견 이름",
  "probability": 예측확률숫자,
  "traits": ["특성1", "특성2", "특성3", "특성4"],
  "description": "100-200자 설명"
}}

자연스러운 한국어로 작성해주세요."""
        #  Gengxin(3. OpenAI API 호출
        model_name = os.getenv("OPENAI_BREEDING_MODEL", "gpt-3.5-turbo")
        response = client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": "당신은 강아지 품종과 특성을 예측하는 전문가입니다."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=300,
            temperature=0.7
        )

        # 4. 응답 파싱
        result = response.choices[0].message.content.strip()
        print(f"OpenAI 응답: {result}")
        
        import json
        try:
            prediction = json.loads(result)
        except json.JSONDecodeError:
            # JSON이 아닌 경우 기본값 반환
            print(f"JSON 파싱 실패, 응답 내용: {result}")
            prediction = {
                "resultBreed": f"{parent1_breed} × {parent2_breed} 믹스",
                "probability": 75,
                "traits": ["활발함", "친근함", "충성심", "지능적"],
                "description": f"{parent1_breed}와 {parent2_breed}의 특성을 모두 가진 활발하고 사랑스러운 믹스견입니다."
            }

        # probability 값을 백분율로 변환
        probability = prediction["probability"]
        if isinstance(probability, str):
            probability = int(probability.replace("%", ""))
        elif isinstance(probability, float):
            # 실수를 백분율로 변환 (0.75 -> 75)
            probability = int(probability * 100)
        else:
            probability = int(probability)

        # 5. DALL-E 이미지 생성
        image_url = ""
        try:
            image_model = os.getenv("OPENAI_IMAGE_MODEL", "dall-e-3")
            image_prompt = (
                f"A photorealistic puppy that looks like a mix between a {parent1_breed} and a {parent2_breed}. "
                f"Natural coat colors and texture, soft lighting, shallow depth of field, "
                f"studio-quality photograph, centered, neutral background."
            )
            
            image_response = client.images.generate(
                model=image_model,
                prompt=image_prompt,
                size="1024x1024",
                quality="standard",
                n=1
            )
            
            image_url = image_response.data[0].url
            print(f"이미지 생성 성공: {image_url}")
            
        except Exception as img_error:
            print(f"이미지 생성 실패: {str(img_error)}")
            image_url = ""

        return BreedingPrediction(
            resultBreed=prediction["resultBreed"],
            probability=probability,
            traits=prediction["traits"],
            description=prediction["description"],
            image=image_url
        )
    except Exception as e:
        raise Exception(f"교배 예측 실패: {str(e)}")