import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { Assessment } from "../src/models/Assessment";
import { Counter } from "../src/models/Counter";
import { Question } from "../src/models/Question";
import { User } from "../src/models/User";

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/codeshield";

async function seed() {
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB");

  const passwordHash = await bcrypt.hash("password123", 12);

  const users = [
    {
      email: "admin@codeshield.ai",
      name: "Dr. Anika Rao",
      role: "admin",
      avatar: "AR",
      status: "active",
    },
    {
      email: "rohan@codeshield.edu",
      name: "Rohan Sharma",
      role: "student",
      avatar: "RS",
      course: "B.Tech CSE",
      year: "Year 3",
      status: "active",
    },
    {
      email: "kabir@codeshield.ai",
      name: "Kabir Mehta",
      role: "interviewer",
      avatar: "KM",
      status: "active",
    },
    {
      email: "demo@codeshield.ai",
      name: "Demo User",
      role: "student",
      avatar: "DU",
      status: "active",
    },
  ] as const;

  const userDocs: Record<string, mongoose.Types.ObjectId> = {};
  for (const user of users) {
    const doc = await User.findOneAndUpdate(
      { email: user.email },
      { ...user, passwordHash },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
    );
    userDocs[user.email] = doc._id;
    console.log(`Upserted ${user.role}: ${user.email}`);
  }

  const adminId = userDocs["admin@codeshield.ai"];

  await Question.deleteMany({});
  await Assessment.deleteMany({});
  await Counter.deleteMany({});

  const questions = await Question.insertMany([
    {
      code: "Q-1001",
      prompt: "What is the time complexity of binary search?",
      type: "mcq",
      category: "Programming",
      difficulty: "easy",
      points: 5,
      explanation: "Binary search halves the search space each step.",
      options: [
        { key: "A", text: "O(n)" },
        { key: "B", text: "O(log n)" },
        { key: "C", text: "O(n log n)" },
        { key: "D", text: "O(1)" },
      ],
      correctOptionKey: "B",
      createdBy: adminId,
    },
    {
      code: "Q-1002",
      prompt: "Define ACID properties of database transactions.",
      type: "subjective",
      category: "Database",
      difficulty: "medium",
      points: 10,
      explanation: "Atomicity, Consistency, Isolation, Durability.",
      createdBy: adminId,
    },
    {
      code: "Q-1003",
      prompt: "Difference between TCP and UDP?",
      type: "subjective",
      category: "Networking",
      difficulty: "medium",
      points: 8,
      createdBy: adminId,
    },
    {
      code: "Q-1004",
      prompt:
        "Write a function two_sum(nums, target) that returns indices of two numbers adding up to target.",
      type: "coding",
      category: "Programming",
      difficulty: "easy",
      points: 15,
      codingLanguages: ["python", "javascript"],
      starterCode: {
        python: "def two_sum(nums, target):\n    # Write your code here\n    pass",
        javascript:
          "function twoSum(nums, target) {\n  // Write your code here\n}",
      },
      testCases: [
        {
          input: "nums = [2,7,11,15], target = 9",
          expectedOutput: "[0,1]",
          isHidden: false,
        },
        {
          input: "nums = [3,2,4], target = 6",
          expectedOutput: "[1,2]",
          isHidden: false,
        },
      ],
      createdBy: adminId,
    },
    {
      code: "Q-1005",
      prompt: "What is overfitting in machine learning?",
      type: "mcq",
      category: "AI",
      difficulty: "medium",
      points: 5,
      options: [
        { key: "A", text: "Model fits training data too well and generalizes poorly" },
        { key: "B", text: "Model underfits the training data" },
        { key: "C", text: "Model has zero training loss always" },
        { key: "D", text: "Model uses too little data by design" },
      ],
      correctOptionKey: "A",
      createdBy: adminId,
    },
    {
      code: "Q-1006",
      prompt: "Explain the SOLID principles in OOP.",
      type: "subjective",
      category: "Programming",
      difficulty: "hard",
      points: 12,
      createdBy: adminId,
    },
  ]);

  await Counter.findOneAndUpdate(
    { key: "question" },
    { seq: 1006 },
    { upsert: true },
  );

  const [q1, q2, q3, q4, q5, q6] = questions;

  await Assessment.insertMany([
    {
      code: "ASM-201",
      title: "Foundations of Python",
      description: "Core Python concepts and problem solving.",
      instructions:
        "You will be monitored by AI proctoring (face, eye, behavior)\nTab switching, copy/paste, right-click and dev tools are disabled\n5 violations will auto-submit your exam\nStay in full-screen until you finish",
      type: "mixed",
      category: "Programming",
      difficulty: "medium",
      status: "published",
      durationMin: 90,
      totalMarks: q1.points + q4.points + q6.points,
      questionIds: [q1._id, q4._id, q6._id],
      visibility: "all",
      publishedAt: new Date(),
      createdBy: adminId,
    },
    {
      code: "ASM-202",
      title: "Database Fundamentals",
      description: "SQL and transactional concepts.",
      instructions: "Answer carefully. No external help allowed.",
      type: "subjective",
      category: "Database",
      difficulty: "medium",
      status: "published",
      durationMin: 60,
      totalMarks: q2.points,
      questionIds: [q2._id],
      visibility: "all",
      publishedAt: new Date(),
      createdBy: adminId,
    },
    {
      code: "ASM-203",
      title: "Networking Essentials",
      description: "TCP/UDP and network basics.",
      type: "subjective",
      category: "Networking",
      difficulty: "easy",
      status: "draft",
      durationMin: 45,
      totalMarks: q3.points,
      questionIds: [q3._id],
      visibility: "all",
      createdBy: adminId,
    },
    {
      code: "ASM-204",
      title: "ML Fundamentals",
      description: "Intro ML concepts.",
      type: "mcq",
      category: "AI",
      difficulty: "hard",
      status: "scheduled",
      durationMin: 30,
      totalMarks: q5.points,
      questionIds: [q5._id],
      visibility: "all",
      scheduledAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdBy: adminId,
    },
  ]);

  await Counter.findOneAndUpdate(
    { key: "assessment" },
    { seq: 204 },
    { upsert: true },
  );

  console.log(`Seeded ${questions.length} questions and 4 assessments`);
  console.log("Seed complete. Password for all users: password123");
  await mongoose.disconnect();
}

seed().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
