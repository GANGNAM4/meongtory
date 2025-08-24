package com.my.backend.insurance.schedule;

import com.my.backend.insurance.dto.InsuranceProductDto;
import com.my.backend.insurance.service.InsuranceService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.stream.Collectors;

/**
 * 통합된 보험 크롤링 시스템
 * 모든 개선된 크롤링 컴포넌트들을 조합하여 사용
 */
@Slf4j
@Component
public class IntegratedInsuranceCrawler {

    private final InsuranceService insuranceService;
    
    // 크롤링 컴포넌트들을 직접 생성하여 사용
    private final ImprovedInsuranceCrawler insuranceNameCrawler = new ImprovedInsuranceCrawler();
    private final CoverageSummaryCrawler coverageCrawler = new CoverageSummaryCrawler();
    private final DetailedInfoCrawler detailedCrawler = new DetailedInfoCrawler();

    public IntegratedInsuranceCrawler(InsuranceService insuranceService) {
        this.insuranceService = insuranceService;
    }
    
    // 병렬 처리를 위한 스레드 풀
    private final ExecutorService executorService = Executors.newFixedThreadPool(6);

    // 지원하는 보험사 목록
    private static final String[] SUPPORTED_COMPANIES = {
        "삼성화재", "NH농협손해보험", "KB손해보험", 
        "현대해상", "메리츠화재", "DB손해보험"
    };
    
    // 보험사별 펫보험 URL
    private static final java.util.Map<String, String> COMPANY_URLS = java.util.Map.of(
        "삼성화재", "https://direct.samsungfire.com/m/fp/pet.html",
        "NH농협손해보험", "https://nhfire.co.kr/product/retrieveProduct.nhfire?pdtCd=D314511",
        "KB손해보험", "https://www.kbinsure.co.kr/CG313010001.ec",
        "현대해상", "https://direct.hi.co.kr/product/doga/dog_insurance_introduce.jsp",
        "메리츠화재", "https://www.meritzfire.com/fire-and-life/pet/direct-pet.do#!/",
        "DB손해보험", "https://www.dbins.co.kr/"
    );

    /**
     * 메인 페이지용 기본 크롤링 (빠른 응답)
     * 보험 이름 + 보장요약 + 로고 (기본)
     */
    public List<InsuranceProductDto> crawlForMainPage() {
        String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
        
        List<CompletableFuture<InsuranceProductDto>> futures = new ArrayList<>();
        
        // 각 보험사별로 병렬 크롤링
        for (String company : SUPPORTED_COMPANIES) {
            CompletableFuture<InsuranceProductDto> future = CompletableFuture.supplyAsync(() -> {
                return crawlSingleCompanyForMainPage(company);
            }, executorService);
            futures.add(future);
        }
        
        // 모든 결과 수집
        List<InsuranceProductDto> results = new ArrayList<>();
        for (CompletableFuture<InsuranceProductDto> future : futures) {
            try {
                InsuranceProductDto result = future.get();
                if (result != null) {
                    results.add(result);
                }
            } catch (Exception e) {
                log.error("메인 페이지 크롤링 중 오류: {}", e.getMessage());
            }
        }
        

        
        return results;
    }
    
    /**
     * 상세 페이지용 상세 크롤링
     * 모든 정보 + 로고 (상세) + 추가 정보
     */
    public InsuranceProductDto crawlForDetailPage(String companyName) {
        
        String petInsuranceUrl = COMPANY_URLS.get(companyName);
        if (petInsuranceUrl == null) {
            log.warn("지원하지 않는 보험사: {}", companyName);
            return createFallbackProduct(companyName);
        }
        
        try {
            // 1단계: 기본 정보 크롤링
            InsuranceProductDto basicInfo = insuranceNameCrawler.crawlInsuranceName(companyName);
            
            // 2단계: 보장 요약 크롤링
            InsuranceProductDto coverageInfo = coverageCrawler.crawlCoverageSummary(companyName, petInsuranceUrl);
            
            // 3단계: 상세 정보 크롤링
            DetailedInfoCrawler.DetailedInsuranceInfo detailedInfo = 
                detailedCrawler.crawlDetailedInfo(companyName, petInsuranceUrl);
            
            // 4단계: 로고 크롤링 제거됨
            String logoUrl = "";
            
            // 모든 정보 통합
            InsuranceProductDto integratedProduct = integrateAllInformation(
                basicInfo, coverageInfo, detailedInfo, logoUrl
            );
            
            return integratedProduct;
            
        } catch (Exception e) {
            log.error("상세 페이지 크롤링 실패: {} - {}", companyName, e.getMessage());
            return createFallbackProduct(companyName);
        }
    }
    
    /**
     * 단일 보험사 메인 페이지용 크롤링
     */
    private InsuranceProductDto crawlSingleCompanyForMainPage(String companyName) {
        String petInsuranceUrl = COMPANY_URLS.get(companyName);
        if (petInsuranceUrl == null) {
            return createFallbackProduct(companyName);
        }
        
        try {
            
            // 병렬로 기본 정보와 로고 크롤링
            CompletableFuture<InsuranceProductDto> basicInfoFuture = 
                CompletableFuture.supplyAsync(() -> {
                    try {
                        return insuranceNameCrawler.crawlInsuranceName(companyName);
                    } catch (Exception e) {
                        log.warn("기본 정보 크롤링 실패: {} - {}", companyName, e.getMessage());
                        return createFallbackProduct(companyName);
                    }
                });
            
            CompletableFuture<String> logoFuture = 
                CompletableFuture.supplyAsync(() -> {
                    return "";
                });
            
            // 결과 통합
            InsuranceProductDto basicInfo = basicInfoFuture.get();
            String logoUrl = logoFuture.get();
            
            // basicInfo가 null인 경우 처리
            if (basicInfo == null) {
                log.warn("{} 기본 정보 크롤링 실패 - 폴백 데이터 사용", companyName);
                return createFallbackProduct(companyName);
            }
            
            // 로고 URL 설정
            basicInfo.setLogoUrl(logoUrl);
            
            return basicInfo;
            
        } catch (Exception e) {
            log.error("메인 페이지 크롤링 실패: {} - {}", companyName, e.getMessage());
            return createFallbackProduct(companyName);
        }
    }
    
    /**
     * 모든 정보 통합
     */
    private InsuranceProductDto integrateAllInformation(
            InsuranceProductDto basicInfo,
            InsuranceProductDto coverageInfo, 
            DetailedInfoCrawler.DetailedInsuranceInfo detailedInfo,
            String logoUrl) {
        
        // 가장 완전한 정보를 기반으로 통합
        String finalProductName = getBestValue(
            basicInfo.getProductName(), 
            coverageInfo.getProductName()
        );
        
        String finalDescription = getBestValue(
            coverageInfo.getDescription(),
            basicInfo.getDescription()
        );
        
        // 특징들 통합 (중복 제거)
        List<String> allFeatures = new ArrayList<>();
        if (basicInfo.getFeatures() != null) allFeatures.addAll(basicInfo.getFeatures());
        if (coverageInfo.getFeatures() != null) allFeatures.addAll(coverageInfo.getFeatures());
        if (detailedInfo.getDetailedBenefits() != null) allFeatures.addAll(detailedInfo.getDetailedBenefits());
        
        List<String> uniqueFeatures = allFeatures.stream()
                .distinct()
                .limit(8)
                .toList();
        
        return InsuranceProductDto.builder()
                .company(basicInfo.getCompany())
                .productName(finalProductName)
                .description(finalDescription)
                .features(uniqueFeatures)
                .logoUrl(logoUrl)
                .redirectUrl(basicInfo.getRedirectUrl())
                .build();
    }
    
    /**
     * 더 나은 값 선택 (길이와 내용 기준)
     */
    private String getBestValue(String value1, String value2) {
        if (value1 == null || value1.isBlank()) return value2;
        if (value2 == null || value2.isBlank()) return value1;
        
        // 더 구체적이고 긴 값 선택
        if (value2.length() > value1.length() && value2.length() <= value1.length() * 2) {
            return value2;
        }
        
        return value1;
    }
    
    /**
     * 폴백 상품 생성
     */
    private InsuranceProductDto createFallbackProduct(String companyName) {
        String productName = getFallbackProductName(companyName);
        return InsuranceProductDto.builder()
                .company(companyName)
                .productName(productName)
                .description(productName + " - 반려동물을 위한 보험 상품")
                .features(getFallbackFeatures(companyName))
                .logoUrl("/placeholder-logo.png")
                .redirectUrl(COMPANY_URLS.getOrDefault(companyName, ""))
                .build();
    }
    
    private String getFallbackProductName(String companyName) {
        return switch (companyName) {
            case "삼성화재" -> "삼성화재 다이렉트 펫보험";
            case "NH농협손해보험" -> "NH농협 펫앤미든든보험";
            case "KB손해보험" -> "KB 금쪽같은 펫보험";
            case "현대해상" -> "현대해상 펫보험";
            case "메리츠화재" -> "메리츠화재 펫보험";
            case "DB손해보험" -> "DB손해보험 펫보험";
            default -> companyName + " 펫보험";
        };
    }
    
    private List<String> getFallbackFeatures(String companyName) {
        return List.of(
            "질병/상해 치료비 보장",
            "응급진료비 보장",
            "간편 온라인 가입"
        );
    }
    
    /**
     * 수동 실행 메서드 (API에서 호출)
     */
    public void runMainPageCrawling() {
        List<InsuranceProductDto> results = crawlForMainPage();
        
        // 실제 크롤링 성공한 것만 필터링
        List<InsuranceProductDto> successfulResults = results.stream()
            .filter(product -> isActuallyCrawled(product))
            .collect(Collectors.toList());
        
        List<InsuranceProductDto> failedResults = results.stream()
            .filter(product -> !isActuallyCrawled(product))
            .collect(Collectors.toList());
        
        // 성공한 결과만 저장
        if (!successfulResults.isEmpty()) {
            try {
                insuranceService.upsertAll(successfulResults);
        
            } catch (Exception e) {
                log.error("크롤링 결과 저장 실패: {}", e.getMessage());
            }
        }
        
        // 실패한 결과 로깅
        if (!failedResults.isEmpty()) {
            log.warn("크롤링 실패한 보험사: {}", 
                failedResults.stream()
                    .map(InsuranceProductDto::getCompany)
                    .collect(Collectors.joining(", "))
            );
        }
        
        
    }
    
    /**
     * 실제로 크롤링이 성공했는지 확인
     */
    private boolean isActuallyCrawled(InsuranceProductDto product) {
        // 기본값과 실제 크롤링 결과를 구분하는 로직
        String productName = product.getProductName();
        String description = product.getDescription();
        
        // 매우 기본적인 기본값만 체크 (더 관대하게)
        boolean isDefaultName = productName.equals(product.getCompany() + " 펫보험") ||
                               productName.equals("알 수 없는 펫보험") ||
                               productName.equals("기본 펫보험");
        
        boolean isDefaultDescription = description.contains("기본적인 치료비를 보장") ||
                                      description.contains("알 수 없는") ||
                                      description.length() < 20;
        
        // 로고가 기본 생성된 것인지 체크
        boolean isDefaultLogo = product.getLogoUrl().contains("/api/logos/generated") ||
                               product.getLogoUrl().contains("/placeholder-logo.png");
        
        // 실제 크롤링 성공 여부 - 설명이 충분히 상세하면 성공으로 간주
        boolean hasDetailedDescription = description.length() >= 30;
        boolean hasFeatures = product.getFeatures() != null && !product.getFeatures().isEmpty();
        
        // 하나라도 실제 크롤링된 내용이 있으면 성공으로 간주
        return !isDefaultName || hasDetailedDescription || hasFeatures || !isDefaultLogo;
    }
    
    /**
     * 스케줄된 크롤링 (매일 새벽 2시)
     */
    @Scheduled(cron = "0 0 2 * * *", zone = "Asia/Seoul")
    public void scheduledCrawling() {
        runMainPageCrawling();
    }
    
    /**
     * 크롤링 상태 체크
     */
    public CrawlingStatus getCrawlingStatus() {
        int supportedCompanies = SUPPORTED_COMPANIES.length;
        int successfulCrawls = 0;
        List<String> failedCompanies = new ArrayList<>();
        
        for (String company : SUPPORTED_COMPANIES) {
            try {
                // 간단한 연결 테스트
                String url = COMPANY_URLS.get(company);
                if (url != null && isUrlAccessible(url)) {
                    successfulCrawls++;
                } else {
                    failedCompanies.add(company);
                }
            } catch (Exception e) {
                failedCompanies.add(company);
            }
        }
        
        return CrawlingStatus.builder()
                .totalCompanies(supportedCompanies)
                .successfulCrawls(successfulCrawls)
                .failedCompanies(failedCompanies)
                .lastCrawlTime(LocalDateTime.now())
                .build();
    }
    
    /**
     * URL 접근 가능 여부 확인
     */
    private boolean isUrlAccessible(String url) {
        try {
            java.net.URL urlObj = new java.net.URL(url);
            java.net.HttpURLConnection connection = (java.net.HttpURLConnection) urlObj.openConnection();
            connection.setRequestMethod("HEAD");
            connection.setConnectTimeout(5000);
            connection.setReadTimeout(5000);
            int responseCode = connection.getResponseCode();
            return responseCode >= 200 && responseCode < 400;
        } catch (Exception e) {
            return false;
        }
    }
    
    /**
     * 크롤링 상태 정보 클래스
     */
    @lombok.Builder
    @lombok.Data
    public static class CrawlingStatus {
        private int totalCompanies;
        private int successfulCrawls;
        private List<String> failedCompanies;
        private LocalDateTime lastCrawlTime;
        private String status;
        
        public String getStatus() {
            if (successfulCrawls == totalCompanies) {
                return "모든 보험사 크롤링 성공";
            } else if (successfulCrawls > 0) {
                return String.format("부분 성공: %d/%d", successfulCrawls, totalCompanies);
            } else {
                return "모든 크롤링 실패";
            }
        }
    }
}