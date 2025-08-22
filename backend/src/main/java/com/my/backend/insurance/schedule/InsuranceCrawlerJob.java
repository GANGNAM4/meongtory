package com.my.backend.insurance.schedule;

import com.my.backend.insurance.dto.InsuranceProductDto;
import com.my.backend.insurance.service.InsuranceService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class InsuranceCrawlerJob {

    private final InsuranceService insuranceService;

    private List<InsuranceProductDto> crawlNhFire() {
        List<InsuranceProductDto> list = new ArrayList<>();
        try {
            Document doc = Jsoup.connect("https://nhfire.co.kr/")
                    .userAgent("Mozilla/5.0")
                    .timeout(10000)
                    .get();

            // 안전 범위의 간단 요약만 등록 (사이트 구조 변경 시 보완)
            list.add(InsuranceProductDto.builder()
                    .company("NH농협손해보험")
                    .productName("다이렉트 펫앤미든든보험(강아지/고양이)")
                    .description("반려동물 치료비 보장(요약)")
                    .features(List.of("질병/상해 치료비", "응급비용", "간편 접수"))
                    .logoUrl("")
                    .redirectUrl("https://nhfire.co.kr/")
                    .build());

        } catch (IOException e) {
            log.warn("NH농협 페이지 접근 실패: {}", e.getMessage());
        }
        return list;
    }

    private List<InsuranceProductDto> crawlSamsungFire() {
        List<InsuranceProductDto> list = new ArrayList<>();
        try {
            Document doc = Jsoup.connect("https://direct.samsungfire.co.kr/m/?mode=normalMode")
                    .userAgent("Mozilla/5.0")
                    .timeout(10000)
                    .get();
            list.add(InsuranceProductDto.builder()
                    .company("삼성화재")
                    .productName("삼성화재 다이렉트 펫보험")
                    .description("반려동물 치료비 보장(요약)")
                    .features(List.of("질병/상해 치료비", "응급비용", "간편 접수"))
                    .logoUrl("")
                    .redirectUrl("https://direct.samsungfire.co.kr/m/?mode=normalMode")
                    .build());
        } catch (IOException e) {
            log.warn("삼성화재 페이지 접근 실패: {}", e.getMessage());
        }
        return list;
    }

    private List<InsuranceProductDto> crawlHyundaiHi() {
        List<InsuranceProductDto> list = new ArrayList<>();
        try {
            Document doc = Jsoup.connect("https://www.hi.co.kr/serviceAction.do")
                    .userAgent("Mozilla/5.0")
                    .timeout(10000)
                    .get();
            list.add(InsuranceProductDto.builder()
                    .company("현대해상")
                    .productName("현대해상 펫보험")
                    .description("반려동물 치료비 보장(요약)")
                    .features(List.of("질병/상해 치료비", "응급비용", "간편 접수"))
                    .logoUrl("")
                    .redirectUrl("https://www.hi.co.kr/serviceAction.do")
                    .build());
        } catch (IOException e) {
            log.warn("현대해상 페이지 접근 실패: {}", e.getMessage());
        }
        return list;
    }

    private List<InsuranceProductDto> crawlDbInsurance() {
        List<InsuranceProductDto> list = new ArrayList<>();
        try {
            Document doc = Jsoup.connect("https://www.dbins.co.kr/")
                    .userAgent("Mozilla/5.0")
                    .timeout(10000)
                    .get();
            list.add(InsuranceProductDto.builder()
                    .company("DB손해보험")
                    .productName("DB손해보험 펫보험")
                    .description("반려동물 치료비 보장(요약)")
                    .features(List.of("질병/상해 치료비", "응급비용", "간편 접수"))
                    .logoUrl("")
                    .redirectUrl("https://www.dbins.co.kr/")
                    .build());
        } catch (IOException e) {
            log.warn("DB손해보험 페이지 접근 실패: {}", e.getMessage());
        }
        return list;
    }

    private List<InsuranceProductDto> crawlKbInsurance() {
        List<InsuranceProductDto> list = new ArrayList<>();
        try {
            Document doc = Jsoup.connect("https://www.kbinsure.co.kr/main.ec")
                    .userAgent("Mozilla/5.0")
                    .timeout(10000)
                    .get();
            list.add(InsuranceProductDto.builder()
                    .company("KB손해보험")
                    .productName("KB손해보험 펫보험")
                    .description("반려동물 치료비 보장(요약)")
                    .features(List.of("질병/상해 치료비", "응급비용", "간편 접수"))
                    .logoUrl("")
                    .redirectUrl("https://www.kbinsure.co.kr/main.ec")
                    .build());
        } catch (IOException e) {
            log.warn("KB손해보험 페이지 접근 실패: {}", e.getMessage());
        }
        return list;
    }

    private List<InsuranceProductDto> crawlMeritz() {
        List<InsuranceProductDto> list = new ArrayList<>();
        try {
            Document doc = Jsoup.connect("https://www.meritzfire.com/")
                    .userAgent("Mozilla/5.0")
                    .timeout(10000)
                    .get();
            list.add(InsuranceProductDto.builder()
                    .company("메리츠화재")
                    .productName("메리츠 펫보험")
                    .description("반려동물 치료비 보장(요약)")
                    .features(List.of("질병/상해 치료비", "응급비용", "간편 접수"))
                    .logoUrl("")
                    .redirectUrl("https://www.meritzfire.com/")
                    .build());
        } catch (IOException e) {
            log.warn("메리츠 페이지 접근 실패: {}", e.getMessage());
        }
        return list;
    }

    @Scheduled(cron = "0 0 2 * * *", zone = "Asia/Seoul")
    public void runDaily() {
        log.info("[InsuranceCrawlerJob] start");
        List<InsuranceProductDto> items = new ArrayList<>();
        items.addAll(crawlNhFire());
        items.addAll(crawlSamsungFire());
        items.addAll(crawlHyundaiHi());
        items.addAll(crawlDbInsurance());
        items.addAll(crawlKbInsurance());
        items.addAll(crawlMeritz());

        for (InsuranceProductDto dto : items) {
            try {
                insuranceService.create(dto);
            } catch (Exception e) {
                log.warn("item 저장 실패: {}", e.getMessage());
            }
        }
        log.info("[InsuranceCrawlerJob] done: {} items", items.size());
    }
}

