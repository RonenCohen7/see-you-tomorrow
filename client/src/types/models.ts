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
  /** Built-in or `custom:<id>` from organization settings. */
  status: string;
  /** 0..24, optional. Absent = full day. Multiple entries per employee/day are allowed. */
  hours?: number;
  note?: string;
  /** How this row was last written: manual edits vs AI batch apply. */
  source?: "manual" | "ai";
  aiBatchId?: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string;
  createdAt: string;
  deliveryStatus: string;
  readBy?: { userId: string; readAt: string }[];
  createdBy?: string;
  scheduleContext?: {
    scheduleId: string;
    employeeId: string;
    employeeName: string;
    workDate: string;
    workDateEnd?: string;
    status: string;
    statusDisplayHe?: string;
    note?: string;
    updatedBy?: string;
    updatedByName?: string;
  };
  meetingContext?: {
    bookingId: string;
    roomId: string;
    roomName: string;
    locationName: string;
    floor?: string;
    workDate: string;
    hourStart?: number;
    hourEnd?: number;
    title: string;
    organizerId: string;
    organizerName: string;
    isUpdate?: boolean;
  };
}
