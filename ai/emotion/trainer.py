# -*- coding: utf-8 -*-
"""
강아지 감정 분류 모델 훈련 스크립트
PyTorch를 활용한 완전한 학습 파이프라인
"""

import torch
import torch.nn as nn
import torch.optim as optim
from torch.optim.lr_scheduler import StepLR, ReduceLROnPlateau
import time
import os
import json
from pathlib import Path
import numpy as np
from tqdm import tqdm
import sys
import io

# Windows 콘솔에서 한글 출력 (기본 인코딩 사용)

# 시작 알림
print("🚀 강아지 감정 분류 훈련 스크립트 시작!")

# 로컬 모듈 import
import sys
from pathlib import Path

# 현재 디렉토리를 Python path에 추가
try:
    current_dir = Path(__file__).parent
except NameError:
    # __file__이 정의되지 않은 경우 현재 디렉토리 사용
    current_dir = Path.cwd() / "emotion"

sys.path.insert(0, str(current_dir))

print(f"📁 현재 작업 디렉토리: {current_dir}")
print(f"📁 실제 경로 존재 확인: {current_dir.exists()}")

try:
    print("📦 모듈 import 중...")
    from training_model import create_model
    from dataset import create_data_loaders
    print("✅ 모듈 import 성공!")
except ImportError as e:
    print(f"❌ Import 오류: {e}")
    print("📍 파일 존재 확인:")
    print(f"   training_model.py: {(current_dir / 'training_model.py').exists()}")
    print(f"   dataset.py: {(current_dir / 'dataset.py').exists()}")
    raise

class DogEmotionTrainer:
    """
    강아지 감정 분류 모델 훈련 클래스
    """
    
    def __init__(self, config):
        """
        훈련기 초기화
        
        Args:
            config (dict): 훈련 설정
        """
        self.config = config
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        print(f"🖥️  사용 디바이스: {self.device}")
        
        # 결과 저장 디렉토리 생성
        self.save_dir = Path(config['save_dir'])
        self.save_dir.mkdir(parents=True, exist_ok=True)
        
        # 훈련 기록을 저장할 리스트
        self.train_losses = []
        self.val_losses = []
        self.train_accuracies = []
        self.val_accuracies = []
        
        # 모델, 옵티마이저, 스케줄러 초기화
        self._setup_model()
        self._setup_optimizer()
        self._setup_scheduler()
        
        # Early Stopping 설정
        self.best_val_loss = float('inf')
        self.best_val_acc = 0.0
        self.patience_counter = 0
        
    def _setup_model(self):
        """모델 초기화"""
        print("🤖 모델 설정 중...")
        
        self.model = create_model(
            num_classes=self.config['num_classes'],
            pretrained=self.config['pretrained'],
            dropout_rate=self.config['dropout_rate'],
            freeze_backbone=self.config['freeze_backbone']
        )
        
        self.model.to(self.device)
        
        # 손실 함수 설정
        if self.config.get('use_class_weights', False):
            # 클래스 가중치는 DataLoader에서 가져와야 함
            self.criterion = nn.CrossEntropyLoss()
        else:
            self.criterion = nn.CrossEntropyLoss()
            
        print(f"✅ 모델이 {self.device}에 로드되었습니다.")
    
    def _setup_optimizer(self):
        """옵티마이저 초기화"""
        optimizer_name = self.config['optimizer'].lower()
        lr = self.config['learning_rate']
        weight_decay = self.config.get('weight_decay', 1e-4)
        
        if optimizer_name == 'adam':
            self.optimizer = optim.Adam(
                self.model.parameters(), 
                lr=lr, 
                weight_decay=weight_decay
            )
        elif optimizer_name == 'sgd':
            self.optimizer = optim.SGD(
                self.model.parameters(), 
                lr=lr, 
                momentum=0.9, 
                weight_decay=weight_decay
            )
        elif optimizer_name == 'adamw':
            self.optimizer = optim.AdamW(
                self.model.parameters(), 
                lr=lr, 
                weight_decay=weight_decay
            )
        else:
            raise ValueError(f"지원하지 않는 옵티마이저: {optimizer_name}")
        
        print(f"📊 옵티마이저: {optimizer_name.upper()}, 학습률: {lr}")
    
    def _setup_scheduler(self):
        """학습률 스케줄러 초기화"""
        scheduler_type = self.config.get('scheduler_type', 'step')
        
        if scheduler_type == 'step':
            self.scheduler = StepLR(
                self.optimizer, 
                step_size=self.config.get('step_size', 10),
                gamma=self.config.get('gamma', 0.1)
            )
        elif scheduler_type == 'reduce_on_plateau':
            self.scheduler = ReduceLROnPlateau(
                self.optimizer, 
                mode='min',
                patience=self.config.get('scheduler_patience', 5),
                factor=0.5,
                verbose=True
            )
        else:
            self.scheduler = None
        
        if self.scheduler:
            print(f"📈 학습률 스케줄러: {scheduler_type}")
    
    def train_epoch(self, train_loader):
        """한 에포크 훈련"""
        self.model.train()
        
        running_loss = 0.0
        correct = 0
        total = 0
        
        # 진행바 설정
        pbar = tqdm(train_loader, desc="훈련 중", leave=False)
        
        for batch_idx, (images, labels, _) in enumerate(pbar):
            images, labels = images.to(self.device), labels.to(self.device)
            
            # 그래디언트 초기화
            self.optimizer.zero_grad()
            
            # 순전파
            outputs = self.model(images)
            loss = self.criterion(outputs, labels)
            
            # 역전파 및 옵티마이저 스텝
            loss.backward()
            self.optimizer.step()
            
            # 통계 업데이트
            running_loss += loss.item()
            _, predicted = torch.max(outputs.data, 1)
            total += labels.size(0)
            correct += (predicted == labels).sum().item()
            
            # 진행바 업데이트
            current_loss = running_loss / (batch_idx + 1)
            current_acc = 100. * correct / total
            pbar.set_postfix({
                'Loss': f'{current_loss:.4f}',
                'Acc': f'{current_acc:.2f}%'
            })
        
        epoch_loss = running_loss / len(train_loader)
        epoch_acc = 100. * correct / total
        
        return epoch_loss, epoch_acc
    
    def validate_epoch(self, val_loader):
        """한 에포크 검증"""
        self.model.eval()
        
        running_loss = 0.0
        correct = 0
        total = 0
        
        # 클래스별 정확도 계산을 위한 변수
        class_correct = list(0. for i in range(self.config['num_classes']))
        class_total = list(0. for i in range(self.config['num_classes']))
        
        with torch.no_grad():
            pbar = tqdm(val_loader, desc="검증 중", leave=False)
            
            for images, labels, _ in pbar:
                images, labels = images.to(self.device), labels.to(self.device)
                
                outputs = self.model(images)
                loss = self.criterion(outputs, labels)
                
                running_loss += loss.item()
                _, predicted = torch.max(outputs, 1)
                total += labels.size(0)
                correct += (predicted == labels).sum().item()
                
                # 클래스별 정확도 계산
                c = (predicted == labels).squeeze()
                for i in range(labels.size(0)):
                    label = labels[i]
                    class_correct[label] += c[i].item()
                    class_total[label] += 1
                
                # 진행바 업데이트
                current_loss = running_loss / (len(pbar.container) if hasattr(pbar, 'container') else 1)
                current_acc = 100. * correct / total
                pbar.set_postfix({
                    'Loss': f'{current_loss:.4f}',
                    'Acc': f'{current_acc:.2f}%'
                })
        
        epoch_loss = running_loss / len(val_loader)
        epoch_acc = 100. * correct / total
        
        # 클래스별 정확도 출력
        emotion_labels = ['angry', 'happy', 'relaxed', 'sad']
        class_accuracies = {}
        
        print("\n📊 클래스별 검증 정확도:")
        for i in range(self.config['num_classes']):
            if class_total[i] > 0:
                acc = 100 * class_correct[i] / class_total[i]
                class_accuracies[emotion_labels[i]] = acc
                print(f"   {emotion_labels[i]:>8}: {acc:.2f}% ({int(class_correct[i])}/{int(class_total[i])})")
        
        return epoch_loss, epoch_acc, class_accuracies
    
    def train(self, train_loader, val_loader):
        """전체 훈련 프로세스"""
        print(f"\n🚀 모델 훈련 시작!")
        print(f"📊 에포크 수: {self.config['num_epochs']}")
        print(f"📦 배치 크기: {self.config['batch_size']}")
        print(f"🎯 조기 종료 patience: {self.config['early_stopping_patience']}")
        print("=" * 60)
        
        start_time = time.time()
        
        for epoch in range(self.config['num_epochs']):
            epoch_start_time = time.time()
            
            print(f"\n📅 Epoch [{epoch+1}/{self.config['num_epochs']}]")
            
            # 훈련
            train_loss, train_acc = self.train_epoch(train_loader)
            
            # 검증
            val_loss, val_acc, class_accuracies = self.validate_epoch(val_loader)
            
            # 기록 저장
            self.train_losses.append(train_loss)
            self.val_losses.append(val_loss)
            self.train_accuracies.append(train_acc)
            self.val_accuracies.append(val_acc)
            
            # 스케줄러 업데이트
            if self.scheduler:
                if isinstance(self.scheduler, ReduceLROnPlateau):
                    self.scheduler.step(val_loss)
                else:
                    self.scheduler.step()
            
            # 에포크 결과 출력
            epoch_time = time.time() - epoch_start_time
            current_lr = self.optimizer.param_groups[0]['lr']
            
            print(f"\n⏱️  에포크 시간: {epoch_time:.2f}초")
            print(f"📚 훈련   - Loss: {train_loss:.4f}, Acc: {train_acc:.2f}%")
            print(f"📊 검증   - Loss: {val_loss:.4f}, Acc: {val_acc:.2f}%")
            print(f"📈 학습률: {current_lr:.6f}")
            
            # 최고 모델 저장
            is_best = val_acc > self.best_val_acc
            if is_best:
                self.best_val_acc = val_acc
                self.best_val_loss = val_loss
                self.save_checkpoint(epoch, is_best=True)
                print(f"✅ 새로운 최고 검증 정확도: {val_acc:.2f}%")
                self.patience_counter = 0
            else:
                self.patience_counter += 1
            
            # 정기적으로 체크포인트 저장
            if (epoch + 1) % self.config.get('save_frequency', 10) == 0:
                self.save_checkpoint(epoch, is_best=False)
            
            # Early Stopping 체크
            if self.patience_counter >= self.config['early_stopping_patience']:
                print(f"\n🛑 Early Stopping! {self.config['early_stopping_patience']} 에포크 동안 개선 없음")
                break
        
        # 훈련 완료
        total_time = time.time() - start_time
        print(f"\n🎉 훈련 완료!")
        print(f"⏱️  총 훈련 시간: {total_time/60:.2f}분")
        print(f"🏆 최고 검증 정확도: {self.best_val_acc:.2f}%")
        
        # 최종 결과 저장
        self.save_training_history()
        
        return self.train_losses, self.val_losses, self.train_accuracies, self.val_accuracies
    
    def save_checkpoint(self, epoch, is_best=False):
        """체크포인트 저장"""
        checkpoint = {
            'epoch': epoch + 1,
            'model_state_dict': self.model.state_dict(),
            'optimizer_state_dict': self.optimizer.state_dict(),
            'scheduler_state_dict': self.scheduler.state_dict() if self.scheduler else None,
            'train_losses': self.train_losses,
            'val_losses': self.val_losses,
            'train_accuracies': self.train_accuracies,
            'val_accuracies': self.val_accuracies,
            'best_val_acc': self.best_val_acc,
            'config': self.config
        }
        
        # 최신 체크포인트 저장
        checkpoint_path = self.save_dir / 'last_checkpoint.pth'
        torch.save(checkpoint, checkpoint_path)
        
        # 최고 모델 저장
        if is_best:
            best_path = self.save_dir / 'best_model.pth'
            torch.save(checkpoint, best_path)
    
    def save_training_history(self):
        """훈련 기록 저장"""
        history = {
            'train_losses': self.train_losses,
            'val_losses': self.val_losses,
            'train_accuracies': self.train_accuracies,
            'val_accuracies': self.val_accuracies,
            'best_val_acc': self.best_val_acc,
            'config': self.config
        }
        
        history_path = self.save_dir / 'training_history.json'
        with open(history_path, 'w', encoding='utf-8') as f:
            json.dump(history, f, indent=2, ensure_ascii=False)
        
        print(f"💾 훈련 기록이 {history_path}에 저장되었습니다.")

def create_training_config():
    """기본 훈련 설정 생성"""
    config = {
        # 모델 설정 - Fine-tuning
        'num_classes': 4,
        'pretrained': True,
        'dropout_rate': 0.3,          # 드롭아웃 감소 (0.5 → 0.3)
        'freeze_backbone': False,     # 백본 해제 (Fine-tuning)
        
        # 훈련 설정 - Fine-tuning용
        'num_epochs': 30,             # 에포크 감소 (50 → 30)
        'batch_size': 32,
        'learning_rate': 0.0001,      # 학습률 감소 (0.001 → 0.0001)
        'weight_decay': 1e-4,
        'optimizer': 'adam',
        
        # 스케줄러 설정
        'scheduler_type': 'reduce_on_plateau',
        'step_size': 10,
        'gamma': 0.1,
        'scheduler_patience': 3,      # 더 빠른 학습률 감소
        
        # 데이터 설정
        'image_size': 224,
        'num_workers': 2,             # Windows 안정성을 위해 감소
        'train_ratio': 0.7,
        'val_ratio': 0.15,
        'test_ratio': 0.15,
        
        # 기타 설정
        'early_stopping_patience': 8, # 조금 더 빨리 종료
        'save_frequency': 3,
        'save_dir': 'emotion/checkpoints_finetune',  # 새 폴더
        'use_class_weights': False
    }
    
    return config

def main():
    """메인 훈련 함수"""
    print("🐕 강아지 감정 분류 모델 훈련 시작!")
    print("=" * 60)
    
    # 설정 로드
    config = create_training_config()
    
    # 설정 출력
    print("⚙️  훈련 설정:")
    for key, value in config.items():
        print(f"   {key}: {value}")
    print()
    
    try:
        # 데이터셋 및 DataLoader 생성
        import kagglehub
        dataset_path = kagglehub.dataset_download("danielshanbalico/dog-emotion")
        dataset_path = Path(dataset_path) / "Dog Emotion"
        csv_file = dataset_path / "labels.csv"
        
        print(f"📁 데이터셋 경로: {dataset_path}")
        
        # DataLoader 생성
        train_loader, val_loader, test_loader, class_weights, emotion_to_idx = create_data_loaders(
            csv_file=csv_file,
            root_dir=dataset_path,
            batch_size=config['batch_size'],
            num_workers=config['num_workers'],
            image_size=config['image_size'],
            train_ratio=config['train_ratio'],
            val_ratio=config['val_ratio'],
            test_ratio=config['test_ratio']
        )
        
        # 훈련기 생성
        trainer = DogEmotionTrainer(config)
        
        # 훈련 시작
        history = trainer.train(train_loader, val_loader)
        
        print("\n🎊 훈련이 성공적으로 완료되었습니다!")
        
        return trainer, history
        
    except Exception as e:
        print(f"❌ 훈련 중 오류 발생: {e}")
        import traceback
        traceback.print_exc()
        return None, None

if __name__ == "__main__":
    trainer, history = main()