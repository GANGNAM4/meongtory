package com.my.backend.insurance.schedule;

import com.my.backend.insurance.dto.InsuranceProductDto;
import com.my.backend.insurance.service.InsuranceService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import com.microsoft.playwright.*;
import com.microsoft.playwright.options.LoadState;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Arrays;

@Slf4j
@Component
@RequiredArgsConstructor
public class InsuranceCrawlerJob {

    private final InsuranceService insuranceService;

    private List<InsuranceProductDto> crawlNhFire() {
        List<InsuranceProductDto> list = new ArrayList<>();
        try {
            InsuranceProductDto dto = crawlWithPlaywright(
                    "NH농협손해보험",
                    "다이렉트 펫앤미든든보험",
                    List.of("https://nhfire.co.kr/direct/", "https://nhfire.co.kr/"),
                    new String[]{"펫앤미", "펫", "반려동물", "강아지", "고양이"}
            );
            list.add(dto);
    
        } catch (Exception e) {
            log.error("NH농협손해보험 크롤링 실패: {}", e.getMessage());
        }
        return list;
    }

    private List<InsuranceProductDto> crawlSamsungFire() {
        List<InsuranceProductDto> list = new ArrayList<>();
        try {
            // 삼성화재는 실제 펫보험 페이지가 있음
            InsuranceProductDto dto = crawlSamsungFireDirect();
            list.add(dto);
    
        } catch (Exception e) {
            log.error("삼성화재 크롤링 실패: {}", e.getMessage());
        }
        return list;
    }

    private InsuranceProductDto crawlSamsungFireDirect() {
        try {
            Document doc = fetchWithRetry("https://direct.samsungfire.com/m/fp/pet.html", 3);
            
            String name = "삼성화재 다이렉트 펫보험";
            String desc = "삼성화재 다이렉트 펫보험 - 반려견, 반려묘를 위한 맞춤 보장";
            List<String> features = new ArrayList<>();
            
            // 펫보험 관련 특징 추출
            String pageText = doc.text();
            if (pageText.contains("펫보험")) {
                features.add("질병/상해 치료비 보장");
                features.add("응급진료비 보장");
                features.add("간편 온라인 가입");
            }
            
            return InsuranceProductDto.builder()
                    .company("삼성화재")
                    .productName(name)
                    .description(desc)
                    .features(features.isEmpty() ? getDefaultFeatures("삼성화재") : features)
                    .logoUrl("")
                    .redirectUrl("https://direct.samsungfire.com/m/fp/pet.html")
                    .build();
                    
        } catch (Exception e) {
            log.error("삼성화재 다이렉트 크롤링 실패: {}", e.getMessage());
            return InsuranceProductDto.builder()
                    .company("삼성화재")
                    .productName("삼성화재 다이렉트 펫보험")
                    .description("삼성화재 다이렉트 펫보험")
                    .features(getDefaultFeatures("삼성화재"))
                    .logoUrl("")
                    .redirectUrl("https://direct.samsungfire.com/m/fp/pet.html")
                    .build();
        }
    }

    private List<InsuranceProductDto> crawlHyundaiHi() {
        List<InsuranceProductDto> list = new ArrayList<>();
        try {
            InsuranceProductDto dto = crawlWithPlaywright(
                    "현대해상",
                    "현대해상 펫보험",
                    List.of("https://www.hi.co.kr/", "https://www.hi.co.kr/product/"),
                    new String[]{"펫보험", "펫", "반려동물", "강아지", "고양이"}
            );
            list.add(dto);
    
        } catch (Exception e) {
            log.error("현대해상 크롤링 실패: {}", e.getMessage());
        }
        return list;
    }

    private List<InsuranceProductDto> crawlDbInsurance() {
        List<InsuranceProductDto> list = new ArrayList<>();
        try {
            InsuranceProductDto dto = crawlWithPlaywright(
                    "DB손해보험",
                    "DB손해보험 펫보험",
                    List.of("https://www.dbins.co.kr/", "https://www.dbins.co.kr/product/"),
                    new String[]{"펫보험", "펫", "반려동물", "강아지", "고양이"}
            );
            list.add(dto);
    
        } catch (Exception e) {
            log.error("DB손해보험 크롤링 실패: {}", e.getMessage());
        }
        return list;
    }

    private List<InsuranceProductDto> crawlKbInsurance() {
        List<InsuranceProductDto> list = new ArrayList<>();
        try {
            InsuranceProductDto dto = crawlWithPlaywright(
                    "KB손해보험",
                    "KB 금쪽같은 펫보험",
                    List.of("https://www.kbinsure.co.kr/", "https://www.kbinsure.co.kr/main.ec"),
                    new String[]{"펫보험", "펫", "반려동물", "강아지", "고양이", "금쪽같은"}
            );
            list.add(dto);
    
        } catch (Exception e) {
            log.error("KB손해보험 크롤링 실패: {}", e.getMessage());
        }
        return list;
    }

    private List<InsuranceProductDto> crawlMeritz() {
        List<InsuranceProductDto> list = new ArrayList<>();
        try {
            InsuranceProductDto dto = crawlWithPlaywright(
                    "메리츠화재",
                    "메리츠 펫보험",
                    List.of("https://www.meritzfire.com/", "https://www.meritzfire.com/product/"),
                    new String[]{"펫보험", "펫", "반려동물", "강아지", "고양이"}
            );
            list.add(dto);
    
        } catch (Exception e) {
            log.error("메리츠화재 크롤링 실패: {}", e.getMessage());
        }
        return list;
    }

    private InsuranceProductDto crawlWithPlaywright(String company, String fallbackName, List<String> startUrls, String[] linkKeywords) {
        String finalUrl = startUrls.get(0);
        String name = fallbackName;
        String desc = fallbackName;
        List<String> features = new ArrayList<>();
        
        try (Playwright pw = Playwright.create()) {
            Browser browser = pw.chromium().launch(new BrowserType.LaunchOptions()
                    .setHeadless(true)
                    .setArgs(Arrays.asList("--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu")));
            
            BrowserContext ctx = browser.newContext(new Browser.NewContextOptions()
                    .setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"));
            
            Page page = ctx.newPage();

            // 페이지 로딩 대기 시간 증가
            page.setDefaultTimeout(30000);
            page.setDefaultNavigationTimeout(30000);

            outer:
            for (String url : startUrls) {
                try {
            
                    page.navigate(url, new Page.NavigateOptions().setTimeout(20000));
                    
                    // 페이지 로딩 대기
                    page.waitForLoadState(LoadState.NETWORKIDLE, new Page.WaitForLoadStateOptions().setTimeout(15000));
                    
                    // 키워드로 링크 찾기
                    for (String kw : linkKeywords) {
                        try {
                            Locator l = page.locator("a:has-text('" + kw + "')").first();
                            if (l != null && l.count() > 0) {
        
                                l.click(new Locator.ClickOptions().setTimeout(15000));
                                page.waitForLoadState(LoadState.NETWORKIDLE, new Page.WaitForLoadStateOptions().setTimeout(15000));
                                finalUrl = page.url();
        
                                break outer;
                            }
                        } catch (Exception e) {
                            log.debug("{} 키워드 '{}' 링크 클릭 실패: {}", company, kw, e.getMessage());
                        }
                    }
                } catch (Exception e) {
                    log.warn("{} URL '{}' 접속 실패: {}", company, url, e.getMessage());
                }
            }

            // 최종 페이지에서 정보 추출
            finalUrl = page.url() != null && !page.url().isBlank() ? page.url() : finalUrl;

            // 제목 추출 (h1, h2, title 순서)
            try {
                String h1 = page.locator("h1").first().innerText();
                if (h1 != null && !h1.isBlank() && h1.length() <= 100) {
                    name = h1.trim();

                }
            } catch (Exception e) {
                try {
                    String h2 = page.locator("h2").first().innerText();
                    if (h2 != null && !h2.isBlank() && h2.length() <= 100) {
                        name = h2.trim();

                    }
                } catch (Exception e2) {
                    String title = page.title();
                    if (title != null && !title.isBlank()) {
                        name = title.trim();

                    }
                }
            }

            // 설명 추출
            try {
                String og = page.locator("meta[property='og:description']").first().getAttribute("content");
                if (og != null && !og.isBlank()) {
                    desc = og.trim();
                    
                } else {
                    String meta = page.locator("meta[name='description']").first().getAttribute("content");
                    if (meta != null && !meta.isBlank()) {
                        desc = meta.trim();

                    }
                }
            } catch (Exception e) {
                log.debug("{} 설명 추출 실패: {}", company, e.getMessage());
            }

            // 특징 정보 추출 (더 구체적인 선택자 사용)
            features = extractFeatures(page, company);

            ctx.close();
            browser.close();
            
        } catch (Exception ex) {
            log.error("{} Playwright 크롤링 실패: {}", company, ex.getMessage(), ex);
        }

        // 폴백 데이터 설정
        if (features.isEmpty()) {
            features = getDefaultFeatures(company);
        }
        if (desc == null || desc.isBlank()) desc = fallbackName;
        if (name == null || name.isBlank()) name = fallbackName;

        return InsuranceProductDto.builder()
                .company(company)
                .productName(name)
                .description(desc)
                .features(features)
                .logoUrl("")
                .redirectUrl(finalUrl)
                .build();
    }

    private List<String> extractFeatures(Page page, String company) {
        List<String> features = new ArrayList<>();
        
        // 회사별 특화 선택자
        String[] selectors = getFeatureSelectors(company);
        
        for (String selector : selectors) {
            try {
                int count = page.locator(selector).count();
                for (int i = 0; i < count && features.size() < 5; i++) {
                    String text = page.locator(selector).nth(i).innerText();
                    if (text != null && !text.isBlank()) {
                        String trimmed = text.trim();
                        if (isValidFeature(trimmed)) {
                            features.add(trimmed);
                            log.debug("{} 특징 추출: {}", company, trimmed);
                        }
                    }
                }
                if (!features.isEmpty()) break;
            } catch (Exception e) {
                log.debug("{} 선택자 '{}' 실패: {}", company, selector, e.getMessage());
            }
        }
        
        return features;
    }

    private String[] getFeatureSelectors(String company) {
        switch (company) {
            case "삼성화재":
                return new String[]{
                    ".benefit-list li", ".coverage-item", ".feature-list li",
                    ".product-benefit li", ".insurance-feature li",
                    "ul li:has-text('보장')", "ul li:has-text('치료')"
                };
            case "메리츠화재":
                return new String[]{
                    ".product-feature li", ".coverage-detail li", ".insurance-benefit li",
                    ".benefit-list li", ".feature-item",
                    "ul li:has-text('보장')", "ul li:has-text('치료')"
                };
            case "KB손해보험":
                return new String[]{
                    ".product-info li", ".coverage-detail li", ".benefit-list li",
                    ".feature-list li", ".insurance-benefit li",
                    "ul li:has-text('보장')", "ul li:has-text('치료')"
                };
            case "현대해상":
                return new String[]{
                    ".product-detail li", ".coverage-info li", ".benefit-detail li",
                    ".feature-list li", ".insurance-benefit li",
                    "ul li:has-text('보장')", "ul li:has-text('치료')"
                };
            case "NH농협손해보험":
                return new String[]{
                    ".product-detail li", ".coverage-detail li", ".benefit-info li",
                    ".feature-list li", ".insurance-benefit li",
                    "ul li:has-text('보장')", "ul li:has-text('치료')"
                };
            case "DB손해보험":
                return new String[]{
                    ".product-feature li", ".coverage-detail li", ".benefit-list li",
                    ".feature-item", ".insurance-benefit li",
                    "ul li:has-text('보장')", "ul li:has-text('치료')"
                };
            default:
                return new String[]{
                    "ul li:has-text('보장')", "ul li:has-text('치료')", "ul li:has-text('질병')",
                    ".benefit-list li", ".feature-list li", ".coverage-item"
                };
        }
    }

    private boolean isValidFeature(String text) {
        if (text.length() < 5 || text.length() > 200) return false;
        if (text.matches(".*[0-9]{4,}.*")) return false; // 너무 긴 숫자 제외
        if (text.contains("원") && text.length() < 10) return false; // 단순 가격 정보 제외
        if (text.contains("%") && text.length() < 8) return false; // 단순 퍼센트 제외
        
        // 유용한 키워드 포함 여부
        String[] usefulKeywords = {"보장", "치료", "질병", "상해", "수술", "진료", "응급", "입원", "통원", "검사", "약품"};
        for (String keyword : usefulKeywords) {
            if (text.contains(keyword)) return true;
        }
        
        return false;
    }

    private List<String> getDefaultFeatures(String company) {
        switch (company) {
            case "삼성화재":
                return List.of("질병/상해 치료비 보장", "응급진료비 보장", "간편 온라인 가입");
            case "메리츠화재":
                return List.of("질병/상해 치료비 보장", "입원/통원 진료비 보장", "24시간 상담 서비스");
            case "KB손해보험":
                return List.of("질병/상해 치료비 보장", "수술비 보장", "금쪽같은 혜택");
            case "현대해상":
                return List.of("질병/상해 치료비 보장", "응급진료비 보장", "하이펫 특별 혜택");
            case "NH농협손해보험":
                return List.of("질병/상해 치료비 보장", "펫앤미든든 보장", "농협 특별 혜택");
            case "DB손해보험":
                return List.of("질병/상해 치료비 보장", "프로미라이프 보장", "DB 특별 혜택");
            default:
                return List.of("질병/상해 치료비 보장", "응급비용 보장", "간편 접수");
        }
    }

    private String extractDescription(Document doc) {
        if (doc == null) return null;
        String og = doc.selectFirst("meta[property=og:description]") != null
                ? doc.selectFirst("meta[property=og:description]").attr("content")
                : null;
        if (og != null && !og.isBlank()) return og;
        String meta = doc.selectFirst("meta[name=description]") != null
                ? doc.selectFirst("meta[name=description]").attr("content")
                : null;
        if (meta != null && !meta.isBlank()) return meta;
        String title = doc.title();
        return (title != null && !title.isBlank()) ? title : null;
    }

    private String findPetInsuranceUrl(Document doc, String baseUrl) {
        if (doc == null) return baseUrl;
        
        // 펫보험 관련 키워드
        String[] keywords = {
            "펫보험", "반려동물보험", "펫", "반려동물", "pet", "동물보험", "애견보험", "애완동물보험", "강아지", "고양이",
            "강아지보험", "고양이보험", "반려견보험", "반려묘보험", "동물병원", "수의사", "치료비", "상해보험", "질병보험",
            "펫앤미", "펫앤미든든", "다이렉트펫", "온라인펫", "실시간펫", "보험상품", "보험가입", "보험료"
        };
        
        // 모든 링크 검색
        Elements links = doc.select("a[href]");
        for (Element link : links) {
            String text = link.text() != null ? link.text().toLowerCase() : "";
            String href = link.attr("abs:href");
            
            // 키워드 매칭
            for (String keyword : keywords) {
                if (text.contains(keyword.toLowerCase())) {
                    
                    return href;
                }
            }
        }
        
        log.warn("펫보험 링크를 찾을 수 없어 기본 URL 사용: {}", baseUrl);
        return baseUrl;
    }

    private Document fetchWithRetry(String url, int maxRetry) throws IOException {
        IOException last = null;
        for (int i = 0; i <= maxRetry; i++) {
            try {
                return Jsoup.connect(url)
                        .userAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36")
                        .timeout(10000)
                        .get();
            } catch (IOException e) {
                last = e;
                try { Thread.sleep(500L * (i + 1)); } catch (InterruptedException ignored) {}
            }
        }
        throw last;
    }

    private Page openDynamicPage(String url) {
        Playwright playwright = Playwright.create();
        Browser browser = playwright.chromium().launch(
                new BrowserType.LaunchOptions()
                        .setHeadless(true)
                        .setArgs(Arrays.asList("--no-sandbox"))
        );
        BrowserContext context = browser.newContext();
        Page page = context.newPage();
        page.navigate(url, new Page.NavigateOptions().setTimeout(15000));
        return page;
    }

    public void runOnce() {

        List<InsuranceProductDto> items = new ArrayList<>();
        items.addAll(crawlNhFire());
        items.addAll(crawlSamsungFire());
        items.addAll(crawlHyundaiHi());
        items.addAll(crawlDbInsurance());
        items.addAll(crawlKbInsurance());
        items.addAll(crawlMeritz());

        insuranceService.upsertAll(items);

    }

    @Scheduled(cron = "0 0 2 * * *", zone = "Asia/Seoul")
    public void scheduledDaily() {
        runOnce();
    }

    /**
     * 특정 보험 상품의 상세 정보를 크롤링합니다.
     */
    public InsuranceProductDto crawlProductDetails(InsuranceProductDto product) {

        
        try {
            String url = product.getRedirectUrl();
            if (url == null || url.isBlank()) {
                log.warn("리다이렉트 URL이 없어 상세 정보 크롤링을 건너뜁니다: {}", product.getProductName());
                return product;
            }

            // 회사별 상세 정보 크롤링
            switch (product.getCompany()) {
                case "삼성화재":
                    return crawlSamsungFireDetails(product, url);
                case "메리츠화재":
                    return crawlMeritzDetails(product, url);
                case "KB손해보험":
                    return crawlKbInsuranceDetails(product, url);
                case "현대해상":
                    return crawlHyundaiHiDetails(product, url);
                case "NH농협손해보험":
                    return crawlNhFireDetails(product, url);
                default:
                    log.warn("지원하지 않는 보험사입니다: {}", product.getCompany());
                    return product;
            }
        } catch (Exception e) {
            log.error("상세 정보 크롤링 중 오류 발생: {}", e.getMessage(), e);
            return product;
        }
    }

    private InsuranceProductDto crawlSamsungFireDetails(InsuranceProductDto product, String url) {
        try {
            Document doc = fetchWithRetry(url, 3);
            
            // 상세 정보 추출
            List<String> detailedFeatures = new ArrayList<>();
            List<String> benefits = new ArrayList<>();
            List<String> requirements = new ArrayList<>();
            
            // 보장 내용 추출
            Elements coverageElements = doc.select(".coverage-item, .benefit-item, .feature-item");
            for (Element element : coverageElements) {
                String text = element.text().trim();
                if (!text.isBlank()) {
                    detailedFeatures.add(text);
                }
            }
            
            // 혜택 정보 추출
            Elements benefitElements = doc.select(".benefit, .advantage, .highlight");
            for (Element element : benefitElements) {
                String text = element.text().trim();
                if (!text.isBlank()) {
                    benefits.add(text);
                }
            }
            
            // 가입 조건 추출
            Elements requirementElements = doc.select(".requirement, .condition, .eligibility");
            for (Element element : requirementElements) {
                String text = element.text().trim();
                if (!text.isBlank()) {
                    requirements.add(text);
                }
            }
            
            // 기존 features와 새로운 detailedFeatures 합치기
            List<String> allFeatures = new ArrayList<>(product.getFeatures());
            allFeatures.addAll(detailedFeatures);
            
            return InsuranceProductDto.builder()
                    .id(product.getId())
                    .company(product.getCompany())
                    .productName(product.getProductName())
                    .description(product.getDescription())
                    .features(allFeatures)
                    .logoUrl(product.getLogoUrl())
                    .redirectUrl(product.getRedirectUrl())
                    .build();
                    
        } catch (Exception e) {
            log.error("삼성화재 상세 정보 크롤링 실패: {}", e.getMessage());
            return product;
        }
    }

    private InsuranceProductDto crawlMeritzDetails(InsuranceProductDto product, String url) {
        try {
            Document doc = fetchWithRetry(url, 3);
            
            List<String> detailedFeatures = new ArrayList<>();
            List<String> benefits = new ArrayList<>();
            List<String> requirements = new ArrayList<>();
            
            // 메리츠 화재 특화 크롤링
            Elements featureElements = doc.select(".product-feature, .coverage-detail, .insurance-benefit");
            for (Element element : featureElements) {
                String text = element.text().trim();
                if (!text.isBlank()) {
                    detailedFeatures.add(text);
                }
            }
            
            List<String> allFeatures = new ArrayList<>(product.getFeatures());
            allFeatures.addAll(detailedFeatures);
            
            return InsuranceProductDto.builder()
                    .id(product.getId())
                    .company(product.getCompany())
                    .productName(product.getProductName())
                    .description(product.getDescription())
                    .features(allFeatures)
                    .logoUrl(product.getLogoUrl())
                    .redirectUrl(product.getRedirectUrl())
                    .build();
                    
        } catch (Exception e) {
            log.error("메리츠 화재 상세 정보 크롤링 실패: {}", e.getMessage());
            return product;
        }
    }

    private InsuranceProductDto crawlKbInsuranceDetails(InsuranceProductDto product, String url) {
        try {
            Document doc = fetchWithRetry(url, 3);
            
            List<String> detailedFeatures = new ArrayList<>();
            List<String> benefits = new ArrayList<>();
            List<String> requirements = new ArrayList<>();
            
            // KB 손해보험 특화 크롤링
            Elements featureElements = doc.select(".product-info, .coverage-detail, .benefit-list");
            for (Element element : featureElements) {
                String text = element.text().trim();
                if (!text.isBlank()) {
                    detailedFeatures.add(text);
                }
            }
            
            List<String> allFeatures = new ArrayList<>(product.getFeatures());
            allFeatures.addAll(detailedFeatures);
            
            return InsuranceProductDto.builder()
                    .id(product.getId())
                    .company(product.getCompany())
                    .productName(product.getProductName())
                    .description(product.getDescription())
                    .features(allFeatures)
                    .logoUrl(product.getLogoUrl())
                    .redirectUrl(product.getRedirectUrl())
                    .build();
                    
        } catch (Exception e) {
            log.error("KB 손해보험 상세 정보 크롤링 실패: {}", e.getMessage());
            return product;
        }
    }

    private InsuranceProductDto crawlHyundaiHiDetails(InsuranceProductDto product, String url) {
        try {
            Document doc = fetchWithRetry(url, 3);
            
            List<String> detailedFeatures = new ArrayList<>();
            List<String> benefits = new ArrayList<>();
            List<String> requirements = new ArrayList<>();
            
            // 현대해상 특화 크롤링
            Elements featureElements = doc.select(".product-detail, .coverage-info, .benefit-detail");
            for (Element element : featureElements) {
                String text = element.text().trim();
                if (!text.isBlank()) {
                    detailedFeatures.add(text);
                }
            }
            
            List<String> allFeatures = new ArrayList<>(product.getFeatures());
            allFeatures.addAll(detailedFeatures);
            
            return InsuranceProductDto.builder()
                    .id(product.getId())
                    .company(product.getCompany())
                    .productName(product.getProductName())
                    .description(product.getDescription())
                    .features(allFeatures)
                    .logoUrl(product.getLogoUrl())
                    .redirectUrl(product.getRedirectUrl())
                    .build();
                    
        } catch (Exception e) {
            log.error("현대해상 상세 정보 크롤링 실패: {}", e.getMessage());
            return product;
        }
    }

    private InsuranceProductDto crawlNhFireDetails(InsuranceProductDto product, String url) {
        try {
            Document doc = fetchWithRetry(url, 3);
            
            List<String> detailedFeatures = new ArrayList<>();
            List<String> benefits = new ArrayList<>();
            List<String> requirements = new ArrayList<>();
            
            // NH농협손해보험 특화 크롤링
            Elements featureElements = doc.select(".product-detail, .coverage-detail, .benefit-info");
            for (Element element : featureElements) {
                String text = element.text().trim();
                if (!text.isBlank()) {
                    detailedFeatures.add(text);
                }
            }
            
            List<String> allFeatures = new ArrayList<>(product.getFeatures());
            allFeatures.addAll(detailedFeatures);
            
            return InsuranceProductDto.builder()
                    .id(product.getId())
                    .company(product.getCompany())
                    .productName(product.getProductName())
                    .description(product.getDescription())
                    .features(allFeatures)
                    .logoUrl(product.getLogoUrl())
                    .redirectUrl(product.getRedirectUrl())
                    .build();
                    
        } catch (Exception e) {
            log.error("NH농협손해보험 상세 정보 크롤링 실패: {}", e.getMessage());
            return product;
        }
    }

    /**
     * 웹페이지에서 로고 이미지를 추출합니다.
     */

}

