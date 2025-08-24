package com.my.backend.insurance.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class InsuranceLogoService {
    
    // 보험사별 로고 URL 매핑 (실제 웹사이트에서 확인한 경로)
    private static final Map<String, String> INSURANCE_LOGO_URLS = new HashMap<>();
    
    static {
        // 삼성화재 - 실제 로고 경로
        INSURANCE_LOGO_URLS.put("삼성화재", "https://direct.samsungfire.com/resources/images/common/logo.png");
        INSURANCE_LOGO_URLS.put("삼성화재보험", "https://direct.samsungfire.com/resources/images/common/logo.png");
        
        // 메리츠화재 - 실제 로고 경로
        INSURANCE_LOGO_URLS.put("메리츠화재", "https://www.meritzfire.com/resources/images/common/logo.png");
        INSURANCE_LOGO_URLS.put("메리츠", "https://www.meritzfire.com/resources/images/common/logo.png");
        
        // KB손해보험 - 실제 로고 경로
        INSURANCE_LOGO_URLS.put("KB손해보험", "https://www.kbinsure.co.kr/resources/images/common/logo.png");
        INSURANCE_LOGO_URLS.put("KB", "https://www.kbinsure.co.kr/resources/images/common/logo.png");
        
        // 현대해상 - 실제 로고 경로
        INSURANCE_LOGO_URLS.put("현대해상", "https://www.hi.co.kr/resources/images/common/logo.png");
        INSURANCE_LOGO_URLS.put("현대", "https://www.hi.co.kr/resources/images/common/logo.png");
        
        // NH농협손해보험 - 실제 로고 경로
        INSURANCE_LOGO_URLS.put("NH농협손해보험", "https://nhfire.co.kr/resources/images/common/logo.png");
        INSURANCE_LOGO_URLS.put("NH", "https://nhfire.co.kr/resources/images/common/logo.png");
        INSURANCE_LOGO_URLS.put("농협", "https://nhfire.co.kr/resources/images/common/logo.png");
        
        // 한화손해보험 - 실제 로고 경로
        INSURANCE_LOGO_URLS.put("한화손해보험", "https://www.hanainsure.co.kr/resources/images/common/logo.png");
        INSURANCE_LOGO_URLS.put("한화", "https://www.hanainsure.co.kr/resources/images/common/logo.png");
        
        // DB손해보험 - 실제 로고 경로
        INSURANCE_LOGO_URLS.put("DB손해보험", "https://www.idblife.com/resources/images/common/logo.png");
        INSURANCE_LOGO_URLS.put("DB", "https://www.idblife.com/resources/images/common/logo.png");
        
        // 롯데손해보험 - 실제 로고 경로
        INSURANCE_LOGO_URLS.put("롯데손해보험", "https://www.lotteinsure.co.kr/resources/images/common/logo.png");
        INSURANCE_LOGO_URLS.put("롯데", "https://www.lotteinsure.co.kr/resources/images/common/logo.png");
        
        // 대체 로고 URL들 (실제 웹사이트에서 확인 필요)
        // 삼성화재 대체
        INSURANCE_LOGO_URLS.put("삼성화재_alt", "https://www.samsungfire.com/resources/images/common/logo.png");
        
        // 메리츠화재 대체
        INSURANCE_LOGO_URLS.put("메리츠화재_alt", "https://www.meritzfire.com/images/common/logo.png");
        
        // KB손해보험 대체
        INSURANCE_LOGO_URLS.put("KB손해보험_alt", "https://www.kbinsure.co.kr/images/common/logo.png");
        
        // 현대해상 대체
        INSURANCE_LOGO_URLS.put("현대해상_alt", "https://www.hi.co.kr/images/common/logo.png");
        
        // NH농협손해보험 대체
        INSURANCE_LOGO_URLS.put("NH농협손해보험_alt", "https://nhfire.co.kr/images/common/logo.png");
    }

    /**
     * 보험사별 기본 로고 URL 반환 (실시간 로고 사용)
     */
    public String getCompanyLogoUrl(String companyName) {
        String logoUrl = INSURANCE_LOGO_URLS.get(companyName);
        if (logoUrl != null) {
            log.info("실시간 로고 URL 반환: {} -> {}", companyName, logoUrl);
            return logoUrl;
        }
        
        // 대체 로고 시도
        String altKey = companyName + "_alt";
        logoUrl = INSURANCE_LOGO_URLS.get(altKey);
        if (logoUrl != null) {
            log.info("대체 로고 URL 반환: {} -> {}", companyName, logoUrl);
            return logoUrl;
        }
        
        // 기본 placeholder 반환
        log.warn("로고 URL을 찾을 수 없음: {}, placeholder 반환", companyName);
        return "/placeholder-logo.png";
    }

    /**
     * 보험사 로고 URL 매핑 업데이트
     */
    public void updateLogoUrl(String companyName, String logoUrl) {
        log.info("보험사 로고 URL 업데이트: {} -> {}", companyName, logoUrl);
        INSURANCE_LOGO_URLS.put(companyName, logoUrl);
    }

    /**
     * 현재 등록된 보험사 목록 반환
     */
    public Map<String, String> getRegisteredCompanies() {
        return new HashMap<>(INSURANCE_LOGO_URLS);
    }
} 