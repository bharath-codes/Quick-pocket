// script.js - FINAL COMPLETE VERSION WITH CALCULATION

document.addEventListener("DOMContentLoaded", function () {
  const API_BASE_URL = "https://quick-pocket.onrender.com/api";

  // --- UTILITY FUNCTIONS ---
  const pages = document.querySelectorAll(".page");
  const showPage = (pageId) => {
    pages.forEach((p) => p.classList.remove("active"));
    const page = document.getElementById(pageId);
    if (page) page.classList.add("active");
  };
  const showNotification = (message, type = "success") => {
    const container = document.getElementById("notification-container");
    if (!container) return;
    const notif = document.createElement("div");
    notif.className = `notification ${type}`;
    notif.textContent = message;
    container.appendChild(notif);
    setTimeout(() => notif.classList.add("show"), 10);
    setTimeout(() => {
      notif.classList.remove("show");
      setTimeout(() => notif.remove(), 500);
    }, 4000);
  };
  const getToken = () => localStorage.getItem("token");
  const setToken = (token) => localStorage.setItem("token", token);
  const removeToken = () => {
    localStorage.removeItem("token");
    showPage("login-page");
  };

  // --- API HELPER ---
  async function apiCall(endpoint, method = "GET", body = null) {
    try {
      const options = {
        method,
        headers: { Authorization: `Bearer ${getToken()}` },
      };
      if (body && !(body instanceof FormData)) {
        options.headers["Content-Type"] = "application/json";
        options.body = JSON.stringify(body);
      } else if (body) {
        options.body = body;
      }
      const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ message: "An unknown server error occurred." }));
        throw new Error(errorData.message);
      }
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        return response.json();
      }
      return null;
    } catch (error) {
      console.error(`API Call Error to ${endpoint}:`, error);
      showNotification(error.message, "error");
      throw error;
    }
  }

  // --- DASHBOARD RENDERERS ---
  async function loadUserDashboard() {
    try {
      const data = await apiCall("/dashboard");
      const welcomeEl = document.getElementById("dashboard-welcome");
      const contentEl = document.getElementById("dashboard-content");
      if (!welcomeEl || !contentEl) return;

      welcomeEl.textContent = `Welcome, ${
        data.user.name || data.user.phone_number
      }!`;

      if (data.application) {
        const app = data.application;
        contentEl.innerHTML = `
                    <div class="status-summary">
                        <h3>Your Application Summary</h3>
                        <div class="summary-item"><span>Application ID:</span><strong>QP-00${
                          app.id
                        }</strong></div>
                        <div class="summary-item"><span>Loan Amount:</span><strong>₹${parseFloat(
                          app.amount
                        ).toFixed(2)}</strong></div>
                        <div class="summary-item"><span>Status:</span><strong class="status-text-${app.status.toLowerCase()}">${
          app.status
        }</strong></div>
                    </div>`;
      } else {
        contentEl.innerHTML = `
                    <h3>Loan Application</h3>
                    <p>All fields and documents are required for submission.</p>
                    <form id="loan-application-form">
                        <div class="input-group"><label for="user-name">Full Name</label><input type="text" id="user-name" name="name" value="${
                          data.user.name || ""
                        }" required></div>
                        <div class="input-group"><label for="alt-phone">Alternative Phone</label><input type="tel" id="alt-phone" name="altPhoneNumber" required></div>
                        <div class="input-group"><label for="loan-amount">Loan Amount (₹)</label><input type="number" id="loan-amount" name="amount" required></div>
                        <div class="input-group"><label for="loan-tenure">Tenure (weeks)</label>
                            <select id="loan-tenure" name="tenure" required><option value="">Select</option><option value="1">1</option><option value="2">2</option><option value="3">3</option></select>
                        </div>
                        
                        <div id="loan-calculation" class="loan-calculation-box" style="display: none;">
                            <p><strong>Interest (20%):</strong> <span id="interest-amount">₹0.00</span></p>
                            <p><strong>Total Repayment:</strong> <span id="total-repayment">₹0.00</span></p>
                        </div>
                        <hr class="form-divider">
                        
                        <div class="input-group"><label for="selfie-file">Selfie</label><input type="file" id="selfie-file" name="selfie" accept="image/*" required></div>
                        <div class="input-group"><label for="aadhar-file">Aadhar</label><input type="file" id="aadhar-file" name="aadhar" accept="image/*" required></div>
                        <div class="input-group"><label for="pan-file">PAN</label><input type="file" id="pan-file" name="pan" accept="image/*" required></div>
                        <button type="submit" class="btn">Submit Application</button>
                    </form>`;

        document
          .getElementById("loan-application-form")
          .addEventListener("submit", handleLoanApplication);

        const loanAmountInput = document.getElementById("loan-amount");
        loanAmountInput.addEventListener("input", () => {
          const amount = parseFloat(loanAmountInput.value);
          const interestRate = 0.2;
          const calcBox = document.getElementById("loan-calculation");
          if (amount > 0 && !isNaN(amount)) {
            document.getElementById("interest-amount").textContent = `₹${(
              amount * interestRate
            ).toFixed(2)}`;
            document.getElementById("total-repayment").textContent = `₹${(
              amount +
              amount * interestRate
            ).toFixed(2)}`;
            calcBox.style.display = "block";
          } else {
            calcBox.style.display = "none";
          }
        });
      }
      showPage("dashboard-page");
    } catch (error) {
      removeToken();
    }
  }

  async function loadAdminDashboard() {
    try {
      const applications = await apiCall("/admin/applications");
      const tbody = document.querySelector("#admin-applications-table tbody");
      tbody.innerHTML = "";
      if (applications.length === 0) {
        tbody.innerHTML =
          '<tr><td colspan="6" style="text-align:center;">No active applications.</td></tr>';
      } else {
        applications.forEach((app) => {
          let actionButtons = `<span>-</span>`;
          if (app.status === "Pending")
            actionButtons = `<button class="btn-sm btn-approve" data-id="${app.id}" data-new-status="Approved">Approve</button> <button class="btn-sm btn-reject" data-id="${app.id}" data-new-status="Rejected">Reject</button>`;
          else if (app.status === "Approved")
            actionButtons = `<button class="btn-sm btn-disburse" data-id="${app.id}" data-new-status="Disbursed">Disburse</button>`;
          const row = document.createElement("tr");
          row.innerHTML = `<td><strong>${app.user_name}</strong><br><small>${
            app.user_phone
          }</small></td><td><strong>₹${parseFloat(app.amount).toFixed(
            2
          )}</strong><br><small>${
            app.tenure_weeks
          } weeks</small></td><td><a href="${
            app.selfie_url
          }" target="_blank">Selfie</a> | <a href="${
            app.aadhar_url
          }" target="_blank">Aadhar</a> | <a href="${
            app.pan_url
          }" target="_blank">PAN</a></td><td><span class="status-tag">${
            app.status
          }</span></td><td>${actionButtons}</td>`;
          tbody.appendChild(row);
        });
      }
      showPage("admin-page");
    } catch (error) {
      removeToken();
    }
  }

  // --- FORM/ACTION HANDLERS ---
  async function handleLogin(identifier, password) {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      setToken(data.token);
      showNotification(data.message);
      const payload = JSON.parse(atob(data.token.split(".")[1]));
      if (payload.isAdmin) loadAdminDashboard();
      else loadUserDashboard();
    } catch (error) {
      showNotification(error.message, "error");
    }
  }

  async function handleLoanApplication(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    try {
      await apiCall("/apply", "POST", formData);
      showNotification("Application submitted successfully!");
      loadUserDashboard();
    } catch (error) {
      /* Handled */
    }
  }

  // --- EVENT LISTENERS ---
  function attachEventListeners() {
    document
      .getElementById("register-form")
      ?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const body = {
          name: document.getElementById("register-name").value,
          phoneNumber: document.getElementById("register-phone").value,
          password: document.getElementById("register-password").value,
        };
        try {
          const response = await fetch(`${API_BASE_URL}/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.message);
          showNotification(data.message);
          showPage("login-page");
        } catch (error) {
          showNotification(error.message || "Registration failed.", "error");
        }
      });
    document.getElementById("login-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      handleLogin(
        document.getElementById("login-phone").value,
        document.getElementById("login-password").value
      );
    });
    document
      .getElementById("admin-login-form")
      ?.addEventListener("submit", (e) => {
        e.preventDefault();
        handleLogin(
          document.getElementById("admin-email").value,
          document.getElementById("admin-password").value
        );
      });
    document
      .getElementById("admin-applications-table")
      ?.addEventListener("click", async (e) => {
        const target = e.target;
        if (target.tagName === "BUTTON" && target.dataset.id) {
          if (
            !confirm(
              `Are you sure you want to set status to "${target.dataset.newStatus}"?`
            )
          )
            return;
          try {
            await apiCall("/admin/applications/update-status", "PUT", {
              applicationId: target.dataset.id,
              newStatus: target.dataset.newStatus,
            });
            showNotification("Status updated.");
            loadAdminDashboard();
          } catch (error) {
            /* Handled */
          }
        }
      });
    document.querySelectorAll(".logout-link").forEach((link) =>
      link.addEventListener("click", (e) => {
        e.preventDefault();
        removeToken();
        showNotification("Logged out.");
      })
    );
    document.getElementById("show-register")?.addEventListener("click", (e) => {
      e.preventDefault();
      showPage("register-page");
    });
    document.getElementById("show-login")?.addEventListener("click", (e) => {
      e.preventDefault();
      showPage("login-page");
    });
    document
      .getElementById("show-admin-login")
      ?.addEventListener("click", (e) => {
        e.preventDefault();
        showPage("admin-login-page");
      });
    document
      .getElementById("show-user-login-from-admin")
      ?.addEventListener("click", (e) => {
        e.preventDefault();
        showPage("login-page");
      });
  }

  // --- INITIAL LOAD ---
  function initialLoad() {
    const token = getToken();
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        if (payload.exp * 1000 < Date.now()) return removeToken();
        if (payload.isAdmin) loadAdminDashboard();
        else loadUserDashboard();
      } catch {
        removeToken();
      }
    } else {
      showPage("login-page");
    }
  }

  attachEventListeners();
  initialLoad();
});
