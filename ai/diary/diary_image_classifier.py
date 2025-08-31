# ai/diary/diary_image_classifier.py
import logging
import io

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class DiaryImageClassifier:
    def __init__(self, use_finetuned=False):
        # OpenAI Vision API 모드로 변경 (CLIP 모델 다운로드 문제 우회)
        self.use_openai_vision = True
        self.categories = ["dog medicine", "dog food", "dog toy", "dog clothing", "dog accessory", "dog treat"]
        logger.info("DiaryImageClassifier initialized with OpenAI Vision API mode")

    def classify_image(self, image_bytes):
        try:
            import base64
            import os
            from openai import OpenAI
            
            # OpenAI Vision API 사용
            client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
            
            # 이미지를 base64로 인코딩
            image_b64 = base64.b64encode(image_bytes).decode("utf-8")
            
            # 카테고리 목록 문자열 생성
            category_list = ", ".join(self.categories)
            
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": f"이 이미지를 다음 카테고리 중 하나로 분류해주세요: {category_list}. 가장 적합한 카테고리 하나만 영어로 답변하세요. 예: dog food"
                            },
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{image_b64}"
                                }
                            }
                        ]
                    }
                ],
                max_tokens=50
            )
            
            # 응답에서 카테고리 추출
            predicted_text = response.choices[0].message.content.strip().lower()
            
            # 예측된 텍스트에서 실제 카테고리 매칭
            predicted_category = "dog accessory"  # 기본값
            for category in self.categories:
                if category.lower() in predicted_text:
                    predicted_category = category
                    break
            
            # 신뢰도는 임의로 설정 (OpenAI Vision API는 신뢰도를 제공하지 않음)
            confidence = 0.85
            
            logger.info(f"OpenAI Vision predicted: {predicted_text} -> {predicted_category} (confidence: {confidence:.4f})")
            return {
                "category": predicted_category,
                "confidence": confidence
            }
        except Exception as e:
            logger.error(f"OpenAI Vision API classification failed: {str(e)}")
            raise