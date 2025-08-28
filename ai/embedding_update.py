#!/usr/bin/env python3
"""
네이버 상품과 일반 상품의 title을 OpenAI 임베딩으로 변환하여 DB에 저장하는 스크립트
"""

import os
import sys
import time
import psycopg2
import requests
import json
from typing import List, Optional, Tuple
from dotenv import load_dotenv

# 환경변수 로드
load_dotenv()

class EmbeddingUpdater:
    def __init__(self):
        self.openai_api_key = os.getenv('OPENAI_API_KEY')
        
        # 환경변수에서 DB 연결 정보 가져오기
        db_host = os.getenv('DB_HOST', 'localhost')
        db_port = os.getenv('DB_PORT', '5432')
        db_name = os.getenv('DB_NAME', 'meong')
        db_user = os.getenv('DB_USER', 'jjj')
        db_password = os.getenv('DB_PASSWORD', '1q2w3e4r!')
        
        self.db_url = f'postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}'
        
        if not self.openai_api_key:
            raise ValueError("OPENAI_API_KEY 환경변수가 설정되지 않았습니다.")
    
    def get_db_connection(self):
        """데이터베이스 연결"""
        return psycopg2.connect(self.db_url)
    
    def generate_embedding(self, text: str) -> Optional[List[float]]:
        """OpenAI API를 사용하여 텍스트를 임베딩으로 변환"""
        try:
            headers = {
                'Authorization': f'Bearer {self.openai_api_key}',
                'Content-Type': 'application/json'
            }
            
            data = {
                'input': text,
                'model': 'text-embedding-ada-002'
            }
            
            response = requests.post(
                'https://api.openai.com/v1/embeddings',
                headers=headers,
                json=data,
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                return result['data'][0]['embedding']
            else:
                print(f"OpenAI API 오류: {response.status_code} - {response.text}")
                return None
                
        except Exception as e:
            print(f"임베딩 생성 실패: {e}")
            return None
    
    def embedding_to_vector_string(self, embedding: List[float]) -> str:
        """임베딩을 PostgreSQL vector 형식의 문자열로 변환"""
        if not embedding:
            return None
        
        vector_str = '[' + ','.join(map(str, embedding)) + ']'
        return vector_str
    
    def get_naver_products_without_embedding(self, limit: int = 500) -> List[tuple]:
        """임베딩이 없는 네이버 상품들을 조회"""
        with self.get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT naver_product_id, title 
                    FROM naver_product 
                    WHERE title_embedding IS NULL 
                    AND title IS NOT NULL 
                    AND title != ''
                    LIMIT %s
                """, (limit,))
                return cursor.fetchall()
    
    def get_regular_products_without_embedding(self, limit: int = 500) -> List[tuple]:
        """임베딩이 없는 일반 상품들을 조회"""
        with self.get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT product_id, name 
                    FROM product 
                    WHERE name_embedding IS NULL 
                    AND name IS NOT NULL 
                    AND name != ''
                    LIMIT %s
                """, (limit,))
                return cursor.fetchall()
    
    def update_naver_product_embedding(self, product_id: int, embedding_vector: str):
        """네이버 상품의 임베딩을 업데이트"""
        with self.get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("""
                    UPDATE naver_product 
                    SET title_embedding = %s::vector, updated_at = CURRENT_TIMESTAMP
                    WHERE naver_product_id = %s
                """, (embedding_vector, product_id))
                conn.commit()
    
    def update_regular_product_embedding(self, product_id: int, embedding_vector: str):
        """일반 상품의 임베딩을 업데이트"""
        with self.get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("""
                    UPDATE product 
                    SET name_embedding = %s::vector
                    WHERE product_id = %s
                """, (embedding_vector, product_id))
                conn.commit()
    
    def count_naver_products_without_embedding(self) -> int:
        """임베딩이 없는 네이버 상품 수 조회"""
        with self.get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT COUNT(*) 
                    FROM naver_product 
                    WHERE title_embedding IS NULL 
                    AND title IS NOT NULL 
                    AND title != ''
                """)
                return cursor.fetchone()[0]
    
    def count_regular_products_without_embedding(self) -> int:
        """임베딩이 없는 일반 상품 수 조회"""
        with self.get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT COUNT(*) 
                    FROM product 
                    WHERE name_embedding IS NULL 
                    AND name IS NOT NULL 
                    AND name != ''
                """)
                return cursor.fetchone()[0]
    
    def update_naver_embeddings(self, batch_size: int = 500):
        """네이버 상품들의 임베딩을 업데이트"""
        print("네이버 상품 임베딩 업데이트를 시작합니다...")
        
        total_processed = 0
        total_updated = 0
        
        while True:
            # 임베딩이 없는 네이버 상품들을 배치로 조회
            products = self.get_naver_products_without_embedding(batch_size)
            
            if not products:
                print("더 이상 업데이트할 네이버 상품이 없습니다.")
                break
            
            print(f"네이버 상품 배치 처리 중: {len(products)}개 상품")
            
            for product_id, title in products:
                try:
                    # 임베딩 생성
                    embedding = self.generate_embedding(title)
                    
                    if embedding:
                        # PostgreSQL vector 형식으로 변환
                        vector_string = self.embedding_to_vector_string(embedding)
                        
                        # DB 업데이트
                        self.update_naver_product_embedding(product_id, vector_string)
                        
                        total_updated += 1
                        print(f"✓ 네이버 상품 ID {product_id}: '{title[:50]}...' 임베딩 업데이트 완료")
                    else:
                        print(f"✗ 네이버 상품 ID {product_id}: 임베딩 생성 실패")
                    
                    total_processed += 1
                    
                    # API 호출 제한을 위한 딜레이 (초당 3회 제한)
                    time.sleep(0.35)
                    
                except Exception as e:
                    print(f"✗ 네이버 상품 ID {product_id} 처리 실패: {e}")
                    total_processed += 1
            
            # 진행 상황 출력
            print(f"네이버 상품 진행 상황: {total_processed}개 처리됨, {total_updated}개 업데이트됨")
            print("-" * 50)
        
        print(f"네이버 상품 임베딩 업데이트 완료: 총 {total_processed}개 처리됨, {total_updated}개 업데이트됨")
        return total_processed, total_updated
    
    def update_regular_embeddings(self, batch_size: int = 500):
        """일반 상품들의 임베딩을 업데이트"""
        print("일반 상품 임베딩 업데이트를 시작합니다...")
        
        total_processed = 0
        total_updated = 0
        
        while True:
            # 임베딩이 없는 일반 상품들을 배치로 조회
            products = self.get_regular_products_without_embedding(batch_size)
            
            if not products:
                print("더 이상 업데이트할 일반 상품이 없습니다.")
                break
            
            print(f"일반 상품 배치 처리 중: {len(products)}개 상품")
            
            for product_id, name in products:
                try:
                    # 임베딩 생성
                    embedding = self.generate_embedding(name)
                    
                    if embedding:
                        # PostgreSQL vector 형식으로 변환
                        vector_string = self.embedding_to_vector_string(embedding)
                        
                        # DB 업데이트
                        self.update_regular_product_embedding(product_id, vector_string)
                        
                        total_updated += 1
                        print(f"✓ 일반 상품 ID {product_id}: '{name[:50]}...' 임베딩 업데이트 완료")
                    else:
                        print(f"✗ 일반 상품 ID {product_id}: 임베딩 생성 실패")
                    
                    total_processed += 1
                    
                    # API 호출 제한을 위한 딜레이 (초당 3회 제한)
                    time.sleep(0.35)
                    
                except Exception as e:
                    print(f"✗ 일반 상품 ID {product_id} 처리 실패: {e}")
                    total_processed += 1
            
            # 진행 상황 출력
            print(f"일반 상품 진행 상황: {total_processed}개 처리됨, {total_updated}개 업데이트됨")
            print("-" * 50)
        
        print(f"일반 상품 임베딩 업데이트 완료: 총 {total_processed}개 처리됨, {total_updated}개 업데이트됨")
        return total_processed, total_updated
    
    def update_all_embeddings(self, batch_size: int = 500):
        """모든 상품의 임베딩을 업데이트 (네이버 + 일반)"""
        print("모든 상품 임베딩 업데이트를 시작합니다...")
        
        # 네이버 상품 임베딩 업데이트
        naver_processed, naver_updated = self.update_naver_embeddings(batch_size)
        
        print("\n" + "="*60 + "\n")
        
        # 일반 상품 임베딩 업데이트
        regular_processed, regular_updated = self.update_regular_embeddings(batch_size)
        
        # 총계 출력
        total_processed = naver_processed + regular_processed
        total_updated = naver_updated + regular_updated
        
        print("\n" + "="*60)
        print(f"전체 임베딩 업데이트 완료:")
        print(f"  - 네이버 상품: {naver_processed}개 처리, {naver_updated}개 업데이트")
        print(f"  - 일반 상품: {regular_processed}개 처리, {regular_updated}개 업데이트")
        print(f"  - 총계: {total_processed}개 처리, {total_updated}개 업데이트")
        print("="*60)

    def search_similar_products(self, query_embedding: List[float], limit: int = 10) -> List[dict]:
        """검색어 임베딩과 유사한 상품들을 검색 (네이버 + 일반)"""
        try:
            query_vector_string = self.embedding_to_vector_string(query_embedding)
            
            with self.get_db_connection() as conn:
                with conn.cursor() as cursor:
                    # 네이버 상품과 일반 상품을 모두 검색
                    cursor.execute("""
                        (SELECT 
                            'naver' as type,
                            naver_product_id as id,
                            product_id,
                            title as name,
                            description,
                            price,
                            image_url,
                            mall_name as seller,
                            product_url,
                            brand,
                            maker,
                            category1,
                            category2,
                            category3,
                            category4,
                            review_count,
                            rating,
                            search_count,
                            created_at,
                            updated_at,
                            1 - (title_embedding <=> %s::vector) as similarity
                        FROM naver_product 
                        WHERE title_embedding IS NOT NULL)
                        
                        UNION ALL
                        
                        (SELECT 
                            'regular' as type,
                            product_id as id,
                            CAST(product_id AS VARCHAR) as product_id,
                            name,
                            description,
                            price,
                            image_url,
                            registered_by as seller,
                            NULL as product_url,
                            NULL as brand,
                            NULL as maker,
                            category,
                            NULL as category2,
                            NULL as category3,
                            NULL as category4,
                            0 as review_count,
                            0 as rating,
                            0 as search_count,
                            registration_date as created_at,
                            registration_date as updated_at,
                            1 - (name_embedding <=> %s::vector) as similarity
                        FROM product 
                        WHERE name_embedding IS NOT NULL)
                        
                        ORDER BY similarity DESC
                        LIMIT %s
                    """, (query_vector_string, query_vector_string, limit))
                    
                    results = []
                    for row in cursor.fetchall():
                        product = {
                            'type': row[0],
                            'id': row[1],
                            'product_id': row[2],
                            'name': row[3],
                            'description': row[4],
                            'price': row[5],
                            'image_url': row[6],
                            'seller': row[7],
                            'product_url': row[8],
                            'brand': row[9],
                            'maker': row[10],
                            'category1': row[11],
                            'category2': row[12],
                            'category3': row[13],
                            'category4': row[14],
                            'review_count': row[15],
                            'rating': row[16],
                            'search_count': row[17],
                            'created_at': row[18].isoformat() if row[18] else None,
                            'updated_at': row[19].isoformat() if row[19] else None,
                            'similarity': float(row[20]) if row[20] else 0.0
                        }
                        results.append(product)
                    
                    return results
                    
        except Exception as e:
            print(f"임베딩 검색 실패: {e}")
            return []

def main():
    try:
        updater = EmbeddingUpdater()
        
        # 명령행 인수 확인
        auto_mode = len(sys.argv) > 1 and sys.argv[1] == '--auto'
        product_type = len(sys.argv) > 2 and sys.argv[2]  # 'naver', 'regular', 'all'
        
        # 기본값 설정
        if not product_type:
            product_type = 'all'
        
        # 임베딩이 없는 상품 수 확인
        naver_count = updater.count_naver_products_without_embedding()
        regular_count = updater.count_regular_products_without_embedding()
        total_count = naver_count + regular_count
        
        print(f"임베딩이 없는 상품 수:")
        print(f"  - 네이버 상품: {naver_count}개")
        print(f"  - 일반 상품: {regular_count}개")
        print(f"  - 총계: {total_count}개")
        
        if total_count == 0:
            print("모든 상품에 임베딩이 이미 설정되어 있습니다.")
            return
        
        if auto_mode:
            print(f"자동 실행 모드: {product_type} 상품의 임베딩 업데이트를 시작합니다.")
        else:
            # 사용자 확인
            response = input(f"{total_count}개 상품의 임베딩을 업데이트하시겠습니까? (y/N): ")
            if response.lower() != 'y':
                print("취소되었습니다.")
                return
        
        # 임베딩 업데이트 실행
        if product_type == 'naver':
            updater.update_naver_embeddings()
        elif product_type == 'regular':
            updater.update_regular_embeddings()
        else:  # 'all'
            updater.update_all_embeddings()
        
    except Exception as e:
        print(f"오류 발생: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
