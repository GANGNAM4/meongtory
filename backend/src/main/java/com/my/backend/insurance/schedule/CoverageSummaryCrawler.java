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
import java.util.regex.Matcher;

/**
 * 2단계: 보장요약 크롤링 정확도 개선
 * 보험 상품의 주요 보장 내용을 정확하게 추출
 */
@Slf4j
@Component
public class CoverageSummaryCrawler {

    // 보장 관련 키워드 패턴
    private static final Map<String, Pattern> COVERAGE_PATTERNS = new HashMap<>();
    
    static {
        // 보장 금액 패턴
        COVERAGE_PATTERNS.put("MAX_AMOUNT", Pattern.compile("최대\\s*([0-9,]+)\\s*만원|한도\\s*([0-9,]+)\\s*만원|보장\\s*([0-9,]+)\\s*만원"));
        
        // 보장률 패턴
        COVERAGE_PATTERNS.put("COVERAGE_RATE", Pattern.compile("([0-9]+)%\\s*보장|보장률\\s*([0-9]+)%"));
        
        // 면책금 패턴
        COVERAGE_PATTERNS.put("DEDUCTIBLE", Pattern.compile("면책금\\s*([0-9,]+)\\s*원|본인부담금\\s*([0-9,]+)\\s*원"));
        
        // 보험료 패턴
        COVERAGE_PATTERNS.put("PREMIUM", Pattern.compile("월\\s*([0-9,]+)\\s*원|보험료\\s*([0-9,]+)\\s*원"));
    }

    // 보험사별 보장 정보 선택자
    private static final Map<String, CoverageSelectors> COMPANY_COVERAGE_SELECTORS = new HashMap<>();
    
    static {
        // 삼성화재
        COMPANY_COVERAGE_SELECTORS.put("삼성화재", CoverageSelectors.builder()
            .coverageTableSelectors(new String[]{
                ".benefit-table", ".coverage-table", ".product-table"
            })
            .coverageItemSelectors(new String[]{
                ".coverage-item", ".benefit-item", ".product-benefit"
            })
            .coverageAmountSelectors(new String[]{
                ".amount", ".limit", ".max-amount", "td:contains('한도')"
            })
            .coverageRateSelectors(new String[]{
                ".rate", ".percentage", "td:contains('%')"
            })
            .keyBenefitSelectors(new String[]{
                ".key-benefit", ".main-coverage", ".primary-benefit"
            })
            .build());
            
        // NH농협손해보험
        COMPANY_COVERAGE_SELECTORS.put("NH농협손해보험", CoverageSelectors.builder()
            .coverageTableSelectors(new String[]{
                ".product-table", ".benefit-table"
            })
            .coverageItemSelectors(new String[]{
                ".coverage-list li", ".benefit-list li"
            })
            .coverageAmountSelectors(new String[]{
                ".coverage-amount", ".benefit-amount"
            })
            .coverageRateSelectors(new String[]{
                ".coverage-rate", ".benefit-rate"
            })
            .keyBenefitSelectors(new String[]{
                ".main-benefit", ".key-coverage"
            })
            .build());
    }

    /**
     * 2단계: 보장요약 정보 크롤링
     */
    public InsuranceProductDto crawlCoverageSummary(String companyName, String petInsuranceUrl) {

        
        try {
            Document doc = fetchWithRetry(petInsuranceUrl, 3);
            
            // 보장 요약 정보 추출
            CoverageSummary coverageSummary = extractCoverageSummary(doc, companyName);
            
            // 주요 보장 항목 추출
            List<String> keyBenefits = extractKeyBenefits(doc, companyName);
            
            // 보장 특징 추출
            List<String> coverageFeatures = extractCoverageFeatures(doc, companyName);
            

            
            return InsuranceProductDto.builder()
                    .company(companyName)
                    .productName(getProductNameFromPreviousStep(companyName))
                    .description(buildCoverageDescription(coverageSummary, keyBenefits))
                    .features(combineFeatures(keyBenefits, coverageFeatures))
                    .logoUrl("")
                    .redirectUrl(petInsuranceUrl)
                    .build();
                    
        } catch (Exception e) {
            log.error("{} 보장요약 크롤링 실패: {}", companyName, e.getMessage());
            return createFallbackCoverageProduct(companyName, petInsuranceUrl);
        }
    }
    
    /**
     * 보장 요약 정보 추출
     */
    private CoverageSummary extractCoverageSummary(Document doc, String companyName) {
        log.debug("보장 요약 정보 추출 시작: {}", companyName);
        
        CoverageSummary summary = new CoverageSummary();
        String pageText = doc.text();
        
        // 최대 보장 금액 추출
        summary.setMaxAmount(extractMaxAmount(pageText, doc, companyName));
        
        // 보장률 추출
        summary.setCoverageRate(extractCoverageRate(pageText, doc, companyName));
        
        // 면책금 추출
        summary.setDeductible(extractDeductible(pageText, doc, companyName));
        
        // 보험료 추출
        summary.setPremium(extractPremium(pageText, doc, companyName));
        
        return summary;
    }
    
    /**
     * 최대 보장 금액 추출
     */
    private String extractMaxAmount(String pageText, Document doc, String companyName) {
        // 패턴 매칭으로 추출
        Matcher matcher = COVERAGE_PATTERNS.get("MAX_AMOUNT").matcher(pageText);
        if (matcher.find()) {
            for (int i = 1; i <= matcher.groupCount(); i++) {
                String amount = matcher.group(i);
                if (amount != null && !amount.isEmpty()) {
                    return amount + "만원";
                }
            }
        }
        
        // 선택자로 추출
        CoverageSelectors selectors = COMPANY_COVERAGE_SELECTORS.get(companyName);
        if (selectors != null) {
            for (String selector : selectors.getCoverageAmountSelectors()) {
                try {
                    Elements elements = doc.select(selector);
                    for (Element element : elements) {
                        String text = element.text();
                        if (text.contains("만원") || text.contains("원")) {
                            return cleanAmountText(text);
                        }
                    }
                } catch (Exception e) {
                    log.debug("보장금액 선택자 '{}' 실패: {}", selector, e.getMessage());
                }
            }
        }
        
        return "상세 문의"; // 기본값
    }
    
    /**
     * 보장률 추출
     */
    private String extractCoverageRate(String pageText, Document doc, String companyName) {
        // 패턴 매칭으로 추출
        Matcher matcher = COVERAGE_PATTERNS.get("COVERAGE_RATE").matcher(pageText);
        if (matcher.find()) {
            for (int i = 1; i <= matcher.groupCount(); i++) {
                String rate = matcher.group(i);
                if (rate != null && !rate.isEmpty()) {
                    return rate + "%";
                }
            }
        }
        
        // 선택자로 추출
        CoverageSelectors selectors = COMPANY_COVERAGE_SELECTORS.get(companyName);
        if (selectors != null) {
            for (String selector : selectors.getCoverageRateSelectors()) {
                try {
                    Elements elements = doc.select(selector);
                    for (Element element : elements) {
                        String text = element.text();
                        if (text.contains("%")) {
                            return cleanRateText(text);
                        }
                    }
                } catch (Exception e) {
                    log.debug("보장률 선택자 '{}' 실패: {}", selector, e.getMessage());
                }
            }
        }
        
        return "80%"; // 기본값
    }
    
    /**
     * 면책금 추출
     */
    private String extractDeductible(String pageText, Document doc, String companyName) {
        Matcher matcher = COVERAGE_PATTERNS.get("DEDUCTIBLE").matcher(pageText);
        if (matcher.find()) {
            for (int i = 1; i <= matcher.groupCount(); i++) {
                String deductible = matcher.group(i);
                if (deductible != null && !deductible.isEmpty()) {
                    return deductible + "원";
                }
            }
        }
        
        return "없음"; // 기본값
    }
    
    /**
     * 보험료 추출
     */
    private String extractPremium(String pageText, Document doc, String companyName) {
        Matcher matcher = COVERAGE_PATTERNS.get("PREMIUM").matcher(pageText);
        if (matcher.find()) {
            for (int i = 1; i <= matcher.groupCount(); i++) {
                String premium = matcher.group(i);
                if (premium != null && !premium.isEmpty()) {
                    return "월 " + premium + "원";
                }
            }
        }
        
        return "상세 문의"; // 기본값
    }
    
    /**
     * 주요 보장 항목 추출 (상세 보장내역 포함)
     */
    private List<String> extractKeyBenefits(Document doc, String companyName) {
        List<String> benefits = new ArrayList<>();
        
        // 1. 상세 보장내역 테이블에서 추출 (우선순위 높음)
        benefits.addAll(extractDetailedCoverage(doc, companyName));
        
        // 2. 보험사별 선택자로 추출
        CoverageSelectors selectors = COMPANY_COVERAGE_SELECTORS.get(companyName);
        if (selectors != null) {
            for (String selector : selectors.getKeyBenefitSelectors()) {
                try {
                    Elements elements = doc.select(selector);
                    for (Element element : elements) {
                        String text = element.text().trim();
                        if (isValidBenefit(text)) {
                            benefits.add(text);
                        }
                    }
                } catch (Exception e) {
                    log.debug("주요보장 선택자 '{}' 실패: {}", selector, e.getMessage());
                }
            }
        }
        
        // 3. 텍스트에서 보장 항목 추출
        if (benefits.isEmpty()) {
            benefits = extractBenefitsFromText(doc.text(), companyName);
        }
        
        
        return benefits.stream().distinct().limit(8).toList(); // 더 많은 보장내역 표시
    }
    
    /**
     * 상세 보장내역 추출 (대폭 강화)
     */
    private List<String> extractDetailedCoverage(Document doc, String companyName) {
        List<String> detailedCoverage = new ArrayList<>();
        

        
        // 1. 회사별 특화 보장내역 테이블 추출
        detailedCoverage.addAll(extractCompanySpecificCoverage(doc, companyName));
        
        // 2. 일반 보장내역 테이블 추출 (더 정밀)
        detailedCoverage.addAll(extractPreciseCoverageTable(doc, companyName));
        
        // 3. 구조화된 보장내역 리스트 추출
        detailedCoverage.addAll(extractStructuredCoverageList(doc, companyName));
        
        // 4. 딥 스캔 - 모든 텍스트에서 보장항목 패턴 추출
        detailedCoverage.addAll(extractCoverageFromDeepScan(doc, companyName));
        

        
        return detailedCoverage.stream()
            .distinct()
            .filter(item -> item.length() > 5 && item.length() < 120)
            .limit(15) // 더 많은 보장내역 수집
            .toList();
    }
    
    /**
     * 회사별 특화 보장내역 추출
     */
    private List<String> extractCompanySpecificCoverage(Document doc, String companyName) {
        List<String> coverage = new ArrayList<>();
        
        switch (companyName) {
            case "삼성화재":
                // 삼성화재 특화 선택자
                coverage.addAll(extractFromSelectors(doc, new String[]{
                    ".fp-content table", ".benefit-wrap table", ".product-info table",
                    ".coverage-wrap .item", ".benefit-list .item"
                }));
                break;
                
            case "KB손해보험":
                // KB 특화 선택자
                coverage.addAll(extractFromSelectors(doc, new String[]{
                    ".product-detail table", ".benefit-table", ".coverage-table",
                    ".benefit-info .item", ".product-benefit .list"
                }));
                break;
                
            case "NH농협손해보험":
                // NH농협 특화 선택자
                coverage.addAll(extractFromSelectors(doc, new String[]{
                    ".product-table", ".benefit-wrap table", ".coverage-info table",
                    ".benefit-list li", ".product-info .item"
                }));
                break;
                
            case "현대해상":
                // 현대해상 특화 선택자
                coverage.addAll(extractFromSelectors(doc, new String[]{
                    ".benefit-table", ".product-table", ".coverage-wrap table",
                    ".benefit-info .list", ".product-detail .item"
                }));
                break;
                
            case "메리츠화재":
                // 메리츠 특화 선택자
                coverage.addAll(extractFromSelectors(doc, new String[]{
                    ".product-benefit table", ".coverage-table", ".benefit-wrap table",
                    ".benefit-list .item", ".product-info .list"
                }));
                break;
                
            case "DB손해보험":
                // DB 특화 선택자
                coverage.addAll(extractFromSelectors(doc, new String[]{
                    ".benefit-table", ".product-table", ".coverage-info table",
                    ".benefit-wrap .item", ".product-detail .list"
                }));
                break;
        }
        
        return coverage;
    }
    
    /**
     * 정밀 보장내역 테이블 추출
     */
    private List<String> extractPreciseCoverageTable(Document doc, String companyName) {
        List<String> coverage = new ArrayList<>();
        
        // 더 정밀한 테이블 선택자
        String[] preciseTableSelectors = {
            "table:contains('보장')", "table:contains('혜택')", "table:contains('한도')",
            "table:contains('금액')", "table:contains('치료비')", "table:contains('수술비')",
            ".benefit-table", ".coverage-table", ".product-table", ".insurance-table",
            ".detail-table", ".plan-table", ".guarantee-table"
        };
        
        for (String selector : preciseTableSelectors) {
            try {
                Elements tables = doc.select(selector);
                for (Element table : tables) {
                    Elements rows = table.select("tr");
                    for (Element row : rows) {
                        Elements cells = row.select("td, th");
                        
                        // 다양한 테이블 구조 지원
                        if (cells.size() >= 2) {
                            String item = cells.get(0).text().trim();
                            String value = cells.get(1).text().trim();
                            
                            if (isCoverageItem(item) && !value.isEmpty()) {
                                coverage.add(item + ": " + value);
                            }
                        }
                        
                        // 3컬럼 테이블 (항목, 내용, 한도)
                        if (cells.size() >= 3) {
                            String item = cells.get(0).text().trim();
                            String content = cells.get(1).text().trim();
                            String limit = cells.get(2).text().trim();
                            
                            if (isCoverageItem(item)) {
                                if (!content.isEmpty() && !limit.isEmpty()) {
                                    coverage.add(item + ": " + content + " (한도: " + limit + ")");
                                } else if (!content.isEmpty()) {
                                    coverage.add(item + ": " + content);
                                }
                            }
                        }
                    }
                }
            } catch (Exception e) {
                log.debug("정밀 테이블 추출 실패: {} - {}", selector, e.getMessage());
            }
        }
        
        return coverage;
    }
    
    /**
     * 구조화된 보장내역 리스트 추출
     */
    private List<String> extractStructuredCoverageList(Document doc, String companyName) {
        List<String> coverage = new ArrayList<>();
        
        // 구조화된 리스트 선택자
        String[] structuredSelectors = {
            ".benefit-list li", ".coverage-list li", ".guarantee-list li",
            ".product-benefit li", ".insurance-benefit li", ".plan-benefit li",
            ".coverage-item", ".benefit-item", ".guarantee-item",
            ".product-info .item", ".benefit-wrap .item", ".coverage-wrap .item"
        };
        
        for (String selector : structuredSelectors) {
            try {
                Elements items = doc.select(selector);
                for (Element item : items) {
                    String text = item.text().trim();
                    
                    // 보장내역 패턴 매칭
                    if (isCoverageText(text)) {
                        // 금액/한도 정보가 포함된 경우
                        if (text.matches(".*\\d+.*원.*") || text.matches(".*\\d+.*만원.*") || 
                            text.matches(".*\\d+.*%.*") || text.matches(".*한도.*")) {
                            coverage.add(text);
                        }
                        // 일반 보장내역
                        else if (text.length() > 8 && text.length() < 100) {
                            coverage.add(text);
                        }
                    }
                }
            } catch (Exception e) {
                log.debug("구조화된 리스트 추출 실패: {} - {}", selector, e.getMessage());
            }
        }
        
        return coverage;
    }
    
    /**
     * 딥 스캔 - 텍스트에서 보장항목 패턴 추출
     */
    private List<String> extractCoverageFromDeepScan(Document doc, String companyName) {
        List<String> coverage = new ArrayList<>();
        String fullText = doc.text();
        
        // 보장내역 패턴들
        String[] coveragePatterns = {
            // 치료비 관련
            "질병\\s*치료비\\s*[:]?\\s*[^\\s]+",
            "상해\\s*치료비\\s*[:]?\\s*[^\\s]+",
            "수술비\\s*[:]?\\s*[^\\s]+",
            "입원비\\s*[:]?\\s*[^\\s]+",
            "통원\\s*치료비\\s*[:]?\\s*[^\\s]+",
            
            // 한도 관련
            "최대\\s*보장\\s*한도\\s*[:]?\\s*[^\\s]+",
            "연간\\s*한도\\s*[:]?\\s*[^\\s]+",
            "회당\\s*한도\\s*[:]?\\s*[^\\s]+",
            
            // 보장률 관련
            "보장률\\s*[:]?\\s*\\d+%",
            "\\d+%\\s*보장",
            
            // 특수 보장
            "응급\\s*진료\\s*[:]?\\s*[^\\s]+",
            "예방\\s*접종\\s*[:]?\\s*[^\\s]+",
            "건강\\s*검진\\s*[:]?\\s*[^\\s]+",
            "중성화\\s*수술\\s*[:]?\\s*[^\\s]+",
            "치과\\s*치료\\s*[:]?\\s*[^\\s]+"
        };
        
        for (String pattern : coveragePatterns) {
            try {
                Pattern p = Pattern.compile(pattern, Pattern.CASE_INSENSITIVE);
                Matcher m = p.matcher(fullText);
                while (m.find() && coverage.size() < 20) {
                    String match = m.group().trim();
                    if (match.length() > 5 && match.length() < 80) {
                        coverage.add(match);
                    }
                }
            } catch (Exception e) {
                log.debug("패턴 매칭 실패: {} - {}", pattern, e.getMessage());
            }
        }
        
        return coverage;
    }
    
    /**
     * 선택자들에서 텍스트 추출
     */
    private List<String> extractFromSelectors(Document doc, String[] selectors) {
        List<String> items = new ArrayList<>();
        
        for (String selector : selectors) {
            try {
                Elements elements = doc.select(selector);
                for (Element element : elements) {
                    String text = element.text().trim();
                    if (isCoverageText(text) && text.length() > 8 && text.length() < 500) {
                        items.add(text);
                    }
                }
            } catch (Exception e) {
                log.debug("선택자 추출 실패: {} - {}", selector, e.getMessage());
            }
        }
        
        return items;
    }
    
    /**
     * 보장항목인지 확인
     */
    private boolean isCoverageItem(String text) {
        if (text == null || text.length() < 3) return false;
        
        String lower = text.toLowerCase();
        return lower.contains("치료") || lower.contains("보장") || lower.contains("수술") ||
               lower.contains("진료") || lower.contains("입원") || lower.contains("통원") ||
               lower.contains("응급") || lower.contains("검진") || lower.contains("예방") ||
               lower.contains("질병") || lower.contains("상해");
    }
    
    /**
     * 보장내역 텍스트인지 확인
     */
    private boolean isCoverageText(String text) {
        if (text == null || text.length() < 5 || text.length() > 500) return false;
        
        String lower = text.toLowerCase();
        return (lower.contains("보장") || lower.contains("치료") || lower.contains("혜택") ||
                lower.contains("한도") || lower.contains("금액") || lower.contains("수술") ||
                lower.contains("진료") || lower.contains("입원") || lower.contains("통원") ||
                lower.contains("응급") || lower.contains("질병") || lower.contains("상해")) &&
               !lower.contains("상담") && !lower.contains("문의") && !lower.contains("신청");
    }
    
    /**
     * 텍스트에서 보장 항목 추출
     */
    private List<String> extractBenefitsFromText(String text, String companyName) {
        List<String> benefits = new ArrayList<>();
        
        String[] benefitKeywords = {
            "질병.*치료.*보장", "상해.*치료.*보장", "수술.*보장", 
            "응급.*진료.*보장", "입원.*보장", "통원.*보장",
            "검사.*보장", "약품.*보장", "진단.*보장"
        };
        
        for (String keyword : benefitKeywords) {
            Pattern pattern = Pattern.compile(keyword, Pattern.CASE_INSENSITIVE);
            Matcher matcher = pattern.matcher(text);
            if (matcher.find()) {
                String benefit = matcher.group();
                if (benefit.length() <= 200) {
                    benefits.add(benefit);
                    if (benefits.size() >= 3) break;
                }
            }
        }
        
        return benefits;
    }
    
    /**
     * 보장 특징 추출
     */
    private List<String> extractCoverageFeatures(Document doc, String companyName) {
        List<String> features = new ArrayList<>();
        
        // 특징 관련 선택자들
        String[] featureSelectors = {
            ".feature-list li", ".benefit-list li", ".coverage-point",
            ".highlight", ".advantage", ".special-benefit"
        };
        
        for (String selector : featureSelectors) {
            try {
                Elements elements = doc.select(selector);
                for (Element element : elements) {
                    String text = element.text().trim();
                    if (isValidCoverageFeature(text)) {
                        features.add(text);
                        if (features.size() >= 3) break;
                    }
                }
                if (!features.isEmpty()) break;
            } catch (Exception e) {
                log.debug("특징 선택자 '{}' 실패: {}", selector, e.getMessage());
            }
        }
        
        return features;
    }
    
    /**
     * 유효한 보장 항목인지 검증
     */
    private boolean isValidBenefit(String text) {
        if (text == null || text.isBlank()) return false;
        if (text.length() < 5 || text.length() > 100) return false;
        
        String lowerText = text.toLowerCase();
        String[] keywords = {"보장", "치료", "질병", "상해", "수술", "진료", "응급"};
        
        for (String keyword : keywords) {
            if (lowerText.contains(keyword)) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * 유효한 보장 특징인지 검증
     */
    private boolean isValidCoverageFeature(String text) {
        if (text == null || text.isBlank()) return false;
        if (text.length() < 8 || text.length() > 200) return false;
        
        // 보장과 관련된 특징인지 확인
        String lowerText = text.toLowerCase();
        String[] keywords = {"할인", "혜택", "서비스", "가입", "보장", "특별", "추가"};
        
        for (String keyword : keywords) {
            if (lowerText.contains(keyword)) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * 보장 설명 생성
     */
    private String buildCoverageDescription(CoverageSummary summary, List<String> keyBenefits) {
        StringBuilder desc = new StringBuilder();
        
        if (!summary.getMaxAmount().equals("상세 문의")) {
            desc.append("최대 ").append(summary.getMaxAmount()).append(" 보장");
        }
        
        if (!summary.getCoverageRate().equals("80%")) {
            if (desc.length() > 0) desc.append(", ");
            desc.append("보장률 ").append(summary.getCoverageRate());
        }
        
        if (!keyBenefits.isEmpty()) {
            if (desc.length() > 0) desc.append(" - ");
            desc.append(String.join(", ", keyBenefits.subList(0, Math.min(2, keyBenefits.size()))));
        }
        
        return desc.toString();
    }
    
    /**
     * 특징들 조합
     */
    private List<String> combineFeatures(List<String> keyBenefits, List<String> coverageFeatures) {
        List<String> combined = new ArrayList<>();
        combined.addAll(keyBenefits);
        combined.addAll(coverageFeatures);
        
        // 중복 제거하고 최대 5개까지
        return combined.stream()
                .distinct()
                .limit(5)
                .toList();
    }
    
    /**
     * 기본 보장 항목
     */
    private List<String> getDefaultBenefits(String companyName) {
        switch (companyName) {
            case "삼성화재":
                return List.of("질병/상해 치료비 보장", "응급진료비 보장", "수술비 보장");
            case "NH농협손해보험":
                return List.of("질병/상해 치료비 보장", "통원/입원 진료비 보장", "수술비 보장");
            case "KB손해보험":
                return List.of("질병/상해 치료비 보장", "수술비 보장", "응급진료비 보장");
            default:
                return List.of("질병/상해 치료비 보장", "응급비용 보장", "수술비 보장");
        }
    }
    
    /**
     * 금액 텍스트 정리
     */
    private String cleanAmountText(String text) {
        return text.replaceAll("[^0-9,만원]", "").trim();
    }
    
    /**
     * 보장률 텍스트 정리
     */
    private String cleanRateText(String text) {
        return text.replaceAll("[^0-9%]", "").trim();
    }
    
    /**
     * 이전 단계에서 추출한 상품명 가져오기 (임시)
     */
    private String getProductNameFromPreviousStep(String companyName) {
        // 실제로는 이전 단계 결과를 사용해야 함
        switch (companyName) {
            case "삼성화재":
                return "삼성화재 다이렉트 펫보험";
            case "NH농협손해보험":
                return "NH농협 펫앤미든든보험";
            case "KB손해보험":
                return "KB 금쪽같은 펫보험";
            default:
                return companyName + " 펫보험";
        }
    }
    
    /**
     * 폴백 보장 상품 생성 (최소한의 정보만)
     */
    private InsuranceProductDto createFallbackCoverageProduct(String companyName, String url) {
        return InsuranceProductDto.builder()
                .company(companyName)
                .productName(getProductNameFromPreviousStep(companyName))
                .description("")
                .features(new ArrayList<>()) // 빈 특징 리스트
                .logoUrl("")
                .redirectUrl(url)
                .build();
    }
    
    /**
     * 재시도와 함께 문서 가져오기
     */
    private Document fetchWithRetry(String url, int maxRetry) throws IOException {
        IOException lastException = null;
        
        for (int i = 0; i <= maxRetry; i++) {
            try {
                return Jsoup.connect(url)
                        .userAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
                        .timeout(15000)
                        .followRedirects(true)
                        .get();
            } catch (IOException e) {
                lastException = e;
                if (i < maxRetry) {
                    try {
                        Thread.sleep(1000 * (i + 1));
                    } catch (InterruptedException ignored) {
                        Thread.currentThread().interrupt();
                    }
                }
            }
        }
        
        throw lastException;
    }
    
    /**
     * 보장 요약 정보 클래스
     */
    @lombok.Data
    public static class CoverageSummary {
        private String maxAmount = "상세 문의";
        private String coverageRate = "80%";
        private String deductible = "없음";
        private String premium = "상세 문의";
    }
    
    /**
     * 보장 선택자 클래스
     */
    @lombok.Builder
    @lombok.Data
    public static class CoverageSelectors {
        private String[] coverageTableSelectors;
        private String[] coverageItemSelectors;
        private String[] coverageAmountSelectors;
        private String[] coverageRateSelectors;
        private String[] keyBenefitSelectors;
    }
}