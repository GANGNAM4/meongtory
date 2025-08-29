import axios from "axios";
import { getBackendUrl } from "@/lib/api";

// DTO 인터페이스
export interface MyPetRequestDto {
  name: string;
  breed?: string;
  age?: number;
  gender?: "MALE" | "FEMALE" | "UNKNOWN";
  type?: string;
  weight?: number;
  imageUrl?: string;
  // 의료기록 관련 필드들 추가
  medicalHistory?: string;
  vaccinations?: string;
  notes?: string;
  microchipId?: string;
  specialNeeds?: string;
}

export interface MyPetResponseDto {
  myPetId: number;
  name: string;
  breed?: string;
  age?: number;
  gender?: "MALE" | "FEMALE" | "UNKNOWN";
  type?: string;
  weight?: number;
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
  // 의료기록 관련 필드들 추가
  medicalHistory?: string;
  vaccinations?: string;
  notes?: string;
  microchipId?: string;
  specialNeeds?: string;
}

export interface MyPetListResponseDto {
  myPets: MyPetResponseDto[];
  totalCount: number;
}

//  JWT 토큰을 헤더로 붙여주는 함수
const getAuthHeader = () => {
  const token = localStorage.getItem("accessToken");
  return {
    Authorization: token ? `Bearer ${token}` : "",
    Access_Token: token || "",
  };
};

// API 함수들
export const myPetApi = {
  // 펫 등록
  registerMyPet: async (data: MyPetRequestDto): Promise<MyPetResponseDto> => {
    const response = await axios.post(`${getBackendUrl()}/api/mypet`, data, {
      headers: getAuthHeader(),
    });
    return response.data.data;
  },

  // 펫 수정
  updateMyPet: async (
    myPetId: number,
    data: MyPetRequestDto
  ): Promise<MyPetResponseDto> => {
    const response = await axios.put(
      `${getBackendUrl()}/api/mypet/${myPetId}`,
      data,
      { headers: getAuthHeader() }
    );
    return response.data.data;
  },

  // 펫 삭제
  deleteMyPet: async (myPetId: number): Promise<void> => {
    await axios.delete(`${getBackendUrl()}/api/mypet/${myPetId}`, {
      headers: getAuthHeader(),
    });
  },

  // 사용자의 모든 펫 조회
  getMyPets: async (): Promise<MyPetListResponseDto> => {
    const response = await axios.get(`${getBackendUrl()}/api/mypet`, {
      headers: getAuthHeader(),
    });
    return response.data.data;
  },

  // 특정 펫 조회
  getMyPet: async (myPetId: number): Promise<MyPetResponseDto> => {
    const response = await axios.get(`${getBackendUrl()}/api/mypet/${myPetId}`, {
      headers: getAuthHeader(),
    });
    return response.data.data;
  },

  // 이미지 업로드
  uploadPetImage: async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await axios.post(
      `${getBackendUrl()}/api/mypet/upload-image`,
      formData,
      {
        headers: {
          ...getAuthHeader(),
          "Content-Type": "multipart/form-data",
        },
      }
    );
    return response.data.data;
  },
};
