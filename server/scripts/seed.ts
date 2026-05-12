/**
 * Seed MongoDB with demo data. Requires shared package built: `npm run build -w @syt/shared`
 * Loads `.env` from repo root when present. Use MONGO_URI=mongodb://127.0.0.1:27017 when Mongo runs on your machine (not the Docker hostname `mongo`).
 * SEED_RESET=true npm run seed  (drops service databases first)
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { faker } from "@faker-js/faker";
import {
  DB_NAMES,
  getConnection,
  getDepartmentModel,
  getEmployeeModel,
  getLocationModel,
  getNotificationModel,
  getOrganizationSettingsModel,
  getScheduleModel,
  SCHEDULE_STATUSES,
} from "../shared/src/index.ts";

async function maybeDrop(conn: mongoose.Connection) {
  if (process.env.SEED_RESET === "true") {
    await conn.dropDatabase();
  }
}

async function main() {
  faker.seed(42);

  const empConn = await getConnection(DB_NAMES.employees);
  const depConn = await getConnection(DB_NAMES.departments);
  const locConn = await getConnection(DB_NAMES.locations);
  const schConn = await getConnection(DB_NAMES.schedules);
  const notifConn = await getConnection(DB_NAMES.notifications);
  const setConn = await getConnection(DB_NAMES.settings);

  await maybeDrop(empConn);
  await maybeDrop(depConn);
  await maybeDrop(locConn);
  await maybeDrop(schConn);
  await maybeDrop(notifConn);
  await maybeDrop(setConn);

  const Location = getLocationModel(locConn);
  const Department = getDepartmentModel(depConn);
  const Employee = getEmployeeModel(empConn);
  const Schedule = getScheduleModel(schConn);
  const Notification = getNotificationModel(notifConn);
  const OrgSettings = getOrganizationSettingsModel(setConn);

  const existingAdmin = await Employee.findOne({ email: "admin@seeyoutomorrow.local" });
  if (existingAdmin && process.env.SEED_RESET !== "true") {
    console.log("Seed skipped (admin exists). Use SEED_RESET=true to recreate.");
    process.exit(0);
  }

  await OrgSettings.create({
    managerCanEditSchedules: false,
    preferenceMinDaysAhead: 7,
    preferenceRemindersEnabled: true,
    updatedAt: new Date(),
  });

  const locations = await Location.insertMany(
    Array.from({ length: 5 }).map((_, i) => ({
      name: `משרד ${i + 1}`,
      city: faker.location.city(),
      country: "IL",
      address: faker.location.streetAddress(),
      capacity: faker.number.int({ min: 40, max: 120 }),
      isActive: true,
    }))
  );

  const departments = await Department.insertMany(
    Array.from({ length: 8 }).map((_, i) => ({
      name: `מחלקת ${faker.commerce.department()}`,
      description: faker.company.catchPhrase(),
      locationId: locations[i % locations.length]._id,
      isActive: true,
    }))
  );

  const adminPass = await bcrypt.hash("Admin123456!", 12);
  const admin = await Employee.create({
    fullName: "מנהל ראשי",
    email: "admin@seeyoutomorrow.local",
    password: adminPass,
    role: "admin",
    isActive: true,
    departmentId: departments[0]._id,
    locationId: locations[0]._id,
    jobTitle: "מנהל מערכת",
  });

  const managers: mongoose.Types.ObjectId[] = [];
  for (let i = 0; i < 8; i++) {
    const pw = await bcrypt.hash("Manager123!", 12);
    const m = await Employee.create({
      fullName: faker.person.fullName(),
      email: `manager${i}@seeyoutomorrow.local`,
      password: pw,
      role: "manager",
      departmentId: departments[i]._id,
      locationId: departments[i].locationId,
      jobTitle: "מנהל צוות",
    });
    managers.push(m._id);
    await Department.findByIdAndUpdate(departments[i]._id, { managerId: m._id });
  }

  const defaultHash = await bcrypt.hash("Temp123456!", 12);
  const bulk: {
    fullName: string;
    email: string;
    password: string;
    role: "employee";
    departmentId: mongoose.Types.ObjectId;
    locationId?: mongoose.Types.ObjectId;
    managerId: mongoose.Types.ObjectId;
    jobTitle: string;
    isActive: boolean;
  }[] = [];
  for (let i = 0; i < 241; i++) {
    const dept = departments[i % departments.length];
    bulk.push({
      fullName: faker.person.fullName(),
      email: `user${i}@${faker.internet.domainName()}`.toLowerCase(),
      password: defaultHash,
      role: "employee",
      departmentId: dept._id,
      locationId: dept.locationId,
      managerId: managers[i % managers.length],
      jobTitle: faker.person.jobTitle(),
      isActive: true,
    });
  }
  await Employee.insertMany(bulk);

  const allEmployees = await Employee.find({ role: "employee" }).lean();
  const statuses = [...SCHEDULE_STATUSES];
  for (let d = 0; d < 14; d++) {
    const day = new Date();
    day.setDate(day.getDate() + d - 7);
    const workDate = new Date(Date.UTC(day.getFullYear(), day.getMonth(), day.getDate()));
    for (const emp of allEmployees.slice(0, 80)) {
      try {
        await Schedule.create({
          employeeId: emp._id,
          departmentId: emp.departmentId,
          locationId: emp.locationId,
          workDate,
          status: statuses[faker.number.int({ min: 0, max: statuses.length - 1 })],
          note: faker.datatype.boolean() ? faker.lorem.sentence() : undefined,
          updatedBy: admin._id,
        });
      } catch {
        /* unique per day */
      }
    }
  }

  await Notification.create({
    title: "ברוכים הבאים",
    message: "נוצרו נתוני דמו עבור See You Tomorrow",
    type: "system",
    recipientIds: [admin._id, managers[0]],
    channels: ["inapp", "socket"],
    deliveryStatus: "sent",
    readBy: [],
    createdAt: new Date(),
  });

  console.log("Seed complete.");
  console.log("Admin login: admin@seeyoutomorrow.local / Admin123456!");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
