// TaskAlert - Gamified Task Management Application
document.addEventListener("DOMContentLoaded", function () {
  // DOM Elements
  const taskForm = document.getElementById("new-task-form");
  const taskInput = document.getElementById("task-input");
  const dueDateInput = document.getElementById("due-date");
  const reminderTimeInput = document.getElementById("reminder-time");
  const prioritySelect = document.getElementById("priority");
  const taskList = document.getElementById("task-list");
  const emptyListMessage = document.getElementById("empty-list");
  const taskTemplate = document.getElementById("task-template");
  const filterButtons = document.querySelectorAll(".filter-btn");

  // Modal Elements
  const editModal = document.getElementById("edit-modal");
  const editForm = document.getElementById("edit-task-form");
  const editTaskInput = document.getElementById("edit-task-input");
  const editDueDateInput = document.getElementById("edit-due-date");
  const editReminderTimeInput = document.getElementById("edit-reminder-time");
  const editPrioritySelect = document.getElementById("edit-priority");
  const editTaskId = document.getElementById("edit-task-id");
  const closeModalBtn = document.querySelector(".close-modal");

  // API URL - change this to your EC2 instance when deployed
  const API_URL = "http://localhost:3000/api";

  // Current user - would be set after login
  let currentUserId = 1; // Default to test user for now

  // Current filter state
  let currentFilter = "all";

  // Set default date to today
  const today = new Date();
  const formattedDate = today.toISOString().substr(0, 10);
  dueDateInput.value = formattedDate;

  // Tasks array
  let tasks = [];

  // Player stats
  let playerStats = {
    level: 1,
    xp: 0,
    nextLevelXp: 100,
    completedTasks: 0,
  };

  // Initialize app
  init();

  // Event Listeners
  taskForm.addEventListener("submit", addTask);
  taskList.addEventListener("click", handleTaskAction);
  editForm.addEventListener("submit", updateTask);
  closeModalBtn.addEventListener("click", closeModal);

  // Add event listeners to filter buttons
  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      // Update active class
      filterButtons.forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");

      // Set current filter
      currentFilter = button.dataset.filter;

      // Apply filter
      renderTasks();
    });
  });

  // Initialize app
  async function init() {
    try {
      // Fetch tasks from API
      await fetchTasks();

      // Fetch player stats
      await fetchPlayerStats();

      // Initialize reminder checking
      checkReminders();

      // Check for reminders every minute
      setInterval(checkReminders, 60000);
    } catch (error) {
      console.error("Error initializing app:", error);
      showGameNotification(
        "Error connecting to server. Please try again later.",
        "warning"
      );
    }
  }

  // API Functions
  async function fetchTasks() {
    try {
      const response = await fetch(`${API_URL}/tasks/${currentUserId}`);
      if (!response.ok) {
        throw new Error("Error fetching tasks");
      }
      tasks = await response.json();
      renderTasks();
    } catch (error) {
      console.error("Error fetching tasks:", error);
      showGameNotification(
        "Error loading tasks. Please refresh the page.",
        "warning"
      );
    }
  }

  async function fetchPlayerStats() {
    try {
      const response = await fetch(`${API_URL}/stats/${currentUserId}`);
      if (!response.ok) {
        throw new Error("Error fetching player stats");
      }
      playerStats = await response.json();
    } catch (error) {
      console.error("Error fetching player stats:", error);
      // Use default stats if error
    }
  }

  async function updatePlayerStats() {
    try {
      const response = await fetch(`${API_URL}/stats/${currentUserId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(playerStats),
      });

      if (!response.ok) {
        throw new Error("Error updating player stats");
      }
    } catch (error) {
      console.error("Error updating player stats:", error);
      showGameNotification(
        "Error saving progress. Please try again.",
        "warning"
      );
    }
  }

  // Functions
  async function addTask(e) {
    e.preventDefault();

    // Play sound effect
    playSound("add");

    const task = {
      user_id: currentUserId,
      title: taskInput.value,
      due_date: dueDateInput.value,
      reminder_time: reminderTimeInput.value,
      priority: prioritySelect.value,
    };

    try {
      const response = await fetch(`${API_URL}/tasks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(task),
      });

      if (!response.ok) {
        throw new Error("Error adding task");
      }

      const result = await response.json();

      // Add task ID from server response
      task.task_id = result.taskId;
      task.completed = false;
      task.id = `quest-${task.task_id}`; // To maintain compatibility with existing code

      tasks.push(task);

      // Reset form
      taskForm.reset();
      dueDateInput.value = formattedDate;

      // Update UI
      renderTasks();

      // Show success message
      showGameNotification("New quest added to your log!", "quest");
    } catch (error) {
      console.error("Error adding task:", error);
      showGameNotification("Error adding quest. Please try again.", "warning");
    }
  }

  function renderTasks() {
    // Clear current list
    taskList.innerHTML = "";

    // Filter tasks based on current filter
    let filteredTasks = filterTasks(tasks, currentFilter);

    // Sort tasks: incomplete first, then by due date, then by priority
    filteredTasks.sort((a, b) => {
      // First sort by completion status
      if (a.completed !== b.completed) {
        return a.completed ? 1 : -1;
      }

      // Then by due date
      const dateA = new Date(a.due_date);
      const dateB = new Date(b.due_date);
      if (dateA.getTime() !== dateB.getTime()) {
        return dateA - dateB;
      }

      // Then by priority (high to low)
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    // Show or hide empty message
    if (filteredTasks.length === 0) {
      emptyListMessage.style.display = "block";
    } else {
      emptyListMessage.style.display = "none";

      // Add tasks to list
      filteredTasks.forEach((task) => {
        const taskElement = createTaskElement(task);
        taskList.appendChild(taskElement);
      });
    }
  }

  function createTaskElement(task) {
    // Clone template
    const taskElement = document
      .importNode(taskTemplate.content, true)
      .querySelector(".task-item");

    // Set task attributes
    taskElement.dataset.id = task.id || `quest-${task.task_id}`;
    if (task.completed) {
      taskElement.classList.add("completed");
    }

    // Set task content
    const checkbox = taskElement.querySelector(".task-checkbox");
    checkbox.checked = task.completed;

    const title = taskElement.querySelector(".task-title");
    title.textContent = task.title;

    const dueDate = taskElement.querySelector(".task-due");
    const formattedDate = formatDate(task.due_date);
    dueDate.innerHTML = `<i class="fas fa-hourglass-half"></i> ${formattedDate}`;

    const reminderTime = taskElement.querySelector(".task-reminder");
    reminderTime.innerHTML = `<i class="fas fa-bell"></i> ${formatTime(
      task.reminder_time
    )}`;

    const priorityElement = taskElement.querySelector(".task-priority");
    priorityElement.dataset.priority = task.priority;

    // Add difficulty labels based on priority
    let difficultyLabel = "";
    switch (task.priority) {
      case "low":
        difficultyLabel = "Easy";
        break;
      case "medium":
        difficultyLabel = "Medium";
        break;
      case "high":
        difficultyLabel = "Boss Level";
        break;
    }

    // Add difficulty tooltip
    priorityElement.title = difficultyLabel;

    return taskElement;
  }

  async function handleTaskAction(e) {
    const taskItem = e.target.closest(".task-item");
    if (!taskItem) return;

    const taskId = taskItem.dataset.id;
    const numericTaskId = taskId.replace("quest-", "");
    const task = tasks.find(
      (t) => t.id === taskId || t.task_id == numericTaskId
    );

    if (e.target.classList.contains("task-checkbox")) {
      // Toggle completion status
      const completed = e.target.checked;

      try {
        const response = await fetch(`${API_URL}/tasks/${task.task_id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ completed }),
        });

        if (!response.ok) {
          throw new Error("Error updating task");
        }

        // Update local task
        task.completed = completed;

        if (task.completed) {
          // Play completion sound
          playSound("complete");

          taskItem.classList.add("completed");

          // Award XP based on priority
          let xpGained = 0;
          switch (task.priority) {
            case "low":
              xpGained = 10;
              break;
            case "medium":
              xpGained = 20;
              break;
            case "high":
              xpGained = 40;
              break;
          }

          // Update stats
          playerStats.xp += xpGained;
          playerStats.completed_tasks += 1;

          // Check for level up
          if (playerStats.xp >= playerStats.next_level_xp) {
            levelUp();
          } else {
            // Show XP notification
            showGameNotification(`Quest completed! +${xpGained} XP`, "xp");
          }

          updatePlayerStats();
        } else {
          // Task unchecked
          taskItem.classList.remove("completed");
          playSound("uncheck");

          // Subtract XP if unchecking (optional game mechanic)
          let xpLost = 0;
          switch (task.priority) {
            case "low":
              xpLost = 5;
              break;
            case "medium":
              xpLost = 10;
              break;
            case "high":
              xpLost = 20;
              break;
          }

          // Only subtract if player has enough XP
          if (playerStats.xp >= xpLost) {
            playerStats.xp -= xpLost;
            playerStats.completed_tasks -= 1;
            updatePlayerStats();
            showGameNotification(`Quest abandoned! -${xpLost} XP`, "warning");
          }
        }
      } catch (error) {
        console.error("Error updating task completion:", error);
        showGameNotification(
          "Error updating quest. Please try again.",
          "warning"
        );
        // Revert checkbox state
        e.target.checked = !completed;
      }
    } else if (e.target.closest(".edit-task")) {
      // Open edit modal
      playSound("click");
      openEditModal(task);
    } else if (e.target.closest(".delete-task")) {
      // Delete task with confirmation
      playSound("click");
      if (confirm("Are you sure you want to abandon this quest?")) {
        try {
          const response = await fetch(`${API_URL}/tasks/${task.task_id}`, {
            method: "DELETE",
          });

          if (!response.ok) {
            throw new Error("Error deleting task");
          }

          tasks = tasks.filter(
            (t) => t.id !== taskId && t.task_id != numericTaskId
          );
          renderTasks();
          playSound("delete");
          showGameNotification("Quest removed from your log!", "warning");
        } catch (error) {
          console.error("Error deleting task:", error);
          showGameNotification(
            "Error removing quest. Please try again.",
            "warning"
          );
        }
      }
    }
  }

  function openEditModal(task) {
    // Fill form with task data
    editTaskId.value = task.task_id;
    editTaskInput.value = task.title;
    editDueDateInput.value = task.due_date;
    editReminderTimeInput.value = task.reminder_time;
    editPrioritySelect.value = task.priority;

    // Show modal
    editModal.style.display = "block";
  }

  function closeModal() {
    playSound("click");
    editModal.style.display = "none";
  }

  async function updateTask(e) {
    e.preventDefault();

    const taskId = editTaskId.value;
    const task = tasks.find((t) => t.task_id == taskId);

    if (task) {
      const updatedTask = {
        title: editTaskInput.value,
        due_date: editDueDateInput.value,
        reminder_time: editReminderTimeInput.value,
        priority: editPrioritySelect.value,
      };

      try {
        const response = await fetch(`${API_URL}/tasks/${taskId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updatedTask),
        });

        if (!response.ok) {
          throw new Error("Error updating task");
        }

        // Update local task
        task.title = updatedTask.title;
        task.due_date = updatedTask.due_date;
        task.reminder_time = updatedTask.reminder_time;
        task.priority = updatedTask.priority;

        renderTasks();
        closeModal();
        playSound("update");
        showGameNotification("Quest details updated!", "update");
      } catch (error) {
        console.error("Error updating task:", error);
        showGameNotification(
          "Error updating quest. Please try again.",
          "warning"
        );
      }
    }
  }

  function filterTasks(tasks, filter) {
    const today = new Date().toISOString().substr(0, 10);

    switch (filter) {
      case "today":
        return tasks.filter((task) => task.due_date === today);
      case "upcoming":
        return tasks.filter((task) => task.due_date > today);
      case "completed":
        return tasks.filter((task) => task.completed);
      default:
        return tasks;
    }
  }

  function checkReminders() {
    const now = new Date();
    const currentTime = now.toTimeString().substr(0, 5);
    const currentDate = now.toISOString().substr(0, 10);

    tasks.forEach((task) => {
      if (
        !task.completed &&
        task.due_date === currentDate &&
        task.reminder_time === currentTime
      ) {
        playSound("alert");
        showGameNotification(
          `Reminder: "${task.title}" is due soon!`,
          "alert",
          true
        );
      }
    });
  }

  function levelUp() {
    // Calculate new level
    playerStats.level += 1;

    // Set new XP threshold (increases with each level)
    playerStats.next_level_xp = Math.floor(playerStats.next_level_xp * 1.5);

    // Save updated stats
    updatePlayerStats();

    // Play level up sound
    playSound("levelup");

    // Show level up notification
    showGameNotification(
      `LEVEL UP! You reached level ${playerStats.level}!`,
      "levelup"
    );
  }

  function showGameNotification(message, type = "info", isAlert = false) {
    if (isAlert && "Notification" in window) {
      // Request permission and show system notification
      Notification.requestPermission().then((permission) => {
        if (permission === "granted") {
          new Notification("TaskAlert Quest Reminder", {
            body: message,
            icon: "https://cdn-icons-png.flaticon.com/512/2098/2098402.png",
          });
        }
      });
    }

    // Create toast notification
    const toast = document.createElement("div");
    toast.className = "toast-notification";
    toast.classList.add(`toast-${type}`);

    // Add icon based on notification type
    let icon = "";
    switch (type) {
      case "xp":
        icon = '<i class="fas fa-star"></i> ';
        break;
      case "levelup":
        icon = '<i class="fas fa-trophy"></i> ';
        break;
      case "quest":
        icon = '<i class="fas fa-scroll"></i> ';
        break;
      case "alert":
        icon = '<i class="fas fa-exclamation-circle"></i> ';
        break;
      case "warning":
        icon = '<i class="fas fa-skull"></i> ';
        break;
      case "update":
        icon = '<i class="fas fa-magic"></i> ';
        break;
      default:
        icon = '<i class="fas fa-info-circle"></i> ';
    }

    toast.innerHTML = icon + message;

    // Add toast to body
    document.body.appendChild(toast);

    // Show toast
    setTimeout(() => {
      toast.classList.add("show");
    }, 100);

    // Remove toast after 3 seconds
    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => {
        document.body.removeChild(toast);
      }, 300);
    }, 3000);
  }

  // sound effect {NOT USED}
  function playSound(soundType) {
    // Function left intentionally empty - no sound implementation needed
    console.log(`Sound event: ${soundType}`); // Uncomment for debugging
  }

  // Helper functions
  function formatDate(dateString) {
    const options = { year: "numeric", month: "short", day: "numeric" };
    return new Date(dateString).toLocaleDateString(undefined, options);
  }

  function formatTime(timeString) {
    // Convert 24h to 12h format
    const [hours, minutes] = timeString.split(":");
    const period = hours >= 12 ? "PM" : "AM";
    const hour12 = hours % 12 || 12;
    return `${hour12}:${minutes} ${period}`;
  }
});
