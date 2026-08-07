const authStorageKey = "habitTrackerUser";
const authLoggedInKey = "habitTrackerLoggedIn";

function getAuthMessageElement() {
  return document.getElementById("signup-message");
}

function showAuthMessage(text, isError = true) {
  const messageEl = getAuthMessageElement();
  if (!messageEl) return;
  messageEl.textContent = text;
  messageEl.style.color = isError ? "#dc3545" : "#198754";
  messageEl.style.display = text ? "block" : "none";
}

function validateEmail(email) {
  return /^\S+@\S+\.\S+$/.test(email);
}

function saveUserData(user) {
  localStorage.setItem(authStorageKey, JSON.stringify(user));
  localStorage.setItem(authLoggedInKey, "true");
}

function redirectToHabitPage() {
  window.location.href = "habit.html";
}

function redirectToHomePage() {
  window.location.href = "home.html";
}

function isLoggedIn() {
  return localStorage.getItem(authLoggedInKey) === "true";
}

function handleSignupSubmit(event) {
  event.preventDefault();

  const name = document.getElementById("signup-name").value.trim();
  const email = document.getElementById("signup-email").value.trim();
  const password = document.getElementById("signup-password").value;
  const confirmPassword = document.getElementById("signup-confirm-password").value;

  if (!name || !email || !password || !confirmPassword) {
    showAuthMessage("Please complete all required fields.");
    return;
  }

  if (!validateEmail(email)) {
    showAuthMessage("Please enter a valid email address.");
    return;
  }

  if (password.length < 6) {
    showAuthMessage("Password must be at least 6 characters long.");
    return;
  }

  if (password !== confirmPassword) {
    showAuthMessage("Passwords do not match. Please try again.");
    return;
  }

  const user = {
    name,
    email,
    password,
    createdAt: new Date().toISOString()
  };

  saveUserData(user);
  showAuthMessage("Signup successful! Redirecting to your Habit Tracker…", false);

  setTimeout(redirectToHabitPage, 500);
}

function redirectIfLoggedIn() {
  if (isLoggedIn()) {
    redirectToHabitPage();
  }
}

function requireAuth() {
  if (!isLoggedIn()) {
    redirectToHomePage();
  }
}

function logout() {
  localStorage.removeItem(authLoggedInKey);
  localStorage.removeItem(authStorageKey);
  redirectToHomePage();
}

function initAuth() {
  const signupForm = document.getElementById("signup-form");
  if (signupForm) {
    redirectIfLoggedIn();
    signupForm.addEventListener("submit", handleSignupSubmit);
  }

  if (document.getElementById("habits-container")) {
    requireAuth();
  }
}

document.addEventListener("DOMContentLoaded", initAuth);
