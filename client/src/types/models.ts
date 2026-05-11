export type Role = "admin" | "manager" | "employee";

export type MaritalStatus = "single" | "married" | "divorced" | "widowed" | "partner";

export interface Employee {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  imageUrl?: string;
  jobTitle?: string;
  departmentId?: string;
  locationId?: string;
  managerId?: string;
  role: Role;
  isActive: boolean;
  birthDate?: string;
  address?: string;
  maritalStatus?: MaritalStatus;
  emergencyContact?: string;
  notes?: string;
}

export interface Schedule {
  id: string;
  employeeId: string;
  departmentId?: string;
  locationId?: string;
  workDate: string;
  status: "office" | "home" | "vacation" | "sick" | "off";
  /** 0..24, optional. Absent = full day. Multiple entries per employee/day are allowed. */
  hours?: number;
  note?: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string;
  createdAt: string;
  deliveryStatus: string;
}
