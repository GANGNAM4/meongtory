from pydantic import BaseModel
from langchain_openai import ChatOpenAI
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_postgres import PGVector
from langchain.prompts import PromptTemplate
from langchain_core.documents import Document
import os
import logging
import psycopg2
import json
from typing import List, Dict, Any, Optional

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 환경 변수
DB_USER = os.getenv("DB_USER", "jjj")
DB_PASSWORD = os.getenv("DB_PASSWORD", "1q2w3e4r!")
DB_HOST = os.getenv("DB_HOST", "db")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "meong")
CONNECTION_STRING = f"postgresql+psycopg2://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
EMBEDDING_MODEL_NAME = os.getenv("EMBEDDING_MODEL_NAME", "all-MiniLM-L6-v2")
VECTORSTORE_COLLECTION_NAME = os.getenv("INSURANCE_VECTORSTORE_COLLECTION_NAME", "insurance_vectors")
VECTORSTORE_DISTANCE_STRATEGY = os.getenv("VECTORSTORE_DISTANCE_STRATEGY", "cosine")
VECTORSTORE_SEARCH_LIMIT = int(os.getenv("INSURANCE_VECTORSTORE_SEARCH_LIMIT", "5"))
PROMPT_TEMPLATE_PATH = os.getenv("INSURANCE_PROMPT_TEMPLATE_PATH", "/app/chatBot/insurance_prompt_template.txt")

# 임베딩 모델
try:
    embeddings = HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL_NAME)
    logger.info(f"HuggingFaceEmbeddings initialized successfully with model: {EMBEDDING_MODEL_NAME}")
except Exception as e:
    logger.error(f"Failed to initialize HuggingFaceEmbeddings: {e}")
    raise Exception("Embedding initialization failed")

# PGVector 초기화
try:
    logger.debug(f"Attempting to connect to database with: {CONNECTION_STRING}")
    vectorstore = PGVector(
        connection=CONNECTION_STRING,
        embeddings=embeddings,
        collection_name=VECTORSTORE_COLLECTION_NAME,
        distance_strategy=VECTORSTORE_DISTANCE_STRATEGY,
        use_jsonb=True,
        pre_delete_collection=False  # 기존 컬렉션 유지
    )
    logger.info("PGVector initialized successfully")
except Exception as e:
    logger.error(f"Failed to initialize PGVector: {e}", exc_info=True)
    raise Exception(f"Vectorstore initialization failed: {str(e)}")

# 보험 상품 데이터를 벡터스토어에 삽입
def initialize_insurance_vectorstore():
    try:
        logger.debug("Starting initialize_insurance_vectorstore")
        
        # 기존 데이터 확인 및 삭제
        with psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            dbname=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD
        ) as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT COUNT(*)
                    FROM langchain_pg_embedding e
                    JOIN langchain_pg_collection c ON e.collection_id = c.uuid
                    WHERE c.name = %s
                """, (VECTORSTORE_COLLECTION_NAME,))
                count = cur.fetchone()[0]
                logger.debug(f"Existing records in {VECTORSTORE_COLLECTION_NAME}: {count}")

                if count > 0:
                    logger.info(f"Deleting existing data in {VECTORSTORE_COLLECTION_NAME}")
                    cur.execute("""
                        DELETE FROM langchain_pg_embedding
                        WHERE collection_id = (
                            SELECT uuid FROM langchain_pg_collection WHERE name = %s
                        )
                    """, (VECTORSTORE_COLLECTION_NAME,))
                    conn.commit()
                    logger.info("Existing data deleted")

        # 보험 상품 데이터를 DB에서 가져와서 벡터스토어에 삽입
        # logger.info("Fetching insurance products from database")
        insurance_docs = fetch_insurance_products_from_db()
        
        if insurance_docs:
            try:
                # 기존 데이터가 있으면 건너뛰기
                existing_docs = vectorstore.similarity_search("보험", k=1)
                if existing_docs:
                    pass  # logger.info("Insurance data already exists in vectorstore, skipping insertion")
                else:
                    vectorstore.add_documents(insurance_docs)
                    # logger.info(f"Inserted {len(insurance_docs)} insurance products into vectorstore")
            except Exception as e:
                logger.warning(f"Failed to add insurance documents to vectorstore: {e}")
                logger.info("Continuing without insurance vectorstore initialization")
        else:
            logger.warning("No insurance products found in database")
            
    except Exception as e:
        logger.error(f"Failed to initialize insurance vectorstore: {str(e)}")
        raise Exception(f"Insurance vectorstore initialization failed: {str(e)}")

# DB에서 보험 상품 데이터를 가져와서 Document 형태로 변환
def fetch_insurance_products_from_db() -> List[Document]:
    try:
        with psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            dbname=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD
        ) as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT 
                        id, company, product_name, description, 
                        features, coverage_details, redirect_url, logo_url
                    FROM insurance_products 
                    ORDER BY id
                """)
                
                rows = cur.fetchall()
                documents = []
                
                for row in rows:
                    id, company, product_name, description, features, coverage_details, redirect_url, logo_url = row
                    
                    # 보장내역과 특징을 파싱
                    features_list = features.split(',') if features else []
                    coverage_list = coverage_details.split(',') if coverage_details else []
                    
                    # Document 내용 구성
                    content = f"""
보험사: {company}
상품명: {product_name}
설명: {description}
주요 특징: {', '.join(features_list[:5])}  # 상위 5개만
보장내역: {', '.join(coverage_list[:10])}  # 상위 10개만
가입링크: {redirect_url}
                    """.strip()
                    
                    # 메타데이터 구성
                    metadata = {
                        "source": "insurance_database",
                        "id": id,
                        "company": company,
                        "product_name": product_name,
                        "features": features_list,
                        "coverage_details": coverage_list,
                        "redirect_url": redirect_url,
                        "logo_url": logo_url
                    }
                    
                    documents.append(Document(
                        page_content=content,
                        metadata=metadata
                    ))
                
                logger.info(f"Fetched {len(documents)} insurance products from database")
                return documents
                
    except Exception as e:
        logger.error(f"Failed to fetch insurance products from database: {str(e)}")
        return []

# OpenAI 모델
try:
    llm = ChatOpenAI(
        api_key=OPENAI_API_KEY,
        model=OPENAI_MODEL,
        max_tokens=300  # 보험 정보는 더 긴 응답이 필요할 수 있음
    )
    logger.info("ChatOpenAI initialized successfully")
except Exception as e:
    logger.error(f"Failed to initialize ChatOpenAI: {e}")
    raise Exception("LLM initialization failed")

# 보험 전용 프롬프트 템플릿
def get_insurance_prompt_template():
    try:
        with open(PROMPT_TEMPLATE_PATH, 'r', encoding='utf-8') as f:
            prompt_template_content = f.read()
        prompt_template = PromptTemplate(input_variables=["context", "query"], template=prompt_template_content)
        logger.info(f"Insurance prompt template loaded successfully from {PROMPT_TEMPLATE_PATH}")
        return prompt_template
    except Exception as e:
        logger.error(f"Failed to load insurance prompt template from {PROMPT_TEMPLATE_PATH}: {e}")
        # 기본 템플릿 사용
        default_template = """
당신은 펫보험 전문가 챗봇입니다.
사용자의 질문에 대해 위 Context를 참고하여 정확하고 간결하게 설명하세요.

[Context]
{context}

[Instruction]
- 보험사명과 상품명을 명확히 포함하세요
- 주요 보장 내역을 요약해서 설명하세요
- 각 상품의 가입 링크가 있다면 반드시 포함하세요
- 링크는 "🔗 [보험사명] 바로가기: [링크]" 형식으로 표시하세요
- 사용자 친화적인 톤으로 답변하세요
- 300자 이내로 답변하세요
- 보험 전문 용어는 쉽게 풀어서 설명하세요

[펫 정보 고려사항]
- 펫의 나이, 품종, 체중을 고려한 보험 추천을 해주세요
- 의료기록이 있는 경우, 해당 질병이나 치료와 관련된 보장 내역을 우선적으로 설명하세요
- 특별관리사항이 있는 경우, 그에 맞는 보험 상품을 추천하세요
- 예방접종 기록을 참고하여 적절한 보험 상품을 제안하세요
- 마이크로칩 정보가 있으면 보험 가입 시 활용할 수 있음을 안내하세요

[주의사항]
- Context에 없는 정보는 추측하지 마세요
- 보험 가입을 강요하지 마세요
- 객관적이고 정확한 정보만 제공하세요
- 링크가 있는 상품은 반드시 링크를 포함하세요
- 펫의 의료기록을 고려한 맞춤형 추천을 제공하세요

사용자 질문: {query}

답변:
        """
        return PromptTemplate(input_variables=["context", "query"], template=default_template)

class InsuranceQueryRequest(BaseModel):
    query: str
    petId: Optional[int] = None

    class Config:
        # null 값을 허용하도록 설정
        json_encoders = {
            int: lambda v: v if v is not None else None
        }

async def process_insurance_rag_query(query: str, pet_id: Optional[int] = None):
    try:
        # 한글 인코딩 확인 및 로깅
        logger.info(f"Processing insurance query (raw): {repr(query)}")
        logger.info(f"Processing insurance query (decoded): {query}")
        logger.info(f"Received petId: {pet_id}")
        
        # petId가 있으면 MyPet 정보를 포함한 쿼리로 처리
        if pet_id:
            # MyPet 정보를 가져와서 쿼리에 포함
            from main import get_mypet_info
            pet_info = await get_mypet_info(pet_id)
            if pet_info:
                # pet_info는 문자열이므로 파싱하여 정보 추출
                import re
                
                # 정규표현식으로 펫 정보 파싱
                name_match = re.search(r'이름: ([^,]+)', pet_info)
                breed_match = re.search(r'품종: ([^,]+)', pet_info)
                age_match = re.search(r'나이: ([^,]+)', pet_info)
                gender_match = re.search(r'성별: ([^,]+)', pet_info)
                weight_match = re.search(r'체중: ([^,]+)', pet_info)
                microchip_match = re.search(r'마이크로칩: ([^,]+)', pet_info)
                medical_match = re.search(r'의료기록: ([^,]+)', pet_info)
                vaccination_match = re.search(r'예방접종: ([^,]+)', pet_info)
                special_match = re.search(r'특별관리: ([^,]+)', pet_info)
                notes_match = re.search(r'메모: ([^,]+)', pet_info)
                
                # 정보 추출 (매치되지 않으면 빈 문자열)
                pet_name = name_match.group(1) if name_match else ''
                breed = breed_match.group(1) if breed_match else ''
                age = age_match.group(1) if age_match else ''
                gender = gender_match.group(1) if gender_match else ''
                weight = weight_match.group(1) if weight_match else ''
                microchip_id = microchip_match.group(1) if microchip_match else ''
                medical_history = medical_match.group(1) if medical_match else ''
                vaccinations = vaccination_match.group(1) if vaccination_match else ''
                special_needs = special_match.group(1) if special_match else ''
                notes = notes_match.group(1) if notes_match else ''
                
                # 사용자 질문에서 @태그를 펫 정보로 치환
                pet_tag_pattern = r'@' + re.escape(pet_name)
                enhanced_query = re.sub(pet_tag_pattern, f"{breed} {age}세 {gender}", query)
                
                # 의료기록 정보를 사용자 질문에 추가
                medical_info = ""
                if medical_history and medical_history != "없음":
                    medical_info += f"의료기록: {medical_history}, "
                if vaccinations and vaccinations != "없음":
                    medical_info += f"예방접종: {vaccinations}, "
                if special_needs and special_needs != "없음":
                    medical_info += f"특별관리: {special_needs}, "
                if notes and notes != "없음":
                    medical_info += f"메모: {notes}, "
                
                # 의료기록 정보가 있으면 사용자 질문에 추가
                if medical_info:
                    enhanced_query += f" ({medical_info.strip(', ')})"
                
                # 펫 정보를 구조화된 형태로 프롬프트에 포함 (의료기록 포함)
                final_query = f"""
펫 정보:
- 이름: {pet_name}
- 품종: {breed}
- 나이: {age}세
- 성별: {gender}
- 체중: {weight}kg
- 마이크로칩: {microchip_id}
- 의료기록: {medical_history}
- 예방접종: {vaccinations}
- 특별관리사항: {special_needs}
- 메모: {notes}

사용자 질문: {enhanced_query}
                """.strip()
                logger.info(f"Enhanced query with pet tag replacement: {final_query}")
            else:
                final_query = query
        else:
            final_query = query
        
        # 직접 데이터베이스에서 보험 상품 검색
        insurance_products = fetch_insurance_products_from_db()
        
        if not insurance_products:
            return {"answer": "죄송합니다. 현재 등록된 보험 상품 정보가 없습니다."}
        
        # 고급 필터링 시스템
        filtered_products = filter_insurance_products(insurance_products, final_query)
        
        if not filtered_products:
            return {"answer": "죄송합니다. 검색 조건에 맞는 보험 상품을 찾을 수 없습니다. 다른 검색어로 다시 시도해보세요."}
        
        # 컨텍스트 구성
        context_parts = []
        for i, product in enumerate(filtered_products, 1):
            metadata = product.metadata
            company = metadata.get('company', '')
            product_name = metadata.get('product_name', '')
            redirect_url = metadata.get('redirect_url', '')
            
            # 링크 정보를 포함한 컨텍스트 구성
            product_info = f"[상품 {i}]\n{product.page_content}"
            if redirect_url:
                product_info += f"\n🔗 가입 링크: {redirect_url}"
            
            context_parts.append(product_info)
        
        context = "\n\n".join(context_parts)
        logger.info(f"Retrieved insurance context: {context[:200]}...")  # 컨텍스트 앞부분만 로깅
        
        # 프롬프트 생성 및 LLM 호출
        prompt_template = get_insurance_prompt_template()
        prompt = prompt_template.format(context=context, query=final_query)
        logger.info(f"Generated insurance prompt: {prompt[:200]}...")  # 프롬프트 앞부분만 로깅
        
        response = llm.invoke(prompt)
        logger.info(f"Insurance LLM response: {response.content}")
        
        return {"answer": response.content}
        
    except Exception as e:
        logger.error(f"Error processing insurance query: {e}", exc_info=True)
        raise Exception(f"Insurance query processing failed: {str(e)}")

def filter_insurance_products(products, query):
    """
    검색어에 따라 보험 상품을 필터링하는 고급 시스템
    """
    query_lower = query.lower()
    filtered_products = []
    
    # 검색 조건 정의
    search_conditions = {
        '보험사': {
            '삼성화재': ['삼성', '삼성화재', 'samsung'],
            'NH농협손해보험': ['nh', '농협', '농협손해보험', 'nh농협'],
            'KB손해보험': ['kb', '국민', 'kb손해보험'],
            '현대해상': ['현대', '현대해상', 'hi'],
            '메리츠화재': ['메리츠', 'meritz'],
            'DB손해보험': ['db', 'db손해보험']
        },
        '가입조건': {
            '나이': ['나이', '연령', '만나이', '생후', '개월', '세'],
            '종': ['강아지', '고양이', '반려견', '반려묘', '개', '고양이'],
            '품종': ['품종', '견종', '묘종']
        },
        '보장내역': {
            '의료비': ['의료비', '치료비', '병원비', '진료비'],
            '수술비': ['수술비', '수술', '외과'],
            '입원': ['입원', '입원비', '입원치료'],
            '통원': ['통원', '통원치료', '외래'],
            '검사비': ['검사비', '검사', '진단'],
            '약품비': ['약품비', '약', '처방']
        },
        '의료기록관련': {
            '만성질환': ['만성', '당뇨', '심장병', '관절염', '알레르기', '피부병'],
            '수술이력': ['수술', '중성화', '불임수술', '외과수술'],
            '예방접종': ['예방접종', '백신', '접종'],
            '특별관리': ['특별관리', '식이요법', '운동요법', '물리치료'],
            '마이크로칩': ['마이크로칩', '칩', '등록']
        },
        '특별조건': {
            '특약': ['특약', '추가보장', '선택보장'],
            '할인': ['할인', '혜택', '이벤트'],
            '자동갱신': ['갱신', '자동갱신', '연장']
        }
    }
    
    for product in products:
        score = 0
        product_text = product.page_content.lower()
        metadata = product.metadata
        
        # 1. 보험사 필터링 (가장 높은 우선순위)
        company = metadata.get('company', '').lower()
        for company_name, keywords in search_conditions['보험사'].items():
            if any(keyword in query_lower for keyword in keywords):
                if company_name.lower() in company:
                    score += 20  # 매우 높은 점수
                    break
        
        # 2. 의료기록관련 필터링 (펫 정보 기반)
        for medical_type, keywords in search_conditions['의료기록관련'].items():
            if any(keyword in query_lower for keyword in keywords):
                if any(keyword in product_text for keyword in keywords):
                    score += 15  # 높은 점수
        
        # 3. 가입조건 필터링
        for condition_type, keywords in search_conditions['가입조건'].items():
            if any(keyword in query_lower for keyword in keywords):
                if any(keyword in product_text for keyword in keywords):
                    score += 10
        
        # 4. 보장내역 필터링
        for coverage_type, keywords in search_conditions['보장내역'].items():
            if any(keyword in query_lower for keyword in keywords):
                if any(keyword in product_text for keyword in keywords):
                    score += 8
        
        # 5. 특별조건 필터링
        for special_type, keywords in search_conditions['특별조건'].items():
            if any(keyword in query_lower for keyword in keywords):
                if any(keyword in product_text for keyword in keywords):
                    score += 6
        
        # 6. 정확한 문구 매칭 (높은 점수)
        if query_lower in product_text:
            score += 25
        
        # 7. 제품명 매칭
        product_name = metadata.get('product_name', '').lower()
        if query_lower in product_name:
            score += 18
        
        # 8. 일반 키워드 매칭 (낮은 점수)
        general_keywords = ['보험', '펫보험', '동물보험', '가입', '보장', '보상', '보험료', '상품']
        for keyword in general_keywords:
            if keyword in query_lower and keyword in product_text:
                score += 3
        
        # 점수가 있는 상품만 필터링
        if score > 0:
            filtered_products.append((score, product))
    
    # 점수순으로 정렬
    filtered_products.sort(key=lambda x: x[0], reverse=True)
    
    # 최소 점수 기준 적용 (더 엄격한 필터링)
    min_score = 10  # 최소 점수 기준
    high_score_products = [product for score, product in filtered_products if score >= min_score]
    
    # 높은 점수 상품이 있으면 그것만 반환, 없으면 상위 1개만 반환
    if high_score_products:
        return high_score_products[:2]  # 최대 2개만 반환
    else:
        return [product for score, product in filtered_products[:1]]  # 상위 1개만 반환

# 서버 시작 시 보험 벡터스토어 초기화
initialize_insurance_vectorstore() 