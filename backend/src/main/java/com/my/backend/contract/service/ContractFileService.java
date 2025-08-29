package com.my.backend.contract.service;

import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

// iText imports for Korean PDF support
import com.itextpdf.kernel.pdf.PdfDocument;
import com.itextpdf.kernel.pdf.PdfWriter;
import com.itextpdf.layout.Document;
import com.itextpdf.layout.element.Paragraph;
import com.itextpdf.io.font.constants.StandardFonts;
import com.itextpdf.kernel.font.PdfFont;
import com.itextpdf.kernel.font.PdfFontFactory;
import com.itextpdf.layout.element.Table;
import com.itextpdf.layout.element.Cell;
import com.itextpdf.kernel.colors.ColorConstants;
import com.itextpdf.layout.borders.SolidBorder;



@Service
public class ContractFileService {
    
    public byte[] generatePDF(String content) throws IOException {
        System.out.println("=== PDF 생성 시작 ===");
        System.out.println("입력된 content 길이: " + (content != null ? content.length() : 0));
        
        // iText를 사용한 한글 PDF 생성
        try {
            return generateKoreanPDF(content);
        } catch (Exception e) {
            System.err.println("PDF 생성 실패: " + e.getMessage());
            e.printStackTrace();
            throw new IOException("PDF 생성에 실패했습니다: " + e.getMessage(), e);
        }
    }
    
    // iText를 사용한 한글 PDF 생성 (개선된 버전)
    private byte[] generateKoreanPDF(String content) throws IOException {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        PdfWriter writer = new PdfWriter(baos);
        PdfDocument pdf = new PdfDocument(writer);
        Document document = new Document(pdf);
        
        // 한글 폰트 설정 (프로젝트에 포함된 NanumGothic 폰트 사용)
        PdfFont koreanFont = null;
        try {
            // 클래스패스에서 NanumGothic 폰트 로드
            java.io.InputStream fontStream = getClass().getResourceAsStream("/fonts/NanumGothic.ttf");
            if (fontStream != null) {
                byte[] fontBytes = fontStream.readAllBytes();
                koreanFont = PdfFontFactory.createFont(fontBytes, "Identity-H");
                System.out.println("NanumGothic 폰트 로드 성공");
            } else {
                throw new Exception("NanumGothic 폰트 파일을 찾을 수 없음");
            }
        } catch (Exception e) {
            try {
                // 기본 한글 폰트 시도
                koreanFont = PdfFontFactory.createFont("STSong-Light", "UniGB-UCS2-H");
                System.out.println("STSong-Light 폰트 로드 성공");
            } catch (Exception e2) {
                try {
                    // 대체 한글 폰트 시도
                    koreanFont = PdfFontFactory.createFont("HeiseiMin-W3", "UniCNS-UCS2-H");
                    System.out.println("HeiseiMin-W3 폰트 로드 성공");
                } catch (Exception e3) {
                    // 기본 폰트 사용
                    koreanFont = PdfFontFactory.createFont();
                    System.out.println("한글 폰트 로드 실패, 기본 폰트 사용");
                }
            }
        }
        
        // 펫 이름 추출하여 제목 생성
        String petName = extractPetName(content);
        String title = petName + " 입양 계약서";
        System.out.println("생성된 제목: " + title);
        
        // 현재 날짜
        String currentDate = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy년 MM월 dd일"));
        
        // 제목 추가 (더 큰 폰트)
        Paragraph titleParagraph = new Paragraph(title)
            .setFont(koreanFont)
            .setFontSize(24)
            .setBold()
            .setMarginBottom(20);
        document.add(titleParagraph);
        
        // 날짜 추가
        Paragraph dateParagraph = new Paragraph("작성일: " + currentDate)
            .setFont(koreanFont)
            .setFontSize(12)
            .setMarginBottom(30);
        document.add(dateParagraph);
        
        // 내용을 테이블 형태로 구성
        if (content != null && !content.trim().isEmpty()) {
            String[] lines = content.split("\n");
            System.out.println("총 라인 수: " + lines.length);
            
            // 테이블 생성
            Table table = new Table(2).useAllAvailableWidth();
            table.setMarginTop(20);
            
            for (String line : lines) {
                if (!line.trim().isEmpty()) {
                    // 라인에서 키-값 분리 시도
                    String[] parts = line.split(":", 2);
                    if (parts.length == 2) {
                        // 키-값 형태인 경우
                        Cell keyCell = new Cell()
                            .add(new Paragraph(parts[0].trim() + ":"))
                            .setFont(koreanFont)
                            .setFontSize(12)
                            .setBold()
                            .setBorder(new SolidBorder(ColorConstants.LIGHT_GRAY, 1))
                            .setPadding(8);
                        
                        Cell valueCell = new Cell()
                            .add(new Paragraph(parts[1].trim()))
                            .setFont(koreanFont)
                            .setFontSize(12)
                            .setBorder(new SolidBorder(ColorConstants.LIGHT_GRAY, 1))
                            .setPadding(8);
                        
                        table.addCell(keyCell);
                        table.addCell(valueCell);
                    } else {
                        // 일반 텍스트인 경우
                        Cell fullCell = new Cell(1, 2)
                            .add(new Paragraph(line.trim()))
                            .setFont(koreanFont)
                            .setFontSize(12)
                            .setBorder(new SolidBorder(ColorConstants.LIGHT_GRAY, 1))
                            .setPadding(8);
                        
                        table.addCell(fullCell);
                    }
                }
            }
            
            document.add(table);
        }
        
        // 서명 섹션 추가
        document.add(new Paragraph("").setMarginTop(40));
        
        Paragraph signatureTitle = new Paragraph("서명")
            .setFont(koreanFont)
            .setFontSize(16)
            .setBold()
            .setMarginBottom(20);
        document.add(signatureTitle);
        
        // 서명 테이블
        Table signatureTable = new Table(2).useAllAvailableWidth();
        signatureTable.setMarginTop(20);
        
        Cell adopterCell = new Cell()
            .add(new Paragraph("입양자 서명: _________________"))
            .setFont(koreanFont)
            .setFontSize(12)
            .setBorder(new SolidBorder(ColorConstants.BLACK, 1))
            .setPadding(20);
        
        Cell shelterCell = new Cell()
            .add(new Paragraph("보호소 서명: _________________"))
            .setFont(koreanFont)
            .setFontSize(12)
            .setBorder(new SolidBorder(ColorConstants.BLACK, 1))
            .setPadding(20);
        
        signatureTable.addCell(adopterCell);
        signatureTable.addCell(shelterCell);
        
        document.add(signatureTable);
        
        document.close();
        System.out.println("=== iText PDF 생성 완료 ===");
        return baos.toByteArray();
    }
    

    

    

    
    // 계약서 내용에서 펫 이름 추출 (개선된 버전)
    private String extractPetName(String content) {
        if (content == null || content.trim().isEmpty()) {
            return "반려동물";
        }
        
        // 다양한 패턴으로 펫 이름 찾기
        String[] patterns = {
            "이름:\\s*([가-힣a-zA-Z]+)",
            "Name:\\s*([가-힣a-zA-Z]+)",
            "펫이름:\\s*([가-힣a-zA-Z]+)",
            "Pet Name:\\s*([가-힣a-zA-Z]+)",
            "강아지이름:\\s*([가-힣a-zA-Z]+)",
            "고양이이름:\\s*([가-힣a-zA-Z]+)"
        };
        
        for (String pattern : patterns) {
            java.util.regex.Pattern p = java.util.regex.Pattern.compile(pattern);
            java.util.regex.Matcher m = p.matcher(content);
            if (m.find()) {
                String petName = m.group(1).trim();
                if (!petName.isEmpty()) {
                    System.out.println("펫 이름 추출 성공: " + petName);
                    return petName;
                }
            }
        }
        
        // "이름" 패턴으로 찾기
        String[] lines = content.split("\n");
        for (String line : lines) {
            if (line.contains("이름")) {
                // 한글 이름 패턴 찾기 (2-4글자 한글 이름)
                String[] words = line.split("\\s+");
                for (String word : words) {
                    if (word.matches("[가-힣]{2,4}") && !word.equals("이름")) {
                        System.out.println("펫 이름 추출 성공: " + word);
                        return word;
                    }
                }
            }
        }
        
        // 기본값 반환
        System.out.println("펫 이름 추출 실패, 기본값 사용: 반려동물");
        return "반려동물";
    }
}