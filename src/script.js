/**
 * Project: Spotimetrics
 * Description: Core logic for Spotify Web API integration. Handles the 
 * Authorization Code Flow with PKCE, data fetching, and dynamic UI rendering.
 *
 * Author: Alexis Corona
 * Version: 1.0.0 (stable)
 */

// Spotify API Configuration
const CLIENT_ID = "f07569ad9d194b899802cc1ade23da7c";
const SCOPE = "user-top-read";

// Dynamic Redirect URI based on environment (Local vs Production)
const REDIRECT_URI = (window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost")
  ? "http://127.0.0.1:5500/src/index.html" 
  : "https://spotimetrics.web.app/";

const loginButton = document.getElementById("login");
let currentView = "tracks"; // Default view state

/**
 * Event Listeners for View Switching (Tracks vs Artists)
 * Updates the 'active' button state and re-renders the display if token exists.
 */
document.querySelectorAll('.view-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelector('.view-btn.active').classList.remove('active');
    btn.classList.add('active');
    currentView = btn.dataset.type;
    
    const token = localStorage.getItem("spotify_access_token");
    if (token) updateDisplay(token);
  });
});

/**
 * Handles Authentication logic.
 * Triggers the Spotify OAuth2 + PKCE flow or logs out based on button state.
 */
loginButton.addEventListener("click", () => {
  if (loginButton.textContent === "Log out") { logout(); return; }

  // PKCE: Generate Verifier and Code Challenge
  const verifier = generateRandomString(64);
  generateCodeChallenge(verifier).then(challenge => {
    localStorage.setItem("verifier", verifier);
    const args = new URLSearchParams({
      response_type: "code",
      client_id: CLIENT_ID,
      scope: SCOPE,
      redirect_uri: REDIRECT_URI,
      code_challenge_method: "S256",
      code_challenge: challenge,
    });
    // Redirect user to Spotify Authorization page
    window.location = "https://accounts.spotify.com/authorize?" + args;
  });
});

/**
 * Initial load logic.
 * Checks for an existing session or an authorization code in the URL.
 */
window.onload = () => {
  const token = localStorage.getItem("spotify_access_token");
  if (token) {
    setLoggedInState(token);
    return;
  }

  // Check if returning from Spotify with an auth code
  const code = new URLSearchParams(window.location.search).get("code");
  if (code) exchangeToken(code);
};

/**
 * Exchanges the Authorization Code for an Access Token using PKCE verifier.
 */
async function exchangeToken(code) {
  const verifier = localStorage.getItem("verifier");
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
    }),
  });

  const data = await response.json();
  if (data.access_token) {
    localStorage.setItem("spotify_access_token", data.access_token);
    // Clean URL by removing the auth code
    history.replaceState(null, null, window.location.pathname);
    setLoggedInState(data.access_token);
  }
}

function setLoggedInState(token) {
  loginButton.textContent = "Log out";
  updateDisplay(token);
}

/**
 * Fetches data from Spotify and populates the main content area.
 * Handles three time ranges: short, medium, and long term.
 */
function updateDisplay(token) {
  const timeRanges = ["short_term", "medium_term", "long_term"];
  const labels = { short_term: "Last 4 weeks", medium_term: "Last 6 months", long_term: "All Time" };
  const container = document.getElementById("content"); // Target container for rendering
  container.innerHTML = "";

  timeRanges.forEach(range => {
    const column = document.createElement("div");
    column.className = "column";
    column.innerHTML = `<h2>${labels[range]}</h2>`;
    container.appendChild(column);

    // Fetching Top Tracks or Top Artists based on currentView
    fetch(`https://api.spotify.com/v1/me/top/${currentView}?time_range=${range}&limit=50`, {
      headers: { Authorization: "Bearer " + token },
    })
    .then(res => res.json())
    .then(data => renderItems(column, data.items))
    .catch(err => console.error("Error fetching data:", err));
  });
}

/**
 * Dynamically creates and injects item cards (tracks or artists) into the DOM.
 */
function renderItems(column, items) {
  items.forEach((item, i) => {
    const card = document.createElement("div");
    card.className = "item-card";
    
    // Select image and subtext based on view type
    const imgUrl = currentView === "tracks" ? item.album.images[1]?.url : item.images[1]?.url;
    const subText = currentView === "tracks" ? item.artists[0].name : "Artist";

    card.innerHTML = `
      <img src="${imgUrl || ''}" alt="${item.name}">
      <div class="item-info">
        <span class="item-name">${i + 1}. ${item.name}</span>
        <span class="item-subtext">${subText}</span>
      </div>
    `;
    column.appendChild(card);
  });
}

/**
 * Clears session and reloads application.
 */
function logout() {
  localStorage.clear();
  location.reload();
}

/**
 * PKCE Helper: Generates a random high-entropy string.
 */
function generateRandomString(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}

/**
 * PKCE Helper: Generates a SHA-256 hash of the verifier string.
 */
async function generateCodeChallenge(verifier) {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}