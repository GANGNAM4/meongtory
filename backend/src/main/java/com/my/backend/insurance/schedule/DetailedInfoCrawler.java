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
 * 3단계: 상세정보 크롤링 정확도 개선 ([id]/page.tsx 용)
 * 보험 상품의 상세한 보장 내용, 가입 조건, 혜택 등을 정확하게 추출
 */
@Slf4j
@Component
public class DetailedInfoCrawler {

    // 보험사별 상세 정보 선택자
    private static final Map<String, DetailedSelectors> COMPANY_DETAILED_SELECTORS = new HashMap<>();
    
    static {
        // 삼성화재 상세 정보 선택자
        COMPANY_DETAILED_SELECTORS.put("삼성화재", DetailedSelectors.builder()
            .benefitDetailSelectors(new String[]{
                ".benefit-detail", ".coverage-detail", ".product-detail-table"
            })
            .requirementSelectors(new String[]{
                ".requirement", ".condition", ".eligibility", ".join-condition"
            })
            .exclusionSelectors(new String[]{
                ".exclusion", ".exception", ".not-covered"
            })
            .premiumDetailSelectors(new String[]{
                ".premium-table", ".price-table", ".cost-detail"
            })
            .specialBenefitSelectors(new String[]{
                ".special-benefit", ".additional-service", ".extra-coverage"
            })
            .contactInfoSelectors(new String[]{
                ".contact-info", ".customer-service", ".support-info"
            })
            .build());
            
        // NH농협손해보험 상세 정보 선택자
        COMPANY_DETAILED_SELECTORS.put("NH농협손해보험", DetailedSelectors.builder()
            .benefitDetailSelectors(new String[]{
                ".product-benefit", ".coverage-benefit", ".insurance-benefit"
            })
            .requirementSelectors(new String[]{
                ".join-requirement", ".subscription-condition"
            })
            .exclusionSelectors(new String[]{
                ".exclusion-list", ".exception-case"
            })
            .premiumDetailSelectors(new String[]{
                ".premium-info", ".insurance-fee"
            })
            .specialBenefitSelectors(new String[]{
                ".nh-special", ".agricultural-benefit"
            })
            .contactInfoSelectors(new String[]{
                ".nh-contact", ".customer-center"
            })
            .build());
    }

    /**
     * 3단계: 상세정보 크롤링
     */
    public DetailedInsuranceInfo crawlDetailedInfo(String companyName, String petInsuranceUrl) {
        log.info("=== 3단계: {} 상세정보 크롤링 시작 ===", companyName);
        
        try {
            Document doc = fetchWithRetry(petInsuranceUrl, 3);
            
            // 상세 보장 내용 추출
            List<String> detailedBenefits = extractDetailedBenefits(doc, companyName);
            
            // 가입 조건 추출
            List<String> requirements = extractRequirements(doc, companyName);
            
            // 면책 사항 추출
            List<String> exclusions = extractExclusions(doc, companyName);
            
            // 보험료 상세 정보 추출
            PremiumInfo premiumInfo = extractPremiumDetails(doc, companyName);
            
            // 특별 혜택 추출
            List<String> specialBenefits = extractSpecialBenefits(doc, companyName);
            
            // 연락처 정보 추출
            ContactInfo contactInfo = extractContactInfo(doc, companyName);
            
            log.info("상세정보 크롤링 성공 - 상세보장: {}, 가입조건: {}, 특별혜택: {}", 
                detailedBenefits.size(), requirements.size(), specialBenefits.size());
            
            return DetailedInsuranceInfo.builder()
                    .companyName(companyName)
                    .detailedBenefits(detailedBenefits)
                    .requirements(requirements)
                    .exclusions(exclusions)
                    .premiumInfo(premiumInfo)
                    .specialBenefits(specialBenefits)
                    .contactInfo(contactInfo)
                    .crawledUrl(petInsuranceUrl)
                    .build();
                    
        } catch (Exception e) {
            log.error("{} 상세정보 크롤링 실패: {}", companyName, e.getMessage());
            return createFallbackDetailedInfo(companyName, petInsuranceUrl);
        }
    }
    
    /**
     * 상세 보장 내용 추출
     */
    private List<String> extractDetailedBenefits(Document doc, String companyName) {
        log.debug("상세 보장 내용 추출 시작: {}", companyName);
        
        List<String> benefits = new ArrayList<>();
        DetailedSelectors selectors = COMPANY_DETAILED_SELECTORS.get(companyName);
        
        if (selectors != null) {
            for (String selector : selectors.getBenefitDetailSelectors()) {
                try {
                    Elements elements = doc.select(selector);
                    for (Element element : elements) {
                        // 테이블 형태인 경우
                        if (element.tagName().equals("table") || element.hasClass("table")) {
                            benefits.addAll(extractBenefitsFromTable(element));
                        } else {
                            // 일반 텍스트 형태인 경우
                            benefits.addAll(extractBenefitsFromElement(element));
                        }
                        
                        if (benefits.size() >= 10) break; // 최대 10개
                    }
                    if (!benefits.isEmpty()) break; // 하나라도 찾으면 다른 선택자는 시도하지 않음
                } catch (Exception e) {
                    log.debug("상세보장 선택자 '{}' 실패: {}", selector, e.getMessage());
                }
            }
        }
        
        // 선택자로 찾지 못한 경우 텍스트 패턴 매칭
        if (benefits.isEmpty()) {
            benefits = extractBenefitsFromTextPatterns(doc.text(), companyName);
        }
        
        // 여전히 없으면 기본 상세 보장 사용
        if (benefits.isEmpty()) {
            benefits = getDefaultDetailedBenefits(companyName);
        }
        
        return benefits.stream().distinct().limit(8).toList();
    }
    
    /**
     * 테이블에서 보장 내용 추출
     */
    private List<String> extractBenefitsFromTable(Element table) {
        List<String> benefits = new ArrayList<>();
        
        Elements rows = table.select("tr");
        for (Element row : rows) {
            Elements cells = row.select("td, th");
            if (cells.size() >= 2) {
                String benefitName = cells.get(0).text().trim();
                String benefitDetail = cells.get(1).text().trim();
                
                if (isValidDetailedBenefit(benefitName + " - " + benefitDetail)) {
                    benefits.add(benefitName + " - " + benefitDetail);
                }
            }
        }
        
        return benefits;
    }
    
    /**
     * 요소에서 보장 내용 추출
     */
    private List<String> extractBenefitsFromElement(Element element) {
        List<String> benefits = new ArrayList<>();
        
        // 리스트 항목들 확인
        Elements listItems = element.select("li");
        if (!listItems.isEmpty()) {
            for (Element li : listItems) {
                String text = li.text().trim();
                if (isValidDetailedBenefit(text)) {
                    benefits.add(text);
                }
            }
        } else {
            // 일반 텍스트 확인
            String text = element.text().trim();
            if (isValidDetailedBenefit(text)) {
                benefits.add(text);
            }
        }
        
        return benefits;
    }
    
    /**
     * 텍스트 패턴으로 보장 내용 추출
     */
    private List<String> extractBenefitsFromTextPatterns(String text, String companyName) {
        List<String> benefits = new ArrayList<>();
        
        // 상세 보장 패턴들
        String[] patterns = {
            "[가-힣\\s]+질병[가-힣\\s]*치료[가-힣\\s]*보장[^.]*",
            "[가-힣\\s]+상해[가-힣\\s]*치료[가-힣\\s]*보장[^.]*",
            "[가-힣\\s]+수술[가-힣\\s]*보장[^.]*",
            "[가-힣\\s]+응급[가-힣\\s]*진료[가-힣\\s]*보장[^.]*",
            "[가-힣\\s]+입원[가-힣\\s]*보장[^.]*",
            "[가-힣\\s]+통원[가-힣\\s]*보장[^.]*"
        };
        
        for (String patternStr : patterns) {
            Pattern pattern = Pattern.compile(patternStr, Pattern.CASE_INSENSITIVE);
            Matcher matcher = pattern.matcher(text);
            while (matcher.find() && benefits.size() < 6) {
                String benefit = matcher.group().trim();
                if (benefit.length() <= 100) {
                    benefits.add(benefit);
                }
            }
        }
        
        return benefits;
    }
    
    /**
     * 가입 조건 추출
     */
    private List<String> extractRequirements(Document doc, String companyName) {
        List<String> requirements = new ArrayList<>();
        DetailedSelectors selectors = COMPANY_DETAILED_SELECTORS.get(companyName);
        
        if (selectors != null) {
            for (String selector : selectors.getRequirementSelectors()) {
                try {
                    Elements elements = doc.select(selector);
                    for (Element element : elements) {
                        Elements listItems = element.select("li");
                        if (!listItems.isEmpty()) {
                            for (Element li : listItems) {
                                String text = li.text().trim();
                                if (isValidRequirement(text)) {
                                    requirements.add(text);
                                }
                            }
                        } else {
                            String text = element.text().trim();
                            if (isValidRequirement(text)) {
                                requirements.add(text);
                            }
                        }
                        
                        if (requirements.size() >= 5) break;
                    }
                    if (!requirements.isEmpty()) break;
                } catch (Exception e) {
                    log.debug("가입조건 선택자 '{}' 실패: {}", selector, e.getMessage());
                }
            }
        }
        
        // 텍스트 패턴으로 추출
        if (requirements.isEmpty()) {
            requirements = extractRequirementsFromText(doc.text());
        }
        
        // 기본 가입 조건
        if (requirements.isEmpty()) {
            requirements = getDefaultRequirements(companyName);
        }
        
        return requirements.stream().distinct().limit(5).toList();
    }
    
    /**
     * 텍스트에서 가입 조건 추출
     */
    private List<String> extractRequirementsFromText(String text) {
        List<String> requirements = new ArrayList<>();
        
        String[] patterns = {
            "만\\s*[0-9]+세\\s*[이상부터~까지]*\\s*가입\\s*가능",
            "[가-힣\\s]*등록[가-힣\\s]*필요",
            "[가-힣\\s]*건강[가-힣\\s]*상태[가-힣\\s]*확인",
            "[가-힣\\s]*예방접종[가-힣\\s]*완료"
        };
        
        for (String patternStr : patterns) {
            Pattern pattern = Pattern.compile(patternStr, Pattern.CASE_INSENSITIVE);
            Matcher matcher = pattern.matcher(text);
            if (matcher.find()) {
                String requirement = matcher.group().trim();
                if (requirement.length() <= 80) {
                    requirements.add(requirement);
                }
            }
        }
        
        return requirements;
    }
    
    /**
     * 면책 사항 추출
     */
    private List<String> extractExclusions(Document doc, String companyName) {
        List<String> exclusions = new ArrayList<>();
        DetailedSelectors selectors = COMPANY_DETAILED_SELECTORS.get(companyName);
        
        if (selectors != null) {
            for (String selector : selectors.getExclusionSelectors()) {
                try {
                    Elements elements = doc.select(selector);
                    for (Element element : elements) {
                        Elements listItems = element.select("li");
                        if (!listItems.isEmpty()) {
                            for (Element li : listItems) {
                                String text = li.text().trim();
                                if (isValidExclusion(text)) {
                                    exclusions.add(text);
                                }
                            }
                        }
                        if (exclusions.size() >= 3) break;
                    }
                    if (!exclusions.isEmpty()) break;
                } catch (Exception e) {
                    log.debug("면책사항 선택자 '{}' 실패: {}", selector, e.getMessage());
                }
            }
        }
        
        return exclusions.stream().distinct().limit(3).toList();
    }
    
    /**
     * 보험료 상세 정보 추출
     */
    private PremiumInfo extractPremiumDetails(Document doc, String companyName) {
        PremiumInfo premiumInfo = PremiumInfo.builder().build();
        
        String pageText = doc.text();
        
        // 보험료 패턴 추출
        Pattern premiumPattern = Pattern.compile("월\\s*([0-9,]+)\\s*원");
        Matcher matcher = premiumPattern.matcher(pageText);
        if (matcher.find()) {
            premiumInfo.setMonthlyPremium("월 " + matcher.group(1) + "원");
        }
        
        // 할인 정보 추출
        Pattern discountPattern = Pattern.compile("([0-9]+)%\\s*할인");
        matcher = discountPattern.matcher(pageText);
        if (matcher.find()) {
            premiumInfo.setDiscount(matcher.group(1) + "% 할인");
        }
        
        return premiumInfo;
    }
    
    /**
     * 특별 혜택 추출
     */
    private List<String> extractSpecialBenefits(Document doc, String companyName) {
        List<String> specialBenefits = new ArrayList<>();
        DetailedSelectors selectors = COMPANY_DETAILED_SELECTORS.get(companyName);
        
        if (selectors != null) {
            for (String selector : selectors.getSpecialBenefitSelectors()) {
                try {
                    Elements elements = doc.select(selector);
                    for (Element element : elements) {
                        String text = element.text().trim();
                        if (isValidSpecialBenefit(text)) {
                            specialBenefits.add(text);
                        }
                        if (specialBenefits.size() >= 3) break;
                    }
                    if (!specialBenefits.isEmpty()) break;
                } catch (Exception e) {
                    log.debug("특별혜택 선택자 '{}' 실패: {}", selector, e.getMessage());
                }
            }
        }
        
        // 텍스트에서 특별 혜택 패턴 추출
        if (specialBenefits.isEmpty()) {
            specialBenefits = extractSpecialBenefitsFromText(doc.text(), companyName);
        }
        
        return specialBenefits.stream().distinct().limit(3).toList();
    }
    
    /**
     * 텍스트에서 특별 혜택 추출
     */
    private List<String> extractSpecialBenefitsFromText(String text, String companyName) {
        List<String> benefits = new ArrayList<>();
        
        String[] patterns = {
            "[0-9]+%\\s*할인[^.]*",
            "24시간\\s*[가-힣\\s]*서비스",
            "온라인\\s*[가-힣\\s]*가입[^.]*",
            "간편\\s*[가-힣\\s]*접수[^.]*"
        };
        
        for (String patternStr : patterns) {
            Pattern pattern = Pattern.compile(patternStr, Pattern.CASE_INSENSITIVE);
            Matcher matcher = pattern.matcher(text);
            if (matcher.find()) {
                String benefit = matcher.group().trim();
                if (benefit.length() <= 60) {
                    benefits.add(benefit);
                }
            }
        }
        
        return benefits;
    }
    
    /**
     * 연락처 정보 추출
     */
    private ContactInfo extractContactInfo(Document doc, String companyName) {
        ContactInfo.ContactInfoBuilder contactInfoBuilder = ContactInfo.builder();
        
        // 전화번호 패턴 추출
        Pattern phonePattern = Pattern.compile("(1[5-8][0-9]{2}-[0-9]{4}|0[2-9][0-9]{1,2}-[0-9]{3,4}-[0-9]{4})");
        Matcher matcher = phonePattern.matcher(doc.text());
        if (matcher.find()) {
            contactInfoBuilder.phoneNumber(matcher.group());
        } else {
            contactInfoBuilder.phoneNumber(getDefaultPhoneNumber(companyName));
        }
        
        // 운영시간 패턴 추출
        Pattern timePattern = Pattern.compile("(평일|월~금)\\s*[0-9]{2}:[0-9]{2}\\s*[-~]\\s*[0-9]{2}:[0-9]{2}");
        matcher = timePattern.matcher(doc.text());
        if (matcher.find()) {
            contactInfoBuilder.operatingHours(matcher.group());
        } else {
            contactInfoBuilder.operatingHours("평일 09:00 - 18:00");
        }
        
        return contactInfoBuilder.build();
    }
    
    // 검증 메서드들
    private boolean isValidDetailedBenefit(String text) {
        if (text == null || text.isBlank()) return false;
        if (text.length() < 8 || text.length() > 150) return false;
        
        String lowerText = text.toLowerCase();
        String[] keywords = {"보장", "치료", "질병", "상해", "수술", "진료", "응급", "입원", "통원"};
        
        for (String keyword : keywords) {
            if (lowerText.contains(keyword)) {
                return true;
            }
        }
        return false;
    }
    
    private boolean isValidRequirement(String text) {
        if (text == null || text.isBlank()) return false;
        if (text.length() < 5 || text.length() > 100) return false;
        
        String lowerText = text.toLowerCase();
        String[] keywords = {"가입", "조건", "필요", "확인", "등록", "나이", "세", "건강"};
        
        for (String keyword : keywords) {
            if (lowerText.contains(keyword)) {
                return true;
            }
        }
        return false;
    }
    
    private boolean isValidExclusion(String text) {
        if (text == null || text.isBlank()) return false;
        if (text.length() < 5 || text.length() > 100) return false;
        
        String lowerText = text.toLowerCase();
        String[] keywords = {"면책", "제외", "보장하지", "않음", "해당없음"};
        
        for (String keyword : keywords) {
            if (lowerText.contains(keyword)) {
                return true;
            }
        }
        return false;
    }
    
    private boolean isValidSpecialBenefit(String text) {
        if (text == null || text.isBlank()) return false;
        if (text.length() < 5 || text.length() > 80) return false;
        
        String lowerText = text.toLowerCase();
        String[] keywords = {"할인", "혜택", "서비스", "특별", "추가", "무료"};
        
        for (String keyword : keywords) {
            if (lowerText.contains(keyword)) {
                return true;
            }
        }
        return false;
    }
    
    // 기본값 제공 메서드들
    private List<String> getDefaultDetailedBenefits(String companyName) {
        switch (companyName) {
            case "삼성화재":
                return List.of(
                    "질병/상해로 인한 치료비 보장 (연간 한도 내)",
                    "응급진료비 보장 (24시간)",
                    "수술비 보장 (전신마취 수술)",
                    "입원비 보장 (1일 이상 입원 시)"
                );
            case "NH농협손해보험":
                return List.of(
                    "질병/상해 치료비 보장",
                    "통원/입원 진료비 보장",
                    "수술비 보장",
                    "검사비 보장"
                );
            default:
                return List.of(
                    "질병/상해 치료비 보장",
                    "응급진료비 보장",
                    "수술비 보장"
                );
        }
    }
    
    private List<String> getDefaultRequirements(String companyName) {
        return List.of(
            "만 3개월 이상 반려동물",
            "동물등록증 필요",
            "예방접종 완료",
            "건강한 상태에서 가입 가능"
        );
    }
    
    private String getDefaultPhoneNumber(String companyName) {
        switch (companyName) {
            case "삼성화재":
                return "1588-5114";
            case "NH농협손해보험":
                return "1644-9000";
            case "KB손해보험":
                return "1544-0400";
            default:
                return "1544-0000";
        }
    }
    
    /**
     * 폴백 상세 정보 생성
     */
    private DetailedInsuranceInfo createFallbackDetailedInfo(String companyName, String url) {
        return DetailedInsuranceInfo.builder()
                .companyName(companyName)
                .detailedBenefits(getDefaultDetailedBenefits(companyName))
                .requirements(getDefaultRequirements(companyName))
                .exclusions(List.of())
                .premiumInfo(PremiumInfo.builder().build())
                .specialBenefits(List.of())
                .contactInfo(ContactInfo.builder()
                    .phoneNumber(getDefaultPhoneNumber(companyName))
                    .operatingHours("평일 09:00 - 18:00")
                    .build())
                .crawledUrl(url)
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
    
    // 데이터 클래스들
    @lombok.Builder
    @lombok.Data
    public static class DetailedInsuranceInfo {
        private String companyName;
        private List<String> detailedBenefits;
        private List<String> requirements;
        private List<String> exclusions;
        private PremiumInfo premiumInfo;
        private List<String> specialBenefits;
        private ContactInfo contactInfo;
        private String crawledUrl;
    }
    
    @lombok.Builder
    @lombok.Data
    public static class DetailedSelectors {
        private String[] benefitDetailSelectors;
        private String[] requirementSelectors;
        private String[] exclusionSelectors;
        private String[] premiumDetailSelectors;
        private String[] specialBenefitSelectors;
        private String[] contactInfoSelectors;
    }
    
    @lombok.Builder
    @lombok.Data
    public static class PremiumInfo {
        @lombok.Builder.Default
        private String monthlyPremium = "상세 문의";
        @lombok.Builder.Default
        private String discount = "";
        @lombok.Builder.Default
        private String ageRange = "";
    }
    
    @lombok.Builder
    @lombok.Data
    public static class ContactInfo {
        private String phoneNumber;
        private String operatingHours;
        @lombok.Builder.Default
        private String email = "";
        @lombok.Builder.Default
        private String website = "";
    }
}