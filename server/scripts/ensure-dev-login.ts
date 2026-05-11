/**
 * Upserts a dev user so you can log in via /login (password stored as bcrypt, same as auth-service).
 * Requires MongoDB (e.g. npm run docker) and: npm run build -w @syt/shared
 *
 * Defaults: DEV_LOGIN_EMAIL / DEV_LOGIN_PASSWORD or ronenc7@gmail.com / 12345678
 *
 *   npm run ensure:dev-user
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { DB_NAMES, getConnection, getEmployeeModel } from "../shared/src/index.ts";

async function main() {
  const email = (process.env.DEV_LOGIN_EMAIL ?? "ronenc7@gmail.com").toLowerCase().trim();
  const plain = process.env.DEV_LOGIN_PASSWORD ?? "12345678";

  if (plain.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }

  const hashed = await bcrypt.hash(plain, 12);
  const empConn = await getConnection(DB_NAMES.employees);
  const Employee = getEmployeeModel(empConn);

  const doc = await Employee.findOneAndUpdate(
    { email },
    {
      $set: {
        fullName: "רון כהן",
        email,
        password: hashed,
        role: "admin",
        isActive: true,
        jobTitle: "מנהל מערכת",
      },
    },
    { upsert: true, new: true, runValidators: true }
  );

  console.log("Dev login user ready:");
  console.log(`  Email:    ${email}`);
  console.log(`  Password: ${plain} (only shown here — change after first login in prod)`);
  console.log(`  Role:     ${doc.role}`);
  console.log(`  Id:       ${doc._id}`);

  await empConn.close();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
