// File: server.js
const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const bcrypt = require("bcrypt");
const dotenv = require("dotenv");
const path = require("path");

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.API_HOST || "localhost";

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "frontend")));
// Serve the index.html for the root path
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "frontend", "index.html"));
});

// Database connection
const db = mysql.createConnection({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "password",
  database: process.env.DB_NAME || "taskalert",
});

// Connect to database
db.connect((err) => {
  if (err) {
    console.error("Error connecting to the database:", err);
    return;
  }
  console.log("Connected to MySQL database");
});

// Routes

// User authentication
app.post("/api/auth/register", async (req, res) => {
  const { username, password, email } = req.body;

  if (!username || !password) {
    return res
      .status(400)
      .json({ message: "Username and password are required" });
  }

  try {
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user into database
    db.query(
      "INSERT INTO users (username, password, email) VALUES (?, ?, ?)",
      [username, hashedPassword, email],
      (err, results) => {
        if (err) {
          if (err.code === "ER_DUP_ENTRY") {
            return res
              .status(409)
              .json({ message: "Username or email already exists" });
          }
          return res
            .status(500)
            .json({ message: "Error creating user", error: err.message });
        }

        const userId = results.insertId;

        // Create initial player stats for new user
        db.query(
          "INSERT INTO player_stats (user_id) VALUES (?)",
          [userId],
          (statsErr) => {
            if (statsErr) {
              return res.status(500).json({
                message: "Error creating player stats",
                error: statsErr.message,
              });
            }

            res
              .status(201)
              .json({ message: "User registered successfully", userId });
          }
        );
      }
    );
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res
      .status(400)
      .json({ message: "Username and password are required" });
  }

  // Find user in database
  db.query(
    "SELECT * FROM users WHERE username = ?",
    [username],
    async (err, results) => {
      if (err) {
        return res
          .status(500)
          .json({ message: "Server error", error: err.message });
      }

      if (results.length === 0) {
        return res
          .status(401)
          .json({ message: "Invalid username or password" });
      }

      const user = results[0];

      // Compare passwords
      const match = await bcrypt.compare(password, user.password);

      if (!match) {
        return res
          .status(401)
          .json({ message: "Invalid username or password" });
      }

      // For simplicity, we're sending user ID. In a real app, you'd send a JWT token
      res.json({ message: "Login successful", userId: user.user_id });
    }
  );
});

// Player stats routes
app.get("/api/stats/:userId", (req, res) => {
  const userId = req.params.userId;

  db.query(
    "SELECT level, xp, next_level_xp, completed_tasks FROM player_stats WHERE user_id = ?",
    [userId],
    (err, results) => {
      if (err) {
        return res
          .status(500)
          .json({ message: "Server error", error: err.message });
      }

      if (results.length === 0) {
        return res.status(404).json({ message: "Stats not found" });
      }

      res.json(results[0]);
    }
  );
});

app.put("/api/stats/:userId", (req, res) => {
  const userId = req.params.userId;
  const { level, xp, next_level_xp, completed_tasks } = req.body;

  db.query(
    "UPDATE player_stats SET level = ?, xp = ?, next_level_xp = ?, completed_tasks = ? WHERE user_id = ?",
    [level, xp, next_level_xp, completed_tasks, userId],
    (err, results) => {
      if (err) {
        return res
          .status(500)
          .json({ message: "Server error", error: err.message });
      }

      if (results.affectedRows === 0) {
        return res.status(404).json({ message: "Stats not found" });
      }

      res.json({ message: "Stats updated successfully" });
    }
  );
});

// Task routes
app.get("/api/tasks/:userId", (req, res) => {
  const userId = req.params.userId;

  db.query(
    "SELECT * FROM tasks WHERE user_id = ? ORDER BY completed ASC, due_date ASC",
    [userId],
    (err, results) => {
      if (err) {
        return res
          .status(500)
          .json({ message: "Server error", error: err.message });
      }

      res.json(results);
    }
  );
});

app.post("/api/tasks", (req, res) => {
  const { user_id, title, due_date, reminder_time, priority } = req.body;

  if (!user_id || !title || !due_date || !reminder_time) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  db.query(
    "INSERT INTO tasks (user_id, title, due_date, reminder_time, priority) VALUES (?, ?, ?, ?, ?)",
    [user_id, title, due_date, reminder_time, priority || "medium"],
    (err, results) => {
      if (err) {
        return res
          .status(500)
          .json({ message: "Server error", error: err.message });
      }

      res.status(201).json({
        message: "Task created successfully",
        taskId: results.insertId,
      });
    }
  );
});

app.put("/api/tasks/:taskId", (req, res) => {
  const taskId = req.params.taskId;
  const { title, due_date, reminder_time, priority, completed } = req.body;

  const updateFields = [];
  const updateValues = [];

  if (title !== undefined) {
    updateFields.push("title = ?");
    updateValues.push(title);
  }

  if (due_date !== undefined) {
    updateFields.push("due_date = ?");
    updateValues.push(due_date);
  }

  if (reminder_time !== undefined) {
    updateFields.push("reminder_time = ?");
    updateValues.push(reminder_time);
  }

  if (priority !== undefined) {
    updateFields.push("priority = ?");
    updateValues.push(priority);
  }

  if (completed !== undefined) {
    updateFields.push("completed = ?");
    updateValues.push(completed);
  }

  if (updateFields.length === 0) {
    return res.status(400).json({ message: "No fields to update" });
  }

  updateValues.push(taskId);

  db.query(
    `UPDATE tasks SET ${updateFields.join(", ")} WHERE task_id = ?`,
    updateValues,
    (err, results) => {
      if (err) {
        return res
          .status(500)
          .json({ message: "Server error", error: err.message });
      }

      if (results.affectedRows === 0) {
        return res.status(404).json({ message: "Task not found" });
      }

      res.json({ message: "Task updated successfully" });
    }
  );
});

app.delete("/api/tasks/:taskId", (req, res) => {
  const taskId = req.params.taskId;

  db.query("DELETE FROM tasks WHERE task_id = ?", [taskId], (err, results) => {
    if (err) {
      return res
        .status(500)
        .json({ message: "Server error", error: err.message });
    }

    if (results.affectedRows === 0) {
      return res.status(404).json({ message: "Task not found" });
    }

    res.json({ message: "Task deleted successfully" });
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
});
