"""
강아지 감정 데이터셋 분석 스크립트
데이터 구조, 클래스 분포, 이미지 품질 등을 분석합니다.
"""

import os
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from PIL import Image
from pathlib import Path
import pandas as pd
from collections import Counter
import warnings
import logging
warnings.filterwarnings('ignore')

# matplotlib 폰트 관련 로깅 억제
logging.getLogger('matplotlib.font_manager').setLevel(logging.WARNING)

class DogEmotionDataAnalyzer:
    def __init__(self, dataset_path):
        """
        데이터셋 분석기 초기화
        
        Args:
            dataset_path (str): 데이터셋 경로
        """
        self.dataset_path = Path(dataset_path)
        
        # 실제 데이터 폴더 찾기
        self.find_actual_data_path()
        
        self.emotions = ['angry', 'happy', 'relaxed', 'sad']
        self.data_info = {}
    
    def find_actual_data_path(self):
        """
        실제 데이터가 있는 경로를 찾고 데이터셋 구조를 파악합니다.
        """
        # 하위 폴더들과 파일들 확인
        subdirs = [d for d in self.dataset_path.iterdir() if d.is_dir()]
        files = [f for f in self.dataset_path.iterdir() if f.is_file()]
        
        print(f"📁 최상위 디렉토리 내용:")
        for subdir in subdirs:
            print(f"   📂 {subdir.name}/")
        for file in files:
            print(f"   📄 {file.name}")
        
        # "Dog Emotion" 폴더가 있다면 그 안을 확인
        for subdir in subdirs:
            if "emotion" in subdir.name.lower():
                emotion_subdir = subdir
                print(f"\n🔍 '{subdir.name}' 폴더를 발견했습니다. 내부 구조를 확인합니다...")
                
                # 이 폴더 안의 모든 내용 확인
                emotion_subdirs = [d for d in emotion_subdir.iterdir() if d.is_dir()]
                emotion_files = [f for f in emotion_subdir.iterdir() if f.is_file()]
                
                print(f"📂 '{subdir.name}' 내부 폴더들:")
                for folder in emotion_subdirs:
                    print(f"   - {folder.name}/")
                
                print(f"📄 '{subdir.name}' 내부 파일들:")
                for file in emotion_files:
                    print(f"   - {file.name}")
                
                # labels.csv 파일이 있는지 확인
                labels_csv = emotion_subdir / "labels.csv"
                if labels_csv.exists():
                    print(f"✅ labels.csv 파일을 발견! CSV 라벨링 방식으로 추정됩니다.")
                    self.csv_labels_path = labels_csv
                    self.dataset_type = "csv_labeling"
                    self.dataset_path = emotion_subdir
                    self.analyze_csv_labels()
                    return
                
                # 감정 관련 폴더가 있으면 폴더 구조 방식
                emotion_folder_names = [f.name.lower() for f in emotion_subdirs]
                if any(emotion in emotion_folder_names for emotion in self.emotions):
                    print(f"✅ 감정 폴더들을 발견! 폴더 구조 방식으로 추정됩니다.")
                    self.dataset_type = "folder_structure"
                    self.dataset_path = emotion_subdir
                    return
    
    def analyze_csv_labels(self):
        """
        CSV 라벨 파일을 분석합니다.
        """
        try:
            df = pd.read_csv(self.csv_labels_path)
            print(f"\n📊 CSV 라벨 파일 분석:")
            print(f"   - 총 레코드 수: {len(df)}")
            print(f"   - 컬럼명: {list(df.columns)}")
            print(f"   - 처음 5행:")
            print(df.head().to_string(index=False))
            
            # 감정 분포 확인 (컬럼명이 'label'인 경우 고려)
            label_column = None
            if 'emotion' in df.columns:
                label_column = 'emotion'
            elif 'label' in df.columns:
                label_column = 'label'
            
            if label_column:
                emotion_counts = df[label_column].value_counts()
                print(f"\n🎭 CSV 파일의 감정 분포:")
                for emotion, count in emotion_counts.items():
                    print(f"   - {emotion}: {count}개")
                    
                self.csv_emotion_counts = emotion_counts.to_dict()
                print(f"✅ csv_emotion_counts 저장 완료: {self.csv_emotion_counts}")
            else:
                print("❌ 감정 라벨 컬럼을 찾을 수 없습니다.")
            
        except Exception as e:
            print(f"❌ CSV 파일 읽기 실패: {e}")
        
    def analyze_dataset_structure(self):
        """
        데이터셋 구조를 분석합니다.
        """
        print("🔍 데이터셋 구조 분석")
        print("=" * 50)
        
        # 전체 디렉토리 구조 확인
        print(f"📁 데이터셋 경로: {self.dataset_path}")
        
        # 하위 폴더들 확인
        subdirs = [d for d in self.dataset_path.iterdir() if d.is_dir()]
        print(f"📂 하위 폴더 수: {len(subdirs)}")
        
        for subdir in subdirs:
            print(f"   - {subdir.name}/")
        
        return subdirs
    
    def analyze_class_distribution(self):
        """
        각 감정별 이미지 개수를 분석합니다.
        """
        print("\n📊 클래스 분포 분석")
        print("=" * 50)
        
        emotion_counts = {}
        total_images = 0
        
        # CSV 라벨링 방식인 경우 CSV 파일에서 카운트
        if hasattr(self, 'dataset_type') and self.dataset_type == "csv_labeling":
            if hasattr(self, 'csv_emotion_counts') and self.csv_emotion_counts:
                emotion_counts = self.csv_emotion_counts.copy()
                total_images = sum(emotion_counts.values())
                
                print("📄 CSV 라벨 파일 기반 분포:")
                for emotion in self.emotions:
                    count = emotion_counts.get(emotion, 0)
                    print(f"😊 {emotion:>8}: {count:>5}개")
            else:
                print("❌ CSV 라벨 데이터를 먼저 분석해주세요.")
                print(f"Debug: dataset_type={getattr(self, 'dataset_type', 'None')}")
                print(f"Debug: csv_emotion_counts={getattr(self, 'csv_emotion_counts', 'None')}")
                return {}
        else:
            # 폴더 구조 방식인 경우 폴더별 카운트
            for emotion in self.emotions:
                emotion_path = self.dataset_path / emotion
                
                if emotion_path.exists():
                    # 이미지 파일만 카운트 (중복 제거)
                    image_extensions = ['.jpg', '.jpeg', '.png', '.bmp', '.tiff']
                    image_files = set()  # 중복 제거를 위해 set 사용
                    
                    for ext in image_extensions:
                        image_files.update(emotion_path.glob(f"*{ext}"))
                        image_files.update(emotion_path.glob(f"*{ext.upper()}"))
                    
                    count = len(image_files)
                    emotion_counts[emotion] = count
                    total_images += count
                    
                    print(f"😊 {emotion:>8}: {count:>5}개")
                else:
                    emotion_counts[emotion] = 0
                    print(f"❌ {emotion:>8}: 폴더 없음")
        
        print(f"\n📈 총 이미지 수: {total_images}개")
        
        # 클래스 불균형 분석
        if total_images > 0:
            print("\n⚖️  클래스 분포 비율:")
            for emotion, count in emotion_counts.items():
                percentage = (count / total_images) * 100
                print(f"   {emotion:>8}: {percentage:>5.1f}%")
            
            # 불균형 정도 계산
            max_count = max(emotion_counts.values())
            min_count = min([c for c in emotion_counts.values() if c > 0])
            
            if min_count > 0:
                imbalance_ratio = max_count / min_count
                print(f"\n🎯 클래스 불균형 비율: {imbalance_ratio:.2f}:1")
                
                if imbalance_ratio > 2.0:
                    print("⚠️  심한 클래스 불균형 감지! 가중치 적용 또는 오버샘플링 필요")
                elif imbalance_ratio > 1.5:
                    print("⚠️  중간 정도 클래스 불균형 감지! 가중치 적용 권장")
                else:
                    print("✅ 클래스 분포가 비교적 균형적입니다")
        
        self.data_info['emotion_counts'] = emotion_counts
        self.data_info['total_images'] = total_images
        
        return emotion_counts
    
    def analyze_image_properties(self, sample_size=100):
        """
        이미지 속성을 분석합니다 (크기, 채널, 포맷 등).
        
        Args:
            sample_size (int): 분석할 샘플 이미지 수
        """
        print(f"\n🖼️  이미지 속성 분석 (샘플 {sample_size}개)")
        print("=" * 50)
        
        image_info = {
            'widths': [],
            'heights': [],
            'channels': [],
            'formats': [],
            'file_sizes': []
        }
        
        corrupted_files = []
        
        # 각 감정별로 샘플 이미지 분석
        for emotion in self.emotions:
            emotion_path = self.dataset_path / emotion
            
            if not emotion_path.exists():
                continue
                
            # 이미지 파일 목록
            image_files = []
            image_extensions = ['.jpg', '.jpeg', '.png', '.bmp', '.tiff']
            
            for ext in image_extensions:
                image_files.extend(list(emotion_path.glob(f"*{ext}")))
                image_files.extend(list(emotion_path.glob(f"*{ext.upper()}")))
            
            # 샘플링
            sample_count = min(sample_size // len(self.emotions), len(image_files))
            sampled_files = np.random.choice(image_files, size=sample_count, replace=False)
            
            for img_path in sampled_files:
                try:
                    with Image.open(img_path) as img:
                        width, height = img.size
                        channels = len(img.getbands())
                        file_format = img.format
                        file_size = img_path.stat().st_size
                        
                        image_info['widths'].append(width)
                        image_info['heights'].append(height)
                        image_info['channels'].append(channels)
                        image_info['formats'].append(file_format)
                        image_info['file_sizes'].append(file_size)
                        
                except Exception as e:
                    corrupted_files.append(str(img_path))
                    print(f"❌ 손상된 파일: {img_path.name} - {str(e)}")
        
        # 통계 출력
        if image_info['widths']:
            print(f"📐 이미지 크기:")
            print(f"   너비: {np.min(image_info['widths'])} ~ {np.max(image_info['widths'])} (평균: {np.mean(image_info['widths']):.1f})")
            print(f"   높이: {np.min(image_info['heights'])} ~ {np.max(image_info['heights'])} (평균: {np.mean(image_info['heights']):.1f})")
            
            print(f"\n🎨 채널 수:")
            channel_counts = Counter(image_info['channels'])
            for channels, count in channel_counts.items():
                print(f"   {channels}채널: {count}개")
            
            print(f"\n📁 파일 포맷:")
            format_counts = Counter(image_info['formats'])
            for fmt, count in format_counts.items():
                print(f"   {fmt}: {count}개")
            
            print(f"\n💾 파일 크기:")
            avg_size = np.mean(image_info['file_sizes']) / 1024  # KB
            print(f"   평균: {avg_size:.1f} KB")
            print(f"   범위: {np.min(image_info['file_sizes'])/1024:.1f} ~ {np.max(image_info['file_sizes'])/1024:.1f} KB")
        
        print(f"\n🔍 품질 검사 결과:")
        print(f"   분석된 이미지: {len(image_info['widths'])}개")
        print(f"   손상된 파일: {len(corrupted_files)}개")
        
        if corrupted_files:
            print("⚠️  손상된 파일들:")
            for file in corrupted_files[:5]:  # 최대 5개만 표시
                print(f"     - {file}")
            if len(corrupted_files) > 5:
                print(f"     ... 외 {len(corrupted_files) - 5}개")
        
        self.data_info['image_properties'] = image_info
        self.data_info['corrupted_files'] = corrupted_files
        
        return image_info, corrupted_files
    
    def suggest_data_split(self):
        """
        Train/Validation/Test 분할을 제안합니다.
        """
        print(f"\n📋 데이터 분할 제안")
        print("=" * 50)
        
        if 'emotion_counts' not in self.data_info:
            print("❌ 먼저 클래스 분포를 분석해주세요.")
            return
        
        total_images = self.data_info['total_images']
        emotion_counts = self.data_info['emotion_counts']
        
        # 70:15:15 분할
        train_ratio, val_ratio, test_ratio = 0.7, 0.15, 0.15
        
        print(f"💡 제안하는 분할 비율: Train {train_ratio*100:.0f}% / Validation {val_ratio*100:.0f}% / Test {test_ratio*100:.0f}%")
        print()
        
        split_suggestion = {}
        
        for emotion, count in emotion_counts.items():
            if count == 0:
                continue
                
            train_count = int(count * train_ratio)
            val_count = int(count * val_ratio)
            test_count = count - train_count - val_count
            
            split_suggestion[emotion] = {
                'train': train_count,
                'val': val_count,
                'test': test_count
            }
            
            print(f"😊 {emotion:>8}: Train {train_count:>3} | Val {val_count:>3} | Test {test_count:>3}")
        
        # 총합 계산
        total_train = sum([split['train'] for split in split_suggestion.values()])
        total_val = sum([split['val'] for split in split_suggestion.values()])
        total_test = sum([split['test'] for split in split_suggestion.values()])
        
        print(f"\n📊 총계: Train {total_train} | Val {total_val} | Test {total_test}")
        print(f"💯 비율: Train {total_train/total_images*100:.1f}% | Val {total_val/total_images*100:.1f}% | Test {total_test/total_images*100:.1f}%")
        
        self.data_info['split_suggestion'] = split_suggestion
        
        return split_suggestion
    
    def create_visualization(self, save_path=None):
        """
        데이터 분석 결과를 시각화합니다.
        
        Args:
            save_path (str): 저장할 경로 (None이면 화면에만 표시)
        """
        if 'emotion_counts' not in self.data_info:
            print("❌ 먼저 데이터 분석을 실행해주세요.")
            return
        
        # 그래프 스타일 설정
        plt.style.use('default')
        sns.set_palette("husl")
        
        # 한글 폰트 설정 (Windows용)
        try:
            # Windows에서 사용 가능한 폰트들
            available_fonts = ['Malgun Gothic', 'Microsoft YaHei', 'DejaVu Sans', 'Arial']
            plt.rcParams['font.family'] = available_fonts
            plt.rcParams['axes.unicode_minus'] = False
        except:
            # 폰트 설정 실패해도 계속 진행
            pass
        
        fig, axes = plt.subplots(2, 2, figsize=(15, 12))
        fig.suptitle('Dog Emotion Dataset Analysis Results', fontsize=16, fontweight='bold')
        
        # 1. 클래스 분포 막대 그래프
        emotions = list(self.data_info['emotion_counts'].keys())
        counts = list(self.data_info['emotion_counts'].values())
        
        ax1 = axes[0, 0]
        bars = ax1.bar(emotions, counts, color=['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24'])
        ax1.set_title('Class Distribution (Image Count)', fontweight='bold')
        ax1.set_ylabel('Number of Images')
        
        # 막대 위에 숫자 표시
        for bar, count in zip(bars, counts):
            ax1.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 5, 
                    str(count), ha='center', va='bottom', fontweight='bold')
        
        # 2. 클래스 분포 파이 차트
        ax2 = axes[0, 1]
        ax2.pie(counts, labels=emotions, autopct='%1.1f%%', startangle=90,
                colors=['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24'])
        ax2.set_title('Class Distribution Ratio', fontweight='bold')
        
        # 3. 이미지 크기 분포 (있는 경우)
        ax3 = axes[1, 0]
        if 'image_properties' in self.data_info and self.data_info['image_properties']['widths']:
            widths = self.data_info['image_properties']['widths']
            heights = self.data_info['image_properties']['heights']
            
            ax3.scatter(widths, heights, alpha=0.6, color='#6c5ce7')
            ax3.set_xlabel('Width (pixels)')
            ax3.set_ylabel('Height (pixels)')
            ax3.set_title('Image Size Distribution', fontweight='bold')
            ax3.grid(True, alpha=0.3)
        else:
            ax3.text(0.5, 0.5, 'Image property\nanalysis needed', 
                    ha='center', va='center', transform=ax3.transAxes, fontsize=12)
            ax3.set_title('Image Size Distribution', fontweight='bold')
        
        # 4. 데이터 분할 제안 (있는 경우)
        ax4 = axes[1, 1]
        if 'split_suggestion' in self.data_info:
            split_data = self.data_info['split_suggestion']
            emotions = list(split_data.keys())
            train_counts = [split_data[emotion]['train'] for emotion in emotions]
            val_counts = [split_data[emotion]['val'] for emotion in emotions]
            test_counts = [split_data[emotion]['test'] for emotion in emotions]
            
            x = np.arange(len(emotions))
            width = 0.25
            
            ax4.bar(x - width, train_counts, width, label='Train', color='#00b894')
            ax4.bar(x, val_counts, width, label='Validation', color='#fdcb6e')
            ax4.bar(x + width, test_counts, width, label='Test', color='#e17055')
            
            ax4.set_xlabel('Emotion')
            ax4.set_ylabel('Number of Images')
            ax4.set_title('Data Split Suggestion', fontweight='bold')
            ax4.set_xticks(x)
            ax4.set_xticklabels(emotions)
            ax4.legend()
        else:
            ax4.text(0.5, 0.5, 'Data split suggestion\nneeded', 
                    ha='center', va='center', transform=ax4.transAxes, fontsize=12)
            ax4.set_title('Data Split Suggestion', fontweight='bold')
        
        plt.tight_layout()
        
        if save_path:
            plt.savefig(save_path, dpi=300, bbox_inches='tight')
            print(f"📊 시각화 결과가 {save_path}에 저장되었습니다.")
        
        plt.show()
    
    def generate_report(self):
        """
        분석 결과 종합 리포트를 생성합니다.
        """
        print(f"\n📋 종합 분석 리포트")
        print("=" * 50)
        
        if not self.data_info:
            print("❌ 분석 데이터가 없습니다. 먼저 분석을 실행해주세요.")
            return
        
        print(f"🎯 데이터셋 개요:")
        print(f"   - 총 이미지 수: {self.data_info.get('total_images', 0):,}개")
        print(f"   - 감정 클래스 수: {len(self.emotions)}개")
        
        if 'corrupted_files' in self.data_info:
            print(f"   - 손상된 파일: {len(self.data_info['corrupted_files'])}개")
        
        print(f"\n💡 학습 권장사항:")
        
        # 클래스 불균형 체크
        if 'emotion_counts' in self.data_info:
            counts = list(self.data_info['emotion_counts'].values())
            if max(counts) / min([c for c in counts if c > 0]) > 2.0:
                print("   - ⚠️  클래스 불균형으로 인한 가중치 적용 필요")
            else:
                print("   - ✅ 클래스 분포가 비교적 균형적")
        
        # 이미지 크기 권장사항
        if 'image_properties' in self.data_info:
            widths = self.data_info['image_properties']['widths']
            heights = self.data_info['image_properties']['heights']
            
            if widths and heights:
                avg_width = np.mean(widths)
                avg_height = np.mean(heights)
                
                if avg_width < 224 or avg_height < 224:
                    print("   - ⚠️  일부 이미지가 작음. 업스케일링 고려 필요")
                else:
                    print("   - ✅ 이미지 크기가 적절함")
        
        print(f"\n🚀 다음 단계:")
        print("   1. 데이터 분할 실행 (train/val/test)")
        print("   2. PyTorch Dataset 클래스 구현")
        print("   3. Data Augmentation 설정")
        print("   4. 모델 학습 시작")

def main():
    """
    메인 실행 함수
    """
    # 데이터셋 경로 설정 (다운로드된 경로로 수정하세요)
    import kagglehub
    
    try:
        # 캐시된 데이터셋 경로 가져오기
        dataset_path = kagglehub.dataset_download("danielshanbalico/dog-emotion")
        print(f"📁 데이터셋 경로: {dataset_path}")
    except Exception as e:
        print(f"❌ 데이터셋 경로를 찾을 수 없습니다: {e}")
        print("download_dataset.py를 먼저 실행하세요.")
        return
    
    # 분석기 초기화
    analyzer = DogEmotionDataAnalyzer(dataset_path)
    
    print("🚀 강아지 감정 데이터셋 분석 시작!")
    print("=" * 50)
    
    # 1. 데이터셋 구조 분석
    analyzer.analyze_dataset_structure()
    
    # 2. 클래스 분포 분석
    analyzer.analyze_class_distribution()
    
    # 3. 이미지 속성 분석
    analyzer.analyze_image_properties(sample_size=200)
    
    # 4. 데이터 분할 제안
    analyzer.suggest_data_split()
    
    # 5. 시각화 생성
    try:
        analyzer.create_visualization(save_path="dog_emotion_analysis.png")
    except Exception as e:
        print(f"⚠️  시각화 생성 중 오류: {e}")
        print("matplotlib이 설치되어 있는지 확인하세요: pip install matplotlib seaborn")
    
    # 6. 종합 리포트
    analyzer.generate_report()
    
    print(f"\n🎉 데이터 분석 완료!")

if __name__ == "__main__":
    main()