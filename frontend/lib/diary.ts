import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080';

// Access Token 가져오기 + 로그인 체크 함수
function getAccessTokenOrRedirect(): string {
  const accessToken = localStorage.getItem("accessToken");
  if (!accessToken) {
    // API 요청의 경우 리다이렉트하지 않고 에러를 던짐
    throw new Error("로그인이 필요합니다.");
  }
  return accessToken;
}

// 공통 401 에러 처리 함수
async function handleUnauthorized(res: any) {
  if (res.status === 401) {
    const errorText = res.data || res.statusText;
    console.error("Unauthorized:", errorText);
    
    // 토큰 제거
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    
    // API 요청의 경우 리다이렉트하지 않고 에러를 던짐
    throw new Error("세션이 만료되었습니다. 다시 로그인해주세요.");
  }
}

export interface DiaryEntry {
  diaryId: number;
  userId: number;
  title: string;
  text: string;
  audioUrl?: string;
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDiaryRequest {
  userId: number;
  title: string;
  text: string;
  audioUrl?: string;
  imageUrl?: string;
}

export interface UpdateDiaryRequest {
  title?: string;
  text?: string;
  audioUrl?: string;
  imageUrl?: string;
}

export async function fetchDiaries(): Promise<DiaryEntry[]> {
  console.log("=== fetchDiaries called ===");
  
  const accessToken = getAccessTokenOrRedirect();
  console.log("Access token obtained:", accessToken ? "Yes" : "No");

  const url = `${API_BASE_URL}/api/diary`;

  console.log("Making request to:", url);
  console.log("Request headers:", {
    "Access_Token": accessToken, 
  });

  try {
    const response = await axios.get(url, {
      headers: {
        "Access_Token": accessToken, 
      },
    });

    console.log("=== fetchDiaries success ===");
    console.log("Response status:", response.status);
    console.log("Response headers:", response.headers["content-type"]);
    console.log("Raw response data:", response.data);
    console.log("Data type:", typeof response.data);
    console.log("Is array:", Array.isArray(response.data));
    console.log("Data length:", response.data?.length);
    
    return response.data;
  } catch (error: any) {
    console.error("=== fetchDiaries error ===");
    console.error("API error response:", error.response?.data);
    console.error("Error details:", error);
    console.error("Error status:", error.response?.status);
    
    if (error.response?.status === 401) {
      await handleUnauthorized(error.response);
    }
    
    throw new Error(`Failed to fetch diaries: ${error.response?.status || error.message}`);
  }
}

export async function fetchDiary(diaryId: number): Promise<DiaryEntry> {
  console.log("=== fetchDiary called ===");
  console.log("Diary ID:", diaryId);
  console.log("API_BASE_URL:", API_BASE_URL);
  
  const accessToken = getAccessTokenOrRedirect();
  console.log("Access token obtained:", accessToken ? "Yes" : "No");

  const url = `${API_BASE_URL}/api/diary/${diaryId}`;
  console.log("Making GET request to:", url);
  console.log("Request headers:", {
    "Access_Token": accessToken,
  });

  try {
    const response = await axios.get(url, {
      headers: {
        "Access_Token": accessToken,
      },
    });

    console.log("=== fetchDiary success ===");
    console.log("Response status:", response.status);
    console.log("Response data:", response.data);
    
    return response.data;
  } catch (error: any) {
    console.error("=== fetchDiary error ===");
    console.error("Error fetching diary:", error);
    console.error("Error response:", error.response);
    console.error("Error status:", error.response?.status);
    console.error("Error message:", error.message);
    
    if (error.response?.status === 401) {
      await handleUnauthorized(error.response);
    }
    
    throw new Error(`Failed to fetch diary: ${error.response?.status || error.message}`);
  }
}

export async function createDiary(diaryData: CreateDiaryRequest): Promise<DiaryEntry> {
  console.log("=== createDiary called ===");
  console.log("API_BASE_URL:", API_BASE_URL);
  console.log("diaryData:", diaryData);
  
  const accessToken = getAccessTokenOrRedirect();
  console.log("Access token obtained:", accessToken ? "Yes" : "No");

  try {
    console.log("Making POST request to:", `${API_BASE_URL}/api/diary`);
    console.log("Request headers:", {
      "Access_Token": accessToken,
      "Content-Type": "application/json",
    });
    
    const response = await axios.post(`${API_BASE_URL}/api/diary`, diaryData, {
      headers: {
        "Access_Token": accessToken,
        "Content-Type": "application/json",
      },
    });

    console.log("=== createDiary success ===");
    console.log("Response status:", response.status);
    console.log("Response data:", response.data);
    
    return response.data;
  } catch (error: any) {
    console.error("=== createDiary error ===");
    console.error("Error creating diary:", error);
    console.error("Error response:", error.response);
    console.error("Error message:", error.message);
    
    if (error.response?.status === 401) {
      await handleUnauthorized(error.response);
    }
    
    throw new Error(`Failed to create diary: ${error.response?.status || error.message}`);
  }
}

export async function updateDiary(diaryId: number, diaryData: UpdateDiaryRequest): Promise<DiaryEntry> {
  const accessToken = getAccessTokenOrRedirect();

  try {
    const response = await axios.put(`${API_BASE_URL}/api/diary/${diaryId}`, diaryData, {
      headers: {
        "Access_Token": accessToken,
        "Content-Type": "application/json",
      },
    });

    return response.data;
  } catch (error: any) {
    console.error("Error updating diary:", error);
    
    if (error.response?.status === 401) {
      await handleUnauthorized(error.response);
    }
    
    throw new Error(`Failed to update diary: ${error.response?.status || error.message}`);
  }
}

export async function deleteDiary(diaryId: number): Promise<void> {
  const accessToken = getAccessTokenOrRedirect();

  try {
    await axios.delete(`${API_BASE_URL}/api/diary/${diaryId}`, {
      headers: {
        "Access_Token": accessToken,
      },
    });
  } catch (error: any) {
    console.error("Error deleting diary:", error);
    
    if (error.response?.status === 401) {
      await handleUnauthorized(error.response);
    }
    
    throw new Error(`Failed to delete diary: ${error.response?.status || error.message}`);
  }
}

export async function uploadImageToS3(file: File): Promise<string> {
  const accessToken = getAccessTokenOrRedirect();
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await axios.post(`${API_BASE_URL}/api/s3/upload/diary`, formData, {
      headers: {
        "Access_Token": accessToken,
        "Content-Type": "multipart/form-data",
      },
    });

    return response.data;
  } catch (error: any) {
    console.error("Error uploading image:", error);
    
    if (error.response?.status === 401) {
      await handleUnauthorized(error.response);
    }
    
    throw new Error(`Failed to upload image: ${error.response?.status || error.message}`);
  }
}

export async function uploadAudioToS3(file: File): Promise<string> {
  const accessToken = getAccessTokenOrRedirect();
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await axios.post(`${API_BASE_URL}/api/diary/audio`, formData, {
      headers: {
        "Access_Token": accessToken,
        "Content-Type": "multipart/form-data",
      },
    });

    return response.data;
  } catch (error: any) {
    console.error("Error uploading audio:", error);
    
    if (error.response?.status === 401) {
      await handleUnauthorized(error.response);
    }
    
    throw new Error(`Failed to upload audio: ${error.response?.status || error.message}`);
  }
}