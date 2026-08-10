export const mockStudents = [
  { name: "Noah Smith", email: "noah.smith@codeshield.edu", course: "Cybersecurity", assessments: 14, avgScore: 59, violations: 4, status: "suspended" },
  { name: "Atharv Gupta", email: "atharv.gupta@codeshield.edu", course: "Full Stack Dev", assessments: 6, avgScore: 72, violations: 4, status: "pending" },
  { name: "Aarav Smith", email: "aarav.smith@codeshield.edu", course: "Cybersecurity", assessments: 2, avgScore: 59, violations: 0, status: "active" },
  { name: "Ali Brown", email: "ali.brown@codeshield.edu", course: "B.Tech CSE", assessments: 13, avgScore: 88, violations: 2, status: "active" },
  { name: "Ishita Patel", email: "ishita.patel@codeshield.edu", course: "Data Science", assessments: 16, avgScore: 56, violations: 2, status: "pending" },
  { name: "Yusuf Johnson", email: "yusuf.johnson@codeshield.edu", course: "B.Tech IT", assessments: 3, avgScore: 80, violations: 4, status: "pending" },
  { name: "Wei Kumar", email: "wei.kumar@codeshield.edu", course: "Full Stack Dev", assessments: 5, avgScore: 50, violations: 0, status: "active" },
  { name: "Riya Wilson", email: "riya.wilson@codeshield.edu", course: "Full Stack Dev", assessments: 23, avgScore: 60, violations: 4, status: "active" },
  { name: "Ethan Martinez", email: "ethan.martinez@codeshield.edu", course: "B.Tech CSE", assessments: 23, avgScore: 68, violations: 4, status: "active" },
  { name: "Sophia Reddy", email: "sophia.reddy@codeshield.edu", course: "AI & ML", assessments: 21, avgScore: 82, violations: 6, status: "suspended" },
  { name: "Pari Brown", email: "pari.brown@codeshield.edu", course: "MCA", assessments: 9, avgScore: 87, violations: 6, status: "active" },
  { name: "Riya Martinez", email: "riya.martinez@codeshield.edu", course: "B.Tech IT", assessments: 18, avgScore: 82, violations: 1, status: "active" },
];

export const mockAlerts = [
  { type: "Copy Attempt", student: "Ishita Reddy", assessment: "C++ Algorithms", severity: "high", time: "23:47" },
  { type: "Copy Attempt", student: "Riya Martinez", assessment: "C++ Algorithms", severity: "low", time: "21:57" },
  { type: "No Face Detected", student: "Noor Nakamura", assessment: "Data Structures Sprint", severity: "low", time: "17:33" },
  { type: "Paste Attempt", student: "Sophia Reddy", assessment: "C++ Algorithms", severity: "low", time: "23:57" },
  { type: "Copy Attempt", student: "Vivaan Kim", assessment: "ML Fundamentals", severity: "high", time: "6:16" },
  { type: "Dev Tools Opened", student: "Wei Kumar", assessment: "SQL Mastery", severity: "low", time: "11:04" },
  { type: "Voice Detected", student: "Mason Davis", assessment: "ML Fundamentals", severity: "medium", time: "12:15" },
  { type: "Full Screen Exit", student: "Amara Smith", assessment: "DBMS Concepts", severity: "high", time: "5:01" },
  { type: "Multiple Faces", student: "Olivia Martinez", assessment: "Data Structures Sprint", severity: "medium", time: "15:04" },
];

export const mockMonitoringFeeds = [
  { name: "Noah Smith", face: 88, status: "safe", flags: ["FACE", "EYE", "HEAD", "ALONE"] },
  { name: "Atharv Gupta", face: 95, status: "safe", flags: ["FACE", "EYE", "HEAD", "ALONE"] },
  { name: "Aarav Smith", face: 90, status: "safe", flags: ["FACE", "EYE", "HEAD", "ALONE"] },
  { name: "Ali Brown", face: 97, status: "warning", flags: ["FACE", "EYE", "HEAD⚠", "ALONE"] },
  { name: "Ishita Patel", face: 92, status: "safe", flags: ["FACE", "EYE", "HEAD", "ALONE"] },
  { name: "Yusuf Johnson", face: 99, status: "warning", flags: ["FACE", "EYE", "HEAD⚠", "MULTI⚠"] },
  { name: "Wei Kumar", face: 94, status: "safe", flags: ["FACE", "EYE", "HEAD", "ALONE"] },
  { name: "Riya Wilson", face: 89, status: "warning", flags: ["FACE", "EYE", "HEAD⚠", "ALONE"] },
];

export const mockInterviews = [
  { id: "IVW-401", candidate: "Noah Johnson", role: "Software Engineer", interviewer: "Reyansh Verma", date: "2026-06-09 · 14:30", type: "Coding", status: "Completed", duration: 60 },
  { id: "IVW-402", candidate: "Ethan Mehta", role: "ML Engineer", interviewer: "Aadhya Wilson", date: "2026-06-26 · 12:30", type: "Technical", status: "Live", duration: 30 },
  { id: "IVW-403", candidate: "Emma Okafor", role: "QA Engineer", interviewer: "Hassan Gupta", date: "2026-06-09 · 09:00", type: "Coding", status: "Scheduled", duration: 30 },
  { id: "IVW-404", candidate: "Sara Kim", role: "DevOps Engineer", interviewer: "Riya Rodriguez", date: "2026-06-07 · 12:00", type: "Coding", status: "Scheduled", duration: 45 },
  { id: "IVW-405", candidate: "Reyansh Wang", role: "Frontend Dev", interviewer: "Liam Brown", date: "2026-06-08 · 13:00", type: "HR", status: "Scheduled", duration: 60 },
  { id: "IVW-406", candidate: "Chen Smith", role: "DevOps Engineer", interviewer: "Aditya Mehta", date: "2026-06-06 · 10:30", type: "Coding", status: "Completed", duration: 60 },
];

export const mockPanel = [
  { name: "Reyansh Martinez", specialty: "Full Stack", rating: 3.9, count: 112 },
  { name: "Mason Wang", specialty: "Security", rating: 4.1, count: 196 },
  { name: "Noah Wilson", specialty: "Full Stack", rating: 4.8, count: 342 },
  { name: "Emma Wilson", specialty: "ML/AI", rating: 4.3, count: 349 },
  { name: "Hana Martinez", specialty: "Frontend", rating: 4.7, count: 336 },
  { name: "Hassan Gupta", specialty: "Frontend", rating: 4.3, count: 322 },
];

export const mockCodingProblems = [
  { id: "P-1", title: "Two Sum", difficulty: "Easy", acceptance: 52, solvedBy: 4820 },
  { id: "P-2", title: "Valid Parentheses", difficulty: "Easy", acceptance: 49, solvedBy: 3140 },
  { id: "P-3", title: "Reverse Linked List", difficulty: "Easy", acceptance: 71, solvedBy: 2890 },
  { id: "P-4", title: "Merge Intervals", difficulty: "Medium", acceptance: 41, solvedBy: 1820 },
  { id: "P-5", title: "Longest Substring Without Repeats", difficulty: "Medium", acceptance: 33, solvedBy: 1620 },
  { id: "P-6", title: "Course Schedule", difficulty: "Medium", acceptance: 38, solvedBy: 980 },
  { id: "P-7", title: "Word Ladder", difficulty: "Hard", acceptance: 24, solvedBy: 412 },
  { id: "P-8", title: "Median of Two Sorted Arrays", difficulty: "Hard", acceptance: 28, solvedBy: 380 },
];

export const mockResults = [
  { assessment: "Python Foundations", score: 92, result: "Passed", time: "42m", date: "2026-05-30" },
  { assessment: "SQL Mastery", score: 78, result: "Passed", time: "55m", date: "2026-05-26" },
  { assessment: "Networking Essentials", score: 64, result: "Passed", time: "38m", date: "2026-05-20" },
  { assessment: "Data Structures Sprint", score: 51, result: "Failed", time: "1h 12m", date: "2026-05-14" },
  { assessment: "Aptitude Round 1", score: 88, result: "Passed", time: "30m", date: "2026-05-08" },
];

export const mockCertificates = [
  { title: "Python Foundations", issued: "May 2026", score: 92 },
  { title: "SQL Mastery", issued: "May 2026", score: 78 },
  { title: "Networking Essentials", issued: "May 2026", score: 64 },
  { title: "Aptitude Round 1", issued: "May 2026", score: 88 },
  { title: "English Proficiency", issued: "Apr 2026", score: 81 },
];

export const mockNotifications = [
  { text: "Python Foundations is live", time: "2h ago" },
  { text: "Interview slot confirmed", time: "5h ago" },
  { text: "Certificate ready: SQL Mastery", time: "1d ago" },
  { text: "New coding challenge added", time: "2d ago" },
];

export const mockReports = [
  { type: "Assessment", title: "Assessment Performance Q2", date: "2026-05-30", size: "2.4 MB" },
  { type: "Coding", title: "Coding Skills Summary", date: "2026-05-28", size: "1.1 MB" },
  { type: "Interview", title: "Interview Pipeline Report", date: "2026-05-25", size: "3.8 MB" },
  { type: "Proctoring", title: "AI Proctoring Incidents", date: "2026-05-22", size: "910 KB" },
  { type: "Security", title: "Weekly Security Audit", date: "2026-05-20", size: "1.6 MB" },
];

export const mockEvaluations = [
  { name: "Noah Johnson", role: "Software Engineer", date: "2026-06-09", score: 95 },
  { name: "Chen Smith", role: "DevOps Engineer", date: "2026-06-06", score: null },
  { name: "Sara Kim", role: "Frontend Dev", date: "2026-06-14", score: 85 },
  { name: "Riya Wilson", role: "Backend Dev", date: "2026-06-07", score: 63 },
  { name: "Mason Davis", role: "DevOps Engineer", date: "2026-06-24", score: null },
  { name: "Riya Martinez", role: "Frontend Dev", date: "2026-06-16", score: 70 },
  { name: "Ananya Kumar", role: "ML Engineer", date: "2026-06-26", score: 90 },
];

export const interviewQuestions = [
  "Tell us briefly about yourself.",
  "Walk us through a project you're proud of.",
  "Explain the difference between TCP and UDP.",
  "How would you design a URL shortener?",
  "Write a function to detect a cycle in a linked list.",
  "How do you handle disagreements with teammates?",
];

export const twoSumProblem = {
  id: "P-1",
  title: "Two Sum",
  difficulty: "Easy",
  acceptance: 52,
  statement:
    "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target. You may assume that each input would have exactly one solution, and you may not use the same element twice.",
  examples: [
    { input: "nums = [2,7,11,15], target = 9", output: "[0,1]" },
    { input: "nums = [3,2,4], target = 6", output: "[1,2]" },
  ],
  starter: {
    python: "def two_sum(nums, target):\n    # Write your code here\n    pass",
    javascript: "function twoSum(nums, target) {\n  // Write your code here\n}",
    java: "class Solution {\n  public int[] twoSum(int[] nums, int target) {\n    // Write your code here\n  }\n}",
    cpp: "vector<int> twoSum(vector<int>& nums, int target) {\n  // Write your code here\n}",
  },
};
