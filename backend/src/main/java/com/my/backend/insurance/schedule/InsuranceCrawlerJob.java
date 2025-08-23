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
        InsuranceProductDto dto = crawlWithPlaywright(
                "NH농협손해보험",
                "다이렉트 펫앤미든든보험",
                List.of("https://nhfire.co.kr/", "https://nhfire.co.kr/direct/", "https://nhfire.co.kr/product/"),
                new String[]{"펫", "반려동물", "강아지", "고양이", "펫앤미"}
        );
        list.add(dto);
        return list;
    }

    private List<InsuranceProductDto> crawlSamsungFire() {
        List<InsuranceProductDto> list = new ArrayList<>();
        InsuranceProductDto dto = crawlWithPlaywright(
                "삼성화재",
                "삼성화재 다이렉트 펫보험",
                List.of("https://direct.samsungfire.com/m/fp/pet.html", "https://direct.samsungfire.com/m/?mode=normalMode"),
                new String[]{"펫", "반려동물", "pet"}
        );
        list.add(dto);
        return list;
    }

    private List<InsuranceProductDto> crawlHyundaiHi() {
        List<InsuranceProductDto> list = new ArrayList<>();
        InsuranceProductDto dto = crawlWithPlaywright(
                "현대해상",
                "현대해상 펫보험",
                List.of("https://www.hi.co.kr/", "https://www.hi.co.kr/product/"),
                new String[]{"펫보험", "펫", "반려동물", "강아지", "고양이"}
        );
        list.add(dto);
        return list;
    }

    private List<InsuranceProductDto> crawlDbInsurance() {
        List<InsuranceProductDto> list = new ArrayList<>();
        InsuranceProductDto dto = crawlWithPlaywright(
                "DB손해보험",
                "DB손해보험 펫보험",
                List.of("https://www.dbins.co.kr/", "https://www.dbins.co.kr/product/"),
                new String[]{"펫보험", "펫", "반려동물", "강아지", "고양이"}
        );
        list.add(dto);
        return list;
    }

    private List<InsuranceProductDto> crawlKbInsurance() {
        List<InsuranceProductDto> list = new ArrayList<>();
        InsuranceProductDto dto = crawlWithPlaywright(
                "KB손해보험",
                "KB 금쪽같은 펫보험",
                List.of("https://www.kbinsure.co.kr/CG313010001.ec", "https://www.kbinsure.co.kr/main.ec"),
                new String[]{"펫보험", "펫", "반려동물", "강아지", "고양이"}
        );
        list.add(dto);
        return list;
    }

    private List<InsuranceProductDto> crawlMeritz() {
        List<InsuranceProductDto> list = new ArrayList<>();
        InsuranceProductDto dto = crawlWithPlaywright(
                "메리츠화재",
                "메리츠 펫보험",
                List.of("https://www.meritzfire.com/", "https://www.meritzfire.com/product/"),
                new String[]{"펫보험", "펫", "반려동물", "강아지", "고양이"}
        );
        list.add(dto);
        return list;
    }

    private InsuranceProductDto dynamicExtract(String company, String fallbackName, String baseUrl, String[] keywords) {
        String redirect = baseUrl;
        String name = fallbackName;
        List<String> features = new ArrayList<>();
        try (Playwright playwright = Playwright.create()) {
            Browser browser = playwright.chromium().launch(new BrowserType.LaunchOptions().setHeadless(true));
            BrowserContext context = browser.newContext();
            Page page = context.newPage();
            page.navigate(baseUrl, new Page.NavigateOptions().setTimeout(20000));
            for (String kw : keywords) {
                Locator link = page.locator("a:has-text('" + kw + "')").first();
                if (link != null && link.count() > 0) {
                    link.click(new Locator.ClickOptions().setTimeout(10000));
                    break;
                }
            }
            page.waitForLoadState(com.microsoft.playwright.options.LoadState.NETWORKIDLE, new Page.WaitForLoadStateOptions().setTimeout(10000));
            redirect = page.url();
            String title = page.title();
            if (title != null && !title.isBlank() && title.length() <= 60) name = title;
            int liCount = page.locator("li").count();
            for (int i = 0; i < liCount && features.size() < 3; i++) {
                String text = page.locator("li").nth(i).innerText();
                if (text == null) continue;
                String trimmed = text.trim();
                if (trimmed.length() < 4 || trimmed.length() > 60) continue;
                if (trimmed.matches(".*[0-9].*") || trimmed.contains("원") || trimmed.contains("%")) continue;
                features.add(trimmed);
            }
            context.close();
            browser.close();
        } catch (Exception ex) {
            log.warn("{} 동적 파싱 실패: {}", company, ex.getMessage());
        }
        if (features.isEmpty()) features = List.of("질병/상해 치료비", "응급비용", "간편 접수");
        return InsuranceProductDto.builder()
                .company(company)
                .productName(name)
                .description(name)
                .features(features)
                .logoUrl("")
                .redirectUrl(redirect)
                .build();
    }

    private InsuranceProductDto crawlWithPlaywright(String company, String fallbackName, List<String> startUrls, String[] linkKeywords) {
        String finalUrl = startUrls.get(0);
        String name = fallbackName;
        String desc = fallbackName;
        List<String> features = new ArrayList<>();
        try (Playwright pw = Playwright.create()) {
            Browser browser = pw.chromium().launch(new BrowserType.LaunchOptions().setHeadless(true).setArgs(Arrays.asList("--no-sandbox")));
            BrowserContext ctx = browser.newContext();
            Page page = ctx.newPage();

            outer:
            for (String url : startUrls) {
                try {
                    page.navigate(url, new Page.NavigateOptions().setTimeout(20000));
                    page.waitForLoadState(LoadState.NETWORKIDLE, new Page.WaitForLoadStateOptions().setTimeout(10000));
                    for (String kw : linkKeywords) {
                        Locator l = page.locator("a:has-text('" + kw + "')").first();
                        if (l != null && l.count() > 0) {
                            l.click(new Locator.ClickOptions().setTimeout(10000));
                            page.waitForLoadState(LoadState.NETWORKIDLE, new Page.WaitForLoadStateOptions().setTimeout(10000));
                            finalUrl = page.url();
                            break outer;
                        }
                    }
                } catch (Exception ignore) {
                }
            }

            // 최종 페이지 기준 추출
            finalUrl = page.url() != null && !page.url().isBlank() ? page.url() : finalUrl;

            // description 우선: og:description -> meta[name=description] -> 첫 단락
            String og = page.locator("meta[property='og:description']").first().getAttribute("content");
            String md = page.locator("meta[name='description']").first().getAttribute("content");
            String pText = null;
            try { pText = page.locator("p").first().innerText(); } catch (Exception ignore) {}
            if (og != null && !og.isBlank()) desc = og.trim();
            else if (md != null && !md.isBlank()) desc = md.trim();
            else if (pText != null && !pText.isBlank()) desc = pText.trim();
            else desc = page.title();

            // name: h1 -> h2 -> title
            String h1 = null; String h2 = null;
            try { h1 = page.locator("h1").first().innerText(); } catch (Exception ignore) {}
            try { h2 = page.locator("h2").first().innerText(); } catch (Exception ignore) {}
            if (h1 != null && !h1.isBlank() && h1.length() <= 80) name = h1.trim();
            else if (h2 != null && !h2.isBlank() && h2.length() <= 80) name = h2.trim();
            else name = page.title();

            // features: ul li 텍스트 상위 3개 필터링
            List<String> liTexts = new ArrayList<>();
            try {
                int count = page.locator("ul li").count();
                for (int i = 0; i < count && liTexts.size() < 10; i++) {
                    String t = page.locator("ul li").nth(i).innerText();
                    if (t == null) continue;
                    String tt = t.trim();
                    if (tt.length() < 4 || tt.length() > 80) continue;
                    liTexts.add(tt);
                }
            } catch (Exception ignore) {}
            if (!liTexts.isEmpty()) {
                // 중복 제거하고 상위 3개만
                List<String> uniq = new ArrayList<>();
                for (String s : liTexts) {
                    if (!uniq.contains(s)) uniq.add(s);
                }
                features = uniq.subList(0, Math.min(3, uniq.size()));
            }

            ctx.close();
            browser.close();
        } catch (Exception ex) {
            log.warn("{} Playwright 크롤링 실패: {}", company, ex.getMessage());
        }

        if (features.isEmpty()) features = List.of("질병/상해 치료비", "응급비용", "간편 접수");
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
                    log.info("펫보험 링크 발견: {} -> {}", text, href);
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
        log.info("[InsuranceCrawlerJob] start");
        List<InsuranceProductDto> items = new ArrayList<>();
        items.addAll(crawlNhFire());
        items.addAll(crawlSamsungFire());
        items.addAll(crawlHyundaiHi());
        items.addAll(crawlDbInsurance());
        items.addAll(crawlKbInsurance());
        items.addAll(crawlMeritz());

        insuranceService.upsertAll(items);
        log.info("[InsuranceCrawlerJob] done: {} items", items.size());
    }

    @Scheduled(cron = "0 0 2 * * *", zone = "Asia/Seoul")
    public void scheduledDaily() {
        runOnce();
    }

    /**
     * 특정 보험 상품의 상세 정보를 크롤링합니다.
     */
    public InsuranceProductDto crawlProductDetails(InsuranceProductDto product) {
        log.info("[InsuranceCrawlerJob] 상세 정보 크롤링 시작: {}", product.getProductName());
        
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
            
            // 로고 추출
            String logoUrl = extractLogo(doc, url, "삼성화재");
            
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
                    .logoUrl(logoUrl != null ? logoUrl : product.getLogoUrl())
                    .redirectUrl(product.getRedirectUrl())
                    .benefits(benefits)
                    .requirements(requirements)
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
            
            // 로고 추출
            String logoUrl = extractLogo(doc, url, "메리츠화재");
            
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
                    .logoUrl(logoUrl != null ? logoUrl : product.getLogoUrl())
                    .redirectUrl(product.getRedirectUrl())
                    .benefits(benefits)
                    .requirements(requirements)
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
            
            // 로고 추출
            String logoUrl = extractLogo(doc, url, "KB손해보험");
            
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
                    .logoUrl(logoUrl != null ? logoUrl : product.getLogoUrl())
                    .redirectUrl(product.getRedirectUrl())
                    .benefits(benefits)
                    .requirements(requirements)
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
            
            // 로고 추출
            String logoUrl = extractLogo(doc, url, "현대해상");
            
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
                    .logoUrl(logoUrl != null ? logoUrl : product.getLogoUrl())
                    .redirectUrl(product.getRedirectUrl())
                    .benefits(benefits)
                    .requirements(requirements)
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
            
            // 로고 추출
            String logoUrl = extractLogo(doc, url, "NH농협손해보험");
            
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
                    .logoUrl(logoUrl != null ? logoUrl : product.getLogoUrl())
                    .redirectUrl(product.getRedirectUrl())
                    .benefits(benefits)
                    .requirements(requirements)
                    .build();
                    
        } catch (Exception e) {
            log.error("NH농협손해보험 상세 정보 크롤링 실패: {}", e.getMessage());
            return product;
        }
    }

    /**
     * 웹페이지에서 로고 이미지를 추출합니다.
     */
    private String extractLogo(Document doc, String baseUrl, String companyName) {
        try {
            // 회사별 로고 선택자
            String[] selectors = getLogoSelectors(companyName);
            
            for (String selector : selectors) {
                Element logoElement = doc.selectFirst(selector);
                if (logoElement != null) {
                    String logoUrl = logoElement.attr("src");
                    if (logoUrl != null && !logoUrl.isBlank()) {
                        // 상대 URL을 절대 URL로 변환
                        if (logoUrl.startsWith("/")) {
                            String domain = baseUrl.replaceAll("^(https?://[^/]+).*", "$1");
                            logoUrl = domain + logoUrl;
                        } else if (!logoUrl.startsWith("http")) {
                            logoUrl = baseUrl + "/" + logoUrl;
                        }
                        
                        log.info("로고 URL 추출 성공: {} -> {}", companyName, logoUrl);
                        return logoUrl;
                    }
                }
            }
            
            log.warn("로고를 찾을 수 없습니다: {}", companyName);
            return null;
            
        } catch (Exception e) {
            log.error("로고 추출 중 오류 발생: {} - {}", companyName, e.getMessage());
            return null;
        }
    }

    /**
     * 회사별 로고 선택자를 반환합니다.
     */
    private String[] getLogoSelectors(String companyName) {
        switch (companyName) {
            case "삼성화재":
                return new String[]{
                    ".logo img", ".header-logo img", ".company-logo img",
                    "img[alt*='삼성화재']", "img[alt*='Samsung']",
                    ".brand-logo img", ".site-logo img"
                };
            case "메리츠화재":
                return new String[]{
                    ".logo img", ".header-logo img", ".company-logo img",
                    "img[alt*='메리츠']", "img[alt*='Meritz']",
                    ".brand-logo img", ".site-logo img"
                };
            case "KB손해보험":
                return new String[]{
                    ".logo img", ".header-logo img", ".company-logo img",
                    "img[alt*='KB']", "img[alt*='손해보험']",
                    ".brand-logo img", ".site-logo img"
                };
            case "현대해상":
                return new String[]{
                    ".logo img", ".header-logo img", ".company-logo img",
                    "img[alt*='현대해상']", "img[alt*='Hyundai']",
                    ".brand-logo img", ".site-logo img"
                };
            case "NH농협손해보험":
                return new String[]{
                    ".logo img", ".header-logo img", ".company-logo img",
                    "img[alt*='NH']", "img[alt*='농협']",
                    ".brand-logo img", ".site-logo img"
                };
            default:
                return new String[]{
                    ".logo img", ".header-logo img", ".company-logo img",
                    ".brand-logo img", ".site-logo img"
                };
        }
    }
}

