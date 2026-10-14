const API_BASE = "https://class2-signups-fall26.vercel.app/api/";

// Demo mode serves sample data from the browser instead of the real roster API.
// It's on for the public GitHub Pages copy, or anywhere with ?demo in the URL.
const DEMO_MODE =
  location.hostname.endsWith("github.io") || new URLSearchParams(location.search).has("demo");
const DEMO_STORAGE_KEY = "class-signup-demo";
const DEMO_SAMPLE = ["Ada Lovelace", "Grace Hopper", "Alan Turing"];

function demoLoad() {
  try {
    const saved = JSON.parse(localStorage.getItem(DEMO_STORAGE_KEY));
    if (Array.isArray(saved)) return saved;
  } catch {
    // storage unavailable or corrupt; fall back to the sample roster
  }
  return DEMO_SAMPLE.map((name) => ({ name }));
}

function demoSave(signups) {
  try {
    localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(signups));
  } catch {
    // storage unavailable; the roster just won't survive a reload
  }
}

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Mimics the real API's status codes (200, 201, 400, 409) so the UI code path is identical.
async function demoFetch(url, options = {}) {
  await new Promise((resolve) => setTimeout(resolve, 300));
  const signups = demoLoad();

  if ((options.method || "GET") === "GET") {
    return jsonResponse(200, { signups });
  }

  const name = (JSON.parse(options.body).name || "").trim();
  if (!name) return jsonResponse(400, { error: "Name is required." });
  if (signups.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
    return jsonResponse(409, { error: "That name is already signed up." });
  }
  const signup = { name };
  demoSave([...signups, signup]);
  return jsonResponse(201, { signup });
}

const apiFetch = DEMO_MODE ? demoFetch : fetch.bind(window);

const form = document.getElementById("signup-form");
const nameInput = document.getElementById("name-input");
const submitBtn = document.getElementById("submit-btn");
const formMessage = document.getElementById("form-message");
const rosterStatus = document.getElementById("roster-status");
const rosterList = document.getElementById("roster-list");
const rosterCount = document.getElementById("roster-count");

function setFormMessage(text, state) {
  formMessage.textContent = text || "";
  if (state) {
    formMessage.setAttribute("data-state", state);
  } else {
    formMessage.removeAttribute("data-state");
  }
}

function setRosterStatus(text, state) {
  rosterStatus.textContent = text || "";
  if (state) {
    rosterStatus.setAttribute("data-state", state);
  } else {
    rosterStatus.removeAttribute("data-state");
  }
}

function renderRoster(signups) {
  rosterList.innerHTML = "";

  if (!signups || signups.length === 0) {
    setRosterStatus("No one has signed up yet. Be the first!");
    rosterCount.textContent = "";
    return;
  }

  setRosterStatus("");
  rosterCount.textContent = `${signups.length} signed up`;

  for (const signup of signups) {
    const li = document.createElement("li");
    li.textContent = signup.name;
    rosterList.appendChild(li);
  }
}

async function extractErrorMessage(response) {
  try {
    const data = await response.json();
    if (data && typeof data.error === "string") return data.error;
    if (data && typeof data.message === "string") return data.message;
  } catch {
    // response body wasn't JSON; fall through to generic message
  }
  return null;
}

async function loadSignups() {
  setRosterStatus("Loading signups…");
  rosterList.innerHTML = "";
  rosterCount.textContent = "";

  try {
    const response = await apiFetch(`${API_BASE}signups`);

    if (!response.ok) {
      const message = await extractErrorMessage(response);
      throw new Error(message || `Couldn't load signups (status ${response.status}).`);
    }

    const data = await response.json();
    renderRoster(data.signups);
  } catch (err) {
    setRosterStatus(err.message || "Couldn't load signups. Please try again.", "error");
  }
}

async function handleSubmit(event) {
  event.preventDefault();

  const name = nameInput.value.trim();
  if (!name) {
    setFormMessage("Please enter your name.", "error");
    nameInput.focus();
    return;
  }

  submitBtn.disabled = true;
  setFormMessage("Signing up…");

  try {
    const response = await apiFetch(`${API_BASE}signups`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });

    if (response.status === 201) {
      const data = await response.json();
      setFormMessage(`You're signed up, ${data.signup?.name || name}!`, "success");
      form.reset();
      await loadSignups();
      return;
    }

    if (response.status === 409) {
      setFormMessage("That name is already signed up.", "error");
      return;
    }

    const message = await extractErrorMessage(response);
    setFormMessage(message || `Something went wrong (status ${response.status}).`, "error");
  } catch (err) {
    setFormMessage("Network error. Please check your connection and try again.", "error");
  } finally {
    submitBtn.disabled = false;
  }
}

form.addEventListener("submit", handleSubmit);
if (DEMO_MODE) {
  document.getElementById("demo-banner").hidden = false;
}
loadSignups();
