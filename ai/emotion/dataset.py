"""
강아지 감정 데이터셋을 위한 PyTorch Dataset 및 DataLoader
CSV 라벨링 방식의 데이터셋을 처리합니다.
"""

import torch
from torch.utils.data import Dataset, DataLoader
import torchvision.transforms as transforms
from PIL import Image
import pandas as pd
import numpy as np
from pathlib import Path
from sklearn.model_selection import train_test_split
import warnings
import sys
import io

# Windows 콘솔에서 한글 출력 (기본 인코딩 사용)

warnings.filterwarnings('ignore')

class DogEmotionDataset(Dataset):
    """
    강아지 감정 데이터셋을 위한 PyTorch Dataset 클래스
    """
    
    def __init__(self, csv_file, root_dir, transform=None, emotion_to_idx=None):
        """
        Args:
            csv_file (str): 라벨 CSV 파일 경로
            root_dir (str): 이미지 파일들이 있는 루트 디렉토리
            transform (callable, optional): 이미지에 적용할 변환
            emotion_to_idx (dict): 감정 라벨을 인덱스로 변환하는 딕셔너리
        """
        # CSV 파일 읽기
        if isinstance(csv_file, str):
            self.labels_df = pd.read_csv(csv_file)
        else:
            self.labels_df = csv_file  # DataFrame이 직접 전달된 경우
        
        self.root_dir = Path(root_dir)
        self.transform = transform
        
        # 라벨 컬럼 찾기
        self.label_column = self._find_label_column()
        
        # 감정 라벨을 숫자 인덱스로 변환
        if emotion_to_idx is None:
            unique_emotions = self.labels_df[self.label_column].unique()
            self.emotion_to_idx = {emotion: idx for idx, emotion in enumerate(sorted(unique_emotions))}
        else:
            self.emotion_to_idx = emotion_to_idx
        
        self.idx_to_emotion = {idx: emotion for emotion, idx in self.emotion_to_idx.items()}
        
        print(f"📊 데이터셋 정보:")
        print(f"   - 총 샘플 수: {len(self.labels_df)}")
        print(f"   - 감정 클래스: {list(self.emotion_to_idx.keys())}")
        print(f"   - 클래스 매핑: {self.emotion_to_idx}")
    
    def _find_label_column(self):
        """라벨 컬럼을 찾습니다."""
        possible_columns = ['label', 'emotion', 'class', 'target']
        for col in possible_columns:
            if col in self.labels_df.columns:
                return col
        raise ValueError(f"라벨 컬럼을 찾을 수 없습니다. 사용 가능한 컬럼: {list(self.labels_df.columns)}")
    
    def __len__(self):
        return len(self.labels_df)
    
    def __getitem__(self, idx):
        if torch.is_tensor(idx):
            idx = idx.tolist()
        
        # 파일명과 라벨 가져오기
        row = self.labels_df.iloc[idx]
        filename = row['filename']
        emotion_label = row[self.label_column]
        
        # 이미지 파일 경로 구성
        img_path = self.root_dir / filename
        
        # 이미지가 없는 경우 감정별 폴더에서 찾기
        if not img_path.exists():
            img_path = self.root_dir / emotion_label / filename
        
        # 이미지 로드
        try:
            image = Image.open(img_path).convert('RGB')
        except Exception as e:
            print(f"❌ 이미지 로드 실패: {img_path} - {e}")
            # 기본 이미지 생성 (에러 방지용)
            image = Image.new('RGB', (224, 224), color='gray')
        
        # 라벨을 숫자 인덱스로 변환
        label_idx = self.emotion_to_idx[emotion_label]
        
        # 변환 적용
        if self.transform:
            image = self.transform(image)
        
        return image, label_idx, filename
    
    def get_class_weights(self):
        """
        클래스 불균형을 위한 가중치를 계산합니다.
        """
        label_counts = self.labels_df[self.label_column].value_counts()
        total_samples = len(self.labels_df)
        
        # 각 클래스별 가중치 계산
        class_weights = []
        for emotion in sorted(self.emotion_to_idx.keys()):
            weight = total_samples / (len(self.emotion_to_idx) * label_counts.get(emotion, 1))
            class_weights.append(weight)
        
        return torch.FloatTensor(class_weights)

class DataTransforms:
    """
    데이터 증강 및 전처리를 위한 클래스
    """
    
    @staticmethod
    def get_train_transforms(image_size=224):
        """
        훈련용 데이터 변환 (Data Augmentation 포함)
        """
        return transforms.Compose([
            transforms.Resize((image_size + 32, image_size + 32)),  # 여유분을 둔 리사이즈
            transforms.RandomResizedCrop(image_size, scale=(0.8, 1.0)),  # 랜덤 크롭
            transforms.RandomHorizontalFlip(p=0.5),  # 좌우 반전
            transforms.ColorJitter(
                brightness=0.2,      # 밝기 변화
                contrast=0.2,        # 대비 변화  
                saturation=0.2,      # 채도 변화
                hue=0.1             # 색조 변화
            ),
            transforms.RandomRotation(degrees=15),  # 15도 범위 내 회전
            transforms.ToTensor(),
            transforms.Normalize(
                mean=[0.485, 0.456, 0.406],  # ImageNet 평균
                std=[0.229, 0.224, 0.225]    # ImageNet 표준편차
            )
        ])
    
    @staticmethod
    def get_val_transforms(image_size=224):
        """
        검증/테스트용 데이터 변환 (Augmentation 없음)
        """
        return transforms.Compose([
            transforms.Resize((image_size, image_size)),
            transforms.ToTensor(),
            transforms.Normalize(
                mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225]
            )
        ])

class DataSplitter:
    """
    데이터를 Train/Validation/Test로 분할하는 클래스
    """
    
    def __init__(self, csv_file, root_dir, train_ratio=0.7, val_ratio=0.15, test_ratio=0.15, random_state=42):
        """
        Args:
            csv_file (str): 라벨 CSV 파일 경로
            root_dir (str): 이미지 디렉토리 경로
            train_ratio (float): 훈련 데이터 비율
            val_ratio (float): 검증 데이터 비율
            test_ratio (float): 테스트 데이터 비율
            random_state (int): 랜덤 시드
        """
        self.df = pd.read_csv(csv_file)
        self.root_dir = root_dir
        self.train_ratio = train_ratio
        self.val_ratio = val_ratio
        self.test_ratio = test_ratio
        self.random_state = random_state
        
        # 비율 검증
        if abs(train_ratio + val_ratio + test_ratio - 1.0) > 1e-6:
            raise ValueError(f"비율의 합이 1.0이 아닙니다: {train_ratio + val_ratio + test_ratio}")
        
        # 라벨 컬럼 찾기
        self.label_column = self._find_label_column()
        
    def _find_label_column(self):
        """라벨 컬럼을 찾습니다."""
        possible_columns = ['label', 'emotion', 'class', 'target']
        for col in possible_columns:
            if col in self.df.columns:
                return col
        raise ValueError(f"라벨 컬럼을 찾을 수 없습니다.")
    
    def split_data(self):
        """
        데이터를 계층화 샘플링으로 분할합니다.
        
        Returns:
            tuple: (train_df, val_df, test_df)
        """
        print("📋 데이터 분할 시작...")
        
        # 계층화 샘플링으로 train과 나머지로 분할
        train_df, temp_df = train_test_split(
            self.df,
            test_size=(1 - self.train_ratio),
            stratify=self.df[self.label_column],
            random_state=self.random_state
        )
        
        # 나머지를 validation과 test로 분할
        val_size = self.val_ratio / (self.val_ratio + self.test_ratio)
        val_df, test_df = train_test_split(
            temp_df,
            test_size=(1 - val_size),
            stratify=temp_df[self.label_column],
            random_state=self.random_state
        )
        
        # 결과 출력
        print(f"✅ 데이터 분할 완료:")
        print(f"   📚 훈련 데이터: {len(train_df)}개 ({len(train_df)/len(self.df)*100:.1f}%)")
        print(f"   📊 검증 데이터: {len(val_df)}개 ({len(val_df)/len(self.df)*100:.1f}%)")
        print(f"   🧪 테스트 데이터: {len(test_df)}개 ({len(test_df)/len(self.df)*100:.1f}%)")
        
        # 각 분할의 클래스 분포 확인
        self._print_class_distribution(train_df, "훈련")
        self._print_class_distribution(val_df, "검증")
        self._print_class_distribution(test_df, "테스트")
        
        return train_df, val_df, test_df
    
    def _print_class_distribution(self, df, set_name):
        """각 세트의 클래스 분포를 출력합니다."""
        class_counts = df[self.label_column].value_counts()
        print(f"\n🎭 {set_name} 세트 클래스 분포:")
        for emotion, count in class_counts.items():
            percentage = count / len(df) * 100
            print(f"   - {emotion}: {count}개 ({percentage:.1f}%)")

def create_data_loaders(csv_file, root_dir, batch_size=32, num_workers=4, image_size=224, 
                       train_ratio=0.7, val_ratio=0.15, test_ratio=0.15):
    """
    Train/Val/Test DataLoader를 생성합니다.
    
    Args:
        csv_file (str): 라벨 CSV 파일 경로
        root_dir (str): 이미지 디렉토리 경로
        batch_size (int): 배치 크기
        num_workers (int): 데이터 로딩 워커 수
        image_size (int): 이미지 크기
        train_ratio (float): 훈련 데이터 비율
        val_ratio (float): 검증 데이터 비율
        test_ratio (float): 테스트 데이터 비율
    
    Returns:
        tuple: (train_loader, val_loader, test_loader, class_weights, emotion_to_idx)
    """
    print("🚀 DataLoader 생성 시작...")
    
    # 1. 데이터 분할
    splitter = DataSplitter(csv_file, root_dir, train_ratio, val_ratio, test_ratio)
    train_df, val_df, test_df = splitter.split_data()
    
    # 2. 변환 정의
    train_transform = DataTransforms.get_train_transforms(image_size)
    val_transform = DataTransforms.get_val_transforms(image_size)
    
    # 3. Dataset 생성
    train_dataset = DogEmotionDataset(train_df, root_dir, train_transform)
    val_dataset = DogEmotionDataset(val_df, root_dir, val_transform, train_dataset.emotion_to_idx)
    test_dataset = DogEmotionDataset(test_df, root_dir, val_transform, train_dataset.emotion_to_idx)
    
    # 4. DataLoader 생성
    train_loader = DataLoader(
        train_dataset,
        batch_size=batch_size,
        shuffle=True,
        num_workers=num_workers,
        pin_memory=True,  # GPU 사용 시 성능 향상
        drop_last=True    # 마지막 배치가 작으면 제거
    )
    
    val_loader = DataLoader(
        val_dataset,
        batch_size=batch_size,
        shuffle=False,
        num_workers=num_workers,
        pin_memory=True
    )
    
    test_loader = DataLoader(
        test_dataset,
        batch_size=batch_size,
        shuffle=False,
        num_workers=num_workers,
        pin_memory=True
    )
    
    # 5. 클래스 가중치 계산
    class_weights = train_dataset.get_class_weights()
    
    print(f"✅ DataLoader 생성 완료!")
    print(f"   📚 Train 배치 수: {len(train_loader)}")
    print(f"   📊 Val 배치 수: {len(val_loader)}")
    print(f"   🧪 Test 배치 수: {len(test_loader)}")
    print(f"   ⚖️  클래스 가중치: {class_weights.tolist()}")
    
    return train_loader, val_loader, test_loader, class_weights, train_dataset.emotion_to_idx

def test_dataloader():
    """
    DataLoader를 테스트합니다.
    """
    import kagglehub
    
    try:
        # 데이터셋 경로 가져오기
        dataset_path = kagglehub.dataset_download("danielshanbalico/dog-emotion")
        dataset_path = Path(dataset_path) / "Dog Emotion"
        csv_file = dataset_path / "labels.csv"
        
        print(f"📁 데이터셋 경로: {dataset_path}")
        
        # DataLoader 생성
        train_loader, val_loader, test_loader, class_weights, emotion_to_idx = create_data_loaders(
            csv_file=csv_file,
            root_dir=dataset_path,
            batch_size=16,  # 테스트용 작은 배치
            num_workers=2,   # 테스트용 적은 워커
            image_size=224
        )
        
        # 첫 번째 배치 테스트
        print(f"\n🧪 첫 번째 배치 테스트:")
        train_batch = next(iter(train_loader))
        images, labels, filenames = train_batch
        
        print(f"   - 이미지 텐서 형태: {images.shape}")
        print(f"   - 라벨 텐서 형태: {labels.shape}")
        print(f"   - 배치 내 클래스 분포: {torch.bincount(labels)}")
        print(f"   - 파일명 예시: {filenames[:3]}")
        
        # 이미지 값 범위 확인
        print(f"   - 이미지 값 범위: [{images.min():.3f}, {images.max():.3f}]")
        
        print(f"\n✅ DataLoader 테스트 완료!")
        
        return train_loader, val_loader, test_loader, class_weights, emotion_to_idx
        
    except Exception as e:
        print(f"❌ DataLoader 테스트 실패: {e}")
        import traceback
        traceback.print_exc()
        return None

if __name__ == "__main__":
    # DataLoader 테스트 실행
    result = test_dataloader()
    
    if result:
        print("\n🎉 DataLoader가 성공적으로 구현되었습니다!")
        print("🚀 이제 모델 학습을 시작할 수 있습니다!")