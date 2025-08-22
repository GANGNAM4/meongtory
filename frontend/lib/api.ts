import axios from 'axios';

// API 설정을 위한 공통 유틸리티
export const getBackendUrl = () => {
  const url = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080';
  return url;
};

// 인증이 필요 없는 엔드포인트 목록
const PUBLIC_ENDPOINTS = [
  '/accounts/register',
  '/accounts/login', // 로그인 엔드포인트도 추가 (필요한 경우)
  '/accounts/refresh',
];

// axios 인터셉터 설정 - 요청 시 인증 토큰 자동 추가
axios.interceptors.request.use(
  (config) => {
    // PUBLIC_ENDPOINTS에 포함된 경로에는 토큰을 추가하지 않음
    const isPublicEndpoint = PUBLIC_ENDPOINTS.some((endpoint) =>
      config.url?.includes(endpoint)
    );
    if (!isPublicEndpoint) {
      const token = localStorage.getItem('accessToken');
      if (token) {
        config.headers.Authorization = `${token}`;
        config.headers['Access_Token'] = token; // 백엔드에서 Access_Token 헤더 사용
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 응답 인터셉터 - 401 에러 시 토큰 갱신 시도
axios.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    if (error.response?.status === 401) {
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const response = await axios.post(`${getBackendUrl()}/api/accounts/refresh`,
            { refreshToken },
            {
              headers: {
                'Content-Type': 'application/json',
              },
            }
          );
          const newAccessToken = response.data.accessToken;
          localStorage.setItem('accessToken', newAccessToken);

          // 원래 요청 재시도
          error.config.headers.Authorization = `${newAccessToken}`;
          error.config.headers['Access_Token'] = newAccessToken;
          return axios.request(error.config);
        } catch (refreshError) {
          // 토큰 갱신 실패 시 로그인 페이지로 리다이렉트
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
        }
      }
    }
    return Promise.reject(error);
  }
);

// API 응답 타입 정의
import type { Pet } from "@/types/pets"

// 펫 API 함수들
export const petApi = {
  getPets: async (filters?: {
    name?: string;
    breed?: string;
    gender?: 'MALE' | 'FEMALE';
    adopted?: boolean;
    vaccinated?: boolean;
    neutered?: boolean;
    status?: string;
    type?: string;
    location?: string;
    minAge?: number;
    maxAge?: number;
    limit?: number;
    lastId?: number;
  }): Promise<Pet[]> => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      });
    }
    console.log('Fetching pets with URL:', `${getBackendUrl()}/api/pets?${params.toString()}`);
    const response = await axios.get(`${getBackendUrl()}/api/pets?${params.toString()}`);
    console.log('Raw pets response:', response.data);
    // 응답이 배열이면 그대로 반환, 아니면 response.data.data 반환
    return Array.isArray(response.data) ? response.data : response.data.data;
  },

  createPet: async (petData: Omit<Pet, 'petId'>): Promise<Pet> => {
    console.log('Creating pet with URL:', `${getBackendUrl()}/api/pets`);
    console.log('Pet data:', petData);
    const response = await axios.post(`${getBackendUrl()}/api/pets`, petData, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    console.log('Create pet response:', response.data);
    console.log('Create pet response.data:', response.data.data);
    console.log('Create pet response.data type:', typeof response.data.data);
    console.log('Create pet response.data keys:', response.data.data ? Object.keys(response.data.data) : 'null/undefined');
    
    // 백엔드 응답 구조 확인 및 적절한 데이터 반환
    if (response.data.data) {
      // response.data.data가 있는 경우
      return response.data.data;
    } else if (response.data.petId) {
      // response.data에 직접 petId가 있는 경우
      return response.data;
    } else {
      // 응답이 없거나 예상과 다른 경우 기본값 반환
      console.warn('No data in response, returning default pet object');
      return {
        petId: 0,
        name: petData.name,
        breed: petData.breed,
        age: petData.age,
        gender: petData.gender,
        vaccinated: petData.vaccinated,
        description: petData.description,
        imageUrl: petData.imageUrl,
        adopted: petData.adopted,
        weight: petData.weight,
        location: petData.location,
        microchipId: petData.microchipId,
        medicalHistory: petData.medicalHistory,
        vaccinations: petData.vaccinations,
        notes: petData.notes,
        specialNeeds: petData.specialNeeds,
        personality: petData.personality,
        rescueStory: petData.rescueStory,
        aiBackgroundStory: petData.aiBackgroundStory,
        status: petData.status,
        type: petData.type,
        neutered: petData.neutered,
      };
    }
  },

  updatePet: async (petId: number, petData: Partial<Pet>): Promise<Pet> => {
    console.log('전송할 데이터:', petData);
    
    const response = await axios.put(`${getBackendUrl()}/api/pets/${petId}`, petData, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return response.data.data;
  },

  deletePet: async (petId: number): Promise<void> => {
    await axios.delete(`${getBackendUrl()}/api/pets/${petId}`);
  },

  updatePetImageUrl: async (petId: number, imageUrl: string): Promise<Pet> => {
    const response = await axios.patch(`${getBackendUrl()}/api/pets/${petId}/image-url`, null, {
      params: { imageUrl },
    });
    return response.data.data;
  },

  updateAdoptionStatus: async (petId: number, adopted: boolean): Promise<Pet> => {
    const response = await axios.patch(`${getBackendUrl()}/api/pets/${petId}/adoption-status`, null, {
      params: { adopted },
    });
    return response.data.data;
  },
};

// S3 API 함수들
export const s3Api = {
  uploadFile: async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await axios.post(`${getBackendUrl()}/api/s3/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.data;
  },

  uploadAdoptionFile: async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await axios.post(`${getBackendUrl()}/api/s3/upload/adoption`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    console.log('S3 업로드 응답:', response.data);
    // 백엔드에서 직접 String을 반환하므로 response.data 사용
    return response.data;
  },

  deleteFile: async (fileName: string): Promise<void> => {
    const response = await axios.delete(`${getBackendUrl()}/api/s3/delete`, 
    {
      params: { fileName },
    });
    if (response.status !== 200) {
      throw new Error(`Failed to delete file: ${response.statusText}`);
    }
  },
};

// 사용자 정보 API 함수들
export const userApi = {
  getCurrentUser: async (): Promise<any> => {
    const response = await axios.get(`${getBackendUrl()}/api/accounts/me`);
    return response.data.data;
  },
};

// 입양신청 API 함수들
export const adoptionRequestApi = {
  createAdoptionRequest: async (requestData: {
    petId: number;
    applicantName: string;
    contactNumber: string;
    email: string;
    message: string;
  }): Promise<any> => {
    const response = await axios.post(`${getBackendUrl()}/api/adoption-requests`, requestData);
    return response.data.data;
  },

  getAdoptionRequests: async (): Promise<any[]> => {
    const response = await axios.get(`${getBackendUrl()}/api/adoption-requests`);
    console.log('Raw adoption requests response:', response.data);
    // 응답이 배열이면 그대로 반환, 아니면 response.data.data 반환
    return Array.isArray(response.data) ? response.data : response.data.data;
  },

  getUserAdoptionRequests: async (): Promise<any[]> => {
    const response = await axios.get(`${getBackendUrl()}/api/adoption-requests/user`);
    return response.data.data;
  },

  getAdoptionRequest: async (requestId: number): Promise<any> => {
    const response = await axios.get(`${getBackendUrl()}/api/adoption-requests/${requestId}`);
    return response.data.data;
  },

  updateAdoptionRequestStatus: async (requestId: number, status: string): Promise<any> => {
    const response = await axios.put(`${getBackendUrl()}/api/adoption-requests/${requestId}/status`, 
    {
      status: status,
    });
    return response.data.data;
  },

  updateAdoptionRequest: async (
    requestId: number,
    data: {
      applicantName: string;
      contactNumber: string;
      email: string;
      message: string;
    }
  ): Promise<any> => {
    const response = await axios.put(`${getBackendUrl()}/api/adoption-requests/${requestId}`, data);
    return response.data.data;
  },

  getAdoptionRequestsByStatus: async (status: string): Promise<any[]> => {
    const response = await axios.get(`${getBackendUrl()}/api/adoption-requests/status/${status}`);
    return response.data.data;
  },
};

// 상품 API 함수들
export const productApi = {
  getProducts: async (): Promise<any[]> => {
    const response = await axios.get(`${getBackendUrl()}/api/products`);
    console.log('Raw products response:', response);
    console.log('Response data:', response.data);
    console.log('Response data type:', typeof response.data);
    console.log('Response data keys:', Object.keys(response.data));
    console.log('Response data.data:', response.data.data);
    console.log('Response data.data type:', typeof response.data.data);
    console.log('Response data.data isArray:', Array.isArray(response.data.data));
    
    // ResponseDto 형태로 응답이 오므로 response.data.data를 반환
    if (!response.data || !response.data.success) {
      throw new Error(response.data?.error?.message || "API 응답이 올바르지 않습니다.");
    }
    
    const products = response.data.data || [];
    if (!Array.isArray(products)) {
      throw new Error("상품 데이터가 배열 형식이 아닙니다.");
    }
    
    console.log('Final products to return:', products);
    return products;
  },

  getProduct: async (productId: number): Promise<any> => {
    console.log('상품 조회 요청:', `${getBackendUrl()}/api/products/${productId}`);
    console.log('요청할 productId:', productId, '타입:', typeof productId);
    try {
      const response = await axios.get(`${getBackendUrl()}/api/products/${productId}`);
      console.log('상품 조회 성공:', response.data);
      return response.data.data;
    } catch (error) {
      console.error('상품 조회 실패:', error);
      if (axios.isAxiosError(error)) {
        console.error('Axios 에러 상세:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          url: error.config?.url,
          method: error.config?.method,
        });
      }
      throw error;
    }
  },

  createProduct: async (productData: any): Promise<any> => {
    console.log('Creating product with URL:', `${getBackendUrl()}/api/products`);
    console.log('Product data:', productData);
    const response = await axios.post(`${getBackendUrl()}/api/products`, productData, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return response.data.data;
  },

  updateProduct: async (productId: number, productData: any): Promise<any> => {
    const response = await axios.put(`${getBackendUrl()}/api/products/${productId}`, productData, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return response.data.data;
  },

  deleteProduct: async (productId: number): Promise<void> => {
    await axios.delete(`${getBackendUrl()}/api/products/${productId}`);
  },
};

// 에러 처리 유틸리티
export const handleApiError = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message || '서버 오류가 발생했습니다.';
  }
  return error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
};