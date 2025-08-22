import torch
import torch.nn as nn
import torchvision.transforms as transforms
import torchvision.models as models
from torchvision.models import ResNet50_Weights
from PIL import Image
import torch.nn.functional as F
from pathlib import Path
from .emotion_labels import DOG_EMOTIONS, EMOTION_KOREAN

class DogEmotionModel(nn.Module):
    """
    강아지 감정 분류를 위한 ResNet50 기반 모델
    Transfer Learning 적용
    """
    
    def __init__(self, num_classes=4, pretrained=True, dropout_rate=0.3):
        """
        Args:
            num_classes (int): 감정 클래스 수 (기본값: 4 - angry, happy, relaxed, sad)
            pretrained (bool): ImageNet 사전 학습된 가중치 사용 여부
            dropout_rate (float): Dropout 비율
        """
        super(DogEmotionModel, self).__init__()
        
        self.num_classes = num_classes
        
        # ResNet50 백본 모델 로드
        if pretrained:
            weights = ResNet50_Weights.IMAGENET1K_V2
            self.backbone = models.resnet50(weights=weights)
        else:
            self.backbone = models.resnet50(weights=None)
        
        # 원본 분류 헤드 제거
        self.backbone = nn.Sequential(*list(self.backbone.children())[:-1])  # avgpool까지만
        
        # 커스텀 분류 헤드 구성
        self.classifier = nn.Sequential(
            nn.AdaptiveAvgPool2d((1, 1)),  # Global Average Pooling
            nn.Flatten(),
            nn.Dropout(dropout_rate),
            nn.Linear(2048, 512),          # 첫 번째 FC 레이어
            nn.ReLU(inplace=True),
            nn.BatchNorm1d(512),
            nn.Dropout(dropout_rate),
            nn.Linear(512, 256),           # 두 번째 FC 레이어
            nn.ReLU(inplace=True),
            nn.BatchNorm1d(256),
            nn.Dropout(dropout_rate),
            nn.Linear(256, num_classes)    # 최종 분류 레이어
        )
        
        # 감정 라벨 매핑
        self.emotion_labels = ['angry', 'happy', 'relaxed', 'sad']
        self.emotion_to_idx = {emotion: idx for idx, emotion in enumerate(self.emotion_labels)}
        self.idx_to_emotion = {idx: emotion for emotion, idx in self.emotion_to_idx.items()}
    
    def forward(self, x):
        """
        순전파 함수
        
        Args:
            x (torch.Tensor): 입력 이미지 텐서 (N, 3, 224, 224)
            
        Returns:
            torch.Tensor: 클래스별 로짓 (N, num_classes)
        """
        # 백본 네트워크를 통한 특성 추출
        features = self.backbone(x)
        
        # 분류 헤드를 통한 최종 예측
        logits = self.classifier(features)
        
        return logits

class DogEmotionClassifier:
    def __init__(self, model_path=None):
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        
        # 학습된 모델 생성
        self.model = DogEmotionModel(
            num_classes=4,
            pretrained=True,
            dropout_rate=0.3
        )
        
        # 학습된 가중치 로드
        if model_path is None:
            # 기본 모델 경로 설정
            model_path = Path(__file__).parent / "checkpoints_finetune" / "best_model.pth"
        
        if Path(model_path).exists():
            try:
                checkpoint = torch.load(model_path, map_location=self.device)
                # 체크포인트에서 모델 상태만 로드
                if 'model_state_dict' in checkpoint:
                    self.model.load_state_dict(checkpoint['model_state_dict'])
                    print(f"✅ 학습된 모델 가중치 로드 완료: {model_path}")
                else:
                    self.model.load_state_dict(checkpoint)
                    print(f"✅ 모델 가중치 로드 완료: {model_path}")
            except Exception as e:
                print(f"⚠️ 학습된 가중치 로드 실패: {e}")
                print("🔧 사전 학습된 ResNet50 가중치를 사용합니다.")
        else:
            print(f"⚠️ 모델 파일을 찾을 수 없습니다: {model_path}")
            print("🔧 사전 학습된 ResNet50 가중치를 사용합니다.")
        
        self.model.eval()
        self.model.to(self.device)
        
        self.transform = transforms.Compose([
            transforms.Resize(256),
            transforms.CenterCrop(224),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], 
                               std=[0.229, 0.224, 0.225])
        ])
    
    def predict(self, image_bytes):
        image = Image.open(image_bytes).convert('RGB')
        input_tensor = self.transform(image).unsqueeze(0).to(self.device)
        
        with torch.no_grad():
            outputs = self.model(input_tensor)
            probabilities = F.softmax(outputs, dim=1)
            
        # Get top prediction
        top_prob, top_idx = torch.max(probabilities, 1)
        
        emotion_idx = top_idx.item()
        confidence = top_prob.item() * 100
        
        emotion_en = DOG_EMOTIONS[emotion_idx]
        emotion_kr = EMOTION_KOREAN[emotion_en]
        
        # 모든 감정의 확률 계산 (100%가 되도록 정규화)
        all_probabilities = probabilities[0]
        emotions_distribution = {}
        for idx, emotion in DOG_EMOTIONS.items():
            prob = all_probabilities[idx].item() * 100
            emotions_distribution[emotion] = round(prob, 1)
        
        return {
            "emotion": emotion_en,
            "emotionKorean": emotion_kr,
            "confidence": round(confidence, 1),
            "emotions": emotions_distribution
        }