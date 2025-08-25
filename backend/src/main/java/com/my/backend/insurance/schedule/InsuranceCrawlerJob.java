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

    public InsuranceProductDto crawlSamsungFireDirect() {
        String name = "삼성화재 다이렉트 펫보험";
        String desc = "반려동물 의료비/수술비 보장~ 펫 실비보험으로 든든하게!";
        List<String> features = new ArrayList<>();
        List<String> coverage = new ArrayList<>();
        String finalUrl = "https://direct.samsungfire.com/m/fp/pet.html";

        try {
            Playwright playwright = Playwright.create();
            Browser browser = playwright.chromium().launch(
                    new BrowserType.LaunchOptions()
                            .setHeadless(true)
                            .setArgs(Arrays.asList("--no-sandbox", "--disable-dev-shm-usage"))
            );
            
            BrowserContext ctx = browser.newContext();
            Page page = ctx.newPage();

            page.navigate(finalUrl, new Page.NavigateOptions().setTimeout(30000));
            page.waitForLoadState(LoadState.NETWORKIDLE, new Page.WaitForLoadStateOptions().setTimeout(20000));

            String[] featureSelectors = {
                ".bullet-list li p",
                ".fp-cont .bullet-list li p",
                ".bullet-list li"
            };

            for (String selector : featureSelectors) {
                try {
                    int count = page.locator(selector).count();
                    
                    for (int i = 0; i < count && features.size() < 8; i++) {
                        String text = page.locator(selector).nth(i).innerText();
                        if (text != null && !text.isBlank()) {
                            String trimmed = text.trim();
                            
                            if (selector.contains("bullet-list") && selector.contains("p")) {
                                String[] lines = trimmed.split("\n");
                                for (String line : lines) {
                                    String cleanLine = line.trim();
                                    if (!cleanLine.isEmpty() && cleanLine.length() > 5) {
                                        if (cleanLine.contains("보장") || cleanLine.contains("할인") || cleanLine.contains("특약")) {
                                            features.add(cleanLine);
                                        }
                                    }
                                }
                            } else if (isValidSamsungFeature(trimmed)) {
                                features.add(trimmed);
                            }
                        }
                    }
                    if (!features.isEmpty()) {
                        break;
                    }
                } catch (Exception e) {
                    log.error("삼성화재 선택자 '{}' 실패: {}", selector, e.getMessage());
                }
            }

            String[] coverageSelectors = {
                ".if-list li dl",
                ".fp-cont .if-list li dl",
                ".list-wrap .if-list li dl",
                ".bullet-list li p span"
            };

            for (String selector : coverageSelectors) {
                try {
                    int count = page.locator(selector).count();
                    
                    for (int i = 0; i < count && coverage.size() < 12; i++) {
                        String text = page.locator(selector).nth(i).innerText();
                        if (text != null && !text.isBlank()) {
                            String trimmed = text.trim();
                            
                            if (selector.contains("if-list") && selector.contains("dl")) {
                                String[] lines = trimmed.split("\n");
                                for (String line : lines) {
                                    String cleanLine = line.trim();
                                    if (!cleanLine.isEmpty() && cleanLine.length() > 3) {
                                        if (cleanLine.contains("가입나이") || cleanLine.contains("보험기간") || 
                                            cleanLine.contains("생후") || cleanLine.contains("만")) {
                                            coverage.add(cleanLine);
                                        }
                                    }
                                }
                            } else if (selector.contains("span")) {
                                if (trimmed.length() > 10 && (trimmed.contains("치료비") || trimmed.contains("질환") || trimmed.contains("할인"))) {
                                    coverage.add(trimmed);
                                }
                            } else if (isValidSamsungCoverage(trimmed)) {
                                coverage.add(trimmed);
                            }
                        }
                    }
                    if (!coverage.isEmpty()) {
                        break;
                    }
                } catch (Exception e) {
                    log.error("삼성화재 보장내역 선택자 '{}' 실패: {}", selector, e.getMessage());
                }
            }

            ctx.close();
            browser.close();

        } catch (Exception ex) {
            log.error("삼성화재 Playwright 크롤링 실패: {}", ex.getMessage(), ex);
        }

        if (features.isEmpty()) {
            features = Arrays.asList(
                "반려견 의료비, 수술비 보장 (특약)",
                "반려묘 의료비, 수술비 보장 (특약)",
                "저렴한 다이렉트 보험료에 5% 추가 할인!",
                "생후 61일 ~ 만 10세까지 가입 가능",
                "만 20세까지 (3/5년 자동갱신)"
            );
        }

        if (coverage.isEmpty()) {
            coverage = Arrays.asList(
                "반려견 의료비, 수술비 보장 (특약): 피부병, 슬관절 치료비를 준비하세요. (보장 비율 50/70/80% 중 선택 가능)",
                "반려묘 의료비, 수술비 보장 (특약): 비뇨기 질환 및 허피스, 칼리시를 대비하세요. (보장 비율 50/70/80% 중 선택 가능)",
                "저렴한 다이렉트 보험료에 5% 추가 할인!: 동물등록증 사진 제출 시 보장보험료의 5% 할인",
                "가입나이: 생후 61일 ~ 만 10세까지",
                "보험기간: 만 20세까지 (3/5년 자동갱신)"
            );
        }

        List<String> limitedFeatures = new ArrayList<>();
        int featureCount = 0;
        for (String feature : features) {
            if (featureCount >= 5) break;
            if (feature.length() > 100) {
                limitedFeatures.add(feature.substring(0, 97) + "...");
            } else {
                limitedFeatures.add(feature);
            }
            featureCount++;
        }

        List<String> limitedCoverage = new ArrayList<>();
        int coverageCount = 0;
        for (String item : coverage) {
            if (coverageCount >= 5) break;
            if (item.length() > 100) {
                limitedCoverage.add(item.substring(0, 97) + "...");
            } else {
                limitedCoverage.add(item);
            }
            coverageCount++;
        }

        log.info("삼성화재 크롤링 완료 - 특징: {}개, 보장내역: {}개", limitedFeatures.size(), limitedCoverage.size());

        return InsuranceProductDto.builder()
                .company("삼성화재")
                .productName(name)
                .description(desc)
                .features(limitedFeatures)
                .coverageDetails(limitedCoverage)
                .logoUrl("")
                .redirectUrl(finalUrl)
                .build();
    }

    public InsuranceProductDto crawlKbInsuranceDirect() {
        String name = "KB 금쪽같은 펫보험";
        String desc = "국민의 평생 희망파트너, KB손해보험";
        List<String> features = new ArrayList<>();
        List<String> coverage = new ArrayList<>();
        String finalUrl = "https://www.kbinsure.co.kr/CG313010001.ec";

        try {
            Playwright playwright = Playwright.create();
            Browser browser = playwright.chromium().launch(
                    new BrowserType.LaunchOptions()
                            .setHeadless(true)
                            .setArgs(Arrays.asList("--no-sandbox", "--disable-dev-shm-usage"))
            );
            
            BrowserContext ctx = browser.newContext();
            Page page = ctx.newPage();

            page.navigate(finalUrl, new Page.NavigateOptions().setTimeout(30000));
            page.waitForLoadState(LoadState.NETWORKIDLE, new Page.WaitForLoadStateOptions().setTimeout(20000));

            String[] featureSelectors = {
                ".product-feature li", ".benefit-list li", ".coverage-item",
                ".product-info .item", ".feature-list li", ".highlight-item"
            };

            for (String selector : featureSelectors) {
                try {
                    int count = page.locator(selector).count();
                    
                    for (int i = 0; i < count && features.size() < 8; i++) {
                        String text = page.locator(selector).nth(i).innerText();
                        if (text != null && !text.isBlank()) {
                            String trimmed = text.trim();
                            
                            if (isValidKbFeature(trimmed)) {
                                features.add(trimmed);
                            }
                        }
                    }
                    if (!features.isEmpty()) {
                        break;
                    }
                } catch (Exception e) {
                    log.error("KB손해보험 선택자 '{}' 실패: {}", selector, e.getMessage());
                }
            }

            String[] coverageSelectors = {
                ".coverage-table tr", ".benefit-table tr", ".guarantee-list li",
                ".product-detail .item", ".coverage-detail li", ".benefit-detail"
            };

            for (String selector : coverageSelectors) {
                try {
                    int count = page.locator(selector).count();
                    
                    for (int i = 0; i < count && coverage.size() < 12; i++) {
                        String text = page.locator(selector).nth(i).innerText();
                        if (text != null && !text.isBlank()) {
                            String trimmed = text.trim();
                            
                            if (isValidKbCoverage(trimmed)) {
                                coverage.add(trimmed);
                            }
                        }
                    }
                    if (!coverage.isEmpty()) {
                        break;
                    }
                } catch (Exception e) {
                    log.error("KB손해보험 보장내역 선택자 '{}' 실패: {}", selector, e.getMessage());
                }
            }

            ctx.close();
            browser.close();

        } catch (Exception ex) {
            log.error("KB손해보험 Playwright 크롤링 실패: {}", ex.getMessage(), ex);
        }

        if (features.isEmpty()) {
            features = Arrays.asList(
                "반려동물 의료비 보장",
                "수술비 보장",
                "입원/통원 치료비 보장",
                "검사비 보장",
                "약품비 보장"
            );
        }

        if (coverage.isEmpty()) {
            coverage = Arrays.asList(
                "반려동물 의료비: 만 0세~만 10세",
                "수술비 보장: 한도 내 실손보상",
                "입원/통원 치료비: 의료기관에서 발생한 비용",
                "검사비: 진단을 위한 검사 비용",
                "약품비: 처방된 약품 비용"
            );
        }

        List<String> limitedFeatures = new ArrayList<>();
        int featureCount = 0;
        for (String feature : features) {
            if (featureCount >= 5) break;
            if (feature.length() > 100) {
                limitedFeatures.add(feature.substring(0, 97) + "...");
            } else {
                limitedFeatures.add(feature);
            }
            featureCount++;
        }

        List<String> limitedCoverage = new ArrayList<>();
        int coverageCount = 0;
        for (String item : coverage) {
            if (coverageCount >= 5) break;
            if (item.length() > 100) {
                limitedCoverage.add(item.substring(0, 97) + "...");
            } else {
                limitedCoverage.add(item);
            }
            coverageCount++;
        }

        log.info("KB손해보험 크롤링 완료 - 특징: {}개, 보장내역: {}개", limitedFeatures.size(), limitedCoverage.size());

        return InsuranceProductDto.builder()
                .company("KB손해보험")
                .productName(name)
                .description(desc)
                .features(limitedFeatures)
                .coverageDetails(limitedCoverage)
                .logoUrl("")
                .redirectUrl(finalUrl)
                .build();
    }

    public InsuranceProductDto crawlHyundaiHiDirect() {
        String name = "현대해상 굿앤굿 우리펫보험";
        String desc = "현대해상 굿앤굿 우리펫보험 - 반려동물을 위한 맞춤형 보험 상품";
        List<String> features = new ArrayList<>();
        List<String> coverage = new ArrayList<>();
        String finalUrl = "https://direct.hi.co.kr/product/doga/dog_insurance_introduce.jsp";

        try {
            Playwright playwright = Playwright.create();
            Browser browser = playwright.chromium().launch(
                    new BrowserType.LaunchOptions()
                            .setHeadless(true)
                            .setArgs(Arrays.asList("--no-sandbox", "--disable-dev-shm-usage"))
            );
            
            BrowserContext ctx = browser.newContext();
            Page page = ctx.newPage();

            page.navigate(finalUrl, new Page.NavigateOptions().setTimeout(30000));
            page.waitForLoadState(LoadState.NETWORKIDLE, new Page.WaitForLoadStateOptions().setTimeout(20000));

            String[] featureSelectors = {
                ".product-benefit li", ".feature-list li", ".benefit-item",
                ".product-info .item", ".highlight-list li", ".advantage-item"
            };

            for (String selector : featureSelectors) {
                try {
                    int count = page.locator(selector).count();
                    
                    for (int i = 0; i < count && features.size() < 8; i++) {
                        String text = page.locator(selector).nth(i).innerText();
                        if (text != null && !text.isBlank()) {
                            String trimmed = text.trim();
                            
                            if (isValidHyundaiFeature(trimmed)) {
                                features.add(trimmed);
                            }
                        }
                    }
                    if (!features.isEmpty()) {
                        break;
                    }
                } catch (Exception e) {
                    log.error("현대해상 선택자 '{}' 실패: {}", selector, e.getMessage());
                }
            }

            String[] coverageSelectors = {
                ".coverage-table tr", ".benefit-table tr", ".guarantee-list li",
                ".product-detail .item", ".coverage-detail li", ".benefit-detail"
            };

            for (String selector : coverageSelectors) {
                try {
                    int count = page.locator(selector).count();
                    
                    for (int i = 0; i < count && coverage.size() < 12; i++) {
                        String text = page.locator(selector).nth(i).innerText();
                        if (text != null && !text.isBlank()) {
                            String trimmed = text.trim();
                            
                            if (isValidHyundaiCoverage(trimmed)) {
                                coverage.add(trimmed);
                            }
                        }
                    }
                    if (!coverage.isEmpty()) {
                        break;
                    }
                } catch (Exception e) {
                    log.error("현대해상 보장내역 선택자 '{}' 실패: {}", selector, e.getMessage());
                }
            }

            ctx.close();
            browser.close();

        } catch (Exception ex) {
            log.error("현대해상 Playwright 크롤링 실패: {}", ex.getMessage(), ex);
        }

        if (features.isEmpty()) {
            features = Arrays.asList(
                "반려동물 의료비 보장",
                "수술비 보장",
                "입원/통원 치료비 보장",
                "검사비 보장",
                "약품비 보장"
            );
        }

        if (coverage.isEmpty()) {
            coverage = Arrays.asList(
                "반려동물 의료비: 만 0세~만 10세",
                "수술비 보장: 한도 내 실손보상",
                "입원/통원 치료비: 의료기관에서 발생한 비용",
                "검사비: 진단을 위한 검사 비용",
                "약품비: 처방된 약품 비용"
            );
        }

        List<String> limitedFeatures = new ArrayList<>();
        int featureCount = 0;
        for (String feature : features) {
            if (featureCount >= 5) break;
            if (feature.length() > 100) {
                limitedFeatures.add(feature.substring(0, 97) + "...");
            } else {
                limitedFeatures.add(feature);
            }
            featureCount++;
        }

        List<String> limitedCoverage = new ArrayList<>();
        int coverageCount = 0;
        for (String item : coverage) {
            if (coverageCount >= 5) break;
            if (item.length() > 100) {
                limitedCoverage.add(item.substring(0, 97) + "...");
            } else {
                limitedCoverage.add(item);
            }
            coverageCount++;
        }

        log.info("현대해상 크롤링 완료 - 특징: {}개, 보장내역: {}개", limitedFeatures.size(), limitedCoverage.size());

        return InsuranceProductDto.builder()
                .company("현대해상")
                .productName(name)
                .description(desc)
                .features(limitedFeatures)
                .coverageDetails(limitedCoverage)
                .logoUrl("")
                .redirectUrl(finalUrl)
                .build();
    }

    public InsuranceProductDto crawlNhFireDirect() {
        String name = "NH농협손해보험 펫보험";
        String desc = "보험에 마음을 더합니다. 헤아림-NH농협손해보험";
        List<String> features = new ArrayList<>();
        List<String> coverage = new ArrayList<>();
        String finalUrl = "https://nhfire.co.kr/product/retrieveProduct.nhfire?pdtCd=D314511";

        try {
            Playwright playwright = Playwright.create();
            Browser browser = playwright.chromium().launch(
                    new BrowserType.LaunchOptions()
                            .setHeadless(true)
                            .setArgs(Arrays.asList("--no-sandbox", "--disable-dev-shm-usage"))
            );
            
            BrowserContext ctx = browser.newContext();
            Page page = ctx.newPage();

            page.navigate(finalUrl, new Page.NavigateOptions().setTimeout(30000));
            page.waitForLoadState(LoadState.NETWORKIDLE, new Page.WaitForLoadStateOptions().setTimeout(20000));

            String[] featureSelectors = {
                ".product-benefit li", ".feature-list li", ".benefit-item",
                ".product-info .item", ".highlight-list li", ".advantage-item",
                ".product-detail li", ".coverage-item"
            };

            for (String selector : featureSelectors) {
                try {
                    int count = page.locator(selector).count();
                    
                    for (int i = 0; i < count && features.size() < 8; i++) {
                        String text = page.locator(selector).nth(i).innerText();
                        if (text != null && !text.isBlank()) {
                            String trimmed = text.trim();
                            
                            if (isValidNhFeature(trimmed)) {
                                features.add(trimmed);
                            }
                        }
                    }
                    if (!features.isEmpty()) {
                        break;
                    }
                } catch (Exception e) {
                    log.error("NH농협손해보험 선택자 '{}' 실패: {}", selector, e.getMessage());
                }
            }

            String[] coverageSelectors = {
                ".coverage-table tr", ".benefit-table tr", ".guarantee-list li",
                ".product-detail .item", ".coverage-detail li", ".benefit-detail",
                ".product-info table tr", ".coverage-info li"
            };

            for (String selector : coverageSelectors) {
                try {
                    int count = page.locator(selector).count();
                    
                    for (int i = 0; i < count && coverage.size() < 12; i++) {
                        String text = page.locator(selector).nth(i).innerText();
                        if (text != null && !text.isBlank()) {
                            String trimmed = text.trim();
                            
                            if (isValidNhCoverage(trimmed)) {
                                coverage.add(trimmed);
                            }
                        }
                    }
                    if (!coverage.isEmpty()) {
                        break;
                    }
                } catch (Exception e) {
                    log.error("NH농협손해보험 보장내역 선택자 '{}' 실패: {}", selector, e.getMessage());
                }
            }

            ctx.close();
            browser.close();

        } catch (Exception ex) {
            log.error("NH농협손해보험 Playwright 크롤링 실패: {}", ex.getMessage(), ex);
        }

        if (features.isEmpty()) {
            features = Arrays.asList(
                "반려동물 의료비 보장",
                "수술비 보장",
                "입원/통원 치료비 보장",
                "검사비 보장",
                "약품비 보장"
            );
        }

        if (coverage.isEmpty()) {
            coverage = Arrays.asList(
                "반려동물 의료비: 만 0세~만 10세",
                "수술비 보장: 한도 내 실손보상",
                "입원/통원 치료비: 의료기관에서 발생한 비용",
                "검사비: 진단을 위한 검사 비용",
                "약품비: 처방된 약품 비용"
            );
        }

        List<String> limitedFeatures = new ArrayList<>();
        int featureCount = 0;
        for (String feature : features) {
            if (featureCount >= 5) break;
            if (feature.length() > 100) {
                limitedFeatures.add(feature.substring(0, 97) + "...");
            } else {
                limitedFeatures.add(feature);
            }
            featureCount++;
        }

        List<String> limitedCoverage = new ArrayList<>();
        int coverageCount = 0;
        for (String item : coverage) {
            if (coverageCount >= 5) break;
            if (item.length() > 100) {
                limitedCoverage.add(item.substring(0, 97) + "...");
            } else {
                limitedCoverage.add(item);
            }
            coverageCount++;
        }

        log.info("NH농협손해보험 크롤링 완료 - 특징: {}개, 보장내역: {}개", limitedFeatures.size(), limitedCoverage.size());

        return InsuranceProductDto.builder()
                .company("NH농협손해보험")
                .productName(name)
                .description(desc)
                .features(limitedFeatures)
                .coverageDetails(limitedCoverage)
                .logoUrl("")
                .redirectUrl(finalUrl)
                .build();
    }

    public InsuranceProductDto crawlMeritzDirect() {
        String name = "메리츠화재 다이렉트 강아지보험";
        String desc = "동물병원 치료비가 걱정된다면, 메리츠 펫보험으로 준비하세요.";
        List<String> features = new ArrayList<>();
        List<String> coverage = new ArrayList<>();
        String finalUrl = "https://store.meritzfire.com/pet/product.do";

        try {
            Playwright playwright = Playwright.create();
            Browser browser = playwright.chromium().launch(
                    new BrowserType.LaunchOptions()
                            .setHeadless(true)
                            .setArgs(Arrays.asList("--no-sandbox", "--disable-dev-shm-usage"))
            );
            
            BrowserContext ctx = browser.newContext();
            Page page = ctx.newPage();

            page.navigate(finalUrl, new Page.NavigateOptions().setTimeout(30000));
            page.waitForLoadState(LoadState.NETWORKIDLE, new Page.WaitForLoadStateOptions().setTimeout(20000));

            String[] featureSelectors = {
                ".product-benefit li", ".feature-list li", ".benefit-item",
                ".product-info .item", ".highlight-list li", ".advantage-item",
                ".product-detail li", ".coverage-item", ".pet-benefit li"
            };

            for (String selector : featureSelectors) {
                try {
                    int count = page.locator(selector).count();
                    
                    for (int i = 0; i < count && features.size() < 8; i++) {
                        String text = page.locator(selector).nth(i).innerText();
                        if (text != null && !text.isBlank()) {
                            String trimmed = text.trim();
                            
                            if (isValidMeritzFeature(trimmed)) {
                                features.add(trimmed);
                            }
                        }
                    }
                    if (!features.isEmpty()) {
                        break;
                    }
                } catch (Exception e) {
                    log.error("메리츠화재 선택자 '{}' 실패: {}", selector, e.getMessage());
                }
            }

            String[] coverageSelectors = {
                ".coverage-table tr", ".benefit-table tr", ".guarantee-list li",
                ".product-detail .item", ".coverage-detail li", ".benefit-detail",
                ".product-info table tr", ".coverage-info li", ".pet-coverage li"
            };

            for (String selector : coverageSelectors) {
                try {
                    int count = page.locator(selector).count();
                    
                    for (int i = 0; i < count && coverage.size() < 12; i++) {
                        String text = page.locator(selector).nth(i).innerText();
                        if (text != null && !text.isBlank()) {
                            String trimmed = text.trim();
                            
                            if (isValidMeritzCoverage(trimmed)) {
                                coverage.add(trimmed);
                            }
                        }
                    }
                    if (!coverage.isEmpty()) {
                        break;
                    }
                } catch (Exception e) {
                    log.error("메리츠화재 보장내역 선택자 '{}' 실패: {}", selector, e.getMessage());
                }
            }

            ctx.close();
            browser.close();

        } catch (Exception ex) {
            log.error("메리츠화재 Playwright 크롤링 실패: {}", ex.getMessage(), ex);
        }

        if (features.isEmpty()) {
            features = Arrays.asList(
                "반려동물 의료비 보장",
                "수술비 보장",
                "입원/통원 치료비 보장",
                "검사비 보장",
                "약품비 보장"
            );
        }

        if (coverage.isEmpty()) {
            coverage = Arrays.asList(
                "반려동물 의료비: 만 0세~만 10세",
                "수술비 보장: 한도 내 실손보상",
                "입원/통원 치료비: 의료기관에서 발생한 비용",
                "검사비: 진단을 위한 검사 비용",
                "약품비: 처방된 약품 비용"
            );
        }

        List<String> limitedFeatures = new ArrayList<>();
        int featureCount = 0;
        for (String feature : features) {
            if (featureCount >= 5) break;
            if (feature.length() > 100) {
                limitedFeatures.add(feature.substring(0, 97) + "...");
            } else {
                limitedFeatures.add(feature);
            }
            featureCount++;
        }

        List<String> limitedCoverage = new ArrayList<>();
        int coverageCount = 0;
        for (String item : coverage) {
            if (coverageCount >= 5) break;
            if (item.length() > 100) {
                limitedCoverage.add(item.substring(0, 97) + "...");
            } else {
                limitedCoverage.add(item);
            }
            coverageCount++;
        }

        log.info("메리츠화재 크롤링 완료 - 특징: {}개, 보장내역: {}개", limitedFeatures.size(), limitedCoverage.size());

        return InsuranceProductDto.builder()
                .company("메리츠화재")
                .productName(name)
                .description(desc)
                .features(limitedFeatures)
                .coverageDetails(limitedCoverage)
                .logoUrl("")
                .redirectUrl(finalUrl)
                .build();
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
     * 웹페이지에서 로고 이미지를 추출합니다.
     */

    private boolean isValidSamsungFeature(String text) {
        if (text == null || text.length() < 3 || text.length() > 100) return false;
        
        // 유용한 키워드 포함 여부
        String[] keywords = {"보장", "치료", "수술", "입원", "통원", "검사", "의료", "비용", "한도"};
        for (String keyword : keywords) {
            if (text.contains(keyword)) return true;
        }
        
        return false;
    }

    private boolean isValidSamsungCoverage(String text) {
        if (text == null || text.length() < 5 || text.length() > 150) return false;
        
        // 보장 관련 키워드 포함 여부
        String[] keywords = {"보장", "치료", "수술", "입원", "통원", "검사", "의료", "비용", "한도", "만원", "%"};
        for (String keyword : keywords) {
            if (text.contains(keyword)) return true;
        }
        
        return false;
    }

    private boolean isValidKbFeature(String text) {
        if (text == null || text.length() < 3 || text.length() > 100) return false;
        
        // KB손해보험 특화 키워드
        String[] keywords = {"보장", "치료", "수술", "입원", "통원", "검사", "의료", "비용", "한도", "반려동물", "펫"};
        for (String keyword : keywords) {
            if (text.contains(keyword)) return true;
        }
        
        return false;
    }

    private boolean isValidKbCoverage(String text) {
        if (text == null || text.length() < 5 || text.length() > 150) return false;
        
        // KB손해보험 보장 관련 키워드
        String[] keywords = {"보장", "치료", "수술", "입원", "통원", "검사", "의료", "비용", "한도", "만원", "%", "반려동물"};
        for (String keyword : keywords) {
            if (text.contains(keyword)) return true;
        }
        
        return false;
    }

    private boolean isValidHyundaiFeature(String text) {
        if (text == null || text.length() < 3 || text.length() > 100) return false;
        
        // 현대해상 특화 키워드
        String[] keywords = {"보장", "치료", "수술", "입원", "통원", "검사", "의료", "비용", "한도", "반려동물", "펫", "굿앤굿"};
        for (String keyword : keywords) {
            if (text.contains(keyword)) return true;
        }
        
        return false;
    }

    private boolean isValidHyundaiCoverage(String text) {
        if (text == null || text.length() < 5 || text.length() > 150) return false;
        
        // 현대해상 보장 관련 키워드
        String[] keywords = {"보장", "치료", "수술", "입원", "통원", "검사", "의료", "비용", "한도", "만원", "%", "반려동물"};
        for (String keyword : keywords) {
            if (text.contains(keyword)) return true;
        }
        
        return false;
    }

    private boolean isValidNhFeature(String text) {
        if (text == null || text.length() < 3 || text.length() > 100) return false;
        
        // NH농협손해보험 특화 키워드
        String[] keywords = {"보장", "치료", "수술", "입원", "통원", "검사", "의료", "비용", "한도", "반려동물", "펫", "헤아림"};
        for (String keyword : keywords) {
            if (text.contains(keyword)) return true;
        }
        
        return false;
    }

    private boolean isValidNhCoverage(String text) {
        if (text == null || text.length() < 5 || text.length() > 150) return false;
        
        // NH농협손해보험 보장 관련 키워드
        String[] keywords = {"보장", "치료", "수술", "입원", "통원", "검사", "의료", "비용", "한도", "만원", "%", "반려동물"};
        for (String keyword : keywords) {
            if (text.contains(keyword)) return true;
        }
        
        return false;
    }

    private boolean isValidMeritzFeature(String text) {
        if (text == null || text.length() < 3 || text.length() > 100) return false;
        
        // 메리츠화재 특화 키워드
        String[] keywords = {"보장", "치료", "수술", "입원", "통원", "검사", "의료", "비용", "한도", "반려동물", "펫", "강아지"};
        for (String keyword : keywords) {
            if (text.contains(keyword)) return true;
        }
        
        return false;
    }

    private boolean isValidMeritzCoverage(String text) {
        if (text == null || text.length() < 5 || text.length() > 150) return false;
        
        // 메리츠화재 보장 관련 키워드
        String[] keywords = {"보장", "치료", "수술", "입원", "통원", "검사", "의료", "비용", "한도", "만원", "%", "반려동물"};
        for (String keyword : keywords) {
            if (text.contains(keyword)) return true;
        }
        
        return false;
    }

    public InsuranceProductDto crawlDbInsuranceDirect() {
        String name = "DB손해보험 펫보험";
        String desc = "어떤 할인 혜택과 이벤트를 받을 수 있나요?";
        List<String> features = new ArrayList<>();
        List<String> coverage = new ArrayList<>();
        String finalUrl = "https://directidb.co.kr/l_pet/index.html";

        try {
            Playwright playwright = Playwright.create();
            Browser browser = playwright.chromium().launch(
                    new BrowserType.LaunchOptions()
                            .setHeadless(true)
                            .setArgs(Arrays.asList("--no-sandbox", "--disable-dev-shm-usage"))
            );
            
            BrowserContext ctx = browser.newContext();
            Page page = ctx.newPage();

            page.navigate(finalUrl, new Page.NavigateOptions().setTimeout(30000));
            page.waitForLoadState(LoadState.NETWORKIDLE, new Page.WaitForLoadStateOptions().setTimeout(20000));

            String[] featureSelectors = {
                ".product-benefit li", ".feature-list li", ".benefit-item",
                ".product-info .item", ".highlight-list li", ".advantage-item",
                ".product-detail li", ".coverage-item", ".pet-benefit li"
            };

            for (String selector : featureSelectors) {
                try {
                    int count = page.locator(selector).count();
                    
                    for (int i = 0; i < count && features.size() < 8; i++) {
                        String text = page.locator(selector).nth(i).innerText();
                        if (text != null && !text.isBlank()) {
                            String trimmed = text.trim();
                            
                            if (isValidDbFeature(trimmed)) {
                                features.add(trimmed);
                            }
                        }
                    }
                    if (!features.isEmpty()) {
                        break;
                    }
                } catch (Exception e) {
                    log.error("DB손해보험 선택자 '{}' 실패: {}", selector, e.getMessage());
                }
            }

            String[] coverageSelectors = {
                ".coverage-table tr", ".benefit-table tr", ".guarantee-list li",
                ".product-detail .item", ".coverage-detail li", ".benefit-detail",
                ".product-info table tr", ".coverage-info li", ".pet-coverage li"
            };

            for (String selector : coverageSelectors) {
                try {
                    int count = page.locator(selector).count();
                    
                    for (int i = 0; i < count && coverage.size() < 12; i++) {
                        String text = page.locator(selector).nth(i).innerText();
                        if (text != null && !text.isBlank()) {
                            String trimmed = text.trim();
                            
                            if (isValidDbCoverage(trimmed)) {
                                coverage.add(trimmed);
                            }
                        }
                    }
                    if (!coverage.isEmpty()) {
                        break;
                    }
                } catch (Exception e) {
                    log.error("DB손해보험 보장내역 선택자 '{}' 실패: {}", selector, e.getMessage());
                }
            }

            ctx.close();
            browser.close();

        } catch (Exception ex) {
            log.error("DB손해보험 Playwright 크롤링 실패: {}", ex.getMessage(), ex);
        }

        if (features.isEmpty()) {
            features = Arrays.asList(
                "반려동물 의료비 보장",
                "수술비 보장",
                "입원/통원 치료비 보장",
                "검사비 보장",
                "약품비 보장"
            );
        }

        if (coverage.isEmpty()) {
            coverage = Arrays.asList(
                "반려동물 의료비: 만 0세~만 10세",
                "수술비 보장: 한도 내 실손보상",
                "입원/통원 치료비: 의료기관에서 발생한 비용",
                "검사비: 진단을 위한 검사 비용",
                "약품비: 처방된 약품 비용"
            );
        }

        List<String> limitedFeatures = new ArrayList<>();
        int featureCount = 0;
        for (String feature : features) {
            if (featureCount >= 5) break;
            if (feature.length() > 100) {
                limitedFeatures.add(feature.substring(0, 97) + "...");
            } else {
                limitedFeatures.add(feature);
            }
            featureCount++;
        }

        List<String> limitedCoverage = new ArrayList<>();
        int coverageCount = 0;
        for (String item : coverage) {
            if (coverageCount >= 5) break;
            if (item.length() > 100) {
                limitedCoverage.add(item.substring(0, 97) + "...");
            } else {
                limitedCoverage.add(item);
            }
            coverageCount++;
        }

        log.info("DB손해보험 크롤링 완료 - 특징: {}개, 보장내역: {}개", limitedFeatures.size(), limitedCoverage.size());

        return InsuranceProductDto.builder()
                .company("DB손해보험")
                .productName(name)
                .description(desc)
                .features(limitedFeatures)
                .coverageDetails(limitedCoverage)
                .logoUrl("")
                .redirectUrl(finalUrl)
                .build();
    }

    private boolean isValidDbFeature(String text) {
        if (text == null || text.length() < 3 || text.length() > 100) return false;
        
        // DB손해보험 특화 키워드
        String[] keywords = {"보장", "치료", "수술", "입원", "통원", "검사", "의료", "비용", "한도", "반려동물", "펫"};
        for (String keyword : keywords) {
            if (text.contains(keyword)) return true;
        }
        
        return false;
    }

    private boolean isValidDbCoverage(String text) {
        if (text == null || text.length() < 5 || text.length() > 150) return false;
        
        // DB손해보험 보장 관련 키워드
        String[] keywords = {"보장", "치료", "수술", "입원", "통원", "검사", "의료", "비용", "한도", "만원", "%", "반려동물"};
        for (String keyword : keywords) {
            if (text.contains(keyword)) return true;
        }
        
        return false;
    }

}

