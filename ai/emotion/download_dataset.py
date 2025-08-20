"""
강아지 감정 데이터셋 다운로드 스크립트
Kaggle에서 dog-emotion 데이터셋을 다운로드합니다.
"""

import os
import kagglehub
from pathlib import Path

def download_dog_emotion_dataset():
    """
    Kaggle에서 강아지 감정 데이터셋을 다운로드합니다.
    
    Returns:
        str: 다운로드된 데이터셋 경로
    """
    try:
        print("🐕 강아지 감정 데이터셋 다운로드 시작...")
        
        # 데이터셋 다운로드
        path = kagglehub.dataset_download("danielshanbalico/dog-emotion")
        
        print(f"✅ 데이터셋 다운로드 완료!")
        print(f"📁 경로: {path}")
        
        # 다운로드된 파일 목록 확인
        dataset_path = Path(path)
        if dataset_path.exists():
            print("\n📋 다운로드된 파일 목록:")
            for file in dataset_path.rglob("*"):
                if file.is_file():
                    print(f"   - {file.name} ({file.stat().st_size / (1024*1024):.1f} MB)")
        
        # 데이터셋 구조 분석
        analyze_dataset_structure(dataset_path)
        
        return str(path)
        
    except Exception as e:
        print(f"❌ 다운로드 실패: {str(e)}")
        print("\n해결 방법:")
        print("1. Kaggle API 토큰이 설정되어 있는지 확인 (~/.kaggle/kaggle.json)")
        print("2. 인터넷 연결 상태 확인")
        print("3. Kaggle 계정이 활성화되어 있는지 확인")
        return None

def analyze_dataset_structure(dataset_path):
    """
    데이터셋 구조를 분석하고 출력합니다.
    
    Args:
        dataset_path (Path): 데이터셋 경로
    """
    print("\n🔍 데이터셋 구조 분석:")
    
    # 하위 디렉토리 확인
    directories = [d for d in dataset_path.iterdir() if d.is_dir()]
    
    if directories:
        print("📁 디렉토리 구조:")
        for directory in directories:
            file_count = len(list(directory.glob("*.*")))
            print(f"   - {directory.name}/: {file_count}개 파일")
            
            # 각 감정별 이미지 개수 확인
            if file_count > 0:
                image_extensions = ['.jpg', '.jpeg', '.png', '.bmp']
                image_files = []
                for ext in image_extensions:
                    image_files.extend(list(directory.glob(f"*{ext}")))
                    image_files.extend(list(directory.glob(f"*{ext.upper()}")))
                
                print(f"     └─ 이미지 파일: {len(image_files)}개")
    
    # 전체 통계
    total_files = len(list(dataset_path.rglob("*.*")))
    print(f"\n📊 전체 파일 수: {total_files}개")

def check_kaggle_config():
    """
    Kaggle API 설정 상태를 확인합니다.
    """
    print("🔧 Kaggle API 설정 확인...")
    
    kaggle_dir = Path.home() / ".kaggle"
    kaggle_json = kaggle_dir / "kaggle.json"
    
    if kaggle_json.exists():
        print("✅ kaggle.json 파일이 존재합니다.")
        
        # 권한 확인 (Unix 계열 시스템)
        if os.name != 'nt':  # Windows가 아닌 경우
            file_permissions = oct(kaggle_json.stat().st_mode)[-3:]
            if file_permissions == '600':
                print("✅ 파일 권한이 올바르게 설정되어 있습니다.")
            else:
                print(f"⚠️  파일 권한: {file_permissions} (권장: 600)")
                print("   chmod 600 ~/.kaggle/kaggle.json 명령어를 실행하세요.")
    else:
        print("❌ kaggle.json 파일이 없습니다.")
        print("   Kaggle.com → Account → API → 'Create New API Token'에서 다운로드하세요.")

if __name__ == "__main__":
    print("🚀 강아지 감정 데이터셋 다운로드 테스트")
    print("=" * 50)
    
    # Kaggle 설정 확인
    check_kaggle_config()
    print()
    
    # 데이터셋 다운로드
    dataset_path = download_dog_emotion_dataset()
    
    if dataset_path:
        print(f"\n🎉 테스트 완료! 데이터셋이 준비되었습니다.")
        print(f"📍 다음 단계: 학습 스크립트에서 '{dataset_path}' 경로를 사용하세요.")
    else:
        print("\n💡 Kaggle API 설정을 확인하고 다시 시도해주세요.")