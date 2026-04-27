const STORAGE_KEY = "student-attendance-system-v1";
const ATTENDANCE_STATES = ["present", "late", "absent", "excused"];

const state = loadState();

const studentForm = document.getElementById("studentForm");
const studentIdInput = document.getElementById("studentId");
const studentNameInput = document.getElementById("studentName");
const studentClassInput = document.getElementById("studentClass");
const attendanceDateInput = document.getElementById("attendanceDate");
const todayLabel = document.getElementById("todayLabel");
const studentTableBody = document.getElementById("studentTableBody");
const emptyState = document.getElementById("emptyState");
const studentCountLabel = document.getElementById("studentCountLabel");
const presentCount = document.getElementById("presentCount");
const lateCount = document.getElementById("lateCount");
const absentCount = document.getElementById("absentCount");
const attendanceRate = document.getElementById("attendanceRate");
const summaryList = document.getElementById("summaryList");
const exportBtn = document.getElementById("exportBtn");
const resetDayBtn = document.getElementById("resetDayBtn");
const summaryItemTemplate = document.getElementById("summaryItemTemplate");

initialize();

function initialize() {
  const today = formatDate(new Date());
  state.selectedDate = state.selectedDate || today;
  attendanceDateInput.value = state.selectedDate;
  todayLabel.textContent = new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  studentForm.addEventListener("submit", handleAddStudent);
  attendanceDateInput.addEventListener("change", handleDateChange);
  exportBtn.addEventListener("click", exportCsv);
  resetDayBtn.addEventListener("click", resetSelectedDay);

  render();
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        students: [],
        attendance: {},
        selectedDate: "",
      };
    }

    const parsed = JSON.parse(raw);
    return {
      students: Array.isArray(parsed.students) ? parsed.students : [],
      attendance: parsed.attendance && typeof parsed.attendance === "object" ? parsed.attendance : {},
      selectedDate: typeof parsed.selectedDate === "string" ? parsed.selectedDate : "",
    };
  } catch (error) {
    console.error("Failed to load attendance data:", error);
    return {
      students: [],
      attendance: {},
      selectedDate: "",
    };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function handleAddStudent(event) {
  event.preventDefault();

  const id = studentIdInput.value.trim();
  const name = studentNameInput.value.trim();
  const className = studentClassInput.value.trim();

  if (!id || !name || !className) {
    return;
  }

  const duplicate = state.students.some(
    (student) => student.id.toLowerCase() === id.toLowerCase()
  );

  if (duplicate) {
    alert("That student ID already exists. Please use a unique ID.");
    studentIdInput.focus();
    return;
  }

  state.students.push({
    id,
    name,
    className,
    createdAt: Date.now(),
  });

  saveState();
  studentForm.reset();
  studentIdInput.focus();
  render();
}

function handleDateChange(event) {
  state.selectedDate = event.target.value;
  saveState();
  render();
}

function getSelectedDateAttendance() {
  return state.attendance[state.selectedDate] || {};
}

function setAttendance(studentId, status) {
  if (!state.attendance[state.selectedDate]) {
    state.attendance[state.selectedDate] = {};
  }

  state.attendance[state.selectedDate][studentId] = status;
  saveState();
  renderStats();
  renderTable();
  renderSummary();
}

function deleteStudent(studentId) {
  const shouldDelete = window.confirm("Remove this student and all related attendance records?");
  if (!shouldDelete) {
    return;
  }

  state.students = state.students.filter((student) => student.id !== studentId);

  Object.values(state.attendance).forEach((dailyRecord) => {
    delete dailyRecord[studentId];
  });

  saveState();
  render();
}

function resetSelectedDay() {
  if (!state.selectedDate) {
    return;
  }

  const shouldReset = window.confirm("Clear all attendance entries for the selected date?");
  if (!shouldReset) {
    return;
  }

  delete state.attendance[state.selectedDate];
  saveState();
  render();
}

function render() {
  renderTable();
  renderStats();
  renderSummary();
}

function renderTable() {
  const dailyAttendance = getSelectedDateAttendance();
  const sortedStudents = [...state.students].sort((a, b) => a.name.localeCompare(b.name));

  studentTableBody.innerHTML = "";

  if (!sortedStudents.length) {
    emptyState.classList.add("is-visible");
  } else {
    emptyState.classList.remove("is-visible");
  }

  sortedStudents.forEach((student, index) => {
    const row = document.createElement("tr");
    row.className = "fade-in";
    row.style.animationDelay = `${index * 40}ms`;

    const status = dailyAttendance[student.id] || "";
    row.innerHTML = `
      <td data-label="ID">${student.id}</td>
      <td data-label="Name">${student.name}</td>
      <td data-label="Class">${student.className}</td>
      <td data-label="Status"></td>
      <td data-label="Actions"></td>
    `;

    const statusCell = row.children[3];
    const actionsCell = row.children[4];

    const statusBadges = document.createElement("div");
    statusBadges.className = "status-badges";

    ATTENDANCE_STATES.forEach((attendanceState) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "status-pill";
      button.dataset.status = attendanceState;
      button.textContent = toTitleCase(attendanceState);
      if (attendanceState === status) {
        button.classList.add("is-active");
      }
      button.addEventListener("click", () => setAttendance(student.id, attendanceState));
      statusBadges.appendChild(button);
    });

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "link-button";
    removeButton.textContent = "Remove";
    removeButton.addEventListener("click", () => deleteStudent(student.id));

    const clearButton = document.createElement("button");
    clearButton.type = "button";
    clearButton.className = "link-button";
    clearButton.textContent = "Clear";
    clearButton.addEventListener("click", () => clearStudentAttendance(student.id));

    const actions = document.createElement("div");
    actions.className = "row-actions";
    actions.append(removeButton, clearButton);

    statusCell.appendChild(statusBadges);
    actionsCell.appendChild(actions);
    studentTableBody.appendChild(row);
  });

  studentCountLabel.textContent = `${state.students.length} student${state.students.length === 1 ? "" : "s"}`;
}

function clearStudentAttendance(studentId) {
  const dailyRecord = state.attendance[state.selectedDate];
  if (!dailyRecord) {
    return;
  }

  delete dailyRecord[studentId];

  if (!Object.keys(dailyRecord).length) {
    delete state.attendance[state.selectedDate];
  }

  saveState();
  render();
}

function renderStats() {
  const dailyRecord = getSelectedDateAttendance();
  const counts = {
    present: 0,
    late: 0,
    absent: 0,
    excused: 0,
  };

  state.students.forEach((student) => {
    const status = dailyRecord[student.id];
    if (counts[status] !== undefined) {
      counts[status] += 1;
    }
  });

  const rateBase = counts.present + counts.late + counts.excused;
  const rate = state.students.length
    ? Math.round((rateBase / state.students.length) * 100)
    : 0;

  presentCount.textContent = String(counts.present);
  lateCount.textContent = String(counts.late);
  absentCount.textContent = String(counts.absent);
  attendanceRate.textContent = `${rate}%`;
}

function renderSummary() {
  summaryList.innerHTML = "";

  const summaries = buildSummaryData();
  summaries.forEach((summary) => {
    const fragment = summaryItemTemplate.content.cloneNode(true);
    fragment.querySelector("h3").textContent = summary.title;
    fragment.querySelector("p").textContent = summary.caption;
    fragment.querySelector("strong").textContent = summary.value;
    summaryList.appendChild(fragment);
  });
}

function buildSummaryData() {
  const totalStudents = state.students.length;
  const uniqueDays = Object.keys(state.attendance).length;
  const totalEntries = Object.values(state.attendance).reduce(
    (count, dailyRecord) => count + Object.keys(dailyRecord).length,
    0
  );

  let bestStudent = { name: "No data", rate: 0 };

  if (totalStudents) {
    bestStudent = state.students.reduce(
      (best, student) => {
        const stats = getStudentAttendanceStats(student.id);
        if (stats.trackedDays === 0) {
          return best;
        }
        return stats.rate > best.rate ? { name: student.name, rate: stats.rate } : best;
      },
      { name: "No data", rate: 0 }
    );
  }

  return [
    {
      title: "Registered Students",
      caption: "Total students in the class roster.",
      value: String(totalStudents),
    },
    {
      title: "Tracked Days",
      caption: "Dates with at least one attendance entry.",
      value: String(uniqueDays),
    },
    {
      title: "Total Marked Records",
      caption: "Attendance actions saved across all dates.",
      value: String(totalEntries),
    },
    {
      title: "Best Attendance",
      caption: bestStudent.name === "No data"
        ? "Add attendance records to generate top performance."
        : `${bestStudent.name} has the strongest overall record.`,
      value: bestStudent.name === "No data" ? "--" : `${bestStudent.rate}%`,
    },
  ];
}

function getStudentAttendanceStats(studentId) {
  let trackedDays = 0;
  let attendedDays = 0;

  Object.values(state.attendance).forEach((dailyRecord) => {
    if (!dailyRecord[studentId]) {
      return;
    }

    trackedDays += 1;
    if (dailyRecord[studentId] !== "absent") {
      attendedDays += 1;
    }
  });

  return {
    trackedDays,
    rate: trackedDays ? Math.round((attendedDays / trackedDays) * 100) : 0,
  };
}

function exportCsv() {
  const rows = [["Date", "Student ID", "Student Name", "Class", "Status"]];

  const studentsById = Object.fromEntries(
    state.students.map((student) => [student.id, student])
  );

  Object.keys(state.attendance)
    .sort()
    .forEach((date) => {
      const dailyRecord = state.attendance[date];
      Object.entries(dailyRecord).forEach(([studentId, status]) => {
        const student = studentsById[studentId];
        if (!student) {
          return;
        }
        rows.push([date, student.id, student.name, student.className, status]);
      });
    });

  const csvContent = rows
    .map((row) => row.map(escapeCsvField).join(","))
    .join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "attendance-records.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function escapeCsvField(value) {
  const stringValue = String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toTitleCase(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
