export interface LampInfo {
  name: string;
  intensity_min: number;
  intensity_max: number;
  unit: string;
}

export interface Chamber {
  id: number;
  name: string;
  description: string | null;
  cassette_count: number | null;
  center_id: number;
  methodologies: string[] | null;
  lamps: LampInfo[] | null;
  condensation_temp_min: number | null;
  condensation_temp_max: number | null;
  irradiation_temp_min: number | null;
  irradiation_temp_max: number | null;
}

export interface Center {
  id: number;
  name: string;
  chambers: Chamber[];
}

export interface Booking {
  id: number;
  center_id: number;
  chamber_id: number;
  cassette_number: number;
  department: string;
  full_name: string;
  sample_cipher: string;
  description: string | null;
  project: string | null;
  lims_request_id: string | null;
  duration_hours: number;
  start_time: string;
  end_time: string;
  status: 'active' | 'cancelled';
  cancellation_reason: string | null;
}

export interface FilterOptions {
  methodologies: string[];
  lamp_types: string[];
}

export interface ChamberFilters {
  center_id?: number;
  methodologies?: string[];
  lamp_types?: string[];
  condensation_temp_min?: number;
  condensation_temp_max?: number;
  irradiation_temp_min?: number;
  irradiation_temp_max?: number;
  intensity_min?: number;
  intensity_max?: number;
  available_from?: string;
  available_to?: string;
}

export interface ChamberWithAvailability extends Chamber {
  available_cassettes: number;
  total_cassettes: number;
  active_bookings_count: number;
}

export interface BookingCreate {
  center_id?: number;
  chamber_id: number;
  cassette_number?: number;
  department: string;
  full_name: string;
  sample_cipher: string;
  description?: string;
  project?: string;
  lims_request_id?: string;
  duration_hours: number;
  start_time: string; // ISO формат
}

// ✅ Динамический URL в зависимости от окружения
const API_BASE_URL = `${import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'}/api/climate`;

export const api = {
  getCenters: async (): Promise<Center[]> => {
    const response = await fetch(`${API_BASE_URL}/centers`);
    if (!response.ok) throw new Error('Ошибка загрузки центров');
    return response.json();
  },

  getCenterById: async (centerId: number): Promise<Center> => {
    const response = await fetch(`${API_BASE_URL}/centers/${centerId}`);
    if (!response.ok) throw new Error('Ошибка загрузки центра');
    return response.json();
  },

  getBookings: async (params: {
    chamber_id?: number;
    center_id?: number;
    status?: 'active' | 'cancelled' | 'all';
    start_date?: string;
    end_date?: string;
  } = {}): Promise<Booking[]> => {
    const queryParams = new URLSearchParams();
    if (params.chamber_id) queryParams.append('chamber_id', params.chamber_id.toString());
    if (params.center_id) queryParams.append('center_id', params.center_id.toString());
    if (params.status) queryParams.append('status', params.status);
    if (params.start_date) queryParams.append('start_date', params.start_date);
    if (params.end_date) queryParams.append('end_date', params.end_date);
    
    const response = await fetch(`${API_BASE_URL}/bookings?${queryParams}`);
    if (!response.ok) throw new Error('Ошибка загрузки бронирований');
    return response.json();
  },

  cancelBooking: async (bookingId: number, reason: string): Promise<Booking> => {
    const response = await fetch(`${API_BASE_URL}/bookings/${bookingId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    });
    if (!response.ok) throw new Error('Ошибка отмены бронирования');
    return response.json();
  },

  getFilterOptions: async (): Promise<FilterOptions> => {
    const response = await fetch(`${API_BASE_URL}/filter-options`);
    if (!response.ok) throw new Error('Ошибка загрузки опций фильтров');
    return response.json();
  },

  filterChambers: async (filters: ChamberFilters): Promise<Chamber[]> => {
    const response = await fetch(`${API_BASE_URL}/chambers/filter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(filters)
    });
    if (!response.ok) throw new Error('Ошибка фильтрации камер');
    return response.json();
  },

  createBooking: async (booking: BookingCreate): Promise<Booking> => {
    const response = await fetch(`${API_BASE_URL}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(booking)
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Ошибка создания бронирования');
    }
    return response.json();
  }
};