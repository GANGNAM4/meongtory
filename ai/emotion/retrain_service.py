"""
감정 분석 모델 재학습 서비스 모듈
사용자 피드백 데이터를 활용한 모델 성능 개선
"""

import torch
import torch.nn as nn
import torch.optim as optim
import torchvision.transforms as transforms
import requests
import logging
import json
import os
from pathlib import Path
from PIL import Image
import tempfile
from datetime import datetime
from typing import List, Dict, Tuple, Optional
from io import BytesIO
import shutil
import boto3
from botocore.exceptions import NoCredentialsError, PartialCredentialsError

from .model import DogEmotionModel
from .emotion_labels import DOG_EMOTIONS, EMOTION_KOREAN

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class EmotionRetrainService:
    """감정 분석 모델 재학습 서비스"""
    
    def __init__(self, backend_url: str = None):
        """
        재학습 서비스 초기화
        
        Args:
            backend_url (str): 백엔드 서버 URL (None이면 환경변수에서 자동 설정)
        """
        if backend_url is None:
            # AI → 백엔드 전용 환경변수 사용
            self.backend_url = os.getenv("BACKEND_SERVICE_URL", "http://localhost:8080")
        else:
            self.backend_url = backend_url
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        self.emotion_to_idx = {emotion: idx for idx, emotion in enumerate(DOG_EMOTIONS.values())}
        
        # S3 설정
        self.s3_bucket_name = os.getenv("AWS_S3_BUCKET_NAME", "meongtory")
        self.s3_model_key = "emotion/best_model.pth"

        # 현재 모델 경로
        self.current_model_dir = Path(__file__).parent / "checkpoints_finetune"
        self.current_model_path = self.current_model_dir / "best_model.pth"
        
        
        # 임시 데이터 디렉토리
        self.temp_data_dir = Path(__file__).parent / "temp_training_data"
        
        logger.info(f"재학습 서비스 초기화 완료 - 디바이스: {self.device}")
    
    def fetch_feedback_data(self) -> Optional[Dict]:
        """
        백엔드에서 학습용 피드백 데이터 조회
        
        Returns:
            Dict: 피드백 데이터 또는 None
        """
        try:
            url = f"{self.backend_url}/api/emotion/feedback/training-data"
            logger.info(f"피드백 데이터 조회 요청: {url}")
            
            response = requests.get(url, timeout=30)
            response.raise_for_status()
            
            data = response.json()
            if data.get('success', False):
                feedback_data = data.get('data', {})
                logger.info(f"피드백 데이터 조회 성공 - 총 {feedback_data.get('totalCount', 0)}개")
                return feedback_data
            else:
                logger.warning(f"피드백 데이터 조회 실패: {data.get('message', 'Unknown error')}")
                return None
                
        except requests.exceptions.RequestException as e:
            logger.error(f"피드백 데이터 조회 중 네트워크 오류: {e}")
            return None
        except Exception as e:
            logger.error(f"피드백 데이터 조회 중 예외 발생: {e}")
            return None
    
    def download_and_prepare_images(self, feedback_data: Dict) -> Tuple[List, List]:
        """
        피드백 데이터에서 이미지를 다운로드하고 학습용 데이터 준비
        
        Args:
            feedback_data (Dict): 백엔드에서 받은 피드백 데이터
            
        Returns:
            Tuple[List, List]: (이미지 데이터 리스트, 라벨 리스트)
        """
        # 임시 디렉토리 생성
        if self.temp_data_dir.exists():
            shutil.rmtree(self.temp_data_dir)
        self.temp_data_dir.mkdir(parents=True)
        
        images = []
        labels = []
        
        transform = transforms.Compose([
            transforms.Resize(256),
            transforms.CenterCrop(224),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], 
                               std=[0.229, 0.224, 0.225])
        ])
        
        # 긍정 피드백 (올바른 예측) 처리
        positive_feedback = feedback_data.get('positiveFeedback', [])
        logger.info(f"긍정 피드백 처리 중: {len(positive_feedback)}개")
        
        for idx, item in enumerate(positive_feedback):
            try:
                image_url = item.get('imageUrl', '')
                emotion = item.get('correctEmotion', '')
                
                if not image_url or not emotion:
                    continue
                
                # 이미지 다운로드 및 변환
                image_tensor = self._process_image(image_url, transform)
                if image_tensor is not None:
                    emotion_idx = self.emotion_to_idx.get(emotion)
                    if emotion_idx is not None:
                        images.append(image_tensor)
                        labels.append(emotion_idx)
                        
            except Exception as e:
                logger.warning(f"긍정 피드백 {idx} 처리 실패: {e}")
                continue
        
        # 부정 피드백 (틀린 예측) 처리
        negative_feedback = feedback_data.get('negativeFeedback', [])
        logger.info(f"부정 피드백 처리 중: {len(negative_feedback)}개")
        
        for idx, item in enumerate(negative_feedback):
            try:
                image_url = item.get('imageUrl', '')
                correct_emotion = item.get('correctEmotion', '')
                
                if not image_url or not correct_emotion:
                    continue
                
                # 이미지 다운로드 및 변환
                image_tensor = self._process_image(image_url, transform)
                if image_tensor is not None:
                    emotion_idx = self.emotion_to_idx.get(correct_emotion)
                    if emotion_idx is not None:
                        images.append(image_tensor)
                        labels.append(emotion_idx)
                        
            except Exception as e:
                logger.warning(f"부정 피드백 {idx} 처리 실패: {e}")
                continue
        
        logger.info(f"총 {len(images)}개 이미지 처리 완료")
        return images, labels
    
    def _process_image(self, image_url: str, transform) -> Optional[torch.Tensor]:
        """
        이미지 URL에서 이미지를 다운로드하고 전처리
        
        Args:
            image_url (str): 이미지 URL (base64 또는 http URL)
            transform: 이미지 전처리 변환
            
        Returns:
            torch.Tensor: 전처리된 이미지 텐서 또는 None
        """
        try:
            if image_url.startswith('data:image'):
                # Base64 이미지 처리
                header, data = image_url.split(',', 1)
                import base64
                image_data = base64.b64decode(data)
                image = Image.open(BytesIO(image_data)).convert('RGB')
            else:
                # HTTP URL 이미지 처리
                response = requests.get(image_url, timeout=10)
                response.raise_for_status()
                image = Image.open(BytesIO(response.content)).convert('RGB')
            
            # 이미지 변환
            return transform(image)
            
        except Exception as e:
            logger.warning(f"이미지 처리 실패 ({image_url[:50]}...): {e}")
            return None

    def _upload_model_to_s3(self, local_file_path: Path) -> bool:
        """
        학습된 모델을 S3에 업로드
        
        Args:
            local_file_path (Path): 업로드할 로컬 모델 파일 경로
            
        Returns:
            bool: 업로드 성공 여부
        """
        try:
            s3_client = boto3.client('s3')
            logger.info(f"S3에 모델 업로드 시작: {local_file_path} -> s3://{self.s3_bucket_name}/{self.s3_model_key}")
            s3_client.upload_file(str(local_file_path), self.s3_bucket_name, self.s3_model_key)
            logger.info("✅ S3 모델 업로드 완료")
            return True
        except (NoCredentialsError, PartialCredentialsError):
            logger.error("❌ S3 업로드 실패: AWS 자격 증명을 찾을 수 없습니다. 환경변수(AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)를 확인하세요.")
            return False
        except Exception as e:
            logger.error(f"❌ S3 업로드 중 오류 발생: {e}")
            return False
    
    
    def retrain_model(self, images: List[torch.Tensor], labels: List[int], 
                     learning_rate: float = 0.0001, num_epochs: int = 10) -> bool:
        """
        피드백 데이터로 모델 재학습
        
        Args:
            images (List[torch.Tensor]): 학습할 이미지 텐서 리스트
            labels (List[int]): 대응하는 라벨 리스트
            learning_rate (float): 학습률
            num_epochs (int): 에포크 수
            
        Returns:
            bool: 재학습 성공 여부
        """
        if len(images) < 5:  # 최소 데이터 요구사항
            logger.warning(f"재학습 데이터가 부족합니다 ({len(images)}개). 최소 5개 필요.")
            return False
        
        try:
            
            # 현재 모델 로드
            model = DogEmotionModel(num_classes=4, pretrained=True, dropout_rate=0.3)
            
            if self.current_model_path.exists():
                checkpoint = torch.load(self.current_model_path, map_location=self.device)
                if 'model_state_dict' in checkpoint:
                    model.load_state_dict(checkpoint['model_state_dict'])
                    logger.info("기존 모델 가중치 로드 완료")
                else:
                    model.load_state_dict(checkpoint)
                    logger.info("기존 모델 가중치 로드 완료 (단순 형식)")
            else:
                logger.info("기존 모델이 없어 사전 학습된 가중치로 시작")
            
            model.to(self.device)
            model.train()
            
            # 옵티마이저, 손실함수, 스케줄러 설정 (기존 학습과 동일하게)
            optimizer = optim.Adam(model.parameters(), lr=learning_rate, weight_decay=1e-4)
            criterion = nn.CrossEntropyLoss()
            
            # 학습률 스케줄러 추가 (기존 학습과 동일)
            from torch.optim.lr_scheduler import ReduceLROnPlateau
            scheduler = ReduceLROnPlateau(optimizer, mode='min', patience=3, factor=0.5, verbose=True)
            
            # 데이터를 텐서로 변환
            image_tensors = torch.stack(images)
            label_tensors = torch.tensor(labels, dtype=torch.long)
            
            # 배치 크기 설정 (기존 학습과 동일하게)
            batch_size = min(16, len(images))
            
            logger.info(f"재학습 시작 - 데이터: {len(images)}개, 에포크: {num_epochs}, 학습률: {learning_rate}")
            
            # 재학습 수행
            for epoch in range(num_epochs):
                epoch_loss = 0.0
                correct = 0
                total = 0
                
                # 데이터 셔플
                indices = torch.randperm(len(images))
                
                for i in range(0, len(images), batch_size):
                    batch_indices = indices[i:i+batch_size]
                    batch_images = image_tensors[batch_indices].to(self.device)
                    batch_labels = label_tensors[batch_indices].to(self.device)
                    
                    optimizer.zero_grad()
                    
                    outputs = model(batch_images)
                    loss = criterion(outputs, batch_labels)
                    
                    loss.backward()
                    optimizer.step()
                    
                    epoch_loss += loss.item()
                    _, predicted = torch.max(outputs.data, 1)
                    total += batch_labels.size(0)
                    correct += (predicted == batch_labels).sum().item()
                
                accuracy = 100.0 * correct / total
                avg_loss = epoch_loss / (len(images) // batch_size + 1)
                
                # 스케줄러 업데이트 (기존 학습과 동일)
                scheduler.step(avg_loss)
                current_lr = optimizer.param_groups[0]['lr']
                
                logger.info(f"에포크 {epoch+1}/{num_epochs} - Loss: {avg_loss:.4f}, Accuracy: {accuracy:.2f}%, LR: {current_lr:.6f}")
            
            # 재학습된 모델 저장
            logger.info(f"모델 저장 시작 - 경로: {self.current_model_path}")
            logger.info(f"저장 디렉토리 존재 여부: {self.current_model_dir.exists()}")
            
            # 저장 디렉토리가 없으면 생성
            if not self.current_model_dir.exists():
                logger.info("저장 디렉토리 생성 중...")
                self.current_model_dir.mkdir(parents=True, exist_ok=True)
            
            checkpoint = {
                'model_state_dict': model.state_dict(),
                'optimizer_state_dict': optimizer.state_dict(),
                'retrain_info': {
                    'timestamp': datetime.now().isoformat(),
                    'num_feedback_samples': len(images),
                    'learning_rate': learning_rate,
                    'num_epochs': num_epochs,
                    'final_accuracy': accuracy,
                    'final_loss': avg_loss
                }
            }
            
            try:
                # 기존 모델을 백업 (선택사항)
                if self.current_model_path.exists():
                    backup_path = self.current_model_dir / f"best_model_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pth"
                    logger.info(f"기존 모델 백업: {backup_path}")
                    import shutil
                    shutil.copy2(self.current_model_path, backup_path)
                
                torch.save(checkpoint, self.current_model_path)
                logger.info(f"✅ 재학습된 모델 저장 완료: {self.current_model_path}")
                logger.info(f"저장된 파일 크기: {self.current_model_path.stat().st_size} bytes")

                # S3에 업로드
                self._upload_model_to_s3(self.current_model_path)
                
            except Exception as save_error:
                logger.error(f"❌ 모델 저장 실패: {save_error}")
                raise save_error
            
            # 임시 데이터 정리
            if self.temp_data_dir.exists():
                shutil.rmtree(self.temp_data_dir)
            
            return True
            
        except Exception as e:
            logger.error(f"모델 재학습 중 오류 발생: {e}")
            return False
    
    def mark_feedback_as_used(self) -> bool:
        """
        사용된 피드백을 학습에 사용됨으로 표시
        
        Returns:
            bool: 성공 여부
        """
        try:
            url = f"{self.backend_url}/api/emotion/feedback/mark-as-used"
            logger.info(f"피드백 사용 표시 요청: {url}")
            
            response = requests.post(url, timeout=30)
            response.raise_for_status()
            
            data = response.json()
            if data.get('success', False):
                logger.info("피드백을 학습에 사용됨으로 표시 완료")
                return True
            else:
                logger.warning(f"피드백 사용 표시 실패: {data.get('message', 'Unknown error')}")
                return False
                
        except requests.exceptions.RequestException as e:
            logger.error(f"피드백 사용 표시 중 네트워크 오류: {e}")
            return False
        except Exception as e:
            logger.error(f"피드백 사용 표시 중 예외 발생: {e}")
            return False
    
    def run_retrain_cycle(self, min_feedback_count: int = 10) -> Dict[str, any]:
        """
        완전한 재학습 사이클 실행
        
        Args:
            min_feedback_count (int): 재학습을 위한 최소 피드백 개수
            
        Returns:
            Dict: 재학습 결과 정보
        """
        result = {
            'success': False,
            'message': '',
            'feedback_count': 0,
            'retrain_performed': False,
            'timestamp': datetime.now().isoformat()
        }
        
        try:
            # 1. 피드백 데이터 조회
            logger.info("재학습 사이클 시작 - 피드백 데이터 조회")
            feedback_data = self.fetch_feedback_data()
            
            if not feedback_data:
                result['message'] = '피드백 데이터를 가져올 수 없습니다'
                return result
            
            total_count = feedback_data.get('totalCount', 0)
            result['feedback_count'] = total_count
            
            if total_count < min_feedback_count:
                result['message'] = f'재학습을 위한 피드백이 부족합니다 ({total_count}/{min_feedback_count})'
                logger.info(result['message'])
                return result
            
            # 2. 이미지 데이터 준비
            logger.info("이미지 데이터 준비 시작")
            images, labels = self.download_and_prepare_images(feedback_data)
            
            if len(images) < 5:
                result['message'] = f'처리 가능한 이미지가 부족합니다 ({len(images)}개)'
                return result
            
            # 3. 모델 재학습
            logger.info(f"{len(images)}개 이미지로 모델 재학습 시작")
            retrain_success = self.retrain_model(images, labels)
            
            if retrain_success:
                # 4. 피드백 사용 완료 표시
                mark_success = self.mark_feedback_as_used()
                
                result['success'] = True
                result['retrain_performed'] = True
                
                if mark_success:
                    result['message'] = f'모델 재학습 및 피드백 처리 완료 ({len(images)}개 샘플 사용)'
                else:
                    result['message'] = f'모델 재학습 성공, 피드백 표시 부분 실패 ({len(images)}개 샘플 사용)'
                    
                logger.info("재학습 사이클 성공적으로 완료")
            else:
                result['message'] = '모델 재학습 실패'
                
        except Exception as e:
            result['message'] = f'재학습 사이클 실행 중 오류: {str(e)}'
            logger.error(result['message'])
        
        return result

# 전역 재학습 서비스 인스턴스
_retrain_service = None

def get_retrain_service(backend_url: str = None) -> EmotionRetrainService:
    """재학습 서비스 싱글톤 인스턴스 반환"""
    global _retrain_service
    if _retrain_service is None:
        _retrain_service = EmotionRetrainService(backend_url)
    return _retrain_service

if __name__ == "__main__":
    # 테스트 실행
    service = get_retrain_service()
    result = service.run_retrain_cycle(min_feedback_count=1)  # 테스트용 낮은 임계값
    print("재학습 결과:", json.dumps(result, indent=2, ensure_ascii=False))