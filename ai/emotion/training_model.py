"""
강아지 감정 분류를 위한 개선된 PyTorch 모델
Transfer Learning을 활용한 ResNet50 기반 모델
"""

import torch
import torch.nn as nn
import torchvision.models as models
from torchvision.models import ResNet50_Weights
import torch.nn.functional as F
import sys
import io

# Windows 콘솔에서 한글 출력 (기본 인코딩 사용)

class DogEmotionModel(nn.Module):
    """
    강아지 감정 분류를 위한 ResNet50 기반 모델
    Transfer Learning 적용
    """
    
    def __init__(self, num_classes=4, pretrained=True, dropout_rate=0.5):
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
            print("✅ ImageNet 사전 학습된 ResNet50 가중치 로드됨")
        else:
            self.backbone = models.resnet50(weights=None)
            print("🔧 무작위 초기화된 ResNet50 모델 생성됨")
        
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
        
        print(f"🎭 감정 클래스 매핑: {self.emotion_to_idx}")
    
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
    
    def predict_emotion(self, x, return_probabilities=False):
        """
        감정 예측 함수
        
        Args:
            x (torch.Tensor): 입력 이미지 텐서
            return_probabilities (bool): 확률 반환 여부
            
        Returns:
            dict: 예측 결과
        """
        self.eval()
        with torch.no_grad():
            logits = self(x)
            probabilities = F.softmax(logits, dim=1)
            
            # 최고 확률의 감정 예측
            top_prob, top_idx = torch.max(probabilities, dim=1)
            
            # 배치별 결과 처리
            results = []
            for i in range(len(top_idx)):
                emotion_idx = top_idx[i].item()
                confidence = top_prob[i].item()
                emotion_name = self.idx_to_emotion[emotion_idx]
                
                result = {
                    'emotion': emotion_name,
                    'confidence': confidence,
                    'emotion_idx': emotion_idx
                }
                
                if return_probabilities:
                    result['probabilities'] = {
                        self.idx_to_emotion[idx]: prob.item() 
                        for idx, prob in enumerate(probabilities[i])
                    }
                
                results.append(result)
        
        return results[0] if len(results) == 1 else results
    
    def freeze_backbone(self):
        """백본 네트워크의 가중치를 고정합니다 (분류 헤드만 학습)"""
        for param in self.backbone.parameters():
            param.requires_grad = False
        print("🔒 백본 네트워크 가중치가 고정되었습니다. 분류 헤드만 학습됩니다.")
    
    def unfreeze_backbone(self):
        """백본 네트워크의 가중치를 해제합니다 (전체 모델 학습)"""
        for param in self.backbone.parameters():
            param.requires_grad = True
        print("🔓 백본 네트워크 가중치가 해제되었습니다. 전체 모델이 학습됩니다.")
    
    def get_trainable_params(self):
        """학습 가능한 파라미터 수를 반환합니다"""
        trainable_params = sum(p.numel() for p in self.parameters() if p.requires_grad)
        total_params = sum(p.numel() for p in self.parameters())
        
        print(f"📊 모델 파라미터:")
        print(f"   - 학습 가능: {trainable_params:,}개")
        print(f"   - 전체: {total_params:,}개")
        print(f"   - 비율: {trainable_params/total_params*100:.1f}%")
        
        return trainable_params, total_params

def create_model(num_classes=4, pretrained=True, dropout_rate=0.5, freeze_backbone=True):
    """
    모델 생성 헬퍼 함수
    
    Args:
        num_classes (int): 감정 클래스 수
        pretrained (bool): 사전 학습된 가중치 사용 여부
        dropout_rate (float): Dropout 비율
        freeze_backbone (bool): 백본 네트워크 고정 여부
        
    Returns:
        DogEmotionModel: 생성된 모델
    """
    model = DogEmotionModel(
        num_classes=num_classes,
        pretrained=pretrained,
        dropout_rate=dropout_rate
    )
    
    if freeze_backbone:
        model.freeze_backbone()
    
    model.get_trainable_params()
    
    return model

def test_model():
    """모델 테스트 함수"""
    print("🧪 모델 테스트 시작...")
    
    # 모델 생성
    model = create_model(
        num_classes=4,
        pretrained=True,
        freeze_backbone=True,
        dropout_rate=0.5
    )
    
    # 테스트 입력 생성 (배치 크기 2)
    batch_size = 2
    test_input = torch.randn(batch_size, 3, 224, 224)
    
    print(f"\n🔍 테스트 입력 형태: {test_input.shape}")
    
    # 순전파 테스트
    model.eval()
    with torch.no_grad():
        # 로짓 출력
        logits = model(test_input)
        print(f"📊 로짓 출력 형태: {logits.shape}")
        print(f"📊 로짓 값 범위: [{logits.min():.3f}, {logits.max():.3f}]")
        
        # 감정 예측
        predictions = model.predict_emotion(test_input, return_probabilities=True)
        
        print(f"\n🎭 예측 결과:")
        for i, pred in enumerate(predictions):
            print(f"   샘플 {i+1}: {pred['emotion']} (신뢰도: {pred['confidence']:.3f})")
            print(f"   확률 분포: {pred['probabilities']}")
    
    print("\n✅ 모델 테스트 완료!")
    return model

if __name__ == "__main__":
    # 모델 테스트 실행
    model = test_model()
    
    print("\n🎉 모델이 성공적으로 구현되었습니다!")
    print("🚀 이제 학습 스크립트를 구현할 수 있습니다!")