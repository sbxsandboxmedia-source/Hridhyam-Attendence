import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  setDoc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA6lgURVq3E3u1g9dMeI91Rb7f4-_hdyk",
  authDomain: "hridhyam-creation-hrms.firebaseapp.com",
  projectId: "hridhyam-creation-hrms",
  storageBucket: "hridhyam-creation-hrms.firebasestorage.app",
  messagingSenderId: "205696907789",
  appId: "1:205696907789:web:008e9b4e706616fff07344",
  measurementId: "G-YG704YEB37"
};

const ADMIN_PASSWORD = "admin123";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);


let employees = [];
let records = [];
let leaves = [];
let workUpdates = [];
let tasks = [];
let notes = [];
let departments = [];
let announcements = [];
let documentsList = [];
let payrolls = [];

let currentEmployee = null;
let myTaskMode = "today";
let messages = [];
let settings = {
  officeStartTime: "10:00",
  allowedBreakMinutes: 30,
  monthlyLeaveLimit: 2
};

let filterDate = "";
let filterMonth = "";

const $ = id => document.getElementById(id);
const nowISO = () => new Date().toISOString();
const todayKey = () => new Date().toLocaleDateString("en-CA");
const monthKey = () => todayKey().slice(0, 7);

function showTime(iso) {
  return iso ? new Date(iso).toLocaleTimeString("en-IN") : "-";
}

function minutesBetween(start, end) {
  if (!start || !end) return 0;
  return Math.max(0, Math.floor((new Date(end) - new Date(start)) / 60000));
}

function fmt(min) {
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

function calcBreak(breaks = []) {
  return breaks.reduce((sum, b) => sum + minutesBetween(b.start, b.end), 0);
}

function calcWorking(r) {
  if (!r.exit) return "-";
  const total = minutesBetween(r.entry, r.exit);
  const breakMin = calcBreak(r.breaks || []);
  return fmt(Math.max(0, total - breakMin));
}

function getOpenRecord(empId) {
  return records.find(r => r.empId === empId && r.date === todayKey() && !r.exit);
}

function isLate(r) {
  if (!r.entry) return false;
  const [h, m] = settings.officeStartTime.split(":").map(Number);
  const limit = new Date(r.entry);
  limit.setHours(h, m, 0, 0);
  return new Date(r.entry) > limit;
}
function lateMinutes(r) {
  if (!r.entry) return 0;

  const [h, m] = settings.officeStartTime.split(":").map(Number);
  const limit = new Date(r.entry);
  limit.setHours(h, m, 0, 0);

  const diff = Math.floor((new Date(r.entry) - limit) / 60000);
  return Math.max(0, diff);
}
function isLateBreak(r) {
  return calcBreak(r.breaks || []) > Number(settings.allowedBreakMinutes || 30);
}

function empLeaveLimit(empId) {
  const emp = employees.find(e => e.id === empId);
  return Number(emp?.leaveLimit || settings.monthlyLeaveLimit || 2);
}

function approvedLeaves(empId, month) {
  return leaves.filter(l =>
    l.empId === empId &&
    l.status === "Approved" &&
    l.date?.startsWith(month)
  ).length;
}

function payrollFor(empId, month) {
  return payrolls.find(p => p.empId === empId && p.month === month) || {
    bonus: 0,
    deduction: 0
  };
}

function filtered(list) {
  return list.filter(x => {
    if (filterDate) return x.date === filterDate;
    if (filterMonth) return x.date?.startsWith(filterMonth);
    return true;
  });
}

async function loadSettings() {
  const ref = doc(db, "settings", "main");
  const snap = await getDoc(ref);

  if (snap.exists()) {
    settings = { ...settings, ...snap.data() };
  }

  renderAll();
}

loadSettings();

onSnapshot(collection(db, "employees"), snap => {
  employees = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderAll();
});

onSnapshot(query(collection(db, "departments"), orderBy("createdAt")), snap => {
    departments = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));

    setOptions();
    renderDepartmentOverview();
});

onSnapshot(query(collection(db, "attendance"), orderBy("createdAt", "desc")), snap => {
  records = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderAll();
});

onSnapshot(query(collection(db, "leaves"), orderBy("createdAt", "desc")), snap => {
  leaves = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderAll();
});

onSnapshot(query(collection(db, "workUpdates"), orderBy("createdAt", "desc")), snap => {
  workUpdates = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderAll();
});

onSnapshot(query(collection(db, "tasks"), orderBy("createdAt", "desc")), snap => {
  tasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderAll();
});

onSnapshot(query(collection(db, "adminNotes"), orderBy("createdAt", "desc")), snap => {
  notes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderAll();
});

onSnapshot(query(collection(db, "announcements"), orderBy("createdAt", "desc")), snap => {
  announcements = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderAll();
});

onSnapshot(query(collection(db, "documents"), orderBy("createdAt", "desc")), snap => {
  documentsList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderAll();
});

onSnapshot(query(collection(db, "payrolls"), orderBy("createdAt", "desc")), snap => {
  payrolls = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderAll();
});

window.login = function () {
  const role = $("role").value;

  if (role === "admin") {
    if ($("adminPassword").value !== ADMIN_PASSWORD) {
      alert("Wrong admin password");
      return;
    }

    $("loginBox").classList.add("hidden");
    $("adminPanel").classList.remove("hidden");
    renderAll();
    return;
  }

  const code = $("employeeCode").value.trim();
  const pin = $("employeePin").value.trim();

  const emp = employees.find(e =>
    e.code === code &&
    String(e.pin || "") === pin &&
    e.active !== false
  );

  if (!emp) {
    alert("Employee code ya PIN galat hai");
    return;
  }

  currentEmployee = emp;
  $("employeeWelcome").innerText = `Welcome, ${emp.name}`;
  $("loginBox").classList.add("hidden");
  $("employeePanel").classList.remove("hidden");
  renderAll();
};

window.logout = function () {
  location.reload();
};

window.saveSettings = async function () {
  settings = {
    officeStartTime: $("officeStartTime").value || "10:00",
    allowedBreakMinutes: Number($("allowedBreakMinutes").value || 30),
    monthlyLeaveLimit: Number($("monthlyLeaveLimit").value || 2)
  };

  await setDoc(doc(db, "settings", "main"), settings);
  alert("Settings saved");
};

window.addEmployee = async function () {
  const name = $("newEmpName").value.trim();
  const code = $("newEmpCode").value.trim();
  const pin = $("newEmpPin").value.trim();

  if (!name || !code || !pin) {
    alert("Name, Code aur PIN zaroori hai");
    return;
  }

  if (employees.some(e => e.code === code)) {
    alert("Ye employee code already hai");
    return;
  }

  await addDoc(collection(db, "employees"), {
    name,
    code,
    pin,
    designation: $("newEmpDesignation").value.trim(),
    department: Array.from(document.querySelectorAll("#newEmpDepartment input:checked")).map(o => o.value).join(", "),
departments: Array.from(document.querySelectorAll("#newEmpDepartment input:checked")).map(o => o.value),
    dob: $("newEmpDOB").value,
    salary: Number($("newEmpSalary").value || 0),
    leaveLimit: Number($("newEmpLeaveLimit").value || settings.monthlyLeaveLimit || 2),
    photo: $("newEmpPhoto").value.trim(),
    active: true,
    createdAt: nowISO()
  });

  [
    "newEmpName",
    "newEmpCode",
    "newEmpPin",
    "newEmpDesignation",
    "newEmpDepartment",
    "newEmpDOB",
    "newEmpSalary",
    "newEmpLeaveLimit",
    "newEmpPhoto"
  ].forEach(id => $(id).value = "");
};

window.deleteEmployee = async function (id) {
  if (confirm("Employee delete karna hai?")) {
    await deleteDoc(doc(db, "employees", id));
  }
};

window.toggleEmployee = async function (id, active) {
  await updateDoc(doc(db, "employees", id), {
    active: !active
  });
};

window.markEntry = async function () {
  if (!currentEmployee) return;

  if (getOpenRecord(currentEmployee.id)) {
    alert("Aaj entry already active hai");
    return;
  }

  await addDoc(collection(db, "attendance"), {
    empId: currentEmployee.id,
    name: currentEmployee.name,
    date: todayKey(),
    entry: nowISO(),
    exit: "",
    breaks: [],
    createdAt: nowISO()
  });

  alert("Entry marked");
};

window.startBreak = async function () {
  const r = getOpenRecord(currentEmployee?.id);

  if (!r) {
    alert("Pehle Entry karo");
    return;
  }

  const breaks = r.breaks || [];
  const activeBreak = breaks.find(b => !b.end);

  if (activeBreak) {
    alert("Break already running hai");
    return;
  }

  breaks.push({
    start: nowISO(),
    end: ""
  });

  await updateDoc(doc(db, "attendance", r.id), {
    breaks
  });

  alert("Break Started");
};

window.endBreak = async function () {
  const r = getOpenRecord(currentEmployee?.id);

  if (!r) {
    alert("Pehle Entry karo");
    return;
  }

  const breaks = r.breaks || [];
  const activeBreak = breaks.find(b => !b.end);

  if (!activeBreak) {
    alert("Koi active break nahi hai");
    return;
  }

  activeBreak.end = nowISO();

  await updateDoc(doc(db, "attendance", r.id), {
    breaks
  });

  alert("Break Ended");
};

window.markExit = async function () {
  const r = getOpenRecord(currentEmployee?.id);

  if (!r) {
    alert("Pehle Entry karo");
    return;
  }

  if ((r.breaks || []).some(b => !b.end)) {
    alert("Pehle break end karo");
    return;
  }

  await updateDoc(doc(db, "attendance", r.id), {
    exit: nowISO()
  });

  alert("Exit marked");
};

window.submitWorkUpdate = async function () {
  const text = $("workText").value.trim();

  if (!text) {
    alert("Work update likho");
    return;
  }

  await addDoc(collection(db, "workUpdates"), {
    empId: currentEmployee.id,
    name: currentEmployee.name,
    date: todayKey(),
    text,
    createdAt: nowISO()
  });

  $("workText").value = "";
  alert("Work update submitted");
};

window.submitLeave = async function () {
  const date = $("leaveDate").value;
  const reason = $("leaveReason").value.trim();

  if (!date || !reason) {
    alert("Date aur reason likho");
    return;
  }

  await addDoc(collection(db, "leaves"), {
    empId: currentEmployee.id,
    name: currentEmployee.name,
    date,
    reason,
    status: "Pending",
    createdAt: nowISO()
  });

  $("leaveDate").value = "";
  $("leaveReason").value = "";
  alert("Leave request submitted");
};

window.approveLeave = async function (id) {
  await updateDoc(doc(db, "leaves", id), {
    status: "Approved"
  });
};

window.rejectLeave = async function (id) {
  await updateDoc(doc(db, "leaves", id), {
    status: "Rejected"
  });
};
window.dismissLeaveAlert = async function(id){

    await updateDoc(
        doc(db,"leaves",id),
        {
            dismissed:true
        }
    );

};
window.deleteTask = async function(id){
  if(confirm("Ye task delete karna hai?")){
    await deleteDoc(doc(db, "tasks", id));
  }
};
window.assignTask = async function () {
  const empId = $("taskEmployee").value;
  const emp = employees.find(e => e.id === empId);
  const date = $("taskDate").value || todayKey();
  const text = $("taskText").value.trim();

  if (!emp || !text) {
    alert("Employee aur task select karo");
    return;
  }

  await addDoc(collection(db, "tasks"), {
    empId: emp.id,
    name: emp.name,
    date,
    text,
    status: "Pending",
    createdAt: nowISO()
  });

  $("taskText").value = "";
};

window.markTaskDone = async function (id) {
 await updateDoc(doc(db,"tasks",id),{
  status:"Done",
  completedAt: nowISO()
});
  renderMyTasks();
renderAchievements();
renderRewards();
};
window.showTodayTasks = function(){
  myTaskMode = "today";
  if($("myTaskDate")) $("myTaskDate").value = todayKey();
  renderMyTasks();
};

window.showPendingTasks = function(){
  myTaskMode = "pending";
  if($("myTaskDate")) $("myTaskDate").value = "";
  renderMyTasks();
};
window.showCompletedTasks = function(){
    myTaskMode = "completed";
    if($("myTaskDate")) $("myTaskDate").value = "";
    renderMyTasks();
};

window.addAdminNote = async function () {
  const empId = $("noteEmployee").value;
  const emp = employees.find(e => e.id === empId);
  const date = $("noteDate").value || todayKey();
  const text = $("noteText").value.trim();

  if (!emp || !text) {
    alert("Employee aur note likho");
    return;
  }

  await addDoc(collection(db, "adminNotes"), {
    empId: emp.id,
    name: emp.name,
    date,
    text,
    createdAt: nowISO()
  });

  $("noteText").value = "";
};

window.addAnnouncement = async function () {
  const title = $("announceTitle").value.trim();
  const text = $("announceText").value.trim();
  const expiry = $("announceExpiry").value;

  if (!title || !text || !expiry) {
    alert("Title, message aur expiry date zaroori hai");
    return;
  }

  await addDoc(collection(db, "announcements"), {
    title,
    text,
    date: todayKey(),
    expiry,
    createdAt: nowISO()
  });

  $("announceTitle").value = "";
  $("announceText").value = "";
  $("announceExpiry").value = "";

  alert("Announcement published");
};

window.addDocument = async function () {
  const empId = $("docEmployee").value;
  const emp = employees.find(e => e.id === empId);
  const type = $("docType").value.trim();
  const url = $("docUrl").value.trim();

  if (!emp || !type || !url) {
    alert("Employee, document type aur URL zaroori hai");
    return;
  }

  await addDoc(collection(db, "documents"), {
    empId: emp.id,
    name: emp.name,
    type,
    url,
    date: todayKey(),
    createdAt: nowISO()
  });

  $("docType").value = "";
  $("docUrl").value = "";
};

window.savePayrollAdjustment = async function () {
  const empId = $("payrollEmployee").value;
  const emp = employees.find(e => e.id === empId);
  const month = filterMonth || monthKey();

  if (!emp) {
    alert("Employee select karo");
    return;
  }

  await addDoc(collection(db, "payrolls"), {
    empId: emp.id,
    name: emp.name,
    month,
    bonus: Number($("payrollBonus").value || 0),
    deduction: Number($("payrollDeduction").value || 0),
    createdAt: nowISO()
  });

  $("payrollBonus").value = "";
  $("payrollDeduction").value = "";
  alert("Payroll adjustment saved");
};

window.applyFilters = function () {
  filterDate = $("filterDate").value;
  filterMonth = $("filterMonth").value;
  renderAll();
};

window.clearFilters = function () {
  filterDate = "";
  filterMonth = "";

  $("filterDate").value = "";
  $("filterMonth").value = "";

  renderAll();
};

window.showNotifications = function () {
  $("notificationPanel").classList.remove("hidden");
};

window.hideNotifications = function () {
  $("notificationPanel").classList.add("hidden");
};

function setOptions() {
  const options = employees.map(e =>
    `<option value="${e.id}">${e.name} (${e.code})</option>`
  ).join("");

  ["taskEmployee", "messageEmp", "noteEmployee", "payrollEmployee", "docEmployee"].forEach(id => {
    if ($(id)) $(id).innerHTML = options;
  });
 if ($("newEmpDepartment")) {
  $("newEmpDepartment").innerHTML = departments.map(d => `
    <label class="dept-check">
      <input type="checkbox" value="${d.name}">
      <span>${d.name}</span>
    </label>
  `).join("");
}
}

window.addDepartment = async function () {
  const name = $("newDepartmentName").value.trim();

  if (!name) {
    alert("Department name likho");
    return;
  }

  await addDoc(collection(db, "departments"), {
    name,
    createdAt: nowISO()
  });

  $("newDepartmentName").value = "";
  alert("Department added");
};


window.renderDepartmentOverview = function () {

    const box = $("departmentOverview");
    const filter = $("departmentFilter");

    if (!box || !filter) return;

    const departments = [...new Set(
        employees
            .map(e => (e.department || "").trim())
            .filter(d => d)
    )].sort();

    const oldSelected = filter.value;

filter.innerHTML =
  '<option value="">All Departments</option>' +
  departments.map(d => `<option value="${d}">${d}</option>`).join("");

filter.value = oldSelected;

const selected = filter.value;

    let list = employees.filter(e => e.active !== false);

    if (selected) {
        list = list.filter(e =>
  (e.departments || [e.department || ""]).includes(selected)
);
    }

    const grouped = {};

    list.forEach(emp => {
        const empDepartments = emp.departments || [emp.department || "No Department"];

empDepartments.forEach(dept => {
  grouped[dept] = grouped[dept] || [];
  grouped[dept].push(emp);
});
    });

    box.innerHTML = Object.keys(grouped).length
        ? Object.entries(grouped).map(([dept, arr]) => `
            <div class="dept-card">
                <div class="dept-header">
                    <strong>${dept}</strong>
                    <span>${arr.length} Employees</span>
                </div>

                ${arr.map(e => `
                    <div class="dept-row">
                        <span>${e.name}</span>
                        <small>${e.designation || "-"}</small>
                    </div>
                `).join("")}
            </div>
        `).join("")
        : "<p>No Department Found</p>";
}

function renderTodayStatus() {
  if (!currentEmployee || !$("todayStatus")) return;

  const r =
    getOpenRecord(currentEmployee.id) ||
    records.find(x => x.empId === currentEmployee.id && x.date === todayKey());

  if (!r) {
    $("todayStatus").innerHTML = "Aaj abhi entry nahi hui.";
    return;
  }

  const breaks = r.breaks || [];
  const activeBreak = breaks.find(b => !b.end);

  $("todayStatus").innerHTML = `
    <b>Today Status</b><br>
    Entry: ${showTime(r.entry)} ${
  isLate(r)
    ? `<b class="badge red-badge">Late ${lateMinutes(r)} min</b>`
    : `<b class="badge green-badge">On Time</b>`
}<br>
    Exit: ${showTime(r.exit)}<br>
    Break Count: ${breaks.length}<br>
    Total Break: ${fmt(calcBreak(breaks))} ${isLateBreak(r) ? "<b class='badge red-badge'>Break Limit Cross</b>" : ""}<br>
    Working Hours: ${calcWorking(r)}<br>
    ${activeBreak ? "<b style='color:red'>Break Running...</b>" : ""}
  `;
}

function renderEmployeeSummary() {
  if (!currentEmployee || !$("employeeSummary")) return;

  const month = monthKey();
  const present = records.filter(r =>
    r.empId === currentEmployee.id &&
    r.date?.startsWith(month)
  ).length;

  const approved = approvedLeaves(currentEmployee.id, month);
  const pending = leaves.filter(l =>
    l.empId === currentEmployee.id &&
    l.status === "Pending" &&
    l.date?.startsWith(month)
  ).length;

  const limit = empLeaveLimit(currentEmployee.id);

  $("employeeSummary").innerHTML = `
    <div>Present Days: <b>${present}</b></div>
    <div>Approved Leaves: <b>${approved}/${limit}</b></div>
    <div>Pending Leaves: <b>${pending}</b></div>
    <div>Extra Leave: <b>${Math.max(0, approved - limit)}</b></div>
  `;
}
function renderEmployeeProfileCard() {
  if (!currentEmployee || !$("employeeProfileCard")) return;

  const month = monthKey();

  const myRecords = records.filter(r =>
    r.empId === currentEmployee.id &&
    r.date?.startsWith(month)
  );

  const present = myRecords.length;

  const approved = approvedLeaves(currentEmployee.id, month);
  const limit = empLeaveLimit(currentEmployee.id);
  const remaining = Math.max(0, limit - approved);

  const lateCount = myRecords.filter(isLate).length;

  const totalTasks = tasks.filter(t => t.empId === currentEmployee.id).length;
  const doneTasks = tasks.filter(t =>
    t.empId === currentEmployee.id &&
    t.status === "Done"
  ).length;

  const attendancePercent = Math.min(100, Math.round((present / 30) * 100));
  const leavePercent = limit ? Math.min(100, Math.round((approved / limit) * 100)) : 0;
  const taskPercent = totalTasks ? Math.min(100, Math.round((doneTasks / totalTasks) * 100)) : 0;

  $("employeeProfileCard").innerHTML = `
    <div class="profile-left">
      <img src="${currentEmployee.photo || 'https://via.placeholder.com/120'}">
      <div>
        <h3>${currentEmployee.name}</h3>
        <p>${currentEmployee.designation || "Employee"} • ${currentEmployee.department || "General"}</p>
        <span>Code: ${currentEmployee.code}</span>
      </div>
    </div>

    <div class="profile-metrics">
      <div>
        <b>${attendancePercent}%</b>
        <span>Attendance</span>
        <i><em style="width:${attendancePercent}%"></em></i>
      </div>

      <div>
        <b>${remaining}</b>
        <span>Leave Left</span>
        <i><em style="width:${100 - leavePercent}%"></em></i>
      </div>

      <div>
        <b>${taskPercent}%</b>
        <span>Task Done</span>
        <i><em style="width:${taskPercent}%"></em></i>
      </div>

      <div>
        <b>${lateCount}</b>
        <span>Late This Month</span>
        <i><em style="width:${Math.min(100, lateCount * 10)}%"></em></i>
      </div>
    </div>
  `;
}
function renderAchievements() {
  if (!currentEmployee || !$("achievementBox")) return;

  const month = monthKey();

  const completed = tasks
    .filter(t =>
      t.empId === currentEmployee.id &&
      t.status === "Done" &&
      t.date &&
      t.date.startsWith(month)
    )
    .sort((a, b) =>
      new Date(b.completedAt || 0) - new Date(a.completedAt || 0)
    )
    .slice(0, 3);

  if (!completed.length) {
  $("achievementBox").innerHTML = `
    <h3>🏆 Recent Achievements</h3>
    <p>No completed tasks yet.</p>
  `;
  return;
}

$("achievementBox").innerHTML = `
  <h3>🏆 Recent Achievements</h3>
  ${completed.map(t => `
      <div class="achievement-item">
        <div class="achievement-icon">🏆</div>
        <div class="achievement-content">
          <div class="achievement-title">${t.text}</div>
          <div class="achievement-time">
            Completed: ${t.completedAt ? new Date(t.completedAt).toLocaleString() : "-"}
          </div>
          <div class="achievement-msg">
            Great job! Keep up the excellent work 🚀
          </div>
        </div>
      </div>
    `).join("")}
  `;
}

function getRewardPoints(empId) {
  const doneTasks = tasks.filter(t => t.empId === empId && t.status === "Done").length;
  const lateCount = records.filter(r => r.empId === empId && isLate(r)).length;
  const approvedLeavesCount = leaves.filter(l => l.empId === empId && l.status === "Approved").length;

  const streak = getAttendanceStreak(empId);

let streakBonus = 0;

if(streak >= 30){
  streakBonus = 50;
}
else if(streak >= 15){
  streakBonus = 25;
}
else if(streak >= 7){
  streakBonus = 10;
}

return Math.max(0, (doneTasks * 10) + streakBonus - (lateCount * 2) - approvedLeavesCount);
}
function getEmployeeRank(points){
  if(points >= 250) return "🏆 Legend";
  if(points >= 200) return "🔥 Elite Employee";
  if(points >= 150) return "⭐ Top Performer";
  if(points >= 100) return "🚀 Rising Star";
  return "🌱 Beginner";
}
function getAttendanceStreak(empId){
  const dates = records
    .filter(r => r.empId === empId)
    .map(r => r.date)
    .filter(Boolean);

  const uniqueDates = [...new Set(dates)];

  let streak = 0;
  let d = new Date();

  while(true){
    const key = d.toLocaleDateString("en-CA");

    if(uniqueDates.includes(key)){
      streak++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

function renderRewards() {
  if (!currentEmployee || !$("employeeRewardsBox")) return;

  const points = getRewardPoints(currentEmployee.id);
  let badge = "";

if(points >= 300){
  badge = "🎁 Gift Voucher Unlocked";
}
else if(points >= 250){
  badge = "🏖️ Paid Leave Unlocked";
}
else if(points >= 200){
  badge = "💵 ₹1000 Bonus Unlocked";
}
else if(points >= 150){
  badge = "💰 ₹500 Bonus Unlocked";
}
else if(points >= 100){
  badge = "🏆 Employee of Month Eligible";
}
const rank = getEmployeeRank(points);
  const streak = getAttendanceStreak(currentEmployee.id);
  let nextReward = "";
let nextPoints = 0;

if(points < 100){
  nextReward = "Employee of Month Certificate";
  nextPoints = 100;
}
else if(points < 150){
  nextReward = "₹500 Bonus";
  nextPoints = 150;
}
else if(points < 200){
  nextReward = "₹1000 Bonus";
  nextPoints = 200;
}
else if(points < 250){
  nextReward = "1 Paid Leave";
  nextPoints = 250;
}
else if(points < 300){
  nextReward = "Gift Voucher";
  nextPoints = 300;
}
else{
  nextReward = "Star Performer Trophy";
  nextPoints = 500;
}

const remaining = Math.max(0, nextPoints - points);
const progress = Math.min(100, (points / nextPoints) * 100);

let unlockedReward = "";

if(points >= 300){
  unlockedReward = "🏆 Gift Voucher Unlocked";
}
else if(points >= 250){
  unlockedReward = "🌴 1 Paid Leave Unlocked";
}
else if(points >= 200){
  unlockedReward = "💰 ₹1000 Bonus Unlocked";
}
else if(points >= 150){
  unlockedReward = "💵 ₹500 Bonus Unlocked";
}
else if(points >= 100){
  unlockedReward = "🏅 Employee of Month Certificate Unlocked";
}
  $("employeeRewardsBox").innerHTML = `
<div class="card reward-card">

<h3>⭐ Reward Points</h3>
<h4>${rank}</h4>
<h4>🔥 Current Streak: ${streak} Days</h4>
<div class="reward-points">${points}</div>

<p>Task Done +10 • Late -2 • Approved Leave -1</p>

${badge ? `
<div class="reward-badge">
  ${badge}
</div>
` : ""}

<hr style="margin:15px 0">

<h4>🎯 Next Reward</h4>

<p><b>${nextReward}</b></p>

<p>${remaining} Points Remaining</p>
${unlockedReward ? `
<div class="reward-unlocked">
${unlockedReward}
</div>
` : ""}

<div class="reward-progress">
<span style="width:${progress}%"></span>
</div>
</div>
`;
}

function renderEmployeeOfMonth() {
  if (!$("employeeOfMonthBox")) return;

  const month = monthKey();

  const ranked = employees.map(emp => {
    const done = tasks.filter(t =>
      t.empId === emp.id &&
      t.status === "Done" &&
      t.date &&
      t.date.startsWith(month)
    ).length;

    const late = records.filter(r =>
      r.empId === emp.id &&
      r.date &&
      r.date.startsWith(month) &&
      isLate(r)
    ).length;

    const points = getRewardPoints(emp.id);
    const score = (done * 10) - (late * 2) + points;

    return { emp, done, late, points, score };
  }).sort((a, b) => b.score - a.score);

  const top = ranked[0];

  if (!top || top.score <= 0) {
    $("employeeOfMonthBox").innerHTML = `
      <h3>🏆 Employee of the Month</h3>
      <p>No performance data available yet.</p>
    `;
    return;
  }

  $("employeeOfMonthBox").innerHTML = `
    <h3>🏆 Employee of the Month</h3>
    <div class="eom-card">
      <div class="eom-avatar">
        ${top.emp.photo ? `<img src="${top.emp.photo}">` : "👤"}
      </div>
      <div>
        <h2>${top.emp.name}</h2>
        <p>${top.emp.designation || "Employee"} • ${(top.emp.departments || [top.emp.department || "General"]).join(", ")}</p>
        <div class="eom-stats">
          <span>✅ Tasks: ${top.done}</span>
          <span>⏰ Late: ${top.late}</span>
          <span>⭐ Points: ${top.points}</span>
        </div>
      </div>
    </div>
  `;
}

function renderLeaderboard() {

  if (!$("leaderboardBox")) return;

  const ranked = employees.map(emp => {

    const points = getRewardPoints(emp.id);

    return {
      name: emp.name,
      points
    };

  }).sort((a,b) => b.points - a.points);

  $("leaderboardBox").innerHTML = `

    <h3>🏆 Top Employees</h3>

    ${ranked.slice(0,5).map((e,index) => `

      <div class="leaderboard-row">

        <span>
          ${index === 0 ? "🥇" :
            index === 1 ? "🥈" :
            index === 2 ? "🥉" : "⭐"}

          ${e.name}
        </span>

        <b>${e.points} pts</b>

      </div>

    `).join("")}

  `;
}

function renderEmployeeLeaveAlerts() {
  if (!currentEmployee || !$("employeeLeaveAlerts")) return;

  const myUpdatedLeaves = leaves
    .filter(l =>
l.empId === currentEmployee.id &&
l.status !== "Pending" &&
!l.dismissed
)
    .slice(0, 3);

 $("employeeLeaveAlerts").innerHTML = myUpdatedLeaves.map(l => `
<div class="leave-alert-item">

<span>
${l.status === "Approved" ? "✅" : "❌"}
Your leave for <b>${l.date}</b> has been <b>${l.status}</b>
</span>

<button
class="dismiss-alert"
onclick="dismissLeaveAlert('${l.id}')">
✖
</button>

</div>
`).join("");
}
function renderEmployeeNotificationCenter(){

    if(!currentEmployee || !$("notificationCenter")) return;

    const notices = [];

    const approvedLeave = leaves.find(l =>
        l.empId === currentEmployee.id &&
        l.status === "Approved"
    );

    if(approvedLeave){
        notices.push(`
            <div class="notification-card">
                <h4>✅ Leave Approved</h4>
                <p>Your leave request has been approved.</p>
            </div>
        `);
    }

    const doneTask = tasks.find(t =>
        t.empId === currentEmployee.id &&
        t.status === "Done"
    );

    if(doneTask){
        notices.push(`
            <div class="notification-card">
                <h4>🏆 Task Completed</h4>
                <p>Great work! Keep completing tasks.</p>
            </div>
        `);
    }

    $("notificationCenter").innerHTML =
        notices.length
        ? notices.join("")
        : "";
}
function renderBirthdays() {
  const today = todayKey().slice(5);
  const birthdayEmployees = employees.filter(e => e.dob && e.dob.slice(5) === today);

  const html = birthdayEmployees.length
    ? `🎂 Birthday Today: <b>${birthdayEmployees.map(e => e.name).join(", ")}</b>`
    : "";

  if ($("adminBirthdayBox")) $("adminBirthdayBox").innerHTML = html;
  if ($("birthdayBox")) $("birthdayBox").innerHTML = html;
}

function renderAnnouncements() {

  const today = todayKey();

  const activeAnnouncements = announcements.filter(a => {
    if (!a.expiry) return false;
    return a.expiry >= today;
  });

  if ($("employeeAnnouncements")) {
    $("employeeAnnouncements").innerHTML =
      activeAnnouncements.slice(0, 3).map(a => `
        <div>
          <b>${a.title}</b><br>
          ${a.text}<br>
          <small>Valid till: ${a.expiry}</small>
        </div>
      `).join("") || "";
  }

  if ($("announcementTable")) {
    $("announcementTable").innerHTML = announcements.map(a => `
      <tr>
        <td>${a.date || "-"}</td>
        <td>${a.title || "-"}</td>
        <td>${a.text || "-"}</td>
      </tr>
    `).join("");
  }

  if ($("announcementTable")) {
    $("announcementTable").innerHTML = announcements.map(a => `
      <tr>
        <td>${a.date}</td>
        <td>${a.title}</td>
        <td>${a.text}</td>
      </tr>
    `).join("");
  }
}
function renderEmployeeMessages() {

  if (!$("employeeMessages")) return;

  const employeeMsgs = messages
    .filter(m => m.empId === currentEmployee?.id)
    .slice()
    .reverse()
    .slice(0,5);

  if (!employeeMsgs.length) {
    $("employeeMessages").innerHTML = "";
    return;
  }

  $("employeeMessages").innerHTML = `
    <div class="card">
      <h3>📨 Messages From Admin</h3>

      ${employeeMsgs.map(m => `
        <div class="message-item">
          <b>${m.title}</b><br>
          ${m.text}<br>
          <small>${m.date}</small>
        </div>
      `).join("")}
    </div>
  `;
}
function renderNotifications() {
  const items = [];

  announcements
  .filter(a => a.expiry && a.expiry >= todayKey())
  .slice(0, 5)
  .forEach(a => {
    items.push(`📢 ${a.title}`);
  });
  
  if (currentEmployee) {
    tasks
      .filter(t => t.empId === currentEmployee.id && t.status === "Pending")
      .forEach(t => items.push(`✅ Task: ${t.text}`));

    leaves
      .filter(l => l.empId === currentEmployee.id && l.status !== "Pending")
      .forEach(l => items.push(`📝 Leave ${l.status}: ${l.date}`));
  }

  if ($("notifyCount")) $("notifyCount").innerText = items.length;

  if ($("notificationList")) {
    $("notificationList").innerHTML = items.map(i => `<p>${i}</p>`).join("") || "<p>No notifications</p>";
  }
}

function renderCalendar() {
  if (!$("calendarBox")) return;

  const month = filterMonth || monthKey();
  const year = Number(month.slice(0, 4));
  const monthNum = Number(month.slice(5, 7));
  const days = new Date(year, monthNum, 0).getDate();

  $("calendarBox").innerHTML = employees.map(emp => {
    let cells = "";

    for (let d = 1; d <= days; d++) {
      const date = `${month}-${String(d).padStart(2, "0")}`;

      const present = records.some(r => r.empId === emp.id && r.date === date);
      const leave = leaves.some(l =>
        l.empId === emp.id &&
        l.date === date &&
        l.status === "Approved"
      );

      const cls = present ? "present" : leave ? "leave" : "absent";
      const txt = present ? "P" : leave ? "L" : "A";

      cells += `<span class="${cls}" title="${date}">${txt}</span>`;
    }

    return `
      <div class="calendar-row">
        <b>${emp.name}</b>
        <div>${cells}</div>
      </div>
    `;
  }).join("");
}

function renderCharts(todayRecords) {
  if (!$("chartBox")) return;

  const activeEmployees = employees.filter(e => e.active !== false).length;
  const present = new Set(todayRecords.map(r => r.empId)).size;
  const absent = Math.max(0, activeEmployees - present);

  const totalLeaves = leaves.length || 1;
  const approvedLeave = leaves.filter(l => l.status === "Approved").length;
  const pendingLeave = leaves.filter(l => l.status === "Pending").length;
  const rejectedLeave = leaves.filter(l => l.status === "Rejected").length;

  const totalTasks = tasks.length || 1;
  const doneTasks = tasks.filter(t => t.status === "Done").length;
  const pendingTasks = tasks.filter(t => t.status === "Pending").length;

  const lateToday = todayRecords.filter(isLate).length;
  const lateBreaks = todayRecords.filter(isLateBreak).length;

  const departments = {};
  employees.forEach(e => {
    const dept = e.department || "General";
    departments[dept] = (departments[dept] || 0) + 1;
  });

  function percent(value, total) {
    return total ? Math.min(100, Math.round((value / total) * 100)) : 0;
  }

  function donut(title, value, total, sub) {
    const p = percent(value, total);

    return `
      <div class="premium-chart-card">
        <div class="premium-donut" style="--p:${p}">
          <span>${p}%</span>
        </div>
        <h4>${title}</h4>
        <p>${value} / ${total}</p>
        <small>${sub}</small>
      </div>
    `;
  }

  function bar(title, rows) {
    return `
      <div class="premium-chart-card wide-chart">
        <h4>${title}</h4>
        ${rows.map(r => {
          const p = percent(r.value, r.total);
          return `
            <div class="premium-bar-row">
              <span>${r.label}</span>
              <div class="premium-bar"><i style="width:${p}%"></i></div>
              <b>${r.value}</b>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  const deptRows = Object.entries(departments).map(([label, value]) => ({
    label,
    value,
    total: employees.length || 1
  }));

  $("chartBox").innerHTML = `
    ${donut("Today Attendance", present, activeEmployees || 1, "Present employee ratio")}
    ${donut("Leave Approval", approvedLeave, totalLeaves, "Approved leaves")}
    ${donut("Task Completion", doneTasks, totalTasks, "Completed tasks")}
    ${bar("Leave Status", [
      {label:"Approved", value:approvedLeave, total:totalLeaves},
      {label:"Pending", value:pendingLeave, total:totalLeaves},
      {label:"Rejected", value:rejectedLeave, total:totalLeaves}
    ])}
    ${bar("Daily Alerts", [
      {label:"Absent", value:absent, total:activeEmployees || 1},
      {label:"Late Entry", value:lateToday, total:todayRecords.length || 1},
      {label:"Late Break", value:lateBreaks, total:todayRecords.length || 1}
    ])}
    ${bar("Department Wise Team", deptRows)}
  `;
}

function renderAdmin() {
  if (!$("adminPanel") || $("adminPanel").classList.contains("hidden")) return;

  $("officeStartTime").value = settings.officeStartTime;
  $("allowedBreakMinutes").value = settings.allowedBreakMinutes;
  $("monthlyLeaveLimit").value = settings.monthlyLeaveLimit;

 setOptions();
renderDepartmentOverview();

const today = todayKey();
  const activeEmployees = employees.filter(e => e.active !== false);
  const todayRecords = records.filter(r => r.date === today);
  const uniquePresent = new Set(todayRecords.map(r => r.empId)).size;

  $("statEmployees").innerText = activeEmployees.length;
  $("statPresent").innerText = uniquePresent;
  $("statAbsent").innerText = Math.max(0, activeEmployees.length - uniquePresent);
  $("statLate").innerText = todayRecords.filter(isLate).length;
  $("statBreaks").innerText = todayRecords.reduce((sum, r) => sum + (r.breaks || []).length, 0);
  $("statLeaves").innerText = leaves.filter(l => l.status === "Pending").length;
  $("statOverLeave").innerText = employees.filter(e =>
    approvedLeaves(e.id, monthKey()) > empLeaveLimit(e.id)
  ).length;
  $("statLateBreaks").innerText = todayRecords.filter(isLateBreak).length;

  $("employeeTable").innerHTML = employees.map(e => `
    <tr>
      <td>${e.photo ? `<img class="avatar" src="${e.photo}">` : "-"}</td>
      <td>${e.name}</td>
      <td>${e.code}</td>
      <td>${e.designation || "-"}</td>
      <td>${e.department || "-"}</td>
      <td>${e.dob || "-"}</td>
      <td>₹${e.salary || 0}</td>
      <td>${e.leaveLimit || settings.monthlyLeaveLimit}</td>
      <td>${e.active !== false ? "Active" : "Inactive"}</td>
      <td>
        <button onclick="toggleEmployee('${e.id}', ${e.active !== false})">
          ${e.active !== false ? "Disable" : "Enable"}
        </button>
        <button class="red" onclick="deleteEmployee('${e.id}')">Delete</button>
      </td>
    </tr>
  `).join("");

  if ($("idCardBox")) {
    $("idCardBox").innerHTML = employees.map(e => `
      <div class="id-card">
        <div class="id-card-header">
          <h2>SBX HR</h2>
          <span>Employee ID Card</span>
        </div>

        <div class="id-card-photo">
          <img src="${e.photo || 'https://via.placeholder.com/120'}">
        </div>

        <h3>${e.name || 'Employee'}</h3>
        <p class="id-designation">${e.designation || 'Employee'}</p>

        <div class="id-card-info">
          <p><b>Code:</b> ${e.code || '-'}</p>
          <p><b>Department:</b> ${e.department || '-'}</p>
          <p><b>Salary:</b> ₹${e.salary || 0}</p>
          <p><b>Status:</b> ${e.active !== false ? 'Active' : 'Inactive'}</p>
        </div>

        <button onclick="window.print()">Print Card</button>
      </div>
    `).join("");
  }

  $("attendanceTable").innerHTML = filtered(records).map(r => {
    const breaks = r.breaks || [];

    const details = breaks.map((b, i) => {
      const duration = b.end ? fmt(minutesBetween(b.start, b.end)) : "Running";
      return `Break ${i + 1}: ${showTime(b.start)} - ${showTime(b.end)} (${duration})`;
    }).join("<br>") || "-";

    return `
      <tr>
        <td>${r.date}</td>
        <td>${r.name}</td>
        <td>${showTime(r.entry)}</td>
        <td>
  ${isLate(r)
    ? `<span class="late-pill">⏰ ${lateMinutes(r)}m</span>`
    : `<span class="ontime-pill">✅ On Time</span>`}
</td>
        <td>${showTime(r.exit)}</td>
        <td>${breaks.length}</td>
        <td>${fmt(calcBreak(breaks))}</td>
        <td>${isLateBreak(r) ? "Yes" : "No"}</td>
        <td>${calcWorking(r)}</td>
        <td>${details}</td>
      </tr>
    `;
  }).join("");

  $("leaveTable").innerHTML = filtered(leaves)
  .filter(l => l.status === "Pending")
  .map(l => {
    const month = l.date?.slice(0, 7);
    const count = approvedLeaves(l.empId, month);
    const limit = empLeaveLimit(l.empId);

    return `
      <tr>
        <td>${l.name}</td>
        <td>${l.date}</td>
        <td>${l.reason}</td>
        <td>${l.status}</td>
        <td>${count}/${limit}</td>
        <td>${count > limit ? "Yes" : "No"}</td>
        <td>
          <button class="green" onclick="approveLeave('${l.id}')">Approve</button>
          <button class="red" onclick="rejectLeave('${l.id}')">Reject</button>
        </td>
      </tr>
    `;
  }).join("");

  $("workTable").innerHTML = filtered(workUpdates).map(w => `
    <tr>
      <td>${w.date}</td>
      <td>${w.name}</td>
      <td>${w.text}</td>
    </tr>
  `).join("");

  $("taskTable").innerHTML = filtered(tasks).map(t => `
    <tr>
      <td>${t.date}</td>
      <td>${t.name}</td>
      <td>${t.text}</td>
      <td>${t.status}</td>
      <td>
 ${t.completedAt
   ? new Date(t.completedAt).toLocaleString()
   : "-"
 }
</td>
      <td>
  <button class="red" onclick="deleteTask('${t.id}')">Delete</button>
</td>
    </tr>
  `).join("");

  $("noteTable").innerHTML = filtered(notes).map(n => `
    <tr>
      <td>${n.date}</td>
      <td>${n.name}</td>
      <td>${n.text}</td>
    </tr>
  `).join("");

  $("documentTable").innerHTML = documentsList.map(d => `
    <tr>
      <td>${d.name}</td>
      <td>${d.type}</td>
      <td><a href="${d.url}" target="_blank">Open</a></td>
      <td>${d.date}</td>
    </tr>
  `).join("");

  renderLeaveBalance();
renderPayroll();
renderCalendar();
renderCharts(todayRecords);
renderAnnouncements();
renderBirthdays();
}
function renderLeaveBalance() {
  if (!$("leaveBalanceTable")) return;

  const month = filterMonth || monthKey();

  $("leaveBalanceTable").innerHTML = employees.map(emp => {

    const limit = empLeaveLimit(emp.id);

    const approved = leaves.filter(l =>
      l.empId === emp.id &&
      l.status === "Approved" &&
      l.date?.startsWith(month)
    ).length;

    const pending = leaves.filter(l =>
      l.empId === emp.id &&
      l.status === "Pending" &&
      l.date?.startsWith(month)
    ).length;

    const remaining = Math.max(0, limit - approved);
    const extra = Math.max(0, approved - limit);

    return `
      <tr>
        <td>${emp.name}</td>
        <td>${limit}</td>
        <td>${approved}</td>
        <td>${pending}</td>
        <td>${remaining}</td>
        <td>${extra}</td>
      </tr>
    `;
  }).join("");
}
function renderPayroll() {
  if (!$("salaryTable")) return;

  const month = filterMonth || monthKey();

  $("salaryTable").innerHTML = employees.map(e => {
    const present = records.filter(r =>
      r.empId === e.id &&
      r.date?.startsWith(month)
    ).length;

    const approved = approvedLeaves(e.id, month);
    const absent = Math.max(0, 30 - present - approved);

    const payroll = payrollFor(e.id, month);
    const salary = Number(e.salary || 0);
    const perDay = salary / 30;

    const finalSalary = Math.max(
      0,
      Math.round(salary - (absent * perDay) + Number(payroll.bonus || 0) - Number(payroll.deduction || 0))
    );

    return `
      <tr>
        <td>${e.name}</td>
        <td>₹${salary}</td>
        <td>${present}</td>
        <td>${approved}</td>
        <td>${absent}</td>
        <td>₹${payroll.bonus || 0}</td>
        <td>₹${payroll.deduction || 0}</td>
        <td>₹${finalSalary}</td>
      </tr>
    `;
  }).join("");
}

function renderMyTasks() {
  if (!currentEmployee || !$("myTaskTable")) return;

  const selectedDate = $("myTaskDate")?.value || todayKey();

  let myTasks = tasks.filter(t => t.empId === currentEmployee.id);

  if (myTaskMode === "pending") {
    myTasks = myTasks.filter(t => t.status === "Pending");
}
else if (myTaskMode === "completed") {
    myTasks = myTasks.filter(t => t.status === "Done");
}
else {
    myTasks = myTasks.filter(t => t.date === selectedDate);
}

  $("myTaskTable").innerHTML = myTasks.map(t => `
    <tr>
      <td>${t.date}</td>
      <td>${t.text}</td>
      <td>${t.status}</td>
      <td>
        ${t.status === "Pending"
          ? `<button onclick="markTaskDone('${t.id}')">Mark Done</button>`
          : "Done"}
      </td>
    </tr>
  `).join("") || `
    <tr>
      <td colspan="4">Is date ya filter me koi task nahi hai.</td>
    </tr>
  `;
}
function renderEmployeeGraphs() {
  if (!currentEmployee || !$("employeeGraphBox")) return;

  const month = monthKey();

  const myRecords = records.filter(r =>
    r.empId === currentEmployee.id &&
    r.date?.startsWith(month)
  );

  const myLeaves = leaves.filter(l =>
    l.empId === currentEmployee.id &&
    l.date?.startsWith(month)
  );

  const myTasks = tasks.filter(t => t.empId === currentEmployee.id);

  const present = myRecords.length;
  const approvedLeavesCount = myLeaves.filter(l => l.status === "Approved").length;
  const pendingLeavesCount = myLeaves.filter(l => l.status === "Pending").length;
  const totalBreakMinutes = myRecords.reduce((sum, r) => sum + calcBreak(r.breaks || []), 0);
  const doneTasks = myTasks.filter(t => t.status === "Done").length;
  const pendingTasks = myTasks.filter(t => t.status === "Pending").length;

  function circleCard(title, value, max, note) {
    const percent = max ? Math.min(100, Math.round((value / max) * 100)) : 0;

    return `
      <div class="circle-card">
        <div class="circle" style="--p:${percent}">
          <span>${percent}%</span>
        </div>
        <h4>${title}</h4>
        <p>${value} / ${max}</p>
        <small>${note}</small>
      </div>
    `;
  }

  function progressCard(title, value, max, note) {
    const percent = max ? Math.min(100, Math.round((value / max) * 100)) : 0;

    return `
      <div class="chart-card">
        <h4>${title}</h4>
        <div class="big-bar">
          <i style="width:${percent}%"></i>
        </div>
        <p><b>${value}</b> / ${max}</p>
        <small>${note}</small>
      </div>
    `;
  }

  $("employeeGraphBox").innerHTML = `
    ${circleCard("Attendance", present, 30, "Monthly present days")}
    ${circleCard("Leave Used", approvedLeavesCount, empLeaveLimit(currentEmployee.id), "Approved leave usage")}
    ${progressCard("Break Time", totalBreakMinutes, 600, "Total break minutes this month")}
    ${progressCard("Tasks Done", doneTasks, doneTasks + pendingTasks || 1, "Task completion status")}
  `;
}
function renderAll() {
  renderAdmin();
  renderTodayStatus();
  renderEmployeeSummary();
  renderEmployeeLeaveAlerts();
  renderEmployeeNotificationCenter();
  renderEmployeeProfileCard();
  renderAchievements();
  renderRewards();
  renderEmployeeOfMonth();
  renderEmployeeMessages();
  renderLeaderboard();
  renderMyTasks();
  renderEmployeeGraphs();
  renderAnnouncements();
  renderNotifications();
  renderBirthdays();
}

window.exportCSV = function () {
  const rows = [
    ["Date", "Name", "Entry", "Late", "Exit", "Break Count", "Total Break", "Late Break", "Working Hours"]
  ];

  filtered(records).forEach(r => {
    rows.push([
      r.date,
      r.name,
      showTime(r.entry),
      isLate(r) ? "Late" : "On Time",
      showTime(r.exit),
      (r.breaks || []).length,
      fmt(calcBreak(r.breaks || [])),
      isLateBreak(r) ? "Yes" : "No",
      calcWorking(r)
    ]);
  });

  const csv = rows.map(row =>
    row.map(v => `"${String(v || "").replaceAll('"', '""')}"`).join(",")
  ).join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");

  a.href = URL.createObjectURL(blob);
  a.download = "attendance-report.csv";
  a.click();
};
function resetMonth(){

  if(!confirm(
    "Close current month?\n\nAttendance, tasks, rewards and leave data will be archived."
  )) return;

  localStorage.setItem(
    "hrms_archive_" + new Date().toISOString(),
    JSON.stringify({
      employees,
      records,
      tasks,
      leaves
    })
  );

  records = [];
  tasks = [];
  leaves = [];

  saveData();

  alert("✅ New Month Started Successfully");

  location.reload();
}
window.toggleSidebar = function () {
  document.body.classList.toggle("sidebar-open");
};
window.exportBackup = function(){
  const data = {
    employees,
    records,
    tasks,
    leaves,
    workUpdates,
    notes,
    announcements,
    documentsList,
    payrolls,
    exportedAt: nowISO()
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json"
  });

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "sbx-hrms-backup.json";
  a.click();
};

window.importBackup = function(event){
  const file = event.target.files[0];
  if(!file) return;

  const reader = new FileReader();

  reader.onload = function(e){
    try{
      const data = JSON.parse(e.target.result);
      console.log("Backup Loaded:", data);
      alert("Backup file loaded. Restore to Firebase will be added after testing.");
    }catch(err){
      alert("Invalid backup file");
    }
  };

  reader.readAsText(file);
};
