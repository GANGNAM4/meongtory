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
            } else {
                throw new Exception("NanumGothic 폰트 파일을 찾을 수 없음");
            }
        } catch (Exception e) {
            try {
                // 기본 한글 폰트 시도
                koreanFont = PdfFontFactory.createFont("STSong-Light", "UniGB-UCS2-H");
            } catch (Exception e2) {
                try {
                    // 대체 한글 폰트 시도
                    koreanFont = PdfFontFactory.createFont("HeiseiMin-W3", "UniCNS-UCS2-H");
                } catch (Exception e3) {
                    // 기본 폰트 사용
                    koreanFont = PdfFontFactory.createFont();
                }
            }
        }
        
        // 펫 이름 추출하여 제목 생성
        String petName = extractPetName(content);
        String title = petName + " 입양 계약서";
        
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
        

        
        document.close();
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
                        return word;
                    }
                }
            }
        }
        
        // 기본값 반환
        return "반려동물";
    }
    
    // 파일명 생성 메서드
    public String generateFilename(String content) {
        String petName = extractPetName(content);
        String today = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        String filename = petName + "_" + today + ".pdf";
        return filename;
    }
}