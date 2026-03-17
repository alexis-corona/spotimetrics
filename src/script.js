const CLIENT_ID = "f07569ad9d194b899802cc1ade23da7c";
const REDIRECT_URI = "https://spotimetrics.web.app/";
const SCOPE = "user-top-read";

const loginButton = document.getElementById("login");

loginButton.addEventListener("click", () => {
  if (loginButton.textContent === "Log out") {
    logout();
    return;
  }

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

    window.location = "https://accounts.spotify.com/authorize?" + args;
  });
});

window.onload = () => {
  const token = localStorage.getItem("spotify_access_token");
  console.log("Access token found in localStorage on page load:", token);

  if (token) {
    setLoggedInState(token);
    return;
  }

  const code = new URLSearchParams(window.location.search).get("code");
  if (!code) {
    setLoggedOutState();
    return;
  }

  const verifier = localStorage.getItem("verifier");

  fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
    }),
  })
    .then(res => res.json())
    .then(data => {
      if(data.error) {
        console.error("Error getting token:", data.error);
        setLoggedOutState();
        return;
      }
      localStorage.removeItem("verifier");
      localStorage.setItem("spotify_access_token", data.access_token);
      history.replaceState(null, null, " ");
      setLoggedInState(data.access_token);
    })
    .catch(() => setLoggedOutState());
};

function setLoggedInState(token) {
  loginButton.textContent = "Log out";
  getTopTracks(token);
}

function setLoggedOutState() {
  localStorage.removeItem("spotify_access_token");
  loginButton.textContent = "Sign in with Spotify";
  document.getElementById("tracks").innerHTML = "";
}

function logout() {
  localStorage.removeItem("spotify_access_token");
  setLoggedOutState();

  location.reload();
}

function getTopTracks(token) {
  const timeRanges = ["short_term", "medium_term", "long_term"];
  const labels = {
    short_term: "Last 4 weeks",
    medium_term: "Last 6 months",
    long_term: "Years"
  };

  const container = document.getElementById("tracks");
  container.innerHTML = "";

  timeRanges.forEach(range => {
    const column = document.createElement("div");
    column.className = "column";

    const title = document.createElement("h2");
    title.textContent = `${labels[range]}`;
    column.appendChild(title);

    fetch(`https://api.spotify.com/v1/me/top/tracks?limit=50&time_range=${range}`, {
      headers: { Authorization: "Bearer " + token },
    })
      .then(res => res.json())
      .then(data => {
        data.items.forEach((track, i) => {
          const div = document.createElement("div");
          div.className = "track";
          div.innerHTML = `
            <strong>${i + 1}. ${track.name}</strong><br>
            <span class="artist">${track.artists[0].name}</span><br>
            <img src="${track.album.images[1].url}" alt="${track.name}">
          `;
          column.appendChild(div);
        });
      });

    container.appendChild(column);
  });
}


function generateRandomString(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++)
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}

async function generateCodeChallenge(verifier) {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}