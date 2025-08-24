package com.my.backend.insurance.schedule;

import lombok.extern.slf4j.Slf4j;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URL;
import java.util.HashMap;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * 4단계: 로고 크롤링 개선
 * 메인 페이지(page.tsx)와 상세 페이지([id]/page.tsx) 모두에서 사용
 */
@Slf4j
@Component
public class LogoCrawler {

    // 보험사별 로고 선택자와 폴백 정보
    private static final Map<String, LogoInfo> COMPANY_LOGO_INFO = new HashMap<>();
    
    static {
        // 삼성화재
        COMPANY_LOGO_INFO.put("삼성화재", LogoInfo.builder()
            .companyName("삼성화재")
            .logoSelectors(new String[]{
                ".fp-header img", ".header-logo img", ".logo img", 
                ".company-logo img", "img[alt*='삼성화재']", 
                "img[src*='logo']", "img[src*='samsung']"
            })
            .fallbackLogoUrls(new String[]{
                "https://direct.samsungfire.com/resources/images/common/logo.png",
                "https://direct.samsungfire.com/m/resources/images/common/logo.png"
            })
            .companyEmoji("⭐")
            .domainPattern("samsungfire.com")
            .build());
            
        // NH농협손해보험
        COMPANY_LOGO_INFO.put("NH농협손해보험", LogoInfo.builder()
            .companyName("NH농협손해보험")
            .logoSelectors(new String[]{
                ".header-logo img", ".logo img", ".nh-logo img",
                "img[alt*='NH']", "img[alt*='농협']", 
                "img[src*='logo']", "img[src*='nh']"
            })
            .fallbackLogoUrls(new String[]{
                "https://nhfire.co.kr/resources/images/common/logo.png",
                "https://nhfire.co.kr/images/logo.png"
            })
            .companyEmoji("🌾")
            .domainPattern("nhfire.co.kr")
            .build());
            
        // KB손해보험
        COMPANY_LOGO_INFO.put("KB손해보험", LogoInfo.builder()
            .companyName("KB손해보험")
            .logoSelectors(new String[]{
                ".header .logo img", ".company-logo img", ".kb-logo img",
                "img[alt*='KB']", "img[alt*='손해보험']", 
                "img[src*='logo']", "img[src*='kb']"
            })
            .fallbackLogoUrls(new String[]{
                "https://www.kbinsure.co.kr/resources/images/common/logo.png",
                "https://www.kbinsure.co.kr/images/logo.png"
            })
            .companyEmoji("🏦")
            .domainPattern("kbinsure.co.kr")
            .build());
            
        // 현대해상
        COMPANY_LOGO_INFO.put("현대해상", LogoInfo.builder()
            .companyName("현대해상")
            .logoSelectors(new String[]{
                ".header-logo img", ".logo img", ".hyundai-logo img",
                "img[alt*='현대']", "img[alt*='해상']", 
                "img[src*='logo']", "img[src*='hyundai']"
            })
            .fallbackLogoUrls(new String[]{
                "https://www.hi.co.kr/resources/images/common/logo.png",
                "https://www.hi.co.kr/images/logo.png"
            })
            .companyEmoji("🚗")
            .domainPattern("hi.co.kr")
            .build());
            
        // 메리츠화재
        COMPANY_LOGO_INFO.put("메리츠화재", LogoInfo.builder()
            .companyName("메리츠화재")
            .logoSelectors(new String[]{
                ".header-logo img", ".logo img", ".meritz-logo img",
                "img[alt*='메리츠']", "img[alt*='화재']", 
                "img[src*='logo']", "img[src*='meritz']"
            })
            .fallbackLogoUrls(new String[]{
                "https://www.meritzfire.com/resources/images/common/logo.png",
                "https://www.meritzfire.com/images/logo.png"
            })
            .companyEmoji("🏢")
            .domainPattern("meritzfire.com")
            .build());
            
        // DB손해보험
        COMPANY_LOGO_INFO.put("DB손해보험", LogoInfo.builder()
            .companyName("DB손해보험")
            .logoSelectors(new String[]{
                ".header-logo img", ".logo img", ".db-logo img",
                "img[alt*='DB']", "img[alt*='손해보험']", 
                "img[src*='logo']", "img[src*='db']"
            })
            .fallbackLogoUrls(new String[]{
                "https://www.dbins.co.kr/resources/images/common/logo.png",
                "https://www.dbins.co.kr/images/logo.png"
            })
            .companyEmoji("💎")
            .domainPattern("dbins.co.kr")
            .build());
    }

    /**
     * 메인 페이지용 로고 크롤링 (page.tsx)
     * 빠른 응답을 위해 캐시된 정보와 폴백 URL 우선 사용
     */
    public String crawlLogoForMainPage(String companyName, String petInsuranceUrl) {
        log.info("=== 메인 페이지 로고 크롤링: {} ===", companyName);
        
        LogoInfo logoInfo = COMPANY_LOGO_INFO.get(companyName);
        if (logoInfo == null) {
            log.warn("지원하지 않는 보험사: {}", companyName);
            return generateFallbackLogoUrl(companyName);
        }
        
        // 1단계: 폴백 로고 URL 유효성 검사 (빠른 방법)
        String validFallbackUrl = validateFallbackLogos(logoInfo);
        if (validFallbackUrl != null) {
            log.info("[로고 선택] {} → 폴백 로고 사용: {}", companyName, validFallbackUrl);
            return validFallbackUrl;
        }
        
        // 2단계: 실제 페이지에서 로고 크롤링 (실시간)
        try {
            String crawledUrl = crawlLogoFromPage(petInsuranceUrl, logoInfo);
            if (crawledUrl != null) {
                log.info("[로고 선택] {} → 실시간 페이지 크롤링 성공: {}", companyName, crawledUrl);
                return crawledUrl;
            }
        } catch (Exception e) {
            log.warn("[로고 선택] {} → 페이지 크롤링 실패: {}", companyName, e.getMessage());
        }
        
        // 3단계: 생성된 기본 로고 URL
        String generatedUrl = generateFallbackLogoUrl(companyName);
        log.info("[로고 선택] {} → 기본 생성 로고 사용: {}", companyName, generatedUrl);
        return generatedUrl;
    }
    
    /**
     * 상세 페이지용 로고 크롤링 ([id]/page.tsx)
     * 더 정확한 로고를 위해 상세 크롤링 수행
     */
    public String crawlLogoForDetailPage(String companyName, String petInsuranceUrl) {
        log.info("=== 상세 페이지 로고 크롤링: {} ===", companyName);
        
        LogoInfo logoInfo = COMPANY_LOGO_INFO.get(companyName);
        if (logoInfo == null) {
            return generateFallbackLogoUrl(companyName);
        }
        
        // 1단계: 실제 페이지에서 상세 로고 크롤링 (실시간)
        try {
            String crawledUrl = crawlLogoFromPageDetailed(petInsuranceUrl, logoInfo);
            if (crawledUrl != null) {
                log.info("[로고 선택] {} → 상세 페이지 크롤링 성공: {}", companyName, crawledUrl);
                return crawledUrl;
            }
        } catch (Exception e) {
            log.warn("[로고 선택] {} → 상세 페이지 크롤링 실패: {}", companyName, e.getMessage());
        }
        
        // 2단계: 회사 메인 페이지에서 로고 검색
        try {
            String mainPageUrl = getCompanyMainPageUrl(logoInfo.getDomainPattern());
            String mainPageLogo = crawlLogoFromPage(mainPageUrl, logoInfo);
            if (mainPageLogo != null) {
                log.info("메인 페이지에서 로고 크롤링 성공: {}", mainPageLogo);
                return mainPageLogo;
            }
        } catch (Exception e) {
            log.warn("메인 페이지 로고 크롤링 실패: {}", e.getMessage());
        }
        
        // 3단계: 폴백 로고 URL 사용
        String validFallbackUrl = validateFallbackLogos(logoInfo);
        if (validFallbackUrl != null) {
            return validFallbackUrl;
        }
        
        // 4단계: 생성된 기본 로고
        return generateFallbackLogoUrl(companyName);
    }
    
    /**
     * 폴백 로고 URL들의 유효성 검사
     */
    private String validateFallbackLogos(LogoInfo logoInfo) {
        for (String fallbackUrl : logoInfo.getFallbackLogoUrls()) {
            try {
                // HEAD 요청으로 빠르게 확인
                URL url = new URL(fallbackUrl);
                var connection = url.openConnection();
                connection.setConnectTimeout(3000);
                connection.setReadTimeout(3000);
                connection.connect();
                
                String contentType = connection.getContentType();
                if (contentType != null && contentType.startsWith("image/")) {
                    return fallbackUrl;
                }
            } catch (Exception e) {
                log.debug("폴백 URL 검증 실패: {} - {}", fallbackUrl, e.getMessage());
            }
        }
        return null;
    }
    
    /**
     * 페이지에서 로고 크롤링 (기본)
     */
    private String crawlLogoFromPage(String pageUrl, LogoInfo logoInfo) throws IOException {
        Document doc = fetchWithRetry(pageUrl, 2); // 빠른 응답을 위해 재시도 2회로 제한
        
        // 선택자들을 우선순위대로 시도
        for (String selector : logoInfo.getLogoSelectors()) {
            try {
                Elements elements = doc.select(selector);
                for (Element element : elements) {
                    String logoUrl = extractLogoUrl(element, pageUrl);
                    if (isValidLogoUrl(logoUrl, logoInfo)) {
                        return logoUrl;
                    }
                }
            } catch (Exception e) {
                log.debug("로고 선택자 '{}' 실패: {}", selector, e.getMessage());
            }
        }
        
        return null;
    }
    
    /**
     * 페이지에서 로고 크롤링 (상세)
     */
    private String crawlLogoFromPageDetailed(String pageUrl, LogoInfo logoInfo) throws IOException {
        Document doc = fetchWithRetry(pageUrl, 3);
        
        // 1단계: 기본 선택자들 시도
        String basicLogo = tryBasicSelectors(doc, pageUrl, logoInfo);
        if (basicLogo != null) {
            return basicLogo;
        }
        
        // 2단계: 고급 검색 - 모든 이미지 검사
        String advancedLogo = tryAdvancedImageSearch(doc, pageUrl, logoInfo);
        if (advancedLogo != null) {
            return advancedLogo;
        }
        
        // 3단계: CSS 배경 이미지 검사
        String backgroundLogo = tryBackgroundImageSearch(doc, pageUrl, logoInfo);
        if (backgroundLogo != null) {
            return backgroundLogo;
        }
        
        return null;
    }
    
    /**
     * 기본 선택자들 시도
     */
    private String tryBasicSelectors(Document doc, String pageUrl, LogoInfo logoInfo) {
        for (String selector : logoInfo.getLogoSelectors()) {
            try {
                Elements elements = doc.select(selector);
                for (Element element : elements) {
                    String logoUrl = extractLogoUrl(element, pageUrl);
                    if (isValidLogoUrl(logoUrl, logoInfo)) {
                        return logoUrl;
                    }
                }
            } catch (Exception e) {
                log.debug("기본 선택자 '{}' 실패: {}", selector, e.getMessage());
            }
        }
        return null;
    }
    
    /**
     * 고급 이미지 검색
     */
    private String tryAdvancedImageSearch(Document doc, String pageUrl, LogoInfo logoInfo) {
        Elements allImages = doc.select("img");
        
        for (Element img : allImages) {
            String src = img.attr("src");
            String alt = img.attr("alt");
            String className = img.className();
            
            // 로고 관련 키워드 확인
            if (containsLogoKeywords(src, alt, className, logoInfo.getCompanyName())) {
                String logoUrl = extractLogoUrl(img, pageUrl);
                if (isValidLogoUrl(logoUrl, logoInfo)) {
                    return logoUrl;
                }
            }
        }
        
        return null;
    }
    
    /**
     * CSS 배경 이미지 검색
     */
    private String tryBackgroundImageSearch(Document doc, String pageUrl, LogoInfo logoInfo) {
        Elements elementsWithStyle = doc.select("[style*='background-image']");
        
        for (Element element : elementsWithStyle) {
            String style = element.attr("style");
            if (style.contains("background-image")) {
                String backgroundUrl = extractBackgroundImageUrl(style, pageUrl);
                if (isValidLogoUrl(backgroundUrl, logoInfo)) {
                    return backgroundUrl;
                }
            }
        }
        
        return null;
    }
    
    /**
     * 로고 관련 키워드 확인
     */
    private boolean containsLogoKeywords(String src, String alt, String className, String companyName) {
        String combined = (src + " " + alt + " " + className).toLowerCase();
        
        String[] logoKeywords = {"logo", "brand", "header", "company"};
        String[] companyKeywords = {
            companyName.toLowerCase(),
            companyName.substring(0, 2).toLowerCase()
        };
        
        // 로고 키워드 확인
        for (String keyword : logoKeywords) {
            if (combined.contains(keyword)) {
                return true;
            }
        }
        
        // 회사명 키워드 확인
        for (String keyword : companyKeywords) {
            if (combined.contains(keyword)) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * 이미지 요소에서 로고 URL 추출
     */
    private String extractLogoUrl(Element img, String baseUrl) {
        String src = img.attr("src");
        if (src == null || src.isBlank()) {
            src = img.attr("data-src"); // Lazy loading 이미지
        }
        
        if (src == null || src.isBlank()) {
            return null;
        }
        
        // 상대 URL을 절대 URL로 변환
        if (src.startsWith("//")) {
            src = "https:" + src;
        } else if (src.startsWith("/")) {
            try {
                URL base = new URL(baseUrl);
                src = base.getProtocol() + "://" + base.getHost() + src;
            } catch (Exception e) {
                return null;
            }
        } else if (!src.startsWith("http")) {
            try {
                URL base = new URL(baseUrl);
                src = base.getProtocol() + "://" + base.getHost() + "/" + src;
            } catch (Exception e) {
                return null;
            }
        }
        
        return src;
    }
    
    /**
     * CSS 배경 이미지 URL 추출
     */
    private String extractBackgroundImageUrl(String style, String baseUrl) {
        Pattern pattern = Pattern.compile("background-image:\\s*url\\(['\"]?([^'\"\\)]+)['\"]?\\)");
        java.util.regex.Matcher matcher = pattern.matcher(style);
        
        if (matcher.find()) {
            String url = matcher.group(1);
            
            // 상대 URL 처리
            if (url.startsWith("/")) {
                try {
                    URL base = new URL(baseUrl);
                    url = base.getProtocol() + "://" + base.getHost() + url;
                } catch (Exception e) {
                    return null;
                }
            }
            
            return url;
        }
        
        return null;
    }
    
    /**
     * 유효한 로고 URL인지 검사
     */
    private boolean isValidLogoUrl(String url, LogoInfo logoInfo) {
        if (url == null || url.isBlank()) {
            return false;
        }
        
        // 이미지 확장자 확인
        String lowerUrl = url.toLowerCase();
        if (!lowerUrl.matches(".*\\.(png|jpg|jpeg|gif|svg|webp)(\\?.*)?$")) {
            return false;
        }
        
        // 회사 도메인 확인 (선택사항)
        if (logoInfo.getDomainPattern() != null && 
            !url.contains(logoInfo.getDomainPattern())) {
            // 다른 도메인이지만 유효한 이미지라면 허용
            log.debug("다른 도메인의 로고 URL: {}", url);
        }
        
        // URL 길이 확인
        if (url.length() > 500) {
            return false;
        }
        
        return true;
    }
    
    /**
     * 회사 메인 페이지 URL 생성
     */
    private String getCompanyMainPageUrl(String domainPattern) {
        return "https://www." + domainPattern;
    }
    

    
    /**
     * 기본 로고 URL 생성 (최후의 수단)
     */
    private String generateFallbackLogoUrl(String companyName) {
        // 실제로는 S3에 저장된 기본 로고나 생성된 로고를 반환
        LogoInfo logoInfo = COMPANY_LOGO_INFO.get(companyName);
        if (logoInfo != null) {
            // 이모지를 기반으로 한 기본 로고 URL 생성
            return String.format("/api/logos/generated?company=%s&emoji=%s", 
                companyName, logoInfo.getCompanyEmoji());
        }
        
        return "/placeholder-logo.png";
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
                        .timeout(10000)
                        .followRedirects(true)
                        .ignoreContentType(false)
                        .get();
            } catch (IOException e) {
                lastException = e;
                if (i < maxRetry) {
                    try {
                        Thread.sleep(500 * (i + 1));
                    } catch (InterruptedException ignored) {
                        Thread.currentThread().interrupt();
                    }
                }
            }
        }
        
        throw lastException;
    }
    
    /**
     * 로고 정보 클래스
     */
    @lombok.Builder
    @lombok.Data
    public static class LogoInfo {
        private String companyName;
        private String[] logoSelectors;
        private String[] fallbackLogoUrls;
        private String companyEmoji;
        private String domainPattern;
    }
}