package com.my.backend.s3;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import java.util.UUID;
import java.io.IOException;
import com.my.backend.contract.service.ContractFileService;

@Service
@Slf4j
public class S3Service {

    private final S3Client s3Client;
    private final ContractFileService contractFileService;

    @Value("${aws.s3.bucket.name:}")
    private String bucketName;

    @Value("${aws.s3.region:}")
    private String region;

    public S3Service(S3Client s3Client, ContractFileService contractFileService) {
        this.s3Client = s3Client;
        this.contractFileService = contractFileService;
        if (s3Client == null) {
            log.warn("S3Client is null - S3 functionality will be disabled");
            log.warn("AWS credentials not configured - using mock URLs");
        } else {
            log.info("S3Service initialized with bucket: {}", bucketName);
            log.info("AWS S3 client is available for file uploads");
        }
    }

    // S3 파일 업로드 메서드 (기존 호환성용)
    public String uploadFile(String originalFileName, byte[] fileData) {
        try {
            if (s3Client == null) {
                log.warn("S3Client is null - returning mock URL");
                String uuidFileName = generateFileName(originalFileName);
                return "https://mock-s3-bucket.s3.amazonaws.com/" + uuidFileName;
            }

            String uuidFileName = generateFileName(originalFileName);
            log.info("Uploading file: {} (UUID: {}) to S3 bucket: {}", originalFileName, uuidFileName, bucketName);

            PutObjectRequest putObjectRequest = PutObjectRequest.builder()
                    .bucket(bucketName)
                    .key(uuidFileName)
                    .contentType("image/jpeg")
                    .build();

            s3Client.putObject(putObjectRequest, RequestBody.fromBytes(fileData));

            String s3Url = "https://" + bucketName + ".s3." + region + ".amazonaws.com/" + uuidFileName;
            log.info("S3 업로드 성공: {}", s3Url);
            return s3Url;
        } catch (Exception e) {
            log.error("Failed to upload file to S3: {}", e.getMessage());
            throw new RuntimeException("S3 upload failed", e);
        }
    }

    // MultipartFile 업로드 메서드
    public String uploadFile(MultipartFile file) {
        try {
            if (s3Client == null) {
                log.warn("S3Client is null - returning mock URL");
                String uuidFileName = generateFileName(file.getOriginalFilename());
                return "https://mock-s3-bucket.s3.amazonaws.com/" + uuidFileName;
            }

            String originalFileName = file.getOriginalFilename();
            byte[] fileData = file.getBytes();

            String uuidFileName = generateFileName(originalFileName);
            log.info("Uploading file: {} (UUID: {}) to S3 bucket: {}", originalFileName, uuidFileName, bucketName);

            PutObjectRequest putObjectRequest = PutObjectRequest.builder()
                    .bucket(bucketName)
                    .key(uuidFileName)
                    .contentType(file.getContentType())
                    .build();

            s3Client.putObject(putObjectRequest, RequestBody.fromBytes(fileData));

            String s3Url = "https://" + bucketName + ".s3." + region + ".amazonaws.com/" + uuidFileName;
            log.info("S3 업로드 성공: {}", s3Url);
            return s3Url;
        } catch (Exception e) {
            log.error("Failed to upload file to S3: {}", e.getMessage());
            throw new RuntimeException("S3 upload failed", e);
        }
    }

    // S3 파일 업로드 메서드 (일기용)
    public String uploadDiaryImage(String originalFileName, byte[] fileData) {
        try {
            if (s3Client == null) {
                log.warn("S3Client is null - returning mock URL");
                String mockFileName = generateDiaryFileName(originalFileName);
                return "https://mock-s3-bucket.s3.amazonaws.com/" + mockFileName;
            }

            String fileName = generateDiaryFileName(originalFileName);
            log.info("Uploading diary image: {} to S3 bucket: {}", fileName, bucketName);

            PutObjectRequest putObjectRequest = PutObjectRequest.builder()
                    .bucket(bucketName)
                    .key(fileName)
                    .contentType("image/jpeg")
                    .build();

            s3Client.putObject(putObjectRequest, RequestBody.fromBytes(fileData));

            String s3Url = "https://" + bucketName + ".s3." + region + ".amazonaws.com/" + fileName;
            log.info("Diary image uploaded successfully: {}", s3Url);
            return s3Url;
        } catch (Exception e) {
            log.error("Failed to upload diary image to S3: {}", e.getMessage());
            throw new RuntimeException("S3 upload failed", e);
        }
    }

    // Base64 이미지 업로드 메서드 (일기용)
    public String uploadDiaryBase64Image(String base64Image, String originalFileName) {
        try {
            log.info("=== S3 Diary Base64 이미지 업로드 시작 ===");
            log.info("Bucket: {}", bucketName);

            if (s3Client == null) {
                log.warn("S3Client is null - returning mock URL");
                String mockFileName = generateDiaryFileName(originalFileName);
                return "https://mock-s3-bucket.s3.amazonaws.com/" + mockFileName;
            }

            String[] parts = base64Image.split(",");
            if (parts.length != 2) {
                log.error("Base64 형식 오류: {}", base64Image.substring(0, Math.min(100, base64Image.length())));
                throw new IllegalArgumentException("Invalid Base64 image format");
            }

            String imageData = parts[1];
            byte[] imageBytes = java.util.Base64.getDecoder().decode(imageData);
            log.info("이미지 크기: {} bytes", imageBytes.length);

            String fileName = generateDiaryFileName(originalFileName);
            log.info("생성된 일기 이미지 파일명: {}", fileName);

            PutObjectRequest putObjectRequest = PutObjectRequest.builder()
                    .bucket(bucketName)
                    .key(fileName)
                    .contentType("image/jpeg")
                    .build();

            s3Client.putObject(putObjectRequest, RequestBody.fromBytes(imageBytes));

            String s3Url = "https://" + bucketName + ".s3." + region + ".amazonaws.com/" + fileName;
            log.info("일기 이미지 S3 업로드 성공: {}", s3Url);
            return s3Url;
        } catch (Exception e) {
            log.error("일기 이미지 S3 업로드 실패: {}", e.getMessage());
            throw new RuntimeException("S3 upload failed", e);
        }
    }

    // 일기 오디오 업로드 메서드
    public String uploadDiaryAudio(String originalFileName, byte[] fileData) {
        try {
            if (s3Client == null) {
                log.warn("S3Client is null - returning mock URL");
                String mockFileName = generateDiaryAudioFileName(originalFileName);
                return "https://mock-s3-bucket.s3.amazonaws.com/" + mockFileName;
            }

            String fileName = generateDiaryAudioFileName(originalFileName);
            log.info("Uploading diary audio: {} to S3 bucket: {}", fileName, bucketName);

            PutObjectRequest putObjectRequest = PutObjectRequest.builder()
                    .bucket(bucketName)
                    .key(fileName)
                    .contentType("audio/webm")
                    .build();

            s3Client.putObject(putObjectRequest, RequestBody.fromBytes(fileData));

            String s3Url = "https://" + bucketName + ".s3." + region + ".amazonaws.com/" + fileName;
            log.info("Diary audio uploaded successfully: {}", s3Url);
            return s3Url;
        } catch (Exception e) {
            log.error("Failed to upload diary audio to S3: {}", e.getMessage());
            throw new RuntimeException("S3 upload failed", e);
        }
    }

    // Base64 이미지 업로드 메서드 (입양 펫용)
    public String uploadBase64Image(String base64Image) {
        try {
            log.info("=== S3 Base64 이미지 업로드 시작 (입양 펫용) ===");
            log.info("Bucket: {}", bucketName);

            if (s3Client == null) {
                log.warn("S3Client is null - returning mock URL");
                return "https://mock-s3-bucket.s3.amazonaws.com/adoption/image.jpg";
            }

            String[] parts = base64Image.split(",");
            if (parts.length != 2) {
                log.error("Base64 형식 오류: {}", base64Image.substring(0, Math.min(100, base64Image.length())));
                throw new IllegalArgumentException("Invalid Base64 image format");
            }

            String imageData = parts[1];
            byte[] imageBytes = java.util.Base64.getDecoder().decode(imageData);
            log.info("이미지 크기: {} bytes", imageBytes.length);

            String fileName = generateFileName("image.jpg");
            String adoptionKey = "adoption/" + fileName;
            log.info("생성된 파일명: {}", adoptionKey);

            PutObjectRequest putObjectRequest = PutObjectRequest.builder()
                    .bucket(bucketName)
                    .key(adoptionKey)
                    .contentType("image/jpeg")
                    .build();

            s3Client.putObject(putObjectRequest, RequestBody.fromBytes(imageBytes));

            String s3Url = "https://" + bucketName + ".s3." + region + ".amazonaws.com/" + adoptionKey;
            log.info("S3 Base64 업로드 성공 (입양 펫): {}", s3Url);
            return s3Url;
        } catch (Exception e) {
            log.error("S3 Base64 업로드 실패: {}", e.getMessage());
            throw new RuntimeException("S3 Base64 upload failed", e);
        }
    }

    // 스토어 상품용 Base64 이미지 업로드 메서드 (/products 폴더에 저장)
    public String uploadProductBase64Image(String base64Image) {
        try {
            log.info("=== S3 Base64 이미지 업로드 시작 (스토어 상품용) ===");
            log.info("Bucket: {}", bucketName);

            if (s3Client == null) {
                log.warn("S3Client is null - returning mock URL");
                return "https://mock-s3-bucket.s3.amazonaws.com/products/image.jpg";
            }

            String[] parts = base64Image.split(",");
            if (parts.length != 2) {
                log.error("Base64 형식 오류: {}", base64Image.substring(0, Math.min(100, base64Image.length())));
                throw new IllegalArgumentException("Invalid Base64 image format");
            }

            String imageData = parts[1];
            byte[] imageBytes = java.util.Base64.getDecoder().decode(imageData);
            log.info("이미지 크기: {} bytes", imageBytes.length);

            String fileName = generateFileName("image.jpg");
            String productKey = "products/" + fileName;
            log.info("생성된 파일명: {}", productKey);

            PutObjectRequest putObjectRequest = PutObjectRequest.builder()
                    .bucket(bucketName)
                    .key(productKey)
                    .contentType("image/jpeg")
                    .build();

            s3Client.putObject(putObjectRequest, RequestBody.fromBytes(imageBytes));

            String s3Url = "https://" + bucketName + ".s3." + region + ".amazonaws.com/" + productKey;
            log.info("S3 Base64 업로드 성공 (스토어 상품): {}", s3Url);
            return s3Url;
        } catch (Exception e) {
            log.error("S3 Base64 업로드 실패: {}", e.getMessage());
            throw new RuntimeException("S3 Base64 upload failed", e);
        }
    }

    // MyPet 전용 이미지 업로드 메서드 (/mypet 폴더에 저장)
    public String uploadMyPetImage(MultipartFile file) {
        try {
            if (s3Client == null) {
                log.warn("S3Client is null - returning mock URL");
                String uuidFileName = generateFileName(file.getOriginalFilename());
                return "https://mock-s3-bucket.s3.amazonaws.com/mypet/" + uuidFileName;
            }

            String originalFileName = file.getOriginalFilename();
            byte[] fileData = file.getBytes();

            String uuidFileName = generateFileName(originalFileName);
            String mypetKey = "mypet/" + uuidFileName;
            log.info("Uploading MyPet image: {} (UUID: {}) to S3 bucket: {} in mypet folder", originalFileName, uuidFileName, bucketName);

            PutObjectRequest putObjectRequest = PutObjectRequest.builder()
                    .bucket(bucketName)
                    .key(mypetKey)
                    .contentType(file.getContentType())
                    .build();

            s3Client.putObject(putObjectRequest, RequestBody.fromBytes(fileData));

            String s3Url = "https://" + bucketName + ".s3." + region + ".amazonaws.com/" + mypetKey;
            log.info("MyPet S3 업로드 성공: {}", s3Url);
            return s3Url;
        } catch (Exception e) {
            log.error("Failed to upload MyPet image to S3: {}", e.getMessage());
            throw new RuntimeException("MyPet S3 upload failed", e);
        }
    }

    // 입양 펫 전용 이미지 업로드 메서드 (/adoption 폴더에 저장)
    public String uploadAdoptionPetImage(MultipartFile file) {
        try {
            if (s3Client == null) {
                log.warn("S3Client is null - returning mock URL");
                String uuidFileName = generateFileName(file.getOriginalFilename());
                return "https://mock-s3-bucket.s3.amazonaws.com/adoption/" + uuidFileName;
            }

            String originalFileName = file.getOriginalFilename();
            byte[] fileData = file.getBytes();

            String uuidFileName = generateFileName(originalFileName);
            String adoptionKey = "adoption/" + uuidFileName;
            log.info("Uploading Adoption Pet image: {} (UUID: {}) to S3 bucket: {} in adoption folder", originalFileName, uuidFileName, bucketName);

            PutObjectRequest putObjectRequest = PutObjectRequest.builder()
                    .bucket(bucketName)
                    .key(adoptionKey)
                    .contentType(file.getContentType())
                    .build();

            s3Client.putObject(putObjectRequest, RequestBody.fromBytes(fileData));

            String s3Url = "https://" + bucketName + ".s3." + region + ".amazonaws.com/" + adoptionKey;
            log.info("Adoption Pet S3 업로드 성공: {}", s3Url);
            return s3Url;
        } catch (Exception e) {
            log.error("Failed to upload Adoption Pet image to S3: {}", e.getMessage());
            throw new RuntimeException("Adoption Pet S3 upload failed", e);
        }
    }

    // 감정 피드백 전용 이미지 업로드 메서드 (/emotion 폴더에 저장)
    public String uploadEmotionFeedbackImage(MultipartFile file) {
        try {
            if (s3Client == null) {
                log.warn("S3Client is null - returning mock URL");
                String uuidFileName = generateEmotionFileName(file.getOriginalFilename());
                return "https://mock-s3-bucket.s3.amazonaws.com/emotion/" + uuidFileName;
            }

            String originalFileName = file.getOriginalFilename();
            byte[] fileData = file.getBytes();

            String uuidFileName = generateEmotionFileName(originalFileName);
            String emotionKey = "emotion/" + uuidFileName;
            log.info("Uploading Emotion Feedback image: {} (UUID: {}) to S3 bucket: {} in emotion folder", originalFileName, uuidFileName, bucketName);

            PutObjectRequest putObjectRequest = PutObjectRequest.builder()
                    .bucket(bucketName)
                    .key(emotionKey)
                    .contentType(file.getContentType())
                    .build();

            s3Client.putObject(putObjectRequest, RequestBody.fromBytes(fileData));

            String s3Url = "https://" + bucketName + ".s3." + region + ".amazonaws.com/" + emotionKey;
            log.info("Emotion Feedback S3 업로드 성공: {}", s3Url);
            return s3Url;
        } catch (Exception e) {
            log.error("Failed to upload Emotion Feedback image to S3: {}", e.getMessage());
            throw new RuntimeException("Emotion Feedback S3 upload failed", e);
        }
    }

    // 일기용 UUID 기반 파일명 생성 메서드
    private String generateDiaryFileName(String originalFileName) {
        String extension = "";
        if (originalFileName != null && originalFileName.contains(".")) {
            extension = originalFileName.substring(originalFileName.lastIndexOf("."));
        } else {
            extension = ".jpg";
        }
        return "diary/" + UUID.randomUUID().toString() + extension;
    }

    // 일기 오디오용 UUID 기반 파일명 생성 메서드
    private String generateDiaryAudioFileName(String originalFileName) {
        String extension = "";
        if (originalFileName != null && originalFileName.contains(".")) {
            extension = originalFileName.substring(originalFileName.lastIndexOf("."));
        } else {
            extension = ".webm";
        }
        return "diary/audio/" + UUID.randomUUID().toString() + extension;
    }

    // 감정 피드백용 UUID 기반 파일명 생성 메서드
    private String generateEmotionFileName(String originalFileName) {
        String extension = "";
        if (originalFileName != null && originalFileName.contains(".")) {
            extension = originalFileName.substring(originalFileName.lastIndexOf("."));
        } else {
            extension = ".jpg";
        }
        return UUID.randomUUID().toString() + extension;
    }

    // 기존 파일명 생성 메서드 (호환성용)
    private String generateFileName(String originalFileName) {
        String extension = "";
        if (originalFileName != null && originalFileName.contains(".")) {
            extension = originalFileName.substring(originalFileName.lastIndexOf("."));
        }
        return "products/" + UUID.randomUUID().toString() + extension;
    }

    // S3 파일 다운로드 메서드
    public byte[] downloadFile(String filePathOrUrl) {
        try {
            if (s3Client == null) {
                log.warn("S3Client is null - cannot download file: {}", filePathOrUrl);
                throw new RuntimeException("S3 client not available");
            }

            // 전체 URL이면 key 부분만 추출
            String key = filePathOrUrl;
            if (filePathOrUrl.startsWith("http")) {
                key = filePathOrUrl.substring(filePathOrUrl.indexOf(".com/") + 5);
            }

            log.info("Downloading file from S3: bucket={}, key={}", bucketName, key);

            GetObjectRequest getObjectRequest = GetObjectRequest.builder()
                    .bucket(bucketName)
                    .key(key)
                    .build();

            ResponseInputStream<GetObjectResponse> response = s3Client.getObject(getObjectRequest);
            byte[] fileData = response.readAllBytes();
            
            log.info("File downloaded successfully from S3: {} ({} bytes)", key, fileData.length);
            return fileData;
        } catch (Exception e) {
            log.error("Failed to download file from S3: {}", e.getMessage());
            throw new RuntimeException("S3 download failed", e);
        }
    }

    // S3 파일 삭제 메서드 (URL이든 Key든 모두 지원)
    public void deleteFile(String filePathOrUrl) {
        try {
            if (s3Client == null) {
                log.warn("S3Client is null - delete operation skipped");
                return;
            }

            // 전체 URL이면 key 부분만 추출
            String key = filePathOrUrl;
            if (filePathOrUrl.startsWith("http")) {
                key = filePathOrUrl.substring(filePathOrUrl.indexOf(".com/") + 5);
            }

            log.info("Deleting file from S3: bucket={}, key={}", bucketName, key);

            DeleteObjectRequest deleteObjectRequest = DeleteObjectRequest.builder()
                    .bucket(bucketName)
                    .key(key)
                    .build();

            s3Client.deleteObject(deleteObjectRequest);
            log.info("File deleted successfully from S3: {}", key);
        } catch (Exception e) {
            log.error("Failed to delete file from S3: {}", e.getMessage());
            throw new RuntimeException("S3 delete failed", e);
        }
    }


    // 입양 펫 이미지 삭제 메서드 (/adoption 폴더에서 삭제)
    public void deleteAdoptionPetImage(String fileName) {
        try {
            if (s3Client == null) {
                log.warn("S3Client is null - cannot delete adoption pet image: {}", fileName);
                return;
            }

            String adoptionKey = "adoption/" + fileName;
            log.info("Deleting adoption pet image from S3: {}", adoptionKey);

            DeleteObjectRequest deleteObjectRequest = DeleteObjectRequest.builder()
                    .bucket(bucketName)
                    .key(adoptionKey)
                    .build();

            s3Client.deleteObject(deleteObjectRequest);
            log.info("Adoption pet image deleted successfully from S3: {}", adoptionKey);
        } catch (Exception e) {
            log.error("Failed to delete adoption pet image from S3: {}", e.getMessage());
            throw new RuntimeException("Adoption pet S3 delete failed", e);
        }
    }

    // MyPet 이미지 삭제 메서드 (/mypet 폴더에서 삭제)
    public void deleteMyPetImage(String fileName) {
        try {
            if (s3Client == null) {
                log.warn("S3Client is null - cannot delete MyPet image: {}", fileName);
                return;
            }
            String mypetKey = "mypet/" + fileName;
            log.info("Deleting MyPet image from S3: {}", mypetKey);
            DeleteObjectRequest deleteObjectRequest = DeleteObjectRequest.builder()
                    .bucket(bucketName)
                    .key(mypetKey)
                    .build();
            s3Client.deleteObject(deleteObjectRequest);
            log.info("MyPet image deleted successfully from S3: {}", mypetKey);
        } catch (Exception e) {
            log.error("Failed to delete MyPet image from S3: {}", e.getMessage());
            throw new RuntimeException("MyPet S3 delete failed", e);
        }
    }

    // 계약서 PDF를 S3에 업로드하는 메서드
    public String uploadContractToS3(Long contractId, String content) throws IOException {
        try {
            if (s3Client == null) {
                log.warn("S3Client is null - returning mock URL for contract PDF");
                return "https://mock-s3-bucket.s3.amazonaws.com/contracts/contract-" + contractId + ".pdf";
            }

            // PDF 생성
            byte[] pdfData;
            try {
                pdfData = contractFileService.generatePDF(content);
                log.info("PDF 생성 성공: contract-{}", contractId);
            } catch (Exception e) {
                log.error("PDF 생성 실패: {}", e.getMessage());
                // PDF 생성 실패 시에도 계속 진행 (mock URL 반환)
                return "https://mock-s3-bucket.s3.amazonaws.com/contracts/contract-" + contractId + ".pdf";
            }

            String fileName = "contract-" + contractId + ".pdf";
            String contractKey = "contracts/" + fileName;
            
            log.info("Uploading contract PDF: {} to S3 bucket: {}", fileName, bucketName);

            PutObjectRequest putObjectRequest = PutObjectRequest.builder()
                    .bucket(bucketName)
                    .key(contractKey)
                    .contentType("application/pdf")
                    .build();

            s3Client.putObject(putObjectRequest, RequestBody.fromBytes(pdfData));

            String s3Url = "https://" + bucketName + ".s3." + region + ".amazonaws.com/" + contractKey;
            log.info("Contract PDF S3 업로드 성공: {}", s3Url);
            return s3Url;
        } catch (Exception e) {
            log.error("Failed to upload contract PDF to S3: {}", e.getMessage());
            // S3 업로드 실패 시에도 mock URL 반환하여 계속 진행
            return "https://mock-s3-bucket.s3.amazonaws.com/contracts/contract-" + contractId + ".pdf";
        }
    }

    // 계약서 PDF를 S3에서 삭제하는 메서드
    public void deleteContractFromS3(Long contractId) {
        try {
            if (s3Client == null) {
                log.warn("S3Client is null - cannot delete contract PDF: {}", contractId);
                return;
            }
            
            String fileName = "contract-" + contractId + ".pdf";
            String contractKey = "contracts/" + fileName;
            
            log.info("Deleting contract PDF from S3: {}", contractKey);
            
            DeleteObjectRequest deleteObjectRequest = DeleteObjectRequest.builder()
                    .bucket(bucketName)
                    .key(contractKey)
                    .build();
            
            s3Client.deleteObject(deleteObjectRequest);
            log.info("Contract PDF deleted successfully from S3: {}", contractKey);
        } catch (Exception e) {
            log.error("Failed to delete contract PDF from S3: {}", e.getMessage());
            throw new RuntimeException("Contract PDF S3 delete failed", e);
        }
    }
}