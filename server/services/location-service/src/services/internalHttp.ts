import { logger } from "@syt/shared";

const schedBase = () => process.env.SCHEDULE_SERVICE_URL ?? "http://127.0.0.1:4005";
const empBase = () => process.env.EMPLOYEE_SERVICE_URL ?? "http://127.0.0.1:4002";
const notifyBase = () => process.env.NOTIFICATION_SERVICE_URL ?? "http://127.0.0.1:4006";
const secret = () => process.env.INTERNAL_SERVICE_SECRET ?? "";

export type MeetingNotifyPayload = {
  id: string;
  roomId: string;
  roomName: string;
  locationName: string;
  floor?: string;
  organizerId: string;
  organizerName: string;
  workDate: string;
  hourStart?: number;
  hourEnd?: number;
  title: string;
  inviteeIds: string[];
};

export async function notifyMeetingInvite(
  booking: MeetingNotifyPayload,
  organizerId: string,
  isUpdate: boolean
): Promise<void> {
  const invitees = booking.inviteeIds.filter((id) => id !== organizerId);
  if (invitees.length === 0) return;
  try {
    const res = await fetch(`${notifyBase()}/internal/notifications/meeting-invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-secret": secret() },
      body: JSON.stringify({
        bookingId: booking.id,
        roomId: booking.roomId,
        roomName: booking.roomName,
        locationName: booking.locationName,
        floor: booking.floor,
        workDate: booking.workDate,
        hourStart: booking.hourStart,
        hourEnd: booking.hourEnd,
        title: booking.title,
        organizerId,
        organizerName: booking.organizerName,
        inviteeIds: invitees,
        isUpdate,
      }),
    });
    if (!res.ok) {
      logger.warn("notifyMeetingInvite failed", { status: res.status });
    }
  } catch (e) {
    logger.warn("notifyMeetingInvite error", e);
  }
}

export async function scheduleOfficePresence(
  checks: { employeeId: string; workDate: string }[]
): Promise<{ employeeId: string; workDate: string; hasOffice: boolean }[]> {
  if (checks.length === 0) return [];
  try {
    const res = await fetch(`${schedBase()}/internal/schedules/office-presence`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-secret": secret() },
      body: JSON.stringify({ checks }),
    });
    if (!res.ok) {
      logger.warn("scheduleOfficePresence failed", { status: res.status });
      throw new Error(`schedule internal ${res.status}`);
    }
    const data = (await res.json()) as {
      results: { employeeId: string; workDate: string; hasOffice: boolean }[];
    };
    return data.results;
  } catch (e) {
    logger.warn("scheduleOfficePresence error", e);
    throw e;
  }
}

export async function fetchEmployeeInternal(id: string) {
  try {
    const res = await fetch(`${empBase()}/internal/employees/${id}`, {
      headers: { "x-internal-secret": secret() },
    });
    if (!res.ok) return null;
    return (await res.json()) as {
      id: string;
      departmentId?: string;
      fullName?: string;
      role: string;
    };
  } catch (e) {
    logger.warn("fetchEmployeeInternal failed", e);
    return null;
  }
}
