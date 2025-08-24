package com.my.backend.insurance.schedule;

import com.my.backend.insurance.dto.InsuranceProductDto;
import lombok.extern.slf4j.Slf4j;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * 개선된 보험 크롤링 시스템
 * 1단계: 보험 이름 크롤링 정확도 개선
 */
@Slf4j
@Component
public class ImprovedInsuranceCrawler {

    // 보험사별 실제 펫보험 URL과 정보
    private static final Map<String, InsuranceCompanyInfo> COMPANY_INFO = new HashMap<>();
    
    static {
        // 삼성화재 - 실제 확인된 정보
        COMPANY_INFO.put("삼성화재", InsuranceCompanyInfo.builder()
            .companyName("삼성화재")
            .petInsuranceUrl("https://direct.samsungfire.com/m/fp/pet.html")
            .fallbackProductName("삼성화재 다이렉트 펫보험")
            .productNameSelectors(new String[]{
                "h3.tit", ".fp-content h3", ".product-title", ".insurance-name"
            })
            .descriptionSelectors(new String[]{
                "p.tit-sub", ".product-description", ".insurance-desc"
            })
            .featureSelectors(new String[]{
                ".benefit-list li", ".feature-list li", ".coverage-item"
            })
            .logoSelectors(new String[]{
                ".fp-header img", ".logo img", ".company-logo img"
            })
            .build());
            
        // NH농협손해보험
        COMPANY_INFO.put("NH농협손해보험", InsuranceCompanyInfo.builder()
            .companyName("NH농협손해보험")
            .petInsuranceUrl("https://nhfire.co.kr/product/retrieveProduct.nhfire?pdtCd=D314511")
            .fallbackProductName("NH농협 펫앤미든든보험")
            .productNameSelectors(new String[]{
                ".product-name", "h1.title", ".insurance-title"
            })
            .descriptionSelectors(new String[]{
                ".product-summary", ".insurance-summary"
            })
            .featureSelectors(new String[]{
                ".benefit-list li", ".feature-item"
            })
            .logoSelectors(new String[]{
                ".header-logo img", ".logo img"
            })
            .build());
            
        // KB손해보험
        COMPANY_INFO.put("KB손해보험", InsuranceCompanyInfo.builder()
            .companyName("KB손해보험")
            .petInsuranceUrl("https://www.kbinsure.co.kr/CG313010001.ec")
            .fallbackProductName("KB 금쪽같은 펫보험")
            .productNameSelectors(new String[]{
                ".product-title", "h1.title", ".insurance-name"
            })
            .descriptionSelectors(new String[]{
                ".product-desc", ".insurance-desc"
            })
            .featureSelectors(new String[]{
                ".benefit-list li", ".coverage-list li"
            })
            .logoSelectors(new String[]{
                ".header .logo img", ".company-logo img"
            })
            .build());
            
        // 현대해상
        COMPANY_INFO.put("현대해상", InsuranceCompanyInfo.builder()
            .companyName("현대해상")
            .petInsuranceUrl("https://direct.hi.co.kr/service.do?m=9762101622&simpCalc=Y&PET_TYPE=dog&HDMS1=cpc&HDMS2=google&HDMS3=listing&HDMS4=%ED%8E%AB%EB%B3%B4%ED%97%98@%ED%98%84%EB%8C%80%ED%95%B4%EC%83%81%ED%8E%AB%EB%B3%B4%ED%97%98&utm_source=google&utm_medium=cpc&utm_campaign=%ED%8E%AB%EB%B3%B4%ED%97%98&utm_term=%ED%8E%AB%EB%B3%B4%ED%97%98@%ED%98%84%EB%8C%80%ED%95%B4%EC%83%81%ED%8E%AB%EB%B3%B4%ED%97%98&gad_source=1&gad_campaignid=21661669642&gbraid=0AAAAABr8i80caAh4fLU84TI_z7iMXrurr&gclid=Cj0KCQjw8KrFBhDUARIsAMvIApY5Oh4Ge_3v7FdQhlMRSQ2hlNQ7v3y3O487K-oEmE-4pndhX7BtkEkaAn3qEALw_wcB")
            .fallbackProductName("현대해상 펫보험")
            .productNameSelectors(new String[]{
                ".product-name", "h1.title", ".main-title", ".pet-title", "h1", "h2"
            })
            .descriptionSelectors(new String[]{
                ".product-summary", ".main-desc", ".pet-desc", ".intro-text", "p"
            })
            .featureSelectors(new String[]{
                ".benefit-list li", ".feature-list li", ".coverage-item", "li"
            })
            .logoSelectors(new String[]{
                ".header .logo img", ".company-logo img", ".top-logo img", "img[src*='logo']"
            })
            .build());
            
        // 메리츠화재
        COMPANY_INFO.put("메리츠화재", InsuranceCompanyInfo.builder()
            .companyName("메리츠화재")
            .petInsuranceUrl("https://store.meritzfire.com/pet/product.do")
            .fallbackProductName("메리츠화재 다이렉트 강아지보험")
            .productNameSelectors(new String[]{
                ".product-title", "h1.title", ".main-title", ".pet-name", ".product-name"
            })
            .descriptionSelectors(new String[]{
                ".product-desc", ".main-summary", ".pet-summary", ".product-description"
            })
            .featureSelectors(new String[]{
                ".benefit-list li", ".feature-item", ".coverage-list li", ".product-features li"
            })
            .logoSelectors(new String[]{
                ".header .logo img", ".company-logo img", ".brand-logo img", ".meritz-logo img"
            })
            .build());
            
        // DB손해보험
        COMPANY_INFO.put("DB손해보험", InsuranceCompanyInfo.builder()
            .companyName("DB손해보험")
            .petInsuranceUrl("https://directidb.co.kr/l_pet/index.html")
            .fallbackProductName("DB손해보험 펫보험")
            .productNameSelectors(new String[]{
                ".product-name", "h1.title", ".main-title", ".insurance-title", "h1", "h2"
            })
            .descriptionSelectors(new String[]{
                ".product-desc", ".main-desc", ".insurance-summary", ".intro-text", "p"
            })
            .featureSelectors(new String[]{
                ".benefit-list li", ".feature-list li", ".coverage-item", "li"
            })
            .logoSelectors(new String[]{
                ".header .logo img", ".company-logo img", ".db-logo img", "img[src*='logo']"
            })
            .build());
    }

    /**
     * 1단계: 보험 이름 크롤링 정확도 개선
     */
    public InsuranceProductDto crawlInsuranceName(String companyName) {
        log.info("=== 1단계: {} 보험 이름 크롤링 시작 ===", companyName);
        
        InsuranceCompanyInfo companyInfo = COMPANY_INFO.get(companyName);
        if (companyInfo == null) {
            log.warn("지원하지 않는 보험사: {}", companyName);
            return createFallbackProduct(companyName);
        }
        
        try {
            Document doc = fetchWithRetry(companyInfo.getPetInsuranceUrl(), 3);
            
            // 1단계: 정확한 보험 상품명 추출
            String productName = extractProductName(doc, companyInfo);
            
            // KB 상품명 정규화 (A/B 표기 정리)
            if (companyName.equals("KB손해보험")) {
                productName = normalizeKBProductName(productName);
            }
            
            // 2단계: 상품 설명 추출
            String description = extractDescription(doc, companyInfo);
            
            // 3단계: 기본 특징 추출
            List<String> features = extractFeatures(doc, companyInfo);
            
            // 4단계: 데이터 정리 및 검증
            productName = sanitizeProductName(productName);
            description = sanitizeDescription(description);
            
            log.info("크롤링 성공 - 상품명: {}, 설명: {}, 특징 수: {}", 
                productName, description.substring(0, Math.min(50, description.length())), features.size());
            
            return InsuranceProductDto.builder()
                    .company(companyName)
                    .productName(productName)
                    .description(description)
                    .features(features)
                    .logoUrl("")
                    .redirectUrl(companyInfo.getPetInsuranceUrl())
                    .build();
                    
        } catch (Exception e) {
            log.error("{} 크롤링 실패: {}", companyName, e.getMessage());
            // 실패 시 null 반환하여 명확히 구분
            return null;
        }
    }
    
    /**
     * 정확한 보험 상품명 추출
     */
    private String extractProductName(Document doc, InsuranceCompanyInfo companyInfo) {
        log.debug("상품명 추출 시작: {}", companyInfo.getCompanyName());
        
        // 선택자들을 순서대로 시도
        for (String selector : companyInfo.getProductNameSelectors()) {
            try {
                Elements elements = doc.select(selector);
                for (Element element : elements) {
                    String text = element.text().trim();
                    
                    // 유효한 상품명인지 검증
                    if (isValidProductName(text, companyInfo.getCompanyName())) {
                        log.info("상품명 추출 성공 [{}]: {}", selector, text);
                        return text;
                    }
                }
            } catch (Exception e) {
                log.debug("선택자 '{}' 실패: {}", selector, e.getMessage());
            }
        }
        
        // 페이지 제목에서 추출 시도
        String title = doc.title();
        if (title != null && isValidProductName(title, companyInfo.getCompanyName())) {
            log.info("페이지 제목에서 상품명 추출: {}", title);
            return title;
        }
        
        // 텍스트에서 패턴 매칭으로 추출
        String extractedFromText = extractProductNameFromText(doc.text(), companyInfo.getCompanyName());
        if (extractedFromText != null) {
            log.info("텍스트 패턴 매칭으로 상품명 추출: {}", extractedFromText);
            return extractedFromText;
        }
        
        log.warn("상품명 추출 실패, 폴백 사용: {}", companyInfo.getFallbackProductName());
        return companyInfo.getFallbackProductName();
    }
    
    /**
     * 텍스트에서 보험 상품명 패턴 매칭으로 추출
     */
    @SuppressWarnings("unused")
    private String extractProductNameFromText(String text, String companyName) {
        // 보험 상품명 패턴들
        String[] patterns = {
            companyName + "\\s*(다이렉트\\s*)?펫\\s*보험[^\\s]*",
            companyName + "\\s*반려동물\\s*보험[^\\s]*",
            "펫[앤&]미[든덜]*\\s*보험",
            "금쪽같은\\s*펫\\s*보험",
            "[하이]+펫\\s*보험"
        };
        
        for (String patternStr : patterns) {
            Pattern pattern = Pattern.compile(patternStr, Pattern.CASE_INSENSITIVE);
            java.util.regex.Matcher matcher = pattern.matcher(text);
            if (matcher.find()) {
                String found = matcher.group().trim();
                if (found.length() <= 50) { // 너무 긴 텍스트 제외
                    return found;
                }
            }
        }
        
        return null;
    }
    
    /**
     * 유효한 상품명인지 검증
     */
    private boolean isValidProductName(String text, String companyName) {
        if (text == null || text.isBlank()) return false;
        if (text.length() < 3 || text.length() > 200) return false;
        
        // 보험 관련 키워드 포함 여부
        String lowerText = text.toLowerCase();
        boolean hasInsuranceKeywords = lowerText.contains("보험") || 
                                     lowerText.contains("펫") || 
                                     lowerText.contains("반려동물");
        
        // 회사명 포함 여부 (선택사항)
        @SuppressWarnings("unused")
        boolean hasCompanyName = lowerText.contains(companyName.toLowerCase()) ||
                                lowerText.contains(companyName.substring(0, 2).toLowerCase());
        
        return hasInsuranceKeywords;
    }
    
    /**
     * 상품 설명 추출
     */
    private String extractDescription(Document doc, InsuranceCompanyInfo companyInfo) {
        // 설명 선택자들 시도
        for (String selector : companyInfo.getDescriptionSelectors()) {
            try {
                Element element = doc.selectFirst(selector);
                if (element != null) {
                    String text = element.text().trim();
                    if (text.length() > 10 && text.length() <= 500) {
                        return text;
                    }
                }
            } catch (Exception e) {
                log.debug("설명 선택자 '{}' 실패: {}", selector, e.getMessage());
            }
        }
        
        // 메타 태그에서 추출
        String metaDesc = doc.select("meta[name=description]").attr("content");
        if (metaDesc != null && !metaDesc.isBlank()) {
            return metaDesc.trim();
        }
        
        String ogDesc = doc.select("meta[property=og:description]").attr("content");
        if (ogDesc != null && !ogDesc.isBlank()) {
            return ogDesc.trim();
        }
        
        // 폴백 설명
        return companyInfo.getFallbackProductName() + " - 반려동물을 위한 맞춤형 보험 상품";
    }
    
    /**
     * 보험 특징 추출
     */
    private List<String> extractFeatures(Document doc, InsuranceCompanyInfo companyInfo) {
        List<String> features = new ArrayList<>();
        
        for (String selector : companyInfo.getFeatureSelectors()) {
            try {
                Elements elements = doc.select(selector);
                for (Element element : elements) {
                    String text = element.text().trim();
                    if (isValidFeature(text)) {
                        features.add(text);
                        if (features.size() >= 5) break; // 최대 5개
                    }
                }
                if (!features.isEmpty()) break; // 하나라도 찾으면 다른 선택자는 시도하지 않음
            } catch (Exception e) {
                log.debug("특징 선택자 '{}' 실패: {}", selector, e.getMessage());
            }
        }
        
        // 특징이 없으면 기본 특징 사용
        if (features.isEmpty()) {
            features = getDefaultFeatures(companyInfo.getCompanyName());
        }
        
        return features;
    }
    
    /**
     * 유효한 특징인지 검증
     */
    private boolean isValidFeature(String text) {
        if (text == null || text.isBlank()) return false;
        if (text.length() < 5 || text.length() > 100) return false;
        
        // 보험 관련 키워드 포함 여부
        String lowerText = text.toLowerCase();
        String[] keywords = {"보장", "치료", "질병", "상해", "수술", "진료", "응급", "입원", "통원"};
        
        for (String keyword : keywords) {
            if (lowerText.contains(keyword)) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * 기본 특징 반환
     */
    private List<String> getDefaultFeatures(String companyName) {
        switch (companyName) {
            case "삼성화재":
                return List.of("질병/상해 치료비 보장", "응급진료비 보장", "간편 온라인 가입", "동물등록증 할인 5%");
            case "NH농협손해보험":
                return List.of("질병/상해 치료비 보장", "펫앤미든든 보장", "농협 특별 혜택");
            case "KB손해보험":
                return List.of("질병/상해 치료비 보장", "수술비 보장", "금쪽같은 혜택");
            default:
                return List.of("질병/상해 치료비 보장", "응급비용 보장", "간편 접수");
        }
    }
    
    /**
     * 폴백 상품 생성
     */
    private InsuranceProductDto createFallbackProduct(String companyName) {
        InsuranceCompanyInfo companyInfo = COMPANY_INFO.get(companyName);
        String productName = companyInfo != null ? companyInfo.getFallbackProductName() : companyName + " 펫보험";
        
        return InsuranceProductDto.builder()
                .company(companyName)
                .productName(productName)
                .description(productName + " - 반려동물을 위한 보험 상품")
                .features(getDefaultFeatures(companyName))
                .logoUrl("")
                .redirectUrl(companyInfo != null ? companyInfo.getPetInsuranceUrl() : "")
                .build();
    }
    
    /**
     * KB 상품명 정규화 (A/B 표기 정리)
     */
    private String normalizeKBProductName(String productName) {
        if (productName == null || productName.isEmpty()) {
            return productName;
        }
        
        String normalized = productName;
        
        // A/B 표기 제거 및 정리
        normalized = normalized.replaceAll("\\s*\\[A\\]\\s*", "");
        normalized = normalized.replaceAll("\\s*\\[B\\]\\s*", "");
        normalized = normalized.replaceAll("\\s*\\(A\\)\\s*", "");
        normalized = normalized.replaceAll("\\s*\\(B\\)\\s*", "");
        normalized = normalized.replaceAll("\\s*-\\s*A\\s*$", "");
        normalized = normalized.replaceAll("\\s*-\\s*B\\s*$", "");
        normalized = normalized.replaceAll("\\s*A형\\s*", "");
        normalized = normalized.replaceAll("\\s*B형\\s*", "");
        
        // 꼬리표 제거
        normalized = normalized.replaceAll("\\s*\\|\\s*KB손해보험.*$", "");
        normalized = normalized.replaceAll("\\s*-\\s*KB손해보험.*$", "");
        normalized = normalized.replaceAll("\\s*KB손해보험\\s*\\[.*\\]\\s*$", "");
        
        // 상품안내 등 불필요한 텍스트 제거
        normalized = normalized.replaceAll("\\s*\\(상품안내\\)\\s*", "");
        normalized = normalized.replaceAll("\\s*상품안내\\s*", "");
        
        // 공백 정리
        normalized = normalized.trim().replaceAll("\\s+", " ");
        
        log.debug("KB 상품명 정규화: '{}' → '{}'", productName, normalized);
        
        return normalized.isEmpty() ? productName : normalized;
    }
    
    /**
     * 재시도와 함께 문서 가져오기
     */
    private Document fetchWithRetry(String url, int maxRetry) throws IOException {
        IOException lastException = null;
        
        for (int i = 0; i <= maxRetry; i++) {
            try {
                log.debug("페이지 가져오기 시도 {}/{}: {}", i + 1, maxRetry + 1, url);
                
                return Jsoup.connect(url)
                        .userAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
                        .timeout(15000)
                        .followRedirects(true)
                        .get();
                        
            } catch (IOException e) {
                lastException = e;
                log.warn("페이지 가져오기 실패 시도 {}: {}", i + 1, e.getMessage());
                
                if (i < maxRetry) {
                    try {
                        Thread.sleep(1000 * (i + 1)); // 점진적 대기
                    } catch (InterruptedException ignored) {
                        Thread.currentThread().interrupt();
                    }
                }
            }
        }
        
        throw lastException;
    }
    
    /**
     * 상품명 정리 및 길이 제한
     */
    private String sanitizeProductName(String productName) {
        if (productName == null) return "알 수 없는 펫보험";
        
        productName = productName.trim();
        
        // 특수 문자 및 불필요한 텍스트 제거
        productName = productName.replaceAll("[|].*$", ""); // | 이후 텍스트 제거
        productName = productName.replaceAll("\\s*\\([^)]*\\)\\s*", ""); // 괄호 내용 제거
        productName = productName.replaceAll("\\s*\\[[^\\]]*\\]\\s*", ""); // 대괄호 내용 제거
        productName = productName.replaceAll("\\s+", " "); // 연속 공백 정리
        productName = productName.trim();
        
        // 길이 제한 (DB 필드 길이에 맞춰)
        if (productName.length() > 400) {
            productName = productName.substring(0, 400).trim();
            // 마지막 단어가 잘린 경우 마지막 공백까지만 유지
            int lastSpace = productName.lastIndexOf(' ');
            if (lastSpace > 200) { // 최소 길이 확보
                productName = productName.substring(0, lastSpace);
            }
            productName = productName.trim() + "...";
        }
        
        log.debug("상품명 정리: 원본 길이 -> 정리 후 길이 = {} -> {}", 
                 productName.length() + 3, productName.length()); // +3은 "..." 때문
        
        return productName;
    }
    
    /**
     * 설명 정리 및 길이 제한
     */
    private String sanitizeDescription(String description) {
        if (description == null) return "펫보험 상품 정보";
        
        description = description.trim();
        description = description.replaceAll("\\s+", " "); // 연속 공백 정리
        
        // 길이 제한 (DB 필드 길이에 맞춰)
        if (description.length() > 900) {
            description = description.substring(0, 900).trim();
            // 마지막 단어가 잘린 경우 마지막 공백까지만 유지
            int lastSpace = description.lastIndexOf(' ');
            if (lastSpace > 400) { // 최소 길이 확보
                description = description.substring(0, lastSpace);
            }
            description = description.trim() + "...";
        }
        
        return description;
    }
    
    /**
     * 보험사 정보 클래스
     */
    @lombok.Builder
    @lombok.Data
    public static class InsuranceCompanyInfo {
        private String companyName;
        private String petInsuranceUrl;
        private String fallbackProductName;
        private String[] productNameSelectors;
        private String[] descriptionSelectors;
        private String[] featureSelectors;
        private String[] logoSelectors;
    }
}