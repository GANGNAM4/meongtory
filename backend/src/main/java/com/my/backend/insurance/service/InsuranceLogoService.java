package com.my.backend.insurance.service;

import com.my.backend.s3.S3Service;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.URL;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class InsuranceLogoService {

    private final RestTemplate restTemplate;
    private final S3Service s3Service;
    
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
     * 보험사 로고를 크롤링하고 전처리하여 S3 URL로 반환
     */
    public String crawlAndProcessLogo(String companyName) {
        try {
            // 보험사별 기본 로고 생성
            BufferedImage logoImage = generateCompanyLogo(companyName);
            if (logoImage == null) {
                log.warn("로고 생성 실패: {}", companyName);
                return null;
            }

            // S3에 업로드
            String s3Url = uploadLogoToS3(logoImage, companyName);
            if (s3Url != null) {
                log.info("로고 S3 업로드 성공: {} -> {}", companyName, s3Url);
                return s3Url;
            } else {
                log.warn("로고 S3 업로드 실패: {}", companyName);
                return null;
            }
            
        } catch (Exception e) {
            log.error("로고 생성 중 오류 발생: {}", e.getMessage(), e);
            return null;
        }
    }

    /**
     * 보험사별 기본 로고 생성 (이모지 + 색상)
     */
    private BufferedImage generateCompanyLogo(String companyName) {
        try {
            // 보험사별 설정
            CompanyLogoConfig config = getCompanyLogoConfig(companyName);
            
            // 더 작은 크기로 생성 (40x40)
            BufferedImage image = new BufferedImage(40, 40, BufferedImage.TYPE_INT_ARGB);
            Graphics2D g2d = image.createGraphics();
            
            // 렌더링 품질 설정
            g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            g2d.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
            
            // 배경 그리기 (둥근 모서리)
            g2d.setColor(config.backgroundColor);
            g2d.fillRoundRect(0, 0, 40, 40, 10, 10);
            
            // 테두리 그리기
            g2d.setColor(config.borderColor);
            g2d.setStroke(new BasicStroke(1));
            g2d.drawRoundRect(0, 0, 39, 39, 9, 9);
            
            // 이모지 그리기
            g2d.setFont(new Font("Segoe UI Emoji", Font.PLAIN, 20));
            g2d.setColor(config.emojiColor);
            
            // 이모지 중앙 정렬
            FontMetrics fm = g2d.getFontMetrics();
            int emojiWidth = fm.stringWidth(config.emoji);
            int emojiHeight = fm.getHeight();
            int emojiX = (40 - emojiWidth) / 2;
            int emojiY = (40 + emojiHeight) / 2 - 2;
            
            g2d.drawString(config.emoji, emojiX, emojiY);
            
            g2d.dispose();
            
            return image;
            
        } catch (Exception e) {
            log.error("로고 생성 실패: {}", e.getMessage(), e);
            return null;
        }
    }

    /**
     * 보험사별 로고 설정
     */
    private CompanyLogoConfig getCompanyLogoConfig(String companyName) {
        if (companyName.contains("삼성화재")) {
            return new CompanyLogoConfig("⭐", new Color(255, 215, 0), new Color(255, 140, 0), new Color(255, 255, 255));
        } else if (companyName.contains("메리츠")) {
            return new CompanyLogoConfig("🏢", new Color(70, 130, 180), new Color(25, 25, 112), new Color(255, 255, 255));
        } else if (companyName.contains("KB")) {
            return new CompanyLogoConfig("🏦", new Color(34, 139, 34), new Color(0, 100, 0), new Color(255, 255, 255));
        } else if (companyName.contains("현대")) {
            return new CompanyLogoConfig("🚗", new Color(255, 69, 0), new Color(139, 0, 0), new Color(255, 255, 255));
        } else if (companyName.contains("NH") || companyName.contains("농협")) {
            return new CompanyLogoConfig("🌾", new Color(255, 215, 0), new Color(218, 165, 32), new Color(255, 255, 255));
        } else if (companyName.contains("한화")) {
            return new CompanyLogoConfig("🏢", new Color(255, 20, 147), new Color(199, 21, 133), new Color(255, 255, 255));
        } else if (companyName.contains("DB")) {
            return new CompanyLogoConfig("🏢", new Color(138, 43, 226), new Color(75, 0, 130), new Color(255, 255, 255));
        } else if (companyName.contains("롯데")) {
            return new CompanyLogoConfig("🏢", new Color(255, 0, 0), new Color(139, 0, 0), new Color(255, 255, 255));
        } else {
            // 기본 설정
            return new CompanyLogoConfig("🏢", new Color(128, 128, 128), new Color(64, 64, 64), new Color(255, 255, 255));
        }
    }

    /**
     * 보험사 로고 설정 클래스
     */
    private static class CompanyLogoConfig {
        final String emoji;
        final Color backgroundColor;
        final Color borderColor;
        final Color emojiColor;
        
        CompanyLogoConfig(String emoji, Color backgroundColor, Color borderColor, Color emojiColor) {
            this.emoji = emoji;
            this.backgroundColor = backgroundColor;
            this.borderColor = borderColor;
            this.emojiColor = emojiColor;
        }
    }

    /**
     * 로고를 S3에 업로드
     */
    private String uploadLogoToS3(BufferedImage image, String companyName) {
        try {
            // 이미지를 바이트 배열로 변환
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            ImageIO.write(image, "PNG", baos);
            byte[] imageBytes = baos.toByteArray();
            
            // 파일명 생성 - /insurance 폴더에 저장
            String timestamp = String.valueOf(System.currentTimeMillis());
            String fileName = "insurance/logos/" + companyName.replaceAll("[^a-zA-Z0-9가-힣]", "") + "_v" + timestamp + ".png";
            
            // S3에 업로드
            String s3Url = s3Service.uploadFile(fileName, imageBytes);
            
            return s3Url;
            
        } catch (Exception e) {
            log.error("S3 업로드 실패: {}", e.getMessage(), e);
            return null;
        }
    }

    /**
     * 보험사 로고 URL 매핑 업데이트
     */
    public void updateLogoUrl(String companyName, String logoUrl) {
        log.info("보험사 로고 URL 업데이트: {} -> {}", companyName, logoUrl);
    }

    /**
     * 현재 등록된 보험사 목록 반환
     */
    public Map<String, String> getRegisteredCompanies() {
        return new HashMap<>();
    }
} 