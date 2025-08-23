# 빌더 스테이지
FROM gradle:8.10.2-jdk17 AS builder
WORKDIR /app
COPY build.gradle settings.gradle ./
RUN gradle dependencies --no-daemon -Dorg.gradle.jvmargs='-Dhttps.protocols=TLSv1.2,TLSv1.3'
COPY src ./src
RUN gradle build --no-daemon -x test

# 실행 스테이지
FROM mcr.microsoft.com/playwright/java:v1.46.0-jammy
WORKDIR /app
COPY --from=builder /app/build/libs/*.jar app.jar
EXPOSE 8080
CMD ["java", "-Duser.timezone=Asia/Seoul", "-jar", "app.jar"]