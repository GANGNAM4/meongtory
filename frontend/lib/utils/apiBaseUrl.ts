// utils/apiBaseUrl.ts
export const getApiBaseUrl = () => {
  let baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "";

  // 브라우저에서 backend 호스트명 인식 못할 경우 localhost로 교체
  if (typeof window !== "undefined" && baseUrl.includes("backend")) {
    baseUrl = baseUrl.replace("backend", "localhost");
  }

  return baseUrl;
};
