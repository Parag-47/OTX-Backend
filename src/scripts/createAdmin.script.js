#!/usr/bin/env node

/**
 * Production Admin Creator
 * ------------------------
 * Creates an admin user safely via CLI.
 *
 * Usage:
 *   npm run create-admin
 */

import mongoose from "mongoose";
import bcrypt from "bcrypt";
import inquirer from "inquirer";

const SALT_ROUNDS = 10;
const COLLECTION = "users";

async function main() {
  try {
    if (!process.env.MONGODB_URI || !process.env.DB_NAME) {
      throw new Error(
        "MONGODB_URI or DB_NAME not found in environment variables"
      );
    }

    console.log("Connecting to database...");
    await mongoose.connect(`${process.env.MONGODB_URI}/${process.env.DB_NAME}`);

    console.log("Connected ✓\n");

    // flexible schema (no assumptions)
    const schema = new mongoose.Schema(
      {},
      {
        strict: false,
        collection: COLLECTION,
      }
    );

    const User =
      mongoose.models.AdminScriptUser ||
      mongoose.model("AdminScriptUser", schema);

    // ===== PROMPTS =====
    const answers = await inquirer.prompt([
      {
        name: "name",
        message: "Admin name:",
        validate: (v) => v.length > 3 || "Name must be > 3 characters",
      },
      {
        name: "email",
        message: "Admin email:",
        validate: (v) => /\S+@\S+\.\S+/.test(v) || "Enter a valid email",
      },
      {
        type: "password",
        name: "password",
        message: "Admin password:",
        mask: "*",
        validate: (v) =>
          v.length >= 8 || "Password must be at least 8 characters",
      },
    ]);

    const { name, email, password } = answers;

    // ===== CHECK EXISTING USER =====
    const existing = await User.findOne({ email });

    if (existing) {
      console.log(
        `❌ User with email "${email}" already exists (id=${existing._id})`
      );
      process.exit(0);
    }

    console.log("\nHashing password...");
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // ===== CREATE ADMIN =====
    const adminUser = await User.create({
      name,
      email,
      password: hashedPassword,

      role: "admin",

      verified_email: true,
      verified_phone: true,
      isActive: true,
      // source defaults to "Direct"
    });

    console.log("\n✅ Admin created successfully!");
    console.log("User ID:", adminUser._id.toString());

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("\n❌ Failed to create admin:");
    console.error(err.message);

    await mongoose.disconnect();
    process.exit(1);
  }
}

main();
